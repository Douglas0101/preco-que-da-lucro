# WP2 `F-D1-gate-ux` — a mensagem do gate passa a nomear o que mudou

Selo do work package `F-D1-gate-ux` (Bloco 3, segundo na ordem canônica), executado no worktree
`.worktree-wp2-gateux`, branch `mission/wp2-gate-ux`, base
`3812febab80f9922d70512ecc3c623d233ecdd2a` (`docs(evidence): record the intent for the F-D1 gate
UX work package`).

Data do selo: **2026-09-19**.

## 1. Sumário

O passo `m02:matrix:check` do `npm run check` — e o 3º passo do job `verify` da CI — reprova
quando um contador gerado da matriz M-02 se move sob `src/**`. Ele imprimia **uma linha**:

```text
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.
```

Acionável, mas cega: ela manda regenerar e revisar um diff que vai de **41 410 bytes**
(`matrix.generated.yaml`) a **58 164 bytes** (`matrix.yaml`), sem dizer **qual** dos seis
contadores andou nem **quais** entradas da lista entraram ou saíram. Quem abre o PR descobre por
conta própria; se o movimento veio de um teste novo que importa `@/db` — 20 das 49 entradas de
`directDatabaseFiles` são de `src/test/**` — o atrito recai sobre quem não fez nada de errado.

O WP **não muda o que é contado** e **não muda quando o gate reprova**. Ele muda **o que a falha
diz**. A comparação por string continua sendo o critério: é ela que decide `process.exitCode = 1`.
O descritor é diagnóstico, puro, e não tem um único `import`.

## 2. O que a mensagem passa a dizer

Medido com uma sonda real (`src/lib/zzz-wp2-probe.functions.ts`, criada e removida pelo
falsificador) — o tamanho é de **9 linhas** contra um diff de **58 164 bytes**:

```text
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.
  docs/specs/M-02/matrix.generated.yaml:
    counts.bffModules: 8 -> 9
    bffs: 8 -> 9 (1 added, 0 removed)
      + src/lib/zzz-wp2-probe.functions.ts
  docs/specs/M-02/matrix.yaml:
    counts.bffModules: 8 -> 9
    bffs: 8 -> 9 (1 added, 0 removed)
      + src/lib/zzz-wp2-probe.functions.ts
```

A **primeira linha é byte a byte a de antes** — escolha conservadora: qualquer coisa que já
reconhecesse a mensagem continua reconhecendo. As linhas do descritor vêm depois.

### 2.1 Os casos que a mensagem cobre

| situação                                       | o que ela diz                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| um contador se moveu                           | `counts.<nome>: <disco> -> <árvore>`, e **nenhum outro** contador aparece                |
| uma lista mudou, contadores iguais             | `<lista>: <n> -> <m> (<a> added, <r> removed)` + até 8 entradas `+` / `-`                |
| a lista é maior que o teto                     | 8 entradas e `... and N more of M` — nunca o despejo que ela combate                     |
| mudou o **conteúdo** de uma entrada            | `the counters and the list identities are identical, but the content of <lista> differs` |
| mudou um campo que não é contador nem lista    | `the counters and the list identities are identical, but these fields differ: <campos>`  |
| só o overlay de política difere                | `only the policy overlay differs (counts and lists are identical)`                       |
| o arquivo não existe                           | `missing (the file does not exist)`                                                      |
| o arquivo é JSON inválido, ou um array no topo | `unreadable (invalid JSON, or not an object)`                                            |
| o documento esperado não é comparável          | `drift detected, but the expected document is not comparable`                            |
| a árvore está em dia                           | nada — o descritor devolve `[]` e a mensagem é a de sempre                               |
| os dois arquivos divergem                      | as duas seções, cada uma com o seu rótulo repo-relativo                                  |

**Nuance do caminho de ausente/ilegível (C8 do S6 — e ela é real).** As linhas acima são as do
**descritor**. O gate imprime a linha legada

```text
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.
```

**incondicionalmente**, antes das linhas do descritor — é o que a condição de "primeira linha
byte a byte igual à de antes" exige, e essa condição é defesa contra um gate que muda de
contrato. Então, para um arquivo ausente ou ilegível, a saída **composta** ainda diz "drift" e
manda regenerar. Isso não é falso — rodar `m02:matrix:generate` recria o ausente e reescreve o
corrompido, logo o conselho está certo nos dois casos — mas **não é suficiente**, e é por isso
que as linhas do descritor vêm logo depois dizendo **qual dos dois é**. A redação anterior
("`missing …` — não _drift_") só valia para as linhas do descritor e foi corrigida aqui, na
SPEC §4 e nas linhas do teste.

