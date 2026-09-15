# QUEUE — MISSÃO SDD (fechamento verificado repo-local) · 2026-09-15

> **Escritor único deste arquivo: MAESTRO.** Squads não editam esta fila; entregam `CLAIMS-INBOX/<id>.md` no seu worktree e o MAESTRO integra.
> **Objetivo unilateral:** maximizar o crédito verificado sob a régua oficial (DONE + ½·PARTIAL, denom. 187) executando o Plano Mestre na ordem §1, sob disciplina SDD de 7 passos (spec-card → teste → código → evidência → claim → adversarial → ledger).

## Base

- HEAD de partida: `1f94b56` (medição vigente). Placar: **139 D / 25 P / 21 NS / 2 UNV = 81,0% parcial · 74,3% cru**.
- FASE 0 (reconciliação do «antes») é **bloqueante**: veredicto de `V0-Reconciliador` em `RECONCILIACAO-BASE-2026-09-15.md` antes de qualquer promoção de claim.
- Restrições absolutas: nada pushado · container `:5432` **intocado** (dado não-fixture aguarda decisão humana) · nenhum guard fail-closed enfraquecido · Neon live / GitHub settings / OAuth = fila humana · segredos nunca logados ou commitados · métrica OBSERVED só em ambiente real (H-6 aberto ⇒ no máximo CONTROLLED local, etiquetado).

## Work packages

**Ordem canônica §1 respeitada (validação do SPEC-STEWARD, 2026-09-15):** correção matemática → segurança → integridade → fronteiras → estabilidade → observabilidade → performance. O despacho é **por onda ordenada**, e a onda N+1 só abre quando a onda N estiver integrada e verificada — performance (WP-A3) **não** pode ser despachada com item crítico de fase anterior aberto.

| onda                         | wp    | itens                                                                                | squad      | worktree/branch                          | spec-card                                  | estado                                        |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------ | ---------- | ---------------------------------------- | ------------------------------------------ | --------------------------------------------- |
| 1 (correção matemática)      | WP-A2 | `10.7` (2 propriedades PBT restantes)                                                | SQUAD-FIN  | `.worktree-mA2` · `mission/a2-pbt`       | `SPEC-CARDS/10.7-pbt.md`                   | **despachado**                                |
| 2 (segurança)                | WP-B3 | `20.1` (CSP: procedimento + bloqueio explícito; sem enforcement sem relatório limpo) | SQUAD-SEC  | `.worktree-mB3` · `mission/b3-csp`       | `SPEC-CARDS/20.1-csp.md`                   | aguarda onda 1                                |
| 2 (integridade)              | WP-B1 | `23.1`/`23.2` (outbox na mesma tx + worker idempotente)                              | SQUAD-DB   | `.worktree-mB1` · `mission/b1-outbox`    | `SPEC-CARDS/23-outbox.md`                  | aguarda onda 1                                |
| 2 (integridade/estabilidade) | WP-B2 | `28.1`–`28.5` (batch/checkpoint/rate-limit/idempotência/observabilidade)             | SQUAD-DB2  | `.worktree-mB2` · `mission/b2-backfill`  | `SPEC-CARDS/28-backfill.md`                | aguarda onda 1 (e WP-B1 para `scripts/db/**`) |
| 2 (estabilidade/CI)          | WP-A4 | `12.5`/`26.7` (E2E na branch efêmera) · `25.4` (Dependabot) · `25.5` (classificação) | SQUAD-APP  | `.worktree-mA4` · `mission/a4-supply`    | `SPEC-CARDS/12.5-25.4-supply-lifecycle.md` | aguarda onda 1                                |
| 3 (observabilidade)          | WP-A1 | `35` (gate perf-evidence, CLASSE A)                                                  | SQUAD-PERF | `.worktree-mA1` · `mission/a1-perf-gate` | `SPEC-CARDS/35-perf-gate.md`               | aguarda onda 2                                |
| 3 (performance)              | WP-A3 | `16.3` (pg_stat_statements local)                                                    | SQUAD-OBS  | `.worktree-mA3` · `mission/a3-pgstat`    | `SPEC-CARDS/16.3-pgstat.md`                | aguarda onda 2                                |

