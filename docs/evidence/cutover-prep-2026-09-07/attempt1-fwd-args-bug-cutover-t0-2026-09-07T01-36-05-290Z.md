# T-0 machine-readable — CUTOVER-PREP (2026-09-07T01:36:05.285Z)

- exit previsto: **0 (nenhum hard fail)** · hard_fail=0 · pendings_rotulados=5
- legenda: PASS · EXPECTED-PENDING (esperado pré-cutover, NÃO fail) · PENDING-ENV (falta env do dia) · DIA-D (passo do dia, proibido hoje) · FAIL (hard)

| check               | status           | detalhe                                                                                                                                                                       |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| env-guard-selftest  | PASS             | total=13 failed=0                                                                                                                                                             |
| m02-matrix-check    | PASS             | determinística e atualizada (sem drift; regen não é needed)                                                                                                                   |
| janela-freeze       | EXPECTED-PENDING | linha 'freeze ativo:' ainda não anexada ao ledger (é do humano no Manifest 5/dia-D; runbook §1) — fora de janela é ESPERADO pré-cutover, NÃO é fail                           |
| segredos-staged     | EXPECTED-PENDING | nada staged na pré-confecção do Manifest 5 (a conferência definitiva é no staging do feixe humano); gate.env ausente do repo                                                  |
| role-membership-dry | PENDING          | dry local sem resultado confiável (exit 2; container pg local em pé? npm run db:up) — rotulado, mecanismo já provado no drill da branch em role-membership-test-2026-09-07.md |
| dupla-snapshot      | PASS             | 2 dumps read-only com sha256 distintos (57e7628f7bcb… vs c1e6abd39b22…)                                                                                                       |
| rls-probe-producao  | DIA-D            | a sonda H-07 executa SOMENTE no smoke A4 (runbook §5) dentro da janela; T-0 de hoje não sonda produção                                                                        |
| gate-readiness      | EXPECTED-PENDING | exit 1 — pré-cutover, falhas de agenda (freeze/sec01/g1/snapshot-fresco) são esperadas e rotuladas                                                                            |

## Snapshot dupla

- `artifacts/snapshots/snapshot-2026-09-07-2.dump` · sha256 `57e7628f7bcb4b439fd9ba5ee2b2ea3d13b6b89aedd3e703a3b9f1bcb0f46f0b` · 120757 B · 24912 ms
- `artifacts/snapshots/snapshot-2026-09-07-3.dump` · sha256 `c1e6abd39b2290c8e6603efca8b28c441177a5f3c14ff85b0081c1903350065f` · 120757 B · 33798 ms

Verificação executada pelo script; decisões de gate do dia continuam no runbook `cutover-A4.md` §2 (este artefato é a leitura mecanizada, não um substituto).
