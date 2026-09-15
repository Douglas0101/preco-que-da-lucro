# CLAIM — 23-outbox

- **wp / squad / branch / commit:** WP-B1 (`23.1` + `23.2`) · SQUAD-DB-OUTBOX · `mission/b1-outbox` · `342a188` (23.1) + `543f29f` (23.2)
- **spec_ref:** Plano Mestre §23 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1750-1768`) · M-04 (`docs/specs/M-04/spec.md:231-254`, `failure-matrix.md` F-16/F-17/F-19, `definition-of-done.md:32-59`) · §21 T1/T2 · §22 · INV-008/INV-009/INV-013 · contrato `src/server/contracts/event.contracts.ts` (implementado, **sem renomear**)
- **status pleiteado:** **DONE** — T1–T5 rodaram de fato no container efêmero PG17 (saída real abaixo). Sem item dependente de ambiente externo pendente.
- **cadeia SDD:**
  1. **SPEC-CARD:** `docs/evidence/agent-state/SPEC-CARDS/23-outbox.md` (lido inteiro antes de qualquer linha; nenhum SPEC-DELTA necessário — mapeamento de colunas na seção "divergências" abaixo).
  2. **TEST-FIRST:** `scripts/db/test-outbox.ts` escrito antes da implementação. Prova de falha inicial:
     ```text
     $ npx tsx scripts/db/test-outbox.ts
     Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/douglas-souza/preco-que-d-main/.worktree-mB1/src/server/repositories/outbox.repository' imported from /home/douglas-souza/preco-que-d-main/.worktree-mB1/scripts/db/test-outbox.ts
       code: 'ERR_MODULE_NOT_FOUND',
     Node.js v24.15.0
     EXIT=1
     ```
     Rede intermediária honesta: a 1ª execução de T4 falhou por **expectativa do teste** (`status` `pending` onde eu esperava `failed`), porque o teste reenfileirava (`status='pending'`) um evento com `attempts` esgotado — o worker corretamente não o reclama. Corrigido o teste (vencer o evento preservando `status='failed'`), não o código.
  3. **IMPLEMENT:** (todos os caminhos abaixo relativos ao worktree `.worktree-mB1`)
     - `src/db/schema.ts:853-896` — `outboxEvents` (id, tenant_id, event_type, aggregate_type, aggregate_id, idempotency_key, payload jsonb, status, attempts, available_at, occurred_at, processed_at, last_error, created_at + unique `(tenant_id, idempotency_key)` + índice de claim `(tenant_id, status, available_at, created_at)` + CHECKs de status/attempts/identidade não-vazia); `src/db/schema.ts:898-911` — `outboxConsumptions` (PK `(consumer_name, event_id)`, FKs para `tenants` e `outbox_events`).
     - `drizzle/0015_curved_riptide.sql` (gerada por `npm run db:generate`; grants/RLS anexados: linhas 34-57) — `GRANT SELECT, INSERT, UPDATE` em `outbox_events` e `SELECT, INSERT` em `outbox_consumptions` para `app_runtime`, `REVOKE ALL … FROM PUBLIC`, `ENABLE ROW LEVEL SECURITY` e policy `tenant_isolation` (`USING`/`WITH CHECK` = `tenant_id = app_private.current_tenant_id() AND app_private.has_tenant_access(tenant_id)`), no padrão de `0006_loud_lockjaw.sql:25-35` (M-04).
     - `drizzle/rollback/0015_to_0014_down.sql` — down (drop policies/grants/tabelas, filho primeiro); `drizzle/rollback/0001_to_0000_down.sql:9-12` — as duas tabelas entram no rollback global (sem isso a chain `test-migrations` quebrava: as tabelas sobreviviam ao `DROP TABLE` enumerado e o replay falhava em `CREATE TABLE ... already exists`).
     - `scripts/db/migration-classes.ts:269-284` — entrada `0015_curved_riptide` classe `SAFE`, `appliedOn: "empty"`, sha256 `c91c648921990b5d30eea3040b51ce09c3ffb9e4d36423168931817b0e3968cb`, rollback apontado.
     - `src/server/repositories/outbox.repository.ts:73` `append` (INSERT … `onConflictDoNothing((tenant_id, idempotency_key))` no **executor recebido**, devolvendo `{eventId, duplicate}` — M-04/F-16); `:114` `claimPending` (`SELECT … FOR UPDATE SKIP LOCKED` limitado a `batchSize>0`, `status in ('pending','failed')`, `available_at <= now()`, `attempts < maxAttempts`; marca `processing` + `attempts+1`); `:162` `markConsumed` (inbox `(consumer_name, event_id)`); `:179` `markProcessed`; `:197` `markFailed` (`failed` + `last_error` + `available_at = now() + make_interval(secs => backoff)`); `:221` `publishPending` implementando o contrato (delega ao dispatcher injetado, falha alto `DEPENDENCY_ERROR` se não houver — nunca marca publicado em silêncio); `OutboxDispatcher`/`OutboxStore` (`:44`, `:49`).
     - `src/server/services/outbox.worker.ts:76` `OutboxWorker` — `:116` `processBatch` (claim + handler + marca na MESMA transação, savepoint por evento), `:106` `backoffMs` (exponencial 1s→60s, injetável), `:162` `publishPending`, `:168` `runOnce(identity)` via `transactionManager`; handler injetável (`:32` `OutboxEventHandler`), `batchSize`/`maxAttempts` validados `>0` no construtor (`:76-104`).
     - `src/server/services/expense.service.ts:35-62` — `expenseService.save` (mutação de domínio real, usada por `src/lib/expenses.functions.ts:90,98`) passa a chamar `this.events.append(context, …)` no **mesmo `context.transaction`**, com chave estável `expense.saved:${id}:v${version}`.
  4. **EVIDENCE:** container efêmero novo (`docker run … -p 5433:5432 postgres:17-alpine`, PostgreSQL 17.11) e cadeia na ordem do `db:test`; saída real colada abaixo.
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)
- **limites declarados:**
  - Nada foi tocado no container `:5432`; todo trabalho de banco foi no container efêmero `pqdl-b1-outbox` na porta 5433, **removido ao fim** (`docker rm -f`) — saída do `docker ps` no EVIDENCE.
  - O worker tem handler injetável e runner (`runOnce`) mas **não** ganhou entrada de cron/runner de produção: o card proíbe criar consumidores de negócio nesta onda (o handler de teste é o consumidor). `publishPending` sem dispatcher injetado falha alto — a composição real do runner fica para o item que ligar o cron.
  - `claim`+efeito+marca rodam numa transação (choice explícita): não há `processing` persistido, logo nenhuma linha presa exige lease/reaper; em troca, um handler com I/O externo seguraria a transação (o handler desta onda é in-process). Documentado em `outbox.repository.ts:11-15` e `outbox.worker.ts:1-17`.
  - T5 usa `set local role app_runtime` + GUCs na mesma técnica de `scripts/db/test-migrations.ts:34-82` (o admin do container é superuser e bypassaria RLS); não há login `app_runtime` real no teste, como já ocorre nos demais testes de banco do repo.
  - Não rodei a suíte completa nem `npm run build` (é do MAESTRO). Rodei `test-migrations.ts` (a minha migration entra na chain dele) e a suíte unitária mínima afetada (`m02-purge-fixtures`, `financial-metrics`, `bff-create-update-contract`, `optimistic-version.repository`, `contracts`, `migration-classes`): 36 testes verdes (6 arquivos). Não apliquei a linha do `package.json`.
- **divergências do §23 (nenhuma SPEC-DELTA):** as colunas exigidas pelo card estão todas presentes; `aggregate_type`/`aggregate_id`/`occurred_at` são exigidas pelo contrato pré-existente `DomainEventInput` (que o card manda implementar sem renomear) e por `docs/specs/M-04/spec.md:243-249`; `processed_at` é o nome do card para o `published_at` do M-04. A tabela `outbox_consumptions` não é "consumidor de negócio": é o mecanismo direto do "Garantir idempotência no consumidor" do §23 e é o que torna T3 demonstrável com um handler que conta efeitos (o card exige exatamente esse handler).
- **propostas de integração (aplica o MAESTRO):**
  - `package.json` — acrescentar `&& tsx scripts/db/test-outbox.ts` ao **final** da linha 61 (`db:test`), resultando em:
    ```json
    "db:test": "tsx scripts/db/check-migration-classes.ts && tsx scripts/db/test-migrations.ts && tsx scripts/db/test-concurrency.ts && tsx scripts/db/test-auth-integration.ts && tsx scripts/db/test-oauth-boundary.ts && tsx scripts/db/test-tool-security.ts && tsx scripts/db/test-sql-injection.ts && tsx scripts/db/test-chat-semantics.ts && tsx scripts/db/test-ai-budget.ts && tsx scripts/db/test-rum-persistence.ts && tsx scripts/db/test-rate-limit-burst.ts && tsx scripts/db/test-outbox.ts"
    ```
  - `scripts/db/test-migrations.ts` já foi ajustado por mim (chain: `0015_to_0014_down.sql` em `DOWNS_TIP_TO_0003:733-735`, journal 15→16 em `:897`, comentários).
  - `scripts/db/purge-fixtures.ts:26-28` já inclui as duas tabelas (filho primeiro) no purge de fixtures.
  - Ao mergear, a migration `0015` precisa ser aplicada no ambiente alvo antes de qualquer deploy do código (o `expenseService.save` passa a escrever em `outbox_events`).
- **rollback:** `git revert 543f29f && git revert 342a188` (nesta ordem) + `drizzle/rollback/0015_to_0014_down.sql` para o DDL. O down descarta eventos ainda não drenados; pós-tráfego o caminho canônico é restore de snapshot.

## EVIDENCE (comando + saída real, não resumida)

### 1. Classificação de migrations + chain + testes do item (container efêmero PG17 novo)

```text
$ docker run -d --name pqdl-b1-outbox -e POSTGRES_DB=preco_que_da_lucro_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:17-alpine
$ export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/preco_que_da_lucro_test DATABASE_URL_UNPOOLED=… DATABASE_ADMIN_URL=… DATABASE_DRIVER=node-postgres
$ npm run db:classify:check
> tsx scripts/db/check-migration-classes.ts

