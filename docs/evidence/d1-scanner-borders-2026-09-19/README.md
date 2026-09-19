# Selo — WP1 `F-D1-scanner-borders` (Bloco 3)

- **Trilho:** D (restante do C3) · **WP:** `F-D1-scanner-borders` · ciclo SDD S0–S9
- **Worktree:** `.worktree-wp1-scanner` · **Branch:** `mission/wp1-scanner-borders`
- **Base:** `55b0090dd9d2deed2493208e0047e7af4998b0d6` (= `origin/develop`)
- **Data:** 2026-09-19
- **Journal:** `docs/evidence/agent-state/PROGRESS.md` `L114` (▶) e `L115` (✔)

---

## 1. Sumário

O scanner `scripts/lib/m02-transaction-sites.ts` **declarava** uma semântica de contagem que
não cumpria em três pontos. A correção fecha as três — e uma quarta borda **introduzida pela
própria correção**, achada e fechada antes de varrer a árvore.

O resultado é medido, não afirmado: a lista completa de transaction sites da árvore **não muda**
(113 → 113, diff vazio) e `m02:matrix:check` fica verde **sem regenerar** `matrix.yaml`. Ao mesmo
tempo, a correção é **observável** em 5 de 6 casos sintéticos das bordas — sem isso, "diff vazio"
seria indistinguível de "não corrigi nada".

O defeito era de **documento que mente**, não de número errado: o rótulo alimenta a leitura de
atomicidade (`reconciliation-r5.md` §2) e a prosa do módulo afirmava duas propriedades que o
código não tinha.

## 2. O que muda

### 2.1 As três bordas declaradas (fonte: veredicto do TRK-D1, tabela §3, itens D1–D3)

| borda                                      | mecanismo do defeito no pai                                                                                                                                                                             | correção                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **sombreamento por bloco aninhado**        | `bindingReferences` fazia `if (declaresName(node, name)) return;`, podando **só a subárvore da declaração sombreadora** — os irmãos seguintes do bloco continuavam contando para o alias externo        | novo `scopeShadowsName`: um bloco que declara o nome no próprio escopo poda a **subárvore inteira** |
| **referência ao alias em posição de tipo** | `inTypePosition` era aplicado **apenas** ao `PropertyAccessExpression` do handle em `sitesForModule`; as referências **ao alias** passavam por `isValueReference`, que nunca consultava posição de tipo | `isValueReference` ganhou `if (inTypePosition(node)) return false;`                                 |
| **lado do operador**                       | `siteShape(host)` recebia só o hospedeiro sintático, não o handle — qualquer `??`/`                                                                                                                     |                                                                                                     | `virava`executor-fallback`; e `??=`/` |     | =` não estavam no predicado | `siteShape(host, handle)` + `FALLBACK_OPERATORS` (os 4 operadores) + `isWithin(host.right, handle)` |

A poda da subárvore **inteira** do bloco (e não só o que vem depois da declaração) é o que a
linguagem faz: `const`/`let`/`class` deixam o nome em **TDZ** desde o topo do bloco e `function`
sofre **hoisting**, então uma referência escrita _antes_ do sombreador também pertence ao sombreador.

### 2.2 A quarta borda — introduzida por mim, achada antes de varrer

Ao adicionar o caso de `for` a `declaresName` (para que `for (const tx of xs)` sombreie o laço),
criei um defeito novo: `enclosingScope` sobe até o primeiro `SourceFile | Block | CaseBlock` —
**não para no `for`** — então, para um alias declarado no **cabeçalho de um `for`**, o `visit`
descia no `ForStatement` e o `declaresName` podava o laço **inteiro**, apagando as referências do
próprio alias.

O diff da árvore continuou vazio (a árvore não tem nenhum caso desses), então a varredura **não**
teria pegado: era latente, exatamente a categoria que este WP combate.

**Correção:** em `bindingReferences`, o caminho até o próprio alias nunca é podado — um `Set`
(`lineage`) construído uma vez a partir de `declaration.parent`, testado em O(1) por nó.

```ts
const lineage = new Set<ts.Node>();
for (let current: ts.Node | undefined = declaration; current; current = current.parent) {
  lineage.add(current);
}
```

