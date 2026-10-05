// DBT-87 + DBT-89 gate: product selectors must render the product NAME in
// their trigger (initial state, after a change, after a full reload) while
// the wire payload keeps the product UUID, on desktop and mobile; and the
// vendas form must not stretch its grid track even for a >=60-char name.
//
// RED   (exit 1): any trigger showing a raw UUID/missing name, payload losing
//                 the id, or the long-name fixture stretching the form.
// GREEN (exit 0): all checks pass (desktop 1350x880 and mobile 390x844).
// PRECONDITION (exit 2): bench/credentials/database unavailable.
//
// Usage: node scripts/qa/product-select-gate.mjs [baseUrl] [evidenceDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { expect } from "@playwright/test";

import {
  assertLoopbackBench,
  geometryProbe,
  loginIfNeeded,
  persistBenchScreenshot,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";
import {
  LONG_NAME_MARKER,
  listFixtureProducts,
  withLongNameFixture,
} from "./long-name-fixture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4174";
const evidenceDir = process.argv[3] ?? null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT_ROUTES = ["/vendas", "/diagnostico", "/simulacoes", "/ponto-equilibrio"];
const BREAKPOINTS = [
  { name: "desktop", width: 1350, height: 880 },
  { name: "mobile", width: 390, height: 844 },
];

assertLoopbackBench(baseUrl);
const creds = readBenchFixtureCredentials(baseUrl);
if (!creds.pid || !creds.email || !creds.password) {
  console.error(
    JSON.stringify({ verdict: "PRECONDITION", reason: "bench or fixture credentials unavailable" }),
  );
  process.exit(2);
}

async function triggerText(page) {
  return (await page.locator('[data-slot="select-trigger"]').first().innerText()).trim();
}

async function productNames(page) {
  const names = [];
  const items = page.locator('[data-slot="select-content"] [role="option"]');
  let lastError = null;
  for (let attempt = 0; attempt < 2 && names.length === 0; attempt += 1) {
    await page.locator('[data-slot="select-trigger"]').first().click();
    try {
      await items.first().waitFor({ state: "visible", timeout: 5000 });
      names.push(...(await items.allInnerTexts()));
    } catch (error) {
      lastError = error;
    }
    await page.keyboard.press("Escape");
  }
  if (names.length === 0) throw lastError ?? new Error("select options not found");
  return names.map((name) => name.trim());
}

async function pickOptionByName(page, name) {
  await page.locator('[data-slot="select-trigger"]').first().click();
  const option = page
    .locator('[data-slot="select-content"] [role="option"]', { hasText: name })
    .first();
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
}

const checks = [];

function record(where, ok, detail) {
  checks.push({ where, ok, detail: String(detail).slice(0, 160) });
}

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
try {
  await withLongNameFixture(baseUrl, async () => {
    const products = await listFixtureProducts(baseUrl);
    const names = products.map((p) => p.name);
    if (names.length < 2 || !names.includes(LONG_NAME_MARKER)) {
      throw new Error(`fixture products insufficient: ${names.length} (long marker missing)`);
    }
    const context = await browser.newContext({ viewport: { width: 1350, height: 880 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/vendas`, { waitUntil: "domcontentloaded" });
    await loginIfNeeded(page, baseUrl, creds);

    for (const breakpoint of BREAKPOINTS) {
      for (const route of SELECT_ROUTES) {
        const where = `${route}@${breakpoint.name}`;
        await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
        await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
        await page
          .locator('[data-slot="select-trigger"]')
          .first()
          .waitFor({ state: "visible", timeout: 20000 });

        // (a) initial pre-selection renders a NAME, never a raw UUID
        await expect.poll(async () => names.includes(await triggerText(page))).toBe(true);
        const initial = await triggerText(page);
        record(`${where} initial-name`, names.includes(initial), initial.slice(0, 60));

        // (b) after changing the selection the NAME updates
        const other = names.find((n) => n !== initial);
        await pickOptionByName(page, other);
        await expect.poll(() => triggerText(page)).toBe(other);
        const afterChange = await triggerText(page);
        record(`${where} change-name`, afterChange === other, afterChange.slice(0, 60));

        // (c) after a full reload the trigger still renders a NAME
        await page.reload({ waitUntil: "domcontentloaded" });
        await page
          .locator('[data-slot="select-trigger"]')
          .first()
          .waitFor({ state: "visible", timeout: 20000 });
        await expect.poll(async () => names.includes(await triggerText(page))).toBe(true);
        const afterReload = await triggerText(page);
        record(`${where} reload-name`, names.includes(afterReload), afterReload.slice(0, 60));
      }
      // Premises belong to the selected product identity. Changing the name
      // shown by the trigger must not keep the previous product's inputs.
      await page.goto(`${baseUrl}/diagnostico`);
      await pickOptionByName(page, LONG_NAME_MARKER);
      const variableCost = page.locator("#diagnostico-custo-variavel-unitario");
      const targetRate = page.locator("#diagnostico-margem-alvo");
      await variableCost.fill("83.17");
      await targetRate.fill("47.23");
      const diagnosticOther = names.find((name) => name !== LONG_NAME_MARKER);
      await pickOptionByName(page, diagnosticOther);
      await expect(variableCost).toHaveValue("");
      await expect(targetRate).toHaveValue("");
      record(`diagnostico@${breakpoint.name} premises-identity`, true, "both premises cleared");

      await page.goto(`${baseUrl}/simulacoes`);
      await pickOptionByName(page, LONG_NAME_MARKER);
      const simulatedPrice = page.locator("#simulacao-preco-venda");
      const simulatedVolume = page.locator("#simulacao-volume-vendas");
      await expect(simulatedPrice).toHaveValue("37,00");
      await simulatedPrice.fill("777,12");
      await simulatedVolume.fill("123");
      // The preserved review fixture has a second calculable product at20.
      if (!names.includes("Produto de teste")) throw new Error("identity sentinel product missing");
      await pickOptionByName(page, "Produto de teste");
      await expect(simulatedPrice).toHaveValue("20,00");
      await expect(simulatedVolume).toHaveValue("");
      record(
        `simulacoes@${breakpoint.name} premises-identity`,
        true,
        "new price20, previous volume absent",
      );
    }

    // (d) wire payload keeps the product UUID (POST body carries product_id)
    await page.setViewportSize({ width: 1350, height: 880 });
    await page.goto(`${baseUrl}/vendas`, { waitUntil: "domcontentloaded" });
    await page
      .locator('[data-slot="select-trigger"]')
      .first()
      .waitFor({ state: "visible", timeout: 20000 });
    await expect.poll(async () => names.includes(await triggerText(page))).toBe(true);
    const selectedName = await triggerText(page);
    const selected = products.find((p) => p.name === selectedName);
    let capturedPayload = null;
    await page.route("**/_serverFn/**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && (request.postData() ?? "").includes("product_id")) {
        capturedPayload = request.postData();
        await route.abort();
        return;
      }
      await route.continue();
    });
    const intercepted = page.waitForRequest(
      (request) => request.method() === "POST" && (request.postData() ?? "").includes("product_id"),
      { timeout: 10000 },
    );
    await page.fill("#venda-quantidade", "1");
    await page.fill("#venda-preco-unitario", "1");
    await page.click("button[type=submit]");
    capturedPayload = (await intercepted).postData();
    // The server-fn POST body is seroval cross-JSON (keys in p.k, values in
    // v[]), so identity is asserted by the presence of the product_id key and
    // of the selected product's UUID in the raw payload.
    const payloadHasId = Boolean(
      capturedPayload &&
      capturedPayload.includes("product_id") &&
      selected &&
      capturedPayload.includes(selected.id),
    );
    record(
      "vendas@desktop payload-uuid",
      payloadHasId,
      `selected=${selectedName.slice(0, 24)} payloadCaptured=${Boolean(capturedPayload)}`,
    );
    await page.unroute("**/_serverFn/**");

    // (e) structural containment: the >=60-char name must not stretch the
    // vendas form grid on mobile (DBT-89 structural requirement)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/vendas`, { waitUntil: "domcontentloaded" });
    await page
      .locator('[data-slot="select-trigger"]')
      .first()
      .waitFor({ state: "visible", timeout: 20000 });
    await pickOptionByName(page, LONG_NAME_MARKER);
    await expect.poll(() => triggerText(page)).toBe(LONG_NAME_MARKER);
    const probe = await page.evaluate(geometryProbe);
    const formProbe = probe.containers.find((c) => c.tag === "FORM");
    record(
      "vendas@390 long-name-containment",
      Boolean(formProbe && formProbe.overflow <= 0),
      formProbe ? `sw=${formProbe.scrollWidth} cw=${formProbe.clientWidth}` : "form not found",
    );
    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      await persistBenchScreenshot(
        page,
        join(evidenceDir, "long-name-mobile-form.png"),
        page.locator("form").first(),
      );
    }
    await context.close();
  });
} finally {
  await browser.close();
}

const failures = checks.filter((c) => !c.ok);
const verdict = failures.length === 0 ? "GREEN" : "RED";
const report = {
  benchUrl: baseUrl,
  verdict,
  checkCount: checks.length,
  failures: failures.length,
  checks,
  longNameMarker: LONG_NAME_MARKER,
};
console.log(JSON.stringify(report, null, 1));
if (evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, "steps.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 1),
  );
}
process.exit(verdict === "GREEN" ? 0 : 1);
