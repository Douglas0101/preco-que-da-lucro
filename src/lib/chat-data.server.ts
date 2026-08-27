import { and, eq } from "drizzle-orm";
import { withTenantTransaction } from "@/db/client.server";
import { chatConversations, products } from "@/db/schema";
import { ApplicationError } from "@/lib/api-error";
import type { RequestContext, RequestIdentity } from "@/lib/request-context";

export function numberSetting(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function requestContext(
  identity: RequestIdentity,
  transaction: RequestContext["transaction"],
): RequestContext {
  return { ...identity, transaction };
}

export async function inTenantTransaction<T>(
  identity: RequestIdentity,
  operation: (context: RequestContext) => Promise<T>,
): Promise<T> {
  try {
    return await withTenantTransaction(identity, (transaction) =>
      operation(requestContext(identity, transaction)),
    );
  } catch (error) {
    if (error instanceof ApplicationError || error instanceof Response) throw error;
    throw new ApplicationError("DATABASE_ERROR", { cause: error });
  }
}

/** Read-only lookup used by GET handlers. GET must never create tenant data. */
export async function getConversation(context: RequestContext) {
  const [existing] = await context.transaction
    .select()
    .from(chatConversations)
    .where(
      and(
        eq(chatConversations.tenantId, context.tenantId),
        eq(chatConversations.userId, context.userId),
      ),
    )
    .limit(1);
  return existing;
}

/** Creation is intentionally isolated to POST flows (send/reset/explicit create). */
export async function getOrCreateConversation(context: RequestContext) {
  const inserted = await context.transaction
    .insert(chatConversations)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      confirmedState: {},
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  const existing = await getConversation(context);
  if (!existing) throw new Error("DATABASE_ERROR");
  return existing;
}

export async function validateCurrentProduct(
  context: RequestContext,
  productId: string | null,
): Promise<string | null> {
  if (!productId) return null;
  const [row] = await context.transaction
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, context.tenantId), eq(products.id, productId)))
    .limit(1);
  if (!row) throw new ApplicationError("NOT_FOUND");
  return row.id;
}
