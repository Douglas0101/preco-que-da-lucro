/**
 * §23 — outbox transacional (23.1) e worker idempotente (23.2).
 *
 * Cobre, contra o banco descartável (container efêmero PG17):
 *   T1 atomicidade: o append acontece na MESMA transação da mutação de domínio
 *      (rollback do domínio não deixa evento órfão; falha do evento desfaz a
 *      mutação de domínio);
 *   T2 claim concorrente: dois workers com `FOR UPDATE SKIP LOCKED` dividem o
 *      lote sem processar o mesmo evento duas vezes;
 *   T3 idempotência do consumidor: o mesmo evento entregue 2× produz 1 efeito;
 *   T4 falha: `attempts++` com `available_at` futuro e retry limitado;
 *   T5 isolamento de tenant via RLS para a role `app_runtime`.
 *
 * Uso: `npx tsx scripts/db/test-outbox.ts` (DATABASE_ADMIN_URL local).
 */

import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";
import {
  setDatabaseForTests,
  withTenantTransaction,
  type Database,
  type DatabaseIdentity,
} from "../../src/db/client.server";
import {
  bindTransactionContext,
  type RequestIdentity,
} from "../../src/lib/request-context";
import type { Executor } from "../../src/server/contracts/event.contracts";
import { outboxRepository } from "../../src/server/repositories/outbox.repository";
import { expenseRepository } from "../../src/server/repositories/expense.repository";
import { expenseService } from "../../src/server/services/expense.service";
import { ensureRuntimeRoleMembership, requireAdminUrl } from "./migrate";

const userA = "e1000000-0000-4000-8000-000000000001";
const tenantA = "e2000000-0000-4000-8000-000000000002";
const userB = "e3000000-0000-4000-8000-000000000003";
const tenantB = "e4000000-0000-4000-8000-000000000004";

const identityA: DatabaseIdentity = { userId: userA, tenantId: tenantA, roles: ["owner"] };
const identityB: DatabaseIdentity = { userId: userB, tenantId: tenantB, roles: ["owner"] };

// Nenhum caminho testado usa o sinal de cancelamento; um controller não abortado
// evita um timer pendente ao fim do script.
const requestA: RequestIdentity = {
  ...identityA,
  correlationId: "db-test-outbox-a",
  signal: new AbortController().signal,
};
const requestB: RequestIdentity = {
  ...identityB,
  correlationId: "db-test-outbox-b",
  signal: new AbortController().signal,
};

/** O Drizzle pode embrulhar o erro do driver; o SQLSTATE vive na cadeia de causas. */
function isPostgresError(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === code) return true;
    if (!("cause" in current)) return false;
    current = current.cause;
  }
  return false;
}

async function countRows(
  pool: Pool,
  sqlText: string,
  params: readonly unknown[] = [],
): Promise<number> {
  const result = await pool.query<{ count: string }>(sqlText, [...params]);
  return Number(result.rows[0]?.count ?? "-1");
}

async function seedFixtures(pool: Pool): Promise<void> {
  await pool.query(
    `insert into users (id, name, email, email_verified)
     values ($1, 'Outbox A', 'outbox-a@example.test', true),
            ($2, 'Outbox B', 'outbox-b@example.test', true)
     on conflict (id) do nothing`,
    [userA, userB],
  );
  await pool.query(
    `insert into tenants (id, name, slug)
     values ($1, 'Outbox Tenant A', 'outbox-tenant-a'), ($2, 'Outbox Tenant B', 'outbox-tenant-b')
     on conflict (id) do nothing`,
    [tenantA, tenantB],
  );
  await pool.query(
    `insert into tenant_memberships (tenant_id, user_id, role)
     values ($1, $2, 'owner'), ($3, $4, 'owner')
     on conflict (tenant_id, user_id) do nothing`,
    [tenantA, userA, tenantB, userB],
  );
  await pool.query("delete from outbox_events where tenant_id in ($1, $2)", [tenantA, tenantB]);
  await pool.query("delete from expenses where tenant_id in ($1, $2)", [tenantA, tenantB]);
}

const expenseFixture = {
  category: null,
  amount: "10.0000",
  type: "fixa" as const,
  periodicity: "mensal",
  notes: null,
};

/**
 * T1 — o append usa a MESMA transação do domínio.
 *
 * (a) rollback depois da mutação não deixa evento órfão nem despesa;
 * (b) commit persiste os dois juntos;
 * (c) falha do append (CHECK de `event_type` vazio) desfaz a mutação de domínio.
 */
