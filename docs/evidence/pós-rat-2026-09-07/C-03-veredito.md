# C-03 — Veredito duplo BAK-01 (2026-09-07, pós-C-02)

## VEREDITO 1 — backup externo + restore isolado: NÃO COMPROVADO neste drill

- Provado: produtor trio N-6 (sha verificado), restore efêmero end-to-end,
  reconcile 26/26 diff 0 (financeiro zero), journal 11/11, cleanup com
  prova, gate `snapshot-fresco` PASS por `created_at`.
- Não provado: `comparison.pass` do `backup-verify` (FAIL por 178 `grants`
  ausentes no restore — artefato das flags `--no-privileges`, causa
  isolada em `C-02-stop-report.md`). Sem PS-S5.
- Para comprovar falta, por decisão humana: (a) aceitar-com-causa com nota
  de reparo de grants no runbook de rollback, ou (b) re-drill com
  privilégios. Nada foi improvisado nesta rodada.

## VEREDITO 2 — PITR: VIOLAÇÃO ABERTA

Retenção Neon confirmada **6h** (`history_retention_seconds=21600`,
preflight RAT); exigência SDD §2446: **≥7 dias**. Upgrade de plano
**existe e não foi contratado** (NAV autenticado; modal fechado sem
seleção) — logo, **não cabe escrever "compensatório = única via"**;
vale o default compensatório de DP2 com a insuficiência explicitamente
aberta. BAK-01 permanece ABERTA.

## Cláusula N-10 (verbatim; também anexada ao ledger)

> Cláusula de tráfego DP2: BAK-01 reabre no carimbo "Tráfego: EXISTE"
> salvo PITR≥7d ativo (dump lógico não satisfaz RPO≤15min com writes).

## PS-S6

Selo de **veredito de parada** (registra o stop, não uma aprovação):
C-02 documentado, C-03 emitido, cláusula N-10 no ledger (working tree,
sem commit). Retomada pós-decisão humana (a)/(b) acima.

## Aditivo C-02A/B (2026-09-08)

O reparo de grants da decisão (a) foi executado e fez o catálogo estrito e o
reconcile passarem, mas o probe H-07 no restore falhou com `42P01` antes de
comprovar as negações RLS. Após a falha do diagnóstico read-only por quoting,
a regra de duas falhas encerrou a rodada. O experimento (b) não foi iniciado.

O veredito permanece: BAK-01a aberta, BAK-01b em violação aberta e PS-S5 não
emitido. A evidência do aditivo está em `C-02A-repair-stop-report.md`.
