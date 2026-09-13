# Evidência — DOCMAP hPanel / Hostinger Web Apps (Node) para os 11 itens de homologação

Rodada: `preco-que-da-lucro`, 2026-09-12. Frente F-HP.
Caminho canônico: `docs/evidence/hpanel-docmap-2026-09-12.md`.

## 0. Escopo, método e limite declarado (leia antes das tabelas)

**Objetivo.** Mapear cada um dos 11 itens de `docs/runbooks/hpanel-homologacao.md` e os tópicos
transversais exigidos pelo mandato (build, start, variáveis de ambiente, versão de Node, subdomínio
de preview, restart, logs, persistência, egress, TLS/SSL, associação de domínio) para o que a
documentação oficial da Hostinger precisa responder.

**Modo autorizado:** Modo B — LIMITAÇÃO DECLARADA (decisão do supervisor nesta rodada), com os
ajustes: caminhos fixados nos dois runbooks, coluna `doc oficial` explicitamente **PENDENTE**, e
**zero URL/seção inventada**.

**LIMITE MATERIAL DESTA EXECUÇÃO (declarado, não contornado).**
Este subagente rodou sem ferramenta de web (`web_search`/`web_fetch`) registrada — apenas
`read`/`write`. Portanto:

- **Nenhuma página oficial da Hostinger foi consultada nesta rodada.** Por isso, **não há nenhuma
  URL, seção, versão de runtime, limite numérico, prazo de retenção ou política de plataforma
  citada como verificada neste arquivo.** Onde a coluna `doc oficial` apareceria, consta
  `PENDENTE — parent fará o DOC-FIRST via web`.
- A REGRA DOC-FIRST permanece **não satisfeita para o lado externo**: os 11 itens continuam sem
  base documental e sem valor observado. Este artefato **não** promove nenhum item a `PASS`.
- O que este artefato entrega é a **metade verificável localmente**: requisito canônico do
  runbook (com arquivo:linha), âncoras de código/script que os itens tocam, a **pergunta exata**
  que a doc oficial precisa responder, e os GAP-DOCs internos encontrados.
- Nenhum valor de variável de ambiente, secret, URL de conexão, token ou endpoint é reproduzido
  aqui — somente **nomes de variáveis e estados** (presente/ausente/esperado).

**Convenção de citação.** Citações `arquivo:linha` foram contadas a partir do conteúdo lido em
2026-09-12; o leitor disponível não expõe numeração de linha, então trate como tolerância de ±1.
Citações por título de seção entre aspas reproduzem o cabeçalho literal do arquivo e são exatas.
Toda frase marcada **[inferência]** é dedução do pesquisador a partir do repositório, **não**
declaração de uma fonte oficial.

---

## 1. Tabela principal — item (1..11) → requisito do runbook → o que a doc oficial precisa responder → referência

Fonte canônica da coluna 2: `docs/runbooks/hpanel-homologacao.md`, linhas 7–17 (tabela de itens;
item N = linha 6+N). Gate de saída: linha 19. Pré-requisito/URL de preview: linha 3.

