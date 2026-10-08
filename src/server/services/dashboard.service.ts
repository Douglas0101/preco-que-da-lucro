import Decimal from "decimal.js";
import type { FeeRow, IngredientRow, PackagingRow } from "@/lib/finance";
import { toDecimalString } from "@/lib/financial-values";
import type { RequestContext } from "@/lib/request-context";
import { applicationMetrics, withSpan } from "@/instrumentation/telemetry";
import { recordSafely } from "@/instrumentation/safe-record";
import {
  dashboardRepository,
  type DashboardInputs,
  type DashboardRepository,
} from "@/server/repositories/dashboard.repository";
import { calculateProductReadModel } from "@/server/services/product-read-model.service";
import { salesService, type SalesService } from "@/server/services/sales.service";

export type DashboardPeriod = "month" | "quarter" | "year";

/**
 * Consolidated contribution margin over the period's REAL sales mix (DBT-88).
 * `ok` carries the margin on net revenue and in currency; `empty` means zero
 * real sales in the period; `incomplete` means the margin cannot be honestly
 * computed — some sold product has no calculable unit cost, or the revenue
 * base is zero — and never falls back to a partial or fictitious number.
 */
export type ConsolidatedMargin =
  | { state: "ok"; valuePct: string; valueAmount: string }
  | { state: "empty" }
  | {
      state: "incomplete";
      incompleteProductCount: number;
      zeroRevenue: boolean;
      salesMismatch?: true;
    };

export interface DashboardSummary {
  consolidatedMargin: ConsolidatedMargin;
  productCount: number;
  fixedExpenses: string | null;
  bestProduct: { name: string; cmPct: string } | null;
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
  period: DashboardPeriod;
  sales: { revenue: string; count: number };
}

export interface DashboardService {
  getSummary(context: RequestContext, period?: DashboardPeriod): Promise<DashboardSummary>;
}

export function periodStart(period: DashboardPeriod, now: Date = new Date()): Date {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  from.setDate(1);
  if (period === "quarter") {
    from.setMonth(Math.floor(from.getMonth() / 3) * 3);
  }
  if (period === "year") {
    from.setMonth(0);
  }
  return from;
}

const decimalNumber = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).toNumber();

function ingredientRow(row: DashboardInputs["ingredientRows"][number]): IngredientRow {
  return {
    used_qty: decimalNumber(row.usedQty) as number,
    used_unit: row.usedUnit,
    package_price: decimalNumber(row.packagePrice),
    package_qty: decimalNumber(row.packageQty),
    package_unit: row.packageUnit,
    conversion_context:
      row.conversionFactor != null && row.packageUnit != null
        ? {
            fromUnit: row.usedUnit,
            toUnit: row.packageUnit,
            factor: row.conversionFactor,
            contextId: row.id,
          }
        : undefined,
  };
}

function packagingRow(row: DashboardInputs["packagingRows"][number]): PackagingRow {
  return {
    package_price: decimalNumber(row.packagePrice) as number,
    units_per_package: decimalNumber(row.unitsPerPackage) as number,
  };
}

const percentPoints = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).mul(100).toNumber();

type DashboardProduct = DashboardInputs["productRows"][number];

function sumFixedExpenses(rows: DashboardInputs["expenseRows"]): {
  value: Decimal;
  invalid: boolean;
} {
  let value = new Decimal(0);
  let invalid = false;
  for (const expense of rows) {
    if (expense.type !== "fixa") continue;
    try {
      const amount = new Decimal(expense.amount);
      if (!amount.isFinite() || amount.isNegative()) {
        invalid = true;
        continue;
      }
      value = value.plus(amount);
    } catch {
      invalid = true;
    }
  }
  return { value, invalid };
}

type ProductAnalysis =
  | { status: "invalid" }
  | { status: "incomplete" }
  | {
      status: "ok";
      best: { name: string; cmPct: string };
      unitCost: string;
      taxAndFeeRate: Decimal;
      alerts: string[];
    };

