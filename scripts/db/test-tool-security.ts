import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/db/schema";
import { runRegisteredTool } from "../../src/lib/ai/tool-runner";
import type { RequestContext } from "../../src/lib/request-context";
import { requireAdminUrl } from "./migrate";

const userId = "71000000-0000-4000-8000-000000000001";
const tenantId = "72000000-0000-4000-8000-000000000002";
const otherUserId = "73000000-0000-4000-8000-000000000003";
const otherTenantId = "74000000-0000-4000-8000-000000000004";
const otherProductId = "75000000-0000-4000-8000-000000000005";
const correlationId = "76000000-0000-4000-8000-000000000006";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: requireAdminUrl(), max: 2 });
  const database = drizzle({ client: pool, schema });
  try {
    await pool.query(
      `insert into users (id, name, email, email_verified) values
        ($1, 'Tool User', 'tool-user@example.test', true),
        ($2, 'Other Tool User', 'other-tool-user@example.test', true)
       on conflict (id) do nothing`,
      [userId, otherUserId],
    );
    await pool.query(
      `insert into tenants (id, name, slug, kind) values
        ($1, 'Tool Tenant', 'tool-tenant', 'personal'),
        ($2, 'Other Tool Tenant', 'other-tool-tenant', 'personal')
       on conflict (id) do nothing`,
      [tenantId, otherTenantId],
    );
    await pool.query(
      `insert into tenant_memberships (tenant_id, user_id, role) values
        ($1, $2, 'owner'),
        ($3, $4, 'owner')
       on conflict (tenant_id, user_id) do nothing`,
      [tenantId, userId, otherTenantId, otherUserId],
    );
    await pool.query(
      `insert into products (id, tenant_id, user_id, name)
       values ($1, $2, $3, 'Produto de outro tenant')
       on conflict (id) do nothing`,
      [otherProductId, otherTenantId, otherUserId],
    );

    await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local role app_runtime`);
      await transaction.execute(sql`
        select
          set_config('app.current_user_id', ${userId}, true),
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_roles', 'owner', true)
      `);
      const context: RequestContext = {
        userId,
        tenantId,
        roles: ["owner"],
        correlationId,
        signal: new AbortController().signal,
        transaction: transaction as unknown as RequestContext["transaction"],
      };

      const first = await runRegisteredTool({
        context,
        name: "create_product",
        rawArguments: JSON.stringify({ name: "Bolo auditável" }),
        idempotencyKey: "conversation:call-create",
      });
      assert.equal(first.ok, true);
      assert.equal(first.replayed, false);

      const replay = await runRegisteredTool({
        context,
        name: "create_product",
        rawArguments: JSON.stringify({ name: "Bolo auditável" }),
        idempotencyKey: "conversation:call-create",
      });
      assert.equal(replay.ok, true);
      assert.equal(replay.replayed, true);

      const invalid = await runRegisteredTool({
        context,
        name: "set_yield",
        rawArguments: JSON.stringify({
          product_id: otherProductId,
          yield_qty: null,
          yield_unit: "un",
        }),
        idempotencyKey: "conversation:call-invalid",
      });
      assert.deepEqual(invalid, { ok: false, code: "VALIDATION_ERROR", replayed: false });

      const unauthorized = await runRegisteredTool({
        context: { ...context, roles: ["viewer"] },
        name: "create_product",
        rawArguments: JSON.stringify({ name: "Não pode existir" }),
        idempotencyKey: "conversation:call-unauthorized",
      });
      assert.deepEqual(unauthorized, {
        ok: false,
        code: "AUTHORIZATION_ERROR",
        replayed: false,
      });

      const crossTenant = await runRegisteredTool({
        context,
        name: "set_yield",
        rawArguments: JSON.stringify({
          product_id: otherProductId,
          yield_qty: 10,
          yield_unit: "un",
        }),
        idempotencyKey: "conversation:call-cross-tenant",
      });
      assert.equal(crossTenant.ok, false);
      if (!crossTenant.ok) assert.equal(crossTenant.code, "NOT_FOUND");
    });

    const products = await pool.query<{ count: string }>(
      "select count(*)::text as count from products where tenant_id = $1 and name = 'Bolo auditável'",
      [tenantId],
    );
    assert.equal(products.rows[0]?.count, "1", "replay idempotente não pode duplicar mutação");
    const forbidden = await pool.query<{ count: string }>(
      "select count(*)::text as count from products where tenant_id = $1 and name = 'Não pode existir'",
      [tenantId],
    );
    assert.equal(forbidden.rows[0]?.count, "0", "tool não autorizada não pode mutar");
    const executions = await pool.query<{ count: string }>(
      "select count(*)::text as count from tool_executions where tenant_id = $1",
      [tenantId],
    );
    assert.equal(executions.rows[0]?.count, "4", "execuções e rejeições devem ser auditadas");
  } finally {
    await pool.end();
  }

  console.log("Tool registry: validação, AuthZ, idempotência, auditoria e isolamento: OK");
}

await main();
