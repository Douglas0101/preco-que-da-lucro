# Evidência — TRILHO D2 · F-C6-1 + F-C6-2 (mapeamento `23503` ciente da constraint + a prova de banco no `db:test`)

- **Itens:** **F-C6-1** (`isForeignKeyViolation` testava só `code === "23503"` e `deleteProductChild` convertia **qualquer** `23503` em `409 CONFLICT` com a mensagem fixa de "histórico de preços") e **F-C6-2** (`db:test` não rodava `src/test/products-fk-conflict.test.ts`: os 4 casos de banco só existiam no `npm run test`, onde são pulados em silêncio sem `DATABASE_ADMIN_URL`).
- **Branch:** `trk-d2-fk` · **base:** `ca9f95c` (= `develop` pós-land A/B/C/D1) · **worktree:** `.worktree-trk-d2` (`cwd` explícito em todo comando; `npm ci --ignore-scripts` no worktree).
- **Ambiente:** `env -u DATABASE_URL_UNPOOLED` em todo lançamento · container **próprio** `trk-d2-pg` (postgres:17-alpine em `127.0.0.1:55470`, destruído ao fim) · `:5432` (container do dev), Neon, host remoto, `vercel` e `git push` **intocados** · `docs/specs/M-02/matrix*.yaml` **não** regenerado nem commitado (regeneração é do MAESTRO no land) · ledger (`EXECUTION-STATE-PROGRAM.md`/`PROGRESS.md`) **não** escrito.

## 1. Decisões escolhidas e declaradas (exigidas pelo contrato)

1. **Um `23503` de FK alheia continua `409 CONFLICT`, com mensagem genérica** (não é relançado cru). Escolha entre as duas do contrato: `CONFLICT`/409 com `"O registro está referenciado por outros registros e não pode ser removido."`. Razão: o status é **verdadeiro** para qualquer violação de FK em delete (o delete conflita com linhas que a referenciam) e mantém o contrato de 409 do BFF em vez de transformar uma FK futura em 500. O que muda é só a **mensagem**: ela deixa de afirmar "histórico de preços" quando a constraint não é de `purchase_price_history`. (`DATABASE_ERROR`/500 para uma FK real seria uma regressão de contrato; o relançamento cru era a outra opção permitida.)
2. **O mapeamento passa a inspecionar `constraint`.** `deleteProductChild` só usa a mensagem de histórico quando `DatabaseError.constraint` é **uma das duas** FKs reais de `purchase_price_history`; qualquer outro `23503` (inclusive sem `constraint` informada) cai na mensagem genérica.
3. **Limite efetivo da cadeia de causas: `FK_CAUSE_CHAIN_LIMIT = 4`** (elos inspecionados = `depth 0…3`), o **mesmo** valor que `isUniqueViolation` já usava no pai — o D2 não alargou nem estreitou a janela, só a nomeou e a tornou declarada. Medido no caminho real: o `DatabaseError` do driver está em **`depth = 1`** (`DrizzleQueryError` → `DatabaseError`), logo a folga tolera **até 2 wrappers futuros**; um `23503` em `depth = 4` **não** é mapeado (relançado como veio, sem travar) — coberto por teste.
4. **Os nomes das constraints são os truncados em 63 bytes.** O literal da migration `0004_giant_nocturne.sql:31-32` tem 82/79 caracteres; o PostgreSQL corta identificadores em `NAMEDATALEN - 1` = 63 bytes, e é o nome **cortado** que chega em `.constraint`. Medido no banco (`RAW-pg-constraint-names.txt`) e no erro real (`RAW-real-driver-error-shape.txt`): `purchase_price_history_tenant_id_ingredient_id_product_ingredie` e `purchase_price_history_tenant_id_packaging_id_product_packaging`.
5. **O ramo genérico é hoje inalcançável por FK real** — varredura em `pg_constraint` do banco migrado: as **duas** FKs de `purchase_price_history` são as **únicas** que referenciam `product_ingredients`/`product_packaging`. Ele existe para não voltar a mentir quando uma terceira FK aparecer, e é exercitado por erro sintético com o shape real do driver (teste de unidade).

## 2. Ficheiros tocados

