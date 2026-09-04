# WS-05 — estimated_cost writer + unknown handling (2026-09-01)

## Mudanças

- Schema (0008): `ai_usage.estimated_cost numeric(19,4) NULL` + `cost_status ('known','unknown','invalid')`; `ai_daily_budgets.estimated_cost_unknown_count`; `tool_executions.estimated_cost/cost_status` (documentado: custo é por rodada de modelo via `ai_usage`, não por tool — desvio intencional).
- `src/lib/ai/budget-ledger.server.ts`: `SettleOptions.estimatedCost/costStatus`; `settle()` grava `estimated_cost`/`cost_status` no `ai_usage` (guardado pela claim `status='reserved'`, replay não duplica custo) e agrega no diário: `estimated_cost += cost` só quando `known`; `estimated_cost_unknown_count += 1` para `unknown`/`invalid`.
- `estimateModelCost(model, inputTokens, outputTokens, prices)` + `modelTokenPricesFromEnv()` (`AI_MODEL_PRICING_JSON`; fallback conservador `google/gemini-3.6-flash` $0.10/$0.40 por 1M tokens, documentado e substituível via env). **Nunca** converte unknown em `0.0000` (INV-006).
- `chat.functions.ts`: `gatewayResponseSchema.model` opcional; `callModel` sempre expõe o nome do modelo.
- `chat-execution.server.ts`: no `finally` do round, estima custo e passa ao `settle`; métricas em `app.ai.estimated_cost_total`/`app.ai.cost_unknown_total` (try/catch — métricas nunca quebram o chat).

## Verificação

- `vitest` 333/333 (incl. novos `ai-estimated-cost.test.ts`: known/unknown/invalid/zero-price/env override).
- `scripts/db/test-ai-budget.ts` T1–T10: verdes (E5 ajustado para tool real `add_expense` porque o guard FSM do WS-06 barra tools fora da allowlist por estado).
