# EXECUTION-STATE-PROGRAM — Mandato de Execução v5 (Programa de Fechamento SDD, F0–F14/V7)

Ledger persistente do programa v5. Este arquivo não contém credenciais, tokens, URLs
Neon reais ou conteúdo de mensagens. Estrutura: Parte 0 (decisões) → estado de partida
→ ledger módulos × tarefas → cartões SA-nn → gates → residuais → regras de retomada.

- **Mandato vigente:** v5 (Programa de Fechamento SDD). v3 ENCERRADO (merge #21/#22;
  CI verde `a4e6fb1`, run `33037401855`); v4 consolidado por este documento.
- **Estrutura SDD:** CONSTITUIÇÃO (C-01..C-20) → ESPECIFICAÇÃO (REQs por módulo) →
  Q → PLANO (D-01..D-17) → SUBAGENTS DIRECIONADOS → TAREFAS → PODERES/PROIBIÇÕES
  (P-01..P-14; proibições 1–27) → RELATÓRIO.
- **Pipeline por módulo (D-14):** CARTÃO RAT → SPEC DRAFT → CARTÃO RT (se alto risco)
  → SPEC CONGELADA em commit (`docs/specs/M-xx-spec.md`) → IMPL → TESTES → CARTÃO AG
  → GATE → PR DRAFT → humano.
- **Ondas (D-16):** W1=M-01 · W2=M-04+M-06 · W3=M-05+M-02 · W4=M-03+M-07+M-08.
  Dependências inegociáveis: M-01→todos; M-04→M-05.
- **Início do programa:** 2026-08-27.
- **Última atualização:** 2026-08-27 (M01-1/M01-2).

---

## Parte 0 — Registro de decisões

### Aprovadas com transcrição verbatim (efeito duradouro por C-20)

> **H-001** — "Aprovo a Opção C e a SPEC-AMEND-001."
> **H-002** — "Autorizo a execução das Fases 1–4 sob os poderes v2 e os deltas propostos."
> **H-003** — "Q-008 permanece NÃO: usar contract tests para os drivers; não usar endpoint Neon."

**Efeitos duradouros:** (i) proibição de endpoint Neon real vincula M-04/M-06 e toda a
suíte de teste (H-003); (ii) o padrão de módulo encapsulado driver-agnóstico
(budget-ledger) é referência arquitetural para M-02/M-05 (H-001); (iii) ratificação
ambiental obrigatória antes de spec (H-001 → C-16).

