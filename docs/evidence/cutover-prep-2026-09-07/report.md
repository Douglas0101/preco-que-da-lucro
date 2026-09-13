# Report — rodada CUTOVER-PREP (2026-09-07, D0) P0–P6

`date -u` de abertura: 2026-09-07T01:06Z · HEAD `8d26a2c` · zero commits do
agente · produção somente lida (ops sancionadas, §6) · branches efêmeras da
rodada deletadas com prova.

## 1. P0 — estado e empilhamento

**STACK_MODE = `uncommitted`** — HEAD ainda `8d26a2c`; V0 (Manifests 1–3),
V4 (Manifest 4) e este Manifest 5 empilhados no mesmo working tree
(`round-state.md`). Risco top-1 (§5). Selos verificados a partir da raiz:
`cutover-2026-09-07/SHA256SUMS` **18/18 SUCESSO**; `gsec-2026-09-06/SHA256SUMS`
12/14 — os 2 FALHOU (`env-guard.mjs`, emenda) são deriva **documentada** pelo
Manifest 4 (emendas #2/#3 pós-selo gsec; selo do round 4 confere os arquivos
in-place). Writeprobe OK. Contratos lidos (reconcile §12 runbook, Emenda #3,
selftest/MANAGED_KEYS): ver `round-state.md` §4.

## 2. P1–P5 — entregas com aceite

| Fase   | Entregável                                                                                                                                                                                                             | Aceite (evidência)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1** | `scripts/m02-v2b.mjs` + `.d.mts` + `src/test/m02-v2b.test.ts` (9 testes) + wiring `m02:v2b`                                                                                                                            | `npm run m02:v2b -- --plan` exit 0 sem conectar (`v2b-plan.log`); exec sem credencial **exit 3 pré-conexão** com orientação D2 e log `sockets_abertos:0` (`v2b-exec-sem-credencial.log`); execução real fica na fila (D2). Cleanup `always()` no código; retry >1 proibido no código.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **P2** | `.github/workflows/neon-pr-branch.yml`                                                                                                                                                                                 | YAML parse OK; pin-check OK (4 uses, todos SHA de 40 hex reaproveitados dos workflows existentes); fork-guard + skip gracioso rotulado sem secrets + transformação pooled **simulados localmente** (`neon-pr-branch-workflow-validation.md`); run real = 1º PR pós-merge (**pendência de CI, não da rodada**).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **P3** | `scripts/m02-role-membership.mjs` (reusa `ensureRuntimeRoleMembership` de `migrate.ts` — fonte única) + 4 testes + runbook §2.5 (v) + linha na §10                                                                     | Drill na branch `probe-membership-2026-09-07` (br-super-dawn-ayzdf306): run1 cria membership (`set_option false→true`), **run2 no-op com `diff` de estado VAZIO** (`role-membership-{run1,run2}.md/.json`, `role-membership-state-{before,mid,after}.json`, teste em `role-membership-test-2026-09-07.md`); produção conferida read-only (inalterada, `set_option=false` como no achado V3); branch deletada com prova antes/depois. GAP-TOOLING rotulado **fechado por ordem de runbook + script**.                                                                                                                                                                                                                                                                                                                                                          |
| **P4** | `scripts/m02-cutover-t0.mjs` + wiring + 2 testes                                                                                                                                                                       | **Run hoje → exit 0** com 4 PASS · 3 EXPECTED-PENDING (janela freeze "fora de janela — esperado pré-cutover", segredos "nada staged", readiness INCOMPLETE/FAIL de agenda) · 1 DIA-D (rls-probe produção) — oficial `cutover-t0-2026-09-07T01-55-17-306Z.{json,md}`; dupla snapshot **com shas distintos** (`7e2d03…` vs `cb7b9f…`) e `ALLOW_SANCTIONED` do guard logado por execução; o gate do dia enxerga os fails nomeados (`m02-state`/`g1-assinada`/`sec01-fechada`/`freeze-ativo`/`snapshot-fresco`). Duas iterações intermediárias preservadas como evidência: `attempt1-fwd-args-bug-*` (forward de args do npm sem `--`) e `attempt2-readiness-detail-gap-*` (parser de JSON em stdout com banner do npm) — ambos corrigidos e revalidados. Detalhe do readiness pré-cutover em `readiness-detalhe-2026-09-07T01-38-59Z.json` (substrate 7/7 PASS). |
| **P5** | `scripts/m02-snapshot.mjs` + `.d.mts` + 4 testes + **Emenda #4** (§10 da emenda + linha na tabela §4 + selftest 12→13 + MANAGED_KEYS +`SUPABASE_MIGRATION_DATABASE_URL` + hook `prem02:snapshot`) + baseline executado | Baseline de produção 1× válido: `artifacts/snapshots/snapshot-2026-09-07.dump` · **sha256 `85b1cc1b…5acfe` verificado com `sha256sum -c` root-relative = SUCESSO** · metadata completo (server 17.11, 120.757 B, 25,2 s, origem=production, read-only proof) — `snapshot-baseline.log` + `snapshot-baseline-guard-hook.log` (ALLOW_SANCTIONED). Attempt1 (bug de parse metadata, só artefato local) preservado. Emenda #4 **não** toca o hard-deny de `db:migrate` (selftest 13/13 prova cenários #2/#3 intactos).                                                                                                                                                                                                                                                                                                                                            |

