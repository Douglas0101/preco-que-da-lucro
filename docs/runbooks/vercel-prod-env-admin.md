# Administração do ambiente de produção Vercel — env, identidade e publicação

Este runbook consolida um procedimento que estava espalhado por vários documentos:
a identidade do alvo em `docs/evidence/vercel-prod-fix-2026-09-10.md`, o inventário
e a proibição de despejo de valores em `docs/evidence/vercel-docmap-2026-09-12.md`,
a regra do redeploy e os limites do preflight em `docs/runbooks/dia-d-2026-09-12.md`,
o checklist por nome em `docs/runbooks/cutover-A4.md` §4.4 e o contrato nominal do
consumidor em `docs/runbooks/deepseek-web.md`. Ele é operacional: destina-se a quem
está com o painel aberto, e não substitui os gates de release.

O sintoma que motivou a consolidação: o chat de produção está quebrado porque o
deployment que serve o alias público ainda não contém o consumidor DeepSeek, e o
ambiente de produção da Vercel está em estado **não verificado**. Nada aqui autoriza
publicação; o circuito de release continua soberano.

## 1. Escopo e invariante "somente nomes"

- São seguros de registrar: **nomes** de variáveis, **record ids**, **targets**
  (production/preview/development), **tipos** (system, encrypted, plain, sensitive),
  estados (presente/vazio/ausente), ids de deployment, aliases e SHAs.
- **Valores nunca são lidos, impressos, logados ou armazenados em artefatos.** Isto
  inclui o valor de uma credencial, o corpo de uma `DATABASE_URL`, o token de sessão
  e o conteúdo de um export do painel. A evidência carrega nome e estado, nunca
  conteúdo.
- A razão técnica está documentada: `GET /v9/projects/{id}/env` **retorna valores
  descriptografados** — `docs/evidence/vercel-docmap-2026-09-12.md:232`. Consultar por
  API é permitido; **despejar a resposta em log ou evidência não é**.
- Convenção de captura names-only, herdada de
  `docs/runbooks/dia-d-2026-09-12.md:66-68`:

  ```bash
  # somente NOMES/ESTADOS (nunca valores) — o valor é substituído antes de existir em texto
  env | grep -E '^(AI_GATEWAY_URL|AI_MODEL|DEEPSEEK_API_KEY|AI_MODEL_PRICING_JSON)=' \
    | sed 's/=.*/=<presente>/' | sort
  ```

  No painel, o equivalente é a checklist por nome de `docs/runbooks/cutover-A4.md:287`
  — "captura de NOMES (nunca valores)" é a coluna de evidência.

- A emissão, entrada, confirmação e submissão de credenciais permanece **Via A**
  (`docs/runbooks/deepseek-web.md:54-68`): o operador emite e cola; o agente prepara
  campos nominais e acompanha estados. O valor da credencial não passa pelo chat.

## 2. Pré-voo: conferir identidade antes de tocar em qualquer coisa

Nenhuma mutação começa antes destas cinco conferências. Identidade errada transforma
uma correção de ambiente em incidente.

| Item                    | Valor medido                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| Alias público           | `preco-que-da-lucro-sage.vercel.app`                                    |
| Deployment servindo     | `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`                                      |
| `gitCommitSha` servindo | `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9` (release v1.0.1, 2026-10-01) |
| `main` HEAD (candidato) | `fa45632391ad9ffe1d20d3bad5264a53b565638e`                              |
| Projeto                 | `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`                                      |
| Time                    | `team_2NnkSYjw5NRHAFnQFEPSHGmW`                                         |

**Refs locais podem estar defasados.** Um clone com `main` antigo não prova o HEAD
remoto; conferir com `git ls-remote origin refs/heads/main` (ou `git fetch`) antes de
comparar SHA. Na medição desta redação, `origin/main` era `fa45632…` enquanto o ref
local `main` apontava para um commit de 2026-09-06 — a divergência é do clone, não do
remoto.

