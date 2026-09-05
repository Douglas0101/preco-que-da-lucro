import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

interface PhaseResult {
  name: string;
  status: "PASS" | "FAIL";
  duration_ms: number;
  detail: unknown;
}

const repositoryRoot = resolve(import.meta.dirname, "../..");
const SCRATCH_PREFIX = "drill_restore_";
const DOCKER_IMAGE = "postgres:17-alpine";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function docker(args: string[], env: Record<string, string>): void {
  // S4036: resolve "docker" only in fixed, system-owned directories.
  execFileSync("docker", args, {
    cwd: repositoryRoot,
    stdio: ["ignore", "inherit", "inherit"],
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", ...env },
  });
}

function scratchUrl(adminUrl: string, scratchName: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${scratchName}`;
  return url.toString();
}

async function tableCounts(pool: Pool): Promise<Record<string, number>> {
  const tables = await pool.query<{ table_name: string }>(
    "select tablename as table_name from pg_tables where schemaname = 'public' order by 1",
  );
  const counts: Record<string, number> = {};
  for (const { table_name } of tables.rows) {
    const result = await pool.query<{ count: string }>(
      `select count(*)::text as count from public."${table_name.replaceAll('"', '""')}"`,
    );
    counts[table_name] = Number(result.rows[0]!.count);
  }
  const journal = await pool.query<{ count: string }>(
    "select count(*)::text as count from drizzle.__drizzle_migrations",
  );
  counts["drizzle.__drizzle_migrations"] = Number(journal.rows[0]!.count);
  return counts;
}

async function journalHashes(pool: Pool): Promise<string[]> {
  const rows = await pool.query<{ hash: string }>(
    "select hash from drizzle.__drizzle_migrations order by created_at, id",
  );
  return rows.rows.map((row) => row.hash);
}

