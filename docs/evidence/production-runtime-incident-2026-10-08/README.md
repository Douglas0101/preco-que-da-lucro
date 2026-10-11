# Incidente de runtime de produção, 2026-10-08

**Estado do pacote: EVIDENCE / DOCUMENTATION. Nenhuma correção foi aplicada. Nenhum
valor de credencial foi lido. Nenhuma mutação de produção foi executada.**

## Resultado corrente

A identidade de produção foi reconciliada e o sintoma do incidente foi recuperado
do lado do servidor. **A causa raiz continua NÃO isolada.**

- **VERIFIED.** O alias público `preco-que-da-lucro-sage.vercel.app` aponta para
  `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` (sha `d4b9395`), não para o deployment que
  falhou. A última escrita nesse alias foi em **2026-10-08T19:00:33.986Z**
  (`updatedAt` 1791486033986).
- **VERIFIED.** Hoje, pelo alias público: `/api/health/live` → `200
{"status":"ok"}`; `/api/health/ready` → `200 {"status":"ready","dependencies":
{"postgres":"ok"}}`; `/api/auth/get-session` → `200 null`.
- **VERIFIED.** O artefato decisivo do incidente **existe e foi recuperado**:
  `{"timestamp":"2026-10-08T17:50:54.712Z","level":"error","event":
"health.readiness_failed","dependency":"postgres","error":{"name":"Error",
"message":"Failed query: select 1 as ready\nparams: "}}` — 6 ocorrências
  (`count=6`), de `17:50:54.000Z` a `19:00:34.000Z`, todas em
  `dpl_6h2LTZX57soGiPP2oTurws7NsgVd`.
- **VERIFIED, e por isso NÃO isolada:** essa mensagem é o invólucro genérico do
  drizzle. `src/routes/api/health/ready.ts:14` passa o objeto `Error` cru para
  `logJson`, que serializa só `name` e `message`. A causa discriminante vive em
  `error.cause` e **não é serializada**. O artefato está disponível e continua
  não-discriminante — por defeito da própria chamada de log, não só por
  retenção.
- **UNDOCUMENTED no repositório:** a execução da contenção. `PROGRESS.md` L794
  ficou em `▶`. A plataforma tem o registro do alias; o journal não.

## Tabela de fatos