**Publicação do domínio customizado é manual.** Com `autoAssignCustomDomains=false`,
o projeto não associa domínio próprio sozinho: após publicar o SHA novo, o host
customizado precisa ser associado/apontado à mão. Um deploy verde com domínio
customizado apontando para o deployment antigo continua servindo o artefato antigo.

**Proteção de deployment.** `ssoProtection.enabled=true` com
`deploymentType="all_except_custom_domains"` significa que **todo alias `.vercel.app`
está atrás da Vercel Authentication** e só o domínio customizado é publicamente
acessível. Consequência operacional: probe anônimo contra `*.vercel.app` recebe `302`
para `vercel.com/sso-api` (medido em
`docs/evidence/vercel-docmap-2026-09-12.md:315-317`) — isso **não** é falha da
aplicação. Os probes da §6 rodam contra o domínio customizado, ou contra o alias com
sessão autenticada do painel.

## 3. Inventário do registro de env de produção — só nome + record id + target + tipo

Medido hoje pela API de env do projeto `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`. Nenhum
valor foi lido; a coluna "estado" descreve apenas o que o registro afirma.

| Nome                    | Record id          | Target               | Tipo              | Estado medido e ação exigida                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------ | -------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_GATEWAY_URL`        | `MRVEv4GtTHNQtbMq` | production + preview | sensitive         | Registro que o chat lê. Documentado como **definido e vazio**. **Editar no lugar** para `https://api.deepseek.com/chat/completions`.                                                                                                                                                                                               |
| `AI_MODEL`              | `J5pElDTcKFX90oTm` | production + preview | sensitive         | Valor **NÃO VERIFICADO**. **Pré-requisito duro**, não um acerto cosmético: sob o código novo, qualquer valor não-vazio diferente de `deepseek-flash` faz **todo** turno falhar com `DEPENDENCY_ERROR` (`src/lib/chat.functions.ts:337-347`). Ajustar para `deepseek-flash` ou deletar o registro para valer o default documentado. |
| `DEEPSEEK_API_KEY`      | `RcHEC8R64Y7c2l2g` | production           | sensitive         | Credencial, **Via A apenas**. Precisa ser não-vazia e sem espaço no início/fim — `src/lib/chat.functions.ts:352` rejeita valor com padding com `ai.credential_unusable`.                                                                                                                                                           |
| `AI_GATEWAY_API_KEY`    | `rAlJcM0NLgoH2NPk` | production + preview | sensitive         | Código morto no caminho DeepSeek sob o SHA novo, mas a **única** credencial lida pelo SHA que serve hoje. **Não deletar antes de o SHA novo servir tráfego.**                                                                                                                                                                      |
| `AI_MODEL_PRICING_JSON` | `vT1FaOQa5aOwHZFi` | production + preview | (conforme painel) | Opcional, recomendado. Sem ele, `deepseek-flash` resolve custo `unknown`, **nunca zero** (INV-006). JSON malformado é `CONFIG_ERROR` no boot. Valor nominal: `{"deepseek-flash":{"inputPerMillion":0.3,"outputPerMillion":1.2}}` (`docs/runbooks/deepseek-web.md:44-46`).                                                          |
| `DATABASE_URL`          | `LQTKQMUeLWmQnHkM` | production + preview | sensitive         | Reescopoado em 2026-10-06 para `target: production` **sem valor no PATCH**; não verificado; suspeito principal do `503 not_ready` de 2026-10-08.                                                                                                                                                                                   |
| `RESEND_API_KEY`        | `w4nacFXeB8N4rtNz` | (conforme painel)    | (conforme painel) | Par de e-mail transacional. `.env.example:29` mostra `RESEND_API_KEY=""` — a forma aspirada-vazia que **recria** a condição "definido e vazio".                                                                                                                                                                                    |
| `AUTH_EMAIL_FROM`       | `PwFFRn9YR6pV7SeZ` | (conforme painel)    | (conforme painel) | Segunda metade do par.                                                                                                                                                                                                                                                                                                             |

