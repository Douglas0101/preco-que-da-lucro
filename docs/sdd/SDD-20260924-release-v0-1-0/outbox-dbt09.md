# Outbox / DBT-09 — triagem de release

**Data da triagem:** 2026-09-24  
**SHA-base:** `420e47b1a2d1222cc53a1c6cf955f8fc0a4c9dd0`  
**Escopo:** `SCOPE_FREEZE=yes`; somente leitura e evidência, sem implementação P2.

## 1. Estado encontrado

Classificação: **B — drenagem parcial existe, mas não está ativa em runtime**.

A cadeia de persistência e as garantias estão implementadas:

- `drizzle/0015_curved_riptide.sql:1-55` cria `outbox_events` e `outbox_consumptions`; `src/db/schema.ts:866-925` espelha as tabelas.
- `src/server/repositories/outbox.repository.ts:71-147` faz append transacional com `onConflictDoNothing`; `claimPending` usa `FOR UPDATE SKIP LOCKED` (`:151-181`).
- `src/server/repositories/outbox.repository.ts:184-224` mantém processed/failed, backoff e limite de tentativas; `publishPending` falha explicitamente quando não há dispatcher (`:231-241`).
- `src/server/services/outbox.worker.ts:76-180` implementa `processBatch`, inbox, savepoint, idempotência e retry.
- `scripts/db/test-outbox.ts:119-728` cobre atomicidade, concorrência, idempotência, retry, RLS e ausencia de dispatcher.
- `src/server/services/expense.service.ts:27-52` grava a despesa e o evento `expense.saved` na mesma transação; `src/server/services/event.service.ts:32-52` expõe o ponto de publicação.

O que falta é o caller runtime. A busca exaustiva no código de produção não encontrou `new OutboxWorker`, `processBatch`, `runOnce`, cron, `setInterval`, plugin, worker stand-alone ou backlog metric fora do worker e dos testes. A instância singleton `outboxRepository` é criada sem dispatcher (`src/server/repositories/outbox.repository.ts:241-243`). Portanto, `publishPending` não drena eventos em runtime.

## 2. Decisão de release

**Não declarar 23.2 DONE. Não declarar DBT-09 fechado. Não introduzir um scheduler/worker neste release.**

A funcionalidade de eventos não é necessária para o caminho financeiro factual do MVP: a transação de despesa e o append do evento já são atômicos, enquanto nenhum consumidor downstream está contratualmente exigido para a primeira entrega. A implementação de um runner exigiria composição de runtime, política de deploy, agendamento, backlog/observabilidade e prova de execução em banco; isso é P2 e não cabe no freeze. A superfície é, portanto, **limitação conhecida / partial**, não cobertura aparente.

Além disso:

- `23.2`: `PARTIAL`/`blocked` no placar, nunca `DONE` enquanto não existir runner runtime.
- `DBT-09`: permanece `ABERTA`, severidade alta, no registry; este documento não altera o registry.
- O MVP deve ser considerado **conditional** enquanto a limitação do outbox permanecer sem implementação.

## 3. Testes e evidência

Nesta etapa de triagem foram confirmados os ponteiros e a ausência de caller por inspeção. A execução PG17 efêmera, a prova de drain real e a auditoria de backlog são pendentes; não foram tratadas como verde. O comando de release previsto é `LOCAL_CI_DB_TIER=auto ./scripts/local-ci.sh`, que inclui `scripts/db/test-outbox.ts` quando o tier de banco é aplicável. A evidência final deverá trazer `headSha`, `result.txt`, manifesto, relatório e selo verificado; resultados históricos não substituem essa prova.

## 4. Impacto no release

- Não há regressão conhecida no cálculo financeiro decorrente desta omissão: o motor financeiro canônico e a transação de domínio permanecem a fonte de verdade.
- Eventos enfileirados ao salvar despesas podem permanecer pendentes até que um dispatcher runtime seja explicitamente implantado.
- A primeira entrega deve divulgar esta limitação e não pode apresentar a entrega de eventos ou o processamento do outbox como operacionais.
- Uma implementação futura exige decisão própria de SDD/ADR, alvo de implantação, métrica de backlog, responsabilidade de retry e um teste de drenagem limpos em PG17.

## 5. Pedido ao MAESTRO

Consulte `MAESTRO-REQUEST-DBT-09-RELEASE.md` ao lado deste arquivo. O pedido solicita ao MAESTRO reconciliar o placar/registry oficial depois que a evidência for selada. Esta SDD deliberadamente não edita `docs/evidence/agent-state/DEBTS.md`, `QUEUE.md` ou o placar oficial.
