import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withTenantTransaction } from "@/db/client.server";
import { applicationMetrics, withSpan } from "@/instrumentation/telemetry";
import { recordSafely } from "@/instrumentation/safe-record";
import { assertGatewayEndpoint } from "@/lib/ai-endpoint.server";
import { ApplicationError } from "@/lib/api-error";
import { createTenantTransaction, numberSetting } from "@/lib/tenant-transaction";
import { executeSendChatMessage } from "@/lib/chat-execution.server";
import { gatewayToolsForState, type GatewayTool } from "@/lib/ai/tool-registry";
import { conversationService } from "@/server/services/conversation.service";
import { logJson } from "@/lib/structured-logger";
import { requireDatabaseIdentity } from "@/middleware/request-context";

const inTenantTransaction = createTenantTransaction(withTenantTransaction);

interface GatewayMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: GatewayToolCall[];
  tool_call_id?: string;
}

interface GatewayToolCall {
  id: string;
  type?: "function";
  function: { name: string; arguments: string };
}

/**
 * O desserializador do destino nativo exige `type: "function"` em cada item de
 * `tool_calls` quando o histórico do assistente volta na rodada seguinte. A
 * OpenAI tolera a ausência; o DeepSeek responde HTTP 422
 * (`messages[6]: missing field 'type'`) e derruba a rodada — medido no Ciclo 29
 * na primeira conversa viva. Normalizar no limite do fetch mantém o contrato do
 * provedor em um único ponto, em vez de depender de cada chamador.
 */
function normalizeToolCallTypes(messages: GatewayMessage[]): GatewayMessage[] {
  return messages.map((message) =>
    message.tool_calls
      ? {
          ...message,
          tool_calls: message.tool_calls.map((call) => ({ ...call, type: "function" as const })),
        }
      : message,
  );
}

const gatewayResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string().min(1),
                type: z.literal("function").optional(),
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

/**
 * Campos de `error.type`/`error.message` do corpo de erro, por varredura de
 * texto: um `JSON.parse` em `try/catch` devolveria valor neutro num caminho de
 * dado (INV-013) e um corpo não-JSON ainda precisa virar detalhe auditável.
 */
function upstreamErrorFields(raw: string): string[] {
  const fields: string[] = [];
  for (const match of raw.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.){1,400})"/g))
    if (match[1] === "type" || match[1] === "message") fields.push(match[2] ?? "");
  return fields.filter((field) => field.length > 0);
}

/**
 * Detalhe limitado da recusa do provedor. Sem ele, uma rejeição 4xx do gateway
 * vira `DEPENDENCY_ERROR` sem causa registrada — medido no Ciclo 29: a rodada 1
 * com ferramentas falhava em ~750 ms desde que o zod descartava o `type` das
 * tool_calls e o motivo era descartado dentro do fetch. Carrega apenas o corpo
 * limitado, nunca cabeçalhos; a própria chave é removida antes de logar e o
 * redator do logger cobre o resto. Falha de leitura do corpo propaga para o
 * retry/DEPENDENCY_ERROR do chamador em vez de virar sucesso vazio.
 */
