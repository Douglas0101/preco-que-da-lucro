# EXECUÇÃO ONDA 2 — painel de supervisão (2026-09-14)

**Plano:** `docs/evidence/plan-partials-2026-09-13/PLANO.md` (Onda 2 — observabilidade: itens **16.7, 19.2, 19.3, 19.5, 17.8, §29, §30**) + `part-3-observabilidade.md`.
**Método:** enxame com até 3 operadores (WIP), **worktree/branch por operador**, integração unitária `git merge --no-ff --no-commit` com **manifests exclusivos do supervisor** (`package.json`, matriz M-02, `EXECUTION-STATE-PROGRAM.md`), **marcador parent-pinned por commit**, **token DB** (`flock /tmp/opencode/onda2-db.lock`, 1 suíte por vez) e verificador adversarial por integração. Sem push (decisão local).

> **Nota de escopo (lacuna de convenção corrigida):** as Ondas 0 e 1 tiveram painel próprio (`EXECUCAO-ONDA0.md`, `EXECUCAO-ONDA1.md`). A **Onda 2A foi integrada sem painel e sem par `▶`/`✔` no journal** — estado órfão detectado pela auditoria independente e reconciliado em **L36** (`b88ebca`). Este painel cobre **2A + 2B** para fechar a lacuna.

## 1. Onda 2A — integrada em sessão anterior (journalizada retroativamente em L36)

| Int. | Item                                           | Operador | Commits   | Merge em `develop` | Migration | Evidência                                                              |
| ---- | ---------------------------------------------- | -------- | --------- | ------------------ | --------- | ---------------------------------------------------------------------- |
| I13  | 19.2 spans HTTP/BFF/service                    | O13      | `907321f` | `877bf71`          | —         | `docs/evidence/onda2-spans-2026-09-13.md`                              |
| I14  | 19.3 DB spans (semconv) + 16.7 pool saturation | O14      | `ead5c12` | `645336e`          | —         | `docs/evidence/db-spans-2026-09-13.md` · `pool-saturation-2026-09-13/` |
| I15  | 17.8 RUM persistido + p75                      | O15      | `b60f919` | `9f8280e`          | **0014**  | `docs/evidence/rum-persistence-2026-09-13.md` · `rum-p75-2026-09-13/`  |

**Registro da sessão de origem:** `#19.2` acrescenta `http.response.status_code` nos três caminhos do middleware (ERROR só ≥500) e o span `bff.request` cobrindo as 29 server functions em um ponto; `#19.3` instrumenta o wrapper de `client.query` (cobre Neon e node-postgres) com `db.system.name`/`db.operation.name`/`db.query.text` **redigido e truncado em 256 chars** (`values` nunca anexado) + `app.db.query.duration`, e mede o pool (§16.7); `#17.8` cria `rum_vitals` (INSERT-only, sem tenant/RLS por design) com ingestão best-effort que **nunca altera o 204**, mais `scripts/obs/rum-percentiles.ts` (`percentile_cont(0.75)`, local-only).

**Gates declarados na origem:** registry `db:classify:check` **15/15**; `test-migrations` + `test-rum-persistence` verdes; build/typecheck/matrix/boundaries verdes; retry de build por flake do `.nitro` compartilhado entre worktrees (registrado).

## 2. Onda 2B — integrada nesta sessão (3ª passagem, sobre parciais não commitados)

Os parciais existiam em worktrees e **nunca haviam sido commitados**. O16 estava funcional; **O17 tinha o harness quebrado (4 testes vermelhos)**; O18 estava funcional mas **sem o runbook exigido**. Medição de partida do supervisor: O16 12 testes verdes · O17 4 falhando · O18 19 verdes.

| Int. | Item                     | Operador | Commits              | Merge em `develop` | Gates do supervisor                                                                | Evidência                                                        |
| ---- | ------------------------ | -------- | -------------------- | ------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| I16  | 19.5 financial metrics   | O16      | `2b6d264`, `60e6a82` | `6883935`          | 24 testes (3 arquivos), typecheck, boundaries, matriz regenerada, prettier         | `docs/evidence/financial-metrics-2026-09-14.md` (+ before/after) |
| I17  | §29 SLO de IA + frontend | O17      | `ee74dc2`, `5799899` | `8ee85e4`          | 11 testes (2 arquivos), typecheck, boundaries, matriz regenerada, `format:check` 0 | `docs/evidence/slo-ai-2026-09-14.md` (+ 4 JSONs)                 |
| I18  | §30 error budget         | O18      | `58a29b5`, `369a757` | `0dc18a3`          | 19 testes, typecheck, boundaries, matriz sem drift, `format:check` 0, lockfile 5/5 | `docs/evidence/error-budget-2026-09-14/` (12 arquivos) + runbook |

