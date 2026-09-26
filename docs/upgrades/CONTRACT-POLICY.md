# Política de Contrato de Borda

Documento que rege o que o `contract-guard` ([`scripts/lib/contract-guard.ts`](../../scripts/lib/contract-guard.ts))
exige da fronteira de borda — as server functions em `src/lib/*.functions.ts`, a taxonomia de
erros em `src/lib/api-error.ts` e as tools de IA em `src/lib/ai/tool-registry.ts` — e, principalmente,
**o que ele não exige**. Um guard que só publica o que cobre treina o time a crer que cobre o resto.

## A regra que este documento existe para sustentar

> **A entrada de toda função que recebe entrada é validada por schema Zod declarado inline; a saída é
> declarada também — e enquanto não for, isso é uma dívida nomeada, não um silêncio.**

O `contract-guard` existe por causa de um vazio **medido**, não por especulação. Uma troca de `zod`
ou de `@tanstack/react-start` muda o que `.validator((input) => schema.parse(input))` faz com uma
entrada hostil, e o repositório não tinha asserção de estrutura que segurasse isso.

## Convenção real: schema inline, um só lugar

O schema Zod é declarado **no arquivo da própria server function**, ao lado dela:

```ts
// src/lib/products.functions.ts:444
export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => createProductInput.parse(input))
  .handler(async ({ data, context }) => createProductWrite(context.requestContext, data));
```

**Proibido criar um segundo lugar para contratos.** Não há `src/server/bff/contracts/`, não há
`schemas/`, não há barrel de schemas: as duas convenções de contrato divergem sozinhas, que é
exatamente o defeito que [`UPGRADE-POLICY.md`](./UPGRADE-POLICY.md) já registrou para as faixas de
versão (uma lista de versão em dois lugares não se mantém sincronizada). O guard **descobre** a
convenção inline; ele não impõe layout.

O `.validator((input: unknown) => schema.parse(input))` usa `parse`, não `safeParse`, e isso é
intencional: o `throw` é o que [`src/lib/api-error.ts:100`](../../src/lib/api-error.ts) mapeia para
`VALIDATION_ERROR`. Trocar por `safeParse` na borda do BFF seria perder o mapeamento de erro.

Já nas tools de IA o inverso vale, e também é intencional: entrada de tool é **não confiável por
conceito** (vem do modelo), então [`src/lib/ai/tool-registry.ts:66`](../../src/lib/ai/tool-registry.ts)
valida com `safeParse` e devolve `{ ok: false, code: "VALIDATION_ERROR" }` em vez de lançar.

## O que o guard cobre

