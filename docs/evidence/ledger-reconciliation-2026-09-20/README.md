# WP-R0 — Reconciliação do ledger (fórmula, taxonomia, varredura NS/UNV)

**Work package:** `WP-R0` (Fase 0 do plano pós-Bloco 3)
**Fato-fonte:** análise avançada do Bloco 3 × Plano Mestre (2026-09-20), itens 1 e 6
**Base:** `c9d1740` (develop pós-WP-R2) · **Branch:** `mission/r0-ledger-recon`
**Natureza:** docs-only; **nenhum placar é movido por inferência** nesta rodada.

---

## 1. Fórmula do placar (explícita)

**Crédito parcial = (D + ½·P) / 187.** Verificação com o placar vigente:

```text
D=150 · P=23 · NS=12 · UNV=2 · denom=187
(150 + 11,5) / 187 = 161,5 / 187 = 86,3636…%  → 86,36% parcial  ✓
150 / 187          = 0,802139…                → 80,21% crua     ✓
```

NS e UNV contam zero em ambas as réguas. A fórmula fecha ao dígito com o placar declarado; ela
passa a estar **explícita aqui e no template** — a fila já a registrava em `QUEUE.md:4`
(`DONE + ½·PARTIAL, denom. 187`) e não foi tocada nesta rodada.

## 2. Taxonomia CORR × N (fixada)

- **CORR** = _claim_ do autor corrigida pelo S6 (o claim dizia A, o fato dizia B). Bound do SDD
  limita **rodadas de correção de um WP**, não claims num veredicto.
- **N** = defeito novo encontrado pelo S6 (pode existir com `0 CORR`).
- **"Correções forçadas"** = CORR + N corrigidos.

**Errata da narrativa dos WPs 3–5** (append-only; o texto anterior não é reescrito):

| WP  | CORR (claims) | N corrigidos  | N declarados | o que a narrativa anterior errava                                                    |
| --- | ------------- | ------------- | ------------ | ------------------------------------------------------------------------------------ |
| 3   | 2 (C5, C10)   | 3 (N1/N3/N4)  | 1 (N2)       | contava "2 correções" (só CORR) e omitia os 3 N; N5 é errata do C10, não N declarado |
| 4   | **0**         | 5 (N2–N6)     | 2 (N1/N7)    | dizia "2 correções forçadas" quando havia 0 CORR e 5 N                               |
| 5   | 1 (C2)        | 6 (N1–N5, N7) | 3 (N6/N8/N9) | dizia "2" quando havia 1 CORR + 6 N                                                  |

Total dos três WPs pela definição: **3 CORR + 14 N = 17 correções forçadas**. A taxonomia e o
cálculo vivem no template (`docs/evidence/_templates/work-package.md` §4) e no `AGENTS.md`.

## 3. Varredura dos NS/UNV — método e resultado

**Método (reprodutível):** extração programática do `ANEXO-ITENS-2026-09-15.md` (coluna de status
do anexo, `**NS**`/`**UNVERIFIABLE**`), aplicação das 9 transições nominais da §3.1 da
`TRANSICOES-ROUND-2026-09-15.md`, e deduplicação do par §24/§25 pelo
`supply-chain-classification-2026-09-15.md:6,14` (e `:24` para a classificação do `25.5`) —
**`25.5` e `24.13` são o mesmo item (Dependency Review), contado uma vez**. Resultado: **12 NS + 2 UNV canônicos**, batendo com o
placar declarado (`150/23/12/2`):

