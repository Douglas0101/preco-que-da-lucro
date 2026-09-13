# Evidência — F-VER / DOCMAP Vercel + leitura dos probes

| Campo       | Valor                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rodada      | produção preco-que-da-lucro — 2026-09-12                                                                                                                |
| Frente      | F-VER (docmap Vercel + hipóteses doc-fundamentadas para 404 e 302)                                                                                      |
| Owner       | plataforma/frontend                                                                                                                                     |
| Escopo      | documentação oficial Vercel (env vars, redeploy, build/preset, deployment protection, aliases/domains, Nitro) + leitura dos probes de 2026-09-12T03:06Z |
| Regra ativa | DOC-FIRST (permanente): toda afirmação operacional sobre sistema externo deve citar doc oficial (URL + seção)                                           |
| Segredos    | Nenhum valor de env/secret é impresso neste documento — somente nomes/estados                                                                           |

## AVISO DE MÉTODO (GAP-DOC-01 — bloqueio de capacidade, não de conteúdo)

> **Este subagente foi executado sem nenhum tool de web** (`web_search`/fetch/`source_check`).
> As ferramentas disponíveis nesta execução foram apenas leitura/escrita de arquivos locais e
> mensagens ao supervisor. Portanto **a consulta web exigida pela REGRA DOC-FIRST NÃO foi
> executada nesta rodada**.
>
> Consequência declarada: **todas as referências a `vercel.com/docs` e `nitro.build` abaixo são
> citações de conhecimento offline do modelo, marcadas individualmente como
> `NÃO VERIFICADA NESTA RODADA`**, com URL e seção-alvo para a verificação. Nenhuma delas deve ser
> tratada como evidência válida para decisão antes da passagem web.
>
> O que É evidência direta nesta rodada: os arquivos do repositório lidos (código, contrato de
> deployment em `AGENTS.md`) e os dois resultados de probe informados no mandato.

## Summary

Os dois sintomas observados são explicáveis por **uma única causa provável**: o projeto existe no
Vercel (há um deployment imutável em `preco-que-da-lucro-f03gpvmth.vercel.app`), mas **não há
deployment de produção ativo associado ao alias canônico** `preco-que-da-lucro.vercel.app`
(⇒ `404 DEPLOYMENT_NOT_FOUND`), enquanto o deployment específico está sob **proteção de
deployment** do Vercel (⇒ `302` de redirecionamento para autenticação, em todas as rotas,
inclusive `/api/health/live`). O `302` **não pode ser comportamento da aplicação**: o handler de
`/api/health/live` no repositório responde `200` JSON sem consultar banco — evidência direta de
código. Faltam, para fechar o diagnóstico, (a) a verificação web das docs oficiais e (b) os headers
brutos dos probes; o resto depende de token (inventário de projeto/alias/deployments).

## Findings

### Grupo A — Evidência direta do repositório (verificável localmente)

1. **Claim:** a rota `/api/health/live` é pública e responde `200` JSON `{"status":"ok"}` com
   `cache-control: no-store`, sem dependência de banco. **Sources:**
   `src/routes/api/health/live.ts` (lido). **Support:** direct evidence (código). **Confidence:**
   high.
   - Inferência (researcher inference): logo, o `302` recebido em
     `preco-que-da-lucro-f03gpvmth.vercel.app/api/health/live` **não** pode ter origem no roteamento
     da aplicação; ele é emitido antes do handler, na borda/proxy da plataforma.

2. **Claim:** existe rota separada de readiness (`/api/health/ready`) que consulta o Postgres e
   retorna `503` com `{"status":"not_ready"}` quando o banco está indisponível. **Sources:**
   `src/routes/api/health/ready.ts` (lido). **Support:** direct evidence (código).
   **Confidence:** high.
   - Implicação operacional (inference): falha de banco **não** explica `404`/`302` em `/live`; o
     probe de liveness é o indicador correto para "deployment/alias existe e é alcançável".

