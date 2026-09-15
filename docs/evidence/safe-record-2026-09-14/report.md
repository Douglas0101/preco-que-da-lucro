# F2C-1 — safe-record sistêmico (O27, Onda 3)

**Base:** `f47318a` · **Worktree:** `.worktree-onda3-saferecord` · **Branch:** `ops/onda3-saferecord`
**Origem:** achado F2C-1 do V14c (`docs/evidence/plan-partials-2026-09-13/EXECUCAO-ONDA2.md` §6.5), que provou no §19.3
que um `record()` que lança pode rejeitar uma transação já commitada, substituir o erro real e pendurar o
checkout do pool. A correção de `client.server.ts` deixou a **mesma classe de defeito em 11 sítios**.

## 1. O helper e o seu contrato

`src/instrumentation/safe-record.ts` (novo):

```ts
export interface RecordableMetric {
  record(value: number, attributes?: Attributes): void;
}

export function recordSafely(
  metric: RecordableMetric,
  ...measurement: [value: number, attributes?: Attributes]
): void {
  try {
    metric.record(...measurement);
  } catch {
    // Observabilidade nunca quebra o caminho da request.
  }
}
```

Contrato:

| Item                      | Garantia                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `record` que lança        | engolido; nunca propaga para o chamador (nem dentro de `finally`/`catch`)                                                        |
| Argumentos                | encaminhados **exatamente como recebidos** — `recordSafely(m, 7)` chama `m.record(7)` (um argumento), não `record(7, undefined)` |
| Valor de retorno          | `void`; nenhum call site depende de retorno                                                                                      |
| Custo no caminho saudável | um `try/catch` por registro; nenhuma alocação adicional além do array de rest args                                               |

**Local — por quê.** O plano da onda sugeria `src/lib/observability/**`, mas a tarefa mandou seguir a convenção
do repositório para helpers de instrumentação compartilhados. A convenção é `src/instrumentation/`
(`telemetry.ts`, `http-request-span.ts`, `sql-redactor.ts`): é onde o próprio `applicationMetrics` vive, onde
está a regra documentada ("observabilidade nunca quebra o caminho da request", `telemetry.ts:44-57`) e onde
quem for adicionar um sítio novo vai procurar. O módulo só importa `type Attributes` — nenhuma dependência
de runtime nova.

## 2. Os 11 sítios migrados

Todos passaram de `applicationMetrics.<m>.record(args)` para `recordSafely(applicationMetrics.<m>, args)`:

| #   | Arquivo:linha (pós)                            | Função que envolve                        | Métrica                | Argumentos                            |
| --- | ---------------------------------------------- | ----------------------------------------- | ---------------------- | ------------------------------------- |
| 1   | `src/lib/chat.functions.ts:222`                | `runModelAttempt` — dentro do `finally`   | `aiDuration`           | `[elapsedMs, { model, attempt }]`     |
| 2   | `src/start.ts:37`                              | `handleResponseError`                     | `requestDuration`      | `[ms, { method, status }]`            |
| 3   | `src/start.ts:71`                              | `handleUnexpectedError`                   | `requestDuration`      | `[ms, { method, status }]`            |
| 4   | `src/start.ts:111`                             | `requestPolicyMiddleware` (caminho feliz) | `requestDuration`      | `[ms, { method, status }]`            |
| 5   | `src/lib/chat-execution.server.ts:191`         | `acknowledgeGatewayResponse`              | `aiTimeToAcknowledge`  | `[ms]`                                |
| 6   | `src/lib/chat-execution.server.ts:421`         | `handleModelResponse` (§29)               | `aiTimeToFirstContent` | `[ms]`                                |
| 7   | `src/lib/chat-execution.server.ts:422`         | `handleModelResponse` (§29)               | `aiTimeToFinal`        | `[ms]`                                |
| 8   | `src/server/services/dashboard.service.ts:185` | `DefaultDashboardService.getSummary`      | `salesSummaryDuration` | `[ms, { period }]`                    |
| 9   | `src/lib/ai/tool-runner.ts:123`                | `persistRejected`                         | `toolDuration`         | `[ms, { tool, status: "rejected" }]`  |
| 10  | `src/lib/ai/tool-runner.ts:358`                | `runRegisteredTool` (sucesso)             | `toolDuration`         | `[ms, { tool, status: "succeeded" }]` |
| 11  | `src/lib/ai/tool-runner.ts:389`                | `runRegisteredTool` (catch)               | `toolDuration`         | `[ms, { tool, status }]`              |

