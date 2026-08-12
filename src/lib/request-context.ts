import type { DatabaseTransaction } from "@/db/client.server";

export interface RequestIdentity {
  userId: string;
  tenantId: string;
  roles: readonly string[];
  correlationId: string;
  signal: AbortSignal;
}

export interface RequestContext extends RequestIdentity {
  transaction: DatabaseTransaction;
}
