# ADR-045 — Erradicação do Lovable e configuração Vite direta (substituição de `@lovable.dev/vite-tanstack-config`)

- Status: ACEITA — ratificada pelo dono em 2026-10-14 após a publicação e a verificação em produção: PR #64 mergeado (`main = ef7568e`), deployment `dpl_3zbrc9hxuFff91V4LwgQAy5iXx1c` servindo `sage`/team/`git-main` com `/api/health/ready` 200 e E2E autenticado respondendo com `deepseek-flash`. A publicação seguiu o circuito `develop` → `main` e ADR-042; o registro de proposta permanece em H-8.
- Data: 2026-10-14.
- Escopo: build/config (`vite.config.ts`), dependências de dev, telemetria de erro do cliente, metadata de head, defaults do consumidor de IA, scripts de guarda/perf e testes. Não altera banco, RLS, auth nem o contrato Web restrito do DeepSeek.
- Complementa ADR-013 e o SDD §16: a substituição permanente do wrapper era a alternativa prevista ("fork/substituição permanente exige ADR-013"), executada aqui sem fork, com os plugins oficiais diretos.
- Evidência: `docs/evidence/chat-practical-2026-10-13/REPORT.md` (recibos da janela) e journal `PROGRESS.md`.

## Contexto

O projeto é um export Lovable sem conexão ativa (ADR-017). O wrapper `@lovable.dev/vite-tanstack-config@2.19.5` injetava, além dos plugins oficiais (`tailwindcss`, `vite-tsconfig-paths`, `@tanstack/react-start/plugin/vite`, `nitro/vite`, `@vitejs/plugin-react`), defaults da plataforma de origem: alvo Cloudflare quando o preset não era forçado, telemetria `window.__lovableEvents`/`__lovableReportRuntimeError`, plugins de sandbox, `css.transformer: lightningcss`, alias `@`, dedupe, `server {host: "::", port: 8080}` e o filtro que trocava o plugin legado de tsconfig pelo nativo `resolve.tsconfigPaths` do Vite 8. Em produção, o consumidor de IA caía no default `ai.gateway.lovable.dev` quando `AI_GATEWAY_URL` estava vazia, e `LOVABLE_API_KEY` era aceita como fallback multi-emissor — exatamente o estado medido no incidente DBT-115 (`ai.credential_unusable`, provider=gateway, host=ai.gateway.lovable.dev, reason=absent).

## Decisão

1. `vite.config.ts` usa `defineConfig` de `vite` com os plugins oficiais diretos e preserva integralmente: `nitro({ preset: isVercel ? "vercel" : "node-server" })`; `tanstackStart({ server: { entry: "server" }, importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } } })`; `tailwindcss()` e `react()`; `css.transformer: lightningcss`; alias `@`; `dedupe`; `optimizeDeps`; `server { host, port: 8080 }`; `resolve.tsconfigPaths: true` (nativo do Vite 8); e os `checks: { pluginTimings: false }` do DBT-109 (cliente e ssr).
   - **Correção factual (2026-10-21):** esta cláusula **não** declara a chave `router: { autoCodeSplitting: true }` — a versão instalada do plugin **descarta** essa chave no schema de entrada (o `zod` a ignora), e por isso `vite.config.ts:81-93` chama `tanstackStart({ server, importProtection })` **sem** o objeto `router`; o comentário em `vite.config.ts:83-86` registra que o wrapper antigo a repassava sem tipo, de modo que o caminho anterior era **exatamente esta omissão**. A redação original desta cláusula ("preserva integralmente: … `router: { autoCodeSplitting: true }`") era, portanto, falsa quanto a esse ponto.
2. `@lovable.dev/vite-tanstack-config` e `vite-tsconfig-paths` (órfão após a troca pelo nativo) saem de `devDependencies` no mesmo commit do `package-lock.json`; faixas de `scripts/dependency-policy.json` e `guard:upgrade` intactas.
3. A telemetria `src/lib/lovable-error-reporting.ts` é deletada com o `useEffect` correspondente no `ErrorComponent`; o metadata de head (`__root.tsx`) passa a identidade do produto ("Preço que Dá Lucro") e remove `author`/`twitter:site` de origem.
4. O default do consumidor de IA passa a `https://api.deepseek.com/chat/completions` com modelo default `deepseek-flash` e credencial única por emissor: `DEEPSEEK_API_KEY` no destino nativo e `AI_GATEWAY_API_KEY` em hosts custom; a chave `LOVABLE_API_KEY` deixa de existir no código e no `.env.example`.
5. `DEFAULT_MODEL_TOKEN_PRICES` ganha `"deepseek-flash": { inputPerMillion: 0.3, outputPerMillion: 1.2 }` (default conservador documentado; override por `AI_MODEL_PRICING_JSON`).
6. O guard `scripts/check-no-supabase-runtime.mjs` passa a bloquear resquícios: `/@lovable\.dev\//i`, `/ai\.gateway\.lovable\.dev/i`, `/\bLOVABLE_API_KEY\b/`, `/\breportLovableError\b/`, `/lovable-error-reporting/i`; `.prettierignore`, `AGENTS.md` e o baseline de perf (`AI_MOCK_HOST = api.deepseek.com`) acompanham.

## Consequências

- O build deixa de depender do pacote da plataforma de origem; a telemetria morta e o metadata incorreto (achado F7) somem; o default de IA passa a ser o provedor documentado.
- Riscos e limites: perdem-se os extras dev-only do wrapper (devtools `@tanstack/devtools-vite`, hmr-gate, error loggers de `serve`, assets proxy) — tooling de desenvolvimento, não de release; se necessários, reintroduzir como plugins próprios com evidência. `docs/SDD.md` §16 mantém a redação histórica; sua condição ("permanece instalado enquanto peer do wrapper") deixa de valer por construção.

## Rollback

`git revert` do commit restaura wrapper/dependências/telemetria e a configuração anterior; nenhum dado, schema ou credencial é envolvido.