| #   | item (canônico) | §   | estado na árvore (medido hoje)                                                            | dono / bloqueio                                   | closure candidato                              |
| --- | --------------- | --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| 1   | `15.1`          | F10 | **implementado por MEM-D1..D4** (`memory.service.ts` + `memory.policy.ts` + repository)   | promoção pendente (re-medição)                    | ratificar DONE/PARTIAL na matriz               |
| 2   | `15.2`          | F10 | **6/9 tabelas** (0017/0018/0019); `embeddings` ausente; conversas/mensagens são `chat_*`  | promoção pendente                                 | ratificar PARTIAL; `embeddings` = pós-gate §43 |
| 3   | `15.3`          | F10 | **implementado** (`memory.policy.ts`; contagem na captura `estado-ns.log.txt`)            | promoção pendente                                 | ratificar na matriz                            |
| 4   | `15.4`          | F10 | **implementado** (proveniência: `sourceKind`/`inferred`/confiança no repository)          | promoção pendente                                 | ratificar na matriz                            |
| 5   | `15.5`          | F10 | **ausente** — FTS `0` hits em `src/` e `drizzle/`                                         | gate §43 (ordem: FTS antes de vetor)              | DBT-07 (FTS, DBT-01 policy)                    |
| 6   | `15.6`          | F10 | **ausente** — vetor/`pgvector`/HNSW `0` hits                                              | gate §44 + decisão pós-gate                       | PÓS-GATE (H)                                   |
| 7   | `15.7`          | F10 | **ausente** — retrieval híbrido inexistente                                               | depende de 15.5/15.6                              | PÓS-GATE                                       |
| 8   | `19.6`          | F14 | **ausente** — nenhuma `memory*` em `instrumentation/telemetry.ts`                         | ADR-031 (a emitir, D7) define a ordem do provider | incluir no escopo do ADR-031 (a emitir)        |
| 9   | `21.3`          | §21 | **ausente** — `SERIALIZABLE`/retry adiado pelo ADR-029 (T3)                               | decisão T3                                        | D item (T3)                                    |
| 10  | `22.4`          | §22 | **ausente** — sem TTL/purge de `idempotency_records` (os deletes existentes são de teste) | —                                                 | DBT-08 (purge de idempotência)                 |
| 11  | `25.5`          | §25 | **settings-side** (Dependency Review; ≡ `24.13`)                                          | H-2 (visibilidade/dependency graph)               | retomar com H-2                                |
| 12  | `29.1`          | §29 | **ausente** — p95 sem alvo/veredito no código; M-06 DRAFT                                 | **Q-020** (congelamento M-06)                     | Fase M-06                                      |
| —   | `25.6` (UNV)    | §25 | **UNVERIFIABLE** — CodeQL depende da visibilidade do repo                                 | H-2                                               | retomar com H-2                                |
| —   | `25.7` (UNV)    | §25 | **UNVERIFIABLE** — secret scanning é setting                                              | H-2                                               | retomar com H-2                                |

**Achado central:** o placar está **estável por política declarada** (a fila registra "não promoções
de item do Plano Mestre" desde o ciclo 2), mas a árvore já cumpre parte do cluster de memória
(`15.1`/`15.3`/`15.4` implementados por MEM-D1..D4; `15.2` em 6/9 tabelas) e fechou `25.4`
(Dependabot) em 2026-09-15. **Nada disso é promovido por inferência nesta rodada** — a proposta é
uma re-medição formal (R0b) com a matriz 187 reconstruída item a item, submetida a ratificação
antes de mover o placar.

## 4. Gate §41 (P0) — posicionamento do arco

Medição corrente (2026-09-15): a camada **P0 é 17 D de 17** (`MEDICAO-2026-09-15.md:57`) e o
`GATE-41` foi recomputado para DONE no TRILHO C (`PROGRESS` L105). As ressalvas seguem registradas
(Q-010; timeout da IA que não propaga ao corpo da tool). `§42` é **PARTIAL**, limitado pelo PITR
6 h (**H-4**); `§43` e `§44` abertos por gate (deferral declarado). Os números da part-E de
2026-09-13 (16 D + 1 P) são **históricos**, não o estado corrente. O Bloco 3 (WP1–WP5) viveu em território P2/
observabilidade/testes — **P0 e P1 não regrediram** nesta rodada; a ordem canônica do §1 segue
respeitada, e a Fase 0 trata as dívidas que o próximo bloco herdaria.

## 5. Riscos e limites declarados

| item                                                                        | situação                                                                                                                                                                    |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| o placar **não** muda nesta rodada                                          | declarado: promoção exige re-medição + ratificação (R0b), não inferência                                                                                                    |
| a extração é do anexo (2026-09-15), não de um inventário vivo               | declarado: o anexo é o raw mais recente item a item; o método e o script estão na captura                                                                                   |
| `15.1`/`15.3`/`15.4` como "implementados" é leitura de árvore (greps)       | declarado: o valor exato (DONE × PARTIAL) é o objeto da R0b                                                                                                                 |
| `25.6`/`25.7` seguem UNV enquanto H-2 não responder                         | declarado: settings-side não derivável read-only                                                                                                                            |
| dívidas sem ID somem                                                        | mitigado: `DEBTS.md` entra no WP-R1 com `DBT-01..08`                                                                                                                        |
| **R0b** (re-medição que propõe promoções) poderia virar promoção silenciosa | declarado: R0b é **WP próprio**, escritor do placar é o MAESTRO, exige S6 adversarial e **ratificação antes de qualquer movimento**; esta rodada não toca `QUEUE.md`/ledger |

## 6. Como reproduzir

```bash
bash captures/extrai-ns.sh.txt   # parser do anexo (assertiva: 12 NS + 2 UNV) — saida em extrai-ns.log.txt
bash captures/estado-ns.sh.txt   # greps de estado atual por item — saida em estado-ns.log.txt
npm run check                     # sobre os bytes finais
```

## 7. S6 ADVERSARIAL

_(preenchido após o veredicto)_
