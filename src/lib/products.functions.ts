import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import Decimal from "decimal.js";
import { z } from "zod";
import {
  marketPrices,
  productIngredients,
  productPackaging,
  products,
  salesFees,
} from "@/db/schema";
import { computeProduct, type FeeRow, type IngredientRow, type PackagingRow } from "@/lib/finance";
import {
  nonNegativeDecimalStringSchema,
  percentFractionSchema,
  positiveDecimalStringSchema,
  toDecimalString,
} from "@/lib/financial-values";
import { applicationMetrics } from "@/instrumentation/telemetry";
import type { RequestContext } from "@/lib/request-context";
import { requireDatabaseAuth } from "@/middleware/request-context";

const uuid = z.string().uuid();
const decimalNumber = (value: string | null) =>
  value == null ? null : new Decimal(value).toNumber();
const percentPoints = (value: string | null) =>
  value == null ? null : new Decimal(value).mul(100).toNumber();

function mapProduct(row: typeof products.$inferSelect) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    user_id: row.userId,
    name: row.name,
    current_price: row.currentPrice,
    yield_qty: row.yieldQty,
    yield_unit: row.yieldUnit,
    tax_regime: row.taxRegime,
    tax_rate: row.taxRate,
    is_demo: row.isDemo,
    notes: row.notes,
    archived_at: row.archivedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapIngredient(row: typeof productIngredients.$inferSelect) {
  return {
    id: row.id,
    product_id: row.productId,
    tenant_id: row.tenantId,
    user_id: row.userId,
    name: row.name,
    used_qty: row.usedQty,
    used_unit: row.usedUnit,
    package_price: row.packagePrice,
    package_qty: row.packageQty,
    package_unit: row.packageUnit,
    conversion_factor: row.conversionFactor,
    price_updated_at: row.priceUpdatedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapPackaging(row: typeof productPackaging.$inferSelect) {
  return {
    id: row.id,
    product_id: row.productId,
    tenant_id: row.tenantId,
    user_id: row.userId,
    name: row.name,
    package_price: row.packagePrice,
    units_per_package: row.unitsPerPackage,
    price_updated_at: row.priceUpdatedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapFee(row: typeof salesFees.$inferSelect) {
  return {
    id: row.id,
    product_id: row.productId,
    tenant_id: row.tenantId,
    user_id: row.userId,
    name: row.name,
    percentage: row.percentage,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function mapMarket(row: typeof marketPrices.$inferSelect) {
  return {
    id: row.id,
    product_id: row.productId,
    tenant_id: row.tenantId,
    user_id: row.userId,
    min_price: row.minPrice,
    avg_price: row.avgPrice,
    max_price: row.maxPrice,
    created_at: row.createdAt.toISOString(),
  };
}

function toFinanceIngredient(item: ReturnType<typeof mapIngredient>): IngredientRow {
  return {
    used_qty: decimalNumber(item.used_qty) as number,
    used_unit: item.used_unit,
    package_price: decimalNumber(item.package_price),
    package_qty: decimalNumber(item.package_qty),
    package_unit: item.package_unit,
  };
}

function toFinancePackaging(item: ReturnType<typeof mapPackaging>): PackagingRow {
  return {
    package_price: decimalNumber(item.package_price) as number,
    units_per_package: decimalNumber(item.units_per_package) as number,
  };
}

function toFinanceFee(item: ReturnType<typeof mapFee>): FeeRow {
  return { percentage: percentPoints(item.percentage) };
}

async function loadProductDetail(request: RequestContext, productId: string) {
  const scope = and(eq(products.tenantId, request.tenantId), eq(products.id, productId));
  const productRows = await request.transaction.select().from(products).where(scope).limit(1);
  const ingredientRows = await request.transaction
    .select()
    .from(productIngredients)
    .where(
      and(
        eq(productIngredients.tenantId, request.tenantId),
        eq(productIngredients.productId, productId),
      ),
    )
    .orderBy(asc(productIngredients.createdAt));
  const packagingRows = await request.transaction
    .select()
    .from(productPackaging)
    .where(
      and(
        eq(productPackaging.tenantId, request.tenantId),
        eq(productPackaging.productId, productId),
      ),
    )
    .orderBy(asc(productPackaging.createdAt));
  const feeRows = await request.transaction
    .select()
    .from(salesFees)
    .where(and(eq(salesFees.tenantId, request.tenantId), eq(salesFees.productId, productId)))
    .orderBy(asc(salesFees.createdAt));
  const marketRows = await request.transaction
    .select()
    .from(marketPrices)
    .where(and(eq(marketPrices.tenantId, request.tenantId), eq(marketPrices.productId, productId)))
    .orderBy(desc(marketPrices.createdAt))
    .limit(1);

  return {
    product: productRows[0] ? mapProduct(productRows[0]) : null,
    ingredients: ingredientRows.map(mapIngredient),
    packaging: packagingRows.map(mapPackaging),
    fees: feeRows.map(mapFee),
    market: marketRows[0] ? mapMarket(marketRows[0]) : null,
  };
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const rows = await request.transaction
      .select()
      .from(products)
      .where(and(eq(products.tenantId, request.tenantId), isNull(products.archivedAt)))
      .orderBy(desc(products.createdAt));
    return rows.map(mapProduct);
  });

export const listProductsWithMetrics = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const productRows = await request.transaction
      .select()
      .from(products)
      .where(and(eq(products.tenantId, request.tenantId), isNull(products.archivedAt)))
      .orderBy(desc(products.createdAt));
    const productIds = productRows.map((row) => row.id);
    if (!productIds.length) return [];
    const ingredientRows = await request.transaction
      .select()
      .from(productIngredients)
      .where(
        and(
          eq(productIngredients.tenantId, request.tenantId),
          inArray(productIngredients.productId, productIds),
        ),
      );
    const packagingRows = await request.transaction
      .select()
      .from(productPackaging)
      .where(
        and(
          eq(productPackaging.tenantId, request.tenantId),
          inArray(productPackaging.productId, productIds),
        ),
      );
    const feeRows = await request.transaction
      .select()
      .from(salesFees)
      .where(
        and(eq(salesFees.tenantId, request.tenantId), inArray(salesFees.productId, productIds)),
      );
    const marketRows = await request.transaction
      .select()
      .from(marketPrices)
      .where(
        and(
          eq(marketPrices.tenantId, request.tenantId),
          inArray(marketPrices.productId, productIds),
        ),
      )
      .orderBy(desc(marketPrices.createdAt));

    return productRows.map((row) => {
      const product = mapProduct(row);
      const ingredients = ingredientRows
        .filter((item) => item.productId === row.id)
        .map(mapIngredient);
      const packaging = packagingRows.filter((item) => item.productId === row.id).map(mapPackaging);
      const fees = feeRows.filter((item) => item.productId === row.id).map(mapFee);
      const marketRow = marketRows.find((item) => item.productId === row.id);
      const metrics = computeProduct({
        ingredients: ingredients.map(toFinanceIngredient),
        packaging: packaging.map(toFinancePackaging),
        yieldQty: decimalNumber(product.yield_qty),
        price: decimalNumber(product.current_price),
        taxRate: percentPoints(product.tax_rate),
        fees: fees.map(toFinanceFee),
      });
      applicationMetrics.financialStates.add(1, { state: metrics.status });
      return {
        product,
        ingredients,
        packaging,
        fees,
        market: marketRow ? mapMarket(marketRow) : null,
        metrics,
      };
    });
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    return loadProductDetail(context.requestContext, data.id);
  });

const productInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(160),
  current_price: nonNegativeDecimalStringSchema.nullable().optional(),
  yield_qty: positiveDecimalStringSchema.nullable().optional(),
  yield_unit: z.string().trim().max(40).nullable().optional(),
  tax_regime: z.string().trim().max(80).nullable().optional(),
  tax_rate: percentFractionSchema.nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => productInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const values = {
      tenantId: request.tenantId,
      userId: request.userId,
      name: data.name,
      currentPrice: data.current_price == null ? null : toDecimalString(data.current_price, 4),
      yieldQty: data.yield_qty == null ? null : toDecimalString(data.yield_qty, 6),
      yieldUnit: data.yield_unit ?? null,
      taxRegime: data.tax_regime ?? null,
      taxRate: data.tax_rate == null ? null : toDecimalString(data.tax_rate, 6),
      updatedAt: new Date(),
    };
    const rows = data.id
      ? await request.transaction
          .update(products)
          .set(values)
          .where(and(eq(products.tenantId, request.tenantId), eq(products.id, data.id)))
          .returning()
      : await request.transaction.insert(products).values(values).returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return mapProduct(rows[0]);
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const rows = await request.transaction
      .update(products)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(products.tenantId, request.tenantId), eq(products.id, data.id)))
      .returning({ id: products.id });
    if (!rows.length) throw new Error("NOT_FOUND");
    return { ok: true };
  });

