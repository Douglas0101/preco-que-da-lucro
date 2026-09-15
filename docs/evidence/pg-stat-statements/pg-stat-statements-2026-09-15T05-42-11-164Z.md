# pg_stat_statements — queries críticas (§16.3)

Coletor local: `scripts/obs/pg-stat-statements.ts`. Regime: **CONTROLLED** (host loopback, dataset sintético de teste) — **nunca** `OBSERVED`.

- Gerado em: 2026-09-15T05:42:11.164Z
- Host: 127.0.0.1 (loopback)
- Banco: pqdl_pgstat
- Statements observados no banco: 3
- Top-N exibido: 10

## Queries críticas do §16.4 encontradas

| critical                     | operation | calls | total_exec_time_ms | mean_exec_time_ms | rows  |
| ---------------------------- | --------- | ----- | ------------------ | ----------------- | ----- |
| products.list                | SELECT    | 12    | 10.920             | 0.910             | 18150 |
| purchasePrice.latest         | SELECT    | 12    | 0.178              | 0.015             | 12    |
| dashboard.productIngredients | SELECT    | 12    | 0.145              | 0.012             | 60    |

Alvos não observados: (nenhum)

## Top-10 por `total_exec_time`

| critical                     | operation | calls | total_exec_time_ms | mean_exec_time_ms | rows  |
| ---------------------------- | --------- | ----- | ------------------ | ----------------- | ----- |
| products.list                | SELECT    | 12    | 10.920             | 0.910             | 18150 |
| purchasePrice.latest         | SELECT    | 12    | 0.178              | 0.015             | 12    |
| dashboard.productIngredients | SELECT    | 12    | 0.145              | 0.012             | 60    |

## Texto das queries (parâmetros redigidos)

| critical                     | query (redigida)                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| products.list                | select * from products where tenant_id = $1 and archived_at is null order by created_at desc                                         |
| purchasePrice.latest         | select * from purchase_price_history where tenant_id = $1 and ingredient_id = $2 order by valid_from desc, recorded_at desc limit $3 |
| dashboard.productIngredients | select * from product_ingredients where tenant_id = $1 and product_id = any($2)                                                      |
