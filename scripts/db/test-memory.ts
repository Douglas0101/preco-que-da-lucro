/**
 * §43/§15.2/§15.4 — memória persistente (MEM-D2, degrau D2).
 *
 * Cobre, contra o banco descartável (container efêmero PG17, `127.0.0.1`):
 *   T1 (a) isolamento de tenant: append com identidade A é invisível para B
 *      (0 linhas sob `app_runtime` com o GUC de B) e o append forjando o
 *      `tenant_id` de B é recusado pelo `WITH CHECK` da policy (42501), sem
 *      deixar linha;
 *   T2 (b) proveniência: `search` devolve a proveniência gravada, proveniência
 *      órfã é impossível (FK composta + CHECK de origem) e as CHECKs de
 *      conteúdo/faixa recusam valores inválidos;
 *   T3 (c) atomicidade: memória e efeito de domínio na MESMA transação — o
 *      rollback de um não deixa o outro, nas duas direções;
 *   T4 (d) delete: afeta só a linha do tenant corrente, devolve `false` para id
 *      inexistente (e para id de outro tenant) e cai em cascata na fonte;
 *   T5 (e) `check-migration-classes` verde com a tag nova classificada `SAFE`.
 *
 * As denegações são provadas **no banco**: o admin do container é superuser e
 * bypassa RLS, então os negativos rodam sob `set local role app_runtime`
 * (NOSUPERUSER/NOBYPASSRLS) com as GUCs de tenant — mesma técnica de
 * `scripts/db/test-outbox.ts` (T5). Nada aqui depende de filtro de aplicação.
 *
 * Uso: `npx tsx scripts/db/test-memory.ts` (DATABASE_ADMIN_URL local). O banco
 * descartável é migrado no início, então o script roda tanto isolado quanto
 * encadeado no fim de `db:test`.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";
import {
  setDatabaseForTests,
  withTenantTransaction,
  type Database,
  type DatabaseIdentity,
  type DatabaseTransaction,
} from "../../src/db/client.server";
import { bindTransactionContext, type RequestIdentity } from "../../src/lib/request-context";
import { ApplicationError } from "../../src/lib/api-error";
import type { MemoryRecordInput } from "../../src/server/contracts/memory.contracts";
import { memoryRepository } from "../../src/server/repositories/memory.repository";
import { expenseRepository } from "../../src/server/repositories/expense.repository";
import { classifyProject } from "./check-migration-classes";
import { ensureRuntimeRoleMembership, requireAdminUrl, runMigrations } from "./migrate";

const userA = "c1000000-0000-4000-8000-000000000001";
const tenantA = "c2000000-0000-4000-8000-000000000002";
const userB = "c3000000-0000-4000-8000-000000000003";
const tenantB = "c4000000-0000-4000-8000-000000000004";
const conversationA = "c5000000-0000-4000-8000-000000000005";
const conversationB = "c6000000-0000-4000-8000-000000000006";

/** Tag da migration de memória (a entrada nova do registry §27a). */
const MEMORY_MIGRATION_TAG = "0017_past_gideon";
const MEMORY_MIGRATION_DOWN = "0017_to_0016_down.sql";

const identityA: DatabaseIdentity = { userId: userA, tenantId: tenantA, roles: ["owner"] };
const identityB: DatabaseIdentity = { userId: userB, tenantId: tenantB, roles: ["owner"] };

