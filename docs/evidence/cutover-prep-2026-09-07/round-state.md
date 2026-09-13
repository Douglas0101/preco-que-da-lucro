# Round-state — CUTOVER-PREP (2026-09-07, P0)

`date -u` de abertura: **2026-09-07T01:06Z** (D0 da rodada; calendário do
programa em UTC, convenção das rodadas anteriores).

## 1. STACK_MODE

**`uncommitted`** — HEAD de `develop` ainda em **`8d26a2c`**
(`docs(program): release pre-A4 ac2e834 + A1 reconfirmado (sandbox ausente)`).
Feixe humano acumulado pendente: **V0** (Manifests 1–3 G-SEC-EXEC + ledger) +
**V6** (Manifest 4 CUTOVER-READY) + esta rodada (**Manifest 5**).

- `git log --oneline -5`: 8d26a2c · 499ae31 · 8229acd · f488bb7 · 36e2c4c.
- Working tree com modificados não commitados (env-guard wiring, package.json,
  matriz, smoke, purge, client, chat, auth) e não rastreados (scripts
  env-guard/reconcile/rls-probe/readiness/forensic, runbooks, evidências
  gsec/cutover/fase0) — exatamente os feixes V0+V4+V5 documentados nos
  manifests respectivos.
- **Risco top-1** reportado: três feixes humanos sem pouso empilham superfície
  de conflito e atrasam o deadline V2b (10/09).

## 2. Verificação SHA256SUMS (root-relative, `sha256sum -c` a partir da raiz)

| Arquivo                                       | Resultado                |
| --------------------------------------------- | ------------------------ |
| `docs/evidence/cutover-2026-09-07/SHA256SUMS` | **18/18 SUCESSO**        |
| `docs/evidence/gsec-2026-09-06/SHA256SUMS`    | 12/14 SUCESSO · 2 FALHOU |

Os 2 FALHOU do selo gsec são **deriva documentada, não achado novo**:
`scripts/env-guard.mjs` e `docs/specs/M-02/emenda-2026-09-07-env-guard.md`
foram alterados pela rodada CUTOVER-READY (emendas #2/#3, selftest
7/7→12/12) depois do selo gsec; `manifest-4.md` (linhas 25–27) registra que
o conteúdo atual da árvore é a versão final e o selo do próprio round 4
(cutover-2026-09-07/SHA256SUMS) verifica os dois arquivos **in-place com
SUCESSO** contra o estado atual.

## 3. Probe de escrita

`docs/evidence/.writeprobe` criado/removido — **OK**.

## 4. Contratos lidos (base da rodada)

- `scripts/m02-reconcile.mjs`: CLI `--source-env/--target-env/--out` por
  NOME de env; SELECT-only (`start transaction read only`+rollback); exit
  0 pass · 1 diff · 2 fail-closed; saída §13.5 + JSON companheiro; métricas
  §13.4 completas (row/null/timestamps/somas NUMERIC/órfãos/checksum ≤100
  linhas pela PK).
- Runbook `cutover-A4.md` §11 (Emenda #3): janela de freeze =
  `NEON_MIGRATION_FREEZE_START/END` ISO 8601 com `now ∈ [start,end]`,
  `NEON_MIGRATION_TARGET_KIND=cutover-window` + `ALLOW_REMOTE_DB=<motivo>`;
  fora da janela → DENY incondicional em produção (hard-deny #2 intocado).
  §1: janela do guard = janela declarada no ledger; V2b ANTES do freeze;
  §13: V2b pré-freeze com NO-GO 10/09 se inconclusa.
- `scripts/env-guard.mjs`: DENY_SET 9 scripts; SANCTIONED_REMOTE 5 ops;
  selftest 12 casos; MANAGED_KEYS = DB_ENV_VARS(4)+`ALLOW_REMOTE_DB`+
  `NEON_MIGRATION_TARGET_KIND`+`NEON_MIGRATION_FREEZE_START/END`+
  `npm_lifecycle_event` (10 chaves). Executado hoje: **12/12 pass**.
- G-SEC T1 (triagem): floor 9 = chat.functions ×4 · request-context ·
  migrate · explain-evidence · backup-verify ×2 — todos FALSO-ALARME
  by-design. **Scan selado MCP indisponível nesta sessão** → triagem manual
  dos scripts novos pelos mesmos critérios em P6 + pendência humana de
  re-selamento (não improvisar ferramenta nova).
- Precedentes de mecanismo: `restore-drill-2026-09-07.md` (pg_dump 17.11 do
  container `preco-que-da-lucro-postgres`, URLs em-processo, `--no-owner
--no-privileges`), `dryrun-notes.md` (criação de branch via `neon branches
create --expires-at`, guard drill-branch com motivo), `branch-cleanup`
  (prova antes/depois §12.5).
- Contrato de carga: `scripts/migration/source-to-neon.ts` exige
  `SUPABASE_MIGRATION_DATABASE_URL` + `DATABASE_ADMIN_URL` (hosts distintos),
  `MIGRATION_APPLY=true` para commit, `MIGRATION_ALLOW_UPSERT` só com revisão,
  relatório `MIGRATION_REPORT_PATH`.
- `scripts/rls-probe.mjs`: `--target-env [--out] [--cleanup]`; exit 0/4/2;
  seed sintético `@preco-que-da.test` com `--cleanup` no alvo produção.
- Neon (read-only): projeto `damp-forest-57346541`; branches = production
  (`br-snowy-violet-aymcvvvv`, ready) + develop (archived). **Zero branch
  efêmera remanescente** — substrato como encontrado pela rodada anterior.
  CLI `neon 3.6.0` autenticado; `pg_dump`/`psql` 17.11 só via container.
- `.env`: sem `SUPABASE_MIGRATION_DATABASE_URL` (D2 não chegou) e sem
  `DATABASE_ADMIN_URL`; `DATABASE_URL(_UNPOOLED)` = produção
  (`ep-long-violet-aye9g0bn[-pooler]`) — hazard §8 da emenda, já triado.

## 5. Decisões de mecânica desta rodada

- Evidência: `docs/evidence/cutover-prep-2026-09-07/`.
- Zero commits; produção somente ops sancionadas read-only com motivo
  (pg_dump baseline + dupla snapshot do T-0; rls-probe NÃO roda em produção
  hoje — rótulo "dia-D").
- `m02:v2b` sem credencial D2 → prova do exit 3 pré-conexão; execução real
  fica na fila humana do dia.
