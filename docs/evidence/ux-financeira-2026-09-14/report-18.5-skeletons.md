# Onda 3 §18.5 — Skeletons de carregamento (UX financeira)

**Item:** 18.5 (Skeleton) — plano `docs/evidence/plan-partials-2026-09-13/part-4-seguranca-ux.md`.
**Base:** `2382636` · **Branch:** `ops/onda3-skeleton` · **Data:** 2026-09-14.

## 1. Rotas que ganharam skeleton

As quatro rotas que não tinham nenhuma ocorrência de `Skeleton` antes deste item:

| Rota                | Pontos de carregamento                               | Esqueleto                                         |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| `/inicio`           | `pendingComponent` (loader) + branch `loadStatus`    | `InicioSkeleton`                                  |
| `/produtos`         | branch `isPending` de `ProductListContent`           | `ProdutosSkeleton`                                |
| `/ponto-equilibrio` | `pendingComponent` (loader) + branch `useQueries`    | `PontoEquilibrioSkeleton`                         |
| `/diagnostico`      | `loadStatus === "loading"` + `ProductState(loading)` | `DiagnosticoSkeleton` + `DiagnosticoDataSkeleton` |

Antes, esses pontos renderizavam `<output className="text-muted-foreground">Carregando...</output>`
(texto visível). O item troca o texto por uma região de carregamento com a **geometria real**
da rota; nenhuma lógica de dados, cálculo ou estado foi alterada.

`simulacoes.tsx` **não foi tocado** (itens 18.1/18.3 são donos desse arquivo). Em `inicio.tsx` a
mudança é aditiva: `MetricCard` não foi alterado, então 18.3 pode acrescentar um prop (`explain`)
sem conflito.

## 2. Convenção de anúncio a11y

O plano pede `role="status"` + `sr-only` "Carregando…". O que o **código** fazia:

- os quatro pontos usavam `<output className="text-muted-foreground">Carregando...</output>`
  — o elemento `<output>` tem role implícita `status`, com o texto **visível**;
- os skeletons já existentes do app (`SimulacoesSkeleton`, `VendasSkeleton`, despesas, preços)
  usam um wrapper `aria-hidden="true"` **sem nenhum anúncio** — ou seja, a rota de referência do
  plano (`simulacoes.tsx:502-538`) não tem `role="status"` nem `sr-only`.

Decisão aplicada (mecanismo do plano, string do repo):

- texto `Carregando...` (a string já usada em `inicio`, `produtos`, `ponto-equilibrio`, `despesas`
  e `route.tsx` — a grafia com reticências ASCII prevalece na base, não a do plano);
- região explícita `role="status"` com o texto em `sr-only`, fora do bloco `aria-hidden`;
- corpo visual (`grid`/`space-y`) marcado `aria-hidden="true"`, mantendo a convenção dos
  skeletons existentes.

A marcação vive num único lugar, `src/components/loading-skeleton.tsx` (`LoadingSkeleton`), porque
o anúncio precisa ficar **fora** do `aria-hidden` — duplicar isso em cinco call sites convidava
justamente ao erro de esconder o anúncio. O arquivo fica em `src/components/` (não em
`src/components/ui/`) porque `scripts/check-ui-stack.mjs` valida um catálogo fechado de nomes de
arquivo em `src/components/ui/` — `npm run check:ui-stack` passa com o novo componente.

## 3. Geometria espelhada por rota

| Rota                | Geometria do conteúdo carregado                                                                                                                  | Esqueleto                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `/inicio`           | header `text-3xl`, grupo de 3 botões de período, grid `md:grid-cols-2 lg:grid-cols-4` (4 KPIs), linha de ações                                   | header, 3 botões, 4 cards KPI com label + disco `h-8 w-8` + valor + descrição, 2 botões            |
| `/produtos`         | `grid gap-3` de `<Card>` com ícone `h-12 w-12`, nome+badge, linha de métricas e 2 botões                                                         | 3 cards (ícone `h-12 w-12`, nome `h-6`, métricas `h-5`, botões `h-8`/`h-9`)                        |
| `/ponto-equilibrio` | header, card de seleção `md:grid-cols-2`, grid `md:grid-cols-3` de métricas, card "ponto de equilíbrio" `md:grid-cols-2`, card de lucro desejado | mesmos grids/heights (`h-9` para Select/Input, `h-7` para valor `text-xl`)                         |
| `/diagnostico`      | header, card de seleção `max-w-md`, card de premissas `md:grid-cols-2`, grid `md:grid-cols-2 xl:grid-cols-5` com 5 KPIs                          | mesmos grids (5 KPIs em `xl:grid-cols-5`); `ProductState(loading)` reusa só o bloco premissas+KPIs |

