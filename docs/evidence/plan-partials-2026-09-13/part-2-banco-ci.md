# PART-2 — Banco, CI, backfill, testes de segurança e evidência de performance

**Fonte:** auditoria read-only de 2026-09-13 sobre `develop @ 83efb16`; Plano Mestre §§27–28, 32, 35.
**Restrição descoberta:** o Drizzle calcula sha256 do conteúdo integral de cada `drizzle/*.sql`
(`node_modules/drizzle-orm/migrator.cjs:56`) e o banco guarda esse hash em `drizzle.__drizzle_migrations`
(contrato em `scripts/db/migrate.ts:14-16`) → **proibido adicionar cabeçalho de classe aos 12 SQL publicados**.

## §27a — Classificação das 12 migrations (registry sidecar + checker)

- Novos: `scripts/db/migration-classes.ts` (array tipado: tag, class, rationale, evidence, sha256, onlineCare, idempotent,
  rollback, contractOf, appliedOn) e `scripts/db/check-migration-classes.ts` (bijeção journal↔registry, recalcula sha256
  byte a byte, valida regras: DATA_MIGRATION exige idempotent+rollback; BREAKING exige contractOf).
- Classes propostas (por leitura dos arquivos): **SAFE** 0000, 0002, 0005, 0006, 0007, 0009, 0011 · **ONLINE_WITH_CARE**
  0001, 0003, 0008 · **DATA_MIGRATION** 0004, 0010 · **BREAKING** 0. Registrar `appliedOn: "empty"` (pré-dados).
- Gate: `package.json` `db:classify:check` chamado no início de `scripts/db/test-migrations.ts` e no `check`;
  `AGENTS.md` atualizado no mesmo commit. Evidência gerada `docs/evidence/migration-classification-<data>.md`.

## §27b — Política expand/contract

- Novo `docs/runbooks/migration-safety.md`: definições das 4 classes + ponteiro ao registry; 6 passos
  (add coluna → escrita dupla por coluna → backfill com checkpoint → ler nova → parar escrita antiga → contract)
  com artefato exigido por passo; rollback por passo; template copiável; enforcement só para `BREAKING` (via checker).
  Usar "escrita dupla por coluna" (evitar "dual-write", já usado para Supabase→Neon em ADR-021:9,20).
- Retroativo: 0007+0010 = exemplo expand→backfill (sem contract); 0004 = exceção autorizada (expand+backfill na mesma
  migration com preflight `migrate.ts:25-86` e fail-loud); 0008 = expand puro; 0011 = fora do eixo.
- Dívida rastreada: primeiro BREAKING real (ex.: remover `purchase_price_history.subject_id`) segue a política; abrir item no ledger.

## §28 — Backfill runner

- Novo `scripts/db/backfill.ts` (registry tipado de steps; sem SQL dinâmico de CLI; padrão `reconcile.ts`/`purge-fixtures.ts`):
  `estimateTotal`, `selectBatch(cursor, limit)` (keyset por PK), `applyBatch` (predicado auto-limitante), `countRemaining`.
- CLI: `--name`, `--batch` (500), `--sleep-ms` (50), `--max-batches`, `--apply` (default dry-run), `--reset`.
- Checkpoint: `app_private.backfill_checkpoints (name pk, cursor, processed, batches, status, started_at, updated_at, report jsonb)`
  auto-provisionada com `CREATE TABLE IF NOT EXISTS` pelo runner (executa com `DATABASE_ADMIN_URL`) — **sem** migration Drizzle
  (mantém journal 12/12; documentar a exceção no runbook).
- Robustez: `pg_advisory_lock(name)`, commit por lote, `lock_timeout`/`statement_timeout`, relatório JSON por lote +
  final (`BACKFILL_REPORT_PATH`, modo 0600).
- Wiring: `package.json` `db:backfill` + `scripts/env-guard.mjs`; testes `scripts/db/test-backfill.ts` (dry-run, retomada,
  idempotência, relatório) na cadeia `db:test`. `0010` fica como está (bounded, idempotente); `source-to-neon.ts` congelado (SUPERSEDED por custódia).

## §32 — SQL injection adversarial

- Novo `scripts/db/test-sql-injection.ts` (Postgres real; entra no `db:test`): fixtures/contexto no padrão
  `test-tool-security.ts` (admin + `set local role app_runtime` + `set_config`, cleanup em `finally`).
- Payloads: `' OR '1'='1`, `x'); DROP TABLE products; --`, `1; SELECT pg_sleep(2); --`,
  `'); UPDATE products SET name='pwned' WHERE '1'='1'; --`, `{"$ne":null}`, `%'); COPY (...) TO PROGRAM 'true'; --`.
- Caminhos: tool `create_product` (`name`) e `DrizzleProductRepository.save` sob `app_runtime`.
- **Controle positivo obrigatório** (canário em temp table com concatenação vulnerável) para provar que o payload é potente;
  asserções: linha byte a byte, tabela existe, zero `pwned`, `pg_sleep` < 1 s.
- Evidência `docs/evidence/sql-injection-<data>.md`.

## §32 — Session fixation

- Bloco novo em `scripts/db/test-auth-integration.ts`: fixture atacante (`issuer='local:credential'`, novo email em
  `TEST_EMAILS` e IP dedicado `198.51.100.45` para não colidir rate limit); login atacante → `S_A`; login vítima enviando
  `cookie: S_A` → `S_B`; assert `S_B !== S_A`, `get-session` de `S_A` → atacante, `S_B` → vítima; `set-cookie` não contém `S_A`.
- Nota no teste: Better Auth sempre cria sessão nova no login, mas **não revoga** a pré-existente; invalidação de token
  antigo é coberta pelo bloco de change-password (`:221-241`).
- Evidência `docs/evidence/session-fixation-<data>.md`.

## §35 — Template de evidência de performance

- Novo `docs/evidence/_templates/performance-evidence.md` com os 7 campos (hypothesis, metric, before, change, after,
  result, decision: keep/revert/follow-up) + ambiente/método/n/janela/fonte.
- Novo `src/test/perf-evidence.test.ts`: varre `docs/evidence/**` com nomes `perf-*.md`/`*-perf-*.md`, com allowlist do
  legado (`perf-baseline-2026-08-29.md`, `perf-after-2026-08-29.md`, `explain-critical-queries-*.md`); novos exigem os 7 rótulos.
- `docs/runbooks/performance-evidence.md` (quando é exigido) + linha no `AGENTS.md` apontando template + teste.

## Ordem

`§27a → §27b → §35 → §32 fixação → §32 SQLi → §28 runner` (1 funda o vocabulário; 3 é o único L e depende do wiring de `db:test`).
