# Pós-ondas PERF/FIN — 2026-08-29 (F0-04 re-mediado, ONDA 3 / S4-CLOSE; atualizado com patch pós-S4)

> **RÓTULO GLOBAL: `dev-evidence`.** Todos os números abaixo foram minerados dos logs de
> dev do Vite (`/tmp/opencode/vite-dev.log` e `/tmp/opencode/vite-dev-after.log`), com o
> MESMO método do baseline S0. Log de dev ≠ produção; nenhum valor aqui é SLO e nenhuma
> afirmação de produção pode ser derivada deste documento.

- Fonte BEFORE: `/tmp/opencode/vite-dev.log` (stdout de `vite dev`, VITE v8.2.2)
  - Arquivo completo: `2026-08-29T19:05:14.505Z` → `2026-08-30T02:22:12.142Z`
    (160 `request.completed`, 69 `app.context_tx`, 5 `request.failed`).
  - **Janela aceita/minerada (idêntica ao baseline S0): `2026-08-29T19:05:14.505Z` →
    `2026-08-29T23:54:46.626Z`** (34 `request.completed`, 0 `app.context_tx`). A mineração
    desta janela reproduz a tabela do baseline valor a valor.
  - **Janela B (descoberta nesta re-mineração, EXCLUÍDA do comparativo):**
    `2026-08-30T00:35Z` → `02:22:12Z` — sessão intermediária das ondas, com
    instrumentação `app.context_tx` já ativa e código em transição (ver §7).
- Fonte AFTER: `/tmp/opencode/vite-dev-after.log` (sessão nova de dev server pós-refatoração)
  - Janela (UTC) sessão principal pré-patch: `2026-08-30T02:27:29.125Z` →
    `2026-08-30T02:46:10.650Z` (235 `request.completed`, 81 `app.context_tx`).
  - **Janela pós-patch (append ao mesmo arquivo):** `2026-08-30T03:24:29.426Z` →
    `03:33:58.830Z` (112 `request.completed`, 36 `app.context_tx`) — tráfego Playwright
    real de verificação após o patch pós-S4 do bug UNION (§4.1). Arquivo total:
    347 `request.completed`, 117 `app.context_tx`, 29 `request.failed`.
  - Protocolo idêntico ao before: navegação real Playwright autenticada
    (`qa.local.admin@preco-que-da.test`), circuito
    `/inicio→/produtos→/precos→/ponto-equilibrio→/despesas→/simulacoes`
    (24 shells de rota = 6 rotas × 4 passes na sessão principal; 3× verificação
    pós-patch em `/produtos` e `/precos`).
- Eventos: `request.completed` (JSON com timestamp/method/pathname/status/durationMs);
  `app.context_tx` (instrumentação S1: `{round_trips, outcome, duration_ms}` por transação).
- Server functions aparecem como `/_serverFn/<base64>`; base64 decodificado para
  `{file, export}`, reportado sem o sufixo `_createServerFn_handler`.
- Método de percentil: interpolação linear (estilo numpy `linear`). **Atenção:** n é
  pequeno (0–40 amostras por endpoint); p95 é estatisticamente frágil e só serve como
  referência comparativa before/after dentro deste mesmo regime de dev.

## 1. p50/p95 por endpoint — AFTER (dev-evidence)

| endpoint                                               | n   | p50 (ms) | p95 (ms) | max (ms) | status                                                |
| ------------------------------------------------------ | --- | -------- | -------- | -------- | ----------------------------------------------------- |
| `/_serverFn` getDashboardSummary                       | 4   | 5215     | 6257     | 6435     | 200×4                                                 |
| `/_serverFn` listProductsWithMetrics (**n pós-patch**) | 4   | 2463     | 2638     | 2639     | 200×4 (janela pós-patch 03:33; histórico 503 no §4.1) |
| `/_serverFn` listExpenses                              | 12  | 3165     | 3565     | 3684     | 200×12                                                |
| `/_serverFn` listPurchasePrices (**n pós-patch**)      | 6   | 2834     | 3277     | 3352     | 200×6 (janelas pós-patch 03:25–03:26 e 03:33)         |
| `/_serverFn` calculateBreakEven                        | 0   | —        | —        | —        | sem amostras (não chamado por navegação)              |
| `/_serverFn` runSimulation                             | 0   | —        | —        | —        | sem amostras (rota não exercitada com inputs)         |
| `/api/auth/get-session`                                | 40  | 2385     | 3573     | 4258     | 200×40                                                |
| `/api/auth/sign-in/email`                              | 5   | 2759     | 3119     | 3158     | 200×3, 400×2 (+403×1 excluído, §5)                    |
| `/auth` (GET)                                          | 11  | 9        | 61       | 105      | 200×11                                                |
| `/api/vitals` (POST)                                   | 121 | 1        | 2        | 4        | 204×121                                               |

