# Relatório curto — RAT S0 executivo S1→C-03 (2026-09-07, sem commit)

Ordem: RAT S0 ASSINADO + §0.2 OK + D-INF respondidas + DP5=(b). Bundle:
`docs/evidence/pós-rat-2026-09-07/`.

## S1 — produtor/consumidor DP5=(b) → PS-S1 EMITIDO

- Produtor (`m02-snapshot.mjs` + `.d.mts`): modo explícito trio
  `dump.pgc`+`.sha256`+`metadata.json` (N-6); trio pré-existente exit 2
  pré-conexão; motivo + anti-pooler nos 2 modos (exit 3); sucesso só
  pós-hash; default INALTERADO. 5 grupos de teste com prova de zero
  socket (`stdout` sem `"event":"start"` nas recusas).
- Consumidor (`m02-readiness.mjs` + `.d.mts` novo): `evaluateSnapshotDir`/
  `checkSnapshotFromRoot` exportados; glob literal preservado; frescor por
  `created_at`; `statSync` removido do caminho; futuro/divergente/
  incompleto nunca PASS; sem dump = DESCONHECIDO; `main()` sob guarda
  (import não dispara gates). 11 casos N-5/N-6 (tmpdir + relógio fixo).
- Testes: 21/21 focados; suíte completa **412/412 em 43 arquivos**;
  `m02:env-guard-selftest` **13/13** (count inalterado).
- Docs do escopo: Emenda #6 datada (`## 11.`, RAT S0), runbook §2.3(a) em
  seis passos, retificação da fundação OP-C (iii-a).

## C-02 — seis passos → STOP em 4/6 (sem PS-S5)

| Passo                                                                       | Resultado                                                                                                                              |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. snapshot trio                                                            | exit 0 · 121.790 B · sha `7611425d…` · `created_at` 18:28:18Z · DIRECT · motivo logado                                                 |
| 2. restore `restore-2026-09-07-c02` (`br-tiny-dust-ayng3ajh`, drill-branch) | ready; reset public/drizzle só na efêmera; `pg_restore` exit 1 padrão plataforma (39 linhas conhecidas, 0 em `public`); 26 tabelas     |
| 3. reconcile origem×restore                                                 | exit 0 · **26/26 diff 0 pass=true** (financeiro zero)                                                                                  |
| 4. backup-verify                                                            | **exit 1 → STOP**: `comparison FAIL ["catalog"]` (178 `grants` só-origem, artefato `--no-privileges`); `journal 11/11 PASS`; sem retry |
| 5. cleanup `always()`                                                       | delete + prova: só production+develop restantes                                                                                        |
| 6. gate `snapshot-fresco`                                                   | **PASS** (trio 0.1h por `created_at`); readiness geral FAIL só na agenda humana conhecida                                              |

Produção: zero escritas (só `pg_dump` read-only + SELECTs). Efêmeras: zero.

## C-03 — veredito duplo → PS-S6 (selo de parada)

- Compensatório: NÃO COMPROVADO neste drill (mecanismo+dados provados;
  comparador estrito aponta causa isolada). Retomada: (a) aceitar-com-causa
  - reparo de grants no runbook, ou (b) re-drill com privilégios.
- PITR: VIOLAÇÃO ABERTA (6h; upgrade existe, não contratado).
- N-10 verbatim no ledger (working tree, sem commit) + `C-03-veredito.md`.

## Selos e selagem

- **PS-S1 EMITIDO** (S1). **PS-S5 BLOQUEADO** (stop passo 4; não emitido).
  **PS-S6 EMITIDO** como selo de parada (não aprova sucesso).
- `m02:sums` regen+verify: **9 bundles PASS** (gsec RED-LABELED rotulado);
  `sha256sum -c` do bundle pós-rat: 6/6 SUCESSO. Matrix sem drift (sem regen).

## Diff só-nomes (working tree, sem commit)

M `EXECUTION-STATE-PROGRAM.md` (cláusula N-10); novos:
`docs/evidence/pós-rat-2026-09-07/` (7 arquivos),
`docs/evidence/sdd-continuacao-2026-09-07/01-op-c-01-reescrito.md` (retificação),
`docs/runbooks/cutover-A4.md` (§2.3 seis passos),
`docs/specs/M-02/emenda-2026-09-07-env-guard.md` (Emenda #6),
`scripts/m02-readiness.{mjs,d.mts}`, `scripts/m02-snapshot.{mjs,d.mts}`,
`src/test/m02-snapshot.test.ts`, `src/test/m02-readiness-snapshot.test.ts`.

## Próximo (fora desta saída)

Decisão humana (a)/(b) do C-02; H1 commits V0→V5 (prazo hoje, humano);
bateria T1–T3/T7 e OP-H **não iniciadas** (ordem: depois disto, e só
depois — pré-requisitos pendentes).

## Atualização C-02A/B — 2026-09-08

- A decisão (a) foi executada em branch efêmera: restore sancionado, reparo de
  178 grants (`roles-before-grants`) PASS, `backup-verify` PASS e reconcile
  26/26 diff 0. Produção permaneceu read-only.
- O probe H-07 falhou na fase PROBE com `42P01`; a relação não foi
  identificada porque o diagnóstico seguinte não executou por quoting do
  shell. O protocolo de duas falhas consecutivas acionou STOP; cleanup foi
  comprovado.
- A decisão (b) **não foi executada**. `PS-S5` continua não emitido; os
  detalhes estão em `C-02A-repair-stop-report.md`,
  `C-02B-experiment-not-run.md` e `PS-S5-status.md`.
