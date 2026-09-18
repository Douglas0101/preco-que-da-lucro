# VERDICT (adversarial) — TRILHO D1 · F-C5-2 + F-C5-3 (scanner `transactionSites` por binding + gate do drift)

- **verificador:** papel ADVERSARIAL em contexto novo (agente `VTrkD1`), convocado pelo MAESTRO. Não implementei nada: tentei **falsificar**.
- **objeto:** claim `docs/evidence/agent-state/CLAIMS-INBOX/TRK-D1/F-C5-2-F-C5-3.md` do worktree `/home/douglas-souza/preco-que-d-main/.worktree-trk-d1` (branch `trk-d1-matrix`, commits `6b62a29` + `4f7bc87`, base `759330f`) + evidência `docs/evidence/trk-d1-matrix-2026-09-18/`.
- **método de bancada:** **nunca** editei arquivo versionado do worktree (`git status --porcelain` vazio ao fim). Cópias próprias em `/tmp/vtrkd1/{base,red,gen,pgen,pgen-ref,gate,inv,preclone}` (tar do worktree sem `node_modules`/`.git`, `node_modules` simbólico) + sondas próprias (fontes em §2). O stand-in de RED é **meu** (escrito a partir de `git show 759330f:scripts/m02-matrix.ts`, adaptando só "ler do disco" → "receber a fonte como string"), não copiado do trilho. `env -u DATABASE_URL_UNPOOLED` em todo lançamento; `:5432`/Neon/host remoto intocados; **sem** `git commit`/`push`.
- **convenção:** `CONFIRMED` = alegação reproduzida por sonda independente; `CORRECTED` = verdadeira só sob condição não declarada / declaração imprecisa; `REJECTED` = falsa como escrita; `UNVERIFIABLE` = não confirmada nem refutada. Linhas **(não reivindicado)** avaliam comportamento que o claim não afirma — nem crédito nem débito dele.

## 1. Linhas de veredicto (uma por alegação)

