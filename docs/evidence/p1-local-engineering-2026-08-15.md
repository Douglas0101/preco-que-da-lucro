# Evidência — Engenharia local P1 — 2026-08-15

## Base e escopo

- Base de implementação: `origin/develop` em `a1b1a4f`.
- Checkout de trabalho: `codex/neon-readiness-fresh-provision`.
- Não houve commit, rebase, amend, squash, force-push ou mutação Neon.
- O ambiente impediu criar branch nova porque `.git` está montado como somente
  leitura; as alterações ficaram no checkout atual para integração posterior.
- O worktree preexistente `.worktree-pr7-sonar/` foi preservado.

## Implementado localmente

| Área                  | Evidência                                                              | Estado                            |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| PostgreSQL major      | `ADR-023`, `EXPECTED_POSTGRES_MAJOR=17` no CI e `db:test`              | implementado                      |
| Services/Repositories | Product, Expense, Sales, Simulation e Calculation Snapshot             | implementado                      |
| Transaction Manager   | `TransactionManager`, `TransactionContext` e binding centralizado      | implementado                      |
| Schema P1             | status de produto, histórico de preços, vendas, snapshots e simulações | implementado                      |
| Tenant boundary       | FKs compostas, índices, checks, grants e RLS nas tabelas novas         | implementado na migration         |
| TanStack Query        | mutações de produto/despesa com invalidação de queries                 | implementado                      |
| Neon                  | workflow protegido e fonte Supabase opcional                           | código pronto; execução bloqueada |

## Verificações executadas

- `npm run typecheck` — aprovado.
- `npm test` — aprovado: 228 testes.
- `npm run db:check` — aprovado.
- `npm run format:check` — aprovado.
- `npm run lint` — aprovado.
- `npm run check` — aprovado, incluindo build e bundle.
- `npm run db:test` — bloqueado por `ECONNREFUSED 127.0.0.1:5432`; depende de
  PostgreSQL local/efêmero e ainda não constitui evidência Neon.

## Limites de evidência

Ainda não comprovados neste checkout:

- projeto Neon PostgreSQL 17 e branch `develop` reais;
- URLs pooled/direct retornadas pelo Neon;
- migrations, RLS, privilégios e cleanup executados numa branch Neon;
- reconciliação Supabase, `different: 0`, `sessionsImported: 0` e zero órfãos;
- backup/restore, OAuth Google, Resend, smoke remoto ou cutover.

Ausência de credencial, execução pulada ou falta de banco local é registrada
como `blocked`, nunca como `passed`.