## 3. Tabela §42 (Plano Mestre) — coluna de modos atualizada + linhas PREP

| #   | Item §42                        | Modo                                         | Estado (pós CUTOVER-READY 09-07)     | + CUTOVER-PREP (PREP: mecaniza, NÃO fecha item novo)                                                                                                                            |
| --- | ------------------------------- | -------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | migrations do zero              | mecanismo                                    | fechado (CI `db:test`)               | —                                                                                                                                                                               |
| 2   | migrations em cópia de produção | cópia                                        | fechado (dryrun 11/11)               | **[PREP-P1]** one-command `m02:v2b` (DAG + exit-3 pré-conexão)                                                                                                                  |
| 3   | schema diff revisado            | cópia                                        | fechado (8/8 EQUAL Neon×cópia)       | **[PREP-P1]** artefato `schema-diff-legacy-<data>.md` legacy×Neon sai do mesmo comando (pendente D2)                                                                            |
| 4   | tenant tests                    | cópia                                        | fechado                              | **[PREP-P2]** repetição automática por PR (branch efêmera)                                                                                                                      |
| 5   | RLS tests                       | cópia + mecanismo                            | fechado (10/10 negações + catálogo)  | **[PREP-P2]** H-07 vira check de CI por PR; **[PREP-P3]** ordem T-0 §2.5 antes do smoke                                                                                         |
| 6   | reconciliation report           | cópia · **dados PENDENTE (V2b)**             | 26/26 diffs 0 produção×cópia/restore | **[PREP-P1]** `reconciliation-legacy-<data>.md` modo DADOS no mesmo comando; paridade legacy×Neon **continua DESCONHECIDA** (dono D2) até V2b executar — redação não convertida |
| 7   | backup/restore testado          | mecanismo (RTO lower bound) + dados pendente | drill 09-07 OK                       | **[PREP-P5]** baseline datado + sha verificado + **[PREP-P4]** dupla snapshot rotulada no T-0; renovação <20/09 na agenda                                                       |
| 8   | direct e pooled configuradas    | mecanismo                                    | hazard §8 (.env→produção) aberto     | **[PREP-P2]** CI usa URI runtime da branch (nunca secret de produção)                                                                                                           |
| 9   | rollback documentado            | runbook                                      | §7 completo                          | **[PREP-P3]** ordem membership→smoke remove 42501 conhecido do caminho do dia                                                                                                   |
| 10  | smoke automatizados             | mecanismo                                    | `smoke:substrate` 7/7                | **[PREP-P4]** T-0 machine-readable (exit 0 com pendings rotulados; fail ≠ agenda → 2)                                                                                           |

Nenhuma linha de modo foi promovida a "fechado com dados" nesta rodada; V2b é
o único caminho para isso e depende de credencial humana (D2).

## 4. Manifest 5 e pré-flight

`manifest-5.md`: staging list exata, mensagem de commit sugerida, notas de
empilhamento (env-guard/emenda/runbook/package.json já pertencem a V0/V4 —
re-staging condicional), conferência de segredos do staged e pós-flight.
Pré-flight executado hoje: selftest **13/13** · unit **35/35** (6 suítes sem
DB) · typecheck 0 · eslint 0 (115 prettier corrigidos) · `m02:matrix:check`
**sem drift (sem regen)** · boundaries PASS · `state:check` VERMELHO
rotulado (esperado com V0 pendente) · secrets-audit `COMPLETE_WITH_LIMITS`,
`possible_secret_literals=[]`, review_required inalterado.

## 5. ESTADO DO SUBSTRATO + top-3 riscos

**ESTADO DO SUBSTRATO**: Tráfego inexistente. Neon production
`br-snowy-violet-aymcvvvv` (ready, fixture-free, journal 11/11,
`app_runtime` sem superuser/bypassrls, membership `set_option=false` — como
no achado V3); `develop` archived; **zero branch efêmera remanescente**
(capturas antes/depois na evidência P3). Snapshots: baseline pg_dump
07/09T01:41Z (sha `85b1cc1b…`) + dupla T-0 oficial 07/09T01:55Z
(`7e2d03…`/`cb7b9f…`); dumps das duas iterações de desenvolvimento do T-0
mantidos como artefatos locais; nativo `snap-tiny-smoke-ayc382ji` até
2026-10-10. Paridade legacy×Neon: **DESCONHECIDA** (dono humano D2; V2b não
executou — credencial ausente). Nenhum commit pousou; ledger e
EXECUTION-STATE-PROGRAM.md intactos.

**Top-3 riscos**:

1. **Feixe humano triplo acumulado** (V0 + V4 + V5 no mesmo tree não-pousado,
   HEAD `8d26a2c`): qualquer push avulso de um bloco quebra a cadeia do
   `state:check`/hooks e comprime a janela V2b (deadline 10/09). Ater os três
   em sequência hoje é a mitigação.