| #   | Requisito (runbook:linha)                                                                                                                                                                                                                                                                                        | O que a doc oficial precisa responder (pergunta do DOC-FIRST)                                                                                                                                                                                                                                                                                                                   | Referência oficial                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Node ≥ 24.15.0; `FAIL` + **ABORT geral** se o teto oferecido for < 24.15.0. `hpanel-homologacao.md:7`                                                                                                                                                                                                            | Qual versão de Node o Web App oferece (mínima/máxima/disponível), como se seleciona a versão (seletor de runtime, arquivo de versão, imagem fixa), qual é o default e qual o caminho de upgrade; existe teto abaixo de 24.15.0?                                                                                                                                                 | **PENDENTE — parent fará o DOC-FIRST via web** (nenhuma URL registrada nesta rodada) |
| 2   | Start customizado: start = `npm run start` (`node .output/server/index.mjs`); `ps` deve mostrar o processo do artefato publicado. `hpanel-homologacao.md:8`                                                                                                                                                      | O Web App aceita comando de start customizado e de que forma (string de comando, `npm run <script>`, `Procfile`/arquivo de config)? O comando é executado em shell com `npm`/`npx` no PATH? Há passo de **build separado** configurável? O processo é persistente (long-running) ou por requisição? É permitido substituir o start command por `node .output/server/index.mjs`? | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 3   | Injeção de porta: `PORT` **ou** `NITRO_PORT` precisa chegar ao processo; `FAIL` se nada chega ou a porta efetiva diverge. `hpanel-homologacao.md:9`                                                                                                                                                              | Qual variável de porta a plataforma injeta, em runtime ou em build; o valor chega ao processo Node? A porta é fixa, atribuída dinamicamente ou escolhida pelo app? Um app que escuta `PORT`/`NITRO_PORT` arbitrário funcionará, ou é exigido um valor específico?                                                                                                               | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 4   | Host bind: `HOST`/`NITRO_HOST` compatível com o proxy; `FAIL` se o preview não roteia. `hpanel-homologacao.md:10`                                                                                                                                                                                                | O app deve fazer bind em `0.0.0.0` ou em host específico? O proxy interno encaminha para `127.0.0.1` ou para a interface pública? A plataforma fornece `HOST`/`NITRO_HOST` ou exige bind em endereço fixo? Há suporte a IPv6?                                                                                                                                                   | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 5   | Persistência: 3× `/api/health/live` → 200 em 15 min sem tráfego; `FAIL` se dorme (reavaliar plano). `hpanel-homologacao.md:11`                                                                                                                                                                                   | O processo do Web App hiberna/dorme por inatividade? Existe cold start, e de quantos segundos? Há keep-alive, plano-dependente (Startup/Business)? O processo recebe `SIGTERM` no recycle e por quanto tempo?                                                                                                                                                                   | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 6   | Restart: `kill <pid>`; 60 s; `ps` + `curl .../live` → novo PID e `live → 200`. `hpanel-homologacao.md:12`                                                                                                                                                                                                        | Política de reinício após saída não zero (automática? quantas tentativas? backoff?); existe restart manual pelo painel? O restart reusa o mesmo artefato publicado (o hash do artefato permanece)? O que acontece em crash loop?                                                                                                                                                | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 7   | Logs sem secrets: stdout/stderr consultáveis, **retenção declarada**, e grep de segredo = `0`. `hpanel-homologacao.md:13`                                                                                                                                                                                        | Onde ficam stdout/stderr, por quanto tempo são retidos, são pesquisáveis/exportáveis? Valores de variáveis de ambiente aparecem mascarados na UI e nos logs? Há limite de tamanho/rotação? Logs sobrevivem a restart/redeploy?                                                                                                                                                  | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 8   | Proxy timeout > 60 s: `POST /api/chat` sem corte ≤ 60 s; `FAIL` se corte ≤ 60 s. `hpanel-homologacao.md:14`                                                                                                                                                                                                      | Qual é o timeout default e máximo do proxy/gateway da plataforma? É configurável por aplicação? Como se comporta com resposta longa/streaming (SSE/chunked) — o timeout é de conexão total ou de inatividade? Existe timeout separado para o handshake TLS/keep-alive?                                                                                                          | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 9   | Egress TLS: 3 sondas HTTPS públicas (Neon, Resend, gateway de IA) sem credenciais alcançáveis; **ABORT** se Neon bloqueado. `hpanel-homologacao.md:15`                                                                                                                                                           | Há firewall/allowlist de saída? Portas de saída permitidas (443 e TCP 5432? WebSocket 443?)? A validação TLS de saída é aberta a qualquer CA pública? Há rate limit/proxy de saída, DNS restrito ou inspeção TLS que quebre conexões Postgres/WebSocket?                                                                                                                        | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 10  | Health live+ready via URL pública: `live = 200`; `ready = 200` (ou `503` = app viva + banco indisponível, aceito aqui). `hpanel-homologacao.md:16`                                                                                                                                                               | A plataforma tem health check configurável (path/porta)? Existe force-HTTPS/redirect e certificado TLS automático no preview? Qual o esquema de URL do preview e ele é público (sem auth)?                                                                                                                                                                                      | **PENDENTE — parent fará o DOC-FIRST via web**                                       |
| 11  | Secrets por ambiente: conferir **nomes** no painel; `DATABASE_URL`, `DATABASE_DRIVER=node-postgres`, `BETTER_AUTH_*`, `AUTH_TRUSTED_ORIGINS`, `RESEND_*`, `AI_GATEWAY_*` presentes e `DATABASE_ADMIN_URL`/`SUPABASE_*`/`MIGRATION_*` **ausentes** do web; registrar limites da conta. `hpanel-homologacao.md:17` | Quantas variáveis e qual o tamanho máximo por valor? As variáveis são escopadas por ambiente (preview vs produção) e trocar exige restart/redeploy? O valor volta a ser visível depois de salvo (masking)? Existe cofre/secret manager, versionamento ou auditoria de alteração? As variáveis são expostas também ao passo de **build**?                                        | **PENDENTE — parent fará o DOC-FIRST via web**                                       |

