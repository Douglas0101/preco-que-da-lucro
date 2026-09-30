# WP-B1 — `@vercel/analytics` condicionado ao alvo Vercel (TRILHO C)

- **branch / worktree:** `trk-c-wp-b1` · `.worktree-trk-c` (repo principal `preco-que-d-main`)
- **base:** `648c029` (= `origin/develop`, CI verde)
- **data:** 2026‑09‑17
- **achado de origem:** B‑1 do ciclo 3 — `<Analytics />` montado **sem condição** em
  `src/routes/__root.tsx` (linhas 11 e 119) ⇒ `GET /_vercel/insights/script.js → 404` +
  recusa por MIME (`text/html` sob `X-Content-Type-Options: nosniff`) em **toda** navegação no
  preset `node-server`. Sem risco de segurança (o script não executa e a CSP estrita segue
  válida) — o impacto é ruído de console/rede + analytics quebrado fora da Vercel.

## 1. Hipótese

O componente do `@vercel/analytics` é útil **só** onde `/_vercel/insights/script.js` existe, isto
é, sob a plataforma Vercel. O alvo do build já é decidido hoje em `vite.config.ts` por
`process.env.VERCEL` (preset `vercel` vs `node-server`). Portanto:

> Se o **mesmo** sinal que escolhe o preset também desligar a montagem do `<Analytics />` no
> bundle do cliente, então no preset `node-server` não há requisição para `/_vercel/insights/*`
> nem recusa por MIME, **e** no preset `vercel` a montagem permanece (analytics ativa).

A decisão precisa ser de **build**: quem injeta o `<script>` é o bundle **cliente**, no
`useEffect` do componente — o servidor não sabe, e um valor lido apenas em runtime no servidor não
chega ao browser (e não sobrevive a navegações client‑side). O `vite.config.ts` já é o lugar onde
`VERCEL` decide o alvo, então o gate nasce da mesma fonte (`isVercel`) — preset e gate **não podem
divergir**.

Alternativa descartada: decidir no servidor e passar por contexto de rota / marcar no HTML.
Exigiria um valor serializado, com risco de divergência entre o SSR e o cliente — mais peças para
o mesmo resultado, sem ganho.

## 2. O que mudou

| arquivo                              | mudança                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vite.config.ts`                     | `const isVercel = Boolean(process.env.VERCEL)` vira a **fonte única**: escolhe o preset do Nitro (`vercel` vs `node-server`) e entra no `define` como `__VERCEL_ANALYTICS_ENABLED__` |
| `src/lib/vercel-analytics.ts` (novo) | `vercelAnalyticsEnabled` — lê o valor substituído pelo Vite; guarda `typeof` faz o valor ser `false` em ambientes sem `define` (ex.: vitest), nunca lançando                         |
| `src/routes/__root.tsx`              | `<Analytics />` passa a `{vercelAnalyticsEnabled ? <Analytics /> : null}` no `RootShell`                                                                                             |

Nenhuma dependência nova (`package.json`/`package-lock.json` intocados), nenhum push, nenhuma
mudança em `src/lib/security-headers.ts` — **a CSP estrita (`script-src 'self'`) não foi tocada**.

## 3. Medição RED (pai `648c029`, sem o gate)

Build `node-server` do pai (`git stash` do fix), servido com
`env -u DATABASE_URL_UNPOOLED node .output/server/index.mjs` (`127.0.0.1:4391`), sonda
`probe-analytics.mjs` (Chromium + Firefox, headless):

```
[red-nodeserver/chromium] analyticsRequests=1 injectedScripts=1 errorResponses=1 mimeRefusals=1 consoleErrors=2
  analytics 404 text/html; charset=utf-8 http://127.0.0.1:4391/_vercel/insights/script.js
  MIME Refused to execute script from 'http://127.0.0.1:4391/_vercel/insights/script.js' because its
       MIME type ('text/html') is not executable, and strict MIME type checking is enabled.
[red-nodeserver/firefox] analyticsRequests=1 injectedScripts=1 errorResponses=1 mimeRefusals=1 consoleErrors=5
  analytics 404 text/html; charset=utf-8 http://127.0.0.1:4391/_vercel/insights/script.js