> As duas linhas **n pós-patch** contêm SOMENTE amostras 200 (o bug dos 503 foi
> corrigido pelo patch pós-S4, §4.1); nenhuma amostra 503 entra em p50/p95 — as 15
> falhas 503 (12 pré-patch + 3 intermediárias em 03:24–03:26) ficam citadas como
> histórico do bug no §4.1. Demais endpoints: janela principal pré-patch
> (02:27:29Z→02:46:10Z).

Amostras brutas AFTER (timestamp UTC, durationMs):

- `getDashboardSummary`: 02:37:43→5181; 02:39:59→6435; 02:42:12→4138; 02:44:27→5249
- `listProductsWithMetrics` — amostras 200 (pós-patch, janela 03:33Z): 03:33:25→1650;
  03:33:36→2295; 03:33:49→2631; 03:33:58→2639. (Histórico do bug: 503×12 pré-patch
  02:37:49→2715 … 02:46:10→3046 e 503×3 intermediárias 03:24–03:26 — §4.1)
- `listExpenses`: 02:38:49→3439; 02:39:20→3392; 02:39:25→2609; 02:41:06→3684;
  02:41:36→3001; 02:41:42→2799; 02:43:18→3188; 02:43:49→3322; 02:43:55→2634;
  02:45:33→3467; 02:46:04→3142; 02:46:10→2724
- `listPurchasePrices` — amostras 200 (pós-patch): 03:25:13→2626; 03:25:51→3052;
  03:26:29→2538; 03:33:31→3042; 03:33:43→3352; 03:33:53→1576. (Histórico do bug:
  503×4 pré-patch 02:38:21→2693 … 02:45:05→2727 — §4.1)
- `calculateBreakEven`: **nenhuma ocorrência no log** — confirmado por busca textual
  (zero chamadas; o cálculo passou a ser client-side e nenhum snapshot foi persistido
  na sessão)
- `runSimulation`: **nenhuma ocorrência no log** — o Playwright navegou `/simulacoes`
  mas não exercitou inputs de simulação (lacuna registrada, não estimada)
- `get-session`: 02:27:34→2380; 02:27:55→1925; 02:30:47→2523; 02:30:50→1911;
  02:30:53→1435; 02:30:56→2030; 02:30:58→1416; 02:31:01→1550; 02:33:36→2131;
  02:34:33→2524; 02:35:01→2721; 02:35:26→2137; 02:35:50→2002; 02:37:07→2264;
  02:37:13→1881; 02:37:33→2603; 02:37:40→2928; 02:37:46→1888; 02:38:18→3230;
  02:38:48→2731; 02:39:20→3506; 02:39:23→1366; 02:39:56→4169; 02:40:02→2389;
  02:40:35→4258; 02:41:04→2547; 02:41:36→3055; 02:41:39→1754; 02:42:10→2354;
  02:42:15→1356; 02:42:47→2678; 02:43:18→3250; 02:43:49→2977; 02:43:53→2091;
  02:44:24→3040; 02:44:30→2182; 02:45:02→2759; 02:45:33→3542; 02:46:04→3205;
  02:46:07→1850
- `sign-in/email` (sem o 403): 02:30:23→2759 (200); 02:35:01→2716 (400); 02:35:27→3158
  (400); 02:37:11→2963 (200); 02:37:37→2299 (200)

