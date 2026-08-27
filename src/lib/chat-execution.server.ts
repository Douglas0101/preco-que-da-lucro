import { and, asc, count, eq, gte } from "drizzle-orm";
import { chatConversations, chatMessages } from "@/db/schema";
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
import {
  getOrCreateConversation,
  inTenantTransaction,
  numberSetting,
  validateCurrentProduct,
} from "@/lib/chat-data.server";
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

interface ChatState {
  conversation: { id: string };
  currentProductId: string | null;
  history: Array<{ role: string; content: string }>;
}

type RoundResult =
  | { kind: "continue"; currentProductId: string | null }
  | { kind: "complete"; content: string; currentProductId: string | null };

function buildInitialMessages(state: ChatState): GatewayMessage[] {
  const messages: GatewayMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
  if (state.currentProductId) {
    messages.push({
      role: "system",
      content: `O produto atual confirmado tem id "${state.currentProductId}".`,
    });
  }
  for (const message of state.history) {
    if (message.role === "user" || message.role === "assistant" || message.role === "system") {
      messages.push({ role: message.role, content: message.content });
    }
  }
  return messages;
}

async function persistAssistantMessage(
  identity: RequestIdentity,
  state: ChatState,
  currentProductId: string | null,
  content: string,
): Promise<void> {
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
}

type ToolResult = Awaited<ReturnType<ToolRunner>>;

function toolMessage(toolCallId: string, toolResult: ToolResult): GatewayMessage {
  const content = toolResult.ok
    ? { ok: true, ...toolResult.output.result, replayed: toolResult.replayed }
    : { ok: false, error: { code: toolResult.code }, replayed: toolResult.replayed };
  return { role: "tool", tool_call_id: toolCallId, content: JSON.stringify(content) };
}

async function runToolCall(
  identity: RequestIdentity,
  conversationId: string,
  toolCall: GatewayToolCall,
  toolRunner: ToolRunner,
): Promise<ToolResult> {
  return inTenantTransaction(identity, (request) =>
    toolRunner({
      context: request,
      name: toolCall.function.name,
      rawArguments: toolCall.function.arguments,
      idempotencyKey: `${conversationId}:${toolCall.id}`,
    }),
  );
}

async function appendToolCalls(
  messages: GatewayMessage[],
  identity: RequestIdentity,
  state: ChatState,
  currentProductId: string | null,
  toolCalls: GatewayToolCall[],
  toolRunner: ToolRunner,
): Promise<string | null> {
  let nextProductId = currentProductId;
  for (const toolCall of toolCalls) {
    const toolResult = await runToolCall(identity, state.conversation.id, toolCall, toolRunner);
    if (toolResult.ok && toolResult.output.state?.currentProductId) {
      nextProductId = toolResult.output.state.currentProductId;
    }
    messages.push(toolMessage(toolCall.id, toolResult));
  }
  return nextProductId;
}

async function handleModelResponse(
  modelResponse: GatewayResponse,
  messages: GatewayMessage[],
  identity: RequestIdentity,
  state: ChatState,
  currentProductId: string | null,
  round: number,
  toolRunner: ToolRunner,
): Promise<RoundResult> {
  const modelMessage = modelResponse.choices[0]!.message;
  const toolCalls = modelMessage.tool_calls;
  if (toolCalls?.length) {
    messages.push({
      role: "assistant",
      content: modelMessage.content ?? "",
      tool_calls: toolCalls,
    });
    const nextProductId = await appendToolCalls(
      messages,
      identity,
      state,
      currentProductId,
      toolCalls,
      toolRunner,
    );
    return { kind: "continue", currentProductId: nextProductId };
  }

  const content = modelMessage.content ? sanitizeAiOutput(modelMessage.content) : "";
  if (!content) throw new ApplicationError("DEPENDENCY_ERROR");
  await persistAssistantMessage(identity, state, currentProductId, content);
  logJson("info", "ai.chat_completed", {
    correlationId: identity.correlationId,
    tenantId: identity.tenantId,
    rounds: round + 1,
  });
  return { kind: "complete", content, currentProductId };
}

async function executeReservedRound({
  budgetLedger,
  budgetConfig,
  identity,
  messages,
  requestSignal,
  state,
  currentProductId,
  round,
  modelCaller,
  toolRunner,
}: {
  budgetLedger: BudgetLedger;
  budgetConfig: BudgetLedgerConfig;
  identity: RequestIdentity;
  messages: GatewayMessage[];
  requestSignal: AbortSignal;
  state: ChatState;
  currentProductId: string | null;
  round: number;
  modelCaller: ModelCaller;
  toolRunner: ToolRunner;
}): Promise<RoundResult> {
  // reserveAtomic performs the lazy tenant sweep in the same transaction as the
  // conditional counter update. No gateway call can happen before this point.
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
    const modelResponse = await modelCaller(
      messages,
      gatewayToolsForState(currentProductId),
      requestSignal,
    );
    inputTokens = modelResponse.usage?.prompt_tokens ?? 0;
    outputTokens = modelResponse.usage?.completion_tokens ?? 0;
    realTokens = inputTokens + outputTokens;
    toolCallsCount = modelResponse.choices[0]!.message.tool_calls?.length ?? 0;
    const result = await handleModelResponse(
      modelResponse,
      messages,
      identity,
      state,
      currentProductId,
      round,
      toolRunner,
    );
    outcome = result.kind === "continue" ? "tool_round" : "success";
    return result;
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

  const state = await inTenantTransaction(identity, (request) =>
    reserveChatAndLoadHistory(
      request,
      budgetLedger,
      data.message,
      data.currentProductId === undefined ? null : data.currentProductId,
    ),
  );
  let currentProductId = state.currentProductId;
  const messages = buildInitialMessages(state);
  const maxToolRounds = numberSetting("AI_MAX_TOOL_ROUNDS", 8, 1, 8);
  for (let round = 0; round < maxToolRounds; round += 1) {
    if (requestSignal.aborted) throw new ApplicationError("AI_TIMEOUT");
    const result = await executeReservedRound({
      budgetLedger,
      budgetConfig,
      identity,
      messages,
      requestSignal,
      state,
      currentProductId,
      round,
      modelCaller: dependencies.modelCaller,
      toolRunner,
    });
    currentProductId = result.currentProductId;
    if (result.kind === "complete") return result;
  }

  throw new ApplicationError("DEPENDENCY_ERROR");
}
