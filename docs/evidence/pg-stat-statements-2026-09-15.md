# pg_stat_statements — instrumento local + medição das queries críticas (§16.3, WP-A3)

**Item:** `16.3` do Plano Mestre (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1378-1389`), spec-card `docs/evidence/agent-state/SPEC-CARDS/16.3-pgstat.md`.
**Método:** `scripts/obs/pg-stat-statements.ts` (novo) + PostgreSQL 17.11 efêmero em Docker com `shared_preload_libraries=pg_stat_statements`; carga das queries críticas do §16.4 pelo protocolo estendido (`\bind`), como na aplicação.
**Ambiente:** `CONTROLLED` — container local, banco loopback, dataset **sintético** de teste. **Nunca** `OBSERVED`.
**n:** 12 execuções por query crítica (36 execuções no total), 1 rodada.
**Janela:** `2026-09-15T05:42:10.603146Z` (`pg_stat_statements_reset()`) → `2026-09-15T05:42:11.164Z` (coleta, `docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T05-42-11-164Z.json`).
**Fonte raw (versionada, re-derivável pelo roteiro abaixo):** `docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T05-42-11-164Z.json` + irmã `.md` (conteúdo idêntico ao relatório colado neste arquivo).

## Campos §35

- **hypothesis:** o §16.3 fica observável em ambiente local se existir um coletor que leia `calls`, `total_exec_time`, `mean_exec_time`, `rows` e `query` das queries críticas do §16.4, com top-N e redação de parâmetros, recusando host não-loopback. Antes deste item não havia extensão habilitada, consulta nem script — a hipótese era "0 de 3 queries críticas medidas" → "3 de 3 medidas com contagem real".
- **metric:** cobertura de observabilidade das 3 queries críticas do §16.4 (`products.list`, `purchasePrice.latest`, `dashboard.productIngredients`), com `calls` (contagem absoluta), `total_exec_time` (ms, soma), `mean_exec_time` (ms, média) e `rows` (linhas devolvidas no total) por query.
- **before:** nenhuma medição — item **NS** no HEAD `1f94b56`: `git grep pg_stat_statements -- docker-compose.yml drizzle scripts` → **0 arquivos** (a menção existe só em docs de plano/spec, ex.: `docs/specs/M-06/spec.md:44`); `docker-compose.yml` (postgres, `:5432`) sem `shared_preload_libraries`; nenhum coletor em `scripts/obs/`. Cobertura = **0/3**; nenhum `calls`/tempo existia para citar.
- **change:** `scripts/obs/pg-stat-statements.ts` (novo, 357 linhas) + `src/test/pg-stat-statements.test.ts` (novo, 199 linhas). O coletor: guarda loopback-only (`resolveLocalTarget`, `scripts/obs/pg-stat-statements.ts:132`), leitura de `pg_stat_statements` filtrada ao banco corrente (`STATEMENTS_SQL`:63), classificação dos 3 alvos do §16.4 (`CRITICAL_QUERIES`:91, `classifyCriticalQuery`:115), top-N com teto 50 (`parseTopN`:120), redação reusando `redactSqlText` de `src/instrumentation/sql-redactor.ts:180` (`scripts/obs/pg-stat-statements.ts:172`), saída JSON+MD em `docs/evidence/pg-stat-statements/` (`buildReport`:177, `renderMarkdown`:240) e guarda de entrypoint (`invokedDirectly`:350) para que importar o módulo em teste não abra conexão. A extensão foi habilitada **apenas** no container efêmero: `docker-compose.yml` e o container `:5432` **não** foram tocados nem reiniciados.
- **after:** **3/3** queries críticas observadas, 12 `calls` cada, sobre o fixture sintético (2.050 `products`, 10.000 `product_ingredients`, 100.000 `purchase_price_history`, com os índices do cenário "depois" do §16.4): `products.list` total 10,920 ms / média 0,910 ms / 18.150 linhas; `purchasePrice.latest` total 0,178 ms / média 0,015 ms / 12 linhas; `dashboard.productIngredients` total 0,145 ms / média 0,012 ms / 60 linhas. Saída crua colada abaixo. O guarda também foi exercitado no CLI real: `NODE_ENV=production` → `exit=2` (`pg-stat-statements é local-only: NODE_ENV=production recusado`) e host remoto → `exit=2` (`pg-stat-statements recusa host não-loopback (fail-closed; valor omitido)`), sem ecoar a connection string em nenhum dos dois casos.
- **result:** instrumento entregue e comprovado localmente — a cobertura saiu de 0/3 para 3/3 alvos com números reais. **Não** há alegação de ganho de latência: os tempos vêm de fixture sintético com 12 chamadas e **não** são comparáveis ao evidence file do §16.4 (`docs/evidence/explain-critical-queries-2026-08-21.md`, `EXPLAIN ANALYZE` sobre 100.000 linhas no PG do compose) nem a qualquer ambiente real.
- **decision:** `keep` — manter coletor e teste. Follow-ups declarados: (i) a porção **Neon live** do §16.3 continua **pendente** (H-2/H-4 — fila humana; **nenhuma** conexão em Neon foi tentada, e o guarda loopback existe justamente para impedir que isso aconteça por acidente), portanto **não** existe medição `OBSERVED`; (ii) repetir a coleta contra o Postgres do ambiente publicado quando o preload existir fora do container efêmero; (iii) se algum número virar baseline, refazer com n maior e declarar o regime.

## Comando exato de reprodução

### 1. Container efêmero (nome único, porta **5435**; o `:5432` não é tocado)

```bash
docker run -d --name pqdl-pgstat-a3 -p 5435:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pqdl_pgstat \
  postgres:17-alpine \
  -c shared_preload_libraries=pg_stat_statements -c track_io_timing=off
```

Inspeção do container em execução: `image=postgres:17-alpine`, `args=[-c shared_preload_libraries=pg_stat_statements -c track_io_timing=off]`, `5432/tcp->5435`. Versões: `PostgreSQL 17.11 on x86_64-pc-linux-musl` · `pg_stat_statements default_version 1.11, installed_version 1.11`.

### 2. Fixture sintética (`/tmp/pgstat-a3-fixture.sql`) — ids fixos, dataset determinístico

```sql
-- Fixture sintética CONTROLLED do WP-A3 (§16.3) — container efêmero :5435.
-- Ids fixos: o workload usa os mesmos literais, então a reprodução é determinística.
create extension if not exists pg_stat_statements;

create table products (
  id uuid primary key,
  tenant_id uuid not null,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index products_tenant_created_idx on products (tenant_id, created_at desc);
create index products_tenant_id_id_uidx on products (tenant_id, id);

create table purchase_price_history (
  id uuid primary key,
  tenant_id uuid not null,
  ingredient_id uuid not null,
  valid_from timestamptz not null,
  recorded_at timestamptz not null default now()
);
create index purchase_price_history_tenant_ingredient_valid_idx
  on purchase_price_history (tenant_id, ingredient_id, valid_from desc, recorded_at desc);

create table product_ingredients (
  id uuid primary key,
  tenant_id uuid not null,
  product_id uuid not null
);
create index product_ingredients_tenant_product_idx on product_ingredients (tenant_id, product_id);

-- tenant 701: 2000 produtos ativos (espelha o volume do §16.4)
insert into products (id, tenant_id, archived_at, created_at)
select ('60000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid,
       null,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' seconds')::interval
from generate_series(1, 2000) g;

-- tenant 702: 50 produtos ativos (tenant frio, para variar o parâmetro $1)
insert into products (id, tenant_id, archived_at, created_at)
select ('60000001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000702'::uuid,
       null,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' hours')::interval
from generate_series(1, 50) g;

insert into product_ingredients (id, tenant_id, product_id)
select ('61000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid,
       ('60000000-0000-4000-8000-' || lpad(((g % 2000) + 1)::text, 12, '0'))::uuid
from generate_series(1, 10000) g;

insert into purchase_price_history (id, tenant_id, ingredient_id, valid_from, recorded_at)
select ('62000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid,
       ('80000000-0000-4000-8000-' || lpad((g % 100)::text, 12, '0'))::uuid,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' minutes')::interval,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' seconds')::interval
from generate_series(1, 100000) g;

vacuum analyze products;
vacuum analyze purchase_price_history;
vacuum analyze product_ingredients;

select 'products' as tabela, count(*) from products
union all select 'product_ingredients', count(*) from product_ingredients
union all select 'purchase_price_history', count(*) from purchase_price_history;
```

Aplicação: `cat /tmp/pgstat-a3-fixture.sql | docker exec -i pqdl-pgstat-a3 psql -U postgres -d pqdl_pgstat -v ON_ERROR_STOP=1`
→ `INSERT 0 2000` · `INSERT 0 50` · `INSERT 0 10000` · `INSERT 0 100000`; contagens finais: `products 2050`, `product_ingredients 10000`, `purchase_price_history 100000`.

### 3. Carga das queries críticas (`/tmp/pgstat-a3-workload.sql`) — 36 execuções

```sql
select pg_stat_statements_reset();
-- 12×: tenant 701 (9×) e 702 (3×)
select * from products where tenant_id = $1 and archived_at is null order by created_at desc \bind '70000000-0000-4000-8000-000000000701' \g
-- 12×: ingredientes 80000000-0000-4000-8000-000000000001..4, tenant 701
select * from purchase_price_history where tenant_id = $1 and ingredient_id = $2 order by valid_from desc, recorded_at desc limit 1 \bind '70000000-0000-4000-8000-000000000701' '80000000-0000-4000-8000-000000000003' \g
-- 12×: arrays de 1 a 3 produtos (60000000-… / 60000001-…) com o tenant correspondente
select * from product_ingredients where tenant_id = $1 and product_id = any($2) \bind '70000000-0000-4000-8000-000000000701' '{60000000-0000-4000-8000-000000000001,60000000-0000-4000-8000-000000000002,60000000-0000-4000-8000-000000000003}' \g
```

As 36 execuções são exatamente as três queries acima repetidas 12× cada, com os parâmetros rotacionando (tenant quente/frio, 4 ingredientes, arrays de 1–3 produtos) para que o Postgres normalize as diferentes constantes em **uma única** entrada de `pg_stat_statements`.

Aplicação:

```bash
docker exec -i pqdl-pgstat-a3 psql -U postgres -d pqdl_pgstat -q -c "select pg_stat_statements_reset();"
cat /tmp/pgstat-a3-workload.sql | docker exec -i pqdl-pgstat-a3 psql -U postgres -d pqdl_pgstat -q -v ON_ERROR_STOP=1 -o /dev/null
```

### 4. Coleta (worktree, branch `mission/a3-pgstat`)

```bash
DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5435/pqdl_pgstat' \
  npx tsx scripts/obs/pg-stat-statements.ts --top=10
```

### 5. Remoção do container efêmero (executada ao fim da medição)

```bash
docker rm -f pqdl-pgstat-a3
# restaram apenas pqdl-integ (:5433) e preco-que-da-lucro-postgres (:5432) — este último não foi editado nem reiniciado
```

## Saída real colada (stdout do coletor)

```text
pg-stat-statements: 3 statements · 3/3 queries críticas observadas (regime CONTROLLED)
pg-stat-statements: products.list calls=12 total=10.920ms mean=0.910ms rows=18150
pg-stat-statements: purchasePrice.latest calls=12 total=0.178ms mean=0.015ms rows=12
pg-stat-statements: dashboard.productIngredients calls=12 total=0.145ms mean=0.012ms rows=60
pg-stat-statements: /home/douglas-souza/preco-que-d-main/.worktree-mA3/docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T05-42-11-164Z.json
pg-stat-statements: /home/douglas-souza/preco-que-d-main/.worktree-mA3/docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T05-42-11-164Z.md
```

## Relatório gerado (`docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T05-42-11-164Z.md`, verbatim)

```markdown
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
```

### Verificação independente do mesmo estado (psql direto, após a coleta)

```text
12 | 10.920 | 0.910 | 18150 | select * from products where tenant_id = $1 and archived_at is null order by created_at desc
12 | 0.178 | 0.015 | 12 | select * from purchase_price_history where tenant_id = $1 and ingredient_id = $2 order by valid_from desc, recorded_at desc limit $3
12 | 0.145 | 0.012 | 60 | select * from product_ingredients where tenant_id = $1 and product_id = any($2)
```

As duas linhas restantes de `pg_stat_statements` (`… query not like $1` do próprio coletor, 1 call, e `select pg_stat_statements_reset()`, 1 call) são excluídas do relatório por `query not like '%pg_stat_statements%'` — por isso "statements observados" = 3.

## Notas de honestidade (limites desta evidência)

- **Regime:** `CONTROLLED`. Dataset **sintético**, um container efêmero, `n = 12` por query em uma única rodada. Nada aqui é `OBSERVED`.
- **Sem alegação de ganho de latência:** os tempos acima não são comparáveis ao evidence file do §16.4 (`docs/evidence/explain-critical-queries-2026-08-21.md`) nem a produção — esquema, volume e regime diferem. O ganho medido é de **visibilidade** (0/3 → 3/3 alvos).
- **Neon live continua pendente (H-2/H-4):** nenhuma conexão em Neon foi tentada; o guarda do coletor recusa host não-loopback justamente para impedir isso por acidente. Concluir a porção "Neon live" do §16.3 exige a fila humana.
- **Redação de parâmetros:** nesta rodada o próprio Postgres devolveu o texto já com placeholders (`$1`, `$2`, `limit $3`), então a redação não teve literal para remover; ela segue aplicada a toda linha emitida (`redactSqlText`, `scripts/obs/pg-stat-statements.ts:172`) e é provada com literal no teste (`src/test/pg-stat-statements.test.ts:154`).
- **`limit 1` → `limit $3`:** o Postgres normaliza o limite como mais uma constante; por isso o casamento dos alvos canoniza placeholders (`normalizeQuery`, `scripts/obs/pg-stat-statements.ts:80`) e o fingerprint do `purchasePrice.latest` usa `limit $3` (`scripts/obs/pg-stat-statements.ts:99-104`).
- **Teste da guarda:** `src/test/pg-stat-statements.test.ts` (8 casos, sem rede) cobre aceitação de `127.0.0.1`/`localhost`/`::1` (:34), recusa de host remoto sem vazar a credencial (:52), falha fechada com `NODE_ENV=production`/URL ausente/malformada (:71), teto do top-N (:84), classificação dos alvos (:93), ordenação + top-N + redação (:135), colunas/regime do markdown (:154) e os 7 rótulos desta evidência (:181).
- **Limpeza:** o container `pqdl-pgstat-a3` foi removido (`docker rm -f`) ao fim da medição; `preco-que-da-lucro-postgres` (`:5432`) permaneceu no ar e `docker-compose.yml` não foi editado.

## Rollback

`git revert <sha do commit>`; o container efêmero já foi removido e o `:5432` permanece intocado.
