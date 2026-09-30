/**
 * Adaptador Playwright da captura visual (ADR-033, §19.7 do Plano Mestre).
 *
 * Este é o único ponto que fala com um browser. Os módulos
 * `src/lib/observability/visual-*` são puros (sem `@playwright/test`) e por isso
 * rodam no `check`; aqui a captura bruta vira artefato redigido e persistido.
 *
 * Declaração de arquitetura: a captura é de TEMPO DE TESTE. O runtime de
 * produção (Nitro node-server/Vercel) não lança browser — o Playwright é
 * devDependency. A correlação com OTel usa o `x-correlation-id` que
 * `src/start.ts` devolve em toda resposta; o `trace_id` in-process só existe
 * quando há span ativo no mesmo processo (a suíte e2e verifica o contrato sem
 * inventar um trace que o processo de teste não tem).
 */

import type { Page, Response } from "@playwright/test";

import type { DomNodeSnapshot } from "../../src/lib/observability/visual-redaction";
import {
  DEFAULT_VISUAL_EVIDENCE_DIR,
  buildRedactedCapture,
  persistVisualCapture,
  type PersistedVisualCapture,
  type RawVisualCapture,
  type RedactedVisualCapture,
} from "../../src/lib/observability/visual-perception";

/** Mesmo formato que `src/start.ts` aceita/emite no header. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_ATTRIBUTE_CHARS = 200;
const MAX_TEXT_CHARS = 300;
const MAX_CHILDREN = 40;
const MAX_DEPTH = 12;

export interface VisualScenario {
  response: Response | null;
  correlationId: string | null;
  capture: RedactedVisualCapture;
  persisted: PersistedVisualCapture;
}

export interface VisualScenarioOptions {
  /** Diretório do trio selado (padrão: `docs/evidence/visual`). */
  dir?: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

/** Lê o `x-correlation-id` da resposta de navegação, ou `null` se ausente/inválido. */
export function readCorrelationId(response: Response | null): string | null {
  const header = response?.headers()["x-correlation-id"]?.trim();
  return header && UUID_PATTERN.test(header) ? header : null;
}

/**
 * Snapshot de DOM limitado e serializável. O limite existe para o artefato ser
 * evidência revisável: profundidade, filhos, atributos e texto têm teto — um
 * snapshot irrestrito vira um dump enorme que ninguém lê.
 */
export async function captureDomSnapshot(page: Page): Promise<DomNodeSnapshot> {
  return page.evaluate(
    (limits) => {
      const walk = (element: Element, depth: number): DomNodeSnapshot => {
        const attributes: Record<string, string> = {};
        for (const attribute of Array.from(element.attributes)) {
          attributes[attribute.name] = attribute.value.slice(0, limits.maxAttributeChars);
        }
        const node: DomNodeSnapshot = { tag: element.tagName.toLowerCase(), attributes };
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
        if (element.children.length === 0 && text) {
          node.text = text.slice(0, limits.maxTextChars);
        }
        if (depth > 0 && element.children.length > 0) {
          node.children = Array.from(element.children)
            .slice(0, limits.maxChildren)
            .map((child) => walk(child, depth - 1));
        }
        return node;
      };
      return walk(document.body, limits.maxDepth);
    },
    {
      maxAttributeChars: MAX_ATTRIBUTE_CHARS,
      maxTextChars: MAX_TEXT_CHARS,
      maxChildren: MAX_CHILDREN,
      maxDepth: MAX_DEPTH,
    },
  );
}

/** Navega, captura (screenshot + a11y + DOM), redige, persiste e correlaciona. */
export async function captureVisualScenario(
  page: Page,
  label: string,
  url: string,
  options: VisualScenarioOptions = {},
): Promise<VisualScenario> {
  const response = await page.goto(url, { waitUntil: options.waitUntil ?? "networkidle" });
  const correlationId = readCorrelationId(response);
  const raw: RawVisualCapture = {
    label,
    screenshotPng: await page.screenshot(),
    a11ySnapshot: await page.locator("body").ariaSnapshot(),
    domSnapshot: await captureDomSnapshot(page),
    correlationId,
  };
  const capture = buildRedactedCapture(raw);
  const persisted = await persistVisualCapture(capture, {
    dir: options.dir ?? DEFAULT_VISUAL_EVIDENCE_DIR,
  });
  return { response, correlationId, capture, persisted };
}

/** Container da linha (card) que exibe `name` em `/produtos`. */
export function productRow(page: Page, name: string) {
  return page.getByText(name, { exact: true }).locator("xpath=../..");
}

/** Valor rotulado dentro de uma linha: `Custo: R$ 12,00 · Preço: …` → `R$ 12,00`. */
export function labeledValue(rowText: string, label: string): string {
  const start = rowText.indexOf(`${label}:`);
  if (start === -1) return "";
  const rest = rowText.slice(start + label.length + 1);
  const end = rest.indexOf("·");
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}
