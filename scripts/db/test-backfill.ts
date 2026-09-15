/**
 * §28 — integração real do runner de backfill contra o banco descartável (PG17).
 *
 * Caso sintético (nenhuma tabela do schema de produção é alterada — a fixture
 * `backfill_demo_rows` é criada por este script): preencher uma coluna derivada
 * de 10 linhas com o runner, provando lote, checkpoint, rate-limit,
 * idempotência e observabilidade contra Postgres de verdade.
 *
 * Fases:
 *   D  erro real do servidor (22012) no meio de um lote ⇒ aborta, o checkpoint
 *      fica no lote anterior e o marcador da linha que falhou NÃO fica gravado
 *      (rollback da transação do efeito); o operador limpa o veneno e retoma.
 *   A  SIGKILL de verdade no meio do run (processo filho) ⇒ o efeito já
 *      aplicado fica gravado, mas o lote não fecha: o checkpoint atrasa.
 *   B  retomada ⇒ relê o lote inteiro; o efeito já aplicado volta `duplicate`.
 *   C  2ª tentativa completa (checkpoint novo, mesma `workKey`) ⇒ 0 efeitos
 *      novos, estado idêntico ⇒ idempotência global.
 *
 * Uso:
 *   npx tsx scripts/db/test-backfill.ts                 # narrativa completa
 *   npx tsx scripts/db/test-backfill.ts --phase=crash    # filho (morre no meio)
 *   npx tsx scripts/db/test-backfill.ts --phase=teardown # remove as tabelas daqui
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import {
  BackfillAbortedError,
  createBackfillRunner,
  type BackfillProgressEvent,
  type BackfillRunSummary,
  type BackfillSink,
  type BackfillSource,
} from "./backfill-runner";
import {
  applyWorkItemOnce,
  createPostgresCheckpointStore,
  ensureBackfillLedger,
} from "./backfill-ledger";
import { requireAdminUrl, runMigrations } from "./migrate";

const WORK_KEY = "backfill-demo.derived_amount:v1";
const MAIN_RUN_KEY = "backfill-demo:attempt-1";
const VERIFY_RUN_KEY = "backfill-demo:attempt-2";
const POISON_RUN_KEY = "backfill-demo:poison-attempt-1";
const BATCH_SIZE = 3;
const RATE_LIMIT = { maxRows: 4, windowMs: 50 };
const CRASH_AFTER_ROW = 4;

const FIXTURE_DDL = `
drop table if exists backfill_demo_rows;
create table backfill_demo_rows (
  id text primary key,
  amount numeric(12,2) not null,
  derived_amount numeric(12,2),
  apply_count integer not null default 0,
  poison boolean not null default false
);
`;

interface DemoRow {
  id: string;
  amount: string;
  poison: boolean;
}

interface FixtureState {
  rows: number;
  derived: number;
  maxApplies: number;
  duplicated: number;
  workItems: number;
  checkpoint: string;
}

function rowId(index: number): string {
  return `d${String(index).padStart(2, "0")}`;
}

/** Zera fixtures e ledger e semeia `count` linhas (opcionalmente uma venenosa). */
async function seed(pool: Pool, count: number, options: { poisonAt?: number } = {}): Promise<void> {
  await pool.query("truncate backfill_demo_rows, backfill_work_items, backfill_checkpoints");
  for (let index = 1; index <= count; index += 1) {
    await pool.query(
      `insert into backfill_demo_rows (id, amount, poison) values ($1, $2, $3)`,
      [rowId(index), (100 + index * 10).toFixed(2), options.poisonAt === index],
    );
  }
}

function demoSource(pool: Pool): BackfillSource<DemoRow> {
  return {
    fetchChunk: async ({ cursor, batchSize }) => {
      const result = await pool.query<DemoRow>(
        `select id, amount, poison from backfill_demo_rows
         where ($1::text is null or id > $1)
         order by id
         limit $2`,
        [cursor, batchSize],
      );
      return result.rows;
    },
  };
}

