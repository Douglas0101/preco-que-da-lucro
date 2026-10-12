# Recuperação controlada da produção — investigação corretiva e entrega

**Data:** 2026-10-12 (UTC) · **Regra:** nenhuma escrita em produção, nenhum deploy, nenhum merge,
nenhuma promoção, nenhum DNS, nenhum valor de env lido. **Produção NÃO foi recuperada** — a
recuperação passa pelos itens humanos da §11 e nenhum deles foi executado sem autorização.
**Evidências brutas:** `captures/` + `RAW-EVIDENCE-LOG.md` + `MANIFEST.sha256`.

---

## 0. Sumário executivo

1. **CI main (FASE A): causa-raiz única, corrigida e com regressão verde.** O check exigido
   `scan + cobertura` de `main` (`40c1a355`) reprovou no **attempt 2** porque o re-run submeteu
   uma **segunda** análise da mesma revisão e o código de então exigia _exatamente uma_
   (`matches.length !== 1`). O baseline virou o stub `NO-VERDICT` (508 B) e o passo
   `Seal scanner LCOV provenance` — sem `continue-on-error` — transformou isso em exit 2.
   O CE, o SHA, o branch e a identidade estavam corretos o tempo todo; `releasePolicy=OK`
   (`new_coverage=73.4 ≥ 60`, ADR-042). A correção (`182754f`, DBT-103) seleciona a análise
   **pela identidade do CE deste run** e mantém o fail-closed; 80 testes de regressão passam,
   incluindo o cenário real com os dois `analysisId` do attempt 2.
2. **Os 68 caminhos não resolvidos pelo scanner são o recorte declarado, não perda.** Aritmética
   exata: 184 do LCOV − 68 não-resolvidos = 116 = todos os arquivos in-scope (`src/**` sem
   `src/test/**`). Os 68 = 63 de `scripts/**` (fora de `sonar.sources=src`, ADR-034/DBT-58) +
   5 de `src/test/**` (excluídos). Nenhum arquivo do escopo foi descartado em silêncio.
3. **Vercel (FASE B): acesso read-only recuperado; a 403 anterior era de escopo/identidade, não
   de permissão ausente.** O deployment `fa45632` é `dpl_6h2LTZ…`: `READY`, target `production`,
   `iad1`, mas **quebrado no driver Neon** (log fresco: exceção de WebSocket em
   `@neondatabase/serverless` + `health.readiness_failed` → 503). O alias de time foi re-apontado
   para a revisão antiga em 2026-10-08 18:48/19:00 (rollback pós-falha); o alias legado
   `preco-que-da-lucro.vercel.app` (fora do escopo do time) segue servindo a revisão quebrada
   publicamente. `main` `40c1a355` **não** tem deployment (`git.deploymentEnabled=false`).
4. **Neon (FASE C): infraestrutura sã; a ponte quebrada é a env.** `production` (`br-snowy-violet`)
   vinculada à Vercel como "vercel production branch", endpoint ativo, schema 20/20 sem drift,
   RLS 35/37; o `-sage` conecta agora. A sonda de hoje no deployment quebrado **não ativou nenhum
   compute do projeto** → o `DATABASE_URL` embutido **não** aponta para um endpoint saudável deste
   projeto (ou é de outro projeto/inexistente, ou falha de credencial). A `develop` arquivada é
   mecanismo compatível, mas **anterior às falhas** (elas começam ~25 h antes do archiving) —
   causa-raiz do valor quebrado exige leitura via Via A humana.
5. **Candidato (FASE D):** `develop` `182754f` com gates locais verdes (`check` e `db:test` 18/18
   em container efêmero). O fluxo de release `develop → main` está preparado e exige aprovação
   humana; o CE de `main` deve rodar na revisão NOVA pós-merge (o SHA antigo não recupera por
   re-run — o re-run usa o workflow do próprio SHA).