| #   | fato                                                                                                                                                                        | status                             | captura                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| 1   | Projeto `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`, time `team_2NnkSYjw5NRHAFnQFEPSHGmW`, framework `tanstack-start-lovable`, Node 24.x                                             | VERIFIED                           | `vercel-project-settings.json`                                        |
| 2   | `ssoProtection.enabled=true`, `deploymentType="all_except_custom_domains"`; `passwordProtection.enabled=false`                                                              | VERIFIED                           | `vercel-project-settings.json`                                        |
| 3   | Alias público → `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` (sha `d4b9395`, production, READY, build 2026-10-01)                                                                     | VERIFIED                           | `vercel-alias-sage.json`                                              |
| 4   | Última escrita do alias: 2026-10-08T19:00:33.986Z                                                                                                                           | VERIFIED                           | `vercel-alias-sage.json`                                              |
| 5   | `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` (sha `fa45632`, production, READY) **não** carrega o alias público                                                                       | VERIFIED                           | `vercel-deployment-new-dpl_6h2LTZX.json`                              |
| 6   | `dpl_4vNYvd5xcXRBjVRyRcp9Fri7mhxz` (sha `d4b9395`, production) está `ERROR` / `BLOCKED_PACKAGE` por `@tanstack/react-start@1.168.49`                                        | VERIFIED                           | `vercel-deployment-blocked-dpl_4vNYvd5.json`                          |
| 7   | `health/live` `200 {"status":"ok"}` hoje                                                                                                                                    | VERIFIED                           | `health-live.txt`                                                     |
| 8   | `health/ready` `200 {"status":"ready","dependencies":{"postgres":"ok"}}` hoje                                                                                               | VERIFIED                           | `health-ready.txt`                                                    |
| 9   | `get-session` `200 null` hoje (anônimo, contrato válido)                                                                                                                    | VERIFIED                           | `get-session.txt`                                                     |
| 10  | `/` serve HTML com SSR real: `<title>Preço que Dá Lucro — …</title>`, 3 `<script>`, 14 `modulepreload`, marcador `$tsr-stream-barrier`                                      | VERIFIED                           | `landing-headers.txt`                                                 |
| 11  | `/novo-produto` sem sessão redireciona no cliente para `/auth?redirect=%2Fnovo-produto`; título `Entrar · Preço que Dá Lucro`                                               | VERIFIED                           | `browser-client-redirect.txt`                                         |
| 12  | Sign-in com credencial inválida → `401` + toast `Invalid email or password`; nenhuma sessão criada                                                                          | VERIFIED                           | `browser-sign-in-invalid-401.txt`, `sign-in-invalid-401.txt`          |
| 13  | CSP é **report-only**, não enforcing; há violações de inline script (2), inline style (2) e eval (1)                                                                        | VERIFIED                           | `landing-headers.txt`, `browser-csp-report-only-violations.txt`       |
| 14  | Log de runtime: `7d` e `1h` → `400 bad_request`; `30m` → funciona                                                                                                           | VERIFIED                           | `vercel-runtime-logs-retention-boundary.txt`                          |
| 15  | `health.readiness_failed` em `dpl_6h2LTZX`, `count=6`, `17:50:54Z`–`19:00:34Z`                                                                                              | VERIFIED                           | `vercel-runtime-errors-7d.txt`                                        |
| 16  | 500 de `get-session` em `dpl_6h2LTZX`: `INTERNAL_ERROR` / `"Failed query: begin"`, `durationMs` 130 / 93 / 125, às 17:50:56Z, 17:51:34Z, 18:42:25Z                          | VERIFIED                           | `vercel-runtime-errors-7d.txt`                                        |
| 17  | `src/db/client.server.ts`, `src/routes/api/health/ready.ts`, `scripts/env-guard.mjs`, `vite.config.ts` são blobs git **idênticos** entre `d4b9395` e `fa45632`              | VERIFIED                           | `blob-identity-verification.txt`                                      |
| 18  | Toda a pilha de driver Postgres tem versão resolvida idêntica nos dois lockfiles (`@neondatabase/serverless` 1.1.0, `pg` 8.23.0, `pg-pool` 3.14.0, `drizzle-orm` 0.45.2, …) | VERIFIED                           | `driver-versions.txt`                                                 |
| 19  | `d4b9395` é ancestral de `fa45632`, 103 commits de distância                                                                                                                | VERIFIED                           | `blob-identity-verification.txt`                                      |
| 20  | O predicado do guard `!connectionString` **pega** `undefined` e `""`; **não** pega `"   "`, `"undefined"`, `"null"` nem URI malformada                                      | VERIFIED                           | `guard-negative-control.txt`                                          |
| 21  | `src/server/auth/auth-policy.ts` e `src/routes/api/auth/$.ts` também são blobs idênticos entre as duas revisões                                                             | VERIFIED                           | `source-facts.txt`                                                    |
| 22  | `src/lib/env.server.ts` (`readEnv`) **já existia** em `fa45632` e **não** existia em `d4b9395` — e **não** era aplicado a `DATABASE_URL`                                    | VERIFIED                           | `source-facts.txt`                                                    |
| 23  | `vercel.json` é novo em `fa45632` (só `git.deploymentEnabled=false`)                                                                                                        | VERIFIED                           | `source-facts.txt`                                                    |
| 24  | Manifestação do 503/500 **hoje** pelo alias público                                                                                                                         | NÃO-obtido                         | `incident-symptom-not-reproducible.txt`                               |
| 25  | Execução da contenção registrada no journal                                                                                                                                 | UNDOCUMENTED                       | `PROGRESS.md` L794 (apenas `▶`)                                       |
| 26  | O fingerprint `28P01 password authentication failed for user 'neondb_owner'` é idêntico para endpoint vivo, endpoint morto e inexistente                                    | VERIFIED (arte fato pré-existente) | `hostinger-recovery-2026-10-06/captures/fingerprint-negativo.txt:5-7` |

## Linha do tempo (timestamps VERIFIED)