✔ 16/16 classificadas

$ npx tsx scripts/db/test-migrations.ts
PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK

$ npx tsx scripts/db/test-outbox.ts
T1 atomicidade: rollback do domínio sem evento órfão + falha do evento sem despesa: OK
  75790210-571f-408b-a12c-6802ed266ae0 → worker=worker-1 · efeitos=1
  2a03b275-641c-4761-a192-9ddca0d62d99 → worker=worker-1 · efeitos=1
  9da0fdf2-c36f-4fe0-b317-9ca0263d4590 → worker=worker-2 · efeitos=1
  54cc76d7-705d-4caf-986c-702615f02750 → worker=worker-2 · efeitos=1
  inbox: 2a03b275-641c-4761-a192-9ddca0d62d99 ← consumer-1
  inbox: 54cc76d7-705d-4caf-986c-702615f02750 ← consumer-2
  inbox: 75790210-571f-408b-a12c-6802ed266ae0 ← consumer-1
  inbox: 9da0fdf2-c36f-4fe0-b317-9ca0263d4590 ← consumer-2
T2 claim concorrente: 2 workers com SKIP LOCKED dividem o lote sem repetir: OK
  98f8a148-840f-4658-9495-38f011cbcb90 → efeito consumer-idempotent=1 após 3 entregas · consumer-other=1