## 4. Testes

Comando:

```
npx vitest run src/test/route-loading-skeletons.test.tsx
```

Resultado: **1 arquivo, 5 testes, 5 passando** (2,9 s).

- `renders the shared loading region with the announcement outside aria-hidden` — contrato do primitivo;
- `inicio`, `produtos`, `ponto-equilibrio`, `diagnostico` — um teste por rota que **renderiza o
  `component` real da rota** (`Route.options.component`) com as queries mockadas em estado
  `pending`, exercitando o gate de carregamento de verdade; cada teste exige
  `role="status"` + `sr-only` + barras `[data-slot="skeleton"]` + anúncio **fora** da subárvore
  `aria-hidden` (`expect(body.contains(announcement)).toBe(false)`) e confere a grade real
  (`lg:grid-cols-4` com 4 filhos, `xl:grid-cols-5` com 5 filhos, `grid gap-3` com 3 cards,
  `md:grid-cols-3` com 3 métricas) + `axe` sem violações (regra `color-contrast` desabilitada,
  igual a `src/test/ui-stack.test.tsx`).

Prova de que o teste não é vacuoso (duas mutações; o arquivo mutado foi restaurado e conferido por
hash em seguida):

1. revertendo o gate de `/inicio` para o `<output>` antigo, o teste falha
   (`região role=status ausente no estado de carregamento`);
2. movendo o `<span className="sr-only">` para **dentro** da `div aria-hidden`
   (`src/components/loading-skeleton.tsx`), os **5** testes falham com
   `AssertionError: expected true to be false // Object.is equality` em
   `expectLoadingContract (src/test/route-loading-skeletons.test.tsx:95:39)` — a asserção
   discrimina o caso "anúncio dentro da subárvore suprimida", que a checagem de existência de
   `.sr-only` não pegava.

Regressão vizinha: `npx vitest run src/test/ui-stack.test.tsx src/test/simulation-race.test.tsx src/test/query-performance.test.ts` → **3 arquivos, 18 testes, 18 passando**.

## 5. Gates locais

| Comando                                                    | Resultado                                    |
| ---------------------------------------------------------- | -------------------------------------------- |
| `npx tsc --noEmit -p tsconfig.json`                        | exit 0                                       |
| `npx eslint <6 arquivos alterados>`                        | exit 0                                       |
| `npx prettier --check <6 arquivos alterados>`              | `All matched files use Prettier code style!` |
| `npm run check:ui-stack`                                   | `UI stack check passed`                      |
| `npx vitest run src/test/route-loading-skeletons.test.tsx` | 5/5 passando                                 |

`npm run check` completo e `db:test` **não** foram executados aqui (contrato do operador — ficam
para o supervisor na integração).

## 6. CLS/LCP/TTFB — **MEDIDOS**

O harness F0-04 existe e é executável neste ambiente: `scripts/perf/capture-baseline.mjs`
(+ `scripts/perf/summarize.mjs`), local-only (preview Nitro `node-server` + PostgreSQL 17 em
Docker, IA mockada em processo). Captura desta rodada:

```
npm run build                                     # .output node-server
flock /tmp/opencode/onda2-db.lock -c "npm run e2e:prepare"   # fixture: perf.controlled@example.test + "Produto de teste"
node scripts/perf/capture-baseline.mjs \
  --dir docs/evidence/ux-financeira-2026-09-14 \
  --iterations 5 --warmup 0 --chat-iterations 0 \
  --skip-db --skip-build --skip-bundle
```

Seed e captura rodaram com `DATABASE_URL`/`DATABASE_ADMIN_URL` explícitos em
`127.0.0.1:5432/preco_que_da_lucro_test` (+ `DATABASE_DRIVER=node-postgres`) e as credenciais
`E2E_AUTH_*` default do harness — nunca Neon/produção.

- Captura concluída (exit 0) em `2026-09-14T15:24:22Z → 15:25:35Z`, base
  `http://127.0.0.1:4219`, chromium 151, **n = 5 amostras por rota**, 81 `app.context_tx`. O campo
  `commit` de `meta.json` é `2382636` — o HEAD que o harness (`gitHead()`) leu no worktree no
  instante da captura, **antes** do commit da fatia; o build medido em `.output` saiu do worktree da
  feature, commitado em `d158f71` (`2026-09-14 12:30 -0300`). Ou seja: `commit` **não** identifica o
  build medido (ver `measuredBuildFrom`/`commitNote` em `meta.json`).
