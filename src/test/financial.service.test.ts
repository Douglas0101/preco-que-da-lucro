import { describe, expect, it } from "vitest";
import { runFinancialSimulation } from "@/server/services/financial.service";

describe("financial simulation BFF contract", () => {
  it("serializa todos os valores financeiros como strings decimais", () => {
    const result = runFinancialSimulation({
      price: "20",
      unitCost: "5",
      taxRate: "10",
      fees: [],
      fixedExpenses: "101",
      volume: "10.1",
      volumeSource: "manual_simulation",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(typeof result.value.price).toBe("string");
    expect(typeof result.value.result).toBe("string");
    expect(typeof result.value.volume).toBe("string");
    expect(typeof result.value.breakEvenUnits.rawUnits).toBe("string");
    expect(result.value.resultSign).toBe("positive");
  });
});