T3 idempotência: mesmo evento 2× ⇒ 1 efeito (inbox persistida por consumidor): OK
T4 falha: attempts++ + available_at futuro + retry limitado por maxAttempts: OK
T5 isolamento: RLS por tenant sob app_runtime + WITH CHECK do append cruzado: OK
Outbox §23 (23.1 + 23.2): atomicidade, claim concorrente, idempotência: OK
```

Registro evento × efeito do consumidor (T2, persistido — lido do banco, não da memória do teste):

```text
$ docker exec pqdl-b1-outbox psql -U postgres -d preco_que_da_lucro_test -c "select e.id, e.status, e.attempts, e.last_error, c.consumer_name from outbox_events e left join outbox_consumptions c on c.event_id = e.id order by e.status, e.id;"
                  id                  | status  | attempts | last_error | consumer_name
--------------------------------------+---------+----------+------------+---------------
 60eeb78f-646b-44cb-a200-0ca5d718124f | pending |        0 |            |
 a10a25c2-cebb-483c-9fdc-4aa350b958d2 | pending |        0 |            |
(2 rows)
```

(as duas linhas `pending` são os eventos semeados por T5; a transação sob `app_runtime` termina em `rollback` por construção, então o evento de A e o de B seguem intocados e **nenhum** consumo cruzado foi gravado — é o estado que prova o isolamento).

### 2. Prova de atomicidade (T1, sem banco limpo entre casos)

`T1` cobre os três sentidos exigidos pelo card, com asserções de contagem no banco (não no retorno das funções):
- (a) `expenseService.save` + `throw` na mesma transação ⇒ `outbox_events` e `expenses` voltam a zero (nenhum evento órfão);
- (b) commit ⇒ exatamente 1 evento com `aggregate_id = despesa.id`, `idempotency_key = expense.saved:<id>:v0`, `status='pending'`, `attempts=0`, `processed_at/last_error` nulos e payload esperado;
- (c) `append` com `event_type` vazio (viola `outbox_events_identity_check`) ⇒ erro `23514` e a despesa escrita antes **não** persiste (mesma transação).

### 3. Autoverificação adversarial do squad (mutations — o verificador deve reconferir do zero)

| mutação aplicada | teste que falhou (mensagem real) |
| --- | --- |
| remover `.for("update", { skipLocked: true })` do claim | `T2`: `o segundo claim não pode bloquear nas linhas travadas pelo primeiro worker` |
| `markConsumed` sempre `true` | `T3`: `1 !== 2` (`redelivered.duplicates`/efeitos) |
| append do domínio em transação separada (`withTenantTransaction` próprio no service) | `T1`: `rollback do domínio não pode deixar evento órfão` |
| claim ignorando `attempts < maxAttempts` | `T4`: `attempts esgotado não volta para a fila` |
| `DROP POLICY tenant_isolation ON outbox_events` no banco | `T5`: `A deve enxergar o próprio evento` (RLS deny-by-default) |
| `REVOKE SELECT ON outbox_events FROM app_runtime` | `T5`: `outbox_events deve ter RLS habilitado e grants SELECT/INSERT/UPDATE somente para app_runtime` |

### 4. Escopo (motor financeiro e `:5432` intocados)

```text
$ git diff --stat 1f94b56..HEAD
 drizzle/0015_curved_riptide.sql              |   57 +
 drizzle/meta/0015_snapshot.json              | 4204 ++++++++++++++++++++++++++
 drizzle/meta/_journal.json                   |    9 +-
 drizzle/rollback/0001_to_0000_down.sql       |    2 +
 drizzle/rollback/0015_to_0014_down.sql       |   15 +
 scripts/db/migration-classes.ts              |   16 +
 scripts/db/purge-fixtures.ts                 |    2 +
 scripts/db/test-migrations.ts                |    9 +-
 scripts/db/test-outbox.ts                    |  732 +++++
 src/db/schema.ts                             |   66 +
 src/server/repositories/outbox.repository.ts |  233 ++
 src/server/services/expense.service.ts       |   30 +-
 src/server/services/outbox.worker.ts         |  179 ++
 13 files changed, 5547 insertions(+), 7 deletions(-)

$ docker ps --format '{{.Names}}\t{{.Ports}}'          # durante a execução
pqdl-b1-outbox	0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp

$ docker rm -f pqdl-b1-outbox                        # fim do item
pqdl-b1-outbox

$ docker ps --format '{{.Names}}\t{{.Ports}}'          # depois: só o :5432, intocado
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
```

Nenhum arquivo do motor financeiro aparece no diff (`src/lib/financial*.ts`, `src/lib/calc-explanation.ts`, `src/server/services/financial.service.ts`, `src/lib/ai/budget-ledger.server.ts`, `src/server/services/pricing.service.ts`): o único arquivo de **domínio** alterado é `src/server/services/expense.service.ts` (append do evento no mesmo `context.transaction`), sem alteração de cálculo. `EXECUTION-STATE-PROGRAM.md`, `docs/evidence/agent-state/{QUEUE.md,PROGRESS.md}` e arquivos de outros worktrees/repo principal não foram tocados.
