# CLAIM — WP-C4-1 (`23503 → CONFLICT` latentemente morto: helper topo-só não enxerga o erro embrulhado pelo Drizzle)

- **wp / squad / branch / commit:** WP-C4-1 · `SQUAD-APP` · `mission/n6a-fk-conflict` (worktree `/tmp/wt-fk`, base **`0b797b8`** = `origin/develop` com CI verde) · **commit único do item** = helper corrigido + teste novo (RED→GREEN unitário + banco real) + este CLAIM (`git -C /tmp/wt-fk log -1 --format=%H`); nada pushado, sem PR, sem `--force`.
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-6.md` §WP-C4-1 (lido inteiro) · resíduo **R2** de `CLAIMS-INBOX/WP-9.2R-VERDICT.md` · `src/lib/products.functions.ts:188-190` (o helper) e `:521` (o uso) · padrão canônico `src/server/repositories/memory.repository.ts:303-311` (`isUniqueViolation`, cadeia de `cause`, profundidade 4) · lições pagas: `cwd` explícito, `env -u DATABASE_URL_UNPOOLED`, container efêmero próprio, `npm run build` no E1, `format:check` antes de commitar.
- **status pleiteado:** **DONE** — evidência **E1** (provisória, no worktree). **E2** (`npm run check` + `npm run db:test` no HEAD integrado, container PG17 virgem) é do MAESTRO.
- **diff stat (tracked + novo):**

```console
$ git -C /tmp/wt-fk diff --stat
 src/lib/products.functions.ts | 14 +++++++++++++-
 1 file changed, 13 insertions(+), 1 deletion(-)

$ git -C /tmp/wt-fk status --porcelain
 M src/lib/products.functions.ts
