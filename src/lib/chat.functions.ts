import { and, asc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withTenantTransaction } from "@/db/client.server";
import { chatConversations, chatMessages, products } from "@/db/schema";
import { applicationMetrics, withSpan } from "@/instrumentation/telemetry";
import { ApplicationError } from "@/lib/api-error";
import { executeSendChatMessage } from "@/lib/chat-execution.server";
import { gatewayToolsForState, type GatewayTool } from "@/lib/ai/tool-registry";
import type { RequestContext, RequestIdentity } from "@/lib/request-context";
import { requireDatabaseIdentity } from "@/middleware/request-context";

interface GatewayMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: GatewayToolCall[];
  tool_call_id?: string;
}

interface GatewayToolCall {
  id: string;
  function: { name: string; arguments: string };
}

const gatewayResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                function: z.object({
                  name: z.string().min(1),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const sendInput = z.object({
  message: z.string().trim().min(1).max(4000),
  currentProductId: z.string().uuid().nullable().optional(),
});

function numberSetting(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function requestContext(
  identity: RequestIdentity,
  transaction: RequestContext["transaction"],
): RequestContext {
  return { ...identity, transaction };
}

async function inTenantTransaction<T>(
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
async function getConversation(context: RequestContext) {
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
async function getOrCreateConversation(context: RequestContext) {
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

async function validateCurrentProduct(
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

function isTransientStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 425 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

const RETRY_BASE_DELAY_MS = 150;

/**
 * Full-jitter backoff (plan §14.7): uniform delay in [0, base * attempt), never
 * above the cap. Uses the CSPRNG from Web Crypto (available in Node and
 * browsers) instead of Math.random to keep the S2245 security hotspot out of
 * the new-code gate.
 */
function retryDelayMs(attempt: number): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  const unit = buffer[0]! / 2 ** 32;
  return Math.floor(unit * RETRY_BASE_DELAY_MS * attempt);
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

type GatewayResponse = z.output<typeof gatewayResponseSchema>;

type ModelCaller = (
  messages: GatewayMessage[],
  tools: GatewayTool[],
  requestSignal: AbortSignal,
) => Promise<GatewayResponse>;

async function fetchModelAttempt({
  apiKey,
  endpoint,
  model,
  messages,
  tools,
  signal,
  requestSignal,
  attempt,
  attempts,
}: Readonly<{
  apiKey: string;
  endpoint: string;
  model: string;
  messages: GatewayMessage[];
  tools: GatewayTool[];
  signal: AbortSignal;
  requestSignal: AbortSignal;
  attempt: number;
  attempts: number;
}>): Promise<GatewayResponse | null> {
  const response = await withSpan(
    "ai.model.call",
    { "gen_ai.request.model": model, "app.ai.attempt": attempt },
    () =>
      fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
        signal,
      }),
  );
  if (response.status === 402) {
    applicationMetrics.aiQuotas.add(1);
    throw new ApplicationError("AI_QUOTA");
  }
  if (response.status === 429) throw new ApplicationError("RATE_LIMIT");
  if (!response.ok) {
    if (isTransientStatus(response.status) && attempt < attempts) {
      await delay(retryDelayMs(attempt), requestSignal);
      return null;
    }
    throw new ApplicationError("DEPENDENCY_ERROR");
  }
  const parsed = gatewayResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApplicationError("DEPENDENCY_ERROR");
  return parsed.data;
}

async function runModelAttempt({
  apiKey,
  endpoint,
  model,
  messages,
  tools,
  requestSignal,
  attempt,
  attempts,
  timeoutMs,
}: Readonly<{
  apiKey: string;
  endpoint: string;
  model: string;
  messages: GatewayMessage[];
  tools: GatewayTool[];
  requestSignal: AbortSignal;
  attempt: number;
  attempts: number;
  timeoutMs: number;
}>): Promise<GatewayResponse | null> {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(timeoutMs)]);
  const attemptStartedAt = performance.now();
  try {
    return await fetchModelAttempt({
      apiKey,
      endpoint,
      model,
      messages,
      tools,
      signal,
      requestSignal,
      attempt,
      attempts,
    });
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    if (signal.aborted) {
      applicationMetrics.aiTimeouts.add(1);
      throw new ApplicationError("AI_TIMEOUT", { cause: error });
    }
    if (attempt >= attempts) throw new ApplicationError("DEPENDENCY_ERROR", { cause: error });
    await delay(retryDelayMs(attempt), requestSignal);
    return null;
  } finally {
    applicationMetrics.aiDuration.record(performance.now() - attemptStartedAt, {
      model,
      attempt,
    });
  }
}

async function callModel(
  messages: GatewayMessage[],
  tools: GatewayTool[],
  requestSignal: AbortSignal,
): Promise<GatewayResponse> {
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new ApplicationError("DEPENDENCY_ERROR");
  const endpoint =
    process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = process.env.AI_MODEL ?? "google/gemini-3.6-flash";
  const attempts = numberSetting("AI_MODEL_MAX_ATTEMPTS", 2, 1, 2);
  const timeoutMs = numberSetting("AI_MODEL_TIMEOUT_MS", 30_000, 1_000, 30_000);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await runModelAttempt({
      apiKey,
      endpoint,
      model,
      messages,
      tools,
      requestSignal,
      attempt,
      attempts,
      timeoutMs,
    });
    if (result) return result;
  }
  throw new ApplicationError("DEPENDENCY_ERROR");
}

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireDatabaseIdentity])
  .handler(async ({ context }) =>
    inTenantTransaction(context.requestIdentity, async (request) => {
      const conversation = await getConversation(request);
      if (!conversation) {
        return {
          messages: [],
          currentProductId: null,
          confirmedState: {
            currentProductId: null,
            lastAssistantMessageId: null,
            lastConfirmedAt: null,
          },
        };
      }
      const messages = await request.transaction
        .select({
          id: chatMessages.id,
          role: chatMessages.role,
          content: chatMessages.content,
          created_at: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.tenantId, request.tenantId),
            eq(chatMessages.conversationId, conversation.id),
          ),
        )
        .orderBy(asc(chatMessages.createdAt));
      return {
        messages: messages.map((message) => ({
          ...message,
          created_at: message.created_at.toISOString(),
        })),
        currentProductId: conversation.currentProductId,
        confirmedState: {
          currentProductId:
            typeof conversation.confirmedState.currentProductId === "string"
              ? conversation.confirmedState.currentProductId
              : null,
          lastAssistantMessageId:
            typeof conversation.confirmedState.lastAssistantMessageId === "string"
              ? conversation.confirmedState.lastAssistantMessageId
              : null,
          lastConfirmedAt:
            typeof conversation.confirmedState.lastConfirmedAt === "string"
              ? conversation.confirmedState.lastConfirmedAt
              : null,
        },
      };
    }),
  );

