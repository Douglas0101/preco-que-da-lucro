# 18.3 — Explain calculation (`Como calculamos?`)

- **Data:** 2026-09-14
- **Branch:** `ops/onda3-explain` · **base:** `f47318a`
- **Worktree:** `.worktree-onda3-explain` (nenhuma escrita no checkout principal)
- **Escopo:** `plan-partials-2026-09-13/part-4-seguranca-ux.md` §18.3 — slot `explain` no `MetricCard`
  (4 KPIs do `/inicio` + destaque de margem) e explainer no resultado da simulação com as fórmulas
  efetivamente usadas e a origem do volume.

## 1. O que foi entregue

| Arquivo                                       | Mudança                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/lib/calc-explanation.ts` (**novo**)      | Tabela de passos do cenário (`SCENARIO_STEP_SPECS`), `scenarioExplanation(echo)`, `CONTRIBUTION_MARGIN_PCT_FORMULA` |
| `src/routes/_authenticated/inicio.tsx`        | Slot `explain` no `MetricCard` (reusa `CalcExplainer`) + explicação nos 4 KPIs + no card de maior margem            |
| `src/routes/_authenticated/simulacoes.tsx`    | `ScenarioExplanation` no resultado (7 passos) + `VOLUME_ORIGIN_EXPLANATION`                                         |
| `src/test/calc-explainer.test.tsx` (**novo**) | 12 testes: teclado/foco, axe, paridade com o motor e as duas telas                                                  |

1. **`MetricCard` ganhou `explain?: ReactNode`** e renderiza `<CalcExplainer className="mt-3">` — o mesmo
   slot que `Kpi` já usa em `diagnostico.tsx`. `CalcExplainer` foi **reusado**, não duplicado.
2. **Quatro KPIs** com explicação própria: _Produtos_ (contagem cadastral), _Despesas fixas cadastradas_
   (soma do tipo «fixa», despesas variáveis fora), _Faturamento real_ (soma das vendas do período — com
   texto próprio no estado `—`) e _Margem consolidada_ (depende do mix real de vendas; mostra «—» em vez
   de uma média dos produtos).
3. **Destaque de margem** (`🏆 Maior margem unitária calculável`) com o critério (maior `cmPct` entre os
   produtos completos, empate mantém o primeiro avaliado) e a fórmula importada de `calc-explanation.ts`.
4. **Resultado da simulação** com um `CalcExplainer` logo abaixo do `<output>`: os 7 passos da cadeia de
   `calculateScenario` na ordem em que o motor os aplica, com o valor exibido sendo o **eco do motor**, e a
   origem do volume declarada em texto (`VOLUME_ORIGIN_EXPLANATION`).

## 2. Como a paridade com `finance.ts` é garantida

Nenhum valor é reescrito: `scenarioExplanation` **só lê o eco do motor** (`DecimalScenarioResult` do BFF /
`ScenarioResult` de `calculateScenario`) e cada passo declara `field`, o campo que explica. O que prende a
explicação ao motor é o teste — `describe("paridade com o motor (§18.3)")`:

1. **Cadeia pelas mesmas funções exportadas**: para o cenário `10 / 4 / 10% / 20 un. / 50` o teste aplica
   `calculateVariableCost` → `calculateContributionMargin` → `calculateContributionMarginPct` na mesma
   ordem do motor e compara com o eco. Se `calculateScenario` parar de compor a cadeia assim, **falha**.
2. **Transcrição independente das fórmulas**: `formulaChain(echo)` escreve em `Decimal` exatamente o que
   as strings de `SCENARIO_STEP_SPECS` dizem (`preço × (imposto + taxas) ÷ 100`, `preço − custo unitário −
