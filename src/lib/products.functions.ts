import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeProduct, type IngredientRow, type PackagingRow, type FeeRow } from "@/lib/finance";

const uuid = z.string().uuid();

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [p, ing, pack, fees, market] = await Promise.all([
      context.supabase.from("products").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("product_ingredients")
        .select("*")
        .eq("product_id", data.id)
        .order("created_at"),
      context.supabase
        .from("product_packaging")
        .select("*")
        .eq("product_id", data.id)
        .order("created_at"),
      context.supabase.from("sales_fees").select("*").eq("product_id", data.id).order("created_at"),
      context.supabase
        .from("market_prices")
        .select("*")
        .eq("product_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (p.error) throw new Error(p.error.message);
    return {
      product: p.data,
      ingredients: ing.data ?? [],
      packaging: pack.data ?? [],
      fees: fees.data ?? [],
      market: market.data ?? null,
    };
  });

const productInput = z.object({
  id: uuid.optional(),
  name: z.string().min(1),
  current_price: z.number().nullable().optional(),
  yield_qty: z.number().positive().optional(),
  yield_unit: z.string().optional(),
  tax_regime: z.string().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
});
export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => productInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: res, error } = await context.supabase
      .from("products")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ingredientInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().min(1),
  used_qty: z.number().positive(),
  used_unit: z.string().min(1),
  package_price: z.number().nullable().optional(),
  package_qty: z.number().nullable().optional(),
  package_unit: z.string().nullable().optional(),
});
export const upsertIngredient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => ingredientInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: res, error } = await context.supabase
      .from("product_ingredients")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deleteIngredient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_ingredients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const packagingInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().min(1),
  package_price: z.number().min(0),
  units_per_package: z.number().positive(),
});
export const upsertPackaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => packagingInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: res, error } = await context.supabase
      .from("product_packaging")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deletePackaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_packaging").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const feeInput = z.object({
  id: uuid.optional(),
  product_id: uuid,
  name: z.string().min(1),
  percentage: z.number().min(0).max(100),
});
export const upsertFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => feeInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: res, error } = await context.supabase
      .from("sales_fees")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deleteFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sales_fees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const marketInput = z.object({
  product_id: uuid,
  min_price: z.number().nullable().optional(),
  avg_price: z.number().nullable().optional(),
  max_price: z.number().nullable().optional(),
});
export const setMarketPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => marketInput.parse(i))
  .handler(async ({ data, context }) => {
    // Simplest: keep only latest — delete previous then insert
    await context.supabase.from("market_prices").delete().eq("product_id", data.product_id);
    const { data: res, error } = await context.supabase
      .from("market_prices")
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

// Server-computed metrics for a product
export const getProductMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [p, ing, pack, fees] = await Promise.all([
      context.supabase.from("products").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("product_ingredients").select("*").eq("product_id", data.id),
      context.supabase.from("product_packaging").select("*").eq("product_id", data.id),
      context.supabase.from("sales_fees").select("*").eq("product_id", data.id),
    ]);
    if (!p.data) throw new Error("Produto não encontrado");
    const computed = computeProduct({
      ingredients: (ing.data ?? []) as unknown as IngredientRow[],
      packaging: (pack.data ?? []) as unknown as PackagingRow[],
      yieldQty: Number(p.data.yield_qty ?? 1),
      price: Number(p.data.current_price ?? 0),
      taxRate: Number(p.data.tax_rate ?? 0),
      fees: (fees.data ?? []) as unknown as FeeRow[],
    });
    const metrics = computed.status === "ok" ? computed.value : null;
    return { product: p.data, metrics };
  });

// ---- Atualização de preços de compra (insumos e embalagens) ----

export const listPurchasePrices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [products, ing, pack] = await Promise.all([
      context.supabase
        .from("products")
        .select("id, name")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("product_ingredients")
        .select("id, product_id, name, package_price, package_qty, package_unit, price_updated_at")
        .order("name"),
      context.supabase
        .from("product_packaging")
        .select("id, product_id, name, package_price, units_per_package, price_updated_at")
        .order("name"),
    ]);
    if (products.error) throw new Error(products.error.message);
    return {
      products: products.data ?? [],
      ingredients: ing.data ?? [],
      packaging: pack.data ?? [],
    };
  });

export const updatePurchasePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z
      .object({
        id: uuid,
        kind: z.enum(["ingrediente", "embalagem"]),
        package_price: z.number().min(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "ingrediente" ? "product_ingredients" : "product_packaging";
    const { data: res, error } = await context.supabase
      .from(table)
      .update({ package_price: data.package_price, price_updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("id, package_price, price_updated_at")
      .single();
    if (error) throw new Error(error.message);
    return res;
  });