**Higiene do supervisor:** `3269080` (guarda de entrypoint canônica + documentação de dois invariantes herdados) · `d8d814e` (reparo do marcador do I18 que um erro de escaping havia corrompido).

### 2.1 Achado material do I16 — contagem dupla real (confirmada e corrigida)

O parcial **escondia** o bug porque mockava `product-detail.service`. Cadeia real: `getDiagnostic` → `loadProductFinancialDetail` → `calculateProductReadModel` (**emissão #1**) e então `diagnostic.service.ts` (**emissão #2**) — **duas** emissões de `app.financial.states` por view de diagnóstico. No caso de divergência as duas carregavam **estados diferentes** (`ok` + `invalid`), o que inflava `invalid_calculation_count` — exatamente o "não-duplicação" que §19.5 exige. **Sobrevivente = o choke point** (o estado da _view_ pode ser `invalid` por break-even, fora do cálculo do produto), sem perda de sinal porque `app.diagnostic.calculation_total{status}` já registra o estado da view. Prova vermelho→verde com loader real, não mock.

### 2.2 Achado material do I17 — o harness e a disciplina de baseline

**Causa-raiz** dos 4 testes vermelhos: o helper `runChat()` local do teste chamava `contextWithRole(...)` e factories que nunca importava; o fix usa o `runFakeChat` exportado (uma única fonte). Mais relevante: o item entregou um **guard de disciplina de baseline** (`scripts/obs/baseline-regime.ts`) que rejeita regime misto, `CONTROLADO` sobre provider real, `OBSERVED` com `n=0` e `OBSERVED-UNAVAILABLE` com amostras — provado **falhando fechado** por invocação direta. Consequência verificável: **nenhuma série `OBSERVED` existe**; o provider real aparece só como `OBSERVED-UNAVAILABLE` com `n=0` (H-6 pendente). A re-execução fresca do p75 em 2026-09-14 devolveu **0 linhas**, o que o artefato declara: **não há dado de usuário real**.

### 2.3 Achado material do I18 — o item que faltava e a prova de local-first

O parcial não tinha o **runbook operacional** (exigido por `part-3`); foi criado (`docs/runbooks/slo-error-budget.md`, 239 linhas). A prova de "local-first/parse-only" foi feita com rigor incomum: `strace -f -e trace=network` → **0 sockets AF_INET/AF_INET6**; execução sob **`unshare -rn`** (netns nova, `lo` DOWN) → relatório **byte-idêntico** ao run com rede; `strace` de escrita → único write é o `--out` pedido. A spec permanece **DRAFT** e **nenhum rótulo `CONTROLADO`** é emitido (todas as ocorrências nos artefatos são negações).

## 3. Manifests aplicados pelo supervisor

| Arquivo                                      | Mudança                                                                                                                                 | Origem            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `docs/specs/M-02/matrix.yaml` + `.generated` | `directDatabaseFiles` 40 → 41 (`financial-metrics.test.ts`) → 42 (`chat-execution-fakes.ts`); deslocamentos de `line` pelos comentários | I16, I17, higiene |
| `package.json`                               | scripts `obs:ai-latency`, `obs:error-budget` (convenção `obs:pool`/`obs:rum-p75`)                                                       | I17, I18          |
| `EXECUTION-STATE-PROGRAM.md`                 | marcador parent-pinned por commit + bullets de integração (22 marcadores, 0 malformados)                                                | todas             |
| `.env.example`                               | sampler OTel (I13) e `RUM_PERSISTENCE_ENABLED` (I15) — da sessão anterior                                                               | 2A                |

**Drift do F-REPO reconciliado no boot:** o repo principal carregava `drizzle-kit ^0.18.1` + lock reescrito, o que deixava `npm run check` **vermelho no 1º passo** (`m02:lockfile-guard` fail-closed, 4 checks). Corrigido com `git checkout` dos dois manifests + `npm ci --ignore-scripts` → guard **5/5 verde**. Como o `node_modules` dos worktrees é **symlink** do principal, um único `npm ci` consistiu os 4 checkouts.

## 4. Verificação adversarial (V13–V18)

**Status: PENDENTE no momento da escrita deste painel** — as integrações de 2B entraram sem V prévio (decisão de manter o ímpeto com WIP=3 e 4 cores). A bateria V cobre: V13 (§19.2 spans HTTP/BFF) · V14 (§19.3/§16.7 spans de query + pool) · V15 (§17.8 RUM/migration 0014) · V16 (§19.5) · V17 (§29) · V18 (§30). Verdictos são anexados na seção 4.1 após a execução.

### 4.1 Verdictos

#### V15 — §17.8 RUM + migration 0014 (`9f8280e`) → **PRONTO-COM-RESSALVAS** (0 bloqueantes)

Verificador independente, contexto _fresh_, mandato de falsificar. **As 8 alegações = CONFIRMADO:**

| #   | Alegação                                      | Verificação executada                                                                                                                                          | Resultado               |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Schema/grants da 0014                         | **introspecção do banco vivo** (`relrowsecurity=false`, 0 policies, `app_runtime` só `INSERT`, `PUBLIC` sem insert, índice `(name, received_at)`)              | CONFIRMADO              |
| 2   | **sha256 do registry**                        | `sha256sum drizzle/0014_mighty_veda.sql` = `069b97ae…c3f2` **==** `scripts/db/migration-classes.ts:265`; e `drizzle.__drizzle_migrations` com o **mesmo hash** | CONFIRMADO              |
| 3   | Rollback + journal 15/15                      | `drizzle/rollback/0014_to_0013_down.sql:9`; `rum_vitals` no down global; `_journal.json` idx 0..14                                                             | CONFIRMADO              |
| 4   | Ingest best-effort preserva 204               | `test-rum-persistence` exit 0 **observando o warn `rum.web_vitals_persist_failed` com resposta 204**                                                           | CONFIRMADO              |
| 5   | Semântica de `RUM_PERSISTENCE_ENABLED`        | matriz empírica (`""`/`"0"`/`"FALSE"`/`"false "` → ON)                                                                                                         | CONFIRMADO (+ ressalva) |
| 6   | Comportamento do script p75                   | `percentile_cont(0.75)`, `MIN_SAMPLES=20`, recusa não-loopback exit 2                                                                                          | CONFIRMADO (+ ressalva) |
| 7   | Evidência é de **fixtures sintéticas**        | cadência horária `…:45:51.597`, re-execução `rows: []`, `generated_at` 58 s antes do commit, render byte-idêntico                                              | CONFIRMADO (~0,95)      |
| 8   | Vereditos p75 **não** são conformidade de SLO | zero menções a `SLO` nos dois arquivos                                                                                                                         | CONFIRMADO              |

**Ressalvas (nenhuma bloqueante, todas em código NOVO desta onda — viram follow-up rastreado, ver §6.7–6.9):**

1. **Bypass do guard local-only** (`scripts/obs/rum-percentiles.ts:73-85`): o guard valida **só o hostname da URL**, mas o `pg` honra o **query param `?host=`** — reproduzido com `DATABASE_ADMIN_URL='…@127.0.0.1…?host=ep-prod.invalid'` → `ENOTFOUND ep-prod.invalid`, ou seja, o guard foi contornado. Impacto **read-only** e exige credenciais válidas + URL forjada, mas o guard existe exatamente para isso.
2. **`RUM_PERSISTENCE_ENABLED` é case/whitespace-sensível** (`src/routes/api/vitals.ts:15` usa `!== "false"`, inverso da convenção `=== "true"` do repo): `"FALSE"`/`"0"`/`"false "` mantêm a persistência **ligada silenciosamente**.
3. **Artefatos do p75 sem marcador de procedência:** `docs/evidence/rum-p75-2026-09-13/{report.md,raw.json}` não carregam um campo dizendo "fixtures sintéticas"; fora do doc irmão, N=40 pode ser lido como tráfego real.
4. Sem teste unitário para as funções puras de `rum-percentiles.ts`; `rum_vitals.metric_id` sem dedup (beacons duplicados distorceriam o p75).

#### V13 — §19.2 spans HTTP/BFF (`877bf71`) → **PRONTO-COM-RESSALVAS** (0 bloqueantes)

**As 8 alegações = CONFIRMADO**, com três **correções factuais** que o próprio verificador extraiu:

| #   | Alegação                                            | Verificação executada                                                                                                                                                                                                                                                               | Resultado                          |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | `http.response.status_code` nos 3 caminhos          | fonte (`start.ts:102/:117/:127`) + **prova empírica** com SDK in-memory: 403 lançado → attr=403 e **OK**; 500 inesperado → attr=500 e **ERROR** + 1 evento de exceção                                                                                                               | CONFIRMADO                         |
| 2   | span sempre encerrado                               | `http-request-span.ts:24-28` (`finally { span.end() }`); `throw "plain"` (não-`Error`) ainda produz 1 span finalizado                                                                                                                                                               | CONFIRMADO                         |
| 3   | `bff.request` em um ponto, attrs limpos             | fonte + empírico: attrs **só** `app.bff.middleware` + `app.correlation_id` (sem header/token/e-mail/body)                                                                                                                                                                           | CONFIRMADO, **contagem corrigida** |
| 4   | span do dashboard sem PII                           | `dashboard.service.ts:174-180`; teste assere `app.sales.count` e `not.toHaveProperty("app.sales.revenue")`; `period` limitado por `z.enum(["month","quarter","year"])` → sem cardinalidade ilimitada                                                                                | CONFIRMADO                         |
| 5   | **sem mudança de comportamento** (o de maior risco) | diff com whitespace normalizado: só entram o import de `withSpan`, o bloco `withBffSpan` e 2 `return`; **todo** log e fluxo byte-idêntico; e **sem vazamento para o bundle do cliente** (`.output/public` não contém `opentelemetry`/`app.bff.middleware`, `.output/server` contém) | CONFIRMADO                         |
| 6   | **fix do BUG-CHAT intacto**                         | `request-context.ts:88` e `:140` **byte-idênticos** ao pré-commit (`907321f^:72/:121`); e2e de regressão existe em `e2e/ui-stack.spec.ts:279` (não executado aqui — exige preview)                                                                                                  | CONFIRMADO                         |
| 7   | deviação 4xx→ERROR existe mas §30 ignora span       | deviação real (empírico: `throw new Response(401)` → span ERROR); **budget provadamente não consome span**: `grep -n "span\|SpanStatusCode\|trace" scripts/obs/error-budget.ts` → **0 matches**; sem outro consumidor de `bff.request`                                              | CONFIRMADO                         |
| 8   | sampler documentado no `.env.example`               | `.env.example:58-62`; `NodeSDK` resolve do env (`sdk.js:219` → `create-from-env.js`)                                                                                                                                                                                                | CONFIRMADO                         |

**Integridade da suíte:** `observability-spans.test.ts` → **10/10**; `grep -nE "\.(skip|only|todo)\("` → **0 hits** (os 10 casos existem de fato).

**Correções factuais ao artefato de origem (não bloqueantes, documentação):** (a) são **33** server functions, não 29 — `createServerFn(` em 8 arquivos, com **paridade perfeita** 1/1·4/4·1/1·1/1·6/6·3/3·15/15·2/2 com os sítios de `middleware([...])`; o "29" é a cifra do próprio plano (`part-3:22`) e o artefato a ecoou; (b) o churn real de `request-context.ts` é **+67/−47**, não +114/−84 (o segundo é a barra do `--stat`); (c) o sampler **já foi aplicado** em `877bf71` (`.env.example:58-62`), mas o artefato ainda o apresenta como "manifest request pendente"; (d) a deviação de 4xx vale para **qualquer** `Response` lançado pelas 33 server functions (409, 429), não só 401/403.

#### V14 — §19.3/§16.7 spans de query + pool (`645336e`) → **BLOQUEADO** (2 achados bloqueantes)

O verificador executou sondas reais contra `pg.Pool` + `drizzle-orm/node-postgres` e **refutou a alegação central do item**.

**BLOQUEANTE 1 — a cobertura de spans é FALSA como escrita.** `pool.connect(cb)` devolve `undefined` (`node_modules/pg-pool/index.js:31-33`), e `src/db/client.server.ts:372-373` faz early-return em não-`thenable` ⇒ `instrumentClientRoundTrips` (`:385`) **nunca roda** para o cliente vindo de `pool.query`. Como `drizzle-orm/node-postgres/session.cjs:159/178` roteia **toda query não-transacional** por `pool.query`, essas queries emitem **zero span e zero `app.db.query.duration`**. A Neon é idêntica (o `promisify` bundled devolve `result: void 0`).

| prova                                                                | resultado observado               |
| -------------------------------------------------------------------- | --------------------------------- |
| `db.execute(sql\`select … '<pii@leak.com>'\`)` **fora** de transação | `spans: []` · `query metrics: []` |
| `db.transaction(...)`                                                | span + métrica presentes          |
| `pg.Pool` real: `pool.connect(cb)` → valor de retorno                | `undefined`                       |
| `pool.query` depois                                                  | `spans after pool.query: []`      |

**Caminhos reais que perdem span silenciosamente:** `src/routes/api/health/ready.ts:8`, `src/routes/api/vitals.ts:22`, `src/server/auth/rate-limit-storage.server.ts:22,43` (**o rate limiter — ou seja, a maioria das requests autenticadas**) e `src/server/auth/auth.server.ts:83`. Só o caminho `withTenantTransaction` está coberto. O artefato afirma "toda query fora de `begin`/`commit`/`rollback` abre span" — **falso**; e `part-3` pedia "wrapper no `client.query`, cobre Neon + node-postgres", o que só é parcialmente honrado (o wrapper está no **client**, não no `pool.query`).

**BLOQUEANTE 2 — vazamento no redator (PII).** `select 'a\', 'secret' from t` → `select ?secret?`. O redator (`src/instrumentation/sql-redactor.ts:86-105`) aplica semântica de escape por barra invertida do `E''` a **toda** string, então um literal terminado em barra invertida engole a aspa de abertura do literal seguinte e **emite o conteúdo dele** em `db.query.text` — num banco com `standard_conforming_strings=on` (default), isso é SQL válido. Alcance hoje estreito (nenhuma query em `src/` usa literal terminado em barra), mas é **regressão de controle de PII no arquivo que existe justamente para impedir PII em traces**.

**Refutado (não bloqueante):** (3) `applicationMetrics.dbQueryDuration.record` (`client.server.ts:239`) **sem guarda** — um `record` que lance rejeita uma query bem-sucedida (caminho promise) e **aborta o callback do usuário** (caminho callback), contradizendo a regra do próprio repo (`telemetry.ts:56`, `:132-134`); (4) o caminho callback e os **atributos** do span **não são cobertos por teste** (o teste atual só mocka `dbQueryDuration.record`), que é o que esconde o achado 3; (5) whitespace **dentro** de identificadores duplamente aspeados é colapsado (`"col  name"` → `"col name"`) — só corrupção de exibição; (6) comentário de linha termina só em `\n`, não em `\r` (over-redação, direção segura).

**CONFIRMADO:** (9) atributos `db.system.name`/`db.operation.name`/`db.query.text`, truncamento em **256** com sufixo `...`, `values` **nunca** anexado (grep sem ocorrência); (10) casos restantes do redator: `''` escapado, `E'...'` (incl. `E'a\'b'`), `$$…$$`/`$tag$…$tag$` (incl. `$tag_1$`), comentários aninhados e não terminados, `$1` preservado, `"weird'col"`/`"col--name"` preservados; (11) `begin/commit/rollback` sem span mas ainda alimentando `app.context_tx` e in-flight (exactly-once: callback → spans `['SELECT','INSERT']`, `round_trips:4`); (12) **nenhum** `db.system` nu em `src/`/`scripts/` (só em cópias gitignored de worktree); (13) métricas e labels do pool corretos, **sem label de tenant**; (14) exactly-once em todos os caminhos alcançáveis (promise e callback cada um encerra 1 span; rejeição/`cb(err)` → ERROR + exception + exatamente 1 callback); (15) `pool-activity` local-only fail-closed (NODE_ENV=production e host não-loopback → exit 1, valor omitido); (16) evidência de pool consistente com os nomes/units das métricas; (17) gates permitidos: 20 testes verdes, prettier e eslint limpos.

**Decisão do S:** o bloqueio é real e material — **§19.3 NÃO conta como fechado**. Conforme o método (precedente V10 da Onda 1), o bloqueio vira **fix dirigido + re-verificação**, não aceitação com ressalva: corrigir a cobertura (`pool.query`), o vazamento do redator, a robustez do `record` e a lacuna de teste; depois **V14b**.

## 5. Resultado

**Status honesto de fechamento por item** (não "tudo fechado"):

| Item     | Status após a Onda 2              | Por quê                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **16.7** | **FECHADO**                       | gauges/histograma do pool com label `driver`, sem label de tenant; evidência de pool versionada                                                                                                                                                                                                                                                                           |
| **19.3** | **BLOQUEADO — em correção (V14)** | a cobertura de spans é **falsa como escrita**: queries não-transacionais via `pool.query` não emitem span nem métrica (afeta rate limiter, health, vitals, auth); e o redator vaza conteúdo de literal após barra invertida. Fix dirigido em curso + **V14b** obrigatório.                                                                                                |
| **19.5** | **FECHADO**                       | choke point único, contagem dupla do diagnóstico corrigida, 4 nomes mapeados sem série duplicada                                                                                                                                                                                                                                                                          |
| **17.8** | **FECHADO**                       | `rum_vitals` (0014) + ingestão best-effort que preserva 204 + p75 com alvos                                                                                                                                                                                                                                                                                               |
| **19.2** | **PERMANECE PARTIAL**             | a **3ª ação** ("spans de service nos cenários M-06": products list, diagnostic, price formation, sales, simulation) **não** foi implementada — só `service.dashboard.sales_summary` existe. A válvula "derivar do item 19.3" de `part-3:24` é sobre **repositories**, não sobre services; portanto **não** fecha a ação. Decisão do S: **não contar §19.2 como fechado**. |
| **§29**  | **PARTIAL aberto**                | o que a onda podia entregar está entregue (fases de IA + disciplina de baseline + comparação p75), mas **sem tráfego real (H-6)** não há SLO: as séries de IA são `CONTROLADO`/mock e o provider real é `OBSERVED-UNAVAILABLE` (`n=0`)                                                                                                                                    |
| **§30**  | **PARTIAL aberto**                | runbook + medição existem, mas a spec segue **DRAFT** (baseline M-06/Q-020 pendente) e a classe financeira fica `UNKNOWN` (exit 2) por falta de série exportada                                                                                                                                                                                                           |

- **Migrations:** 0014 (`rum_vitals`) — registry **15/15**, `sha256` **recomputado e conferido** pelo V15 contra o banco vivo, rollback versionado, replay do chain verde.
- **Dependências novas: zero** (a decisão ratificada de recusar `@opentelemetry/instrumentation-pg` foi respeitada: o wrapper de `client.query` cobre Neon **e** node-postgres).
- **Fila humana inalterada e ainda bloqueante:** **H-4** (PITR ≥7 d) e **H-6** (tráfego real) continuam sendo os únicos bloqueios operacionais do dia-D. **H-8** (ratificação do ADR-029) é novo, de governança.
- **Gates no HEAD integrado** (`d8d814e`): `npm run check` **exit 0** (9/9 passos; **561 testes em 64 arquivos**, de 495 no fim da Onda 1) e `npm run db:test` **exit 0** (10/10 suítes com veredito `: OK`).

## 6. Gaps declarados (não escondidos)

1. **Sem coletor OTLP local** em 19.2/19.3/19.5: os atributos e labels são aferidos na API do meter/testes in-memory, **não** como série exportada em backend. Confirmar export em staging é follow-up.
2. **`time_to_first_content == time_to_final`** hoje (§29, fluxo não-streaming) — as duas séries existem separadas para receber streaming sem renomear; documentado no artefato.
3. **Classe financeira `UNKNOWN` (exit 2)** no error budget para as fixtures de 7 d, porque `app.financial.states` é OTEL-only e não há série exportada para parsear.
4. **RUM sem tráfego real:** o p75 vem de fixtures sintéticas (regime `CONTROLADO`); os vereditos "OK" **não** são conformidade de SLO. `part-E` registra §29/§30 como NOT STARTED — não existe SLO operacional hoje.
5. **Placar oficial (`part-E` = 77,8%) não foi remedido**; 79,1% e 80,2% são projeções por delta que **subdeclaram** ~0,27–0,53pp. Não inflam resultado.
6. **Dívida pré-existente declarada, não corrigida:** 4 asserções `as unknown as` em `products.functions.ts` (de `87a5d39`) documentadas com `SAFETY:`; `JSON.parse(JSON.stringify(...))` em `diagnostic.service.ts` documentado com `SAFETY:`.

### 6.2 Correções bloqueantes em curso (achadas por V14 — NÃO são follow-ups)

Diferente da §6.1, estes **não podem ficar para depois**: a integração I14 está **BLOQUEADA** e o método exige fix + re-verificação (precedente V10→O10c/O10d→V10b na Onda 1).

| id    | correção exigida                                                                                          | por quê é bloqueante                                                                  |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| B2A-1 | Fazer o span/métrica de query cobrir `pool.query` (o `pg-pool` chama `connect(cb)` e devolve `undefined`) | a maioria das queries reais (rate limiter, health, vitals, auth) não emite span algum |
| B2A-2 | Redator: parar de aplicar escape por barra invertida fora de `E'...'`/`e'...'`                            | vaza o conteúdo do literal seguinte para `db.query.text` — controle de PII do §19.4   |
| B2A-3 | Envolver `applicationMetrics.dbQueryDuration.record` em try/catch                                         | instrumentação não pode rejeitar query nem abortar o callback do usuário              |
| B2A-4 | Teste do caminho callback + dos **atributos** do span (hoje só mocka `record`)                            | foi essa lacuna que escondeu B2A-3                                                    |
| B2A-5 | Corrigir o texto de contrato de `docs/evidence/db-spans-2026-09-13.md` para refletir a cobertura REAL     | o artefato afirma cobertura que não existe — o próximo leitor confiaria nela          |

### 6.3 Follow-ups rastreados abertos por V15 (código novo desta onda, não corrigidos no PC de propósito)

**Por que não corrigi agora:** cada um é mudança em código que **já passou pelo verificador**; alterá-lo no PC invalidaria o V15 sem re-verificação — exatamente o anti-padrão que o método proíbe. Ficam **rastreados com reprodução exata** para a Onda 3.

| id    | item                                                                                                                                                                                                                                                                                                  | reprodução / evidência                                                                                                                                    | risco                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| F2A-1 | Guard local-only de `scripts/obs/rum-percentiles.ts` contornável por `?host=`                                                                                                                                                                                                                         | `DATABASE_ADMIN_URL='postgresql://…@127.0.0.1:5432/db?host=ep-prod.invalid' npx tsx scripts/obs/rum-percentiles.ts` → tenta conectar remoto (`ENOTFOUND`) | read-only; exige URL forjada + credenciais válidas                                                            |
| F2A-2 | `RUM_PERSISTENCE_ENABLED` case/whitespace-sensível (`!== "false"`, inverso da convenção `=== "true"`)                                                                                                                                                                                                 | `"FALSE"`/`"0"`/`"false "` → persistência permanece LIGADA sem erro                                                                                       | telemetria gravando quando o operador queria log-only                                                         |
| F2A-3 | `docs/evidence/rum-p75-2026-09-13/{report.md,raw.json}` sem marcador de procedência sintética                                                                                                                                                                                                         | leitura dos arquivos: não há campo de regime/procedência                                                                                                  | N=40 pode ser lido como tráfego real fora do doc irmão                                                        |
| F2A-4 | Sem teste unitário das funções puras de `rum-percentiles.ts`; `rum_vitals.metric_id` sem dedup                                                                                                                                                                                                        | não existe `src/test/rum-percentiles.test.ts`                                                                                                             | regressão silenciosa; p75 distorcido por beacons duplicados                                                   |
| F2A-5 | **§19.2 fica PARTIAL:** faltam spans de service para products list, diagnostic, price formation, sales e simulation                                                                                                                                                                                   | `grep` por span de service: só `service.dashboard.sales_summary` existe (`dashboard.service.ts:171`); `product-read-model.service.ts` sem span            | item do plano contado como fechado sem estar                                                                  |
| F2A-6 | **Ponto cego PRÉ-EXISTENTE que limita o §30:** `handleResponseError` (`start.ts:34-47`) **não emite log estruturado**, então um **5xx lançado** (ex.: 503 `DATABASE_ERROR` vindo de `requireDatabaseAuth`) não chega nem a `request.failed` nem a `request.completed` → **invisível ao error budget** | leitura de `start.ts:34-47` + grep dos eventos em `error-budget.ts:255-266`                                                                               | o orçamento de erro do §30 não enxerga falhas de dependência, que são justamente o caso de uso dele           |
| F2A-7 | `start.ts:86` hoista `const pathname = new URL(request.url).pathname` **para fora** do `try`                                                                                                                                                                                                          | leitura de `start.ts:86`                                                                                                                                  | inalcançável para um `Request` WHATWG (URL sempre absoluta), mas remove um caminho do `handleUnexpectedError` |
