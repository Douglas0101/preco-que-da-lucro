// F3.4: real UI, independent arithmetic, tenant identities and recovery.
// Only the qualified local synthetic PG17 bench is supported. Credentials
// are generated in memory; neither auth bodies nor database URLs are emitted.
// Bundle without injected function names before serializing the DOM helper:
// npx --no-install esbuild scripts/qa/consolidated-margin-gate.mjs --bundle
//   --platform=node --packages=external --format=esm --outfile=.artifacts/c29-margin-gate.mjs
// Run: node .artifacts/c29-margin-gate.mjs <url> <output-dir>
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import pg from "pg";
import { chromium } from "playwright";
import { expect } from "@playwright/test";
import { hashPassword } from "../../src/server/auth/password.server.ts";
import { classificarAlvo } from "../lib/db-target.ts";
import { captureDomSnapshot } from "../../e2e/visual/visual-capture.ts";
import {
  buildRedactedCapture,
  persistVisualCapture,
} from "../../src/lib/observability/visual-perception.ts";
import { redactText } from "../../src/lib/observability/visual-redaction.ts";
import {
  assertLoopbackBench,
  loginIfNeeded,
  logoutViaUi,
  readBenchEnv,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const outputDir = process.argv[3];
assertLoopbackBench(baseUrl);
assert.ok(outputDir, "evidence directory required");
mkdirSync(outputDir, { recursive: true });
const { pid } = readBenchFixtureCredentials(baseUrl);
assert.ok(pid, "qualified bench unavailable");
const adminUrl = readBenchEnv(pid, ["DATABASE_ADMIN_URL"]).DATABASE_ADMIN_URL;
assert.equal(
  classificarAlvo(adminUrl, {}).modo,
  "loopback",
  "synthetic admin database must be local",
);
const runtimeUrl = readBenchEnv(pid).databaseUrl;
assert.equal(classificarAlvo(runtimeUrl, {}).modo, "loopback");
const databaseIdentity = (url) => {
  const parsed = new URL(url);
  return [parsed.hostname, parsed.port, parsed.pathname];
};
assert.deepEqual(databaseIdentity(runtimeUrl), databaseIdentity(adminUrl));
const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const namespace = randomUUID();
const accounts = [];
const cases = [];
const captures = [];
const errors = [];
const REQUIRED_CASES = [
  "empty-with-product-and-foreign-sales",
  "actual-price-40-vs-catalog-25",
  "month-excludes-previous-month",
  "year-includes-previous-month",
  "mixed-sale-with-unknown-cost",
  "restored-calculable-month",
  "controlled-summary-error-retry",
  "logout-protected-route-login-B",
  "tenant-B-visible-and-A-absent",
  "login-back-to-A-without-B-cache",
  "actual-loss-below-cost",
  "recorded-sale-with-zero-revenue",
];
let dashboardPath;

async function fixtureAccount(letter, ip) {
  const credentials = {
    email: `margin-${letter.toLowerCase()}-${namespace}@c29.invalid`,
    password: randomBytes(24).toString("hex"),
  };
  const context = await browser.newContext({
    viewport: { width: 1350, height: 880 },
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const userId = randomUUID();
  const tenantId = randomUUID();
  const productId = randomUUID();
  const entry = { letter, credentials, context, userId, tenantId, productId, sales: [] };
  accounts.push(entry);
  await client.query("BEGIN");
  try {
    // Same credential fixture idiom as scripts/e2e/seed-auth.ts: verified
    // synthetic users, hashed local credential, real sign-in still required.
    await client.query("INSERT INTO users (id,name,email,email_verified) VALUES ($1,$2,$3,true)", [
      userId,
      `QA Margem ${letter}`,
      credentials.email,
    ]);
    await client.query(
      `INSERT INTO accounts (id,account_id,provider_id,user_id,password,issuer)
      VALUES ($1,$2,'credential',$2,$3,'local:credential')`,
      [`c29-credential-${userId}`, userId, await hashPassword(credentials.password)],
    );
    await client.query("INSERT INTO tenants (id,name,slug) VALUES ($1,$2,$3)", [
      tenantId,
      `QA Margem ${letter}`,
      `c29-${letter}-${namespace}`,
    ]);
    await client.query(
      "INSERT INTO tenant_memberships (tenant_id,user_id,role) VALUES ($1,$2,'owner')",
      [tenantId, userId],
    );
    await client.query(
      "INSERT INTO profiles (id,tenant_id,user_id,email,display_name) VALUES ($1,$2,$1,$3,$4)",
      [userId, tenantId, credentials.email, `QA Margem ${letter}`],
    );
    await client.query(
      `INSERT INTO products (id,tenant_id,user_id,name,current_price,yield_qty,yield_unit,status,tax_rate)
      VALUES ($1,$2,$3,$4,25,1,'unidade','active',0.1)`,
      [productId, tenantId, userId, `C29 calculável ${letter}`],
    );
    await client.query(
      `INSERT INTO product_ingredients (product_id,tenant_id,user_id,name,used_qty,used_unit,package_price,package_qty,package_unit)
      VALUES ($1,$2,$3,'Farinha sintética',1,'kg',10,1,'kg')`,
      [productId, tenantId, userId],
    );
    await client.query(
      `INSERT INTO product_packaging (product_id,tenant_id,user_id,name,package_price,units_per_package)
      VALUES ($1,$2,$3,'Caixa sintética',1,1)`,
      [productId, tenantId, userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return entry;
}

async function sale(
  account,
  quantity,
  price,
  occurredAt = new Date(),
  productId = account.productId,
) {
  const saleId = randomUUID();
  const total = new Decimal(quantity).mul(price).toFixed(4);
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO sales (id,tenant_id,user_id,occurred_at,gross_amount,net_amount,channel)
      VALUES ($1,$2,$3,$4,$5,$5,'Loja')`,
      [saleId, account.tenantId, account.userId, occurredAt, total],
    );
    await client.query(
      `INSERT INTO sales_items (sale_id,tenant_id,user_id,product_id,quantity,unit_price,total_amount)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [saleId, account.tenantId, account.userId, productId, quantity, price, total],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  account.sales.push(saleId);
  return saleId;
}

function marginCard(page) {
  return page
    .locator(".bg-card")
    .filter({ hasText: /Margem consolidada/i })
    .first();
}
async function ready(page) {
  await expect(page.getByRole("heading", { name: "Olá! 👋" })).toBeVisible();
  await expect(marginCard(page)).toBeVisible();
}
async function record(page, name, expected) {
  await ready(page);
  await expect(marginCard(page)).toContainText(expected);
  assert.ok(
    !(await page.locator("body").innerText()).match(/NaN|Infinity|Something went wrong/),
    "invalid calculation/crash visible",
  );
  cases.push({
    name,
    expected: String(expected),
    actual: redactText(await marginCard(page).innerText()).value,
    ok: true,
  });
  const capture = buildRedactedCapture({
    label: name,
    screenshotPng: await page.screenshot({
      mask: [page.locator('input[type="email"], input[type="password"]')],
    }),
    a11ySnapshot: await page.locator("body").ariaSnapshot(),
    domSnapshot: await captureDomSnapshot(page),
    correlationId: null,
  });
  captures.push({ name, ...(await persistVisualCapture(capture)) });
}

try {
  const a = await fixtureAccount("A", "198.51.100.181");
  const b = await fixtureAccount("B", "198.51.100.182");
  await sale(b, "1", "1000");
  const page = await a.context.newPage();
  page.on("pageerror", (error) => errors.push(redactText(error.message).value));
  page.on("response", async (response) => {
    if (response.url().includes("/_serverFn/") && response.status() === 200) {
      const text = await response.text().catch(() => "");
      if (text.includes("consolidatedMargin") && text.includes("productCount"))
        dashboardPath = new URL(response.url()).pathname;
    }
  });
  await page.goto(`${baseUrl}/inicio`);
  await loginIfNeeded(page, baseUrl, a.credentials);
  await record(page, "empty-with-product-and-foreign-sales", /Registre vendas reais/);
  await sale(a, "2", "40");
  await page.reload();
  await record(page, "actual-price-40-vs-catalog-25", /62,50/);
  await expect(page.locator("body")).toContainText("R$ 80,00");
  const oldDate = new Date();
  assert.ok(oldDate.getMonth() > 0, "period fixture requires a month after January");
  oldDate.setMonth(oldDate.getMonth() - 1, 15);
  await sale(a, "1", "10", oldDate);
  await page.reload();
  await record(page, "month-excludes-previous-month", /62,50/);
  await page.getByRole("button", { name: "Ano", exact: true }).click();
  await record(page, "year-includes-previous-month", /53,33/);
  await expect(page.locator("body")).toContainText("R$ 90,00");
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  const incompleteId = randomUUID();
  await client.query(
    "INSERT INTO products (id,tenant_id,user_id,name,status) VALUES ($1,$2,$3,'C29 incompleto A','draft')",
    [incompleteId, a.tenantId, a.userId],
  );
  const incompleteSale = await sale(a, "1", "10", new Date(), incompleteId);
  await page.reload();
  await record(
    page,
    "mixed-sale-with-unknown-cost",
    /1 produto\(s\) vendido\(s\) sem custo calculável/,
  );
  await expect(marginCard(page)).toContainText("DADOS INCOMPLETOS");
  await client.query("DELETE FROM sales WHERE id=$1 AND tenant_id=$2", [
    incompleteSale,
    a.tenantId,
  ]);
  await page.reload();
  await record(page, "restored-calculable-month", /62,50/);
  await expect.poll(() => Boolean(dashboardPath)).toBe(true);
  const failureUrl = `${baseUrl}${dashboardPath}*`;
  await page.route(failureUrl, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"synthetic dashboard outage"}',
    }),
  );
  await page.reload();
  await expect(page.getByText("Não foi possível carregar o resumo financeiro.")).toBeVisible({
    timeout: 20000,
  });
  await page.unroute(failureUrl);
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await record(page, "controlled-summary-error-retry", /62,50/);
  // The same tab must switch accounts by identity without carrying A's data.
  await logoutViaUi(page);
  await page.goto(`${baseUrl}/inicio`);
  await loginIfNeeded(page, baseUrl, b.credentials);
  await record(page, "logout-protected-route-login-B", /88,90/);
  await expect(page.locator("body")).toContainText("R$ 1.000,00");
  await page.goto(`${baseUrl}/produtos`);
  await expect(page.getByText("C29 calculável B", { exact: true })).toBeVisible();
  await expect(page.getByText("C29 calculável A", { exact: true })).toHaveCount(0);
  cases.push({ name: "tenant-B-visible-and-A-absent", ok: true, tenantId: b.tenantId });
  await logoutViaUi(page);
  await page.goto(`${baseUrl}/inicio`);
  await loginIfNeeded(page, baseUrl, a.credentials);
  await record(page, "login-back-to-A-without-B-cache", /62,50/);
  await expect(page.locator("body")).toContainText("R$ 80,00");
  await client.query("DELETE FROM sales WHERE tenant_id=$1", [a.tenantId]);
  await sale(a, "2", "5");
  await page.reload();
  await record(page, "actual-loss-below-cost", /-130,00/);
  await client.query("DELETE FROM sales WHERE tenant_id=$1", [a.tenantId]);
  await sale(a, "1", "0");
  await page.reload();
  await record(page, "recorded-sale-with-zero-revenue", /faturamento real do período é zero/);
  await expect(marginCard(page)).toContainText("DADOS INCOMPLETOS");
  assert.deepEqual(errors, [], "no client runtime exceptions permitted");
  assert.deepEqual(cases.map((entry) => entry.name).sort(), [...REQUIRED_CASES].sort());
} finally {
  for (const account of accounts) {
    await account.context.close();
    await client.query("DELETE FROM sales WHERE tenant_id=$1", [account.tenantId]);
    await client.query("DELETE FROM products WHERE tenant_id=$1", [account.tenantId]);
    await client.query("DELETE FROM profiles WHERE tenant_id=$1", [account.tenantId]);
    await client.query("DELETE FROM tenant_memberships WHERE tenant_id=$1", [account.tenantId]);
    await client.query("DELETE FROM tenants WHERE id=$1", [account.tenantId]);
    await client.query("DELETE FROM users WHERE id=$1", [account.userId]);
    for (const [table, id] of [
      ["tenants", account.tenantId],
      ["users", account.userId],
    ]) {
      const remaining = await client.query(`SELECT id FROM ${table} WHERE id=$1`, [id]);
      assert.equal(remaining.rows.length, 0, "owned synthetic identity cleanup must be proven");
    }
  }
  await client.end();
  await browser.close();
  const report = {
    at: new Date().toISOString(),
    verdict:
      cases.every((entry) => entry.ok) &&
      JSON.stringify(cases.map((entry) => entry.name).sort()) ===
        JSON.stringify([...REQUIRED_CASES].sort()) &&
      errors.length === 0
        ? "GREEN"
        : "INCOMPLETE",
    cases,
    captures,
    errors,
    cleanup: "owned identities independently absent",
  };
  const safe = redactText(JSON.stringify(report, null, 2)).value;
  writeFileSync(join(outputDir, "steps.json"), safe);
  console.log(safe);
}