### 2.2 Por que `only the policy overlay differs` quase mentiu

A primeira versão do descritor imprimia essa frase **sempre** que contadores e identidades de
lista coincidiam, sem nunca verificar que a diferença era de fato o overlay. Isso é alcançável
sem esforço: acrescentar um import **não-DB** a um `src/lib/*.functions.ts` existente muda
`bffs[].imports` — não move contador nenhum e não muda a identidade da entrada, que é o `path`.
O gate reprovava e a mensagem **culpava a política**. É a mesma classe de defeito que este WP
existe para combater (um artefato afirmando o que não é o caso), encontrada pelo S6 adversarial
e corrigida por `describeResidual`, que passa a nomear o que sobra: o **conteúdo** de uma lista,
os campos não itemizados, ou o overlay — e só diz "só o overlay" quando o overlay é, de fato,
tudo o que difere.

## 3. Evidência

### 3.1 Gates

| gate                                 | resultado                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `npm run check`                      | **exit 0** (`captures/gate-local.log.txt`)                                     |
| suíte do descritor                   | `Test Files 1 passed (1)` / `Tests 12 passed (12)`                             |
| suíte do scanner (não pode regredir) | exit 0                                                                         |
| `tsc --noEmit`                       | exit 0                                                                         |
| `m02:matrix:check`                   | **exit 0 sem regenerar** — a refatoração é neutra                              |
| `prettier --check` nos 4 arquivos    | exit 0                                                                         |
| bateria completa                     | `PRETTIER=0 VITEST=0 VITEST2=0 TSC=0 MATRIX=0 FALSIFICA=0` / `BATERIA WP2: OK` |
| H-9                                  | **0 listeners** em `:5432` antes, durante e depois                             |

Suíte completa no gate: `Test Files 88 passed (88)` e `Tests 869 passed | 13 skipped (882)` —
era 87/859 antes deste WP. Os **13 skipped** são os casos protegidos por loopback
(`Boolean(adminUrl) && isLoopbackUrl(adminUrl) && …`): sem nenhuma variável de banco no ambiente
o gate é falso por `Boolean(undefined)` e os blocos pulam. Isso é comportamento documentado, não
regressão — e é justamente por isso que as provas de banco vivem na cadeia `db:test` e no `env:`
do job da CI, não no `npm run check`.

`check:bundle` continua com `assets/index-eXg04t5H.js: 237694 minified, 73259 gzip, 63812 Brotli
bytes` e `Initial graph (9 chunks): 473230 minified, 151054 gzip, 132937 Brotli bytes` —
**idênticos ao WP1 e ao TRILHO C**, prova de que a mudança não tocou nada além do gerador.

### 3.2 A falsificação de ponta a ponta

`.artifacts/zz-wp2-falsifica.sh` não confia no teste unitário: ele planta uma sonda real e exige
que o gate dispare, que a mensagem nomeie contador, lista, **entrada** e arquivo, que a
**direção** seja a certa (disco → árvore, sonda nova como `+`), que a primeira linha continue
idêntica, e que o `exit 0` volte depois de remover a sonda. As asserções de **entrada** e
**direção** foram acrescentadas ao próprio falsificador porque o S6 apontou (N5c) que elas só
existiam na bateria: a afirmação deste parágrafo era retórica até então, e agora é executada pelo
script que ela nomeia. Uma mensagem que só aparece em teste unitário não prova a **fiação**.

| passo                        | medido                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- |
| árvore limpa                 | `EXIT_ANTES=0`                                                               |
| sonda plantada em `src/lib/` | `GATE_EXIT=1`                                                                |
| primeira linha               | `PRIMEIRA_LINHA: IDENTICA A ANTERIOR`                                        |
| contador nomeado             | `counts.bffModules: 8 -> 9`                                                  |
| lista e entrada nomeadas     | `bffs: 8 -> 9 (1 added, 0 removed)` / `+ src/lib/zzz-wp2-probe.functions.ts` |
| arquivo nomeado              | as duas seções, `matrix.generated.yaml` e `matrix.yaml`                      |
| sonda removida               | `EXIT_DEPOIS=0`                                                              |
| sonda sobrou no git?         | não — `git status` limpo                                                     |

### 3.3 Neutralidade da mudança (o gate não mudou o que conta)

Medida em três frentes:

1. `m02:matrix:check` **exit 0 sem regenerar** — nenhum dos seis contadores se moveu.
2. `counts` real nos dois arquivos: `bffModules` 8, `createServerFnDeclarations` 35,
   `concreteOperations` 36, `apiRoutes` 5, `transactionSites` 113, `directDatabaseFiles` 49 —
   inalterados em relação ao pai (`git show 3812feb:docs/specs/M-02/matrix.yaml`).
