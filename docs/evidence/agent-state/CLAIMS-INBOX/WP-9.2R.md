# CLAIM — WP-9.2R (`9.2` residual: zerar os 4 pontos de acesso direto à transação)

- **wp / squad / branch / commit:** WP-9.2R · `SQUAD-APP` · `mission/n4a-9-2-residual` (worktree `/tmp/wt-92r`, base **`fdd7e4d`**) · **commit único do item** = contrato + adapter + rewire dos 3 consumidores + o teste novo + este CLAIM (`git -C /tmp/wt-92r log -1 --format=%H`); nada pushado, sem PR, sem `--force`.
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-4.md` §WP-9.2R (lido inteiro) · `docs/evidence/plan-recap-2026-09-15/MEDICAO-2026-09-15.md:109` (os 4 pontos, nominal) · Plano §9.2/§9.3 · `docs/specs/M-02/spec.md:57-60` · `AGENT-ENV-NOTES.md` §10 (credencial de produção herdada) · lição de `cwd` explícito do ciclo 3.
- **status pleiteado:** **DONE** — evidência **E1** (provisória, no worktree). **E2** (`npm run check` + `npm run db:test` no HEAD integrado, container PG17 virgem) é do MAESTRO, assim como a regeneração de `docs/specs/M-02/matrix*.yaml`.
- **diff stat (tracked; o contrato e o teste novo são untracked):**

```console
$ git -C /tmp/wt-92r diff --stat
 src/lib/products.functions.ts                 | 567 +++++++-------------------
 src/server/repositories/product.repository.ts | 556 ++++++++++++++++++++++++-
 src/server/services/product-detail.service.ts |  73 +---
 src/server/services/purchase-price.service.ts |  74 ++--
 4 files changed, 727 insertions(+), 543 deletions(-)

$ git -C /tmp/wt-92r status --porcelain
 M src/lib/products.functions.ts
 M src/server/repositories/product.repository.ts
 M src/server/services/product-detail.service.ts
 M src/server/services/purchase-price.service.ts
