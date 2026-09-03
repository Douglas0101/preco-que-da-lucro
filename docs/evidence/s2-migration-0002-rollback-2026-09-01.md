# Evidência S2 — Rollback da migration 0002 (rate_limits) — 2026-09-01

Agente: A2 (step S2). Escopo: fechar a lacuna de down `0002_to_0001` na cadeia
`drizzle/` 0000→0009 e cobri-la em `scripts/db/test-migrations.ts`, com prova em
banco scratch. Nenhuma execução contra `preco_que_da_lucro_test` foi feita.

## 1. Auditoria da cadeia 0000→0009 (up × down)

| Migration (up)                        | Down em `drizzle/rollback/` | Cobertura   | Classe §27/§19.2 (0002)   |
| ------------------------------------- | --------------------------- | ----------- | ------------------------- |
| `0000_p0_postgres_foundation.sql`     | — (baseline, por definição) | ok          | —                         |
| `0001_p0_runtime_role_and_rls.sql`    | `0001_to_0000_down.sql`     | ok          | —                         |
| `0002_rate_limit_database.sql`        | **ausente → criado aqui**   | **fechado** | up: `SAFE` / down: `SAFE` |
| `0003_curvy_firebrand.sql`            | `0003_to_0002_down.sql`     | ok          | —                         |
| `0004_giant_nocturne.sql`             | `0004_to_0003_down.sql`     | ok          | —                         |
| `0005_ai_tool_call_count.sql`         | `0005_to_0004_down.sql`     | ok          | —                         |
| `0006_loud_lockjaw.sql`               | `0006_to_0005_down.sql`     | ok          | —                         |
| `0007_add_accounts_issuer.sql`        | `0007_to_0006_down.sql`     | ok          | —                         |
| `0008_workable_professor_monster.sql` | `0008_to_0007_down.sql`     | ok          | —                         |
| `0009_military_gertrude_yorkes.sql`   | `0009_to_0008_down.sql`     | ok          | —                         |

Conclusão: **0002 era a única lacuna** de down na cadeia (0000 é baseline e
`0001_to_0000_down.sql` cobre 0001). Não há dependentes de `rate_limits`: nenhum
SQL posterior (0003–0009) referencia a tabela (`grep` vazio) e, no código, apenas
`src/db/schema.ts` a usa via runtime role. Sem RLS/policies; os grants de 0002
são `REVOKE ... FROM PUBLIC` + `GRANT SELECT/INSERT/UPDATE/DELETE TO app_runtime`.

## 2. Classificação §27 (tabelas de classes em DIRETRIZ §19.2)

- **0002 up — `SAFE`**: apenas criação de tabela (`rate_limits`), índices e
  grants; não altera objetos existentes nem converte dados.
- **0002 down — `SAFE`**: remoção de tabela sem dependentes fora dos grants de
  `PUBLIC`/`app_runtime` da própria 0002. Os índices `rate_limits_key_uidx` e
  `rate_limits_last_request_idx` caem junto com o `DROP TABLE ... CASCADE`.

## 3. O que foi adicionado

### 3.1 `drizzle/rollback/0002_to_0001_down.sql` (novo)

```sql
DO $revoke_runtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime')
     AND to_regclass('public.rate_limits') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.rate_limits FROM app_runtime';
  END IF;
END
$revoke_runtime$;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
```

Desvio documentado do rascunho da tarefa: `REVOKE ALL ON TABLE IF EXISTS ...`
**não é sintaxe válida no PostgreSQL** — verificado no servidor em uso
(PostgreSQL 17.11): `ERROR: syntax error at or near "EXISTS"`. O guard `IF
EXISTS` do REVOKE foi implementado via bloco `DO` com `to_regclass` (mesmo
padrão do `DO $drop_runtime$` em `0001_to_0000_down.sql`), preservando a
simetria REVOKE-antes-do-DROP e a idempotência.

### 3.2 `scripts/db/test-migrations.ts`

