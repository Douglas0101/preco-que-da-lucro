import type { DatabaseTransaction } from "@/db/client.server";
import { ApplicationError } from "@/lib/api-error";

export interface RequestIdentity {
  userId: string;
  tenantId: string;
  roles: readonly string[];
  correlationId: string;
  signal: AbortSignal;
}

/** Context shared by application services and repositories. The tenant and
 * user come from the authenticated membership; a body/header is never the
 * source of authority for either value. */
export interface TransactionContext extends RequestIdentity {
  transaction: DatabaseTransaction;
}

export type RequestContext = TransactionContext;

export function bindTransactionContext(
  identity: RequestIdentity,
  transaction: DatabaseTransaction,
): TransactionContext {
  return { ...identity, transaction };
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
