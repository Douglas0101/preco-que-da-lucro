// DBT-86 gate: unauthenticated dashboard prefetch must never be cached as
// success data and must never crash the dashboard after a later login.
//
// RED   (exit 1): TypeError "reading 'count'" from the inicio chunk after the
//                 login transition — the ciclo-28 defect.
// GREEN (exit 0): both scenarios land on a rendered dashboard (or a controlled
//                 error state) with no TypeError, and a dashboard server
//                 function call succeeds after the final login.
// PRECONDITION (exit 2): bench unreachable or fixture credentials unavailable.
//
// Usage: node scripts/qa/repro-dbt86.mjs [baseUrl] [evidenceDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  assertLoopbackBench,
  loginIfNeeded,
  logoutViaUi,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const evidenceDir = process.argv[3] ?? null;
const CRASH_SIGNATURE = /Cannot read properties of undefined \(reading 'count'\)/;

assertLoopbackBench(baseUrl);
const creds = readBenchFixtureCredentials(baseUrl);
if (!creds.pid || !creds.email || !creds.password) {
  console.error(
    JSON.stringify({ verdict: "PRECONDITION", reason: "bench or fixture credentials unavailable" }),
  );
  process.exit(2);
}

function collectClientErrors(page, sink) {
  const onError = (error) =>
    sink.push({ kind: "pageerror", message: String(error?.message ?? error) });
  const onConsole = (msg) => {
    if (msg.type() === "error") sink.push({ kind: "console", message: msg.text() });
  };
  page.on("pageerror", onError);
  page.on("console", onConsole);
  return () => {
    page.off("pageerror", onError);
    page.off("console", onConsole);
  };
}

async function trackDashboardServerFn(page, sink) {
  const listener = async (response) => {
    if (response.url().includes("/_serverFn/")) {
      // Do not persist any request/response payload — only method/status.
      sink.push({ status: response.status() });
    }
  };
  page.on("response", listener);
  return () => page.off("response", listener);
}

async function runScenario(browser, name, { preLogout }) {
  const context = await browser.newContext({ viewport: { width: 1350, height: 880 } });
  const page = await context.newPage();
  const errors = [];
  const serverFnCalls = [];
  const detachErrors = collectClientErrors(page, errors);
  const detachServerFn = await trackDashboardServerFn(page, serverFnCalls);
  const result = { scenario: name, clientErrors: [], serverFnCalls, screenshots: [] };

  try {
    await page.goto(`${baseUrl}/inicio`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await loginIfNeeded(page, baseUrl, creds);
    await page.waitForURL("**/inicio**", { timeout: 20000 });
    await page.waitForTimeout(2000);

    if (preLogout) {
      // With the defect present the first login also crashes the dashboard;
      // a full reload recovers it (ciclo-28 observation) so the UI logout and
      // the protected-route second pass can proceed.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await logoutViaUi(page);
      // Second pass: protected route without a session (fresh 401 prefetch),
      // then login again — the ciclo-28 transition A/B with one fixture account.
      await page.goto(`${baseUrl}/inicio`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await loginIfNeeded(page, baseUrl, creds);
      await page.waitForURL("**/inicio**", { timeout: 20000 });
      await page.waitForTimeout(2000);
    }

    const crash = errors.filter((e) => CRASH_SIGNATURE.test(e.message));
    // Full innerText: the dashboard heading cards sit past the sidebar text, a
    // truncated excerpt would miss them and misreport a healthy render.
    const bodyText = await page.evaluate(() => document.body.innerText);
    // innerText reflects CSS text-transform: the metric card label renders as
    // "MARGEM CONSOLIDADA" — match case-insensitively.
    const dashboardRendered = /margem consolidada|bem-vindo/i.test(bodyText);
    const controlledError = /Não foi possível carregar/i.test(bodyText);
    const postLoginCalls = serverFnCalls;
    const anyDashboardCallOk = postLoginCalls.some((c) => c.status === 200);

    result.bodyExcerpt = bodyText.replace(/\n+/g, " | ").slice(0, 200);
    result.dashboardRendered = dashboardRendered;
    result.controlledError = controlledError;
    result.crashCount = crash.length;
    result.clientErrors = errors.slice(0, 10);
    result.verdict =
      !crash.length && (dashboardRendered || controlledError) && anyDashboardCallOk
        ? "GREEN"
        : "RED";
    if (evidenceDir && result.verdict === "RED") {
      mkdirSync(evidenceDir, { recursive: true });
      const shot = join(evidenceDir, `screenshot-${name}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      result.screenshots.push(shot);
    }
  } catch (error) {
    result.verdict = "RED";
    result.harnessError = String(error?.message ?? error).slice(0, 300);
  } finally {
    detachErrors();
    detachServerFn();
    await context.close();
  }
  return result;
}

const browser = await chromium.launch();
const results = [];
try {
  results.push(await runScenario(browser, "fresh-unauthenticated-login", { preLogout: false }));
  results.push(await runScenario(browser, "logout-protected-route-relogin", { preLogout: true }));
} finally {
  await browser.close();
}

const verdict = results.every((r) => r.verdict === "GREEN") ? "GREEN" : "RED";
const report = { benchUrl: baseUrl, verdict, scenarios: results };
console.log(JSON.stringify(report, null, 1));
if (evidenceDir) {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, "steps.json"),
    JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 1),
  );
}
process.exit(verdict === "GREEN" ? 0 : 1);