?? src/server/contracts/product.contracts.ts
?? src/test/product-contracts.test.ts
```

(`docs/specs/M-02/matrix*.yaml`, `package.json`, `drizzle/**` e `src/db/schema.ts` **não** aparecem: intocados. A suíte de teste não aparece: **nenhum arquivo de teste existente foi alterado** — só o novo `src/test/product-contracts.test.ts`.)

- **cadeia SDD:**
  1. SPEC-CARD lido inteiro antes da primeira linha (`SPEC-CARDS/CICLO-4.md` §WP-9.2R) + a medição nominal dos 4 pontos. Nenhum SPEC-DELTA necessário.
  2. S2 ISOLATE: worktree próprio + branch + container PG17 efêmero próprio (§2.1).
  3. S3 BUILD: contrato type-only → adapter implementa → rewire dos consumidores (§2.3).
  4. S4 VERIFY (E1): vitest dirigido + `tsc` + `m02:boundaries` + grep de resíduo (§3).
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

## 1. Problema atacado

O item `9.2` estava **PARTIAL** porque o port `ProductRepository` existia, mas **morava dentro do arquivo que importa o driver** (`src/server/repositories/product.repository.ts`), e quatro caminhos continuavam falando com a transação do driver:

| #   | ponto (medição nominal)                                | o que fazia na transação                                                              |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | `src/lib/products.functions.ts:169-455`                | read-model: 5 `select()` diretos + o UNION consolidado dos filhos via `sql` templated |
| 2   | `src/lib/products.functions.ts:697-828`                | escritas de filho: insert/update de ingredientes, embalagem e taxas (+ delete/market) |
| 3   | `src/server/services/purchase-price.service.ts:79-115` | `update` direto em `productIngredients`                                               |
| 4   | `src/server/services/product-detail.service.ts:45-81`  | 5 `select()` diretos (produto/ingredientes/embalagem/taxas/mercado)                   |

Os três arquivos importavam `drizzle-orm` **e** `@/db/schema`, então consumidores de leitura precisavam do driver só para tipar/projetar. O WP-9.2R zera isso: o port vai para um contrato **somente-tipo**, o adapter Drizzle passa a ser o **único** lugar com driver, e os três consumidores passam a falar só com o port — **sem mudança de comportamento observável** (os 5 arquivos de teste do card seguem verdes **sem uma asserção alterada**).

## 2. Cadeia SDD

### 2.1 S2 — isolamento (worktree, branch, banco)

```console
$ git -C /home/douglas-souza/.omp/wt/wt-20260916-234317-7609fed worktree add -b mission/n4a-9-2-residual /tmp/wt-92r fdd7e4d
Preparing worktree (new branch 'mission/n4a-9-2-residual')
HEAD is now at fdd7e4d docs(evidence): read the infrastructure through the owner Firefox session

$ cd /tmp/wt-92r && npm ci --ignore-scripts     # node_modules do worktree
added 613 packages in 5s

$ env -u DATABASE_URL_UNPOOLED docker run -d --name pqdl-n4a-92r \
    -e POSTGRES_DB=preco_que_da_lucro_test -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55470:5432 postgres:17-alpine
a1d07630ae4d7ad39f53b54cc8cfc2078dfa02f3120439a90ee183dabee70b81

$ docker ps --format '{{.Names}}\t{{.Ports}}'
pqdl-n4a-92r	127.0.0.1:55470->5432/tcp                    # MEU efêmero (porta ≠ 5432/55432/55440/55450/55460)
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp        # :5432 do projeto — INTOCADO (nenhum comando meu o tocou)
```

Todo lançamento de processo subiu com `env -u DATABASE_URL_UNPOOLED` e todo comando mutante declarou `cwd` (`cd /tmp/wt-92r` / `git -C /tmp/wt-92r`). Nenhum host remoto, nenhum `ALLOW_REMOTE_DB`, nenhum push.

### 2.2 S3(a) — contrato type-only + adapter

**`src/server/contracts/product.contracts.ts` (novo, 247 linhas, só tipo):** nenhum valor executável, nenhum import do driver/schema (o único import é `import type { RequestContext } from "@/lib/request-context"`, exatamente como `event.contracts.ts`). Declara:

- as formas de linha do agregado (`Product`, `ProductIngredient`, `ProductPackaging`, `SalesFee`, `MarketPrice`, `ProductRef`) — estruturais às colunas do schema, para o consumidor não precisar de `@/db/schema`;
- os tipos que já existiam no repositório (`ProductQuery`, `ProductWrite`, `ProductRepository`, agora com as operações novas);
- as operações que cada ponto exige: `loadDetail` (pontos 1-detalhe/4), `loadReadModel` (ponto 1-lista), `loadPurchasePriceRows` (a listagem da tela de preços, que também estava no ponto 1), `saveIngredient`/`savePackaging`/`saveFee`/`createMarketPrice`/`deleteChild` (ponto 2) e `updateIngredientPrice`/`updatePackagingPrice` + `IngredientPriceUpdate`/`PackagingPriceUpdate`/`IngredientPriceRow`/`PackagingPriceRow` (ponto 3);
- a fatia `ProductChildPriceWriter = Pick<ProductRepository, "updateIngredientPrice" | "updatePackagingPrice">`, que é o que o serviço de preço de compra injeta.

**`src/server/repositories/product.repository.ts`:** passa a **implementar** o port (o adaptador Drizzle é o único arquivo com `drizzle-orm`), recebendo o SQL que estava nos consumidores — os 4 branches do UNION consolidado, `loadChildRows`/`normalizeChildRow` (paridade de driver nos timestamps) e os mapeamentos `kind → tabela`. Os tipos continuam disponíveis pelo caminho antigo (`export type { ... } from "@/server/contracts/product.contracts"`), então `src/server/services/product.service.ts` — **fora do meu escopo** — não precisou mudar.

**Regra de negócio/financeira não foi para o adapter:** o cálculo (`calculateProductReadModel`), os mapeamentos snake_case do BFF, a decisão de `priceUpdatedAt` (só carimba quando veio preço) e o mapeamento de violação de FK (`23503` → `ApplicationError("CONFLICT")`) continuam nos consumidores; o adapter só executa SQL e deriva `tenantId`/`userId` do `RequestContext`.

### 2.3 S3(b) — rewire dos consumidores (injeção pelo padrão do repo)

- **`src/lib/products.functions.ts`**: `loadProductDetail`/`loadProductReadModels`/`listPurchasePrices`/`upsertIngredient`/`upsertPackaging`/`upsertFee`/`setMarketPrice`/`deleteChild` passam a chamar `productRepository.*` (singleton composto no módulo, mesmo padrão de `productService`/`purchasePriceService`); o agrupamento/projeção financeira continua no arquivo. As **20** declarações `export const` (server functions + inputs) são **idênticas** às de antes (`diff` dos nomes exportados = vazio), então nenhuma assinatura consumida por `src/routes/_authenticated/{produtos,precos,ponto-equilibrio}.tsx` ou `src/lib/query-options.ts` mudou.
- **`src/server/services/purchase-price.service.ts`**: `update` passa a usar o port para a **linha base** dos filhos (`updateIngredientPrice`/`updatePackagingPrice`) e o port de histórico continua com o advisory lock/append. Injeção: `constructor(repository: PurchasePriceRepository, productChildren: ProductChildPriceWriter = productRepository)` — **mesmo padrão de `event.service.ts:33`** (`= outboxRepository`) e `expense.service.ts` (`events: EventService = eventService`). O lock ordering `lock → update → append` é o mesmo (teste do card, verde).
- **`src/server/services/product-detail.service.ts`**: troca os 5 `select()` por `productRepository.loadDetail`, mantendo a projeção financeira (`calculateProductReadModel`, `metrics`).

### 2.4 S4 — E1

**(1) Grep de resíduo — vazio (exit 1 = nenhum match), nos 4 arquivos** (os 3 consumidores + o contrato novo, cobrindo as duas leituras possíveis de "os 4 arquivos" do card):

```console
$ cd /tmp/wt-92r && grep -rn "drizzle-orm\|@/db/schema\|\.transaction" \
    src/lib/products.functions.ts src/server/services/purchase-price.service.ts \
    src/server/services/product-detail.service.ts src/server/contracts/product.contracts.ts
GREP_EXIT=1        # nenhuma linha
```

Controle positivo do grep (o adapter é o único lugar que **deve** ter o driver, e o `m02:boundaries` o allowlista por prefixo):

```console
$ grep -c "drizzle-orm" src/server/repositories/product.repository.ts
1
```

**(2) Os 5 arquivos de teste do card — verdes, sem asserção alterada:**

```console
$ env -u DATABASE_URL_UNPOOLED npx vitest run src/test/products-read-models.golden.perf-waves.test.ts \
    src/test/bff-create-update-contract.test.ts src/test/purchase-price.service.test.ts \
    src/test/finance.boundaries.test.ts src/test/query-performance.test.ts --reporter=verbose
 RUN  v4.1.11 /tmp/wt-92r

 ✓ src/test/finance.boundaries.test.ts > fronteiras de persistência FIN-002 > remove defaults legados que convertiam rendimento/imposto ausentes em 1/0 2ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de persistência FIN-002 > preserva rendimento/imposto desconhecidos como null no fluxo conversacional 1ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de persistência FIN-002 > preserva null também quando o produto é criado pelo BFF manual 1ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de entrada FIN-003 > usa strings decimais finitas em todos os schemas do BFF financeiro 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de entrada FIN-003 > rejeita texto vazio e números não finitos nos formulários financeiros 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de entrada FIN-003 > mantém invalid distinto de incomplete nos consumidores financeiros 1ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de entrada FIN-003 > impõe taxas individuais abaixo de 100% no BFF 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de proveniência FIN-004 > torna a origem do volume obrigatória no contrato do motor 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de proveniência FIN-004 > remove o cenário atual fictício e inicia o volume manual vazio 1ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de proveniência FIN-004 > não apresenta soma de preços ou média simples como KPI consolidado 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de proveniência FIN-004 > distingue falha de consulta de uma coleção financeira vazia 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de formação de preço FIN-005 > remove multiplicador arbitrário e linguagem de preço sugerido 1ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de formação de preço FIN-005 > exige premissas explícitas sem transformar vazio em zero 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de formação de preço FIN-005 > distingue cálculo interno, simulação e referência de mercado 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de formação de preço FIN-005 > não rateia despesas periódicas sem volume ou direcionador 0ms
 ✓ src/test/finance.boundaries.test.ts > fronteiras de formação de preço FIN-005 > calcula custo direto sem depender do preço atual e verifica erros remotos 1ms
 ✓ src/test/products-read-models.golden.perf-waves.test.ts > T2 perf-waves: golden de leituras consolidadas de produtos > mantém paridade exata da resposta JSON (fixture capturada antes da consolidação) 57ms
 ✓ src/test/products-read-models.golden.perf-waves.test.ts > T2 perf-waves: golden de leituras consolidadas de produtos > loadProductReadModels executa no máximo 2 queries por invocação 5ms
 ✓ src/test/products-read-models.golden.perf-waves.test.ts > T2 perf-waves: golden de leituras consolidadas de produtos > listPurchasePrices executa no máximo 2 queries por invocação 2ms
 ✓ src/test/products-read-models.golden.perf-waves.test.ts > T2 perf-waves: golden de leituras consolidadas de produtos > lista vazia de produtos executa apenas a query de produtos 3ms
 ✓ src/test/products-read-models.golden.perf-waves.test.ts > T2 perf-waves: golden de leituras consolidadas de produtos > snapshot cobre produtos, filhos e primeiro preço de mercado por produto 8ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > gera a mesma chave para a mesma simulação e inclui todos os campos relevantes 3ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > diferencia mudanças em cada campo relevante da simulação 1ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > mantém a simulação no staleTime operacional e sem retry das queries autenticadas 1ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > diferencia staleTime por natureza do dado (plano §17.5) 0ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > invalida a coleção de produtos sem invalidar a simulação 2ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > mantém número fixo de queries do read model do dashboard 3ms
 ✓ src/test/query-performance.test.ts > query keys e política de cache financeira > mantém número fixo de queries no read model batch de produtos 5ms
 ✓ src/test/bff-create-update-contract.test.ts > BFF create/update split — contrato estático (M02-D-010) > products.functions.ts expõe createProduct/updateProduct e mantém upsert/delete legados 3ms
 ✓ src/test/bff-create-update-contract.test.ts > BFF create/update split — contrato estático (M02-D-010) > expenses.functions.ts expõe createExpense/updateExpense e mantém upsert legado 1ms
 ✓ src/test/bff-create-update-contract.test.ts > BFF create/update split — contrato estático (M02-D-010) > createProductInput não aceita id/version; updateProductInput exige ambos 3ms
 ✓ src/test/bff-create-update-contract.test.ts > BFF create/update split — contrato estático (M02-D-010) > createExpenseInput não aceita id/version; updateExpenseInput exige ambos 2ms
 ✓ src/test/purchase-price.service.test.ts > PurchasePriceService > normaliza preço/quantidade e mantém metadados no histórico 3ms
 ✓ src/test/purchase-price.service.test.ts > PurchasePriceService > rejeita quantidade ausente/inválida e preserva autorização 1ms
 ✓ src/test/purchase-price.service.test.ts > PurchasePriceService > adquire o advisory lock ANTES do UPDATE da linha base (lock ordering) 1ms
 ✓ src/test/purchase-price.service.test.ts > DrizzlePurchasePriceRepository > serializa por tenant/kind/subject e deduplica somente o mesmo valor efetivo 2ms

 Test Files  5 passed (5)
      Tests  36 passed (36)
   Start at  02:45:29
   Duration  3.84s (transform 920ms, setup 615ms, import 4.66s, tests 127ms, environment 3.88s)
```

Vizinhança também verde (não-vacuidade do que já existia, nada alterado): `npx vitest run src/test/contracts.test.ts src/test/financial-metrics.test.ts src/test/optimistic-version.repository.test.ts src/test/product-completeness.test.ts src/test/route-loading-skeletons.test.tsx src/test/snapshot-idempotency.test.ts src/test/ui-stack.test.tsx` → `Test Files 13 passed (13) / Tests 93 passed (93)` (inclui o novo arquivo — ver (3)).

**(3) Teste novo `src/test/product-contracts.test.ts` — contrato + prova de banco das operações novas do port sob `app_runtime`:**

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_URL -u DATABASE_ADMIN_URL \
    DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test' \
    DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test' \
    DATABASE_DRIVER=node-postgres npx vitest run src/test/product-contracts.test.ts --reporter=verbose
 RUN  v4.1.11 /tmp/wt-92r

 ✓ src/test/product-contracts.test.ts > contrato do agregado Product (§9.2 — independente de driver) > declara as operações que os 4 pontos residuais exigem 13ms
 ✓ src/test/product-contracts.test.ts > contrato do agregado Product (§9.2 — independente de driver) > exporta as formas de linha que os consumidores usam sem importar o schema 4ms
 ✓ src/test/product-contracts.test.ts > contrato do agregado Product (§9.2 — independente de driver) > não importa @/db, drizzle-orm nem repositórios 2ms
 ✓ src/test/product-contracts.test.ts > contrato do agregado Product (§9.2 — independente de driver) > é type-only (nenhum valor executável) 2ms
 ✓ src/test/product-contracts.test.ts > contrato do agregado Product (§9.2 — independente de driver) > mantém os 3 consumidores sem driver na transação (§9.2 aceitação 1) 1ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > loadDetail respeita o tenant do contexto (cross-tenant = null) e o controle positivo enxerga o próprio 31ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > a sessão de prova roda como app_runtime e o RLS esconde as linhas do outro tenant 4ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > loadReadModel devolve 0 linhas do outro tenant e o read model do dono não é vazio 18ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > loadPurchasePriceRows devolve só produtos/filhos do tenant do contexto 13ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > saveIngredient insere sob o tenant do contexto e recusa update cross-tenant 34ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > savePackaging/saveFee/createMarketPrice gravam no tenant do contexto 16ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > deleteChild remove a linha do próprio tenant nos 3 filhos e devolve NOT_FOUND no cross-tenant 48ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > updateIngredientPrice/updatePackagingPrice gravam só na linha do tenant e recusam cross-tenant 22ms
 ✓ src/test/product-contracts.test.ts > ProductRepository — operações do port sob app_runtime (PG efêmero) > savePackaging/saveFee recusam update cross-tenant com NOT_FOUND 7ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  02:47:27
   Duration  1.71s (transform 178ms, setup 107ms, import 693ms, tests 340ms, environment 467ms)
```

O bloco de banco **abre cada caso com `set local role app_runtime`** (NOSUPERUSER/NOBYPASSRLS) + GUCs por transação — o admin do container é superuser e bypassaria a policy (mesma técnica de `scripts/db/test-migrations.ts` e `test-outbox.ts:379`). A última asserção de papel é medida, não inferida: `current_user = 'app_runtime'`, `rolbypassrls = false`, `count(*)` de `product_ingredients` visível > 0 (controle positivo não-vacuoso) e cross-tenant = **0**. O gate é fail-closed por URL: qualquer `DATABASE_URL`/`DATABASE_ADMIN_URL`/`DATABASE_URL_UNPOOLED` fora de loopback ⇒ `describe.skip` rotulado (sem banco, o arquivo roda as 5 asserções estáticas e as 9 de banco aparecem como skip).

**(4) Poder discriminante da asserção de resíduo (antes × depois, medido):**

```console
$ for f in src/lib/products.functions.ts src/server/services/purchase-price.service.ts \
           src/server/services/product-detail.service.ts; do
    echo -n "$f (HEAD blob): "; git show HEAD:$f | grep -c "drizzle-orm\|@/db/schema\|\.transaction"
    echo -n "$f (worktree): ";  grep -c "drizzle-orm\|@/db/schema\|\.transaction" $f
  done
src/lib/products.functions.ts (HEAD blob): 22
src/lib/products.functions.ts (worktree): 0
src/server/services/purchase-price.service.ts (HEAD blob): 4
src/server/services/purchase-price.service.ts (worktree): 0
src/server/services/product-detail.service.ts (HEAD blob): 7
src/server/services/product-detail.service.ts (worktree): 0
```

33 linhas de resíduo no HEAD → **0** no worktree. A asserção do teste **morde de verdade**, e a RED foi observada nesta rodada: na primeira execução do arquivo novo ela reprovou porque o _comentário_ de `purchase-price.service.ts` ainda citava o nome do módulo do driver (o texto da asserção é o mesmo do grep obrigatório, então qualquer menção conta):

```console
(excerto das linhas relevantes)
$ npx vitest run src/test/product-contracts.test.ts --reporter=verbose     # 1ª execução, antes de limpar o comentário
 ❯ src/test/product-contracts.test.ts:125:26
    123|     for (const path of PORT_CONSUMERS) {
    124|       const source = projectFile(path);
    125|       expect(source).not.toContain("drizzle-orm");
       |                          ^
     Tests  1 failed | 4 passed | 8 skipped (13)
```

O comentário foi reescrito (sem tocar asserção) e a execução seguinte ficou verde — está registrado aqui, e não como um RED ensaiado: o RED real desta alteração é a própria medição `HEAD blob > 0 → worktree = 0` acima.

**(5) `tsc` e `m02:boundaries`:**

```console
$ cd /tmp/wt-92r && npx tsc -p tsconfig.json --noEmit
TSC_EXIT=0

$ env -u DATABASE_URL_UNPOOLED npm run m02:boundaries
M-02 BFF boundary is clean: all database reachability is allowlisted or repository-only.
BOUNDARIES_EXIT=0
```

**(6) Scripts de banco que exercitam o repositório tocado (prova extra de que a superfície de escrita não regrediu), no MEU container efêmero:**

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_ADMIN_URL \
    DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test' \
    DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test' \
    DATABASE_DRIVER=node-postgres npx tsx scripts/db/test-concurrency.ts
T2 CAS: produto e despesa com 1 update OK + 1 CONFLICT por burst + version incrementada: OK
CONCURRENCY_EXIT=0

$ ... npx tsx scripts/db/test-sql-injection.ts
SQL injection adversarial: parametrização resiste aos 6 payloads, 0 mutações: OK
SQLI_EXIT=0
```

**(7) Lint/format dos arquivos tocados (o `check` é do MAESTRO; aqui é só escopo):**

```console
$ npx prettier --check src/lib/products.functions.ts src/server/repositories/product.repository.ts \
    src/server/services/purchase-price.service.ts src/server/services/product-detail.service.ts \
    src/server/contracts/product.contracts.ts src/test/product-contracts.test.ts
All matched files use Prettier code style!

$ npx eslint <os mesmos 6 arquivos>
ESLINT_EXIT=0
```

**(8) Container efêmero removido ao fim:**

```console
$ env -u DATABASE_URL_UNPOOLED docker rm -f pqdl-n4a-92r
pqdl-n4a-92r
RM_EXIT=0

$ docker ps --format '{{.Names}}\t{{.Ports}}'
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp     # :5432 do projeto, nunca tocado

$ docker ps -a --format '{{.Names}}' | grep -c "pqdl-n4a-92r"
0        # container removido (nem parado/existente)
```

## 3. Aceitação do card — item a item

| aceitação do card                                                                                                                | como está satisfeita                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) zero resíduo: os 4 arquivos sem `drizzle-orm`, `@/db/schema` e `.transaction`, provado por grep vazio                        | §2.4(1): grep exit 1 (vazio) sobre os 3 consumidores + o contrato; controle positivo no adapter. A cobertura é **do arquivo inteiro**, não só da faixa nominal (ver §5-A)                                                                                                                                                                                      |
| (2) o port vive em `src/server/contracts/product.contracts.ts` (novo, type-only) e `product.repository.ts` o implementa          | §2.2: contrato com 1 import `type` e zero declarações de valor (asserção AST própria, no padrão de `contracts.test.ts`); `class DrizzleProductRepository implements ProductRepository`                                                                                                                                                                         |
| (3) os 4 caminhos usam o port, sem mudança de comportamento observável; os 5 testes seguem verdes sem alterar asserção           | §2.3 + §2.4(2): **36/36** nos 5 arquivos, **nenhum arquivo de teste existente alterado** (`git status --porcelain src/test/` = só o `?? src/test/product-contracts.test.ts`); os nomes exportados do BFF idênticos (20/20); o fixture golden do read model **não foi tocado** (`git status` não o lista) e a asserção de paridade exata da resposta JSON passa |
| (4) suíte dirigida + `tsc` + `m02:boundaries` + grep, com saída crua                                                             | §2.4                                                                                                                                                                                                                                                                                                                                                           |
| (5) se alguma operação nova do port não tiver cobertura, teste de banco sob `app_runtime` com isolamento (0 linhas cross-tenant) | §2.4(3): 9 casos de banco; cada operação nova tem (i) controle positivo do dono e (ii) negativo cross-tenant (`null`/`NOT_FOUND`/0 linhas), com o papel e o bypass-RLS **medidos** na própria sessão                                                                                                                                                           |
| (6) nada pushado; `matrix.yaml`/`package.json`/`drizzle/**` intocados                                                            | §header: `git status --porcelain` só mostra os 4 modificados + 2 novos; nenhum push (branch local em worktree)                                                                                                                                                                                                                                                 |

## 4. Riscos e limites declarados

- **E1 é provisório**: a árvore é a do meu worktree; a autoritativa é o `npm run check` + `npm run db:test` do MAESTRO no HEAD integrado (container PG17 virgem). O que sustento aqui: 5/5 arquivos do card verdes sem asserção alterada, 14/14 no teste novo (com banco), `tsc` 0, `m02:boundaries` 0, grep de resíduo vazio, 2 scripts de banco do repo verdes.
- **`matrix.yaml` fica defasado de propósito**: o card manda o MAESTRO regenerar (`npm run m02:matrix:generate`). As `line` das operações de `src/lib/products.functions.ts` e a lista `databasePaths` (que hoje já cita `product.repository.ts`) mudam com este commit; o `m02:matrix:check` (não o `m02:boundaries`) é quem vai apontar a defasagem.
- **O adapter segue sendo o único arquivo com o driver** (por desenho: é ele que implementa o port). A aceitação (1) foi lida como "os consumidores não referenciam `.transaction`"; o grepping dos 4 arquivos inclui o contrato novo e continua vazio.
- **Diferença de plano de execução declarada (não observável via API):** com produto inexistente, o detalhe agora faz **1** query (o `select` do produto) e devolve `NOT_FOUND`, em vez de rodar as 5 e só então lançar. Nenhum teste do repo pina a contagem de queries desse caminho (os dois que pinam contagem são do read model de lista/lista-de-preços, ambos verdes). Nos casos de produto existente a ordem e a contagem são idênticas às de antes.
- **O teste de banco novo é skip-rotulado em E2**: `npm run check`/`npm test` não carrega `DATABASE_URL`/`DATABASE_ADMIN_URL` no processo do vitest (o `.env` só entra no `pretest`/env-guard), e a presença da credencial herdada `DATABASE_URL_UNPOOLED` (produção) também desabilita o bloco por desenho — então o E2 vê o arquivo verde com 9 skips. A prova real está em §2.4(3), com banco local e a variável removida.

## 5. O que NÃO foi feito (declarado, não varrido para debaixo do tapete)

1. **Bateria de UI (S5 do spec-card) não executada.** A delegação recebida termina em "S4 VERIFY (E1) + commitar e parar"; a bateria de S5 (preview local semeado + Playwright nas 3 rotas) e o E2 são do MAESTRO. O que dá sustentação indireta: as 20 assinaturas exportadas do BFF são idênticas, o payload do read model passa na comparação exata contra o golden capturado antes da consolidação (fixture intocado) e o `ui-stack`/`route-loading-skeletons` seguem verdes.
2. **Não rodei `npm run check` nem `npm run db:test` completos** (E2 do MAESTRO); rodei o dirigido do card + `tsc` + `m02:boundaries` + 2 scripts de banco pontuais.
3. **Não editei `docs/specs/M-02/matrix*.yaml`, `package.json`, `drizzle/**`, `src/db/schema.ts`** — proibido pelo card (e a regeneração da matrix é do MAESTRO).
4. **Não editei `src/test/contracts.test.ts`** (registrar `product.contracts.ts` na lista `CONTRACTS` dali é fora do meu escopo exclusivo) — a asserção equivalente vive no meu arquivo novo. Proposta no §6.
5. **Não toquei os outros serviços/repositórios** que ainda referenciam `.transaction` (`event.service.ts`, `expense.service.ts`, `outbox.worker.ts`, `membership.service.ts`, `ai-tool.repository.ts` etc.): o item `9.2` é nominalmente sobre **estes 4 pontos**.
6. **Não adicionei o teste de banco novo à cadeia `db:test`** (seria editar `package.json`, proibido). Proposta no §6.
7. **Não há teste de banco do caminho `updateIngredientPrice`/`updatePackagingPrice` que prove o _append_ do histórico na mesma transação** — isso é do port de preço de compra (fora dos 4 pontos) e o `purchase-price.service.test.ts` cobre a ordem `lock → update → append` com fakes.

## 6. Ambiguidades do spec-card (reportadas, não "consertadas") e propostas

**A. "os 4 arquivos" × 3 arquivos.** Os 4 pontos vivem em **3** arquivos (`products.functions.ts` aparece duas vezes: itens 1 e 2). Interpretei "os 4 arquivos" como o conjunto dos consumidores afetados + o contrato novo, e colei o grep dos **4** caminhos (vazio). Se a intenção era incluir o adapter, o critério é insatisfazível por construção — o adapter _precisa_ do driver para implementar o port (é o item (2) da própria aceitação).

**B. Faixas nominais × arquivo inteiro.** O ponto 3 é citado como `purchase-price.service.ts:79-115` (branch de ingrediente), mas o requisito de "arquivo sem `.transaction`" obriga a mover **também** o branch de embalagem (`:120-155`); idem em `products.functions.ts`: a faixa `:697-828` cobre ingrediente/embalagem/taxas, mas `setMarketPrice` (`:839-860`) e `listPurchasePrices` (`:886-938`) também falavam com a transação e tiveram de ir junto para o grep ficar vazio. Fiz o corte completo por arquivo — se o STEWARD queria só as faixas, o aceite (1) precisaria ser reescrito.

**C. Proposta 1 (integração, quem aplica é o MAESTRO): registrar o contrato no teste de contratos.** Em `src/test/contracts.test.ts`, acrescentar a `CONTRACTS`:

```ts
{ path: "src/server/contracts/product.contracts.ts", exports: ["Product", "ProductRepository", "ProductDetailRows"] },
```

(o teste já checa existência, proibição de import de `@/db`/`drizzle-orm`/repositórios e ausência de valor executável — o meu arquivo novo replica isso, mas a lista canônica é de lá).

**D. Proposta 2: encadear o teste de banco novo no `db:test`.** Como ele é skip-rotulado sem banco, a prova de banco só entra na cadeia se o MAESTRO rodar (sugestão, em `package.json`, fora do meu escopo):

```json
"db:test": "… && npx vitest run src/test/product-contracts.test.ts"
```

com o env do próprio `db:test` (`DATABASE_ADMIN_URL` loopback) — hoje ele fica de fora e o E2 o vê como skip.

**E. Proposta 3: regenerar as `line` da matrix.** `npm run m02:matrix:generate` depois da integração; as operações de `src/lib/products.functions.ts` deslocaram de linha (o arquivo caiu de 938 para 665 linhas) e o `m02:matrix:check` deve ficar verde com exatamente as mesmas operações (nenhuma foi criada/removida/renomeada — §2.3).