### 1.1 Shells de rota — AFTER (novos no método; loaders não-bloqueantes S3)

| rota (GET)          | n   | p50 (ms) | p95 (ms) | max (ms) | status |
| ------------------- | --- | -------- | -------- | -------- | ------ |
| `/inicio`           | 4   | 6        | 7        | 7        | 200×4  |
| `/produtos`         | 4   | 4        | 4        | 4        | 200×4  |
| `/precos`           | 4   | 4        | 6        | 6        | 200×4  |
| `/ponto-equilibrio` | 4   | 4        | 5        | 5        | 200×4  |
| `/despesas`         | 4   | 5        | 5        | 5        | 200×4  |
| `/simulacoes`       | 4   | 5        | 5        | 5        | 200×4  |

**Sem amostras before na janela aceita** (a sessão before não navegou por shells de rota);
a comparação de shells é qualitativa: 24/24 respostas em 3–7ms com loaders
não-bloqueantes + `pendingComponent`.

## 2. Comparativo before/after por endpoint (dev-evidence)

Before = janela aceita do baseline S0 (19:05:14Z→23:54:46Z); After = sessão completa
02:27:29Z→02:46:10Z, sem as contaminações do §5.

| endpoint                | n before | p50/p95/max before (ms) | n after       | p50/p95/max after (ms) | Δ p50                     | status before → after     |
| ----------------------- | -------- | ----------------------- | ------------- | ---------------------- | ------------------------- | ------------------------- |
| getDashboardSummary     | 2        | 5657 / 6004 / 6043      | 4             | 5215 / 6257 / 6435     | −7,8%                     | 200×2 → 200×4             |
| listProductsWithMetrics | 5        | 4935 / 6358 / 6614      | 4 (pós-patch) | 2463 / 2638 / 2639     | **−50,1%**                | 200×5 → 200×4 (pós-patch) |
| listExpenses            | 5        | 3409 / 5108 / 5155      | 12            | 3165 / 3565 / 3684     | −7,2%                     | 200×5 → 200×12            |
| listPurchasePrices      | 1        | 3873 / 3873 / 3873      | 6 (pós-patch) | 2834 / 3277 / 3352     | **−26,8%**                | 200×1 → 200×6 (pós-patch) |
| calculateBreakEven      | 1        | 4608 / 4608 / 4608      | 0             | —                      | **saída do caminho** (§4) | 200×1 → 0 chamadas        |
| get-session             | 12       | 2316 / 3345 / 3436      | 40            | 2385 / 3573 / 4258     | **+3,0%**                 | 200×12 → 200×40           |
| sign-in/email           | 3        | 2909 / 3173 / 3202      | 5             | 2759 / 3119 / 3158     | −5,2%                     | 200×2,401×1 → 200×3,400×2 |
| /auth                   | 1        | 204 / 204 / 204         | 11            | 9 / 61 / 105           | −95,6% (n=1 before)       | 200×1 → 200×11            |
| /api/vitals             | 4        | 1 / 2 / 2               | 121           | 1 / 2 / 4              | estável                   | 204×4 → 204×121           |

**Fator de confundimento entre sessões (medição, não promessa):** a latência por RT Neon
varia entre sessões. Evidência interna: `listExpenses` com o MESMO rt=6/tx mediu
transações de ~730–790ms na janela B (§7) e ~1330–1740ms na sessão after; `get-session`
max subiu de 3436 (before) para 4258 (after). Deltas de latência across-sessions são
portanto conservadores; **RT-count é a métrica robusta** (§3).

## 3. RT-count por server function (instrumentação S1 — only-after)

O log BEFORE (janela aceita) não contém `app.context_tx` (instrumentação não existia) —
RT-count before permanece não-observável, como registrado no baseline.

### 3.1 Tabela estática do S1 (design-time)

| função                                               | before (S1)      | after (S1)       | Δ RTs (estimativa S1 @0,5s/RT)  |
| ---------------------------------------------------- | ---------------- | ---------------- | ------------------------------- |
| requireDatabaseAuth (preamble de qualquer server fn) | 2 tx / 7+q stmts | 1 tx / 5+q stmts | consolidação em transação única |
| /produtos (total)                                    | 12 stmts / 2 tx  | 7 stmts / 1 tx   | −5 RTs ≈ −2,5s                  |
| /precos (total)                                      | 10 stmts         | 7 stmts          | −3 RTs ≈ −1,5s                  |

