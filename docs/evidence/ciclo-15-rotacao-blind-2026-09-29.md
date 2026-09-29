# Ciclo 15 (parcial) — captura cega, sondas de credencial e H-6; a rotação em console segue bloqueada

- **Data:** 2026-09-29 · **HEAD:** `6b8704a0b65eaa4e0c53697f5289a5e0a6473e5c` · **Branch:** `feature/contract-guard-bff`
- **Brief:** "Ciclo 15 — FULL-AUTONOMOUS" (rotação via MCP, H-Panel, deployment de produção, relaunch de MCP)
- **Veredito:** **executado o que o ambiente permite; 5 premissas do brief refutadas por medição; a
  rotação das 4 credenciais segue bloqueada** (sem sessão autenticada nos consoles e sem os
  adaptadores por provedor que o próprio lado do sidecar declara pendentes). O **H-6 foi destravado
  pelo login do operador e concluído** — build verde, app no ar e health 200 nos caminhos reais.
- **Incidente declarado:** dois valores vivos (`DATABASE_URL` e `BETTER_AUTH_SECRET`) chegaram ao
  contexto do agente via snapshot de acessibilidade da tela `settings` do hPanel. Nenhum valor foi
  repetido, nenhum artefato/commit o contém e as capturas locais foram removidas sem leitura
  (§4). É a mesma classe de contenção dos incidentes `L195`–`L198`.

## 1. Premissas do brief × medição

| Premissa do brief                                       | Medição                                                                                                                                        | Veredito                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Sidecar instalado e API `read_keys_txt`/`test_endpoint` | instalado (`~/.mcp-runtime/secret-sidecar/bin/sidecar` → repo); API real é `capture`/`copy-out`/`test`/`inject`/`denylist`; **não lê arquivo** | **refutada**                |
| `Keys.txt` com credenciais válidas                      | 4/4 do registry sondadas contra endpoints reais: **200**                                                                                       | **confirmada**              |
| H-Panel logado no Chrome                                | MCPs em `about:blank`; `auth.hostinger.com/login` no canal de automação; **operador fez login depois** (14:2x)                                 | refutada; depois satisfeita |
| Vercel dashboard acessível (sessão ativa)               | `vercel.com/dashboard` → `Login – Vercel`; token Vercel válido mas sem escopo no projeto (§3.4)                                                | **refutada**                |
| `DBT-37` = relaunch do cliente MCP                      | `DBT-37` é a prosa de prazo do `REGISTRO-H` × `.arm`; o ATTEST de relaunch é outro (`L225`)                                                    | **refutada**                |
| CI bloqueada por cota                                   | runs de 2026-09-28 executam com 40 steps, sem anotação de billing; PR #49 aberto (`UNSTABLE`)                                                  | **refutada**                |

## 2. Executado — canal cego provado e sondas medidas

1. **Rehearsal com fictício** (pré-condição antes de tocar valor real): `stdin → wl-copy → capture`
   → `restore` → `delete`; clipboard relido **0 bytes**. `selftest --backend=cofre` = **5/5 PASS**.
2. **Capturas cegas** das 4 credenciais do registry, sem valor em stdout/stderr/audit. Hash de
   referência (sha256) do que está no cofre:

   | ref             | sha256                                                             |
   | --------------- | ------------------------------------------------------------------ |
   | `neon-antigo`   | `10bd52b9068b13e4ecf095d72b0fccdf101e7838173c12f36427acfad8fd2f7b` |
   | `vercel-antigo` | `31ae3503910b6b7665d2f20c945b59a0a6ed61f6ffb39ebd1b7de7aba08e470c` |
   | `github-antigo` | `688fceb9c44974f0b6d9ba84e0ab6dde09103a640a8f8f15890a9430c0b98873` |
   | `sonar-antigo`  | `1c916a95f3d63cf3f1e701b63cbb856665c5c0c34466ff8b76ad4d30ff9693b3` |

3. **Sondas de autenticação** (`test --kind=http`, GET com `Authorization: Bearer`), todas **200**:
   `console.neon.tech/api/v2/users/me`, `api.vercel.com/v2/user`, `api.github.com/user`,
   `sonarcloud.io/api/authentication/validate`. O par 200/401 do closure da DBT-36 tem a **metade
   "valor antigo ainda autentica"** medida; falta a rotação para produzir o 401.
