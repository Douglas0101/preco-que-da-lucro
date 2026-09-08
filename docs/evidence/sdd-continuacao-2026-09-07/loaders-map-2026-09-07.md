# B-01 (LOTE-MCP-1) — Mapa de carga de env (loaders-map) — 2026-09-07

- Branch: `develop` (confirmado via `git branch --show-current` em 2026-09-07)
- Tarefa: SOMENTE-LEITURA + este arquivo novo de evidência. Nenhum arquivo
  existente foi editado, nada foi staged/commitado, sem rede/banco.
- Regra de sigilo: este arquivo contém SOMENTE NOMES de vars e hostnames
  mascarados/locais. Nenhum valor de secret foi lido ou impresso
  (o arquivo `.env` real — cuja existência foi constatada por glob — NUNCA
  foi aberto).
- Método: `read` de `package.json`, `vite.config.ts`, `drizzle.config.ts`,
  `.nvmrc`, `docker-compose.yml`, `.gitignore`, `.env.example` (só nomes),
  `scripts/env-guard.mjs`, `scripts/m02-snapshot.mjs`, `scripts/build.mjs`,
  `vitest.config.ts`, `playwright.config.ts`, workflows em
  `.github/workflows/`; `grep` por `dotenv`, `--mode`, `--env-file`,
  `sanctioned-remote`, `loadEnv|loadEnvFile`, `node-version|NODE_VERSION`;
  `glob` de `.env*`, `Dockerfile*`, `*.config.*`; `node --version`.

## Veredito de conformidade (itens 1–6)

| Item | Esperado | Resultado |
| ---- | -------- | --------- |
| 1 — zero imports próprios de `dotenv` em scripts/, src/, vite.config.ts, drizzle.config.ts | zero | SIM |
| 2 — único `--mode` é `build:dev --mode development`; `.env.sanctioned-remote` sem colisão `.env.[mode]` | só build:dev; sem colisão | SIM |
| 3 — engines/CI/container Node suportam `--env-file-if-exists` (≥22.9) | todos ≥22.9 | SIM |
| 4 — `drizzle.config.ts` lê `process.env` direto | direto, sem loader | SIM |
| 5 — 10 hooks `pre*`, cada script principal SEM `--env-file` próprio | 10/10 sem `--env-file` | SIM |
| 6 — `prem02:snapshot` carrega `.env` hoje | via `--env-file-if-exists=.env` | SIM |

Nenhum loader oculto encontrado → sem marcador STOP-LOADER-OCULTO.
Arquivo declara CONFORMIDADE nos 6 itens.

## Item 1 — `dotenv`: zero imports próprios (SIM)

- `grep dotenv` em `scripts/` (`*.{ts,tsx,mjs,cjs,js}`): zero matches.
- `grep dotenv` em `src/` (mesmo filtro): zero matches.
- `vite.config.ts` (63 linhas, lido integralmente): imports só de
  `@lovable.dev/vite-tanstack-config` e `vite` (tipos); nenhuma menção a
  `dotenv`, `loadEnv`, `envDir` ou `envPrefix`.
- `drizzle.config.ts` (16 linhas, lido integralmente): único acesso a env é
  `process.env.DATABASE_ADMIN_URL` (linha 3); nenhuma menção a `dotenv`.
- `package.json` (linhas 67–132): `dotenv` NÃO consta em `dependencies` nem
  em `devDependencies`.
- `grep dotenv` repo-wide: matches SOMENTE em (a) prosa de docs de evidência
  (`docs/evidence/g0-gitignore-hardening-2026-08-17.md:14`), (b)
  `package-lock.json:9270,9282` — `dotenv: "*"` como **peerDependencies
  OPCIONAL do pacote `nitro`** (`peerDependenciesMeta.dotenv.optional`,
  engines do nitro `^20.19.0 || >=22.12.0`), (c) snapshots baselines
  não-fonte em `.mimosa/hook-state/...` e saída de tarefa em `.pi/tasks/...`.
- `grep "node_modules/dotenv"` em `package-lock.json`: zero matches →
  `dotenv` sequer está instalado (peer opcional não resolvido).
- Conclusão: nenhum loader `dotenv` próprio, direto ou transitivo ativo.

## Item 2 — `--mode` e colisão `.env.sanctioned-remote` (SIM)

- `grep --mode` repo-wide (código-fonte vivo): única ocorrência em
  `package.json:23` → `"build:dev": "vite build --mode development"`.
  Demais ocorrências são espelhos em `.mimosa/...baseline/*.source` e
  `.pi/tasks/...` (não-fonte, ignorados).
