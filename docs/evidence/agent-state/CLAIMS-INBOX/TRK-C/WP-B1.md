# CLAIM — TRILHO C · WP-B1 (`@vercel/analytics` condicionado ao alvo Vercel)

- **papel:** TRILHO C (worker) · **data:** 2026‑09‑17
- **branch:** `trk-c-wp-b1` · **worktree:** `.worktree-trk-c` (isolado; nenhum push, nenhum merge)
- **base:** `648c029` (= `origin/develop`, CI verde) · **commit do WP:** `04b88fd`
- **veredicto:** **não é meu** — aguarda o ADVERSARIAL (contexto novo). Este arquivo não auto‑aprova.

## 1. Objetivo

Remover o achado **B‑1** (ciclo 3): `<Analytics />` de `@vercel/analytics/react` montado
**incondicionalmente** em `src/routes/__root.tsx` ⇒ `GET /_vercel/insights/script.js → 404` +
recusa por MIME em **toda** navegação no preset `node-server`, **sem** afrouxar a CSP estrita
(`script-src 'self'`) e **sem** dependência nova.

## 2. O que foi medido (comandos + saída crua)

Tudo dentro do worktree, `cwd` explícito, `env -u DATABASE_URL_UNPOOLED` em todo lançamento;
`:5432`, host remoto, Neon, `vercel` e `git push` **nunca** usados. Servidores: `node
.output/server/index.mjs` (`:4391` RED, `:4392` GREEN, `NODE_ENV=production`) e o harness do
Build Output API (`:4393`); sonda Playwright (Chromium + Firefox headless) = `probe-analytics.mjs`.

| etapa                        | comando                                                                                                            | saída crua (resumo)                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RED** (pai, `node-server`) | `git checkout 648c029 -- vite.config.ts src/routes/__root.tsx` · `npm run build` · `node … --label=red-nodeserver` | `chromium analyticsRequests=1 injectedScripts=1 errorResponses=1 mimeRefusals=1 consoleErrors=2` · `analytics 404 text/html; charset=utf-8 …/_vercel/insights/script.js` · `MIME Refused to execute script … MIME type ('text/html') is not executable` · `log: [Vercel Web Analytics] Failed to load script …` |
| **GREEN** (`node-server`)    | `git checkout HEAD -- … && npm run build` · mesma sonda (`:4392`)                                                  | `chromium analyticsRequests=0 injectedScripts=0 errorResponses=0 mimeRefusals=0 consoleErrors=0` · `firefox … mimeRefusals=0 consoleErrors=4` (as 4 são as violações **CSP Report‑Only** do §20.1, idênticas no RED)                                                                                            |
| **Vercel** (`VERCEL=1`)      | `env -u DATABASE_URL_UNPOOLED VERCEL=1 npm run build` · harness + sonda (`:4393`)                                  | `chromium analyticsRequests=1 injectedScripts=1` · `injected: {src:"/_vercel/insights/script.js", sdkn:"@vercel/analytics/react", sdkv:"1.6.1"}` (o `404` é do harness local, sem edge Vercel)                                                                                                                  |
| **§17.6/§17.7**              | `npm run check:bundle` (RED e GREEN)                                                                               | RED `PASS assets/index-DC1OyfB3.js: 239717 …` / grafo `475253` → GREEN `PASS assets/index-79FGcCpK.js: 237694` / grafo `473230` (**−2023 B**, 9 chunks nos dois)                                                                                                                                                |
| build do gate (Vercel)       | `VERCEL=1 npm run build`                                                                                           | `.vercel/output/static/assets/index-DC1OyfB3.js` = **239717 B, hash igual ao do pai** ⇒ para a Vercel a mudança é no‑op                                                                                                                                                                                         |
| build do gate (node-server)  | `grep -rl '_vercel/insights' .output/public/`                                                                      | **0 arquivos** (módulo tree‑shaken) · `grep -rl '__VERCEL_ANALYTICS_ENABLED__' .output/ .vercel/output/` = **0** (define sempre substituído)                                                                                                                                                                    |

