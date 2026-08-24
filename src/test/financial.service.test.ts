import { describe, expect, it, vi } from "vitest";
import { applicationMetrics } from "@/instrumentation/telemetry";
import {
  FINANCE_ENGINE_VERSION,
  runFinancialSimulation,
} from "@/server/services/financial.service";

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

  it("registra a versão do motor financeiro a cada simulação executada", () => {
    const add = vi.spyOn(applicationMetrics.financialEngineVersion, "add");

    runFinancialSimulation({
      price: "20",
      unitCost: "5",
      taxRate: "10",
      fees: [],
      fixedExpenses: "101",
      volume: "10.1",
      volumeSource: "manual_simulation",
    });
    runFinancialSimulation({
      price: null,
      unitCost: null,
      taxRate: null,
      fees: [],
      fixedExpenses: null,
      volume: null,
      volumeSource: "unknown",
    });

    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith(1, { version: FINANCE_ENGINE_VERSION });
  });
});
