# Evidência — Engenharia local P1 — 2026-08-15

## Base e escopo

- PR #11 foi integrado remotamente em `develop` no merge commit
  `0ceabc265ede0480566f79e838f0ad760eb41eff`; o checkout local permanece no
  trabalho de engenharia P1, sem reescrever histórico publicado.
- Checkout: `codex/p1-local-engineering`, base local em `2df8b78`; a referência
  local `origin/develop` está stale porque `.git` é somente leitura. O SHA
  remoto acima foi confirmado antes desta execução.
- Não houve commit, rebase, amend, squash, force-push, mutação Neon ou escrita
  de produção. O worktree preexistente `.worktree-pr7-sonar/` foi preservado.

## Implementado localmente

| Área                     | Evidência                                                                            | Estado                                         |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Read model de produto    | `src/server/services/product-read-model.service.ts`; list/detail/metrics/dashboard   | implementado localmente                        |
| Histórico de preço       | `purchase-price.service.ts`, repository, BFF, upserts e IA                           | implementado localmente                        |
| Integridade de histórico | `drizzle/0004_giant_nocturne.sql`: backfill fail-fast, FKs tenant e checks           | migration preparada; execução DB bloqueada     |
| Simulações               | schema estrito, cálculo server-side, versão fixa e append-only                       | implementado localmente                        |
| Vendas                   | arredondamento por linha, limites, checks SQL, trigger deferred e runtime sem UPDATE | implementado localmente; execução DB bloqueada |
| PostgreSQL major         | ADR-023 e `EXPECTED_POSTGRES_MAJOR=17` no CI                                         | decisão registrada                             |
| Neon/migração            | workflow e fonte legada opcional                                                     | bloqueado por contas/chaves; não executado     |

## Verificações executadas

- `npm run typecheck` — aprovado.
- `npm test -- --run` — aprovado: 20 arquivos, 235 testes.
- `npm run lint` — aprovado.
- `npm run format:check` — aprovado.
- `npm run build` — aprovado.
- `npm run check:bundle` — aprovado.
- `npm run check:ui-stack` — aprovado.
- `npm run check:no-supabase-runtime` — aprovado.
- `DATABASE_ADMIN_URL=postgresql://placeholder npm run db:check` — aprovado.
- `DATABASE_ADMIN_URL=...127.0.0.1:5432... EXPECTED_POSTGRES_MAJOR=17 npm run db:test` —
  bloqueado por `ECONNREFUSED 127.0.0.1:5432`; nenhum teste de migrations/RLS foi
  classificado como passed por esse motivo.

## Limites de evidência

Ainda não comprovados neste checkout:

- migration 0004 executada e rollback validado em PostgreSQL 17 descartável;
- privilégios/RLS/FKs e trigger de vendas observados em banco vivo;
- projeto Neon PostgreSQL 17, branch `develop` e URLs pooled/direct;
- reconciliação Supabase, `different: 0`, `sessionsImported: 0` e zero órfãos;
- backup/restore, OAuth Google, Resend, smoke remoto ou cutover.

Ausência de credencial, execução pulada ou falta de banco local é registrada
como `blocked`, nunca como `passed`.