4. **Escopo do token Vercel (DBT-31 re-medida):** `/v9/projects/preco-que-da-lucro` = **404**,
   `/v2/teams` = **403** ⇒ o bloqueador "o token não alcança o time/projeto" **persiste**.
5. **Vínculo criptográfico achado:** o literal `GITHUB_PERSONAL_ACCESS_TOKEN` em
   `~/.config/mcp/mcp.json` (guard `--home`, violação de segredo) tem sha256 prefixo
   `688fceb9c449…` — **é o mesmo token** capturado de `Keys.txt` (`github-antigo`). Rotacionar o PAT
   sem atualizar essa config quebra o binding MCP; a ordem do runbook (sidecar → rotação) segue
   correta.
6. **Audit do sidecar:** 131+ linhas, **0 malformadas**; `verify` OK. Nenhum valor em log.

## 3. H-6 — homologação hPanel (destravada pelo operador e **concluída**)

### 3.1 Causa raiz lida nos logs

Última implantação `01a098c7-…` (branch `main`, commit `9724d2c7`, a única tentada): **17 linhas,
`npm error code EBADENGINE`** — `Required: {"node":">=24.15.0"}` × `Actual: {"node":"v24.6.0"}`,
terminando em `ERROR: Failed to install dependencies`. O `engines` do `package.json` excede o Node
do builder; o remédio prescrito (`NPM_CONFIG_ENGINE_STRICT=false`) foi aplicado e **funcionou**.

### 3.2 Mutação executada (autorizada pelo login do operador)

- Env vars adicionadas pela UI: `NPM_CONFIG_ENGINE_STRICT=false`,
  `BETTER_AUTH_URL=https://darkgray-pony-545965.hostingersite.com`,
  `AUTH_TRUSTED_ORIGINS=https://darkgray-pony-545965.hostingersite.com` (nenhuma é segredo).
- **Gap medido e contornado:** o formulário de `settings` listava só as **11** vars originais; um
  `Salvar e reimplantar` direto as derrubaria. As 3 linhas foram adicionadas ao formulário **por
  DOM** (sem snapshot da tela, que renderiza valores em texto plano) e o save submeteu **14**.
- **Reimplantação** disparada; novo registro `2026-09-29 11:31:24`, status **"Concluído Atual"**.
- Nenhum outro site da conta foi tocado; nenhum DNS/SSL/redirect alterado (medidos corretos).

### 3.3 Gates medidas no alvo (após o deploy)

| gate                                            | antes             | depois         |
| ----------------------------------------------- | ----------------- | -------------- |
| `GET /`                                         | 200 (placeholder) | **200 (app)**  |
| `GET /api/health/ready`                         | 404               | **200**        |
| `GET /api/health/live`                          | 404               | **200**        |
| `GET /ready` / `GET /live` (caminho do watcher) | 404               | **404**        |
| `http → https`                                  | 301               | 301            |
| TLS                                             | válido            | válido (07/12) |

O `<title>` servido é o do app (`Preço que Dá Lucro — …`), não o placeholder. **Achado:** o watcher
`app-live-watch` está armado com `paths='/ready /live'`, mas a convenção real das rotas é
`/api/health/ready` e `/api/health/live` — o watcher **nunca** poderá ficar verde mesmo com o app
saudável. Candidato a registro no `DEBTS.md` (escritor: MAESTRO).

## 4. Incidente de exposição (contenção executada)

A rota `.../node/deployments/settings` renderiza os valores das env vars **em inputs de texto**
(diferente da tela de variáveis, que mascara com `•••`). Um snapshot de acessibilidade da região
`main` trouxe `DATABASE_URL` (senha Neon) e `BETTER_AUTH_SECRET` (64 hex) para o contexto do agente.
**Não houve screenshot, commit, nem repetição em documento.** Contenção: os arquivos de captura
desta sessão sob `.playwright-mcp/` foram **removidos sem leitura** (23 arquivos, em três passagens);
o diretório é gitignored. **Lições:** (a) a redaction precisa cobrir **snapshot de acessibilidade**,
não só pixels; (b) a tela `settings` do hPanel é superfície de exposição e não deve ser snapshotada
— operar por DOM sem dump. A `BETTER_AUTH_SECRET` exposta é exatamente a classe que a DBT-31 já
manda rotacionar; isso **aumenta a urgência** do Ciclo de rotação, não a substitui.

