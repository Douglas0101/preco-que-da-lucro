# Pacote DECIDE — N-2 (`DecimalString` como wire canônico)

- **Ciclo:** 14 · **Fase:** F14-3 · **Classe de autorização:** DECIDE (R4, matriz §3 do brief)
- **Data:** 2026-09-29
- **Estado:** **entregue — decisão humana pendente.** Nada aqui está ratificado, e este
  documento não promove nada a `DONE`.
- **Origem:** `docs/evidence/ciclo-10-censo-bloqueadores-2026-09-28.md:125`,
  `docs/evidence/agent-state/PROGRESS.md:406` (`L214`, veredicto adversarial do S6),
  `docs/evidence/ciclo-13-reconciliacao-2026-09-29.md:144` (`R4`, `NÃO ENTREGUE`).

---

## 1. Fato medido

`DecimalString` **não é um tipo pendente de implementação**. Ele existe, está em uso, e o
tipo está no caminho do wire hoje:

| Item                   | Local                                 | Forma                                                                                                                                          |
| ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| O tipo                 | `src/lib/financial-values.ts:8`       | `export type DecimalString = string & { readonly __decimalString: unique symbol }`                                                             |
| O encoder              | `src/lib/financial-values.ts:185-208` | `toDecimalString(value: Decimal.Value, scale?: number): DecimalString`                                                                         |
| O padrão textual       | `src/lib/financial-values.ts:51`      | `decimalPattern = /^-?(?:0\|[1-9]\d*)(?:\.\d+)?$/`                                                                                             |
| O schema do contrato   | `src/lib/financial-values.ts:90-94`   | `z.string().regex(decimalPattern, "Use uma string decimal canônica.").refine(isFiniteDecimal, …).transform((value) => value as DecimalString)` |
| Derivados              | `:95`, `:99`, `:104`                  | `nonNegativeDecimalStringSchema`, `positiveDecimalStringSchema`, `percentFractionSchema`                                                       |
| A política de precisão | `FINANCIAL_DECIMAL_POLICY`            | tiers `.money` / `.percent` / `.quantity` / `.intermediate`, selecionados por `policyForScale(scale)`                                          |
| O tipo de quantidade   | `src/lib/financial-values.ts`         | `Quantity = Readonly<{ amount: DecimalString; unit: QuantityUnit; dimension: QuantityDimension; … }>`                                          |

Os três sítios que o S6 nomeou como **estreitados**, todos verificados nesta medição:

- `listExpenses` — `src/lib/expenses.functions.ts:108`; publica por
  `outputSchema(expensesListOutput, "expenses.listExpenses", view)` em `:116`.
- `getTotals` — `src/lib/expenses.functions.ts:176`; publica por
  `outputSchema(expenseTotalsOutput, "expenses.getTotals", totals)` em `:180`, e
  `expenseTotalsOutput` (`:101-107`) é `{ fixed: decimalStringSchema, variable: decimalStringSchema, productCount: z.int().nonnegative() }` — **não** o tipo nomeado `ExpenseTotals`.
- `listProducts` — `src/lib/products.functions.ts:386`; publica por
  `outputSchema(productListOutput, "products.listProducts", products)` em `:398`.

## 2. O que o brief pedia, e o que foi medido contra ele

O brief F14-3 pede **implementar um shadow dual-encode** controlado por `N2_CONTRACT_MODE`
(`legacy` → `value.toFixed(2)`; `dual` → `{legacy, decimal}`; `new` → `decimalStr`), para
**medir** qual formato de wire adotar.

Medido: **`N2_CONTRACT_MODE` não existe em parte alguma do repositório** — `grep -rn
"N2_CONTRACT_MODE"` sobre todo o repo devolve **0 ocorrências**. E a função de exemplo do
brief (`formatMoney(value: number): string | {legacy: number; decimal: string}`) **não
corresponde à arquitetura do repo**: aqui não há formatador; há um encoder
(`toDecimalString`) alimentando um contrato de schema (`outputSchema`) na fronteira de cada
server function.