| id   | alegação (claim / grupo)                                                                                                                            | método próprio (sonda)                                                                                                                    | veredicto   | evidência bruta (saída resumida)                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1.1 | RED real: as fixtures novas contra a semântica do pai dão **9 failed / 5 passed (14)**, EXIT=1, e o pai dá 1 site onde o aceite exige 3, 0 onde exige 1, 2 onde exige 0 | **meu** stand-in do pai (`transactionSites` por regex `/\b(request\|context)\.transaction\b/g` + `classifyTransactionSite` por prefixo, `shape` ignorado; `isEntrypoint` real) swapeado em `/tmp/vtrkd1/red/scripts/lib/…`; mesma suíte | CONFIRMED | `Tests 9 failed \| 5 passed (14)` EXIT=1; as 6 fixtures do aceite + 3 de classificação falham; passam "uso direto", "determinismo", "rótulo por caminho", os 2 da guarda — exatamente a lista declarada |
| G2.1 | "contagem por binding: 1 entrada por referência de valor a `tx` no escopo léxico, na **linha da referência**; alias morto = 0"                        | sonda própria §2.B: alias com 3 refs, 2 aliases em blocos distintos, 2 aliases no mesmo bloco, alias morto, propriedade `obj.tx`           | CONFIRMED   | `3 site(s) [[4,…],[5,…],[6,…]]`; dois aliases homônimos em blocos → `3 site(s) [[4],[8],[9]]`; nomes distintos → `[[4],[5]]`; `obj.tx` e `{ tx: 1 }` não contam; `{ tx }` conta  |
| G2.2 | comentário, literal de string e `src/test/**` não contam                                                                                             | sonda §2.B (iv)/(viii) + per-file diff no disco                                                                                            | CONFIRMED   | `"context.transaction"` e template literal → `0 sites`; interpolação `\`handle=${context.transaction}\`` → 1 (é valor); `src/test/**` → `[]`. No disco: as 5 perdas de contagem são **todas** linhas de docstring (memory 4, outbox.repo 4, event.service 8, expense.service 31, contracts 21) e as 5 de `src/test` |
| G2.3 | "posição de tipo **não conta**" (cláusula declarada como geral)                                                                                     | sonda §2.B (2.iv): alias referenciado **só** em tipo                                                                                       | REJECTED    | `const tx = context.transaction as T; type Handle = typeof tx;` → `2 site(s) [[3],[4]]` (esperado 1); variante sem uso de valor → `1 site` com a mensagem do caso: alias morto **não** vale 0 se a única referência é de tipo. A cláusula só vale para o **handle** (`typeof context.transaction`), não para o **alias** |
| G2.4 | sombreamento por **parâmetro** e por `catch` é respeitado                                                                                            | sonda §2.B (2.v-b, 2.v-c)                                                                                                                  | CONFIRMED   | arrow `(tx: Other) => tx.run()` → `1 site (linha 4)`; `catch (tx) { tx.report() }` → `2 site(s) [[3],[4]]`                                                                      |
| G2.5 | "sombreamento por nome homônimo (**declaração aninhada**) é respeitado"                                                                              | sonda §2.B (2.v): `const tx` em bloco interno com uso depois da sombra                                                                    | REJECTED    | `3 site(s) [[3],[6],[8]]`, esperado 2: a linha 6 (`tx.b()`) é do `tx` **local** e foi contada como site do alias externo. O visitante só poda a subárvore da *própria* declaração sombreadora; irmãos posteriores do bloco continuam contados. **Não ocorre na árvore real** (varredura de re-declaração de nome de alias: `(nenhum)` em 14 arquivos com alias) |
| G2.6 | dois aliases no mesmo arquivo · uso direto **e** alias no mesmo arquivo · template · acesso a propriedade de `tx`                                     | sonda §2.B (2.iii, 2.vii, 2.viii, 2.vi)                                                                                                    | CONFIRMED   | direto+alias → `2 site(s) [[3],[4]]` (o inicializador do alias não é site próprio); `tx.insert` conta, `obj.tx` não                                                                 |
| G2.7 | "…isto é, **por instrução que efetivamente roda** na transação"                                                                                     | sonda §2.B (2.ii) + leitura de `bindingReferences`                                                                                        | CORRECTED   | a contagem é **léxica**, não de fluxo: `const run = async () => tx.insert(rows)` (closure que pode escapar) → `1 site`; `tx.a(); { const tx = x; tx.b(); }` (ramo/escopo morto) também conta. A equivalência "referência léxica == instrução que roda" é aproximação, não teorema |
| G3.1 | `executor-fallback` (default de parâmetro) tem precedência sobre o caminho → `repository-fallback` (F-C5-2 §4)                                      | sonda §2.C: shape × 3 caminhos                                                                                                            | CONFIRMED   | `{AUTH, executor-fallback} → repository-fallback`; `{REPO, executor-fallback} → repository-fallback`; `{FACADE, direct-use} → compatibility-facade`; no disco os 3 `executor: Executor = context.transaction` reais (event.service 38/45, outbox.worker 118) mudam de rótulo |
| G3.2 | "o **lado direito** de `??`/`\|\|`" é o fallback                                                                                                       | sonda §2.C 3.h/3.k: handle à **esquerda** de `??`/`\|\|`                                                                                     | REJECTED    | `const e = context.transaction ?? fallback;` → `1 site [2] repository-fallback` (esperado: não-fallback); idem em `src/server/auth/` com `\|\|` → `repository-fallback` em vez de `auth-allowlist`. `siteShape` não olha o lado. **Não ocorre na árvore real** (varredura do padrão "handle seguido de `??` ou `\|\|`" em `src/**`: 0 ocorrências) |
| G3.3 | `??`/`\|\|` como gatilho de fallback                                                                                                                   | sonda §2.C 3.j                                                                                                                             | CORRECTED   | `executor ??= context.transaction;` → `compatibility-facade` (não fallback): operadores de **atribuição** (`??=`, `\|\|=`) não são cobertos pelo predicado (`QuestionQuestionToken` ≠ `QuestionQuestionEqualsToken`) |
| G3.4 | `src/server/auth/` é o mesmo prefixo do allowlist de `m02-boundaries.ts`                                                                             | `grep` no overlay + leitura do consumidor                                                                                                  | CONFIRMED   | `matrix.overlay.yaml:112-118` tem `{"id":"auth","pathPrefix":"src/server/auth/"}`; `m02-boundaries.ts:63` allowlista por `path.startsWith(entry.pathPrefix)`                    |
| G3.5 | "algum arquivo real muda de rótulo de forma **injustificada**?" → o claim declara exatamente 3 sites                                              | diff por arquivo pai×entrega (sonda §2.D) + leitura dos 3 sites                                                                            | CONFIRMED   | só 3 sites em 2 arquivos mudam de rótulo (`event.service.ts` ×2, `outbox.worker.ts` ×1), todos `executor: Executor = context.transaction` (fallback de executor de verdade, fora de `repositories/`). Os outros 4 arquivos que saem da matriz (1→0) têm como única ocorrência uma **docstring** ou estão em `src/test/**` |
| G3.6 | arquivo só-tipo não recebe rótulo de runtime (`transaction.contracts.ts` sai da matriz)                                                               | sonda de disco                                                                                                                            | CONFIRMED   | `src/server/contracts/transaction.contracts.ts` parent `[21]` → new `[]`, linha 21 = `* (\`context.transaction as DatabaseTransaction\`) uma asserção …` (comentário). Nenhum site novo da árvore cai em linha com `typeof` |
| G3.7 | **(não reivindicado)** o rótulo alimenta alguma política no consumidor?                                                                              | leitura de `scripts/m02-boundaries.ts:105-135`                                                                                            | CONFIRMED   | o consumidor só valida o enum (`["auth-allowlist","repository-fallback","compatibility-facade"]`) e compara as contagens **com a própria matriz** — nomear event.service de `repository-fallback` não mascara nada hoje |
| G4.1 | `npx tsx scripts/m02-matrix.ts` na árvore: **91 → 113**; âncoras tool-runner 3→11, dashboard 1→6, product 19→28; demais contagens inalteradas          | cópia `/tmp/vtrkd1/gen` (entrega) **e** `/tmp/vtrkd1/pgen` com o gerador do **pai** (`git show 759330f`) + remoção do teste novo para reconstruir a árvore do pai | CONFIRMED | `NEW counts: {bffModules:8, createServerFnDeclarations:35, concreteOperations:36, apiRoutes:5, transactionSites:113, directDatabaseFiles:48}`; `PARENT-tree counts: {… transactionSites:91 …}`; âncoras `11 / 6 / 28` (novo) vs `3 / 1 / 19` (pai); rótulos `22/89/2` vs `24/66/1` |
| G4.2 | determinismo de bytes (2–3 gerações)                                                                                                                | 3 gerações no mesmo copy + 1 geração em copy independente                                                                                 | CONFIRMED   | 3× `638cdaa3…` (matrix.yaml) e `c6ce105e…` (matrix.generated.yaml); copy independente (`gen` vs `gate`) → mesmos dois hashes                    |
| G4.3 | **(não reivindicado)** baseline do pai, e o próprio teste novo teria poluído o scanner antigo                                                        | gerador do pai na árvore **atual** (com o teste novo) × árvore do pai                                                                      | CONFIRMED   | pai sobre a árvore atual → `transactionSites:108` (rótulos 41/66/1); removendo `src/test/m02-transaction-sites.test.ts` → **91** (24/66/1). Ou seja: as 17 menções textuais nas fixtures do teste novo teriam inflado a matriz antiga em +17 |
| G5.1 | guarda de entrypoint: **importar** `scripts/m02-matrix.ts` não regrava `docs/specs/M-02/**`                                                          | `await import("./scripts/m02-matrix.ts")` em `/tmp/vtrkd1/guard`; sha256 **e** mtime antes/depois                                          | CONFIRMED   | `matrix.yaml a0a6d64e…` e `matrix.generated.yaml d40cd9b3…` idênticos antes/depois; `stat %Y` idêntico (1789700536); `chaves exportadas pelo script: 0`  |
| G5.2 | como entrypoint continua escrevendo/validando                                                                                                        | 7 formas de invocação, com a matriz ausente para dar sinal binário                                                                         | CONFIRMED   | escrevem: `tsx scripts/m02-matrix.ts`, `./scripts/…`, `$PWD/scripts/…`, `node --import tsx scripts/…`, `npm run m02:matrix:generate`, **e `tsx <path absoluto>` de `cwd=/tmp`** (debug: `isEntry=true`); não escrevem: `tsx imp.mts` (import). `--check` na árvore do branch → `M-02 matrix drift…` EXIT=1 (esperado) |
| G6.1 | gate F-C5-3: arquivo inerte sob `src/db/` é invisível ao `m02:boundaries` e **detectado** pelo `m02:matrix:check`; controle volta a 0                      | cópia `/tmp/vtrkd1/gate` regenerada; `printf 'export const inertDriftProbe = true;\n' > src/db/inert-drift-probe.ts`                         | CONFIRMED   | base: `check` EXIT=0 ×2 (`M-02 matrix is deterministic and up to date.`); com o arquivo: `boundaries` EXIT=0 (`M-02 BFF boundary is clean…`) e `matrix:check` EXIT=1 (`M-02 matrix drift: execute npm run m02:matrix:generate and review the result.`); depois de `rm`: EXIT=0 |
| G6.2 | ligado nos **dois** lugares (check + workflow), sabendo que o pai não tinha nenhum                                                                    | `node -e` no `package.json`, `grep` no workflow, `git show 759330f`                                                                        | CONFIRMED   | `check` = `npm run m02:lockfile-guard && npm run m02:matrix:check && npm run check:ui-stack && …`; `ui-stack.yml:53 npm ci` → `:54 npm run m02:matrix:check` → `:55 check:ui-stack`; pai: `jq -r .scripts.check \| grep -c` = **0** e no workflow = **0** (`ci-light.yml` não roda `npm run check`, não precisa do gate). Nuance conferida: `grep -c` no **arquivo inteiro** do pai dá 1, porque a *definição* `"m02:matrix:check": …` já existia desde antes — o que faltava era o encadeamento (`check`) e o passo de CI |
| G6.3 | nenhum teste assere a string do script (pin de implementação proibido)                                                                               | `grep` em `src/test/**`, `e2e`, `vitest.config.ts`                                                                                         | CONFIRMED   | nenhuma ocorrência de `package.json`/`ui-stack`/`m02:matrix:check` em testes/specs. O teste novo cita `scripts/m02-matrix.ts` só como **caminho importado** (`isEntrypoint(import.meta.url, resolve(root,"scripts/m02-matrix.ts"))`) e no título do `describe` |
| G7.1 | risco de falso positivo "checkout sem `npm ci`"                                                                                                       | cópia `/tmp/vtrkd1/preclone` **sem** `node_modules`; `npm run check`                                                                         | CONFIRMED (risco **não** se materializa) | `npm run check` já para no passo 1 (`m02:lockfile-guard`) com mensagem acionável: `"detail": "node_modules/drizzle-kit ausente (npm ci pendente)"` + `"hint": "git checkout -- package.json package-lock.json && npm ci --ignore-scripts && npm run m02:lockfile-guard"` EXIT=1 — o passo novo nunca é alcançado. Isolado, `m02:matrix:check` sem `npm ci` dá `sh: 1: tsx: not found` EXIT=127 (genérico, mas não é o primeiro erro) |
| G7.2 | risco de falso positivo em cenário **legítimo** com a árvore e a matriz ainda não regeneradas                                                        | 5 cenários na cópia regenerada                                                                                                             | CORRECTED   | **(a) teste novo que importa `@/db`** (`src/test/foo-drift-probe.test.ts` com `import { db } from "@/db/client.server"`) → `boundaries` EXIT=0 mas `matrix:check` **EXIT=1** (muda `directDatabaseFiles`, que hoje tem 48 entradas, **20 delas de `src/test/**`**). (b) teste novo sem `db`, (c) arquivo comum novo, (d) arquivo novo com `context.transaction` **em comentário** → EXIT=0. (e) `src/lib/zzz.functions.ts` → EXIT=1 (drift legítimo). O claim/README só declaram o resíduo "até o MAESTRO regenerar"; não declaram que **toda** mudança em `src/**` que mexa nos 6 contadores (tipicamente um teste novo com import de `db`) passa a reprovar o `check` e o CI |
| G7.3 | "A mensagem é acionável?"                                                                                                                            | leitura da saída + inspeção do que `generate` reescreve                                                                                    | CORRECTED   | diz **o comando** (`npm run m02:matrix:generate`) mas não **o que** drifta nem a contagem: o dev que só adicionou um teste vê "matrix drift", roda o generate e ganha um diff opaco de 58 KB em `matrix.yaml` (que também carrega o overlay inteiro) sem indicação do delta |
| G8.1 | `sha256sum -c manifest.sha256` = 10 entradas, todas OK; nada gitignored prometido                                                                    | `sha256sum -c` + `git check-ignore` por entrada                                                                                            | CONFIRMED   | 10/10 `OK`, `MANIFEST EXIT=0`; `git check-ignore` negativo para as 10 (todas versionadas no commit `6b62a29`)                                                                     |
| G8.2 | 2–3 RAW conferem com o claim                                                                                                                         | reconferência aritmética/de conteúdo contra minhas medições                                                                                | CONFIRMED   | `RAW-parent-baseline.txt` (91; rótulos 24/66/1; 22 arquivos), `RAW-new-generate.txt` (113; 22/89/2; mesma lista por arquivo), `RAW-counts-delta.txt` (+22; tabela completa), `RAW-gate-wiring.txt` (`check` do pai = 0), `RAW-static-gates.txt`, `RAW-vitest-red/green` (9F/5P e 14/14) — todos batem com o que medi | 
| G8.3 | a evidência prova proveniência (hash do pai na cópia do pai)                                                                                        | `sha256sum` do arquivo na cópia `/tmp/trkd1-red` (ainda existente) × `git show 759330f` × `git show 6b62a29`                                | CORRECTED   | `RAW-parent-baseline.txt` registra `913d83b047e59d0b3a94ff23b54be44545e76ef6f17ef5845967a70af872520b  scripts/m02-matrix.ts` sob o cabeçalho "copia limpa do PAI (git archive 759330f)". Esse hash é o do arquivo da **entrega** (`git show 6b62a29:scripts/m02-matrix.ts`); o arquivo da cópia (idêntico ao pai, `diff` vazio) é `ea9c2ef1f5ff…`. Os **números** do RAW são genuínos (reproduzi 91), só a linha de hash está trocada — e o `manifest.sha256` sela o arquivo como está, então não pega erro **de conteúdo** dentro do RAW |

