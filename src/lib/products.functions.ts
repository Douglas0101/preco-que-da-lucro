import { and, asc, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import Decimal from "decimal.js";
import { z } from "zod";
import { ApplicationError } from "@/lib/api-error";
import {
  marketPrices,
  productIngredients,
  productPackaging,
  products,
  salesFees,
} from "@/db/schema";
import type { FeeRow, IngredientRow, PackagingRow } from "@/lib/finance";
import {
  nonNegativeDecimalStringSchema,
  percentFractionSchema,
  positiveDecimalStringSchema,
  quantityUnitSchema,
  toDecimalString,
} from "@/lib/financial-values";
import { applicationMetrics } from "@/instrumentation/telemetry";
import { LIST_LIMITS } from "@/lib/list-limits";
import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { productService } from "@/server/services/product.service";
import { calculateProductReadModel } from "@/server/services/product-read-model.service";
import { purchasePriceService } from "@/server/services/purchase-price.service";

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
    status: row.status,
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

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}

function toFinanceIngredient(item: ReturnType<typeof mapIngredient>): IngredientRow {
  return {
    used_qty: decimalNumber(item.used_qty) as number,
    used_unit: item.used_unit,
    package_price: decimalNumber(item.package_price),
    package_qty: decimalNumber(item.package_qty),
    package_unit: item.package_unit,
    conversion_context:
      item.conversion_factor != null && item.package_unit != null
        ? {
            fromUnit: item.used_unit,
            toUnit: item.package_unit,
            factor: item.conversion_factor,
            contextId: item.id,
          }
        : undefined,
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

function projectProductCalculation(
  product: ReturnType<typeof mapProduct>,
  ingredients: ReturnType<typeof mapIngredient>[],
  packaging: ReturnType<typeof mapPackaging>[],
  fees: ReturnType<typeof mapFee>[],
) {
  const calculation = calculateProductReadModel({
    persistedStatus: product.status,
    currentPrice: product.current_price,
    yieldQty: product.yield_qty,
    taxRate: product.tax_rate,
    ingredients: ingredients.map(toFinanceIngredient),
    packaging: packaging.map(toFinancePackaging),
    fees: fees.map(toFinanceFee),
  });
  applicationMetrics.financialStates.add(1, { state: calculation.metrics.status });
  return calculation;
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

  if (!productRows[0]) throw new Error("NOT_FOUND");

  const product = mapProduct(productRows[0]);
  const ingredients = ingredientRows.map(mapIngredient);
  const packaging = packagingRows.map(mapPackaging);
  const fees = feeRows.map(mapFee);
  const market = marketRows[0] ? mapMarket(marketRows[0]) : null;
  const calculation = projectProductCalculation(product, ingredients, packaging, fees);
  return {
    product: { ...product, status: calculation.status },
    ingredients,
    packaging,
    fees,
    market,
    metrics: calculation.metrics,
    completeness: calculation.completeness,
  };
}

type IngredientSelect = typeof productIngredients.$inferSelect;
type PackagingSelect = typeof productPackaging.$inferSelect;
type FeeSelect = typeof salesFees.$inferSelect;
type MarketSelect = typeof marketPrices.$inferSelect;
type ChildUnionKind = "ingredient" | "packaging" | "fee" | "market";

/** Shape of one row of the consolidated children UNION: every branch carries
 * the full aligned column list (siblings contribute NULLs) plus branch tags. */
interface ChildUnionRow extends IngredientSelect {
  branch: number;
  ord: number;
  kind: ChildUnionKind;
  unitsPerPackage: string | null;
  percentage: string | null;
  minPrice: string | null;
  avgPrice: string | null;
  maxPrice: string | null;
}

function rowsFromQueryResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

/**
 * O UNION consolidado executa via `execute()` (sem decoders do Drizzle), então
 * os valores chegam crús do driver: com neon-serverless, timestamptz volta como
 * string; com node-postgres, como Date. Normaliza os timestamps para Date antes
 * dos mappers (que chamam .toISOString()) — paridade entre drivers.
 */
const CHILD_TIMESTAMP_FIELDS = ["createdAt", "updatedAt", "priceUpdatedAt"] as const;

function normalizeChildRow<T>(row: T): T {
  const normalized = { ...(row as Record<string, unknown>) };
  for (const key of CHILD_TIMESTAMP_FIELDS) {
    const value = normalized[key];
    if (typeof value === "string") {
      const parsed = new Date(value);
      normalized[key] = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return normalized as T;
}

function ingredientChildBranch(
  request: RequestContext,
  productIds: string[],
  ord: SQL,
  orderColumns: SQL[] = [],
) {
  return request.transaction
    .select({
      branch: sql`1`.as("branch"),
      ord: ord.as("ord"),
      kind: sql`'ingredient'`.as("kind"),
      id: sql`${productIngredients.id}`.as("id"),
      productId: sql`${productIngredients.productId}`.as("productId"),
      tenantId: sql`${productIngredients.tenantId}`.as("tenantId"),
      userId: sql`${productIngredients.userId}`.as("userId"),
      name: sql`${productIngredients.name}`.as("name"),
      usedQty: sql`${productIngredients.usedQty}`.as("usedQty"),
      usedUnit: sql`${productIngredients.usedUnit}`.as("usedUnit"),
      packagePrice: sql`${productIngredients.packagePrice}`.as("packagePrice"),
      packageQty: sql`${productIngredients.packageQty}`.as("packageQty"),
      packageUnit: sql`${productIngredients.packageUnit}`.as("packageUnit"),
      conversionFactor: sql`${productIngredients.conversionFactor}`.as("conversionFactor"),
      priceUpdatedAt: sql`${productIngredients.priceUpdatedAt}`.as("priceUpdatedAt"),
      unitsPerPackage: sql`null::numeric`.as("unitsPerPackage"),
      percentage: sql`null::numeric`.as("percentage"),
      minPrice: sql`null::numeric`.as("minPrice"),
      avgPrice: sql`null::numeric`.as("avgPrice"),
      maxPrice: sql`null::numeric`.as("maxPrice"),
      createdAt: sql`${productIngredients.createdAt}`.as("createdAt"),
      updatedAt: sql`${productIngredients.updatedAt}`.as("updatedAt"),
    })
    .from(productIngredients)
    .where(
      and(
        eq(productIngredients.tenantId, request.tenantId),
        inArray(productIngredients.productId, productIds),
      ),
    )
    .orderBy(...orderColumns)
    .limit(LIST_LIMITS.productChildren);
}

function packagingChildBranch(
  request: RequestContext,
  productIds: string[],
  ord: SQL,
  orderColumns: SQL[] = [],
) {
  return request.transaction
    .select({
      branch: sql`2`.as("branch"),
      ord: ord.as("ord"),
      kind: sql`'packaging'`.as("kind"),
      id: sql`${productPackaging.id}`.as("id"),
      productId: sql`${productPackaging.productId}`.as("productId"),
      tenantId: sql`${productPackaging.tenantId}`.as("tenantId"),
      userId: sql`${productPackaging.userId}`.as("userId"),
      name: sql`${productPackaging.name}`.as("name"),
      usedQty: sql`null::numeric`.as("usedQty"),
      usedUnit: sql`null::text`.as("usedUnit"),
      packagePrice: sql`${productPackaging.packagePrice}`.as("packagePrice"),
      packageQty: sql`null::numeric`.as("packageQty"),
      packageUnit: sql`null::text`.as("packageUnit"),
      conversionFactor: sql`null::numeric`.as("conversionFactor"),
      priceUpdatedAt: sql`${productPackaging.priceUpdatedAt}`.as("priceUpdatedAt"),
      unitsPerPackage: sql`${productPackaging.unitsPerPackage}`.as("unitsPerPackage"),
      percentage: sql`null::numeric`.as("percentage"),
      minPrice: sql`null::numeric`.as("minPrice"),
      avgPrice: sql`null::numeric`.as("avgPrice"),
      maxPrice: sql`null::numeric`.as("maxPrice"),
      createdAt: sql`${productPackaging.createdAt}`.as("createdAt"),
      updatedAt: sql`${productPackaging.updatedAt}`.as("updatedAt"),
    })
    .from(productPackaging)
    .where(
      and(
        eq(productPackaging.tenantId, request.tenantId),
        inArray(productPackaging.productId, productIds),
      ),
    )
    .orderBy(...orderColumns)
    .limit(LIST_LIMITS.productChildren);
}

function feeChildBranch(request: RequestContext, productIds: string[]) {
  return request.transaction
    .select({
      branch: sql`3`.as("branch"),
      ord: sql`row_number() over ()`.as("ord"),
      kind: sql`'fee'`.as("kind"),
      id: sql`${salesFees.id}`.as("id"),
      productId: sql`${salesFees.productId}`.as("productId"),
      tenantId: sql`${salesFees.tenantId}`.as("tenantId"),
      userId: sql`${salesFees.userId}`.as("userId"),
      name: sql`${salesFees.name}`.as("name"),
      usedQty: sql`null::numeric`.as("usedQty"),
      usedUnit: sql`null::text`.as("usedUnit"),
      packagePrice: sql`null::numeric`.as("packagePrice"),
      packageQty: sql`null::numeric`.as("packageQty"),
      packageUnit: sql`null::text`.as("packageUnit"),
      conversionFactor: sql`null::numeric`.as("conversionFactor"),
      priceUpdatedAt: sql`null::timestamptz`.as("priceUpdatedAt"),
      unitsPerPackage: sql`null::numeric`.as("unitsPerPackage"),
      percentage: sql`${salesFees.percentage}`.as("percentage"),
      minPrice: sql`null::numeric`.as("minPrice"),
      avgPrice: sql`null::numeric`.as("avgPrice"),
      maxPrice: sql`null::numeric`.as("maxPrice"),
      createdAt: sql`${salesFees.createdAt}`.as("createdAt"),
      updatedAt: sql`${salesFees.updatedAt}`.as("updatedAt"),
    })
    .from(salesFees)
    .where(and(eq(salesFees.tenantId, request.tenantId), inArray(salesFees.productId, productIds)))
    .limit(LIST_LIMITS.productChildren);
}

function marketChildBranch(request: RequestContext, productIds: string[]) {
  return request.transaction
    .select({
      branch: sql`4`.as("branch"),
      ord: sql`row_number() over (order by ${marketPrices.createdAt} desc)`.as("ord"),
      kind: sql`'market'`.as("kind"),
      id: sql`${marketPrices.id}`.as("id"),
      productId: sql`${marketPrices.productId}`.as("productId"),
      tenantId: sql`${marketPrices.tenantId}`.as("tenantId"),
      userId: sql`${marketPrices.userId}`.as("userId"),
      name: sql`null::text`.as("name"),
      usedQty: sql`null::numeric`.as("usedQty"),
      usedUnit: sql`null::text`.as("usedUnit"),
      packagePrice: sql`null::numeric`.as("packagePrice"),
      packageQty: sql`null::numeric`.as("packageQty"),
      packageUnit: sql`null::text`.as("packageUnit"),
      conversionFactor: sql`null::numeric`.as("conversionFactor"),
      priceUpdatedAt: sql`null::timestamptz`.as("priceUpdatedAt"),
      unitsPerPackage: sql`null::numeric`.as("unitsPerPackage"),
      percentage: sql`null::numeric`.as("percentage"),
      minPrice: sql`${marketPrices.minPrice}`.as("minPrice"),
      avgPrice: sql`${marketPrices.avgPrice}`.as("avgPrice"),
      maxPrice: sql`${marketPrices.maxPrice}`.as("maxPrice"),
      createdAt: sql`${marketPrices.createdAt}`.as("createdAt"),
      updatedAt: sql`null::timestamptz`.as("updatedAt"),
    })
    .from(marketPrices)
    .where(
      and(eq(marketPrices.tenantId, request.tenantId), inArray(marketPrices.productId, productIds)),
    )
    .orderBy(desc(marketPrices.createdAt))
    .limit(LIST_LIMITS.productChildren);
}

async function loadChildRows(request: RequestContext, union: SQL) {
  const result = await request.transaction.execute(union);
  const rows = rowsFromQueryResult(result) as unknown as ChildUnionRow[];
  const ingredients: IngredientSelect[] = [];
  const packaging: PackagingSelect[] = [];
  const fees: FeeSelect[] = [];
  const market: MarketSelect[] = [];
  for (const rawRow of rows) {
    const row = normalizeChildRow(rawRow);
    if (row.kind === "ingredient") ingredients.push(row);
    else if (row.kind === "packaging") packaging.push(row as unknown as PackagingSelect);
    else if (row.kind === "fee") fees.push(row as unknown as FeeSelect);
    else if (row.kind === "market") market.push(row as unknown as MarketSelect);
  }
  return { ingredients, packaging, fees, market };
}

async function loadProductReadModels(request: RequestContext) {
  const productRows = await request.transaction
    .select()
    .from(products)
    .where(and(eq(products.tenantId, request.tenantId), isNull(products.archivedAt)))
    .orderBy(desc(products.createdAt))
    .limit(LIST_LIMITS.products);
  const productIds = productRows.map((row) => row.id);
  if (!productIds.length) return [];
  const scanOrder = sql`row_number() over ()`;
  const { ingredients, packaging, fees, market } = await loadChildRows(
    request,
    sql`${ingredientChildBranch(request, productIds, scanOrder)}
      union all ${packagingChildBranch(request, productIds, scanOrder)}
      union all ${feeChildBranch(request, productIds)}
      union all ${marketChildBranch(request, productIds)}
      order by branch, ord`,
  );
  const ingredientsByProduct = new Map<string, ReturnType<typeof mapIngredient>[]>();
  for (const item of ingredients) {
    const rows = ingredientsByProduct.get(item.productId) ?? [];
    rows.push(mapIngredient(item));
    ingredientsByProduct.set(item.productId, rows);
  }
  const packagingByProduct = new Map<string, ReturnType<typeof mapPackaging>[]>();
  for (const item of packaging) {
    const rows = packagingByProduct.get(item.productId) ?? [];
    rows.push(mapPackaging(item));
    packagingByProduct.set(item.productId, rows);
  }
  const feesByProduct = new Map<string, ReturnType<typeof mapFee>[]>();
  for (const item of fees) {
    const rows = feesByProduct.get(item.productId) ?? [];
    rows.push(mapFee(item));
    feesByProduct.set(item.productId, rows);
  }
  const marketByProduct = new Map<string, ReturnType<typeof mapMarket>>();
  for (const item of market) {
    if (!marketByProduct.has(item.productId)) marketByProduct.set(item.productId, mapMarket(item));
  }

  return productRows.map((row) => {
    const product = mapProduct(row);
    const ingredients = ingredientsByProduct.get(row.id) ?? [];
    const packaging = packagingByProduct.get(row.id) ?? [];
    const fees = feesByProduct.get(row.id) ?? [];
    const calculation = projectProductCalculation(product, ingredients, packaging, fees);
    return {
      product: { ...product, status: calculation.status },
      ingredients,
      packaging,
      fees,
      market: marketByProduct.get(row.id) ?? null,
      metrics: calculation.metrics,
      completeness: calculation.completeness,
    };
  });
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const rows = await loadProductReadModels(request);
    return rows.map(({ product }) => product);
  });

export const listProductsWithMetrics = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    return loadProductReadModels(context.requestContext);
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const detail = await loadProductDetail(context.requestContext, data.id);
    return {
      product: detail.product,
      ingredients: detail.ingredients,
      packaging: detail.packaging,
      fees: detail.fees,
      market: detail.market,
    };
  });

const productInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(160),
  current_price: nonNegativeDecimalStringSchema.nullable().optional(),
  yield_qty: positiveDecimalStringSchema.nullable().optional(),
  yield_unit: quantityUnitSchema.nullable().optional(),
  tax_regime: z.string().trim().max(80).nullable().optional(),
  tax_rate: percentFractionSchema.nullable().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => productInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const product = await productService.save(request, {
      id: data.id,
      name: data.name,
      currentPrice: data.current_price == null ? null : toDecimalString(data.current_price, 4),
      yieldQty: data.yield_qty == null ? null : toDecimalString(data.yield_qty, 6),
      yieldUnit: data.yield_unit ?? null,
      taxRegime: data.tax_regime ?? null,
      taxRate: data.tax_rate == null ? null : toDecimalString(data.tax_rate, 6),
    });
    return mapProduct(product);
  });

