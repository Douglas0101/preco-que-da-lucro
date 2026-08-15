import Decimal from "decimal.js";
import type { FeeRow, IngredientRow, PackagingRow } from "@/lib/finance";
import { toDecimalString } from "@/lib/financial-values";
import type { RequestContext } from "@/lib/request-context";
import { loadDashboardInputs } from "@/server/repositories/dashboard.repository";
import { calculateProductReadModel } from "@/server/services/product-read-model.service";

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

type DashboardInputs = Awaited<ReturnType<typeof loadDashboardInputs>>;
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
  try {
    cmPct = toDecimalString(calculation.metrics.value.contributionMarginPct, 6);
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
  return { status: "ok", best: { name: product.name, cmPct }, alerts };
}

/**
 * Calculates one server-side, set-based dashboard read model.  The browser
 * receives presentation-ready decimal strings and never aggregates raw rows.
 */
export async function getDashboardSummary(context: RequestContext) {
  const input = await loadDashboardInputs(context);
  const fixedExpenseSummary = sumFixedExpenses(input.expenseRows);

  let bestProduct: { name: string; cmPct: string } | null = null;
  let invalidProductCount = 0;
  let incompleteProductCount = 0;
  const alerts: string[] = [];

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
  return {
    productCount: input.productRows.length,
    fixedExpenses: fixedExpensesValue,
    bestProduct: finalHasInvalidCalculation ? null : bestProduct,
    hasInvalidCalculation: finalHasInvalidCalculation,
    incompleteProductCount,
    alerts,
  };
}
