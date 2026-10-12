# Auditoria Real de Produção — Log de evidências brutas

**Sessão:** 2026-10-12 (UTC), host do operador, sem mutação em produção.
**Repositório:** `Douglas0101/preco-que-da-lucro` (worktree local em `develop`).
**Regra:** este log registra medições e as **correções das próprias medições** — nunca apaga uma medição
anterior; uma medição refutada vira errata nomeada.

Capturas brutas: `captures/http-probes.txt`, `captures/git-and-versions.txt`.

---

## 1. Topologia descoberta

| Elo                                          | Valor medido                                                                                                                                                                                                                             | Fonte                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Repositório                                  | `Douglas0101/preco-que-da-lucro`                                                                                                                                                                                                         | `git remote -v`                       |
| Branches publicadas                          | `develop` = `182754fe98bb2f01ceafd5cad81bb890b71f18a3`, `main` = `40c1a35577c70c7d33424640648d52bfdedb8bde`                                                                                                                              | `git ls-remote` (2 refs)              |
| PR #61                                       | mergeado em `main` (`40c1a35` = "Merge pull request #61 from Douglas0101/develop"); `0807115` (CSP nonce) é ancestral de `main`                                                                                                          | `git merge-base --is-ancestor`        |
| Projeto Vercel                               | `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q` (`preco-que-da-lucro`), team `team_2NnkSYjw5NRHAFnQFEPSHGmW`                                                                                                                                          | MCP Vercel (antes da perda de escopo) |
| Deployment atribuído a `production` (GitHub) | `fa45632391ad9ffe1d20d3bad5264a53b565638e`, `2026-10-08T17:46:02Z`, criador `vercel[bot]`, env "Production – preco-que-da-lucro"                                                                                                         | GitHub Deployments API                |
| Projeto Neon                                 | `damp-forest-57346541` (AWS us-east-1)                                                                                                                                                                                                   | MCP Neon                              |
| Branches Neon existentes                     | `production` `br-snowy-violet-aymcvvvv` (**ready**, default, restricted: "vercel production branch"), `develop` `br-small-hill-aymcu14y` (**archived** em `2026-10-09T18:35:05Z`), `ci-fixture-base` `br-wandering-sky-ayxm5e5s` (ready) | `neon_list_branches`                  |
| PostgreSQL                                   | 17.11                                                                                                                                                                                                                                    | consulta read-only                    |

### 1.1 Aliases Vercel — dois comportamentos distintos, mesmo build

`preco-que-da-lucro-sage.vercel.app` e `preco-que-da-lucro.vercel.app` servem **o mesmo código** (15 hashes de
asset idênticos, `/` = 9891 bytes nos dois, `/auth` = 9063 bytes nos dois) e **comportamentos de banco
opostos**, de forma determinística (10 rodadas: 10/10 iguais; `captures/http-probes.txt`):

| Rota                    | `-sage`.vercel.app           | `preco-que-da-lucro`.vercel.app           |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| `/api/health/live`      | 200 `{"status":"ok"}`        | 200 `{"status":"ok"}`                     |
| `/api/health/ready`     | **200 `ready`, postgres ok** | **503 `not_ready`, postgres unavailable** |
| `/api/auth/get-session` | **200 `null`**               | **500** (página de erro do TanStack)      |
| `/auth`                 | 200                          | 200                                       |

Ler: mesma revisão de código, **configuração de ambiente diferente**. O alias com banco quebrado é o
**nome canônico do projeto**; o alias que funciona é o único caminho utilizável hoje.

### 1.2 Divergência de destino público

- `diretrizprecifica.com` e `www.diretrizprecifica.com` → **200 de um site estático de builder (Wix),
  `last-modified: 2026-09-06`**, com catch-all: **todo path devolve o mesmo documento**, inclusive
  `/api/health/ready` e `/api/health/live`, que respondem **200 `text/html`** — não o JSON do app.
- Consequência: qualquer `200` medido contra o domínio custom mede o **site estático**, não o produto.

### 1.3 Divergência de SHA

O `main` publicado (`40c1a355`) **não** tem registro de deployment de produção no GitHub; o registro mais
recente de `production` é `fa45632` (2026-10-08). `d4b9395` (release v1.0.1, 2026-10-01) é ancestral de
`main` e de `develop` e é a revisão servida pelo alias que funciona.

---

## 2. Provas HTTP reais contra produção (2026-10-12, UTC)

Captura bruta: `captures/http-probes.txt` (sessão `2026-10-12T01:09:42Z`).

| #   | Requisição                                               | Resultado medido                                                                            |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2.1 | `GET -sage/api/health/live`                              | 200 `{"status":"ok"}` (15 b)                                                                |
| 2.2 | `GET -sage/api/health/ready`                             | 200 `{"status":"ready","dependencies":{"postgres":"ok"}}` (51 b)                            |
| 2.3 | `GET preco-que-da-lucro.vercel.app/api/health/ready`     | **503** `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}` (64 b em 0,26 s) |
| 2.4 | `GET -sage/api/auth/get-session`                         | 200 `null` (4 b)                                                                            |
| 2.5 | `GET preco-que-da-lucro.vercel.app/api/auth/get-session` | **500** (1312 b, página "This page didn't load")                                            |
| 2.6 | `GET */api/health/readiness` (os três hosts)             | **404** — a rota **não existe** (o path do código é `/api/health/ready`)                    |
| 2.7 | `GET */api/health`                                       | 404 no app; 200 `text/html` (catch-all estático) no domínio custom                          |

