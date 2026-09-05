import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";

interface CheckResult {
  id: string;
  status: "PASS" | "FAIL";
  detail: unknown;
}

const results: CheckResult[] = [];

function record(id: string, pass: boolean, detail: unknown): boolean {
  results.push({ id, status: pass ? "PASS" : "FAIL", detail });
  return pass;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main(): Promise<void> {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    console.error(
      JSON.stringify({ error: "DATABASE_ADMIN_URL é obrigatória para o smoke de substrato" }),
    );
    process.exit(2);
  }

  const pool = new Pool({ connectionString: adminUrl, ssl: { rejectUnauthorized: false } });
  const startedAt = new Date().toISOString();

  try {
    const version = await pool.query<{ server_version_num: string }>(
      "select current_setting('server_version_num') as server_version_num",
    );
    const expectedMajor = process.env.EXPECTED_POSTGRES_MAJOR ?? "17";
    const actualMajor = version.rows[0]!.server_version_num.slice(0, 2);
    record("postgres-major", actualMajor === expectedMajor, {
      expected: expectedMajor,
      actual: version.rows[0]!.server_version_num,
    });

    const journalFile = resolve(import.meta.dirname, "../../drizzle/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalFile, "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const applied = await pool.query<{ count: string }>(
      "select count(*)::text as count from drizzle.__drizzle_migrations",
    );
    const hashes = await pool.query<{ hash: string }>(
      "select hash from drizzle.__drizzle_migrations order by created_at, id",
    );
    const dbHashes = hashes.rows.map((row) => row.hash);
    const dbCount = Number(applied.rows[0]!.count);
    record("journal-count", dbCount === journal.entries.length, {
      expected: journal.entries.length,
      actual: dbCount,
    });

    const hashMismatches: { idx: number; tag: string; local: string; remote: string }[] = [];
    for (const entry of journal.entries) {
      const local = sha256(
        readFileSync(resolve(import.meta.dirname, `../../drizzle/${entry.tag}.sql`), "utf8"),
      );
      const remote = dbHashes[entry.idx];
      if (local !== remote) hashMismatches.push({ idx: entry.idx, tag: entry.tag, local, remote });
    }
    record("journal-hashes", hashMismatches.length === 0, {
      reconciled: journal.entries.length - hashMismatches.length,
      mismatches: hashMismatches,
    });

    const runtimeRole = await pool.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>("select rolname, rolsuper, rolbypassrls from pg_roles where rolname = 'app_runtime'");
    const role = runtimeRole.rows[0];
    record(
      "app-runtime-role",
      Boolean(role && !role.rolsuper && !role.rolbypassrls),
      role ?? "app_runtime ausente",
    );

    const tenantTables = await pool.query<{
      table_name: string;
      rowsecurity: boolean;
      tableowner: string;
    }>(
      `select c.relname as table_name, c.relrowsecurity as rowsecurity, pg_get_userbyid(c.relowner) as tableowner
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join information_schema.columns col
         on col.table_schema = n.nspname and col.table_name = c.relname and col.column_name = 'tenant_id'
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    const rlsFailures = tenantTables.rows.filter(
      (table) => !table.rowsecurity || table.tableowner === "app_runtime",
    );
    record("tenant-tables-rls", rlsFailures.length === 0, {
      checked: tenantTables.rows.length,
      failures: rlsFailures,
    });

    const accounts = await pool.query<{ issuer: string | null; count: string }>(
      "select issuer, count(*)::text as count from accounts group by issuer",
    );
    const issuerNull = Number(accounts.rows.find((row) => row.issuer === null)?.count ?? "0");
    record("accounts-issuer-null", issuerNull === 0, {
      detail: "issuer IS NULL quebra sign-in com better-auth 1.7.x",
      issuer_counts: accounts.rows,
    });

    const pass = results.every((result) => result.status === "PASS");
    console.log(
      JSON.stringify(
        {
          check: "smoke:substrate",
          read_only: true,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          result: pass ? "PASS" : "FAIL",
          results,
        },
        null,
        2,
      ),
    );
    process.exitCode = pass ? 0 : 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ error: String(error) }));
  process.exit(2);
});
