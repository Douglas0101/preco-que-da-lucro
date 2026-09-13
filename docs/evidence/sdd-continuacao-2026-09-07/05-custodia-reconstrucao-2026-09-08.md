# 05 — Fechamento de custódia + reconstrução (Fases E/F, 2026-09-08, sem commit)

## E1 — G1(a) com causa CUSTÓDIA

Memo `M02-D-008-G1-memo.md` §6 (FATO NOVO 2026-09-08): origem Lovable/Supabase
sob custódia do sócio; handover = código + algoritmos; D2 FECHADO; evidência
`curl 000` SUPERSEDIDA; reconstrução por design; SUNSET 20/09 DISSOLVIDO.
**Aguarda apenas a assinatura do operador** (bloco `G1 SIGNATURE` vazio —
agente nunca assina). Template E3 emitido (não-bloqueante).

## E2 — addendum `emenda-2026-09-08-42-13-reconstrucao.md`

§42 itens 2,3 (acepção legado×Neon) e item 6 (acepção legado) = N/A-por-decisão;
§§13.4/13.6 com semântica de reconstrução; fase C = declaração de limite de
custódia. BAK-01a/BAK-01b, N-10 e selos inalterados.

## E5 — ADR §12.1

Addendum em `ADR-023`: PG 17 vigente, PG 18 RECUSADO sem novo ADR + matriz.

## §42 item a item (2026-09-08)

| #   | Item                   | Estado                                                                                                 |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | migrations do zero     | CONFORME mecanismo (journal 11/11)                                                                     |
| 2   | migrations em cópia    | N/A-por-decisão G1(a) 2026-09-08 (acepção legacy); drill Neon×restore segue obrigatório como mecanismo |
| 3   | schema diff revisado   | N/A-por-decisão G1(a) 2026-09-08 (acepção legacy); diff Neon×restore segue obrigatório como mecanismo  |
| 4   | tenant tests           | BLOQUEADO — H-07 em restore falhou 42P01 (causa DESCONHECIDA)                                          |
| 5   | RLS tests              | BLOQUEADO — cross-tenant não comprovado                                                                |
| 6   | reconciliation report  | N/A-por-decisão (acepção legacy); Neon×restore 26/26 PASS como mecanismo                               |
| 7   | backup/restore testado | PARCIAL — catálogo/dados PASS; RLS + PITR abertos                                                      |
| 8   | direct/pooled URLs     | PARCIAL — addendum criado; split `.env` pendente                                                       |
| 9   | rollback documentado   | PRONTO (runbook + DR-C02A/B); execução humana pendente                                                 |
| 10  | smoke automatizados    | Ferramentas prontas; produção não autorizada                                                           |

Paridade no ESTADO DO SUBSTRATO: **NÃO-APLICÁVEL** (decisão G1(a) assinada —
após assinatura; até lá, DESCONHECIDA por spec).

## Dia-D com datas e margem (relativo a D = cutover, sem D2/sunset no caminho)

| Quando     | Ação                                                                                   | Margem                         |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------ |
| D-14       | PITR ≥7d contratado + re-verificação do painel                                         | 14d antes de tráfego           |
| D-7        | compra hPanel + token mínimo + MCP + domínio decidido + custódia do domínio VERIFICADA | 7d para homologação            |
| D-5…D-2    | homologação 11/11 em preview (D2), evidência 01–11                                     | 3d de folga para FAIL→correção |
| D-1        | H1 commits V0→V5 verdes; SEC-01 fechada; G1 assinada; E3 enviado                       | portão de entrada              |
| D (manhã)  | trio `dump.pgc` novo (<24h por `created_at`) + snapshot nativo ID/validade             | frescor do dia                 |
| D (janela) | freeze declarado → T-0 → migrate → smoke + H-07 `--cleanup` → carimbos                 | janela única                   |
| D+14       | retenção/rollback window conforme runbook                                              | —                              |

## Gate desta atualização

`PS-S5` NÃO EMITIDO · `PS-S6` vigente · Fase B bloqueada até causa 42P01 ·
Fase D2 bloqueada até D0 · sem commit (H1 é a ponte).
