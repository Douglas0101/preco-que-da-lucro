// Sonda de evidência do WP-B1 (TRILHO C).
//
// Mede, num alvo servido localmente, o canal do `@vercel/analytics`:
//  - requisições para `/_vercel/insights/*` e `/_vercel/speed-insights/*` (URL, status, content-type);
//  - todo response >= 400 (não só o da analytics);
//  - todos os console messages/página-erros;
//  - o `<script data-sdkn>` efetivamente injetado no DOM.
//
// Uso (a partir do worktree, com o alvo já no ar):
//   node docs/evidence/trk-c-wp-b1-2026-09-17/probe-analytics.mjs \
//     --base-url=http://127.0.0.1:4391 --path=/ \
//     --out=docs/evidence/trk-c-wp-b1-2026-09-17/measurements --label=red-nodeserver
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, firefox } from "@playwright/test";

const ENGINES = { chromium, firefox };
const ANALYTICS_URL = /\/_vercel\/(?:insights|speed-insights)\//;

function readArgs(argv) {
  const args = {};
  for (const raw of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const args = readArgs(process.argv.slice(2));
const baseUrl = (args["base-url"] ?? "http://127.0.0.1:4391").replace(/\/$/, "");
const pagePath = args.path ?? "/";
const outDir = path.resolve(args.out ?? "docs/evidence/trk-c-wp-b1-2026-09-17/measurements");
const label = args.label ?? "probe";
const engineNames = (args.engines ?? "chromium,firefox").split(",");
const settleMs = Number(args["settle-ms"] ?? 3000);

await mkdir(outDir, { recursive: true });

const report = {
  label,
  baseUrl,
  path: pagePath,
  measuredAt: new Date().toISOString(),
  engines: [],
};

for (const engineName of engineNames) {
  const engine = ENGINES[engineName];
  if (!engine) throw new Error(`Unknown engine: ${engineName}`);

  const browser = await engine.launch();
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on("console", (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() }),
  );
  page.on("pageerror", (error) => consoleMessages.push({ type: "pageerror", text: error.message }));

  const analyticsRequests = [];
  const errorResponses = [];
  page.on("response", async (response) => {
    const url = response.url();
    const isAnalytics = ANALYTICS_URL.test(url);
    if (!isAnalytics && response.status() < 400) return;
    const headers = await response.allHeaders().catch(() => ({}));
    const entry = {
      url,
      status: response.status(),
      contentType: headers["content-type"] ?? null,
    };
    if (isAnalytics) analyticsRequests.push(entry);
    if (response.status() >= 400) errorResponses.push(entry);
  });

  const requestFailures = [];
  page.on("requestfailed", (request) =>
    requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? null }),
  );

  await page.goto(`${baseUrl}${pagePath}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(settleMs);

  const injectedScripts = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[data-sdkn]")).map((element) => ({
      src: element.getAttribute("src"),
      sdkn: element.getAttribute("data-sdkn"),
      sdkv: element.getAttribute("data-sdkv"),
    })),
  );

  const screenshot = path.join(outDir, `${label}-${engineName}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  await browser.close();

  const mimeRefusals = consoleMessages.filter((message) =>
    /MIME type|not executable|Refused to execute/i.test(message.text),
  );
  const consoleErrors = consoleMessages.filter(
    (message) => message.type === "error" || message.type === "pageerror",
  );

  report.engines.push({
    engine: engineName,
    url: `${baseUrl}${pagePath}`,
    analyticsRequests,
    injectedScripts,
    errorResponses,
    requestFailures,
    mimeRefusals,
    consoleErrors,
    consoleMessageCount: consoleMessages.length,
    consoleMessages,
    screenshot: path.relative(process.cwd(), screenshot),
  });

  console.log(
    `[${label}/${engineName}] analyticsRequests=${analyticsRequests.length} ` +
      `injectedScripts=${injectedScripts.length} errorResponses=${errorResponses.length} ` +
      `mimeRefusals=${mimeRefusals.length} consoleErrors=${consoleErrors.length}`,
  );
  for (const entry of analyticsRequests) {
    console.log(`  analytics ${entry.status} ${entry.contentType} ${entry.url}`);
  }
  for (const entry of mimeRefusals) console.log(`  MIME ${entry.text.slice(0, 200)}`);
  for (const entry of consoleErrors) console.log(`  console.error ${entry.text.slice(0, 200)}`);
}

const reportPath = path.join(outDir, `${label}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Report: ${reportPath}`);