/** Efeito transacional com o marcador (`applyWorkItemOnce`): grava 1× por linha. */
function demoEffectSink(
  pool: Pool,
  hooks: { afterProcessed?: (processed: number) => void } = {},
): BackfillSink<DemoRow> {
  let processed = 0;
  return {
    apply: async (row, context) => {
      const outcome = await applyWorkItemOnce(pool, {
        workKey: context.workKey,
        runKey: context.runKey,
        rowKey: context.rowKey,
        effect: async (client) => {
          // Erro de servidor de verdade na linha envenenada (SQLSTATE 22012).
          if (row.poison) await client.query("select 1 / $1::int", [0]);
          await client.query(
            `update backfill_demo_rows
             set derived_amount = round(amount * 1.2, 2), apply_count = apply_count + 1
             where id = $1`,
            [row.id],
          );
        },
      });
      processed += 1;
      hooks.afterProcessed?.(processed);
      return outcome;
    },
  };
}

function printProgress(event: BackfillProgressEvent): void {
  console.log(
    `    [${event.type} lote ${event.batch}] linhas=${event.rows} lidas=${event.rowsScanned} ` +
      `aplicadas=${event.rowsApplied} duplicadas=${event.rowsDuplicate} erros=${event.errors} ` +
      `cursor=${event.cursor ?? "-"} taxa=${event.rowsPerSecond.toFixed(1)}/s ` +
      `checkpoint=${event.checkpoint.completed ? "concluído" : "em curso"}`,
  );
}

function printSummary(label: string, summary: BackfillRunSummary): void {
  console.log(
    `  ${label}: lotes=${summary.batches} lidas=${summary.rowsScanned} aplicadas=${summary.rowsApplied} ` +
      `duplicadas=${summary.rowsDuplicate} erros=${summary.errors} taxa=${summary.rowsPerSecond.toFixed(1)}/s ` +
      `esperas=${summary.rateLimitWaits}(${summary.rateLimitWaitMs}ms) checkpoint=${summary.checkpoint.cursor}/${summary.checkpoint.completed ? "concluído" : "em curso"} ` +
      `retomada=${summary.resumed} duração=${summary.durationMs}ms`,
  );
}

function buildRunner(
  pool: Pool,
  options: {
    runKey: string;
    batchSize: number;
    crashAfter?: number;
    rateLimit?: { maxRows: number; windowMs: number };
    onProgress?: (event: BackfillProgressEvent) => void;
  },
) {
  return createBackfillRunner<DemoRow>({
    workKey: WORK_KEY,
    runKey: options.runKey,
    batchSize: options.batchSize,
    keyOf: (row) => row.id,
    source: demoSource(pool),
    sink: demoEffectSink(pool, {
      afterProcessed: (processed) => {
        if (options.crashAfter === processed) process.kill(process.pid, "SIGKILL");
      },
    }),
    checkpoints: createPostgresCheckpointStore(pool),
    rateLimit: options.rateLimit,
    onProgress: options.onProgress ?? printProgress,
  });
}

async function readState(pool: Pool, runKey: string): Promise<FixtureState> {
  const rows = await pool.query<{
    rows: number;
    derived: number;
    max_applies: number;
    duplicated: number;
  }>(
    `select count(*)::int as rows,
            count(derived_amount)::int as derived,
            coalesce(max(apply_count), 0)::int as max_applies,
            count(*) filter (where apply_count > 1)::int as duplicated
     from backfill_demo_rows`,
  );
  const items = await pool.query<{ items: number }>(
    `select count(*)::int as items from backfill_work_items where work_key like $1`,
    [`${WORK_KEY}#%`],
  );
  const checkpoint = await pool.query<{
    cursor: string | null;
    completed: boolean;
    batches: number;
    rows_scanned: number;
    rows_applied: number;
    rows_duplicate: number;
    errors: number;
  }>(
    `select cursor, completed, batches, rows_scanned, rows_applied, rows_duplicate, errors
     from backfill_checkpoints where run_key = $1`,
    [runKey],
  );
  const row = rows.rows[0];
  const cp = checkpoint.rows[0];
  return {
    rows: row.rows,
    derived: row.derived,
    maxApplies: row.max_applies,
    duplicated: row.duplicated,
    workItems: items.rows[0].items,
    checkpoint: cp
      ? `${cp.cursor ?? "-"}/lotes=${cp.batches}/lidas=${cp.rows_scanned}/aplicadas=${cp.rows_applied}/dup=${cp.rows_duplicate}/erros=${cp.errors}/${cp.completed ? "concluído" : "em curso"}`
      : "ausente",
  };
}

async function printState(pool: Pool, label: string, runKey: string): Promise<void> {
  const state = await readState(pool, runKey);
  console.log(
    `  estado (${label}): linhas=${state.rows} derivadas=${state.derived} max_apply_count=${state.maxApplies} ` +
      `linhas_duplicadas=${state.duplicated} marcadores=${state.workItems} checkpoint=${state.checkpoint}`,
  );
}

