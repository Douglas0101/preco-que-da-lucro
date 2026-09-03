import { and, asc, count, eq, gte } from "drizzle-orm";
import { withTenantTransaction } from "@/db/client.server";
import { chatConversations, chatMessages } from "@/db/schema";
import { ApplicationError } from "@/lib/api-error";
import {
  budgetConfigFromEnv,
  createBudgetLedger,
  estimateModelCost,
  type BudgetLedger,
  type BudgetLedgerConfig,
} from "@/lib/ai/budget-ledger.server";
import { gatewayToolsForState, type GatewayTool } from "@/lib/ai/tool-registry";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { runRegisteredTool } from "@/lib/ai/tool-runner";
import {
  FSM_STATE_TOOL_ALLOWLIST,
  isConversationState,
  isTransitionAllowed,
  transitionConversationState,
  type ConversationEvent,
  type ConversationState,
} from "@/lib/chat-fsm.server";
import { applicationMetrics } from "@/instrumentation/telemetry";
import {
  createTenantTransaction,
  getOrCreateConversation,
  numberSetting,
  validateCurrentProduct,
} from "@/lib/chat-data";
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
7) Apresente valores financeiros no padrão do Brasil: moeda como R$ 1.234,56 e decimais/percentuais com vírgula (ex.: 12,5%).
8) É vedado inventar, arredondar ou somar valores não fornecidos pelo usuário ou pelo motor financeiro; exiba o valor recebido sem alterar o número.

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
const inTenantTransaction = createTenantTransaction(withTenantTransaction);

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
  const conversationState: ConversationState = isConversationState(conversation.conversationState)
    ? conversation.conversationState
    : "idle";
  return { conversation, currentProductId, history, conversationState };
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
  conversationState: ConversationState;
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
        conversationState: state.conversationState,
        stateUpdatedAt: new Date(),
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

async function persistConversationState(
  identity: RequestIdentity,
  conversationId: string,
  conversationState: ConversationState,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await inTenantTransaction(identity, async (request) => {
    await request.transaction
      .update(chatConversations)
      .set({
        conversationState,
        stateUpdatedAt: new Date(),
        ...(metadata === undefined ? {} : { stateMetadata: metadata }),
      })
      .where(
        and(
          eq(chatConversations.tenantId, request.tenantId),
          eq(chatConversations.id, conversationId),
        ),
      );
  });
}

/**
 * Applies an FSM transition: records the metric, persists the new state when
 * it differs, and never throws for invalid transitions (returns state as-is).
 */
async function transitionConversation(
  identity: RequestIdentity,
  conversationId: string,
  state: ConversationState,
  event: ConversationEvent,
  persist = true,
): Promise<ConversationState> {
  if (!isTransitionAllowed(state, event)) {
    applicationMetrics.conversationInvalidTransitions.add(1, { from: state, event });
    return state;
  }
  const next = transitionConversationState(state, event);
  applicationMetrics.conversationStateTransitions.add(1, { from: state, to: next });
  if (persist && next !== state) {
    await persistConversationState(identity, conversationId, next);
  }
  return next;
}

/**
 * Per-round tool gate (WS-06): tools only run when the conversation state
 * allowlist and the product scope (gatewayToolsForState) both permit the call.
 */
function fsmGuardedToolRunner(
  getState: () => ConversationState,
  getProductId: () => string | null,
  inner: ToolRunner,
): ToolRunner {
  return async (options) => {
    const toolName = options.name;
    const state = getState();
    const scopedNames = new Set(
      gatewayToolsForState(getProductId()).map((tool) => tool.function.name),
    );
    if (!FSM_STATE_TOOL_ALLOWLIST[state].includes(toolName) || !scopedNames.has(toolName)) {
      applicationMetrics.toolExecutions.add(1, { tool: toolName, status: "blocked", state });
      logJson("warn", "ai.tool_blocked", { toolName, state });
      return { ok: false as const, code: "VALIDATION_ERROR" as const, replayed: false };
    }
    return inner(options);
  };
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
    state.conversationState = await transitionConversation(
      identity,
      state.conversation.id,
      state.conversationState,
      "TOOL_EXECUTED",
    );
    return { kind: "continue", currentProductId: nextProductId };
  }

  const content = modelMessage.content ? sanitizeAiOutput(modelMessage.content) : "";
  if (!content) throw new ApplicationError("DEPENDENCY_ERROR");
  state.conversationState = await transitionConversation(
    identity,
    state.conversation.id,
    state.conversationState,
    "FINAL",
    false,
  );
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
  let modelName: string | null = null;
  let outcome = "error";

  try {
    const modelResponse = await modelCaller(
      messages,
      gatewayToolsForState(currentProductId),
      requestSignal,
    );
    modelName = (modelResponse as { model?: string }).model ?? null;
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
    const est = estimateModelCost(modelName, inputTokens, outputTokens);
    await budgetLedger.settle(reservationResult.usageId, realTokens, outcome, {
      inputTokens,
      outputTokens,
      toolCalls: toolCallsCount,
      estimatedCost: est.status === "known" ? est.cost : null,
      costStatus: est.status,
    });
    try {
      if (est.status === "known") {
        applicationMetrics.aiEstimatedCostTotal.add(1, {
          model: modelName ?? "unknown",
          status: "known",
        });
      } else if (est.status === "unknown") {
        applicationMetrics.aiCostUnknownTotal.add(1);
      }
    } catch (error) {
      // Cost telemetry must never break the chat settle path.
      logJson("warn", "ai.cost_metrics_failed", { error });
    }
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
  const baseToolRunner = dependencies.toolRunner ?? runRegisteredTool;
  const requestTimeoutMs = numberSetting("AI_REQUEST_TIMEOUT_MS", 60_000, 1_000, 60_000);
  const requestSignal = AbortSignal.any([identity.signal, AbortSignal.timeout(requestTimeoutMs)]);

  if (requestSignal.aborted) throw new ApplicationError("AI_TIMEOUT");

  const loaded = await inTenantTransaction(identity, (request) =>
    reserveChatAndLoadHistory(
      request,
      budgetLedger,
      data.message,
      data.currentProductId === undefined ? null : data.currentProductId,
    ),
  );
  const state: ChatState = {
    conversation: loaded.conversation,
    currentProductId: loaded.currentProductId,
    history: loaded.history,
    conversationState: loaded.conversationState,
  };
  let currentProductId = state.currentProductId;
  const toolRunner = fsmGuardedToolRunner(
    () => state.conversationState,
    () => currentProductId,
    baseToolRunner,
  );
  const messages = buildInitialMessages(state);
  const maxToolRounds = numberSetting("AI_MAX_TOOL_ROUNDS", 8, 1, 8);
  try {
    state.conversationState = await transitionConversation(
      identity,
      state.conversation.id,
      state.conversationState,
      "SUBMIT",
    );
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
  } catch (error) {
    try {
      await transitionConversation(
        identity,
        state.conversation.id,
        state.conversationState,
        "FAILED",
      );
    } catch (stateError) {
      logJson("warn", "ai.state_persist_failed", { error: stateError });
    }
    throw error;
  }
}
