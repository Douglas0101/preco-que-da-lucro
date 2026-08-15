import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import {
  expenseRepository,
  type ExpenseRepository,
  type ExpenseTotals,
  type ExpenseWrite,
} from "@/server/repositories/expense.repository";
import type { Expense } from "@/db/schema";

export interface ExpenseService {
  list(context: RequestContext): Promise<Expense[]>;
  save(context: RequestContext, input: ExpenseWrite): Promise<Expense>;
  remove(context: RequestContext, id: string): Promise<void>;
  totals(context: RequestContext): Promise<ExpenseTotals>;
}

export class DefaultExpenseService implements ExpenseService {
  constructor(private readonly repository: ExpenseRepository) {}

  list(context: RequestContext): Promise<Expense[]> {
    return this.repository.list(context);
  }

  async save(context: RequestContext, input: ExpenseWrite): Promise<Expense> {
    assertTenantMutationAuthorized(context);
    return this.repository.save(context, input);
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    assertTenantMutationAuthorized(context);
    await this.repository.remove(context, id);
  }

  totals(context: RequestContext): Promise<ExpenseTotals> {
    return this.repository.totals(context);
  }
}

export const expenseService: ExpenseService = new DefaultExpenseService(expenseRepository);