custo variável unitário`, `margem ÷ preço × 100`, `preço × volume`, `(custo + variável) × volume`,
   `margem × volume`, `margem total − despesas fixas`) e confere com o eco **passo a passo**. Se o motor
   mudar a aritmética de um passo (ex.: faturamento deixar de ser `preço × volume`), **falha**.
3. **Nada de número à mão**: o valor exibido é comparado com `brl`/`pct` do eco do motor.
4. **Contrato de campos**: o teste percorre todas as chaves do eco **serializado pelo BFF**
   (`runFinancialSimulation` → `DecimalScenarioResult`) e exige que cada uma esteja explicada **ou**
   declarada em `NOT_EXPLAINED_HERE` com motivo (`price`/`unitCost`/`volume` = entradas;
   `breakEven*` = explicados em `/ponto-equilibrio`; `resultSign` = só cor da linha). Um campo novo
   **no eco** derruba o teste até alguém decidir se ele entra na explicação; um campo que exista só no
   motor (`ScenarioResult` de `calculateScenario`, cujo eco é uma lista explícita de campos montada em
   `financial.service.ts`) **não** derruba: o lock cobre as chaves do eco, não as do motor.
5. **Anti-cópia entre telas**: `CONTRIBUTION_MARGIN_PCT_FORMULA` é a **mesma string** do passo
   `contributionMarginPct` (preso ao motor pelo item 2 **pelo campo e pelo valor, não pelo texto** — ver
   residual 1) e é ela que o card de `/inicio` renderiza — o teste confere a identidade e a página
   renderizada contém a string.

**Falsificação executada** (mutação temporária em `src/lib/calc-explanation.ts`, fonte restaurada e
conferida com `diff` — arquivo idêntico ao backup):

- valor escrito à mão no passo de faturamento (`brl(202)`) → `exibe o eco do motor, nunca um número
reescrito à mão` **falha**: `expected 'R$ 202,00' to be 'R$ 200,00'`;
- `totalContribution` trocado por `totalVariable` na tabela → `cobre todo campo do eco do motor, ou declara
por que não cobre` **falha**: `campo do motor sem explicação declarada: totalContribution`.

**Limite declarado (residual 1):** a garantia automática sobre o **texto** das fórmulas é desigual por
passo. As prosas de `variableCost`, `contributionMargin`, `revenue`, `totalContribution` e `result` são
assertadas **literalmente** no teste do resultado (`toContain("Faturamento: preço × volume")`, por
exemplo, nas duas telas), então trocar a prosa de `revenue` por uma fórmula que o motor não usa **não**
passa — o teste falha. O que fica **sem guarda** é exatamente a prosa de dois pontos: o passo
`totalVariable` ("Custo variável total", `(custo unitário + custo variável unitário) × volume`) e a
constante `CONTRIBUTION_MARGIN_PCT_FORMULA`, que o teste usa **pela própria constante** (identidade e
`toContain`), nunca pelo conteúdo literal — reescrever o texto dela por outra fórmula não derruba nada.
O que está provado é que o valor exibido é o eco do motor, que a aritmética transcrita ao lado da string
bate com o motor e que o conjunto de campos cobertos segue o contrato; nesses dois pontos a fórmula
escrita pode divergir do motor em silêncio e depende de revisão.

## 3. Como a origem `forecast` é descrita

`VOLUME_ORIGIN_EXPLANATION` (co-locado com `VOLUME_ORIGIN_LABELS`, de §18.1):

| Origem              | Texto no "Como calculamos?"                                                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manual_simulation` | "volume hipotético informado por você como premissa do cenário."                                                                                                                                            |
| `forecast`          | "projeção de volume informada por você — **não é previsão estatística**: o motor não usa série histórica nem modelo. A matemática é a mesma da simulação manual; muda apenas a origem declarada do volume." |
| `real`              | "soma das vendas registradas; nenhuma projeção entra aqui."                                                                                                                                                 |

O texto **não contradiz §18.1**: a projeção é _informada_, a matemática é a mesma e só a origem declarada
difere. O teste da rota seleciona `forecast`, digita o volume, abre o explainer e afirma o texto (além de
`Estimativa informada (projeção)` na linha de origem, contrato de §18.1 preservado).

## 4. Testes

