# WS-07 — Observabilidade, testes e evidências (2026-09-01)

## Métricas novas (`applicationMetrics`)

`app.sales.created_total`, `app.sales.summary_duration` (ms), `app.diagnostic.calculation_total{status}`, `app.simulation.saved_total`, `app.snapshot.created_total{type}`, `app.snapshot.failure_total{type}` + as dos WS-05/06 (`app.ai.estimated_cost_total`, `app.ai.cost_unknown_total`, `app.ai.conversation_state_transitions`, `app.ai.conversation_invalid_transitions`).

## Spans adicionados

`service.dashboard.sales_summary` (com `app.tenant_id`); `ai.model.call`/`ai.tool.execute`/`db.tenant_transaction`/`http.request` já existentes seguem sem segredos (redaction por `structured-logger`).

## Gates executados (2026-09-01, ambiente local)

- `tsc --noEmit` limpo · `vitest` **333/333** · `eslint .` 0 erros · `npm run build` ok · `check:bundle` ok (entry 84.9 kB gzip; grafo inicial 148.9 kB gzip ≤ 500 kB).
- `db:test` (Postgres 17-local): migrations 0000→0008 do zero + upgrade a partir de 0003 + RLS/cross-tenant/rollback **OK**; tool security OK; chat semantics OK; orçamento IA T1–T10 OK.
- Falha registrada (pré-existente, fora do escopo): `test-auth-integration.ts` — sign-in do hash bcrypt importado retorna 401 no ambiente local; nenhum arquivo de auth foi alterado por este programa.

## Ledger

`EXECUTION-STATE-PROGRAM.md` atualizado com a seção "P1 closeout (WS-01..WS-07)".
