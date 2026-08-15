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
