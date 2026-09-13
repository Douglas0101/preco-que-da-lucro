# 00 — Namespaces, rastreabilidade §42 e resoluções (SDD-CONTINUAÇÃO, 2026-09-07)

## W1 — Namespaces (colisão FASE 2/3 × PM-F resolvida)

| Código          | Significado                                           | Fonte                               |
| --------------- | ----------------------------------------------------- | ----------------------------------- |
| PM-F (F0–F15)   | Fases do Plano Mestre                                 | `docs/PLANO_MESTRE_…md:279-300`     |
| PM-P (P0–P2)    | Prioridades §§36–38 (17/15/10 itens)                  | `§§36–38`                           |
| TR (A–E)        | Trilhas de mecanização                                | SDD-CONTINUAÇÃO                     |
| OP-H            | Etapa operacional: homologação hPanel (era "FASE 2")  | runbook §3                          |
| OP-C            | Etapa operacional: cutover A4 (era "FASE 3")          | runbook §§1–5,9                     |
| OP-C-00…03      | freeze / T-0 / deploy+smoke+carimbos / A5-T+-rollback | este dir, `01-op-c-01-reescrito.md` |
| Gate de entrada | passo zero da Trilha A (era "P0 do SDD" em A-00)      | checklist A                         |

## Matriz §42 × trilhas (Gate antes de Neon production, §42:2166–2177)

| #   | Item §42                          | Trilha                                                     | Estado real 2026-09-07 |
| --- | --------------------------------- | ---------------------------------------------------------- | ---------------------- |
| 1   | migrations do zero                | A (db:test, journal 11/11)                                 | Mecanizado             |
| 2   | migrations em cópia de produção   | D (V2b drill) + C (dry-run §13.2)                          | D bloqueada em D2      |
| 3   | schema diff revisado              | D-02 (§13.3)                                               | Bloqueada em D2        |
| 4   | tenant tests                      | OP-C-02 (H-07) + P2 CI                                     | Pronta p/ executar     |
| 5   | RLS tests                         | OP-C-02 (H-07) + P2 CI                                     | Pronta p/ executar     |
| 6   | reconciliation report             | D-02, formato §13.5                                        | Bloqueada em D2        |
| 7   | backup/restore testado            | C (compensatório provado; PITR em DP2)                     | Parcial                |
| 8   | direct e pooled URLs configuradas | B (§12.2:1059–1066 + diagrama §47: `APP→POOL, MIG→DIRECT`) | Hazard ativo até B     |
| 9   | rollback documentado              | runbook §13.7 ↔ OP-C-03                                    | Pronto                 |
| 10  | smoke tests automatizados         | OP-C-02 + P2 CI                                            | Pronto                 |

Atualização append-only em 2026-09-08: a matriz vigente após o STOP C-02A,
incluindo a separação entre catálogo/schema de aplicação, objetos de
plataforma e paridade legacy, está em
`04-alinhamento-b1-b4-2026-09-08.md`. Ela não converte os estados históricos
acima em PASS nem emite PS-S5.

## W2 — Fidelidade §26 do `neon-pr-branch.yml` (verificado linha a linha)

`.github/workflows/neon-pr-branch.yml:1-217` vs §26:1811–1831: branch ✅,
DIRECT p/ migrations ✅ (`:121-127`), POOLED p/ integração ✅ (`:129-135`),
migrations ✅, seed sintético do probe ✅, integração `db:test` ✅, cleanup
`always()` ✅ (`:166-182`), pins SHA + permissions mínimas + fork-guard ✅
(§25/§2.11). **Ausentes: E2E e schema-diff → corte deliberado** (E2E exige
build+preview+seed-auth; schema-diff vive no T-0/A5 e no gate §42), com
follow-up pós-cutover. Provas: journal read-only (`:150-164`), comentário
de cleanup no PR (`:184-217`).

## W3 — SLO §29 vs smoke (desvio conhecido, aceito pré-RUM)

Backend p95 <500ms (§29:1881–1884) vs cold-start ~2s: o runbook já trata via
warm-up + asserções `--max-time 3`. Sem promessa contratual antes de RUM
(§29:1877). Nenhuma ação.

## W4 — Referências H2/H6 indefinidas (resolvido)

"Consumido por: B, H2" (A-10) → **"Consumido por: B (wiring), OP-H/OP-C
(pré-requisito de fase)"**. "Consumido por: F3 GO/NO-GO, H6" (C-03) →
**"Consumido por: OP-C GO/NO-GO, memo G1 (DP4)"**. H-02/H-06 da matriz
seguem válidos apenas como hipóteses, nunca como consumidores.

## Adendos normativos aplicados

- **§45 DoD** (código, testes, erro explícito, observabilidade,
  documentação, rollback, CI verde, sem regressão — §45:2211–2223)
  **anexado ao selo de saída A-10**.
- **§24** (pipeline: migration lint/test → integration DB branch → build →
  E2E → dependency review — §24:1772–1791) = definição oficial de "CI
  verde" do selo A-10.
- **INV-011** ("Neon é substituível") = fundamento do dump `-Fc
--no-owner --no-privileges` portátil em C/E.
- **§19.4** (nunca token/senha/DB URL em trace — §19.4:1601–1614) =
  fundamento do N-F1 "evidência só NOMES".
- **W6:** D-00 declara status §13.1 (migrations ✅ journal 11/11; auth ✅
  D1 CONFORME; CI verde ⏳ A-10; BFF+Repository = estado do ledger, sem
  presumir) — detalhe em `04-d00-13.1-e-pedido-d2.md` (gerado na
  materialização D).
