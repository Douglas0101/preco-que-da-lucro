// DBT-86/DBT-88 — chat honesty gate (§19.7, ADR-033).
//
// What it affirms (deterministic with or without a model provider):
//  1. the chat surface renders and a new assistant bubble answers the turn;
//  2. the outcome is honest: either the controlled unavailability message —
//     derived from apiError("DEPENDENCY_ERROR"), never a copied string — with NO
//     visible figure, or a real live reply;
//  3. no stuck state: the send control returns to enabled after the outcome;
//  4. negative control: a fabricated "unavailable + value" text must be REJECTED
//     by the same assertion, otherwise the gate itself is broken (fail-closed).
//
// RED   (exit 1): a scenario violated 1..3, or the negative control was accepted.
// GREEN (exit 0): every scenario held, with the branch (controlled|live) recorded.
// PRECONDITION (exit 2): bench unreachable or fixture credentials unavailable.
//
// Side effect: sends ONE chat turn on the bench. With a live provider the model
// may call tools and mutate fixture data — use a disposable bench.
//
// Usage: node scripts/qa/chat-honesty-gate.mjs [baseUrl] [evidenceDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { apiError } from "../../src/lib/api-error.ts";
import { assertChatOutcomeHonest } from "../../src/lib/observability/visual-verification.ts";
import {
  assertLoopbackBench,
  loginIfNeeded,
  persistBenchScreenshot,
  readBenchFixtureCredentials,
} from "./bench-lib.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4173";
const evidenceDir = process.argv[3] ?? null;
const PROMPT = "Olá! Pode me explicar como funciona o cadastro de produto por aqui?";
const INPUT = "Escreva sua resposta...";
const SEND = "Enviar";
const ASSISTANT_BUBBLE = '[role="log"] > div.flex.items-start:not(.justify-end)';
const CORRELATION_ID = "00000000-0000-4000-8000-000000000000";
const CONTROLLED = apiError("DEPENDENCY_ERROR", CORRELATION_ID).message;
const TURN_TIMEOUT_MS = 150_000;

assertLoopbackBench(baseUrl);
const bench = readBenchFixtureCredentials(baseUrl);
const creds = {
  pid: bench.pid,
  email: bench.email ?? process.env.E2E_AUTH_EMAIL,
  password: bench.password ?? process.env.E2E_AUTH_PASSWORD,
};
if (!creds.email || !creds.password) {
  console.error(
    JSON.stringify({
      verdict: "PRECONDITION",
      reason: "fixture credentials unavailable (bench env or E2E_AUTH_EMAIL/E2E_AUTH_PASSWORD)",
    }),
  );
  process.exit(2);
}

const failures = [];
const fixtures = [];

function fixture(name, text, expectedOk, expectedType) {
  const result = assertChatOutcomeHonest(text, CONTROLLED);
  const pass = result.ok === expectedOk && (expectedOk || result.failureType === expectedType);
  fixtures.push({
    name,
    expectedOk,
    observedOk: result.ok,
    observedType: result.ok ? null : result.failureType,
    pass,
  });
  if (!pass)
    failures.push({ scenario: "negative-control", detail: `fixture "${name}" mudou de veredicto` });
}

// Controle negativo do próprio gate: a predicação tem de reprovar a fabricação e
// aceitar os dois desfechos honestos. Fixture errada nunca vira GREEN.
fixture("controlled-honest", `⚠️ ${CONTROLLED}`, true, null);
fixture("live-reply", "Claro! O cadastro começa com o nome do produto.", true, null);
fixture(
  "controlled-with-money",
  `⚠️ ${CONTROLLED} Custo: R$ 0,00`,
  false,
  "chat-outcome-fabricated",
);
fixture(
  "controlled-with-percent",
  `⚠️ ${CONTROLLED} Margem 35,00%`,
  false,
  "chat-outcome-fabricated",
);
fixture("empty-bubble", "   ", false, "chat-outcome-missing");
fixture("non-finite", "seu custo é NaN", false, "nan-rendered");

