import { describe, expect, it } from "vitest";
import type { Sale, SaleItem } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";
import { DefaultSalesService, type SaleDraft } from "@/server/services/sales.service";
import type { SaleWrite, SalesRepository } from "@/server/repositories/sales.repository";

function contextWithRole(role: string): RequestContext {
  return {
    userId: "user-1",
    tenantId: "50000000-0000-4000-8000-000000000005",
    roles: [role],
    correlationId: "60000000-0000-4000-8000-000000000006",
    signal: new AbortController().signal,
    transaction: {} as RequestContext["transaction"],
  };
}

class FakeSalesRepository implements SalesRepository {
  lastWrite: SaleWrite | undefined;

  async create(_context: RequestContext, input: SaleWrite) {
    this.lastWrite = input;
    return { sale: {} as Sale, items: [] as SaleItem[] };
  }

  async revenue(): Promise<string> {
    return "0.0000";
  }
}

describe("SalesService", () => {
  it("calcula linhas e faturamento bruto com decimal canônico", async () => {
    const repository = new FakeSalesRepository();
    const service = new DefaultSalesService(repository);
    const input: SaleDraft = {
      occurredAt: new Date("2026-08-15T12:00:00.000Z"),
      channel: "manual",
      items: [
        { productId: "50000000-0000-4000-8000-000000000005", quantity: "2", unitPrice: "10" },
      ],
    };

    await service.create(contextWithRole("owner"), input);

    expect(repository.lastWrite).toMatchObject({
      grossAmount: "20.0000",
      netAmount: "20.0000",
      items: [
        {
          quantity: "2.000000",
          unitPrice: "10.0000",
          totalAmount: "20.0000",
        },
      ],
    });
  });

  it("rejeita venda sem itens antes de tocar o repository", async () => {
    const repository = new FakeSalesRepository();
    const service = new DefaultSalesService(repository);

    await expect(
      service.create(contextWithRole("owner"), {
        occurredAt: new Date(),
        channel: "manual",
        items: [],
      }),
    ).rejects.toThrow("SALE_REQUIRES_ITEM");
    expect(repository.lastWrite).toBeUndefined();
  });

  it("mantém autorização de escrita no service", async () => {
    const service = new DefaultSalesService(new FakeSalesRepository());

    await expect(
      service.create(contextWithRole("member"), {
        occurredAt: new Date(),
        channel: "manual",
        items: [
          { productId: "50000000-0000-4000-8000-000000000005", quantity: "1", unitPrice: "1" },
        ],
      }),
    ).rejects.toThrow("Você não pode realizar esta ação.");
  });
});