function analyzeProduct(input: DashboardInputs, product: DashboardProduct): ProductAnalysis {
  const ingredients = input.ingredientRows
    .filter((row) => row.productId === product.id)
    .map(ingredientRow);
  const packaging = input.packagingRows
    .filter((row) => row.productId === product.id)
    .map(packagingRow);
  const fees: FeeRow[] = input.feeRows
    .filter((row) => row.productId === product.id)
    .map((row) => ({ percentage: percentPoints(row.percentage) }));
  const calculation = calculateProductReadModel({
    persistedStatus: product.status,
    currentPrice: product.currentPrice,
    yieldQty: product.yieldQty,
    taxRate: product.taxRate,
    ingredients,
    packaging,
    fees,
  });
  if (calculation.metrics.status === "invalid") return { status: "invalid" };
  if (calculation.metrics.status === "incomplete") return { status: "incomplete" };

  let cmPct: string;
  let unitCost: string;
  try {
    cmPct = toDecimalString(calculation.metrics.value.contributionMarginPct, 6);
    unitCost = toDecimalString(calculation.metrics.value.unitCost, 6);
  } catch {
    return { status: "invalid" };
  }

  const alerts: string[] = [];
  const price = decimalNumber(product.currentPrice);
  if (price != null && price < calculation.metrics.value.unitCost) {
    alerts.push(`"${product.name}": preço de venda abaixo do custo unitário.`);
  }
  if (
    calculation.metrics.value.contributionMarginPct > 0 &&
    calculation.metrics.value.contributionMarginPct < 15
  ) {
    alerts.push(`"${product.name}": margem de contribuição baixa.`);
  }
  const taxAndFeeRate = input.feeRows
    .filter((row) => row.productId === product.id)
    .reduce((sum, row) => sum.plus(row.percentage ?? "0"), new Decimal(product.taxRate ?? "0"));
  return { status: "ok", best: { name: product.name, cmPct }, unitCost, taxAndFeeRate, alerts };
}

type ProductSaleCosts = { unitCost: Decimal; taxAndFeeRate: Decimal };

/**
 * Calculates one server-side, set-based dashboard read model.  The browser
 * receives presentation-ready decimal strings and never aggregates raw rows.
 * `period` bounds the factual sales KPIs (plan WS-01); it has no effect on
 * the cadastral/current-shape metrics, which have no time dimension.
 */
