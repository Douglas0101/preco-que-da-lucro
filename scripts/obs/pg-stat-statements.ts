/**
 * Coletor local de `pg_stat_statements` (§16.3): lê `calls`,
 * `total_exec_time`, `mean_exec_time`, `rows` e `query` das queries críticas do
 * §16.4 (`docs/evidence/explain-critical-queries-2026-08-21.md`) com top-N e
 * redação de parâmetros, e grava JSON+MD em
 * `docs/evidence/pg-stat-statements/`.
 *
 * Local-only por contrato (mesma disciplina de `scripts/obs/pool-activity.ts`):
 * recusa `NODE_ENV=production` e host que não seja loopback
 * (127.0.0.1/localhost/::1). Nunca imprime nem grava a URL de conexão.
 *
 * A extensão não é habilitada aqui: o coletor só mede ambiente onde
 * `shared_preload_libraries=pg_stat_statements` + `CREATE EXTENSION` já rodaram
 * (container efêmero de medição). Ver
 * `docs/evidence/pg-stat-statements-2026-09-15.md`.
 *
 * Uso:
 *   DATABASE_ADMIN_URL=postgresql://postgres@127.0.0.1:5435/pqdl_pgstat \
 *     npx tsx scripts/obs/pg-stat-statements.ts [--top=10]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { normalizeSqlOperation, redactSqlText } from "../../src/instrumentation/sql-redactor";

const EVIDENCE_DIR = "docs/evidence/pg-stat-statements";
export const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "::1"]);
export const DEFAULT_TOP_N = 10;
export const MAX_TOP_N = 50;

/** Regime do artefato: harness local com dataset sintético — nunca `OBSERVED`. */
export const REGIME = "CONTROLLED";

/** Linha crua de `pg_stat_statements` (bigint chega como string pelo driver). */
export interface StatRow {
  query: string;
  calls: number;
  total_exec_time: number;
  mean_exec_time: number;
  rows: number;
}

export interface CriticalTarget {
  label: string;
  /** Forma normalizada (placeholders preservados) da query crítica do §16.4. */
  fingerprint: string;
}

/** Colunas exibidas por linha do relatório. */
export interface ReportRow extends StatRow {
  operation: string;
  critical: string | null;
  redacted_query: string;
}

export interface Report {
  top: ReportRow[];
  critical: ReportRow[];
  missingCritical: string[];
}

const STATEMENTS_SQL = `
  select
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows
  from pg_stat_statements
  where dbid = (select oid from pg_database where datname = current_database())
    and query not like '%pg_stat_statements%'
  order by total_exec_time desc
`;

/** Normaliza SQL para casar com o texto que o Postgres guarda: minúsculas,
 * espaços colapsados, sem espaços em volta de `(`, `)`, `,` e `=`, e
 * placeholders em forma canônica `$0` — a numeração não é estável
 * (`limit 1` vira `limit $3`, depois dos dois parâmetros da query). */
export function normalizeQuery(sql: string): string {
  return sql
    .toLowerCase()
    .replace(/\$\d+/g, "$0")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),=])\s*/g, "$1")
    .trim()
    .replace(/;$/, "");
}

/** As três queries críticas do §16.4, na forma já normalizada. */
export const CRITICAL_QUERIES: readonly CriticalTarget[] = [
  {
    label: "products.list",
    fingerprint: normalizeQuery(
      "select * from products where tenant_id = $1 and archived_at is null order by created_at desc",
    ),
  },
  {
    label: "purchasePrice.latest",
    // `limit 1` chega normalizado como `limit $3` (o Postgres trata o limite
    // como mais uma constante) — `$3` aqui só marca a posição do placeholder.
    fingerprint: normalizeQuery(
      "select * from purchase_price_history where tenant_id = $1 and ingredient_id = $2 order by valid_from desc, recorded_at desc limit $3",
    ),
  },
  {
    label: "dashboard.productIngredients",
    fingerprint: normalizeQuery(
      "select * from product_ingredients where tenant_id = $1 and product_id = any($2)",
    ),
  },
];

