# Baseline de performance — 2026-08-29 (F0-04, ONDA 0 / S0-BASELINE)

> **RÓTULO GLOBAL: `dev-evidence`.** Todos os números abaixo foram minerados do log de
> dev do Vite (`/tmp/opencode/vite-dev.log`). Log de dev ≠ produção; nenhum valor aqui
> é SLO e nenhuma afirmação de produção pode ser derivada deste documento.

- Fonte: `/tmp/opencode/vite-dev.log` (stdout de `vite dev`, VITE v8.2.2)
- Janela de timestamp (UTC): `2026-08-29T19:05:14.505Z` → `2026-08-29T23:54:46.626Z`
- Eventos: `request.completed` (JSON com timestamp/method/pathname/status/durationMs)
- Server functions aparecem como `/_serverFn/<base64>`; base64 decodificado para
  `{file, export}` (ex.: `/src/lib/dashboard.functions.ts?tss-serverfn-split` +
  `getDashboardSummary_createServerFn_handler` → reportado sem o sufixo handler).
- Método de percentil: interpolação linear (estilo numpy `linear`). **Atenção:** n é
  pequeno (1–12 amostras por endpoint); p95 é estatisticamente frágil e só serve como
  referência comparativa before/after dentro deste mesmo regime de dev.

## 1. p50/p95 por endpoint (dev-evidence)

| endpoint                             | n   | p50 (ms) | p95 (ms) | max (ms) | status       |
| ------------------------------------ | --- | -------- | -------- | -------- | ------------ |
| `/_serverFn` getDashboardSummary     | 2   | 5657     | 6004     | 6043     | 200          |
| `/_serverFn` listProductsWithMetrics | 5   | 4935     | 6358     | 6614     | 200          |
| `/_serverFn` listExpenses            | 5   | 3409     | 5108     | 5155     | 200          |
| `/_serverFn` listPurchasePrices      | 1   | 3873     | 3873     | 3873     | 200          |
| `/_serverFn` calculateBreakEven      | 1   | 4608     | 4608     | 4608     | 200          |
| `/api/auth/get-session`              | 12  | 2316     | 3345     | 3436     | 200          |
| `/api/auth/sign-in/email`            | 3   | 2909     | 3173     | 3202     | 200×2, 401×1 |
| `/auth` (GET)                        | 1   | 204      | 204      | 204      | 200          |
| `/api/vitals` (POST)                 | 4   | 1        | 2        | 2        | 204          |

Amostras brutas (timestamp UTC, durationMs):

- `getDashboardSummary`: 20:08:50→6043; 20:15:14→5271
- `listProductsWithMetrics`: 20:10:06→4935; 20:14:56→5334; 20:16:01→2104; 20:17:11→2917; 23:54:46→6614
- `listExpenses`: 20:11:44→3409; 20:14:55→4922; 20:16:00→1943; 20:17:10→2363; 23:54:45→5155
- `listPurchasePrices`: 20:10:13→3873
- `calculateBreakEven`: 20:14:55→4608
- `get-session`: 2705, 2133, 1641, 2400, 1557, 1969, 2567, 1769, 3436, 3270, 2900, 2231 (20:08:21→20:15:58)
- `sign-in/email`: 19:05:14→3202 (401, primeira tentativa com usuário inexistente); 19:20:23→1565 (200); 20:08:41→2909 (200)

## 2. RT-count por server function

O log de dev **não contém spans `app.db.duration`** (0 ocorrências; verificado por
busca textual no arquivo inteiro, incluindo variações `db.duration`/`span`).

**RT-count: derivável apenas no after (instrumentação S1)** — nenhum número de RT é
estimado aqui por não haver medição no log.

O que o log suporta qualitativamente (dev-evidence, consistente com o diagnóstico
aceito de taxa fixa de ~8–10 RTs Neon a ~0,5s/RT por server function):

- `get-session` custa 1,6–3,4s por chamada mesmo sem payload — coerente com 2+ RTs
  de validação de sessão no PostgreSQL (cookie cache desabilitado, deliberado por
  ADR-020; ver ADR-025 draft).
