/**
 * §28 — persistência do backfill em Postgres: checkpoint retomável + marcador de
 * idempotência (`work key`).
 *
 * O runner (`backfill-runner.ts`) é puro e recebe essas duas peças por injeção;
 * este módulo é a implementação sobre `pg`, usada pelo caso de integração
 * (`test-backfill.ts`) e reutilizável por qualquer backfill futuro.
 *
 * Invariantes:
 * - `backfill_work_items.work_key` é a PK e é derivada da LINHA (não da
 *   tentativa): reexecutar o mesmo trabalho em outra tentativa não reaplica o
 *   efeito — o `INSERT … ON CONFLICT DO NOTHING` é a arbitragem.
 * - O marcador e o efeito rodam na MESMA transação (`applyWorkItemOnce`): se o
 *   efeito falha, o marcador desaparece com ele; se o processo morre depois do
 *   commit, o marcador sobrevive e a retomada vê `duplicate`.
 *
 * Estas tabelas não estão em `src/db/schema.ts` (escopo do WP-B1): o DDL abaixo é
 * idempotente e vive no banco descartável de teste. Levar o ledger para produção
 * exige uma migration própria — proposta registrada no claim do WP-B2.
 */

import type { Pool, PoolClient } from "pg";
import type {
  BackfillApplyOutcome,
  BackfillCheckpoint,
  BackfillCheckpointStore,
} from "./backfill-runner";

export const BACKFILL_LEDGER_DDL = `
create table if not exists backfill_checkpoints (
  run_key text primary key,
  cursor text,
  completed boolean not null default false,
  batches integer not null default 0,
  rows_scanned integer not null default 0,
  rows_applied integer not null default 0,
  rows_duplicate integer not null default 0,
  errors integer not null default 0,
  updated_at timestamptz not null
);

create table if not exists backfill_work_items (
  work_key text primary key,
  run_key text not null,
  row_key text not null,
  applied_at timestamptz not null default now()
);

create index if not exists backfill_work_items_run_key_idx on backfill_work_items (run_key);
`;

export async function ensureBackfillLedger(pool: Pool): Promise<void> {
  await pool.query(BACKFILL_LEDGER_DDL);
}

export function createPostgresCheckpointStore(pool: Pool): BackfillCheckpointStore {
  return {
    load: async (runKey) => {
      const result = await pool.query<{
        cursor: string | null;
        completed: boolean;
        batches: number;
        rows_scanned: number;
        rows_applied: number;
        rows_duplicate: number;
        errors: number;
        updated_at: Date;
      }>(
        `select cursor, completed, batches, rows_scanned, rows_applied, rows_duplicate, errors, updated_at
         from backfill_checkpoints where run_key = $1`,
        [runKey],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        cursor: row.cursor,
        completed: row.completed,
        batches: row.batches,
        rowsScanned: row.rows_scanned,
        rowsApplied: row.rows_applied,
        rowsDuplicate: row.rows_duplicate,
        errors: row.errors,
        updatedAt: row.updated_at.toISOString(),
      } satisfies BackfillCheckpoint;
    },
    save: async (runKey, checkpoint) => {
      await pool.query(
        `insert into backfill_checkpoints
           (run_key, cursor, completed, batches, rows_scanned, rows_applied, rows_duplicate, errors, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
         on conflict (run_key) do update set
           cursor = excluded.cursor,
           completed = excluded.completed,
           batches = excluded.batches,
           rows_scanned = excluded.rows_scanned,
           rows_applied = excluded.rows_applied,
           rows_duplicate = excluded.rows_duplicate,
           errors = excluded.errors,
           updated_at = excluded.updated_at`,
        [
          runKey,
          checkpoint.cursor,
          checkpoint.completed,
          checkpoint.batches,
          checkpoint.rowsScanned,
          checkpoint.rowsApplied,
          checkpoint.rowsDuplicate,
          checkpoint.errors,
          checkpoint.updatedAt,
        ],
      );
    },
  };
}

export interface WorkItemApply {
  /** `<workKey>#<rowKey>` — identidade global do efeito. */
  readonly workKey: string;
  /** Tentativa que está aplicando (rastreabilidade). */
  readonly runKey: string;
  readonly rowKey: string;
  /** Efeito da linha, executado na MESMA transação do marcador. */
  readonly effect: (client: PoolClient) => Promise<void>;
}

/**
 * Aplica o efeito de uma linha exatamente uma vez: marca a `workKey`
 * (`ON CONFLICT DO NOTHING`) e só então executa o efeito, tudo numa transação.
 * Já marcado ⇒ devolve `duplicate` sem tocar no efeito.
 */
export async function applyWorkItemOnce(
  pool: Pool,
  input: WorkItemApply,
): Promise<BackfillApplyOutcome> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inserted = await client.query<{ work_key: string }>(
      `insert into backfill_work_items (work_key, run_key, row_key)
       values ($1, $2, $3)
       on conflict (work_key) do nothing
       returning work_key`,
      [input.workKey, input.runKey, input.rowKey],
    );
    if (inserted.rowCount === 0) {
      await client.query("rollback");
      return "duplicate";
    }
    await input.effect(client);
    await client.query("commit");
    return "applied";
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