export const createChatConversation = createServerFn({ method: "POST" })
  .middleware([requireDatabaseIdentity])
  .handler(async ({ context }) =>
    inTenantTransaction(context.requestIdentity, async (request) => {
      const conversation = await getOrCreateConversation(request);
      return {
        id: conversation.id,
        currentProductId: conversation.currentProductId,
      };
    }),
  );

export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireDatabaseIdentity])
  .handler(async ({ context }) =>
    inTenantTransaction(context.requestIdentity, async (request) => {
      const conversation = await getOrCreateConversation(request);
      await request.transaction
        .delete(chatMessages)
        .where(
          and(
            eq(chatMessages.tenantId, request.tenantId),
            eq(chatMessages.conversationId, conversation.id),
          ),
        );
      await request.transaction
        .update(chatConversations)
        .set({
          currentProductId: null,
          confirmedState: {},
          resetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(chatConversations.tenantId, request.tenantId),
            eq(chatConversations.id, conversation.id),
          ),
        );
      return { ok: true as const };
    }),
  );

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireDatabaseIdentity])
  .validator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data, context }) =>
    executeSendChatMessage(data, context.requestIdentity, { modelCaller: callModel }),
  );

export {
  callModel as callModelForTests,
  getConversation as getConversationForTests,
  retryDelayMs as retryDelayMsForTests,
};
