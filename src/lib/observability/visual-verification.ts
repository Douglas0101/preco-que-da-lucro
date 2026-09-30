/**
 * V5 — assertions visuais puras.
 *
 * Cada assertion devolve um veredicto tipado (`AssertionResult`) em vez de
 * lançar: o adaptador Playwright converte em `expect`/métrica, e o teste unitário
 * exercita o veredicto sem browser. O oráculo dos fallbacks é o próprio
 * `src/lib/format.ts` (`brl`), não uma cópia de string — se o formato do app
 * mudar, a assertion acompanha, e a suíte e2e não vira uma segunda fonte de
 * verdade que pode divergir em silêncio.
 *
 * Invariantes cobertos: INV-007 (NaN/Infinity nunca formatados como zero),
 * INV-006 (dado incompleto nunca apresentado como factual), INV-008 (isolamento
 * de tenant), presença de badge de estado e orçamento de CLS (ADR-033 / §19.7).
 */

import { brl, type NumericDisplayState } from "../format";
import { findSecretLeaks } from "./visual-redaction";

export type VisualFailureType =
  | "badge-missing"
  | "badge-unexpected"
  | "nan-rendered"
  | "invalid-as-zero"
  | "incomplete-not-displayed"
  | "cls-above-threshold"
  | "tenant-leak"
  | "redaction-leak";

export interface AssertionOk {
  ok: true;
  assertion: string;
}

export interface AssertionFailed {
  ok: false;
  assertion: string;
  failureType: VisualFailureType;
  detail: string;
}

export type AssertionResult = AssertionOk | AssertionFailed;

export const STATE_BADGES = ["REAL", "SIMULAÇÃO", "DADOS INCOMPLETOS"] as const;
export type StateBadge = (typeof STATE_BADGES)[number];

export const DEFAULT_CLS_MAX = 0.1;

/** Fallbacks derivados do formatador real do app (anti-drift). */
export const FALLBACK_BY_STATE = {
  incomplete: brl(null),
  invalid: brl(Number.NaN),
  infinite: brl(Number.POSITIVE_INFINITY),
} satisfies Record<Exclude<NumericDisplayState, "ok">, string>;

function ok(assertion: string): AssertionOk {
  return { ok: true, assertion };
}

function fail(assertion: string, failureType: VisualFailureType, detail: string): AssertionFailed {
  return { ok: false, assertion, failureType, detail };
}

function normalizeBadge(value: string): string {
  return value.trim().toLocaleUpperCase("pt-BR");
}

export function assertBadgePresent(
  badges: readonly string[],
  expected: StateBadge,
): AssertionResult {
  const wanted = normalizeBadge(expected);
  const assertion = `badge-present:${wanted}`;
  const present = badges.some((badge) => normalizeBadge(badge) === wanted);
  if (present) return ok(assertion);
  return fail(
    assertion,
    "badge-missing",
    `badge "${expected}" ausente; observados: [${badges.join(", ")}]`,
  );
}

export function assertBadgeAbsent(
  badges: readonly string[],
  unexpected: StateBadge,
): AssertionResult {
  const unwanted = normalizeBadge(unexpected);
  const assertion = `badge-absent:${unwanted}`;
  const present = badges.some((badge) => normalizeBadge(badge) === unwanted);
  if (!present) return ok(assertion);
  return fail(assertion, "badge-unexpected", `badge "${unexpected}" presente quando não deveria`);
}

const NON_FINITE_TOKEN = /(?:^|[^A-Za-z0-9_])(NaN|Infinity|∞)(?![A-Za-z0-9_])/g;

