import { asc, eq, sql } from "drizzle-orm";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getDatabase, withTenantTransaction } from "@/db/client.server";
import { tenantMemberships } from "@/db/schema";
import { getAuth } from "@/server/auth/auth.server";

const uuid = z.string().uuid();

async function resolveMembership(userId: string, requestedTenantId: string | null) {
  if (requestedTenantId && !uuid.safeParse(requestedTenantId).success) return undefined;

  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    const rows = await transaction
      .select({ tenantId: tenantMemberships.tenantId, role: tenantMemberships.role })
      .from(tenantMemberships)
      .where(
        requestedTenantId
          ? eq(tenantMemberships.tenantId, requestedTenantId)
          : eq(tenantMemberships.userId, userId),
      )
      .orderBy(asc(tenantMemberships.createdAt))
      .limit(1);
    return rows[0];
  });
}

export const requireDatabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const session = await getAuth().api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) throw new Response("Não autenticado", { status: 401 });

    const membership = await resolveMembership(session.user.id, request.headers.get("x-tenant-id"));
    if (!membership) throw new Response("Tenant não autorizado", { status: 403 });

    const requestedCorrelationId = request.headers.get("x-correlation-id");
    const correlationId = uuid.safeParse(requestedCorrelationId).success
      ? requestedCorrelationId!
      : crypto.randomUUID();

    return withTenantTransaction(
      {
        userId: session.user.id,
        tenantId: membership.tenantId,
        roles: [membership.role],
      },
      (transaction) =>
        next({
          context: {
            requestContext: {
              userId: session.user.id,
              tenantId: membership.tenantId,
              roles: [membership.role],
              correlationId,
              transaction,
            },
          },
        }),
    );
  },
);
