# README — resoluções direcionadas (2026-10-22)

> **O que este pacote é:** a correção e a prova de cinco frentes medidas na bateria
> `docs/evidence/bug-hunt/` (DBT-160, DBT-157, DBT-123/159, DBT-148) mais o gate local
> `check:own`. Executado na bancada local (Postgres 17; app em `:4173`), **sem commit, push,
> deploy ou toque em produção**.
>
> **O que este pacote NÃO é:** um run de CI, um selo de release ou uma prova de runtime da
> Vercel. As fases 4 (baselines de pixel) e 5 (Lighthouse CI) do prompt **não foram concluídas**
> — ver §4.

## 1. Sumário

| frente                  | antes (medido)                                               | depois (medido)                                                      | dívida                            |
| ----------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------- |
| Exclusão de despesa     | server fn **503** (`42501` antes da RLS), linha 1→1          | **200**, linha some e continua ausente após reload                   | DBT-160 FECHADA                   |
| Clickjacking            | iframe de outra origem carrega a landing                     | `chrome-error://chromewebdata/`; controle sem XFO carrega            | DBT-157 FECHADA                   |
| Contraste `/produtos`   | 2,15:1 (`.text-success`) e 3,20:1 (badge); rota fora do gate | **4,95:1** e **5,03:1**; axe sem violação; rota no gate              | DBT-123 parcial / DBT-159 FECHADA |
| OTel no build compilado | 0 requisições OTLP; duas cópias da API                       | 3× `POST /v1/metrics` + 1× `POST /v1/traces`; API única              | DBT-148 FECHADA                   |
| Gate local              | `npm run check` parado no lockfile alheio                    | `check:own` **exit 0**; gate completo só vermelho no lockfile alheio | —                                 |

- **Um efeito colateral corrigido:** `OTEL_METRIC_EXPORT_INTERVAL_MS < 5000` fazia o
  `PeriodicExportingMetricReader` lançar e desligava **traces e métricas** juntos. O piso agora é
  `exportTimeoutMillis` (5 s), com teste em 1.000/4.999/5.000 ms.
- **Um defeito de ferramental corrigido:** `eslint .` varria `.vercel/output` (Build Output API)
  e travava; `.vercel` entrou no ignore, como `.output`.

## 2. Evidência por frente

### 2.1 DBT-160 — DELETE em `expenses`

`drizzle/0020_runtime_delete_expenses.sql` concede `DELETE` **somente** em `public.expenses`.
A enumeração por código mostra que é o único caminho real: `deleteProduct = archiveProduct`
(UPDATE) e não há `.delete(sales)` nem `.delete(simulations)`. O teste nega o alargamento:

```
expenses|DELETE      products|INSERT/SELECT/UPDATE
                     sales|INSERT/SELECT
                     simulations|INSERT/SELECT
```

- `captures/grants-expenses-products-sales-simulations.txt` — `information_schema.role_table_grants`.
- `captures/db-test-migrations.txt` — `PostgreSQL 17, migration zero, constraints, RLS, P1 tables,
cross-tenant e rollback: OK`; inclui DELETE real como `app_runtime`, 0 linhas para outro tenant.
- `captures/resolutions-probe.json` §`expenseDelete` — server fn **200**, `visibleAfterReload:false`.
- `captures/expense-delete.png`.

### 2.2 DBT-157 — `X-Frame-Options: DENY`

- `src/lib/security-headers.ts` emite XFO em **ambos** os modos; `CSP_ENFORCE` não foi alterado.
- `captures/headers-4173.txt` e `headers-api-health-live.txt` — `x-frame-options: DENY` em 200.
  O S6 confirmou também em **404** e em `CSP_ENFORCE=true`.
- `captures/resolutions-probe.json` §`clickjacking` — alvo em `chrome-error://chromewebdata/`,
  `targetText:null`, controle em `:4179` com `CONTROL-FRAME-CONTENT`,
  `methodDiscriminates:true`.