## 5. Achados colaterais

- **`Keys.txt` tem 6 credenciais, não 4:** além das do registry, uma `alnum-43` com sufixo opaco e
  a rotulada `API-DeepSeek` — **declaradas e intocadas** até decisão de escopo.
- **`Sonar.txt`** (raiz do repo) contém uma linha de 40 hex com forma de token; coberto pelo
  `.gitignore` (`Sonar*.txt`), fora do histórico — mas é mais um plaintext no disco.
- **`Keys.txt` é `-rw-rw-r--`** (legível por qualquer usuário da máquina) — higiene a corrigir.
- **MCP runtime (escopo-máquina):** 7 violações no guard `--home`, incluindo o PAT literal (§2.5).
- **Rotas de health existem em `origin/main`** (`src/routes/api/health/{ready,live}.ts`) — o deploy
  verde as serve; o que está errado é o caminho que o watcher consulta.

## 6. Não executado, e por quê

1. **Rotação das 4 credenciais (F15-1/DBT-36):** os consoles não tinham sessão no canal de
   automação; o fluxo do brief supõe `read_keys_txt`/`inject_env_console`, que **não existem** — o
   README do sidecar declara que os adaptadores por provedor são entrega **deste** Ciclo 15. Uma
   rotação pela UI sem adaptador e sem o par 200→401 verificado seria cobertura aparente.
2. **`BETTER_AUTH_SECRET` (F15-2/DBT-31):** sem canal Vercel (login) e o token não alcança o
   projeto (404/403); ver §2.4.
3. **Deployment de produção Vercel (F15-3):** só existem deployments `Preview – …`; o contrato do
   repositório é "produção só de `main`", e a `main` está 406 commits atrás de `develop`. Promover
   um preview de feature branch a produção violaria o contrato — decisão de release é do MAESTRO.
4. **Hostinger DNS/SSL/redirects:** medidos **já corretos** e inaplicáveis (subdomínio gratuito, sem
   zona própria); o que faltava era o deploy, feito (§3).
5. **Relaunch de MCP (F15-5):** o brief confunde `DBT-37`; o ATTEST real (`L225`) é recarregar o
   cliente do harness. `verify-mcp-relaunch.sh` estático = **OK**; a config viva segue com as 7
   violações (corrigi-la é o passo do runbook `mcp-relaunch.md`, fora do escopo do brief).

## 7. Higiene e gates do repositório

- `m02:state:check` verde no boot (**folga 2/13**); `m02:lockfile-guard` **exit 0**;
  `m02:secrets-audit` **exit 0** (0 literais, cobertura sem falhas); `m02:temporal-guard` e
  `m02:debts-guard` verdes; `guard:mcp-runtime` (escopo-repo) **exit 0**.
- Cofre ao fim: 4 refs `*-antigo` (necessárias para o par 401 da futura rotação) + audit íntegro.
- Nenhum push, nenhum `run@sha` novo cunhado, nenhum segredo em artefato versionado.

## 8. Próximos passos (fila humana)

1. **Ciclo de rotação** com sessões autenticadas nos 4 consoles (ou adaptadores por provedor do
   sidecar) e o operador disponível para 2FA; ordem do runbook `secret-rotation-blind.md`.
2. **Mover o PAT de `~/.config/mcp/mcp.json` para o cofre** (runbook `mcp-relaunch.md`) e recarregar
   o cliente — a rotação do PAT depende disso para não quebrar o binding.
3. **Corrigir o caminho do watcher** (`/ready /live` → `/api/health/*`) ou o registro que o cita.
4. **Decidir escopo** das duas credenciais extras de `Keys.txt`; corrigir permissão do arquivo.
5. **Release**: avaliar `develop → main` (406 commits) antes de qualquer produção.
6. `DEBTS.md` — atualização é do **MAESTRO** (agente não edita); este documento propõe:
   `DBT-36` segue **ABERTA** (captura+sondas feitas; rotação pendente), `DBT-31` sem mudança, e um
   registro novo para o **descasamento watcher × rota de health**.
