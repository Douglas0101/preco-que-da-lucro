import { and, desc, eq, isNull } from "drizzle-orm";
import { products, type Product } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export interface ProductQuery {
  includeArchived?: boolean;
}

export interface ProductWrite {
  id?: string;
  name: string;
  currentPrice: string | null;
  yieldQty: string | null;
  yieldUnit: string | null;
  taxRegime: string | null;
  taxRate: string | null;
}

export interface ProductRepository {
  list(context: RequestContext, query?: ProductQuery): Promise<Product[]>;
  findById(context: RequestContext, id: string): Promise<Product | null>;
  save(context: RequestContext, input: ProductWrite): Promise<Product>;
  archive(context: RequestContext, id: string): Promise<void>;
}

export class DrizzleProductRepository implements ProductRepository {
  async list(context: RequestContext, query: ProductQuery = {}): Promise<Product[]> {
    const predicates = [eq(products.tenantId, context.tenantId)];
    if (!query.includeArchived) predicates.push(isNull(products.archivedAt));

    return context.transaction
      .select()
      .from(products)
      .where(and(...predicates))
      .orderBy(desc(products.createdAt));
  }

  async findById(context: RequestContext, id: string): Promise<Product | null> {
    const rows = await context.transaction
      .select()
      .from(products)
      .where(and(eq(products.tenantId, context.tenantId), eq(products.id, id)))
      .limit(1);
    return rows[0] ?? null;
  }

  async save(context: RequestContext, input: ProductWrite): Promise<Product> {
    const values = {
      name: input.name,
      currentPrice: input.currentPrice,
      yieldQty: input.yieldQty,
      yieldUnit: input.yieldUnit,
      taxRegime: input.taxRegime,
      taxRate: input.taxRate,
      updatedAt: new Date(),
    };

    const rows = input.id
      ? await context.transaction
          .update(products)
          .set(values)
          .where(and(eq(products.tenantId, context.tenantId), eq(products.id, input.id)))
          .returning()
      : await context.transaction
          .insert(products)
          .values({
            tenantId: context.tenantId,
            userId: context.userId,
            ...values,
          })
          .returning();

    if (!rows[0]) throw new Error("NOT_FOUND");
    return rows[0];
  }

  async archive(context: RequestContext, id: string): Promise<void> {
    const rows = await context.transaction
      .update(products)
      .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(products.tenantId, context.tenantId), eq(products.id, id)))
      .returning({ id: products.id });
    if (!rows.length) throw new Error("NOT_FOUND");
  }
}

export const productRepository = new DrizzleProductRepository();