?? src/test/products-fk-conflict.test.ts
```

(`docs/specs/M-02/matrix*.yaml`, `package.json`, `drizzle/**`, `src/db/schema.ts` **não** aparecem: intocados. Nenhum teste existente foi alterado — só o novo `src/test/products-fk-conflict.test.ts`.)

- **cadeia SDD:**
  1. SPEC-CARD lido inteiro antes da primeira linha + o R2 do veredicto (a medição do shape) + o padrão canônico. Nenhum SPEC-DELTA necessário.
  2. S2 ISOLATE: worktree próprio + branch + container PG17 efêmero próprio (§2.1).
  3. S3 BUILD: helper topo-só → caminhada da cadeia de `cause` (§2.3).
  4. S4 VERIFY (E1): RED→GREEN dirigido + banco real + controles negativos + `tsc` + `build` + `m02:boundaries` + `format:check` + grep do resíduo (§3).
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

## 1. Problema atacado

`isForeignKeyViolation(error)` (privada, `src/lib/products.functions.ts:188-190`) testava o SQLSTATE **apenas no topo** do objeto:

```ts
function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
```

O `drizzle-orm@0.45` embrulha a falha do driver em `DrizzleQueryError` (`pg-core/session.js:41,48,59,66,81,98`, `new DrizzleQueryError(queryString, params, e)`), onde `code` é `undefined` e o SQLSTATE mora em `.cause`. Medição própria (§2.7): `top.code = undefined · cause.code = "23503"`. Logo o helper **nunca** retornava `true` no caminho real e `deleteIngredient`/`deletePackaging` de um filho com histórico (`purchase_price_history`, FK `ON DELETE restrict`) devolviam o erro cru do driver (500) em vez do **409 `CONFLICT`** prometido. Defeito **pré-existente** (não é regressão do ciclo 4): o `catch` em `:533` estava correto, o predicado é que era cego.

## 2. Execução

### 2.1 S2 ISOLATE

```console
$ git worktree add -b mission/n6a-fk-conflict /tmp/wt-fk 0b797b8   # base com CI verde
$ cd /tmp/wt-fk && npm ci --ignore-scripts                         # 613 packages
$ docker run -d --name c4-1-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=preco_que_da_lucro_test -p 55510:5432 postgres:17-alpine
5778d5e26fa4e86977d012dfffca49a6927201f609a319bb7acd8f026a92de13
/var/run/postgresql:5432 - accepting connections
```

Container **próprio** `c4-1-pg` em `127.0.0.1:55510` (fora da lista proibida 5432/55432/55455/55470/55480/55490/55495), removido ao fim (§6). `:5432` do `preco-que-da-lucro-postgres` **não** tocado; nenhum host remoto, nenhum `ALLOW_REMOTE_DB`, nenhum push. Todo comando mutante com `cwd` explícito; todo lançamento com `env -u DATABASE_URL_UNPOOLED` (e `-u DATABASE_URL` no lançamento do vitest, para o gate de loopback não herdar credencial).

### 2.2 Decisão de escopo: **não** consolidar (declarada)

O card oferecia consolidar `isForeignKeyViolation` + `isUniqueViolation` em `src/lib/db-error.ts`. **Escolha: manter os dois helpers e corrigir só o quebrado.** Razões: (a) o card manda preferir a correção mínima quando a consolidação amplia o diff — tocar `memory.repository.ts` (730 linhas, dono de um caminho transacional delicado com `ON CONFLICT`/advisory lock) acrescentaria risco a um WP que é de mapeamento de erro; (b) o helper quebrado é **privado** e tem **um** consumidor; (c) o diff fica em 2 arquivos (helper + teste). O padrão canônico foi **copiado verbatim** (§2.3), então a divergência futura é de forma, não de semântica. O resíduo §4.4 registra a dívida.

### 2.3 S3 BUILD — diff-chave do helper

```diff
--- a/src/lib/products.functions.ts
+++ b/src/lib/products.functions.ts
@@
-function isForeignKeyViolation(error: unknown): boolean {
-  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
-}
+/** Violação de chave estrangeira do Postgres (SQLSTATE `23503`). O Drizzle
+ * embrulha o erro do driver (`DrizzleQueryError`), então o SQLSTATE tem de ser
+ * buscado na cadeia de causas — mesma técnica de `isUniqueViolation` em
+ * `src/server/repositories/memory.repository.ts`. Profundidade limitada: uma
+ * cadeia circular não trava. */
+function isForeignKeyViolation(error: unknown): boolean {
+  let current: unknown = error;
+  for (let depth = 0; depth < 4; depth += 1) {
+    if (typeof current !== "object" || current === null) return false;
+    if ("code" in current && current.code === "23503") return true;
+    if (!("cause" in current)) return false;
+    current = current.cause;
+  }
+  return false;
+}
```

O `catch` (`:533`) **não** foi tocado; a mensagem observada pelos testes existentes (`"O registro possui histórico de preços e não pode ser removido."`) e o `cause: error` continuam iguais. **Nenhuma regra de negócio nova**; o mapeamento segue no consumidor (BFF), não no adapter. Helper segue **específico**: só `23503`.

## 3. EVIDENCE (comandos exatos + saída colada)

### 3.1 S4 VERIFY — RED primeiro (código **não** corrigido)

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_URL \
    DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:55510/preco_que_da_lucro_test' \
    npx vitest run src/test/products-fk-conflict.test.ts
 ❯ src/test/products-fk-conflict.test.ts (9 tests | 4 failed) 516ms
     × deleteIngredient mapeia o erro embrulhado pelo Drizzle (cause.code = 23503) para CONFLICT/409 11ms
     × deletePackaging usa o mesmo mapeamento 1ms
     × ingrediente com histórico ⇒ CONFLICT/409 (antes: erro cru do driver) 10ms
     × embalagem com histórico ⇒ CONFLICT/409 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/test/products-fk-conflict.test.ts > mapeamento FK 23503 → CONFLICT (WP-C4-1) > deleteIngredient mapeia o erro embrulhado pelo Drizzle (cause.code = 23503) para CONFLICT/409
AssertionError: expected Error: Failed query: delete from "product… { …(2) } to match object { name: 'ApplicationError', …(4) }
(4 matching properties omitted from actual)

- Expected
+ Received

- {
-   "cause": DrizzleQueryError {
-     "message": "Failed query: delete from \"product_ingredients\" where \"id\" = $1
- params: c4100000-0000-4000-8000-000000000004",
-     "cause": error {
-       "message": "update or delete on table \"product_ingredients\" violates foreign key constraint \"purchase_price_history_tenant_id_ingredient_id_product_i_fk\" on table \"purchase_price_history\"",
-       "length": 0,
+ DrizzleQueryError {
 ❯ src/test/products-fk-conflict.test.ts:87:6

 FAIL  src/test/products-fk-conflict.test.ts > mapeamento FK 23503 → CONFLICT (WP-C4-1) > deletePackaging usa o mesmo mapeamento
AssertionError: expected Error: Failed query: delete from "product… { …(2) } to be an instance of ApplicationError
 ❯ src/test/products-fk-conflict.test.ts:105:19

 FAIL  src/test/products-fk-conflict.test.ts > delete de filho com histórico — caminho real do driver (PG efêmero) > ingrediente com histórico ⇒ CONFLICT/409 (antes: erro cru do driver)
AssertionError: expected Error: Failed query: delete from "product… { …(2) } to be an instance of ApplicationError
 ❯ src/test/products-fk-conflict.test.ts:254:19

 FAIL  src/test/products-fk-conflict.test.ts > delete de filho com histórico — caminho real do driver (PG efêmero) > embalagem com histórico ⇒ CONFLICT/409
AssertionError: expected Error: Failed query: delete from "product… { …(2) } to be an instance of ApplicationError
 ❯ src/test/products-fk-conflict.test.ts:262:19

 Test Files  1 failed (1)
```