- `rollbackTo0003` refatorado sobre o novo `applyDowns(client, downFiles)`
  (linhas ~560–585): aplica N arquivos down e delete **exatamente N** entradas
  do journal (`limit ${downFiles.length}`), com a lista compartilhada
  `DOWNS_0009_TO_0003` (6 arquivos) — contagem idêntica ao código anterior.
- Novo `assertDowngrade0002To0001AndReplay(adminUrl, client)` (~linhas 678–762),
  chamado em `main()` **depois** de `assertUpgradeFrom0003` (chain 0000–0009
  totalmente aplicada, journal com 10 linhas): aplica `DOWNS_0009_TO_0003` +
  `0003_to_0002_down.sql` + `0002_to_0001_down.sql` (8 arquivos = 8 linhas
  deletadas do journal),asserta journal = 2 e
  `to_regclass('public.rate_limits') IS NULL` (também sales/purchase_price_history
  nulas, confirmando a descida até 0001); re-aplica o down de 0002 (prova de
  idempotência dos guards); `runMigrations` replay (0002 e 0003 reprodutíveis);
  asserta journal = 10, `rate_limits` recriada **vazia**, grants idênticos a
  0002 (`app_runtime` SELECT/INSERT/UPDATE/DELETE = true, PUBLIC SELECT = false)
  e funcionalidade real via `withRuntimeCommit` (INSERT ON CONFLICT + DELETE
  como `app_runtime`).
- Flag `SKIP_FINAL_ROLLBACK=1` (~linhas 776–788): envolve o bloco de rollback
  final `0001→0000` — que dá `DROP ROLE app_runtime` (objeto **global** do
  cluster e quebraria outros databases do mesmo servidor). Em banco de prova
  isolado usa-se a flag; no fluxo padrão (`npm run db:test`, test DB dedicada)
  o passo permanece intacto.

## 4. Prova em banco SCRATCH (nunca em `preco_que_da_lucro_test`)

Ambiente: container `preco-que-da-lucro-postgres`, PostgreSQL 17.11.

1. Criação: `DROP DATABASE IF EXISTS s2_verify WITH (FORCE); CREATE DATABASE s2_verify;`
2. Migração: `DATABASE_ADMIN_URL=.../s2_verify DATABASE_DRIVER=node-postgres npx tsx scripts/db/migrate.ts`
   → `Migrations PostgreSQL aplicadas com sucesso.`
3. Down 0002 direto via psql (`ON_ERROR_STOP=1`), primeira aplicação:

   ```text
   DO
   DROP TABLE
   select to_regclass('public.rate_limits');  →  (null)
   ```

   segunda aplicação (guards):

   ```text
   DO
   NOTICE:  table "rate_limits" does not exist, skipping
   DROP TABLE
   ```

4. Suíte estendida completa no scratch:
   `DATABASE_ADMIN_URL=.../s2_verify DATABASE_DRIVER=node-postgres SKIP_FINAL_ROLLBACK=1 npx tsx scripts/db/test-migrations.ts`

   ```text
   PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
   ```

   (inclui `assertUpgradeFrom0003` e o novo `assertDowngrade0002To0001AndReplay`)

5. Estado pós-teste no scratch (replay íntegro):

   ```text
   journal count                                  → 10
   to_regclass('public.rate_limits') is not null  → t
   rows em rate_limits (probe limpo)              → 0
   grants app_runtime na rate_limits              → DELETE,INSERT,SELECT,UPDATE
   ```

6. Limpeza: `DROP DATABASE IF EXISTS s2_verify WITH (FORCE);` → `DROP DATABASE`

`tsc --noEmit -p tsconfig.json`: limpo. Prettier aplicado a
`scripts/db/test-migrations.ts` (arquivos `.sql` não têm parser no prettier do
projeto, consistente com os demais rollback).

## 5. Conclusão

`drizzle/rollback/0002_to_0001_down.sql` restaura a **reprodutibilidade
INV-012** no eixo descendente da cadeia 0000→0009: hoje a suíte consegue
descer até 0001 e voltar, com o replay de 0002/0003 validado em banco scratch
isolado. A cobertura de down passa a ser 100% para todas as migrations
forward publicadas (0001–0009).