export const archiveProduct = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    await productService.archive(request, data.id);
    return { ok: true };
  });

// Compatibility alias for existing consumers; deletion becomes recoverable archive.
export const deleteProduct = archiveProduct;

const ingredientInput = z
  .object({
    id: uuid.optional(),
    product_id: uuid,
    name: z.string().trim().min(1).max(160),
    used_qty: positiveDecimalStringSchema,
    used_unit: quantityUnitSchema,
    package_price: nonNegativeDecimalStringSchema.nullable().optional(),
    package_qty: positiveDecimalStringSchema.nullable().optional(),
    package_unit: quantityUnitSchema.nullable().optional(),
    conversion_factor: positiveDecimalStringSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasQuantity = value.package_qty != null;
    const hasUnit = value.package_unit != null;
    if (hasQuantity !== hasUnit) {
      ctx.addIssue({
        code: "custom",
        path: [hasQuantity ? "package_unit" : "package_qty"],
        message: "Informe quantidade e unidade da embalagem juntas.",
      });
    }
    if (value.package_price != null && (!hasQuantity || !hasUnit)) {
      ctx.addIssue({
        code: "custom",
        path: ["package_price"],
        message: "O histórico exige quantidade e unidade para registrar o preço.",
      });
    }
  });

export const upsertIngredient = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => ingredientInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    assertTenantMutationAuthorized(request);
    const priceUpdatedAt = data.package_price == null ? null : new Date();
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
      priceUpdatedAt,
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
    if (data.package_price != null && data.package_qty != null && data.package_unit != null) {
      await purchasePriceService.append(request, {
        kind: "ingredient",
        subjectId: rows[0].id,
        price: data.package_price,
        quantity: data.package_qty,
        unit: data.package_unit,
        validFrom: priceUpdatedAt ?? new Date(),
      });
    }
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
      assertTenantMutationAuthorized(request);
      let rows: Array<{ id: string }>;
      try {
        rows = await request.transaction
          .delete(table)
          .where(and(eq(table.tenantId, request.tenantId), eq(table.id, data.id)))
          .returning({ id: table.id });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ApplicationError("CONFLICT", {
            cause: error,
            message: "O registro possui histórico de preços e não pode ser removido.",
          });
        }
        throw error;
      }
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
    assertTenantMutationAuthorized(request);
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
    await purchasePriceService.append(request, {
      kind: "packaging",
      subjectId: rows[0].id,
      price: data.package_price,
      quantity: data.units_per_package,
      unit: "unidade",
      validFrom: values.priceUpdatedAt,
    });
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
    assertTenantMutationAuthorized(request);
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
    assertTenantMutationAuthorized(request);
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
    return {
      product: detail.product,
      metrics: detail.metrics,
      completeness: detail.completeness,
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
      .orderBy(desc(products.createdAt))
      .limit(LIST_LIMITS.products);
    const productIds = productRows.map((row) => row.id);
    if (!productIds.length) return { products: [], ingredients: [], packaging: [] };
    const { ingredients, packaging } = await loadChildRows(
      request,
      sql`${ingredientChildBranch(
        request,
        productIds,
        sql`row_number() over (order by ${productIngredients.name})`,
        [asc(productIngredients.name)],
      )}
        union all ${packagingChildBranch(
          request,
          productIds,
          sql`row_number() over (order by ${productPackaging.name})`,
          [asc(productPackaging.name)],
        )}
        order by branch, ord`,
    );
    return {
      products: productRows,
      ingredients: ingredients.map(mapIngredient),
      packaging: packaging.map(mapPackaging),
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
        package_qty: positiveDecimalStringSchema,
        package_unit: quantityUnitSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const updated = await purchasePriceService.update(request, {
      kind: data.kind === "ingrediente" ? "ingredient" : "packaging",
      subjectId: data.id,
      price: data.package_price,
      quantity: data.package_qty,
      unit: data.package_unit,
    });
    return {
      id: updated.id,
      package_price: updated.packagePrice,
      price_updated_at: updated.priceUpdatedAt.toISOString(),
      history_id: updated.historyId,
    };
  });