Gate de saída (runbook): 11/11 `PASS` com evidência coletada em
`docs/evidence/hpanel-homologacao-<AAAA-MM-DD>/` (`hpanel-homologacao.md:3` e `:19`), depois
atualizar `docs/evidence/hostinger-hpanel-verification.md`; só então apontar o domínio e iniciar A4
(`docs/runbooks/a4-a5-cutover.md`).

---

## 2. Tópicos transversais do mandato → item(s) do runbook → pergunta pendente

| Tópico do mandato                              | Item(ns) correspondente(s)                                                                             | Âncora local (repo)                                                                                                                                                      | Pergunta pendente para a doc oficial                                                                                                                                                                       | Referência oficial                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Como o build roda (`npm ci` / `npm run build`) | 2 (e pré-condição de 1)                                                                                | `docs/runbooks/hostinger-cloud-node.md` "Contrato de build e start"; `package.json:24` (`build` → `node scripts/build.mjs`); `scripts/build.mjs` (spawn do `vite build`) | A plataforma executa install+build próprios? Comandos configuráveis? Como é feito com lockfile (`npm ci` vs `npm install`)? O build tem rede e tempo/CPU limitados? O build recebe as env vars de runtime? | **PENDENTE — parent fará o DOC-FIRST via web** |
| Comando de start                               | 2                                                                                                      | `package.json:26` (`start` → `node .output/server/index.mjs`); `hostinger-cloud-node.md` "Contrato de build e start"                                                     | Ver item 2 da tabela principal.                                                                                                                                                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Variáveis de ambiente (limites, masking)       | 11 (+ 3, 4, 8, 9, 10 como efeito)                                                                      | `.env.example` (somente nomes); `hostinger-cloud-node.md` "Variáveis por processo"                                                                                       | Ver item 11 da tabela principal.                                                                                                                                                                           | **PENDENTE — parent fará o DOC-FIRST via web** |
| Versão de Node disponível                      | 1                                                                                                      | `.nvmrc:1` = `24.15.0`; `package.json:7-9` (`engines.node` = `>=24.15.0`)                                                                                                | Ver item 1 da tabela principal.                                                                                                                                                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Subdomínio de preview                          | 3, 4, 10; pré-requisito da rodada                                                                      | `hpanel-homologacao.md:3` ("Usar a **URL preview temporária** (`https://<preview-host>`), nunca o domínio canônico")                                                     | Formato/nome do host de preview, se é público, se persiste entre deploys, se é por-ambiente ou por-deploy, e se aceita path de health.                                                                     | **PENDENTE — parent fará o DOC-FIRST via web** |
| Restart                                        | 6                                                                                                      | `hostinger-cloud-node.md` "Operação, restart e rollback"                                                                                                                 | Ver item 6 da tabela principal.                                                                                                                                                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Logs                                           | 7                                                                                                      | `src/lib/structured-logger.ts` (`logJson` em stdout/stderr, com redação)                                                                                                 | Ver item 7 da tabela principal.                                                                                                                                                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Persistência                                   | 5                                                                                                      | `hostinger-cloud-node.md` "Operação, restart e rollback"                                                                                                                 | Ver item 5 da tabela principal.                                                                                                                                                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Egress                                         | 9                                                                                                      | `src/db/client.server.ts` (drivers `pg` e `@neondatabase/serverless`)                                                                                                    | Ver item 9 da tabela principal, com atenção extra ao transporte do driver escolhido (TCP vs WebSocket) — ver GAP-DOC-INTERNO-01.                                                                           | **PENDENTE — parent fará o DOC-FIRST via web** |
| TLS/SSL                                        | 10; pré-requisito de 3/4                                                                               | `src/start.ts` (HSTS quando `NODE_ENV=production`)                                                                                                                       | Emissão/renovação automática do certificado? TLS mínimo? Force-HTTPS? O certificado cobre o preview e o domínio canônico? O app vê `https`/`X-Forwarded-Proto`?                                            | **PENDENTE — parent fará o DOC-FIRST via web** |
| Associação de domínio                          | gate de saída (`hpanel-homologacao.md:19`); A4 (`a4-a5-cutover.md` §"A4 — sequência (~1 dia)" passo 2) | `hostinger-cloud-node.md` "Operação, restart e rollback"                                                                                                                 | Procedimento de apontamento (DNS/registros, apex vs `www`), tempo de propagação, emissão de TLS no domínio, pré-requisitos e impacto no preview.                                                           | **PENDENTE — parent fará o DOC-FIRST via web** |

