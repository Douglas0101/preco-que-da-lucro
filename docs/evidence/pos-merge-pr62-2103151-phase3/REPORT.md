# Relatório Pós-Merge PR #62 — Fase 3 (Deploy Verificado — Preview)

## Status Geral

**AMARELO — promoção abortada pela regra invariante.** O ciclo técnico está fechado (release em `main`, CI verde, builds de produção READY) e a **promoção de aliases foi ABORTADA** em 2026-10-13T00:21Z porque o health seguiu **503** (`28P01`, não-transitório) na segunda tentativa e o reparo Via A declarado **não se refletiu em nenhum plano de controle**: a env de produção `DATABASE_URL` segue com `updatedAt` de **2026-10-06T16:37:23Z** (API da Vercel) e não há operação de role/senha no Neon na janela. A superfície pública permanece saudável no `dpl_DHsbj` (200) — **nenhum tráfego foi movido**.

## Git

- SHA `main`: `2103151ac32d88847eb97bb97ccd5ff9d7d1a44f`
- SHA `develop`: `cb6baaae23dc242929883806781d4dc483ea9a1c` (evidências das fases 1–3; antes `ed26ec3`)
- PR de ativação: **N/A estrutural** — o ruleset `24347682` ("Only develop and main branches", sem bypass) proíbe a criação da branch `fix/vercel-deploy-activation-*`; qualquer mudança versionada (ex.: reativar `git.deploymentEnabled`) entra pelo circuito normal develop→main.
- Back-merge `main→develop`: `ed26ec3` (existe, CI verde) — anterior a esta fase.

## Vercel — Deploy

- Causa-raiz do "sem deploy": **`vercel.json` com `{"git":{"deploymentEnabled":false}}`** desde `0bafaeb` (2026-10-02) — desativação **deliberada** ("disable automatic Git publication"); zero deployments para `2103151`, `40c1a355`, `ed26ec3`, `1f559ff`.
- **Preview URL**: `preco-que-da-lucro-ho2uql3za.vercel.app` (`dpl_GdkNB9Pko1WwpouayY9Zw3oV2JS9`, `READY`, iad1, build ≈21 s, commit `cb6baaa`/develop)
- **Preview healthcheck**: `/api/health/ready` → **200** `{"status":"ready","dependencies":{"postgres":"ok"}}` (via bypass read-only; direto = 302 SSO)
- Produção URL: `dpl_6h2LTZ` (`preco-que-da-lucro-gssnblvr8.vercel.app`, `fa45632`, 2026-10-08) — `READY` no painel, app **503** `postgres unavailable`
- Alias público: `sage`/time/git-main servem `d4b9395` (200, revisão antiga); o alias legado público segue 503
- Deployment Checks: **não verificáveis por API/MCP** (dashboard exige sessão humana) — `N/A declarado`, não usado como gate
- Observabilidade: sem Observability Plus; logs de build coletados (2 warnings de plataforma, nenhum erro); runtime logs limitados

## Neon

- Branch de produção: `production` (`br-snowy-violet-aymcvvvv`) **ready**, PG 17.11
- Pooling: **`pooler_enabled=false`** em todos os endpoints (host direto 5432; pooled host existe) — divergência da recomendação oficial p/ serverless, registrada; 12/901 conexões
- **Efeito colateral do preview (integração Vercel↔Neon):** a branch `develop` (`br-small-hill-aymcu14y`) foi **desarquivada automaticamente** às 2026-10-12T19:14:09Z, 1 s após a criação do deployment de preview (estava archived desde 10-09) — é ela que fornece o banco ao preview. Decisão de re-arquivar é humana.
- Migrações: **20/20 aplicadas**, zero pendências
- Branch efêmera: **nenhuma criada** (nada a limpar em dados; `pg_stat_activity` sem sessões longas do app — driver serverless/HTTP)

## Testes E2E (navegador real, read-only)

