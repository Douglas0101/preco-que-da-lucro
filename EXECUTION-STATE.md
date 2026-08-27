# EXECUTION-STATE — csf_58b444f152e35ba899b5381e

Estado persistente da execução do fix `resource-exhaustion.ai-budget-race`.
Este arquivo não contém credenciais, tokens, URLs Neon reais ou conteúdo de mensagens.

## Identidade da execução

- Mandato vigente: v3, desbloqueado por H-001..H-003 em 2026-08-26.
- Finding: `csf_58b444f152e35ba899b5381e` (CWE-770).
- Branch do fix: `fix/ai-budget-reservation-csf58b4`.
- Base ratificada: `origin/develop` em `339efb0d02db1c2b868c41d87821357d61f4b021`.
- Preservação local: `wip/preservacao-c371032-20260826`, não publicada.
- Início desta execução v3: `2026-08-26T21:43:51-03:00`.
- Última atualização: `2026-08-27T01:39:16Z`.

## Decisões humanas — transcrição verbatim

> **H-001** — "Aprovo a Opção C e a SPEC-AMEND-001."

> **H-002** — "Autorizo a execução das Fases 1–4 sob os poderes v2 e os deltas propostos."

> **H-003** — "Q-008 permanece NÃO: usar contract tests para os drivers; não usar endpoint Neon."

### Efeitos registrados

- Q-007 resolvida: Opção C, com REQ-008 rev2, REQ-010, REQ-011 e REQ-012.
- SPEC-AMEND-001 ratificada e vigente para esta execução.
- Q-008 resolvida como NÃO: node-postgres contra PostgreSQL local/efêmero; contract
  tests para `neon-serverless`; nenhum endpoint Neon real.
- Fases 1–4 autorizadas somente dentro dos poderes e proibições do mandato v3.

### Não-efeitos preservados

- Sem merge, sem push da `wip/`, sem push direto em `main`/`develop` e sem force-push.
- Sem migração, escrita, restore, backup, cutover ou teste em Neon real.
- Sem alteração de ADR-021, `src/routes/auth.tsx`, secrets de produção ou billing do provedor.
- Sem implementação de D1/Workers; portabilidade permanece adiada por REQ-012.

## Perguntas e decisões

| ID                        | Owner   | Status nesta execução                                |
| ------------------------- | ------- | ---------------------------------------------------- |
| Q-001 (A1)                | HUMANO  | Aberta e intocada                                    |
| Q-002 (TAC)               | EXTERNO | Aberta e intocada                                    |
| Q-003 (merge)             | HUMANO  | Aberta e intocada                                    |
| Q-004 (destino da `wip/`) | HUMANO  | Aberta e intocada                                    |
| Q-005 (defaults)          | AGENTE  | Resolvida em F2-3: defaults registrados abaixo       |
| Q-006 (validade no tip)   | AGENTE  | Resolvida por T-03, saída (a)                        |
| Q-007 (D1)                | HUMANO  | Resolvida por H-001; portabilidade adiada em REQ-012 |
| Q-008 (endpoint Neon)     | HUMANO  | Resolvida por H-003: NÃO                             |

## Ledger de tarefas