---

## 3. GAP-DOCs encontrados

### GAP-DOC-TOOLING-00 (bloqueante para o DOC-FIRST externo) — **ABERTO**

**Divergência:** o mandato exige citação de doc oficial consultada via web; esta execução não teve
ferramenta de web. **Consequência:** os 11 itens e os 11 tópicos transversais estão com a coluna
"doc oficial" em `PENDENTE`; nenhum item pode sair de `BLOCKED` por este artefato.
**Evidência:** seção 0 deste arquivo (declaração de limite) + `docs/evidence/hostinger-hpanel-verification.md`
("Bloqueio atual", itens `BLOCKED`). **Ação:** o parent (ou subagente com fetch) executa o DOC-FIRST
por item e substitui cada célula `PENDENTE` por referência oficial real.

### GAP-DOC-INTERNO-01 (doc↔doc/runbook/runtime) — driver do banco no runtime web — **ABERTO, decision-relevant**

**Divergência (contradição registrada, não resolvida):**

- `docs/runbooks/hpanel-homologacao.md:17` (item 11) exige `DATABASE_DRIVER=node-postgres` no
  processo web.
- `docs/evidence/hostinger-hpanel-verification.md` (procedimento, passo 2) repete
  `DATABASE_DRIVER=node-postgres`.
- `docs/runbooks/hostinger-cloud-node.md` "Variáveis por processo → Web/runtime na Hostinger" lista
  `DATABASE_DRIVER` como variável obrigatória/operacional **sem fixar valor**.
- `.env.example` (bloco "Runtime PostgreSQL/Neon") declara: **"Padrão e produção: neon-serverless"**,
  reservando `node-postgres` para PostgreSQL TCP local/efêmero (integração e E2E).
- `src/db/client.server.ts` (`createDatabase()`): default é `neon-serverless`; o comentário do ramo
  `node-postgres` afirma "Production remains on Neon pooled through `@neondatabase/serverless`".