async function rlsReport(
  pool: Pool,
): Promise<{ rls_enabled: number; tenant_tables: number; policies: number }> {
  const tenantTables = await pool.query<{ count: string }>(
    `select count(*)::text as count
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join information_schema.columns col
       on col.table_schema = n.nspname and col.table_name = c.relname and col.column_name = 'tenant_id'
     where n.nspname = 'public' and c.relkind = 'r'`,
  );
  const rlsEnabled = await pool.query<{ count: string }>(
    `select count(*)::text as count
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     join information_schema.columns col
       on col.table_schema = n.nspname and col.table_name = c.relname and col.column_name = 'tenant_id'
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity`,
  );
  const policies = await pool.query<{ count: string }>(
    "select count(*)::text as count from pg_policies where schemaname = 'public'",
  );
  return {
    tenant_tables: Number(tenantTables.rows[0]!.count),
    rls_enabled: Number(rlsEnabled.rows[0]!.count),
    policies: Number(policies.rows[0]!.count),
  };
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    console.error(
      JSON.stringify({
        error: "DATABASE_ADMIN_URL (direct/unpooled) é obrigatória para o drill de backup",
      }),
    );
    process.exit(2);
  }
  const productionDb = new URL(adminUrl).pathname.replace("/", "");
  if (!productionDb || productionDb.startsWith(SCRATCH_PREFIX)) {
    console.error(
      JSON.stringify({ error: "DATABASE_ADMIN_URL deve apontar para o banco de produção" }),
    );
    process.exit(2);
  }

  const stamp = new Date().toISOString().replaceAll(/[-:T]/g, "").slice(0, 14);
  const scratchName = `${SCRATCH_PREFIX}${stamp}`;
  const artifactDir = resolve(repositoryRoot, `.artifacts/backup-drill/${stamp}`);
  mkdirSync(artifactDir, { recursive: true });

  const phases: PhaseResult[] = [];
  const startedAt = new Date().toISOString();
  const phase = async (name: string, fn: () => Promise<unknown>): Promise<boolean> => {
    const start = Date.now();
    try {
      const detail = await fn();
      phases.push({ name, status: "PASS", duration_ms: Date.now() - start, detail });
      return true;
    } catch (error) {
      phases.push({ name, status: "FAIL", duration_ms: Date.now() - start, detail: String(error) });
      return false;
    }
  };

  const source = new Pool({ connectionString: adminUrl, ssl: { rejectUnauthorized: false } });
  let sourceCounts: Record<string, number> = {};
  let sourceHashes: string[] = [];

  try {
    let halted = false;
    const runPhase = async (name: string, fn: () => Promise<unknown>): Promise<boolean> => {
      if (halted) return false;
      const ok = await phase(name, fn);
      if (!ok) halted = true;
      return ok;
    };

    // Fase 1 — leitura da origem (read-only)
    await runPhase("source-inventory", async () => {
      sourceCounts = await tableCounts(source);
      sourceHashes = await journalHashes(source);
      return { tables: Object.keys(sourceCounts).length, journal_entries: sourceHashes.length };
    });

    // Fase 2 — snapshot externo (pg_dump custom format via docker; credencial via env, nunca em argv)
    await runPhase("pg-dump", async () => {
      docker(
        [
          "run",
          "--rm",
          "-v",
          `${artifactDir}:/out`,
          "-e",
          "PGSRC",
          DOCKER_IMAGE,
          "sh",
          "-c",
          'pg_dump "$PGSRC" -Fc -f /out/dump.pgc',
        ],
        { PGSRC: adminUrl },
      );
      const dump = readFileSync(resolve(artifactDir, "dump.pgc"));
      return { bytes: dump.length, sha256: sha256(dump.toString("latin1")) };
    });

    // Fase 3 — restore em banco efêmero (criação/destruição autorizadas: drill A4)
    await runPhase("scratch-create", async () => {
      await source.query(`CREATE DATABASE "${scratchName}"`);
      return { scratch: scratchName };
    });

    if (!halted) {
      let scratchReady = false;
      try {
        if (
          await runPhase("pg-restore", async () => {
            docker(
              [
                "run",
                "--rm",
                "-v",
                `${artifactDir}:/out`,
                "-e",
                "PGDST",
                DOCKER_IMAGE,
                "sh",
                "-c",
                'pg_restore -d "$PGDST" --exit-on-error --no-owner --no-privileges /out/dump.pgc',
              ],
              { PGDST: scratchUrl(adminUrl, scratchName) },
            );
            return { scratch: scratchName };
          })
        ) {
          scratchReady = true;

          // Fase 4 — verificação do conteúdo restaurado
          await runPhase("verify", async () => {
            const scratch = new Pool({
              connectionString: scratchUrl(adminUrl, scratchName),
              ssl: { rejectUnauthorized: false },
            });
            try {
              const restoredCounts = await tableCounts(scratch);
              const mismatches = Object.entries(sourceCounts).filter(
                ([table, count]) => restoredCounts[table] !== count,
              );
              const restoredHashes = await journalHashes(scratch);
              const journalFile = resolve(repositoryRoot, "drizzle/meta/_journal.json");
              const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
                entries: { idx: number; tag: string }[];
              };
              const hashMismatches: string[] = [];
              for (const entry of journal.entries) {
                const local = sha256(
                  readFileSync(resolve(repositoryRoot, `drizzle/${entry.tag}.sql`), "utf8"),
                );
                if (restoredHashes[entry.idx] !== local) hashMismatches.push(entry.tag);
              }
              const rls = await rlsReport(scratch);
              const ok =
                mismatches.length === 0 &&
                hashMismatches.length === 0 &&
                restoredHashes.length === sourceHashes.length &&
                rls.tenant_tables === rls.rls_enabled &&
                rls.rls_enabled > 0;
              if (!ok) {
                throw new Error(
                  JSON.stringify({
                    mismatches,
                    hashMismatches,
                    rls,
                    journal: restoredHashes.length,
                  }),
                );
              }
              return {
                tables_compared: Object.keys(sourceCounts).length,
                journal_reconciled: `${restoredHashes.length}/${journal.entries.length}`,
                rls,
              };
            } finally {
              await scratch.end();
            }
          });
        }
      } finally {
        // Fase 5 — destruição do banco efêmero (sempre que o create rodou)
        await phase("scratch-drop", async () => {
          if (!scratchName.startsWith(SCRATCH_PREFIX)) throw new Error("nome de scratch inválido");
          await source.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
          return { dropped: scratchName, restored_before_drop: scratchReady };
        });
      }
    }

    const pass = !halted && phases.every((p) => p.status === "PASS");
    const report = {
      check: "m02:backup-verify",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      result: pass ? "PASS" : "FAIL",
      production_db: productionDb,
      scratch_db: scratchName,
      artifact_dir: artifactDir,
      restore_flags: "--no-owner --no-privileges",
      limits:
        "Cobre dados, journal de migrations, RLS flags, policies e constraints. Ownership e GRANTs não são restaurados (--no-owner --no-privileges) porque objetos internos Neon pertencem a roles de serviço (ex.: neon_service).",
      phases,
    };
    writeFileSync(resolve(artifactDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = pass ? 0 : 1;
  } finally {
    await source.end();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: String(error) }));
  process.exit(2);
});