| check                         | afirma                                                                                                 | exit |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| `contract-discovery`          | ao menos uma server function declarada (descoberta vazia é parser quebrado)                            | 1    |
| `contract-input-validated`    | toda função que **recebe entrada** tem `.validator(`                                                   | 1    |
| `contract-schema-declared`    | todo `.validator(` nomeia um schema Zod (identificador ou `z.*` inline)                                | 1    |
| `contract-error-taxonomy`     | os 9 códigos do plano §6.9 estão declarados em `api-error.ts`                                          | 1    |
| `contract-ai-tool-validation` | o registry usa `safeParse` e toda tool declarada tem `schema:`                                         | 1    |
| `contract-output-ratchet`     | a dívida de contrato de saída **não cresce** (ver [piso declarado](#piso-declarado-e-regra-do-escada)) | 1    |

Mais o `contract-precondition` (exit **2**, nunca `pass`): arquivo ausente ou ilegível, ou parâmetro
de entrada que o parser não consegue determinar com segurança.

### Piso declarado e a regra da escada

O `contract-output-ratchet` **não** cobra 100% hoje — seria um guard permanentemente vermelho,
e guard que nunca pode ficar verde acaba desabilitado. Ele cobra que a **dívida não cresça**, contra
um piso versionado em [`scripts/contract-baseline.json`](../../scripts/contract-baseline.json):

```json
{ "outputContracts": 5, "serverFunctions": 35, "debt": "DBT-25" }
```

Três caminhos reprovam, e só eles:

1. **dívida cresce** — uma server function adicionada depois do piso sem schema de saída;
2. **regressão** — a contagem de contratos cai abaixo do que era no piso (remover função que já
   tinha contrato regride a dívida);
3. **piso ausente ou malformado** — isso é **precondição (exit 2)**, nunca um piso zero implícito:
   um piso inventado daria um verde que ninguém declarou.

Um teste pina o arquivo do piso contra a árvore real, para que o verde não seja de um número
inventado. **O número absoluto nunca é escondido**: `observed.outputContracts`,
`observed.outputContractCoverage` e o detalhe do check carregam `5 de 35` em toda execução,
inclusive quando o check está verde.

### `skip` no vazio, `pass` nunca no vazio

Quando a descoberta de server functions é zero, `contract-input-validated`,
`contract-schema-declared` e `contract-output-ratchet` saem `skip` com o detalhe
`inconclusivo: 0 server functions descobertas` — nunca `pass`. `0 de 0` não é aprovação, e um check
que "passa" no vazio é cobertura aparente, que é exatamente o defeito que a política de dívidas
(`DBT-19`) já denuncia neste repositório. Quem reprova nesse caso é `contract-discovery`.

### A regra que evita o alarme falso

**Uma função sem `.validator` só é violação se recebe entrada.** Um
`createServerFn({ method: "GET" })` sem parâmetro é legítimo — `listProducts`
([`src/lib/products.functions.ts:339`](../../src/lib/products.functions.ts)) e `listSimulations`
([`src/lib/financial.functions.ts:47`](../../src/lib/financial.functions.ts)) são exatamente isso.
Exigir validator ali seria falso positivo, e guarda que alarma sem motivo treina o time a ignorá-la.

O guard decide pelo que o parser vê: `.validator(` presente, ou `data` no destructuring do handler
(`async ({ data, context })`). `listSales`
([`src/lib/sales.functions.ts:92`](../../src/lib/sales.functions.ts)) tem validator e não consome
`data` — conta como entrada mesmo assim. Quando o parser não consegue decidir, o resultado é
**precondição (2)**: "não sei" não é "está bem".

## O que o guard NÃO cobre — nomeado, com o número

### Contrato de saída: parcial. Medido: **5 de 35** (eram 0).

No fecho da Fase C, **nenhuma** das 35 server functions declaradas em `src/lib/*.functions.ts`
publicava `outputSchema`, `responseSchema` ou `.returns(` — era `0 de 35`. No ciclo 3 o MAESTRO
autorizou uma **fatia** de 5 funções de dinheiro (`listExpenses`, `getTotals`, `runSimulation`,
`listSimulations`, `listProducts`), o piso subiu para `5` e a dívida segue nomeada em `DBT-25`
para as 30 restantes. A entrada tem contrato; a saída passou a ter, nessas cinco, verificação em
runtime. O guard **mede e reporta** o número em `observed.outputContracts` e
`observed.outputContractCoverage` — e o valor vai também no detalhe do check, mesmo quando ele
está verde. O que o check cobra é que a dívida **não cresça** a partir do
piso declarado ([acima](#piso-declarado-e-regra-da-escada)); fechar o gap inteiro é outro ciclo.

**Como a fatia é declarada.** Cada uma das cinco declara o schema Zod **inline no próprio arquivo
da função**, ancorado em tempo de compilação por `satisfies z.ZodType<…>` sobre o tipo de retorno
real, e o aplica no handler por `outputSchema(schema, sujeito, valor)`
([`src/lib/output-contract.ts`](../../src/lib/output-contract.ts) — mecanismo único, **sem**
schemas dentro, para não criar um segundo sítio de declaração). Em violação: log estruturado
`bff.output_contract_violation` e `throw new ApplicationError("DEPENDENCY_ERROR")` (§6.9 → HTTP 503) — nunca lista vazia, nunca `null` (INV-013).

**Limite declarado deste piso.** O `OUTPUT_CONTRACT_RE` do guard é **textual**: ele reconhece o
token `outputSchema` no bloco da função. O TanStack instalado (`@tanstack/react-start` 1.168.26)
**não tem** `.outputSchema()` nem `.returns()` no builder — só `validator`/`inputValidator` —
então as duas alternativas de cadeia que a regex também aceita descrevem uma API que não existe.
Consequência honesta: o guard conta a **chamada** do mecanismo, não prova que o schema corresponde
ao tipo de retorno; quem prova isso é o `satisfies` (compile-time) e os testes negativos por
função. Os schemas **não** são `.strict()`: chave desconhecida é removida, não reprovada — rejeitar
arriscaria 503 no caminho do dinheiro por um campo que o tipo fechado diz não existir.

**Por que os 30 restantes não entram aqui.** Retipar as 30 é trabalho de modelagem de outro ciclo:
cada handler devolve uma forma diferente (`ProductView`, `{ ok: true }`, arrays mapeados,
`SimulationView`). A decisão de continuar é do MAESTRO, e a fatia existe justamente para que a
unidade seja aceita sem substância. O que este
ciclo entrega é a **medição** e a dívida nomeada — esconder o zero seria cobertura aparente, o pior
resultado possível e um defeito que este repositório já tem precedente documentado de punir (DBT-19).

**O que seria preciso para fechá-lo**, por função, em ordem de custo:

1. `.returns(schema)` (ou `outputSchema(schema)`) na cadeia, com o schema declarado **inline**, ao
   lado da função — nunca em diretório paralelo;
2. o schema derivado do tipo de retorno real do handler, para que a asserção seja verdadeira no
   primeiro dia e não vire formulário em branco;
3. um teste por função que **falsifique** o schema com uma resposta adulterada, para que a dívida
   encolha com evidência e não por declaração;
4. a mesma coisa para a fronteira do gateway de IA (`src/lib/ai/`), que tem contrato de entrada
   (`toolExecutionOutputSchema`) e hoje não tem contrato de saída equivalente.

Enquanto isso, o check `contract-output-ratchet` reprova, e reprovar é o registro honesto.

## Relação com o que já existe (não duplica)

- **`npm run m02:boundaries`** — guarda a fronteira **BFF × banco**: se cada operação reaches the
  database por caminho allowlisted, se há arquivo com acesso direto ao banco, e se a política de
  transaction de cada unidade está declarada. Diz **aonde** o dado vai. O `contract-guard` diz **o que
  entra e se entra validado**. Nenhum dos dois afirma o outro.
- **`src/test/api-error-contract.test.ts`** — fixa o **comportamento** de `api-error.ts`: status HTTP,
  `retryable`, `cache-control`, `x-correlation-id` e `ApiResult` para cada código. O `contract-guard`
  só afirma que os códigos **existem** na lista — não toca em status, header nem payload. São camadas
  diferentes: presença do contrato, e o contrato funcionando.
- **`src/test/tool-registry.test.ts`** — prova em runtime que uma tool com entrada inválida é
  rejeitada antes de tocar o banco. O `contract-guard` afirma a **estrutura** (`safeParse` no
  registry, `schema:` em toda tool declarada) sem executar nada.
- **`src/test/bff-create-update-contract.test.ts`** — fixa o contrato create/update de produto e
  despesa (incluindo a separação de arquivos e o CAS otimista). O guard não conhece esses schemas:
  ele verifica que **todo** validator aponta para um schema, não o conteúdo de um schema específico.
- **`scripts/lib/upgrade-guard.ts` e `scripts/lib/migration-toolchain-guard.ts`** — guardas de
  **versão** de dependência. Esta é a guarda de **forma** do contrato; a de versão não diz nada sobre
  a forma.

## O que um upgrade ou downgrade de `zod` / TanStack Start tem que rodar

Qualquer PR que mexa em `zod`, `@tanstack/react-start` ou nos arquivos da superfície
(`src/lib/*.functions.ts`, `src/lib/api-error.ts`, `src/lib/ai/tool-registry.ts`) tem que rodar, nesta
ordem:

1. `npm run guard:contracts` — reprova se uma função com entrada ficou sem validator, se um validator
   ficou sem schema, se um código do §6.9 sumiu da taxonomia, se o `safeParse` saiu do registry, se uma
   tool ficou sem `schema:`, se a dívida de contrato de saída **cresceu** além do piso declarado, e
   carrega o número absoluto da cobertura (`5 de 35` hoje) em `observed` e no detalhe do check.
2. `npx vitest run src/test/contract-guard.test.ts` — controles negativos do próprio guard.
3. `npx vitest run src/test/api-error-contract.test.ts src/test/tool-registry.test.ts src/test/bff-create-update-contract.test.ts`
   — comportamento de erro, rejeição de tool e contrato create/update.
4. `npm run m02:boundaries` — se a mudança alterou a fronteira BFF × banco.
5. Se o PR **mexe em `scripts/contract-baseline.json`**, isso não é bump de rotina: subir o piso sem
   digitar as funções que o justificam é exatamente como cobertura aparente entra no repositório. O
   arquivo só muda junto com schema de saída novo, e a dívida correspondente sai de `DBT-25`.

Razão por dependência:

- **`zod`**: `.parse` lança, `safeParse` devolve, e uma minor pode mudar coerção, `z.enum` mais
  estrito, mensagens de issue ou o comportamento de `z.toJSONSchema` (que é o que publica o JSON
  Schema de cada tool). O guard não detecta mudança de comportamento — ele garante que **ainda há um
  schema** onde a validação acontece, e os testes acima dizem se ele ainda valida o que deve.
- **`@tanstack/react-start`**: `createServerFn` é a superfície. Trocar de versão muda o que
  `.validator()` e `.handler()` significam, e pode mudar a extração para o módulo servidor — a razão
  de o guard ancorar a descoberta em `export const … = createServerFn(` e não em `createServerFn(`.
  Descoberta vazia sai **1**, não `pass`: uma mudança de compilador que derruba o padrão de declaração
  tem de ser visível, não silenciosa.

## Como rodar

```bash
# relatório JSON em stdout; exit 0 = pass, 1 = veredito, 2 = precondição
npx tsx scripts/lib/contract-guard.ts

# controles negativos e sanidade na árvore real
npx vitest run src/test/contract-guard.test.ts
```

Formato da finding, o mesmo dos demais guards do repositório:

```
${sujeito} (${lado}): observado ${observado}, esperado ${esperado}
```

Hoje o guard sai **0** na árvore real, e o que ele ainda não fecha é o contrato de saída das 30
funções restantes (`5 de 35` desde o ciclo 3) — dívida nomeada em `DBT-25`, com o número visível em
`observed` mesmo no verde. Os
vereditos que ainda reprovam são: entrada sem validator, validator sem schema, código do §6.9
ausente, `safeParse` fora do registry, tool sem `schema:`, e a dívida de saída crescendo.
