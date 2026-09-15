# Evidência de performance — baseline CONTROLADO (F0-04) — 2026-09-13

Artefato contratado de §35 para o baseline controlado gravado em
`docs/evidence/perf-controlled-2026-09-13/`. Os números **não** são novos: todos
vêm do raw versionado deste diretório e do sumário `report.md` (gerado por
`scripts/perf/summarize.mjs`, commit de origem `42d4b76`).

## Cabeçalho obrigatório

- **ambiente:** `CONTROLLED` — preview Nitro local (`node-server`) em
  `http://127.0.0.1:4219` + PostgreSQL 17 em Docker (`127.0.0.1:5432`, base
  `preco_que_da_lucro_test`), Node v24.15.0, linux, Playwright chromium
  `151.0.7922.34`. **Não** é produção, **não** usa o gateway real de IA e **não**
  consome M-06/Q-020.
- **método:** `npm run build` (preset `node-server`) + `npm run preview`;
  fixture local (`npm run e2e:prepare`); Playwright autenticado (Better Auth) com
  1 warmup descartado e n amostras por rota; prontidão = marcador de dados
  visível (não `load`); percentis por interpolação linear R-7
  (`rank = (p/100) × (n − 1)`); query count/duração de `app.context_tx`; bundle
  de `.artifacts/bundle-report.json` (`check:bundle`).
- **n:** 5 amostras por rota (warmup 1) · chat HTTP **n=0** (lacuna declarada) ·
  AI latency n=3 (sonda direta de `callModel`).
- **janela:** `2026-09-13T15:25:17.161Z` → `2026-09-13T15:28:49.451Z`.
- **fonte:** `docs/evidence/perf-controlled-2026-09-13/` — `meta.json`,
  `route-samples.jsonl`, `context-tx.jsonl`, `ai-model-attempts.jsonl`,
  `chat-samples.jsonl`, `bundle-report.json`, `server-stdout.txt`; sumário
  `report.md`.

## Campos §35

- **hypothesis:** o baseline controlado (preview Nitro local + Postgres 17 em
  Docker, IA mockada em processo) fornece um `before` re-derivável do raw para os
  PRs de performance de §5; espera-se prontidão de rota p50 na ordem de ~2,5 s
  (shell `ssr: false` + hidratação client-side), TTFB de poucos ms e o entry do
  bundle dentro do budget de 500 000 B.
- **metric:** métrica primária = prontidão de rota (dados visíveis) p50/p95 em ms.
  Secundárias: TTFB ms, round trips por evento `app.context_tx`, duração de
  transação ms, LCP/CLS, bytes minificados do entry e do grafo inicial.
- **before:** não existe `before` no mesmo regime — esta é a **primeira** captura
  `CONTROLLED` (F0-04). O único `before` do repositório é
  `docs/evidence/perf-baseline-2026-08-29.md`, de regime `dev-evidence` (log de
  `vite dev`, n=1–12, fonte `/tmp` não versionada): regimes diferentes, **não
  comparáveis**; é por isso que ele segue na allowlist de legado do gate.
- **change:** nenhuma mudança de produto. O que passou a existir é o harness de
  medição controlada: `scripts/perf/capture-baseline.mjs` (captura no commit
  `42d4b76`) e `scripts/perf/summarize.mjs` (sumário `report.md`), mais este
  artefato §35 no caminho contratado.
- **after:** valores medidos (mesma captura, n=5 por rota) — prontidão p50/p95:
  `/inicio` 2490,0/2526,6 ms; `/produtos` 2461,0/2477,0 ms; `/diagnostico`
  2476,0/2518,0 ms; `/ponto-equilibrio` 2512,0/2519,2 ms; `/simulacoes`
  2505,0/2556,0 ms. TTFB p50 3,8–6,3 ms. Round trips/evento 8,00 (`/inicio`) e
  5,50 (`/produtos`); duração de transação p50 21,0 ms (`/inicio`) e 24,0 ms
  (`/produtos`). LCP p50 1124,0 ms e CLS p50 0,0000 em `/inicio`. Bundle: entry
  `assets/index-BfoIlnr6.js` 268,4 KiB min / 83,6 KiB gzip, grafo inicial
  459,0 KiB ≤ 500 000 B → PASS. AI latency (mock, sonda direta) p50 36,0 /
  p95 36,9 ms (n=3). Chat HTTP round trip: n=0 — **não medido** (ver lacunas).
- **result:** referência registrada; **sem alegação de ganho** (não há par
  antes/depois no mesmo regime). Limites declarados: IA mockada ≠ gateway real;
  Postgres 17 em loopback ≠ Neon; n=5 torna p95 frágil; chat HTTP não gerou
  `ai.model_attempt` (4 timeouts de `waitForFunction`), logo o circuito completo
  do chat não está coberto.
- **decision:** `keep` — adotar este artefato como o `before` canônico dos
  próximos PRs de §5. Follow-ups: (1) repetir com n≥30 para p95 utilizável;
  (2) medir o chat HTTP (lacuna n=0) e, quando houver tráfego real, declarar
  regime `OBSERVED`; (3) `scripts/perf/summarize.mjs` deve passar a emitir o
  bloco §35 no `report.md` gerado, hoje mantido à mão (fora do escopo de WP-A1).

## Cadeia de proveniência

O `report.md` deste diretório é regenerado por `scripts/perf/summarize.mjs` e
carrega um bloco §35 mantido à mão (o gerador não o emite); este arquivo é o
artefato §35 revisável, com o contexto que o sumário não tem. Nenhum número
deste documento foi estimado: todos constam do raw listado em **fonte**.
