# Invariantes do Result Type financeiro — Fase C (Contract Guard)

Escopo: **verificação e teste**. Nenhuma linha de `src/lib/finance.ts` e nenhuma
server function foi alterada nesta fase. O que existe aqui é a medição do que
o motor financeiro já garante e a lista do que ele ainda não garante.

## 1. Base medida

| Item                                                | Valor medido                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| HEAD no momento da medição                          | `19505b6`                                                                                          |
| Arquivo de teste criado                             | `src/test/finance.result-invariants.test.ts`                                                       |
| Casos no arquivo                                    | **49** (todos verdes)                                                                              |
| Perímetro financeiro (`src/test/finance.*.test.ts`) | **5 arquivos · 214 casos**, todos verdes                                                           |
| Comandos                                            | `npx vitest run src/test/finance.result-invariants.test.ts` e `npx vitest run src/test/finance.`   |
| Varredura de `catch`, isolada                       | `npx vitest run src/test/finance.result-invariants.test.ts -t "varredura"` → 5 casos, 44 filtrados |

**Limite declarado sobre a contagem da suíte.** O contrato desta fase proíbe
rodar a suíte completa, `check`, `lint`, `typecheck` e `build`; a contagem
acima é do perímetro financeiro, obtida por execução real, e não um número
estimado. O total da suíte completa não foi medido neste ciclo e **não é
afirmado aqui** — quem precisar dele o obtém com `npm test`.

## 2. Propriedades verificadas

Cada linha aponta para o que a prova. `finance.golden.test.ts` fixa os valores
canônicos; estas são as propriedades que o golden **não** afirma.

### P1 — `incomplete` nunca é convertido em `ok` com valor inventado

| Caso                                                             | Teste                              | Mecanismo no motor                                                                      |
| ---------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| 5 campos de `calculateScenario` nulos, um por vez                | `P1 > ausência em <campo>`         | `collectNullableNumber` empurra para `missing` e retorna — `src/lib/finance.ts:103-115` |
| `fees[0].percentage` nulo                                        | `P1 > ausência na taxa de uma fee` | `missingFeeFields` indexa o item real — `src/lib/finance.ts:528-534`                    |
| `yieldQty` nulo                                                  | `P1 > ausência de rendimento`      | validação antes de calcular — `src/lib/finance.ts:830`                                  |
| `ok` nunca carrega `missing`; `incomplete` nunca carrega `value` | `P1 > ok nunca carrega missing`    | forma da union `CalculationResult` — `src/lib/finance.ts:41-44`                         |

O par é falsificável: o mesmo fixture sem mutação é `ok` com `revenue === 2000`
(`P1 > o fixture completo é ok`).

### P2 — `invalid` nunca é rebaixado a `incomplete`

