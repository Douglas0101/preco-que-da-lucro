// DBT-89 geometry gate: every navigation destination must hold
// scrollWidth <= clientWidth for the document and key containers at both
// supported breakpoints (1350x880 desktop, 390x844 mobile).
//
// RED   (exit 1): at least one page x breakpoint overflows (JSON lists each
//                 offending container; element screenshots are captured).
// GREEN (exit 0): no overflow anywhere in the matrix.
// PRECONDITION (exit 2): bench unreachable or fixture credentials unavailable.
//
// Usage: node scripts/qa/geometry-gate.mjs [baseUrl] [evidenceDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  assertLoopbackBench,
  geometryProbe,
  geometryVerdict,
  loginIfNeeded,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const evidenceDir = process.argv[3] ?? null;
const NAVIGATION_PAGES = [
  "/inicio",
  "/produtos",
  "/novo-produto",
  "/precos",
  "/despesas",
  "/vendas",
  "/ponto-equilibrio",
  "/simulacoes",
  "/diagnostico",
];
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

async function measurePage(page, path, breakpoint, shotPrefix) {
  await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 6000 });
  } catch {
    // data-heavy pages may keep polling; geometry does not depend on quiescence
  }
  await page.waitForTimeout(500);
  const probe = await page.evaluate(geometryProbe);
  const verdict = geometryVerdict(probe);
  const shots = [];
  if (evidenceDir && !verdict.ok) {
    mkdirSync(evidenceDir, { recursive: true });
    for (const [index, offender] of verdict.offenders.slice(0, 3).entries()) {
      const handle = await page.evaluateHandle((cls) => {
        const els = [...document.querySelectorAll("*")];
        return els.find((el) => String(el.className).startsWith(cls)) ?? null;
      }, offender.cls);
      const element = handle.asElement();
      if (element) {
        const shot = join(evidenceDir, `${shotPrefix}-offender-${index}.png`);
        await element.screenshot({ path: shot }).catch(() => {});
        shots.push(shot);
      }
    }
    const full = join(evidenceDir, `${shotPrefix}-full.png`);
    await page.screenshot({ path: full, fullPage: true }).catch(() => {});
    shots.push(full);
  }
  return { page: path, breakpoint: breakpoint.name, ...verdict, shots };
}

const browser = await chromium.launch();
const results = [];
try {
  // One authenticated context for the whole matrix: resizing the viewport
  // exercises the same responsive layout as a fresh context while keeping the
  // sign-in budget at a single attempt per run (auth rate limit: 5/min/IP).
  const context = await browser.newContext({ viewport: { width: 1350, height: 880 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/inicio`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await loginIfNeeded(page, baseUrl, creds);
  // With the defect present the first dashboard render may crash; a full
  // reload recovers it (ciclo-28 observation) and does not affect geometry.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  for (const breakpoint of BREAKPOINTS) {
    for (const path of NAVIGATION_PAGES) {
      const prefix = `${breakpoint.name}${path.replaceAll("/", "-")}`;
      results.push(await measurePage(page, path, breakpoint, prefix));
    }
  }
  await context.close();
} finally {
  await browser.close();
}

const failures = results.filter((r) => !r.ok);
const verdict = failures.length === 0 ? "GREEN" : "RED";
const report = {
  benchUrl: baseUrl,
  verdict,
  pages: results.length,
  failures: failures.length,
  results,
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
