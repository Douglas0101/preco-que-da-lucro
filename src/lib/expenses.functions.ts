import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { expenses } from "@/db/schema";
import { nonNegativeDecimalStringSchema, toDecimalString } from "@/lib/financial-values";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { expenseService } from "@/server/services/expense.service";

const uuid = z.string().uuid();
const expenseInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(80).optional().nullable(),
  amount: nonNegativeDecimalStringSchema,
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
    amount: row.amount,
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
    const rows = await expenseService.list(context.requestContext);
    return rows.map(mapExpense);
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => expenseInput.parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    const expense = await expenseService.save(request, {
      id: data.id,
      name: data.name,
      category: data.category ?? null,
      amount: toDecimalString(data.amount, 4),
      type: data.type,
      periodicity: data.periodicity ?? "mensal",
      notes: data.notes ?? null,
    });
    return mapExpense(expense);
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const request = context.requestContext;
    await expenseService.remove(request, data.id);
    return { ok: true };
  });

export const getTotals = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    return expenseService.totals(context.requestContext);
  });
