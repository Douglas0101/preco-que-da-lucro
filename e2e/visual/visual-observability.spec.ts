/**
 * Suíte visual da Computer User Observability (ADR-033, §19.7).
 *
 * Roda na camada de e2e — não na cadeia `check` — porque depende de browser e
 * de app servido. Cada cenário captura screenshot + snapshot de acessibilidade
 * + DOM, redige (V6), persiste o trio selado em `docs/evidence/visual/` e
 * verifica os invariantes visíveis: INV-007 (NaN/Infinity nunca como valor),
 * INV-006 (dado incompleto não vira número factual), presença de badge de
 * estado e orçamento de CLS.
 *
 * Limite declarado (ADR-033): o processo de teste não tem span OTel ativo, então
 * a correlação aqui é `screenshot.hash ↔ x-correlation-id` da resposta — o
 * pareamento com `trace_id` in-process é verificado no teste unitário do
 * adaptador, e nunca inventado aqui.
 */

import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

import { correlateWithTrace } from "../../src/lib/observability/visual-correlation";
import { findSecretLeaks } from "../../src/lib/observability/visual-redaction";
import {
  assertBadgeAbsent,
  assertBadgePresent,
  assertCLSBelowThreshold,
  assertIncompleteDisplayed,
  assertNoNaNasZero,
  assertNumericDisplay,
  type AssertionResult,
} from "../../src/lib/observability/visual-verification";
import {
  captureVisualScenario,
  labeledValue,
  productRow,
  type VisualScenario,
} from "./visual-capture";

const COMPLETE_PRODUCT = "Produto de teste";
const INCOMPLETE_PRODUCT = "Produto incompleto E2E";
const STATE_BADGE = /^(REAL|DADOS INCOMPLETOS)$/;

function expectOk(assertion: AssertionResult): void {
  if (assertion.ok) return;
  throw new Error(
    `assertion visual falhou: ${assertion.assertion} (${assertion.failureType}) — ${assertion.detail}`,
  );
}

/** CLS observado; `null` quando a engine não expõe LayoutShift (fail-closed fica no assert). */
async function measureCLS(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const supported =
      typeof PerformanceObserver !== "undefined" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("layout-shift");
    if (!supported) return Promise.resolve(null);
    return new Promise<number>((resolve) => {
      let cls = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (!shift.hadRecentInput) cls += shift.value ?? 0;
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
      window.setTimeout(() => {
        observer.disconnect();
        resolve(cls);
      }, 500);
    });
  });
}

async function rowBadges(page: Page, name: string): Promise<string[]> {
  const row = productRow(page, name);
  await expect(row).toBeVisible();
  return row.getByText(STATE_BADGE).allTextContents();
}

test("produtos: estado REAL rotulado e células numéricas em estado ok", async ({ page }) => {
  await captureVisualScenario(page, `produtos-real-${test.info().project.name}`, "/produtos");

  const badges = await rowBadges(page, COMPLETE_PRODUCT);
  expectOk(assertBadgePresent(badges, "REAL"));
  expectOk(assertBadgeAbsent(badges, "DADOS INCOMPLETOS"));

  const rowText = await productRow(page, COMPLETE_PRODUCT).innerText();
  expectOk(assertNumericDisplay(labeledValue(rowText, "Custo"), "ok"));
  expectOk(assertNumericDisplay(labeledValue(rowText, "Preço"), "ok"));
  expectOk(assertNoNaNasZero(rowText));
});

test("produto sem rendimento exibe DADOS INCOMPLETOS e nunca zero factual", async ({ page }) => {
  await captureVisualScenario(page, `produtos-incompleto-${test.info().project.name}`, "/produtos");

  const badges = await rowBadges(page, INCOMPLETE_PRODUCT);
  expectOk(assertBadgePresent(badges, "DADOS INCOMPLETOS"));
  expectOk(assertBadgeAbsent(badges, "REAL"));

  const rowText = await productRow(page, INCOMPLETE_PRODUCT).innerText();
  const custo = labeledValue(rowText, "Custo");
  expectOk(assertNumericDisplay(custo, "incomplete"));
  expectOk(assertIncompleteDisplayed(rowText));
  expect(custo).not.toContain("R$ 0,00");
  expectOk(assertNoNaNasZero(rowText));
});

test("CLS fica abaixo de 0,1 quando a engine expõe layout-shift", async ({ page }) => {
  await captureVisualScenario(page, `inicio-cls-${test.info().project.name}`, "/inicio");

  const cls = await measureCLS(page);
  if (cls === null) {
    test.info().annotations.push({
      type: "cls-unsupported",
      description: `${test.info().project.name} não expõe LayoutShift API; CLS é verificado nos projetos Chromium`,
    });
    return;
  }
  expectOk(assertCLSBelowThreshold(cls));
});

test("artefato persistido está redigido, selado e correlacionado", async ({ page }) => {
  const scenario: VisualScenario = await captureVisualScenario(
    page,
    `inicio-selo-${test.info().project.name}`,
    "/inicio",
  );

  const [a11yText, domText, png] = await Promise.all([
    readFile(scenario.persisted.a11y, "utf8"),
    readFile(scenario.persisted.dom, "utf8"),
    readFile(scenario.persisted.png),
  ]);
  expect(png.equals(scenario.capture.screenshotPng)).toBe(true);
  expect(scenario.persisted.hash).toBe(scenario.capture.hash);
  expect(scenario.persisted.correlationId).toBe(scenario.correlationId);

  // V6 no limite da persistência: nada de resíduo detectável no que foi gravado.
  expect(findSecretLeaks(a11yText)).toEqual([]);
  expect(findSecretLeaks(domText)).toEqual([]);
  const email = process.env.E2E_AUTH_EMAIL ?? "";
  if (email) {
    expect(a11yText).not.toContain(email);
    expect(domText).not.toContain(email);
  }

  const payload = JSON.parse(a11yText) as { correlationId?: string | null; hash?: string };
  expect(payload.correlationId).toBe(scenario.correlationId);
  expect(payload.hash).toBe(scenario.capture.hash);

  const correlation = correlateWithTrace(scenario.capture.hash, scenario.correlationId);
  expect(correlation.screenshotHash).toBe(scenario.capture.hash);
  expect(correlation.correlationId).toBe(scenario.correlationId);
  // Contrato de honestidade: sem span ativo no processo de teste, traceId é nulo.
  expect(correlation.traceId).toBeNull();
});