**Regras duras sobre os registros:**

- **`AI_GATEWAY_URL` — editar no lugar, nunca criar segundo registro.** Duas
  production records com a mesma chave têm precedência ambíena dentro do mesmo
  escopo: o runtime pode continuar lendo a vazia e o chat continua quebrado.
- **`AI_GATEWAY_URL` — não deletar.** A deleção aponta silenciosamente o build antigo
  para o gateway legado Lovable (`src/lib/chat.functions.ts:330-331`) e remove o
  ponteiro de todo preview que não seja `develop`.
- **Registro existente e vazio = DELETAR, não preencher.** Um registro com valor vazio
  ocupa o nome e ainda assim não configura nada; preenchê-lo deixa a janela em que o
  nome "existe" mas o runtime lê string vazia. Isto vale sobretudo para o par
  `RESEND_API_KEY` / `AUTH_EMAIL_FROM`.
- **`DATABASE_ADMIN_URL`, `SUPABASE_*` e `MIGRATION_*` devem permanecer ausentes** do
  escopo web (H-11/H-14; remoção registrada em
  `docs/evidence/vercel-prod-fix-2026-09-10.md:24-39`).

**Sobre `DATABASE_URL`, com precisão:** `src/db/client.server.ts:78-87` passou a
tratar "definido e vazia" como **não configurado**, com erro explícito — a condição
que produziu o `503` de 2026-09-10. Mas um valor **só de espaços** ou **malformado**
passa pelo guard e falha dentro do driver, com o mesmo sintoma de produção. A
confirmação de formato é de quem tem o valor, nunca deste runbook.

## 4. A regra do redeploy

**Mudança de env não afeta deployment existente; exige deployment novo.** Está
documentado duas vezes, em fontes independentes:

- `docs/evidence/vercel-docmap-2026-09-12.md:307` — alteração de env var não se aplica
  a deployments existentes, exige novo deployment/redeploy.
- `docs/runbooks/dia-d-2026-09-12.md:52-55` — e a consequência: "probe canônico antes
  do redeploy mede artefato **antigo** e mente".

Portanto a unidade de trabalho **não é** a variável: é **(uma mudança de env → um
redeploy → um conjunto de probes)**. Salvar três variáveis e sondar uma vez produz um
veredicto sobre uma mistura que ninguém sabe descrever.

O precedente de cadeia está medido: a correção de produção de 2026-09-10 precisou de
**quatro redeploys sequenciais** do mesmo commit, um por elo da cadeia causal
(`docs/evidence/vercel-prod-fix-2026-09-10.md:46-54`). Cada elo só apareceu depois de
o anterior ser corrigido e o runtime log ser lido. Plujar "quantos redeploys serão
necessários" é ignorar o precedente: **registre cada deploy e o elo que ele testa**.

## 5. A lacuna do preflight, dita sem rodeio

`scripts/m02-auth-preflight.ts --require-email` **não cobre o que está quebrado aqui.**
Ele classifica somente nomes de auth e **explicitamente não** julga `DATABASE_*` nem
`AI_*` (`docs/runbooks/dia-d-2026-09-12.md:490-493`; a lista de não-cobertura inclui
também `SUPABASE_*` e `MIGRATION_*`). Rodá-lo dá confiança sobre `BETTER_AUTH_*` e
sobre o par de e-mail — e **zero** informação sobre o formato do consumidor de IA.

Consequência: a forma do contrato de IA tem de ser conferida **por nome no painel**,
ou por leitura do código, antes de publicar. O contrato estrito está em
`src/lib/chat.functions.ts:337-347`: no endpoint DeepSeek, a origem exata
`https://api.deepseek.com`, o path exato `/chat/completions`, ausência de userinfo,
query e fragmento, e `model === "deepseek-flash"` — qualquer desvio é
`DEPENDENCY_ERROR`, não degradação. Recomendação: checklist por nome contra essas
linhas, no mesmo formato de `docs/runbooks/cutover-A4.md:292-299`.