- `calculateBreakEven` (0 queries, controle) = 4608ms vs `listExpenses` (1 query) =
  3409–5155ms: o piso de ~4,6s não é database, é o custo fixo de invocação/RTs,
  confirmando o controle do diagnóstico.

## 3. Waterfalls de navegação observados (dev-evidence)

Padrão recorrente: um `get-session` (~2–3s) precede cada server function da página
(data em UTC):

- `20:11:40` get-session 3436ms → `20:11:44` listExpenses 3409ms
- `20:14:50` get-session 3270ms → `20:14:55` calculateBreakEven 4608ms → `20:14:55`
  listExpenses 4922ms → `20:14:56` listProductsWithMetrics 5334ms (três queries em
  série na mesma página, sem sobreposição)
- `23:54:45` listExpenses 5155ms → `23:54:46` listProductsWithMetrics 6614ms (em série)

## 4. Snapshot "before" dos endpoints-chave (dev-evidence)

Mapeamento rota → server function (lido de `src/routes/_authenticated/` e
`src/lib/query-options.ts`, somente leitura):

| rota                   | server function                                                            | n          | p50 (ms) | p95 (ms) | janela de timestamp (UTC) |
| ---------------------- | -------------------------------------------------------------------------- | ---------- | -------- | -------- | ------------------------- |
| `/produtos`            | listProductsWithMetrics                                                    | 5          | 4935     | 6358     | 20:10:06 → 23:54:46       |
| `/precos`              | listPurchasePrices                                                         | 1          | 3873     | 3873     | 20:10:13                  |
| `/ponto-equilibrio`    | calculateBreakEven (+ listExpenses, listProductsWithMetrics na mesma tela) | 1 (+5, +5) | 4608     | 4608     | 20:14:50 → 23:54:46       |
| `/simulacoes`          | runSimulation                                                              | **0**      | —        | —        | sem amostras no log       |
| `/despesas`            | listExpenses                                                               | 5          | 3409     | 5108     | 20:11:44 → 23:54:45       |
| `/inicio` (referência) | getDashboardSummary                                                        | 2          | 5657     | 6004     | 20:08:50 → 20:15:14       |

Nota sobre `/simulacoes`: `runSimulation` não aparece no log na janela minerada —
rota não exercitada nesta sessão de dev. Registro honesto: sem baseline before.

## 5. Reconfirmação dos dados de referência do orquestrador

Re-derivado do log, valor a valor (todos confirmam):

| referência orquestrador                  | re-derivado                                       | ✓   |
| ---------------------------------------- | ------------------------------------------------- | --- |
| getDashboardSummary 6043ms / 5271ms      | 6043 (20:08:50); 5271 (20:15:14)                  | ✓   |
| listProductsWithMetrics 5334/4935/2917ms | 5334 (20:14:56); 4935 (20:10:06); 2917 (20:17:11) | ✓   |
| listExpenses 4922/3409ms                 | 4922 (20:14:55); 3409 (20:11:44)                  | ✓   |
| calculateBreakEven 4608ms                | 4608 (20:14:55)                                   | ✓   |
| listPurchasePrices 3873ms                | 3873 (20:10:13)                                   | ✓   |
| /api/auth/get-session 3436/3270ms        | 3436 (20:11:40); 3270 (20:14:50)                  | ✓   |
| sign-in/email 2909ms                     | 2909 (20:08:41, status 200)                       | ✓   |

Amostras adicionais presentes no log além da lista do orquestrador (incluídas acima):
listProductsWithMetrics 2104/6614ms; listExpenses 1943/2363/5155ms; get-session ×12
na janela; sign-in/email 3202ms (401) e 1565ms (200).

## 6. Limitações

1. `dev-evidence`: single-user, single-process, Vite dev (sem build de produção),
   Neon remoto. Latências absolutas não extrapolam para produção.
2. n baixo: p95 com n=1–5 é o máximo ou quase; usar só para comparação before/after.
3. Sem spans `app.db.duration` no log → RT-count não observável; instrumentação S1
   obrigatória para derivar RT-count no after.
4. `/simulacoes` sem amostras (rota não exercitada).
