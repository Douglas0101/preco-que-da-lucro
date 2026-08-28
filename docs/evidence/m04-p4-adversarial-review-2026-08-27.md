# P4 — revisão adversarial da máquina de estados M-04

Data: 2026-08-27
Status: revisão read-only concluída; não consumiu Q-019
Classificação: achados de design/runtime localmente verificados; nenhuma correção de runtime aplicada

## Escopo e método

Esta revisão foi delegada a um subagent read-only com write-set vazio. O handoff
foi recebido e os achados relevantes foram rechecados pelo agente principal no
checkout `program/v5-fechamento-sdd`.

Método executado:

1. inspeção dos quatro documentos M-04 em estado `DRAFT`;
2. rastreamento do fluxo atual `reserve → gateway → settle` e do sweep;
3. análise dos interleavings propostos sob PostgreSQL `READ COMMITTED`, sem
   isolamento customizado no cliente;
4. comparação entre D-004, D-008, D-009, a máquina M04-D-011 e o runtime atual;
5. verificação da cobertura existente para `recordOutcome`, F-21 e F-22;
6. rechecagem local das linhas e predicados abaixo, sem executar corrida
   concorrente real, migration, CI, Neon ou produção.

## Achados

| Severidade | Achado                                                                                                                                                                                                                                                            | Evidência local                                                                                      | Estado                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P1         | O sweep atual pode sobrescrever um outcome conhecido com `ttl_expired`: filtra somente `status = 'reserved'`, grava `real_tokens = 0` e não exige `outcome IS NULL`.                                                                                              | `src/server/repositories/budget.repository.ts:64-81`                                                 | `LOCAL-VERIFIED`; corrigir somente após Q-019                                   |
| P1         | `recordOutcome` ainda não existe no runtime. A operação proposta precisa ser first-writer-wins; sem um CAS de estado/outcome, chamadas repetidas ou divergentes podem sobrescrever o desfecho.                                                                    | `docs/specs/M-04/spec.md:161-183`; `src/db/schema.ts:741-767`                                        | `LOCAL-VERIFIED` como ausência de implementação; corrida dinâmica não executada |
| P1         | O schema `ai_usage` persiste `real_tokens` e `outcome`, mas não o breakdown de input/output/tool calls necessário para reconstruir integralmente os contadores após crash entre outcome e settlement.                                                             | `src/db/schema.ts:741-767`; `src/server/repositories/budget.repository.ts:210-218`                   | `LOCAL-VERIFIED`                                                                |
| P1         | A assinatura atual de `settleBudget` recebe novamente `realTokens`, `outcome` e breakdown e grava esses valores diretamente. Isso não implementa a semântica estrita de consumir um outcome persistido e pode sobrescrever a interpretação de uma chegada tardia. | `src/server/repositories/budget.repository.ts:183-231`; `src/lib/ai/budget-ledger.server.ts:325-375` | `LOCAL-VERIFIED`                                                                |
| P1         | O TTL atual usa `Date` calculada pela aplicação para `cutoff`, `settled_at` e `reserved_at`; ainda não usa o relógio do banco. A fronteira exata do TTL também não está testada pelo runtime.                                                                     | `src/server/repositories/budget.repository.ts:64-81`; `src/lib/ai/budget-ledger.server.ts:268-285`   | `LOCAL-VERIFIED`                                                                |
| P1         | `settle-after-expire` está documentado como no-op/reconciliação, mas não há ainda mecanismo runtime para preservar e auditar o resultado tardio sem reabrir a reserva.                                                                                            | `docs/specs/M-04/decisions.md:15-16`; `docs/specs/M-04/failure-matrix.md:30-31`                      | `LOCAL-VERIFIED`                                                                |
| P2         | O log `ai.budget_settled` é emitido também quando `applied: false`, carregando `realTokens`/`outcome` do chamador. Isso pode produzir telemetria semanticamente ambígua entre settlement aplicado e no-op.                                                        | `src/lib/ai/budget-ledger.server.ts:351-375`                                                         | `LOCAL-VERIFIED`                                                                |
| P2         | A cobertura atual não executa `recordOutcome`, F-21/F-22 nem duas sweeps concorrentes reais; E9 cobre sweeps sequenciais.                                                                                                                                         | `docs/specs/M-04/definition-of-done.md:55-58`; `scripts/db/test-ai-budget.ts:569-595`                | `LOCAL-VERIFIED`                                                                |

## Análise de concorrência

No runtime atual, settlement e sweep atualizam a mesma linha com predicado
`status = 'reserved'` dentro da transação. Sob `READ COMMITTED`, a primeira
transição mantém o lock da linha e a segunda reavalia o predicado depois do
commit; não foi identificada dupla liberação causada somente pela corrida atual.
Essa afirmação é uma análise do SQL e da semântica do PostgreSQL, não uma
execução concorrente real nesta rodada.

A propriedade deixa de ser suficiente quando D-004 introduz o estado
intermediário `reserved + outcome IS NOT NULL`: o sweep precisa distinguir
explicitamente `expire` de `reconcile` e nenhum dos dois deve permitir
sobrescrita do resultado persistido.

## Recomendações para o freeze Q-019

1. Congelar uma máquina de estados explícita:
   `reserved + outcome NULL → expired`, `reserved + outcome conhecido →
settled/reconciled`, e `settled/expired → no-op tardio` com telemetria
   separada.
2. Fazer o claim de expiração exigir `status = 'reserved' AND outcome IS NULL`.
3. Tornar `recordOutcome` first-writer-wins, distinguindo repetição idêntica de
   payload divergente.
4. Persistir breakdown completo antes do settlement, ou criar registro
   imutável de outcome por `usageId`; o sweep não deve inventar input/output/tool.
5. Fazer `settle` consumir o outcome persistido, removendo valores duplicados do
   chamador ou validando-os contra a linha.
6. Definir o relógio autoritativo do banco e a fronteira exata do TTL.
7. Adicionar testes concorrentes reais para `recordOutcome × expire`,
   `recordOutcome × settle`, `settle × expire`, outcome duplicado/conflitante e
   settlement tardio.

## Disposição

Os achados são adicionados ao pacote de evidência P4 e devem alimentar emendas
de D-011/F-21/F-22 durante o freeze. O runtime não foi alterado porque P9 exige
o token humano Q-019. Nenhum achado foi tratado como aprovação ou como motivo
para consumir Q-019.