3. **Claim:** o preset do Nitro é escolhido por ambiente em `vite.config.ts`:
   `nitro: { preset: process.env.VERCEL ? "vercel" : "node-server" }`. Em builds fora da Vercel
   (local/CI/Hostinger) o output é o Node server (`.output/server/index.mjs`); em build Vercel o
   output esperado é a Build Output API (`.vercel/output`). **Sources:** `vite.config.ts` (lido);
   `package.json` (`start`, `preview`, devDependency `nitro: 3.0.260603-beta`) (lido);
   `AGENTS.md` §"Deployment contract (Vercel)" (lido). **Support:** direct evidence (código).
   **Confidence:** high (fato do repo). A validade do preset `vercel` no Nitro 3 beta é
   `NÃO VERIFICADA NESTA RODADA`.

4. **Claim:** não existe arquivo `vercel.json` no repositório e não existe link local
   `.vercel/project.json`. **Sources:** tentativas de leitura em
   `/home/douglas-souza/preco-que-d-main/vercel.json` e `.vercel/project.json` → `ENOENT`
   (lido). **Support:** direct evidence (ausência observada). **Confidence:** high.
   - Consequência (inference, corroborada por `AGENTS.md`): **toda** a configuração de build,
     instalador, domínio, proteção e env do alvo Vercel vive no dashboard → é drift out-of-repo e
     **não é reproduzível a partir do repo**; o inventário exige token.

5. **Claim:** o contrato do projeto já registra que settings só-dashboard são drift e devem ser
   registrados em `docs/evidence/`; previsões buildam por branch/PR e produção só de `main`
   (ADR-017). **Sources:** `AGENTS.md` §"Deployment contract (Vercel)";
   `docs/adr/ADR-017-branching-strategy.md` (lido). **Support:** direct evidence (documento
   normativo). **Confidence:** high.

### Grupo B — Docmap oficial (autorreferências a verificar via web)

1. **Claim:** as referências a usar para cada afirmação operacional desta frente são as listadas na
   tabela abaixo. **Support:** researcher knowledge (offline) — **todas `NÃO VERIFICADAS NESTA
RODADA`**. **Confidence:** low até a passagem web (GAP-DOC-01).

| #   | Tema                                | Doc oficial (URL-alvo)                                                                                               | Seção-alvo a citar                                                                                   | O que deve ser confirmado na doc                                                                                                                 |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Environment variables               | <https://vercel.com/docs/environment-variables>                                                                      | "Managing environment variables", "Environments", "Redeploying"                                      | escopos Production/Preview/Development; mudança de env **não** se aplica a deployment existente; exige novo deployment/redeploy                  |
| D2  | System environment variables        | <https://vercel.com/docs/environment-variables/system-environment-variables>                                         | lista de variáveis de sistema                                                                        | presença/exatidão de `VERCEL=1`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_TARGET_ENV`, `VERCEL_GIT_COMMIT_REF` (base do `process.env.VERCEL` do repo) |
| D3  | Redeploy                            | <https://vercel.com/docs/deployments/redeploy>                                                                       | "Redeploy a deployment"                                                                              | quais settings/env o redeploy reaproveita; relação com build cache                                                                               |
| D4  | Build config                        | <https://vercel.com/docs/builds/configure-a-build>                                                                   | Build Command, Install Command, Output Directory, Framework Preset, "per environment"                | Install/Build Command customizados **substituem** o default do framework (lição PR #42)                                                          |
| D5  | Build Output API v3                 | <https://vercel.com/docs/build-output-api/v3>                                                                        | estrutura `.vercel/output` (`config.json`, `functions/`, `static/`)                                  | o que a Vercel exige para servir um output pré-construído                                                                                        |
| D6  | Frameworks / preset                 | <https://vercel.com/docs/frameworks>                                                                                 | Framework presets / "Other"                                                                          | detecção automática de preset e override no dashboard                                                                                            |
| D7  | Deployment Protection (visão geral) | <https://vercel.com/docs/deployment-protection>                                                                      | "Vercel Authentication", "Standard Protection", "Password Protection"                                | **qual método está ativo por default** e **qual o escopo** (preview vs deployment URL vs domínio de produção)                                    |
| D8  | Protection Bypass for Automation    | <https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation> | headers `x-vercel-protection-bypass`, `x-vercel-set-bypass-cookie`                                   | como um probe automatizado atravessa a proteção (e o nome da env `VERCEL_AUTOMATION_BYPASS_SECRET`)                                              |
| D9  | Deployment URLs                     | <https://vercel.com/docs/deployments/deployment-urls>                                                                | formato do host de deployment                                                                        | confirmar que `<project>-<hash>.vercel.app` é URL imutável **por deployment** (explica `f03gpvmth`)                                              |
| D10 | Aliases                             | <https://vercel.com/docs/deployments/aliases>                                                                        | "Production alias", assign/remove alias                                                              | que o domínio `<project>.vercel.app` é alias de produção e **o que acontece quando não há target**                                               |
| D11 | Domains                             | <https://vercel.com/docs/domains/working-with-domains>                                                               | atribuir domínio a projeto; domínio `*.vercel.app`                                                   | como um domínio pode ficar sem deployment associado (origem do 404)                                                                              |
| D12 | Error code 404                      | <https://vercel.com/docs/errors/DEPLOYMENT_NOT_FOUND>                                                                | `DEPLOYMENT_NOT_FOUND`                                                                               | semântica exata: hostname sem deployment/alias alvo; status 404                                                                                  |
| D13 | Catálogo de erros                   | <https://vercel.com/docs/errors>                                                                                     | índice de códigos                                                                                    | distinguir `DEPLOYMENT_NOT_FOUND` de `NOT_FOUND`/`DEPLOYMENT_DISABLED`                                                                           |
| D14 | CLI                                 | <https://vercel.com/docs/cli>                                                                                        | `alias`, `inspect`, `ls`, `env`, `project(s)`, `promote`, `redeploy`                                 | nomes **atuais** dos subcomandos (mudam entre versões) e o que cada um exige                                                                     |
| D15 | REST API                            | <https://vercel.com/docs/rest-api/reference>                                                                         | `GET /v9/projects/{idOrName}`; `GET /v6/deployments`; `GET /v4/aliases`; `GET /v9/projects/{id}/env` | inventário via token; **atenção**: endpoint de env retorna valores descriptografados                                                             |
| D16 | Nitro provider Vercel               | <https://nitro.build/deploy/providers/vercel>                                                                        | provider/preset `vercel`                                                                             | que o preset `vercel` emite Build Output API v3 em `.vercel/output`                                                                              |

