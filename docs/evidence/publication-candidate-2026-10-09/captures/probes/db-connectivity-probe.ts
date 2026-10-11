/**
 * Probe sanitizado de conectividade Postgres contra banco isolado.
 *
 * Executa um cenário por processo, porque `getDatabase()` memoiza o pool no
 * registro de módulo e um processo só poderia provar uma forma de conexão:
 *
 *   S1  `select 1 asReady` pelo caminho real da aplicação, contra o container
 *       efêmero `postgres:17-alpine` do `docker-compose.yml` (loopback, dado
 *       descartável — nunca produção, nunca Neon).
 *   S2..S6  as formas de falha que o incidente de 2026-10-08 não conseguiu
 *       distinguir, agora passadas pelo classificador
 *       (`src/lib/db-failure-classifier.ts`): host inexistente, senha errada,
 *       porta fechada, banco inexistente e credencial com padding.
 *
 * Nada sensível é impresso. A saída de cada cenário é a classificação
 * (componente, categoria, etapa, código aprovado, transient, elos inspecionados)
 * mais o tempo gasto. O probe termina com auto-verificação: se alguma substring
 * de credencial chegou ao stdout, ele reprova.
 *
 * Uso: npx tsx <este arquivo> <s1|s2|s3|s4|s5|s6|all>
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyDatabaseFailure } from "@/lib/db-failure-classifier";

const LOOPBACK = "postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test";
const DEAD_HOST = "postgresql://postgres:postgres@ep-dead-endpoint-abc123.invalid:5432/neondb";
const scenario = process.argv[2] ?? "all";

async function runSuccess(): Promise<string> {
  process.env.DATABASE_URL = LOOPBACK;
  process.env.DATABASE_ADMIN_URL = LOOPBACK;
  process.env.DATABASE_DRIVER = "node-postgres";
  const { getDatabase } = await import("@/db/client.server");
  const { sql } = await import("drizzle-orm");
  const started = Date.now();
  await getDatabase().execute(sql`select 1 as ready`);
  const result = (await getDatabase().execute(sql`select version() as version`)) as unknown as {
    rows?: Array<{ version?: string }>;
  };
  const version = result.rows?.[0]?.version ?? "";
  const major = /PostgreSQL (\d+)/.exec(version)?.[1] ?? "?";
  return [
    "S1 select-1-ok",
    `elapsed_ms=${Date.now() - started}`,
    `pg_major=${major}`,
    "path=getDatabase().execute",
  ].join(" ");
}

async function runFailure(label: string, connectionString: string): Promise<string> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 1 });
  const started = Date.now();
  try {
    await pool.query("select 1 as ready");
    return `${label} UNEXPECTED-SUCCESS`;
  } catch (error) {
    const diagnosis = classifyDatabaseFailure(error);
    return [
      label,
      `elapsed_ms=${Date.now() - started}`,
      `category=${diagnosis.category}`,
      `step=${diagnosis.step}`,
      `code=${diagnosis.code ?? "none"}`,
      `transient=${diagnosis.transient}`,
      `inspectedCauses=${diagnosis.inspectedCauses}`,
    ].join(" ");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

const SCENARIOS: Record<string, () => Promise<string>> = {
  s1: runSuccess,
  s2: () => runFailure("S2 host-inexistente", DEAD_HOST),
  s3: () => runFailure("S3 senha-errada", "postgresql://postgres:senha-errada@127.0.0.1:5432/db"),
  s4: () => runFailure("S4 porta-fechada", "postgresql://postgres:postgres@127.0.0.1:5433/db"),
  s5: () =>
    runFailure(
      "S5 banco-inexistente",
      "postgresql://postgres:postgres@127.0.0.1:5432/inexistente_db",
    ),
};

/** Um cenário por processo; a saída do filho já é sanitizada pelo classificador. */
async function childRun(name: string): Promise<string> {
  const self = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, ["--import", "tsx", self, name], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  let out = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    out += chunk;
  });
  const code = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  return `${out.trim()} exit=${code}`;
}

/**
 * Auto-verificação anti-vazamento. As agulhas são **substrings das connection
 * strings**, nunca dos rótulos de cenário: um rótulo como `S3 senha-errada`
 * descreve a forma da falha e não é credencial. Se alguma dessas substring
 * chegar ao stdout, a credenciação vazou e o probe reprova — evidência
 * sanitizada que vaza é pior que evidência ausente.
 */
function assertSanitized(output: string): void {
  const forbidden = [
    "postgres:postgres@",
    "senha-errada@",
    "127.0.0.1:5432",
    "127.0.0.1:5433",
    "preco_que_da_lucro_test",
    "inexistente_db@",
  ];
  const leaked = forbidden.filter((needle) => output.includes(needle));
  if (leaked.length > 0) {
    process.stdout.write(`AUTOVERIFY=LEAK ${leaked.join(",")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("AUTOVERIFY=ok nenhuma substring de credencial alcancou stdout\n");
}

if (scenario === "all") {
  const lines: string[] = [];
  for (const name of Object.keys(SCENARIOS)) lines.push(await childRun(name));
  const output = `${lines.join("\n")}\n`;
  process.stdout.write(output);
  assertSanitized(output);
} else {
  const run = SCENARIOS[scenario];
  if (!run) {
    process.stdout.write(`cenário desconhecido: ${scenario}\n`);
    process.exitCode = 2;
  } else {
    const output = `${await run()}\n`;
    process.stdout.write(output);
    assertSanitized(output);
  }
}