```

Console do Chromium no RED (7 mensagens, **3 delas do defeito**; as outras 4 são o canal de soak
CSP Report‑Only do §20.1, presentes antes e depois):

```
info:  Executing inline script violates the following Content Security Policy directive 'script-src 'self''. …   (×2, §20.1)
info:  Applying inline style violates the following Content Security Policy directive 'style-src 'self''. …     (×2, §20.1)
error: Failed to load resource: the server responded with a status of 404 ()
error: Refused to execute script from 'http://127.0.0.1:4391/_vercel/insights/script.js' because its MIME type ('text/html') … is not executable
log:   [Vercel Web Analytics] Failed to load script from /_vercel/insights/script.js. Be sure to enable Web Analytics for your project and deploy again.
```

## 4. Medição GREEN (preset `node-server`, com o gate)

Mesmo build/servidor (`127.0.0.1:4392`), mesma sonda:

```
[green-nodeserver/chromium] analyticsRequests=0 injectedScripts=0 errorResponses=0 mimeRefusals=0 consoleErrors=0
[green-nodeserver/firefox]  analyticsRequests=0 injectedScripts=0 errorResponses=0 mimeRefusals=0 consoleErrors=4
```

- **Chromium: console e rede integralmente limpos** (`consoleMessageCount=4`, todos `info` do soak
  CSP Report‑Only; `errorResponses=0` — nenhum outro 404 na página).
- **Firefox:** os 4 erros remanescentes são **exatamente** as violações Report‑Only do §20.1
  (inline script/style) — as mesmas 4 que já existiam no RED; o par 404+MIME desapareceu
  (RED = 5 erros → GREEN = 4).
- Nenhum `<script data-sdkn>` injetado (`injectedScripts=0`) e o app hidrata normalmente
  (`pageerror=0`); as capturas RED/GREEN são **byte‑idênticas** (`677bef83f926…` no Chromium,
  `062f5d3ecdfd…` no Firefox) — o defeito era invisível na tela, vivia em console/rede.

## 5. Medição do alvo Vercel (`VERCEL=1`)

Build `env -u DATABASE_URL_UNPOOLED VERCEL=1 npm run build` (preset `vercel`, `.vercel/output`),
servido localmente por um harness do Build Output API (`serve-vercel-output.mjs`: static +
handler de fetch da função gerada) em `127.0.0.1:4393`:

```
[vercel-preset/chromium] analyticsRequests=1 injectedScripts=1 errorResponses=1 consoleErrors=2
  analytics 404 text/html; charset=utf-8 http://127.0.0.1:4393/_vercel/insights/script.js
  injected: { src: "/_vercel/insights/script.js", sdkn: "@vercel/analytics/react", sdkv: "1.6.1" }
```

Isto é: **no alvo Vercel o componente continua montando e o script continua sendo pedido** — o
`404` do harness é a ausência do edge da Vercel na máquina local, não o gate.

Prova mecânica complementar (independente do harness):

| verificação                                                         | `node-server` (GREEN)           | `VERCEL=1`                          |
| ------------------------------------------------------------------- | ------------------------------- | ----------------------------------- |
| `grep -rl '_vercel/insights'` no output do cliente                  | **0 arquivos** (tree‑shaken)    | 1 arquivo (`index-DC1OyfB3.js`)     |
| `grep -rl '__VERCEL_ANALYTICS_ENABLED__'` (literal não substituído) | 0                               | 0                                   |
| entry do cliente                                                    | `index-79FGcCpK.js` (237 694 B) | `index-DC1OyfB3.js` (**239 717 B**) |

O entry do alvo Vercel é **byte‑idêntico ao do pai** (`index-DC1OyfB3.js`, 239 717 B — o mesmo
hash de conteúdo do build RED): para a Vercel a mudança é um no‑op. Já no `node-server` o módulo
da analytics sai do grafo (0 referências).

## 6. Bundle §17.6/§17.7 (`npm run check:bundle`)

| build                        | entry (minified / gzip / brotli)       | grafo inicial (9 chunks)                 |
| ---------------------------- | -------------------------------------- | ---------------------------------------- |
| RED `node-server`            | 239 717 / 74 025 / 64 413              | 475 253 / 151 820 / 133 538              |
| **GREEN `node-server`**      | **237 694 / 73 257 / 63 672** (−2 023) | **473 230 / 151 052 / 132 797** (−2 023) |
| Vercel (`index-DC1OyfB3.js`) | 239 717 (idêntico ao RED)              | — (preset grava `.vercel/output`)        |

Sem regressão: mesma contagem de chunks (9), teto de 500 000 B respeitado
(`PASS … Initial graph (9 chunks)`), e o alvo não‑Vercel **encolhe** 2 023 B minificados.

## 7. Como reproduzir

```bash
cd .worktree-trk-c
npm ci --ignore-scripts

