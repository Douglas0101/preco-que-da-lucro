import { asc, eq, sql } from "drizzle-orm";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  getDatabase,
  TenantMembershipDeniedError,
  withResolvedTenantTransaction,
  withTenantTransaction,
  type DatabaseTransaction,
} from "@/db/client.server";
import { tenantMemberships } from "@/db/schema";
import { apiErrorResponse, errorCodeFromUnknown } from "@/lib/api-error";
import { bindTransactionContext, type RequestIdentity } from "@/lib/request-context";
import { logJson } from "@/lib/structured-logger";
import { getAuth } from "@/server/auth/auth.server";

const uuid = z.string().uuid();

async function selectMembership(
  transaction: DatabaseTransaction,
  userId: string,
  requestedTenantId: string | null,
) {
  return transaction
    .select({ tenantId: tenantMemberships.tenantId, role: tenantMemberships.role })
    .from(tenantMemberships)
    .where(
      requestedTenantId
        ? sql`${tenantMemberships.tenantId} = ${requestedTenantId}
              and ${tenantMemberships.userId} = ${userId}`
        : eq(tenantMemberships.userId, userId),
    )
    .orderBy(asc(tenantMemberships.createdAt))
    .limit(1)
    .then((rows) => rows[0]);
}

async function resolveMembership(userId: string, requestedTenantId: string | null) {
  if (requestedTenantId && !uuid.safeParse(requestedTenantId).success) return undefined;

  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return selectMembership(transaction, userId, requestedTenantId);
  });
}

function getCorrelationId(context: unknown): string {
  const value = (context as { correlationId?: unknown } | undefined)?.correlationId;
  return uuid.safeParse(value).success ? String(value) : crypto.randomUUID();
}

async function authenticateRequest(options: {
  context: unknown;
  signal: AbortSignal;
}): Promise<RequestIdentity> {
  const request = getRequest();
  const correlationId = getCorrelationId(options.context);
  const session = await getAuth().api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) throw apiErrorResponse("AUTHENTICATION_ERROR", correlationId);
  const membership = await resolveMembership(session.user.id, request.headers.get("x-tenant-id"));
  if (!membership) throw apiErrorResponse("AUTHORIZATION_ERROR", correlationId);
  return {
    userId: session.user.id,
    tenantId: membership.tenantId,
    roles: [membership.role],
    correlationId,
    signal: options.signal,
  };
}

/** Autentica em transações curtas, sem manter uma transação aberta durante I/O externo. */
export const requireDatabaseIdentity = createMiddleware({ type: "function" }).server(
  async ({ context, next, signal }) => {
    const correlationId = getCorrelationId(context);
    try {
      const identity = await authenticateRequest({ context, signal });
      return next({ context: { requestIdentity: identity } });
    } catch (error) {
      if (error instanceof Response) throw error;
      const code = errorCodeFromUnknown(error);
      logJson("error", "bff.identity_failed", { correlationId, code, error });
      throw apiErrorResponse(code === "INTERNAL_ERROR" ? "DATABASE_ERROR" : code, correlationId);
    }
  },
);

/** Contexto transacional para BFFs curtos e exclusivamente dependentes do PostgreSQL.
 * Resolve sessão, membership e GUCs de tenant em UMA transação (S1-PERF-TX). */
export const requireDatabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ context, next, signal }) => {
    const correlationId = getCorrelationId(context);
    try {
      const request = getRequest();
      const session = await getAuth().api.getSession({
        headers: request.headers,
        query: { disableCookieCache: true },
      });
      if (!session) throw apiErrorResponse("AUTHENTICATION_ERROR", correlationId);
      const requestedTenantId = request.headers.get("x-tenant-id");
      if (requestedTenantId && !uuid.safeParse(requestedTenantId).success) {
        throw apiErrorResponse("AUTHORIZATION_ERROR", correlationId);
      }
      return await withResolvedTenantTransaction(
        session.user.id,
        (transaction) => selectMembership(transaction, session.user.id, requestedTenantId),
        (transaction, membership) =>
          next({
            context: {
              requestContext: bindTransactionContext(
                {
                  userId: session.user.id,
                  tenantId: membership.tenantId,
                  roles: [membership.role],
                  correlationId,
                  signal,
                },
                transaction,
              ),
            },
          }),
      );
    } catch (error) {
      if (error instanceof Response) throw error;
      if (error instanceof TenantMembershipDeniedError) {
        throw apiErrorResponse("AUTHORIZATION_ERROR", correlationId);
      }
      const code = errorCodeFromUnknown(error);
      logJson("error", "bff.request_failed", { correlationId, code, error });
      throw apiErrorResponse(code === "INTERNAL_ERROR" ? "DATABASE_ERROR" : code, correlationId);
    }
  },
);
