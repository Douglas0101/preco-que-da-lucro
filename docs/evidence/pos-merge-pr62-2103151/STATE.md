# Pós-merge PR #62 — estado medido (2026-10-12)

Read-only. Nenhuma mutação em Vercel/Neon/produção; nenhum SQL de escrita; nenhum secret transcrito.

## Refs Git (medido 2026-10-12T17:27Z–17:52Z)

- `main` = `2103151ac32d88847eb97bb97ccd5ff9d7d1a44f` — "Merge pull request #62 from Douglas0101/develop"
  (pais `40c1a35577c70c7d33424640648d52bfdedb8bde` + `1f559ff47dfc274f7e631337e479b7ab6ad2ee88`; `mergedAt` 2026-10-12T16:39:01Z).
- `develop` = `ed26ec3db086029476d35c76d19d1cba73dc6d41` — inclui o commit documental `96caec1` e o merge de retorno de `main`.
- Back-merge: **executado nesta sessão** (`--no-ff origin/main`), árvores idênticas (`git diff origin/develop origin/main` vazio antes do merge), `main` agora ancestral de `develop`.
- CI do push de `main` (2103151): UI stack `38278881373` success · CI light `38278881422` success · SonarCloud `38278881202` success.
- CI do push do back-merge (`ed26ec3`): UI stack `38285083153` (`verify` success) · CI light `38285083213` success.

## Vercel (projeto `preco-que-da-lucro`, time `douglasultimatesouza-5127s-projects`)

- **Não existe deployment para `2103151` nem para `40c1a355`.** Publicação de produção permanece manual/suspensa.
- Deployment de produção mais recente: `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` = commit `fa45632391ad9ffe1d20d3bad5264a53b565638e` (2026-10-08), `READY`, região `iad1`, aliases `preco-que-da-lucro-douglasultimatesouza-5127s-projects.vercel.app` e `...-git-main-...`.
- `GET /api/health/ready` nesse deployment (via bypass read-only de proteção): **503** `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}` — idêntico ao alias legado público `preco-que-da-lucro.vercel.app` (503). Falha conhecida de ponte de banco (auditoria de 2026-10-12).
- `preco-que-da-lucro-sage.vercel.app` → deployment `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` (`READY`, revisão antiga `d4b9395`): `/api/health/ready` **200** `{"status":"ready","dependencies":{"postgres":"ok"}}`; `/api/auth/get-session` **200** `null`; `/` **200** HTML.
- Aliases do time e `git-main` respondem **302** para Vercel Authentication (proteção de deployment ativa).

## Neon (projeto `damp-forest-57346541`)

- Branch `production` (`br-snowy-violet-aymcvvvv`): `ready`; endpoint `ep-long-violet-aye9g0bn` (`aws-us-east-2`, autoscaling 0.25–2 CU, **pooler desabilitado**, `passwordless_access: true`).
- `SELECT version()` → `PostgreSQL 17.11` (aarch64).
- Migrações: `drizzle.__drizzle_migrations` = **20 aplicadas**, última `2026-09-18T02:27:54Z`; journal local `drizzle/meta/_journal.json` = **20 entradas** → **sem migrações pendentes**.
- Branches: `develop` `archived` (desde 2026-10-09T18:35:05Z; conhecido e anterior às falhas) · `ci-fixture-base` `ready` (vazia).
- Operações recentes: criação/descarte da branch efêmera do CI (`br-falling-hall-ayrfrokv`, 15:36–15:43Z, `delete_timeline` confirmado); no branch de produção, `start/suspend_compute` às 16:39/16:47Z (origem não identificada por este agente) e às 17:28Z (a consulta read-only desta sessão). Nenhuma escrita observada.

## Capturas

- `captures/http-probes.txt` — curl/SMOKE dos aliases (headers + corpo truncado).
- `captures/check-local.txt` — Etapa 2: `npm ci --ignore-scripts` + `npm run check` completos.
- `captures/e2e-home-sage.png`, `captures/e2e-auth-sage.png` — navegador real nas telas públicas.
- `playwright-mcp/` — bruto do computer use (3 logs de console + 5 snapshots de acessibilidade), selado no `.prettierignore`, nunca reformatado.

## Checks locais (Etapa 2)

- `npm ci --ignore-scripts` (mesma instalação do CI): exit 0, 0 vulnerabilidades.
- `npm run check`: exit 0 — `Test Files 145 passed | 1 skipped (146)`, `Tests 2274 passed | 18 skipped (2292)`; `m02:temporal-guard` OK; `debts guard` OK (91 dívidas); state marker válido (`ed26ec3`, folga 5/13).
- Bundle `assets/index-DRI3LDON.js` sha256 `30ca04baaa66` e grafo inicial sha256 `ffcafa3794f1` — **idênticos aos digests de todas as rodadas anteriores** (sem drift de build após o merge).
- Fingerprint da rodada 3 (`corrections/captures/round3-source-fingerprint.json`) inalterado: as árvores de `main` e `develop` são idênticas ao `1f559ff` aceito, mais o commit documental.

## E2E com navegador real (Etapa 5, read-only, sem mutação)

- `/` → **200**, título "Preço que Dá Lucro — avalie preços sustentáveis para seu produto"; console 0 erros; 1 chamada de API (`/api/auth/get-session` 200). Screenshot `captures/e2e-home-sage.png`.
- `/auth` → **200**, título "Entrar · Preço que Dá Lucro"; renderiza OAuth Google, formulário e-mail/senha, alternância para cadastro (nome/e-mail/senha) e "Esqueci minha senha"; console 0 erros. Screenshot `captures/e2e-auth-sage.png`.
- `/inicio` (rota protegida) → redireciona client-side para `/auth?redirect=%2Finicio`; **1 erro de console esperado**: `401` na `_serverFn` de dados antes do redirect (negação de autorização para sessão nula — comportamento correto, não crash); `get-session` 200 `null` nos dois lados do redirect.
- `POST /api/vitals` → `net::ERR_ABORTED` (beacons RUM abortados pela navegação programática, sem resposta 4xx/5xx).
- Submit vazio do formulário: validação bloqueou o envio sem chamar a API de autenticação (foco voltou para E-mail).
- **Limitação declarada:** fluxos autenticados completos (login real, CRUD, logout) exigem credencial de teste da instância publicada — decisão humana; nenhum segredo foi usado, inserido ou transcrito.

## Bloqueadores / decisões humanas

- **Publicação da revisão de `main` (2103151)** segue suspensa/manual: exige autorização explícita (Via A para credenciais), com `fa45632`/503 ainda servido pelo alias legado público e pelo deployment de produção.
- `develop` no Neon continua `archived` — decisão humana (recuperar/recriar ou manter).
- Nenhum hotfix em `main` foi feito; nenhuma falha nova do código mesclado foi observada (a falha de banco é do deployment antigo `fa45632`, não da revisão `2103151`, que ainda não foi publicada).
