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
- Última atualização: `2026-08-27T00:54:17Z`.

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

| ID | Owner | Status nesta execução |
|---|---|---|
| Q-001 (A1) | HUMANO | Aberta e intocada |
| Q-002 (TAC) | EXTERNO | Aberta e intocada |
| Q-003 (merge) | HUMANO | Aberta e intocada |
| Q-004 (destino da `wip/`) | HUMANO | Aberta e intocada |
| Q-005 (defaults) | AGENTE | Pendente de F2-3, após F1-2 |
| Q-006 (validade no tip) | AGENTE | Resolvida por T-03, saída (a) |
| Q-007 (D1) | HUMANO | Resolvida por H-001; portabilidade adiada em REQ-012 |
| Q-008 (endpoint Neon) | HUMANO | Resolvida por H-003: NÃO |

## Ledger de tarefas

Status permitidos: `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `NOT_RUN`.

| Tarefa | Status | Evidência / predicado de retomada |
|---|---|---|
| T-00 / partida histórica | DONE | Log de execução preservado; worktree inicial catalogado |
| T-01 / preservação histórica | DONE | `a14fdb9` na `wip/`, não publicada |
| T-02 / SHA histórico | DONE | `origin/develop=339efb0d02db1c2b868c41d87821357d61f4b021` |
| T-03 / SPEC-RATIFICADA histórica | DONE | Diff vazio de `src/lib/chat.functions.ts`; saída (a) |
| F1-1 / branch, evidências e estado | DONE | `10d257d9fa0a9697616cf08ba423db30c183dead`; G-AMBIENTE-0 passou |
| F1-2 / auditoria ambiental C-11 | DONE | `docs/auditoria-ambiental-2026-08-26.md`; G-AMBIENTE passou |
| F1-3 / schema local | DONE | `drizzle/0006_loud_lockjaw.sql`; `db:check` passou; migration aplicada duas vezes; objetos verificados |
| F2-1 / módulo budget-ledger | IN_PROGRESS | Investigação security-boundary em andamento; implementar interface após fechar G-SCHEMA |
| F2-2 / integração no chat | PENDING | Depende de F2-1; reserva antes do gateway |
| F2-3 / configuração e observabilidade | PENDING | Depende de F2-2; fecha Q-005 |
| F3-1 / T1–T10 | PENDING | Depende de F2-3; PostgreSQL local via node-postgres |
| F3-2 / T-CN | PENDING | Depende de F3-1; branch temporário local |
| F4-1 / qualidade | PENDING | Depende de G-TEST |
| F4-2 / secrets | PENDING | Depende de F4-1 |
| F4-3 / push e PR draft | PENDING | Depende de F4-2; nunca merge |
| F4-4 / CI | PENDING | Depende de F4-3; wait total máximo 15 min |
| F4-5 / re-scan | PENDING | Depende de F4-4; Standard local no tip |
| F4-6 / canário auth | PENDING | Depende de F4-3; diff deve ser vazio |
| F4-7 / relatório final | PENDING | Depende de F4-5 e F4-6 |

## Registro de gates

| Gate | Estado | Evidência |
|---|---|---|
| G-AMBIENTE-0 | DONE | HEAD `10d257d9fa0a9697616cf08ba423db30c183dead`; ancestry em `339efb0`; status limpo; wip sem ref remota |
| G-AMBIENTE | DONE | `docs/auditoria-ambiental-2026-08-26.md`; harness PostgreSQL 17 confirmado |
| G-SCHEMA | DONE | `ai_usage`, counters, índice, checks, RLS e grants verificados no PostgreSQL local |
| G-IMPL | PENDING | F2-1/F2-2/F2-3 |
| G-TEST | PENDING | F3-1/F3-2 |
| G-QUALITY | PENDING | F4-1 |
| G-SCAN | PENDING | F4-5 |
| MISSÃO-CONCLUÍDA | PENDING | F4-7 |

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