### 2.8 ERRATA da primeira passada (medição anterior refutada)

- **ERRATA 2.8.1** — o log anterior afirmava `/api/health/readiness` → **200**. **Refutado**: essa rota
  devolve **404** (o arquivo do código é `src/routes/api/health/ready.ts`). O `200` anterior foi medido
  contra o **domínio custom**, cujo catch-all estático responde 200 a qualquer path.
- **ERRATA 2.8.2** — o log anterior afirmava "concatenação direta do domínio (18 chars) → 404".
  **Refutado**: `preco-que-da-lucro.vercel.app` responde **200** em `/` e `/auth` hoje.
- **ERRATA 2.8.3** — o log anterior dava `/api/health` → 200. **Refutado**: no app é **404**; no domínio
  custom é o catch-all estático (`text/html`).
- **Lição registrada:** medir `status` sem inspecionar `content-type` e o corpo produz **falso-verde**. Toda
  prova HTTP deste relatório passa a registrar código **+ content-type + primeiros bytes**.

---

## 3. Computer Use (navegador real, Playwright MCP) — produção

| #   | Página/ação                          | Resultado observado                                                                                                                                |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `-sage/`                             | 200, `<title>Preço que Dá Lucro — …</title>`, **console: 4 mensagens / 0 erros**                                                                   |
| 3.2 | `-sage/auth`                         | 200, formulário (Google, e-mail/senha, entrar, cadastrar, esqueci minha senha)                                                                     |
| 3.3 | `-sage/inicio` sem sessão            | redireciona para `/auth?redirect=%2Finicio` (**proteção de rota funciona**) com **1 erro de console**: `GET /_serverFn/<hash>?payload=…` → **401** |
| 3.4 | Rotas autenticadas                   | **BLOCKED** — não há identidade de teste autorizada nesta sessão                                                                                   |
| 3.5 | Login com credencial inválida        | **NÃO EXECUTADO** — escreve em `rate_limits` (produção); exige autorização explícita                                                               |
| 3.6 | Viewports móveis / zoom / orientação | **NOT TESTED** — o MCP Playwright usado não expõe controle de viewport                                                                             |

---

## 4. Piso de segurança das dependências TanStack (GHSA-qx66-fv34-fjm8 / CVE-2026-102989)

Piso obrigatório (AGENTS.md, `scripts/dependency-policy.json`): `@tanstack/react-start >= 1.168.60` e
`@tanstack/start-server-core >= 1.169.39`. Captura: `captures/git-and-versions.txt` (lido do
`package-lock.json` de cada revisão).

| Revisão                                          | Data       | `react-start` | `start-server-core` | Veredito                |
| ------------------------------------------------ | ---------- | ------------- | ------------------- | ----------------------- |
| `d4b9395` (servida pelo alias que funciona hoje) | 2026-10-01 | **1.168.49**  | **1.169.31**        | **VIOLA os dois pisos** |
| `fa45632` (deployment de `production`)           | 2026-10-08 | 1.168.60      | 1.169.39            | no piso exato           |
| `182754f` (`develop`)                            | 2026-10-11 | 1.168.60      | 1.169.39            | no piso exato           |
| `40c1a355` (`main`, PR #61)                      | 2026-10-11 | 1.168.60      | 1.169.39            | no piso exato           |

Leitura: **a única instância funcional da aplicação em produção roda as duas dependências abaixo do piso de
segurança**, e o fornecedor recusa reconstruir aquela revisão (`BLOCKED_PACKAGE`, evidência do pacote de
2026-10-08) — a remediação exige publicar uma revisão nova.

---

## 5. Capacidade de diagnóstico do deployment atual (medido no código + no comportamento)

- `src/routes/api/health/ready.ts` atual (develop) registra `classifyDatabaseFailure(error)` + identidade do
  deployment; a revisão **`fa45632` publicada não tem** esse discriminador (evidência do pacote
  `production-runtime-incident-2026-10-08`), por isso o 503 de hoje **não** pode ser classificado em
  `dns|connect|tls|auth|pool|query` a partir de fora.
- `src/db/client.server.ts` (develop) já usa `readEnv("DATABASE_URL")`: string **definida e vazia** agora
  falha explícita em vez de cair em `localhost:5432` (a classe do 503 de produção).

## 6. Limitações declaradas nesta sessão

1. MCP Vercel passou a **403** ("You must re-authenticate to this scope") no meio da sessão → sem listagem
   de deployments/domínios/logs, sem leitura de env vars (nunca valores) e sem confirmação por API da
   atribuição alias↔deployment.
2. `pg_stat_statements` não instalado em produção → sem telemetria de queries lentas.
3. Sem identidade de teste autorizada → fluxos autenticados em produção = BLOCKED.
4. Sem controle de viewport no navegador controlado → responsividade = NOT TESTED em produção.
