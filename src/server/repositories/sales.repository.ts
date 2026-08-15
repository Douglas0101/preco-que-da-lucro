import { and, eq, gte, lte, sql } from "drizzle-orm";
import { sales, salesItems, type Sale, type SaleItem } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export interface SaleItemWrite {
  productId: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
}

export interface SaleWrite {
  occurredAt: Date;
  grossAmount: string;
  netAmount: string;
  channel: string;
  items: readonly SaleItemWrite[];
}

export interface SalesRepository {
  create(context: RequestContext, input: SaleWrite): Promise<{ sale: Sale; items: SaleItem[] }>;
  revenue(context: RequestContext, range?: { from?: Date; to?: Date }): Promise<string>;
}

export class DrizzleSalesRepository implements SalesRepository {
  async create(context: RequestContext, input: SaleWrite) {
    const [sale] = await context.transaction
      .insert(sales)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        occurredAt: input.occurredAt,
        grossAmount: input.grossAmount,
        netAmount: input.netAmount,
        channel: input.channel,
      })
      .returning();
    if (!sale) throw new Error("DATABASE_ERROR");

    const items = await context.transaction
      .insert(salesItems)
      .values(
        input.items.map((item) => ({
          tenantId: context.tenantId,
          userId: context.userId,
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
        })),
      )
      .returning();

    return { sale, items };
  }

  async revenue(context: RequestContext, range: { from?: Date; to?: Date } = {}) {
    const predicates = [eq(sales.tenantId, context.tenantId)];
    if (range.from) predicates.push(gte(sales.occurredAt, range.from));
    if (range.to) predicates.push(lte(sales.occurredAt, range.to));

    const [row] = await context.transaction
      .select({ revenue: sql<string>`coalesce(sum(${sales.netAmount}), 0)` })
      .from(sales)
      .where(and(...predicates));
    return row?.revenue ?? "0.0000";
  }
}

export const salesRepository = new DrizzleSalesRepository();
