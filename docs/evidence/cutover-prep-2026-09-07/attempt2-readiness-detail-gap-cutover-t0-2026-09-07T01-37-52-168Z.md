# T-0 machine-readable — CUTOVER-PREP (2026-09-07T01:37:52.165Z)

- exit previsto: **0 (nenhum hard fail)** · hard_fail=0 · pendings_rotulados=4
- legenda: PASS · EXPECTED-PENDING (esperado pré-cutover, NÃO fail) · PENDING-ENV (falta env do dia) · DIA-D (passo do dia, proibido hoje) · FAIL (hard)

| check               | status           | detalhe                                                                                                                                                 |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| env-guard-selftest  | PASS             | total=13 failed=0                                                                                                                                       |
| m02-matrix-check    | PASS             | determinística e atualizada (sem drift; regen não é needed)                                                                                             |
| janela-freeze       | EXPECTED-PENDING | linha 'freeze ativo:' ainda não anexada ao ledger (é do humano no Manifest 5/dia-D; runbook §1) — fora de janela é ESPERADO pré-cutover, NÃO é fail     |
| segredos-staged     | EXPECTED-PENDING | nada staged na pré-confecção do Manifest 5 (a conferência definitiva é no staging do feixe humano); gate.env ausente do repo                            |
| role-membership-dry | PASS             | local · before.has_set_membership=true · action="dry-run: nenhuma escrita" — grant em produção é do dia-D na janela (kind cutover-window, runbook §2.5) |
| dupla-snapshot      | PASS             | 2 dumps read-only com sha256 distintos (2c53529acfd3… vs acc232d2da51…)                                                                                 |
| rls-probe-producao  | DIA-D            | a sonda H-07 executa SOMENTE no smoke A4 (runbook §5) dentro da janela; T-0 de hoje não sonda produção                                                  |
| gate-readiness      | EXPECTED-PENDING | exit 1 — pré-cutover, falhas de agenda (freeze/sec01/g1/snapshot-fresco) são esperadas e rotuladas                                                      |

## Snapshot dupla

- `artifacts/snapshots/snapshot-2026-09-07-4.dump` · sha256 `2c53529acfd303c37c3e4abf22cc61ad0abc740010f831a0c1bc9cdb9dd99ef3` · 120757 B · 31111 ms
- `artifacts/snapshots/snapshot-2026-09-07-5.dump` · sha256 `acc232d2da51af9d9667d28a17ef43edd36602bb60f34af493f1d57ae081d835` · 120757 B · 33122 ms

Verificação executada pelo script; decisões de gate do dia continuam no runbook `cutover-A4.md` §2 (este artefato é a leitura mecanizada, não um substituto).