1. **Claim:** a leitura correta de D1/D3 para esta frente é: **alteração de env var ou de build
   setting não altera deployments já existentes; é necessário um novo deployment (ou redeploy)**.
   **Support:** researcher knowledge (offline) — NÃO VERIFICADA. **Confidence:** medium (alta
   probabilidade, precisa citação literal da seção).
   - Por que importa (inference): as observações `404`/`302` podem ser _estado de configuração_
     (produção nunca deployada / proteção ligada), e não bug de código; corrigir exige novo
     deployment + verificação dos escopos de env (ex.: `CSP_ENFORCE`, `DATABASE_URL` existindo em
     Preview mas não em Production).

### Grupo C — Hipóteses para o 404 (doc-fundamentadas) + teste que confirma

1. **Claim (H1):** `404 DEPLOYMENT_NOT_FOUND` em `https://preco-que-da-lucro.vercel.app/api/health/live`
   é o erro de borda para **hostname sem deployment/alias alvo**, não um 404 de rota da aplicação.
   **Sources:** D12/D13 (a verificar); `src/routes/api/health/live.ts` (evidência direta: a rota
   existe). **Support:** interpretation + doc a verificar. **Confidence:** medium-high.
   - Sub-hipóteses mutuamente exclusivas entre si, mas todas determinadas por estado no dashboard:
     - **H1a — nunca houve deployment de produção** (só previews). O alias de produção existe como
       hostname, mas não tem target. Compatível com o host `-f03gpvmth` ter aparência de deployment
       imutável.
     - **H1b — o deployment de produção existe, mas o domínio/alias de produção foi removido ou
       reapontado** (inclusive por intervenção manual no dashboard).
     - **H1c — o deployment de produção anterior foi deletado/expirou** e o alias ficou pendurado.
   - **Teste que separa H1a/H1b/H1c (exige token):** listar deployments por target e aliases:
     `GET /v6/deployments?projectId=<id>&target=production` (ou `vercel ls`/`vercel inspect`) e
     `GET /v4/aliases` (ou `vercel alias ls`). Resultado: existir **0** deployment de produção ⇒
     H1a; existir ≥1 produção e nenhum alias apontando para ele ⇒ H1b; existir produção e o alias
     apontar para um deployment inexistente/removido ⇒ H1c.
   - **Teste público que confirma a semântica de borda:** comparar o mesmo path em três hostnames
     (canônico, deployment imutável-git-branch, deployment imutável-hash). Se o corpo/HTML do 404
     for a página de erro da Vercel (código `DEPLOYMENT_NOT_FOUND`, Request ID) e não o
     `NotFoundComponent` do app, fica provado que a resposta vem da plataforma.

