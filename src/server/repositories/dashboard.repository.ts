import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  expenses,
  marketPrices,
  productIngredients,
  productPackaging,
  products,
  salesFees,
} from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

/**
 * Read model for the dashboard.  All predicates include tenant_id even though
 * PostgreSQL RLS is enabled, keeping repository methods safe when called from
 * admin tooling and making the tenant boundary explicit in every query.
 */
export async function loadDashboardInputs(context: RequestContext) {
  const productRows = await context.transaction
    .select()
    .from(products)
    .where(and(eq(products.tenantId, context.tenantId), isNull(products.archivedAt)))
    .orderBy(desc(products.createdAt));
  const productIds = productRows.map((row) => row.id);

  const [expenseRows, ingredientRows, packagingRows, feeRows, marketRows] = await Promise.all([
    context.transaction
      .select()
      .from(expenses)
      .where(eq(expenses.tenantId, context.tenantId))
      .orderBy(desc(expenses.createdAt)),
    productIds.length
      ? context.transaction
          .select()
          .from(productIngredients)
          .where(
            and(
              eq(productIngredients.tenantId, context.tenantId),
              inArray(productIngredients.productId, productIds),
            ),
          )
      : Promise.resolve([]),
    productIds.length
      ? context.transaction
          .select()
          .from(productPackaging)
          .where(
            and(
              eq(productPackaging.tenantId, context.tenantId),
              inArray(productPackaging.productId, productIds),
            ),
          )
      : Promise.resolve([]),
    productIds.length
      ? context.transaction
          .select()
          .from(salesFees)
          .where(
            and(eq(salesFees.tenantId, context.tenantId), inArray(salesFees.productId, productIds)),
          )
      : Promise.resolve([]),
    productIds.length
      ? context.transaction
          .select()
          .from(marketPrices)
          .where(
            and(
              eq(marketPrices.tenantId, context.tenantId),
              inArray(marketPrices.productId, productIds),
            ),
          )
          .orderBy(desc(marketPrices.createdAt))
      : Promise.resolve([]),
  ]);

  return { productRows, expenseRows, ingredientRows, packagingRows, feeRows, marketRows };
}
