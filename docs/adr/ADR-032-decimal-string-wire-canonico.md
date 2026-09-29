# ADR-032 — `DecimalString` como wire canônico

- **ID:** ADR-032 · **Rastro:** Ciclo 14 / F14-3 (pacote DECIDE de N-2) · **Data:** 2026-09-29
- **Estado:** **PROPOSTA** — aguarda ratificação do MAESTRO (R4 da matriz de autorização).
  A implementação **já está no código** e verde; o que falta é a decisão, não a execução.
- **Tipo:** contrato de API / formato de wire
- **Precedente de forma:** `ADR-029-concurrency-t2-optimistic-version.md`, `ADR-030-boundary-guard-dbt19.md`

---

## 1. Fato

O Ciclo 3 estreitou o tipo público de retorno de **3 das 5** funções do censo
(`docs/evidence/ciclo-10-censo-bloqueadores-2026-09-28.md:125`): `listExpenses` e
`listProducts` passaram a publicar `DecimalString`, e `getTotals` deixou de devolver o tipo
nomeado `ExpenseTotals`. O autor declarou que _"nenhuma assinatura mudou"_ — a afirmação é
**falsa**, e o S6 adversarial a refutou com sondas próprias (`PROGRESS.md:406`, `L214`).

O mesmo veredicto mediu que a mudança é **compatível na leitura** (`DecimalString` é uma
marca sobre `string`, e marca está contida no tipo base): `tsc` global exit 0, 1222 testes
verdes, nenhum consumidor quebrado, e o canal de erro não foi tocado (o erro é `throw`).

A mudança **não estava autorizada no brief** e por isso não foi ratificada. O Ciclo 13
registrou a ratificação como `NÃO ENTREGUE` (`ciclo-13-reconciliacao-2026-09-29.md:144`) e o
Ciclo 10 registrou a ordem correta: ratificar **antes** de ampliar cobertura, porque escalar
antes "multiplicaria por 7× uma decisão de API ainda não ratificada"
(`ciclo-10-censo-bloqueadores-2026-09-28.md:130`).

Estado técnico medido (Ciclo 14 / F14-3):

- `DecimalString` — `src/lib/financial-values.ts:8` — `string & { readonly __decimalString: unique symbol }`.
- Encoder — `src/lib/financial-values.ts:185-208` — `toDecimalString(value, scale?)`.
- Padrão canônico — `src/lib/financial-values.ts:51` — `decimalPattern`.
- Schema de contrato — `src/lib/financial-values.ts:90-94` — `decimalStringSchema` e os três derivados.
- **60** sítios de produção de `toDecimalString(`; **20** arquivos carregam o tipo.

## 2. Decisão

Adotar a **string decimal canônica** como formato canônico de wire para todo valor decimal
financeiro que atravessa a fronteira de uma server function.

`toDecimalString` é o portão único dessa travessia e **não é um formatador**: ele recusa, com
erro tipado, `NON_FINITE_DECIMAL`, `INVALID_DECIMAL_SCALE`, `DECIMAL_OVERFLOW` (por tier de
`FINANCIAL_DECIMAL_POLICY`) e `NON_CANONICAL_DECIMAL`. O contrato de saída é o par
`toDecimalString` (mappers) + `outputSchema` (fronteira), e os schemas derivados
(`nonNegativeDecimalStringSchema`, `positiveDecimalStringSchema`, `percentFractionSchema`)
restringem o sinal e a faixa no próprio schema.

## 3. Contratos e invariantes

- **INV-013 preservada:** o estreitamento não mexeu no canal de erro; falha continua sendo
  `throw` classificado, nunca valor vazio.
- **Um único encoder.** Nenhum formatador alternativo publica valor monetário; `src/lib/format.ts`
  formata para _exibição_ (`toFixed(digits).replace(".", ",")`) e não cruza a fronteira.
- **Nenhum número IEEE-754 cruza a fronteira** como valor decimal ou de quantidade.
- **Escala é explícita no sítio de produção** (`4` para dinheiro, `6` para quantidade e
  percentual) e é o que seleciona o tier de política via `policyForScale`.
- **O portão recusa, não corrige.** Um valor fora da política falha a chamada; ele nunca é
  arredondado silenciosamente para caber.

## 4. Alternativas

| Alternativa                                                               | Por que não                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`legacy` — número JSON no wire**                                        | IEEE-754 não carrega a garantia de canonicidade; não existe forma de recusar um valor não-canônico, e `0.1`/`0.2` não são representáveis exatamente. Reintroduz erro de ponto flutuante no caminho de cálculo financeiro — inclusive em `src/lib/ai/tool-registry.ts`, que tem 16 ocorrências do tipo. Custo de reversão medido: 60 sítios, 20 arquivos, 4 schemas.      |
| **`dual` — `{legacy, decimal}`**                                          | Estritamente pior que ambos: paga o payload dos dois e **transfere ao consumidor** uma escolha que o contrato deveria ter feito, sem nada que o obrigue a escolher a string. Publica ao lado da string canônica exatamente o número que a string existe para não usar.                                                                                                   |
| **Shadow dual-encode via `N2_CONTRACT_MODE`** (como o brief F14-3 propõe) | Não é implementável como pedido e não faz falta: `N2_CONTRACT_MODE` **não existe** no repositório (0 ocorrências), e o modo shadow existe para medir decisão ainda não tomada — esta já está no código. Além disso, o único lugar onde o ramo caberia é dentro de `toDecimalString`, e um ramo `legacy` ali faria o portão devolver a forma que ele existe para recusar. |
| **`decimal.js` serializado / string binária**                             | Perde a legibilidade do payload e não ganha garantia que `decimalPattern` não dê.                                                                                                                                                                                                                                                                                        |

## 5. Consequências

**Positivas.** O formato passa a ser citável, o que destrava o item nº 1 da fronteira
recomendada do Ciclo 13 e o `C10-3` (que ficou em `5/35` por causa desta pendência).
A mudança não exige nenhuma linha de código nova: o que falta é a decisão. A precisão do
`numeric` do Postgres é preservada ponta a ponta.

**Negativas e limites.** O payload é maior que o de um número por valor; consumidores novos
precisam tratar o valor como string e passar por `Decimal` para aritmética; e o valor de
retorno de `getTotals` deixa de ser o tipo nomeado `ExpenseTotals` e passa a ser o tipo
inferido de `expenseTotalsOutput` — o que é uma perda de expressividade nominal que este ADR
aceita em troca de o schema ser a fonte da verdade.

**Dívida declarada.** Enquanto este ADR estiver em `PROPOSTA`, a documentação afirma o
contrário do que o código faz: três assinaturas públicas **mudaram** e o registro do Ciclo 3
disse que nenhuma mudou. Ratificar corrige isso por decisão; reverter corrige pelo outro
lado. O statu quo silencioso é o único desfecho que deixa a afirmação falsa de pé.
