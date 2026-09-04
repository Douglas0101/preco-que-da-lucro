# WS-02 — DiagnosticService server-side (2026-09-01)

## Mudanças

- `src/server/services/product-detail.service.ts` (novo): `loadProductFinancialDetail` — produto + filhos (ingredientes/embalagens/taxas/mercado) tenant-scoped + `calculateProductReadModel` (server-side, sem `Number()` no browser).
- `src/server/services/diagnostic.service.ts` (novo): `getDiagnostic(context, {productId, nonPercentageVariableUnitCost, targetContributionRate})` — despesas fixas (Decimal), custo (`computeProductCost`), análise do preço atual (break-even + alertas: preço abaixo do custo, margem <20%, não cobre fixas, desvio de mercado), formação de preço (`calculatePriceFormation`, Model A) e versão do motor; grava snapshots (ver WS-03).
- `src/lib/diagnostic.functions.ts` (novo): `getDiagnostic` GET (zod estrito; `requireDatabaseAuth`).
- `src/routes/_authenticated/diagnostico.tsx`: removeu o pipeline de cálculo canônico do browser; coleta premissas (debounce 400 ms), busca via BFF e renderiza resultado tipado. Literais de relação (premissas, "Simulação não salva", escopo, "falta um volume ou direcionador confiável") mantidos.

## Verificação

- `vitest`: 333/333 (incl. `finance.golden` F0-03 imutáveis); `finance.boundaries.test.ts` atualizado para o novo contrato (server-side `Number.isFinite(difference)` em `diagnostic.service.ts`; cliente usa `productsListQueryOptions()`).
- Build + bundle verdes.

## Resíduo documentado

- O alerta de mercado (comparação % vs referência) foi movido para o servidor; no browser restam apenas guardas de exibição e formatação (INV-004 preservado).