- Preview `/` → 200, título correto, **console 0 erros**; `/api/auth/get-session` 200 `null`
- Preview `/auth` → 200, OAuth + formulário renderizando
- Preview `/inicio` (protegida) → redireciona para `/auth?redirect=%2Finicio`; **1 erro de console esperado** (401 na server function — negação de autorização, não crash); `POST /api/vitals` abortado pela navegação
- Limitações: login real/CRUD/logout exigem credencial de teste (não usada/inserida); fluxos autenticados cobertos pela suíte E2E de CI em fixture efêmera

## Publicação autorizada de produção (tentativa de 2026-10-12T19:31Z)

Após autorização humana explícita ("publicar + validar + rollback pronto"), foi criado o deployment de produção do SHA exato de `main`:

- `dpl_8sjNJvBbiFkHrR6hUcMx1iDR1Jrf` (`preco-que-da-lucro-pc4qrwlyd.vercel.app`, ref `main`, `2103151`) → **ERROR** no build: `BUILD_UTILS_SPAWN_1`, `Command "npm run build" exited with 1`.
- **Causa-raiz (do próprio repositório):** `scripts/build.mjs` falha o build com `Build emitted unregistered or expired warnings:` quando observa warning não registrado/expirado. O build de produção (cache frio do `fa45632`) emitiu diagnósticos `[PLUGIN_TIMINGS]` do rolldown (não registrados); adicionalmente, a única entrada da allowlist (`WARN-NITRO-001`) está **expirada desde 2026-10-06** (`expiresOn`), política intencional e documentada (`docs/runbooks/cutover-A4.md:491`, emenda env-guard 2026-09-07). O preview passou porque o cache quente não emitiu o diagnóstico — assimetria de cache, não de código.
- **Produção inalterada:** nenhum alias se moveu (`sage`/time/`git-main` seguem no `dpl_DHsbj` `d4b9395`, 200); o deployment falho ficou sem alias; **rollback não foi necessário**.
- Evidência: `captures/vercel-prod-deploy-attempt.json`, `captures/vercel-prod-build-failure.txt`.

## Correção do gate de build (FASE A — DBT-109)

- **Supressão na origem:** `vite.config.ts` desativa o diagnóstico de performance `[PLUGIN_TIMINGS]` do rolldown em **cliente e ssr** (`rolldownOptions.checks.pluginTimings = false`). Prova estrutural no rolldown instalado (1.2.6): `create-bundler-option…mjs:3194` → `checks.pluginTimings !== false` é o gate do recorder; falso ⇒ `pluginTimings` chega `undefined` ao nativo (`bindingify-input-options…mjs:2206`) ⇒ o diagnóstico **não pode** ser emitido. O gate de warnings não foi tocado.
- **Allowlist:** `WARN-NITRO-001` (expirou em 2026-10-06) foi re-verificada e **removida** — o warning não se reproduz em nenhum canal observado (build local de cache frio, CI e builds Vercel de 2026-10-12). Política de expiração preservada (`fail-closed`).
- **Lógica do gate extraída** para `scripts/lib/build-warnings.mjs` (+ `build-warnings.d.mts`): comportamento byte a byte idêntico, agora **testável**.
- **Testes novos** (`src/test/build-warnings.test.ts`, 12 casos): streams limpos passam; stderr/`WARN`/`(!)`/`deprecated` entram; assinatura exige igualdade exata; entrada **expirada** e canal não permitido reprovam; ANSI; **regressão do incidente** (`[PLUGIN_TIMINGS]` reprova se reaparecer por outro caminho); contrato da allowlist real (sem expiradas); pin do DBT-109 no `vite.config.ts`.
- **Validação local:** testes 12/12 PASS, `typecheck` limpo, **build de cache frio exit 0** com `.artifacts/build-warnings.json` = `passed: true`, `allowlist: []`, `observedWarnings: []` (`captures/build-gate-fix-*.txt`, `captures/rolldown-source-gate.txt`).
- **Aceite real pendente:** build de produção em cache frio no ambiente Vercel (só possível publicando o SHA de `main` — ver bloqueador 1).