### 3.2 Medição AFTER (`app.context_tx`, n=81)

| valor `round_trips` | ocorrências | outcome                | atribuição (por adjacência temporal com `request.completed`)        |
| ------------------- | ----------- | ---------------------- | ------------------------------------------------------------------- |
| 4                   | 48          | commit 48 / rollback 0 | transação de sessão (get-session / sign-in)                         |
| 6                   | 12          | commit 12 / rollback 0 | listExpenses (12 chamadas 200)                                      |
| 7                   | 16          | commit 0 / rollback 16 | listProductsWithMetrics (12×) + listPurchasePrices (4×)             |
| 11                  | 5           | commit 5 / rollback 0  | getDashboardSummary (4× 200 + 1× request abortado cuja tx concluiu) |

Agregados (n=81): média **5,32 RT/tx**; p50 **4**; p95 **11** (interpolação linear);
outcome: 65 commit / 16 rollback. Duração da tx: commit média 1251ms (p50 1042 / p95 2614);
rollback média 1901ms (p50 1943 / p95 2050).

**Confirmação da tabela S1 pela medição:** `/produtos` e `/precos` mediram **7 RTs/tx**
(bate com 12→7 e 10→7 do S1; os −5/−3 RTs são confirmação direta — nas falhas
pré-patch a transação terminava em rollback, no pós-patch termina em commit).
`/inicio` (getDashboardSummary) mediu **11 RTs/tx** — o S1 não declarou redução para
esta função e a latência não caiu de forma material (§4). listExpenses mediu 6 RTs/tx.

**Medição pós-patch (`app.context_tx`, janela 03:24:29Z→03:33:58Z, n=36):**
histograma `{4: 22 commit, 7: 14 (10 commit / 4 rollback)}` — os 4 rollbacks de
rt=7 são o resquício intermediário (03:24–03:26, enquanto o patch era aplicado);
a partir de 03:33 todos os rt=7 são **commit** com as duas server functions
retornando 200 — o read-model UNION ALL funciona em 7 RTs/tx em sucesso, fechando
a confirmação da tabela S1.

## 4. O que caiu, o que não caiu, o que regrediu (medição, não promessa)

**CAIU (medido):**

- **Shells de rota 3–7ms** (24/24, §1.1) com loaders não-bloqueantes + `pendingComponent` (S3).
- **listExpenses**: p50 3409→3165 (−7,2%), p95 5108→3565 (−30,2%), max 5155→3684 (−28,5%),
  12/12 sucessos com rt=6/tx.
- **calculateBreakEven saiu do caminho de navegação** (S3, cálculo client-side): 1 chamada
  de 4608ms no before → **0 chamadas** no after (nota de método: sem persistência de
  snapshot na sessão, não há amostra server-side — não se estima ganho).
- **RT-count /produtos e /precos**: 7 RTs/tx medidos, confirmando −5 e −3 RTs do S1.
- **/auth**: p50 204→9ms (n=1 before — comparação frágil).

**NÃO CAIU (medido):**

- **get-session**: p50 2316→2385 (+3,0%), p95 3345→3573. O imposto de sessão permanece:
  ADR-020 mantida e o cookie cache de sessão é o T3 do S1 — **BLOCKED_ON_ADR**
  (ADR-025 PROPOSED/PENDING). O waterfall persiste: 40 get-session na sessão
  (~1 por navegação) e cada server fn continua abrindo transação com preamble de 4 RTs.
- **getDashboardSummary (/inicio)**: p50 5657→5215 (−7,8%, n=2→4) e p95/max SUBIRAM
  (6004→6257 / 6043→6435). Sem queda material; o S1 não declarou redução de RT para
  /inicio e o rt=11/tx medido é o mais alto do sistema.
- **sign-in/email**: ≈ estável (2909→2759 p50).