**Contagem final: 29 linhas — 21 `CONFIRMED` (20 + G7.1) · 5 `CORRECTED` (G2.7, G3.3, G7.2, G7.3, G8.3) · 3 `REJECTED` (G2.3, G2.5, G3.2) · 0 `UNVERIFIABLE`.** Nenhum `REJECTED` se materializa na árvore real (as três cláusulas falsas exigem construções ausentes da árvore — provado por varredura, §2.E). O número entregue (113) e as três âncoras são **exatos** e reproduzíveis.

## 2. Evidência bruta (comandos + saída)

### 2.A RED (stand-in próprio do pai)

```text
# /tmp/vtrkd1/red — cópia da árvore integrada com MEU stand-in no lugar do módulo
$ cp /tmp/vtrkd1/red/scripts/lib/m02-transaction-sites.ts  ← stand-in fiel ao pai (regex + prefixo de caminho)
$ env -u DATABASE_URL_UNPOOLED npx vitest run src/test/m02-transaction-sites.test.ts --reporter=verbose
 × conta uma entrada por referência de valor ao alias, não uma por declaração        (pai: 1, esperado 3)
 × conta zero quando o alias não é referenciado e ignora sombreamento por parâmetro  (pai: 2, esperado 1)
 × não conta comentários, nem em arquivo só-tipo                                     (pai: 2, esperado 0)
 × não conta literais de string que mencionam o handle                               (pai: 2, esperado 0)
 × não conta handle em posição de tipo                                              (pai: 1, esperado 0)
 × não varre src/test/**, que é código de teste                                      (pai: 1, esperado 0)
 ✓ conta o uso direto do handle, sem alias
 ✓ é determinístico: duas execuções e a ordem de entrada não mudam os bytes
 ✓ rotula pelo alvo da política, com evidência de runtime
 × rotula fallback de executor como repository-fallback mesmo fora de src/server/repositories
 × rotula o lado direito de ?? como fallback de executor
 × deixa o shape decidir antes do caminho
 ✓ só reconhece o próprio módulo em argv[1]
 ✓ importar o gerador não regrava a matriz
     Tests  9 failed | 5 passed (14)          EXIT=1
# entrega (sem stand-in), na mesma cópia:
     Tests  14 passed (14)                    EXIT=0
```