6. **Staged deployment (FASE E): plano pronto; criação aguarda autorização específica.** Não
   existe URL staged para Computer Use — inspecionei o que existe (o deployment quebrado e o
   `-sage`) e registrei como limite, sem apresentar preview antigo como se fosse o candidato.
7. **Domínio (FASE F):** `diretrizprecifica.com` está na Hostinger (NS `dns-parking.com`), serve
   **Hostinger Horizons** (builder estático, catch-all, `last-modified` 2026-09-06), TLS Let's
   Encrypt SAN apex+www. O destino declarado pelo ADR-039 (Hostinger Node/Nitro **após** validação
   do circuito) não está cumprido — decisão humana; nenhum DNS foi tocado.

**Veredito final (§ abaixo): READY FOR STAGED DEPLOYMENT (técnico) com BLOCKED — HUMAN ACTION nos
itens de env Via A, aprovação de release, autorização de criação do staged e decisão de domínio.
A produção publicada continua degradada e NÃO foi declarada recuperada.**

---

## 1. Diagnóstico da falha do CI main (FASE A)

**Run** `38112535521` · workflow _SonarCloud (scanner + cobertura)_ · `head_sha=40c1a355`
(`main`) · `run_attempt=2` · `conclusion=failure` (o attempt 1 fechou `success`; a falha nasceu
do **re-run** humano).

**Identidade (do proprio run, `c25-gate-readout.json`):** `providerIdentity.revision=40c1a355…`,
`branch=main`, `pullRequest=null`, `ceTaskId=AaErfPmYHxi1U64p4iLF`,
`analysisId=08d02858-5846-445b-b349-9e1fc4fe6ba3`, `surface.branchType=LONG`. O CE **concluiu** a
análise do mesmo SHA; a API estava **disponível** (o stub do baseline registra GitHub 200/332 ms
e Sonar `/api/project_analyses/search` 200/216 ms).

**Causa-raiz medida (não suposta):** em `scripts/sonar/main-baseline.mjs` no SHA `40c1a355`, a
precondição era `matches.length !== 1 || analyses[0].revision !== sha` → recusa. O attempt 1 criou
a análise `11893646-49df-4fe9-a029-de9cec53dbf2`; o attempt 2 criou a análise
`08d02858-5846-445b-b349-9e1fc4fe6ba3` — **duas análises da MESMA revisão** → `matches.length=2`
→ stub `main-baseline/2` `NO-VERDICT` → o passo de selo (sem `continue-on-error`) sai 2 e derruba
o check exigido. **Determinístico:** uma terceira tentativa mediria 3 análises e falharia igual.

**Inconsistência temporal:** sim — a "análise de main" é ambígua quando o mesmo SHA é submetido
duas vezes; a unicidade era uma proxy frágil da identidade. A correção usa o `analysisId` do CE
**deste** run (lido do readout que o passo anterior já esperou) e exige que a análise mais recente
de `main` **seja a nossa e na revisão medida** — identidade no lugar de cardinalidade.

**Métricas do período de código novo (readout):** `new_coverage=73.4`, `new_reliability_rating=1`,
`new_security_rating=1`, `new_maintainability_rating=1`, `new_duplicated_lines_density=1.0`,
`new_security_hotspots_reviewed=100.0`. O denominador de linhas/condições (`new_lines_to_cover`…)
**não está persistido nos artefatos do attempt 2** porque o passo que o grava produziu o stub — é
gravado pelo baseline corrigido e ficará disponível na próxima execução de main. **Limite
declarado**: sem `SONAR_TOKEN` local (vive no runner, correto) não é possível remedir a API aqui.

**Proveniência do LCOV:** o selo falhou por **efeito de segunda ordem** do mesmo defeito (stub →
exceção com mensagem genérica, exit 2). A correção passou a **nomear a fase**
(`BASELINE_ARTIFACT_UNUSABLE`, `GATE_READOUT_UNAVAILABLE`, `LCOV_UNAVAILABLE`, …) **preservando o
exit 2** — nomear não afrouxa o selo — e o teste de regressão reproduz o estado real do attempt 2
(stub de 508 B) exigindo o código nomeado.