2. **D2/V2b**: paridade de dados continua DESCONHECIDA; sem
   `SUPABASE_MIGRATION_DATABASE_URL` até 10/09 → **NO-GO** do freeze por
   regra do runbook §13. O mecanismo está pronto em 1 comando; o risco é
   100% fila humana de credencial.
3. **Agenda do dia-D nos gates**: `m02:readiness` hoje FAIL por 5 itens de
   agenda humana (state-landing, G1 assinada, SEC-01 revogada, linha
   `freeze ativo:`, `snapshot-fresco`). Atenção mecânica: o gate
   `snapshot-fresco` só enxerga `.artifacts/backup-drill/*/dump.pgc` (gerado
   pelo `m02:backup-verify` do §2.3a do runbook) — o baseline novo de
   `m02:snapshot` **não** o alimenta por design; no dia, a dupla do §2.3 é
   backup-verify + snapshot T-0, e a linha `artifacts/snapshots` fica fora do
   gate (registrado, sem improvisar mudança no glob do gate).

## 6. Ops em produção hoje (motivos logados; todas read-only)

| Op                                                                              | Mecanismo                                                               | Log                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| pg_dump baseline ×1 válido (+1 attempt com bug de metadata local)               | `m02:snapshot` DIRECT · Emenda #4 · hook ALLOW_SANCTIONED               | `snapshot-baseline*.log`                                        |
| dupla snapshot ×2 (T-0 run1) + ×2 (run2) + ×2 (run3 oficial) + readiness detail | `m02:cutover-t0` → `m02:snapshot` (motivos "tentativa n/2" no metadata) | JSONs do T-0 (incl. `attempt1-*`/`attempt2-*`) + `.dump.sha256` |
| SELECT journal/membership na produção (estado como encontrado)                  | pg Client `start transaction read only`                                 | `role-membership-test-2026-09-07.md` §2.7                       |
| substrate-smoke via `m02:readiness` (sanctioned)                                | allowlist §4                                                            | `readiness-detalhe-*.json`                                      |

**Escritas em produção: ZERO** (nenhum DML/DDL; endpoint de produção jamais
recebeu `db:migrate` — o caminho exercitado hoje foi drill-branch não-prod).
Hard-deny de migrate em produção continua incondicional fora da janela.

## 7. Regras de condução + selado + calendário

- Zero commits do agente; nada staged (`segredos-staged` confirmou).
- Matrix sem drift → sem regen. Produção só nas ops da tabela §6.
- **Scan selado**: ferramenta MCP de selamento indisponível nesta sessão →
  triagem manual pelos critérios G-SEC T1: os 4 scripts novos não introduzem
  **classe nova** de finding ao floor 9 (sem env→fetch; SQL sempre literal ou
  com `quote()`/parâmetros; identifiers de catálogo; URLs só definem alvo de
  conexão, mesma classe by-design de `backup-verify` #5/#6 já triada).
  Potenciais novas _localizações_ da mesma classe (taint env→`pg`/`pg_dump`
  conninfo em `m02-snapshot.mjs`/`m02-v2b.mjs`) ficam **registradas** aqui —
  triáveis pelos mesmos critérios, sem improvisar fix. Re-selamento pelo
  humano/ferramenta quando disponível = item de fila.
- **Calendário recomputado (desde 07/09 01:50Z)**:

| Data       | Marco                                                                                                                                                                                                          | Estado                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 07/09 (D0) | CUTOVER-PREP (esta rodada)                                                                                                                                                                                     | ✅ mecânica pronta         |
| 07–09/09   | **Humanos**: pousar V0→V4→V5 em sequência; CI verde; renovação snapshot nativo **antes de 20/09** já coberta por baseline de hoje (pg_dump) + drill backup-verify no dia                                       | fila                       |
| 10/09      | **deadline V2b**: D2 credencial → `npm run m02:v2b` (1 comando) — NO-GO se inconclusa                                                                                                                          | fila crítica               |
| 10–11/09   | hPanel 11/11 (runbook `hpanel-homologacao.md`)                                                                                                                                                                 | humano                     |
| 11–12/09   | **Cutover A4**: linha `freeze ativo:` + janela; `m02:cutover-t0` completo (ADMIN URL) → §2.5 membership (janela, kind cutover-window) → `db:migrate` (Emenda #3) → smoke §5 com H-07 `--cleanup` → carimbos §9 | humano com mecânica pronta |
| 20/09      | sunset G1 (M02-D-008) + janela de refresh de snapshot                                                                                                                                                          | agenda                     |
| 06/10      | WARN-NITRO-001 expiresOn (build.mjs)                                                                                                                                                                           | monitorar                  |

**Fila humana explícita** (ordem): (1) pousar V0+V6/V4 com CI verde;
(2) executar Manifest 5 (com a nota de empilhamento); (3) D2 → credencial →
`npm run m02:v2b` e triagem dos artefatos legacy; (4) hPanel 10–11/09;
(5) cutover 11–12/09 via runbook com T-0 mecânico (janela do guard = linha do
ledger; nunca contornar com invocação direta — regra V1).