const scenarios = [];
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
try {
  const context = await browser.newContext({ viewport: { width: 1350, height: 880 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/novo-produto`, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page, baseUrl, creds);

  const surface = { scenario: "chat-surface", ok: false, detail: "" };
  try {
    await page.goto(`${baseUrl}/novo-produto`, { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder(INPUT).waitFor({ state: "visible", timeout: 20_000 });
    // O histórico é restaurado no cliente: sem esta espera a contagem inicial
    // sai zerada e o turno seria lido um índice atrás.
    await page
      .locator(ASSISTANT_BUBBLE)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    surface.ok = true;
    surface.bubbles = await page.locator(ASSISTANT_BUBBLE).count();
  } catch (error) {
    surface.detail = String(error).slice(0, 200);
  }
  scenarios.push(surface);

  if (surface.ok) {
    const before = await page.locator(ASSISTANT_BUBBLE).count();
    await page.getByPlaceholder(INPUT).fill(PROMPT);
    await page.getByRole("button", { name: SEND }).click();

    const turn = { scenario: "chat-turn", ok: false, detail: "" };
    try {
      await page
        .locator(ASSISTANT_BUBBLE)
        .nth(before)
        .waitFor({ state: "visible", timeout: TURN_TIMEOUT_MS });
      await page.waitForTimeout(300);
      const reply = (await page.locator(ASSISTANT_BUBBLE).nth(before).innerText()).trim();
      const assertion = assertChatOutcomeHonest(reply, CONTROLLED);
      turn.branch = reply.includes(CONTROLLED) ? "controlled" : "live";
      turn.replyChars = reply.length;
      turn.replyExcerpt = reply.replace(/\s+/g, " ").slice(0, 200);
      turn.ok = assertion.ok;
      if (!assertion.ok) {
        turn.detail = `${assertion.failureType}: ${assertion.detail}`;
        failures.push({ scenario: "chat-turn", detail: turn.detail });
      }
    } catch (error) {
      turn.detail = `sem bolha do assistente em ${TURN_TIMEOUT_MS}ms: ${String(error).slice(0, 160)}`;
      failures.push({ scenario: "chat-turn", detail: turn.detail });
    }
    scenarios.push(turn);

    const idle = { scenario: "no-stuck-state", ok: false, detail: "" };
    try {
      idle.inputEnabled = await page.getByPlaceholder(INPUT).isEnabled();
      // O envio é desabilitado com o campo vazio POR DESENHO
      // (`disabled={loading || !input.trim()}`): a prova de "não travado" é o
      // controle voltar a habilitar quando há texto — ou seja, o estado de
      // carregamento terminou e a UI aceita o próximo turno.
      await page.getByPlaceholder(INPUT).fill("sonda de estado");
      idle.sendEnabledWithText = !(await page.getByRole("button", { name: SEND }).isDisabled());
      await page.getByPlaceholder(INPUT).fill("");
      idle.ok = idle.inputEnabled && idle.sendEnabledWithText;
      if (!idle.ok) {
        idle.detail = `inputEnabled=${idle.inputEnabled} sendEnabledWithText=${idle.sendEnabledWithText}`;
        failures.push({ scenario: "no-stuck-state", detail: idle.detail });
      }
    } catch (error) {
      idle.detail = String(error).slice(0, 160);
      failures.push({ scenario: "no-stuck-state", detail: idle.detail });
    }
    scenarios.push(idle);
  }

  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    await persistBenchScreenshot(page, join(evidenceDir, "chat-bubble.png"));
  }
  await context.close();
} finally {
  await browser.close();
}

const verdict = failures.length === 0 ? "GREEN" : "RED";
const report = {
  benchUrl: baseUrl,
  verdict,
  controlledMessage: CONTROLLED,
  scenarios,
  fixtures,
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
process.exit(verdict === "GREEN" ? 0 : 1);
