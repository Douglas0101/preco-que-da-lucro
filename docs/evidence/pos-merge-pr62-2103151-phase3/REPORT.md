# Relatório Pós-Merge PR #62 — Fase 3 (Deploy Verificado — Preview)

## Status Geral

**AMARELO** — a revisão mesclada foi construída e validada em **preview** (build limpo, healthcheck 200, E2E read-only verde); **produção não foi tocada** e permanece no deployment antigo `fa45632` com `/api/health/ready` 503, aguardando **autorização humana explícita** para publicação (regra 3/5 da missão).

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

## Bloqueadores

1. **Publicação de produção pendente de autorização explícita** (regra 3/5).
2. **Ponte de banco da produção suspeita**: `fa45632` (construído com o `DATABASE_URL` sensitive atual, de 10-06) responde 503 — publicar a revisão nova com o MESMO env pode manter o 503. Recomendação: validar/repontar o `DATABASE_URL` de produção (Via A) antes ou junto da publicação.
3. Deployment Checks não verificáveis sem sessão humana no dashboard.
4. PR de ativação prescrito é impossível (ruleset) — se a opção for reativar build por Git, o caminho é uma mudança de `vercel.json` no circuito normal develop→main.

## Próximos Passos (decisão humana)

- (a) Autorizar publicação manual da revisão validada em produção (e revalidar); (b) reativar build automático por Git via `vercel.json`; (c) corrigir/verificar o `DATABASE_URL` de produção antes; (d) manter suspenso. E decidir sobre re-arquivar a branch `develop` no Neon.

## Evidências

- `docs/evidence/pos-merge-pr62-2103151-phase3/captures/` — `git-state.txt`, `vercel-project-config.json`, `vercel-deployment-checks.json`, `vercel-preview-inspect.json`, `vercel-preview-logs-build.txt`, `vercel-preview-http.txt`, `neon-branches.json`, `neon-endpoints-pooling.json`, `neon-readonly-checks.txt`, `pre-push-check.txt`
- `docs/evidence/pos-merge-pr62-2103151-phase3/screenshots/` — `e2e-preview-home.png`, `e2e-preview-auth.png`
- `docs/evidence/pos-merge-pr62-2103151-phase3/playwright-mcp/` — 3 logs de console + 3 snapshots (selados, brutos)
