import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const directory = new URL("./", import.meta.url).pathname;
const receipt = JSON.parse(readFileSync(join(directory, "bench-identity.json"), "utf8"));
const fixture = JSON.parse(readFileSync(join(receipt.privateDirectory, "bench-env.json"), "utf8"));
const destination = new URL(fixture.DATABASE_ADMIN_URL);
assert.equal(destination.hostname, "127.0.0.1");
assert.equal(destination.port, String(receipt.postgresPort));
assert.notEqual(destination.port, "5432");
assert.equal(destination.pathname, "/preco_que_da_lucro_test");
const container = JSON.parse(
  execFileSync("docker", ["inspect", receipt.containerId], { encoding: "utf8" }),
)[0];
assert.equal(container.Id, receipt.containerId);
assert.equal(container.Name, `/${receipt.containerName}`);
assert.equal(container.Config.Labels["pqd.owner"], "chat-practical-2026-10-13");
assert.equal(container.Config.Labels["pqd.disposable"], "true");
assert.equal(container.State.Running, true);
assert.deepEqual(container.NetworkSettings.Ports["5432/tcp"], [
  { HostIp: "127.0.0.1", HostPort: String(receipt.postgresPort) },
]);
const client = new pg.Client({
  connectionString: fixture.DATABASE_ADMIN_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});
const tenant = "00000000-0000-4000-8000-000000000002";
const user = "00000000-0000-4000-8000-000000000001";
try {
  await client.connect();
  await client.query("begin transaction read only");
  const identity = (
    await client.query(
      "select current_database() as database, current_user as role, current_setting('server_version') as version",
    )
  ).rows[0];
  assert.equal(identity.database, "preco_que_da_lucro_test");
  assert.match(identity.version, /^17\./);
  const conversations = (
    await client.query(
      "select id, tenant_id, user_id, current_product_id, conversation_state, confirmed_state, created_at, updated_at from chat_conversations where tenant_id=$1 and user_id=$2 and created_at >= $3",
      [tenant, user, receipt.createdAt],
    )
  ).rows;
  assert.equal(conversations.length, 1);
  const conversation = conversations[0];
  const messages = (
    await client.query(
      "select id, role, content, metadata, created_at from chat_messages where tenant_id=$1 and user_id=$2 and conversation_id=$3 order by created_at, id",
      [tenant, user, conversation.id],
    )
  ).rows;
  const product =
    (
      await client.query(
        "select id, tenant_id, user_id, name, status, current_price, yield_qty, yield_unit, tax_regime, tax_rate, created_at, updated_at from products where tenant_id=$1 and user_id=$2 and id=$3",
        [tenant, user, conversation.current_product_id],
      )
    ).rows[0] ?? null;
  const productsInWindow = (
    await client.query(
      "select id, name, current_price, yield_qty, yield_unit, tax_regime, tax_rate, status, created_at from products where tenant_id=$1 and user_id=$2 and created_at >= $3 order by created_at, id",
      [tenant, user, receipt.createdAt],
    )
  ).rows;
  const ingredients = (
    await client.query(
      "select id, product_id, name, used_qty, used_unit, package_price, package_qty, package_unit, conversion_factor from product_ingredients where tenant_id=$1 and user_id=$2 and product_id=$3 order by name, id",
      [tenant, user, conversation.current_product_id],
    )
  ).rows;
  const tools = (
    await client.query(
      "select id, correlation_id, tool_name, status, input, safe_result, error_code, duration_ms, usage_id, started_at, completed_at from tool_executions where tenant_id=$1 and user_id=$2 and started_at >= $3 order by started_at, id",
      [tenant, user, receipt.createdAt],
    )
  ).rows;
  const usage = (
    await client.query(
      "select usage_id, kind, round_no, status, reserved_at, settled_at, real_tokens, outcome, estimated_cost, cost_status from ai_usage where tenant_id=$1 and reserved_at >= $2 order by reserved_at, usage_id",
      [tenant, receipt.createdAt],
    )
  ).rows;
  const budget = (
    await client.query(
      "select usage_date, chat_count, model_call_count, tool_call_count, input_tokens, output_tokens, tokens_reserved, in_flight, estimated_cost, estimated_cost_unknown_count from ai_daily_budgets where tenant_id=$1 and usage_date=current_date",
      [tenant],
    )
  ).rows;
  await client.query("rollback");
  const report = {
    observedAt: new Date().toISOString(),
    target: "disposable-loopback-only",
    containerId: receipt.containerId,
    applicationRevision: receipt.applicationRevision,
    readOnly: true,
    identity,
    conversation,
    messages,
    product,
    productsInWindow,
    ingredients,
    tools,
    usage,
    budget,
  };
  let safe = JSON.stringify(report, null, 2);
  for (const [name, value] of Object.entries(fixture)) {
    if (typeof value === "string" && value.length >= 8 && /SECRET|PASSWORD|URL|EMAIL/.test(name))
      safe = safe.replaceAll(value, `[REDACTED:${name}]`);
  }
  assert(!/postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|sk-[A-Za-z0-9]{12,}/i.test(safe));
  writeFileSync(join(directory, "bench-db-observation.json"), `${safe}\n`);
  console.log(
    JSON.stringify(
      {
        identity,
        conversation: {
          id: conversation.id,
          state: conversation.conversation_state,
          productId: conversation.current_product_id,
        },
        productsInWindow,
        ingredients,
        tools: tools.map((row) => ({
          name: row.tool_name,
          status: row.status,
          error: row.error_code,
          correlationId: row.correlation_id,
        })),
        usage: {
          rows: usage.length,
          settled: usage.filter((row) => row.status === "settled").length,
          knownCost: usage.filter((row) => row.cost_status === "known").length,
          estimatedUsd: usage.reduce((total, row) => total + Number(row.estimated_cost ?? 0), 0),
        },
        budget,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({ status: "precondition-or-query-failed", code: error.code ?? error.name }),
  );
  process.exitCode = 2;
} finally {
  await client.end();
}
