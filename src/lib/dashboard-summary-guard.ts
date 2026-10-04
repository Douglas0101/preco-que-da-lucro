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
export interface DashboardSummaryShape {
  productCount: number;
  fixedExpenses: string | null;
  bestProduct: { name: string; cmPct: string } | null;
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
  period: DashboardPeriod;
  sales: { revenue: string; count: number };
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
  if (typeof candidate.sales !== "object" || candidate.sales === null) return false;
  if (typeof candidate.sales.count !== "number") return false;
  if (typeof candidate.sales.revenue !== "string") return false;
  if (candidate.bestProduct !== null) {
    if (typeof candidate.bestProduct !== "object") return false;
    if (typeof candidate.bestProduct.name !== "string") return false;
    if (typeof candidate.bestProduct.cmPct !== "string") return false;
  }
  return true;
}