| Caso                                                        | Teste                                     | Mecanismo no motor                                                                            |
| ----------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NaN`, `-1` (abaixo do mínimo) e `Infinity` no preço        | `P2 > preço <caso> é invalid`             | `numericInputError` → `INVALID_NUMBER` — `src/lib/finance.ts:67-91`                           |
| **precedência**: preço `NaN` + `unitCost` e `taxRate` nulos | `P2 > precedência`                        | `errors.length > 0` avaliado **antes** de `missing.length > 0` — `src/lib/finance.ts:666-667` |
| volume com origem `unknown`                                 | `P2 > volume numérico com origem unknown` | `invalidVolumeSourceError` — `src/lib/finance.ts:519-525, 661-665`                            |
| origem fora do conjunto suportado, sem volume               | `P2 > origem fora do conjunto`            | guarda de `VOLUME_SOURCES` — `src/lib/finance.ts:512-517`                                     |
| `package_price: NaN` **não** vira `missing`                 | `P2 > campo ausente NÃO entra em missing` | `collectNumericError` vs `collectNullableNumber` — `src/lib/finance.ts:93-115`                |
| `invalid` só carrega `errors`                               | `P2 > invalid carrega só errors`          | `calcInvalid` — `src/lib/finance.ts:57-59`                                                    |

A distinção é load-bearing: `incomplete` diz "falta dado", `invalid` diz "o
dado é inaproveitável". Colá-los faria a UI pedir ao usuário algo que já está
errado. O teste de precedência existe exatamente para travar essa colagem.

### P3 — `warnings` são propagadas, nunca engolidas

| Caso                                                                   | Teste                                  | Mecanismo                                                                                |
| ---------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `calcOk` propaga a lista sem filtrar nem reordenar                     | `P3 > calcOk propaga`                  | `calcOk` — `src/lib/finance.ts:46-48`                                                    |
| `calcIncomplete` carrega `missing` **e** `warnings` — os dois convivem | `P3 > calcIncomplete carrega`          | `calcIncomplete` — `src/lib/finance.ts:50-55`                                            |
| `ok` sem warning ≠ `ok` com warning (o vazio é informação)             | `P3 > ok sem warning e ok com warning` | default `warnings = []` — `src/lib/finance.ts:46`                                        |
| `calcInvalid` não transporta `warnings`                                | `P3 > calcInvalid não transporta`      | assinatura sem a chave — `src/lib/finance.ts:44, 57-59`                                  |
| nenhum motor emite warning **hoje**                                    | `P3 > LIMITE DECLARADO`                | nenhum `calcOk`/`calcIncomplete` interno passa lista — varredura em `src/lib/finance.ts` |

**Limite declarado e assumido.** Hoje **nenhum motor emite warning**: todos os
`calcOk`/`calcIncomplete` internos passam a lista vazia. A propagação está
verificada no contrato do construtor, não em um produtor real. O teste
`P3 > LIMITE DECLARADO` fixa essa ausência de propósito: se ele falhar, algum
motor ganhou um produtor de warning e a propagação precisa de caso próprio.

### P4 — fechadura de status (motor determinístico)

| Caso                                                                     | Teste                                                                                 | O que exercita                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| mesma entrada, duas chamadas, resultado deep-equal                       | `P4 > mesma entrada, duas chamadas`                                                   | motor puro por valor                                   |
| **o motor não lê relógio nem entropia**                                  | `P4 > o motor não lê o relógio` — espiões em `Date.now` e `Math.random`; chamadas = 0 | ausência das fontes, não coincidência de dois valores  |
| os espiões estão vivos (controle negativo)                               | `P4 > CONTROLE NEGATIVO: os espiões estão vivos`                                      | prova de que o "0 chamadas" acima é medido, não inerte |
| status e valor não dependem da ordem de chamada (300 casos `fast-check`) | `P4 > propriedade`                                                                    | estabilidade sobre entradas variadas                   |

O controle negativo é o que dá valor ao teste anterior: sem ele, "0 chamadas"
seria indistinguível de "espião inerte". A afirmação é mais forte que
"duas chamadas coincidem" — é a ausência das **fontes** de não-determinismo.

### P5 — fronteira de completude dos caminhos de `missing`

| Caso                                                                                                              | Teste                                          | Mecanismo no motor                                                  |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| 1 a 4 ingredientes, um campo nulo em índice aleatório: citado **exatamente uma vez**, no índice certo (200 casos) | `P5 > propriedade: um único campo nulo`        | laço indexado — `src/lib/finance.ts:744-751`                        |
| taxa de fee nula em índice aleatório (200 casos)                                                                  | `P5 > propriedade: taxa de fee nula`           | `missingFeeFields` — `src/lib/finance.ts:528-534`                   |
| `conversion_context` resolve para o item real, sem off-by-one                                                     | `P5 > caminho de índice de conversion_context` | guarda de conversão — `src/lib/finance.ts:773-784`                  |
| todo `missing` citado aponta para folha realmente ausente                                                         | `P5 > todo missing citado`                     | `collectNullableNumber` — `src/lib/finance.ts:103-115`              |
| atalho por linha pinado (abaixo)                                                                                  | `P5 > curto-circuito por linha PINADO`         | `return` após `package_unit == null` — `src/lib/finance.ts:760-762` |
| o resolvedor rejeita caminho órfão (controle negativo)                                                            | `P5 > CONTROLE NEGATIVO: o resolvedor`         | resolvedor do próprio teste                                         |

O resolvedor de caminho (`a.b[0].c`, `fees[1].percentage`) é o que separa
"campo ausente" de "campo citado à toa". Ele aceita um campo opcional de um item
indexado que simplesmente não existe na linha (`conversion_context` é `?` em
`IngredientRow`) e **rejeita** caminho cujo pai não resolve.

**Comportamento pinado, não acidental.** Com `package_unit` nulo, o motor cita
`ingredients[i].package_qty` **e** `ingredients[i].package_unit`, mas **não**
cita `ingredients[i].conversion_context`: o atalho por linha acontece depois da
coleta dos campos numéricos. Isso está fixado em
`P5 > curto-circuito por linha PINADO` para que uma refatoração do atalho não
mude a resposta à UI sem decisão.

## 3. Varredura de `catch` / error-swallowing (INV-013)

**Comando exato:**

```
npx vitest run src/test/finance.result-invariants.test.ts -t "varredura"
```

A varredura está no próprio arquivo de teste, com núcleo puro
(`auditarEngolimento(arquivos)` recebe fontes já lidas) separado do I/O
(`arvoreDeFontes` caminha `src/` e exclui `src/test/`). Sem essa separação os
controles negativos não seriam herméticos: para falsificar a detecção seria
preciso mutar a árvore do repositório.

**Superfície medida:** 132 arquivos `.ts`/`.tsx` em `src/` (fora de `src/test/`),
dos quais 44 contêm a palavra `catch`.

**Resultado: 41 achados, em três camadas** (eram 42; um `sucesso-vazio` foi
corrigido no ciclo 3 — ver §3.1).

| Camada          | Qtd. | Significado                                                                                          |
| --------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| `silencioso`    | 4    | corpo vazio depois de remover comentários: não propaga, não registra, não devolve nada               |
| `sucesso-vazio` | 9    | converte a falha em valor neutro (`null`, `[]`, `{}`, `""`, `0`, `false`)                            |
| `tradutor`      | 28   | converte a falha em sinal explícito (`NaN`, `{status:"invalid"}`, `rejected(...)`, `invalid = true`) |

### 3.1 Achado com consequência — dívida registrada e CORRIGIDA (`DBT-26`)

**`src/server/auth/password.server.ts` — o `catch` que devolvia `false`**

Único `sucesso-vazio` em caminho de dado de servidor. `verifyPassword` convertia
qualquer exceção de `bcryptjs`/`scrypt` (hash corrompido, algoritmo
desconhecido, falha de memória, biblioteca ausente) em `false` — indistinguível
de "senha errada". Na prática: um hash ilegível produz um laço de login sem
sinal nenhum, e o operador não tem como distinguir erro de infraestrutura de
credencial inválida. Não viola INV-013 ao pé da letra (não é sucesso vazio de
banco), mas é a mesma classe: **falha de infraestrutura disfarçada de veredito
de negócio**.

**Fechamento.** A dívida foi registrada como `DBT-26` (`robustez` / `média`) em
`docs/evidence/agent-state/DEBTS.md` e o MAESTRO autorizou a correção no ciclo 3.
O veredito do brief original — `P0`, com `DatabaseError`/`TimeoutError`/
`ConfigurationError` — foi **medido falso** e não entrou no registry: `verifyPassword`
recebe `{hash, password}` e é cripto pura, **sem acesso a banco**; a superfície real
de exceção é `Error("Invalid password hash")` (better-auth exige um par `salt:key`),
`Error("Illegal arguments: …")` do `bcryptjs` e `TypeError` para hash nulo ou senha
não-string. O `catch` agora classifica e **lança** `PasswordVerificationError`
(`malformed-input` | `unusable-hash` | `crypto-failure`), registrando sinal com o
motivo e **sem serializar o hash**; a assinatura pública (`Promise<boolean>`) não
mudou e o consumidor better-auth em `auth.server.ts:42` segue sem edição. `false`
passou a significar **apenas** hash válido com senha errada.

**Consequência neste artefato:** o site sai do inventário pinado em
`src/test/finance.result-invariants.test.ts` (`INVENTARIO_MEDIDO`, `CONTAGENS`) e
`SUCESSO_VAZIO_EM_DADO` fica vazio. Essa remoção é um **ato consciente com decisão
registrada** — o registry é fail-closed nas duas direções justamente para exigir isso.
Os controles negativos da suíte continuam fabricando achados em fixture, então o
scanner segue provado vivo.

### 3.2 Achados sem consequência, com justificativa

- `silencioso` (4), todos em `src/instrumentation/` (`safe-record.ts:25`,
  `telemetry.ts:55`, `telemetry.ts:143`, `telemetry.ts:153`): observabilidade
  deliberadamente nunca derruba o caminho da request, e registrar ali realimenta
  a falha que acabou de falhar. O comentário no código registra a decisão.
- `sucesso-vazio` (9) em `src/lib/web-vitals.client.ts` e nos loaders de
  `src/routes/_authenticated/{despesas,inicio,ponto-equilibrio}.tsx`: prefetch
  deliberadamente não-bloqueante, com o estado de erro do `useQuery` do
  componente responsável pela exibição. São `.catch(() => null)` /
  `.catch(() => undefined)` — falha de prefetch, não de leitura da tela.
- `tradutor` (28): em todos os casos o erro vira sinal explícito que sobe até
  o `Result Type` (`{status:"invalid"}`, `NaN`, `verdict:"invalid"`,
  `result.failed += 1` com `markFailed`). É o comportamento correto.

### 3.3 Como o teste trava isso

- **Descoberta vazia reprova.** `auditarEngolimento([])` devolve um achado com
  motivo `descoberta vazia`: 0 arquivos lidos significa que o parser quebrou,
  não que o repositório está limpo. Ausência é violação.
- **Inventário pinado.** Os 42 achados são comparados por
  `arquivo|camada|assinatura` (sem linha: deriva de linha não é dívida nova).
  Achado novo reprova; sumido também reprova, porque seria mudança de
  comportamento sem decisão.
- **Contagem por camada pinada** em `4 / 10 / 28`, para o `tradutor` não poder
  desaparecer em silêncio.
- **Camada `silencioso` em caminho de dado = zero**, e essa é a invariante dura
  de INV-013 que hoje vale.

### 3.4 Limitação declarada desta varredura

**Análise estática por regex não prova ausência de error-swallowing.** Ela
enumera `catch` por forma textual, e por isso:

1. **Contagem por chaves e parênteses.** Uma chave ou parêntese dentro de uma
   string literal desloca o casamento. Nenhum caso conhecido hoje, mas é uma
   fonte cega real.
2. **Remoção de comentários é por regex.** Um `//` dentro de uma string pode
   truncar uma linha na varredura e não no código.