```
npx vitest run src/test/calc-explainer.test.tsx \
  src/test/finance.golden.test.ts src/test/financial-metrics.test.ts \
  src/test/dashboard.service.test.ts src/test/ui-stack.test.tsx \
  src/test/simulation-race.test.tsx src/test/query-performance.test.ts \
  src/test/financial.service.test.ts src/test/route-loading-skeletons.test.tsx \
  src/test/simulation-volume-source.test.tsx
→ Test Files 10 passed (10) · Tests 189 passed (189)
```

`src/test/calc-explainer.test.tsx` — **12 testes** em 4 grupos:

- **`CalcExplainer`**: fechado por padrão, `summary` nativo alcançado por **Tab** (laço de `user.tab()`),
  foco **permanece no resumo** ao revelar e ao esconder, axe limpo com o conteúdo aberto;
- **`/inicio`** (rota real renderizada, resumo mockado): **5** resumos "Como calculamos?" (4 KPIs +
  destaque), cada um com conteúdo não vazio, o texto de cada KPI, a fórmula do destaque presente, axe
  limpo; e o estado sem vendas, que explica o «—» do faturamento;
- **paridade com o motor**: os 6 testes descritos na §2;
- **resultado da simulação** (motor real via `runFinancialSimulation`): `forecast` mostra os 7 passos com
  os valores calculados (`R$ 1,00`, `R$ 5,00`, `50,00%`, `R$ 200,00`, `R$ 100,00`, `R$ 100,00`, `R$ 50,00`),
  descreve a projeção **informada** e passa no axe; simulação manual mostra a mesma matemática e o volume
  declarado hipotético.

Nota de harness: `summary` **não** tem papel na tabela do `aria-query`, então `getByRole("button")` não o
encontra em jsdom — os testes usam `details > summary` pelo texto; e o `Intl` pt-BR separa `R$` do número
com NBSP, normalizado antes das asserções.

## 5. Gates

`npm run typecheck` exit 0; `npx eslint` nos 4 arquivos **0 erros / 0 avisos**; `npx prettier --check`
"All matched files use Prettier code style!". `npm run check` e `npm run db:test` ficam com o supervisor
(regra da onda). Nenhum arquivo de `finance.ts` foi alterado (só leitura).

## 6. Residuais declarados

1. **A prosa de duas das sete fórmulas não é verificada por teste** (§2, limite): a garantia automática
   cobre valor exibido = eco do motor, aritmética transcrita = motor e cobertura de campos, e as prosas
   de `variableCost`, `contributionMargin`, `revenue`, `totalContribution` e `result` são assertadas
   literalmente no teste do resultado — trocar a de `revenue` derruba 2 testes (a asserção
   `toContain("Faturamento: preço × volume = R$ 200,00")`, em `forecast` e em `simulação manual`).
   Ficam sem guarda só a prosa do passo `totalVariable` e a constante
   `CONTRIBUTION_MARGIN_PCT_FORMULA` (o teste a usa pela própria constante, então a troca de texto passa
   despercebida): nelas a fórmula escrita pode divergir do motor e depende de revisão.
2. **Sem e2e autenticado.** O e2e exigiria preview + `E2E_AUTH_EMAIL/PASSWORD` + seed e `e2e/ui-stack.spec.ts`
   é propriedade de O23 (20.1) na tabela de ownership; a prova de teclado é jsdom/`user-event`. Em
   particular, **a alternância por Enter/Espaço no `<summary>` não é exercitada**: jsdom não implementa a
   camada de teclado do elemento nativo (o navegador dispara um click sintético), então o teste cobre a
   alcançabilidade por Tab, o foco e a ativação pelo caminho que o navegador usa. Verificação em browser
   real fica para o e2e.
3. **Não há explicação de ponto de equilíbrio no resultado da simulação** (deliberado): o resultado não
   exibe esses números e `/ponto-equilibrio` já tem o próprio `CalcExplainer`; `breakEven*` está declarado
   em `NOT_EXPLAINED_HERE` com esse motivo.
4. Nenhuma medição de performance/CLS neste item (não há métrica aqui); nenhuma mudança em `finance.ts`,
   `start.ts`, `security-headers.ts` ou nas áreas de outros operadores.