Status permitidos: `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `NOT_RUN`.

| Tarefa                                | Status  | Evidência / predicado de retomada                                                                      |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| T-00 / partida histórica              | DONE    | Log de execução preservado; worktree inicial catalogado                                                |
| T-01 / preservação histórica          | DONE    | `a14fdb9` na `wip/`, não publicada                                                                     |
| T-02 / SHA histórico                  | DONE    | `origin/develop=339efb0d02db1c2b868c41d87821357d61f4b021`                                              |
| T-03 / SPEC-RATIFICADA histórica      | DONE    | Diff vazio de `src/lib/chat.functions.ts`; saída (a)                                                   |
| F1-1 / branch, evidências e estado    | DONE    | `10d257d9fa0a9697616cf08ba423db30c183dead`; G-AMBIENTE-0 passou                                        |
| F1-2 / auditoria ambiental C-11       | DONE    | `docs/auditoria-ambiental-2026-08-26.md`; G-AMBIENTE passou                                            |
| F1-3 / schema local                   | DONE    | `drizzle/0006_loud_lockjaw.sql`; `db:check` passou; migration aplicada duas vezes; objetos verificados |
| F2-1 / módulo budget-ledger           | DONE    | `src/lib/ai/budget-ledger.ts`; reserve/settle/sweep; typecheck + T1–T10 verdes                         |
| F2-2 / integração no chat             | DONE    | Reserva antes de `modelCaller`; finally liquida cada round; nenhum SQL de orçamento em chat            |
| F2-3 / configuração e observabilidade | DONE    | Defaults e eventos estruturados registrados abaixo; Q-005 resolvida                                    |
| F3-1 / T1–T10                         | DONE    | `npm run db:test` e runner focado verdes no PostgreSQL 17 local                                        |
| F3-2 / T-CN                           | DONE    | Baseline sem fix: gateway=20; fix: E1 gateway=1                                                        |
| F4-1 / qualidade                      | DONE    | UI/no-Supabase/formatação/lint/typecheck/test/build/bundle verdes                                      |
| F4-2 / secrets                        | PENDING | Depende de F4-1                                                                                        |
| F4-3 / push e PR draft                | PENDING | Depende de F4-2; nunca merge                                                                           |
| F4-4 / CI                             | PENDING | Depende de F4-3; wait total máximo 15 min                                                              |
| F4-5 / re-scan                        | PENDING | Depende de F4-4; Standard local no tip                                                                 |
| F4-6 / canário auth                   | PENDING | Depende de F4-3; diff deve ser vazio                                                                   |
| F4-7 / relatório final                | PENDING | Depende de F4-5 e F4-6                                                                                 |

## Registro de gates

| Gate             | Estado  | Evidência                                                                                                |
| ---------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| G-AMBIENTE-0     | DONE    | HEAD `10d257d9fa0a9697616cf08ba423db30c183dead`; ancestry em `339efb0`; status limpo; wip sem ref remota |
| G-AMBIENTE       | DONE    | `docs/auditoria-ambiental-2026-08-26.md`; harness PostgreSQL 17 confirmado                               |
| G-SCHEMA         | DONE    | `ai_usage`, counters, índice, checks, RLS e grants verificados no PostgreSQL local                       |
| G-IMPL           | DONE    | typecheck + inspeção de ordem/isolamento; reserva antes do gateway e settle em `finally`                 |
| G-TEST           | DONE    | `npm run db:test`: migrações/auth/tools/chat + T1–T10; T-CN reproduziu o race no baseline                |
| G-QUALITY        | DONE    | `npm run check` até build; `check:bundle` isolado PASS; `git diff --check` PASS                          |
| G-SCAN           | PENDING | F4-5                                                                                                     |
| MISSÃO-CONCLUÍDA | PENDING | F4-7                                                                                                     |

## Regras de retomada

1. Revalidar `HEAD`, worktree, ancestry da base e integridade da `wip/` antes de cada gate.
2. Se `origin/develop` divergir, aplicar D-12: re-ratificar source-to-sink antes de
   prosseguir; alteração estrutural exige parada e nova decisão.
3. Uma tarefa só passa a `DONE` após seu método de verificação e evidência serem registrados.
4. Subagent sem handoff mínimo (claim + comando + saída ou file:line) não é evidência.
5. Q humana/externa, endpoint Neon real, secrets, `src/routes/auth.tsx`, merge ou operação
   fora dos poderes interrompem a execução.

## F1-3 — evidência do schema local

- `DATABASE_ADMIN_URL=...127.0.0.1:5432... npm run db:check`: PASS (`Everything's fine`).
- `DATABASE_ADMIN_URL=...127.0.0.1:5432... npm run db:migrate`: PASS; segunda execução
  também PASS, sem erro e sem reaplicar a migration registrada.
