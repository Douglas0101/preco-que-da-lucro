# Pool saturation — evidência §16.7 (2026-09-13)

- **ambiente:** `dev-evidence` — PostgreSQL 17 local (`127.0.0.1:5432/preco_que_da_lucro_test`,
  driver `node-postgres`), nunca produção.
- **método:** `scripts/obs/pool-activity.ts` amostra `pg_stat_activity`
  (`state`/`wait_event_type`/`wait_event`/`count`) a cada 250 ms por 4 000 ms, com carga
  sintética de 3 clientes `pg` (1× `select pg_sleep(0.6)`, 1× `select pg_sleep(0.2) from
generate_series(1,2)`, 1× `select count(*) from pg_class`). O script é local-only
  (recusa `NODE_ENV=production` e host não-loopback; não imprime a URL).
- **n:** 16 amostras na janela.
- **janela:** 2026-09-14T02:49:11Z → 2026-09-14T02:49:15Z (UTC).
- **fonte:** `docs/evidence/pool-saturation-2026-09-13/pool-activity-2026-09-14T02-49-15-768Z.json`
  e o `.md` homônimo (raw re-derivável versionado).
- **hypothesis:** instrumentar o pool com gauges (`used`/`idle`/`waiting`/`max`), histograma
  de wait time real no checkout e contador de transações em voo torna a saturação observável;
  o `pg_stat_activity` deve confirmar que há fila/uso real para correlacionar.
- **metric:** `app.db.pool.connections` (gauge, `state` ∈ used/idle/waiting/max, label `driver`);
  `app.db.pool.wait_time` (ms, histograma); `app.db.pool.in_flight_transactions` (gauge);
  no raw: contagens por `state` e `wait_event`.
- **before:** não existia nenhuma métrica de pool nem wait time; havia apenas
  `app.db.duration` agregado e o teto `DATABASE_POOL_MAX ?? 10`
  (`src/db/client.server.ts:15,66` original) e 1 snapshot de contexto.
- **change:** `src/instrumentation/telemetry.ts` (gauges + histograma + registry defensivo de
  snapshots), `src/db/client.server.ts` (leitura de `totalCount/idleCount/waitingCount/options.max`,
  `performance.now()` em volta do checkout, contador in-flight em `begin`/`commit`/`rollback`) e
  `scripts/obs/pool-activity.ts` (novo).
- **after:** instrumentação presente e coberta por teste (pool fake com
  `totalCount/idleCount/waitingCount/options.max`); o raw local capturou pico de 3 conexões
  simultâneas (2 `active` + 1 `idle`), 28 ocorrências `Timeout/PgSleep` e 15 `Client/ClientRead`
  na janela. Os gauges não foram exportados a OTLP nesta rodada (sem collector local), então não
  há valor remoto de produção — só a leitura unitária e o raw do servidor.
- **result:** a instrumentação está habilitada, é defensiva (fonte/exporter que lançam não
  propagam) e o sampler é reproduzível; **não** há alegação de ganho de performance nem baseline
  de produção (sem tráfego real, H-6 pendente).
- **decision:** `keep` — manter; follow-up: exportar/coletar em staging quando houver collector
  OTLP e comparar `waiting`/`wait_time` com o raw de `pg_stat_activity`.

## Contrato de normalização

- `used = max(totalCount - idleCount, 0)`, `idle = idleCount`, `waiting = waitingCount`,
  `max = options.max` — os dois drivers expõem esses campos.
- Wait time medido do pedido de checkout até a resolução de `connect` (promise **ou** callback).
- In-flight conta `begin` como +1 e `commit`/`rollback` como −1 (uma única finalização por
  boundary), nunca negativo.
- Sem labels de tenant/usuário em nenhuma série do pool; apenas `driver`.
- `waiting` no raw exclui `wait_event_type` `Client`/`Activity` (espera de rede/sessão);
  `Timeout/PgSleep` é espera real de query do servidor.

## Guardas verificadas

```
NODE_ENV=production ... npx tsx scripts/obs/pool-activity.ts
  -> "pool-activity é local-only: NODE_ENV=production recusado" (exit 1)
DATABASE_ADMIN_URL=postgresql://user:pass@ep-fake.neon.tech/db npx tsx scripts/obs/pool-activity.ts
  -> "pool-activity recusa host não-loopback (fail-closed; valor omitido)" (exit 1)
```