**Consequência operacional:** o item 11 não é auto-consistente entre runbooks, `.env.example` e o
default do código. **[inferência]** Os dois drivers usam transportes diferentes (TCP/`pg` versus
WebSocket/fetch via `@neondatabase/serverless`), então a resposta do item 11 muda o que o item 9
(egress) precisa demonstrar e o que o "ready=200" do item 10 exercita. **Pergunta que a doc oficial
precisa responder:** o processo Node do Web App permite saída WebSocket(443) e/ou TCP direto para
Postgres gerenciado, e há restrição de portas/Protocolo que force um dos drivers?
**Evidência local:** arquivos citados acima. **Ação:** resolver antes de A4 (a escolha do driver
entra no conjunto de secrets do item 11).

### GAP-DOC-INTERNO-02 (build no ambiente da plataforma) — **ABERTO**

`docs/runbooks/hostinger-cloud-node.md` "Contrato de build e start" exige `npm ci` + `npm run build`

- `npm run start`, mas **não há nenhuma afirmação** sobre quem executa o build na plataforma,
  com qual comando, nem sobre lockfile drift. **[inferência]** O repo depende de `npm ci` estrito
  (AGENTS.md: "CI instala com `npm ci --ignore-scripts` e falha (`EUSAGE`) em drift de lockfile"), e
  o build local passa por `scripts/build.mjs`, que **falha** em warning não registrado/expirado; se a
  plataforma rodar `npm install` (não `ci`), ou um `vite build` direto, o gate local de warnings é
  contornado e a paridade com CI se perde. **Ação:** a doc oficial precisa dizer qual comando de
  install/build a plataforma executa; se for configurável, fixar `npm ci` + `npm run build`.

### GAP-DOC-INTERNO-03 (env-guard não roda em `build`/`start`) — **ABERTO (inferência)**

`package.json` registra hooks `pre*` do env-guard apenas para `dev`, `test`, `build:dev`,
`e2e:prepare`, `test:e2e`, `db:*`, `m02:*` — **não** para `build` nem `start`. **[inferência]** Logo,
o pre-hook que nega banco remoto (`scripts/env-guard.mjs`) **não** protege o caminho de produção
`npm run build`/`npm run start` no hPanel; a proteção ali é contratual (variáveis certas no painel),
não executável. Nenhuma doc oficial cobre isso — é limite interno. **Ação:** registrar como risco
aceito ou explicitar no runbook; não é GAP de doc externa.

### GAP-DOC-04 (janela temporal do allowlist de build) — **ABERTO, sensível a data**

`scripts/build.mjs` mantém o allowlist `WARN-NITRO-001` com `releaseChannels: ["local",
"pre-beta-internal"]`, `expiresOn: "2026-10-06"`, `recheckedAt: "2026-09-07"`. **[inferência]** Se
`BUILD_RELEASE_CHANNEL`/`CI` não estiverem definidos no ambiente da plataforma, o canal resolvido é
`local` (permitido) — mas **após 2026-10-06** o mesmo warning passa a reprovar o build, inclusive em
deploy na Hostinger. Nenhuma doc oficial cobre isso; é dívida interna com prazo. **Ação:** decidir
canal de release do build de produção antes de A4 ou renovar/rever o allowlist (só via processo
explícito, nunca afrouxando gate silenciosamente).

### GAP-DOC-05 (divergência de rótulo de evidência) — **ABERTO, menor**

`docs/runbooks/hpanel-homologacao.md:19` manda "atualizar `docs/evidence/hostinger-hpanel-verification.md`",
mas esse arquivo já existe com data de 2026-08-23 e todos os itens `BLOCKED`. **[inferência]** O
runbook não define se a atualização é in-place, por append datado, ou se cada rodada gera novo
arquivo — risco de sobrescrever evidência histórica. **Ação:** fixar convenção (append datado) no
runbook.