**Os 68 caminhos não resolvidos (log do sensor):**
`Could not resolve 68 file paths in [/usr/src/coverage/lcov.info]`, primeiro
`scripts/m02-cutover-t0.mjs`; `Excluded sources: src/test/**`; `149 files indexed`. Identidade
aritmética: LCOV=184 únicos (121 `src/` + 63 `scripts/`) − 68 = **116 = todo o escopo**
(`sonar.sources=src` sem `src/test/**`); todos os 184 existem no SHA; os 68 = 63 `scripts/**`
(fora do `sources` por decisão ADR-034/DBT-58) + 5 `src/test/**` (exclusão). A advertência é
efeito do recorte declarado — **nenhuma unidade in-scope perdida**.

## 2. Correções implementadas

| #   | Correção                                                                | Onde                                                                | Prova                                                                                  |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| C1  | Seleção da análise de baseline pelo `analysisId` do CE do run (DBT-103) | `scripts/sonar/main-baseline-select.ts` (novo), `main-baseline.mjs` | `src/test/main-baseline-select.test.ts` com os 2 IDs reais do attempt 2 (80/80 verdes) |
| C2  | Recusas **nomeadas** por fase no selo, mantendo exit 2                  | `scripts/sonar/lcov-provenance.ts`                                  | teste "stub NO-VERDICT ⇒ `BASELINE_ARTIFACT_UNUSABLE`" (regressão verde)               |
| C3  | `reasonCode` de conjunto fechado no stub de falha do baseline           | `scripts/sonar/main-baseline.mjs`                                   | artefato novo passa a nomear a causa (o antigo não tinha o campo)                      |

Nenhum teste, regra ou orçamento foi removido; nenhum threshold foi alterado; nenhuma cobertura
foi inflada. As correções já estão em `develop` (`182754f`) — o check cumulativo local que as
acompanha está verde (§6).

## 3. Evidências da ADR-042

- `releasePolicy.status=OK` com `policy=ADR-042/coverage-minimum-60`, mínimo 60, medido **73.4**,
  `blockingConditions=[]`, controles preservados (reliability/security/maintainability/duplication/
  hotspots) — tudo no artefato real `c25-gate-readout.json` do run de `main`.
- O preset do provedor segue em 80% (condição `new_coverage` `ERROR` no veredito bruto) —
  **coexistência declarada** pela ADR-042 §3; o scanner `qualitygate.wait=false` + leitura do CE
  real preservam o veredito bruto e aplicam o mínimo de 60%.
- **O SHA `40c1a355` não recupera por re-run** (o re-run usa o workflow do próprio SHA e criaria
  uma terceira análise). O verde do check exigido de `main` volta com a **revisão nova** do
  release PR — exatamente o fluxo da §9. Nada disso é novidade da ADR-042; nada dela foi alterado.

## 4. Estado do acesso Vercel (FASE B)

**Diagnóstico da classe de erro da sessão anterior (403 → "re-authenticate to this scope"):**
_escopo/identidade da sessão_, não permissão ausente nem recurso inexistente. Nesta medição o MCP
respondeu em escopo de time (`list_teams` → `team_2NnkSYjw5NRHAFnQFEPSHGmW`); `/v2/user`
responde **404 not_found** — comportamento de token sem superfície de usuário (classe de
identidade do token, não de permissão). Nenhum controle foi contornado.