### Grupo D — Hipóteses para o 302 + teste que confirma

1. **Claim (H2 — principal):** o `302` em `preco-que-da-lucro-f03gpvmth.vercel.app` (em `/api/health/live`
   **e** nas rotas de auth) é **redirect de proteção de deployment** da plataforma para
   autenticação. O padrão histórico do Vercel Authentication é responder `302` com `Location`
   apontando para o domínio de SSO da Vercel (`vercel.com/sso-api?...`) e devolver
   `_vercel_jwt` após autenticar. **Sources:** D7/D8 (a verificar); `src/routes/api/health/live.ts`
   (evidência direta: a rota não redireciona). **Support:** interpretation do padrão + doc a
   verificar. **Confidence:** medium.
   - **Por que o 302 e não 401 (inference):** o método de proteção determina o formato da resposta;
     respostas `401` com HTML de login também são documentadas para proteção. Por isso o teste
     decisivo é ler os headers, não o status isolado.
   - **Teste público que confirma/refuta H2:** capturar headers sem seguir redirect e inspecionar
     `Location`, `set-cookie`, `x-vercel-id`:
     `curl -sS -o /dev/null -D - -H 'User-Agent: Mozilla/5.0' https://preco-que-da-lucro-f03gpvmth.vercel.app/api/health/live`
     - `Location` apontando para `vercel.com/sso-api` / página de login Vercel ⇒ H2 confirmada
       (proteção de deployment).
     - `Location` relativo no mesmo host (ex.: `/login`) ⇒ H3/H4 (redirecionamento de aplicação ou
       de dashboard), não proteção.
     - `401` com HTML de login/password ⇒ proteção confirmada por método diferente (Password
       Protection / Vercel Authentication).
   - **Teste de bypass (confirma proteção com certeza):** repetir com os headers de
     Protection Bypass for Automation (D8), usando a env `VERCEL_AUTOMATION_BYPASS_SECRET`
     (**nome apenas** — valor nunca impresso).
     `curl -sS -o /dev/null -w '%{http_code}\n' -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" https://preco-que-da-lucro-f03gpvmth.vercel.app/api/health/live`
     Retorno `200` no bypass + `302` sem bypass ⇒ proteção de deployment confirmada como causa do
     `302`.

2. **Claim (H3 — alternativa):** o `302` pode vir de **redirect configurado no dashboard**
   (`vercel.json`/project redirects), já que o repo não tem `vercel.json`. **Sources:** ausência de
   `vercel.json` (evidência direta); D4/D11 (a verificar). **Support:** interpretation.
   **Confidence:** low-medium.
   - Teste: mesmo `Location` observado determinará; se o destino for uma rota interna do app, H3 é
     candidata. Confirmável de forma definitiva só no dashboard/token.

3. **Claim (H4 — refutada para `/api/health/live`):** redirect da própria aplicação. **Sources:**
   `src/routes/api/health/live.ts` (evidência direta). **Support:** direct evidence.
   **Confidence:** high (refutação).
   - Inferência: como o handler devolve `200` sem redirecionar e o `302` ocorre em `/live` **e** em
     auth, o comportamento é transversal e pré-aplicação ⇒ plataforma.

4. **Claim (H5 — improvável):** `302` de normalização de URL/HTTPS. **Support:** knowledge offline.
   **Confidence:** low — normalizações da Vercel são `308` (permanentes), e o `302` observado em
   múltiplos paths com auth sugere proteção.

5. **Claim (H0 — hipótese integradora):** as duas observações têm **uma causa única**: o projeto
   tem deployment(s) **de preview** (sob Standard/Vercel Authentication ⇒ `302`) e **nenhum
   deployment de produção ativo** (⇒ alias canônico sem target ⇒ `404 DEPLOYMENT_NOT_FOUND`).
   **Support:** researcher inference construída sobre D7/D9/D10/D12 (todas a verificar) + evidência
   direta de código dos findings 1–4. **Confidence:** medium.
   - **Como refutar H0:** se um probe público contra um host de produção conhecido
     (`<project>-git-main-*.vercel.app` ou o próprio canônico após promover um deployment) retornar
     `200`/`302` controlado e o inventário mostrar target `production` ativo, H0 cai para H1b.

