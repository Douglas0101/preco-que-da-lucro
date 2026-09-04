import { and, asc, desc, eq } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  marketPrices,
  productIngredients,
  productPackaging,
  products,
  salesFees,
} from "@/db/schema";
import type { FeeRow, IngredientRow, PackagingRow, ProductComputation } from "@/lib/finance";
import type { CalculationResult } from "@/lib/finance";
import type { RequestContext } from "@/lib/request-context";
import { calculateProductReadModel } from "@/server/services/product-read-model.service";

const decimalNumber = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).toNumber();
const percentPoints = (value: string | null): number | null =>
  value == null ? null : new Decimal(value).mul(100).toNumber();

export interface ProductFinancialDetail {
  product: {
    id: string;
    name: string;
    status: "draft" | "incomplete" | "ready" | "active" | "archived";
    currentPrice: string | null;
    yieldQty: string | null;
    taxRate: string | null;
  };
  ingredients: IngredientRow[];
  packaging: PackagingRow[];
  fees: FeeRow[];
  market: { avgPrice: string | null } | null;
  metrics: CalculationResult<ProductComputation>;
}

/**
 * Loads one tenant-scoped product with its children and projects the
 * financial read model, on the current request transaction (RLS applies).
 * This is the server-side detail source for the diagnostic BFF.
 */
export async function loadProductFinancialDetail(
  context: RequestContext,
  productId: string,
): Promise<ProductFinancialDetail | null> {
  const productRows = await context.transaction
    .select()
    .from(products)
    .where(and(eq(products.tenantId, context.tenantId), eq(products.id, productId)))
    .limit(1);
  const product = productRows[0];
  if (!product) return null;

  const ingredientRows = await context.transaction
    .select()
    .from(productIngredients)
    .where(
      and(
        eq(productIngredients.tenantId, context.tenantId),
        eq(productIngredients.productId, productId),
      ),
    )
    .orderBy(asc(productIngredients.createdAt));
  const packagingRows = await context.transaction
    .select()
    .from(productPackaging)
    .where(
      and(
        eq(productPackaging.tenantId, context.tenantId),
        eq(productPackaging.productId, productId),
      ),
    )
    .orderBy(asc(productPackaging.createdAt));
  const feeRows = await context.transaction
    .select()
    .from(salesFees)
    .where(and(eq(salesFees.tenantId, context.tenantId), eq(salesFees.productId, productId)))
    .orderBy(asc(salesFees.createdAt));
  const marketRows = await context.transaction
    .select()
    .from(marketPrices)
    .where(and(eq(marketPrices.tenantId, context.tenantId), eq(marketPrices.productId, productId)))
    .orderBy(desc(marketPrices.createdAt))
    .limit(1);

  const ingredients: IngredientRow[] = ingredientRows.map((row) => ({
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
  }));
  const packaging: PackagingRow[] = packagingRows.map((row) => ({
    package_price: decimalNumber(row.packagePrice) as number,
    units_per_package: decimalNumber(row.unitsPerPackage) as number,
  }));
  const fees: FeeRow[] = feeRows.map((row) => ({ percentage: percentPoints(row.percentage) }));

  const calculation = calculateProductReadModel({
    persistedStatus: product.status,
    currentPrice: product.currentPrice,
    yieldQty: product.yieldQty,
    taxRate: product.taxRate,
    ingredients,
    packaging,
    fees,
  });

  const market = marketRows[0] ? { avgPrice: marketRows[0].avgPrice } : null;

  return {
    product: {
      id: product.id,
      name: product.name,
      status: product.status,
      currentPrice: product.currentPrice,
      yieldQty: product.yieldQty,
      taxRate: product.taxRate,
    },
    ingredients,
    packaging,
    fees,
    market,
    metrics: calculation.metrics,
  };
}
