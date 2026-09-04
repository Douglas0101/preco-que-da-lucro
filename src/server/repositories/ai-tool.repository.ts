import { and, eq } from "drizzle-orm";
import { idempotencyRecords, toolExecutions } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";

export interface ExistingToolClaim {
  requestHash: string;
  status: string;
  response: Record<string, unknown> | null;
  errorCode: string | null;
}

export class DrizzleAiToolRepository {
  async persistRejected(
    context: RequestContext,
    input: {
      toolName: string;
      inputHash: string;
      errorCode: string;
      durationMs: number;
    },
  ): Promise<void> {
    await context.transaction.insert(toolExecutions).values({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      toolName: input.toolName,
      inputHash: input.inputHash,
      status: "failed",
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      completedAt: new Date(),
    });
  }

  async findClaim(
    context: RequestContext,
    name: string,
    idempotencyKey: string,
  ): Promise<ExistingToolClaim | undefined> {
    const [existing] = await context.transaction
      .select({
        requestHash: idempotencyRecords.requestHash,
        status: idempotencyRecords.status,
        response: idempotencyRecords.response,
        errorCode: idempotencyRecords.errorCode,
      })
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, context.tenantId),
          eq(idempotencyRecords.userId, context.userId),
          eq(idempotencyRecords.operation, `ai.tool.${name}`),
          eq(idempotencyRecords.key, idempotencyKey),
        ),
      )
      .limit(1);
    return existing;
  }

  async claim(
    context: RequestContext,
    input: { name: string; idempotencyKey: string; requestHash: string; expiresAt: Date },
  ): Promise<string | undefined> {
    const [claimed] = await context.transaction
      .insert(idempotencyRecords)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        operation: `ai.tool.${input.name}`,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        status: "pending",
        expiresAt: input.expiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: idempotencyRecords.id });
    return claimed?.id;
  }

  async startExecution(
    context: RequestContext,
    input: { name: string; requestHash: string; idempotencyKey: string },
  ): Promise<string | undefined> {
    const [execution] = await context.transaction
      .insert(toolExecutions)
      .values({
        tenantId: context.tenantId,
        userId: context.userId,
        correlationId: context.correlationId,
        toolName: input.name,
        inputHash: input.requestHash,
        status: "pending",
        idempotencyKey: input.idempotencyKey,
      })
      .returning({ id: toolExecutions.id });
    return execution?.id;
  }

  async markSucceeded(
    context: RequestContext,
    executionId: string,
    claimId: string,
    output: Record<string, unknown>,
    durationMs: number,
  ): Promise<void> {
    await context.transaction
      .update(toolExecutions)
      .set({ status: "succeeded", durationMs, safeResult: output, completedAt: new Date() })
      .where(
        and(
          eq(toolExecutions.id, executionId),
          eq(toolExecutions.tenantId, context.tenantId),
          eq(toolExecutions.userId, context.userId),
        ),
      );
    await context.transaction
      .update(idempotencyRecords)
      .set({ status: "succeeded", response: output, updatedAt: new Date() })
      .where(
        and(
          eq(idempotencyRecords.id, claimId),
          eq(idempotencyRecords.tenantId, context.tenantId),
          eq(idempotencyRecords.userId, context.userId),
        ),
      );
  }

  async markFailed(
    context: RequestContext,
    executionId: string,
    claimId: string,
    errorCode: string,
    durationMs: number,
  ): Promise<void> {
    await context.transaction
      .update(toolExecutions)
      .set({ status: "failed", durationMs, errorCode, completedAt: new Date() })
      .where(
        and(
          eq(toolExecutions.id, executionId),
          eq(toolExecutions.tenantId, context.tenantId),
          eq(toolExecutions.userId, context.userId),
        ),
      );
    await context.transaction
      .update(idempotencyRecords)
      .set({ status: "failed", errorCode, updatedAt: new Date() })
      .where(
        and(
          eq(idempotencyRecords.id, claimId),
          eq(idempotencyRecords.tenantId, context.tenantId),
          eq(idempotencyRecords.userId, context.userId),
        ),
      );
  }
}

export const aiToolRepository = new DrizzleAiToolRepository();
