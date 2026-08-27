import { desc, eq } from "drizzle-orm";
import { simulations, type Simulation } from "@/db/schema";
import { LIST_LIMITS } from "@/lib/list-limits";
import type { RequestContext } from "@/lib/request-context";

export interface SimulationRecordWrite {
  productId?: string | null;
  name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  scenarioType: "manual_simulation";
  engineVersion: string;
}

export interface SimulationRepository {
  list(context: RequestContext): Promise<Simulation[]>;
  append(context: RequestContext, input: SimulationRecordWrite): Promise<Simulation>;
}

export class DrizzleSimulationRepository implements SimulationRepository {
  list(context: RequestContext): Promise<Simulation[]> {
    return context.transaction
      .select()
      .from(simulations)
      .where(eq(simulations.tenantId, context.tenantId))
      .orderBy(desc(simulations.createdAt))
      .limit(LIST_LIMITS.simulations);
  }

  async append(context: RequestContext, input: SimulationRecordWrite): Promise<Simulation> {
    const [row] = await context.transaction
      .insert(simulations)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        productId: input.productId ?? null,
        name: input.name,
        params: input.params,
        result: input.result,
        scenarioType: input.scenarioType,
        engineVersion: input.engineVersion,
      })
      .returning();
    if (!row) throw new Error("DATABASE_ERROR");
    return row;
  }
}

export const simulationRepository = new DrizzleSimulationRepository();
