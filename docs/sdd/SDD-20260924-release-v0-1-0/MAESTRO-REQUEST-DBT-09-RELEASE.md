# MAESTRO-REQUEST — DBT-09 / release v0.1.0-mvp

**Status:** pedido de decisão; não altera o registry oficial  
**SHA-base:** `420e47b1a2d1222cc53a1c6cf955f8fc0a4c9dd0`  
**Evidência técnica:** `docs/sdd/SDD-20260924-release-v0-1-0/outbox-dbt09.md`

## Estado técnico

O schema, o append transacional, a claim com `FOR UPDATE SKIP LOCKED`, a marcação processed/failed, backoff, inbox idempotente e os testes de PG17 existem. Porém, a busca no código de produção não encontrou `OutboxWorker` instanciado, `processBatch`/`runOnce` chamados, cron, `setInterval`, plugin ou backlog metric. O singleton `outboxRepository` é criado sem dispatcher; `publishPending` lança `DEPENDENCY_ERROR` nesse estado.

Classificação: **B — drenagem parcial presente, mas não está ativa em runtime**. `23.2` não pode permanecer `DONE` por covered-by-tests; no máximo `PARTIAL`/`blocked`.

## Decisão de release

Não introduzir scheduler/worker nesta entrega congelada. A transação de despesa continua sendo a fonte de verdade financeira; eventos podem permanecer pendentes e a limitação deve ser declarada. O Release Readiness permanece `conditional` enquanto o blocker permanecer.

Evidência e pointers: `docs/sdd/SDD-20260924-release-v0-1-0/outbox-dbt09.md`, `src/server/services/outbox.worker.ts:76-180`, `src/server/repositories/outbox.repository.ts:71-241`, `scripts/db/test-outbox.ts:119-728`.

## Ação requerida do MAESTRO

1. Registrar a classificação `23.2 = PARTIAL` ou `blocked`, nunca `DONE`, até existir runner runtime comprovado.
2. Manter `DBT-09` aberta/alta ou registrar a decisão de equivalência formal; não inferir fechamento a partir dos testes mecânicos.
3. Registrar `DBT-19` separadamente; a cobertura de guards continua aberta até a asserção de fechamento exigida existir.
4. Se uma drenagem runtime for autorizada futuramente, criar SDD/ADR próprio com scheduler, deploy, retry/backlog metric, RLS, observabilidade e teste PG17 de drain real.
5. Após a evidência current-SHA ser selada, atualizar o placar/registry conforme a decisão, sem permitir que esta SDD os edite.

**Nenhum arquivo de registry, placar, fila ou gate foi alterado por este pacote.**
