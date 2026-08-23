# Evidência — Triagem de follow-ups do PR #12 — 2026-08-15

## Escopo

O PR #12 está integrado em `develop` no merge commit `a03d29d`. A triagem foi
somente leitura; não houve resposta, resolução de thread ou alteração de código.

## Cinco follow-ups de backlog registrados no corpo do PR

1. Tornar o dedupe do histórico seguro contra corrida; hoje há
   `SELECT`-then-`INSERT` sem constraint única.
2. Reavaliar `recorded_at`, atualmente igual a `valid_from`, para usar o
   default `now()` quando essa for a semântica desejada.
3. Decidir o destino do status `active`, que permanece inalcançável sem fluxo
   de ativação: endpoint de ativação ou remoção do enum.
4. Reavaliar o trigger de vendas `FOR EACH ROW` somente se importações em lote
   forem introduzidas.
5. Adicionar teste unitário específico para dedupe do histórico, além da
   cobertura existente em `db:test`/CI.

## Threads inline ainda pendentes

- [Backfill de totais legados](https://github.com/Douglas0101/preco-que-da-lucro/pull/12#discussion_r3789716569), em `drizzle/0004_giant_nocturne.sql:47`.
- [Semântica de exclusão dos filhos com histórico](https://github.com/Douglas0101/preco-que-da-lucro/pull/12#discussion_r3789716571), em `drizzle/0004_giant_nocturne.sql:31-32`.

Os cinco itens de backlog não são cinco threads de review. A implementação fica
para uma próxima branch focada, depois da análise de risco e dos testes de cada
item.

## Implementação da branch `codex/pr12-followups-hardening`

Esta branch parte de `develop` em `10e1db74ca69f4c6a85cd885a8eb26d25a5ade49` e
implementa os follow-ups sem alterar histórico publicado:

1. O dedupe de histórico agora serializa transações por tenant, tipo e sujeito
   com `pg_advisory_xact_lock`; duas gravações simultâneas do mesmo valor
   retornam uma única linha.
2. `recorded_at` deixou de receber `valid_from` no repository e usa o
   `DEFAULT now()` do PostgreSQL.
3. `active` permanece no schema como estado reservado; não há endpoint de
   ativação nem promoção implícita.
4. O trigger de vendas permanece `FOR EACH ROW`, sem importação em lote que
   justifique mudança.
5. O runner de migrations executa um preflight idempotente que recalcula
   `sales_items.total_amount` a partir de quantidade e preço canônicos antes de
   aplicar o check aritmético do `0004`, preservando o hash da migration já
   publicada.

As duas threads inline foram tratadas por contrato: o backfill legado ocorre
antes da validação, e os vínculos de histórico permanecem `ON DELETE RESTRICT`
para impedir perda de auditoria. A violação de FK agora é exposta como
`CONFLICT`, em vez de erro genérico, e o teste de banco comprova ingrediente e
embalagem protegidos, referência cross-tenant inválida e preservação do
histórico.

## Validação da branch

- `npm run db:test`: PostgreSQL 17, migrations do zero, upgrade real
  `0003 -> 0004` com preflight, backfill legado, abort de órfão, RLS, cross-tenant, rollback,
  Better Auth, tools, chat, `recorded_at`, exclusão restrita e concorrência do
  histórico — passou.
- `npm run db:check`, format, lint, typecheck e `npm run test`: passaram; 236
  testes unitários.
- `npm run build` e `npm run check:bundle`: passaram.
- `npm run test:e2e`: 32/32 em Chromium, Firefox, WebKit e mobile Pixel 7.
  A execução final usou `127.0.0.1:4174` para não reutilizar o preview de outro
  worktree em `4173`; o sandbox exige permissão local para bind.

Neon, OAuth Google e Resend continuam bloqueados por credenciais externas.
Nenhuma execução `skipped` de Neon foi promovida a evidência de migration,
reconciliação ou cutover.
