# Financial metrics (§19.5) — choke point, dedup do diagnóstico e mapeamento dos 4 nomes (2026-09-14)

- **ambiente:** `dev-evidence` — worktree `.worktree-onda2-finmetrics`, branch `ops/onda2-finmetrics`,
  base `9f8280e` (já contém Onda 2A: I13/I14/I15). Vitest 4.1.11 (jsdom + setup local), Postgres 17 local
  (`127.0.0.1:5432`) para o env-guard; nenhuma suíte deste artefato abre conexão de banco
  (transações são fakes em memória).
- **método:** leitura do caminho real de emissão + testes de unidade que espionam o meter
  (`vi.spyOn(applicationMetrics.<counter>, "add")`) e contam chamadas por chave de atributo. O caminho do
  diagnóstico **não** mocka `product-detail.service` nem `product-read-model.service`: a duplicação só é
  visível com o loader real.
- **n:** 14 testes (2 arquivos) verdes nas suítes tocadas; 63 testes (10 arquivos) nas suítes de
  regressão que importam `product-read-model` / `dashboard` / `diagnostic` / `simulation`; **531 testes
  (61 arquivos)** verdes na suíte unitária completa.
- **janela:** 2026-09-14T03:29Z → 2026-09-14T03:35Z (UTC, execução local).
- **fonte:** código versionado (`src/server/services/product-read-model.service.ts`,
  `financial.service.ts`, `diagnostic.service.ts`, `src/lib/products.functions.ts`) + raw em
  `docs/evidence/financial-metrics-2026-09-14-before.txt` e
  `docs/evidence/financial-metrics-2026-09-14-after.txt`.
- **hypothesis:** mover a emissão de `app.financial.states` para o choke point
  `calculateProductReadModel` (usado por lista, detalhe e dashboard) fecha §19.5 sem duplicar série — desde
  que nenhum consumidor do choke point emita o mesmo estado por conta própria.
- **metric:** contagem de emissões de `app.financial.states` por cálculo de produto (lista/detalhe/dashboard)
  e por view de diagnóstico; nº de séries distintas necessárias para os 4 nomes do §19.5.
- **before:** ver inventário abaixo (baseline `9f8280e` + estado parcial).
- **change:** choke point passa a emitir `{state, engine_version}`; `recordFinancialState()` cobre os 4
  caminhos de `runFinancialSimulation` (incluindo o early-return `volumeSource === "real"`); emissões diretas
  em `products.functions.ts` e em `diagnostic.service.ts` removidas; testes por caminho + não-duplicação.
- **after:** exatamente **1** emissão de `app.financial.states` por cálculo de produto e por view de
  diagnóstico; 4 nomes do §19.5 derivados por soma/label, sem counter novo.
- **result:** duplicação do diagnóstico **confirmada e corrigida** (medida: 2 chamadas por view antes;
  1 depois). Suítes tocadas 14/14 verdes, regressão 63/63 verdes, suíte unitária completa 531/531 verdes
  (54 s), `prettier --check` e `tsc --noEmit` limpos.
- **decision:** `keep` — manter a emissão única no choke point; o status da view do diagnóstico permanece em
  `app.diagnostic.calculation_total{status}` (métrica pré-existente, sem perda de informação).

## 1. Inventário de emissão — antes vs. depois

### Baseline (`9f8280e`, antes do trabalho parcial)