**Deployment `fa45632` (mission) = `dpl_6h2LTZX57soGiPP2oTurws7NsgVd`:**
SHA `fa45632391ad9ffe1d20d3bad5264a53b565638e` (PR #60) · target `production` · `READY` ·
`LAMBDAS` · `iad1` · criado 2026-10-08T17:45:32Z · URLs `preco-que-da-lucro-gssnblvr8.vercel.app`.

- **Readiness:** 503 `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}`
  (diretamente no URL do deployment, via bypass de proteção de deployment; `x-correlation-id`
  `0520468f-…`). **Sessão:** 500 HTML (error boundary) na superfície pública que o serve.
- **Log fresco (2026-10-12T01:49:44Z):** `Uncaught Exception: Error: Unhandled error. ()` no
  `@neondatabase/serverless` (WebSocket) → `health.readiness_failed postgres` → 503
  (`correlationId a4491fa0-…`, request `cg2s9-…`). A falha é **de conexão com o banco**, no
  driver, não no CDN/edge.
- **Runtime:** Node 24.x, framework `tanstack-start-lovable`, região `iad1`.
- **Variáveis (somente nome/escopo/timestamp; nenhum valor lido):** produção tem `DATABASE_URL`
  **manual** `sensitive` (editada 2026-10-06T16:37:23Z — **única mutação** entre o build funcional
  de 2026-10-01 e o build quebrado de 2026-10-08) e a `DATABASE_URL_UNPOOLED` da integração Neon;
  a integração **não** injeta `DATABASE_URL` em produção (só em preview/develop);
  `hiddenProductionEnvCount=0`. Demais chaves presentes (auth/IA/OTEL/CSP) — nomes em
  `captures/vercel-topology.txt`.
- **Logs e retenção:** plano Hobby retém 1 h; `since=2h/7d` rejeitados (400) pelo provedor — os
  logs de 2026-10-08 não são mais recuperáveis; os agrupamentos de erro da plataforma preservam a
  classe e os `correlationId` do dia (capturados na auditoria e neste pacote).

## 5. Diagnóstico da conexão Neon (FASE C)

- Projeto `damp-forest-57346541` (PG 17, aws-us-east-2). Três branches permanentes: `production`
  (`br-snowy-violet-aymcvvvv`, ready/default, **restrições "vercel production branch"** — vínculo
  Vercel↔Neon confirmado), `develop` (`br-small-hill-aymcu14y`, **archived** desde
  2026-10-09T18:35:05Z) e `ci-fixture-base` (ready, vazia).
- Endpoints: produção `active` (última atividade 01:47:29Z, correlação com o `-sage`);
  develop `idle` desde 2026-10-08T18:25:43Z; ci-fixture `idle`. `pooler_enabled=false` em todos.
- **Identidade/estado das conexões:** a sonda de hoje no deployment quebrado **não ativou compute
  de nenhum endpoint** deste projeto → o alvo embutido não é endpoint saudável deste projeto.
  O `-sage` conecta agora ao endpoint de produção (200/200) → cluster são e alcançável.
- **Schema:** read-only em produção — 20 migrations aplicadas (sem drift), 37 tabelas públicas,
  35 com RLS, 129 linhas RUM. Compatível.
- **`develop` archived não é a causa observada:** as falhas do `dpl_6h2LTZ` começam ~25 h antes do
  archiving. Mecanismo compatível _se_ o valor apontar para o endpoint dela — atribuição do alvo
  exige leitura do valor (**Via A humana**); não foi presumida.
- Nenhuma migration/escrita executada; telemetria de log Neon retornou vazia (canal indisponível).

## 6. Estado do candidato de release (FASE D)

- `develop` = `182754fe98bb2f01ceafd5cad81bb890b71f18a3` (contém C1–C3 e o espelho informacional da
  PR #61); árvore difere de `main` apenas por journal/evidência (back-merge em `74ab15f`).
- **Bancada local (esta sessão):** `db:test` **EXIT=0 — 18/18 suítes** contra container PG17
  **efêmero** (127.0.0.1:55432, descartado após o uso); `npm run check` completo na árvore
  reconciliada (ver `captures/local-gate.txt`).
- **Reconciliação pendente:** o pacote `docs/evidence/auditoria-producao-2026-10-12/**` e o
  journal (`PROGRESS.md`) estavam não-commitados da sessão anterior; este trabalho os reconcilia
  no mesmo commit de evidência (docs-only → light CI).
- **Fluxo de integração:** `develop → main` por PR de release (o único canal), exige aprovação
  humana; após o merge, o **CE real da nova revisão de `main`** (ADR-042) e os checks do ruleset
  precisam ficar verdes — o run de `main` pós-merge usa o workflow já corrigido.

## 7. Resultado dos testes Computer Use (FASE E)

**Não executado contra um deployment staged porque ele não existe** — a criação exige autorização
específica (não concedida) e não há preview do SHA candidato (o último preview é `ce9bd44`,
2026-10-06, **anterior** às correções — apresentá-lo como "staged" seria medir a revisão errada).
O que foi medido em navegador/HTTP real nesta sessão, no lugar dos candidatos existentes:

| Verificação                                          | Alvo                       | Resultado                                  |
| ---------------------------------------------------- | -------------------------- | ------------------------------------------ |
| `GET /api/health/ready`                              | `dpl_6h2LTZ` (por bypass)  | **503** `not_ready` (postgres unavailable) |
| `GET /api/health/ready`                              | alias público legado       | **503** (5/5 determinístico, 0,22–0,28 s)  |
| `GET /api/auth/get-session`                          | alias público legado       | **500** HTML                               |
| `GET /auth` e `GET /`                                | alias público legado       | 200 HTML (render)                          |
| `GET /api/health/ready` · `get-session`              | `-sage` (d4b9395)          | **200** `ready` · **200** `null`           |
| `GET /api/health/ready`                              | alias de time e URL direto | 302 Vercel Authentication (proteção ativa) |
| CSP (report-only), HSTS, nosniff, permissions-policy | correções com 503          | presentes                                  |

O **classificador de falhas de readiness** (exigido no plano staged) existe em `develop`
(`classifyDatabaseFailure` + identidade do deployment em `src/routes/api/health/ready.ts`) e tem
testes verdes na suíte — mas **não está publicado** em nenhuma revisão em produção (por isso o
503 de hoje não se auto-classifica; é o F4 da auditoria anterior).

## 8. Matriz de regressões

| Regressão                                                             | Comando/escopo                                                                | Resultado                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| DBT-103 (seleção do baseline; re-run com 2 análises da mesma revisão) | `npx vitest run src/test/main-baseline-select.test.ts` (+ gate-readout + api) | **80/80 passed**                                    |
| Selo nomeia fase com o stub REAL do attempt 2                         | idem (caso com artefato real de 508 B)                                        | exit 2 com `BASELINE_ARTIFACT_UNUSABLE`             |
| Cadeia de banco/RLS/concorrência (18 suítes)                          | `npm run db:test` em container efêmero                                        | **EXIT=0, 18/18**                                   |
| Gate local completo                                                   | `npm run check`                                                               | **PASS** (30 passos; ver `captures/local-gate.txt`) |
| Sondas de produção (sem mutação)                                      | HTTP nos 4 hostnames + domínio                                                | matriz da §7                                        |

## 9. Plano de promoção

1. **(Humano, Via A)** Conferir/corrigir a `DATABASE_URL` de produção no painel Vercel (presença,
   host = endpoint da branch `production`; nunca colar valores em contexto de agente). Opcional:
   restaurar a gestão pela integração Neon. Alternativa segura: manter manual, corrigida.
2. **(Humano)** Aprovar o PR de release `develop → main` (novo SHA de merge; sem rewrite de
   história). O PR roda a matriz completa; o push de `main` roda o Sonar corrigido.
3. **CE real da nova `main`** com `releasePolicy.status=OK` (ADR-042, ≥ 60%) + `verify-release`
   e `scan + cobertura` verdes no SHA de merge. Sem isso, não publicar.
4. **(Humano, autorização específica)** Criar o **deployment staged** manual (CLI/API, sem alias):
   `vercel deploy` **sem** `--prod` e **sem** `--alias` (preview puro, sem promote), a partir do
   SHA imutável aprovado; identificar por ID (`dpl_…`) e validar: `/api/health/ready` 200,
   `/api/auth/get-session` 200 `null`, `/`, `/auth`, CSP/console/render; **nenhum** teste com
   escrita em banco de produção (usar snapshot/leitura).
5. **(Humano)** Após o staged verde: publicar o MESMO SHA (publicação manual, condicional) e
   só então apontar/validar o destino do domínio conforme decisão da §11.
6. Pós-publicação: readiness 200 + sessão 200 + escrita RUM no deployment novo; registrar no
   journal. Só então a produção pode ser declarada recuperada.

## 10. Plano de reversão

- **Alias/promoção:** o rollback observado é por **re-apontamento de alias** (o precedente de
  2026-10-08 18:48/19:00 fez exatamente isso para `dpl_DHsbj` funcional). Manter
  `dpl_DHsbj` como alvo de rollback (`isRollbackCandidate=true`).
- **Redeploy da revisão antiga está bloqueado pelo fornecedor** (`BLOCKED_PACKAGE` — piso TanStack),
  logo o rollback não pode depender de reconstruir `d4b9395`; depende de o deployment antigo
  continuar existindo (existe) ou de corrigir a env.
- **Banco:** nenhuma migration nova entra no release; nenhum plano de reversão de schema é
  necessário. Snapshots/branching Neon estão disponíveis como rede de segurança (não usados).
- **Domínio:** como nenhum DNS foi alterado, não há o que reverter na Hostinger.
- **Critério de aborto do staged:** readiness ≠ 200 contratual, erro 5xx em `/auth` ou CSP
  violando, ou classificação de erro de banco ⇒ **não promover**; registrar a classificação.

## 11. Pendências humanas

| #   | Pendência                                                                                                                                   | Por que é humana                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| H1  | Corrigir/validar `DATABASE_URL` de produção (Via A; nomes/presença apenas)                                                                  | Valor não é legível por agente; ação de painel       |
| H2  | Aprovar e mergear o release `develop → main`                                                                                                | Merge de release exige aprovação (governança)        |
| H3  | Autorizar a criação do deployment staged (§9.4)                                                                                             | A criação exige autorização específica (missão)      |
| H4  | Decidir o destino de `diretrizprecifica.com` (ADR-039: Hostinger Node/Nitro x Vercel)                                                       | Decisão arquitetural + DNS                           |
| H5  | Decidir o descarte/retomada do alias legado `preco-que-da-lucro.vercel.app` (fora do escopo do time; serve a revisão quebrada publicamente) | Fora do alcance do token; exposição pública          |
| H6  | Restaurar ou declarar o estado da branch Neon `develop` (archived)                                                                          | Decisão de operação de dados                         |
| H7  | Publicação manual do SHA aprovado (após o veredito real do CE verde)                                                                        | Publicação é manual e condicional (contrato do repo) |

## 12. Veredito final

```
READY FOR STAGED DEPLOYMENT           (correções C1–C3 aplicadas e provadas; plano da §9 pronto)
BLOCKED — HUMAN ACTION                (H1–H7; a produção continua degradada até H1+H2+H7)
```

Justificativa em uma linha: **o defeito técnico do CI está corrigido com regressão verde e o
candidato está verde na bancada local; a recuperação efetiva da produção depende de ações humanas
(env Via A, aprovação de release, autorização de staged e publicação) — nenhuma delas foi
executada sem autorização e nenhum atalho foi usado para "esconder" o estado do job de CI.**

## Anexos

`captures/ci-main-run.txt` · `captures/sonar-run-38112535521/{c24-main-baseline.json,c25-gate-readout.json,lcov-sf-paths.txt}` ·
`captures/http-probes.txt` · `captures/vercel-topology.txt` · `captures/neon-state.txt` ·
`captures/domain-probes.txt` · `captures/local-gate.txt` · `RAW-EVIDENCE-LOG.md` · `MANIFEST.sha256`.
