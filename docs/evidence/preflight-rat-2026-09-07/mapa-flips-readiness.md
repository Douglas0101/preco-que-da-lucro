# Mapa de flips do readiness (C1–C4) — conferido em 2026-09-07

> Base: `scripts/m02-readiness.mjs` (executado nesta rodada, saída em
> `logs/readiness.json`) + runbook `docs/runbooks/cutover-A4.md` §2.1.
> Regra do ADD-OPS lacuna 5: **flip fora deste mapa = PARAR.** Os gates
> `g1-assinada` e `sec01-fechada` viram por assinatura/registro — nunca por
> execução de comando.

Estado observado nesta rodada: `m02-matrix` PASS · `m02-boundaries` PASS ·
`substrate-smoke` DESCONHECIDO · os demais 5 FAIL (conjunto histórico
reproduzido exatamente).

| Gate              | Estado 07/09                                                | Ato que vira                                                                                                                                                                                                    | Dono                | Quando                                              | Evidência exigida                                                                                       |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `m02-state`       | FAIL — ledger sem HEAD `8d26a2c…`                           | Append no `EXECUTION-STATE-PROGRAM.md` registrando o HEAD (ou marker parent-pinned) — parte do pouso V0                                                                                                         | ★ H1                | 07–08/09                                            | Linha de ledger + regen SUMS do bundle afetado                                                          |
| `g1-assinada`     | FAIL — bloco vazio                                          | Preencher `## G1 SIGNATURE` (Nome/Data/Assinatura + `[x]`) em `docs/specs/M-02/decisions/M02-D-008-G1-memo.md`                                                                                                  | ★ H4                | meta 10–11/09; sunset 20/09                         | Memo assinado; release da exceção gsec (`m02:sums --release-gsec`) só após V0                           |
| `sec01-fechada`   | FAIL — sem registro                                         | **Revogação no emissor** das 5 credenciais de `neon-storage.env` + linha no ledger casando `SEC-01` e `fechada\|encerrada\|revogad\|closed`                                                                     | ★ H4                | 10–11/09                                            | Linha de ledger; prova de revogação                                                                     |
| `freeze-ativo`    | FAIL — sem declaração                                       | Append da linha literal `freeze ativo: deploys congelados da janela A4→B3 (exceção única: hotfix de segurança), declarada <DATA> — M02-D-009` + `NEON_MIGRATION_FREEZE_START/END` **iguais** à janela declarada | ★ H5                | 11–12/09                                            | Linha no ledger; janela do guard idêntica à declarada (divergência = achado → PARAR)                    |
| `snapshot-fresco` | FAIL — dump stale 45.6h                                     | C-02 em 6 passos produzindo trio válido (`dump.pgc`+`.sha256`+`metadata.json`), idade `0 <= age < 24h` **por `created_at`** — requer S1 selado (pós-RAT)                                                        | 🤖 executa + ★ sela | S5, e trio fresco <24h antes da 1ª readiness de T-0 | Trio no glob literal `.artifacts/backup-drill/*/dump.pgc` + `m02:backup-verify` PASS + reconcile diff 0 |
| `substrate-smoke` | DESCONHECIDO — `DATABASE_ADMIN_URL` ausente do loader atual | Loader sancionado (Emenda #5 aplicada → `node --env-file=.env.sanctioned-remote`) ou export explícito na janela, com smoke 7/7                                                                                  | ★+🤖                | pré-T-0                                             | JSON `read_only: true` 7/7 em `docs/evidence/`                                                          |
| `m02-matrix`      | PASS                                                        | — (regen de matrix só por humano sob drift declarado)                                                                                                                                                           | —                   | —                                                   | —                                                                                                       |
| `m02-boundaries`  | PASS                                                        | —                                                                                                                                                                                                               | —                   | —                                                   | —                                                                                                       |

## Notas de conformidade

- `m02-state` depende de ato de ledger (humano); o gate compara HEAD
  registrado × HEAD corrente — após H1 pousar o stack, o estado muda de
  `uncommitted` para `committed` e o gate reavalia.
- `snapshot-fresco` hoje usa `mtime` (PS-GAP-01, violação N-5 no consumidor).
  A correção é o consumidor N-5/N-6 da Emenda #6 (S1) — o trio só passa a
  valer depois disso; até lá o gate permanece no comportamento atual.
- Nenhum dos flips acima é executável pelo agente sem o selo/dono
  correspondente; o mapa é o anexo de conferência exigido pela lacuna 5.