export class DefaultDashboardService implements DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly sales: SalesService = salesService,
  ) {}

  async getSummary(
    context: RequestContext,
    period: DashboardPeriod = "month",
  ): Promise<DashboardSummary> {
    const input = await this.repository.loadInputs(context);
    const from = periodStart(period);
    const fixedExpenseSummary = sumFixedExpenses(input.expenseRows);
    const startedAt = Date.now();
    const salesSummary = await withSpan(
      "service.dashboard.sales_summary",
      {
        "app.tenant_id": context.tenantId,
        "app.correlation_id": context.correlationId,
        "app.dashboard.period": period,
      },
      async (span) => {
        const summary = await this.sales.summaryForPeriod(context, from);
        span.setAttribute("app.sales.count", summary.count);
        return summary;
      },
    );
    recordSafely(applicationMetrics.salesSummaryDuration, Date.now() - startedAt, { period });

    let bestProduct: { name: string; cmPct: string } | null = null;
    let invalidProductCount = 0;
    let incompleteProductCount = 0;
    const alerts: string[] = [];
    const costsByProduct = new Map<string, ProductSaleCosts>();

    for (const product of input.productRows) {
      const analysis = analyzeProduct(input, product);
      if (analysis.status === "invalid") {
        invalidProductCount += 1;
        continue;
      }
      if (analysis.status === "incomplete") {
        incompleteProductCount += 1;
        continue;
      }
      costsByProduct.set(product.id, {
        unitCost: new Decimal(analysis.unitCost),
        taxAndFeeRate: analysis.taxAndFeeRate,
      });
      if (!bestProduct || new Decimal(analysis.best.cmPct).gt(bestProduct.cmPct)) {
        bestProduct = analysis.best;
      }
      alerts.push(...analysis.alerts);
    }

    if (incompleteProductCount > 0) {
      alerts.unshift(
        `${incompleteProductCount} produto(s) não participa(m) dos destaques por ter dados incompletos.`,
      );
    }
    let fixedExpensesValue: string | null = null;
    if (!fixedExpenseSummary.invalid) {
      try {
        fixedExpensesValue = toDecimalString(fixedExpenseSummary.value, 4);
      } catch {
        fixedExpenseSummary.invalid = true;
      }
    }
    const finalHasInvalidCalculation = invalidProductCount > 0 || fixedExpenseSummary.invalid;
    const consolidatedMargin = await this.consolidatedMarginFor(
      context,
      from,
      salesSummary,
      costsByProduct,
    );
    return {
      consolidatedMargin,
      productCount: input.productRows.length,
      fixedExpenses: fixedExpensesValue,
      bestProduct: finalHasInvalidCalculation ? null : bestProduct,
      hasInvalidCalculation: finalHasInvalidCalculation,
      incompleteProductCount,
      alerts,
      period,
      sales: {
        revenue: salesSummary.revenue,
        count: salesSummary.count,
      },
    };
  }

  /**
   * Three honest states, never a partial margin (DBT-88 closure contract):
   * zero real sales -> `empty`; any sold product without a calculable unit
   * cost, or a zero revenue base -> `incomplete` with the true cause flags;
   * otherwise the mix-weighted margin on net revenue in Decimal.
   */
  private async consolidatedMarginFor(
    context: RequestContext,
    from: Date,
    salesSummary: { revenue: string; count: number },
    costsByProduct: Map<string, ProductSaleCosts>,
  ): Promise<ConsolidatedMargin> {
    if (salesSummary.count === 0) return { state: "empty" };
    const itemSummary = await this.sales.itemSummaryForPeriod(context, from);
    // Sold products without a read-model margin — explicitly invalid/incomplete
    // ones and products absent from the cadastral set (e.g. archived after the
    // sale) are equally without a calculable unit cost.
    const unknownCostCount = itemSummary.filter((row) => !costsByProduct.has(row.productId)).length;
    const revenue = new Decimal(salesSummary.revenue);
    const zeroRevenue = revenue.isZero();
    if (unknownCostCount > 0 || zeroRevenue) {
      return {
        state: "incomplete",
        incompleteProductCount: unknownCostCount,
        zeroRevenue,
      };
    }
    // Net adjustments lack a per-product fiscal allocation. A missing or
    // concurrently changed item aggregate also cannot prove a real margin.
    // Report the reconciliation gap instead of inventing a partial result.
    const itemRevenue = itemSummary.reduce((sum, row) => sum.plus(row.totalAmount), new Decimal(0));
    if (itemSummary.length === 0 || !itemRevenue.eq(revenue)) {
      return {
        state: "incomplete",
        incompleteProductCount: 0,
        zeroRevenue: false,
        salesMismatch: true,
      };
    }
    let marginTotal = new Decimal(0);
    for (const row of itemSummary) {
      const costs = costsByProduct.get(row.productId)!;
      const actualRevenue = new Decimal(row.totalAmount);
      marginTotal = marginTotal.plus(
        actualRevenue
          .minus(new Decimal(row.quantity).mul(costs.unitCost))
          .minus(actualRevenue.mul(costs.taxAndFeeRate)),
      );
    }
    return {
      state: "ok",
      valuePct: toDecimalString(marginTotal.div(revenue).mul(100), 4),
      valueAmount: toDecimalString(marginTotal, 4),
    };
  }
}

export const dashboardService: DashboardService = new DefaultDashboardService(dashboardRepository);

/** Adapter consumed by `src/lib/dashboard.functions.ts` and existing tests. */
export function getDashboardSummary(
  context: RequestContext,
  period: DashboardPeriod = "month",
): Promise<DashboardSummary> {
  return dashboardService.getSummary(context, period);
}