- Nenhum script usa `--mode sanctioned-remote`, `--mode production`,
  `--mode prod` ou qualquer outro `--mode`.
- Convenção Vite (auto-load nativo, MAPEADO — não oculto): Vite carrega
  `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`. Com
  `--mode development`, os arquivos extras seriam `.env.development` e
  `.env.development.local` — `glob .env*` mostra que NENHUM deles existe no
  repo (só `.env` e `.env.example`; `.env.example` não casa com nenhum
  padrão de auto-load). Logo, hoje o `--mode development` não puxa nenhum
  arquivo extra além do `.env` padrão.
- `.env.sanctioned-remote` ≠ `.env.[mode]` de nenhum mode em uso: o nome só
  colidiria se existisse `--mode sanctioned-remote`, o que não existe e é
  proibido pelo desenho da Emenda #5 (DP1 em
  `docs/evidence/sdd-continuacao-2026-09-07/02-decisoes-dp1-dp6.md:5-10`:
  nome escolhido justamente por NÃO ser `.env.production`/`.env.prod`;
  loader futuro exclusivo
  `node --env-file=.env.sanctioned-remote <script>`, sem `-if-exists`, sem
  `pre*`). `grep sanctioned-remote` confirma: zero ocorrências em
  `package.json`/`scripts/`/`*.config.ts` — só nos drafts da Emenda #5.
- `.gitignore:11-15`: `.env`, `.env.*`, `*.env` ignorados, com exceção só
  para `.env.example` / `.env.*.example` → o futuro
  `.env.sanctioned-remote` já nasce coberto (casa com `.env.*`).

## Item 3 — Node ≥22.9 em engines/CI/container (SIM)

- `package.json:7-9`: `engines.node >=24.15.0` (≫ 22.9).
- `.nvmrc`: `24.15.0`.
- Runtime local verificado: `node --version` → `v24.15.0`, `npm 11.14.1`.
- CI (`actions/setup-node` com `node-version-file: .nvmrc`):
  - `.github/workflows/ui-stack.yml:40-43` — SIM
  - `.github/workflows/neon-preview.yml:27-29` — SIM
  - `.github/workflows/neon-pr-branch.yml:82-84` — SIM
  - `.github/workflows/neon-readiness.yml:143-145` — SIM
  - `.github/workflows/neon-drill-ops.yml` — N/A (sem `setup-node`; jobs
    só chamam API Neon via `node --input-type=module` no runner
    `ubuntu-latest` + actions `neondatabase/*`; nenhum `--env-file` ali).
- Container: `glob Dockerfile*` → nenhum Dockerfile no repo;
  `docker-compose.yml` tem UM serviço (`postgres:17-alpine`, linhas 1–16,
  sem serviço Node). Não há imagem Node própria para validar — todo Node
  (local + CI) vem de `.nvmrc`/`engines` ≥24.15. Sem gap: nenhum runtime
  Node <22.9 existe no mapa.
- Nota: `engines.node ^20.19.0 || >=22.12.0` visto no `package-lock` é o
  floor da lib `nitro`, não o runtime do projeto — sem efeito no item.

## Item 4 — `drizzle.config.ts` lê `process.env` direto (SIM)

`drizzle.config.ts:3` → `const adminUrl = process.env.DATABASE_ADMIN_URL;`
com fail-closed (`if (!adminUrl) throw`, linhas 5–7) e uso em
`dbCredentials: { url: adminUrl }` (linha 13). Nenhum `dotenv`, `loadEnv`,
`config()` ou leitura de disco no arquivo. O `.env` chega via hook
(`predb:generate` / `predb:check`, item 5) ou env herdada (CI `GITHUB_ENV` /
shell) — sem loader próprio no config nem nos comandos
`db:generate`/`db:check` (são `drizzle-kit generate` / `drizzle-kit check`
puros).

## Item 5 — 10 hooks `pre*` × mains sem `--env-file` (SIM, 10/10)

`grep --env-file` em `package.json` casa EXCLUSIVAMENTE com as 10 linhas de
hook (12–21); nenhum script principal contém `--env-file`:

