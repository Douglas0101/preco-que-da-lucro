# PART-E — Medição quantitativa do Plano Mestre (§5–§35 + §29–§31)

**Fonte:** `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` (2.559 linhas; §5–§35 + §29–§31).
**Método:** auditoria READ-ONLY sobre `develop @ 8df3fe3` (2026-09-13) por 5 subagentes read-only — 4 fatias §16–§35 + 1 verificador do recap §5–§15. Sem execução de npm/build/testes.
**Escalas:** crua (DONE=1) e crédito parcial (DONE=1, PARTIAL=0,5); a métrica **oficial é o crédito parcial**.
**Rodapé:** ver "Limites declarados" ao final.

## 1. Método e regras

- **Universo:** 194 itens mapeados (§5–§35 + §29–§31).
- **Denominador acionável:** **187** (194 − 7 exclusões).
- **Excluídos (7):** 3 SUPERSEDED (§12.2, §13.4, §15.2-conversas); 1 NÃO VERIFICADO (gate M-02 `m02:boundaries`); 2 N-A (§27 "evitar big-bang", §31 vector por pré-requisito ausente); 1 duplicado (Dependency Review listado em §24 e §25).
- **Escalas:** crua (DONE=1; PARTIAL/NS=0) e crédito parcial (DONE=1; PARTIAL=0,5; NS=0). **Métrica oficial = crédito parcial.**
- **Auditoria read-only**, sem execução de npm/build/testes; os números de RLS, journal e PITR vêm de artefato versionado.

## 2. Placar consolidado

| bloco      | escopo               | denom   | D       | P      | NS     | % crua    | % crédito |
| ---------- | -------------------- | ------- | ------- | ------ | ------ | --------- | --------- |
| A          | §5–§15               | 75      | 55      | 12     | 8      | 73,3%     | 81,3%     |
| B          | §16–§20              | 34      | 22      | 10     | 2      | 64,7%     | 79,4%     |
| C          | §21–§28 + §32–§35    | 73      | 51      | 8      | 14     | 69,9%     | 75,3%     |
| D          | §29–§31              | 6       | 1       | 3      | 2      | 16,7%     | 41,7%     |
| **Global** | **§5–§35 + §29–§31** | **187** | **129** | **33** | **25** | **69,0%** | **77,8%** |

> **Métrica oficial: crédito parcial = 77,8%.**

Nota de reconciliação: a soma aritmética dos blocos dá 188 itens / 26 NS; o Placar Global (187/25) aplica a deduplicação do item Dependency Review, listado em §24 e §25 — os percentuais por bloco permanecem como medidos.

## 3. Fases 0–15

| fase | escopo | D   | P   | NS  | % crua | % crédito | lacuna dominante                                              |
| ---- | ------ | --- | --- | --- | ------ | --------- | ------------------------------------------------------------- |
| F0   | §5     | 4   | 1   | 0   | 80,0%  | 90,0%     | F0-04 log-fonte perdido                                       |
| F1   | §6     | 10  | 0   | 0   | 100%   | 100%      | —                                                             |
| F2   | §7     | 6   | 1   | 0   | 85,7%  | 92,9%     | AUTH-005 OAuth sem runtime                                    |
| F3   | §8     | 6   | 2   | 0   | 75,0%  | 87,5%     | BFF-002/003 consolidados em `upsert*`                         |
| F4   | §9     | 1   | 2   | 1   | 25,0%  | 50,0%     | Memory/EventService inexistentes, repos sem interface         |
| F5   | §10    | 7   | 0   | 0   | 100%   | 100%      | —                                                             |
| F6   | §11    | 9   | 0   | 0   | 100%   | 100%      | RLS 26 tabelas/30 políticas via artefato, sem gate de índices |
| F7   | §12    | 2   | 3   | 0   | 40,0%  | 70,0%     | branch model/lifecycle/guardrails                             |
| F8   | §13    | 4   | 2   | 0   | 66,7%  | 83,3%     | PITR 6 h = H-4                                                |
| F9   | §14    | 6   | 1   | 0   | 85,7%  | 92,9%     | 14.3 tool audit (input cru/`tool_execution_id`)               |
| F10  | §15    | 0   | 0   | 7   | 0%     | 0%        | deferral com gate §43                                         |
| F11  | §16    | 6   | 1   | 1   | 75,0%  | 81,3%     | 16.3 pg_stat_statements, 16.7 séries de pool                  |
| F12  | §17    | 7   | 1   | 0   | 87,5%  | 93,8%     | 17.8 RUM sem p75/SLO                                          |
| F13  | §18    | 4   | 3   | 0   | 57,1%  | 78,6%     | 18.1/18.3/18.5 (UI)                                           |
| F14  | §19    | 2   | 3   | 1   | 33,3%  | 58,3%     | spans BFF/DB, métricas financeiras, memory metrics            |
| F15  | §20    | 3   | 2   | 0   | 60,0%  | 80,0%     | CSP report-only, chat/exports                                 |

## 4. Bloco C — §21–§28 + §32–§35

