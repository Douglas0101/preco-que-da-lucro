# Evidência — TRILHO D1 · F-C5-2 + F-C5-3 (scanner `transactionSites` por binding + gate do drift)

- **Itens:** **F-C5-2** (o scanner da matriz M-02 conta texto cru ⇒ `transactionSites` deixa de ser inventário) e **F-C5-3** (o drift da matriz é invisível ao gate local).
- **Branch:** `trk-d1-matrix` · **base:** `759330f` (= `develop` pós-land A/B/C) · **worktree:** `.worktree-trk-d1` (`cwd` explícito em todo comando).
- **Specs lidas antes da primeira linha:** `RELATORIO-CICLO-5-2026-09-17.md` §F-C5-2/§F-C5-3 · `WP-9.2T.md` resíduos S1/S2/S3 · `QUEUE.md:79` (S0 resgatado) · `spec.md:26` (definição de `transactionSites`) · `reconciliation-r5.md` §2 (leitura de atomicidade que o rótulo alimenta) · `m02-boundaries.ts` (consumidor do campo).
- **Ambiente:** `env -u DATABASE_URL_UNPOOLED` em todo lançamento · `:5432`/Neon/`vercel`/host remoto **intocados** · **sem** `git push` · `docs/specs/M-02/matrix*.yaml` **não** regenerado nem commitado nesta trilha (é do MAESTRO no land) · ledger (`EXECUTION-STATE-PROGRAM.md`/`PROGRESS.md`) **não** escrito.

## 1. Semântica declarada (o que o scanner passou a contar)

O scanner saiu de `scripts/m02-matrix.ts` para um **módulo puro** (`scripts/lib/m02-transaction-sites.ts`), sem leitura de disco e sem efeito de carga, para poder ser testado sobre fixtures em string. As quatro regras que substituem a busca textual `/\b(request|context)\.transaction\b/g`:

1. **Site = expressão de valor no AST.** Comentário não é nó do AST; literal de string é `StringLiteral`; `typeof context.transaction` é posição de tipo. Nenhum dos três conta. (Comentário era 5 das 91 ocorrências do pai.)
2. **Alias conta por binding.** `const tx = <handle>.transaction` (ou `let`/`var`) **não** vale 1: vale **uma entrada por referência de valor a `tx`** no escopo léxico do alias — isto é, por instrução que efetivamente roda na transação. Alias sem referência vale **0** (não executa instrução alguma). Sombreamento por nome homônimo (parâmetro/declaração aninhada) é respeitado e a listagem sai na linha de cada referência, não na linha da declaração. É a leitura que o S0 resgatou ("N statements contam 1 site") e a que `reconciliation-r5.md` já usava manualmente para agrupar sites.
3. **`src/test/**` fora da varredura.** Código de teste não é caminho de runtime: as asserções `expect(...).toBe(context.transaction)` e as sondas type-only de teste não são sites transacionais (5 das 91 ocorrências do pai).
4. **Classificação com evidência de runtime, com precedência do _shape_ sobre o caminho.** O `shape` do site é decidido na AST:
   - `executor-fallback` → rótulo **`repository-fallback`**: o handle só preenche o executor padrão (`executor: Executor = context.transaction`) ou o lado direito de `??`/`||`; não abre transação, herda a do chamador.
   - caminho em `src/server/auth/` → **`auth-allowlist`** (mesmo prefixo que `m02-boundaries.ts` allowlista).
   - caminho em `src/server/repositories/` → **`repository-fallback`**.
   - resto → **`compatibility-facade`** (fachada/adapter que estreita o handle neutro).

   Consequência declarada: **um arquivo só-tipo não produz site nenhum**, logo não recebe rótulo de runtime (`transaction.contracts.ts` sai da matriz); e um fallback de executor fora de `repositories/` passa a ser rotulado pelo que é, não pelo diretório — 3 sites mudam de rótulo (`event.service.ts` 2, `outbox.worker.ts` 1).

   _Delta de rótulos: `compatibility-facade` 24→22 · `repository-fallback` 66→89 · `auth-allowlist` 1→2._

O módulo também hospeda a **guarda de entrypoint** (`isEntrypoint`), porque o gerador a usa e ela é a defesa contra a armadilha medida no S0:

- `scripts/m02-matrix.ts` ganhou a guarda `if (isEntrypoint(import.meta.url, process.argv[1]))` em volta de `buildMatrix()`/`writeOutputs()`/`checkOutputs()`. Antes, **qualquer** `import` do script regravava `docs/specs/M-02/matrix{,.generated}.yaml`; agora só a execução como script escreve ou valida (coberto por teste, `RAW-vitest-green-fixtures.txt`).

