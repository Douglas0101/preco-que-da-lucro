import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { auditEvents, idempotencyRecords, toolExecutions } from "@/db/schema";
import type { ApiErrorCode } from "@/lib/api-error";
import { errorCodeFromUnknown } from "@/lib/api-error";
import type { RequestContext } from "@/lib/request-context";
import { logJson } from "@/lib/structured-logger";
import { applicationMetrics, withSpan } from "@/instrumentation/telemetry";
import { TOOL_REGISTRY, type ToolExecutionOutput } from "./tool-registry";

export type ToolRunResult =
  | { ok: true; output: ToolExecutionOutput; replayed: boolean }
  | { ok: false; code: ApiErrorCode; replayed: boolean };

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function inputHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function publicFailure(code: ApiErrorCode): ToolRunResult {
  return { ok: false, code, replayed: false };
}

async function persistRejected(
  context: RequestContext,
  toolName: string,
  hash: string,
  code: ApiErrorCode,
  startedAt: number,
): Promise<void> {
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
  await context.transaction.insert(toolExecutions).values({
    tenantId: context.tenantId,
    userId: context.userId,
    correlationId: context.correlationId,
    toolName,
    inputHash: hash,
    status: "failed",
    durationMs,
    errorCode: code,
    completedAt: new Date(),
  });
  applicationMetrics.toolExecutions.add(1, { tool: toolName, status: "rejected", code });
  applicationMetrics.toolDuration.record(durationMs, { tool: toolName, status: "rejected" });
}

export async function runRegisteredTool(options: {
  context: RequestContext;
  name: string;
  rawArguments: string;
  idempotencyKey: string;
}): Promise<ToolRunResult> {
  const { context, name, rawArguments, idempotencyKey } = options;
  const startedAt = performance.now();
  let rawInput: unknown;
  try {
    rawInput = JSON.parse(rawArguments || "{}");
  } catch {
    const hash = inputHash(rawArguments);
    await persistRejected(context, name, hash, "VALIDATION_ERROR", startedAt);
    return publicFailure("VALIDATION_ERROR");
  }

  const hash = inputHash(rawInput);
  const definition = TOOL_REGISTRY.get(name);
  if (!definition) {
    await persistRejected(context, name, hash, "VALIDATION_ERROR", startedAt);
    return publicFailure("VALIDATION_ERROR");
  }
  const prepared = definition.prepare(context, rawInput);
  if (!prepared.ok) {
    await persistRejected(context, name, hash, prepared.code, startedAt);
    return publicFailure(prepared.code);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const claimed = await context.transaction
    .insert(idempotencyRecords)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      operation: `ai.tool.${name}`,
      key: idempotencyKey,
      requestHash: hash,
      status: "pending",
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({ id: idempotencyRecords.id });

  if (!claimed[0]) {
    const [existing] = await context.transaction
      .select()
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
    if (existing?.requestHash !== hash) return publicFailure("CONFLICT");
    if (existing.status === "succeeded" && existing.response) {
      return {
        ok: true,
        output: existing.response as unknown as ToolExecutionOutput,
        replayed: true,
      };
    }
    return {
      ok: false,
      code: (existing?.errorCode as ApiErrorCode | null) ?? "CONFLICT",
      replayed: true,
    };
  }

  const [execution] = await context.transaction
    .insert(toolExecutions)
    .values({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      toolName: name,
      inputHash: hash,
      status: "pending",
      idempotencyKey,
    })
    .returning({ id: toolExecutions.id });
  if (!execution) return publicFailure("DATABASE_ERROR");

  try {
    context.signal.throwIfAborted();
    const output = await withSpan(
      "ai.tool.execute",
      {
        "app.correlation_id": context.correlationId,
        "app.tenant_id": context.tenantId,
        "ai.tool.name": name,
      },
      () => prepared.execute(),
    );
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    await context.transaction
      .update(toolExecutions)
      .set({ status: "succeeded", durationMs, safeResult: output, completedAt: new Date() })
      .where(eq(toolExecutions.id, execution.id));
    await context.transaction
      .update(idempotencyRecords)
      .set({ status: "succeeded", response: output, updatedAt: new Date() })
      .where(eq(idempotencyRecords.id, claimed[0].id));
    await context.transaction.insert(auditEvents).values({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      eventType: "ai.tool.succeeded",
      resourceType: "tool",
      resourceId: name,
      safeMetadata: { durationMs, replayed: false },
    });
    applicationMetrics.toolExecutions.add(1, { tool: name, status: "succeeded" });
    applicationMetrics.toolDuration.record(durationMs, { tool: name, status: "succeeded" });
    return { ok: true, output, replayed: false };
  } catch (error) {
    const mapped = errorCodeFromUnknown(error);
    const code = mapped === "INTERNAL_ERROR" ? "DATABASE_ERROR" : mapped;
    const durationMs = Math.max(0, Math.round(performance.now() - startedAt));
    await context.transaction
      .update(toolExecutions)
      .set({ status: "failed", durationMs, errorCode: code, completedAt: new Date() })
      .where(eq(toolExecutions.id, execution.id));
    await context.transaction
      .update(idempotencyRecords)
      .set({ status: "failed", errorCode: code, updatedAt: new Date() })
      .where(eq(idempotencyRecords.id, claimed[0].id));
    await context.transaction.insert(auditEvents).values({
      tenantId: context.tenantId,
      userId: context.userId,
      correlationId: context.correlationId,
      eventType: "ai.tool.failed",
      resourceType: "tool",
      resourceId: name,
      safeMetadata: { code, durationMs },
    });
    applicationMetrics.toolExecutions.add(1, { tool: name, status: "failed", code });
    applicationMetrics.toolDuration.record(durationMs, { tool: name, status: "failed" });
    logJson("warn", "ai.tool_failed", {
      correlationId: context.correlationId,
      toolName: name,
      code,
      error,
    });
    return { ok: false, code, replayed: false };
  }
}
