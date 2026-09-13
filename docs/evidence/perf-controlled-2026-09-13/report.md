# Baseline de performance CONTROLADO

**Rótulo:** CONTROLADO — preview Nitro local (`node-server`) + PostgreSQL 17 em Docker;
**não** é produção, **não** usa o gateway real de IA e **não** consome M-06/Q-020.

- Gerado em: 2026-09-13T15:30:04.880Z
- Capturado em: 2026-09-13T15:25:17.161Z — 2026-09-13T15:28:49.451Z
- Commit: `42d4b76`
- Base URL: `http://127.0.0.1:4219`
- Iterações medidas: 5 por rota (warmup: 1)
- Playwright: {"browser":"chromium","version":"151.0.7922.34"}
- IA: {"enabled":true,"endpoint":"https://ai.gateway.lovable.dev/v1/chat/completions","latencyMs":35,"content":"Resposta mockada do baseline controlado F0-04."}

## Método

1. `npm run build` (preset `node-server`) e `npm run preview -- --host 127.0.0.1`; stdout do
   servidor capturado em `server-stdout.txt` (JSON lines `app.context_tx`, `ai.model_attempt`).
2. Fixture local via `npm run e2e:prepare` (migrations + seed determinístico).
3. Playwright (chromium) autenticado por Better Auth; por rota: warmup(s) descartado(s) e n amostras.
4. Tempo de prontidão = do `goto` até o marcador de dados da rota ficar visível (não apenas `load`).
5. Percentis por interpolação linear R-7: `rank = (p/100) × (n − 1)` entre as amostras ordenadas.
6. Query count/duração vêm de `app.context_tx` (round trips reais por transação) atribuídos à janela da rota.
7. Bundle copiado de `.artifacts/bundle-report.json` (saída de `check:bundle`).

Janela da captura: **2026-09-13T15:25:17.161Z → 2026-09-13T15:28:49.451Z**.

## 1. p50/p95 de rotas internas

Prontidão (dados visíveis) e TTFB, em ms:

| Rota                | n   | p50    | p95    | min    | max    |
| ------------------- | --- | ------ | ------ | ------ | ------ |
| `/diagnostico`      | 5   | 2476.0 | 2518.0 | 2439.0 | 2523.0 |
| `/inicio`           | 5   | 2490.0 | 2526.6 | 2448.0 | 2533.0 |
| `/ponto-equilibrio` | 5   | 2512.0 | 2519.2 | 2503.0 | 2521.0 |
| `/produtos`         | 5   | 2461.0 | 2477.0 | 2446.0 | 2479.0 |
| `/simulacoes`       | 5   | 2505.0 | 2556.0 | 2473.0 | 2568.0 |

TTFB (ms):

| Rota                | n   | p50 | p95 | min | max |
| ------------------- | --- | --- | --- | --- | --- |
| `/diagnostico`      | 5   | 4.6 | 5.8 | 3.5 | 6.1 |
| `/inicio`           | 5   | 4.0 | 6.1 | 3.8 | 6.4 |
| `/ponto-equilibrio` | 5   | 4.1 | 6.2 | 3.3 | 6.3 |
| `/produtos`         | 5   | 3.8 | 4.1 | 3.3 | 4.1 |
| `/simulacoes`       | 5   | 6.3 | 7.5 | 3.3 | 7.7 |

Latência dos server functions observada no browser (soma de respostas por amostra):

| Rota                | n   | p50  | p95  | min  | max  |
| ------------------- | --- | ---- | ---- | ---- | ---- |
| `/diagnostico`      | 15  | 23.4 | 29.2 | 14.4 | 29.5 |
| `/inicio`           | 5   | 17.7 | 25.9 | 13.7 | 27.9 |
| `/ponto-equilibrio` | 10  | 24.9 | 33.2 | 18.6 | 33.2 |
| `/produtos`         | 5   | 21.6 | 31.3 | 17.6 | 32.5 |
| `/simulacoes`       | 20  | 31.1 | 51.3 | 12.6 | 52.6 |

## 2. Query count por tela

| Rota                | Eventos de transação | Round trips | Média round trips/evento |
| ------------------- | -------------------- | ----------- | ------------------------ |
| `/diagnostico`      | 20                   | 160         | 8.00                     |
| `/inicio`           | 10                   | 80          | 8.00                     |
| `/ponto-equilibrio` | 15                   | 85          | 5.67                     |
| `/produtos`         | 10                   | 55          | 5.50                     |
| `/simulacoes`       | 25                   | 140         | 5.60                     |

Round trips = soma de `round_trips` por transação concluída (`commit`/`rollback`) na janela da rota;
inclui as queries do Better Auth/sessão que rodam dentro da transação do server fn.

## 3. Query duration

Duração da transação (`duration_ms`), em ms:

| Rota                | n   | p50  | p95  | min  | max  |
| ------------------- | --- | ---- | ---- | ---- | ---- |
| `/diagnostico`      | 20  | 17.0 | 45.5 | 6.0  | 54.0 |
| `/inicio`           | 10  | 21.0 | 47.5 | 8.0  | 57.0 |
| `/ponto-equilibrio` | 15  | 17.0 | 62.6 | 5.0  | 64.0 |
| `/produtos`         | 10  | 24.0 | 43.3 | 10.0 | 46.0 |
| `/simulacoes`       | 25  | 16.0 | 60.2 | 3.0  | 63.0 |

## 4. Tempo de carregamento do dashboard

Dashboard (`/inicio`): prontidão p50 **2490.0 ms** / p95 **2526.6 ms** (n=5); TTFB p50 4.0 ms.

