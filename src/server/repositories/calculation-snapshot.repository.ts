import { desc, eq, and } from "drizzle-orm";
import { calculationSnapshots, type CalculationSnapshot } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export interface CalculationSnapshotWrite {
  entityType: string;
  entityId: string;
  calculationType: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  engineVersion: string;
}

export interface CalculationSnapshotRepository {
  append(context: RequestContext, input: CalculationSnapshotWrite): Promise<CalculationSnapshot>;
  listForEntity(
    context: RequestContext,
    entityType: string,
    entityId: string,
  ): Promise<CalculationSnapshot[]>;
}

export class DrizzleCalculationSnapshotRepository implements CalculationSnapshotRepository {
  async append(context: RequestContext, input: CalculationSnapshotWrite) {
    const [row] = await context.transaction
      .insert(calculationSnapshots)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        calculationType: input.calculationType,
        inputs: input.inputs,
        outputs: input.outputs,
        engineVersion: input.engineVersion,
      })
      .returning();
    if (!row) throw new Error("DATABASE_ERROR");
    return row;
  }

  listForEntity(context: RequestContext, entityType: string, entityId: string) {
    return context.transaction
      .select()
      .from(calculationSnapshots)
      .where(
        and(
          eq(calculationSnapshots.tenantId, context.tenantId),
          eq(calculationSnapshots.entityType, entityType),
          eq(calculationSnapshots.entityId, entityId),
        ),
      )
      .orderBy(desc(calculationSnapshots.createdAt));
  }
}

export const calculationSnapshotRepository = new DrizzleCalculationSnapshotRepository();