## 2. Files tocados

| Arquivo                                          | Mudança                                                                                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib/m02-transaction-sites.ts`           | **novo** — scanner/classificador/guarda puros (296 linhas, sem I/O)                                                                                                                           |
| `scripts/m02-matrix.ts`                          | passa a importar o módulo (remove `classifyTransactionSite` e `transactionSites` locais) + guarda de entrypoint                                                                               |
| `src/test/m02-transaction-sites.test.ts`         | **novo** — 14 testes sobre fixtures em string (contagem por binding, comentário, literal, posição de tipo, `src/test/**`, sombreamento, fallback, determinismo) + guarda de entrypoint/import |
| `package.json` (`scripts.check`, linha 77)       | `npm run m02:matrix:check` entra no encadeamento do `check` (F-C5-3 opção **a**)                                                                                                              |
| `.github/workflows/ui-stack.yml` (após `npm ci`) | passo `npm run m02:matrix:check` no job `verify` (F-C5-3 opção **b**)                                                                                                                         |

`docs/specs/M-02/**` **intocado** (`git status --short docs/specs` vazio, `RAW-static-gates.txt`). Nenhum teste que leia `package.json` e asserte a string do script foi escrito (pin de implementação **proibido** pelo contrato): o gate é provado por execução, não por inspeção.

## 3. RED → GREEN medido (não afirmado)

### 3.1 Fixtures contra a semântica do pai

O pai não é importável para fixture (o módulo não exporta nada e grava a matriz ao carregar), então o RED foi medido com um **stand-in fiel**: as duas funções substituídas, copiadas do pai e adaptadas só para receber a fonte como string em vez de ler do disco, sob a **mesma** API do módulo novo. O stand-in foi **swapeado no lugar do módulo real** e o **mesmo arquivo de teste** rodou; o real foi restaurado em seguida (hash conferido).

```text
$ sha256sum scripts/lib/m02-transaction-sites.ts          # após restaurar
d60ad757a757f41daaab1302a591fe30a4623c383ab8c453a0ba9913141b8659  scripts/lib/m02-transaction-sites.ts
$ env -u DATABASE_URL_UNPOOLED npx vitest run src/test/m02-transaction-sites.test.ts --reporter=verbose
     Tests  9 failed | 5 passed (14)          EXIT=1        ← RAW-vitest-red-parent-fixtures.txt
$ (restaura o real)
$ env -u DATABASE_URL_UNPOOLED npx vitest run src/test/m02-transaction-sites.test.ts --reporter=verbose
     Tests  14 passed (14)                    EXIT=0        ← RAW-vitest-green-fixtures.txt
```

Fixtures (i)–(iv) do aceite, e o resultado no pai:

| #   | Fixture                                                          | Pai (RED)                         | Entrega (GREEN)           |
| --- | ---------------------------------------------------------------- | --------------------------------- | ------------------------- |
| i   | alias + 3 referências (`tx.insert`/`tx.update`/`tx.select`)      | 1 site na linha da **declaração** | 3 sites, nas linhas 4/5/6 |
| ii  | comentário (`/** … context.transaction … */` em arquivo só-tipo) | 2 sites `compatibility-facade`    | 0 sites                   |
| iii | literais de string (`"context.transaction"`, template)           | 2 sites                           | 0 sites                   |
| iv  | posição de tipo (`typeof context.transaction`)                   | 1 site                            | 0 sites                   |

Os 5 testes que já passavam no pai são os que **não** medem o defeito: uso direto do handle sem alias (1 site nos dois), determinismo de ordem (o pai também é determinístico), rótulo por caminho em `auth`/`repositories`/facade (o pai acerta esses três) e os dois testes da guarda de entrypoint (a guarda é defesa nova, não correção do scanner). Os 9 que falham no pai são exatamente os das fixtures (i)–(iv) + sombreamento/alias morto + os três de classificação por evidência.

### 3.2 Gate do drift (F-C5-3)

Ligado **nos dois lugares** (declarado): `npm run check` (linha 77, logo após `m02:lockfile-guard`) e o workflow `ui-stack.yml` (passo imediatamente após `npm ci`). Medição numa **cópia** da árvore integrada (`/tmp/trkd1-gate`), matriz **regenerada só na cópia**:

```text
$ env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check      # GREEN, execução 1   EXIT=0
M-02 matrix is deterministic and up to date.
$ env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check      # GREEN, execução 2   EXIT=0
$ sha256sum -c /tmp/trkd1-gate-sums.txt                      # 3 gerações seguidas
docs/specs/M-02/matrix.yaml: OK
docs/specs/M-02/matrix.generated.yaml: OK                    EXIT=0   ← RAW-gate-green-determinism.txt