Semântica do `RED→GREEN`: **medido** (não afirmado) — o fix foi removido do worktree
(`git checkout 648c029 -- …`), o build do pai foi servido e a sonda reproduziu o par 404+MIME
antes de restaurar e remedir. `npm run build`, `npx tsc --noEmit`, `npx eslint` (3 arquivos) e
`npx prettier --check` (arquivos tocados + evidência) saíram **0**.

## 3. Evidência selada

- `docs/evidence/trk-c-wp-b1-2026-09-17/` — `README.md` (hipótese → medição → resultado),
  `probe-analytics.mjs`, `serve-vercel-output.mjs` e `measurements/` (3 JSONs + 6 PNGs + 5 logs de
  build convertidos a `.txt` — `.log` e `raw/` são **gitignored** neste repo, então os artefatos
  foram versionados sob `measurements/*.txt` para que o manifesto seja verificável por terceiros).
- **`manifest.sha256`** = 17 entradas · `sha256sum -c manifest.sha256` (de dentro do diretório) =
  **17 OK / ALL MATCH** · `sha256` do próprio manifesto:
  `958ee08d112f2f195b93b25cbf6052e8b282e64bd068f527cf918a16299bdcb3`.
- Tudo versionado no commit `04b88fd` (18 arquivos de evidência rastreados pelo git).

## 4. Desenho (o que um revisor precisa checar)

Uma única fonte — `const isVercel = Boolean(process.env.VERCEL)` em `vite.config.ts` — escolhe o
preset do Nitro **e** entra no `define` como `__VERCEL_ANALYTICS_ENABLED__`; `src/lib/vercel-analytics.ts`
expõe `vercelAnalyticsEnabled` (com guarda `typeof`, para que ambiente sem `define` — ex.: vitest —
seja `false` em vez de `ReferenceError`); `__root.tsx` passa a `{vercelAnalyticsEnabled ? <Analytics /> : null}`.
Preset e gate **não podem divergir**; nada em `src/lib/security-headers.ts`.

## 5. Limites e resíduos declarados

1. **A plataforma Vercel não é reproduzível offline**: no `VERCEL=1` local o gate liga e o script é
   **pedido/injetado**, mas quem serve `/_vercel/insights/script.js` é o edge — no harness local a
   resposta é `404` (limite do harness, não do gate). Não medi o serving real.
2. **Nenhum teste automatizado novo**: o comportamento é condicional ao **alvo de build** e o vitest
   roda sem o `define` (gate sempre `false` ali) — um teste de unidade só reafirmaria o default.
   O guarda permanente candidato é no `test:e2e` (preview `node-server` ⇒ nenhuma requisição
   `/_vercel/insights/*`), **não adicionado** porque o gate desta trilha proíbe rodar `test:e2e`
   (exige banco semeado); declarado, não silenciado.
3. `firefox` mantém as **4** violações CSP **Report‑Only** do §20.1 (inline script/style) — canal de
   soak deliberado, pré‑existente, fora do escopo deste WP (presentes idênticas no RED).
4. **Rotas autenticadas não navegadas** e nenhum banco usado (R7): a sonda mediu `/` (pública); a
   montagem é do `RootShell`, global a toda rota — a lacuna é de cobertura, não de código.
5. `check:bundle` só roda no preset `node-server` (lê `.output/public/.vite/manifest.json`); no alvo
   Vercel não há relatório de orçamento (`nitro deploy --prebuilt` é do MAESTRO).
6. Não toquei `package.json`/`package-lock.json`, não regenerei a matriz M‑02, não escrevi no ledger
   (`EXECUTION-STATE-PROGRAM.md`/`PROGRESS.md`) e não fiz push.

## 6. Arquivos tocados

`vite.config.ts` · `src/lib/vercel-analytics.ts` (novo) · `src/routes/__root.tsx` ·
`docs/evidence/trk-c-wp-b1-2026-09-17/**` · este claim.