- `captures/clickjacking-frame.png`.
- **CSP aplicada:** continua condicionada a `CSP_ENFORCE=true` (ADR-043/DBT-142). O prompt
  autoriza manter o XFO como defesa imediata e registrar a pendência; não houve relaxamento de
  diretiva nem nonce.

### 2.3 DBT-123 / DBT-159 — contraste e cobertura de `/produtos`

- `--success` do `:root` passou de `oklch(0.74 0.17 155)` (2,15:1) para
  `oklch(0.527 0.154 150.069)` = **4,95:1** (canvas, 3 engines).
- Badge passou de `text-amber-600` (3,20:1) para `text-amber-700` = **5,03:1**.
- `e2e/ui-stack.spec.ts` adiciona o teste `products list meets WCAG AA text contrast with the
seeded rows`: resolve a cor por canvas (Chromium devolve `oklch()`), confere as duas razões e
  roda o axe. Fixture determinística do seed (margem > 30 % + produto incompleto).
- `captures/e2e-targeted.txt` — 2/2 verdes (a asserção de XFO e a de contraste).
- `captures/negative-control-contrast.json` — reverter **só** as duas cores no mesmo fixture
  devolve **2,153:1** e **3,199:1**, com axe `color-contrast` serious em 2 nós. O gate discrimina.
- **DBT-123 segue ABERTA** pelo `scrollable-region-focusable` do log de `/novo-produto`.

### 2.4 DBT-148 — OTel com uma API e entrega real

- `telemetry.ts`: instrumentos de `applicationMetrics` são criados **depois** de `sdk.start()`
  (`getApplicationMetrics()`), atrás de um Proxy que preserva a mutabilidade do literal (testes
  substituem instrumentos). `ensureTelemetryStarted()` é aguardável e o middleware de `start.ts`
  espera; sem endpoint o caminho retorna sem importar o SDK.
- `vite.config.ts`: os imports do SDK são **literais** (lazy) para o SSR empacotar SDK + API no
  mesmo grafo; o cliente marca `@opentelemetry/*` como externo (nunca executam lá). O bundle
  `.vercel/output` não tem import bare de OTel e tem 7,5 MB.
- `captures/otel-collector.jsonl` — 3 `POST /v1/metrics` e 1 `POST /v1/traces` no build
  compilado (S6 reconfirmou no `.output` final).
- `captures/unit-tests.txt` — 151 arquivos / 2369 testes PASS.
- Intervalo de métrica: piso de 5 s (teste em `otel-batch-config` e `env-empty-defaults`).

### 2.5 `check:own` e gate completo

`package.json` adiciona:

```
m02:debts-guard → m02:temporal-guard → m02:secrets-audit → m02:state:check →
m02:matrix:check → format:check → lint → typecheck
```

`captures/check-own.txt` — exit 0. Fora dele, por desenho: `m02:lockfile-guard` (vermelho
**pré-existente** pelo `package-lock.json` do WIP alheio) e `check:bundle`.

Passos pesados rodados à parte e registrados:

- `npm run test` — 2369 PASS, 30 skipped, exit 0 (`captures/unit-tests.txt`).
- `npm run build` + `npm run check:bundle` — grafo inicial **451.299 B** (teto 500.000).
- `db:test` no container efêmero `55432`: `test-migrations`, `concurrency`, `tool-security`,
  `sql-injection`, `chat-semantics`, `ai-budget`, `rum-persistence`, `rate-limit-burst`,
  `outbox`, `backfill`, `memory`, `products-fk-conflict`, `product-contracts`,
  `reconcile-ai-usage`, `dashboard-margin` — verdes. **`test-auth-integration` falha 503 por
  DBT-147** (par de e-mail ausente no ambiente), dívida pré-existente e declarada.