### Grupo E — Env vars / redeploy / preset (contrato de correção)

1. **Claim:** corrigir qualquer uma das causas acima exige **novo deployment** (promote/redeploy)
   porque mudanças de env var e de build settings não retroagem em deployments existentes.
   **Sources:** D1/D3 (a verificar). **Support:** interpretation. **Confidence:** medium.
2. **Claim:** se o build Vercel não emitir `.vercel/output`, o deployment não tem o que servir
   (não é o `404 DEPLOYMENT_NOT_FOUND`, que é de hostname, mas produziria erro de build/runtime).
   **Sources:** `vite.config.ts`, `AGENTS.md` §Deployment contract (evidência direta);
   D5/D16 (a verificar). **Support:** interpretation. **Confidence:** medium.
   - Teste read-only: `VERCEL=1 npm run build` em workspace isolado e verificar que
     `.vercel/output/config.json` existe (não rodar na rodada de produção sem aprovação).
   - Nota (direct evidence): `vite.config.ts` usa a **truthiness** `process.env.VERCEL` — compatível
     com `VERCEL=1`, mas sensível a qualquer definição vazia (`VERCEL=""`).

### Grupo F — Público vs dependente de token

1. **Claim:** o que dá para provar sem token e o que exige token/operador:

**Público (sem token, read-only, seguro nesta frente):**

| Verificação                                | Comando (exemplo)                                                                                 | O que decide                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Semântica do 404 (borda Vercel vs app)     | `curl -sS https://preco-que-da-lucro.vercel.app/api/health/live \| head -c 400`                   | corpo com código `DEPLOYMENT_NOT_FOUND`/Request ID ⇒ borda (H1)                    |
| Headers do 302                             | `curl -sS -o /dev/null -D - https://preco-que-da-lucro-f03gpvmth.vercel.app/api/health/live`      | `Location` (SSO Vercel vs rota interna), `set-cookie`, `x-vercel-id`               |
| Destino do redirect sem seguir             | `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' <url>`                                 | separa `302` de `307/308` e mostra o alvo                                          |
| Variante de UA (browser vs bot)            | mesma URL com e sem `-H 'User-Agent: Mozilla/5.0'`                                                | proteção costuma diferir entre browser e cliente não-browser                       |
| Bypass de proteção                         | com header de D8 (nome da env: `VERCEL_AUTOMATION_BYPASS_SECRET`)                                 | `200` no bypass ⇒ proteção de deployment confirmada                                |
| Existência/propagação DNS do host canônico | `dig +short preco-que-da-lucro.vercel.app` e `dig +short preco-que-da-lucro-f03gpvmth.vercel.app` | ambos resolvem ao edge da Vercel; **não** discrimina alias (registrar como limite) |
| Headers de plataforma no 404               | `curl -sS -D - -o /dev/null https://preco-que-da-lucro.vercel.app/api/health/live`                | presença de `server: Vercel`/`x-vercel-id`(e eventual `x-vercel-error`)            |

**Dependente de token (inventário — exige operador; nenhum valor de env é impresso):**

| Item de inventário                                                     | Via CLI (confirmar nomes em D14)                               | Via REST (D15)                                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Identidade/escopo (pessoal vs team) e projeto                          | `vercel whoami`, `vercel project ls`, `vercel project inspect` | `GET /v2/user`, `GET /v9/projects/{idOrName}`                                                                          |
| Target dos deployments (production vs preview) e histórico             | `vercel ls <project>`, `vercel inspect <deployment-url>`       | `GET /v6/deployments?projectId=<id>` (filtro `target=production`)                                                      |
| Aliases e para onde apontam                                            | `vercel alias ls`                                              | `GET /v4/aliases`, `GET /v4/aliases/{alias}`                                                                           |
| Domínios do projeto (`<project>.vercel.app` presente?)                 | `vercel domains ls`                                            | `GET /v9/projects/{id}/domains`                                                                                        |
| Build settings (install/build command, framework preset, root, output) | `vercel project inspect`                                       | `GET /v9/projects/{idOrName}` campos `buildCommand`, `installCommand`, `framework`, `rootDirectory`, `outputDirectory` |
| Deployment Protection ativa e escopo                                   | painel/Dashboard → Settings → Deployment Protection            | `ssoProtection` / `passwordProtection` em `GET /v9/projects/{idOrName}`                                                |
| Env vars — **somente nomes/ambientes/estado**                          | `vercel env ls`                                                | `GET /v9/projects/{id}/env` (**retorna valores descriptografados: não despejar em log/evidência**)                     |
| Branch de produção configurada                                         | `vercel project inspect` / dashboard                           | `GET /v9/projects/{idOrName}` (`link.type`, `productionBranch` quando presente)                                        |
| Ação corretiva (mutação — exige aprovação explícita do operador)       | `vercel promote <deployment-url>`, `vercel redeploy <url>`     | —                                                                                                                      |