- Percentis por interpolação linear R-7, mesmo método do baseline F0-04.
- Raw: `route-samples.jsonl`, `context-tx.jsonl`, `server-stdout.txt`, `meta.json`,
  `capture-stdout.txt`, `ai-probe-output.txt`. Derivado: `cls-<rota>.json` (before/after + amostras).

**Antes** = `docs/evidence/perf-controlled-2026-09-13/route-samples.jsonl` (commit `42d4b76`,
warmup 1, n=5). **Depois** = esta captura (warmup 0, n=5).

| Rota                                       | CLS p50 / max (antes → depois) | LCP p50 / p95 (antes → depois) | TTFB p50 (antes → depois) | readyMs p50 (antes → depois) |
| ------------------------------------------ | ------------------------------ | ------------------------------ | ------------------------- | ---------------------------- |
| `/inicio`                                  | 0.00 / 0 → 0.00 / 0            | 1124 / 1274 → 1132 / 1448      | 4.0 → 5.1                 | 2490 → 2524                  |
| `/produtos`                                | 0.00 / 0 → 0.00 / 0            | 1116 / 1175 → 1236 / 1315      | 3.8 → 4.8                 | 2461 → 2588                  |
| `/ponto-equilibrio`                        | 0.00 / 0 → 0.00 / 0            | 1244 / 1339 → 1356 / 1727      | 4.1 → 6.8                 | 2512 → 2562                  |
| `/diagnostico`                             | 0.00 / 0 → 0.00 / 0            | 1216 / 1282 → 1352 / 1638      | 4.6 → 5.3                 | 2476 → 2619                  |
| `/simulacoes` (controle, **não alterada**) | 0.02 / 0.02 → 0.02 / 0.02      | 1272 / 1342 → 1724 / 2634      | 6.3 → 6.2                 | 2505 → 3154                  |

Leitura honesta dos números:

- **CLS não regride**: as quatro rotas ficam em `0` antes e depois (o `/simulacoes` de controle
  mantém `0.02` nas duas rodadas).
- LCP/`readyMs`: subiram nas **cinco** rotas, inclusive `/simulacoes`, que este item **não tocou**
  (LCP p50 1272 → 1724 ms; `readyMs` p50 2505 → 3154 ms). TTFB: subiu nas **quatro rotas alteradas**
  (4.0 → 5.1, 3.8 → 4.8, 4.1 → 6.8 e 4.6 → 5.3 ms) e **não** subiu na rota de controle
  (`/simulacoes` 6.3 → 6.2 ms). O desvio dominante está no LCP/`readyMs` do controle, que nenhum
  código desta fatia alterou, então ele é da rodada/ambiente (n=5, `warmup 0` em vez de 1, máquina
  com outros processos ativos), não atribuível ao esqueleto; nenhuma regressão pode ser imputada a
  §18.5 com este par antes/depois.
- O ganho do item é de **geometria/percepção** (o carregamento ocupa o espaço final), não
  mensurável por CLS nesta fixture — declarado como tal em vez de inventar número.

## 7. Lacunas declaradas

1. `--skip-db` / `--skip-build` / `--skip-bundle` nesta captura: o seed foi executado antes, sob
   `flock /tmp/opencode/onda2-db.lock`, e o build é o mesmo `.output` recém-gerado (os três
   aparecem como `gaps` em `meta.json`). `bundle-report.json` não foi recalculado.
2. `--chat-iterations 0`: o circuito de chat (rota não-alvo de §18.5) foi omitido; sem
   `ai.model_attempt` nesta rodada (`aiProbe.records = 0`).
3. `warmup 0` em vez de `warmup 1`: as amostras descartadas do baseline F0-04 tinham latência
   dentro da faixa medida (ex.: `/inicio` 2538 ms de warmup vs 2448–2533 ms medidos), então a
   comparabilidade se mantém; ainda assim é uma diferença de método em relação ao F0-04.
4. Captura CONTROLADO (mock/local ≠ produção): não mede nada do preview Vercel nem do gateway
   real de IA.
5. Pontos cobertos por rota: `/inicio` e `/ponto-equilibrio` declaram `pendingComponent` (loader
   não-bloqueante) **e** branch client-side; `/produtos` e `/diagnostico` não declaram
   `pendingComponent` (não têm loader), então nelas o esqueleto cobre apenas o carregamento
   client-side das queries — mesmo conjunto de estados de antes.
6. Não foi executado `npm run check` completo, `db:test`, e2e Playwright do repo (§46) nem a
   varredura de a11y por rota autenticada — ficam para o supervisor na integração.