3. **Propagação indeterminada.** `.catch(handlerNomeado)` não entra no
   inventário: o corpo do handler está em outro arquivo e a análise não o segue.
4. **Não há análise de fluxo.** Um `catch` que engole e mais tarde reconstrói um
   valor neutro fora do próprio `catch` é classificado pelo que devolve, não
   pelo efeito.
5. **O filtro de "registra" é uma lista de nomes.** Uma função de log própria
   do projeto que não esteja na lista conta como "não registra" — o achado
   aparece (falha do lado conservador), mas a camada pode ser exagerada.
6. **Só TypeScript/TSX.** Scripts em `scripts/` e `e2e/` estão fora da
   superfície.

O que a varredura **garante** é mais estreito e é isso que o teste afirma: que o
conjunto de `catch` que não propaga nem registra não cresce sem alguém decidir.

## 4. Falsificação — os negativos rodados

Nenhum teste passa com a lógica removida. Verificado por mutação do arquivo de
teste, com restauração em seguida:

| #   | Mutação aplicada ao arquivo de teste                                            | Testes que reprovaram                                                                                    |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `corpo === ""` passa a classificar como `tradutor`                              | **5** — inventário, contagem por camada e 3 controles negativos de corpo vazio                           |
| 2   | `devolveNeutro` passa a devolver `retornos.length === 0`                        | **9** — lista de dívida, inventário, contagem, os 5 `it.each` de retorno neutro e o caso de feeds mistos |
| 3   | guarda de descoberta vazia (`arquivos.length === 0`) desativada                 | **1** — `a varredura é viva`                                                                             |
| 4   | exclusão de `propaga` removida (`if (propaga \|\| registra)` → `if (registra)`) | **4** — lista de dívida, inventário, contagem e o controle positivo de relançamento                      |
| 5   | `comCampo` deixa de aplicar a mutação                                           | **12** — as 5 ausências, a fee, a forma da union e os 5 casos de `invalid`                               |
| 6   | P5 passa a esperar `ingredients[(indice + 1) % quantidade]`                     | **1** — `propriedade: um único campo nulo`                                                               |

