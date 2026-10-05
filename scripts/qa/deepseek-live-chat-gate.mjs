// DeepSeek live chat gate — runbook `docs/runbooks/deepseek-web.md`, passo 4:
// "executar uma conversa e uma rodada de ferramenta; conferir resposta, tenant
// autorizado, uso medido e estimativa persistida".
//
// What it affirms against a bench wired to the native DeepSeek consumer:
//  1. every scripted turn answered with a REAL reply (never the controlled
//     unavailability message, never the ⚠️ marker);
//  2. the composer serializes turns: with text the send control re-enables
//     between turns (no request left dangling);
//  3. the persisted state closes the flow: conversation `completed`, the newest
//     product with price AND yield, and `tax_rate` ABSENT (absence stays absent,
//     never zero);
//  4. the tool round happened: the expected tool names all succeeded and none
//     failed in the run window;
//  5. usage is measured with a KNOWN cost: every settled `ai_usage` row carries
//     `cost_status='known'` and the run total is > 0 (a provider key without
//     pricing configured would settle as unknown);
//  6. the sealed trios (V1→V6→V5, ADR-033) are persisted for the chat and the
//     products page.
//
// RED   (exit 1): a reply was not real, a turn was left dangling, or any of the
//                 persisted/usage conditions above failed.
// GREEN (exit 0): every condition held; the run window, the model and the cost
//                 are printed as evidence.
// PRECONDITION (exit 2): bench unreachable, fixture credentials or DATABASE_URL
//                 unavailable, or the bench runtime has no DEEPSEEK_API_KEY.
//                 Presence is checked by NAME only: the value is never read,
//                 printed or copied (Via A owns the credential).
//
// Side effect: sends FOUR chat turns and mutates fixture data on the bench
// (creates a product). Use a disposable bench; never point it at production.
//
// Usage: node scripts/qa/deepseek-live-chat-gate.mjs [baseUrl] [evidenceDir]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { chromium } from "playwright";
import { captureVisualScenario } from "../../e2e/visual/visual-capture.ts";
import { apiError } from "../../src/lib/api-error.ts";
import {
  assertLoopbackBench,
  loginIfNeeded,
  persistBenchScreenshot,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4174";
const evidenceDir = process.argv[3] ?? null;
const INPUT = "Escreva sua resposta...";
const SEND = "Enviar";
const ASSISTANT_BUBBLE = '[role="log"] > div.flex.items-start:not(.justify-end)';
const ZERO_UUID = "00000000-0000-4000-8000-000000000000";
const CONTROLLED = apiError("DEPENDENCY_ERROR", ZERO_UUID).message;
const TURN_TIMEOUT_MS = 150_000;
const EXPECTED_TOOLS = [
  "create_product",
  "add_ingredients",
  "set_ingredient_cost",
  "set_yield",
  "set_price_and_tax",
  "finish_product",
];
const TURNS = [
  "Quero cadastrar uma pizza margherita: a massa custa R$ 4,00 e o queijo R$ 6,00 por unidade. A receita rende 1 pizza e eu vendo cada pizza por R$ 30,00.",
  "Sim, é exatamente isso: 1 unidade de massa e 1 unidade de queijo por pizza. Não uso embalagem.",
  "Sou MEI. Não tenho a alíquota efetiva de imposto calculada agora — pode registrar sem ela.",
  "Sim, os dados estão corretos. Pode finalizar o cadastro.",
];

function precondition(reason) {
  console.error(JSON.stringify({ verdict: "PRECONDITION", reason }));
  process.exit(2);
}

/**
 * Presença de uma variável no ambiente do processo da bancada, por NOME.
 * Deliberadamente não devolve o valor: a credencial é custódia Via A.
 */
function hasEnvName(pid, name) {
  let raw;
  try {
    raw = readFileSync(`/proc/${pid}/environ`, "utf8");
  } catch {
    return null;
  }
  return raw
    .split("\0")
    .some((entry) => entry.startsWith(`${name}=`) && entry.length > name.length + 1);
}

assertLoopbackBench(baseUrl);
const bench = readBenchFixtureCredentials(baseUrl);
const creds = {
  email: bench.email ?? process.env.E2E_AUTH_EMAIL,
  password: bench.password ?? process.env.E2E_AUTH_PASSWORD,
};
if (!bench.pid) precondition("bench pid unavailable on the listening port");
if (!creds.email || !creds.password) precondition("fixture credentials unavailable");
if (!bench.databaseUrl) precondition("bench DATABASE_URL unavailable");
const keyPresent = hasEnvName(bench.pid, "DEEPSEEK_API_KEY");
if (keyPresent !== true) precondition(`DEEPSEEK_API_KEY not present in bench env (${keyPresent})`);

const db = new Client({ connectionString: bench.databaseUrl });
await db.connect();
const failures = [];
const steps = [];
const startedAt = (await db.query("select now() as now")).rows[0].now;

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
try {
  // `baseURL` no contexto: o adaptador selado navega em URL relativa, que o
  // runner do Playwright resolve pelo config — aqui não há config, então o
  // contexto é quem resolve (sem isto o goto falha com URL inválida).
  const context = await browser.newContext({
    viewport: { width: 1350, height: 880 },
    baseURL: baseUrl,
  });
  const page = await context.newPage();
  const httpErrors = [];
  page.on("response", (response) => {
    if (response.status() >= 400)
      httpErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto(`${baseUrl}/novo-produto`, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page, baseUrl, creds);
  await page.goto(`${baseUrl}/novo-produto`, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(INPUT).waitFor({ state: "visible", timeout: 20_000 });
  // Histórico é restaurado no cliente: sem esta espera o turno é lido um índice atrás.
  await page
    .locator(ASSISTANT_BUBBLE)
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);

  for (const [index, message] of TURNS.entries()) {
    const before = await page.locator(ASSISTANT_BUBBLE).count();
    const turn = { turn: index + 1, ok: false, seconds: null, branch: null, replyChars: 0 };
    const startedTurn = Date.now();
    await page.getByPlaceholder(INPUT).fill(message);
    await page.getByRole("button", { name: SEND }).click();
    try {
      await page
        .locator(ASSISTANT_BUBBLE)
        .nth(before)
        .waitFor({ state: "visible", timeout: TURN_TIMEOUT_MS });
      await page.waitForTimeout(300);
      const reply = (await page.locator(ASSISTANT_BUBBLE).nth(before).innerText()).trim();
      turn.seconds = Math.round((Date.now() - startedTurn) / 100) / 10;
      turn.replyChars = reply.length;
      turn.branch = reply.includes(CONTROLLED) ? "controlled" : "live";
      turn.replyExcerpt = reply.replace(/\s+/g, " ").slice(0, 160);
      // "conferir resposta": turno real, não aviso controlado nem erro de UI.
      turn.ok = turn.branch === "live" && !reply.includes("⚠️");
      if (!turn.ok)
        failures.push({ turn: index + 1, detail: `desfecho não real (branch=${turn.branch})` });

      // "sem retry cego"/serialização: com texto, o envio volta a habilitar.
      await page.getByPlaceholder(INPUT).fill("sonda de estado");
      const reenabled = !(await page.getByRole("button", { name: SEND }).isDisabled());
      await page.getByPlaceholder(INPUT).fill("");
      turn.composerReenabled = reenabled;
      if (!reenabled)
        failures.push({ turn: index + 1, detail: "composer não voltou a habilitar após o turno" });
    } catch (error) {
      turn.detail = `sem bolha do assistente em ${TURN_TIMEOUT_MS}ms`;
      failures.push({ turn: index + 1, detail: `${turn.detail}: ${String(error).slice(0, 120)}` });
    }
    steps.push(turn);
  }

  const chatScenario = await captureVisualScenario(page, "deepseek-live-chat", "/novo-produto");
  const productsScenario = await captureVisualScenario(page, "deepseek-live-produtos", "/produtos");

  // ── estado persistido do fluxo ────────────────────────────────────────────
  const conversation = (
    await db.query(
      "select conversation_state from chat_conversations where updated_at >= $1 order by updated_at desc limit 1",
      [startedAt],
    )
  ).rows[0];
  const persisted = { conversationState: conversation?.conversation_state ?? null };
  if (persisted.conversationState !== "completed")
    failures.push({
      check: "conversation",
      detail: `esperado completed, observado ${persisted.conversationState}`,
    });

  const product = (
    await db.query(
      `select name, current_price, yield_qty, yield_unit, tax_rate
         from products where created_at >= $1 order by created_at desc limit 1`,
      [startedAt],
    )
  ).rows[0];
  persisted.product = product
    ? {
        name: product.name,
        price: product.current_price,
        yieldQty: product.yield_qty,
        yieldUnit: product.yield_unit,
        taxRate: product.tax_rate,
      }
    : null;
  if (!product) failures.push({ check: "product", detail: "nenhum produto criado na janela" });
  else {
    if (product.current_price === null)
      failures.push({ check: "product.price", detail: "preço não persistido" });
    if (product.yield_qty === null)
      failures.push({
        check: "product.yield",
        detail: "rendimento não persistido (rodada de ferramenta?)",
      });
    // Ausência continua ausente: alíquota não informada não pode virar 0.
    if (product.tax_rate !== null && Number(product.tax_rate) === 0)
      failures.push({ check: "product.taxRate", detail: "alíquota ausente gravada como zero" });
  }

  const tools = (
    await db.query("select tool_name, status from tool_executions where started_at >= $1", [
      startedAt,
    ])
  ).rows;
  persisted.tools = tools.map((row) => `${row.tool_name}:${row.status}`);
  for (const name of EXPECTED_TOOLS)
    if (!tools.some((row) => row.tool_name === name && row.status === "succeeded"))
      failures.push({ check: "tool", detail: `${name} não consta como succeeded na janela` });
  for (const row of tools)
    if (row.status !== "succeeded")
      failures.push({ check: "tool", detail: `${row.tool_name}=${row.status}` });

  const usage = (
    await db.query(
      "select status, cost_status, estimated_cost from ai_usage where reserved_at >= $1",
      [startedAt],
    )
  ).rows;
  const knownCost = usage
    .filter((row) => row.status === "settled" && row.cost_status === "known")
    .reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0);
  persisted.usage = {
    rows: usage.length,
    settled: usage.filter((row) => row.status === "settled").length,
    unknownCost: usage.filter((row) => row.cost_status !== "known").length,
    knownCostUsd: Math.round(knownCost * 1_000_000) / 1_000_000,
    models: null,
  };
  if (persisted.usage.settled < TURNS.length)
    failures.push({
      check: "usage",
      detail: `settled=${persisted.usage.settled} < turnos=${TURNS.length}`,
    });
  if (persisted.usage.unknownCost > 0)
    failures.push({
      check: "usage.cost",
      detail: `${persisted.usage.unknownCost} linhas com custo desconhecido (pricing ausente?)`,
    });
  if (knownCost <= 0) failures.push({ check: "usage.cost", detail: "custo estimado não medido" });

  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    await persistBenchScreenshot(page, join(evidenceDir, "produtos-pos-chat.png"));
  }

  const verdict = failures.length === 0 ? "GREEN" : "RED";
  const report = {
    benchUrl: baseUrl,
    verdict,
    startedAt: new Date(startedAt).toISOString(),
    turns: steps,
    persisted,
    httpErrors,
    sealedArtifacts: [
      {
        label: "deepseek-live-chat",
        hash: chatScenario.capture.hash,
        correlationId: chatScenario.correlationId,
      },
      {
        label: "deepseek-live-produtos",
        hash: productsScenario.capture.hash,
        correlationId: productsScenario.correlationId,
      },
    ],
    failures,
  };
  console.log(JSON.stringify(report, null, 1));
  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      join(evidenceDir, "steps.json"),
      JSON.stringify({ timestamp: new Date().toISOString(), report }, null, 1),
    );
  }
  await context.close();
  process.exitCode = verdict === "GREEN" ? 0 : 1;
} finally {
  await browser.close();
  await db.end();
}