- Consulta administrativa corrigida: `information_schema.columns` confirmou
  `tokens_reserved`, `in_flight` e os dez campos de `ai_usage`; `pg_indexes` confirmou
  `ai_usage_tenant_status_reserved_idx`; constraints confirmaram PK/FK/checks; `pg_class`
  e `pg_policies` confirmaram RLS/policy `tenant_isolation`; `has_table_privilege`
  confirmou SELECT/INSERT/UPDATE para `app_runtime`.
- Primeira tentativa de consulta administrativa falhou somente por quoting do script
  inline (`column "public" does not exist`); nenhuma alteração ocorreu e a mesma
  verificação foi repetida com delimitador correto e passou.

## F2/F3 — ledger, integração e evidência comportamental

- `src/lib/ai/budget-ledger.ts` concentra `reserveAtomic`, `settle` e `sweepOrphans`,
  com clock injetável, tenant autenticado, transações PostgreSQL, guard de status
  `reserved` e retry único seguro para falha de cliente após commit.
- `src/lib/chat.functions.ts` chama a reserva de model round antes de `modelCaller`,
  não contém SQL de `ai_usage`, `tokens_reserved` ou `in_flight`, e liquida em
  `finally` tanto em sucesso quanto em timeout, abort, erro do provedor e tool round.
- Defaults fechados em Q-005: `AI_DAILY_MODEL_CALL_LIMIT_PER_TENANT=500`,
  `AI_DAILY_TOKEN_LIMIT_PER_TENANT=1500000`, `AI_DAILY_CHAT_LIMIT_PER_TENANT=200`,
  `AI_IN_FLIGHT_LIMIT_PER_TENANT=2`, `AI_CONSERVATIVE_TOKEN_BUDGET=64000` e
  `AI_BUDGET_RESERVATION_TTL_MS=120000`. A escolha conserva o limite de chat existente
  (`AI_DAILY_CHAT_LIMIT_PER_TENANT=200`) e adiciona teto diário, concorrência 2 e
  reserva de 64k com TTL de 120s; nomes e limites são validados no código.
- Os defaults novos estão documentados no módulo e neste estado. `.env.example` foi
  deixado sem alteração para cumprir a proibição v3 sobre commits `.env*`; nenhum
  segredo foi adicionado.
- `DATABASE_DRIVER=node-postgres ... npm run db:test`: migration zero, auth/tenant,
  tools, chat e T1–T10 passaram. O runner de orçamento isolado também passou após a
  correção de lint da sanitização de valores estruturados.
- T-CN em worktree/branch local descartável, sem fix: `T-CN/E1 sem fix: FAIL conforme
esperado — gateway=20, peak=16`. Com fix, T1/E1 confirmou exatamente uma invocação
  do gateway e 19 rejeições `AI_QUOTA`.
- G-QUALITY: `npm run check` passou UI stack, ausência de Supabase, Prettier, ESLint,
  TypeScript, 25 arquivos/272 testes Vitest e build Nitro; `npm run check:bundle`
  passou (`index-C6f6_f0_.js`, 223681 minified, 68814 gzip, 59881 Brotli).

## Revisões independentes de segurança

- Schrodinger (pré-edição): handoff mínimo registrou o finding no HEAD 057 e o caminho
  antigo `callModel` antes de `recordModelUsage`, usando `git show HEAD:src/lib/chat.functions.ts`
  com linhas numeradas; sem edição, rede ou Neon.
- Hume (pós-candidato): handoff registrou reserva antes de `modelCaller`, settlement
  guardado por `usage_id/tenant_id/status='reserved'` e ausência de SQL de orçamento em
  `chat.functions.ts`; apontou a necessidade de tratar falha pós-commit, coberta pelo
  retry idempotente e pelo caso T2/E2. Sem edição, rede ou Neon.
- Noether: revisão final pós-quality gate foi encerrada após a janela bounded sem handoff
  transferível; conforme C-12, silêncio não foi tratado como aprovação, rejeição ou
  evidência. O handoff válido de Hume permanece a revisão final transferível.