| # | Hook `pre*` (loader: `node --env-file-if-exists=.env scripts/env-guard.mjs`) | Script principal | `--env-file` no principal? |
| - | ----------------------------------------------------------------------------- | ---------------- | -------------------------- |
| 1 | `predev` (`package.json:12`) | `dev`: `vite dev` | NÃO |
| 2 | `pretest` (`package.json:13`) | `test`: `vitest run` | NÃO |
| 3 | `prebuild:dev` (`package.json:14`) | `build:dev`: `vite build --mode development` | NÃO |
| 4 | `pree2e:prepare` (`package.json:15`) | `e2e:prepare`: `tsx scripts/e2e/seed-auth.ts` | NÃO |
| 5 | `pretest:e2e` (`package.json:16`) | `test:e2e`: `playwright test` | NÃO |
| 6 | `predb:test` (`package.json:17`) | `db:test`: `tsx scripts/db/test-*.ts` (×5) | NÃO |
| 7 | `predb:migrate` (`package.json:18`) | `db:migrate`: `tsx scripts/db/migrate.ts` | NÃO |
| 8 | `predb:generate` (`package.json:19`) | `db:generate`: `drizzle-kit generate` | NÃO |
| 9 | `predb:check` (`package.json:20`) | `db:check`: `drizzle-kit check` | NÃO |
| 10 | `prem02:snapshot` (`package.json:21`) | `m02:snapshot`: `node scripts/m02-snapshot.mjs` | NÃO (é `node` puro) |

Padrão único: o hook injeta `.env` (se existir) via flag nativa do Node e
roda o guard (só inspeciona `process.env` em memória — `env-guard.mjs:157`,
"nunca conecta, nunca lê disco"); o script principal herda o ambiente e
lê `process.env` direto (varredura `process.env` em `scripts/` mostra só
leituras por nome — nenhuma carga de arquivo).

## Item 6 — `prem02:snapshot` carrega `.env` hoje (SIM)

`package.json:21` →
`"prem02:snapshot": "node --env-file-if-exists=.env scripts/env-guard.mjs"`.
É o mesmo loader dos outros 9 hooks (Node nativo, tolerante à ausência do
arquivo). O `m02:snapshot` principal (`node scripts/m02-snapshot.mjs`)
não tem loader próprio: consome a env herdada pelo NOME
(`process.env[parsed.sourceEnv]`, default `DATABASE_ADMIN_URL`,
`m02-snapshot.mjs:115`) e exige motivo em `ALLOW_REMOTE_DB`
(`m02-snapshot.mjs:102-114`), sem jamais imprimir valores.

## Tabela script → loader → fonte de env → risco

Legenda de risco: **B** = baixo (loader único/explícito, fail-closed);
**MB** = médio-baixo (dupla fonte mesma origem, mapeada).