/** Rótulo da query crítica que a linha satisfaz, ou `null`. */
export function classifyCriticalQuery(sql: string): string | null {
  const normalized = normalizeQuery(sql);
  return CRITICAL_QUERIES.find((target) => normalized.includes(target.fingerprint))?.label ?? null;
}

export function parseTopN(argv: readonly string[], fallback = DEFAULT_TOP_N): number {
  const prefix = "--top=";
  const argument = argv.find((value) => value.startsWith(prefix));
  if (!argument) return Math.min(fallback, MAX_TOP_N);
  const parsed = Number(argument.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--top exige um inteiro positivo");
  }
  return Math.min(parsed, MAX_TOP_N);
}

/** Guarda local-only: falha fechado e nunca ecoa a connection string. */
export function resolveLocalTarget(env: Record<string, string | undefined>): {
  connectionString: string;
  host: string;
  database: string;
} {
  if (env.NODE_ENV === "production") {
    throw new Error("pg-stat-statements é local-only: NODE_ENV=production recusado");
  }
  const connectionString = env.DATABASE_ADMIN_URL;
  if (!connectionString) throw new Error("DATABASE_ADMIN_URL é obrigatória");
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_ADMIN_URL malformada (fail-closed; valor omitido)");
  }
  const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!LOCAL_HOSTNAMES.has(host)) {
    throw new Error("pg-stat-statements recusa host não-loopback (fail-closed; valor omitido)");
  }
  const database = parsed.pathname.replace(/^\//, "") || "unknown";
  return { connectionString, host, database };
}

/** Coerção defensiva: `pg` entrega bigint como string. */
function toStatRow(raw: Record<string, unknown>): StatRow {
  return {
    query: String(raw.query ?? ""),
    calls: Number(raw.calls ?? 0),
    total_exec_time: Number(raw.total_exec_time ?? 0),
    mean_exec_time: Number(raw.mean_exec_time ?? 0),
    rows: Number(raw.rows ?? 0),
  };
}

function toReportRow(row: StatRow): ReportRow {
  return {
    ...row,
    operation: normalizeSqlOperation(row.query),
    critical: classifyCriticalQuery(row.query),
    redacted_query: redactSqlText(row.query),
  };
}

/** Redige, classifica e ordena por `total_exec_time` desc, cortando no top-N. */
export function buildReport(rows: readonly StatRow[], topN: number): Report {
  const reportRows = rows.map(toReportRow);
  const top = [...reportRows]
    .sort(
      (a, b) =>
        b.total_exec_time - a.total_exec_time ||
        b.calls - a.calls ||
        a.redacted_query.localeCompare(b.redacted_query),
    )
    .slice(0, Math.min(topN, MAX_TOP_N));
  const found = new Set(reportRows.map((row) => row.critical).filter((value) => value !== null));
  return {
    top,
    critical: CRITICAL_QUERIES.filter((target) => found.has(target.label)).map((target) =>
      reportRows.find((row) => row.critical === target.label)!,
    ),
    missingCritical: CRITICAL_QUERIES.filter((target) => !found.has(target.label)).map(
      (target) => target.label,
    ),
  };
}

function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length)),
  );
  const renderRow = (cells: string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column]!)).join(" | ")} |`;
  const separator = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  return [renderRow(headers), separator, ...rows.map(renderRow)].join("\n");
}

const STATS_HEADERS = [
  "critical",
  "operation",
  "calls",
  "total_exec_time_ms",
  "mean_exec_time_ms",
  "rows",
];

function statsTable(rows: readonly ReportRow[]): string {
  if (rows.length === 0) return "(nenhuma)";
  return renderTable(STATS_HEADERS, [
    ...rows.map((row) => [
      row.critical ?? "-",
      row.operation,
      String(row.calls),
      row.total_exec_time.toFixed(3),
      row.mean_exec_time.toFixed(3),
      String(row.rows),
    ]),
  ]);
}

function queryTable(rows: readonly ReportRow[]): string {
  if (rows.length === 0) return "(nenhuma)";
  return renderTable(
    ["critical", "query (redigida)"],
    rows.map((row) => [row.critical ?? "-", row.redacted_query]),
  );
}

export function renderMarkdown(meta: {
  generatedAt: string;
  host: string;
  database: string;
  topN: number;
  totalStatements: number;
  top: readonly ReportRow[];
  critical: readonly ReportRow[];
  missingCritical: readonly string[];
}): string {
  return `# pg_stat_statements — queries críticas (§16.3)

