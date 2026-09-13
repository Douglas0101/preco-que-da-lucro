# Manifest 4 — feixe CUTOVER-READY V1–V5 (commit único, HUMANO)

Pré-requisito: **V0 já pousado** (Manifests 1–3 do G-SEC-EXEC + ledger; HEAD
parent para o marcador abaixo). Nenhum commit pelo agente (gate floor 9).
Branches efêmeras já deletadas com prova (`branch-cleanup-2026-09-07.md`).

## Staging list (arquivos exatos)

| Arquivo                                                                           | Estado                                                                                   | Origem                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------ |
| `scripts/m02-reconcile.mjs`                                                       | novo                                                                                     | V2 (script-âncora §13.4/§13.5) |
| `scripts/rls-probe.mjs`                                                           | novo                                                                                     | V3 (sonda H-07)                |
| `docs/runbooks/cutover-A4.md`                                                     | novo                                                                                     | V5 (13 seções)                 |
| `docs/evidence/cutover-2026-09-07/env-guard-drill.md`                             | novo                                                                                     | V1                             |
| `docs/evidence/cutover-2026-09-07/dryrun-notes.md`                                | novo                                                                                     | V2                             |
| `docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.md` + `.json`  | novo                                                                                     | V2                             |
| `docs/evidence/cutover-2026-09-07/schema-diff-2026-09-07.md`                      | novo                                                                                     | V2                             |
| `docs/evidence/cutover-2026-09-07/restore-drill-2026-09-07.md`                    | novo                                                                                     | V4                             |
| `docs/evidence/cutover-2026-09-07/reconciliation-restore-2026-09-07.md` + `.json` | novo                                                                                     | V4                             |
| `docs/evidence/cutover-2026-09-07/rls-probe-2026-09-07.md` + `.json`              | novo                                                                                     | V3                             |
| `docs/evidence/cutover-2026-09-07/branch-cleanup-2026-09-07.md`                   | novo                                                                                     | fechamento                     |
| `docs/evidence/cutover-2026-09-07/manifest-4.md`, `evidence.json`, `SHA256SUMS`   | novo                                                                                     | fechamento                     |
| `package.json`                                                                    | modificado (entradas inertes `m02:reconcile`, `m02:rls-probe`, `m02:env-guard-selftest`) | V6 wiring                      |

Nota: `scripts/env-guard.mjs` e `docs/specs/M-02/emenda-2026-09-07-env-guard.md`
(emendas #2/#3, selftest 12/12) **já entram pelo Manifest 1 do V0** — o conteúdo
atual da árvore é a versão final. `docs/specs/M-02/matrix*.yaml` só entram se
`npm run m02:matrix:check` acusar drift no pré-flight.

## Pré-flight (nesta ordem; tudo deve passar)

```
npm run m02:env-guard-selftest        # 12/12 (re-roda pós-merge: CI valida código commitado, não working tree)
npx vitest run src/test/ai-endpoint.server.test.ts src/test/auth-policy.test.ts   # unit sem DB (npx direto = gap documentado; suítes com DB ficam para o CI isolado)
npm run m02:matrix:check              # regen (m02:matrix:generate) SOMENTE se acusar drift
npm run m02:boundaries                # PASS
npm run m02:state:check               # VERDE pós-V0 (fallback: hash real à mão + amend)
npm run m02:secrets-audit             # COMPLETE_WITH_LIMITS, sem chaves novas
```

Interino E0.5 SUPERADO para suites: com o ENV-GUARD wired, `npm run test` com
`.env` de produção agora é **NEGADO pelo pretest** (fail-closed); a suite
completa roda no CI (banco isolado) e localmente só após o split do `.env`.

## Commit único (Mensagem 4)

```
git add scripts/m02-reconcile.mjs scripts/rls-probe.mjs docs/runbooks/cutover-A4.md docs/evidence/cutover-2026-09-07 package.json
git commit -m "feat(cutover): §42 fechado em modos (cópia/mecanismo) — reconcile+rls-probe+restore-drill+runbook A4+env-guard emendas #2/#3 (CUTOVER-READY V1-V5)"
```

## Ledger — bloco parent-pinned (ÚLTIMO commit)

```
PARENT=$(git rev-parse HEAD)
cat >> EXECUTION-STATE-PROGRAM.md <<EOF

## CUTOVER-READY — gate §42 fechado em modos + runbook A4 + guards de migração (2026-09-07)

- Latest state marker parent = \`__PARENT_SHA__\`
- §42 (Plano Mestre): migrations-em-cópia (branch dryrun, journal 11/11) · schema diff
  (8/8 EQUAL, diff vazio) · tenant/RLS tests (rls-probe 10/10 negações bidirecionais como
  app_runtime, catálogo rolbypassrls=false/owner≠runtime) · reconciliation (26/26, 0 diff)
  · backup/restore (mecanismo: dump→restore→reconcile, RTO ~5 min lower bound) · rollback
  §13.7 completo (runbook cutover-A4.md) — MODOS: cópia/mecanismo; legacy-pendente (V2b,
  NO-GO 10/09 se inconcluso). Paridade legacy×Neon: DESCONHECIDA, dono humano (D2);
  MEDIDA-EM-CÓPIA somente após V2b.
- ENV-GUARD: emenda #2 (drill-branch sancionado, produção hard-deny) + emenda #3
  (cutover-window time-boxed = único caminho de migration em produção; janela do guard =
  janela de freeze do ledger). Selftest 12/12.
- Runbook: docs/runbooks/cutover-A4.md (T-0 → T+, smoke tolerante a cold start ~2,2 s,
  freeze declarado abaixo).
- freeze ativo: deploys congelados da janela A4→B3 (exceção única: hotfix de segurança),
  declarada 2026-09-07 — M02-D-009
- Branches efêmeras deletadas com prova §12.5 (dryrun-2026-09-07, restore-2026-09-07);
  produção intacta, fixture-free, read-only exceto ops sancionadas.
- Evidência: docs/evidence/cutover-2026-09-07/ (drill, dryrun-notes, reconciliations,
  schema-diff, restore-drill, rls-probe, branch-cleanup).
- ESTADO DO SUBSTRATO: Tráfego inexistente; Neon fixture-free, snapshot até 2026-10-10;
  Paridade DESCONHECIDA (dono humano D2 — MEDIDA-EM-CÓPIA após V2b); Blockers SEC-01,
  BAK-01, G1/G2, hPanel, Sonar main neutral.
EOF
sed -i "s/__PARENT_SHA__/$PARENT/" EXECUTION-STATE-PROGRAM.md
git add EXECUTION-STATE-PROGRAM.md
git commit -m "chore(ledger): CUTOVER-READY §42 em modos + freeze (2026-09-07)"
```

## Pós-flight

```
npm run m02:state:check     # VERDE
npm run m02:env-guard-selftest  # 12/12 no código commitado
git push origin develop     # CI verde no tip
sha256sum -c docs/evidence/cutover-2026-09-07/SHA256SUMS
```
