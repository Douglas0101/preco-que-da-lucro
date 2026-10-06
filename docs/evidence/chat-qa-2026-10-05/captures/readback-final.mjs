import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import pg from "pg";

assert.ok(process.argv.slice(2).every((arg) => arg === "--final-build"));
const finalBuild = process.argv.includes("--final-build");
const expectedTurns = finalBuild ? 7 : 5;
const expectedUsage = finalBuild ? 12 : 10;
const pid = readFileSync("/tmp/pqdl-chat-qa-20261005/runtime-after.pid", "utf8").trim();
const env = Object.fromEntries(
  readFileSync(`/proc/${pid}/environ`, "utf8")
    .split("\0")
    .filter((entry) => entry.includes("="))
    .map((entry) => [entry.slice(0, entry.indexOf("=")), entry.slice(entry.indexOf("=") + 1)]),
);
const admin = new URL(env.DATABASE_ADMIN_URL);
const app = new URL(env.DATABASE_URL);
assert.equal(admin.hostname, "127.0.0.1");
assert.equal(admin.port, "41922");
assert.equal(admin.host, app.host);
assert.equal(admin.pathname, app.pathname);
assert.ok(env.E2E_AUTH_EMAIL.endsWith("@example.test"));
const tenant = "00000000-0000-4000-8000-000000000002";
const productId = "01e3b94a-91f4-42f8-9ddb-651f370d1187";
const conversationId = "00000000-0000-4000-8000-000000000020";
const since = "2026-10-05T23:58:23.792Z";
const client = new pg.Client({ connectionString: env.DATABASE_ADMIN_URL });
await client.connect();
try {
  await client.query("BEGIN READ ONLY");
  const product = (
    await client.query(
      "SELECT id,name,status,current_price,yield_qty,yield_unit,tax_regime,tax_rate FROM products WHERE tenant_id=$1 AND id=$2",
      [tenant, productId],
    )
  ).rows;
  assert.equal(product.length, 1);
  assert.equal(product[0].name, "Pizza QA Chrome 05-10");
  assert.equal(product[0].current_price, "30.0000");
  assert.equal(product[0].yield_qty, "1.000000");
  assert.equal(product[0].yield_unit, "unidade");
  assert.equal(product[0].tax_regime, "MEI");
  assert.equal(product[0].tax_rate, null);
  const ingredients = (
    await client.query(
      "SELECT id,name,used_qty,used_unit,package_price,package_qty,package_unit FROM product_ingredients WHERE tenant_id=$1 AND product_id=$2 ORDER BY name",
      [tenant, productId],
    )
  ).rows;
  assert.deepEqual(
    ingredients.map((row) => [row.name.toLowerCase(), row.package_price, row.used_qty]),
    [
      ["massa", "4.0000", "1.000000"],
      ["queijo", "6.0000", "1.000000"],
    ],
  );
  const absent = {};
  for (const table of ["product_packaging", "sales_fees", "market_prices"]) {
    absent[table] = (
      await client.query(`SELECT id FROM ${table} WHERE tenant_id=$1 AND product_id=$2`, [
        tenant,
        productId,
      ])
    ).rows.length;
    assert.equal(absent[table], 0);
  }
  const duplicates = (
    await client.query(
      "SELECT id FROM products WHERE tenant_id=$1 AND created_at >= $2 AND name=$3",
      [tenant, since, product[0].name],
    )
  ).rows;
  assert.deepEqual(
    duplicates.map((row) => row.id),
    [productId],
  );
  const conversation = (
    await client.query(
      "SELECT id,conversation_state,current_product_id FROM chat_conversations WHERE tenant_id=$1 AND id=$2",
      [tenant, conversationId],
    )
  ).rows;
  assert.equal(conversation.length, 1);
  assert.equal(conversation[0].current_product_id, productId);
  assert.equal(conversation[0].conversation_state, "completed");
  const tools = (
    await client.query(
      "SELECT tool_name,status,error_code FROM tool_executions WHERE tenant_id=$1 AND started_at >= $2 ORDER BY started_at",
      [tenant, since],
    )
  ).rows;
  assert.equal(tools.length, 7);
  assert.ok(tools.every((row) => row.status === "succeeded" && row.error_code === null));
  assert.equal(tools.filter((row) => row.tool_name === "create_product").length, 1);
  const usage = (
    await client.query(
      "SELECT usage_id,status,cost_status,real_tokens,estimated_cost,outcome,round_no FROM ai_usage WHERE tenant_id=$1 AND reserved_at >= $2 ORDER BY reserved_at",
      [tenant, since],
    )
  ).rows;
  assert.equal(usage.length, expectedUsage);
  assert.ok(
    usage.every(
      (row) => row.status === "settled" && row.cost_status === "known" && row.real_tokens > 0,
    ),
  );
  const costs = (
    await client.query(
      "SELECT SUM(estimated_cost)::text AS estimated_cost_usd FROM ai_usage WHERE tenant_id=$1 AND reserved_at >= $2",
      [tenant, since],
    )
  ).rows[0];
  const messages = (
    await client.query(
      "SELECT role,content FROM chat_messages WHERE tenant_id=$1 AND conversation_id=$2 AND created_at >= $3 ORDER BY created_at",
      [tenant, conversationId, since],
    )
  ).rows;
  assert.equal(messages.filter((row) => row.role === "user").length, expectedTurns);
  assert.equal(messages.filter((row) => row.role === "assistant").length, expectedTurns);
  const answers = messages.filter((row) => row.role === "assistant");
  assert.ok(answers[3].content.includes("motor financeiro"));
  assert.ok(!answers[3].content.includes("R$ 10,00"));
  assert.ok(answers[4].content.includes("R$ 30,00"));
  assert.ok(answers[4].content.includes("MEI"));
  if (finalBuild) {
    assert.ok(answers[5].content.includes("motor financeiro"));
    assert.ok(!/\bNaN\b|Infinity|∞/.test(answers[5].content));
    assert.ok(answers[6].content.includes("R$ 30,00"));
    assert.ok(answers[6].content.includes("MEI"));
  }
  const data = {
    observedAt: new Date().toISOString(),
    targetQualified: true,
    runtimePid: Number(pid),
    product: product[0],
    ingredients,
    absent,
    duplicateProductIds: duplicates.map((row) => row.id),
    conversation: conversation[0],
    tools,
    usage,
    estimatedCostUsd: costs.estimated_cost_usd,
    messages: {
      user: expectedTurns,
      assistant: expectedTurns,
      guardReplyPersisted: true,
      summaryReplyPersisted: true,
      finalBuild,
    },
  };
  writeFileSync(
    `docs/evidence/chat-qa-2026-10-05/captures/db-readback-${finalBuild ? "final-build" : "final"}.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
  console.log(JSON.stringify(data));
  await client.query("ROLLBACK");
} finally {
  await client.end();
}
