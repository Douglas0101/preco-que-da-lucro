import Decimal from "decimal.js";
import { computeProduct, type FeeRow, type IngredientRow, type PackagingRow } from "@/lib/finance";
import { toDecimalString } from "@/lib/financial-values";
import type { RequestContext } from "@/lib/request-context";
import { loadDashboardInputs } from "@/server/repositories/dashboard.repository";

const decimalNumber = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).toNumber();

function ingredientRow(
  row: Awaited<ReturnType<typeof loadDashboardInputs>>["ingredientRows"][number],
): IngredientRow {
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

function packagingRow(
  row: Awaited<ReturnType<typeof loadDashboardInputs>>["packagingRows"][number],
): PackagingRow {
  return {
    package_price: decimalNumber(row.packagePrice) as number,
    units_per_package: decimalNumber(row.unitsPerPackage) as number,
  };
}

const percentPoints = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).mul(100).toNumber();

/**
 * Calculates one server-side, set-based dashboard read model.  The browser
 * receives presentation-ready decimal strings and never aggregates raw rows.
 */
export async function getDashboardSummary(context: RequestContext) {
  const input = await loadDashboardInputs(context);
  let fixedExpenses = new Decimal(0);
  let invalidFixedExpenses = false;
  for (const expense of input.expenseRows) {
    if (expense.type !== "fixa") continue;
    try {
      const amount = new Decimal(expense.amount);
      if (!amount.isFinite() || amount.isNegative()) {
        invalidFixedExpenses = true;
        continue;
      }
      fixedExpenses = fixedExpenses.plus(amount);
    } catch {
      invalidFixedExpenses = true;
    }
  }

  let bestProduct: { name: string; cmPct: string } | null = null;
  let invalidProductCount = 0;
  let incompleteProductCount = 0;
  const alerts: string[] = [];

  for (const product of input.productRows) {
    const ingredients = input.ingredientRows
      .filter((row) => row.productId === product.id)
      .map(ingredientRow);
    const packaging = input.packagingRows
      .filter((row) => row.productId === product.id)
      .map(packagingRow);
    const fees: FeeRow[] = input.feeRows
      .filter((row) => row.productId === product.id)
      .map((row) => ({
        percentage: percentPoints(row.percentage),
      }));
    const metrics = computeProduct({
      ingredients,
      packaging,
      yieldQty: decimalNumber(product.yieldQty),
      price: decimalNumber(product.currentPrice),
      taxRate: percentPoints(product.taxRate),
      fees,
    });
    if (metrics.status === "invalid") {
      invalidProductCount += 1;
      continue;
    }
    if (metrics.status === "incomplete") {
      incompleteProductCount += 1;
      continue;
    }
    const cmPct = toDecimalString(metrics.value.contributionMarginPct, 6);
    if (!bestProduct || new Decimal(cmPct).gt(bestProduct.cmPct)) {
      bestProduct = { name: product.name, cmPct };
    }
    const price = decimalNumber(product.currentPrice);
    if (price != null && price < metrics.value.unitCost) {
      alerts.push(`"${product.name}": preço de venda abaixo do custo unitário.`);
    }
    if (metrics.value.contributionMarginPct > 0 && metrics.value.contributionMarginPct < 15) {
      alerts.push(`"${product.name}": margem de contribuição baixa.`);
    }
  }

  if (incompleteProductCount > 0) {
    alerts.unshift(
      `${incompleteProductCount} produto(s) não participa(m) dos destaques por ter dados incompletos.`,
    );
  }
  const hasInvalidCalculation = invalidProductCount > 0 || invalidFixedExpenses;
  return {
    productCount: input.productRows.length,
    fixedExpenses: invalidFixedExpenses ? null : toDecimalString(fixedExpenses, 4),
    bestProduct: hasInvalidCalculation ? null : bestProduct,
    hasInvalidCalculation,
    incompleteProductCount,
    alerts,
  };
}
