import { and, asc, count, eq, gte } from "drizzle-orm";
import { withTenantTransaction } from "@/db/client.server";
import { chatConversations, chatMessages, products } from "@/db/schema";
import { ApplicationError } from "@/lib/api-error";
import {
  budgetConfigFromEnv,
  createBudgetLedger,
  type BudgetLedger,
  type BudgetLedgerConfig,
} from "@/lib/ai/budget-ledger.server";
import { gatewayToolsForState, type GatewayTool } from "@/lib/ai/tool-registry";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { runRegisteredTool } from "@/lib/ai/tool-runner";
import type { RequestContext, RequestIdentity } from "@/lib/request-context";
import { logJson } from "@/lib/structured-logger";

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

interface GatewayResponse {
  choices: Array<{
    message: {
      content?: string | null;
      tool_calls?: GatewayToolCall[];
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const SYSTEM_PROMPT = `Você é o "Consultor Preço que Dá Lucro", uma IA amiga e didática que ajuda pequenos empreendedores brasileiros a coletarem dados e avaliarem cenários de preço.

REGRAS INEGOCIÁVEIS:
1) Converse em português do Brasil, com linguagem simples e uma pergunta por vez.
2) Nunca faça cálculos matemáticos; o motor financeiro determinístico faz os cálculos.
3) Nunca invente preço, custo, alíquota ou imposto. Ausência continua ausente, nunca zero.
4) Confirme o entendimento antes de chamar uma ferramenta de mutação.
5) Use somente as ferramentas registradas e explique apenas o resultado seguro recebido.
6) Não solicite senha, token, documento pessoal ou credencial.

FLUXO: create_product; add_ingredients; set_ingredient_cost para cada ingrediente; set_yield; add_packaging; set_price_and_tax; add_fee; set_market_price; finish_product.
Ao explicar, use "vale investigar", "os dados indicam" e "pode ser interessante simular". Não afirme que um preço está certo ou errado sem contexto.`;

export interface SendChatMessageInput {
  message: string;
  currentProductId?: string | null;
}

export type ModelCaller = (
  messages: GatewayMessage[],
  tools: GatewayTool[],
  requestSignal: AbortSignal,
) => Promise<GatewayResponse>;

export type ToolRunner = (
  options: Parameters<typeof runRegisteredTool>[0],
) => ReturnType<typeof runRegisteredTool>;

export interface ChatExecutionDependencies {
  modelCaller: ModelCaller;
  budgetLedger?: BudgetLedger;
  budgetConfig?: Partial<BudgetLedgerConfig>;
  toolRunner?: ToolRunner;
}

const CHAT_LIMIT_WINDOW_MS = 10 * 60 * 1_000;

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

async function reserveChatAndLoadHistory(
  context: RequestContext,
  budgetLedger: BudgetLedger,
  message: string,
  requestedProductId: string | null,
) {
  const [recent] = await context.transaction
    .select({ value: count() })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.tenantId, context.tenantId),
        eq(chatMessages.userId, context.userId),
        eq(chatMessages.role, "user"),
        gte(chatMessages.createdAt, new Date(Date.now() - CHAT_LIMIT_WINDOW_MS)),
      ),
    );
  const chatLimit = numberSetting("AI_CHAT_LIMIT_PER_10_MINUTES", 20, 1, 1_000);
  if ((recent?.value ?? 0) >= chatLimit) throw new ApplicationError("RATE_LIMIT");

  const chatReserved = await budgetLedger.reserveChatInTransaction(
    context.transaction,
    context.tenantId,
  );
  if (!chatReserved) throw new ApplicationError("AI_QUOTA");

  const conversation = await getOrCreateConversation(context);
  const currentProductId = await validateCurrentProduct(
    context,
    requestedProductId ?? conversation.currentProductId,
  );
  await context.transaction.insert(chatMessages).values({
    conversationId: conversation.id,
    tenantId: context.tenantId,
    userId: context.userId,
    role: "user",
    content: message,
  });
  const history = await context.transaction
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.tenantId, context.tenantId),
        eq(chatMessages.conversationId, conversation.id),
      ),
    )
    .orderBy(asc(chatMessages.createdAt))
    .limit(60);
  return { conversation, currentProductId, history };
}

function settlementOutcome(error: unknown): string {
  if (error instanceof ApplicationError) return `error_${error.code.toLowerCase()}`;
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  return "error";
}