// Compatibility alias for existing consumers; deletion becomes recoverable archive.
export const deleteProduct = archiveProduct;

const ingredientInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().trim().min(1).max(160),
  used_qty: positiveDecimalStringSchema,
  used_unit: z.string().trim().min(1).max(40),
  package_price: nonNegativeDecimalStringSchema.nullable().optional(),
  package_qty: positiveDecimalStringSchema.nullable().optional(),
  package_unit: z.string().trim().max(40).nullable().optional(),
  conversion_factor: positiveDecimalStringSchema.nullable().optional(),
});

export const upsertIngredient = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => ingredientInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const values = {
      tenantId: request.tenantId,
      userId: request.userId,
      productId: data.product_id,
      name: data.name,
      usedQty: toDecimalString(data.used_qty, 6),
      usedUnit: data.used_unit,
      packagePrice: data.package_price == null ? null : toDecimalString(data.package_price, 4),
      packageQty: data.package_qty == null ? null : toDecimalString(data.package_qty, 6),
      packageUnit: data.package_unit ?? null,
      conversionFactor:
        data.conversion_factor == null ? null : toDecimalString(data.conversion_factor, 8),
      priceUpdatedAt: data.package_price == null ? null : new Date(),
      updatedAt: new Date(),
    };
    const rows = data.id
      ? await request.transaction
          .update(productIngredients)
          .set(values)
          .where(
            and(
              eq(productIngredients.tenantId, request.tenantId),
              eq(productIngredients.id, data.id),
            ),
          )
          .returning()
      : await request.transaction.insert(productIngredients).values(values).returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return mapIngredient(rows[0]);
  });