---

## 4. O que a doc oficial NÃO cobre (limite declarado)

Independentemente de quanta documentação oficial seja consultada, ela **não** pode certificar os
fatos abaixo — todos dependem de observação no ambiente ou de validação interna. Isto é limite de
escopo da fonte, não omissão de pesquisa:

1. **Semântica de readiness da aplicação** — `/api/health/ready` → `200` só com `select 1` OK e
   `503` como estado aceito de "app viva + banco indisponível" (`src/routes/api/health/ready.ts`;
   `hostinger-cloud-node.md` "Health checks"). Nenhuma doc de plataforma descreve isso.
2. **Ausência de secrets no log da aplicação** — é garantida pelo redator
   `src/lib/structured-logger.ts` (`logJson` + `redactLogValue`, chaves sensíveis e padrões de URL
   de conexão/Bearer/e-mail). A plataforma só pode responder por retenção/masking do painel, não
   pelo conteúdo que o app emite.
3. **Precedência `NITRO_PORT` > `PORT` e bind `NITRO_HOST`/`HOST`** — comportamento do runtime Nitro
   gerado, validado localmente por `scripts/check-hostinger-runtime.mjs`
   (`runCase("NITRO_PORT/NITRO_HOST")` e `runCase("PORT/HOST")`) e descrito em
   `hostinger-cloud-node.md` "Porta e host". Não é contrato da plataforma.
4. **Segurança de cabeçalhos** — CSP e HSTS são emitidos pelo app (`src/start.ts`); a CSP permanece
   `Report-Only` salvo `CSP_ENFORCE=true`. Nenhuma doc de plataforma substitui esse gate.
5. **PostgreSQL gerenciado do hPanel como banco canônico** — `hostinger-cloud-node.md`
   "PostgreSQL e Neon" declara explicitamente que a existência de `node-postgres` no projeto **não**
   comprova PostgreSQL 17, RLS, roles, grants, triggers, funções, constraints compostas e usuários
   separados; o banco do hPanel não será usado sem validação específica. Doc oficial da plataforma
   não deve ser lida como essa validação.
6. **Rollback do artefato por commit** — `hostinger-cloud-node.md` "Operação, restart e rollback"
   exige manter o artefato anterior identificável por commit; se a plataforma retém apenas o último
   deploy, isso precisa ser observado no painel, não lido como garantia.
7. **Comportamento do banco/e-mail/gateway de IA reais** — itens 9 e 10 exigem sondas reais
   (Neon, Resend, gateway de IA) com credenciais do ambiente; doc não prova alcance.
8. **Limites de conta/plano** (item 11, "limites da conta") e existência de redundância/PITR do
   provedor externo — fora do escopo de doc de plataforma.

---

## 5. Âncoras locais usadas (repo, verificáveis)

