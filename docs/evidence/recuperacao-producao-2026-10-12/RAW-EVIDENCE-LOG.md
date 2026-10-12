# RAW evidence log — recuperação controlada (2026-10-12, UTC)

Regra: cada linha declara **fonte** e **resultado medido**. Nenhum valor de segredo, nenhum blob
cifrado, nenhuma credencial. Onde a leitura não foi possível, está dito — nunca inferido como sucesso.

## FASE A — CI main

1. `gh api .../runs/38112535521` → `run_attempt=2`, `conclusion=failure`, `head_sha=40c1a355…`.
2. `gh api .../runs/38112535521/artifacts` → `coverage-lcov` (11706646526, 102542 B) e
   `sonar-gate-readout` (11706302298, 1247 B), ambos criados no attempt 2.
3. `gh api .../jobs/114499549769/logs` → passo `Seal scanner LCOV provenance`:
   `NO-VERDICT: scanner LCOV provenance could not be established (no raw inputs emitted)` + exit 2.
   Linhas do sensor: `Could not resolve 68 file paths` / `First unresolved path: scripts/m02-cutover-t0.mjs`
   / `Excluded sources: src/test/**` / `149 files indexed`.
4. Artefatos baixados; `c24-main-baseline.json` = stub `NO-VERDICT` **sem** `reasonCode`
   (produzido pelo código pré-fix); `c25-gate-readout.json` = identidade correta do CE do run.
5. `git show 40c1a355:scripts/sonar/main-baseline.mjs` → precondição `matches.length !== 1`.
6. Análises da mesma revisão: attempt 1 `11893646-49df-4fe9-a029-de9cec53dbf2`,
   attempt 2 `08d02858-5846-445b-b349-9e1fc4fe6ba3` (fontes: journal L826 + readout real).
7. LCOV: 184 caminhos únicos (121 `src/` c/ 5 `src/test/` + 63 `scripts/`); 184−68 = 116 in-scope;
   `git cat-file -e 40c1a355:<caminho>` → 0 ausentes (0/184).
8. Regressão: `npx vitest run src/test/main-baseline-select.test.ts src/test/sonar-gate-readout.test.ts
src/test/sonar-api.test.ts` → **3 files / 80 tests passed**.
9. Simulação ao vivo do baseline corrigido contra a API do Sonar: **não executada** — requer
   `SONAR_TOKEN`/`GITHUB_TOKEN` que vivem no runner (correto); limite declarado.

## FASE B — Vercel (MCP read-only)

1. `list_teams` → `team_2NnkSYjw5NRHAFnQFEPSHGmW`. `get_auth_user` → **404 not_found**
   (token sem superfície de usuário; ≠ 403 da sessão anterior — escopo/identidade, não permissão).
2. `list_projects` → só `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`; `domains` do projeto = apenas `*.vercel.app`.
3. `list_deployments(target=production)` → 6; o mais recente `dpl_6h2LTZ…` sha `fa45632` `READY`
   target production `iad1`, criado 2026-10-08T17:45:32Z; **nenhum** deployment para `40c1a355`
   nem `182754f` (varredura de 30 deployments).
4. `get_deployment(dpl_6h2LTZ…)` + `vercel_web_fetch` do URL direto →
   `/api/health/ready` **503** `not_ready` (correlation 0520468f-…).
5. `list_aliases` → `-sage` e `-5127s-projects` apontam `dpl_DHsbj` (d4b9395), updated
   **2026-10-08T19:00:33Z / 18:48:22Z** (rollback após as falhas das 17:50Z).
   `get_alias(preco-que-da-lucro.vercel.app)` → **404** no escopo do time (alias legado).
6. `filter_project_envs` (sem decrypt): produção tem `DATABASE_URL` **manual sensitive** (id
   LQTKQMUeLWmQnHkM, updated **2026-10-06T16:37:23Z**) + `DATABASE_URL_UNPOOLED` da integração;
   integração Neon **não** injeta `DATABASE_URL` em produção (só preview/develop);
   `hiddenProductionEnvCount=0`. Nenhum valor foi decifrado ou copiado.