3. `check:bundle` com os mesmos bytes de antes.

### 3.4 Acoplamento

Quem importa o gerador, hoje:

| arquivo                                  | importa                                         |
| ---------------------------------------- | ----------------------------------------------- |
| `src/test/m02-transaction-sites.test.ts` | `transactionSites`, `TransactionSiteShape`      |
| `src/test/m02-matrix-drift.test.ts`      | `describeMatrixDrift`, `MatrixArtifact`         |
| `scripts/m02-matrix.ts`                  | `isEntrypoint`, `transactionSites`, o descritor |

O descritor **não importa nada** — nem `fs`, nem `path`, nem o gerador. O teste novo importa o
módulo puro, não o gerador; é por isso que ele roda em **766 ms** em vez de pagar a varredura de
`src/**` que o gerador faz no escopo de módulo.

## 4. O defeito que o falsificador expôs — e por que os testes não o pegariam

A primeira implementação comparava com os nomes `expected` e `actual`, onde `expected` era a
**árvore** (o lado novo) e `actual` era o **arquivo commitado** (o lado velho). A mensagem saiu
invertida:

```text
    counts.bffModules: 9 -> 8
    bffs: 9 -> 8 (0 added, 1 removed)
      - src/lib/zzz-wp2-probe.functions.ts
```

Lido por quem acabou de criar um arquivo, isso diz que o arquivo foi **removido**. A direção
estava errada em relação à única pergunta que o leitor faz — "o que eu mudei?".

**Por que os 10 casos de teste não pegaram**: eles verificavam as strings **que eu mesmo havia
escolhido**. Um teste que confirma a saída que o autor escolheu não falsifica a saída; para isso
é preciso uma corrida com um arquivo **realmente** adicionado à árvore, e ler a resposta como
leitor. Foi a falsificação de ponta a ponta que mostrou, não a suíte.

**A correção não foi inverter a saída.** Foi renomear os dois lados para o que eles **são** —
`fromTree` e `onDisk` — o que torna a direção auto-documentada em vez de depender de um rótulo
ambíguo. Onde a ambiguidade morava era no nome, não no código. E a suíte passou a ter os casos
2 e 3 (arquivo adicionado → `+`; arquivo removido → `-`), que travam a direção.

Este é o mesmo modo de falha que o WP combate — um artefato que afirma algo que não é o caso —
e aqui quem o introduzia era o autor do WP. A SPEC ganhou o item correspondente no DoD
("a mensagem responde na direção da pergunta").

## 5. Riscos e limites declarados

| risco / limite                                            | tratamento                                                                                                                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| o descritor virar segunda fonte de verdade da matriz      | ele **lê** os dois documentos já serializados e os compara; não recalcula contador nenhum, não toca em `src/**`                                                                                                                               |
| a mensagem crescer e virar o despejo que ela combate      | teto de 8 entradas **por lista**, com o total declarado quando truncar                                                                                                                                                                        |
| a comparação estrutural divergir da comparação por string | a string continua decidindo exit 0/1; o descritor nunca decide                                                                                                                                                                                |
| `JSON.parse` lançar sobre arquivo corrompido              | o caminho de ilegível/ausente é explícito, distinto de "drift", e testado nos três formatos (texto solto, JSON inválido, array)                                                                                                               |
| **limite:** o descritor não explica o overlay             | quando só a política difere ele diz **isso**, em vez de inventar um detalhe que não tem                                                                                                                                                       |
| **limite:** `identityOf` cai para `#<índice>`             | quando a entrada não é string nem tem `path` — a linha vira `+ #3`, menos útil que um caminho, mas nunca falsa                                                                                                                                |
| **limite:** a linha legada é incondicional                | `M-02 matrix drift: …` vem **antes** das linhas do descritor, por exigência de compatibilidade; para ausente/ilegível a saída composta ainda diz "drift" (C8/N2 do S6 — declarado, não corrigido, porque corrigir mudaria o contrato do gate) |
| **limite:** `identityOf` com `path:line`                  | um deslocamento de linha lê como `- path:antigo` **e** `+ path:novo`; com `line` de um só lado, o mesmo caminho sai removido e adicionado (N4 do S6) — mais ruidoso, nunca falso negativo                                                     |
| **limite:** a mensagem é impressa em `stderr`             | junto com a primeira linha já existente; nada muda em `stdout`                                                                                                                                                                                |
| **limite:** nada aqui cobre o `F-D1-raw-sha`              | o §6 item 4 do mesmo veredicto (linha de hash do `RAW-parent-baseline.txt`) fica com o MAESTRO/ESCRIVÃO                                                                                                                                       |

