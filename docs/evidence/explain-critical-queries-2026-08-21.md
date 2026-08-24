# Evidência EXPLAIN — queries críticas (2026-08-21)

Fonte: plano mestre §16.4 ("Queries críticas devem possuir evidence file:
before plan / after plan / before latency / after latency").

Ambiente: PostgreSQL 17 local (docker-compose), dataset sintético
(2000 produtos, 10000 insumos,
100000 registros de histórico de preços,
30 despesas, 1 tenant). Planos capturados com `EXPLAIN (ANALYZE, BUFFERS)`
sob o papel `app_runtime` com `app.current_tenant_id` definido.
O cenário "antes" remove os índices dentro de uma transação com rollback —
o estado final do banco permanece intacto.

### products.list (listagem ativa por tenant)

**SQL**

```sql
select * from products where tenant_id = $1 and archived_at is null order by created_at desc
```

**Índices removidos no cenário "antes":** products_tenant_active_idx, products_tenant_created_idx

**Antes (sem índice)**

```text
->  Index Scan using products_tenant_id_id_uidx on products  (cost=0.27..8.29 rows=1 width=272) (actual time=0.020..1.969 rows=2000 loops=1)
Execution Time: 3.314 ms
```

**Depois (com índice)**

```text
Index Scan Backward using products_tenant_created_idx on products  (cost=0.27..8.29 rows=1 width=272) (actual time=0.022..0.540 rows=2000 loops=1)
Execution Time: 0.621 ms
```

<details><summary>Plano completo antes</summary>

```text
Sort  (cost=8.30..8.30 rows=1 width=272) (actual time=3.012..3.133 rows=2000 loops=1)
  Sort Key: created_at DESC
  Sort Method: quicksort  Memory: 330kB
  Buffers: shared hit=4024
  ->  Index Scan using products_tenant_id_id_uidx on products  (cost=0.27..8.29 rows=1 width=272) (actual time=0.020..1.969 rows=2000 loops=1)
        Index Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
        Filter: (archived_at IS NULL)
        Buffers: shared hit=4024
Planning:
  Buffers: shared hit=46
Planning Time: 0.336 ms
Execution Time: 3.314 ms
```

</details>

<details><summary>Plano completo depois</summary>

```text
Index Scan Backward using products_tenant_created_idx on products  (cost=0.27..8.29 rows=1 width=272) (actual time=0.022..0.540 rows=2000 loops=1)
  Index Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
  Filter: (archived_at IS NULL)
  Buffers: shared hit=108
Planning:
  Buffers: shared hit=35
Planning Time: 0.354 ms
Execution Time: 0.621 ms
```

</details>

### purchasePrice.latest (último preço por insumo)

**SQL**

```sql
select * from purchase_price_history
            where tenant_id = $1 and ingredient_id = $2
            order by valid_from desc, recorded_at desc limit 1
```

**Índices removidos no cenário "antes":** purchase_price_history_tenant_ingredient_valid_idx

**Antes (sem índice)**

```text
->  Bitmap Heap Scan on purchase_price_history  (cost=8.79..1668.69 rows=3 width=266) (actual time=10.898..27.380 rows=10 loops=1)
Execution Time: 27.567 ms
```

**Depois (com índice)**

```text
->  Index Scan Backward using purchase_price_history_tenant_ingredient_valid_idx on purchase_price_history  (cost=0.42..16.48 rows=3 width=266) (actual time=0.017..0.019 rows=2 loops=1)
Execution Time: 0.089 ms
```

<details><summary>Plano completo antes</summary>

```text
Limit  (cost=1668.71..1668.71 rows=1 width=266) (actual time=27.425..27.427 rows=1 loops=1)
  Buffers: shared hit=4606
  ->  Sort  (cost=1668.71..1668.71 rows=3 width=266) (actual time=27.422..27.424 rows=1 loops=1)
        Sort Key: valid_from DESC, recorded_at DESC
        Sort Method: top-N heapsort  Memory: 25kB
        Buffers: shared hit=4606
        ->  Bitmap Heap Scan on purchase_price_history  (cost=8.79..1668.69 rows=3 width=266) (actual time=10.898..27.380 rows=10 loops=1)
              Recheck Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
              Filter: (ingredient_id = 'd252eb8b-11ff-4927-8266-d97c332c3577'::uuid)
              Rows Removed by Filter: 99990
              Heap Blocks: exact=4445
              Buffers: shared hit=4606
              ->  Bitmap Index Scan on purchase_price_history_tenant_packaging_valid_idx  (cost=0.00..8.79 rows=600 width=0) (actual time=4.377..4.377 rows=200000 loops=1)
                    Index Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
                    Buffers: shared hit=161
Planning:
  Buffers: shared hit=34
Planning Time: 0.396 ms
Execution Time: 27.567 ms
```

</details>

<details><summary>Plano completo depois</summary>

```text
Limit  (cost=5.78..9.39 rows=1 width=266) (actual time=0.054..0.055 rows=1 loops=1)
  Buffers: shared hit=8
  ->  Incremental Sort  (cost=5.78..16.61 rows=3 width=266) (actual time=0.053..0.053 rows=1 loops=1)
        Sort Key: valid_from DESC, recorded_at DESC
        Presorted Key: valid_from
        Full-sort Groups: 1  Sort Method: quicksort  Average Memory: 25kB  Peak Memory: 25kB
        Buffers: shared hit=8
        ->  Index Scan Backward using purchase_price_history_tenant_ingredient_valid_idx on purchase_price_history  (cost=0.42..16.48 rows=3 width=266) (actual time=0.017..0.019 rows=2 loops=1)
              Index Cond: ((tenant_id = '70000000-0000-4000-8000-000000000701'::uuid) AND (ingredient_id = 'd252eb8b-11ff-4927-8266-d97c332c3577'::uuid))
              Buffers: shared hit=5
Planning:
  Buffers: shared hit=23
Planning Time: 0.291 ms
Execution Time: 0.089 ms
```

</details>

### dashboard.productIngredients (insumos por produto)

**SQL**

```sql
select * from product_ingredients where tenant_id = $1 and product_id = any($2)
```

**Índices removidos no cenário "antes":** product_ingredients_tenant_product_idx

**Antes (sem índice)**

```text
Bitmap Heap Scan on product_ingredients  (cost=4.68..152.97 rows=1 width=286) (actual time=5.133..5.135 rows=0 loops=1)
Execution Time: 5.364 ms
```

**Depois (com índice)**

```text
Index Scan using product_ingredients_tenant_product_idx on product_ingredients  (cost=0.29..8.30 rows=1 width=286) (actual time=0.015..0.015 rows=0 loops=1)
Execution Time: 0.034 ms
```

<details><summary>Plano completo antes</summary>

```text
Bitmap Heap Scan on product_ingredients  (cost=4.68..152.97 rows=1 width=286) (actual time=5.133..5.135 rows=0 loops=1)
  Recheck Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
  Filter: (product_id = ANY ('{d252eb8b-11ff-4927-8266-d97c332c3577}'::uuid[]))
  Rows Removed by Filter: 10000
  Heap Blocks: exact=409
  Buffers: shared hit=559
  ->  Bitmap Index Scan on product_ingredients_tenant_id_id_uidx  (cost=0.00..4.68 rows=53 width=0) (actual time=2.247..2.248 rows=20000 loops=1)
        Index Cond: (tenant_id = '70000000-0000-4000-8000-000000000701'::uuid)
        Buffers: shared hit=150
Planning:
  Buffers: shared hit=58
Planning Time: 1.376 ms
Execution Time: 5.364 ms
```

</details>

<details><summary>Plano completo depois</summary>

```text
Index Scan using product_ingredients_tenant_product_idx on product_ingredients  (cost=0.29..8.30 rows=1 width=286) (actual time=0.015..0.015 rows=0 loops=1)
  Index Cond: ((tenant_id = '70000000-0000-4000-8000-000000000701'::uuid) AND (product_id = ANY ('{d252eb8b-11ff-4927-8266-d97c332c3577}'::uuid[])))
  Buffers: shared hit=2
Planning:
  Buffers: shared hit=20
Planning Time: 0.247 ms
Execution Time: 0.034 ms
```

</details>

Gerado por `scripts/db/explain-evidence.ts`.
