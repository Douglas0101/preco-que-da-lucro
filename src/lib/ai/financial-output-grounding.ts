import Decimal from "decimal.js";
import { visibleChatMarkdownText } from "@/lib/chat-markdown-parser";
import { logJson } from "@/lib/structured-logger";

interface SourceMessage {
  role: string;
  content: string;
  /** Nome da tool por `id`, usado para saber o que foi REALMENTE registrado no turno. */
  tool_calls?: Array<{ id: string; function: { name: string } }>;
  tool_call_id?: string;
}

interface Figures {
  money: Set<string>;
  percent: Set<string>;
  invalid: number;
}

/**
 * Sem registro nenhum no turno, a mensagem não pode afirmar que os dados foram
 * salvos (DBT-127: a versão anterior dizia "continuam registrados" mesmo com
 * `products=0`, e o cliente lia isso como confirmação).
 */
export const UNGROUNDED_FINANCIAL_REPLY =
  "Não posso apresentar valores calculados sem um resultado do motor financeiro. " +
  "Nenhum dado foi registrado neste turno. Me diga o dado bruto (nome do produto, " +
  "rendimento, custo do ingrediente ou preço) ou use o cadastro manual; consulte " +
  "Diagnóstico ou Simulações para ver os cálculos disponíveis e os dados que ainda faltam.";

/** Nome da tool → rótulo do que ela registrou. Sem números, por construção. */
const TOOL_REGISTRATION_LABELS: Record<string, string> = {
  create_product: "o produto",
  add_ingredients: "os ingredientes",
  set_ingredient_cost: "o custo do ingrediente",
  set_yield: "o rendimento",
  add_packaging: "a embalagem",
  set_price_and_tax: "o preço e o imposto",
  add_fee: "a taxa",
  set_market_price: "o preço de mercado",
  add_expense: "a despesa",
  finish_product: "a conclusão do cadastro",
};

/** Parse único do resultado de tool: o catch registra (INV-013) e nunca engole em silêncio. */
function parseToolResult(content: string): { ok: boolean; result?: unknown } {
  try {
    const result: unknown = JSON.parse(content);
    if (result && typeof result === "object" && "ok" in result) {
      return { ok: result.ok === true, result };
    }
    return { ok: false };
  } catch {
    logJson("warn", "ai.financial_source_invalid", { source: "tool", reason: "invalid_json" });
    return { ok: false };
  }
}

