# Classificação das migrations — 2026-09-13

- Journal canônico: `drizzle/meta/_journal.json`
- sha256 do journal: `4e4050238c0421f5031ed44154a95ffc631b73a4cc1e46b9641ada5507972863`
- Registry: `scripts/db/migration-classes.ts`
- Checker: `npx tsx scripts/db/check-migration-classes.ts` — exit 0
- Resultado: **12/12 classificadas** (sha256 byte a byte)

## Visão geral

```text
idx  tag                              classe            appliedOn  sha256
0    0000_p0_postgres_foundation      SAFE              empty      952004d7ccebd5af1c3064a350d1a2cd322c2911728b7ae6a2d239df68641743
1    0001_p0_runtime_role_and_rls     ONLINE_WITH_CARE  empty      c1bf8f25a7534f9ec154c3844da8a7000d329d8a2170d1ecd5978fe1029eaf16
2    0002_rate_limit_database         SAFE              empty      d730f0fbb9a54d4a4f09b11526540d6f11fb0d0ea734fa699fc998b2940e8ff6
3    0003_curvy_firebrand             ONLINE_WITH_CARE  empty      c524ddbd26ace10b17fcb9fba7a78162f66779874b05f2fdcfc326c42c7e38ec
4    0004_giant_nocturne              DATA_MIGRATION    empty      1517e6f4684aa87137d16bb6f5e81b18c0bd651210f4a454ecfea8f502258570
5    0005_ai_tool_call_count          SAFE              empty      7a6495ce7e9d39ffa368efbab48031e7e2ed7cb71babd064740ca348081d4ead
6    0006_loud_lockjaw                SAFE              empty      51f32b321436a83c666229ea850e9e8fc851b915e7c37774167d81a5508b0dcb
7    0007_add_accounts_issuer         SAFE              empty      db08871dbb49d16be1de994fc1963e26661dced76e768e9488ee031772610e5e
8    0008_workable_professor_monster  ONLINE_WITH_CARE  empty      a8ca9a022686b5f1b8fff0aef3725fa2a3f0fa190ee310148a9d2cfa4fcc8e0b
9    0009_military_gertrude_yorkes    SAFE              empty      e544600a73dc01c4cc32f61c7be12ad67aeb3785272685c77512317af5d6d734
10   0010_backfill_accounts_issuer    DATA_MIGRATION    empty      5bbe63899706fb8be6ef8777b099db1bcdd120fa02fc539ca69ba6e85349b605
11   0011_auth_rls_normalization      SAFE              empty      6c9d62a66e40edfb53e6f1eb2be1d0195390192ab75ea17af0ac87f897138fef
```

## Detalhes

### 0000_p0_postgres_foundation — SAFE (appliedOn: empty)

- Motivo: Fundação do schema sobre banco vazio: apenas CREATE TABLE/INDEX/FK/CHECK, sem DML e sem
  alteração de objetos pré-existentes.
- Evidência: drizzle/0000_p0_postgres_foundation.sql; scripts/db/test-migrations.ts (replay do chain
  0002→0011)
- Rollback: n/a — baseline do chain; recriar o banco a partir do zero

### 0001_p0_runtime_role_and_rls — ONLINE_WITH_CARE (appliedOn: empty)

- Motivo: Cria a role global app_runtime, schema app_private, funções SECURITY DEFINER e as
  políticas RLS base; a role é compartilhada entre databases do mesmo servidor.
- Evidência: drizzle/0001_p0_runtime_role_and_rls.sql; scripts/db/test-migrations.ts (atributos da
  role, grants, RLS e funções); drizzle/rollback/0001_to_0000_down.sql
- Rollback: drizzle/rollback/0001_to_0000_down.sql
- Cuidado online: Aplicar fora do pico: CREATE/ALTER ROLE e REVOKE/GRANT tomam locks globais curtos;
  o down derruba as tabelas e, pós-tráfego, o rollback é restore de snapshot.

### 0002_rate_limit_database — SAFE (appliedOn: empty)

- Motivo: Cria a tabela rate_limits e seus grants/índices; nenhum DML sobre dados existentes.
- Evidência: drizzle/0002_rate_limit_database.sql; scripts/db/test-migrations.ts (replay e grants de
  rate_limits)
- Rollback: drizzle/rollback/0002_to_0001_down.sql

### 0003_curvy_firebrand — ONLINE_WITH_CARE (appliedOn: empty)

- Motivo: Cria as tabelas P1 e usa ADD COLUMN NOT NULL DEFAULT em products/simulations
  (metadata-only no PG17) com grants/RLS para as novas tabelas.
- Evidência: drizzle/0003_curvy_firebrand.sql; scripts/db/test-migrations.ts (colunas P1 e rollback
  0003→0002)
