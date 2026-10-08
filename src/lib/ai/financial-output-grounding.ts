import Decimal from "decimal.js";
import { visibleChatMarkdownText } from "@/lib/chat-markdown-parser";
import { logJson } from "@/lib/structured-logger";

interface SourceMessage {
  role: string;
  content: string;
}

interface Figures {
  money: Set<string>;
  percent: Set<string>;
  invalid: number;
}

export const UNGROUNDED_FINANCIAL_REPLY =
  "Não posso apresentar valores calculados sem um resultado do motor financeiro. " +
  "Os dados informados continuam registrados. Consulte Diagnóstico ou Simulações " +
  "para ver os cálculos disponíveis e os dados que ainda faltam.";

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
      try {
        const result: unknown = JSON.parse(message.content);
        if (result && typeof result === "object" && "ok" in result && result.ok === true)
          collectToolFigures(result, allowed);
      } catch {
        // No payload is logged: malformed tool text provides no evidence.
        logJson("warn", "ai.financial_source_invalid", { source: "tool", reason: "invalid_json" });
      }
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
    content: blocked ? UNGROUNDED_FINANCIAL_REPLY : content,
    blocked,
    unsupportedCount: unsupported.length + candidate.invalid + Number(nonFinite),
  };
}
