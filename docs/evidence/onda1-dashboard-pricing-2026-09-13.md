# Onda 1 — Dashboard repository com DI + PricingService (§9.1/§9.2)

**Operador:** O7 (worktree `.worktree-onda1-dashboard-pricing`) · **Branch:** `ops/onda1-dashboard-pricing`
**Base:** `27af175` · **Data:** 2026-09-13 · **Escopo:** §9.2 (interfaces/DI) + §9.1 Pricing

## O que mudou

### §9.2 — `DashboardRepository` + DI

- `src/server/repositories/dashboard.repository.ts`: exporta `interface DashboardInputs`,
  `interface DashboardRepository { loadInputs(context): Promise<DashboardInputs> }`,
  `class DrizzleDashboardRepository implements DashboardRepository` e o singleton tipado
  `dashboardRepository`. O corpo de query foi movido verbatim para `loadInputs` (mesmos 6 selects
  tenant-scoped, mesmo número fixo de queries por produto).
- A função exportada `loadDashboardInputs(context)` virou adapter que delega ao singleton — importadores
  existentes seguem funcionando (`src/test/query-performance.test.ts`,
  `src/test/products-read-models.golden.perf-waves.test.ts`).
- `src/server/services/dashboard.service.ts`: `interface DashboardSummary`, `interface DashboardService`,
  `class DefaultDashboardService` com `constructor(repo: DashboardRepository, sales: SalesService = salesService)`.
  A função `getDashboardSummary(context, period)` segue exportada como adapter do singleton
  `dashboardService` (consumida por `src/lib/dashboard.functions.ts`). O cálculo não mudou:
  `analyzeProduct`, alertas, despesas fixas e o `withSpan("service.dashboard.sales_summary")` foram
  preservados.

### §9.1 — `PricingService`

- Novo `src/server/services/pricing.service.ts`: `interface PricingService` com
  `calculatePriceFormationFor(input)` (delega a `calculatePriceFormation` de `src/lib/finance.ts`) e
  `appendPricingSnapshot(context, input)` (snapshot `calculationType: "pricing"` com
  `deriveSnapshotIdempotencyKey`, `FINANCE_ENGINE_VERSION`, métricas e log de falha). DI do
  `CalculationSnapshotService` no construtor; singleton `pricingService`.
- `src/server/services/diagnostic.service.ts` passou a chamar `pricingService.calculatePriceFormationFor`
  e `pricingService.appendPricingSnapshot` dentro do mesmo `try` do snapshot `diagnostic`. A chave de
  idempotência do snapshot de pricing permanece idêntica (mesmo `inputs`: `productId`,
  `nonPercentageVariableUnitCost`, `targetContributionRate`, `marketAvgPrice`) e o output do
  `DiagnosticView` é inalterado. Falha de snapshot continua absorvida (métrica + `logJson`), sem
  propagar para a resposta.

## Arquivos

| Arquivo                                           | Mudança                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `src/server/repositories/dashboard.repository.ts` | interface + classe + singleton + adapter            |
| `src/server/services/dashboard.service.ts`        | `DefaultDashboardService` + adapter                 |
| `src/server/services/pricing.service.ts`          | novo service                                        |
| `src/server/services/diagnostic.service.ts`       | passa a usar `pricingService`                       |
| `src/test/dashboard.service.test.ts`              | novo (DI + adapters)                                |
| `src/test/pricing.service.test.ts`                | novo (delegação, snapshot, replay, falha absorvida) |

## Validação (worktree, HEAD `27af175` + diff)

| Comando                                                                                                                                    | Exit | Resultado                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------- |
| `npx vitest run src/test/sales.service.test.ts src/test/query-performance.test.ts src/test/products-read-models.golden.perf-waves.test.ts` | 0    | 3 arquivos / 17 testes      |
| `npx vitest run src/test/dashboard.service.test.ts src/test/pricing.service.test.ts`                                                       | 0    | 2 arquivos / 10 testes      |
| `npx vitest run` (suíte completa)                                                                                                          | 0    | 52 arquivos / 454 testes    |
| `./node_modules/.bin/prettier --check` (6 arquivos)                                                                                        | 0    | código formatado            |
| `./node_modules/.bin/eslint` (6 arquivos)                                                                                                  | 0    | sem avisos                  |
| `npm run typecheck`                                                                                                                        | 0    | sem erros                   |
| `npm run m02:boundaries`                                                                                                                   | 0    | boundary limpa              |
| `npm run m02:matrix:check`                                                                                                                 | 1    | drift esperado (ver abaixo) |

Nota de matriz: `scripts/m02-matrix.ts` serializa `transactionSites` com linha por site; o 6º/7º selects
de `dashboard.repository.ts` mudaram de linha (18,26,32,43,54,62 → 35,43,49,60,71,82) e o catálogo do
overlay ainda não tem as entradas novas. `m02:matrix:generate` é do supervisor (arquivo proibido ao
operador); a regeneração + entradas do overlay estão no manifest request do handoff. Nenhum teste toca
banco nesta entrega (sem token DB).

## Riscos / observações

- `DefaultDashboardService` usa `salesService` singleton como default; testes que não injetam `sales`
  tocariam o banco — os testes novos sempre injetam o fake.
- O snapshot de pricing agora é absorvido dentro do `PricingService`; a métrica de falha continua
  `snapshotFailureTotal{type:"diagnostic"}` e o log `diagnostic.snapshot_failed` (paridade com o
  comportamento anterior de um único `try/catch`).
- `diagnostic.service.ts` segue sem import de DB direto; `pricing.service.ts` não importa DB (boundary OK).