- Rollback: drizzle/rollback/0003_to_0002_down.sql
- Cuidado online: Aplicar fora do pico: os ALTER TABLE pegam ACCESS EXCLUSIVE breve por tabela; o
  down 0003→0002 remove as tabelas P1 e não preserva dados.

### 0004_giant_nocturne — DATA_MIGRATION (appliedOn: empty)

- Motivo: Expande purchase_price_history (ingredient_id/packaging_id), converte o discriminador
  legado por UPDATE absoluto e só então adiciona FKs/CHECK; o preflight aborta fail-loud quando há
  órfão.
- Evidência: drizzle/0004_giant_nocturne.sql; scripts/db/migrate.ts:25-86 (preflight fail-loud antes
  do migrator); scripts/db/test-migrations.ts (assertUpgradeFrom0003: reconciliação e aborto por
  órfão)
- Rollback: drizzle/rollback/0004_to_0003_down.sql
- Idempotente: sim

### 0005_ai_tool_call_count — SAFE (appliedOn: empty)

- Motivo: Adiciona tool_call_count (NOT NULL DEFAULT 0, metadata-only) e recria o CHECK de
  ai_daily_budgets com a variante final; sem DML próprio.
- Evidência: drizzle/0005_ai_tool_call_count.sql; scripts/db/test-migrations.ts (replay do chain)
- Rollback: drizzle/rollback/0005_to_0004_down.sql

### 0006_loud_lockjaw — SAFE (appliedOn: empty)

- Motivo: Cria ai_usage e adiciona colunas com default constante em ai_daily_budgets, com grants/RLS
  para a nova tabela; aditiva, sem DML.
- Evidência: drizzle/0006_loud_lockjaw.sql; scripts/db/test-migrations.ts (replay do chain)
- Rollback: drizzle/rollback/0006_to_0005_down.sql

### 0007_add_accounts_issuer — SAFE (appliedOn: empty)

- Motivo: Passo expand do par 0007+0010: adiciona accounts.issuer nullable com IF NOT EXISTS, sem
  tocar dados existentes.
- Evidência: drizzle/0007_add_accounts_issuer.sql; docs/runbooks/migration-safety.md (retroativo
  expand→backfill 0007+0010)
- Rollback: drizzle/rollback/0007_to_0006_down.sql
- Idempotente: sim

### 0008_workable_professor_monster — ONLINE_WITH_CARE (appliedOn: empty)

- Motivo: Faz DROP NOT NULL em calculation_snapshots.entity_id, adiciona colunas em
  ai_usage/chat_conversations/tool_executions, recria o CHECK de ai_daily_budgets e cria índice
  único de idempotência.
- Evidência: drizzle/0008_workable_professor_monster.sql; drizzle/rollback/0008_to_0007_down.sql;
  scripts/db/test-migrations.ts (replay do chain)
- Rollback: drizzle/rollback/0008_to_0007_down.sql
- Cuidado online: Aplicar fora do pico: cada ALTER TABLE pega ACCESS EXCLUSIVE breve; a validação do
  CHECK recriado escaneia ai_daily_budgets; o DROP NOT NULL não reescreve a tabela.

### 0009_military_gertrude_yorkes — SAFE (appliedOn: empty)

- Motivo: Expand puro: adiciona ai_usage.tool_execution_id uuid nullable, sem constraint, índice ou
  DML.
- Evidência: drizzle/0009_military_gertrude_yorkes.sql; scripts/db/test-migrations.ts (replay do
  chain)
- Rollback: drizzle/rollback/0009_to_0008_down.sql

### 0010_backfill_accounts_issuer — DATA_MIGRATION (appliedOn: empty)

- Motivo: Backfill bounded e idempotente: seta issuer='local:credential' apenas onde
  provider_id='credential' AND issuer IS NULL, sem sobrescrever valor gravado por 1.7.x.
- Evidência: drizzle/0010_backfill_accounts_issuer.sql; drizzle/rollback/0010_to_0009_down.sql
  (guarda fail-closed; pós-tráfego o rollback é restore de snapshot); scripts/db/test-migrations.ts
  (replay do chain)
- Rollback: drizzle/rollback/0010_to_0009_down.sql
- Idempotente: sim

### 0011_auth_rls_normalization — SAFE (appliedOn: empty)

- Motivo: Normalização idempotente de RLS: habilita RLS com guards e cria auth_service_access (FOR
  ALL para app_runtime) nas cinco tabelas de auth; aditiva e sem DML de dados.
- Evidência: drizzle/0011_auth_rls_normalization.sql; docs/evidence/cp1-auth-rls-2026-09-10/;
  scripts/db/test-migrations.ts (bloco auth RLS em assertDatabaseContract)
- Rollback: drizzle/rollback/0011_to_0010_down.sql
- Idempotente: sim