### 2.B Sondas de semântica (as que furaram/confirmaram as cláusulas)

| sonda                                                                 | obtido (impl. real)                                     | leitura |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| `const tx = …; tx = other; tx.run();`                                  | 2 sites (linhas 3, 4)                                   | reatribuição conta como referência |
| `const tx = …; const run = async () => tx.insert(rows)`                | 1 site (linha 3)                                        | closure conta (execução diferida) |
| dois `const tx` em blocos distintos / dois nomes no mesmo bloco         | 3 / 2 sites                                             | 1 por alias, escopo respeitado |
| `type H = typeof tx; return tx.select()`                               | **2 sites (linhas 3 e 4)**                              | **posição de tipo do alias conta** |
| `const tx = …; type H = typeof tx;` (sem uso de valor)                  | **1 site**                                              | alias "morto" não vale 0 |
| `tx.a(); { const tx = local; tx.b(); } tx.c();`                        | **3 sites (3, 6, 8)**                                   | **sombreamento aninhado vaza** |
| `(tx: Other) => tx.run()` / `catch (tx) { tx.report() }`               | 1 (linha 4) / 2 (linhas 3, 4)                           | parâmetro e catch OK |
| `tx.insert` / `obj.tx` / `{ tx }` / `{ tx: 1 }`                        | conta / não / conta / não                               | correto |
| `const tx = …; await tx.a(); await context.transaction.execute(sql);`  | 2 sites (3, 4)                                          | inicializador do alias não é site próprio |
| `"context.transaction"` × 2 em literais/template                        | 0 sites                                                 | literal não conta |
| `ctx.transaction` e `this.context.transaction`                         | **0 sites**                                             | mesma limitação do pai (handle exige o nome literal) |
| `context?.transaction` / `context!.transaction`                        | 1 site / **0 sites**                                    | `!` no **base** não é reconhecido (`unwrap` só desembrulha o próprio nó) |