// Nenhum caminho testado usa o sinal de cancelamento; um controller não abortado
// evita um timer pendente ao fim do script.
const requestA: RequestIdentity = {
  ...identityA,
  correlationId: "db-test-memory-a",
  signal: new AbortController().signal,
};
const requestB: RequestIdentity = {
  ...identityB,
  correlationId: "db-test-memory-b",
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

function memoryInput(overrides: Partial<MemoryRecordInput> = {}): MemoryRecordInput {
  return {
    scope: "tenant",
    content: "Preferência: relatórios semanais com margem por produto",
    importance: 0.6,
    provenance: {
      sourceKind: "user",
      sourceId: "chat-message-42",
      capturedAt: new Date("2026-09-16T12:00:00.000Z"),
      inferred: false,
      confidence: 0.9,
    },
    ...overrides,
  };
}

const expenseFixture = {
  category: null,
  amount: "10.0000",
  type: "fixa" as const,
  periodicity: "mensal",
  notes: null,
};

/** Limpa as linhas de memória dos dois tenants (o script é reexecutável e roda
 * encadeado no `db:test`, onde o banco já tem as tabelas). */
async function resetMemory(pool: Pool): Promise<void> {
  await pool.query("delete from ai_memory_sources where tenant_id in ($1, $2)", [tenantA, tenantB]);
  await pool.query("delete from ai_memories where tenant_id in ($1, $2)", [tenantA, tenantB]);
}

async function seedFixtures(pool: Pool): Promise<void> {
  await pool.query(
    `insert into users (id, name, email, email_verified)
     values ($1, 'Memória A', 'memory-a@example.test', true),
            ($2, 'Memória B', 'memory-b@example.test', true)
     on conflict (id) do nothing`,
    [userA, userB],
  );
  await pool.query(
    `insert into tenants (id, name, slug)
     values ($1, 'Memória Tenant A', 'memory-tenant-a'),
            ($2, 'Memória Tenant B', 'memory-tenant-b')
     on conflict (id) do nothing`,
    [tenantA, tenantB],
  );
  await pool.query(
    `insert into tenant_memberships (tenant_id, user_id, role)
     values ($1, $2, 'owner'), ($3, $4, 'owner')
     on conflict (tenant_id, user_id) do nothing`,
    [tenantA, userA, tenantB, userB],
  );
  await pool.query(
    `insert into chat_conversations (id, tenant_id, user_id)
     values ($1, $2, $3), ($4, $5, $6)
     on conflict (id) do nothing`,
    [conversationA, tenantA, userA, conversationB, tenantB, userB],
  );
  await resetMemory(pool);
}

/**
 * Executa `operation` como `app_runtime` (NOSUPERUSER/NOBYPASSRLS) com as GUCs
 * de tenant da identidade. É a única forma de provar denegação **no banco**:
 * o admin do container é superuser e bypassaria a policy.
 */
async function withRuntimeRoleTransaction<T>(
  pool: Pool,
  identity: DatabaseIdentity,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    const database = drizzle({ client, schema });
    return await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local role app_runtime`);
      await transaction.execute(
        sql`select set_config('app.current_user_id', ${identity.userId}, true)`,
      );
      await transaction.execute(
        sql`select set_config('app.current_tenant_id', ${identity.tenantId}, true)`,
      );
      await transaction.execute(
        sql`select set_config('app.current_roles', ${identity.roles.join(",")}, true)`,
      );
      return operation(transaction);
    });
  } finally {
    client.release();
  }
}

/** Conta linhas enxergadas pela role de runtime com o GUC de `identity`. */
function runtimeCount(pool: Pool, identity: DatabaseIdentity, table: string): Promise<number> {
  return withRuntimeRoleTransaction(pool, identity, async (transaction) => {
    const result = await transaction.execute<{ count: string }>(
      sql`select count(*)::text as count from ${sql.identifier(table)}`,
    );
    return Number(result.rows[0]?.count ?? "-1");
  });
}

/** Espera a denegação do banco (SQLSTATE) sob a role de runtime. */
async function expectRuntimeDenial(
  pool: Pool,
  identity: DatabaseIdentity,
  code: string,
  operation: (transaction: DatabaseTransaction) => Promise<unknown>,
  message: string,
): Promise<void> {
  await assert.rejects(
    withRuntimeRoleTransaction(pool, identity, operation),
    (error: unknown) => isPostgresError(error, code),
    message,
  );
}

/**
 * T1 (a) — isolamento de tenant.
 *
 * A memória de A não é visível para B (contagem sob `app_runtime` com o GUC de
 * B = 0; com o GUC de A = 1, então a medição não é vacuosa) e a inserção com
 * `tenant_id` de B sob o GUC de A viola o `WITH CHECK` da policy (42501).
 */
async function t1TenantIsolation(pool: Pool): Promise<void> {
  await seedFixtures(pool);

  const appended = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.append(bindTransactionContext(requestA, transaction), memoryInput()),
  );
  assert.ok(appended.id, "o append de A deve devolver a memória gravada");
  assert.equal(
    await countRows(
      pool,
      "select count(*)::text as count from ai_memory_sources where memory_id = $1",
      [appended.id],
    ),
    1,
    "o append com proveniência deve gravar exatamente uma fonte",
  );

  const searchedByB = await withTenantTransaction(identityB, (transaction) =>
    memoryRepository.search(bindTransactionContext(requestB, transaction), {
      text: "relatórios semanais",
    }),
  );
  assert.deepEqual(searchedByB, [], "a busca com identidade B não pode devolver memória de A");

  assert.equal(
    await runtimeCount(pool, identityB, "ai_memories"),
    0,
    "sob app_runtime com o GUC de B a tabela de memória deve estar vazia (RLS, não filtro de app)",
  );
  assert.equal(
    await runtimeCount(pool, identityA, "ai_memories"),
    1,
    "sob app_runtime com o GUC de A a memória precisa aparecer (senão a contagem acima seria vacuosa)",
  );
  assert.equal(await runtimeCount(pool, identityB, "ai_memory_sources"), 0);
  assert.equal(await runtimeCount(pool, identityA, "ai_memory_sources"), 1);

  await expectRuntimeDenial(
    pool,
    identityA,
    "42501",
    (transaction) =>
      transaction.execute(
        sql`insert into ai_memories (tenant_id, user_id, scope, content)
            values (${tenantB}, ${userA}, 'tenant', 'memória forjada do tenant B')`,
      ),
    "append forjando o tenant_id de B sob o GUC de A deve violar o WITH CHECK (42501)",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where tenant_id = $1", [
      tenantB,
    ]),
    0,
    "a inserção recusada pela policy não pode deixar linha",
  );

  await expectRuntimeDenial(
    pool,
    identityA,
    "23503",
    (transaction) =>
      transaction.execute(
        sql`insert into ai_memories (tenant_id, user_id, scope, content)
            values (${tenantA}, ${userB}, 'tenant', 'memória de membro de outro tenant')`,
      ),
    "memória atribuída a quem não é membro do tenant deve violar a FK composta para tenant_memberships",
  );

  console.log(
    "T1 isolamento: busca de B = 0 linhas sob RLS + append forjado recusado por WITH CHECK (42501): OK",
  );
}

/**
 * T2 (b) — proveniência: `search` devolve a fonte gravada; fonte órfã (memória
 * inexistente, memória de outro tenant, conversa de outro tenant) e fonte sem
 * nenhuma origem são impossíveis; as CHECKs de conteúdo e de faixa mordem.
 */
async function t2Provenance(pool: Pool): Promise<void> {
  await seedFixtures(pool);

  const capturedAt = new Date("2026-09-16T12:00:00.000Z");
  const record = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.append(
      bindTransactionContext(requestA, transaction),
      memoryInput({
        scope: "conversation",
        content: "Prefere relatórios semanais por produto",
        importance: 0.7,
        provenance: {
          sourceKind: "user",
          sourceId: "chat-message-42",
          conversationId: conversationA,
          capturedAt,
          inferred: false,
          confidence: 0.9,
        },
      }),
    ),
  );
  assert.deepEqual(
    record.provenance,
    {
      sourceKind: "user",
      sourceId: "chat-message-42",
      conversationId: conversationA,
      capturedAt,
      inferred: false,
      confidence: 0.9,
    },
    "o append deve devolver a proveniência gravada",
  );
  assert.equal(record.status, "active");
  assert.equal(record.importance, 0.7);

  const found = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.search(bindTransactionContext(requestA, transaction), {
      text: "relatórios semanais",
    }),
  );
  assert.equal(found.length, 1, "a busca do próprio tenant deve devolver a memória");
  assert.deepEqual(
    found[0]?.provenance,
    record.provenance,
    "a busca deve devolver a proveniência junto do registro",
  );

  // Duas fontes para a mesma memória: o read model expõe a mais antiga
  // (`captured_at` asc, `id` asc) — regra determinística, não ordem de inserção.
  await pool.query(
    `insert into ai_memory_sources
       (tenant_id, memory_id, source_kind, source_ref, confidence, captured_at)
     values ($1, $2, 'model', 'model:later', 0.4, $3)`,
    [tenantA, record.id, new Date("2026-09-16T15:00:00.000Z")],
  );
  const withTwoSources = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.search(bindTransactionContext(requestA, transaction), {
      text: "relatórios semanais",
    }),
  );
  assert.equal(
    withTwoSources[0]?.provenance?.sourceId,
    "chat-message-42",
    "com duas fontes o read model expõe a mais antiga",
  );
  assert.equal(
    await countRows(
      pool,
      "select count(*)::text as count from ai_memory_sources where memory_id = $1",
      [record.id],
    ),
    2,
    "as duas fontes coexistem (a proveniência é 1:N)",
  );

  // Origem opcional de verdade: só o rótulo opaco é aceito; as FKs tipadas são
  // ausentes e a linha passa (o CHECK exige ao menos uma origem).
  await assert.doesNotReject(
    pool.query(
      `insert into ai_memory_sources
         (tenant_id, memory_id, source_kind, source_ref, confidence, captured_at, inferred)
       values ($1, $2, 'tool', 'tool:run-1', 0.5, now(), true)`,
      [tenantA, record.id],
    ),
    "fonte sem FK tipada é válida desde que tenha ao menos uma origem",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memory_sources
         (tenant_id, memory_id, source_kind, source_ref, confidence, captured_at)
       values ($1, $2, 'user', 'user:orphan', 0.5, now())`,
      [tenantA, "c7000000-0000-4000-8000-000000000007"],
    ),
    (error: unknown) => isPostgresError(error, "23503"),
    "fonte apontando para memória inexistente deve violar a FK composta",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memory_sources
         (tenant_id, memory_id, source_kind, source_ref, confidence, captured_at)
       values ($1, $2, 'user', 'user:cross-tenant', 0.5, now())`,
      [tenantB, record.id],
    ),
    (error: unknown) => isPostgresError(error, "23503"),
    "fonte de B apontando para memória de A deve violar a FK composta (tenant_id, memory_id)",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memory_sources
         (tenant_id, memory_id, source_kind, source_ref, conversation_id, confidence, captured_at)
       values ($1, $2, 'user', 'user:foreign-conversation', $3, 0.5, now())`,
      [tenantA, record.id, conversationB],
    ),
    (error: unknown) => isPostgresError(error, "23503"),
    "conversa de outro tenant na proveniência deve violar a FK composta (tenant_id, conversation_id)",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memory_sources
         (tenant_id, memory_id, source_kind, confidence, captured_at)
       values ($1, $2, 'user', 0.5, now())`,
      [tenantA, record.id],
    ),
    (error: unknown) => isPostgresError(error, "23514"),
    "fonte sem nenhuma origem identificável deve violar o CHECK origin_check",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memories (tenant_id, user_id, scope, content) values ($1, $2, 'tenant', '')`,
      [tenantA, userA],
    ),
    (error: unknown) => isPostgresError(error, "23514"),
    "content vazio deve violar o CHECK ai_memories_content_check",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memories (tenant_id, user_id, scope, content, confidence)
       values ($1, $2, 'tenant', 'confiança fora da faixa', 1.5)`,
      [tenantA, userA],
    ),
    (error: unknown) => isPostgresError(error, "23514"),
    "confidence fora de [0,1] deve violar o CHECK ai_memories_confidence_check",
  );

  await assert.rejects(
    pool.query(
      `insert into ai_memories (tenant_id, user_id, scope, content, importance)
       values ($1, $2, 'tenant', 'importância fora da faixa', -0.1)`,
      [tenantA, userA],
    ),
    (error: unknown) => isPostgresError(error, "23514"),
    "importance fora de [0,1] deve violar o CHECK ai_memories_importance_check",
  );

  // O escopo da busca é do chamador e não amplia o tenant: um filtro que não
  // casa não pode vazar para o resto do tenant.
  const wrongScope = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.search(bindTransactionContext(requestA, transaction), {
      text: "relatórios semanais",
      scopes: ["user"],
    }),
  );
  assert.deepEqual(
    wrongScope,
    [],
    "o filtro de escopo deve excluir a memória de escopo 'conversation'",
  );

  console.log(
    "T2 proveniência: search devolve a fonte mais antiga; órfã/sem origem impossíveis (23503/23514): OK",
  );
}

/**
 * T3 (c) — atomicidade com o efeito de domínio, nas duas direções:
 * rollback depois dos dois deixa zero memória e zero despesa; e a memória
 * recusada pelo banco (CHECK) desfaz a despesa da mesma transação.
 */
async function t3AtomicWithDomainEffect(pool: Pool): Promise<void> {
  await seedFixtures(pool);

  await assert.rejects(
    withTenantTransaction(identityA, async (transaction) => {
      const context = bindTransactionContext(requestA, transaction);
      const saved = await expenseRepository.save(context, {
        ...expenseFixture,
        name: "Despesa revertida com memória",
      });
      assert.ok(saved.id, "a mutação de domínio deve produzir uma despesa");
      await memoryRepository.append(context, memoryInput());
      throw new Error("falha simulada depois da memória e da despesa");
    }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("falha simulada depois da memória"),
    "a transação deve propagar a falha posterior às duas mutações",
  );

  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where tenant_id = $1", [
      tenantA,
    ]),
    0,
    "rollback do domínio não pode deixar memória órfã",
  );
  assert.equal(
    await countRows(
      pool,
      "select count(*)::text as count from ai_memory_sources where tenant_id = $1",
      [tenantA],
    ),
    0,
    "rollback do domínio não pode deixar fonte órfã",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from expenses where name = $1", [
      "Despesa revertida com memória",
    ]),
    0,
    "rollback não pode deixar a despesa",
  );

  await assert.rejects(
    withTenantTransaction(identityA, async (transaction) => {
      const context = bindTransactionContext(requestA, transaction);
      const saved = await expenseRepository.save(context, {
        ...expenseFixture,
        name: "Despesa desfeita pela memória",
      });
      assert.ok(saved.id);
      await memoryRepository.append(context, memoryInput({ content: "" }));
    }),
    (error: unknown) => isPostgresError(error, "23514"),
    "memória com content vazio deve violar o CHECK e abortar a transação inteira",
  );

  assert.equal(
    await countRows(pool, "select count(*)::text as count from expenses where name = $1", [
      "Despesa desfeita pela memória",
    ]),
    0,
    "falha da memória deve desfazer o efeito de domínio da mesma transação",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where tenant_id = $1", [
      tenantA,
    ]),
    0,
    "a memória recusada não pode persistir",
  );

  const committed = await withTenantTransaction(identityA, async (transaction) => {
    const context = bindTransactionContext(requestA, transaction);
    const saved = await expenseRepository.save(context, {
      ...expenseFixture,
      name: "Despesa commitada com memória",
    });
    const memory = await memoryRepository.append(context, memoryInput());
    return { expenseId: saved.id, memoryId: memory.id };
  });
  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where id = $1", [
      committed.memoryId,
    ]),
    1,
    "o commit deve persistir a memória junto do efeito de domínio",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from expenses where id = $1", [
      committed.expenseId,
    ]),
    1,
  );

  console.log(
    "T3 atomicidade: rollback e falha cruzadas entre memória e despesa deixam zero linhas: OK",
  );
}

/**
 * T4 (d) — delete: `true` só quando a linha do tenant corrente cai; id
 * inexistente devolve `false`; id de outro tenant devolve `false` e não apaga
 * nada; a fonte cai em cascata; a role de runtime tem DELETE concedido.
 */
async function t4Delete(pool: Pool): Promise<void> {
  await seedFixtures(pool);

  const mine = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.append(bindTransactionContext(requestA, transaction), memoryInput()),
  );
  const removalByRuntime = await withRuntimeRoleTransaction(pool, identityA, (transaction) =>
    memoryRepository.delete(bindTransactionContext(requestA, transaction), mine.id),
  );
  assert.equal(
    removalByRuntime,
    true,
    "a role de runtime precisa ter DELETE concedido e a policy USING precisa alcançar a linha",
  );
  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where id = $1", [
      mine.id,
    ]),
    0,
    "o delete deve remover a linha do tenant corrente",
  );
  assert.equal(
    await countRows(
      pool,
      "select count(*)::text as count from ai_memory_sources where memory_id = $1",
      [mine.id],
    ),
    0,
    "a fonte deve cair em cascata com a memória",
  );

  const missing = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.delete(
      bindTransactionContext(requestA, transaction),
      "c8000000-0000-4000-8000-000000000008",
    ),
  );
  assert.equal(missing, false, "delete de id inexistente devolve false");

  const foreignKeyRow = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.append(bindTransactionContext(requestA, transaction), memoryInput()),
  );
  const removalByB = await withTenantTransaction(identityB, (transaction) =>
    memoryRepository.delete(bindTransactionContext(requestB, transaction), foreignKeyRow.id),
  );
  assert.equal(removalByB, false, "delete sob outra identidade não afeta a linha de A");
  assert.equal(
    await countRows(pool, "select count(*)::text as count from ai_memories where id = $1", [
      foreignKeyRow.id,
    ]),
    1,
    "a linha de A permanece intacta",
  );

  const ownRemoval = await withTenantTransaction(identityA, (transaction) =>
    memoryRepository.delete(bindTransactionContext(requestA, transaction), foreignKeyRow.id),
  );
  assert.equal(ownRemoval, true, "A apaga a própria memória");
  assert.equal(
    await withTenantTransaction(identityA, (transaction) =>
      memoryRepository.delete(bindTransactionContext(requestA, transaction), foreignKeyRow.id),
    ),
    false,
    "o delete é idempotente: a segunda chamada devolve false",
  );

  const metadata = await pool.query<{
    rowSecurity: boolean;
    select: boolean;
    insert: boolean;
    update: boolean;
    delete: boolean;
    publicSelect: boolean;
    policies: string;
  }>(
    `select c.relrowsecurity as "rowSecurity",
            has_table_privilege('app_runtime', 'public.ai_memories', 'select') as "select",
            has_table_privilege('app_runtime', 'public.ai_memories', 'insert') as "insert",
            has_table_privilege('app_runtime', 'public.ai_memories', 'update') as "update",
            has_table_privilege('app_runtime', 'public.ai_memories', 'delete') as "delete",
            has_table_privilege('public', 'public.ai_memories', 'select') as "publicSelect",
            (select string_agg(p.policyname || ':' || coalesce(p.qual, '-') || ':' || coalesce(p.with_check, '-'), '|')
               from pg_policies p
              where p.schemaname = 'public' and p.tablename = 'ai_memories') as "policies"
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'ai_memories'`,
  );
  const memoryMetadata = metadata.rows[0];
  assert.equal(memoryMetadata?.rowSecurity, true, "ai_memories deve ter RLS habilitado");
  assert.deepEqual(
    {
      select: memoryMetadata?.select,
      insert: memoryMetadata?.insert,
      update: memoryMetadata?.update,
      delete: memoryMetadata?.delete,
      publicSelect: memoryMetadata?.publicSelect,
    },
    { select: true, insert: true, update: true, delete: true, publicSelect: false },
    "ai_memories deve ter SELECT/INSERT/UPDATE/DELETE para app_runtime e nada para PUBLIC",
  );
  assert.match(
    memoryMetadata?.policies ?? "",
    /^tenant_isolation:.*current_tenant_id.*has_tenant_access.*:.*current_tenant_id.*has_tenant_access.*$/,
    "a policy tenant_isolation precisa ter USING e WITH CHECK com has_tenant_access",
  );

  const sourceMetadata = await pool.query<{
    rowSecurity: boolean;
    select: boolean;
    insert: boolean;
    delete: boolean;
    publicSelect: boolean;
  }>(
    `select c.relrowsecurity as "rowSecurity",
            has_table_privilege('app_runtime', 'public.ai_memory_sources', 'select') as "select",
            has_table_privilege('app_runtime', 'public.ai_memory_sources', 'insert') as "insert",
            has_table_privilege('app_runtime', 'public.ai_memory_sources', 'delete') as "delete",
            has_table_privilege('public', 'public.ai_memory_sources', 'select') as "publicSelect"
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'ai_memory_sources'`,
  );
  assert.deepEqual(
    sourceMetadata.rows[0],
    { rowSecurity: true, select: true, insert: true, delete: false, publicSelect: false },
    "ai_memory_sources deve ser append-only para app_runtime e fechada para PUBLIC",
  );

  const invalidLimit = await withTenantTransaction(identityA, (transaction) =>
    assert.rejects(
      memoryRepository.search(bindTransactionContext(requestA, transaction), {
        text: "relatórios",
        limit: 0,
      }),
      (error: unknown) => error instanceof ApplicationError && error.code === "VALIDATION_ERROR",
      "limite inválido deve falhar alto em vez de virar varredura",
    ),
  );
  assert.equal(invalidLimit, undefined);

  console.log(
    "T4 delete: só o tenant corrente apaga, cascata na fonte, false para id inexistente e de terceiro: OK",
  );
}

/** T5 (e) — a migration nova está classificada e tem down no registry §27a. */
async function t5MigrationClassification(): Promise<void> {
  const result = await classifyProject(process.cwd());
  assert.deepEqual(result.errors, [], "o registry de classes precisa estar sem divergências");
  assert.equal(
    result.classified,
    result.total,
    "todas as migrations do journal precisam estar classificadas",
  );

  const entry = result.rows.find((row) => row.tag === MEMORY_MIGRATION_TAG);
  assert.ok(entry, `a migration ${MEMORY_MIGRATION_TAG} precisa estar no journal e no registry`);
  assert.equal(entry.class, "SAFE", "tabelas novas sem DML são SAFE (§27)");
  assert.equal(entry.appliedOn, "empty");
  assert.equal(entry.ok, true);

  await assert.doesNotReject(
    readFile(resolve("drizzle/rollback", MEMORY_MIGRATION_DOWN), "utf8"),
    `o down ${MEMORY_MIGRATION_DOWN} precisa existir`,
  );

  console.log(
    `T5 classificação: ${result.classified}/${result.total} classificadas · ${MEMORY_MIGRATION_TAG} = SAFE/empty + down: OK`,
  );
}

async function main(): Promise<void> {
  const adminUrl = requireAdminUrl();
  const pool = new Pool({ connectionString: adminUrl, max: 4 });
  const database = drizzle({ client: pool, schema });
  setDatabaseForTests(database as unknown as Database);

  try {
    await runMigrations(adminUrl);
    await ensureRuntimeRoleMembership(pool);
    await t1TenantIsolation(pool);
    await t2Provenance(pool);
    await t3AtomicWithDomainEffect(pool);
    await t4Delete(pool);
    await t5MigrationClassification();
  } finally {
    setDatabaseForTests(undefined);
    await pool.end();
  }

  console.log("Memória §43/D2 (persistência + proveniência + tenant isolation): OK");
}

await main();