async function readUpstreamErrorDetail(response: Response, apiKey: string): Promise<string | null> {
  const raw = await response.text();
  if (raw.length === 0) return null;
  const fields = upstreamErrorFields(raw);
  const detail = (fields.length > 0 ? fields.join(": ") : raw).replace(/\s+/g, " ").trim();
  const withoutKey = apiKey.length >= 8 ? detail.split(apiKey).join("[REDACTED]") : detail;
  return withoutKey.slice(0, 240) || null;
}

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
  endpoint: URL;
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
        redirect: "error",
        headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: normalizeToolCallTypes(messages),
          tools,
          tool_choice: "auto",
          ...(endpoint.hostname === "api.deepseek.com"
            ? {
                // The existing history does not retain reasoning_content. Explicit
                // non-thinking mode keeps native tool round-trips compatible.
                thinking: { type: "disabled" },
                max_tokens: Math.min(
                  8192,
                  numberSetting("AI_CONSERVATIVE_TOKEN_BUDGET", 8192, 1, 1_000_000),
                ),
              }
            : {}),
        }),
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
    // Recusa definitiva do provedor: preserva status e motivo (limitados e
    // redigidos) antes de descartar o corpo — sem isto a causa não é auditável.
    logJson("warn", "ai.model_rejected", {
      model,
      attempt,
      status: response.status,
      detail: await readUpstreamErrorDetail(response, apiKey),
    });
    throw new ApplicationError("DEPENDENCY_ERROR");
  }
  const parsed = gatewayResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    logJson("warn", "ai.model_unparsable", {
      model,
      attempt,
      issues: parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "(root)"}:${issue.code}`),
    });
    throw new ApplicationError("DEPENDENCY_ERROR");
  }
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
  endpoint: URL;
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
  let outcome = "error";
  try {
    const response = await fetchModelAttempt({
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
    outcome = response === null ? "retry" : "success";
    return response;
  } catch (error) {
    if (error instanceof ApplicationError) {
      outcome = error.code;
      throw error;
    }
    if (signal.aborted) {
      outcome = "AI_TIMEOUT";
      applicationMetrics.aiTimeouts.add(1);
      throw new ApplicationError("AI_TIMEOUT", { cause: error });
    }
    if (attempt >= attempts) {
      outcome = "DEPENDENCY_ERROR";
      throw new ApplicationError("DEPENDENCY_ERROR", { cause: error });
    }
    await delay(retryDelayMs(attempt), requestSignal);
    outcome = "retry";
    return null;
  } finally {
    const elapsedMs = performance.now() - attemptStartedAt;
    recordSafely(applicationMetrics.aiDuration, elapsedMs, {
      model,
      attempt,
    });
    logJson("info", "ai.model_attempt", {
      model,
      attempt,
      durationMs: Math.round(elapsedMs),
      outcome,
    });
  }
}

async function callModel(
  messages: GatewayMessage[],
  tools: GatewayTool[],
  requestSignal: AbortSignal,
): Promise<GatewayResponse> {
  const endpoint =
    process.env.AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
  // Guard anti-SSRF na origem (G-SEC #10-13): o URL validado é o único que
  // alcança o fetch nos retries, cobrindo todas as instâncias com um check.
  const gatewayEndpoint = assertGatewayEndpoint(endpoint);
  const deepseek = gatewayEndpoint.hostname === "api.deepseek.com";
  const model = process.env.AI_MODEL ?? (deepseek ? "deepseek-flash" : "google/gemini-3.6-flash");
  if (
    deepseek &&
    (gatewayEndpoint.origin !== "https://api.deepseek.com" ||
      gatewayEndpoint.pathname !== "/chat/completions" ||
      gatewayEndpoint.username ||
      gatewayEndpoint.password ||
      gatewayEndpoint.search ||
      gatewayEndpoint.hash ||
      model !== "deepseek-flash")
  )
    throw new ApplicationError("DEPENDENCY_ERROR");
  // A provider-specific credential may never fall back to another issuer's key.
  const apiKey = deepseek
    ? process.env.DEEPSEEK_API_KEY
    : (process.env.AI_GATEWAY_API_KEY ?? process.env.LOVABLE_API_KEY);
  if (!apiKey || apiKey.trim() !== apiKey) throw new ApplicationError("DEPENDENCY_ERROR");
  const attempts = numberSetting("AI_MODEL_MAX_ATTEMPTS", 2, 1, 2);
  const timeoutMs = numberSetting("AI_MODEL_TIMEOUT_MS", 30_000, 1_000, 30_000);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await runModelAttempt({
      apiKey,
      endpoint: gatewayEndpoint,
      model,
      messages,
      tools,
      requestSignal,
      attempt,
      attempts,
      timeoutMs,
    });
    if (result) return { ...result, model: result.model ?? model };
  }
  throw new ApplicationError("DEPENDENCY_ERROR");
}

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireDatabaseIdentity])
  .handler(async ({ context }) =>
    inTenantTransaction(context.requestIdentity, async (request) => {
      const conversation = await conversationService.findForUser(request);
      if (!conversation) {
        return {
          messages: [],
          currentProductId: null,
          conversationState: "idle",
          confirmedState: {
            currentProductId: null,
            lastAssistantMessageId: null,
            lastConfirmedAt: null,
          },
        };
      }
      const messages = await conversationService.listMessages(request, conversation.id);
      return {
        messages: messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          created_at: message.createdAt.toISOString(),
        })),
        currentProductId: conversation.currentProductId,
        conversationState: conversation.conversationState,
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
      const conversation = await conversationService.getOrCreate(request);
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
      const conversation = await conversationService.getOrCreate(request);
      await conversationService.deleteMessages(request, conversation.id);
      await conversationService.updateConversation(request, conversation.id, {
        currentProductId: null,
        confirmedState: {},
        conversationState: "idle",
        stateUpdatedAt: new Date(),
        resetAt: new Date(),
        updatedAt: new Date(),
      });
      return { ok: true as const };
    }),
  );

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireDatabaseIdentity])
  .validator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data, context }) =>
    executeSendChatMessage(data, context.requestIdentity, { modelCaller: callModel }),
  );

export { callModel as callModelForTests, retryDelayMs as retryDelayMsForTests };