O `start.ts:110` (caminho feliz do middleware) não estava na lista de 2 itens do achado, mas o total de 11
sítios de `record` fora de `client.server.ts` só fecha com ele — e o próprio achado o descreve como "um
único sítio lógico" com `:70` (o `catch` do middleware re-registra em `handleUnexpectedError`). Foi migrado.

**Idioma único verificado estruturalmente:** o teste
`recordSafely > nenhum módulo de produção chama applicationMetrics.*.record() direto` varre `src/**` (sem
testes, sem o próprio helper). Pré-fix ele acusa **14 ocorrências** (os 11 sítios + os 3 helpers de
`client.server.ts`); pós-fix, zero.

## 3. Prova red-first (o que falhou antes da correção)

`npx vitest run src/test/safe-record.test.ts` com a migração revertida por `git show HEAD:<arquivo>`:

```
Tests  12 failed | 8 passed (20)
```

Os 12 vermelhos são os 11 testes de sítio + o teste estrutural; os 8 verdes são os 6 testes de
byte-identidade (que passam nos dois estados — ver §4) e 2 testes de contrato do helper.

| #   | Teste vermelho (pré-fix)                      | Falha observada                                                                                                                                                                                           |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | start.ts — caminho feliz                      | `Error: metric boom` a partir de `src/start.ts:110`; o `catch` do próprio middleware registra um `request.failed` **falso** com `code: INTERNAL_ERROR` e `message: "metric boom"` (o 200 vira 500 logado) |
| 2   | start.ts — `handleUnexpectedError`            | `Error: metric boom` a partir de `src/start.ts:70`; a resposta 500 nunca é devolvida                                                                                                                      |
| 3   | start.ts — `handleResponseError`              | `AssertionError: expected Error: metric boom to be Response { status: 503, ... }` — o erro real **é substituído**                                                                                         |
| 4   | chat.functions — `runModelAttempt`            | `promise rejected "Error: metric boom" instead of resolving` (throw dentro do `finally` mascara a resposta do gateway)                                                                                    |
| 5   | chat-execution — `acknowledgeGatewayResponse` | `Error: metric boom` em `chat-execution.server.ts:190`; o chat inteiro rejeita                                                                                                                            |
| 6   | chat-execution — `aiTimeToFirstContent`       | idem, `:420` (a mensagem já foi persistida e mesmo assim o envio falha)                                                                                                                                   |
| 7   | chat-execution — `aiTimeToFinal`              | idem, `:421`                                                                                                                                                                                              |
| 8   | dashboard — `getSummary`                      | `Error: metric boom` em `dashboard.service.ts:184`; o resumo nunca chega ao chamador                                                                                                                      |
| 9   | tool-runner — rejeição por Zod                | `Error: metric boom` em `tool-runner.ts:122`; o `VALIDATION_ERROR` vira rejeição da tool                                                                                                                  |
| 10  | tool-runner — sucesso                         | `Error: metric boom` em `tool-runner.ts:357`; a execução já persistida vira falha                                                                                                                         |
| 11  | tool-runner — catch (`AI_TIMEOUT`)            | `Error: metric boom` em `tool-runner.ts:388`; o `AI_TIMEOUT` é substituído                                                                                                                                |
| 12  | estrutural                                    | `expected [ Array(14) ] to deeply equal []` — 14 sítios diretos                                                                                                                                           |

Todos os testes usam stub que **registra os argumentos antes de lançar** e um `Promise.race` com deadline de
2 s (`withinDeadline`), para que um eventual hang falhe de forma determinística em vez de travar a suíte.
Nenhum sítio dos 11 é invocado a partir de callback sem `try/catch` (essa era a assinatura do checkout do
pool, já corrigido em `client.server.ts`), então nenhum hang foi observado — o deadline é a garantia, não a
evidência de um hang real.

## 4. Byte-identidade no caminho saudável

**Método.** Os 6 testes de byte-identidade usam um stub que **só captura** (não lança) e comparam
`record.mock.calls` com `toStrictEqual` — que distingue aridade (`[[7]]` ≠ `[[7, undefined]]`). Eles foram
executados **nos dois estados**: pré-fix (arquivos de produção em `HEAD`) e pós-fix. Os dois runs são verdes,
ou seja, os mesmos argumentos que o código antigo emitia são os que o código migrado emite:

```
pré-fix:  Tests  12 failed | 8 passed (20)   # os 6 de byte-identidade estão entre os 8 verdes
pós-fix:  Tests  20 passed (20)
```