## 6. Procedimento ordenado

Um passo por elo; cada passo termina com verificação. Preencha a tabela da §6.9 depois
de **cada** mudança.

### 6.1 Elo 0 — inventário e backup do estado

1. Conferir as seis identidades da §2 (alias, deployment, SHA servindo, `main` HEAD,
   projeto, time). SHA divergente = **PARAR**.
2. Exportar o inventário de env **por nome/record id/target/tipo/estado** para
   `docs/evidence/vercel-prod-env-admin-<data>/env-names-before.txt`, com o
   `sed 's/=.*/=<presente>/'` da §1 quando a fonte for um dump de processo.
3. Conferir o estado do domínio customizado e de `ssoProtection` (ambos da §2).

Verificação: o arquivo `env-names-before.txt` existe, contém os oito nomes da §3 com
seus record ids, e **não contém nenhum valor** — confirmação por leitura humana, não
por grep de padrão.

### 6.2 Elo 1 — `DATABASE_URL`

1. Conferir no painel o registro `LQTKQMUeLWmQnHkM`: **nome, target, estado**.
2. Tratar "definido e vazio" como não configurado: **deletar** o registro vazio e
   criar um novo, ou editar no lugar com a URL válida — só o operador com o valor
   decide. Um registro só de espaços conta como vazio para efeito prático.
3. Se o target foi reescopoado para `production` apenas, decidir se o preview precisa
   de registro próprio — e registrar a decisão, não o valor.

Verificação: o nome consta no inventário com estado distinto de vazio, no target
exigido pelo circuito; **nenhum valor no artefato**.

### 6.3 Elo 2 — `AI_MODEL` (pré-requisito duro)

1. Conferir `J5pElDTcKFX90oTm`. Valor não verificado **bloqueia** a publicação.
2. Ajustar para `deepseek-flash`, ou **deletar** o registro para que o default
   documentado valha (`src/lib/chat.functions.ts:336`).
3. Não deixar nenhum outro valor não-vazio: sob o SHA novo ele quebra todo turno com
   `DEPENDENCY_ERROR`.

Verificação: nome com valor `deepseek-flash` **ou** nome ausente do inventário; os
dois casos são aceitáveis, e a verificação registra qual dos dois.

### 6.4 Elo 3 — `AI_GATEWAY_URL`

1. **Editar no lugar** `MRVEv4GtTHNQtbMq` para
   `https://api.deepseek.com/chat/completions`. Não criar segundo registro de
   production, não deletar.
2. Conferir a string final contra `src/lib/chat.functions.ts:339-344`: origem, path,
   sem userinfo, sem query, sem fragmento, sem porta alternativa.

Verificação: um registro só, target production+preview, com a URL exata.

### 6.5 Elo 4 — `DEEPSEEK_API_KEY` (Via A)

1. O operador emite/insere/confirma a chave em `RcHEC8R64Y7c2l2g`, target production.
   O agente **não** lê o valor, em nenhum ponto.
2. Atenção ao padding: leading/trailing whitespace vira `ai.credential_unusable` e
   `DEPENDENCY_ERROR` em `src/lib/chat.functions.ts:352`. Colar e salvar uma vez, sem
   reescrever.
3. `AI_MODEL_PRICING_JSON` (`vT1FaOQa5aOwHZFi`) entra neste elo, se o operador
   quiser custo conhecido: valor nominal
   `{"deepseek-flash":{"inputPerMillion":0.3,"outputPerMillion":1.2}}`. JSON
   malformado é `CONFIG_ERROR` no boot — conferir a validade antes de salvar.

Verificação: nome presente, target production, estado não-vazio; **presença
verificada só pelo nome**, como o gate de `docs/runbooks/deepseek-web.md:86-88`.

### 6.6 Elo 5 — par de e-mail e limpeza de escopo