**Este é o teste que fecha a borda** (o que faltaria sem ele): um alias que nasce no `for` deve
render **1** site, na linha do corpo.

### 2.3 Prosa

O cabeçalho do módulo foi reescrito para descrever o que o código faz: os dois sub-bullets da
cláusula do alias (posição de tipo; sombreamento com TDZ e hoisting) e a cláusula de
`executor-fallback` agora nomeia os **quatro** operadores e diz que à **esquerda** o handle é o
primário.

## 3. Evidência

### 3.1 Bateria (`captures/bateria-wp1.log.txt`)

| gate                   | comando                                                 | resultado                                                        |
| ---------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| sonda de bordas        | `npx tsx .artifacts/wp1-diff.ts`                        | `SONDA_EXIT=0`                                                   |
| suíte do scanner       | `npx vitest run src/test/m02-transaction-sites.test.ts` | `Tests 20 passed (20)`                                           |
| determinismo da matriz | `npm run m02:matrix:check`                              | `M-02 matrix is deterministic and up to date.` **sem regenerar** |
| tipos                  | `npx tsc -p tsconfig.json --noEmit`                     | `TSC_EXIT=0`                                                     |
| estilo                 | `npx prettier --check <os 2 arquivos>`                  | `PRETTIER_EXIT=0`                                                |

Contexto medido: `branch = mission/wp1-scanner-borders`, `HEAD_SHA = 55b0090…`,
`node v24.15.0`, `npm 11.14.1`, `typescript 5.9.3`, **`porta 5432 (H-9) tocada? -> 0 listener(es)`**.

### 3.2 Neutralidade — e por que não é vacuidade (`captures/sonda-bordas.log.txt`)

```
arquivos varridos: 132
scanner do PAI : 113 sites
scanner CORRIGIDO: 113 sites
so no pai      : 0
so no corrigido: 0
VEREDITO A: diff VAZIO -> correcao neutra em contagem
```

113 é o mesmo número que o veredicto do TRK-D1 declarou como entrega (91 → 113) — terceira
confirmação independente.

**A neutralidade sozinha não provaria nada.** A sonda roda a mesma bateria contra o **pai** e
contra o **corrigido**, e exige divergência:

| caso                                      | pai                                | corrigido                                                           |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| b1 sombreamento por bloco aninhado        | 3 sites (L3, L6, L8)               | **2** (L3, L8)                                                      |
| b2 sombreamento por `for` + `catch`       | 2 (L3, L4)                         | **1** (L4)                                                          |
| b3 referência ao alias em posição de tipo | 2 (L3, L4)                         | **1** (L4)                                                          |
| b4 handle à **esquerda** de `??`          | 1 site (L2) `repository-fallback`  | 1 site (L2) **`auth-allowlist`** — muda o rótulo, não a contagem    |
| b5 handle à **direita** de `??`           | 1 site (L2) `repository-fallback`  | 1 site (L2) `repository-fallback` (**igual** — regressão protegida) |
| b6 `??=` com o handle à direita           | 1 site (L2) `compatibility-facade` | 1 site (L2) **`repository-fallback`**                               |
|                                           |                                    | **5 de 6 divergem**                                                 |

O caso **b5** é deliberadamente um não-divergente: é o controle de regressão do comportamento que
o pai já acertava. Uma bateria em que tudo diverge não distingue "corrigi" de "quebrei".

### 3.3 Hash da base (terceiro método)

O scanner na base tem sha256
`d60ad757a757f41daaab1302a591fe30a4623c383ab8c453a0ba9913141b8659`, que **bate** com o hash que o
veredicto do TRK-D1 registrou ter medido em `6b62a29` (`captures/hashes-scanner.log.txt` traz os
quatro: pai, corrigido, `6b62a29`, `HEAD`). Isso prova, por um método que não é meu, que o arquivo
não mudou entre 18/09 e hoje.

### 3.4 Acoplamento

`siteShape` é **interna** (`scripts/lib/m02-transaction-sites.ts:129`, sem `export`) e seu único
chamador é `sitesForModule` (`:378`). Só **dois** módulos importam do arquivo:
`src/test/m02-transaction-sites.test.ts` (`transactionSites`, `TransactionSiteSource`) e
`scripts/m02-matrix.ts:5` (`isEntrypoint, transactionSites`). A superfície exportada
(`classifyTransactionSite` `:342`, `transactionSites` `:402`, `isEntrypoint` `:413` + os tipos)
não mudou.

