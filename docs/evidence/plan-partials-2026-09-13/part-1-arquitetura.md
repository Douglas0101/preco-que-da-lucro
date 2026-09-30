# PART-1 — Arquitetura: serviços, repositórios, tool execution, T2, BFF

**Fonte:** auditoria read-only de 2026-09-13 sobre `develop @ 83efb16`; itens do Plano Mestre §§8, 9, 14.3, 21.
**Impacto:** +3,0 de crédito (BFF-002, BFF-003, 9.1, 9.2, 14.3, §21-T2) +1,0 se Memory/Event saírem de NS.

## Ordem recomendada

1. **9.2 interfaces** (habilita o resto) → 2. **9.1 Audit** → 3. **14.3 ToolExecution** (migration 0012) →
2. **9.1 Conversation** → 5. **T2** (migration 0013 + ADR-029) → 6. **BFF create/update** (M02-D-010) →
3. **9.1 Pricing** → 8. **Memory/Event contracts** (gated M-04/M-05).

## 9.2 Repository interfaces

- Já cumprem (interface + DI): product, expense, sales, simulation, purchase-price, calculation-snapshot.
- Faltam: `dashboard.repository.ts:17-76` (função solta) e `ai-tool.repository.ts:12-158` (classe sem interface, singleton órfão).
- Ações: exportar `DashboardRepository` + `DrizzleDashboardRepository` + `DefaultDashboardService(ctor repo)`; exportar
  `AiToolRepository` cobrindo os 6 métodos e tipar o singleton; threading opcional no `runRegisteredTool` (`tool-runner.ts:185-193`).
- Evidência: teste DI novo; `rg "export interface .*Repository" src/server/repositories/` ≥ 9.

## 9.1 Application Services (10 do plano)

- Existem: Product, Expense, Sales, Simulation, Diagnostic. Parciais: Pricing (lógica no diagnóstico + `src/lib/finance.ts`),
  Conversation (`chat-data.ts:45-89`, `chat-execution.server.ts`, `chat.functions.ts`), Audit (inserts diretos em
  `tool-runner.ts:95-103,298-306,331-339`). Inexistentes: Memory, Event (`matrix.yaml:1223-1237` aponta paths mortos).
- **Audit (S):** `audit.repository.ts` + `audit.service.ts`; tool-runner passa a chamar `auditService.append`.
- **Conversation (L):** mover para `conversation.repository.ts` + `conversation.service.ts` sem mudar FSM/replay
  (`chat-execution.server.ts:313` usa `${conversationId}:${toolCall.id}` — invariante); SQL fica no repository
  (gate `m02-boundaries` proíbe service→DB); `chat-data.ts` vira adapter e depois sai.
- **Pricing (S):** extrair `pricing.service.ts` de `diagnostic.service.ts:192-200,223-287` delegando a `calculatePriceFormation`.
- **Memory/Event (S, gated):** criar contracts reais (`src/server/contracts/event.contracts.ts` verbatim de M-04 spec:231-254;
  `memory.contracts.ts` mínimo PLANNED) **ou** matrix honesta com `deferred` — decidir no passo; memória segue NS até M-05.
- Bookkeeping: `matrix.overlay.yaml` (services/repos/transactionPolicies) + `npm run m02:matrix:generate` + `m02:matrix:check`/`m02:boundaries`.

## 14.3 ToolExecution (migration 0012)

- Estado: `tool_executions` (`src/db/schema.ts:692-735`) tem `input_hash`, `status`, `duration_ms`, `safe_result`,
  `idempotency_key`; faltam `tool_call_id` e `input`; `ai_usage.tool_execution_id` nunca escrito (`drizzle/0009:1`).
- Migration 0012: `tool_call_id text`, `input jsonb`, `usage_id uuid` + índice `(tenant_id, usage_id)`; sem FK (ai_usage sem UNIQUE(tenant,id)).
- Redator novo `src/lib/ai/tool-payload.ts` (`sanitizeToolInput`: limites + redação por chave; **não** reutilizar o SENSITIVE_KEY
  do logger, que apaga campos de domínio); persistir `prepared.input` sanitizado; `JSON.parse` inválido → `input: null`.
- Threading: `toolCallId`/`usageId` em `runRegisteredTool` ← `runToolCall` ← `executeReservedRound` (`reservationResult.usageId`).
- Decisão de contrato (`docs/specs/M-04/decisions.md`, ex. M04-D-012): vínculo canônico é N:1 via `tool_executions.usage_id`;
  **não** preencher `ai_usage.tool_execution_id` com "last tool wins".
- Testes: `src/test/tool-runner.persistence.test.ts` (fake transaction) + extensão de `scripts/db/test-tool-security.ts`;
  atualizar `test-migrations.ts` (12→13) e `scripts/m02-v2b.mjs:32`.

## §21 T2 — read-modify-write (migration 0013 + ADR-029)

- Casos vulneráveis: `product.repository.ts:47-75` e `expense.repository.ts:39-63` (last-write-wins); lock de
  `purchase-price.repository.ts:35-38` acontece depois do UPDATE da base row; FSM da conversa grava em tx separada.
- Migration 0013: `version integer default 0 not null` + CHECK em products/expenses; update CAS
  (`where tenant+id+version`) e `version+1`; 0 rows → `CONFLICT` (409) se existe / `NOT_FOUND` se não.
- BFF update exige `version` (ver BFF-002/003); upsert legado com `id` sem `version` → `VALIDATION_ERROR`.
- Conversa (sem migration): CAS no `persistConversationState` (`chat-execution.server.ts:223-244`) contra estado esperado.
- Lock ordering: `lock()` no início de `DefaultPurchasePriceService.update`.
- Testes: version tests dos repositórios + burst em `scripts/db/` (1 OK + 1 CONFLICT + versão incrementada); ADR-029 curto
  ("version otimista para products/expenses; FOR UPDATE só com leitura na tx; SERIALIZABLE é T3").

## BFF-002/003 — create/update split (ratificado)

- `products.functions.ts`: dividir `productInput:520-528` em `createProductInput`/`updateProductInput` (update com `id`+`version`);
  `createProduct`/`updateProduct` explícitos; `upsertProduct:530` vira dispatcher; `deleteProduct:557` segue alias de archive (nota de soft-delete).
- `expenses.functions.ts`: mesma divisão (`expenseInput:9-17`).
- Decisão: `docs/specs/M-02/decisions/M02-D-010-bff-create-update-semantics.md` + `matrix.overlay.yaml` + regenerate/check/boundaries.
- Teste: contrato estático (4 exports; create sem `id`; update exige `id`/`version`).