As 5 asserções que passam antes e depois (assertivas do correto): os 2 controles negativos unitários (23505 e sem `cause`), o controle de cadeia circular, o `NOT_FOUND` do caminho real e o controle positivo de que o histórico continua restringindo o delete. **A falha é exatamente a predita pelo R2**: o que chega é `DrizzleQueryError`, não `ApplicationError`.

### 3.2 S4 VERIFY — GREEN (após o fix)

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_URL \
    DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:55510/preco_que_da_lucro_test' \
    npx vitest run src/test/products-fk-conflict.test.ts

 RUN  v4.1.11 /tmp/wt-fk

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  13:11:43
   Duration  1.70s (transform 224ms, setup 95ms, import 938ms, tests 101ms, environment 474ms)
```

**Caminho real exercitado (DoD 3):** o bloco `dbDescribe` **rodou** (9/9, não skip) contra `c4-1-pg`: `runMigrations(adminUrl)` + `ensureRuntimeRoleMembership(pool)`, sessão como `app_runtime` com GUCs do tenant (`set local role app_runtime`), filho com linha em `purchase_price_history` ⇒ `deleteIngredient`/`deletePackaging` rejeitam **`ApplicationError { code: 'CONFLICT', status: 409, retryable: false }`** — antes: `DrizzleQueryError` cru. O teste também reconfere, por `count(*)`, que as 2 linhas de histórico e o filho seguem no banco (o rollback da transação desfaz o delete abortado).

### 3.3 Shape real do driver (probe própria, fora do repo)

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_URL tsx /tmp/fk-probe/probe.mts
[
  { "ctor": "DrizzleQueryError", "name": "Error", "code": undefined,  "message": "Failed query: delete from product_ingredients where tenant_id = $1 and id = $2" },
  { "ctor": "DatabaseError",     "name": "error", "code": "23503",    "message": "update or delete on table \"product_ingredients\" violates foreign key constraint \"purchase_..." }
]
top.code = undefined · cause.code = "23503"
```

(Reproduz a medição do R2 com o `DELETE` cru, sem passar pelo port; confirma que o shape que o helper precisa enxergar é `DrizzleQueryError{code:undefined}.cause.code === "23503"`.)

### 3.4 Os três blocos de teste (unit + controles negativos), com o shape real