> **Correção de infra (declarada):** a primeira versão desta fila presumia que os worktrees das ondas 2–3 já existiam — existiam apenas `mA1`–`mA4`. `SQUAD-SEC` criou o seu `.worktree-mB3`; o MAESTRO criou `.worktree-mB1` e `.worktree-mB2`. Nenhum squad deve presumir infra: verifique antes de começar.

| artefato entregue (aguardando adversarial) | commit(s)                   | branch           | status pleiteado                                                                                      |
| ------------------------------------------ | --------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `10.7` PBT (WP-A2)                         | `2f42bf2` + claim `8e0164f` | `mission/a2-pbt` | DONE                                                                                                  |
| `20.1` CSP (WP-B3)                         | `304c4f1` + claim `35e76a7` | `mission/b3-csp` | PARTIAL (bloqueio H-6; **defeito real corrigido**: modo enforçado republicava as diretivas de report) |

## Arbitragem de escopo de arquivos (decidida ANTES do despacho)

| artefato                                                                         | dono único                                               | observação                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `package.json`                                                                   | **MAESTRO** (integração)                                 | squads propõem a linha exata no claim; eu aplico no merge |
| `EXECUTION-STATE-PROGRAM.md`, `PROGRESS.md`, `QUEUE.md`                          | **MAESTRO**                                              | ledger só é gravado na FASE 4                             |
| `drizzle/**`, `scripts/db/migration-classes.ts`, `src/db/schema.ts`              | SQUAD-DB (WP-B1)                                         | `db:generate` + registry + `db:classify:check`            |
| `docs/specs/M-02/matrix.yaml`                                                    | **MAESTRO** (regeneração `m02:matrix:generate` no merge) | gerado, não escrito à mão                                 |
| `src/test/finance.properties.test.ts`                                            | SQUAD-FIN (WP-A2)                                        |                                                           |
| `src/test/perf-evidence.test.ts` + `docs/evidence/perf-controlled-2026-09-13/**` | SQUAD-PERF (WP-A1)                                       |                                                           |
| `scripts/obs/pg-stat-statements.ts` (+ teste)                                    | SQUAD-OBS (WP-A3)                                        | `docker-compose.yml` **não** é tocado                     |
| `.github/workflows/neon-pr-branch.yml`, `.github/dependabot.yml`                 | SQUAD-APP (WP-A4)                                        | `.github/workflows/ui-stack.yml` intocado                 |
| `docs/evidence/agent-state/CLAIMS-INBOX/<id>.md`                                 | squad do item (1 arquivo por claim)                      |                                                           |
| `docs/evidence/agent-state/SPEC-DELTAS/<id>.md`                                  | squad propõe; **SPEC-STEWARD decide**                    |                                                           |

## Protocolo de integração

1. Squad commita **1 item = 1 commit atômico** no seu worktree/branch e escreve `CLAIMS-INBOX/<id>.md` (cadeia completa: spec_ref → SHA → evidência → comandos/execução).
2. MAESTRO faz `merge --no-ff` na ordem A1→A2→A3→A4 (depois B1→B2), resolve `package.json`/matriz, roda `npm run check` + `db:test` (container efêmero PG17).
3. Verificador adversarial _fresh-context_ por claim (V-A1..V-A4, V-B1, V-B2) ataca do zero; veredicto CONFIRMED/CORRECTED/REJECTED.
4. Só após CONFIRMED o MAESTRO promove no ledger (`DONE`/`PARTIAL`) e recomputa o placar; discrepância item a item ⇒ a rodada não fecha.

## Estado do placar (recompute oficial — só MAESTRO)

| momento        | D   | P   | NS  | UNV | parcial | cru   |
| -------------- | --- | --- | --- | --- | ------- | ----- |
| base `1f94b56` | 139 | 25  | 21  | 2   | 81,0%   | 74,3% |
| após WP-A*     | —   | —   | —   | —   | —       | —     |
| após WP-B*     | —   | —   | —   | —   | —       | —     |