| quando (UTC)             | o quê                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| 2026-10-01T14:52:06.674Z | `dpl_DHsbjECX` construído, sha `d4b9395`, production                                            |
| 2026-10-06T18:42:12.760Z | `dpl_4vNYvd5` (redeploy do **mesmo** sha `d4b9395`) criado → `ERROR` / `BLOCKED_PACKAGE`        |
| 2026-10-08T17:45:32.774Z | `dpl_6h2LTZX` criado, sha `fa45632`, production                                                 |
| 2026-10-08T17:46:01.438Z | `dpl_6h2LTZX` READY                                                                             |
| ~2026-10-08T17:46Z       | alias sage atribuído a `dpl_6h2LTZX` — **INFERRED** de L792/L793; só a última escrita é visível |
| 2026-10-08T17:50:54.712Z | **primeiro** `health.readiness_failed` (6 no total)                                             |
| 2026-10-08T17:50:56.670Z | **primeiro** 500 de `get-session`, `"Failed query: begin"`                                      |
| 2026-10-08T18:01:25Z     | L793 registra o sintoma no journal                                                              |
| 2026-10-08T18:34:00Z     | L794 registra a **intenção** de contenção                                                       |
| 2026-10-08T18:42:25.595Z | mais um 500 de `get-session` — ainda servindo o alias público                                   |
| 2026-10-08T19:00:33.986Z | **CONTENÇÃO EXECUTADA**: alias sage → `dpl_DHsbjECX` (VERIFIED, `alias.updatedAt`)              |
| 2026-10-08T19:00:34.000Z | último `health.readiness_failed`, 14 ms depois da escrita do alias                              |
| 2026-10-08T22:40–22:55Z  | probes de hoje, todos verdes                                                                    |

Os 14 ms entre a escrita do alias e a última falha são a correlação mais apertada
disponível entre os dois eventos. Não provam ordenação além do que os dois
timestamps dizem.

## As duas contradições anteriores do journal

1. **L792 (17:46Z)** — "o domínio `preco-que-da-lucro-sage.vercel.app` ainda
   resolve `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` … esperado porque
   `autoAssignCustomDomains=false`, a publicação do domínio customizado é manual".
2. **L793 (18:01:25Z)** — "alias sage atribuído manualmente
   (`oldDeploymentId dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`)", tratando o alias como já
   movido, e registrando o incidente.

**Reconciliação medida:** as duas descrevem momentos diferentes de um mesmo
processo. Às 17:46Z o alias ainda estava no antigo; entre 17:46 e 17:50 foi
movido; às 18:01 já estava no novo, daí o incidente; às 19:00:33.986Z voltou ao
antigo. **A parte que não é reconciliável por medição é o horário exato do
primeiro move**, porque a API de alias expõe apenas a última escrita
(`updatedAt`), não o histórico. Está marcado **INFERRED** acima.

**Sobre a contenção:** o estado vivo (alias → `dpl_DHsbjECX`, os dois health
endpoints verdes, `get-session` `200 null`) é **consistente** com a contenção
ter sido executada, e o timestamp de auditoria do alias (19:00:33.986Z, **depois**
da intenção de 18:34:00Z) corrobora. Mas **o repositório não tem nenhum `✔`
registrando isso**: L794 continua `▶`. Este pacote acrescenta o fechamento, não
substitui a ausência por uma afirmação.

## O que NÃO está isolado

A causa raiz **não** está isolada. O que se sabe:

- Os bytes do client de banco, da rota de readiness, do `env-guard` e do
  `vite.config.ts` são **idênticos** entre a revisão que conecta (`d4b9395`) e a
  que não conecta (`fa45632`) — mesmos hashes de objeto git
  (`2b0e9778…`, `2cdd37e1…`, `01ae819d…`, `38784422…`).
- A pilha inteira de driver Postgres tem versão resolvida idêntica nos dois
  lockfiles. (`package.json`/`package-lock.json` **não** são byte-idênticos entre
  essas duas revisões; o delta são TanStack Router/Start, `zod`, `seroval`,
  `unplugin` e o pin de `esbuild` — nenhum deles na pilha de banco. A identidade
  de `ce9bd44`↔`fa45632` nesses dois manifests é que é byte-idêntica, e foi
  verificada.)
- O sintoma do 500 de `get-session` **tem explicação estrutural única**:
  `src/routes/api/auth/$.ts` chama `getAuth()` → `createAuthInstance()`, cujo
  parâmetro default é `getDatabase()`. Uma falha de banco produz o 500 sozinha.
  Portanto `BETTER_AUTH_URL` **não** é necessária como causa aditiva para
  explicar o que foi observado — a hipótese que a treatava como "causa aditiva
  separada" está **rebaixada** por esta medição.

O que **não** se sabe: por que o pool do deployment novo não conectou. O
`error.cause` não foi registrado.

## Diagnóstico diferencial, ranqueado

A ordem é por **capacidade de explicar todos os pontos observados** com o que já
está medido, não por probabilidade intuitiva. Nenhuma está confirmada.

