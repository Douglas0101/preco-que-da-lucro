// Synthetic long-name product fixture for the ciclo-29 DBT-89 structural
// proof (a >=60-char product name must not stretch the vendas form grid).
// Writes run in their own committed transaction under the same RLS context
// the application uses (app.current_user_id plus app.current_tenant_id); the
// connection string comes from the bench server environment, never printed.
import pg from "pg";
import { classificarAlvo } from "../lib/db-target.ts";

import { readBenchEnv, readBenchFixtureCredentials } from "./bench-lib.mjs";

export const LONG_NAME_MARKER =
  "Produto de nome deliberadamente longo para provar contencao de largura do seletor movel do formulario de vendas ciclo29";

async function connectFixtureDatabase(baseUrl) {
  const { pid } = readBenchFixtureCredentials(baseUrl);
  if (!pid) throw new Error("bench process not found");
  const { databaseUrl } = readBenchEnv(pid);
  if (!databaseUrl || classificarAlvo(databaseUrl, {}).modo !== "loopback")
    throw new Error("fixture database must be qualified loopback");
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  return client;
}

export async function withFixtureIdentity(baseUrl, fn, { commit = false } = {}) {
  const { email } = readBenchFixtureCredentials(baseUrl);
  if (!email) throw new Error("fixture credentials unavailable");
  const client = await connectFixtureDatabase(baseUrl);
  try {
    await client.query("BEGIN");
    const user = await client.query(`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [
      email,
    ]);
    if (user.rows.length !== 1) throw new Error("fixture user not found");
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [user.rows[0].id]);
    const membership = await client.query(
      `SELECT tenant_id FROM tenant_memberships WHERE user_id = $1 ORDER BY created_at LIMIT 1`,
      [user.rows[0].id],
    );
    if (membership.rows.length !== 1) throw new Error("fixture tenant not found");
    const tenantId = membership.rows[0].tenant_id;
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query("SET LOCAL ROLE app_runtime");
    const result = await fn(client, { tenantId, userId: user.rows[0].id });
    await client.query(commit ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function archiveMarker(baseUrl) {
  // The runtime role has no DELETE grant (products are archive-only in the
  // application), so the fixture copy is soft-archived on entry and exit.
  await withFixtureIdentity(
    baseUrl,
    async (client) => {
      await client.query(
        `UPDATE products SET archived_at = now() WHERE name = $1 AND archived_at IS NULL`,
        [LONG_NAME_MARKER],
      );
    },
    { commit: true },
  );
}

/**
 * Runs `fn()` with a long-name product inserted (and committed) for the
 * fixture account's tenant; the row is archived afterwards.
 */
export async function withLongNameFixture(baseUrl, fn) {
  await archiveMarker(baseUrl);
  await withFixtureIdentity(
    baseUrl,
    async (client, { tenantId, userId }) => {
      await client.query(
        `INSERT INTO products (tenant_id,user_id,name,current_price,yield_qty,yield_unit,tax_rate)
         VALUES ($1,$2,$3,37,1,'unidade',0)`,
        [tenantId, userId, LONG_NAME_MARKER],
      );
    },
    { commit: true },
  );
  try {
    return await fn();
  } finally {
    await archiveMarker(baseUrl);
  }
}

/** Ids and names of the fixture tenant products (read-only). */
export async function listFixtureProducts(baseUrl) {
  return withFixtureIdentity(baseUrl, async (client, { tenantId }) => {
    const rows = await client.query(
      `SELECT id, name FROM products WHERE tenant_id = $1 AND archived_at IS NULL ORDER BY created_at`,
      [tenantId],
    );
    return rows.rows.map((row) => ({ id: row.id, name: row.name }));
  });
}
