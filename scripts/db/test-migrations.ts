import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { ensureRuntimeRoleMembership, requireAdminUrl, runMigrations } from "./migrate";

const adminUrl = requireAdminUrl();
const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "20000000-0000-4000-8000-000000000002";
const userA = "30000000-0000-4000-8000-000000000003";
const userB = "40000000-0000-4000-8000-000000000004";
const productA = "50000000-0000-4000-8000-000000000005";
const productB = "60000000-0000-4000-8000-000000000006";
const expectedPostgresMajor = Number(process.env.EXPECTED_POSTGRES_MAJOR ?? "17");

if (!Number.isInteger(expectedPostgresMajor) || expectedPostgresMajor < 10) {
  throw new Error("EXPECTED_POSTGRES_MAJOR deve ser um major PostgreSQL inteiro >= 10");
}

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

async function withRuntimeCommit<T>(
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
    await client.query("commit");
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
    `insert into products (id, tenant_id, user_id, name, current_price, tax_rate)
     values ($1, $2, $3, 'Produto A', '12.3400', '0.060000'),
            ($4, $5, $6, 'Produto B', '99.9900', '0.120000')`,
    [productA, tenantA, userA, productB, tenantB, userB],
  );
}

async function assertDatabaseContract(client: Client): Promise<void> {
  const version = await client.query<{ serverVersionNum: string }>(
    "select current_setting('server_version_num') as \"serverVersionNum\"",
  );
  const serverVersionNum = Number(version.rows[0]?.serverVersionNum);
  const actualPostgresMajor = Math.floor(serverVersionNum / 10_000);
  assert.equal(
    actualPostgresMajor,
    expectedPostgresMajor,
    `PostgreSQL major incompatível: esperado ${expectedPostgresMajor}, atual ${actualPostgresMajor}`,
  );

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

  const ownedObjects = await client.query<{
    objectType: string;
    objectCount: string;
  }>(`
    with runtime as (
      select oid from pg_roles where rolname = 'app_runtime'
    )
    select object_type as "objectType", count(*)::text as "objectCount"
    from (
      select 'schema' as object_type
      from pg_namespace n
      join runtime on runtime.oid = n.nspowner
      where n.nspname not like 'pg_%'
        and n.nspname <> 'information_schema'
      union all
      select 'database' as object_type
      from pg_database d
      join runtime on runtime.oid = d.datdba
      where d.datname = current_database()
      union all
      select 'relation' as object_type
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join runtime on runtime.oid = c.relowner
      where n.nspname not like 'pg_%'
        and n.nspname <> 'information_schema'
      union all
      select 'function' as object_type
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join runtime on runtime.oid = p.proowner
      where n.nspname not like 'pg_%'
        and n.nspname <> 'information_schema'
      union all
      select 'type' as object_type
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join runtime on runtime.oid = t.typowner
      where n.nspname not like 'pg_%'
        and n.nspname <> 'information_schema'
    ) owned
    group by object_type
    order by object_type
  `);
  assert.deepEqual(ownedObjects.rows, []);

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
    purchase_history_select: boolean;
    purchase_history_update: boolean;
    sales_insert: boolean;
    sales_delete: boolean;
    sales_update: boolean;
    sales_items_update: boolean;
    simulations_update: boolean;
    snapshots_insert: boolean;
  }>(
    `select
       has_schema_privilege('app_runtime', 'public', 'CREATE') as runtime_create_schema,
       has_table_privilege('app_runtime', 'public.users', 'DELETE') as auth_delete,
       has_table_privilege('app_runtime', 'public.products', 'DELETE') as products_delete,
       has_table_privilege('app_runtime', 'public.tenants', 'DELETE') as tenants_delete,
       has_table_privilege('app_runtime', 'public.tenant_memberships', 'DELETE') as memberships_delete,
       has_table_privilege('app_runtime', 'public.audit_events', 'SELECT') as audit_select,
       has_table_privilege('app_runtime', 'public.rate_limits', 'DELETE') as rate_limit_delete,
       has_table_privilege('app_runtime', 'public.purchase_price_history', 'SELECT') as purchase_history_select,
       has_table_privilege('app_runtime', 'public.purchase_price_history', 'UPDATE') as purchase_history_update,
       has_table_privilege('app_runtime', 'public.sales', 'INSERT') as sales_insert,
       has_table_privilege('app_runtime', 'public.sales', 'DELETE') as sales_delete,
       has_table_privilege('app_runtime', 'public.sales', 'UPDATE') as sales_update,
       has_table_privilege('app_runtime', 'public.sales_items', 'UPDATE') as sales_items_update,
       has_table_privilege('app_runtime', 'public.simulations', 'UPDATE') as simulations_update,
       has_table_privilege('app_runtime', 'public.calculation_snapshots', 'INSERT') as snapshots_insert`,
  );
  assert.deepEqual(privileges.rows[0], {
    runtime_create_schema: false,
    auth_delete: true,
    products_delete: false,
    tenants_delete: false,
    memberships_delete: false,
    audit_select: false,
    rate_limit_delete: true,
    purchase_history_select: true,
    purchase_history_update: false,
    sales_insert: true,
    sales_delete: false,
    sales_update: false,
    sales_items_update: false,
    simulations_update: false,
    snapshots_insert: true,
  });

  const p1Columns = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
       and ((table_name = 'products' and column_name = 'status')
         or (table_name = 'purchase_price_history' and column_name in ('ingredient_id', 'packaging_id'))
         or (table_name = 'simulations' and column_name in ('result', 'scenario_type', 'engine_version')))
     order by table_name, column_name`,
  );
  assert.deepEqual(p1Columns.rows, [
    { table_name: "products", column_name: "status" },
    { table_name: "purchase_price_history", column_name: "ingredient_id" },
    { table_name: "purchase_price_history", column_name: "packaging_id" },
    { table_name: "simulations", column_name: "engine_version" },
    { table_name: "simulations", column_name: "result" },
    { table_name: "simulations", column_name: "scenario_type" },
  ]);

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

  const tenantASale = await withRuntimeCommit(
    client,
    { userId: userA, tenantId: tenantA },
    async () => {
      const sale = await client.query<{ id: string }>(
        `insert into sales (tenant_id, user_id, occurred_at, gross_amount, net_amount, channel)
         values ($1, $2, now(), '20.0000', '20.0000', 'manual')
         returning id`,
        [tenantA, userA],
      );
      await client.query(
        `insert into sales_items
           (tenant_id, user_id, sale_id, product_id, quantity, unit_price, total_amount)
         values ($1, $2, $3, $4, '2.000000', '10.0000', '20.0000')`,
        [tenantA, userA, sale.rows[0]?.id, productA],
      );
      return sale.rows[0]?.id;
    },
  );
  assert.ok(tenantASale);

  await assert.rejects(
    withRuntimeCommit(client, { userId: userA, tenantId: tenantA }, async () =>
      client.query(
        `insert into sales (tenant_id, user_id, occurred_at, gross_amount, net_amount, channel)
         values ($1, $2, now(), '10.0000', '10.0000', 'manual')`,
        [tenantA, userA],
      ),
    ),
    (error: unknown) => error instanceof Error && error.message.includes("SALE_REQUIRES_ITEM"),
  );

  await client.query("delete from sales where id = $1", [tenantASale]);

  const crossTenantSales = await withRuntimeContext(
    client,
    { userId: userB, tenantId: tenantB },
    async () => client.query("select id from sales where tenant_id = $1", [tenantA]),
  );
  assert.equal(crossTenantSales.rowCount, 0);
}

async function main(): Promise<void> {
  await runMigrations(adminUrl);

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await ensureRuntimeRoleMembership(client);
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
  console.log(
    `PostgreSQL ${expectedPostgresMajor}, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK`,
  );
}

await main();