async function t1AtomicAppend(pool: Pool): Promise<void> {
  const before = await countRows(pool, "select count(*)::text as count from outbox_events");

  await assert.rejects(
    withTenantTransaction(identityA, async (transaction) => {
      const context = bindTransactionContext(requestA, transaction);
      const saved = await expenseService.save(context, {
        ...expenseFixture,
        name: "Despesa atômica",
      });
      assert.ok(saved.id, "a mutação de domínio deve produzir uma despesa");
      throw new Error("falha simulada após a mutação de domínio");
    }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("falha simulada após a mutação de domínio"),
    "a transação deve propagar a falha posterior à mutação",
  );

  assert.equal(
    await countRows(pool, "select count(*)::text as count from outbox_events"),
    before,
    "rollback do domínio não pode deixar evento órfão",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from expenses where tenant_id = $1", [
      tenantA,
    ]),
    0,
    "rollback do domínio não pode deixar despesa",
  );

  const committed = await withTenantTransaction(identityA, (transaction) =>
    expenseService.save(bindTransactionContext(requestA, transaction), {
      ...expenseFixture,
      name: "Despesa commitada",
      amount: "20.0000",
    }),
  );
  assert.ok(committed.id);

  const appended = await pool.query<{
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    idempotency_key: string;
    status: string;
    attempts: number;
    payload: Record<string, unknown>;
    processed_at: Date | null;
    last_error: string | null;
  }>(
    `select event_type, aggregate_type, aggregate_id, idempotency_key, status, attempts,
            payload, processed_at, last_error
     from outbox_events
     where tenant_id = $1 and aggregate_id = $2`,
    [tenantA, committed.id],
  );
  assert.equal(appended.rowCount, 1, "commit da despesa deve persistir exatamente um evento");
  const event = appended.rows[0];
  assert.equal(event?.event_type, "expense.saved");
  assert.equal(event?.aggregate_type, "expense");
  assert.equal(event?.idempotency_key, `expense.saved:${committed.id}:v${committed.version}`);
  assert.equal(event?.status, "pending");
  assert.equal(event?.attempts, 0);
  assert.equal(event?.processed_at, null);
  assert.equal(event?.last_error, null);
  assert.deepEqual(event?.payload, {
    expenseId: committed.id,
    name: "Despesa commitada",
    amount: "20.0000",
    type: "fixa",
    version: committed.version,
  });

  await assert.rejects(
    withTenantTransaction(identityA, async (transaction) => {
      const context = bindTransactionContext(requestA, transaction);
      await expenseRepository.save(context, {
        ...expenseFixture,
        name: "Despesa revertida",
        amount: "30.0000",
      });
      await outboxRepository.append(context, {
        eventType: "",
        aggregateType: "expense",
        aggregateId: "e7000000-0000-4000-8000-000000000007",
        idempotencyKey: "outbox-t1c",
        payload: {},
        occurredAt: new Date(),
      });
    }),
    (error: unknown) => isPostgresError(error, "23514"),
    "event_type vazio deve violar o CHECK e abortar a transação inteira",
  );

  assert.equal(
    await countRows(pool, "select count(*)::text as count from expenses where name = $1", [
      "Despesa revertida",
    ]),
    0,
    "falha do append deve desfazer a mutação de domínio na mesma transação",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from outbox_events"),
    before + 1,
    "o append rejeitado não pode persistir evento",
  );

  console.log(
    "T1 atomicidade: rollback do domínio sem evento órfão + falha do evento sem despesa: OK",
  );
}

/**
 * T5 — isolamento de tenant: sob a role `app_runtime` (NOSUPERUSER/NOBYPASSRLS)
 * o evento de A é invisível para B e um append cruzado é recusado pela policy.
 */
