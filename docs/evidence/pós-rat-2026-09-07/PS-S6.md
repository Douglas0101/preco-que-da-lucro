# PS-S6 — Selo de veredito de parada C-03 (2026-09-07, RAT S0)

Escopo: C-02 documentado em `C-02-stop-report.md` (+ `reconcile-c02.md`
companheiro), C-03 emitido em `C-03-veredito.md`, cláusula N-10 verbatim
no ledger (working tree, sem commit). Sem commit (human commita via
Manifest).

## Registrado (nomes; sem valores)

- S1: produtor/consumidor DP5=(b) + 21 testes focados + 412/412 + selftest
  13/13 + PS-S1 emitido (ver `PS-S1.md`).
- C-02: trio válido sha `7611425d…` (121.790 B, `created_at`
  2026-09-07T18:28:18Z); restore `restore-2026-09-07-c02`
  (`br-tiny-dust-ayng3ajh`, criada/deletada com prova); reconcile 26/26
  diff 0; journal 11/11; `backup-verify` exit 1 (causa isolada: 178
  `grants` — artefato `--no-privileges`); cleanup completo; gate
  `snapshot-fresco` PASS (0.1h por `created_at`).
- C-03: veredito duplo (compensatório NÃO COMPROVADO neste drill; PITR
  VIOLAÇÃO ABERTA, upgrade existe/não contratado); N-10 verbatim.
- Produção: zero escritas em toda a rodada (apenas `pg_dump` read-only +
  SELECTs). Efêmeras restantes: zero.

## Veredito

PS-S6 **EMITIDO como selo de parada**: não aprova selo de sucesso;
bloqueia PS-S5 até decisão humana (a) aceitar-com-causa + reparo de
grants no runbook, ou (b) re-drill com privilégios. T1–T3/T7 e OP-H
**não iniciados** (ordem: depois disto, e só depois — pré-requisitos
pendentes). H1 (commits V0→V5) humano, prazo de hoje, fora deste selo.
Selagem `m02:sums` (regen+verify) registrada no relatório de saída.

## Continuação C-02A (2026-09-08)

O selo continua válido. O reparo de grants produziu `backup-verify` PASS e
reconcile 26/26 em nova branch, porém H-07 retornou `42P01` na fase PROBE;
diagnóstico read-only não executou e a segunda falha acionou STOP. Cleanup
foi comprovado. `PS-S5` não foi emitido e o experimento privilegiado (b) não
foi executado. Ver `C-02A-repair-stop-report.md`.