| item | D   | P   | NS  | lacuna/observação                                             |
| ---- | --- | --- | --- | ------------------------------------------------------------- |
| §21  | 1   | 1   | 1   | T1 default; T2 sem FOR UPDATE/versão; T3 SERIALIZABLE ausente |
| §22  | 3   | 0   | 1   | sem purge de expirados                                        |
| §23  | 0   | 0   | 2   | outbox inexistente; M-04 PENDING                              |
| §24  | 12  | 0   | 1   | falta dependency review                                       |
| §25  | 3   | 0   | 4   | Dependabot/CodeQL/secret scanning/dependency review ausentes  |
| §26  | 7   | 0   | 2   | sem E2E e schema diff na branch Neon                          |
| §27  | 1   | 2   | 0   | + 1 N-A; classificação em 3/12; expand/contract parcial       |
| §28  | 0   | 2   | 3   | sem batch/checkpoint/rate-limit                               |
| §32  | 8   | 2   | 0   | faltam SQLi adversarial e fixation                            |
| §33  | 9   | 0   | 0   | —                                                             |
| §34  | 7   | 0   | 0   | —                                                             |
| §35  | 0   | 1   | 0   | sem template dos 7 campos                                     |

## 5. Bloco D — §29–§31

- §29 SLO backend: **NS**.
- §29 frontend: **PARTIAL**.
- §29 IA: **PARTIAL**.
- §30 error budget: **NS**.
- §31 IA indisponível: **PARTIAL**.
- §31 vector: **N-A** (excluído do denominador; pré-requisito ausente).
- §31 observabilidade externa: **DONE**.

## 6. Prioridades (§36–§38)

Camada com overlap — **não somada** ao placar por blocos/fases.

| prioridade | itens | D   | P   | NS  | % crédito |
| ---------- | ----- | --- | --- | --- | --------- |
| P0         | 17    | 16  | 1   | 0   | 97,1%     |
| P1         | 15    | 11  | 4   | 0   | 86,7%     |
| P2         | 10    | 2   | 2   | 6   | 30,0%     |

## 7. Ordem prática (§40) e gates

- **Ordem prática:** 30/38 passos (**78,9%**). Passos 01–29 concluídos (com ressalvas); 30 (cutover) **PARTIAL** — tráfego de aplicação inexistente (H-6); 31 **DONE**; 32–35 **NOT STARTED** (bloqueio B4/S8); 36–38 parciais.
- **Gates:** §41 P0 satisfeito (ressalvas Q-010 e timeout não propaga ao corpo da tool); §42 Neon production satisfeito (limite: PITR 6 h viola §16.6 = H-4); §43 memória **NÃO** (esperado); §44 HNSW **NÃO** (esperado) → **2/4**, os 2 abertos são deferrals com gate.
- **Fila humana:** H-4 é a única exigência pré-tráfego; H-6 trava o tráfego.

## 8. Confiança do lastro

- **Alta (teste executável no CI):** F1/F5/F6/F9, F11–F12, §33 9/9, §34 7/7, §32 8/10.
- **Média (~10; artefato medido, não re-derivável read-only):** RLS 26 tabelas/30 políticas, journal 12/12, reconciliação 0, PITR 6 h, perf before/after, EXPLAIN 2026-08-21, bundle, traces OTel, RUM LCP, F0-04.
- **Baixa (~7; só código/estrutural/ponteiro):** F0-04 (também citado acima como artefato não re-derivável), §12.3, AUTH-005, 16.2, 17.2/17.3, 17.7, 18.7, §35.

## 9. Inventário do que falta

**NOT STARTED — 25 itens por tema:**

| tema                                                       | qtd | itens                                                     |
| ---------------------------------------------------------- | --- | --------------------------------------------------------- |
| Memória                                                    | 9   | F10 §15.1–15.7 (7) + Memory/EventService (§9) 1 + 19.6 1  |
| Supply chain                                               | 4   | §25 (Dependabot/CodeQL/secret scanning/dependency review) |
| Backfill                                                   | 3   | §28 (batch/checkpoint/rate-limit)                         |
| Outbox                                                     | 2   | §23 (inexistente; M-04 PENDING)                           |
| SLO backend + error budget                                 | 2   | §29 backend + §30                                         |
| E2E + schema diff Neon                                     | 2   | §26                                                       |
| T3 SERIALIZABLE, purge de idempotência, pg_stat_statements | 3   | §21 T3 + §22 purge + 16.3                                 |

**PARTIAL — 33 itens:** ~15 de UI/obs/CSP/segurança (§18/§19/§20/§32/§35) e ~10 estruturais (F0-04, AUTH-005, BFF `upsert*`, §9, §12–§13, 14.3).

## Limites declarados

1. **Read-only, sem execução:** não rodei npm, build, testes nem migrações; a prova de execução vem de artefato versionado/CI.
2. **Ausências provadas por busca:** os NOT STARTED foram inferidos por ausência em código/schema/specs, não por execução.
3. **Números de DB/CI vêm de artefatos versionados:** RLS, journal, reconciliação e PITR não foram re-derivados nesta auditoria.
4. **Fora de escopo:** §15.8+ segue não classificado.
