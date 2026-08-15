import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/lib/request-context";
import {
  DefaultPurchasePriceService,
  type PurchasePriceService,
} from "@/server/services/purchase-price.service";
import type {
  PurchasePriceHistoryWrite,
  PurchasePriceRepository,
} from "@/server/repositories/purchase-price.repository";
import type { PurchasePriceHistory } from "@/db/schema";
import { contextWithRole } from "./helpers/request-context";

class FakePurchasePriceRepository implements PurchasePriceRepository {
  lastInput: PurchasePriceHistoryWrite | undefined;

  async append(_context: RequestContext, input: PurchasePriceHistoryWrite) {
    this.lastInput = input;
    return {
      id: "70000000-0000-4000-8000-000000000007",
    } as PurchasePriceHistory;
  }
}

describe("PurchasePriceService", () => {
  it("normaliza preço/quantidade e mantém metadados no histórico", async () => {
    const repository = new FakePurchasePriceRepository();
    const service: PurchasePriceService = new DefaultPurchasePriceService(repository);

    await service.append(contextWithRole("owner"), {
      kind: "ingredient",
      subjectId: "80000000-0000-4000-8000-000000000008",
      price: "12.3",
      quantity: "1.25",
      unit: " kg ",
      validFrom: new Date("2026-08-15T12:00:00.000Z"),
    });

    expect(repository.lastInput).toMatchObject({
      price: "12.3000",
      quantity: "1.250000",
      unit: "kg",
    });
  });

  it("rejeita quantidade ausente/inválida e preserva autorização", async () => {
    const service = new DefaultPurchasePriceService(new FakePurchasePriceRepository());
    const input = {
      kind: "ingredient" as const,
      subjectId: "80000000-0000-4000-8000-000000000008",
      price: "12",
      quantity: "0",
      unit: "kg",
      validFrom: new Date(),
    };

    await expect(service.append(contextWithRole("owner"), input)).rejects.toThrow(
      "INVALID_PRICE_QUANTITY",
    );
    await expect(
      service.append(contextWithRole("member"), { ...input, quantity: "1" }),
    ).rejects.toThrow("Você não pode realizar esta ação.");
  });
});
