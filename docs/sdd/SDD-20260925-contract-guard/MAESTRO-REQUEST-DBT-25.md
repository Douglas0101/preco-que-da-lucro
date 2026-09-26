# Pedido ao MAESTRO — dívida de contrato de saída do BFF (`DBT-25`)

> **Por que este arquivo existe e não uma edição no registry:**
> `docs/evidence/agent-state/DEBTS.md` declara o **MAESTRO** como escritor. O agente não edita.
> Este é o pedido auditável, com closure test executável e o piso declarado versionado.

- **Solicitante:** agente supervisionado, ciclo `SDD-20260925-contract-guard` (Fase C)
- **Data:** 2026-09-25
- **Dívida candidata:** **35 de 35** server functions sem schema de saída. Nenhuma — literalmente
  nenhuma — declara contrato de retorno.

## 1. O que a Fase C encontrou

O `guard:contracts` descobre, por parsing de `src/lib/*.functions.ts`:

```text
server functions descobertas      35   (em 8 arquivos)
funções que recebem entrada       26   — todas com .validator(
funções sem entrada                9   — GET sem parâmetro, legítimos, zero finding
validadores com schema reconhecível 26
contratos de SAÍDA                  0   ← a dívida
códigos da taxonomia §6.9            9/9 presentes em src/lib/api-error.ts
tools de IA com schema + safeParse  10/10
```

Entrada está validada em todo lugar. **Saída não é validada em lugar nenhum.** O plano §6.1 pede
contrato de entrada **e** de saída; a entrada existe desde o início, a saída nunca existiu.

**Reconciliação que corrige o enunciado original:** a Fase C foi descrita como consolidate
`src/server/bff/contracts/`. Esse diretório **não existe** e não foi criado — a convenção viva do
repositório é schema **inline**, ao lado da server function que o usa
(`src/lib/products.functions.ts:355,446,451,457`). Criar o diretório abriria uma segunda convenção,
o que o `AGENTS.md` proíbe.

## 2. Por que a dívida não foi fechada aqui

Retipar as 35 funções é uma refatoração que toca a assinatura de retorno de toda a API de servidor.
Não é verificação: é mudança de comportamento em superfície ampla, e a Fase C foi definida como
fase de **verificação e teste**. Nenhuma assinatura foi alterada.

## 3. O que foi feito em vez de fingir o verde

O guard **não** foi encadeado como "meta de 100%" — isso o deixaria vermelho para sempre, e ninguém
roda um gate que nunca passa. Também não foi encadeado como verde-por-definição, que seria cobertura
aparente. Ele rege a dívida por um **piso declarado e versionado** em
`scripts/contract-baseline.json`:

```json
{ "outputContracts": 0, "serverFunctions": 35, "debt": "DBT-25" }
```

A regra é **"a dívida pode diminuir, nunca crescer"**, com duas condições independentes:

1. **função adicionada sem contrato de saída** ⇒ reprova;
2. **contrato de saída perdido** (remover função que já tinha um) ⇒ reprova.

O número absoluto nunca é escondido: `observed.outputContracts` é sempre 0 hoje, o detalhe do check
lê `cobertura de contrato de saída 0% (0 de 35); dívida declarada em DBT-25, piso 0 de 35`, e
`src/test/contract-guard.test.ts` tem um caso que compara o arquivo de piso com a árvore real — se
alguém editar o piso para um número inventado, o teste reprova.

**As três direções foram falsificadas na árvore real, com mutação e restauração:**

| prova                                          | veredito                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| função nova sem contrato de saída acrescentada | **exit 1** — `1 função(ões) adicionada(s) desde o piso, 0 com contrato de saída`                 |
| piso elevado para 3 contratos com 0 reais      | **exit 1** — `contrato de saída perdido: eram 3 no piso e agora são 0`                           |
| árvore real no piso                            | **exit 0**, com o `0 de 35` visível no relatório                                                 |
| `.validator` removido de `getProduct`          | **exit 1** — `src/lib/products.functions.ts:353 getProduct (GET) recebe entrada sem .validator(` |
| `AI_QUOTA` removido de `api-error.ts`          | **exit 1** — `ausentes AI_QUOTA`                                                                 |
| piso declarado ausente                         | **exit 2**, precondição — nunca um piso zero implícito                                           |

## 4. Linha proposta

```text
id: DBT-25
origem: Fase C · `SDD-20260925-contract-guard` · `scripts/contract-baseline.json`
classe: conformidade
severidade: média
closure test: src/test/contract-guard.test.ts — com 0 contratos de saída sobre 35 funções e o piso
  declarado em 0, o guard passa; acrescentar uma função sem contrato de saída reprova nomeando
  arquivo:linha; elevar o piso acima do real reprova como "contrato de saída perdido"; remover o
  arquivo de piso reprova por PRECONDIÇÃO (exit 2), nunca como verde. O caso "o piso versionado bate
  com a árvore real" impede que o verde seja de um número inventado.
evidência: docs/upgrades/CONTRACT-POLICY.md
status: ABERTA
```

## 5. Decisão que cabe à MAESTRO

**O que fazer com a dívida**, e isso não é medição, é escolha de produto:

| opção                      | o que significa                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| manter `ABERTA` com o piso | a dívida é aceita e fica sob custódia de gate; fecha-se por incremento, função a função       |
| `FECHADA`                  | só se a tipagem de saída for entregue — nesse caso o piso sobe e a linha muda de closure test |
| adiar e remover o piso     | **não recomendada**: devolve o guard a vermelho-permanente ou a verde-por-definição           |

A MAESTRO pode também autorizar um ciclo de retipagem por _fatia_ (ex.: só `financial.functions.ts`),
que é a unidade que o guarda aceita sem substância: cada função nova entra com contrato, o piso nunca
cresce, e a linha fecha quando a última sair da dívida.

## 6. O que este pedido **não** pede

- Não pede alteração de assinatura de nenhuma server function.
- Não pede fechamento de `DBT-19` ou `DBT-24` (ambos já fechados por decisão em 2026-09-25).
- Não pede exclusão do `guard:contracts` da cadeia `check`, nem afrouxamento da regra de cobertura.
- Não pede mudança no `DEBTS.md`, na régua de placar ou no `m02-debts-guard`.
