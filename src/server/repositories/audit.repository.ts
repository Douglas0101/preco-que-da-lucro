import { auditEvents } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

/** Payload of an audit trail entry. Tenant, user and correlation always come
 * from the authenticated request context — never from the caller payload. */
export interface AuditEventWrite {
  eventType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  safeMetadata?: Record<string, unknown> | null;
}

export interface AuditRepository {
  append(context: RequestContext, input: AuditEventWrite): Promise<void>;
}

export class DrizzleAuditRepository implements AuditRepository {
  async append(context: RequestContext, input: AuditEventWrite) {
    await context.transaction.insert(auditEvents).values({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      eventType: input.eventType,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      safeMetadata: input.safeMetadata ?? null,
    });
  }
}

export const auditRepository: AuditRepository = new DrizzleAuditRepository();