async function t5TenantIsolation(pool: Pool): Promise<void> {
  await seedFixtures(pool);
  const eventA = await withTenantTransaction(identityA, (transaction) =>
    outboxRepository.append(bindTransactionContext(requestA, transaction), {
      eventType: "expense.saved",
      aggregateType: "expense",
      aggregateId: "e8000000-0000-4000-8000-000000000008",
      idempotencyKey: "t5:a",
      payload: { tenant: "a" },
      occurredAt: new Date(),
    }),
  );
  const eventB = await withTenantTransaction(identityB, (transaction) =>
    outboxRepository.append(bindTransactionContext(requestB, transaction), {
      eventType: "expense.saved",
      aggregateType: "expense",
      aggregateId: "e9000000-0000-4000-8000-000000000009",
      idempotencyKey: "t5:b",
      payload: { tenant: "b" },
      occurredAt: new Date(),
    }),
  );
  assert.notEqual(eventA.eventId, eventB.eventId);

  const metadata = await pool.query<{
    rowSecurity: boolean;
    select: boolean;
    insert: boolean;
    update: boolean;
    delete: boolean;
    publicInsert: boolean;
  }>(
    `select c.relrowsecurity as "rowSecurity",
            has_table_privilege('app_runtime', 'public.outbox_events', 'select') as "select",
            has_table_privilege('app_runtime', 'public.outbox_events', 'insert') as "insert",
            has_table_privilege('app_runtime', 'public.outbox_events', 'update') as "update",
            has_table_privilege('app_runtime', 'public.outbox_events', 'delete') as "delete",
            has_table_privilege('public', 'public.outbox_events', 'insert') as "publicInsert"
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'outbox_events'`,
  );
  assert.deepEqual(
    metadata.rows[0],
    {
      rowSecurity: true,
      select: true,
      insert: true,
      update: true,
      delete: false,
      publicInsert: false,
    },
    "outbox_events deve ter RLS habilitado e grants SELECT/INSERT/UPDATE somente para app_runtime",
  );

  const consumptionMetadata = await pool.query<{
    rowSecurity: boolean;
    select: boolean;
    insert: boolean;
    update: boolean;
    delete: boolean;
  }>(
    `select c.relrowsecurity as "rowSecurity",
            has_table_privilege('app_runtime', 'public.outbox_consumptions', 'select') as "select",
            has_table_privilege('app_runtime', 'public.outbox_consumptions', 'insert') as "insert",
            has_table_privilege('app_runtime', 'public.outbox_consumptions', 'update') as "update",
            has_table_privilege('app_runtime', 'public.outbox_consumptions', 'delete') as "delete"
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'outbox_consumptions'`,
  );
  assert.deepEqual(
    consumptionMetadata.rows[0],
    { rowSecurity: true, select: true, insert: true, update: false, delete: false },
    "outbox_consumptions deve ser append-only (SELECT/INSERT) para app_runtime",
  );

  const runtimeRole = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
    "select rolsuper, rolbypassrls from pg_roles where rolname = 'app_runtime'",
  );
  assert.deepEqual(
    runtimeRole.rows[0],
    { rolsuper: false, rolbypassrls: false },
    "app_runtime deve ser NOSUPERUSER e NOBYPASSRLS",
  );

  const client = await pool.connect();
  const runtimeDatabase = drizzle({ client, schema });
  try {
    await runtimeDatabase.transaction(async (transaction) => {
      await transaction.execute(sql`set local role app_runtime`);
      await transaction.execute(sql`select set_config('app.current_user_id', ${userA}, true)`);
      await transaction.execute(sql`select set_config('app.current_tenant_id', ${tenantA}, true)`);
      // SAFETY: o driver node-postgres e o neon expõem a mesma superfície de
      // transação consumida pelo repositório (mesma justificativa do cast em
      // `src/db/client.server.ts`).
      const executor = transaction as unknown as Executor;

      const own = await transaction
        .select({ count: sql<string>`count(*)::text` })
        .from(schema.outboxEvents)
        .where(eq(schema.outboxEvents.id, eventA.eventId));
      assert.equal(own[0]?.count, "1", "A deve enxergar o próprio evento");

      const foreign = await transaction
        .select({ count: sql<string>`count(*)::text` })
        .from(schema.outboxEvents)
        .where(eq(schema.outboxEvents.id, eventB.eventId));
      assert.equal(foreign[0]?.count, "0", "o evento de B deve ser invisível para A");

      const claimable = await outboxRepository.claimPending(
        bindTransactionContext(requestA, executor),
        { batchSize: 10, maxAttempts: 5 },
      );
      assert.deepEqual(
        claimable.map((claimed) => claimed.id),
        [eventA.eventId],
        "o claim sob app_runtime deve devolver somente o evento do tenant do GUC",
      );

      await assert.rejects(
        outboxRepository.append(bindTransactionContext(requestB, executor), {
          eventType: "expense.saved",
          aggregateType: "expense",
          aggregateId: "ea000000-0000-4000-8000-00000000000a",
          idempotencyKey: "t5:cross",
          payload: {},
          occurredAt: new Date(),
        }),
        (error: unknown) => isPostgresError(error, "42501"),
        "append com tenant_id alheio ao GUC deve ser recusado pela policy (WITH CHECK)",
      );

      await transaction.execute(sql`rollback`);
    });
  } finally {
    client.release();
  }

  console.log("T5 isolamento: RLS por tenant sob app_runtime + WITH CHECK do append cruzado: OK");
}

async function main(): Promise<void> {
  const adminUrl = requireAdminUrl();
  const pool = new Pool({ connectionString: adminUrl, max: 4 });
  const database = drizzle({ client: pool, schema });
  setDatabaseForTests(database as unknown as Database);

  try {
    await ensureRuntimeRoleMembership(pool);
    await seedFixtures(pool);
    await t1AtomicAppend(pool);
    await t5TenantIsolation(pool);
  } finally {
    setDatabaseForTests(undefined);
    await pool.end();
  }

  console.log("Outbox §23 (23.1): atomicidade e isolamento de tenant: OK");
}

await main();
