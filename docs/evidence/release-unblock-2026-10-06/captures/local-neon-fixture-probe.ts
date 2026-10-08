import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { resetEmptyFixture } from "../../../../scripts/ci/prepare-neon-fixture";

const connectionString = process.env.DATABASE_ADMIN_URL;
assert.ok(connectionString, "local fixture URL required");
const url = new URL(connectionString);
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "41923");
assert.equal(url.pathname, "/preco_que_da_lucro_test");
const client = new Client({ connectionString });
await client.connect();
try {
  const version = await client.query("select current_setting('server_version_num') as version");
  assert.equal(Math.floor(Number(version.rows[0].version) / 10000), 17);
  const ledger = await client.query(
    "select count(*)::text as count from drizzle.__drizzle_migrations",
  );
  assert.equal(ledger.rows[0].count, "0", "schema-only clone must not invent applied migrations");
  const userId = "fixture-empty-inventory-negative";
  await client.query(
    "insert into users(id, name, email) values ($1, 'Synthetic fixture', 'fixture@example.test')",
    [userId],
  );
  await client.query(
    "insert into accounts(id, account_id, provider_id, user_id, issuer) values ($1, $1, 'credential', $1, 'local:credential')",
    [userId],
  );
  await assert.rejects(
    client.query(readFileSync("drizzle/rollback/0010_to_0009_down.sql", "utf8")),
    (error: unknown) =>
      error instanceof Error && error.message.includes("rollback 0010 BLOQUEADO: 1 conta(s)"),
  );
  await client.query("rollback");
  await assert.rejects(resetEmptyFixture(client), /contains rows/);
  const preserved = await client.query("select id, issuer from accounts");
  assert.deepEqual(preserved.rows, [{ id: userId, issuer: "local:credential" }]);
  console.log(
    "NEGATIVE: existing rollback and new fixture guard both refuse one account; identity and issuer preserved",
  );
  // Remove only the synthetic sentinel we inserted in this fresh local container.
  await client.query("delete from users where id = $1", [userId]);
  const result = await resetEmptyFixture(client);
  assert.equal(result.rowsErased, 0);
  assert.ok(result.discoveredTables > 20);
  assert.equal(result.checkedTables, result.discoveredTables);
  const removed = await client.query(
    "select to_regclass('public.accounts') as account, to_regclass('drizzle.__drizzle_migrations') as ledger",
  );
  assert.deepEqual(removed.rows, [{ account: null, ledger: null }]);
  console.log(
    JSON.stringify({
      gate: "local-neon-empty-fixture",
      postgresMajor: 17,
      target: "fresh loopback:41923",
      helperSha256: createHash("sha256")
        .update(readFileSync("scripts/ci/prepare-neon-fixture.ts"))
        .digest("hex"),
      ...result,
      status: "PASS",
      limitation:
        "local PG17 function proof; remote API and schema-only creation remain separate CI evidence",
    }),
  );
} finally {
  await client.end();
}