/** O que o turno registrou de fato: só tools com resultado `ok:true`. */
function registeredLabels(messages: readonly SourceMessage[]): string[] {
  const nameByCallId = new Map<string, string>();
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) nameByCallId.set(call.id, call.function.name);
  }
  const labels: string[] = [];
  for (const message of messages) {
    if (message.role !== "tool" || !message.tool_call_id) continue;
    if (!parseToolResult(message.content).ok) continue;
    const name = nameByCallId.get(message.tool_call_id);
    const label = name ? TOOL_REGISTRATION_LABELS[name] : undefined;
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

/**
 * Resposta substituta do bloqueio financeiro. Determinística, sem chamada extra
 * ao modelo e **sem figuras**: confirma somente o que as tools registraram de
 * fato e mantém o caminho vivo (próximo dado, cadastro manual, Diagnóstico).
 */
export function ungroundedFinancialReply(messages: readonly SourceMessage[]): string {
  const labels = registeredLabels(messages);
  if (labels.length === 0) return UNGROUNDED_FINANCIAL_REPLY;
  return (
    "Não posso apresentar valores calculados sem um resultado do motor financeiro, " +
    `mas o registro foi feito: ${labels.join(", ")}. ` +
    "Consulte Diagnóstico ou Simulações para ver os cálculos disponíveis e os dados que ainda faltam. " +
    "Podemos seguir com o próximo dado que você tiver em mãos."
  );
}

// Only explicit financial notation is evidence: dates, quantities and product
// names such as "Pizza 05-10" cannot authorize a monetary figure of ten reais.
// Consume literal markers between digits too: an invalid token must not grant
// its numeric prefix or suffix as a separate financial figure.
const MONEY_PATTERNS = [
  /([+-]?\s*)(?:R\$|\bBRL\b)\s*([+-]?\s*(?:\d+(?:(?:[.,]|[*_~`]+)\d+)*|[.,]\d+))/gi,
  /([+-]?\s*(?:\d+(?:(?:[.,]|[*_~`]+)\d+)*|[.,]\d+))\s*(?:reais|real)\b/gi,
  /\b(?:custa|custam|preço|preco|vendo por|pago|gasto)\s*(?:é|de|:)?\s*([+-]?\s*(?:\d+(?:(?:[.,]|[*_~`]+)\d+)*|[.,]\d+))/gi,
];
const PERCENT_PATTERN = /([+-]?\s*(?:\d+(?:(?:[.,]|[*_~`]+)\d+)*|[.,]\d+))\s*(?:%|por\s+cento\b)/gi;
const MONEY_FIELDS = new Set([
  "amount",
  "price",
  "currentPrice",
  "current_price",
  "packagePrice",
  "package_price",
  "minPrice",
  "min_price",
  "avgPrice",
  "avg_price",
  "maxPrice",
  "max_price",
  "cost",
  "unitCost",
  "totalCost",
  "costPerUnit",
]);
const PERCENT_FIELDS = new Set(["taxRate", "tax_rate", "percentage", "margin"]);

function canonicalTextNumber(raw: string): string | null {
  raw = raw.trim().replace(/^([+-])\s+/, "$1");
  const normalized =
    raw.includes(",") || /^[-+]?\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replaceAll(".", "").replace(",", ".")
      : raw;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  return new Decimal(normalized).toString();
}

function financialVisibleText(text: string, role: "user" | "assistant"): string {
  // User bubbles render literal text; only assistant bubbles project Markdown.
  const renderedText = role === "assistant" ? visibleChatMarkdownText(text) : text;
  return renderedText
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replaceAll("−", "-")
    .replace(/([+-])\s+(?=\d)/g, "$1");
}

function textFigures(text: string, role: "user" | "assistant"): Figures {
  const figures: Figures = { money: new Set(), percent: new Set(), invalid: 0 };
  const visibleText = financialVisibleText(text, role);
  for (const pattern of MONEY_PATTERNS) {
    for (const match of visibleText.matchAll(pattern)) {
      const value = canonicalTextNumber(match[2] === undefined ? match[1]! : match[1]! + match[2]);
      if (value === null) figures.invalid++;
      else figures.money.add(value);
    }
  }
  for (const match of visibleText.matchAll(PERCENT_PATTERN)) {
    const value = canonicalTextNumber(match[1]!);
    if (value === null) figures.invalid++;
    else figures.percent.add(value);
  }
  return figures;
}

function collectToolFigures(value: unknown, figures: Figures): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectToolFigures(entry, figures);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [field, entry] of Object.entries(value)) {
    if (
      (typeof entry === "string" || typeof entry === "number") &&
      /^-?\d+(?:\.\d+)?$/.test(String(entry))
    ) {
      const decimal = new Decimal(entry);
      if (MONEY_FIELDS.has(field)) figures.money.add(decimal.toString());
      // The domain's Percent is a canonical fraction (financial-values.ts).
      if (PERCENT_FIELDS.has(field)) figures.percent.add(decimal.mul(100).toString());
    } else if (entry && typeof entry === "object") collectToolFigures(entry, figures);
  }
}

/**
 * Numeric provenance before display/persistence. Model/system text and failed
 * tools are never sources. This checks the numbers, not their semantic labels;
 * it does not authorize mutations or calculate a financial result.
 */
export function groundFinancialOutput(content: string, messages: readonly SourceMessage[]) {
  const allowed: Figures = { money: new Set(), percent: new Set(), invalid: 0 };
  for (const message of messages) {
    if (message.role === "user") {
      const source = textFigures(message.content, "user");
      for (const value of source.money) allowed.money.add(value);
      for (const value of source.percent) allowed.percent.add(value);
    } else if (message.role === "tool") {
      const parsed = parseToolResult(message.content);
      if (parsed.ok && parsed.result) collectToolFigures(parsed.result, allowed);
    }
  }
  const candidate = textFigures(content, "assistant");
  const unsupported = [
    ...[...candidate.money].filter((value) => !allowed.money.has(value)),
    ...[...candidate.percent].filter((value) => !allowed.percent.has(value)),
  ];
  const nonFinite = /\b(?:NaN|Infinity)\b|∞/i.test(financialVisibleText(content, "assistant"));
  const blocked = unsupported.length > 0 || candidate.invalid > 0 || nonFinite;
  return {
    content: blocked ? ungroundedFinancialReply(messages) : content,
    blocked,
    unsupportedCount: unsupported.length + candidate.invalid + Number(nonFinite),
  };
}
