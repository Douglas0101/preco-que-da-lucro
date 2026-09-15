import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import {
  expenseRepository,
  type ExpenseRepository,
  type ExpenseTotals,
  type ExpenseWrite,
} from "@/server/repositories/expense.repository";
import { outboxRepository } from "@/server/repositories/outbox.repository";
import type { EventRepositoryPort } from "@/server/contracts/event.contracts";
import type { Expense } from "@/db/schema";

export interface ExpenseService {
  list(context: RequestContext): Promise<Expense[]>;
  save(context: RequestContext, input: ExpenseWrite): Promise<Expense>;
  remove(context: RequestContext, id: string): Promise<void>;
  totals(context: RequestContext): Promise<ExpenseTotals>;
}

export class DefaultExpenseService implements ExpenseService {
  constructor(
    private readonly repository: ExpenseRepository,
    private readonly events: EventRepositoryPort = outboxRepository,
  ) {}

  list(context: RequestContext): Promise<Expense[]> {
    return this.repository.list(context);
  }

  /**
   * §23 — a mutação de domínio e o evento de outbox commitam juntos: o append
   * usa `context.transaction` (o executor da transação corrente), então rollback
   * de qualquer um dos dois desfaz ambos. A chave de idempotência é estável por
   * (despesa, version), então um retry do mesmo write não cria segundo evento.
   */
  async save(context: RequestContext, input: ExpenseWrite): Promise<Expense> {
    assertTenantMutationAuthorized(context);
    const expense = await this.repository.save(context, input);
    await this.events.append(context, {
      eventType: "expense.saved",
      aggregateType: "expense",
      aggregateId: expense.id,
      idempotencyKey: `expense.saved:${expense.id}:v${expense.version}`,
      payload: {
        expenseId: expense.id,
        name: expense.name,
        amount: expense.amount,
        type: expense.type,
        version: expense.version,
      },
      occurredAt: expense.updatedAt,
    });
    return expense;
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