## 5. Tempo de lista de produtos

Lista de produtos (`/produtos`): prontidão p50 **2461.0 ms** / p95 **2477.0 ms** (n=5); server fn p50 21.6 ms.

## 6. AI latency

AI latency (mock local): n=3, p50 **36.0 ms**, p95 **36.9 ms**, min 36.0 / max 37.0 ms.

| Modelo                    | n   | p50  | p95  |
| ------------------------- | --- | ---- | ---- |
| `google/gemini-3.6-flash` | 3   | 36.0 | 36.9 |

Outcomes observados: {"success":3}
Origem das amostras: {"direct-probe":3}

> Aviso: as amostras vieram da sonda direta da camada de modelo (`callModel`), não do
> caminho HTTP do chat — o harness registrou a indisponibilidade em Lacunas. A latência
> cobre fetch mockado + retry/timeout/telemetria, sem auth/budget/DB do chat.

Chat completo (round trip do envio até a resposta): n=0, p50 — ms, p95 — ms.

## 7. Tamanho de bundle

Budget: {"entryMinifiedBytes":500000,"initialGraphMinifiedBytes":500000}

| Entry                      | Minified  | gzip     | Brotli   | Grafo inicial (min) | Budget |
| -------------------------- | --------- | -------- | -------- | ------------------- | ------ |
| `assets/index-BfoIlnr6.js` | 268.4 KiB | 83.6 KiB | 72.6 KiB | 459.0 KiB           | PASS   |

## 8. Core Web Vitals em ambiente controlado

| Rota                | LCP p50 | LCP p95 | CLS p50 | CLS p95 | FCP p50 | Load p50 |
| ------------------- | ------- | ------- | ------- | ------- | ------- | -------- |
| `/diagnostico`      | 1216.0  | 1281.6  | 0.0000  | 0.0000  | 136.0   | 549.9    |
| `/inicio`           | 1124.0  | 1274.4  | 0.0000  | 0.0000  | 144.0   | 541.4    |
| `/ponto-equilibrio` | 1244.0  | 1339.2  | 0.0000  | 0.0000  | 180.0   | 597.4    |
| `/produtos`         | 1116.0  | 1175.2  | 0.0000  | 0.0000  | 156.0   | 547.1    |
| `/simulacoes`       | 1272.0  | 1342.4  | 0.0243  | 0.0243  | 160.0   | 629.2    |

## Decisões

- Baseline rotulado **CONTROLADO**: preview Nitro local + PostgreSQL em Docker; nenhum tráfego de produção, nenhuma chamada ao gateway real.
- Prontidão de rota = marcador de dados visível (não `load`); o HTML inicial das rotas autenticadas é só o shell (`ssr: false`).
  - `/inicio` → `heading:Olá! 👋`
  - `/produtos` → `text:Produto de teste`
  - `/ponto-equilibrio` → `heading:Ponto de Equilíbrio`
  - `/simulacoes` → `text:Dados unitários do produto`
  - `/diagnostico` → `text:Premissas da formação de preço`
- Item 6 (AI latency) medido com provider mockado; quando o chat HTTP está inviável, a fonte é a sonda direta da camada de modelo (declarada em Lacunas).
- Percentis por interpolação linear R-7; query count/duração vêm de `app.context_tx`, incluindo auth/sessão dentro da transação.
- Raw re-derivável gravado como `.json/.jsonl/.txt` no diretório da evidência; `report.md` é regenerado por `scripts/perf/summarize.mjs`.

## Limitações

- **Mock de IA ≠ gateway real:** o circuito de chat responde de um provider mockado em processo
  (latência artificial determinística). Os números de AI latency medem o caminho interno do app
  (retry, timeout, ledger, persistência), não a rede/vendor do gateway.
- **Local ≠ Neon:** PostgreSQL 17 em Docker no loopback, latência de rede ~0; Neon tem
  latência de região, connection pooling e autoscaling que não aparecem aqui.
- **n pequeno:** percentis p95 com n=5 são indicativos; não use como SLO.
- **TTFB/ready inclui o browser** (Playwright, cold context por rota) e o roteamento
  client-side (`ssr: false` nas rotas autenticadas): o HTML inicial é só o shell.
- **M-06/Q-020 não consumidos:** nenhum tráfego real ou de produção foi tocado.

## Lacunas declaradas

- Chat iteração 0 (warmup=true): page.waitForFunction: Timeout 30000ms exceeded.
- Chat iteração 1 (warmup=false): page.waitForFunction: Timeout 30000ms exceeded.
- Chat iteração 2 (warmup=false): page.waitForFunction: Timeout 30000ms exceeded.
- Chat iteração 3 (warmup=false): page.waitForFunction: Timeout 30000ms exceeded.
- Circuito HTTP de chat não gerou ai.model_attempt — detalhe do cliente: Mensagem restaurada do histórico E2E. | Mensagem controlada de baseline #0. | ⚠️ The "signals[0]" argument must be an instance of AbortSignal. Received undefined.

## Raw versionado

- `meta.json` — ambiente/janela/lacunas da captura
- `route-samples.jsonl` — amostras por rota (prontidão, TTFB, LCP, CLS, server fn)
- `chat-samples.jsonl` — round trips do chat
- `context-tx.jsonl` — eventos `app.context_tx` atribuídos por fase
- `ai-model-attempts.jsonl` — eventos `ai.model_attempt`
- `server-stdout.txt` — stdout/stderr do preview Nitro
- `build-output.txt` — saída do build
- `bundle-report.json` — cópia de `.artifacts/bundle-report.json`