**Fora de escopo, declarado:** não se mudou o que é contado (`src/test/**` segue contando em
`directDatabaseFiles` — um teste que importa `@/db` é mesmo um arquivo com acesso direto ao
banco, e a matriz mede a árvore real); não se regenerou a matriz (já estava em dia); não se
tocou em `writeOutputs`, no overlay nem no formato dos arquivos gerados.

## 6. Arquivos tocados

| arquivo                                       | mudança                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `scripts/lib/m02-matrix-drift.ts`             | **novo** — o descritor puro (`describeMatrixDrift`, `MatrixArtifact`)                |
| `scripts/m02-matrix.ts`                       | o bloco inline do gate dá lugar à chamada do descritor; a string de gatilho não muda |
| `src/test/m02-matrix-drift.test.ts`           | **novo** — 12 casos                                                                  |
| `docs/evidence/d1-gate-ux-2026-09-19/SPEC.md` | a especificação do WP                                                                |

O descritor mora em módulo próprio e **não** dentro de `scripts/m02-matrix.ts` por uma razão
medida: importar o descritor do gerador obrigaria o teste a carregar o módulo inteiro, que faz a
varredura pesada de `src/**` no escopo de módulo. É o mesmo padrão que o gerador já usa para
`./lib/m02-transaction-sites`.

## 7. Como reproduzir

```bash
# o gate, verde, sem regenerar
npm run m02:matrix:check

# a suíte do descritor
npx vitest run src/test/m02-matrix-drift.test.ts

# a falsificação de ponta a ponta: dispara, nomeia, limpa
bash .artifacts/zz-wp2-falsifica.sh

# a bateria completa
bash .artifacts/zz-wp2-verify.sh

# o gate local inteiro
npm run check
```

Os instrumentos estão versionados em `captures/` com sufixo `.txt` — extensão que nem o ESLint
nem o prettier processam, e que o `.gitignore` não engole (diferente de `raw/` e de `*.log`).
São **snapshots**, não um pipeline executável: reproduzem-se a partir do commit, não rodando.

## 8. S6 ADVERSARIAL

Lane `d1d251651a88776bdaf3c9e70d390684a` (rota `opencode-go/deepseek-v4.1-flash`, capability
_inspect_, 40 turnos / 150 tool calls / 2700 s, seed 374 803 bytes). Resposta de **10 829 bytes**,
sha256 **`9820581155a8fb15a6e88f98542a6eaccb6a44fd6d8d85c79ae78e0538f38dca`**, conferido contra o
declarado pela lane pelo script de colheita ⇒ **cadeia de custódia OK**. Verdicto bruto em
`captures/adversarial-wp2-verdict.md.txt`.

**Veredicto: C1, C2, C3, C4, C5, C6, C7, C9, C10, C11, C12, C13, C14 CONFIRMED · C8 CORRECTED ·
0 REJECTED · 0 UNVERIFIABLE**, mais cinco defeitos novos (N1…N5).

### 8.1 O que o S6 sustentou com prova própria

O descritor tem **0 imports**; `difference` é diferença de multiconjunto de verdade; o teto de 8
é **por lista** e as adições vêm antes das remoções; `describeLists` cobre exatamente as quatro
listas de `LIST_FIELDS`, e uma lista ausente de um lado vira `0 -> N` **declarado**; o único
caminho silencioso é `if (artifact.onDisk === artifact.fromTree) continue;`, que só pula o que
está igual. **Nenhum fail-open nas três caças abertas:** o gate não passa com árvore derivada,
não reprova com árvore em dia, e a análise estática da árvore real confirma o diff vazio.

### 8.2 O que foi corrigido

- **N1 (código, o achado que importa)** — `only the policy overlay differs` era emitido sem
  verificar que a diferença era o overlay, e a mensagem **culpava a política** por mudanças em
  `bffs[].imports`, `operations[].line`, `schemaVersion`. Corrigido por `describeResidual`, com
  dois testes novos (conteúdo de lista; campo desconhecido). Ver §2.2.
- **N3 (teste fraco)** — o caso "diz em qual dos dois arquivos" passava **dois** artefatos em
  deriva e por isso não falsificava "só o que derivou é nomeado". Reescrito com um artefato em
  dia mais um em deriva, e asserção `not.toContain`.
