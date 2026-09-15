# 18.1 — Estado `estimated` / origem de volume `forecast` (v1)

- **Data:** 2026-09-14
- **Branch:** `ops/onda3-estimated` · **base:** `6132325`
- **Worktree:** `.worktree-onda3-estimated` (nenhuma escrita no checkout principal)
- **Escopo:** v1 da UI (plano `plan-partials-2026-09-13/part-4-seguranca-ux.md` §18.1). Persistir/historicizar
  `forecast` é **v2** e **não foi entregue** (declaração explícita na última seção).

## 1. O que foi entregue

Símbolos em `src/routes/_authenticated/simulacoes.tsx`:

| Símbolo                           | Papel                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| `SimulationVolumeSource`          | `Extract<ResolvedVolumeSource, "manual_simulation" \| "forecast">` — o que a UI oferece     |
| `SIMULATION_VOLUME_SOURCES`       | As duas opções exibidas                                                                     |
| `VOLUME_SOURCE_DISPLAY`           | Título do card, dica, rótulo/dica da opção, badge, `title`, rótulo do campo e `persistable` |
| `VOLUME_ORIGIN_LABELS`            | Rótulo da origem **ecoada pelo motor** no resultado                                         |
| `VolumeSourceSelector`            | `fieldset` + radios nativos (via `ui/Input`)                                                |
| `buildSimulationInput`            | Passa `form.volumeSource` adiante (antes: `"manual_simulation"` fixo)                       |
| `SIMULATION_SAVE_BLOCKED_NOTE_ID` | Id da nota ligada ao botão por `aria-describedby`                                           |

1. **Seletor** `manual_simulation` × `forecast` no card (`fieldset` + `legend`
   "Origem do volume simulado", radios com `name="simulacao-origem-volume"`, rótulo por `htmlFor` e
   dica por `aria-describedby`).
2. **Badge** `Simulação` × `Estimativa` (classe `uppercase`), **título do card** e **origem do volume** no
   resultado: `Informado manualmente` × `Estimativa informada (projeção)`. A origem no resultado vem do
   **eco do motor** (`simulated.value.volumeSource`), não do formulário — é o que o cálculo de fato usou.
   O campo de volume também segue a origem: `Vendas simuladas (unidades)` × `Vendas estimadas (unidades)`.
3. **Salvar desabilitado** para `forecast` (`!sourceDisplay.persistable`), com nota visível dentro de uma
   região `aria-live="polite"` e ligada ao botão por `aria-describedby`:

   > "Salvar está indisponível para estimativas: a persistência aceita apenas a origem «simulação manual» —
   > guardar projeções está previsto para a v2. O cálculo acima continua válido e nada é convertido em
   > simulação manual em segundo plano."

   Sem fallback: `buildSimulationInput` envia `volumeSource: form.volumeSource`; não existe caminho que
   troque `forecast` por `manual_simulation`. Falsificação executada: restaurar o literal
   `"manual_simulation"` no builder derruba 3 dos 7 testes novos — saída em `falsification.txt`
   (mutação temporária, fonte restaurada logo depois).

## 2. `forecast` COMPUTA? — sim, com evidência

- **Contrato do engine:** `src/lib/finance.ts` lista `forecast` em `VOLUME_SOURCES` e
  `calculateScenario` só rejeita `unknown` com volume numérico; `runFinancialSimulation`
  (`src/server/services/financial.service.ts`) recusa apenas `real` (`INVALID_VOLUME_SOURCE`).
  `simulationParamsSchema` (`z.enum(["real","manual_simulation","forecast","unknown"])`) aceita a origem.
- **Unidade (`forecast computa no motor`):** `runFinancialSimulation` com os mesmos números devolve
  `status: "ok"` para as duas origens; removendo só o campo `volumeSource` do eco, os dois resultados são
  **deep-equal**. Ou seja: `forecast` produz resultado real; muda a origem declarada, não a matemática —
  o motor **não** tem nenhuma projeção/forecast estatístico, e a UI não promete isso em nenhum texto.
- **Componente:** o teste de rota usa a opção real `financialSimulationQueryOptions` → `runSimulation`
  (server fn) → engine (mock apenas na fronteira HTTP, como em `simulation-race.test.tsx`) e afirma o
  resultado renderizado com a estimativa selecionada (`Estimativa informada (projeção)`,
  `Faturamento simulado`). Não é branch morta: o caminho calcula e exibe.