A razão de o modo shadow **não ser implementável como pedido não é a ausência do flag — é
ter sido ultrapassado pelo fato**: o wire **já é** a string canônica. Um modo shadow existe
para medir uma decisão ainda não tomada; aqui a decisão já está no código, verde (`tsc`
global 0, 1222 testes) e em produção. Implementar `N2_CONTRACT_MODE` agora acrescentaria um
terceiro caminho de código para medir uma escolha já feita.

Há um obstáculo mais forte, e ele é de desenho. `toDecimalString` **não é um formatador — é
um portão**: ele lança `NON_FINITE_DECIMAL`, `INVALID_DECIMAL_SCALE`, `DECIMAL_OVERFLOW` e
`NON_CANONICAL_DECIMAL`. Um ramo `legacy` dentro dele faria o portão **devolver justamente a
forma que ele existe para recusar**: um número JSON é IEEE-754 e não carrega a garantia de
canonicidade que o `decimalPattern` exige. O modo `dual` tem o mesmo defeito na direção
oposta — publicar `{legacy, decimal}` põe um número sem canonicidade no payload ao lado da
string, e o consumidor escolhe; nada no contrato o obriga a escolher a string.

## 3. Tabela comparativa

| Critério                           | `legacy` (number no wire)                                                                             | `dual` (`{legacy, decimal}`)                             | `new` (string canônica) — **estado atual**           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Preserva `numeric` do Postgres     | **não** — IEEE-754 perde dígitos acima de ~15 significativos e não representa `0.1`, `0.2` exatamente | parcial — a string preserva, o número ao lado não        | **sim**                                              |
| Canonicidade enforçável            | não existe forma de recusar                                                                           | ambígua: metade do payload é recusável, metade não       | **sim** — `decimalPattern` + `NON_CANONICAL_DECIMAL` |
| Rejeita não-finito na fronteira    | não                                                                                                   | não para a metade numérica                               | **sim** — `NON_FINITE_DECIMAL`                       |
| Teto/piso por política             | não                                                                                                   | não                                                      | **sim** — `DECIMAL_OVERFLOW` por tier                |
| Tamanho do payload                 | menor                                                                                                 | **maior** — cada valor monetário vira objeto de 2 campos | maior que `legacy` por valor, mas plana              |
| Consumidor precisa decidir a forma | não                                                                                                   | **sim** — e nada o obriga a decidir certo                | não                                                  |
| Custo de reversão a partir de hoje | — (é o alvo da reversão)                                                                              | — (não existe)                                           | — (é o estado atual)                                 |

Escalas em uso, medidas nos mappers: `toDecimalString(data.amount, 4)` e
`toDecimalString(data.current_price, 4)` (dinheiro), `toDecimalString(data.yield_qty, 6)` e
`toDecimalString(data.tax_rate, 6)` (quantidade/percentual). São exatamente as escalas para
as quais `policyForScale(scale)` seleciona o tier de política — este é o motivo pelo qual um
`toFixed(2)` fixo, como o do exemplo do brief, **não** poderia representar os valores de
escala 6 sem truncar.

## 4. Custo de reversão medido

Se a decisão fosse **reverter** para `legacy`, a superfície a tocar é (contagem de
ocorrências do literal `DecimalString`, por arquivo, mais os sítios de produção):

- **60** sítios de produção — `grep -rn "toDecimalString(" src/ | wc -l` = **60**.
- **20** arquivos carregam o tipo. Os maiores: `src/lib/products.functions.ts` (29),
  `src/server/services/financial.service.ts` (16), **`src/lib/ai/tool-registry.ts` (16)**,
  `src/lib/break-even.ts` (15), `src/lib/financial-values.ts` (11),
  `src/server/services/sales.service.ts` (9).
- **Testes que pinam o formato**: `src/test/financial-values.test.ts` (8),
  `src/test/simulation.service.test.ts` (7), `src/test/output-contracts.test.ts` (4),
  `src/test/finance.properties.test.ts` (4), `src/test/finance.boundaries.test.ts` (1).