export async function executeSendChatMessage(
  data: SendChatMessageInput,
  identity: RequestIdentity,
  dependencies: ChatExecutionDependencies,
) {
  const budgetConfig = { ...budgetConfigFromEnv(), ...dependencies.budgetConfig };
  const budgetLedger =
    dependencies.budgetLedger ?? createBudgetLedger({ identity, config: budgetConfig });
  const toolRunner = dependencies.toolRunner ?? runRegisteredTool;
  const requestTimeoutMs = numberSetting("AI_REQUEST_TIMEOUT_MS", 60_000, 1_000, 60_000);
  const requestSignal = AbortSignal.any([identity.signal, AbortSignal.timeout(requestTimeoutMs)]);

  if (requestSignal.aborted) throw new ApplicationError("AI_TIMEOUT");

  // reserveAtomic performs the lazy tenant sweep in the same transaction as the
  // conditional counter update. No gateway call can happen before this point.
  const state = await inTenantTransaction(identity, (request) =>
    reserveChatAndLoadHistory(
      request,
      budgetLedger,
      data.message,
      data.currentProductId === undefined ? null : data.currentProductId,
    ),
  );
  let currentProductId = state.currentProductId;
  const messages: GatewayMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  if (currentProductId) {
    messages.push({
      role: "system",
      content: `O produto atual confirmado tem id "${currentProductId}".`,
    });
  }
  for (const message of state.history) {
    if (message.role === "user" || message.role === "assistant" || message.role === "system") {
      messages.push({ role: message.role, content: message.content });
    }
  }

  const maxToolRounds = numberSetting("AI_MAX_TOOL_ROUNDS", 8, 1, 8);
  for (let round = 0; round < maxToolRounds; round += 1) {
    if (requestSignal.aborted) throw new ApplicationError("AI_TIMEOUT");

    const reservationResult = await budgetLedger.reserveAtomic(
      identity.tenantId,
      budgetConfig.conservativeTokenBudget,
      { kind: "model", roundNo: round },
    );
    if (reservationResult.status !== "reserved") throw new ApplicationError("AI_QUOTA");

    let inputTokens = 0;
    let outputTokens = 0;
    let realTokens = 0;
    let toolCallsCount = 0;
    let outcome = "error";

    try {
      const modelResponse = await dependencies.modelCaller(
        messages,
        gatewayToolsForState(currentProductId),
        requestSignal,
      );
      inputTokens = modelResponse.usage?.prompt_tokens ?? 0;
      outputTokens = modelResponse.usage?.completion_tokens ?? 0;
      realTokens = inputTokens + outputTokens;
      const modelMessage = modelResponse.choices[0].message;
      const toolCalls = modelMessage.tool_calls;

      if (toolCalls?.length) {
        toolCallsCount = toolCalls.length;
        outcome = "tool_round";
        messages.push({
          role: "assistant",
          content: modelMessage.content ?? "",
          tool_calls: toolCalls,
        });
        for (const toolCall of toolCalls) {
          const toolResult = await inTenantTransaction(identity, (request) =>
            toolRunner({
              context: request,
              name: toolCall.function.name,
              rawArguments: toolCall.function.arguments,
              idempotencyKey: `${state.conversation.id}:${toolCall.id}`,
            }),
          );
          if (toolResult.ok && toolResult.output.state?.currentProductId) {
            currentProductId = toolResult.output.state.currentProductId;
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(
              toolResult.ok
                ? { ok: true, ...toolResult.output.result, replayed: toolResult.replayed }
                : { ok: false, error: { code: toolResult.code }, replayed: toolResult.replayed },
            ),
          });
        }
        continue;
      }

      const content = modelMessage.content ? sanitizeAiOutput(modelMessage.content) : "";
      if (!content) throw new ApplicationError("DEPENDENCY_ERROR");
      await inTenantTransaction(identity, async (request) => {
        const [saved] = await request.transaction
          .insert(chatMessages)
          .values({
            conversationId: state.conversation.id,
            tenantId: request.tenantId,
            userId: request.userId,
            role: "assistant",
            content,
            metadata: { currentProductId },
          })
          .returning({ id: chatMessages.id });
        await request.transaction
          .update(chatConversations)
          .set({
            currentProductId,
            confirmedState: {
              currentProductId,
              lastAssistantMessageId: saved?.id ?? null,
              lastConfirmedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(chatConversations.tenantId, request.tenantId),
              eq(chatConversations.id, state.conversation.id),
            ),
          );
      });
      outcome = "success";
      logJson("info", "ai.chat_completed", {
        correlationId: identity.correlationId,
        tenantId: identity.tenantId,
        rounds: round + 1,
      });
      return { content, currentProductId };
    } catch (error) {
      outcome = settlementOutcome(error);
      throw error;
    } finally {
      await budgetLedger.settle(reservationResult.usageId, realTokens, outcome, {
        inputTokens,
        outputTokens,
        toolCalls: toolCallsCount,
      });
    }
  }

  throw new ApplicationError("DEPENDENCY_ERROR");
}