| Arquivo                                   | Mudança                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/products.functions.ts`           | `isForeignKeyViolation` (booleano, cego à constraint) → `foreignKeyViolation` (devolve `{ constraint }`), + `PURCHASE_HISTORY_FKS` (`:195`) + `FK_CAUSE_CHAIN_LIMIT` (`:203`); `deleteProductChild` (`:549`) escolhe a mensagem pela constraint. +39/−15 linhas. |
| `src/test/products-fk-conflict.test.ts`   | +4 casos de unidade (constraint alheia; `depth=2` detectado; `depth=4` fora do limite; `cause` primitiva) e as duas provas de banco passam a assertar **a mensagem** de histórico. +104/−10 linhas.                                                              |
| `scripts/db/test-products-fk-conflict.ts` | **novo** — passo encadeado: exige `DATABASE_ADMIN_URL` (`requireAdminUrl`) e roda a suíte do arquivo com o reporter JSON, **falhando alto** se algum caso do arquivo tiver sido pulado.                                                                          |
| `package.json:61` (`db:test`)             | o passo novo entra no fim do encadeamento (15º passo).                                                                                                                                                                                                           |

Nenhum teste lê `package.json` e assere a string do script (pin de implementação proibido pelo contrato): a ligação é provada **por execução** (`RAW-green-f-c6-2-dbtest.txt`), não por inspeção.

## 3. RED → GREEN medido (não afirmado)

### 3.1 F-C6-1 — o defeito é a cegueira à constraint

RED medido no worktree com **só o teste alterado** (`git diff --stat` = `src/test/products-fk-conflict.test.ts` apenas; `src/` ainda no pai):

```text
$ npx vitest run src/test/products-fk-conflict.test.ts          # pai: src/ intacto, teste novo
      Tests  1 failed | 8 passed | 4 skipped (13)   EXIT=1      ← RAW-red-f-c6-1-unit.txt

FAIL … > F-C6-1: 23503 de FK alheia não herda a mensagem de histórico
AssertionError: expected ApplicationError: O registro possui histó…{…} to match object { code: 'CONFLICT', status: 409, …(2) }
-   "message": "O registro está referenciado por outros registros e não pode ser removido.",
+ ApplicationError { "code": "CONFLICT", "status": 409 }
```

A falha é **exatamente** a alegação do item: com `constraint = "another_table_tenant_id_ingredient_id_fk"` o pai respondia com a mensagem de histórico. As outras 8 passam no pai (incluindo `depth=2` e `depth=4`) — são caracterização/regressão, não RED.

GREEN (fix aplicado): `Tests 9 passed | 4 skipped (13)`, EXIT=0 (`RAW-green-f-c6-1-unit.txt`) e, contra o caminho real do driver no container efêmero, `Tests 13 passed (13)`, EXIT=0 (`RAW-green-f-c6-1-db.txt`).

### 3.2 F-C6-2 — a prova de banco não estava no `db:test`

RED medido contra o **pai** (`git show HEAD:…`, sem tocar no worktree):

```text
$ git show HEAD:package.json | grep -c 'test-products-fk-conflict'
0                                                    ← RAW-red-f-c6-2-parent-dbtest-wiring.txt
$ npx vitest run <arquivo do pai>                    # sem DATABASE_ADMIN_URL
      Tests  5 passed | 4 skipped (9)    EXIT=0      ← RAW-red-f-c6-2-parent-silent-skip.txt
```

Os 4 casos de banco do pai ou não eram alcançados por `db:test` (0 de 14 passos) ou eram **pulados em silêncio** com exit 0.

GREEN: `npm run db:test` completo no container efêmero, **EXIT=0**, com o passo novo no fim (`RAW-green-f-c6-2-dbtest.txt`):

```text
 ✓ src/test/products-fk-conflict.test.ts (13 tests) 100ms
      Tests  13 passed (13)
