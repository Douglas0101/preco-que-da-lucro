# pg_stat_statements — instrumento local + medição das queries críticas (§16.3, WP-A3)

**Item:** `16.3` do Plano Mestre (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1378-1389`), spec-card `docs/evidence/agent-state/SPEC-CARDS/16.3-pgstat.md`.
**Método:** `scripts/obs/pg-stat-statements.ts` (novo) + PostgreSQL 17.11 efêmero em Docker com `shared_preload_libraries=pg_stat_statements`, **schema real** (as 15 migrations drizzle via `scripts/db/migrate.ts`) e o **SQL real renderizado pelo drizzle** dos três repositórios do §16.4 — nada de SQL escrito à mão para casar com o matcher.
**Ambiente:** `CONTROLLED` — container local, banco loopback, dataset **sintético** de teste. **Nunca** `OBSERVED`.
**n:** `products.list` 14 chamadas (12 como `postgres` + 2 como `app_runtime`), `purchasePrice.latest` 12, `dashboard.productIngredients` 12 (6 com `in` de 3 produtos + 6 com `in` de 2) — 38 execuções, 1 rodada.
**Janela:** `2026-09-15T06:00:12.972942Z` (`pg_stat_statements_reset()`) → `2026-09-15T06:00:13.805Z` (coleta).
**Fonte raw (versionada, re-derivável pelo roteiro abaixo):** `docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T06-00-13-805Z.json` + irmã `.md` (o markdown é o mesmo conteúdo do relatório colado neste arquivo).

## Campos §35

- **hypothesis:** o §16.3 fica observável em ambiente local se existir um coletor que (i) só conecte em loopback, (ii) reconheça as queries críticas do §16.4 **como o app realmente as monta** (drizzle, não o SQL do plano) e (iii) leia `calls`, `total_exec_time`, `mean_exec_time`, `rows` e `query` com redação de parâmetros. Antes deste item não havia extensão habilitada, consulta nem script, e a hipótese era "0 de 3 alvos medidos" → "3 de 3 medidos com contagem real".
- **metric:** cobertura de observabilidade dos 3 alvos críticos, com `calls`, `total_exec_time` (ms, soma), `mean_exec_time` (ms, média) e `rows` (linhas devolvidas) por alvo, agregando **todas** as entradas de `pg_stat_statements` que casam com o alvo.
- **before:** nenhuma medição — item **NS** no HEAD `1f94b56`: `git grep pg_stat_statements -- docker-compose.yml drizzle scripts` → **0 arquivos** (a menção existe só em docs de plano/spec); `docker-compose.yml` sem `shared_preload_libraries`; nenhum coletor em `scripts/obs/`. Cobertura = **0/3**; nenhum `calls`/tempo existia para citar.
- **change:** `scripts/obs/pg-stat-statements.ts` (novo, 505 linhas) + `src/test/pg-stat-statements.test.ts` (novo, 316 linhas). Coletor: guarda loopback-only validando o **host do driver** (`resolveLocalTarget`, `:196`, com `pg-connection-string` honrando `?host=` e recusa explícita de `hostaddr`, `:212`); alvos com o SQL real do app (`CRITICAL_QUERIES`, `:153`) e origem `arquivo:linha` de cada repositório; normalização de forma (`normalizeQuery`, `:141`: aspas de identificador fora, qualificador `tabela.` fora, `$n` → `$0`); redação reusando `redactSqlText` de `src/instrumentation/sql-redactor.ts:180` com teto do Postgres (`STATS_REDACTION_MAX_LENGTH = 1024`, `:57`) em `:248`; agregação por forma redigida e por alvo (`buildReport`, `:276`); artefato sem SQL cru (`buildArtifact`, `:319`); relatório (`renderMarkdown`, `:401`); guarda de entrypoint (`:498`). Extensão habilitada **apenas** no container efêmero — `docker-compose.yml` e o container `:5432` **não** foram tocados nem reiniciados.
- **after:** **3/3** alvos observados no schema real, com agregação de todas as entradas: `products.list` `statements=2`, `calls=14`, total 74,041 ms, média 5,289 ms, 22.150 linhas; `purchasePrice.latest` `statements=1`, `calls=12`, total 0,297 ms, média 0,025 ms, 12 linhas; `dashboard.productIngredients` `statements=2`, `calls=12`, total 0,289 ms, média 0,024 ms, 150 linhas. A agregação é visível e não silenciosa: as 2 entradas de `products.list` são as mesmas doze chamadas sob `postgres` mais duas sob o papel `app_runtime` (RLS ativa), e as 2 de `dashboard.productIngredients` são as duas formas de `in ($2,$3)`/`in ($2,$3,$4)` que o `inArray` do drizzle renderiza. Saída crua colada abaixo. O guarda foi exercitado no CLI real (4 caminhos): `NODE_ENV=production` → `exit=2`; host remoto → `exit=2`; `?host=db.neon.tech` (override na query string) → `exit=2`; `?hostaddr=10.0.0.5` → `exit=2` — sempre sem ecoar a connection string.
- **result:** instrumento entregue e comprovado contra o **SQL real** do app; a cobertura saiu de 0/3 para 3/3 alvos com números reais e agregados. **Não** há alegação de ganho de latência: os tempos vêm de fixture sintético com 12–14 chamadas, sob um único container, e **não** são comparáveis ao evidence file do §16.4 (`docs/evidence/explain-critical-queries-2026-08-21.md`) nem a qualquer ambiente real.
- **decision:** `keep` — manter coletor e teste. Follow-ups declarados: (i) a porção **Neon live** do §16.3 continua **pendente** (H-2/H-4 — fila humana; **nenhuma** conexão em Neon foi tentada e o guarda loopback existe para impedir isso por acidente), portanto **não** existe medição `OBSERVED`; (ii) medir o Postgres publicado o quanto antes, agora que o matcher casa o SQL do app — é o mesmo texto, muda só o regime; (iii) se algum número virar baseline, refazer com n maior e declarar `n`/janela.

## Correções aplicadas após o veredicto adversarial V-A3

1. **JSON não carrega mais SQL cru.** `ReportRow` deixou de ter o campo `query` (`:60-72`) e o payload é montado por `buildArtifact` (`:319`), que só serializa `redacted_query`; o teste agora abre o JSON e afirma ausência do literal **e** ausência de chave de texto cru (`src/test/pg-stat-statements.test.ts:250`).
2. **Casamento pelo SQL real do drizzle**, não pelo texto do plano: os alvos são padrões sobre o SQL normalizado, com a origem `arquivo:linha` de cada repositório (`product.repository.ts:30-37`, `purchase-price.repository.ts:66-71`, `dashboard.repository.ts:48-58`) e tolerância às duas formas de `inArray` (`in ($1, $2)` / `in ($1, $2, $3)`) e ao `= any($2)` do §16.4. O teste fixa o SQL renderizado (`.toSQL()`) das três queries (`:127`) e rejeita vizinhos da mesma tabela (`:151`).
3. **Agregação de todas as entradas por alvo.** `buildReport` soma `calls`/`total_exec_time`/`rows` das entradas que casam (mesma forma redigida ou formas diferentes do mesmo alvo), com `mean = total / calls` e `statements` = quantas entradas foram somadas; a evidência mostra isso vivo (`statements=2` em dois alvos). Teste: `:165` e `:216`.
4. **Guarda também no host efetivo do driver.** `resolveLocalTarget` valida o host que o `pg` vai usar (via `pg-connection-string`, que resolve `?host=`), exige que **todos** os hosts da lista sejam loopback e recusa `hostaddr` por construção. Teste: `:78`.

## Comando exato de reprodução

### 1. Container efêmero (nome único, porta **5435**; o `:5432` não é tocado)

```bash
docker run -d --name pqdl-pgstat-a3 -p 5435:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=preco_que_da_lucro_test \
  postgres:17-alpine \
  -c shared_preload_libraries=pg_stat_statements -c track_io_timing=off
```

Inspeção do container em execução: `image=postgres:17-alpine`, `args=[-c shared_preload_libraries=pg_stat_statements -c track_io_timing=off]`, `5432/tcp->5435`. Versões: `PostgreSQL 17.11 on x86_64-pc-linux-musl (Alpine 15.2.0)` · `pg_stat_statements 1.11`.

### 2. Schema real (15 migrations drizzle)

```bash
DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5435/preco_que_da_lucro_test' \
  npx tsx scripts/db/migrate.ts
# → "Migrations PostgreSQL aplicadas com sucesso." · select count(*) from drizzle.__drizzle_migrations = 15
```

### 3. Fixture sintética (`/tmp/pgstat-a3-fixture.sql`) — idempotente sobre banco vazio

```sql
create extension if not exists pg_stat_statements;

insert into tenants (id, name, slug, kind)
values ('70000000-0000-4000-8000-000000000701', 'Evidência WP-A3', 'wp-a3-evidence-701', 'personal'),
       ('70000000-0000-4000-8000-000000000702', 'Evidência WP-A3 (frio)', 'wp-a3-evidence-702', 'personal');

insert into users (id, name, email)
values ('user-wp-a3', 'WP-A3', 'wp-a3@example.invalid');

insert into tenant_memberships (tenant_id, user_id, role)
values ('70000000-0000-4000-8000-000000000701', 'user-wp-a3', 'owner'),
       ('70000000-0000-4000-8000-000000000702', 'user-wp-a3', 'owner');

insert into profiles (id, tenant_id, user_id, email, display_name)
values ('user-wp-a3', '70000000-0000-4000-8000-000000000701', 'user-wp-a3', 'wp-a3@example.invalid', 'WP-A3');

-- tenant 701: 2000 produtos ativos (espelha o volume do §16.4)
insert into products (id, tenant_id, user_id, name, status, is_demo, version, archived_at, created_at, updated_at)
select ('60000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid, 'user-wp-a3', 'Produto ' || g, 'active', false, 0, null,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' seconds')::interval, now()
from generate_series(1, 2000) g;

-- tenant 702: 50 produtos ativos (tenant frio, para variar o parâmetro $1)
insert into products (id, tenant_id, user_id, name, status, is_demo, version, archived_at, created_at, updated_at)
select ('60000001-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000702'::uuid, 'user-wp-a3', 'Produto frio ' || g, 'active', false, 0, null,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' hours')::interval, now()
from generate_series(1, 50) g;

insert into product_ingredients (id, product_id, tenant_id, user_id, name, used_qty, used_unit, created_at, updated_at)
select ('61000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       ('60000000-0000-4000-8000-' || lpad(((g % 2000) + 1)::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid, 'user-wp-a3', 'Insumo ' || g, 1, 'kg', now(), now()
from generate_series(1, 10000) g;

insert into purchase_price_history (
  id, tenant_id, user_id, subject_type, subject_id, ingredient_id, packaging_id,
  price, quantity, unit, valid_from, recorded_at
)
select ('62000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       '70000000-0000-4000-8000-000000000701'::uuid, 'user-wp-a3', 'ingredient',
       ('61000000-0000-4000-8000-' || lpad(((g % 10000) + 1)::text, 12, '0'))::uuid,
       ('61000000-0000-4000-8000-' || lpad(((g % 10000) + 1)::text, 12, '0'))::uuid,
       null, (10 + (g % 90))::numeric(19, 4), 1, 'kg',
       timestamptz '2026-08-21 00:00:00+00' - (g || ' minutes')::interval,
       timestamptz '2026-08-21 00:00:00+00' - (g || ' seconds')::interval
from generate_series(1, 100000) g;

vacuum analyze tenants, tenant_memberships, products, product_ingredients, purchase_price_history;
```

Aplicação: `cat /tmp/pgstat-a3-fixture.sql | docker exec -i pqdl-pgstat-a3 psql -U postgres -d preco_que_da_lucro_test -v ON_ERROR_STOP=1`
→ `CREATE EXTENSION` · `INSERT 0 2` (tenants, memberships) · `INSERT 0 1` (users, profiles) · `INSERT 0 2000` · `INSERT 0 50` · `INSERT 0 10000` · `INSERT 0 100000`; contagens finais: `products 2050`, `product_ingredients 10000`, `purchase_price_history 100000`.

### 4. SQL real das três queries críticas (renderizado pelo drizzle)

Sonda descartável (removida do branch, não versionada) que usa `drizzle.mock()` + as tabelas de `src/db/schema.ts` e repete **exatamente** as cadeias dos repositórios, imprimindo `.toSQL()`:

```ts
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { productIngredients, products, purchasePriceHistory } from "../../src/db/schema";

const db = drizzle.mock();
const tenantId = "70000000-0000-4000-8000-000000000701";
const productIds = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
];

// product.repository.ts:30-37
db.select()
  .from(products)
  .where(and(eq(products.tenantId, tenantId), isNull(products.archivedAt)))
  .orderBy(desc(products.createdAt))
  .toSQL();

// purchase-price.repository.ts:66-71
db.select()
  .from(purchasePriceHistory)
  .where(
    and(
      eq(purchasePriceHistory.tenantId, tenantId),
      eq(purchasePriceHistory.ingredientId, "61000000-0000-4000-8000-000000000003"),
    ),
  )
  .orderBy(desc(purchasePriceHistory.validFrom), desc(purchasePriceHistory.recordedAt))
  .limit(1)
  .toSQL();

// dashboard.repository.ts:48-58 (3 produtos e depois 2, para pegar as duas formas de `in`)
db.select()
  .from(productIngredients)
  .where(
    and(
      eq(productIngredients.tenantId, tenantId),
      inArray(productIngredients.productId, productIds),
    ),
  )
  .toSQL();
```

Textos renderizados usados no workload (placeholders + lista explícita de colunas; **não** o `select *` do §16.4):

```text
select "id", "tenant_id", "user_id", "name", "status", "current_price", "yield_qty", "yield_unit", "tax_regime", "tax_rate", "is_demo", "notes", "version", "archived_at", "created_at", "updated_at" from "products" where ("products"."tenant_id" = $1 and "products"."archived_at" is null) order by "products"."created_at" desc

select "id", "tenant_id", "user_id", "subject_type", "subject_id", "ingredient_id", "packaging_id", "price", "quantity", "unit", "supplier_id", "valid_from", "recorded_at" from "purchase_price_history" where ("purchase_price_history"."tenant_id" = $1 and "purchase_price_history"."ingredient_id" = $2) order by "purchase_price_history"."valid_from" desc, "purchase_price_history"."recorded_at" desc limit $3

select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", "used_unit", "package_price", "package_qty", "package_unit", "conversion_factor", "price_updated_at", "created_at", "updated_at" from "product_ingredients" where ("product_ingredients"."tenant_id" = $1 and "product_ingredients"."product_id" in ($2, $3, $4))

select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", "used_unit", "package_price", "package_qty", "package_unit", "conversion_factor", "price_updated_at", "created_at", "updated_at" from "product_ingredients" where ("product_ingredients"."tenant_id" = $1 and "product_ingredients"."product_id" in ($2, $3))
```

### 5. Workload (`/tmp/pgstat-a3-workload.sql`) — 38 execuções pelo protocolo estendido (`\bind`)

```sql
select pg_stat_statements_reset();

-- 12× products.list (9× tenant quente, 3× tenant frio)
<TEXTOS[1]> \bind '70000000-0000-4000-8000-000000000701' \g      -- e '...702' nas 3 chamadas de tenant frio

-- 12× purchasePrice.latest (insumos 61000000-0000-4000-8000-00000000000{1,2,3,4}, limit 1)
<TEXTOS[2]> \bind '70000000-0000-4000-8000-000000000701' '61000000-0000-4000-8000-000000000001' '1' \g

-- 6× dashboard.productIngredients com 3 produtos / 6× com 2 produtos (as duas formas de `in`)
<TEXTOS[3]> \bind '70000000-0000-4000-8000-000000000701' '60000000-0000-4000-8000-000000000001' '60000000-0000-4000-8000-000000000002' '60000000-0000-4000-8000-000000000003' \g
<TEXTOS[4]> \bind '70000000-0000-4000-8000-000000000701' '60000000-0000-4000-8000-000000000001' '60000000-0000-4000-8000-000000000002' \g

-- 2× products.list como app_runtime (mesma forma, outro userid ⇒ outra entrada em pg_stat_statements)
select set_config('app.current_tenant_id', '70000000-0000-4000-8000-000000000701', false);
select set_config('app.current_user_id', 'user-wp-a3', false);
set role app_runtime;
<TEXTOS[1]> \bind '70000000-0000-4000-8000-000000000701' \g      -- 2×
reset role;
```

`<TEXTOS[n]>` = os textos renderizados da seção 4 (repetidos literalmente em cada linha, uma execução por linha).

Aplicação:

```bash
docker exec -i pqdl-pgstat-a3 psql -U postgres -d preco_que_da_lucro_test -q -c "select pg_stat_statements_reset();"
cat /tmp/pgstat-a3-workload.sql | docker exec -i pqdl-pgstat-a3 psql -U postgres -d preco_que_da_lucro_test -q -v ON_ERROR_STOP=1 -o /dev/null
```

### 6. Coleta (worktree, branch `mission/a3-pgstat`)

```bash
DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5435/preco_que_da_lucro_test' \
  npx tsx scripts/obs/pg-stat-statements.ts --top=10
```

### 7. Remoção do container efêmero

```bash
docker rm -f pqdl-pgstat-a3
# restaram apenas pqdl-integ (:5433) e preco-que-da-lucro-postgres (:5432) — este último não foi editado nem reiniciado
```

## Saída real colada (stdout do coletor)

```text
pg-stat-statements: 8 entradas · 7 padrões · 3/3 queries críticas observadas (regime CONTROLLED)
pg-stat-statements: products.list statements=2 calls=14 total=74.041ms mean=5.289ms rows=22150
pg-stat-statements: purchasePrice.latest statements=1 calls=12 total=0.297ms mean=0.025ms rows=12
pg-stat-statements: dashboard.productIngredients statements=2 calls=12 total=0.289ms mean=0.024ms rows=150
pg-stat-statements: /home/douglas-souza/preco-que-d-main/.worktree-mA3/docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T06-00-13-805Z.json
pg-stat-statements: /home/douglas-souza/preco-que-d-main/.worktree-mA3/docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T06-00-13-805Z.md
```

## Relatório gerado (`docs/evidence/pg-stat-statements/pg-stat-statements-2026-09-15T06-00-13-805Z.md`)

Tabelas de agregação (o arquivo versionado traz as mesmas tabelas, com o quadro completo das queries redigidas):

```markdown
## Queries críticas do §16.4 encontradas

| critical                     | statements | calls | total_exec_time_ms | mean_exec_time_ms | rows  |
| ---------------------------- | ---------- | ----- | ------------------ | ----------------- | ----- |
| products.list                | 2          | 14    | 74.041             | 5.289             | 22150 |
| purchasePrice.latest         | 1          | 12    | 0.297              | 0.025             | 12    |
| dashboard.productIngredients | 2          | 12    | 0.289              | 0.024             | 150   |

Alvos não observados: (nenhum)

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
```

Nas "Formas observadas" o relatório imprime o SQL redigido (só o do `pg_stat_statements`, já parametrizado, com os literais da fixture ausentes — `grep` de `70000000-`/`60000000-`/`61000000-`/`62000000-` no JSON: **0 hits**).

### Verificação independente do mesmo estado (psql direto, após a coleta)

```text
app_runtime | 2  | 49.596 | 24.798 | 4000  | select "id", "tenant_id", "user_id", "name", "status", "current_price" …
postgres    | 12 | 24.445 |  2.037 | 18150 | select "id", "tenant_id", "user_id", "name", "status", "current_price" …
postgres    | 12 |  0.297 |  0.025 | 12    | select "id", "tenant_id", "user_id", "subject_type", "subject_id", "in…
postgres    | 6  |  0.176 |  0.029 | 90    | select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", …
postgres    | 6  |  0.113 |  0.019 | 60    | select "id", "product_id", "tenant_id", "user_id", "name", "used_qty", …
postgres    | 2  |  0.025 |  0.013 | 2     | select set_config($1, $2, $3)
app_runtime | 1  |  0.024 |  0.024 | 0     | set role app_runtime
postgres    | 1  |  0.010 |  0.010 | 0     | reset role
```

As duas linhas de `products.list` (uma por papel) somam exatamente o `statements=2 / calls=14 / rows=22150 / total=74.041 ms` do relatório; as duas de `product_ingredients` (formas de `in` de 3 e 2 produtos) somam `statements=2 / calls=12 / rows=150`. A consulta do próprio coletor e o `pg_stat_statements_reset()` saem do relatório pelo filtro `query not like '%pg_stat_statements%'`.

## Guarda local-only — prova no CLI real

```text
$ NODE_ENV=production DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5435/preco_que_da_lucro_test' npx tsx scripts/obs/pg-stat-statements.ts
pg-stat-statements: pg-stat-statements é local-only: NODE_ENV=production recusado            (exit=2)
$ DATABASE_ADMIN_URL='postgresql://user:sup3r-s3cret@db.neon.tech:5432/prod' npx tsx scripts/obs/pg-stat-statements.ts
pg-stat-statements: pg-stat-statements recusa host não-loopback (fail-closed; valor omitido)  (exit=2)
$ DATABASE_ADMIN_URL='postgresql://postgres:sup3r-s3cret@127.0.0.1:5435/preco_que_da_lucro_test?host=db.neon.tech' npx tsx scripts/obs/pg-stat-statements.ts
pg-stat-statements: pg-stat-statements recusa host não-loopback (fail-closed; valor omitido)  (exit=2)
$ DATABASE_ADMIN_URL='postgresql://postgres:sup3r-s3cret@127.0.0.1:5435/preco_que_da_lucro_test?hostaddr=10.0.0.5' npx tsx scripts/obs/pg-stat-statements.ts
pg-stat-statements: pg-stat-statements recusa hostaddr na connection string (fail-closed; valor omitido)  (exit=2)
```

Nenhuma das quatro saídas contém a credencial nem o hostname remoto.

## Notas de honestidade (limites desta evidência)

- **Regime:** `CONTROLLED`. Schema real, mas dataset **sintético**, um container efêmero, 38 execuções em uma única rodada. Nada aqui é `OBSERVED`.
- **Sem alegação de ganho de latência:** os tempos não são comparáveis ao evidence file do §16.4 nem a produção — volume, plano e regime diferem. O ganho medido é de **visibilidade** (0/3 → 3/3 alvos).
- **Neon live continua pendente (H-2/H-4):** nenhuma conexão em Neon foi tentada; o guarda loopback impede isso por acidente. Concluir essa porção do §16.3 exige a fila humana.
- **Redação:** nesta rodada o Postgres devolveu o texto já parametrizado, então a redação não teve literal para remover; ela segue aplicada a **toda** linha emitida (`redactSqlText`, `:248`), é provada com literal no teste (`src/test/pg-stat-statements.test.ts:250`) e o JSON não tem campo de SQL cru (`ReportRow` sem `query`, `:78-88`).
- **`limit 1` → `limit $3` e `in` variável:** o Postgres normaliza o limite como mais uma constante e o `inArray` do drizzle rende um placeholder por elemento; por isso o casamento canoniza placeholders (`normalizeQuery`, `:141`) e agrega todas as formas do mesmo alvo (`buildReport`, `:276`). Uma mudança de forma (ex.: reescrita da query) faz o alvo aparecer em `missing_critical` em vez de casar errado.
- **Testes:** `src/test/pg-stat-statements.test.ts` (11 casos, sem rede) cobre guarda loopback e overrides (`:56`, `:78`, `:105`), teto do top-N (`:118`), SQL real do drizzle (`:127`), variações de caixa/espaço (`:138`), rejeição de vizinhos (`:151`), agregação por alvo e por forma (`:165`, `:216`), pureza do JSON/markdown (`:250`) e os 7 rótulos desta evidência (`:295`).
- **Limpeza:** `pqdl-pgstat-a3` foi removido (`docker rm -f`); `preco-que-da-lucro-postgres` (`:5432`) permaneceu no ar e `docker-compose.yml` não foi editado. A sonda que renderiza o SQL (seção 4) foi **deletada** e não está no branch.

## Rollback

`git revert <sha do commit>`; o container efêmero já foi removido e o `:5432` permanece intocado.
