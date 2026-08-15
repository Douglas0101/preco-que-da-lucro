import { desc, eq, and } from "drizzle-orm";
import { simulations, type Simulation } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export interface SimulationWrite {
  id?: string;
  productId?: string | null;
  name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  scenarioType: "manual_simulation" | "forecast" | "real";
  engineVersion: string;
}

export interface SimulationRepository {
  list(context: RequestContext): Promise<Simulation[]>;
  save(context: RequestContext, input: SimulationWrite): Promise<Simulation>;
}

export class DrizzleSimulationRepository implements SimulationRepository {
  list(context: RequestContext): Promise<Simulation[]> {
    return context.transaction
      .select()
      .from(simulations)
      .where(eq(simulations.tenantId, context.tenantId))
      .orderBy(desc(simulations.createdAt));
  }

  async save(context: RequestContext, input: SimulationWrite): Promise<Simulation> {
    const values = {
      productId: input.productId ?? null,
      name: input.name,
      params: input.params,
      result: input.result,
      scenarioType: input.scenarioType,
      engineVersion: input.engineVersion,
      updatedAt: new Date(),
    };
    const rows = input.id
      ? await context.transaction
          .update(simulations)
          .set(values)
          .where(and(eq(simulations.tenantId, context.tenantId), eq(simulations.id, input.id)))
          .returning()
      : await context.transaction
          .insert(simulations)
          .values({ tenantId: context.tenantId, userId: context.userId, ...values })
          .returning();
    if (!rows[0]) throw new Error("NOT_FOUND");
    return rows[0];
  }
}

export const simulationRepository = new DrizzleSimulationRepository();