| Script npm | Loader | Fonte de env | Risco |
| ---------- | ------ | ------------ | ----- |
| `predev`, `pretest`, `prebuild:dev`, `pree2e:prepare`, `pretest:e2e`, `predb:test`, `predb:migrate`, `predb:generate`, `predb:check`, `prem02:snapshot` (10 hooks) | `node --env-file-if-exists=.env` + `scripts/env-guard.mjs` (guard in-memory, exit 0/3/2) | `.env` (se existir) + ambiente herdado (shell/CI) | B — flag nativa Node ≥22.9; `-if-exists` tolera ausência; guard fail-closed em URL malformada |
| `dev` (`vite dev`) | herda `predev`; Vite auto-load nativo (MAPEADO, item 2) | `.env` via hook + auto-load Vite (mesma origem) | MB — dupla carga idempotente da mesma origem; sem arquivo `.env.[mode]` extra hoje |
| `test` (`vitest run`) | herda `pretest`; `vitest.config.ts` sem dotenv/loadEnv (só alias `@`, jsdom, setup) | `.env` via hook + ambiente | B |
| `build:dev` (`vite build --mode development`) | herda `prebuild:dev`; único `--mode` do repo | `.env` via hook; `.env.development[.local]` inexistentes → nada extra | B — sem colisão (item 2) |
| `build` (`node scripts/build.mjs` → spawna `vite build` sem `--mode`) | SEM hook `prebuild` (inexistente) e SEM `--env-file`; `build.mjs:23-27` repassa `process.env` ao filho | ambiente herdado (em CI: job `env` + `GITHUB_ENV` do `ui-stack.yml`); localmente, auto-load Vite de `.env` se presente | MB — único build sem guard; aceitável e MAPEADO: CI injeta env explícita; risco residual = dev local com `.env` remoto — fora do DENY_SET do guard por desenho (build não é script de teste/dev/mutação) |
| `e2e:prepare` (`tsx …/seed-auth.ts`) | herda `pree2e:prepare`; `tsx` sem auto-load de `.env` | `.env` via hook + ambiente | B |
| `test:e2e` (`playwright test`) | herda `pretest:e2e`; `playwright.config.ts` só lê `process.env` por nome (`PLAYWRIGHT_BASE_URL`, `CI`); `webServer` re-invoca `npm run e2e:prepare/build/preview` (sub-hooks próprios quando existirem) | `.env` via hook + ambiente | B |
| `db:test` (5× `tsx scripts/db/test-*.ts`) | herda `predb:test` | `.env` via hook; scripts leem `process.env` por nome | B |
| `db:migrate` (`tsx scripts/db/migrate.ts`) | herda `predb:migrate` | `.env` via hook; `migrate.ts:7` lê `process.env.DATABASE_ADMIN_URL` direto | B — guard contém hard-deny/override regrado (drill/cutover-window) em `env-guard.mjs:185-267` |
| `db:generate` / `db:check` (`drizzle-kit …`) | herdam `predb:generate` / `predb:check` | `.env` via hook; `drizzle.config.ts` lê `process.env` direto (item 4) | B |
| `m02:snapshot` (`node scripts/m02-snapshot.mjs`) | herda `prem02:snapshot`; sem loader próprio | `.env` via hook; URL por NOME (`--source-env`, default `DATABASE_ADMIN_URL`) + `ALLOW_REMOTE_DB` obrigatório | B — sancionada (Emenda #4), read-only (`pg_dump -Fc --no-owner --no-privileges`, DIRECT) |
| `m02:env-guard-selftest` (`node scripts/env-guard.mjs --selftest`) | SEM `--env-file` (por desenho — matriz sintética em memória, `env-guard.mjs:511-552`) | nenhuma (envs sintéticas internas) | B |
| Loader futuro Emenda #5 (NÃO implementado) | `node --env-file=.env.sanctioned-remote <script>` (sem `-if-exists`, sem `pre*`) | `.env.sanctioned-remote` exclusivo | B por desenho; hoje zero ocorrências em código (só drafts) |

Auto-loads conhecidos e MAPEADOS (não ocultos): (a) Vite
(`.env[.local]`, `.env.[mode][.local]` — item 2); (b) Node
`--env-file-if-exists=.env` nos 10 hooks (item 5). Varredura
`loadEnv|loadEnvFile|process.loadEnv` em `scripts/` retornou só
`set_config(...)` SQL (falso positivo de substring `config(`) — nenhum
carregador de env. `grep import.meta.env` em `src/` → zero.

## Nomes de vars observados (NOMES apenas, sem valores)

- Guard (`env-guard.mjs:37-42,45`): `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED`, `DATABASE_ADMIN_URL`, `DATABASE_RESTORE_URL`,
  `ALLOW_REMOTE_DB` (+ `NEON_MIGRATION_TARGET_KIND`,
  `NEON_MIGRATION_FREEZE_START/END`, `SUPABASE_MIGRATION_DATABASE_URL`).
- `.env.example` (só chaves, valores nunca transcritos): `DATABASE_URL`,
  `DATABASE_ADMIN_URL`, `DATABASE_DRIVER`,
  `SUPABASE_MIGRATION_DATABASE_URL`, `MIGRATION_APPLY`,
  `MIGRATION_ALLOW_UPSERT`, `MIGRATION_REPORT_PATH`, `BETTER_AUTH_URL`,
  `BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS`, `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`,
  `AI_GATEWAY_URL`, `AI_GATEWAY_API_KEY`, `AI_MODEL`,
  `AI_REQUEST_TIMEOUT_MS`, `AI_MODEL_TIMEOUT_MS`, `AI_MODEL_MAX_ATTEMPTS`,
  `AI_MAX_TOOL_ROUNDS`, `AI_CHAT_LIMIT_PER_10_MINUTES`,
  `AI_DAILY_CHAT_LIMIT_PER_TENANT`, `AI_MODEL_PRICING_JSON`,
  `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `CSP_ENFORCE`.
- Observação (não-loader, sem STOP): `DATABASE_URL_UNPOOLED` e
  `DATABASE_RESTORE_URL` são lidas pelo guard mas não têm entrada no
  `.env.example` — lacuna de documentação, não de carregamento.

## Conclusão

Conformidade 6/6 (SIM × 6). Mapa fechado: todo `.env` em runtime de
teste/dev/mutação entra por UM caminho — `node --env-file-if-exists=.env`
nos 10 hooks `pre*` — mais o auto-load nativo do Vite (mapeado, sem
arquivo `.env.[mode]` extra existente e sem mode colidente para o futuro
`.env.sanctioned-remote`). Nenhum `dotenv`, nenhum `--mode` além de
`build:dev`, nenhum auto-load não mapeado. Riscos residuais MB (`dev` com
dupla carga idempotente; `build` sem hook por desenho) estão mapeados na
tabela acima.
