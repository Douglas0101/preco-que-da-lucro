import { describe, expect, it } from "vitest";
import type { Simulation } from "@/db/schema";
import { toDecimalString } from "@/lib/financial-values";
import type { RequestContext } from "@/lib/request-context";
import type {
  SimulationRecordWrite,
  SimulationRepository,
} from "@/server/repositories/simulation.repository";
import {
  DefaultSimulationService,
  type SimulationWrite,
} from "@/server/services/simulation.service";

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

const validParams: SimulationWrite["params"] = {
  price: toDecimalString("20"),
  unitCost: toDecimalString("8"),
  fixedExpenses: toDecimalString("100"),
  volume: toDecimalString("20"),
  taxRate: toDecimalString("0.1"),
  fees: [{ percentage: toDecimalString("0.02") }],
  volumeSource: "manual_simulation",
};

class FakeSimulationRepository implements SimulationRepository {
  lastWrite: SimulationRecordWrite | undefined;

  async list(): Promise<Simulation[]> {
    return [];
  }

  async append(_context: RequestContext, input: SimulationRecordWrite) {
    this.lastWrite = input;
    return {} as Simulation;
  }
}

describe("SimulationService", () => {
  it("calcula no servidor e persiste versão/result sem aceitar payload derivado", async () => {
    const repository = new FakeSimulationRepository();
    const service = new DefaultSimulationService(repository);

    await service.save(contextWithRole("owner"), {
      name: "Cenário manual",
      params: validParams,
    });

    expect(repository.lastWrite?.scenarioType).toBe("manual_simulation");
    expect(repository.lastWrite?.engineVersion).toBe("finance-engine/2.0.0");
    expect(repository.lastWrite?.result).toMatchObject({ status: "ok" });
    expect(repository.lastWrite?.params).toEqual(validParams);
  });

  it("não persiste cenário incompleto ou origem que ainda não tem fonte server-side", async () => {
    const repository = new FakeSimulationRepository();
    const service = new DefaultSimulationService(repository);

    await expect(
      service.save(contextWithRole("owner"), {
        name: "Incompleto",
        params: { ...validParams, price: null },
      }),
    ).rejects.toThrow("SIMULATION_NOT_PERSISTABLE");
    await expect(
      service.save(contextWithRole("owner"), {
        name: "Forecast",
        params: { ...validParams, volumeSource: "forecast" },
      }),
    ).rejects.toThrow("SIMULATION_SOURCE_NOT_PERSISTABLE");
    expect(repository.lastWrite).toBeUndefined();
  });
});