$ printf 'export const inertDriftProbe = true;\n' > src/db/inert-drift-probe.ts
$ env -u DATABASE_URL_UNPOOLED npm run m02:boundaries        # validador INTERNO   EXIT=0
M-02 BFF boundary is clean: all database reachability is allowlisted or repository-only.
$ env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check      # gate NOVO           EXIT=1
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.
$ rm src/db/inert-drift-probe.ts && npm run m02:matrix:check # restaurado          EXIT=0
                                                              ← RAW-gate-red-drift.txt
```

O par é a prova do F-C5-3: um arquivo inerte novo sob `src/db/` muda `directDatabaseFiles`/`transactionSites` da árvore, mas `m02:boundaries` continua **verde** (ele recomputa as contagens _da própria matriz_ — consistência interna, nunca contra a árvore) e só o gate novo acusa. Estado do pai medido no mesmo documento (`RAW-gate-wiring.txt`): `git show 759330f:package.json | jq -r .scripts.check | grep -c m02:matrix:check` = **0** e `git show 759330f:.github/workflows/ui-stack.yml | grep -c m02:matrix:check` = **0**.

## 4. Números da árvore real (evidência, não asserção)

Mesma árvore, mesmo `npx tsx scripts/m02-matrix.ts`, pai (`/tmp/trkd1-red`, cópia limpa de `759330f`, `sha256(scripts/m02-matrix.ts)=ea9c2ef1…`) versus entrega (`/tmp/trkd1-gate`, `sha256(scripts/lib/m02-transaction-sites.ts)=d60ad757…`).

```text
path                                                          pai  novo  delta
src/lib/ai/tool-registry.ts                                     9     9    =
src/lib/ai/tool-runner.ts                                       3    11  +8
src/lib/chat-execution.server.ts                                1     2  +1
src/server/auth/membership.service.ts                           1     2  +1
src/server/contracts/transaction.contracts.ts                   1     0  -1
src/server/repositories/ai-tool.repository.ts                   6     8  +2
src/server/repositories/audit.repository.ts                     1     1    =
src/server/repositories/calculation-snapshot.repository.ts      2     3  +1
src/server/repositories/conversation.repository.ts              8     8    =
src/server/repositories/dashboard.repository.ts                 1     6  +5
src/server/repositories/expense.repository.ts                   4     6  +2
src/server/repositories/memory.repository.ts                   11    10  -1
src/server/repositories/outbox.repository.ts                    6     5  -1
src/server/repositories/product.repository.ts                  19    28  +9
src/server/repositories/purchase-price.repository.ts            2     3  +1
src/server/repositories/sales.repository.ts                     4     6  +2
src/server/repositories/simulation.repository.ts                2     2    =
src/server/services/event.service.ts                            3     2  -1
src/server/services/expense.service.ts                          1     0  -1
src/server/services/outbox.worker.ts                            1     1    =
src/test/event-service.test.ts                                  4     0  -4
src/test/product-contracts.test.ts                              1     0  -1
TOTAL                                                          91   113  +22
```

- **`transactionSites`: 91 → 113.** As três âncoras do S0 batem exatamente: `tool-runner` **3→11**, `dashboard.repository` **1→6**, `product.repository` **19→28**.
- **As outras cinco contagens não mudam** (`bffModules` 8, `createServerFnDeclarations` 35, `concreteOperations` 36, `apiRoutes` 5, `directDatabaseFiles` 48) — a mudança é isolada em `transactionSites` (`RAW-counts-delta.txt`).
- Saídas de geração: `RAW-parent-baseline.txt` (pai) e `RAW-new-generate.txt` (entrega). Nenhum dos dois comandos imprime stdout (escrevem a matriz); os números vêm do `jq` sobre a matriz regenerada na cópia.
- **A matriz comitada permanece a do pai** (`matrix.yaml a0a6d64e…`, `matrix.generated.yaml d40cd9b3…`): por isso `npx tsx scripts/m02-matrix.ts --check` **na árvore do branch** sai **1** (drift esperado) até o MAESTRO regenerar e commitar — é exatamente o comportamento que o F-C5-3 torna visível. `RAW-static-gates.txt`.

## 5. Comandos de reprodução

```bash
# worktree/branch
git -C /home/douglas-souza/preco-que-d-main worktree add .worktree-trk-d1 -b trk-d1-matrix develop
cd /home/douglas-souza/preco-que-d-main/.worktree-trk-d1 && env -u DATABASE_URL_UNPOOLED npm ci --ignore-scripts