| Âncora                                                                                          | O que sustenta                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/runbooks/hpanel-homologacao.md:3, :7-:17, :19`                                            | 11 itens, comandos, saídas esperadas, evidência exigida, FAIL/ABORT, gate de saída, URL de preview como alvo (não o domínio canônico).                                   |
| `docs/runbooks/hostinger-cloud-node.md` "Contrato de build e start"                             | Sequência `npm ci` / `npm run build` / `npm run start`; `node .output/server/index.mjs` como comando de produção; `npm run preview` é local.                             |
| `docs/runbooks/hostinger-cloud-node.md` "Porta e host"                                          | `NITRO_PORT → PORT`, `NITRO_HOST → HOST`, precedência de `NITRO_PORT`; lista de confirmações pendentes no hPanel.                                                        |
| `docs/runbooks/hostinger-cloud-node.md` "Health checks"                                         | Endpoints sem autenticação; `live=200`/`ready=503` no smoke degradado; smoke `npm run build && npm run check:hostinger-runtime`.                                         |
| `docs/runbooks/hostinger-cloud-node.md` "Variáveis por processo"                                | Conjunto obrigatório do runtime web, conjunto de e-mail (Resend), gateway de IA, observabilidade, e proibição de `DATABASE_ADMIN_URL`/`SUPABASE_*`/`MIGRATION_*` no web. |
| `docs/runbooks/hostinger-cloud-node.md` "Operação, restart e rollback" e "Status deste runbook" | Lista do que deve ser confirmado no hPanel e estados `UNVERIFIED`/`BLOCKED` (Node, comando custom, processo persistente, Postgres do hPanel).                            |
| `docs/evidence/hostinger-hpanel-verification.md`                                                | Checklist espelho dos 11 itens, todos `BLOCKED` (registro de 2026-08-23); critérios de PASS por item.                                                                    |
| `docs/runbooks/a4-a5-cutover.md` §"A4 — sequência (~1 dia)"                                     | Pré-condição 11/11 PASS antes do apontamento de domínio; `npm run check:hostinger-runtime` verde no SHA de `main`.                                                       |
| `package.json:7-9, :24, :26`                                                                    | `engines.node >=24.15.0`; `build` = `node scripts/build.mjs`; `start` = `node .output/server/index.mjs`.                                                                 |
| `.nvmrc:1`                                                                                      | `24.15.0`.                                                                                                                                                               |
| `vite.config.ts`                                                                                | Preset Nitro `node-server` (Hostinger/local/CI) versus `vercel` quando `VERCEL` está definido.                                                                           |
| `scripts/check-hostinger-runtime.mjs`                                                           | Smoke local degradado: `live=200`, `ready=503`, precedência de porta/host nos dois modos; redação de saída; SIGTERM/SIGKILL.                                             |
| `scripts/build.mjs`                                                                             | Build via `vite build` + gate de warnings com allowlist datado (`WARN-NITRO-001`, expira 2026-10-06).                                                                    |
| `scripts/env-guard.mjs`                                                                         | Guard default-deny para banco remoto em scripts de dev/teste/mutação; nunca ecoa valores (somente hostname) — **não** cobre `build`/`start`.                             |
| `src/db/client.server.ts`                                                                       | Seleção de driver (`DATABASE_DRIVER`, default `neon-serverless`), pools `pg` e `@neondatabase/serverless`, `withTenantTransaction`.                                      |
| `src/routes/api/health/live.ts`, `src/routes/api/health/ready.ts`                               | Contrato HTTP dos itens 5/6/10.                                                                                                                                          |
| `src/start.ts`                                                                                  | Cabeçalhos de segurança, HSTS em produção, CSP report-only/enforce.                                                                                                      |
| `src/lib/structured-logger.ts`                                                                  | Redação de segredos e emissão em stdout/stderr (base do item 7 no lado app).                                                                                             |
| `.env.example` (somente nomes)                                                                  | Nomes de variáveis e o comentário "Padrão e produção: neon-serverless" que gera o GAP-DOC-INTERNO-01.                                                                    |

---

## 6. Próximos passos (para o parent / DOC-FIRST via web)

1. **Fechar GAP-DOC-TOOLING-00:** executar as consultas oficiais por item (1→11) usando as perguntas
   da seção 1 como consulta, e substituir cada `PENDENTE` por URL + seção literal da doc. Nenhuma
   célula deve ser preenchida por analogia, memória ou smoke local (regra já expressa em
   `docs/evidence/hostinger-hpanel-verification.md`, "Limite da evidência").
2. **Alvos de busca (não verificados nesta rodada, sem URL registrada):** tutoriais oficiais de
   Web Apps Node/JS; deploy via Git no hPanel; variáveis de ambiente e secrets por ambiente;
   seleção de versão de Node; logs e retenção; subdomínios/preview; domínios e DNS; SSL/TLS;
   limites de plano/recurso. Tratar cada família como hipótese de fonte até ser lida.
3. **Resolver GAP-DOC-INTERNO-01 antes de A4**, porque a escolha do driver define o conjunto de
   secrets do item 11 e a sonda de egress do item 9. Se a plataforma impuser restrição de transporte,
   o item 11 muda de valor e o runbook precisa ser corrigido na mesma rodada.
4. **Decidir GAP-DOC-04 (allowlist expirando em 2026-10-06)** antes do build de produção; canal de
   release do build da plataforma precisa ser explícito.
5. **Somente após 11/11 PASS documentado:** atualizar `docs/evidence/hostinger-hpanel-verification.md`
   (com convenção de append datado definida — GAP-DOC-05), apontar o domínio e iniciar A4.

## 7. Resultado desta frente

- Itens de homologação com base documental externa: **0/11** (`PENDENTE` por indisponibilidade de
  ferramenta de web nesta execução — limite declarado, não insucesso de pesquisa).
- Itens com requisito canônico localizado e pergunta de DOC-FIRST formulada: **11/11**.
- Tópicos transversais do mandato mapeados: **11/11**, todos com pergunta pendente registrada.
- GAP-DOCs abertos: **1 de ferramental (GAP-DOC-TOOLING-00)**, **4 internos** (driver do banco,
  build na plataforma, env-guard fora de build/start, janela do allowlist) e **1 menor**
  (convenção de evidência).
- **GAP-DOC-ENGINES-01** (achado material da rodada 2026-09-12/13): a doc oficial do painel oferece seleção de Node **apenas por major** (18/20/22/24) enquanto o runbook exige patch `>= 24.15.0` e manda ABORT abaixo disso → divergência **doc ↔ runbook**; destino: **ADR-028** (fallback `>=24.6.0` como transição com prazo). Evidência: `docs/evidence/hpanel-homologacao-2026-09-12/01-node-version.md:4,18,25`; `docs/adr/ADR-028-node-engines-24-6-fallback.md`.
- Nenhum item foi promovido a `PASS`; nenhuma URL, seção ou limite foi inventado; nenhum valor de
  secret/env foi reproduzido (somente nomes e estados).

## Adendo do orquestrador — passagem web DOC-FIRST (2026-09-12) — fecha PARCIALMENTE o GAP-DOC (3 páginas oficiais: itens 1, 2, 11 e parcial 6; §7 permanece 0/11)

Fontes oficiais consultadas pelo orquestrador (páginas `.md`):

- **Build Settings** — <https://docs.hostinger.com/node.js/build-settings.md>: campos oficiais = Node version (`18/20/22/24`; 22 default), Application type (inclui **`nitro`**), Root directory, Build script (script npm, ex. `build`), Output directory (Nitro SSR = **`.output`**), Entry file (ex. `server/index.mjs`), Package manager (npm default, auto por lockfile), Source type (git/archive). **Limites: 15 min para instalação de dependências e para o build; 1 deployment por vez (até 20 na fila); logs das últimas 10 builds.**
- **Environment Variables** — <https://docs.hostinger.com/node.js/environment-variables.md>: injetadas **no build e no runtime** e persistem entre deploys; chaves `A–Z/0–9/_` (≤255), até 1000 por app; **valores mascarados**; **salvar env vars dispara redeploy**; import `.env` disponível; variáveis system-managed ficam bloqueadas.
- **Deployments** — <https://docs.hostinger.com/node.js/deployments.md>: histórico com branch/commit/status; "Current" = build que serve tráfego; **não existe rollback por commit** — publicar versão anterior exige `git revert`/reset + push (ou upload do archive anterior); deployment settings (branch/Node/build/output/entry/env) aplicam no próximo push ou via "Save and redeploy".

**GAP-DOC material (doc ↔ runbook):** o runbook de rollback app-level descreve "selecionar o commit anterior → redeploy"; a doc oficial afirma que **não há rollback por commit** → emenda obrigatória: rollback = revert/reset no Git + push (ou archive anterior). Registrar emenda antes do dia-D.