### H1 — `DATABASE_URL` de produção não é atingível pelo deployment novo (ambiental)

**Forma:** o valor corrente do registro genérico `DATABASE_URL` (id
`LQTKQMUeLWmQnHkM`, reescopado para `production` em 2026-10-06 sem campo de
valor) aponta para um endpoint que os bytes novos não alcançam.

**A favor:** é o único delta que resta entre "conecta" e "não conecta" depois da
exoneração por blob; o intento L794 já aponta nessa direção; o precedente de
2026-10-06 (L702) foi exatamente um `DATABASE_URL` apontando para endpoint
removido.

**Contra, e esta contradição é o ponto central:** se os dois deployments lessem o
**mesmo valor corrente**, um valor morto quebraria os dois — e o antigo responde
`ready/postgres ok` hoje. A hipótese só sobrevive sob o modelo em que um
deployment retém o ambiente do momento do seu build. Esse modelo é o que o
próprio repositório documenta (`docs/runbooks/dia-d-2026-09-12.md:52-55`: "na
Vercel, mudar env **não** altera deployment existente — exige novo deployment"),
mas **não foi medido aqui**, e medi-lo exigiria ler o valor.

**Experimento decisivo:** redeploy de `d4b9395` com o ambiente atual. Se a
reconstrução dos bytes antigos **também** falhar, a diferença é ambiente, não
bytes. **Este experimento está bloqueado:** o fornecedor recusou exatamente esse
redeploy com `BLOCKED_PACKAGE` (`vercel-deployment-blocked-dpl_4vNYvd5.json`).
Só seria possível habilitando o bypass do fornecedor, o que este pacote não faz e
não recomenda.

### H2 — O valor está definido-e-vazio ou definido-e-malformado

**Forma:** `DATABASE_URL` existe no escopo `production` mas é `""`, espaços, a
string `"undefined"`/`"null"`, ou uma URI sem esquema.

**Correção de claim medida:** a afirmação de que `src/db/client.server.ts:64`
"não guarda definida-e-vazia" está **errada** para `""` — o predicado
`!connectionString` pega `""` e lança `"DATABASE_URL não configurada"`
(`guard-negative-control.txt`). O que **não** existe é validação de formato:
`"   "`, `"undefined"`, `"null"` e URI malformada passam pelo guard e falham
depois, no driver, com a mensagem que aparece no log. É uma lacuna real, mas não
é a que foi alegada.

**A favor:** a tarefa concorrente está corrigindo exatamente isso agora, ligando
`readEnv("DATABASE_URL")` ao guard (blob de disco `632f74f0…`, contra `2b0e9778…`
em HEAD). `readEnv` **já existia** em `fa45632` e não era aplicado a
`DATABASE_URL`. E há medição própria da plataforma de que env vazia quebra
coisas neste projeto: o comentário de `src/lib/env.server.ts:8-12` registra que
`AI_GATEWAY_URL=""` derrubou todo turno de chat no preview
`dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8`.

**Experimento decisivo:** equivalência de ambiente por valor, que exige ler o
valor — **proibido por este pacote**. Alternativa que **não** exige ler valor:
comparar o comportamento dos dois deployments com o **mesmo** corpo de requisição
e o mesmo `x-correlation-id` numa janela em que os dois estejam servindo. Hoje o
novo não serve o alias público, então essa alternativa está indisponível.

### H3 — Falha intermitente de conectividade, não específica dos bytes novos

**Forma:** a conectividade Postgres de produção é intermitente e o deployment
novo apenas a encontrou.

**A favor — e esta é a evidência mais forte do pacote:** os clusters de erro
mostram `"Failed query: begin"` / `"Failed query: insert into rate_limits …"` com
`INTERNAL_ERROR` em `/api/auth/get-session` em **2026-10-02**, **2026-10-06** e
**2026-10-08**, em pelos menos seis deployments distintos. Inclusive em
`dpl_CzhQ5BmcW1ZPadxH36TKhYy75iQd`, que é um **preview de `develop` do sha
`ce9bd44`** — a mesma revisão que o journal chama de "preview healthy". A
assinatura não é nova nem exclusiva dos bytes novos.

**Contra:** os clusters de `get-session` 500 em outras datas têm
`lastDeployment` de previews, e um preview tem override de `DATABASE_URL`
próprio. A amostra é pequena (`count=1` por cluster).

**Experimento decisivo:** série temporal de `request.failed` em
`/api/health/ready` por `lastDeployment`, cruzada com as operações do Neon, por
uma janela longa. O `get_runtime_errors` com `since=7d` já entrega isso e deve
ser consultado antes de qualquer conclusão sobre "bytes novos".

### H4 — `BETTER_AUTH_URL` ausente no escopo `production`

**Status: rebaixada.** `src/server/auth/auth-policy.ts:45-47` de fato lança
`"BETTER_AUTH_URL é obrigatória em produção"` quando a variável falta. Mas
`createAuthInstance(database: Database = getDatabase())` avalia `getDatabase()`
**antes** de `resolveAuthPolicy()`, e `dpl_DHsbjECX` responde `get-session` `200
null` hoje pelo mesmo escopo. Uma única falha de banco explica o 503 e o 500.

**Experimento decisivo:** construir a instância de auth com um banco funcional
num preview e ver se `get-session` passa a responder 200. Se passar, H4 está
refutada como causa deste incidente (pode continuar sendo risco latente).

### H5 — Delta de framework TanStack entre as revisões

**Status: sem suporte para o sintoma de banco.** `@tanstack/react-start`
`1.168.49` → `1.168.60`, `start-server-core` `1.169.31` → `1.169.39`,
`router-plugin` `1.168.35` → `1.168.42`. Nada nessa família toca a pilha de
driver. A relevância é **outra**: `d4b9395` carrega a versão que o fornecedor
classifica como vulnerável, e a contenção atual mantém produção nela.

## Declarações obrigatórias

- **Nenhuma correção foi aplicada por este pacote.** Nenhum arquivo em `src/`,
  `scripts/`, `e2e/` ou `.github/` foi criado ou modificado.
- **Nenhum valor de ambiente foi lido.** `vercel_filter_project_envs`,
  `vercel_get_project_env` e `vercel_get_shared_env_var` **não foram chamados**.
- **Nenhum segredo foi impresso.** A credencial usada no probe de sign-in foi
  fabricada pelo autor desta sessão e não corresponde a conta alguma; o endereço
  usa o TLD reservado `.invalid`, que não pode ser registrado.
- **Nenhuma mutação de produção foi executada.** Nenhum deployment, alias, domínio,
  env var, branch Neon, snapshot ou credencial foi criado, alterado ou removido.
  Todas as chamadas Vercel foram leituras (`get_deployment`, `get_alias`,
  `get_project`, `get_runtime_logs`, `get_runtime_errors`).
- **Nenhum link de bypass de autenticação foi usado.**
- **Nenhuma ferramenta Neon MCP foi chamada.**
- **Nenhum dado de produção foi usado como alvo de teste.**

## Riscos e limites declarados

1. **Produção está numa revisão com vulnerabilidade conhecida.** O deployment que
   serve `preco-que-da-lucro-sage.vercel.app` carrega
   `@tanstack/react-start@1.168.49`, bloqueado pelo fornecedor para novos builds
   (`GHSA-qx66-fv34-fjm8`). A contenção atual mantém produção nessa revisão; o
   fornecedor já provou que recusa reconstruí-la. **Este é um risco de segurança
   aberto e não é resolvido por este pacote.**
2. **Correção e runbook pendentes.** A correção do valor de ambiente é da Via A
   (entrada humana de credencial, por contrato). O runbook é
   `docs/runbooks/dia-d-2026-09-12.md:45-60`: vars → reimplantar → associar
   domínio → SSL → probes → integridade. **Nenhum probe canônico feito antes do
   redeploy mede o artefato antigo e mente.**
3. **A lacuna do `error.cause` não foi corrigida aqui.** Está declarada como
   defeito: `src/routes/api/health/ready.ts:14` deveria serializar a causa do
   driver, não só `name`/`message`. Corrigir isso é o que teria tornado este
   incidente diagnosticável sem ler credencial.
4. **A correlação dos 14 ms não é prova de ordenação** além dos timestamps.
5. **Amostra pequena em H3**: `count=1` por cluster de `get-session`.
6. **A tarefa concorrente de código avançou durante a escrita.** Este pacote não
   executou o gate dela e não a valida.
7. **Risco de leitura.** Um leitor pode confundir "o estado vivo é consistente
   com a contenção" com "a contenção está confirmada". O pacote separa as duas
   coisas em cada ocorrência, e ambas permanecem verdadeiras ao mesmo tempo: o
   estado é consistente, e o registro no repositório estava ausente.

## Auto-verificação pré-S6

| #   | item                          | como foi satisfeito                                                                                                                                                                                              |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo             | `guard-negative-control.txt` distingue `""` (reprovado pelo guard) de `"   "` / `"undefined"` / URI malformada (aprovados e falhos depois).                                                                      |
| 2   | Fronteira nas duas direções   | `vercel-runtime-logs-retention-boundary.txt`: `7d` reprova, `1h` reprova, `30m` passa — o limite é medido nos dois lados.                                                                                        |
| 3   | Identidade, não cardinalidade | Deployment, alias, sha, target e state nomeados por id em cada captura; `lastDeployment` nomeado em cada cluster de erro.                                                                                        |
| 4   | Não exit-code-only            | Todo probe carrega o corpo e o código HTTP, não só o exit. As respostas 503/500 são citadas pelo JSON, não por código.                                                                                           |
| 5   | Sem sleep fixo como prova     | O toast foi capturado por `MutationObserver`, não por timer; a leitura após 4 s é só o momento da leitura, e o sinal (`current` vazio) é registrado como tal.                                                    |
| 6   | Sem identidade degenerada     | `x-correlation-id` é UUID distinto por requisição e está em cada captura.                                                                                                                                        |
| 7   | Precondição de estado         | `probe-start-utc.txt` fixa o início; cada captura carrega data/hora.                                                                                                                                             |
| 8   | Sentinela real                | O endereço `.invalid` é sentinela real de inexistência, não lista inferida.                                                                                                                                      |
| 9   | Fingerprint de revisão        | `blob-identity-verification.txt` fixa os hashes de objeto git das duas revisões; `source-facts.txt` fixa o blob de disco da árvore mutante.                                                                      |
| 10  | checked === discovered        | `MANIFEST.sha256` lista a descoberta real do diretório; descoberta vazia reprovaria. Conferido com `sha256sum -c`.                                                                                               |
| 11  | S6 adversarial                | **PENDENTE.** Este pacote foi escrito pelo autor e ainda não passou por revisão independente de contexto limpo. Duas claims já foram autocorrigidas e estão nomeadas abaixo.                                     |
| 12  | Falha alta (fail-closed)      | Nenhum passo foi convertido em sucesso vazio: a falha do log de runtime aparece como `400 bad_request` verbatim, não como "sem logs".                                                                            |
| 13  | Isolamento de bancada         | Nenhuma escrita em repositório fora deste diretório e do append do journal; a árvore foi inspecionada com `git status --porcelain src/` antes e durante.                                                         |
| 14  | Todo check tem captura        | Cada probe tem arquivo próprio em `captures/`. O que não tem é o 503 ao vivo, e o arquivo `incident-symptom-not-reproducible.txt` explica por quê.                                                               |
| 15  | Run de CI por commit          | **N/A-trigger.** Push docs-only sob `docs/evidence/**` dispara `CI light`, não o pesado; este pacote não foi publicado por este autor (sem push).                                                                |
| 16  | Descoberta multi-sítio        | O conjunto de deployments foi descoberto por leitura dos clusters de erro (`lastDeployment`), não por lista fixa; dois deles (`dpl_Q3f5ahDS…`) já dão 404 na API.                                                |
| 17  | Precondição de ambiente       | Pré-condições declaradas: acesso de leitura Vercel, DNS público alcançável, navegador headless disponível. Todas verificadas em runtime; a do log de runtime falhou e foi registrada como falha, não contornada. |

**KPI pré-S6:** 2 claims do próprio requisito foram medidas e reprovadas
(causa-raiz-isolada-do-log e o guard de definida-e-vazia), mais 1 erro de
alinhamento de timestamp do próprio autor (18:34Z vs 19:00:33.986Z), todos
corrigidos dentro deste pacote antes de qualquer revisão. Total de achados
independentes ainda desconhecido; densidade e CORR/N do S6 não calculáveis
antes dele. Nenhum zero fictício é declarado.

## S6 ADVERSARIAL

**PENDENTE.** Nenhuma revisão independente de contexto limpo foi executada sobre
este pacote. As três autocorreções acima são do autor e **não** substituem S6.

## Rollback

Não há rollback de produção neste pacote: nada em produção foi tocado. Reverter o
pacote seria apagar arquivos de evidência, o que não é o caminho previsto. O
rollback operacional continua sendo o já documentado: manter
`preco-que-da-lucro-sage.vercel.app` em `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`, com o
custo declarado de permanecer em `@tanstack/react-start@1.168.49`.
