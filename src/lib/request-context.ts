import type { DatabaseTransaction } from "@/db/client.server";
import { ApplicationError } from "@/lib/api-error";

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

/**
 * Product, price and expense writes require an owner/admin membership.  The
 * tenant is resolved from the authenticated membership; callers must never
 * promote a role supplied by a request body or header.
 */
export function assertTenantMutationAuthorized(identity: Pick<RequestIdentity, "roles">): void {
  if (!identity.roles.some((role) => role === "owner" || role === "admin")) {
    throw new ApplicationError("AUTHORIZATION_ERROR");
  }
}
