# WS-01 — Sales → BFF → Dashboard factual (2026-09-01)

## Mudanças

- `src/server/repositories/sales.repository.ts`: `summaryForPeriod(context, from)` (net revenue + count, `coalesce(sum(net_amount),0)` sem filtro de tenant) e `list(context, range)` (sale + itens com nome do produto via INNER JOIN, cap `LIST_LIMITS.sales = 50`).
- `src/server/services/sales.service.ts`: pass-through `summaryForPeriod`/`list`.
- `src/server/services/dashboard.service.ts`: `getDashboardSummary(context, period)` agora resolve `periodStart(period)` (mês/trimestre/ano, exportada) e soma vendas reais do período; span `service.dashboard.sales_summary` + histograma `app.sales.summary_duration`.
- `src/lib/dashboard.functions.ts`: `period` validado é passado ao service.
- `src/lib/query-options.ts`: `dashboardSummaryQueryOptions(period)` (chave inclui período), `salesListQueryOptions`, `productsListQueryOptions`.
- `src/routes/_authenticated/inicio.tsx`: seletor Mês/Trimestre/Ano (aria-pressed); "Faturamento real" exibe valor factual quando há vendas no período ("—" + literal "Nenhuma venda real registrada." mantido no ramo de zero para não regredir o teste anti-fictício).
- `src/lib/sales.functions.ts` (novo): `createSale` (POST, zod estrito, erros de negócio mapeados para `VALIDATION_ERROR`) e `listSales` (GET, cap 50), ambos com `requireDatabaseAuth`.
- `src/routes/_authenticated/vendas.tsx` (novo): formulário (produto, quantidade, preço unitário, data, canal) + histórico recente; invalida `["sales","list"]` e prefixo `["dashboard","summary"]`.
- `src/components/app-shell.tsx`: item de navegação "Vendas".

## Verificação

- `tsc --noEmit`: limpo; `vitest`: 333/333; `finance.boundaries.test.ts` (literais de fronteira) verde; `sales.service.test.ts` (validação decimal/autorização) verde; `query-performance.test.ts` (stale/key policy) verde.
- Build (autoCodeSplitting) + bundle check verdes.

## Resíduo documentado

- "Margem consolidada" do dashboard continua "—" (mix real por produto requer receita por item × CMU — fora do escopo do WS-01, mapeado para P2).