### 2.C Fronteiras de classificação

```text
{src/server/auth/, executor-fallback}      → repository-fallback   (shape manda no caminho — declarado)
{repositories/,      executor-fallback}    → repository-fallback
{src/lib/ai/tool-runner.ts, direct-use}    → compatibility-facade
{contracts/, direct-use}                   → compatibility-facade   (o arquivo só-tipo não produz site)
{src/server/auth.ts, direct-use}           → compatibility-facade   (prefixo é dir: `src/server/auth/`)
{src/server/repositories.ts, direct-use}   → compatibility-facade
const e = maybe ?? context.transaction;    → 1 site repository-fallback   (direito — OK)
const e = context.transaction ?? fallback; → 1 site repository-fallback   (ESQUERDO — indevido)
executor ??= context.transaction;          → 1 site compatibility-facade  (não é fallback p/ o código)
context.transaction || fallback  (auth)    → 1 site repository-fallback   (ESQUERDO — indevido)
```

### 2.D Árvore real: pai × entrega (varredura própria, mesma enumeração do gerador)

```text
PARENT total = 108 (árvore ATUAL, com o teste novo)   NEW total = 113
  (removendo o teste novo da cópia do pai: PARENT = 91 — o baseline do claim)
âncoras: tool-runner 3→11 · dashboard 1→6 · product 19→28
rótulos: auth 1→2 · compatibility 24→22 · repository 66→89
outras contagens iguais: bffModules 8 · createServerFnDeclarations 35 · concreteOperations 36 · apiRoutes 5 · directDatabaseFiles 48
mudam de contagem: tool-runner +8, dashboard +5, product +9, chat-execution +1, membership +1, ai-tool +2,
  calc-snapshot +1, expense.repo +2, purchase-price +1, sales +2, contracts -1, memory -1, outbox.repo -1,
  event.service -1, expense.service -1, test/event-service -4, test/product-contracts -1   (= +22)
mudam de RÓTULO: event.service.ts (3→2, ×2 fallback) · outbox.worker.ts (1→1, ×1 fallback)
```