/** Literais não finitos renderizados como texto (INV-007, primeira metade). */
export function findNonFiniteTokens(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(NON_FINITE_TOKEN)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function assertNoNaNasZero(text: string): AssertionResult {
  const assertion = "no-nan-as-zero";
  const tokens = findNonFiniteTokens(text);
  if (tokens.length === 0) return ok(assertion);
  return fail(assertion, "nan-rendered", `texto visível contém ${tokens.join(", ")}`);
}

/**
 * INV-007/INV-006: o estado declarado do valor tem de bater com o texto
 * renderizado. `ok` exige dígito e proíbe fallback; os demais exigem exatamente
 * o fallback do `format.ts` — em particular, `invalid`/`infinite` nunca podem
 * aparecer como valor monetário.
 */
export function assertNumericDisplay(
  observed: string,
  state: NumericDisplayState,
): AssertionResult {
  const assertion = `numeric-display:${state}`;
  const text = observed.trim();
  if (state === "ok") {
    const fallbacks = Object.values(FALLBACK_BY_STATE);
    if (text.length === 0) return fail(assertion, "incomplete-not-displayed", "valor ok vazio");
    if (fallbacks.includes(text)) {
      return fail(assertion, "invalid-as-zero", `valor ok renderizado como fallback "${text}"`);
    }
    if (!/\d/.test(text))
      return fail(assertion, "invalid-as-zero", `valor ok sem dígito: "${text}"`);
    return ok(assertion);
  }
  const expected = FALLBACK_BY_STATE[state];
  if (text === expected) return ok(assertion);
  const failureType: VisualFailureType =
    state === "incomplete" ? "incomplete-not-displayed" : "invalid-as-zero";
  return fail(assertion, failureType, `esperado "${expected}", observado "${text}"`);
}

/** INV-006: dado incompleto aparece como "—" ou é rotulado como incompleto. */
export function assertIncompleteDisplayed(text: string): AssertionResult {
  const assertion = "incomplete-displayed";
  if (text.includes("—") || /dados incompletos/i.test(text)) return ok(assertion);
  return fail(
    assertion,
    "incomplete-not-displayed",
    `sem "—" e sem rótulo de incompleto: "${text}"`,
  );
}

/** CLS estritamente abaixo do teto; valor não finito também reprova (fail-closed). */
export function assertCLSBelowThreshold(
  cls: number,
  max: number = DEFAULT_CLS_MAX,
): AssertionResult {
  const assertion = `cls-below:${max}`;
  if (!Number.isFinite(cls) || cls < 0) {
    return fail(assertion, "cls-above-threshold", `CLS inválido: ${String(cls)}`);
  }
  if (cls < max) return ok(assertion);
  return fail(assertion, "cls-above-threshold", `CLS ${cls} não é < ${max}`);
}

/** INV-008: nenhum marcador do outro tenant pode aparecer na tela. */
export function assertTenantIsolation(
  visibleText: string,
  foreignMarkers: readonly string[],
): AssertionResult {
  const assertion = "tenant-isolation";
  if (foreignMarkers.length === 0) {
    return fail(assertion, "tenant-leak", "sem marcador estrangeiro: a assertion não tem valor");
  }
  const leaked = foreignMarkers.filter(
    (marker) => marker.length > 0 && visibleText.includes(marker),
  );
  if (leaked.length === 0) return ok(assertion);
  return fail(assertion, "tenant-leak", `texto visível contém marcador(es): ${leaked.join(", ")}`);
}

/** Redação (V6) como assertion: resíduo de segredo no texto é falha, não aviso. */
export function assertNoSecretLeak(text: string): AssertionResult {
  const assertion = "no-secret-leak";
  const leaks = findSecretLeaks(text);
  if (leaks.length === 0) return ok(assertion);
  return fail(assertion, "redaction-leak", `resíduo: ${leaks.join(", ")}`);
}

export interface AssertionSummary {
  total: number;
  passed: number;
  failed: number;
  failuresByType: Partial<Record<VisualFailureType, number>>;
  failures: AssertionFailed[];
}

export function summarizeResults(results: readonly AssertionResult[]): AssertionSummary {
  const failuresByType: Partial<Record<VisualFailureType, number>> = {};
  const failures: AssertionFailed[] = [];
  for (const result of results) {
    if (result.ok) continue;
    failures.push(result);
    failuresByType[result.failureType] = (failuresByType[result.failureType] ?? 0) + 1;
  }
  return {
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failuresByType,
    failures,
  };
}
