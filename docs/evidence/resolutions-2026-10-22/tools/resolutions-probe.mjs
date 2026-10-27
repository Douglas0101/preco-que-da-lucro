import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const outDir = "docs/evidence/resolutions-2026-10-22/captures";
mkdirSync(outDir, { recursive: true });

const results = { generatedAt: new Date().toISOString(), checks: {} };

function listen(port, handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const control = await listen(4179, (_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<!doctype html><body><h1>CONTROL-FRAME-CONTENT</h1></body>");
});

const attacker = await listen(4178, (_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><body>
    <h1>attacker</h1>
    <iframe id="target" src="http://127.0.0.1:4173/" width="600" height="200"></iframe>
    <iframe id="control" src="http://127.0.0.1:4179/" width="600" height="200"></iframe>
  </body>`);
});

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://127.0.0.1:4178/");
await page.waitForTimeout(1500);

const frames = page.frames().map((frame) => ({ url: frame.url(), name: frame.name() }));
let targetText = null;
let targetError = null;
const target = page.frames().find((frame) => frame.url().startsWith("http://127.0.0.1:4173"));
if (target) {
  try {
    targetText = await target.evaluate(() => document.body?.innerText ?? "");
  } catch (error) {
    targetError = String(error);
  }
}
let controlText = null;
const controlFrame = page.frames().find((frame) => frame.url().startsWith("http://127.0.0.1:4179"));
if (controlFrame) controlText = await controlFrame.evaluate(() => document.body?.innerText ?? "");

results.checks.clickjacking = {
  frames,
  targetText,
  targetError,
  controlText,
  blocked: !targetText || targetText.trim() === "",
  methodDiscriminates: controlText?.includes("CONTROL-FRAME-CONTENT") ?? false,
};
await page.screenshot({ path: `${outDir}/clickjacking-frame.png`, fullPage: true });

// ── Exclusão de despesa pela UI, como app_runtime ───────────────────────────
const app = await browser.newContext({
  storageState: ".artifacts/e2e-auth.json",
  baseURL: "http://127.0.0.1:4173",
  extraHTTPHeaders: { "x-forwarded-for": "198.51.100.21" },
});
const expensePage = await app.newPage();
await expensePage.goto("/despesas");
await expensePage.getByRole("heading", { name: "Minhas Despesas" }).waitFor();

const probeName = `Probe DBT-160 ${Date.now()}`;
await expensePage.getByLabel("Nome").fill(probeName);
await expensePage.getByLabel("Valor (R$)").fill("12,34");
await expensePage.getByRole("button", { name: "Adicionar despesa" }).click();
await expensePage.getByText(probeName, { exact: true }).waitFor();

const deleteResponses = [];
expensePage.on("response", (response) => {
  if (response.url().includes("/_serverFn/")) {
    deleteResponses.push({ url: response.url(), status: response.status() });
  }
});

await expensePage.getByRole("button", { name: `Excluir ${probeName}` }).click();
await expensePage.getByRole("button", { name: "Excluir despesa", exact: true }).click();
await expensePage.getByText(probeName, { exact: true }).waitFor({ state: "detached" });
await expensePage.reload();
await expensePage.getByRole("heading", { name: "Minhas Despesas" }).waitFor();
const stillVisible = await expensePage.getByText(probeName, { exact: true }).count();

results.checks.expenseDelete = {
  probeName,
  serverFnResponses: deleteResponses,
  visibleAfterReload: stillVisible > 0,
  passed:
    stillVisible === 0 &&
    deleteResponses.some((entry) => entry.status >= 200 && entry.status < 300),
};
await expensePage.screenshot({ path: `${outDir}/expense-delete.png`, fullPage: true });

writeFileSync(`${outDir}/resolutions-probe.json`, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));

await app.close();
await browser.close();
control.close();
attacker.close();