- Guardas avulsas: `guard:upgrade`, `check:migration-toolchain`, `guard:contracts`,
  `m02:work-package-guard`, `m02:boundaries`, `guard:mcp-runtime`, `m02:seal-dts:check`,
  `check:ui-stack`, `check:no-supabase-runtime`, `check:bundle` — exit 0.
- e2e: 2/2 testes direcionados no Chromium. A suíte inteira não foi usada como prova porque o
  teste de chat depende do provedor vivo (respondeu conteúdo real e falhou na regex de
  indisponibilidade) — comportamento de ambiente, não regressão deste pacote.

## 3. Hashes e identidade

`captures/hashes.txt` — HEAD `363eb43ff9b4702bb7b5c837ce6639c05a12369a` e sha256 de cada
arquivo de produto/documentação. `MANIFEST.sha256` cobre todo o pacote (`checked === discovered`).

## 4. Riscos e limites declarados

1. **Fase 4 (baselines de pixel) não concluída.** As 24 baselines do bug-hunt foram medidas na
   bancada, não no `ubuntu-24.04` do CI; a própria dívida declara a portabilidade como não
   medida. Commitar baselines locais criaria um gate que pode falhar por ambiente — pior que a
   lacuna. Não há `e2e/visual/__screenshots__` versionado.
2. **Fase 5 (Lighthouse CI) não concluída.** Não existe baseline Lighthouse versionada; a
   comparação compatível é o LCP controlado de `deep-2026-10-20` (572 ms, −5,9 %). INP não é
   medido pelo Lighthouse 12.8.2 no modo padrão. Adicionar `@lhci/cli` sobre o lockfile já sujo
   misturaria WIP alheio e criaria um gate sem baseline.
3. **DBT-123 parcial** (log de `/novo-produto`).
4. **Vercel runtime não exercitado.** O artefato foi inspecionado; a entrega em produção não é
   afirmada.
5. **S6 não é humano nem CI.** Foi uma lane de contexto limpo por subagente.
6. **WIP alheio:** o bump `vite` 8.0.16 → 8.2.4 e o lockfile existiam antes desta sessão. Não
   são reivindicados aqui e não foram descartados.

## 5. Auto-verificação pré-S6 (17 itens)

| #   | item                          | como foi satisfeito / limite declarado                                                                                                                           |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | controle negativo             | controle sem XFO carrega; grant negativo em products/sales/simulations; razões antigas 2,15/3,20 documentadas                                                    |
| 2   | fronteira nos dois lados      | intervalo 4.999 → default e 5.000 → aceito; XFO em report-only **e** enforce                                                                                     |
| 3   | identidade, não cardinalidade | IDs fixos (`runtimeExpenseId`), URLs de frame e path do coletor nomeados; não só contagens                                                                       |
| 4   | proibido exit-code-only       | o veredito exige POST observado no coletor, linha ausente no reload e razão ≥4,5 — não só exit 0                                                                 |
| 5   | proibido sleep fixo           | **parcial:** o smoke do coletor usou espera limitada de 12 s; a asserção é sobre requisições observadas, não sobre o tempo. Declarado.                           |
| 6   | sem valor degenerado          | IDs, hashes, razões e contagens distinguem os estados; nada serializa para constante                                                                             |
| 7   | precondição de estado         | fixture do seed assertada (`Produto de teste`, `DADOS INCOMPLETOS`); banco efêmero para `db:test`                                                                |
| 8   | sentinela real                | despesa criada pela UI, produto semeado, frame real em outra porta                                                                                               |
| 9   | fingerprint de revisão        | `captures/hashes.txt` com HEAD e sha256                                                                                                                          |
| 10  | `checked === discovered`      | MANIFEST gerado do conjunto descoberto não vazio e conferido                                                                                                     |
| 11  | S6 contexto limpo             | subagente independente, 0 REJECTED; ver §6                                                                                                                       |
| 12  | falha alta                    | testes usam `assert.rejects`/`expect` com código nomeado; nenhum catch converte erro em sucesso                                                                  |
| 13  | isolamento de bancada         | `db:test` no container efêmero `55432`, removido; ausência verificada; `:5432` local não é produção; nenhum alvo remoto                                          |
| 14  | check impresso → gate+captura | todos os exits citados têm captura em `captures/`                                                                                                                |
| 15  | run de CI atado ao commit     | **N/A-trigger:** sem push autorizado. Nenhum selo cita run inexistente; o último verde é anterior a este pacote.                                                 |
| 16  | descoberta multi-sítio        | caminhos de DELETE enumerados por grep; grants por `information_schema`; sítios OTel e workflows enumerados                                                      |
| 17  | precondição de ambiente       | HEAD/worktree/deps declarados; o selo automático **não** rodou porque o worktree está sujo (WIP alheio + este pacote) — precondição do `m02:seal` não satisfeita |