## Preview do novo commit (FASE B — `45fe606`)

- Deployment manual `dpl_uN5qWefkpuUXyEQwScpVmzNRdhCT` (`preco-que-da-lucro-kjwhyausb.vercel.app`, `develop@45fe606`, `READY` em ~33 s).
- **Build no Vercel verde com o gate corrigido**: `Build Completed in /vercel/output [18s]`, `✓ built in 2.56s`, **sem** `Build emitted unregistered or expired warnings` e **sem** `[PLUGIN_TIMINGS]`; cache novo criado (84,65 MB).
- `/api/health/ready` → **200** `ready/ok`; E2E: `/` 200 console limpo, `/auth` 200, `/inicio` → redirect com o 401 esperado; screenshots com **hash idêntico** aos do preview anterior (render determinístico).
- Captura: `captures/vercel-preview-gate-fix.json`; CI do push (`45fe606`): UI stack `38316023401` success + light success.

## FASE C — publicação de produção (PR #63)

- **Release:** PR #63 (`release: publish the build-gate fix (DBT-109) to main`) aberto, matriz completa verde (verify-release, `scan + cobertura`, Neon, light) e mergeado → `main` = `5d6049b9badf067b804bdc3062c922bab72c46d0` (2026-10-12T22:41:44Z).
- **CI do push de main:** Sonar `38318115587` **success** (scan + cobertura; espelho skippado em main), UI stack `38318115654` **success**, light `38318115622` success.
- **Deployment de produção:** `dpl_GWEFoMxhXfz31E6HxfR2NH1RNZFn` (`preco-que-da-lucro-bwnjalzid.vercel.app`, `main@5d6049b`) → **READY em ~26 s**, **sem** `BUILD_UTILS_SPAWN_1` e **sem** warnings bloqueantes — o gate corrigido passou nas condições (cache frio de produção) que derrubaram `dpl_8sjNJvBbiFkHrR6hUcMx1iDR1Jrf`.
- **Health de produção:** `/api/health/ready` → **503** `postgres unavailable`, com erro estruturado do próprio app `component:postgres, category:authentication, step:auth, code:28P01` (= `invalid_password`): o `DATABASE_URL` de produção está com **credenciais inválidas** — mesma causa do `fa45632` desde 2026-10-08. O código está limpo (a mesma árvore serve 200 no preview com o env escopado). **DBT-110** registrada.
- **Aliases:** `sage`/time/`git-main` **não se moveram** (seguem no `dpl_DHsbj`, `d4b9395`, 200) — nenhuma regressão pública e **rollback não necessário**. Após o reparo do env, basta reativar/reatribuir este deployment (READY) ou re-deployar.
- Capturas: `captures/vercel-prod-deploy-fix.json`, `captures/vercel-prod-runtime-error.txt`.

## FASE 4 — promoção: tentativa e ABORTO (2026-10-13)

- **Marcador M-02 re-pinado** antes de novos commits: bloco aditivo no `EXECUTION-STATE-PROGRAM.md` apontando para `20f6ee7` (folga 0/13 no check; o próximo commit exige o pino, que foi feito) — commit `0b4f5be`, push em `develop`.
- **Nova tentativa de deployment** do SHA exato de `main` para puxar a configuração de ambiente corrente: `dpl_56yK8ntpAEUSbUuR8teDaUKSFdvN` (`preco-que-da-lucro-42rfg4yvy.vercel.app`, `READY` em ~26 s).
- **Health `/api/health/ready` → 503** `postgres unavailable`, erro estruturado `component:postgres, category:authentication, step:auth, code:28P01` (invalid_password), `transient:false`.
- **Verificação de planos de controle** (por que o 503 persistiu):
  - Vercel: `DATABASE_URL` de produção (sensitive, `LQTKQMUeLWmQnHkM`) com `updatedAt=2026-10-06T16:37:23Z` — **inalterada**; o reparo Via A declarado no handoff não aparece na API.
  - Neon: **nenhuma** operação de role/senha (`reset_role_password`) na janela 2026-10-12T22:00Z–00:22Z; só ciclo de compute e `epc_sync`.
  - Código: a mesma árvore serve **200** em preview com o env escopado — a ponte de banco do app está correta; o servidor Postgres é alcançado e **recusa a credencial**.