1. **Claim:** nenhum dos testes públicos acima revela secret e nenhum deles muta estado.
   **Support:** interpretation sobre a natureza dos comandos. **Confidence:** high.
   - Nota (inference): `vercel promote`/`vercel redeploy` **mutam produção** e estão fora do escopo
     desta frente de pesquisa; só devem rodar com aprovação do operador.

## Contradictions

- **Doc ↔ observação:** o `302` observado só é compatível com proteção de deployment se a
  configuração ativa for um método que redireciona (SSO) em vez de responder `401` com HTML.
  A doc de Deployment Protection precisa ser lida literalmente para resolver isso (D7) — nesta
  rodada não houve acesso web, então a divergência fica **declarada**, não resolvida.
- **`AGENTS.md` (contrato) ↔ probe:** o contrato de deployment do repo diz "previews buildam por
  branch/PR; produção deploys só de `main`" e o README registra que a frente Vercel do PR #42 passou
  a deixar deployments de `develop` verdes. Isso é compatível com **existirem previews** e ainda
  assim **não existir produção** — ou seja, contrato e probe não se contradizem, mas o contrato
  **não** prova que produção existe. Registrado para não virar suposição.
- Nenhuma contradição interna encontrada nas evidências de código (`src/routes/api/health/*`,
  `vite.config.ts`).

## Missing evidence

- **GAP-DOC-01 (bloqueio de capacidade):** nenhuma doc oficial foi consultada via web nesta rodada;
  todas as 16 referências (D1–D16) estão `NÃO VERIFICADAS`. A passagem web é pré-requisito para
  qualquer afirmação "doc-first" desta frente.
- **Headers brutos dos probes de 2026-09-12T03:06Z:** não foram fornecidos (status/`Location`/
  `set-cookie`/`x-vercel-id`/corpo). Sem eles, H2 vs H3 e "borda vs aplicação" ficam em aberto.
- **Target dos deployments (production vs preview)** e existência de alias para
  `preco-que-da-lucro.vercel.app` — exige token.
- **Escopo do projeto** (conta pessoal vs team): não verificável offline; nenhum vínculo local
  (`.vercel/project.json` ausente).
- **Estado real da Deployment Protection** (método ativo e escopo: preview vs deployment URL vs
  domínio de produção) — exige token/dashboard.
