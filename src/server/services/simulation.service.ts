import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import {
  simulationRepository,
  type SimulationRepository,
  type SimulationWrite,
} from "@/server/repositories/simulation.repository";
import type { Simulation } from "@/db/schema";

export interface SimulationService {
  list(context: RequestContext): Promise<Simulation[]>;
  save(context: RequestContext, input: SimulationWrite): Promise<Simulation>;
}

export class DefaultSimulationService implements SimulationService {
  constructor(private readonly repository: SimulationRepository) {}

  list(context: RequestContext): Promise<Simulation[]> {
    return this.repository.list(context);
  }

  async save(context: RequestContext, input: SimulationWrite): Promise<Simulation> {
    assertTenantMutationAuthorized(context);
    return this.repository.save(context, input);
  }
}

export const simulationService: SimulationService = new DefaultSimulationService(
  simulationRepository,
);