Coletor local: \`scripts/obs/pg-stat-statements.ts\`. Regime: **${REGIME}** (host loopback, dataset sintético de teste) — **nunca** \`OBSERVED\`.

- Gerado em: ${meta.generatedAt}
- Host: ${meta.host} (loopback)
- Banco: ${meta.database}
- Statements observados no banco: ${meta.totalStatements}
- Top-N exibido: ${meta.topN}

## Queries críticas do §16.4 encontradas

${statsTable(meta.critical)}

Alvos não observados: ${meta.missingCritical.length ? meta.missingCritical.join(", ") : "(nenhum)"}

## Top-${meta.topN} por \`total_exec_time\`

${statsTable(meta.top)}

## Texto das queries (parâmetros redigidos)

${queryTable([...meta.critical, ...meta.top.filter((row) => row.critical === null)])}
`;
}

function describeMissingExtension(error: unknown): string | undefined {
  const code = (error as { code?: string } | null)?.code;
  if (code === "42P01") {
    return "extensão pg_stat_statements ausente: rode em ambiente com shared_preload_libraries=pg_stat_statements + CREATE EXTENSION (container efêmero de medição)";
  }
  return undefined;
}

async function readStatements(client: Client): Promise<StatRow[]> {
  try {
    const result = await client.query<Record<string, unknown>>(STATEMENTS_SQL);
    return result.rows.map(toStatRow);
  } catch (error) {
    const hint = describeMissingExtension(error);
    if (hint) throw new Error(hint);
    throw error;
  }
}

async function main(): Promise<void> {
  const { connectionString, host, database } = resolveLocalTarget(process.env);
  const topN = parseTopN(process.argv.slice(2));

  const client = new Client({ connectionString });
  await client.connect();
  let rows: StatRow[];
  try {
    rows = await readStatements(client);
  } finally {
    await client.end().catch(() => undefined);
  }

  const report = buildReport(rows, topN);
  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const outputDirectory = resolve(process.cwd(), EVIDENCE_DIR);
  await mkdir(outputDirectory, { recursive: true });

  const payload = {
    check: "obs:pg-stat-statements",
    read_only: true,
    regime: REGIME,
    generated_at: generatedAt,
    environment: { host, database, local_only: true, top_n: topN },
    total_statements: rows.length,
    missing_critical: report.missingCritical,
    critical: report.critical,
    top: report.top,
  };
  const jsonPath = resolve(outputDirectory, `pg-stat-statements-${stamp}.json`);
  const markdownPath = resolve(outputDirectory, `pg-stat-statements-${stamp}.md`);
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(
    markdownPath,
    renderMarkdown({ generatedAt, host, database, topN, totalStatements: rows.length, ...report }),
  );

  console.log(
    `pg-stat-statements: ${rows.length} statements · ${report.critical.length}/${CRITICAL_QUERIES.length} queries críticas observadas (regime ${REGIME})`,
  );
  for (const row of report.critical) {
    console.log(
      `pg-stat-statements: ${row.critical} calls=${row.calls} total=${row.total_exec_time.toFixed(3)}ms mean=${row.mean_exec_time.toFixed(3)}ms rows=${row.rows}`,
    );
  }
  if (report.missingCritical.length) {
    console.log(`pg-stat-statements: alvos ausentes: ${report.missingCritical.join(", ")}`);
  }
  console.log(`pg-stat-statements: ${jsonPath}`);
  console.log(`pg-stat-statements: ${markdownPath}`);
}

// Guarda de entrypoint (padrão canônico do repositório, ver error-budget.ts):
// importar este módulo (teste) nunca abre conexão com o banco.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main().catch((error: unknown) => {
    console.error(`pg-stat-statements: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  });
}