- **Build settings do dashboard** (install/build command, framework preset, root directory, output
  directory, branch de produção) — exige token/dashboard. Sem isso, não é possível confirmar que o
  Install Command customizado substituto não está em uso (risco da lição PR #42).
- **Build logs** do(s) deployment(s) existentes, para checar emissão de `.vercel/output` (D5/D16).
- **Relação entre os deployments e `main`:** se algum push a `main` gerou deployment e o que
  aconteceu com ele.
- **Nomes/ambientes das env vars do projeto Vercel** (somente nomes/estados): não coletados.

## Sources

- **Kept — evidência local (leitura direta nesta rodada):**
  - `src/routes/api/health/live.ts` — prova que o handler de liveness é `200` JSON e não redireciona (base da refutação de H4).
  - `src/routes/api/health/ready.ts` — separa liveness de readiness e exclui "banco indisponível" como causa de `404`/`302` em `/live`.
  - `vite.config.ts` — seleção do preset Nitro (`vercel` vs `node-server`) e dependência de `process.env.VERCEL`.
  - `package.json` — scripts (`start` = Node server, `preview` = `nitro preview`), versão pinada `nitro@3.0.260603-beta`, Node/npm pinados.
  - `AGENTS.md` §"Deployment contract (Vercel)" e §"Security baseline" — contrato de preset, drift de dashboard, CSP.
  - `docs/adr/ADR-017-branching-strategy.md` — produção só via `main`; base do raciocínio sobre origem dos deployments.
  - `/home/douglas-souza/preco-que-d-main/vercel.json` e `.vercel/project.json` — ausência confirmada por `ENOENT`.
- **Kept — docs oficiais a verificar (D1–D16 da tabela do finding 6):** `vercel.com/docs` (environment-variables, deployments/redeploy, builds/configure-a-build, build-output-api/v3, frameworks, deployment-protection, deployment-urls, aliases, domains/working-with-domains, errors/DEPLOYMENT_NOT_FOUND, errors, cli, rest-api/reference) e `nitro.build/deploy/providers/vercel`. Status: **não verificadas nesta rodada (GAP-DOC-01)**.
- **Rejected/deprioritized:** nenhuma fonte descartada — não houve coleta web nesta rodada, portanto não houve triagem de SEO/redundância. Registrar como limitação do método, não como resultado.

## Next steps

1. **Executar a passagem web (fecha GAP-DOC-01):** percorrer D1–D16 coletando URL + seção literal,
   com prioridade para D7 (Deployment Protection: método default e escopo), D10/D11/D12 (alias sem
   target ⇒ `DEPLOYMENT_NOT_FOUND`) e D1/D3 (env var exige novo deployment).
2. **Coletar headers brutos dos dois probes** (comandos da tabela do finding 16 — públicos,
   read-only) e decidir H2 vs H3 por `Location`/`set-cookie`; usar o bypass de automação (D8) como
   teste confirmatório.
3. **Inventário com token (operador):** target dos deployments, aliases, domínios, build settings,
   proteção e branch de produção — **somente nomes/estados para env vars**.
4. **Só depois, ação corretiva com aprovação:** promover/redeployar para reatribuir o alias de
   produção e reexecutar os probes; registrar o resultado em `docs/evidence/` (contrato do
   `AGENTS.md` sobre mudanças no dashboard).

## Adendo do orquestrador — passagem web DOC-FIRST (2026-09-12T03:1xZ) — fecha PARCIALMENTE o GAP-DOC-01 (D1/D7/D16 verificados; D2–D15 pendentes)

Verificado pelo orquestrador via web (URL + seção):

- **Environment variables** — alteração de env var **não** se aplica a deployments existentes; exige novo deployment/redeploy: <https://vercel.com/docs/environment-variables/managing-environment-variables> ("Managing environment variables").
- **Nitro na Vercel** — preset suportado: <https://vercel.com/docs/frameworks/backend/nitro>.
- **Deployment Protection (Vercel Authentication)** — restringe o acesso ao deployment; requisição não autenticada é redirecionada ao SSO. Confirmado por header: `location: https://vercel.com/sso-api?url=...` + `set-cookie: _vercel_sso_nonce=...` (probe 2026-09-12T03:07:43Z).

Probes públicos timestamped (sem token, read-only):

| URL                                                       | Resultado                                                                                                                       | Leitura                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `preco-que-da-lucro.vercel.app/api/health/live`           | 404 `DEPLOYMENT_NOT_FOUND` (corpo da borda Vercel)                                                                              | **H1 confirmada**: hostname sem alias/target                               |
| `preco-que-da-lucro-f03gpvmth.vercel.app/api/health/live` | 302 → `vercel.com/sso-api` + `_vercel_sso_nonce`                                                                                | **H2 confirmada**: Deployment Protection ativa neste deployment            |
| **`preco-que-da-lucro-sage.vercel.app`**                  | **200** em `live` (`{"status":"ok"}`), `ready` (`{"status":"ready","dependencies":{"postgres":"ok"}}`) e `get-session` (`null`) | **há alias público verde com banco OK**; SHA exato pendente de token (H-2) |

Conclusão F-VER: "verde" **evidenciado** no alias `sage`; o alias canônico não tem target e o deployment sob proteção (host `-f03gpvmth` medido) `[INFERÊNCIA: vínculo com e6da247 pendente de token/H-2]`. Fechar o inventário (target/alias/proteção/build settings) exige token (H-2); correção só com aprovação.