7. `get_runtime_errors(7d)` → `health.readiness_failed` ×6 e `get-session begin` ×3 no
   `dpl_6h2LTZ` (2026-10-08T17:50→19:00Z) com correlationIds a8499878-…, 6b0ce8e2-…, 8a0b3a2c-….
8. `get_runtime_logs(30m)` → log fresco decisivo do `dpl_6h2LTZ` (2026-10-12T01:49:44Z):
   `Uncaught Exception … @neondatabase/serverless` (WebSocket) + `readiness_failed` + 503
   (correlation a4491fa0-…, request cg2s9-...).
   `since=2h/7d` → **400** do provedor (retenção Hobby 1h) — limite declarado.
9. Sondas HTTP (curl): matriz na `captures/http-probes.txt`; determinismo 5/5 no alias público.
10. `vercel.json` do repo → `git.deploymentEnabled=false` (push não builda; publicação é manual).

## FASE C — Neon (MCP read-only)

1. `list_projects` → `damp-forest-57346541` (PG 17, aws-us-east-2).
2. `list_branches` → production ready (restritas `delete…` com razão **"vercel production branch"**),
   develop **archived** (2026-10-09T18:35:05Z), ci-fixture-base ready.
3. `list_postgres_endpoints` → produção `active` (last_active 01:47:29Z do `-sage`), develop
   `idle` desde **2026-10-08T18:25:43Z**, ci-fixture `idle`; `pooler_enabled=false`.
4. `list_operations(100)` → ciclos start/suspend de produção; criação/deleção de branches de
   fixture (09–11/10); **nenhuma** operação destrutiva de produção no recorte.
5. `run_sql` (SELECT, branch production) → 20 migrations, 37 tabelas, 35 com RLS, 129 linhas RUM.
6. Sonda no deployment quebrado (01:49:44Z) → **nenhum** compute ativado no projeto
   (production seguiu em 01:47:29Z; develop em 2026-10-08) — discriminante de identidade do alvo.
7. `query_logs` (6h/7d) → `[]` — canal de logs indisponível/vazio; não usado como evidência.

## FASE D — Bancada local

1. Container efêmero `pqd-dbtest-55432` (postgres:17-alpine, porta 127.0.0.1:55432) — descartado após.
2. `npm run db:test` com `DATABASE_ADMIN_URL`/`DATABASE_URL` loopback e `DATABASE_DRIVER=node-postgres`
   → **EXIT=0**, 18/18 suítes (`/tmp/kilo/dbtest-full.log` preservado nesta captura resumida).
3. `npm run check` na árvore reconciliada → resultado em `captures/local-gate.txt`.

## FASE F — Domínio

1. `dig` NS → `apollo/athena.dns-parking.com` (Hostinger); SOA `dns.hostinger.com` serial 2026100801.
   Apex A = 89.116.213.232/91.108.127.168; www CNAME → `www.diretrizprecifica.com.cdn.hstgr.net`.
2. `curl -I https://diretrizprecifica.com/` → 200 text/html, `x-powered-by: Hostinger Horizons`,
   `server: hcdn`, cache HIT, `last-modified 2026-09-06`; `/api/health/ready` idem (catch-all).
3. `openssl s_client` → CN=diretrizprecifica.com, LE YE1, 2026-09-05→12-04, SAN apex+www.
4. Leitura ADR-039 (Hostinger Node/Nitro como destino principal após validação) — condição não
   cumprida; nenhum DNS alterado.

## Limites declarados (não são sucessos implícitos)

- Sem `SONAR_TOKEN` local: remediação live do baseline não executada (coberta por regressão unitária
  com os IDs reais).
- Logs de runtime Vercel > 1 h: irrecuperáveis (retenção do plano).
- Valores de env: nunca lidos; identidade do endpoint-alvo do deployment quebrado exige Via A.
- Sem deployment do SHA candidato: Computer Use no "staged" impossível nesta rodada.
- Telemetria de log do Neon: vazia/indisponível.
- `preco-que-da-lucro.vercel.app`: fora do escopo do token do time; atribuição não confirmável por API.
