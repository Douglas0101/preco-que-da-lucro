# pg_stat_statements — queries críticas (§16.3)

Coletor local: `scripts/obs/pg-stat-statements.ts`. Regime: **CONTROLLED** (host loopback, dataset sintético de teste) — **nunca** `OBSERVED`.

- Gerado em: 2026-09-15T06:00:13.805Z
- Host: 127.0.0.1 (loopback)
- Banco: preco_que_da_lucro_test
- Entradas de `pg_stat_statements` observadas: 8
- Padrões distintos após agregação: 7
- Top-N exibido: 10

## Queries críticas do §16.4 encontradas

| critical                     | statements | calls | total_exec_time_ms | mean_exec_time_ms | rows  |
| ---------------------------- | ---------- | ----- | ------------------ | ----------------- | ----- |
| products.list                | 2          | 14    | 74.041             | 5.289             | 22150 |
| purchasePrice.latest         | 1          | 12    | 0.297              | 0.025             | 12    |
| dashboard.productIngredients | 2          | 12    | 0.289              | 0.024             | 150   |

Alvos não observados: (nenhum)

## Formas observadas (parâmetros redigidos)

| critical                     | query (redigida)                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| products.list                | select "id", "tenant_id", "user_id", "name", "status", "current_price", "yield_qty", "yield_unit", "tax_regime", "tax_rate", "is_demo", "notes", "version", "archived_at", "created_at", "updated_at" from "products" where ("products"."tenant_id" = $1 and "products"."archived_at" is null) order by "products"."created_at" desc                                                                                    |
| purchasePrice.latest         | select "id", "tenant_id", "user_id", "subject_type", "subject_id", "ingredient_id", "packaging_id", "price", "quantity", "unit", "supplier_id", "valid_from", "recorded_at" from "purchase_price_history" where ("purchase_price_history"."tenant_id" = $1 and "purchase_price_history"."ingredient_id" = $2) order by "purchase_price_history"."valid_from" desc, "purchase_price_history"."recorded_at" desc limit $3 |
| dashboard.productIngredients | select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", "used_unit", "package_price", "package_qty", "package_unit", "conversion_factor", "price_updated_at", "created_at", "updated_at" from "product_ingredients" where ("product_ingredients"."tenant_id" = $1 and "product_ingredients"."product_id" in ($2, $3, $4))                                                                                |
| dashboard.productIngredients | select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", "used_unit", "package_price", "package_qty", "package_unit", "conversion_factor", "price_updated_at", "created_at", "updated_at" from "product_ingredients" where ("product_ingredients"."tenant_id" = $1 and "product_ingredients"."product_id" in ($2, $3))                                                                                    |
| -                            | select set_config($1, $2, $3)                                                                                                                                                                                                                                                                                                                                                                                           |
| -                            | set role app_runtime                                                                                                                                                                                                                                                                                                                                                                                                    |
| -                            | reset role                                                                                                                                                                                                                                                                                                                                                                                                              |

## Top-10 por `total_exec_time`

| critical                     | operation | statements | calls | total_exec_time_ms | mean_exec_time_ms | rows  |
| ---------------------------- | --------- | ---------- | ----- | ------------------ | ----------------- | ----- |
| products.list                | SELECT    | 2          | 14    | 74.041             | 5.289             | 22150 |
| purchasePrice.latest         | SELECT    | 1          | 12    | 0.297              | 0.025             | 12    |
| dashboard.productIngredients | SELECT    | 1          | 6     | 0.176              | 0.029             | 90    |
| dashboard.productIngredients | SELECT    | 1          | 6     | 0.113              | 0.019             | 60    |
| -                            | SELECT    | 1          | 2     | 0.025              | 0.013             | 2     |
| -                            | SET       | 1          | 1     | 0.024              | 0.024             | 0     |
| -                            | RESET     | 1          | 1     | 0.010              | 0.010             | 0     |
