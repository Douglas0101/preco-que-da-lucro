import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { requireAdminUrl, runMigrations } from "./migrate";

const adminUrl = requireAdminUrl();
const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "20000000-0000-4000-8000-000000000002";
const userA = "30000000-0000-4000-8000-000000000003";
const userB = "40000000-0000-4000-8000-000000000004";

async function withRuntimeContext<T>(
  client: Client,
  identity: { userId?: string; tenantId?: string },
  operation: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role app_runtime");
    if (identity.userId) {
      await client.query("select set_config('app.current_user_id', $1, true)", [identity.userId]);
    }
    if (identity.tenantId) {
      await client.query("select set_config('app.current_tenant_id', $1, true)", [
        identity.tenantId,
      ]);
    }
    const result = await operation();
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function seedIsolationFixtures(client: Client): Promise<void> {
  await client.query(
    `insert into users (id, name, email, email_verified)
     values ($1, 'Usuário A', 'a@example.test', true),
            ($2, 'Usuário B', 'b@example.test', true)`,
    [userA, userB],
  );
  await client.query(
    `insert into tenants (id, name, slug)
     values ($1, 'Tenant A', 'tenant-a'), ($2, 'Tenant B', 'tenant-b')`,
    [tenantA, tenantB],
  );
  await client.query(
    `insert into tenant_memberships (tenant_id, user_id, role)
     values ($1, $2, 'owner'), ($3, $4, 'owner')`,
    [tenantA, userA, tenantB, userB],
  );
  await client.query(
    `insert into products (tenant_id, user_id, name, current_price, tax_rate)
     values ($1, $2, 'Produto A', '12.3400', '0.060000'),
            ($3, $4, 'Produto B', '99.9900', '0.120000')`,
    [tenantA, userA, tenantB, userB],
  );
}

async function assertDatabaseContract(client: Client): Promise<void> {
  const role = await client.query<{
    rolcanlogin: boolean;
    rolsuper: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolbypassrls: boolean;
  }>(
    `select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
     from pg_roles where rolname = 'app_runtime'`,
  );
  assert.equal(role.rowCount, 1);
  assert.deepEqual(role.rows[0], {
    rolcanlogin: true,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolbypassrls: false,
  });

  const runtimePrivileges = await client.query<{
    rateLimitSelect: boolean;
    rateLimitInsert: boolean;
    publicRateLimitSelect: boolean;
    membershipFunctionExecute: boolean;
    tenantDelete: boolean;
    membershipDelete: boolean;
  }>(`
    select
      has_table_privilege('app_runtime', 'public.rate_limits', 'select') as "rateLimitSelect",
      has_table_privilege('app_runtime', 'public.rate_limits', 'insert') as "rateLimitInsert",
      has_table_privilege('public', 'public.rate_limits', 'select') as "publicRateLimitSelect",
      has_function_privilege('app_runtime', 'app_private.has_tenant_access(uuid)', 'execute') as "membershipFunctionExecute",
      has_table_privilege('app_runtime', 'public.tenants', 'delete') as "tenantDelete",
      has_table_privilege('app_runtime', 'public.tenant_memberships', 'delete') as "membershipDelete"
  `);
  assert.deepEqual(runtimePrivileges.rows[0], {
    rateLimitSelect: true,
    rateLimitInsert: true,
    publicRateLimitSelect: false,
    membershipFunctionExecute: true,
    tenantDelete: false,
    membershipDelete: false,
  });

  const scales = await client.query<{
    column_name: string;
    numeric_precision: number;
    numeric_scale: number;
  }>(
    `select column_name, numeric_precision, numeric_scale
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name in ('current_price', 'yield_qty', 'tax_rate')
     order by column_name`,
  );
  assert.deepEqual(scales.rows, [
    { column_name: "current_price", numeric_precision: 19, numeric_scale: 4 },
    { column_name: "tax_rate", numeric_precision: 9, numeric_scale: 6 },
    { column_name: "yield_qty", numeric_precision: 24, numeric_scale: 6 },
  ]);

  const rateLimitColumns = await client.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `select column_name, data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public' and table_name = 'rate_limits'
     order by ordinal_position`,
  );
  assert.deepEqual(rateLimitColumns.rows, [
    { column_name: "id", data_type: "text", is_nullable: "NO" },
    { column_name: "key", data_type: "text", is_nullable: "NO" },
    { column_name: "count", data_type: "integer", is_nullable: "NO" },
    { column_name: "last_request", data_type: "bigint", is_nullable: "NO" },
  ]);

  const privileges = await client.query<{
    runtime_create_schema: boolean;
    auth_delete: boolean;
    products_delete: boolean;
    tenants_delete: boolean;
    memberships_delete: boolean;
    audit_select: boolean;
    rate_limit_delete: boolean;
  }>(
    `select
       has_schema_privilege('app_runtime', 'public', 'CREATE') as runtime_create_schema,
       has_table_privilege('app_runtime', 'public.users', 'DELETE') as auth_delete,
       has_table_privilege('app_runtime', 'public.products', 'DELETE') as products_delete,
       has_table_privilege('app_runtime', 'public.tenants', 'DELETE') as tenants_delete,
       has_table_privilege('app_runtime', 'public.tenant_memberships', 'DELETE') as memberships_delete,
       has_table_privilege('app_runtime', 'public.audit_events', 'SELECT') as audit_select,
       has_table_privilege('app_runtime', 'public.rate_limits', 'DELETE') as rate_limit_delete`,
  );
  assert.deepEqual(privileges.rows[0], {
    runtime_create_schema: false,
    auth_delete: true,
    products_delete: false,
    tenants_delete: false,
    memberships_delete: false,
    audit_select: false,
    rate_limit_delete: true,
  });

  await assert.rejects(
    client.query(
      `insert into products (tenant_id, user_id, name, tax_rate)
       values ($1, $2, 'Taxa inválida', '1.000001')`,
      [tenantA, userA],
    ),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "23514",
  );

  const ownRows = await withRuntimeContext(client, { userId: userA, tenantId: tenantA }, async () =>
    client.query<{ name: string }>("select name from products where tenant_id = $1", [tenantA]),
  );
  assert.deepEqual(
    ownRows.rows.map((row) => row.name),
    ["Produto A"],
  );

  const membershipAccess = await withRuntimeContext(
    client,
    { userId: userA, tenantId: tenantA },
    async () =>
      client.query<{ own: boolean; other: boolean }>(
        "select app_private.has_tenant_access($1::uuid) as own, app_private.has_tenant_access($2::uuid) as other",
        [tenantA, tenantB],
      ),
  );
  assert.deepEqual(membershipAccess.rows[0], { own: true, other: false });

  const crossTenantRows = await withRuntimeContext(
    client,
    { userId: userA, tenantId: tenantB },
    async () => client.query("select id from products where tenant_id = $1", [tenantB]),
  );
  assert.equal(crossTenantRows.rowCount, 0);

  const missingContextRows = await withRuntimeContext(client, {}, async () =>
    client.query("select id from products"),
  );
  assert.equal(missingContextRows.rowCount, 0);

  await assert.rejects(
    withRuntimeContext(client, { userId: userA, tenantId: tenantA }, async () =>
      client.query(
        `insert into expenses (tenant_id, user_id, name, amount, type)
         values ($1, $2, 'Cross tenant', '10.0000', 'fixa')`,
        [tenantB, userA],
      ),
    ),
    (error: unknown) =>
      typeof error === "object" && error !== null && "code" in error && error.code === "42501",
  );
}

async function main(): Promise<void> {
  await runMigrations(adminUrl);

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await seedIsolationFixtures(client);
    await assertDatabaseContract(client);

    const rollbackSql = await readFile(resolve("drizzle/rollback/0001_to_0000_down.sql"), "utf8");
    await client.query(rollbackSql);
    const rolledBack = await client.query<{ table_name: string | null }>(
      "select to_regclass('public.products')::text as table_name",
    );
    assert.equal(rolledBack.rows[0]?.table_name, null);
  } finally {
    await client.end();
  }

  // A rollback must leave a database where the complete migration chain can be replayed.
  await runMigrations(adminUrl);
  console.log("Migration zero, constraints, RLS, cross-tenant e rollback: OK");
}

await main();