# alvos desta trilha
env -u DATABASE_URL_UNPOOLED npx vitest run src/test/m02-transaction-sites.test.ts
npx tsc --noEmit
npx prettier --check scripts/lib/m02-transaction-sites.ts scripts/m02-matrix.ts src/test/m02-transaction-sites.test.ts package.json .github/workflows/ui-stack.yml
env -u DATABASE_URL_UNPOOLED npm run m02:boundaries

# cópia para medir geração/gate sem tocar docs/specs do worktree
tar -c --exclude=node_modules --exclude=.git . | tar -x -C /tmp/trkd1-gate && ln -s "$PWD/node_modules" /tmp/trkd1-gate/node_modules
cd /tmp/trkd1-gate && env -u DATABASE_URL_UNPOOLED npm run m02:matrix:generate && env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check
```

Fonte do stand-in de RED (`sha256 b746a423…` no momento da medição; nunca entregue, removido antes do commit):

```ts
export function classifyTransactionSite(input: {
  path: string;
  shape: TransactionSiteShape;
}): TransactionSiteClassification {
  const normalized = input.path;
  if (normalized.startsWith("src/server/auth/")) return "auth-allowlist";
  if (normalized.startsWith("src/server/repositories/")) return "repository-fallback";
  return "compatibility-facade";
}

export function transactionSites(sources: readonly TransactionSiteSource[]): TransactionSite[] {
  const sites: Array<{
    path: string;
    line: number;
    expression: "request.transaction" | "context.transaction";
    classification: "auth-allowlist" | "repository-fallback" | "compatibility-facade";
  }> = [];
  for (const { path, source } of sources) {
    const pattern = /\b(request|context)\.transaction\b/g;
    for (const match of source.matchAll(pattern)) {
      const prefix = source.slice(0, match.index ?? 0);
      sites.push({
        path,
        line: prefix.split("\n").length,
        expression: `${match[1]}.transaction` as "request.transaction" | "context.transaction",
        classification: classifyTransactionSite({ path, shape: "direct-use" }),
      });
    }
  }
  return sites.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}
```

O restante do arquivo era o `isEntrypoint` (a guarda é defesa nova, compartilhada com a entrega) e as declarações de tipo — por isso os dois testes da guarda passam também no RED.

## 6. O que **não** foi feito (resíduos declarados)

- **`docs/specs/M-02/matrix*.yaml` não regenerado e não commitado** (instrução do despacho: é do MAESTRO no land). Consequência explícita: no branch `trk-d1-matrix`, `npm run check` **falha** no passo novo (`m02:matrix:check`, drift) e o passo novo do `ui-stack.yml` também, **até** o MAESTRO commitar a matriz regenerada. O GREEN do gate foi medido na cópia regenerada (§3.2).
- **Nenhuma mudança em `scripts/m02-boundaries.ts`**: o contrato determinava só ligar o gate; o validador interno continua sendo consistência interna (a comparação contra a árvore agora é o `m02:matrix:check` no `check`/CI).
- **`reconciliation-r5.md` não foi reescrito**: é documento datado (`13 sites`) e histórico; os números novos estão aqui. Reescrevê-lo seria falsificar a medição daquele ciclo.
- **`src/test/simulation.service.test.ts:84`** (`(context as { transaction: unknown }).transaction = new FakeTransaction()`) não aparece na varredura: está em `src/test/**` (fora por caminho) e nem é leitura de valor do handle.
- **Contagem de "transações físicas"** continua fora do escopo: o campo é inventário de **sites**, como o próprio `reconciliation-r5.md` conclui; nada aqui prova commit/rollback por unidade de trabalho.
- **`npm run check` completo, `db:test`, e2e e `build`**: não rodados (validação project-wide é do MAESTRO/E2; o despacho proíbe). Rodados apenas os alvos: vitest escopado, `tsc --noEmit`, `prettier --check` dos arquivos tocados, `m02:boundaries`, geração/check da matriz em cópia.