1. `RESEND_API_KEY` (`w4nacFXeB8N4rtNz`) e `AUTH_EMAIL_FROM` (`PwFFRn9YR6pV7SeZ`):
   registro que existe e está vazio deve ser **deletado**, não preenchido. Depois
   preencher os dois juntos, ou remover os dois — par pela metade vira bloqueio
   condicional do preflight.
2. Reconferir que `DATABASE_ADMIN_URL`, `SUPABASE_*` e `MIGRATION_*` seguem
   **ausentes** do escopo web (H-11/H-14).
3. Reconferir `AI_GATEWAY_API_KEY` (`rAlJcM0NLgoH2NPk`): **ainda presente**, porque o
   SHA servindo ainda o lê. Ele só sai depois que o SHA novo servir tráfego.

Verificação: o par de e-mail está consistente (os dois preenchidos ou os dois
ausentes), os proibidos continuam ausentes, e `AI_GATEWAY_API_KEY` continua listado.

### 6.7 Elo 6 — publicação e probes

1. Um **redeploy por elo testado**, na ordem acima, e nunca um redeploy único para
   "tudo junto" (precedente: `docs/evidence/vercel-prod-fix-2026-09-10.md:46-54`).
2. Após cada redeploy, os três probes — contra o domínio customizado, porque
   `*.vercel.app` está atrás da Vercel Authentication (§2):

   | Probe                       | Esperado                                                    |
   | --------------------------- | ----------------------------------------------------------- |
   | `GET /api/health/live`      | `200` `{"status":"ok"}`                                     |
   | `GET /api/health/ready`     | `200` `{"status":"ready","dependencies":{"postgres":"ok"}}` |
   | `GET /api/auth/get-session` | `200` com corpo `null` (anônimo)                            |

   `ready` `503` com `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}`
   aponta para o elo de banco, não para o de IA. Verificação verde nos três probes é
   condição **necessária, não suficiente**: o chat só é provado por conversa real com
   conta legítima, conforme `docs/runbooks/deepseek-web.md:69-71`.

3. Só depois de os probes ficarem verdes com o SHA novo, `AI_GATEWAY_API_KEY` pode ser
   removido — em rodada própria, com redeploy próprio.

Verificação: para cada redeploy, nome do deployment + elo + resultado dos três probes,
arquivados em `docs/evidence/vercel-prod-env-admin-<data>/`.

### 6.8 Elo 7 — conversa real e custo

1. Com conta legítima, uma conversa e uma rodada de ferramenta; conferir resposta,
   tenant autorizado, uso medido e estimativa persistida
   (`docs/runbooks/deepseek-web.md:69-71`).
2. `deepseek-flash` sem `AI_MODEL_PRICING_JSON` produz custo `unknown` — correto, e
   diferente de zero fictício (INV-006). Custo `unknown` não é falha de configuração.

Verificação: turnos com resposta real e `ai_usage` liquidado registrados no
`docs/evidence/vercel-prod-env-admin-<data>/`.

### 6.9 Tabela de verificação names-only (preencher após cada mudança)

| Elo | Nome alterado | Record id | Ação (editar/deletar/criar) | Target conferido | Tipo | Redeploy | Probes | Valor lido? |
| --- | ------------- | --------- | --------------------------- | ---------------- | ---- | -------- | ------ | ----------- |
|     |               |           |                             |                  |      |          |        | **NÃO**     |

A última coluna é a invariante da §1: só admite `NÃO`. Qualquer outra entrada invalida
a evidência da rodada.

## 7. Restrição de ordem e nota de segurança

**Não apontar o runtime antigo para uma variável que só o código novo entende.**
`docs/runbooks/deepseek-web.md:60-63` (passo 1 da seção Via A): conferir conta,
projeto, deployment e SHA do consumidor protegido **antes** de inserir configuração;
não mudar o runtime antigo de `main` para uma variável que somente o candidato
conhece; preparar e validar primeiro em bancada de desenvolvimento isolada;
produção aguarda o circuito de release completo. Nenhum ajuste de endpoint implica
autorização de deploy (`docs/runbooks/deepseek-web.md:67-68`).