| Local                                                               | Emissão                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/products.functions.ts:166` (usado por lista **e** detalhe) | `financialStates.add(1, { state })` — 1 por produto                                                                      |
| `src/server/services/diagnostic.service.ts:217`                     | `financialStates.add(1, { state })` — 1 por view                                                                         |
| `src/server/services/product-read-model.service.ts`                 | nenhuma                                                                                                                  |
| `src/server/services/dashboard.service.ts`                          | **nenhuma** (dashboard fora do §19.5)                                                                                    |
| `src/server/services/financial.service.ts:140`                      | `financialEngineVersion.add(1, { version })` só no caminho normal; early-return `volumeSource === "real"` **não** emitia |

Sem label `engine_version` em `app.financial.states`; dashboard invisível para §19.5; o caminho de volume real
("erro esperado") não contava.

### Estado parcial (herdado, sem commit) — o que já estava feito

- Emissão movida para o choke point `product-read-model.service.ts` (cobre lista/detalhe/dashboard).
- `financial.service.ts`: `recordFinancialState()` + `financialEngineVersion` também no early-return `real`.
- `products.functions.ts`: emissão direta removida.
- `diagnostic.service.ts:217`: emissão **mantida** e apenas rotulada com `engine_version` ⇒ **2 emissões por
  view de diagnóstico**.

### Depois (esta branch)

| Local                                                                                           | Emissão                                             | Cardinalidade                                    |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `src/server/services/product-read-model.service.ts:35` (choke point: lista, detalhe, dashboard) | `financialStates.add(1, { state, engine_version })` | 1 por **cálculo de produto**                     |
| `src/server/services/financial.service.ts` `recordFinancialState()`                             | `financialStates.add(1, { state, engine_version })` | 1 por simulação: `ok` / `incomplete` / `invalid` |
| `src/server/services/financial.service.ts` (early-return `real`, overflow)                      | `recordFinancialState("invalid")`                   | 1 por simulação                                  |
| `src/server/services/financial.service.ts:133/141`                                              | `financialEngineVersion.add(1, { version })`        | 1 por simulação (ambos os ramos)                 |
| `src/server/services/diagnostic.service.ts:218`                                                 | `diagnosticCalculationTotal.add(1, { status })`     | 1 por view (**só** o status da view)             |
| `src/lib/products.functions.ts`                                                                 | — (depende do choke point)                          | 0                                                |

Únicos dois call-sites de `financialStates` no `src/`: `financial.service.ts:126` e
`product-read-model.service.ts:35` (`grep -rn "financialStates" src/`).

## 2. Mapeamento dos 4 nomes do §19.5 (sem counter novo)

Nenhum counter novo foi criado: o desenho existente (`app.financial.states` com label `state` +
`app.financial.engine_version` com label `version`) é fiel aos 4 nomes.

| Nome §19.5                     | Série OTel                                                    | Derivação                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calculation_count`            | `app.financial.states`                                        | soma do counter em **todos** os `state` (`= ok + incomplete + invalid`)                                                                                                             |
| `incomplete_calculation_count` | `app.financial.states{state="incomplete"}`                    | soma por label                                                                                                                                                                      |
| `invalid_calculation_count`    | `app.financial.states{state="invalid"}`                       | soma por label                                                                                                                                                                      |
| `engine_version_distribution`  | `app.financial.states{engine_version="finance-engine/2.0.0"}` | distribuição por label (caminho de cálculo de produto) — corroborada por `app.financial.engine_version{version="finance-engine/2.0.0"}` (contador dedicado do caminho de simulação) |

Por que o mapeamento é fiel:

- O label `state` recebe exatamente os três status de `CalculationResult` (`ok` | `incomplete` | `invalid`),
  isto é, mapeamento 1:1 com os três nomes de contagem; `ok = calculation_count − incomplete − invalid`.
- `engine_version` é o **mesmo** `FINANCE_ENGINE_VERSION` (`finance-engine/2.0.0`) usado no snapshot e no
  diagnóstico, e está presente em **toda** emissão de `app.financial.states` — inclusive na de
  `financial.service.ts` via `recordFinancialState()` — logo a distribuição por versão não tem "buraco".
- `app.financial.engine_version` não foi removido nem duplicado: é o contador de versão do caminho de
  simulação. Para o caminho de cálculo de produto a distribuição vem do label, evitando emitir dois counters
  (e duas séries) para o mesmo evento.

## 3. Achado: duplicação no caminho do diagnóstico — **confirmado**

**Cadeia real (sem mocks):**

```text
getDiagnostic (diagnostic.service.ts)
  └─ loadProductFinancialDetail (product-detail.service.ts:41)
       └─ calculateProductReadModel (product-detail.service.ts:107)
            └─ applicationMetrics.financialStates.add(1, { state: metrics.status, ... })   ← emissão #1
  └─ applicationMetrics.financialStates.add(1, { state: currentResult.status, ... })      ← emissão #2 (removida)
```

**Medições pré-correção** (`financial-metrics-2026-09-14-before.txt`, 3 testes falhando):

1. View `ok`: a lista de chamadas com chave `state` tinha **2** entradas idênticas
   `[1, { state: "ok", engine_version: "finance-engine/2.0.0" }]` (esperado 1).
2. View com produto `invalid`: **2** entradas `{ state: "invalid", ... }` (esperado 1).
3. Caso de divergência (produto `ok`, despesa fixa não numérica ⇒ `breakEvenUnits` inválido): **2** entradas,
   mas com estados **diferentes** — `{ state: "ok" }` (read model) e `{ state: "invalid" }` (view). Ou seja, a
   segunda emissão não era nem sequer uma repetição do mesmo evento: era outro conceito entrando na mesma série.

