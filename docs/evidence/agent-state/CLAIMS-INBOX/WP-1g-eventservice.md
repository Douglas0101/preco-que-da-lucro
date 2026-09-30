# CLAIM — WP-1g

- **wp / squad / branch / commit:** WP-1g · SQUAD-APP (`SQUAD-APP-N2B`) · `mission/n2b-eventservice` · `da910e5` (deliverable) + `HEAD` (este claim)
- **spec_ref:** Plano §9.1 (Application Services) · §23.1/§23.2 (outbox transacional + worker) · contrato `src/server/contracts/event.contracts.ts` (implementado pelo outbox no WP-B1) · `docs/specs/M-02/matrix.yaml:1353-1357` (declara `EventService`) · **INV-004** (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:256`) · SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` §WP-1g
- **status pleiteado:** **DONE** (escopo exato do card). `docs/specs/M-02/matrix.yaml` e `matrix.overlay.yaml` **não foram editados** — a mudança de `contract-only` para `implemented` é da regeneração do MAESTRO.

- **cadeia SDD:**
  1. SPEC-CARD: `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` §WP-1g (lido na íntegra). Escopo exclusivo respeitado: `src/server/services/event.service.ts` (novo) · `src/server/services/expense.service.ts` (só a troca pelo serviço) · `src/test/event-*.test.ts` (novo → `src/test/event-service.test.ts`).
  2. TEST-FIRST (S2): `src/test/event-service.test.ts` escrito **antes** da implementação; falha inicial **por ausência de módulo** (EVIDENCE-A), não por bug.
  3. IMPLEMENT (S3):
     - `src/server/services/event.service.ts:1-51` (novo) — `EventService` (interface) + `DefaultEventService` com DI do `EventRepositoryPort` (contrato M-04, sem renomear nada). `append` (`:36-42`) resolve `executor = context.transaction` **no próprio serviço** e repassa ao port; `publishPending` (`:44-49`) idem — é o ponto de drenagem que o `OutboxWorker` implementa (o worker não foi tocado). Sem SQL (`@/db/`/`drizzle-orm` só via repositório), sem consumidor, sem regra financeira (INV-004). Composição: `export const eventService: EventService = new DefaultEventService();` (`:51`).
     - `src/server/services/expense.service.ts` — **só a troca**: import de `outboxRepository`/`EventRepositoryPort` → `eventService`/`EventService`; o 2º parâmetro do construtor passa de `EventRepositoryPort = outboxRepository` para `EventService = eventService` (assinaturas idênticas ⇒ troca estruturalmente compatível para qualquer chamador que injetasse um port); `save` continua chamando `this.events.append(context, { … })` **sem** executor, e o `EventService` resolve `context.transaction`. Mesma transação, mesmo payload, mesma chave de idempotência ⇒ **sem mudança de comportamento** (prova: EVIDENCE-E, `test-outbox.ts` inalterado e verde).
     - Nenhum arquivo fora do escopo do card (EVIDENCE-G).
  4. EVIDENCE: EVIDENCE-A (RED) · EVIDENCE-B (vitest verde) · EVIDENCE-C (`tsc`) · EVIDENCE-D (prettier) · EVIDENCE-E (`test-outbox.ts` no container efêmero + `psql`) · EVIDENCE-F (poder discriminante das asserções) · EVIDENCE-G (escopo/diff).
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

- **EVIDENCE-A — RED (falha por ausência, antes de existir o serviço):**

  ```text
  $ npx vitest run src/test/event-service.test.ts
   RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n2b

   ❯ src/test/event-service.test.ts (0 test)

  ⎯⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

   FAIL  src/test/event-service.test.ts [ src/test/event-service.test.ts ]
  Error: Failed to resolve import "@/server/services/event.service" from "src/test/event-service.test.ts". Does the file exist?
    Plugin: vite:import-analysis
    File: /home/douglas-souza/preco-que-d-main/.worktree-n2b/src/test/event-service.test.ts:19:69
    6  |  import { DefaultEventService, eventService } from "@/server/services/event.service";
       |                                                     ^

   Test Files  1 failed (1)
        Tests  no tests
  ```

- **EVIDENCE-B — GREEN (teste do item, com os nomes das asserções):**

  ```text
  $ npx vitest run src/test/event-service.test.ts --reporter=verbose
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > a instância de aplicação é a classe padrão sobre o port injetável
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > append usa o executor da transação do domínio quando nenhum é informado
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > append honra o executor explícito (transação/savepoint do chamador)
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > append propaga a falha do port — não engole nem repete a chamada
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > publishPending usa o executor da transação e devolve a contagem drenada
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > publishPending honra o executor explícito
   ✓ event-service.test.ts > EventService — caso de uso dos eventos de domínio sobre o port > publishPending propaga o erro do dispatcher — não engole a falha
   ✓ event-service.test.ts > INV-004 — o serviço de eventos não carrega regra financeira > não importa o motor financeiro nem abre SQL direto
   ✓ event-service.test.ts > expense.service -> EventService — mesma transação do domínio > um save appenda o evento uma única vez no executor da transação corrente
   ✓ event-service.test.ts > expense.service -> EventService — mesma transação do domínio > falha do append derruba o save (não é engolida)

   Test Files  1 passed (1)
        Tests  10 passed (10)
     Start at  00:50:43
     Duration  1.08s
  ```

  Vizinhança do contrato/consumidor (não-vacuidade do que já existia): `npx vitest run src/test/event-service.test.ts src/test/contracts.test.ts src/test/financial-metrics.test.ts` → `Test Files 3 passed (3) / Tests 27 passed (27)`.

  Notas de método (o que cada asserção morde, e não o “caminho feliz”):
  - **Executor da transação**: o fake do `EventRepositoryPort` registra o 3º argumento e a asserção é de **identidade** (`toBe(context.transaction)`), não de igualdade estrutural — um executor diferente (ou ausente) reprova.
  - **Override explícito**: com `{ marker: "savepoint" }` o serviço repassa **exatamente** o executor recebido (`toBe(executor)` **e** `not.toBe(context.transaction)`) — o default não engole a transação aninhada.
  - **Erro não engolido**: `rejects.toBe(failure)` (identidade do `ApplicationError`, não só “rejeitou”) e `appends`/`publishes` com **exatamente 1** chamada — não há retry nem segundo caminho silencioso.
  - **Publish**: o erro de dispatcher usado no fake é `ApplicationError("DEPENDENCY_ERROR", …)`, o mesmo que o `DrizzleOutboxRepository.publishPending` lança quando não há dispatcher composto (`outbox.repository.ts:216-227`).
  - **INV-004**: a asserção extrai os _specifiers_ de import do serviço, exige conjunto **não vazio** (fail-closed contra asserção vacua) e exige zero casamento com `/financ/i` e zero `@/db/`/`drizzle-orm` direto.
  - **Consumidor**: o teste de `expense.service` injeta um `ExpenseRepository` fake **e** um `DefaultEventService` real sobre o fake do port; assere que o evento sai **uma vez**, no `context.transaction` do contexto, com `eventType`/`aggregateType`/`aggregateId`/`idempotencyKey`/`occurredAt`/payload derivados da despesa salva — e que a falha do append derruba o `save`.

- **EVIDENCE-C — typecheck (S4):**

  ```text
  $ npx tsc -p tsconfig.json --noEmit
  TSC_EXIT=0
  ```

  (sem saída; `tsconfig.json` inclui `src/**/*.ts` e `scripts/**/*.ts` — o `test-outbox.ts` inalterado continua tipando contra o novo construtor do `DefaultExpenseService`.)

- **EVIDENCE-D — formatação (S4):**

  ```text
  $ npx prettier --check src/server/services/event.service.ts src/server/services/expense.service.ts src/test/event-service.test.ts
  Checking formatting...
  All matched files use Prettier code style!
  PRETTIER_EXIT=0
  ```

- **EVIDENCE-E — integração: `scripts/db/test-outbox.ts` **inalterado** e verde em container efêmero PG17 (S4):**

  ```text
  $ docker run -d --name pqdl-n2b-eventservice -e POSTGRES_DB=preco_que_da_lucro_test \
      -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:17-alpine
  81432d4e72ee8ce03a59c605844bb267fb9dfbfe6e446584275f8d6308728fdf

  $ docker ps --format '{{.Names}}\t{{.Ports}}'
  pqdl-n2c-mem-d2            127.0.0.1:5437->5432/tcp        # container do squad MEM (N2C), independente
  pqdl-n2b-eventservice      0.0.0.0:5433->5432/tcp          # o MEU efêmero
  preco-que-da-lucro-postgres 0.0.0.0:5432->5432/tcp         # :5432 do projeto — INTOCADO

  $ env DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/preco_que_da_lucro_test' \
        DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5433/preco_que_da_lucro_test' \
        DATABASE_DRIVER=node-postgres npx tsx scripts/db/test-outbox.ts
  T1 atomicidade: rollback do domínio sem evento órfão + falha do evento sem despesa: OK
    e2a1af61-bd4d-4407-8136-0e6719347490 → worker=worker-1 · efeitos=1
    70d6905a-ceb6-423e-9cae-165c29f21164 → worker=worker-1 · efeitos=1
    e1799a42-0aa7-49ef-b155-8907f2c50cd5 → worker=worker-2 · efeitos=1
    7cf87893-1dc7-4882-aa6e-37667fa20609 → worker=worker-2 · efeitos=1
    inbox: 70d6905a-ceb6-423e-9cae-165c29f21164 ← consumer-1
    inbox: 7cf87893-1dc7-4882-aa6e-37667fa20609 ← consumer-2
    inbox: e1799a42-0aa7-49ef-b155-8907f2c50cd5 ← consumer-2
    inbox: e2a1af61-bd4d-4407-8136-0e6719347490 ← consumer-1
  T2 claim concorrente: 2 workers com SKIP LOCKED dividem o lote sem repetir: OK
    710c5d70-9127-4902-a1d4-99568708d24f → efeito consumer-idempotent=1 após 3 entregas · consumer-other=1
  T3 idempotência: mesmo evento 2× ⇒ 1 efeito (inbox persistida por consumidor): OK
  T4 falha: attempts++ + available_at futuro + retry limitado por maxAttempts: OK
  T5 isolamento: RLS por tenant sob app_runtime + WITH CHECK do append cruzado: OK
  Outbox §23 (23.1 + 23.2): atomicidade, claim concorrente, idempotência: OK
  $ echo $?
  0
  ```

  (rodado sobre banco **recriado do zero** — `drop database`/`create database` antes da corrida —, de modo que as 17 migrations e todo o estado vêm da corrida e não de sobra da anterior)

  ```text
  $ docker exec pqdl-n2b-eventservice psql -U postgres -d preco_que_da_lucro_test \
      -c "select event_type, aggregate_type, status, count(*) from outbox_events group by 1,2,3 order by 1;" \
      -c "select (select count(*) from expenses) as expenses, (select count(*) from outbox_events) as events, (select count(*) from drizzle.__drizzle_migrations) as migrations;"
    event_type   | aggregate_type | status  | count
  ---------------+----------------+---------+-------
   expense.saved | expense        | pending |     2
  (1 row)

   expenses | events | migrations
  ----------+--------+------------
          0 |      2 |         17
  (1 row)
  ```

  **Leitura correta do `psql` acima (correção V-WP1g — atribuição, não número):** essas 2 linhas **não** vêm do caminho `EventService`: `seedFixtures` apaga `outbox_events` e `expenses` dos dois tenants (`scripts/db/test-outbox.ts:104-105`) e roda no início de T2 (`:437`) e de T5 (`:290`) — a linha que T1 commitou via `expenseService.save` é removida ali. As 2 `expense.saved/pending` são as de **T5**, que appenda **direto no `outboxRepository`** para provar RLS/claim (`t5:a` em `:291-300`, `t5:b` em `:301-310`); e `expenses = 0` é o efeito do mesmo `delete` (`:105`), **não** do rollback de T1. O que esta consulta prova é apenas **onde** a corrida rodou (banco efêmero recriado do zero, `migrations = 17`, nada no `:5432`) — não a fiação nova.

  Onde cada pedaço do aceite fica provado, então:
  - **`EventService → port` (executor da transação, DI, erro não engolido):** testes **unitários** de `src/test/event-service.test.ts` — o fake registra o terceiro argumento e a asserção é `toBe(context.transaction)`, com o teste do consumidor injetando `DefaultEventService` real e mostrando que o `save` do `expense.service` passa pelo serviço com o executor da transação (EVIDENCE-B), mais as sondas de EVIDENCE-F;
  - **append na mesma transação do domínio (integração):** `test-outbox.ts` **inalterado** e verde — em T1, `expenseService.save` é chamado em `:178` (bloco de rollback `:175-188`) e `:203-209` (commit), e as asserções correspondentes (`:190-201` rollback sem evento órfão; `:229` commit da despesa persiste exatamente um evento) rodam sobre o caminho `expenseService.save → EventService → outboxRepository`; já `:246-277` prova a falha do append **direto no repositório** desfazendo a mutação. É a E2 do item;
  - **efeito do `EventService` no caminho do repositório:** coberto por T1 (o evento sai com `event_type`/`aggregate_type`/`idempotency_key`/payload esperados) — a sonda 3 de EVIDENCE-F mostra que esse teste morre se o `expense.service` deixar de appendar.

  ```text
  $ docker rm -f pqdl-n2b-eventservice
  pqdl-n2b-eventservice
  $ docker ps --format '{{.Names}}\t{{.Ports}}'
  pqdl-n2c-mem-d2            127.0.0.1:5437->5432/tcp
  preco-que-da-lucro-postgres 0.0.0.0:5432->5432/tcp     # só o do projeto, intocado
  ```

- **EVIDENCE-F — as asserções novas são capazes de falhar (sondas descartáveis, revertidas):**

  ```text
  $ # sonda 1: EventService.append deixa de repassar o executor ao port
  $ npx vitest run src/test/event-service.test.ts
     × append usa o executor da transação do domínio quando nenhum é informado
     × append honra o executor explícito (transação/savepoint do chamador)
     × um save appenda o evento uma única vez no executor da transação corrente
  AssertionError: expected undefined to be {} // Object.is equality
  AssertionError: expected undefined to be { marker: 'savepoint' } // Object.is equality
  AssertionError: expected undefined to be {} // Object.is equality
        Tests  3 failed | 7 passed (10)
  ```

  ```text
  $ # sonda 2: publishPending engole a falha do dispatcher (try/catch → 0)
  $ npx vitest run src/test/event-service.test.ts
     × publishPending propaga o erro do dispatcher — não engole a falha
  AssertionError: promise resolved "+0" instead of rejecting
        Tests  1 failed | 9 passed (10)
  ```

  ```text
  $ # sonda 3: expense.service.save deixa de appendar o evento (integração, container efêmero)
  $ npx tsx scripts/db/test-outbox.ts
  AssertionError [ERR_ASSERTION]: commit da despesa deve persistir exatamente um evento
  $ echo $?
  1
  ```

  Todas as sondas foram revertidas; o estado final é o do commit (`npx vitest run src/test/event-service.test.ts` → `10 passed`; `npx prettier --check` nos 3 arquivos → exit 0; `git status --short` limpo logo após o commit). A sonda 1 é a que prova que o **executor** é o que está sob teste (não o default do repositório); a 3 é a que prova que o `test-outbox.ts` inalterado **morde** a troca de fiação que este item fez.

- **EVIDENCE-G — escopo/diff (S5):**

  ```text
  $ git show --stat --oneline da910e5
  da910e5 feat(services): EventService runtime over the M-04 port — expense.service uses it (WP-1g)
   src/server/services/event.service.ts   |  51 +++++++
   src/server/services/expense.service.ts |  14 +-
   src/test/event-service.test.ts         | 249 +++++++++++++++++++++++++++++++++
   3 files changed, 307 insertions(+), 7 deletions(-)

  $ git show --numstat --oneline da910e5
  51	0	src/server/services/event.service.ts
  7	7	src/server/services/expense.service.ts
  249	0	src/test/event-service.test.ts
  ```

  Diff estritamente dentro do escopo exclusivo do card. **`docs/specs/M-02/matrix.yaml` NÃO foi editado** (nem `matrix.overlay.yaml`) — a passagem de `contract-only` para `implemented` (`matrix.yaml:1353-1357`) é da regeneração do MAESTRO. Também **intocados**: `src/server/repositories/outbox.repository.ts`, `src/server/services/outbox.worker.ts`, `src/server/contracts/event.contracts.ts`, `scripts/db/test-outbox.ts`, `drizzle/**`, `src/db/schema.ts`, `package.json`, `docker-compose.yml`, `EXECUTION-STATE-PROGRAM.md`, `QUEUE.md`, `PROGRESS.md`, `SUPERVISION-LOG.md`, `DECISIONS-PENDING/**`, `SPEC-CARDS/**` e o repo principal. **Nada pushado.**

- **riscos / limites conhecidos:**
  1. **O `EventService` é hoje um caso de uso fino**: exatamente os dois métodos do port (append no executor da transação + `publishPending`), com a resolução explícita do executor. É o que o card pede (“sobre o port existente”, sem consumidor de negócio, sem mexer no worker); retry/backoff, registro de handler ou leitura de fila permanecem no `OutboxWorker` e no repositório — quem os move para cá seria uma mudança de fronteira, não deste item.
  2. **A troca de tipo do 2º parâmetro do construtor** (`EventRepositoryPort` → `EventService`) é compatível estruturalmente (mesmas assinaturas), então nenhum chamador que injetasse um port quebra em tipo. Não há, no repositório, nenhum chamador que faça isso (único uso é o singleton `expenseService`; `test-outbox.ts` cobre o caminho de runtime) — verificado por `grep` e por `tsc` exit 0.
  3. **`eventService` (singleton) é composto com `outboxRepository`** (que tem `dispatcher` indefinido até a composição do worker): chamar `eventService.publishPending` cedo falha alto com `DEPENDENCY_ERROR` — comportamento herdado do repositório (`outbox.repository.ts:216-227`), deliberado (“não perder a fila em silêncio”) e agora **provado por teste** (não engolido).
  4. **Escopo de teste unitário**: as asserções de executor/erro usam um fake do port; a garantia de atomicidade real (rollback conjunto) continua sendo a de `test-outbox.ts` contra Postgres — que este item reexecutou. Não há teste de RLS novo (nada de schema mudou).
  5. Nada aqui mede performance/SLO: o item é de fronteira de aplicação, sem caminho novo de I/O (o número de round-trips para um `save` de despesa é o mesmo de antes).

- **o que NÃO foi feito (deliberadamente, por fronteira do card):**
  - **`matrix.yaml`/`matrix.overlay.yaml` não tocados** (regeneração e promoção de status são do MAESTRO) — declarado expressamente.
  - Nada de `drizzle/**`/`src/db/schema.ts`/migration (não houve DB novo); nenhum container persistente; **`:5432` intocado** (o efêmero `pqdl-n2b-eventservice` rodou em `5433` e foi **removido ao fim**).
  - Nenhum consumidor de negócio criado; worker (`outbox.worker.ts`) e repositório do outbox intocados; contrato `event.contracts.ts` não renomeado nem alterado.
  - Não rodei `npm install`, build, ESLint, `npm run check`, `db:test` completo nem a suíte inteira (validação project-wide é do MAESTRO na integração); rodei apenas o teste do item, `test-outbox.ts`, `tsc` e `prettier` nos arquivos tocados.
  - Sem push, sem ledger, sem `QUEUE.md`/`PROGRESS.md`/`SUPERVISION-LOG.md`, sem `SPEC-DELTAS` (nenhuma divergência de spec foi encontrada: o contrato M-04 tem append/publishPending e o card pede exatamente isso).

- **propostas de integração (quem aplica é o MAESTRO):**
  1. `docs/specs/M-02/matrix.yaml:1353-1357` — `EventService`: `contract-only` (path `src/server/contracts/event.contracts.ts`) → **`implemented`** com path `src/server/services/event.service.ts`; refletir no `matrix.overlay.yaml:42`. Isto é regeneração do MAESTRO (o card proíbe a edição direta).
  2. Nenhuma alteração de `package.json`, registry de migrations ou `scripts/db/test-outbox.ts` é exigida por este item.
  3. Registro para o STEWARD: com `D5`/a emenda do `9.1-ME`, o lado `EventService` do item §9.1 deixa de ser `contract-only` — o que resta do `9.1-ME` é apenas o `MemoryService`, endereçado por **MEM-D2/D3** (squad N2C).
  4. Quando o `OutboxWorker` for composto no wiring de aplicação, a composição natural é injetá-lo no `DrizzleOutboxRepository` e deixar `eventService.publishPending` como a porta de drenagem (já é o que o serviço expõe).

- **rollback:** `git revert da910e5` (o claim é o segundo commit e pode ser revertido junto).
