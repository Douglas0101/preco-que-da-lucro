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
- **Última atualização:** 2026-08-27 (W1/M-01 CONCLUÍDA; gate G-M1 selado; PR draft aberto).

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

| Q                                             | Default aplicado                                                                                                                | Override humano                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Q-010 (residual de falha dupla de settlement) | **CORRIGIR em M-04** + teste dedicado do caso                                                                                   | "Aceito o residual formalmente" — **não informado** |
| Q-016 (política de merge)                     | humano revisa e mergeia cada PR de módulo (C-09) — **aplicado nesta execução: PRs em draft, nenhum merge pela linha principal** | política alternativa explícita — **não informada**  |
| Q-009 (proveniência dos merges #21/#22)       | registrado como **presumido-humano, pendente de confirmação**; NÃO-bloqueante                                                   | confirmação factual — **não informada**             |

### Genuinamente abertas (sem default possível)

| Q                                                                                     | Owner   | Estado                                                                             |
| ------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| **Q-001 (A1)** — fresh provisioning OU URL somente leitura da fonte Supabase          | HUMANO  | **Aberta — bloqueia F8 e o caminho crítico de produção. Único desbloqueio de F8.** |
| Q-002 (TAC)                                                                           | EXTERNO | Aberta                                                                             |
| Q-004 (destino da `wip/`)                                                             | HUMANO  | Aberta                                                                             |
| Q-012..Q-015 (Hostinger, Neon persistente, credenciais reais, acessibilidade externa) | HUMANO  | Abertas (camada C)                                                                 |

Resolvidas (histórico): Q-005..Q-008 (v3), Q-011 (H-004).

---

## Estado de partida — M01-1 (verificação 2026-08-27)

- `HEAD` = `a4e6fb1879daf020ed933cc5fb6755498b835b1c` em
  `fix/ai-budget-reservation-csf58b4`; worktree **limpo** (`git status --porcelain` vazio).
- `origin/develop` = `12c90a17f81edd5a126c2e32c3f703c8b7841f87` — _Merge pull request #21
  from fix/ai-budget-reservation-csf58b4_ (tip publicado).
- `origin/main` = `55cb5502d43b18f21e0fce85708472ff836a0c06` — _Merge pull request #22
  from fix/ai-budget-reservation-csf58b4_.
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

| Tarefa                                                        | Status | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Predicado de retomada                                                                                                                            |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| M01-1 Verificação de partida + este ledger                    | DONE   | Seção acima; SHAs/diffs registrados                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `git rev-parse HEAD` = branch do programa em `12c90a1`; status limpo; seção "Estado de partida" presente                                         |
| M01-2 Branch do programa a partir de `origin/develop@12c90a1` | DONE   | Branch `program/v5-fechamento-sdd` criada; `HEAD` = `12c90a1`; commit inicial do ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `git rev-parse HEAD` = `12c90a17f81…`; `git status --porcelain` vazio após commit                                                                |
| M01-3 Higiene documental (REQ M01-3)                          | DONE   | Commit `b2da0fb`: Plano Mestre com status real + registro de execução (fix **MERGEADO** PR #21 `12c90a1` / PR #22 `55cb550`; CI `33037007387`; mapeamento V7↔Plano referenciado) + `docs/evidence/release-readiness-develop-main-2026-08-27.md` (release develop→main **CUMPRIDA**; cutover permanece bloqueado por Q-001/A1)                                                                                                                                                                                                                                                                                                                                                                                                                 | Diff NÃO toca ADR-021 — verificado (`git show --name-only HEAD                                                                                   | grep -c ADR-021` = 0) |
| M01-4 Delta-scan Standard no tip publicado `12c90a1`          | DONE   | Commit `60ad804`: artefatos selados em `docs/evidence/security-scan/csf-58b444f-delta-2026-08-27/` — scan `cb6038a1-c397-4042-a68d-ae6427e95802`; delta `e61c8c8→12c90a1` = 7 arquivos 100% documentais (zero código/schema/testes/config); `findings.json` vazio; veredito **RESOLVIDO no publicado**; cobertura parcial 7 superfícies/240 registrada sem mascarar                                                                                                                                                                                                                                                                                                                                                                           | Artefatos com hashes no `scan-manifest.json`; producer honesto (`pi-program-v5.standard-delta-scan 1.0`, não-codex)                              |
| M01-5 Reexecução do workflow neon-readiness no SHA atual      | DONE   | Run `33080843742` (dispatch em `develop`, `headSha=12c90a1`, `dry-run` + `no-legacy-source`): ref develop ✓; credenciais ✓; branch Neon descartável `readiness/develop-33080843742` criada e **deletada no cleanup** ✓; URLs direct/pooled provadas (PostgreSQL 17, hosts distintos) ✓; etapas de migração **PERMANECEM skipped** ✓; evidência upada como artefato `neon-readiness-33080843742` (retenção 7d) ✓; **conclusão: failure** — `npm run db:test` falhou somente em **T6/E6** (`scripts/db/test-ai-budget.ts:427`, `gatewayCalls <= 2` → `false !== true`); T1–T5 verdes no Neon; restrição 403 da API de branches: **não foi necessária** (verificação integral via `gh run view`/`--log-failed` + URLs web — fallback registrado) | Predicado cumprido (re-execução + registro); o vermelho é EVIDÊNCIA registrada, não máscara; roteado como residual (linha abaixo) e ao relatório |
| M01-6 Registro de residuais                                   | DONE   | Seção "Residuais" atualizada: E6 Neon (run `33080843742`) adicionada; cobertura 7 superfícies/240 (delta `cb6038a1`); Q-010 → M-04                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Seção consistente com scan-delta e readiness doc                                                                                                 |
| M01-7 Gate G-M1 + auditoria independente SA-01                | DONE   | SA-01 `confirm` com GAPS fechados por comando: sha256 dos artefatos de `60ad804` = manifesto selado (`b1f1575e…`/`704f67cd…`/`52de5c8f…`); ADR-021: 0 arquivos em `12c90a1..HEAD`, `docs/adr/` vazio; drift de re-autofix sobre `report.md` revertido (restaurado de HEAD, regra 8)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Cartão SA-01 com handoff D-15 e verdict `confirm` OU verificação manual equivalente registrada; commit de gate                                   |

### M-02..M-08 (esqueleto; specs congeladas no pipeline D-14 antes de implementar)

| Módulo                                                    | Onda | Deps             | Status  | Predicado de retomada                                                                       |
| --------------------------------------------------------- | ---- | ---------------- | ------- | ------------------------------------------------------------------------------------------- |
| M-02 F3/F4 arquitetura uniforme                           | W3   | M-01             | PENDING | Cartão RAT SA-06 → spec congelada em `docs/specs/M-02-spec.md` antes de implementar         |
| M-03 F5 decimal canônico (RISCO ALTO, gate humano)        | W4   | M-02 recomendada | PENDING | Cartão RT SA-07 + RD SA-08; gate humano no diff de golden tests antes do PR                 |
| M-04 F9 orquestração + residual Q-010 (default: corrigir) | W2   | M-01             | PENDING | Cartão AG SA-02; teste dedicado do caso de falha dupla                                      |
| M-05 F10 memória pela sequência de gate                   | W3   | M-04             | PENDING | Cartões RAT SA-04 + RT SA-05; ordem do gate inegociável                                     |
| M-06 F0/F11–F14-parcial baselines controlados             | W2   | M-01             | PENDING | Cartão RAT SA-03; rotulagem CONTROLADO (não é RUM); SLO/error budget calculados do baseline |
| M-07 F14/F1 hardening verificável                         | W4   | M-01             | PENDING | Cartão AG SA-09; cobertura de scan incremental registrada sem mascarar                      |
| M-08 F2 wire-level com mocks                              | W4   | M-01             | PENDING | Cartão RT SA-10; credenciais reais permanecem Q-014                                         |

---

## Cartões de missão registrados (C-17/C-18; subagents SOMENTE leitura)

| Cartão | Agente                    | Módulo | Papel | Perguntas fechadas                                                                                                                     | Status                                                                                                                       |
| ------ | ------------------------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SA-01  | Turing→carrier `reviewer` | M-01   | AG    | (1) O ledger reflete SHAs/runs reais? (2) Algum diff de docs toca ADR-021? (3) O scan do tip publicado registra csf_58b444f resolvido? | DONE — **VERDICT `confirm`** (handoff D-15 válido; GAPS fechados e evidenciados na linha M01-7; carrier registrado por C-18) |

Cartões emergentes: nenhum. Novos cartões SA-11+ são registrados aqui com o mesmo
template antes da instanciação (C-18). Veredito `diverge` de RAT/RT bloqueia
congelamento de spec; `blocked`/ausência de handoff → registra e segue (C-12).

---

## Gates

| Gate        | Estado   | Evidência                                                                                                                                                                                                                        |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-M1 (M-01) | **DONE** | M01-1..M01-7 DONE; SA-01 `confirm` com GAPS fechados por comando; commits `1aa17f2`→`b2da0fb`→`60ad804`→`7034ccf` + commit de gate sobre `12c90a1`; residuais registrados (E6 Neon → M-06; cobertura 7/240 → M-07; Q-010 → M-04) |

---

## Residuais registrados

| Residual                                                                                                                                                                                                                                                                                                                                         | Origem                                                              | Destino                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha dupla de transação em `settle` pode adiar correção para o sweep por TTL (retry único reduz, não elimina)                                                                                                                                                                                                                                   | v3 / scan `2ca2b19a` limitations                                    | **M-04 — CORRIGIR (default C-19 Q-010) + teste dedicado**                                                                                                                                                              |
| Cobertura de scan parcial: 6/240 superfícies no scan base; delta-scan `cb6038a1` re-registrou 7 superfícies com recibo (6 + verificação de delta) de 240, restante `needs_follow_up`; seam test-only `callModelForTests` listado como residual de revisão                                                                                        | scan base `2ca2b19a` coverage.json + delta `cb6038a1` coverage.json | **M-07 — estratégia incremental de scan (100% das superfícies críticas em scans sucessivos)**                                                                                                                          |
| Q-009 proveniência #21/#22 presumida-humano                                                                                                                                                                                                                                                                                                      | default C-19                                                        | Confirmação factual humana (não-bloqueante)                                                                                                                                                                            |
| **E6 (T6) sensível à latência no Neon**: `scripts/db/test-ai-budget.ts:427` assume janela de hold de 300ms ≫ latência local; no Neon pooled um holder concluiu dentro do burst e uma 3ª chamada foi aceita (comportamento correto da barreira — `peakActiveCalls <= 2` PASSOU). `db:test` não-verde no Neon no tip `12c90a1` (run `33080843742`) | neon-readiness reexecutado (M01-5)                                  | **Correção do harness (hold determinístico até liberação pelo teste, não por wall-clock) — proposta para ratificação de harness do M-06 (cartão SA-03); integridade do ledger NÃO foi violada no Neon (E1–E5 verdes)** |

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
8. **Artefatos selados de scan são imutáveis**: normalização automática de lint NÃO pode
   alterar bytes de `docs/evidence/security-scan/*/` — se o drift ocorrer, restaurar de
   HEAD e re-verificar os hashes do manifesto (aplicado em 2026-08-27 ao delta-scan
   `cb6038a1`).