/** Deriva a coluna de uma linha só (o efeito), usada pelo filho do SIGKILL. */
async function crashPhase(): Promise<void> {
  const pool = new Pool({ connectionString: requireAdminUrl(), max: 2 });
  try {
    await ensureBackfillLedger(pool);
    console.log(
      `  [filho] run ${MAIN_RUN_KEY} batchSize=${BATCH_SIZE} · SIGKILL após processar a linha ${CRASH_AFTER_ROW}`,
    );
    await buildRunner(pool, {
      runKey: MAIN_RUN_KEY,
      batchSize: BATCH_SIZE,
      crashAfter: CRASH_AFTER_ROW,
      rateLimit: RATE_LIMIT,
    }).run();
    throw new Error("o run deveria ter morrido por SIGKILL");
  } finally {
    await pool.end();
  }
}

/** D — falha real do servidor no meio do lote: aborta, checkpoint atrasa, retoma. */
async function poisonPhase(pool: Pool): Promise<void> {
  console.log(
    "\n== T1/T4 — erro real do Postgres (22012) no meio do lote: aborta, checkpoint no lote anterior, retoma ==",
  );
  await seed(pool, 4, { poisonAt: 4 });
  await printState(pool, "antes", POISON_RUN_KEY);

  const failure = await buildRunner(pool, { runKey: POISON_RUN_KEY, batchSize: 2 })
    .run()
    .then(
      () => null,
      (error: unknown) => error,
    );
  assert.ok(failure instanceof BackfillAbortedError, "22012 deve abortar o run");
  printSummary("abortado", failure.summary);
  assert.equal(failure.summary.errors, 1);
  assert.equal(failure.summary.rowsApplied, 3);
  assert.equal(failure.summary.checkpoint.cursor, "d02");
  await printState(pool, "após o abort", POISON_RUN_KEY);
  const afterAbort = await readState(pool, POISON_RUN_KEY);
  assert.equal(afterAbort.derived, 3, "d03 foi aplicado antes da falha");
  assert.equal(afterAbort.workItems, 3, "marcador de d03 sobrevive (efeito commitado)");
  assert.equal(afterAbort.duplicated, 0);
  const orphan = await pool.query<{ items: number }>(
    `select count(*)::int as items from backfill_work_items where row_key = 'd04'`,
  );
  assert.equal(orphan.rows[0].items, 0, "marcador e efeito falho caem na MESMA transação");

  await pool.query("update backfill_demo_rows set poison = false where id = 'd04'");
  const resumed = await buildRunner(pool, { runKey: POISON_RUN_KEY, batchSize: 2 }).run();
  printSummary("retomada", resumed);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.rowsScanned, 2, "retoma relendo o lote inteiro (d03, d04)");
  assert.equal(resumed.rowsDuplicate, 1);
  assert.equal(resumed.rowsApplied, 1);
  assert.equal(resumed.completed, true);
  const final = await readState(pool, POISON_RUN_KEY);
  await printState(pool, "final", POISON_RUN_KEY);
  assert.equal(final.derived, 4);
  assert.equal(final.maxApplies, 1, "nenhuma linha recebeu o efeito duas vezes");
  assert.equal(final.duplicated, 0);
  assert.equal(final.workItems, 4);
}