Na prática, aqui: `AI_GATEWAY_URL` apontando para o endpoint DeepSeek **antes** de o
SHA novo servir tráfego não acelera nada — o build antigo ainda lê
`AI_GATEWAY_API_KEY` e o caminho antigo. A ordem que faz sentido é a da §6: identidade
→ banco → forma do consumidor → credencial Via A → publicação do SHA novo → limpeza.

**Nota de segurança — reparar env sem publicar o SHA novo não basta.** O SHA que
serve hoje (`d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`) resolve
`@tanstack/react-start@1.168.49`, **abaixo** do piso obrigatório `>=1.168.60`
(GHSA-qx66-fv34-fjm8 / CVE-2026-102989, `AGENTS.md` — seção Dependency discipline). A
Vercel **já recusou** um redeploy dessa revisão com `BLOCKED_PACKAGE`. Uma rodada que
conserta apenas o ambiente e republica o SHA antigo deixa produção numa revisão
sinalizada pelo fornecedor, com o chat consertado e a vulnerabilidade intacta. A
correção de ambiente é **pré-condição** da publicação do SHA novo, não substituta
dela.

## 8. Rollback

O alias volta por **promote/rollback para um deployment existente** — não por nova
publicação, que reconstruiria e revalidaria tudo.

| Situação                                     | Ação                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Volta ao último estado bom conhecido         | apontar o alias para `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` (`d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`, release v1.0.1, 2026-10-01) |
| Estados bons já medidos nesse deployment     | `/api/health/live` 200, `/api/health/ready` 200 com `postgres: ok`, `/api/auth/get-session` 200 `null`                           |
| SHA candidato que **não** é alvo de rollback | `fa45632391ad9ffe1d20d3bad5264a53b565638e` (`main` HEAD) — não publicado; não serve tráfego                                      |

Ressalvas honestas do rollback:

- Voltar a `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` **restaura o consumo quebrado**. O
  artefato antigo lê `AI_GATEWAY_API_KEY`, não `DEEPSEEK_API_KEY`; o chat volta a
  falhar do jeito que falha agora. O rollback é para conter dano colateral (banco,
  auth, e-mail), não para restaurar o chat.
- Env editada **não** volta com o rollback: variáveis são do projeto, não do
  deployment. Se uma variável foi editada e o rollback for acionado, a variável
  continua editada — a rodada de env precisa ser desfeita à mão, elo por elo, com
  registro no inventário.
- Rollback não é prova de saúde: repetir os três probes da §6.7 depois de promover, e
  reconferir a identidade do alias (`preco-que-da-lucro-sage.vercel.app` →
  deployment servindo) antes de declarar a contenção encerrada.
- `vercel promote` e `vercel redeploy` **mutam produção** e estão fora do escopo de
  qualquer verificação read-only (`docs/evidence/vercel-docmap-2026-09-12.md:234,
238-239`): só com aprovação explícita do operador.

## Limites deste runbook

- Nenhum valor de env foi lido, impresso ou comparado nesta redação. As oito linhas da
  §3 descrevem **registros**, não conteúdo.
- O SHA servindo e o SHA de `main` foram conferidos contra o remoto
  (`git ls-remote origin refs/heads/main` → `fa45632…`), mas **não** contra a API da
  Vercel: a identidade do deployment `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` e o
  `gitCommitSha` que ele carrega vêm do contexto desta rodada, não de uma medição
  própria.
- O target e o tipo de `AI_MODEL_PRICING_JSON`, `RESEND_API_KEY` e `AUTH_EMAIL_FROM`
  estão marcados "conforme painel" porque não foram medidos aqui.
- A versão resolvida de `@tanstack/react-start` no lockfile atual do repositório é
  `1.168.60`, ou seja, **no piso** — não acima dele. O `>=` é satisfeito, com margem
  zero.
- Login ponta a ponta, e-mail transacional e chamada real faturável ao provedor
  continuam pendentes de execução humana; nada aqui os fecha.
