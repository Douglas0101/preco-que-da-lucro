import { and, desc, eq, sql } from "drizzle-orm";
import { expenses, products, type Expense } from "@/db/schema";
import { LIST_LIMITS } from "@/lib/list-limits";
import type { RequestContext } from "@/lib/request-context";

export interface ExpenseWrite {
  id?: string;
  name: string;
  category: string | null;
  amount: string;
  type: "fixa" | "variavel";
  periodicity: string;
  notes: string | null;
}

export interface ExpenseTotals {
  fixed: string;
  variable: string;
  productCount: number;
}

export interface ExpenseRepository {
  list(context: RequestContext): Promise<Expense[]>;
  save(context: RequestContext, input: ExpenseWrite): Promise<Expense>;
  remove(context: RequestContext, id: string): Promise<void>;
  totals(context: RequestContext): Promise<ExpenseTotals>;
}

export class DrizzleExpenseRepository implements ExpenseRepository {
  async list(context: RequestContext): Promise<Expense[]> {
    return context.transaction
      .select()
      .from(expenses)
      .where(eq(expenses.tenantId, context.tenantId))
      .orderBy(desc(expenses.createdAt))
      .limit(LIST_LIMITS.expenses);
  }

  async save(context: RequestContext, input: ExpenseWrite): Promise<Expense> {
    const values = {
      name: input.name,
      category: input.category,
      amount: input.amount,
      type: input.type,
      periodicity: input.periodicity,
      notes: input.notes,
      updatedAt: new Date(),
    };

    const rows = input.id
      ? await context.transaction
          .update(expenses)
          .set(values)
          .where(and(eq(expenses.tenantId, context.tenantId), eq(expenses.id, input.id)))
          .returning()
      : await context.transaction
          .insert(expenses)
          .values({ tenantId: context.tenantId, userId: context.userId, ...values })
          .returning();

    if (!rows[0]) throw new Error("NOT_FOUND");
    return rows[0];
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    const rows = await context.transaction
      .delete(expenses)
      .where(and(eq(expenses.tenantId, context.tenantId), eq(expenses.id, id)))
      .returning({ id: expenses.id });
    if (!rows.length) throw new Error("NOT_FOUND");
  }

  async totals(context: RequestContext): Promise<ExpenseTotals> {
    const [totals] = await context.transaction
      .select({
        fixed: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.type} = 'fixa'), 0)`,
        variable: sql<string>`coalesce(sum(${expenses.amount}) filter (where ${expenses.type} = 'variavel'), 0)`,
        productCount: sql<number>`(
          select count(*)::integer
          from ${products}
          where ${products.tenantId} = ${context.tenantId}
            and ${products.archivedAt} is null
        )`,
      })
      .from(expenses)
      .where(eq(expenses.tenantId, context.tenantId));

    if (!totals) throw new Error("DATABASE_ERROR");
    return totals;
  }
}

export const expenseRepository = new DrizzleExpenseRepository();
