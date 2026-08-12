import { and, desc, eq, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { expenses, products } from "@/db/schema";
import { toDecimalString } from "@/lib/financial-values";
import { requireDatabaseAuth } from "@/server/auth/request-context.middleware";

const uuid = z.string().uuid();
const expenseInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional().nullable(),
  amount: z.number().finite().min(0),
  type: z.enum(["fixa", "variavel"]),
  periodicity: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function mapExpense(row: typeof expenses.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    tenant_id: row.tenantId,
    name: row.name,
    category: row.category,
    amount: Number(row.amount),
    type: row.type,
    periodicity: row.periodicity,
    is_demo: row.isDemo,
    notes: row.notes,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const rows = await request.transaction
      .select()
      .from(expenses)
      .where(eq(expenses.tenantId, request.tenantId))
      .orderBy(desc(expenses.createdAt));
    return rows.map(mapExpense);
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => expenseInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const values = {
      tenantId: request.tenantId,
      userId: request.userId,
      name: data.name,
      category: data.category ?? null,
      amount: toDecimalString(data.amount, 4),
      type: data.type,
      periodicity: data.periodicity ?? "mensal",
      notes: data.notes ?? null,
      updatedAt: new Date(),
    };

    const rows = data.id
      ? await request.transaction
          .update(expenses)
          .set(values)
          .where(and(eq(expenses.tenantId, request.tenantId), eq(expenses.id, data.id)))
          .returning()
      : await request.transaction.insert(expenses).values(values).returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return mapExpense(rows[0]);
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const deleted = await request.transaction
      .delete(expenses)
      .where(and(eq(expenses.tenantId, request.tenantId), eq(expenses.id, data.id)))
      .returning({ id: expenses.id });
    if (!deleted.length) throw new Error("NOT_FOUND");
    return { ok: true };
  });

export const getTotals = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const request = context.requestContext;
    const [totals] = await request.transaction
      .select({
        fixed: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.type} = 'fixa'), 0)`,
        variable: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.type} = 'variavel'), 0)`,
        productCount: sql<number>`(select count(*)::integer from ${products} where ${products.tenantId} = ${request.tenantId} and ${products.archivedAt} is null)`,
      })
      .from(expenses)
      .where(eq(expenses.tenantId, request.tenantId));
    if (!totals) throw new Error("DATABASE_ERROR");
    return {
      fixed: Number(totals.fixed),
      variable: Number(totals.variable),
      productCount: totals.productCount,
    };
  });