O helper é privado, então o teste o exercita pelo **caminho exportado** (`deleteIngredient`/`deletePackaging`) com o `@tanstack/react-start` mockado no padrão do repo (`bff-create-update-contract.test.ts:8-17`) e, para os controles negativos, uma transação falsa que rejeita no `returning()` — **só o driver é substituído**: `deleteProductChild` + serviço + repositório reais rodam. O erro injetado é construído com as classes reais (`DrizzleQueryError` de `drizzle-orm/errors` + `DatabaseError` de `pg`), byte a byte com o shape medido em §3.3.

| caso                                                              | esperado                                         | RED (antes) | GREEN (depois) |
| ----------------------------------------------------------------- | ------------------------------------------------ | ----------- | -------------- |
| `cause.code = 23503` (ingrediente)                                | `CONFLICT`/409, `cause` = orig                   | **falha**   | **passa**      |
| `cause.code = 23503` (embalagem)                                  | `CONFLICT`/409                                   | **falha**   | **passa**      |
| **negativo:** `code = 23505`                                      | relança o **mesmo** erro                         | passa       | passa          |
| **negativo:** `Error("NOT_FOUND")` sem `cause`                    | relança o **mesmo** erro                         | passa       | passa          |
| profundidade limitada: `cause` circular                           | não trava; relança o mesmo                       | passa       | passa          |
| **banco real:** ingrediente/embalagem com histórico               | `CONFLICT`/409                                   | **falha**   | **passa**      |
| **banco real:** filho inexistente                                 | `Error("NOT_FOUND")`, **não** `ApplicationError` | passa       | passa          |
| **banco real:** histórico preservado (`count(*)` = 2 e filho = 1) | linha intacta                                    | passa       | passa          |

### 3.5 Gate de tipos / fronteira / build / format

```console
$ npx tsc --noEmit
TSC_EXIT=0

$ npm run m02:boundaries
M-02 BFF boundary is clean: all database reachability is allowlisted or repository-only.
BOUNDARIES_EXIT=0

$ npm run build
✓ built in 659ms
[success] [nitro] You can preview this build using `npx vite preview`
BUILD_EXIT=0

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!
FORMAT_EXIT=0

$ npx eslint src/test/products-fk-conflict.test.ts src/lib/products.functions.ts
ESLINT_EXIT=0
```

(O `build` roda no E1 porque o arquivo tocado é alcançável pelo cliente; ele era o gate que pegou o R1 do ciclo 4. `format:check` rodado **antes** do commit.)

### 3.6 Testes existentes dos caminhos tocados (sem alterar asserção)

```console
$ env -u DATABASE_URL_UNPOOLED -u DATABASE_URL npx vitest run \
    src/test/products-fk-conflict.test.ts src/test/financial-metrics.test.ts \
    src/test/finance.boundaries.test.ts src/test/perf-summarize.test.ts \
    src/test/query-performance.test.ts src/test/products-read-models.golden.perf-waves.test.ts \
    src/test/product-contracts.test.ts src/test/bff-create-update-contract.test.ts

 Test Files  8 passed (8)
      Tests  66 passed | 13 skipped (79)
```

Os 8 arquivos são os que importam `@/lib/products.functions` (`grep -rln`). Nenhum arquivo de teste existente foi editado (`git status` §topo) — os 13 skips são o bloco de banco de `product-contracts.test.ts`, que sem `DATABASE_ADMIN_URL` é skip rotulado por desenho.

### 3.7 Grep provando que o helper topo-só não existe mais

```console
$ grep -n 'typeof error === "object" && error !== null && "code" in error' src/lib/products.functions.ts
GREP_OLD_EXIT=1                       # zero ocorrências (o corpo antigo sumiu)

$ grep -n '23503' src/lib/products.functions.ts
188:/** Violação de chave estrangeira do Postgres (SQLSTATE `23503`). O Drizzle
197:    if ("code" in current && current.code === "23503") return true;   # dentro do laço de causas

$ grep -rn 'isForeignKeyViolation' src/
src/lib/products.functions.ts:193:function isForeignKeyViolation(error: unknown): boolean {
src/lib/products.functions.ts:533:    if (isForeignKeyViolation(error)) {
```