**Correção:** removida a emissão #2 em `diagnostic.service.ts`. A sobrevivente é a do **choke point**
(`calculateProductReadModel`, emissão #1).

**Justificativa da sobrevivente:**

- §19.5 conta **cálculos financeiros**: o status do choke point é o status do cálculo do produto — o mesmo
  conceito que lista, detalhe e dashboard emitem, o que torna `calculation_count` / `incomplete_` / `invalid_`
  comparáveis entre superfícies (critério B). O caminho do diagnóstico é um dos três consumidores do choke
  point, então ele **precisa** emitir ali.
- O status da view de diagnóstico (`currentResult.status`) **não** é status de cálculo de produto: ele fica
  `invalid` quando o break-even é inválido, mesmo com o cálculo do produto `ok`. Mantê-lo em
  `app.financial.states` inflaria `invalid_calculation_count` com eventos que não são resultados inválidos de
  cálculo de produto — e o faria **em dobro** para o caso comum.
- Não há perda de informação: `app.diagnostic.calculation_total{status}` (pré-existente, intocada) registra
  exatamente o status da view. O teste de divergência afirma isso explicitamente:
  `states = [{ state: "ok" }]` **e** `diagnosticCalculationTotal = [{ status: "invalid" }]`.
- A contagem por view passa a ser 1, igual à de lista/detalhe/dashboard (critério D).

## 4. Cobertura de teste (critério E)

| Caminho                                                | Teste                                                                                       | Arquivo                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| `ok` no choke point                                    | "emite estado ok com a versão do motor"                                                     | `src/test/financial-metrics.test.ts` |
| `incomplete` no choke point                            | "emite estado incomplete com a versão do motor"                                             | idem                                 |
| `invalid` no choke point                               | "emite estado invalid com a versão do motor"                                                | idem                                 |
| lista (1 produto ⇒ 1 evento)                           | "não duplica a emissão na lista: um evento por produto"                                     | idem                                 |
| detalhe (1 produto ⇒ 1 evento)                         | "emite o detalhe uma única vez por produto"                                                 | idem                                 |
| dashboard (`ok`+`invalid`+`incomplete`, 1 por produto) | "emite exatamente um evento por produto, em todos os estados (sem duplicação)"              | idem                                 |
| diagnóstico `ok` (1 por view, loader real)             | "emite um único estado por view, no choke point do read model"                              | idem                                 |
| diagnóstico `invalid` (1 por view, loader real)        | "emite um único estado invalid quando o cálculo do produto é inválido"                      | idem                                 |
| diagnóstico, status da view ≠ status do read model     | "conta o status da view em `app.diagnostic.calculation_total`, não no estado do read model" | idem                                 |
| `volumeSource === "real"` emite                        | "registra estado e versão do motor em todos os caminhos, inclusive volume real"             | `src/test/financial.service.test.ts` |

## 5. Comandos exatos e resultados

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test
export DATABASE_ADMIN_URL=$DATABASE_URL
export DATABASE_DRIVER=node-postgres

# pré-correção (para medir a duplicação) — raw: financial-metrics-2026-09-14-before.txt
npx vitest run src/test/financial-metrics.test.ts src/test/financial.service.test.ts
# → Test Files 1 failed | 1 passed (2); Tests 3 failed | 11 passed (14)   [esperado: vermelho]

# pós-correção — raw: financial-metrics-2026-09-14-after.txt
npx vitest run --reporter=verbose src/test/financial-metrics.test.ts src/test/financial.service.test.ts
# → Test Files 2 passed (2); Tests 14 passed (14)

npx vitest run src/test/dashboard.service.test.ts src/test/pricing.service.test.ts \
  src/test/product-completeness.test.ts src/test/finance.boundaries.test.ts \
  src/test/products-read-models.golden.perf-waves.test.ts src/test/bff-create-update-contract.test.ts \
  src/test/observability-spans.test.ts src/test/snapshot-idempotency.test.ts \
  src/test/simulation.service.test.ts src/test/simulation-race.test.tsx
# → Test Files 10 passed (10); Tests 63 passed (63)

# suíte unitária completa (61 arquivos) — lista de arquivos e resumo no raw
npx vitest run --reporter=verbose
# → Test Files 61 passed (61); Tests 531 passed (531); Duration 54.37s

npx prettier --check src/lib/products.functions.ts src/server/services/diagnostic.service.ts \
  src/server/services/financial.service.ts src/server/services/product-read-model.service.ts \
  src/test/financial-metrics.test.ts src/test/financial.service.test.ts
# → All matched files use Prettier code style!

npx eslint src/lib/products.functions.ts src/server/services/diagnostic.service.ts \
  src/server/services/financial.service.ts src/server/services/product-read-model.service.ts \
  src/test/financial-metrics.test.ts src/test/financial.service.test.ts
# → sem saída (0 erros)

npx tsc -p tsconfig.json --noEmit
# → sem saída (0 erros)
```

## 6. Lacunas remanescentes (não fechadas por este recorte)

- **Sem collector OTLP local:** os labels foram verificados por asserção no meter (`counter.add`), não por
  série exportada em backend. A confirmação de export fica para quando houver collector (mesma pendência de
  §19.2/§19.3).
- **`app.financial.states` agrega dois caminhos:** cálculo de produto (choke point) e simulação
  (`runFinancialSimulation`). O label `state` é compartilhado; separar os caminhos exigiria um label novo
  (ex.: `path`), o que ampliaria o escopo e não é pedido pelo §19.5. `calculation_count` deve ser lido como
  "cálculos financeiros" nas duas origens.
- **Erro inesperado em `runFinancialSimulation`** (exceção que não é `DECIMAL_OVERFLOW`) é re-lançado sem
  emissão de estado: não há `CalculationResult` produzido, então não há estado para contar.
- **Achado fora do diff:** o self-scan do editor (`pi-lens`) aponta 4 asserções `as unknown as` em
  `src/lib/products.functions.ts:420-430`. São pré-existentes no `HEAD` e não foram tocadas — corrigi-las
  seria escopo novo.