- **Banco:** o CHECK de `simulations.scenario_type` já admite `forecast`
  (`src/db/schema.ts` / `drizzle/0003_curvy_firebrand.sql`). A recusa é do **service**:
  `SIMULATION_SOURCE_NOT_PERSISTABLE` em `src/server/services/simulation.service.ts:43-45` — **inalterado**
  neste item.

## 3. Persistência de forecast = v2, NÃO entregue

`forecast` **não é persistido** nesta entrega. A UI diz isso em dois lugares (dica da opção e nota do botão)
e o salvamento fica desabilitado; a guarda do servidor continua sendo a última linha de defesa, provada pelo
teste **pré-existente** `src/test/simulation.service.test.ts` ("Forecast" → rejeita
`SIMULATION_SOURCE_NOT_PERSISTABLE`, sem escrita). Nenhuma migration, nenhum caminho de escrita novo.

## 4. Testes

```
npx vitest run src/test/simulation-volume-source.test.tsx src/test/simulation-race.test.tsx \
  src/test/finance.boundaries.test.ts src/test/simulation.service.test.ts \
  src/test/query-performance.test.ts src/test/financial.service.test.ts src/test/ui-stack.test.tsx
→ Test Files 7 passed (7) · Tests 48 passed (48)     (vitest-targeted.txt)
```

Novo arquivo `src/test/simulation-volume-source.test.tsx` — **7 testes**:

1. `buildSimulationInput` envia `manual_simulation` no cenário manual;
2. `buildSimulationInput` envia `forecast` sem fallback silencioso (só `volumeSource` difere);
3. campo vazio continua `null` na estimativa (unknown ≠ zero);
4. `forecast` computa no motor com os mesmos números do manual;
5. toggle: grupo (`fieldset`/`legend`) nomeado, rótulo e estado por opção (`checked`), descrição acessível
   por opção, **Tab alcança o radio marcado** e **setas trocam a seleção do grupo** (comportamento nativo do
   `input[type=radio]` homônimo, exercitado via `user-event` `walkRadio`);
6. `forecast`: badge `Estimativa`, título, rótulo do campo, origem ecoada pelo motor, salvamento
   desabilitado com `aria-describedby` apontando para a nota, `saveSimulation` **não** chamado ao tentar
   clicar; voltar para manual reabilita o botão;
7. axe (`axe-core`, `color-contrast` desabilitado como em `ui-stack.test.tsx`): **zero violações** com a
   estimativa selecionada.

Atualização mínima em `src/test/simulation-race.test.tsx`: os dois literais de formulário passaram a
declarar `volumeSource: "manual_simulation"` (o builder não aceita mais formulário sem origem).

## 5. Gates

`gates.txt`: `npm run typecheck` exit 0; `npx eslint` nos 3 arquivos **0 erros / 0 avisos**;
`npx prettier --check` "All matched files use Prettier code style!". `npm run check` e `npm run db:test`
ficam com o supervisor (regra da onda). As linhas `✓ xms` no fim de `gates.txt`/`vitest-targeted.txt` são
do hook local `pi-lens`, não dos comandos.

## 6. Residuais declarados

1. **Sem execução em browser real** (e2e Playwright) neste ambiente: exige `npm run build` + preview +
   `E2E_AUTH_EMAIL/PASSWORD` + seed no Postgres — orçamento de tempo da onda não permite. A prova de
   teclado é a de jsdom/`user-event` (`walkRadio` sobre `input[type=radio]` nativo); o anúncio por leitor de
   tela e as setas no browser ficam **não verificados aqui**.
2. `e2e/ui-stack.spec.ts` é **propriedade de O23 (20.1)** na tabela de ownership; por isso o teste do toggle
   foi entregue como teste de componente, não como e2e naquele arquivo (evita colisão de escrita).
3. O caminho de erro do salvamento rejeitado (toast `SIMULATION_SOURCE_NOT_PERSISTABLE`) não é exercitado na
   UI porque o botão fica desabilitado por desenho; a garantia do servidor segue coberta pelo teste
   pré-existente do service.
4. Nenhuma medição de performance/CLS entra aqui (não há métrica deste item).