| Sítio                         | Args afirmados (idênticos pré e pós)                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| start.ts (3 caminhos)         | `[ms, { method: "GET", status: 200 }]`, `[ms, { method: "GET", status: 503 }]`, `[ms, { method: "GET", status: 500 }]` |
| chat.functions (`aiDuration`) | `[ms, { model: <string>, attempt: 1 }]`                                                                                |
| chat-execution (3 fases)      | `[ms]` em cada um dos três histogramas                                                                                 |
| dashboard                     | `[ms, { period: "quarter" }]`                                                                                          |
| tool-runner (3 caminhos)      | `[ms, { tool: "create_product", status: "rejected" \| "succeeded" \| "cancelled" }]`                                   |
| client.server (3 métricas)    | ver §5                                                                                                                 |

Diff dos call sites (pré → pós), que é a origem desses argumentos — só a chamada muda de forma:

```
- applicationMetrics.dbDuration.record(durationMs);
+ recordSafely(applicationMetrics.dbDuration, durationMs);

- applicationMetrics.dbPoolWaitTime.record(durationMs, { driver });
+ recordSafely(applicationMetrics.dbPoolWaitTime, durationMs, { driver });

- applicationMetrics.requestDuration.record(performance.now() - startedAt, { method, status });
+ recordSafely(applicationMetrics.requestDuration, performance.now() - startedAt, { method, status });
```

O teste de contrato do helper fixa a aridade: `recordSafely(m, 7)` → `calls === [[7]]` e
`recordSafely(m, 8, { status: 200 })` → `calls === [[8, { status: 200 }]]`.

## 5. `client.server.ts` delega — os três helpers

Os três helpers verificados pelo V14c passaram a delegar (`recordQueryDuration`, `recordTransactionDuration`,
`recordPoolWait`), mantendo os comentários que explicam **por que cada sítio é perigoso**. Nome, valor e
atributos continuam byte-idênticos:

| Helper                      | Args afirmados pós-delegação                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| `recordPoolWait`            | `[[ms, { driver: "node-postgres" }]]`                                         |
| `recordQueryDuration`       | `[[ms, { "db.operation.name": "SELECT", "db.system.name": "postgresql" }]]`   |
| `recordTransactionDuration` | `[[ms]]` (chamada de **um** argumento — a delegação não introduz `undefined`) |

O mesmo teste afirma esses três arrays com o stub **só capturando** e rodou verde também com `client.server.ts`
em `HEAD` (versão try/catch), o que fixa a igualdade entre as duas implementações. A suíte §19.3
(`round-trip-instrumentation.perf-waves.test.ts`, 33 testes) permanece verde, inclusive os casos "um record que
lança não rejeita transação já commitada / não substitui o erro real / não pendura pool.query".

## 6. O que deliberadamente NÃO mudou

- **`applicationMetrics.<counter>.add(...)`** (14 sítios: `errors`, `aiTimeouts`, `aiQuotas`, `toolExecutions`,
  `conversationStateTransitions`, `financialStates`, `snapshotCreatedTotal`, …): fora do escopo do F2C-1, que
  fala de `record`. Mesma classe de defeito em teoria; **residual declarado** para lane própria.
- **`applicationMetrics` em `telemetry.ts`** e os callbacks de observable do pool: já são defensivos.
- **Nenhum teste existente foi afrouxado, pulado ou removido.** A única alteração em teste pré-existente é
  mecânica: `FakeTransaction`/`fakeContext` de `tool-runner.persistence.test.ts` foram movidos para
  `src/test/helpers/tool-runner-fakes.ts` (convenção da pasta `helpers/`) para serem reusados pelos testes de
  sítio; a suíte de persistência continua com os mesmos 11 testes, verdes.
- **`docs/specs/**`, manifests, `AGENTS.md`:** intocados.

## 7. Gates

| Gate                                                 | Resultado                       |
| ---------------------------------------------------- | ------------------------------- |
| `npx vitest run src/test/safe-record.test.ts`        | 20 passed                       |
| `npx vitest run` (suíte completa)                    | 72 arquivos / 669 testes passed |
| Suítes que tocam arquivos mudados (16 arquivos)      | 161 testes passed               |
| `npx tsc -p tsconfig.json --noEmit`                  | limpo                           |
| `npx eslint` nos 10 arquivos mudados/novos           | limpo                           |
| `npx prettier --check` nos 10 arquivos mudados/novos | limpo                           |

Residual não verificável aqui: o comportamento em produção com um exporter OTLP real (rede/backpressure) não
foi medido — o defeito e a defesa são locais ao `record`, e o gate é `try/catch`.
