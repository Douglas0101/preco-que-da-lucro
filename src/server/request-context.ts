import type { DatabaseTransaction } from "@/db/client.server";

export interface RequestContext {
  userId: string;
  tenantId: string;
  roles: readonly string[];
  correlationId: string;
  transaction: DatabaseTransaction;
}
