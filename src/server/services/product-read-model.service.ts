import { computeProduct, type FeeRow, type IngredientRow, type PackagingRow } from "@/lib/finance";
import type { ProductStatus } from "@/db/schema";
import {
  completenessFromCalculation,
  productStatusFromCalculation,
} from "@/server/services/product-completeness";

export interface ProductCalculationInput {
  persistedStatus: ProductStatus;
  currentPrice: string | null;
  yieldQty: string | null;
  taxRate: string | null;
  ingredients: IngredientRow[];
  packaging: PackagingRow[];
  fees: FeeRow[];
}

/**
 * Single server-side projection of financial truth into the product read
 * model. Every product reader uses this function, so persisted lifecycle
 * state and derived completeness cannot diverge between list/detail/dashboard.
 */
export function calculateProductReadModel(input: ProductCalculationInput) {
  const metrics = computeProduct({
    ingredients: input.ingredients,
    packaging: input.packaging,
    yieldQty: input.yieldQty == null ? null : Number(input.yieldQty),
    price: input.currentPrice == null ? null : Number(input.currentPrice),
    taxRate: input.taxRate == null ? null : Number(input.taxRate) * 100,
    fees: input.fees,
  });

  return {
    status: productStatusFromCalculation(input.persistedStatus, metrics),
    metrics,
    completeness: completenessFromCalculation(metrics),
  };
}
