# WS-03 — Calculation snapshots ativados (2026-09-01)

## Mudanças

- Schema (migration `drizzle/0008_workable_professor_monster.sql`): `calculation_snapshots.entity_id` nullable, `idempotency_key` (default uuid) + `UNIQUE (tenant_id, calculation_type, idempotency_key)`.
- `src/server/repositories/calculation-snapshot.repository.ts`: `append` com `onConflictDoNothing` + retorno do registro existente (replay idempotente); `listForEntity` trata `entityId = null`.
- Callers reais (chave sha256 determinística por tipo/entidade/versão do motor/inputs):
  1. `diagnostic.service.ts` — tipos `diagnostic` e `pricing`;
  2. `simulation.service.ts` — tipo `simulation`;
  3. `break-even.functions.ts` — tipo `break_even`.
- Assertions de escrita: dentro da mesma transação do request (`requireDatabaseAuth`); falha de snapshot registrada (`logJson` warn + `app.snapshot.failure_total`) sem derrubar o cálculo, exceto na simulação (obrigatório: falha propaga).

## Verificação

- `tsc`/`vitest` verdes; `scripts/db/test-migrations.ts` (migration zero → 0008, upgrade a partir de 0003 com novos downs `0007_to_0006_down.sql`/`0008_to_0007_down.sql`, RLS, cross-tenant, rollback) OK no Postgres 17 local.
- `drizzle-kit check`: "Everything's fine".