**REGREDIU (observado — **CORRIGIDO no patch pós-S4**, §4.1; registro histórico):**

- **listProductsWithMetrics: 0/12 sucessos** na sessão principal (503×12). Erro:
  `bff.request_failed` → `Error: Failed query: (select 1 as "branch", … union all …)` —
  o wrapper Drizzle do read-model UNION ALL do S1-T2.
- **listPurchasePrices: 0/4 sucessos** na sessão principal (503×4). Erro:
  `TypeError: row.priceUpdatedAt?.toISOString is not a function` — serialização do
  branch `null` do UNION ALL sob o driver de dev contra Neon remoto
  (`src/lib/products.functions.ts`).
- O padrão **já ocorria na janela B do log before** (13× 503 a partir de 01:05:05Z,
  assim que o read-model UNION ALL entrou no dev server) — não é artefato da sessão after.
- Os gates verdes (vitest 315/315, golden 5/5, build) exercitaram o código contra driver
  local de teste e NÃO capturaram este caminho de runtime dev contra Neon remoto
  (causa-raiz e lição de cobertura no §4.1).

### 4.1 Patch pós-S4 (bug UNION) — authorized_orchestrator_post_s4

- **Causa-raiz confirmada contra o Neon:** `UNION types text and numeric cannot be
matched` — os bare `null` acumulados nos branches esquerda do UNION ALL resolvem
  como `text` e colidem com o `numeric` do branch fee. Passava nos testes locais
  porque node-postgres/golden-fake nunca executou o UNION real (ver lição abaixo).
- **Fix aplicado pelo orquestrador em `src/lib/products.functions.ts`:**
  (i) casts explícitos nos 36 placeholders null (`null::text|numeric|timestamptz`
  conforme a coluna); (ii) `normalizeChildRow` em `loadChildRows` — `execute()` não
  aplica os decoders do Drizzle e o neon-serverless devolve `timestamptz` como string
  (paridade entre drivers; elimina o `TypeError` de serialização).
- **Lição de cobertura:** golden test com fake transaction não executa SQL real —
  cobertura contra Neon exige teste de integração com Postgres real para o read-model
  UNION (recomendação registrada ao próximo agente).