# RED (pai): git checkout 648c029 -- vite.config.ts src/routes/__root.tsx   (restaure depois com
#             git checkout HEAD -- vite.config.ts src/routes/__root.tsx)
env -u DATABASE_URL_UNPOOLED npm run build
env -u DATABASE_URL_UNPOOLED PORT=4391 HOST=127.0.0.1 NODE_ENV=production node .output/server/index.mjs &
env -u DATABASE_URL_UNPOOLED node docs/evidence/trk-c-wp-b1-2026-09-17/probe-analytics.mjs \
  --base-url=http://127.0.0.1:4391 --label=red-nodeserver --out=docs/evidence/trk-c-wp-b1-2026-09-17/measurements      # ⇒ 404 + MIME

# GREEN (node-server)  → mesmo build/sonda  ⇒ 0 requisições, 0 erros
npm run check:bundle                                                        # ⇒ PASS, sem regressão

# Vercel
env -u DATABASE_URL_UNPOOLED VERCEL=1 npm run build
env -u DATABASE_URL_UNPOOLED node docs/evidence/trk-c-wp-b1-2026-09-17/serve-vercel-output.mjs --port=4393 &
env -u DATABASE_URL_UNPOOLED node docs/evidence/trk-c-wp-b1-2026-09-17/probe-analytics.mjs \
  --base-url=http://127.0.0.1:4393 --label=vercel-preset --out=docs/evidence/trk-c-wp-b1-2026-09-17/measurements       # ⇒ script injetado/pedido
```

Sonda: `probe-analytics.mjs` (Playwright Chromium+Firefox; registra console, `pageerror`,
responses ≥400, requisições `/_vercel/insights|speed-insights/*` com status/content‑type, o
`<script data-sdkn>` do DOM e screenshot). Harness Vercel: `serve-vercel-output.mjs`.

Selagem: `manifest.sha256` cobre este README, as duas sondas e os 14 artefatos de
`measurements/` (17 entradas) — `sha256sum -c manifest.sha256` **de dentro deste diretório**.

## 8. Limites declarados

1. **A plataforma Vercel não está disponível offline.** No alvo `VERCEL=1` local, a requisição ao
   script é **feita** (gate ligado, `<script>` injetado) mas recebe `404` do harness — quem serve
   `/_vercel/insights/script.js` é o edge da Vercel. O que ficou medido é o **gate** (monta/não
   monta) e a presença do código da analytics no output do alvo; o serving do script em si não é
   reproduzível aqui.
2. **Sem teste automatizado novo no `vitest`.** O comportamento corrigido é condicional ao **alvo
   de build**; o `vitest` roda sem o `define` (o gate ali é sempre `false`), logo um teste de
   unidade só reafirmaria o default. O guarda permanente candidato é no `test:e2e` (preview
   `node-server` = nenhuma requisição `/_vercel/insights/*`), que **não** foi adicionado por não
   poder ser executado nesta trilha (o gate local proíbe rodar `test:e2e`; exige banco semeado).
   A prova desta correção é a medição RED→GREEN acima, reexecutável pelas duas sondas versionadas.
3. **Ruído pré-existente do Firefox:** as 4 violações **CSP Report‑Only** (inline script/style) do
   §20.1 permanecem — é o canal de soak, fora do escopo deste WP e sem relação com B‑1.
4. **Rotas autenticadas não foram navegadas** (nenhum banco foi usado: `DATABASE_URL` ausente e
   `:5432`/Neon/Hostinger proibidos nesta trilha). A montagem é do `RootShell` (global), e a
   sonda mediu a página pública `/` — o caminho exercitado é o mesmo para toda rota.
5. `npm run build` do gate local usa o preset `node-server`; o **E2 integrado** (com banco e e2e) é
   do MAESTRO no land.
