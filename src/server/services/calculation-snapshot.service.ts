import { assertTenantMutationAuthorized, type RequestContext } from "@/lib/request-context";
import {
  calculationSnapshotRepository,
  type CalculationSnapshotRepository,
  type CalculationSnapshotWrite,
} from "@/server/repositories/calculation-snapshot.repository";
import type { CalculationSnapshot } from "@/db/schema";

export interface CalculationSnapshotService {
  append(context: RequestContext, input: CalculationSnapshotWrite): Promise<CalculationSnapshot>;
  listForEntity(
    context: RequestContext,
    entityType: string,
    entityId: string,
  ): Promise<CalculationSnapshot[]>;
}

export class DefaultCalculationSnapshotService implements CalculationSnapshotService {
  constructor(private readonly repository: CalculationSnapshotRepository) {}

  async append(context: RequestContext, input: CalculationSnapshotWrite) {
    assertTenantMutationAuthorized(context);
    return this.repository.append(context, input);
  }

  listForEntity(context: RequestContext, entityType: string, entityId: string) {
    return this.repository.listForEntity(context, entityType, entityId);
  }
}

export const calculationSnapshotService: CalculationSnapshotService =
  new DefaultCalculationSnapshotService(calculationSnapshotRepository);
