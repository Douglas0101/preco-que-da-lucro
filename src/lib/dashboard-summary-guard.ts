import type { DashboardPeriod } from "@/lib/dashboard.functions";

/**
 * Shape guard for the dashboard summary payload (DBT-86, fase 1.4).
 *
 * The legacy render guard only tested `productCount === 0`, so a foreign
 * payload (error envelope, partial object) sailed through and crashed on
 * `metrics.sales.count`. A summary is trusted only with the full shape;
 * anything else routes to the screen's error state. Extend this function —
 * never the render branch — when `DashboardSummary` grows fields (DBT-88).
 */
export type ConsolidatedMarginShape =
  | { state: "ok"; valuePct: string; valueAmount: string }
  | { state: "empty" }
  | {
      state: "incomplete";
      incompleteProductCount: number;
      zeroRevenue: boolean;
      salesMismatch?: true;
    };

export interface DashboardWindowShape {
  from: string;
  to: string;
}

export interface DashboardSummaryShape {
  productCount: number;
  fixedExpenses: string | null;
  bestProduct: { name: string; cmPct: string } | null;
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
  period: DashboardPeriod;
  window: DashboardWindowShape;
  sales: { revenue: string; count: number };
  consolidatedMargin: ConsolidatedMarginShape;
}

/**
 * A janela é o contrato que a tela exibe: sem ela o render morre antes do card
 * de erro (achado P2 do review do PR #72, DBT-176). `from < to` porque `to` é o
 * início do período seguinte; janela invertida ou vazia é payload estrangeiro.
 */
function isWindowValid(value: unknown): value is DashboardWindowShape {
  if (typeof value !== "object" || value === null) return false;
  const window = value as Partial<DashboardWindowShape>;
  if (typeof window.from !== "string" || typeof window.to !== "string") return false;
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  return Number.isFinite(from) && Number.isFinite(to) && from < to;
}

function isConsolidatedMarginValid(value: unknown): value is ConsolidatedMarginShape {
  if (typeof value !== "object" || value === null) return false;
  const margin = value as Partial<ConsolidatedMarginShape>;
  if (margin.state === "empty") return true;
  if (margin.state === "ok") {
    return [margin.valuePct, margin.valueAmount].every(
      (item) =>
        typeof item === "string" && /^-?\d+(\.\d+)?$/.test(item) && Number.isFinite(Number(item)),
    );
  }
  if (margin.state === "incomplete") {
    return (
      typeof margin.incompleteProductCount === "number" &&
      Number.isSafeInteger(margin.incompleteProductCount) &&
      margin.incompleteProductCount >= 0 &&
      typeof margin.zeroRevenue === "boolean" &&
      (margin.salesMismatch === undefined || margin.salesMismatch === true)
    );
  }
  return false;
}

export function isDashboardSummaryValid(metrics: unknown): metrics is DashboardSummaryShape {
  if (typeof metrics !== "object" || metrics === null) return false;
  const candidate = metrics as Partial<DashboardSummaryShape>;
  if (typeof candidate.productCount !== "number") return false;
  if (candidate.fixedExpenses !== null && typeof candidate.fixedExpenses !== "string") return false;
  if (typeof candidate.hasInvalidCalculation !== "boolean") return false;
  if (typeof candidate.incompleteProductCount !== "number") return false;
  if (!Array.isArray(candidate.alerts)) return false;
  if (
    candidate.period !== "month" &&
    candidate.period !== "quarter" &&
    candidate.period !== "year"
  ) {
    return false;
  }
  // Só a **forma** é validada aqui. Coerência entre o `period` pedido e o payload
  // é decisão de exibição: com `keepPreviousData` o payload anterior — de outro
  // período — continua montado de propósito, e E3/E5 exigem que a janela antiga
  // permaneça durante a troca; o rótulo sai de `summary.window`, nunca recalculado.
  // Recusar o período divergente aqui desmontava o grid e matava o foco (medido na
  // run 40275083772 do PR #72, captura f6b no pacote de evidência).
  if (!isWindowValid(candidate.window)) return false;
  if (typeof candidate.sales !== "object" || candidate.sales === null) return false;
  if (typeof candidate.sales.count !== "number") return false;
  if (typeof candidate.sales.revenue !== "string") return false;
  if (!isConsolidatedMarginValid(candidate.consolidatedMargin)) return false;
  if (candidate.bestProduct !== null) {
    if (typeof candidate.bestProduct !== "object") return false;
    if (typeof candidate.bestProduct.name !== "string") return false;
    if (typeof candidate.bestProduct.cmPct !== "string") return false;
  }
  return true;
}