## 4. Resíduos

1. **R-a (do WP, não do fix): o teste de banco novo fica fora da cadeia `db:test`.** Como `product-contracts.test.ts` (R6 do WP-9.2R), o bloco `dbDescribe` só roda com `DATABASE_ADMIN_URL` loopback e **sem** a credencial herdada `DATABASE_URL_UNPOOLED`; `npm run check`/`db:test` não injetam essas variáveis, então o E2 vê o arquivo verde com **9 skips**. A prova real é §3.2 (container `c4-1-pg`, 9/9). Proposta C do §5.
2. **R-b: o gate `m02:boundaries` continua cego a violação real de fronteira** (lê só `docs/specs/M-02/matrix.yaml`) — herdado do veredicto (R5). O gate que de fato pega fronteira é o `build`, que rodou exit 0.
3. **R-c: o mesmo padrão topo-só existe em `scripts/db/test-migrations.ts:616,636,712`** (`"code" in error && error.code === "23503"`). **Fora do escopo exclusivo** do card e provavelmente correto lá (aquelas checagens usam `pool.query` cru, cujo erro é o `DatabaseError` do driver, **não** embrulhado). Não tocado; registrado para ninguém "descobrir" depois.
4. **R-d: duplicação declarada** (§2.2): `isForeignKeyViolation` (cadeia, 4 níveis) agora é cópia estrutural de `isUniqueViolation`. Se um terceiro helper aparecer, a consolidação em `src/lib/db-error.ts` (`isSqlState(error, code)`) passa a valer — não fiz agora para manter o diff mínimo.
5. **R-e: mensagem fixa.** O texto do 409 (`"O registro possui histórico de preços e não pode ser removido."`) é genérico para qualquer `23503` no delete de filho — inclui `fee`, que não tem FK de histórico. É o comportamento pré-existente do `catch`, preservado de propósito (o card proíbe mudar mensagens observadas por testes).

## 5. Propostas de integração (quem aplica é o MAESTRO)

**A. Integrar o commit** `mission/n6a-fk-conflict` (base `0b797b8`) sem alterações; o diff é de 1 arquivo de produção + 1 teste novo.

**B. Nada a regenerar na matrix.** O helper é privado e nenhuma operação de banco foi criada/removida/renomeada; `m02:boundaries` exit 0. **Cuidado:** o arquivo ganhou 12 linhas líquidas antes do `catch` (o comentário + o laço no lugar de um `return`) ⇒ as `line` de `docs/specs/M-02/matrix*.yaml` para `src/lib/products.functions.ts` podem ter driftado (mesmo fenômeno declarado como R5 no WP-9.2R). Se o `m02:matrix:check` do E2 acusar, a regeneração é `npm run m02:matrix:generate` (MAESTRO).

**C. (Opcional, fora deste WP) Colocar o bloco de banco na cadeia de E2.** Padrão que serviria para `product-contracts.test.ts` e para este arquivo: um runner que exporte `DATABASE_ADMIN_URL` loopback + `DATABASE_URL` do `app_runtime` antes do `vitest run`, fechando o oco "E2 vê skips" (R6/R-a).

## 6. Limites declarados

- **E2 não executado** (é do MAESTRO): `npm run check`, `npm run db:test`, `m02:matrix:check`. Não rodei a suíte inteira nem `db:test` (proibido pelo card).
- **Container efêmero `c4-1-pg`**: criado em `127.0.0.1:55510`, **removido ao fim** (`docker rm -f c4-1-pg`, zero ocorrências em `docker ps -a`). Nenhum comando tocou `:5432`, host remoto ou `ALLOW_REMOTE_DB`.
- **Nada pushado**; branch local; sem PR; sem `--force`.
- **Testes existentes não alterados** — nenhuma asserção re-pinada; a suíte dirigida é a prova de não-regressão no E1.
- A prova de banco **não** está em `db:test` (R-a) — repetida aqui para o adversarial reconferir com o comando do §3.2.

- **rollback:** `git revert <sha>`