- **N5a (cadeia de evidência)** — o manifesto era gerado de dentro do selo e conferido da raiz;
  reprovava de verdade (15 unreadable + 1 mismatch, porque `./README.md` resolve para o README do
  repositório). Corrigido para caminhos repo-relativos, com guarda que veta caminho fora do selo.
- **N5c (afirmação sem dente)** — a asserção de entrada e direção vivia só na bateria; o
  falsificador imprimia `NOMEOU CONTADOR` mesmo com a mensagem **invertida**. Agora o próprio
  falsificador faz o grep da entrada e da direção e reprova se qualquer uma falhar.
- **C8** — redação corrigida em três lugares (§2.1, SPEC §4, linhas do teste): a linha legada é
  incondicional.

### 8.3 O que foi refutado

Nada. Não houve claim REJECTED nem UNVERIFIABLE nesta rodada — diferente do WP1, onde o N3 do
adversário foi refutado por listagem do selo.

### 8.4 Declarado, sem correção

- **N2** — a DoD "ausente/ilegível não diz drift" é internamente contraditória com a
  primeira-linha byte-idêntica. Declarado; corrigir exigiria mexer no contrato do gate.
- **N4** — identidade `path:line` sob deslocamento de linha (ver §5). Sem falso negativo.
- **N5b** — `captures/` estava ausente no instante da inspeção, por ser um S8 inacabado; era
  transitório e desapareceu quando o selo foi completado.

## 9. O defeito do próprio selo — e por que ele importa mais que os outros

A **segunda** corrida do selo passou em tudo: 17 arquivos, `checked === discovered: OK`,
`sha256sum -c` com 17 `OK` e 0 `FAILED`. E mesmo assim estava **errada**.

A conferência de vínculo mostrou que `captures/gate-local.log.txt` e `captures/bateria.log.txt`
tinham hash **diferente** dos logs da última medição:

```text
bc774df7…  .artifacts/wp2-gate-local-3.log        (o gate FINAL, 21:12:55)
b0ade19d…  …/captures/gate-local.log.txt          (copiado de wp2-gate-local-2.log, 21:01:30)
```

O script copiava `wp2-gate-local-2.log` e `wp2-verify-run1.log` como se fossem os canônicos — os
dois são de **antes** das correções do S6 (N1, N3). O `wp2-s7.log` tinha o mesmo problema: o S7
declarado examinou um diff que não é o que vai a `develop`.

**Por que isto é pior que os outros defeitos desta rodada:** um selo com manifesto verde sobre a
revisão errada é um artefato que **afirma ter verificado** o que não verificou. É a classe de
defeito que este WP existe para combater — o gate que não nomeia o contador, o
`only the policy overlay differs` que culpava a política, o falsificador que imprimia `NOMEOU
CONTADOR` com a mensagem invertida. Aconteceu **dentro do selo**, na ferramenta que produz a prova.

### 9.1 Correções aplicadas

1. Os logs canônicos passam a ser os da última medição: `wp2-fechar.log` →
   `captures/fecho-final.log.txt` (formato, bateria e gate na mesma corrida) e `wp2-gate-local-3.log`
   → `captures/gate-local.log.txt`.
2. Os anteriores **não** foram apagados: ficaram com o sufixo `-antes-do-S6` — o nome passa a dizer
   a revisão a que se referem.
3. O **S7 foi re-rodado sobre os bytes finais**, com o log anterior preservado como
   `captures/s7-guard-antes-do-S6.log.txt`.

### 9.2 O S7 não conseguia provar que tinha reexaminado nada

O script de reselo foi escrito para recusar um S7 que não tivesse mexido no mundo, comparando o log
novo com o antigo — e **disparou**: `IDENTICO ao anterior — suspeito`. Não era falso positivo: o S7
reportava apenas **contagens e listas** (4 arquivos, 0 credenciais herdadas, 0 linhas suspeitas, 0
imports). Rodar sobre bytes diferentes produz exatamente as mesmas contagens. É a família
**cardinalidade × identidade** outra vez — a quarta ocorrência nesta rodada, depois do guard do
scanner (WP1), do gerador do TRILHO C e do log velho deste selo.

O S7 passou a imprimir a **identidade** do que examinou:

```text
=== IDENTIDADE do que foi examinado (nao cardinalidade) ===
sha256 do artefato examinado: <hash do diff + dos arquivos novos>
bytes examinados: <n>
sha256 scripts/m02-matrix.ts: <hash>
sha256 scripts/lib/m02-matrix-drift.ts: <hash>
sha256 src/test/m02-matrix-drift.test.ts: <hash>
```

Um log de verificação que não carrega o hash do que examinou não consegue provar que examinou — e
um guard que só conta não vê o objeto trocado.
