# Relatório Pós-Merge PR #62 — Fase 3 (Deploy Verificado — Preview)

## Status Geral

**AMARELO** — a revisão mesclada está validada em **preview** (health 200, E2E verde) e o **gate de build foi corrigido na origem** (DBT-109, testes + cache frio local verdes); a publicação de produção aguarda o retry pelo circuito de release (SHA de `main`), com produção ainda no `fa45632` (503) e o bloqueador nomeado.

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

## Bloqueadores

1. **Publicação exige o circuito de release (política):** com o gate corrigido, o aceite remoto do build de produção (cache frio do `fa45632`) só ocorre no ambiente real — e a arquitetura manda publicar o **SHA exato de `main`**, o que requer novo PR de release develop→main (checks do PR) antes do retry de produção. Um deploy direto de um SHA de `develop` violaria a política de publicação.
2. **Ponte de banco da produção não testada** (não chegamos ao runtime): o `DATABASE_URL` sensitive de produção continua suspeito do 503 do `fa45632`; recomenda-se validar (Via A) antes/junto de nova tentativa.
3. Deployment Checks não verificáveis sem sessão humana no dashboard.
4. PR de ativação prescrito é impossível (ruleset) — se a opção for reativar build por Git, o caminho é mudança de `vercel.json` no circuito develop→main.

## Próximos Passos (decisão humana)

- (a) **FASE C (recomendado):** abrir o PR de release develop→main (checks completos de PR), merge e então publicar o **SHA exato de `main`** em produção com validação imediata (health/logs/E2E) e rollback pronto (reatribuir `sage`/time/`git-main` ao `dpl_DHsbj`, que responde 200).
- (b) Validar/repontar o `DATABASE_URL` sensitive de produção antes (Via A) — suspeito do 503 do `fa45632` e não testado no runtime.
- (c) Retry da publicação do `main` atual (`2103151`) — **sem** a correção do gate, depende de sorte de cache; não recomendado.
- (d) Manter a publicação suspensa. A branch Neon `develop` fica desarquivada (decisão tomada).

## Evidências

- `docs/evidence/pos-merge-pr62-2103151-phase3/captures/` — `git-state.txt`, `vercel-project-config.json`, `vercel-deployment-checks.json`, `vercel-preview-inspect.json`, `vercel-preview-logs-build.txt`, `vercel-preview-http.txt`, `vercel-prod-deploy-attempt.json`, `vercel-prod-build-failure.txt`, `neon-branches.json`, `neon-endpoints-pooling.json`, `neon-readonly-checks.txt`, `pre-push-check.txt`
- `docs/evidence/pos-merge-pr62-2103151-phase3/screenshots/` — `e2e-preview-home.png`, `e2e-preview-auth.png`
- `docs/evidence/pos-merge-pr62-2103151-phase3/playwright-mcp/` — snapshots de acessibilidade (`page-*.yml`, commitados, selados byte a byte) e logs de console (`console-logs/*.log`, presentes localmente e cobertos pelo selo do `.prettierignore`; ignorados pelo git pela regra `*.log` do próprio repositório)