> **H-004** — Ativação do Mandato v5 e autorização da execução de W1 (M-01) sob os
> poderes herdados e os deltas (seleção explícita do humano em 2026-08-27; frase
> canônica do documento: "Ativo o Mandato v5 e autorizo a execução de W1 (M-01) sob
> os poderes herdados e os deltas."). Q-011 resolvida para o escopo de W1.

### Defaults seguros aplicados (C-19 — nunca expandem escopo; override humano a qualquer momento)

| Q | Default aplicado | Override humano |
| --- | --- | --- |
| Q-010 (residual de falha dupla de settlement) | **CORRIGIR em M-04** + teste dedicado do caso | "Aceito o residual formalmente" — **não informado** |
| Q-016 (política de merge) | humano revisa e mergeia cada PR de módulo (C-09) — **aplicado nesta execução: PRs em draft, nenhum merge pela linha principal** | política alternativa explícita — **não informada** |
| Q-009 (proveniência dos merges #21/#22) | registrado como **presumido-humano, pendente de confirmação**; NÃO-bloqueante | confirmação factual — **não informada** |

### Genuinamente abertas (sem default possível)

| Q | Owner | Estado |
| --- | --- | --- |
| **Q-001 (A1)** — fresh provisioning OU URL somente leitura da fonte Supabase | HUMANO | **Aberta — bloqueia F8 e o caminho crítico de produção. Único desbloqueio de F8.** |
| Q-002 (TAC) | EXTERNO | Aberta |
| Q-004 (destino da `wip/`) | HUMANO | Aberta |
| Q-012..Q-015 (Hostinger, Neon persistente, credenciais reais, acessibilidade externa) | HUMANO | Abertas (camada C) |

Resolvidas (histórico): Q-005..Q-008 (v3), Q-011 (H-004).

---

## Estado de partida — M01-1 (verificação 2026-08-27)

- `HEAD` = `a4e6fb1879daf020ed933cc5fb6755498b835b1c` em
  `fix/ai-budget-reservation-csf58b4`; worktree **limpo** (`git status --porcelain` vazio).
- `origin/develop` = `12c90a17f81edd5a126c2e32c3f703c8b7841f87` — *Merge pull request #21
  from fix/ai-budget-reservation-csf58b4* (tip publicado).
- `origin/main` = `55cb5502d43b18f21e0fce85708472ff836a0c06` — *Merge pull request #22
  from fix/ai-budget-reservation-csf58b4*.
- **Igualdade de conteúdo develop↔main:** `git diff --name-only origin/develop origin/main`
  → **0 arquivos** (conteúdo idêntico; SHAs divergem apenas por história de merges:
  main-only = 3 merge commits — #22, #18, #7; develop-only = 1 — #21; merge-base = `a4e6fb1`).
- `develop` local defasado (`c371032`, merge #19) — intocado nesta sessão; alinhamento
  somente por fast-forward quando exigido (Parte IX).
- Preservações intocadas: branch local `wip/preservacao-c371032-20260826` (sem ref
  remota) e `stash@{0}` preexistente em `codex/local-dev-postgres`.
- CI: `gh` autenticado (`repo`, `workflow`); workflows ativos: `UI stack`,
  `Neon preview boundary`, `Neon readiness`; environment `neon-readiness` **sem
  protection_rules** (dispatch executa sem aprovação extra).
- Scan v3 selado: Standard scan ID `2ca2b19a-3ab2-49a1-a436-0a9ab46b3fcd`, alvo
  `e61c8c8` (antecessor imediato do tip publicado; único delta até `12c90a1` é o merge
  commit #21, sem delta de conteúdo — ver M01-4), cobertura parcial **6/240**,
  artefatos em `docs/evidence/security-scan/csf-58b444f-2026-08-27/` com hashes
  registrados no `EXECUTION-STATE.md` v3.
- **ADR-021** (`docs/adr/ADR-021-migration-cutover-supabase-neon.md`): **intocável**.
- Auditoria ambiental vigente: `docs/auditoria-ambiental-2026-08-26.md` (Nitro
  `node-server` + PostgreSQL 17; harness `docker-compose.yml` saudável).

---

## Ledger de módulos e tarefas

Status: `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `NOT_RUN`.

### M-01 — Reconciliação de estado e evidência (W1; sem deps)

| Tarefa | Status | Evidência | Predicado de retomada |
| --- | --- | --- | --- |
| M01-1 Verificação de partida + este ledger | DONE | Seção acima; SHAs/diffs registrados | `git rev-parse HEAD` = branch do programa em `12c90a1`; status limpo; seção "Estado de partida" presente |
| M01-2 Branch do programa a partir de `origin/develop@12c90a1` | DONE | Branch `program/v5-fechamento-sdd` criada; `HEAD` = `12c90a1`; commit inicial do ledger | `git rev-parse HEAD` = `12c90a17f81…`; `git status --porcelain` vazio após commit |
| M01-3 Higiene documental (REQ M01-3) | PENDING | — | Commits com header do Plano Mestre atualizado + mapeamento V7↔Plano + fix csf-58b444f marcado mergeado + readiness com release develop→main CUMPRIDA; diff NÃO toca ADR-021 |
| M01-4 Delta-scan Standard no tip publicado `12c90a1` | PENDING | — | Artefatos de scan-delta selados com alvo `12c90a1`; csf_58b444f registrado como resolvido no publicado; cobertura parcial registrada sem mascarar |
| M01-5 Reexecução do workflow neon-readiness no SHA atual | PENDING | — | Run ID registrado via `gh run view`; `headSha` = `12c90a1`; etapas de migração skipped (`legacy_source=false`); cleanup do branch Neon no log; 403 da API de branches registrado com fallback de URLs |
| M01-6 Registro de residuais | PENDING | — | Seção "Residuais" atualizada no ledger (Q-010 → M-04; cobertura 6/240 → M-07) |
| M01-7 Gate G-M1 + auditoria independente SA-01 | PENDING | — | Cartão SA-01 com handoff D-15 e verdict `confirm` OU verificação manual equivalente registrada; commit de gate |

### M-02..M-08 (esqueleto; specs congeladas no pipeline D-14 antes de implementar)

| Módulo | Onda | Deps | Status | Predicado de retomada |
| --- | --- | --- | --- | --- |
| M-02 F3/F4 arquitetura uniforme | W3 | M-01 | PENDING | Cartão RAT SA-06 → spec congelada em `docs/specs/M-02-spec.md` antes de implementar |
| M-03 F5 decimal canônico (RISCO ALTO, gate humano) | W4 | M-02 recomendada | PENDING | Cartão RT SA-07 + RD SA-08; gate humano no diff de golden tests antes do PR |
| M-04 F9 orquestração + residual Q-010 (default: corrigir) | W2 | M-01 | PENDING | Cartão AG SA-02; teste dedicado do caso de falha dupla |
| M-05 F10 memória pela sequência de gate | W3 | M-04 | PENDING | Cartões RAT SA-04 + RT SA-05; ordem do gate inegociável |
| M-06 F0/F11–F14-parcial baselines controlados | W2 | M-01 | PENDING | Cartão RAT SA-03; rotulagem CONTROLADO (não é RUM); SLO/error budget calculados do baseline |
| M-07 F14/F1 hardening verificável | W4 | M-01 | PENDING | Cartão AG SA-09; cobertura de scan incremental registrada sem mascarar |
| M-08 F2 wire-level com mocks | W4 | M-01 | PENDING | Cartão RT SA-10; credenciais reais permanecem Q-014 |

---

## Cartões de missão registrados (C-17/C-18; subagents SOMENTE leitura)

| Cartão | Agente | Módulo | Papel | Perguntas fechadas | Status |
|---|---|---|---|---|---|
| SA-01 | Turing | M-01 | AG | (1) O ledger reflete SHAs/runs reais? (2) Algum diff de docs toca ADR-021? (3) O scan do tip publicado registra csf_58b444f resolvido? | PENDING (janela 1×~15min + handoff D-15 + retry máx 1) |

Cartões emergentes: nenhum. Novos cartões SA-11+ são registrados aqui com o mesmo
template antes da instanciação (C-18). Veredito `diverge` de RAT/RT bloqueia
congelamento de spec; `blocked`/ausência de handoff → registra e segue (C-12).

---

## Gates

| Gate | Estado | Evidência |
|---|---|---|
| G-M1 (M-01) | PENDING | Req: M01-1..M01-7 DONE + SA-01 handoff válido |

---

## Residuais registrados

| Residual | Origem | Destino |
| --- | --- | --- |
| Falha dupla de transação em `settle` pode adiar correção para o sweep por TTL (retry único reduz, não elimina) | v3 / scan `2ca2b19a` limitations | **M-04 — CORRIGIR (default C-19 Q-010) + teste dedicado** |
| Cobertura de scan parcial: 6/240 superfícies; restante `needs_follow_up`; seam test-only `callModelForTests` listado como residual de revisão | scan `2ca2b19a` coverage.json | **M-07 — estratégia incremental de scan (100% das superfícies críticas em scans sucessivos)** |
| Q-009 proveniência #21/#22 presumida-humano | default C-19 | Confirmação factual humana (não-bloqueante) |

---

## Regras de retomada

1. Revalidar `HEAD`, worktree limpo, ancestry da base (`12c90a1`) e integridade das
   preservações (`wip/*`, stash) antes de cada gate.
2. `develop` movendo → re-ratificar o módulo afetado contra o novo tip (C-16) antes de
   prosseguir; alteração estrutural exige parada e nova decisão.
3. Uma tarefa só passa a `DONE` após seu método de verificação e evidência registrados
   (comando + saída OU file:line).
4. Subagent sem handoff conforme template D-15 = "sem evidência transferível" → encerra
   e segue (C-12); a linha principal assume a verificação.
5. Q humana/externa sem default (Q-001/A1, Q-002, Q-004, Q-012..Q-015), endpoint Neon
   real, segredos, ADR-021, merge de PR, force-push ou operação fora dos poderes
   interrompem a execução.
6. Waits bounded ≤15 min; retomada idempotente por predicado; commit do ledger a cada gate.
7. Pré-push: rebase local do branch do programa; pós-push: merge `develop`→branch
   (fast-forward/merge normal), **jamais force**; nenhum rewrite de branches publicadas.