- **Verificação (200 confirmado):** tráfego Playwright real pós-patch
  (janela 03:24:29Z→03:33:58Z) — `listProductsWithMetrics` 200×4
  (03:33:25→1650; 03:33:36→2295; 03:33:49→2631; 03:33:58→2639) e
  `listPurchasePrices` 200×6 (03:25:13→2626 … 03:33:53→1576), com `app.context_tx`
  rt=7 **commit**; UI renderizada ("1 produto cadastrado | Produto de teste | REAL |
  Custo: R$ 10,00…"). Resquício: 3× 503 intermediárias em 03:24–03:26 enquanto o
  patch era aplicado (histórico, não entra em p50/p95).
- **Efeito medido:** com o bug corrigido, o comparativo passa a ser válido (§2):
  listProductsWithMetrics p50 4935→2463 (**−50,1%**) e listPurchasePrices
  3873→2834 (**−26,8%**) — os −5/−3 RTs do S1 materializados em latência.

## 5. Contaminação do log AFTER (EXCLUÍDA do p50/p95, citada como nota)

- **24× `request.failed` "Invalid server function ID"** (02:30:47Z–02:31:01Z): tentativas
  curl com IDs de server fn antigos (base64 de `listProductsWithMetrics`, `listExpenses`,
  `getDashboardSummary`, `listPurchasePrices` das versões pré-refatoração). Não são
  `request.completed` e ficariam fora do método de qualquer forma; citadas por contrato.
- **1× sign-in/email 403** (02:28:26→2088ms): origem não-confiável via IP de LAN
  (browser MCP; Better Auth "Invalid origin: http://192.168.3.89:8080"). Excluído do
  p50/p95 de sign-in (n=5 remanescente).
- Adicionalmente, 3× `request.failed` "aborted" (get-session ×2, getDashboardSummary ×1)
  são aborts de cliente — fora do método (`request.completed`); o `getDashboardSummary`
  abortado teve sua transação concluída (rt=11 commit em 02:37:17) e não conta como
  amostra do endpoint. Na janela pós-patch, 2× `request.failed` "aborted" em
  get-session (03:24:36Z, 03:33:20Z) — mesmo tratamento, fora do método.

## 6. Lacunas de amostragem (registro honesto, sem estimativa)

1. **runSimulation: 0 amostras** no after — o Playwright navegou `/simulacoes` mas não
   exercitou inputs de simulação. Sem baseline before também (rota não exercitada no S0).
2. **calculateBreakEven: 0 amostras** no after — esperado por design (cálculo client-side);
   nenhuma persistência de snapshot ocorreu na sessão.
3. **listPurchasePrices before n=1** — comparação before/after estatisticamente frágil.
4. **Shells de rota sem baseline before** na janela aceita.
5. **LCP RUM after**: p50 4436ms / p95 6588ms (n=29 `rum.web_vitals` LCP na sessão
   principal; ratings predominantly poor nas páginas autenticadas) — sem baseline
   before de LCP; contexto qualitativo de que o waterfall de sessão ainda domina a
   percepção. Contexto pós-patch: LCP n=14 com p50 2538ms em `/produtos`/`/precos`
   (mín 116ms, máx 6044ms) — melhora qualitativa com os dados carregando, sem
   baseline comparável.

## 7. Janela B descoberta no log before (não aceita; registrada por honestidade)

O arquivo `/tmp/opencode/vite-dev.log` contém, além da janela aceita do S0, tráfego de
`2026-08-30T00:35Z` → `02:22:12Z` (126 `request.completed`, 69 `app.context_tx`, 5
`request.failed` "aborted", páginas `/diagnostico` n=16) que o baseline S0 não declarou.
Características medidas dessa janela: histograma `app.context_tx` `{4:36, 6:16, 7:13,
8:1, 10:3}` (formas intermediárias — código em transição durante as ondas);
`listProductsWithMetrics` 200×7 + **503×13** (o mesmo "Failed query" do UNION ALL, a
partir de 01:05:05Z); `listExpenses` 200×20 com p50 ~1.6s e rt=6. Esta janela não é
"before" limpo (instrumentação/refatoração já parcialmente ativas) nem a sessão after;
fica excluída do comparativo e registra que o padrão de falha do read-model antecede a
sessão after.

## 8. Limitações

1. `dev-evidence`: single-user, single-process, Vite dev (sem build de produção), Neon
   remoto. Latências absolutas não extrapolam para produção.
2. n baixo por endpoint (0–40); p95 frágil; usar só para comparação before/after.
3. RT-count before não observável (sem instrumentação na janela aceita); o comparativo
   RT-count usa a tabela estática do S1 como "before" e a medição `app.context_tx` como
   "after".
4. Confundimento de latência entre sessões (Neon RT latência variável — §2).
5. **[RESOLVIDO no patch pós-S4]** a causa das falhas 503 do §4 era indeterminável pelo
   log (mensagem truncada em 2000 chars); confirmada pelo orquestrador contra o Neon e
   corrigida — ver §4.1.
6. `/simulacoes` sem exercício de inputs (runSimulation sem amostras nos dois lados).

## 9. Nota de verificação (atualizada pós-patch)

Verificação S4 original (2026-08-30 ~00:15 local): test 315/315 PASS, typecheck PASS,
build PASS, **lint FAIL** (2 erros prettier pré-existentes) → handoff PARTIAL.

**Reverificação após os patches do orquestrador (authorized_orchestrator_post_s4):**

1. **Lint fix:** `npx eslint --fix` em `src/lib/query-options.ts:16` e
   `src/routes/_authenticated/ponto-equilibrio.tsx:37` (formatação prettier dos
   desvios 3/S3). Causa do falso "lint 0" nos gates anteriores: exit code mascarado
   por pipe no orquestrador — reconhecido como falha de processo do orquestrador,
   não dos agentes.
2. **Bug dos 503 corrigido** em `src/lib/products.functions.ts` (§4.1).
3. **Gates re-executados pelo orquestrador (exit codes SEM pipe, confiáveis):**
   test 315/315 (31 arquivos), lint 0, typecheck 0, build 0, check-bundle PASS
   (entry 272.380 min/84.802 gzip; graph 467.625 min/148.837 gzip).
4. **Reverificação final S4 (T3, exit codes sem pipe):** registrada no handoff
   S4-CLOSE final (test/lint/typecheck/build).

## Bloco §35 — contrato de evidência de performance

> Acrescentado no WP-1c (2026-09-16) para que este artefato cumpra o contrato de §35
> **sem isenção de legado**. Nenhuma linha de §1–§9 mudou: nenhum número, tabela, janela,
> amostra ou nota de contaminação foi removido. Os rótulos abaixo citam o que já está
> medido neste arquivo; o que os logs brutos não permitem re-derivar sai `N/A` com a
> lacuna declarada — nada aqui foi estimado.

### Cabeçalho obrigatório

- **ambiente:** `dev-evidence` — `vite dev` (VITE v8.2.2) single-user/single-process
  contra Neon remoto, com instrumentação S1 (`app.context_tx`) ativa no after. Não é
  produção e nenhum valor aqui sustenta SLO.
- **método:** idêntico ao baseline S0 — mineração de `request.completed` (JSON com
  `timestamp/method/pathname/status/durationMs`), server functions como
  `/_serverFn/<base64>` decodificado para `{file, export}`, percentil por interpolação
  linear — acrescido de `app.context_tx` (`{round_trips, outcome, duration_ms}` por
  transação, instrumentação S1) e de navegação real Playwright autenticada no circuito
  `/inicio→/produtos→/precos→/ponto-equilibrio→/despesas→/simulacoes`.
- **n:** 0–40 amostras por endpoint de `request.completed` (§1) e n=81 `app.context_tx`
  na sessão principal + n=36 na janela pós-patch (§3.2); LCP RUM n=29 na sessão
  principal + n=14 pós-patch (§6.5).
- **janela:** before = janela aceita de S0, `2026-08-29T19:05:14.505Z` →
  `2026-08-29T23:54:46.626Z` (UTC); after = sessão principal
  `2026-08-30T02:27:29.125Z` → `2026-08-30T02:46:10.650Z` + janela pós-patch
  `2026-08-30T03:24:29.426Z` → `03:33:58.830Z` (mesmo arquivo, append), com a janela B
  do log before (`00:35Z`→`02:22:12Z`) **excluída** do comparativo (§7).
- **fonte:** `/tmp/opencode/vite-dev.log` e `/tmp/opencode/vite-dev-after.log` —
  **não versionadas** (gitignored e hoje indisponíveis): os números são a transcrição da
  mineração feita à época e **não são re-deriváveis** a partir do repositório (ver lacuna
  em `result` e `decision`).

### Campos §35

- **hypothesis:** as refatorações das ondas PERF/FIN — S1 (transação única por server
  function + instrumentação `app.context_tx`) e S3 (loaders não-bloqueantes +
  `pendingComponent`) — cortam RTs por server function e o p50/p95 dos endpoints-chave
  (`listProductsWithMetrics`, `listPurchasePrices`) no mesmo regime `dev-evidence`, sem
  mexer no imposto de sessão (ADR-020) e sem regressão nos endpoints não tocados.
- **metric:** métrica primária: **RT-count por server function**
  (`app.context_tx.round_trips`) — §2 declara ser a métrica robusta entre sessões;
  secundárias: p50/p95/max ms por endpoint (`request.completed.durationMs`), latência de
  transação por `outcome` (commit/rollback) e LCP RUM. RT-count **before**: `N/A` — a
  instrumentação não existia na janela aceita (§3); o "before" de RT é a tabela estática
  de design do S1 (§3.1), que é **estimativa**, não medição.
- **before:** janela aceita do baseline S0 — fonte
  `docs/evidence/perf-baseline-2026-08-29.md` §1 (transcrita no comparativo §2 deste
  arquivo), p50/p95/max ms: getDashboardSummary
  5657/6004/6043 (n=2); listProductsWithMetrics 4935/6358/6614 (n=5); listExpenses
  3409/5108/5155 (n=5); listPurchasePrices 3873/3873/3873 (n=1); calculateBreakEven
  4608/4608/4608 (n=1); `/api/auth/get-session` 2316/3345/3436 (n=12);
  `/api/auth/sign-in/email` 2909/3173/3202 (n=3); `/auth` 204/204/204 (n=1);
  `/api/vitals` 1/2/2 (n=4). RT-count before: `N/A` (§3).
- **change:** S1 (transação única + instrumentação `app.context_tx`) e S3 (loaders
  não-bloqueantes + `pendingComponent`) das ondas PERF/FIN, mais o patch pós-S4 do bug
  UNION (§4.1): casts explícitos `null::text|numeric|timestamptz` nos 36 placeholders e
  `normalizeChildRow` em `src/lib/products.functions.ts`.
- **after:** mesma sessão after, mesmo regime (§1–§3) — p50/p95 ms: listProductsWithMetrics
  2463/2638 (n=4, somente amostras 200 pós-patch); listPurchasePrices 2834/3277 (n=6,
  pós-patch); listExpenses 3165/3565 (n=12); getDashboardSummary 5215/6257 (n=4);
  `/api/auth/get-session` 2385/3573 (n=40); `/api/auth/sign-in/email` 2759/3119 (n=5);
  `/auth` 9/61 (n=11); `/api/vitals` 1/2 (n=121); calculateBreakEven n=0 (saiu do caminho
  de navegação, §4). RT-count medido (`app.context_tx`, n=81): média 5,32 RT/tx, p50 4,
  p95 11 (65 commit / 16 rollback), com **7 RTs/tx em `/produtos` e `/precos`** (commit)
  confirmando os −5/−3 RTs do S1; janela pós-patch (n=36) repete rt=7 em commit. LCP RUM:
  p50 4436 / p95 6588 ms (n=29) na sessão principal; p50 2538 ms (n=14) pós-patch em
  `/produtos`/`/precos`.
- **result:** **caiu em parte, não caiu em parte, e regrediu — corrigido** (§4, medição,
  não promessa). Caiu: listProductsWithMetrics p50 4935→2463 (**−50,1%**, pós-patch),
  listPurchasePrices p50 3873→2834 (**−26,8%**, pós-patch), listExpenses p95
  5108→3565 (**−30,2%**) e 12/12 com rt=6/tx, shells de rota 3–7 ms (24/24, §1.1),
  calculateBreakEven fora do caminho (1→0 chamadas). Não caiu: `/api/auth/get-session`
  p50 2316→2385 (**+3,0%**) — imposto de sessão, ADR-020 mantida e cookie cache em
  ADR-025 `BLOCKED_ON_ADR`; getDashboardSummary sem queda material (p95/max subiram,
  rt=11/tx é o maior do sistema). Regrediu: 503×12 em listProductsWithMetrics e 503×4 em
  listPurchasePrices pelo bug do UNION ALL, **corrigido** no patch pós-S4 (§4.1) e
  reverificado com 200×4 / 200×6 em rt=7 commit. Confundidor declarado: a latência por RT
  Neon varia entre sessões (§2), logo os deltas de latência são conservadores e o
  RT-count é a leitura robusta. Lacunas (registradas, não estimadas): `runSimulation` n=0
  e `calculateBreakEven` n=0 no after; listPurchasePrices before n=1; shells sem baseline
  before; LCP sem baseline before; RT-count before não observável.
- **decision:** `follow-up` — os números medidos não sustentam `keep` por si: regime
  `dev-evidence` (single-user, sem build de produção) e fontes em `/tmp` **não
  versionadas** ⇒ não re-deriváveis (o contrato de §35 só admite `keep` com fonte
  versionada e re-derivável). Próximos passos declarados: (1) re-baseline sob regime
  `CONTROLLED` com raw versionado — entregue em
  `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md`; (2) cobertura de integração
  contra Postgres real para o read-model UNION (§4.1, lição registrada); (3) `get-session`
  / cookie cache segue `BLOCKED_ON_ADR` (ADR-025 PROPOSED).