As duas últimas são as mais importantes. A #6 troca o índice esperado por
`índice + 1` — exatamente o defeito de off-by-one que P5 existe para caçar — e
reprova. A #5 prova que os 12 casos de status não são tautológicos: sem a
mutação que produz a ausência, todos eles caem.

Cada mutação foi aplicada isoladamente e o arquivo restaurado em seguida; o
estado final é o da §1, com `npx vitest run src/test/finance.result-invariants.test.ts`
verde nos 49 casos.

## 5. O que NÃO foi coberto, e por quê

1. **Contrato de saída ausente nas server functions do BFF** (medido pelo
   `contract-guard`: `observed.outputContracts` sobre `observed.serverFunctions`;
   reproduzir com `npx tsx scripts/lib/contract-guard.ts`, check
   `contract-output-ratchet`, dívida declarada em `DBT-25`). O gerador é
   citado, não o literal: o denominador é derivado de um parser e se move a
   cada server function adicionada, então escrever o número aqui faria esta
   evidência afirmar algo que ninguém mediu no dia da leitura. Confirmado por
   execução: cobertura de contrato de saída 0%, com entrada validada em todas
   as funções que recebem parâmetro. Fechar isso exige retipar as funções — é
   refatoração de outro ciclo, e a decisão é do MAESTRO.
2. **`incomplete` vs `invalid` em rotas que não usam o motor financeiro.** As
   propriedades valem para `calculateScenario`, `computeProduct`,
   `computeProductCost` e `calculatePriceFormation`. Qualquer outro produtor de
   `CalculationResult` precisa ser coberto por teste próprio.
3. **Warnings reais.** Nenhum produtor existe hoje (ver P3). Nada é afirmado
   sobre a semântica de uma warning que o motor ainda não emite.
4. **`BreakEvenResult` como union independente.** `calculateBreakEvenUnits`
   tem contrato próprio (`reachable` / `unreachable` / `invalid`) e já é
   coberto por `finance.properties.test.ts` e `finance.required-sales.test.ts`.
   Aqui só se afirma que `calculateScenario` propaga o `invalid` dele sem
   rebaixar (P2, via precedência).
5. **Concorrência e reentrância.** O motor é puro por valor, mas nada aqui
   prova que duas chamadas concorrentes não interferem — o teste P4 prova
   estabilidade sequencial.
6. **A suíte completa.** Não executada nesta fase, por contrato. O número do
   perímetro financeiro (214) é real; o total da suíte não é afirmado.