/** A/B/C — SIGKILL de verdade no meio do run, retomada e 2ª tentativa completa. */
async function crashAndResumePhases(pool: Pool): Promise<void> {
  console.log(
    `\n== T1/T2 — SIGKILL no meio do run (10 linhas, batchSize=${BATCH_SIZE}, rate-limit ${RATE_LIMIT.maxRows}/${RATE_LIMIT.windowMs}ms) ==`,
  );
  await seed(pool, 10);
  await printState(pool, "antes", MAIN_RUN_KEY);

  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(import.meta.url), "--phase=crash"],
    { env: process.env, stdio: "inherit" },
  );
  console.log(`  [pai] filho: status=${child.status} signal=${child.signal} (morte real no meio do run)`);
  assert.equal(child.signal, "SIGKILL", "o run precisa ter morrido por SIGKILL");
  assert.equal(child.status, null);

  await printState(pool, "após o SIGKILL", MAIN_RUN_KEY);
  const crashed = await readState(pool, MAIN_RUN_KEY);
  assert.equal(crashed.derived, 4, "d04 foi aplicado (transação própria) antes da morte");
  assert.equal(crashed.workItems, 4);
  assert.equal(crashed.checkpoint.startsWith("d03/"), true, "checkpoint no último lote fechado");

  console.log("  -- retomada (mesmo runKey) --");
  const resumed = await buildRunner(pool, {
    runKey: MAIN_RUN_KEY,
    batchSize: BATCH_SIZE,
    rateLimit: RATE_LIMIT,
  }).run();
  printSummary("retomada", resumed);
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.rowsScanned, 7, "relê d04..d10 (o lote interrompido inteiro)");
  assert.equal(resumed.rowsDuplicate, 1, "d04 volta como duplicata, não é reaplicada");
  assert.equal(resumed.rowsApplied, 6);
  assert.equal(resumed.errors, 0);
  assert.equal(resumed.rateLimitWaits, 1, "7 linhas em janelas de 4 ⇒ 1 espera");
  assert.ok(
    resumed.rateLimitWaitMs > 0 && resumed.rateLimitWaitMs <= RATE_LIMIT.windowMs,
    `a espera fica dentro da janela (${resumed.rateLimitWaitMs}ms de ${RATE_LIMIT.windowMs}ms)`,
  );
  assert.equal(resumed.completed, true);
  assert.equal(resumed.checkpoint.cursor, "d10");
  const afterResume = await readState(pool, MAIN_RUN_KEY);
  await printState(pool, "após a retomada", MAIN_RUN_KEY);
  assert.equal(afterResume.derived, 10);
  assert.equal(afterResume.maxApplies, 1);
  assert.equal(afterResume.duplicated, 0);
  assert.equal(afterResume.workItems, 10);

  console.log("  -- 2ª tentativa completa (checkpoint novo, mesma workKey) --");
  const verify = await buildRunner(pool, {
    runKey: VERIFY_RUN_KEY,
    batchSize: BATCH_SIZE,
    rateLimit: RATE_LIMIT,
  }).run();
  printSummary("2ª tentativa", verify);
  assert.equal(verify.resumed, false);
  assert.equal(verify.rowsScanned, 10);
  assert.equal(verify.rowsApplied, 0, "nada é reaplicado: a workKey é da linha, não da tentativa");
  assert.equal(verify.rowsDuplicate, 10);
  assert.equal(verify.completed, true);
  const afterVerify = await readState(pool, VERIFY_RUN_KEY);
  await printState(pool, "após a 2ª tentativa", VERIFY_RUN_KEY);
  assert.deepEqual(
    { derived: afterVerify.derived, maxApplies: afterVerify.maxApplies, duplicated: afterVerify.duplicated },
    { derived: 10, maxApplies: 1, duplicated: 0 },
    "rodar 2× não muda o estado",
  );

  const wrong = await pool.query<{ wrong: number }>(
    `select count(*)::int as wrong from backfill_demo_rows
     where derived_amount is distinct from round(amount * 1.2, 2)`,
  );
  assert.equal(wrong.rows[0].wrong, 0, "toda linha derivada corretamente");
}

async function fullStory(): Promise<void> {
  await runMigrations();
  const pool = new Pool({ connectionString: requireAdminUrl(), max: 4 });
  try {
    await pool.query(FIXTURE_DDL);
    await ensureBackfillLedger(pool);
    await poisonPhase(pool);
    await crashAndResumePhases(pool);
    console.log("\nBackfill §28 (28.1 lote · 28.2 checkpoint · 28.3 rate-limit · 28.4 idempotência · 28.5 observabilidade): OK");
  } finally {
    await pool.end();
  }
}

async function teardown(): Promise<void> {
  const pool = new Pool({ connectionString: requireAdminUrl(), max: 1 });
  try {
    await pool.query(
      "drop table if exists backfill_work_items; drop table if exists backfill_checkpoints; drop table if exists backfill_demo_rows;",
    );
    console.log("Fixtures do backfill removidas.");
  } finally {
    await pool.end();
  }
}

const phase = process.argv.find((arg) => arg.startsWith("--phase="))?.slice("--phase=".length) ?? "all";
if (phase === "crash") await crashPhase();
else if (phase === "teardown") await teardown();
else if (phase === "all") await fullStory();
else throw new Error(`fase desconhecida: ${phase}`);