**KPI de prevenção:** o autor capturou antes do S6 **2** achados (piso do intervalo de métrica;
`eslint` travando em `.vercel`) de **7** totais (2 + 1 CORR + 4 N do S6) ⇒ **2/7 ≈ 29 %**.

## 6. S6 adversarial (lane de contexto limpo)

**Veredicto inicial: CORR 1 · N 4 · REJECTED 0 · UNVERIFIABLE 0.**

| claim                                    | veredicto | evidência / tratamento                                                                                            |
| ---------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 1. DELETE só em expenses, RLS intacta    | OK        | SQL independente: `t/f/f/f`; cross-tenant 0, own 1 (rollback); `21/21` classificadas                              |
| 2. XFO efetivo nos dois modos            | OK        | 200 **e** 404 com XFO; frame bloqueado; controle carrega                                                          |
| 3. contraste ≥4,5 e rota no gate         | **CORR**  | limiar correto, **razões reportadas erradas**: real 4,945/5,031, não 5,14/5,02. Comentários e registry corrigidos |
| 4. OTel entrega e bundle sem import bare | OK        | `/v1/traces` + `/v1/metrics` no `.output` final; 125 JS da função Vercel, 0 import bare; cliente sem OTel         |
| 5. `check:own` verde                     | OK        | exit 0; composição declarada (ver N2)                                                                             |

**N encontrados e tratados:**

- **N1 — documentação viva obsoleta:** o runbook `reconcile-ai-usage.md` e os comentários do job
  ainda diziam que `app.ai.reconciliation_*` nunca saía do processo. Corrigidos para o estado
  pós-DBT-148 (alerta por métrica possível com OTLP; log continua sendo o fallback).
- **N2 — gate local não documentado / composição:** `check:own` não substitui o gate completo e
  não cobre `build`/`test`/`lockfile`. Registrado em `AGENTS.md` e neste README; os passos
  pesados foram executados e capturados separadamente.
- **N3 — footprint não declarado:** bump do `vite`/lockfile é WIP alheio; `visual-correlation.ts`
  e `DEBTS.md` são desta sessão. Declarado na §4 e em `SPEC.md` §4.
- **N4 — pacote sem selo / evidência pendurada:** `SPEC.md`, este `README.md` e
  `MANIFEST.sha256` criados; o ponteiro de DBT-159 agora existe.

**Minors corrigidos:** comentário “0019→0003” → “head→0003”; campos novos no tipo do resultado de
privilégios. **Não corrigido (declarado):** o selo automático (`m02:seal`) não roda com worktree
sujo; o MANIFEST foi gerado por descoberta + sha256 e conferido.

## 7. Manifesto

`tools/` contém os três scripts usados para reproduzir as provas (probe de clickjacking+exclusão, controle negativo de contraste e coletor OTLP).

`MANIFEST.sha256` — gerado por `find docs/evidence/resolutions-2026-10-22 -type f | sort` e
`sha256sum`: **discovered 22 = checked 22**, `sha256sum -c --quiet` OK. O manifesto não se
auto-inclui (mesma convenção do pacote `bug-hunt`).