### 2.E Varreduras de "isso ocorre na árvore?" (as 3 cláusulas falsas são latentes)

```text
sites novos cuja linha contém `typeof`                                   →  (nenhum)
sites novos com handle à esquerda de ?? ou ||                            →  (nenhum)
ocorrências textuais de `??=`/`||=` com o handle                         →  (nenhuma em src/; só a fixture de teste)
`context!.transaction` / `this.context.transaction` / `ctx.transaction`  →  (nenhuma)
re-declaração homônima de nome de alias em 14 arquivos com alias         →  (nenhuma)
```

### 2.F Números/gerador/determinismo

```text
$ /tmp/vtrkd1/gen  (entrega)  x3:  matrix.yaml 638cdaa311ca6bd5ea4a4c93f88a66e1e05ed9ca8daa2b90da0cbadc032266ff
                                    matrix.generated.yaml c6ce105e28a7ed2e3a5c781b62dc71c8aa2fbd570fb7c998714108f1abb15004
$ /tmp/vtrkd1/gate (cópia independente): os MESMOS dois hashes
$ /tmp/vtrkd1/pgen (gerador do pai, árvore do pai): 91 · 24/66/1
$ git show 6b62a29:scripts/m02-matrix.ts | sha256sum → 913d83b0…   ← o hash "do pai" registrado no RAW (ver G8.3)
$ git show 759330f:scripts/m02-matrix.ts | sha256sum → ea9c2ef1…
$ git show 6b62a29:scripts/lib/m02-transaction-sites.ts        → d60ad757…  (= declarado)
$ sha256sum src/test/m02-transaction-sites.test.ts             → a39234f162f758aefc707c9b6f073bf0652340ddaf45dd52fb2a28dcea4c97f5 (= declarado)
$ sha256sum docs/specs/M-02/matrix{,.generated}.yaml (branch)  → a0a6d64e… / d40cd9b3…  (= declarado; pai)
$ wc -l scripts/lib/m02-transaction-sites.ts → 296  (= declarado)
$ npx tsc --noEmit → EXIT=0   ·   npx prettier --check (5 arquivos) → All matched files … EXIT=0
```

