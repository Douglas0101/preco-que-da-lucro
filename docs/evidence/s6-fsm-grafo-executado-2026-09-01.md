# S6 — Grafo executado da FSM de conversa: qual estado autoriza tools mutantes (2026-09-01)

Decisão registrada em **ADR-026** (`docs/adr/ADR-026-conversation-fsm-executed-graph.md`), caminho **(b) — poda ao grafo executado + marcação de estados reservados**, sem mudança de comportamento.

## Resposta à pergunta S6 (com evidência)

**Hoje, o único estado que autoriza tools mutantes é `collecting_context`.**

- `src/lib/chat-fsm.server.ts:116` — `FSM_STATE_TOOL_ALLOWLIST.collecting_context = REGISTRY_TOOL_NAMES` (as 10 tools do registro).
- `src/lib/chat-fsm.server.ts:115,117-121` — os demais 6 estados (`idle`, `calculating`, `confirming`, `executing`, `completed`, `failed`) têm allowlist **vazia**.
- Enforcement server-side: `src/lib/chat-execution.server.ts:284` (`fsmGuardedToolRunner`) exige `allowlist[state].includes(tool)` **E** `gatewayToolsForState(productId)` (escopo de produto), além de permissão (`canMutate` owner/admin) e idempotência no runner guardado.

As 10 tools autorizadas: `create_product`, `add_ingredients`, `set_ingredient_cost`, `set_yield`, `add_packaging`, `set_price_and_tax`, `add_fee`, `set_market_price`, `add_expense`, `finish_product` (`src/lib/ai/tool-registry.ts:96-315`, nomes agregados em `REGISTRY_TOOL_NAMES` `:347`).

## Grafo EXECUTADO vs. vocabulário declarado (evidência de alcançabilidade)

Vocabulário declarado: 7 estados (`src/lib/chat-fsm.server.ts:8-18`) = CHECK do banco (migration `drizzle/0008_workable_professor_monster.sql`, `chat_conversations.conversation_state in (7)`).

Arestas **executadas** pelo fluxo atual (`chat-execution.server.ts`):

| Transição                                                              | Tabela (`chat-fsm.server.ts`) | Disparo (`chat-execution.server.ts`)                                                              |
| ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `idle --SUBMIT--> collecting_context`                                  | `:44`                         | `:515-520`                                                                                        |
| `collecting_context --TOOL_EXECUTED--> collecting_context` (self-loop) | `:46`                         | `:362-367`                                                                                        |
| `collecting_context --FINAL--> completed`                              | `:47`                         | `:373-380` (persist junto da mensagem)                                                            |
| `collecting_context --FAILED--> failed`                                | `:48`                         | `:542-547` (best-effort no catch)                                                                 |
| `completed/failed --SUBMIT--> collecting_context`                      | `:61-62`                      | `:515-520`                                                                                        |
| `* --RESET--> idle`                                                    | `:44,50,58-62`                | escrita direta `conversationState:"idle"` em `clearChatHistory` (`src/lib/chat.functions.ts:337`) |

**Verificação da alegação "entrada rejeitada como transição inválida":** a tabela **não define nenhuma aresta de ENTRADA** para `calculating`/`confirming`/`executing` — nenhum evento emitido de qualquer estado do grafo executado os alcança. As arestas **de saída** desses três (`FINAL→completed`, `FAILED→failed`, `RESET→idle`, `chat-fsm.server.ts:58-60`) **existem e são mantidas**: são guardas inofensivos caso uma linha seja escrita diretamente nesses estados (futuro M-04/intervenção). Outros eventos a partir deles (`SUBMIT`, `TOOL_EXECUTED`) são inválidos: `transitionConversation` não lança, emite métrica `conversationInvalidTransitions` e retorna estado inalterado (`chat-execution.server.ts:257-259`). Fixado por teste: `src/test/chat-fsm.server.test.ts` → "não possui aresta de entrada para os estados reservados".

## Decisão (b) — o que muda e o que NÃO muda

- **NÃO muda comportamento:** nenhum change de transição, allowlist, schema ou UI. `calculating`/`confirming`/`executing` continuam declarados (CHECK intacto — compatibilidade _forward_ com um passo `confirming` futuro do M-04).
- **Muda documentação:** anotações `RESERVA (ADR-026)` na union `ConversationState`, no bloco das três linhas da tabela, e doc block em `FSM_STATE_TOOL_ALLOWLIST` afirmando o estado único que autoriza mutações.

## Compensação INV-009 (confirmação conversacional, não server-side)

Não há estado `confirming` de execução server-side no fluxo atual: o modelo propõe e a **mesma requisição** executa as mutações; a "confirmação" é puramente conversacional na UX do chat. A compensação exigida por INV-009 é _por chamada_, não por estado:

- Chave de idempotência `${conversationId}:${toolCall.id}` (`src/lib/chat-execution.server.ts:313`);
- Ledger `tool_executions` + settle no budget ledger (rounds reservados/liquidados em `executeReservedRound`).

Portanto o gate de mutação real = `(estado ∈ allowlist) ∧ (escopo de produto) ∧ (permissão) ∧ (idempotência)`, e não um estágio `confirming`.

## O que restaria para um futuro caminho (a) (FORA do P1)

Um protocolo de confirmação server-side real (UI de aceite → `confirming` → `CONFIRM` → `executing` → `completed`) exige: novo evento `CONFIRM`, persistência da proposta aprovada, UI de confirmação e execução diferida — e depende da **máquina CAS de orçamento do M-04**, hoje `DRAFT v2` **sem RAT humano** (`docs/specs/M-04/spec.md:3`, D-011 `:312-315`). É o pouso previsto para a nota residual de S6, em P2. Congelado agora por §10 do plano P1 (sem escopo). Reabrir ADR-026 se optarmos por (a).

## Verificação executada

- `npx tsc --noEmit` (limpo para os arquivos tocados).
- `npx vitest run src/test/chat-fsm.server.test.ts src/test/tool-registry.test.ts src/test/chat-fsm.test.ts` (novos blocos "grafo executado" e "estados reservados" verdes).
- Suites E5/chat-semantics (DB) são de responsabilidade do orquestrador — NÃO executadas aqui (container intocado).