- **ABORTO executado conforme a regra invariante**: nenhum alias foi movido (`sage`/`git-main`/time seguem no `dpl_DHsbj`, `d4b9395`, 200); nenhum tráfego público foi movido para um deployment com falha de banco. O ciclo **não** é declarado concluído.
- Capturas: `captures/vercel-prod-abort.json`, `captures/vercel-prod-env-metadata-redacted.txt` (sem valores/ciphertext), `captures/vercel-prod-runtime-error.txt`.

## Bloqueadores

1. **O reparo Via A do `DATABASE_URL` de produção não materializou** (env sem alteração na Vercel desde 2026-10-06T16:37:23Z; nenhuma operação de credencial no Neon; `28P01` persistente e não-transitório). Ação humana: gravar na env `DATABASE_URL` de **Production** uma credencial válida vigente para o endpoint de produção (ex.: copiar a connection string atual do branch `production` no console do Neon, papel `neondb_owner`); depois, ativação/redeploy do `dpl_56yK8ntpAEUSbUuR8teDaUKSFdvN` (READY) ou de novo deployment do mesmo SHA — e então health 200 + E2E fecham a DBT-110.
2. Deployment Checks não verificáveis sem sessão humana no dashboard.
3. PR de ativação prescrito é impossível (ruleset) — se a opção for reativar build por Git, o caminho é mudança de `vercel.json` no circuito develop→main.

## Próximos Passos (decisão humana)

- (a) **Gravar a credencial válida** no `DATABASE_URL` de Production (Vercel, Via A) — é o único bloqueador restante; em seguida este agente (ou o pipeline manual) reativa/reatribui os aliases ao deployment READY e valida health 200 + E2E, fechando a DBT-110.
- (b) Opcional: reativar build por Git (`vercel.json`) pelo circuito normal, se a publicação automática voltar a ser desejada (hoje é manual por ADR-042).
- A branch Neon `develop` fica desarquivada (decisão tomada); nenhum DNS/SQL pendente.

## Evidências

- `docs/evidence/pos-merge-pr62-2103151-phase3/captures/` — `git-state.txt`, `vercel-project-config.json`, `vercel-deployment-checks.json`, `vercel-preview-inspect.json`, `vercel-preview-logs-build.txt`, `vercel-preview-http.txt`, `vercel-prod-deploy-attempt.json`, `vercel-prod-build-failure.txt`, `build-gate-fix-tests.txt`, `build-gate-fix-cold-build.txt`, `rolldown-source-gate.txt`, `vercel-preview-gate-fix.json`, `pre-push-check-gate-fix.txt`, `vercel-prod-deploy-fix.json`, `vercel-prod-runtime-error.txt`, `vercel-prod-abort.json`, `vercel-prod-env-metadata-redacted.txt`, `pre-push-check-repin.txt`, `neon-branches.json`, `neon-endpoints-pooling.json`, `neon-readonly-checks.txt`, `pre-push-check.txt`
- `docs/evidence/pos-merge-pr62-2103151-phase3/screenshots/` — `e2e-preview-home.png`, `e2e-preview-auth.png`, `e2e-preview-fix-home.png`, `e2e-preview-fix-auth.png`
- `docs/evidence/pos-merge-pr62-2103151-phase3/playwright-mcp/` — snapshots de acessibilidade (`page-*.yml`, commitados, selados byte a byte) e logs de console (`console-logs/*.log`, presentes localmente e cobertos pelo selo do `.prettierignore`; ignorados pelo git pela regra `*.log` do próprio repositório)
