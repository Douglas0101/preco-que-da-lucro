# WS-06 — Conversation FSM server-side + allowlist por estado (2026-09-01)

## Mudanças

- Schema (0008): `chat_conversations.conversation_state` (+CHECK 7 estados), `state_updated_at`, `state_metadata`.
- `src/lib/chat-fsm.server.ts` (novo): estados `idle | collecting_context | calculating | confirming | executing | completed | failed`, eventos `SUBMIT | TOOL_EXECUTED | FINAL | FAILED | RESET`, tabela de transições (grafo do §5.6.2 com self-loop de tools e retry `failed→collecting_context`), `isTransitionAllowed` e `FSM_STATE_TOOL_ALLOWLIST` (só `collecting_context` expõe tools — demais estados vazio).
- `tool-registry.ts`: `REGISTRY_TOOL_NAMES`.
- `chat-execution.server.ts`: estado carregado/persistido (SUBMIT no início da mensagem; TOOL_EXECUTED por rodada; FINAL→completed antes do persist; FAILED em erro — best-effort); gate `fsmGuardedToolRunner` valida allowlist do estado + escopo do produto ANTES do runner (bloqueio → VALIDATION_ERROR, log `ai.tool_blocked`, métrica `toolExecutions{status:"blocked"}`).
- `chat.functions.ts`: `getChatHistory` expõe `conversation_state`; `clearChatHistory` reseta para `idle`.

## Verificação

- `tsc` limpo; `vitest` 333/333 (incl. novos `chat-fsm.server.test.ts` — triagem da tabela e completude da allowlist; `chat-fsm.test.ts` do cliente intacto).
- `scripts/db/test-ai-budget.ts` T1–T10 verdes; `test-tool-security.ts` e `test-chat-semantics.ts` verdes.

## Notas

- Estados `calculating/confirming/executing` existem no grafo e são persistidos por transições explícitas; a execução atual transita `collecting_context ↔ completed/failed` (o modelo só usa tools em `collecting_context` — enforcement real de permissão).
