# PART-3 — Observabilidade, SLOs e performance

**Fonte:** auditoria read-only de 2026-09-13 sobre `develop @ 83efb16`; Plano Mestre §§16, 17.8, 19, 29, 30.
**Nota transversal:** M-06 segue DRAFT/PENDING (`EXECUTION-STATE-PROGRAM.md:443`); rótulos CONTROLADO só após o baseline M-06/Q-020.
Zero dependência npm nova; `@opentelemetry/instrumentation-pg` recusado (não cobre o driver Neon de produção).

## 16.7 Pool saturation

- Hoje: cap `DATABASE_POOL_MAX ?? 10` (`client.server.ts:15,66`) e 1 snapshot; falta wait time/active tx/fila.
- Ações: gauges `app.db.pool.*` (used/idle/waiting/max) lendo `pool.totalCount/idleCount/waitingCount/options.max`
  (os 2 drivers expõem), histograma de wait time real no checkout (`performance.now()` em `originalConnect`),
  contador de transações em voo; label `driver`; **sem** label de tenant.
- `scripts/obs/pool-activity.ts` local-only (recusa produção) amostrando `pg_stat_activity` (state/wait_event) a cada ~250 ms;
  evidência JSON+MD `docs/evidence/pool-saturation-<data>/`.
- Teste: estender `src/test/round-trip-instrumentation.perf-waves.test.ts` com pool fake.

## 19.2 Spans HTTP/BFF/service

- Hoje: `http.request` (`start.ts:87-95`, sem status), `ai.model.call`, `ai.tool.execute`, `service.dashboard.sales_summary`,
  `db.tenant_transaction`.
- Ações: `http.response.status_code` nos 2 caminhos (ERROR só ≥500); span `bff.request` envolvendo o corpo do middleware
  (`request-context.ts:75-135`) — cobre as 29 server functions num ponto; spans de service nos cenários M-06
  (`service.dashboard.summary`, products list, diagnostic, price formation, sales, simulation).
- Repository: não instrumentar os 8 inteiros; só read models sem span de service (dashboard/catálogo) ou derivar do item 19.3.
- Documentar sampler (`OTEL_TRACES_SAMPLER`/`_ARG`) em `.env.example`; evidência `docs/evidence/obs-spans-<data>.md`.

## 19.3 DB spans (semconv PostgreSQL)

- Ações (wrapper no `client.query`, cobre Neon + node-postgres): span por query com `db.system.name="postgresql"`,
  `db.operation.name` normalizado, `db.query.text` redigido/truncado (~256 chars) — **nunca** anexar `values`;
  `recordException` em erro; pular begin/commit/rollback (`transactionBoundary` já existe em `client.server.ts:171-177`).
- Métrica `app.db.query.duration` (ms) por operação; migrar `db.system` → `db.system.name`.
- Testes: redator (PII, `$1`, comentários, truncamento) + formato objeto `{text, values}` no teste de round-trip existente.

## 19.5 Financial metrics

- Hoje `app.financial.states` só em `products.functions.ts:164` e diagnóstico; `engine_version` só em `financial.service.ts:140`.
- Ações: mover emissão para o choke point `calculateProductReadModel` (`product-read-model.service.ts:23-37`) cobrindo
  lista/detalhe/dashboard; emitir no early-return `volumeSource === "real"` (`financial.service.ts:128-139`); adicionar
  dimensão `engine_version` ao counter (mapear os 4 nomes do plano via soma/label, sem duplicar série).
- Testes por caminho (ok/invalid/real) + não-duplicação no dashboard; evidência `docs/evidence/financial-metrics-<data>.md`.

## 17.8 RUM

- Hoje `/api/vitals` só loga (`vitals.ts:33-40`); sem p75 nem targets.
- **Decisão aberta** (Onda 2): (a) tabela `rum_vitals` (migration 0014; INSERT-only; sem tenant; índice `(name, received_at)`;
  ingestão best-effort atrás de `RUM_PERSISTENCE_ENABLED` preservando 204) + `scripts/obs/rum-percentiles.ts` com
  `percentile_cont(0.75)`; ou (b) log-only com script de agregação — perde série consultável.
- Comparar com LCP ≤2,5 s / INP ≤200 ms / CLS ≤0,1 (p75), N e janela declarados; evidência `docs/evidence/rum-p75-<data>.md`.
- Se tabela: atualizar contagens do journal (12→N) e reavaliar m02/readiness.

## §29 SLOs (frontend + IA)

- Frontend: derivar p75 do item 17.8 e comparar com os targets no mesmo artefato.
- IA: fluxo **não-streaming** (`chat-execution.server.ts:478-553`) → instrumentar `time_to_acknowledge`,
  `time_to_first_content` e `time_to_final` (hoje first_content = final; documentar) + campos no log `ai.chat_completed`.
- Baselines: mock (CONTROLLED) para orquestração; provider real (OBSERVED) só com autorização/tráfego (H-6); nunca misturar.

## §30 Error budget

- Novo `docs/specs/M-06/error-budget.md` (DRAFT até Q-020): financeiro crítico (`invalid`) = zero; IA transitória
  (`AI_TIMEOUT`/`DEPENDENCY_ERROR`) com tolerância pós-baseline; `AI_QUOTA` (429 não-retryable) fora; 4xx de
  validação/auth excluídos do budget.
- `scripts/obs/error-budget.ts` (local-first, parseia JSON de `request.completed`/`request.failed`/`ai.*` por janela)
  - `docs/runbooks/slo-error-budget.md`; nada de rótulo CONTROLADO antes do baseline.

## Ordem

`19.2+19.3 → 16.7 → 19.5 → 17.8 → §29 (frontend/IA) → §30`. Itens 1–4 independentes de M-06; SLO/error budget dependem do baseline.