### 2.G Guarda de entrypoint e gate

```text
$ /tmp/vtrkd1/guard: import-probe.mts → await import("./scripts/m02-matrix.ts")
  antes  = a0a6d64e… / d40cd9b3…   mtime 1789700536
  depois = a0a6d64e… / d40cd9b3…   mtime 1789700536   (idênticos)   IMPORT EXIT=0
$ tsx scripts/m02-matrix.ts --check (branch) → "M-02 matrix drift: …" EXIT=1
$ /tmp/vtrkd1/gate (regenerada): check EXIT=0 ×2 · com src/db/inert-drift-probe.ts: boundaries EXIT=0 / check EXIT=1 · após rm: check EXIT=0
$ cenários E2: (a) teste novo com import @/db → check EXIT=1  (b) teste novo sem db → 0  (c) arquivo comum novo → 0
               (d) arquivo novo com o handle em COMENTÁRIO → 0  (e) src/lib/zzz.functions.ts → 1
$ /tmp/vtrkd1/preclone (sem node_modules): npm run check → EXIT=1 já no passo 1 (m02:lockfile-guard), hint "… && npm ci --ignore-scripts && …"
```

## 3. Divergências declarado × implementado (o que o land precisa decidir)

| #   | divergência                                                                                                          | local no código                                                              | efeito hoje                                                         | veredicto do verificador |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------ |
| D1  | referência de **alias** em posição de tipo conta (`typeof tx`)                                                        | `bindingReferences`/`isValueReference` (`m02-transaction-sites.ts:214-231`)  | nenhum (0 sites da árvore caem em linha de tipo)                    | corrigir ou declarar como limite |
| D2  | sombreamento por `const`/`let` em bloco aninhado **não** é respeitado (o nome sombreado continua contando para o alias externo) | `bindingReferences` (poda só a subárvore da declaração sombreadora)          | nenhum (sem re-declaração homônima na árvore)                       | corrigir ou declarar como limite |
| D3  | lado **esquerdo** de `??`/`\|\|` é rotulado como fallback de executor                                                  | `siteShape` (`:137-146`)                                                     | nenhum (0 ocorrências na árvore)                                    | corrigir ou declarar como limite |
| D4  | `??=`/`\|\|=` não contam como fallback; `context!.transaction` não é site                                              | `siteShape` / `handleBase` (`:88-96`)                                        | nenhum                                                             | declarar como limite |
| D5  | o gate novo transforma qualquer deriva de `src/**` (p.ex. teste novo importando `@/db` → `directDatabaseFiles`) em falha do `check`/CI | `package.json:77` + `ui-stack.yml:54`; `directDatabaseFiles` inclui `src/test/**` | nenhum arquivo hoje; mas é o primeiro atrito que outro PR encontra | mitigar (doc de 1 linha no `AGENTS.md`/CONTRIBUTING ou mensagem que nomeie o contador) |

## 4. Resíduos (o que não verifiquei ou não fecha)