- **UI**: `src/routes/_authenticated/{precos,ponto-equilibrio,despesas}.tsx` (3 cada).
- **4 schemas** (`decimalStringSchema` e os três derivados) + o tipo `Quantity`.

A leitura que importa: **`src/lib/ai/tool-registry.ts` tem a mesma densidade (16) que o
maior serviço do repo.** As ferramentas de IA leem e escrevem valores decimais nas mesmas
escalas; reverter o wire para número reintroduziria erro de ponto flutuante no caminho em
que ele é mais caro — o de um cálculo financeiro feito por modelo.

## 5. Compatibilidade já medida (não presumida)

O S6 adversarial do Ciclo 3 mediu, com sondas próprias (`PROGRESS.md:406`, `L214`):

> É **compatível na leitura** (brand ⊂ `string`), nenhum consumidor quebra (`tsc` global 0,
> 1222 testes verdes) e não houve mudança para caber o canal de erro (o erro é `throw`), mas
> **não estava autorizado no brief** e fica **para ratificação do MAESTRO**.

Isso é decisivo para o formato desta decisão: **a objeção é de autorização, não de
engenharia.** O S6 não encontrou consumidor quebrado nem regressão; encontrou uma afirmação
falsa do autor (_"nenhuma assinatura mudou"_) sobre uma mudança que de fato ocorreu. O que
falta é o MAESTRO dizer _sim_ ou _não_, não um experimento.

## 6. O que está errado hoje, independentemente da decisão

Um item não depende de ratificação e deve ser corrigido em qualquer cenário: a
**documentação afirma o contrário do que o código faz**. `listExpenses`, `listProducts` e
`getTotals` têm tipo público estreitado, e o registro do Ciclo 3 afirmou que nenhuma
assinatura havia mudado. Ratificar N-2 fecha isso; reverter também fecha, para o outro lado.
**Manter como está e não decidir é o único desfecho que deixa a afirmação falsa de pé.**

## 7. Recomendação

**Ratificar `new`** — a string decimal canônica como wire canônico — e abrir o ADR-032
(`docs/adr/ADR-032-decimal-string-wire-canonico.md`, **PROPOSTA**).

Justificativa (§10.1 do Plano Mestre — decisão pelo que o artefato prova, não pelo que se
pretendia):

1. O estado atual é o único dos três que **enforça** o contrato. `legacy` e `dual` não têm
   como recusar um valor não-canônico, porque não existe representação de recusa em IEEE-754.
2. A objeção registrada é de **autorização**, e o S6 mediu ausência de regressão de
   consumidores. Ratificar converte uma mudança não autorizada em uma decisão autorizada
   **sem tocar em uma linha de código** — a alternativa custa os 60 sítios da §4.
3. `dual` é estritamente pior que os dois: paga o custo de payload de ambos e transfere ao
   consumidor uma escolha que o contrato deveria ter feito.
4. O ADR torna o formato **citável**, e é isso que destrava o item nº 1 da fronteira
   recomendada do Ciclo 13 (`docs/evidence/ciclo-13-reconciliacao-2026-09-29.md:184`) e o
   `C10-3` do Ciclo 10, que ficou em `5/35` **por causa desta pendência** — ampliar cobertura
   antes de ratificar multiplicaria por 7× uma decisão de API não ratificada
   (`ciclo-10-censo-bloqueadores-2026-09-28.md:130`).

**Se o MAESTRO reverter:** o custo está na §4 e é conhecido, não estimado. O que **não** é
opção é o statu quo silencioso.

## 8. Limite declarado deste pacote

Nenhuma das três colunas foi medida por execução — **`legacy` e `dual` são contrafactuais e
não existem em ramo algum**, e o brief não autoriza criá-los. O que está medido é (a) o
estado atual, por leitura direta do código-fonte e por contagem; (b) a ausência de regressão
de consumidores, pelo S6 do Ciclo 3 com sondas próprias; (c) o custo de reversão, por
contagem de sítios. A comparação da §3 é **análise sobre o que existe**, não benchmark — e
está dito aqui para que não seja lida como medição de três braços.