## 4. Riscos e limites declarados (não silenciados)

| item                                                                                                              | decisão                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class A extends tx {}` — `ExpressionWithTypeArguments` é `TypeNode` no AST, então o alias é excluído             | **consistente com o handle**, que já era excluído pelo mesmo motivo. Declarado como limite, não corrigido (fora do escopo nomeado).                                                                                                                                                 |
| `context!.transaction` (handle atrás de asserção não-nula) não é reconhecido como site: `handleBase` só olha o nó | **D4 parcial**, explicitamente fora do escopo deste WP.                                                                                                                                                                                                                             |
| a poda por `scopeShadowsName` vale para o bloco inteiro, inclusive referências escritas antes do sombreador       | **correto por TDZ/hoisting**, não é excesso de poda.                                                                                                                                                                                                                                |
| `enclosingScope` não delimitava `ModuleBlock` (o pai também não delimitava)                                       | **corrigido neste WP**: a assimetria com `isScopeContainer` nasceu da minha própria mudança. Efeito medido da correção: **zero** (0 `namespace` em `src/**`; o diff segue vazio).                                                                                                   |
| **`var` é function-scoped e o modelo o trata como escopado ao bloco** (pré-existente)                             | declarado no cabeçalho como limite (i). Duas consequências: um `var tx` em bloco aninhado perde referências fora do bloco; e não sombreia o alias externo lá fora. Latente: 0 ocorrências de `var <x> = <y>.transaction` em `src/**`. **Não corrigido — escopo adjacente.**         |
| **nome de método/campo de classe homônimo poda como se fosse ligação de valor** (pré-existente)                   | declarado no cabeçalho como limite (ii): `declaredName` inclui `MethodDeclaration`/`PropertyDeclaration` e `declaresName` poda a subárvore inteira, apagando referência legítima a um `tx` capturado pelo corpo do método. Latente na árvore. **Não corrigido — escopo adjacente.** |
| `declaresName` devolve `true` para **qualquer** `import`, sem testar o nome                                       | pré-existente, inofensivo (a subárvore de um import não contém leitura de valor do alias). Declarado, não corrigido.                                                                                                                                                                |

## 5. Arquivos tocados

| arquivo                                          | mudança                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `scripts/lib/m02-transaction-sites.ts`           | as três bordas + a guarda `lineage` + a prosa do cabeçalho |
| `src/test/m02-transaction-sites.test.ts`         | 7 testes novos (14 → 21)                                   |
| `docs/evidence/d1-scanner-borders-2026-09-19/**` | este selo                                                  |

## 6. Como reproduzir

```bash
cd .worktree-wp1-scanner
bash .artifacts/zz-wp1-verify.sh      # bateria: sonda + suíte + matriz + tipos + estilo
bash .artifacts/zz-wp1-seal.sh        # regera captures/ e o manifesto
```

Os scripts de sonda vivem em `.artifacts/` (gitignored) e estão versionados como **snapshots** em
`captures/*.txt` — são registro do método, não pipeline executável a partir do commit.

## 7. Nota de método: o `format:check` reprovou na primeira corrida do gate

A primeira corrida de `npm run check` (`CHECK_EXIT=1`) reprovou **exclusivamente** em
`format:check`, apontando este `SPEC.md`. Causa: o pi-lens reformata o arquivo **depois** da
escrita, então um documento recém-criado por ferramenta de edição está fora do estilo do prettier.

**Terceira ocorrência da mesma causa no ciclo** (CI do TRILHO A, selo do TRILHO C, agora). A
resposta não foi "lembrar mais": o passo **0.5** do `zz-wp1-verify.sh` passou a normalizar formato
com `prettier --write` **antes** de qualquer gate. Lição registrada não é lição aplicada — o
processo tem que carregar o passo.

Além disso: a corrida anterior a essa foi **descartada como evidência** por ter rodado em paralelo
às edições que deveria certificar — uma verificação que corre junto com a mudança não distingue
"verde antes" de "verde depois".

## 8. S6 ADVERSARIAL — veredicto e adjudicação

Revisor de contexto limpo (lane `da02799e`, rota `opencode-go/deepseek-v4.1-flash`, capability
_inspect_ — leitura, sem shell), 9 turnos / 15 chamadas. Veredicto: **C1, C2, C3, C4, C6, C7, C8,
C9 CONFIRMED · C5, C10, C11 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE**, mais cinco defeitos novos.

### 8.1 O que o S6 sustentou

As três bordas fechadas; a guarda `lineage` **real e necessária** (sem ela o próprio alias nascido
no `for` seria podado); os 6 testes novos **não vacuosos** e rastreáveis à mão, um a um; os 6 casos
b1–b6 conferidos contra o código do pai e do corrigido; a sonda comparando o que diz comparar; a
superfície exportada inalterada.

### 8.2 O que o S6 corrigiu, e o que eu fiz

| #       | correção                                                                                                                                                                                                              | adjudicação                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C10** | o cabeçalho afirmava "**Sombreamento é respeitado.**" sem qualificar, enquanto `declaredName` poda nome de **método/campo** (que não liga nome no corpo) e `var` é function-scoped mas tratado como escopado ao bloco | **procedente.** É a mesma família de "documento que mente" que este WP combate — e aqui quem a introduzia era **eu**. O cabeçalho passou a declarar os **três limites** explicitamente (i, ii, iii). |
| **C11** | `enclosingScope` não delimitava `ModuleBlock`, enquanto `isScopeContainer` delimitava                                                                                                                                 | **procedente.** A assimetria nasceu da minha mudança em `isScopeContainer`. Corrigido em `enclosingScope`; efeito medido **zero** (0 `namespace` em `src/**`, o diff segue vazio).                   |
| **C5**  | `class A extends tx {}` é falso negativo (o nó é `TypeNode`, mas a leitura é de runtime)                                                                                                                              | **procedente e já declarado** na SPEC §6; agora também no cabeçalho, como limite. Consistente com o handle, que sempre foi descartado pelo mesmo teste.                                              |
| **N4**  | nenhum teste exercitava `\|\|`, `\|\|=` nem o lado esquerdo de `??=`/`\|\|=`; o título prometia "e do OU"                                                                                                             | **procedente.** Teste novo cobrindo os **quatro** operadores nos **dois** lados (14 → 21 testes, com o título antigo corrigido).                                                                     |

### 8.3 O que o S6 não sustentou

**N3 — "o controle negativo não está na evidência versionada": FALSO.** O `captures/` do selo
contém `wp1-diff.ts.txt` (a sonda), `scanner-do-pai.ts.txt` (a revisão pré-fix),
`scanner-corrigido.ts.txt` e `sonda-bordas.log.txt` — este último com o dump **linha a linha** de
pai e corrigido nos 6 casos. O revisor leu estado anterior à selagem. Verificado por listagem
própria, não por argumento.

**C8 — "o '2' de b4":** a bateria sempre reportou **1 site → 1 site** para b4 (muda o rótulo, não a
contagem); o "2→1" vivia no _briefing_ que eu entreguei ao revisor, não no selo. A tabela §3.2
passou a explicitar a contagem em cada linha para não admitir essa leitura.

### 8.4 Defeitos pré-existentes declarados, não corrigidos (escopo adjacente)

| #      | defeito                                                                                                                                                                | por que não agora                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **N1** | `declaredName` inclui `MethodDeclaration`/`PropertyDeclaration`; o nome homônimo poda a subárvore e apaga referência legítima a um `tx` capturado pelo corpo do método | idêntico no pai (`scanner-parent.ts:138`); fora das três bordas nomeadas na fila; latente na árvore |
| **N2** | `var` é function-scoped e o modelo o trata como escopado ao bloco                                                                                                      | idêntico no pai; latente (0 `var <x> = <y>.transaction` em `src/**`)                                |
| **N5** | `declaresName` devolve `true` para qualquer `import`, sem testar o nome                                                                                                | inofensivo na prática; declarado                                                                    |

Os três ficam registrados como candidatos a WP próprio. **Nenhum é fail-open**: são falsos
negativos ou falhas fechadas, não contagem inflada.