1. **`npm run check` completo, `test:e2e`, `build`, `check:bundle`, `db:test`** — não rodados (validação project-wide é do MAESTRO/E2). Rodei só os alvos escopados: vitest do scanner (14/14), `tsc --noEmit` (0), `prettier --check` dos 5 arquivos (0), `m02:boundaries` (0), geração/check da matriz em cópia. O efeito do passo novo no `check` de ponta a ponta é **inferido** do encadeamento + execução direta do passo.
2. **`ui-stack.yml` não executado** (exigiria CI/Postgres): validei por leitura de posição dos passos e pela execução direta de `npm run m02:matrix:check`. O job também faz `npm ci --ignore-scripts` antes, então o passo novo nunca é o primeiro erro.
3. **Tabela resumida do claim (§3) não soma +22**: lista +15 e omite os +7 de chat-execution (+1), membership (+1), ai-tool (+2), calc-snapshot (+1), expense.repo (+2), purchase-price (+1), sales (+2), outbox.repo (−1), expense.service (−1), event.service (−1). O `RAW-counts-delta.txt` tem a tabela completa e correta — é imprecisão de resumo, não de medição.
4. **`reconciliation-r5.md` (§2) e `spec.md:26`** — não reconferi se a leitura de atomicidade que o novo rótulo alimenta depende dos 13/91/113 sites nem se algum doc consumidor repete a semântica de "posição de tipo" (o rótulo `repository-fallback` para fallback de executor fora de `repositories/` é decisão declarada, mas nenhum doc foi atualizado para explicá-la além do README da evidência).
5. **`context!.transaction` / `ctx.transaction`** — não são sites (nem no pai); não medi quantos existiriam na árvore fora de `src/**` (docs/e2e).
6. **Guarda de entrypoint sob bundlers/transpilers** (import.meta.url reescrito): testei `tsx`, `node --import tsx`, e `cwd` diferente; não testei `vitest --coverage` nem empacotamento.
7. **`docs/specs/M-02/matrix*.yaml` do branch** não foram regenerados (correto, é do MAESTRO): registrei os hashes esperados do land medidos na árvore do branch (`638cdaa3…` / `c6ce105e…`) — servem de conferência pós-`generate`.

## 5. Limpeza

Cópias `/tmp/vtrkd1/**` removidas ao fim; **não** toquei `.worktree-trk-d1` (`git status --porcelain` vazio, `docs/specs` intocado, nenhum commit/push). `/tmp/trkd1-red` e `/tmp/trkd1-gate` são do trilho (não meus) e foram apenas **lidos** — foi lendo `/tmp/trkd1-red/scripts/m02-matrix.ts` que provei o G8.3.

## 6. Recomendação de land

**Adequado para land: SIM** — o núcleo do F-C5-2 (contagem por binding, comentário/literal/`src/test` fora, âncoras 11/6/28, total 113) e o F-C5-3 (gate RED/GREEN, ligado no `check` e no CI, sem pin de teste) foram **reproduzidos por sonda independente**, incluindo o RED 9F/5P contra um stand-in do pai escrito por mim. Nenhuma cláusula falsa se materializa hoje na árvore (as 3 REJECTED são latentes, todas provadas ausentes por varredura). Os 5 `CORRECTED` são de **declaração/evidência**, não de medição.

**O que o land precisa fazer/mitigar, em ordem:**

1. **Regenerar e commitar `docs/specs/M-02/matrix.yaml` + `matrix.generated.yaml`** (determinação do despacho, não é opcional): no estado atual do branch, `npm run check` **falha** no passo novo e o `verify` do `ui-stack.yml` **falha** no 3º passo — com drift medido, não hipotético (a matriz comitada é a do pai: `a0a6d64e…`/`d40cd9b3…`; a árvore produz `638cdaa3…`/`c6ce105e…`, 3× + 1 cópia independente). Sem esse passo, o land quebra o E2 de todos.
2. **Documentar o efeito do gate novo no E2 de quem clonar o repo:** depois do land, `npm ci --ignore-scripts && npm run check` passa **se** a matriz estiver regenerada; mas **qualquer** mudança em `src/**` que altere um dos 6 contadores passa a reprovar o passo 2 do `check` (e o CI) até rodar `npm run m02:matrix:generate`. O caso que o dev vai encontrar na prática é `directDatabaseFiles` (48, dos quais **20 são de `src/test/**`): um PR que só **adiciona um teste que importa `@/db`** reprova — medido. Mitigação mínima: uma linha em `AGENTS.md`/CONTRIBUTING ("mudou `src/**`? rode `npm run m02:matrix:generate`") ou fazer a mensagem nomear o contador que drifta (hoje ela só manda rodar o generate, e o diff resultante é opaco). *Não* é bloqueio de land.
3. **Fechar ou declarar os 3 limites semânticos** (D1 tipo, D2 sombreamento aninhado, D3 `??` à esquerda) e os 2 menores (D4): o README/claim afirmam "posição de tipo não conta" e "sombreamento por declaração aninhada é respeitado" como propriedades gerais, e não são. Como o rótulo alimenta a leitura de atomicidade (`reconciliation-r5.md` §2) e o consumidor só valida o enum, o risco é de **documento que mente**, não de número errado.
4. **Higiene de evidência (G8.3):** corrigir/annotar a linha de hash do `RAW-parent-baseline.txt` (`913d83b0…` é o arquivo da **entrega**, não o da cópia do pai) e re-selar o `manifest.sha256` — hoje o manifesto prova que os RAW não mudaram depois de selados, não que o conteúdo deles está certo.