function deleteChild(
  table: typeof productIngredients | typeof productPackaging | typeof salesFees,
) {
  return createServerFn({ method: "POST" })
    .middleware([requireDatabaseAuth])
    .validator((input: unknown) => z.object({ id: uuid }).parse(input))
    .handler(async ({ data, context }) => {
      const request = context.requestContext;
      const rows = await request.transaction
        .delete(table)
        .where(and(eq(table.tenantId, request.tenantId), eq(table.id, data.id)))
        .returning({ id: table.id });
      if (!rows.length) throw new Error("NOT_FOUND");
      return { ok: true };
    });
}

export const deleteIngredient = deleteChild(productIngredients);

const packagingInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().trim().min(1).max(160),
  package_price: nonNegativeDecimalStringSchema,
  units_per_package: positiveDecimalStringSchema,
});

export const upsertPackaging = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => packagingInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const values = {
      tenantId: request.tenantId,
      userId: request.userId,
      productId: data.product_id,
      name: data.name,
      packagePrice: toDecimalString(data.package_price, 4),
      unitsPerPackage: toDecimalString(data.units_per_package, 6),
      priceUpdatedAt: new Date(),
      updatedAt: new Date(),
    };
    const rows = data.id
      ? await request.transaction
          .update(productPackaging)
          .set(values)
          .where(
            and(eq(productPackaging.tenantId, request.tenantId), eq(productPackaging.id, data.id)),
          )
          .returning()
      : await request.transaction.insert(productPackaging).values(values).returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return mapPackaging(rows[0]);
  });

export const deletePackaging = deleteChild(productPackaging);

const feeInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().trim().min(1).max(160),
  percentage: percentFractionSchema,
});

export const upsertFee = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => feeInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const values = {
      tenantId: request.tenantId,
      userId: request.userId,
      productId: data.product_id,
      name: data.name,
      percentage: toDecimalString(data.percentage, 6),
      updatedAt: new Date(),
    };
    const rows = data.id
      ? await request.transaction
          .update(salesFees)
          .set(values)
          .where(and(eq(salesFees.tenantId, request.tenantId), eq(salesFees.id, data.id)))
          .returning()
      : await request.transaction.insert(salesFees).values(values).returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return mapFee(rows[0]);
  });

export const deleteFee = deleteChild(salesFees);

const marketInput = z.object({
  product_id: uuid,
  min_price: nonNegativeDecimalStringSchema.nullable().optional(),
  avg_price: nonNegativeDecimalStringSchema.nullable().optional(),
  max_price: nonNegativeDecimalStringSchema.nullable().optional(),
});

export const setMarketPrice = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => marketInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const [row] = await request.transaction
      .insert(marketPrices)
      .values({
        tenantId: request.tenantId,
        userId: request.userId,
        productId: data.product_id,
        minPrice: data.min_price == null ? null : toDecimalString(data.min_price, 4),
        avgPrice: data.avg_price == null ? null : toDecimalString(data.avg_price, 4),
        maxPrice: data.max_price == null ? null : toDecimalString(data.max_price, 4),
      })
      .returning();
    if (!row) throw new Error("DATABASE_ERROR");
    return mapMarket(row);
  });

export const getProductMetrics = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const detail = await loadProductDetail(context.requestContext, data.id);
    if (!detail.product) throw new Error("NOT_FOUND");
    const metrics = computeProduct({
      ingredients: detail.ingredients.map(toFinanceIngredient),
      packaging: detail.packaging.map(toFinancePackaging),
      yieldQty: decimalNumber(detail.product.yield_qty),
      price: decimalNumber(detail.product.current_price),
      taxRate: percentPoints(detail.product.tax_rate),
      fees: detail.fees.map(toFinanceFee),
    });
    applicationMetrics.financialStates.add(1, { state: metrics.status });
    return {
      product: detail.product,
      metrics,
    };
  });

export const listPurchasePrices = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const productRows = await request.transaction
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.tenantId, request.tenantId), isNull(products.archivedAt)))
      .orderBy(desc(products.createdAt));
    const productIds = productRows.map((row) => row.id);
    if (!productIds.length) return { products: [], ingredients: [], packaging: [] };
    const ingredientRows = await request.transaction
      .select()
      .from(productIngredients)
      .where(
        and(
          eq(productIngredients.tenantId, request.tenantId),
          inArray(productIngredients.productId, productIds),
        ),
      )
      .orderBy(asc(productIngredients.name));
    const packagingRows = await request.transaction
      .select()
      .from(productPackaging)
      .where(
        and(
          eq(productPackaging.tenantId, request.tenantId),
          inArray(productPackaging.productId, productIds),
        ),
      )
      .orderBy(asc(productPackaging.name));
    return {
      products: productRows,
      ingredients: ingredientRows.map(mapIngredient),
      packaging: packagingRows.map(mapPackaging),
    };
  });

export const updatePurchasePrice = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: uuid,
        kind: z.enum(["ingrediente", "embalagem"]),
        package_price: nonNegativeDecimalStringSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const table = data.kind === "ingrediente" ? productIngredients : productPackaging;
    const rows = await request.transaction
      .update(table)
      .set({
        packagePrice: toDecimalString(data.package_price, 4),
        priceUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(table.tenantId, request.tenantId), eq(table.id, data.id)))
      .returning({
        id: table.id,
        package_price: table.packagePrice,
        price_updated_at: table.priceUpdatedAt,
      });
    if (!rows[0]) throw new Error("NOT_FOUND");
    return {
      ...rows[0],
      package_price: rows[0].package_price,
      price_updated_at: rows[0].price_updated_at?.toISOString() ?? null,
    };
  });