prova de banco (src/test/products-fk-conflict.test.ts) contra 127.0.0.1: 13 passed (13), 0 skipped — admin=127.0.0.1:55470
```

> **Delta declarado contra o DoD:** o contrato esperava `Tests 9 passed (9)` (5 de unidade + 4 de banco, contagem do pai). O arquivo passou a ter **13** casos porque F-C6-1 exigiu 4 casos de unidade novos (constraint alheia, `depth=2`, `depth=4`, `cause` primitiva) — mesmo arquivo, mesmo passo; a linha crua é `Tests 13 passed (13)`, sem nenhum skip.

## 4. Controle negativo do fail-closed

| cenário                                                             | resultado                                                                                                                                                             |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| passo novo **sem** `DATABASE_ADMIN_URL`                             | `Error: DATABASE_ADMIN_URL é obrigatória para migrations` · **EXIT=1** — `RAW-control-failclosed-no-admin-url.txt`                                                    |
| passo novo com URL **remota** (gate de loopback do teste pulando)   | `Tests 9 passed \| 4 skipped (13)` e depois `AssertionError: a prova de banco foi pulada (4 testes pendentes)` · **EXIT=1** — `RAW-control-failclosed-remote-url.txt` |
| `npm run test` **sem** URL (comportamento declarado, não regressão) | `Test Files 85 passed (85)` · `Tests 838 passed \| 13 skipped (851)` · **EXIT=0** — `RAW-green-npm-test-without-url.txt`                                              |

A URL remota nunca foi contatada: o gate de loopback do próprio teste desabilita o bloco antes de abrir qualquer conexão, e o runner converte o skip silencioso em falha dura. Com a URL local, `0 skipped`.

## 5. Gates do trilho

| gate                          | comando                                   | resultado                                                             |
| ----------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| prova de banco encadeada      | `npm run db:test` (PG17 efêmero `:55470`) | **EXIT=0**, 15 passos, último = `13 passed (13), 0 skipped`           |
| suíte sem banco               | `npm run test` (sem `DATABASE_ADMIN_URL`) | **EXIT=0** — `838 passed \| 13 skipped`                               |
| tipos                         | `npx tsc --noEmit`                        | **EXIT=0**, sem saída                                                 |
| formatação (arquivos tocados) | `npx prettier --check <4 arquivos>`       | `All matched files use Prettier code style!` — `RAW-static-gates.txt` |

**Não** rodados (fora do alvo do trilho, por contrato): `npm run check` completo, `build`, e2e, `db:check`. O E2 é do MAESTRO.

## 6. Drift de matriz M-02 — **esperado** e declarado (não regenerado)

`npm run m02:matrix:check` em `trk-d2-fk`: **EXIT=1** (`RAW-matrix-drift-check.txt`). O drift foi **medido** sem deixar rastro: `m02:matrix:generate` rodado uma vez, `git diff` capturado (`RAW-matrix-drift-diff.txt`) e os dois YAML restaurados com `git checkout --` (`git status --short docs/specs` vazio depois).

- **18 entradas** de `bffs[].operations[].line` deslocam em cada arquivo (`matrix.yaml` e `matrix.generated.yaml`): 36 linhas alteradas por arquivo, 72 no total. **Dois degraus**, não um:
  - **+21** nas **10** operações que ficam **acima** de `deleteProductChild` — `listProducts 318→339`, `listProductsWithMetrics 326→347`, `getProduct 332→353`, `createProduct 423→444`, `updateProduct 428→449`, `upsertProduct 434→455`, `archiveProduct 443→464`, `deleteProduct 453→474`, `upsertIngredient 486→507`, **`deleteIngredient 544→568`**;
  - **+24** nas **8** que ficam **abaixo**: `upsertPackaging 559→583`, **`deletePackaging 584→608`**, `upsertFee 598→622`, `deleteFee 612→636`, `setMarketPrice 624→648`, `getProductMetrics 638→662`, `listPurchasePrices 650→674`, `updatePurchasePrice 661→685`.
- A causa dos dois degraus: o bloco substituído (`isForeignKeyViolation` → `PURCHASE_HISTORY_FKS` + `FK_CAUSE_CHAIN_LIMIT` + `foreignKeyViolation`) é uma troca de **15 → 36 linhas = +21** (`diff --numstat` do arquivo: +39/−15), e a escolha da mensagem dentro de `deleteProductChild` acrescenta **+3** mais abaixo.
- Nenhuma entrada entra/sai da matriz: é drift **só de número de linha** (a assinatura do arquivo, `createServerFn`/alias, não muda).
- **A regeneração é do MAESTRO no land** (`npm run m02:matrix:generate` + revisão). Nada de `docs/specs/M-02/**` foi commitado nesta trilha.

## 7. O que explicitamente NÃO foi feito

- **Não** regenerado nem commitado `docs/specs/M-02/matrix*.yaml` (só medido e restaurado).
- **Não** escrito ledger (`EXECUTION-STATE-PROGRAM.md`/`PROGRESS.md`/`QUEUE.md`).
- **Não** rodados `npm run check` completo, `build`, `db:check`, e2e (E2 do MAESTRO); **não** rodado `lint`/`format:check` de árvore inteira (só prettier dos 4 arquivos tocados).
- **Não** tocado `:5432`, Neon, host remoto, `vercel`; **sem** `git push`.
- **Não** alterado o texto da mensagem de histórico (`"O registro possui histórico de preços e não pode ser removido."`) nem o status `409`/`retryable: false` já contratados.
- **Não** feito o ramo genérico alcançável por banco: hoje nenhuma outra FK referencia os filhos do produto (medido em `pg_constraint`), então a alegação correspondente é provada por erro sintético com o shape real do driver e **declarada** como tal.
- **Não** instrumentado o caso "FK de outro tenant"/RLS: fora do escopo do S0.

## 8. Evidência selada

`manifest.sha256` (gerado neste diretório) cobre `README.md`, este `probe-*.ts` e todos os `RAW-*.txt`; a conferência está em `RAW-manifest-check.txt` (`sha256sum -c` = **ALL MATCH**). O `probe-real-driver-error-shape.ts` é a sonda descartável que mediu a profundidade e os campos do erro do driver (não é código de produção, não é importado por nada e não vive em `src/`/`scripts/`).
