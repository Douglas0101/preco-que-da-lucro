# Evidência hPanel / preview — 2026-09-09

## Resultado executivo

Esta rodada termina em **`RED / BLOCKED` e fail-closed**.

A única mutação externa autorizada que foi concluída foi a criação da branch Neon de homologação `preview-hpanel-develop-2026-09-09`, filha de `production`, com expiração declarada. A operação foi registrada imediatamente em `artifacts/B2-neon-branch-created.md:1-22`.

Não houve:

- inserção de env vars — CP-1 ficou `RED`;
- deploy ou redeploy Hostinger/Vercel;
- build, start, smoke ou 11/11 no alvo Hostinger;
- merge do PR #41;
- delete de `codex/evidence-2026-09-08` ou `vercel/install-*`;
- alteração de branch protection/ruleset;
- alteração de integração Vercel além da leitura que parou no sudo;
- alteração de domínio canônico, DNS, NS, MX, SPF, DKIM ou DMARC;
- escrita em Neon production;
- exposição de valores de env, tokens, cookies, senhas ou URLs com credenciais.

O estado-alvo `repo = develop + main (+ WIP declarado)` **não foi atingido**, porque o PR #41 continua aberto e as refs auxiliares remotas continuam presentes. O WIP preexistente foi preservado.

## 1. Branch protection, Vercel e PR #41

### Antes/depois

Antes, o GitHub mostrava ausência de classic branch protection e de rulesets, sem evidência de que Vercel fosse um check `required`; o mesmo estado do PR registrava 2 falhas e 7 sucessos (`artifacts/A1-branch-protection-before.md:3-24`).

Depois, a página continuou mostrando `Classic branch protections have not been configured` e `You haven't created any rulesets`; não houve mutação (`artifacts/A1-branch-protection-after.md:3-22`).

Conclusão A1: **não existe evidência observada de check Vercel required que pudesse ser desmarcado**. Logo, HP-9 não produziu uncheck nesta rodada. A tentativa read-only de inspecionar a app Vercel parou em `Confirm access`/sudo; nenhum método de autenticação foi acionado e nenhum escopo foi alterado (`artifacts/A2-vercel-integration-readonly.md:3-15`). Se o owner ainda desejar limitar a integração, permanece `HUMAN-REQUIRED / SUB-PORTÃO`, com os passos exatos registrados no mesmo artefato.

### Merge do PR #41

O PR #41 (`codex/evidence-2026-09-08` → `develop`, head `012f607ef1c19e8284d5e69c3112089d7c63c8d0`) segue aberto, sem conflitos, mas com bloqueio exato: `Vercel – forensic` e `Vercel – preco-que-da-lucro` estão em `Deployment has failed`; GitHub mostra `2 failing, 7 successful checks` (`artifacts/D2-pr41-merge-blocked.md:3-14`).

Resultado: **merge bloqueado; nenhuma tentativa de merge foi feita** (`artifacts/D2-pr41-merge-blocked.md:16-24`). A indicação visual `Able to merge`/sem conflitos não substitui checks verdes, nem transforma o PR intermediário em PR final `develop → main`.

## 2. Checkpoints

| Checkpoint              | Veredito                        | Entregáveis e decisão                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CP-1 — antes de env     | **RED**                         | S-SEC `RED`, S-ALIN `RED`, S-TEC `TRANSCRIPT-UNAVAILABLE`; `artifacts/CP-1-verdict.md:3-29`. Env não foi inserida e `Implantar` não foi acionado.                                                                                                            |
| CP-2 — antes do deploy  | **SEM-VEREDITO / NÃO ACIONADO** | CP-1 não liberou avanço; não existe deployment alvo, URL live ou supervisor técnico de deploy. Nenhuma mutação ocorreu.                                                                                                                                      |
| CP-3 — antes do merge   | **SEM-VEREDITO / NÃO ACIONADO** | A precondição de checks verdes falhou; D2 registra bloqueio por 2 failures e ausência de tentativa de merge (`artifacts/D2-pr41-merge-blocked.md:16-24`).                                                                                                    |
| CP-4 — antes de deletes | **SEM-VEREDITO / BLOQUEADO**    | S-DIFF `TRANSCRIPT-UNAVAILABLE`; S-ALIN `SEM-VEREDITO / NO-GO`; `artifacts/CP-4-verdict.md:3-19`. Nenhuma branch foi apagada.                                                                                                                                |
| CP-5 — fechamento       | **RED / BLOCKED**               | S-SEC `VERDE` apenas para os artefatos locais; S-TEC `TRANSCRIPT-UNAVAILABLE`; S-ALIN `RED`; S-FORENSE tardio `TRANSCRIPT-UNAVAILABLE`; `artifacts/CP-5-verdict.md:3-19`. O fechamento documental existe, mas não há fechamento positivo de release/go-live. |

O princípio aplicado foi: sem veredito compatível, a mutação correspondente não ocorre; `RED` interrompe o item sem interromper o registro dos checks independentes.

## 3. TRANSCRIPT-UNAVAILABLEs

| Supervisor/escopo                          | Registro                                                           | Bloqueio produzido                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| S-TEC / CP-1                               | `docs/evidence/subagents/S-TEC-2026-09-09.md:1-11`                 | O arquivo foi criado como registro da ausência, não como handoff. Não liberou env, deploy, 11/12 ou gates posteriores.             |
| S-DIFF / CP-4                              | `docs/evidence/subagents/S-DIFF-2026-09-09.md:1-22`                | O thread encerrou sem handoff independente. Não liberou o delete da branch `vercel/install-*`.                                     |
| S-TEC / CP-5                               | `docs/evidence/subagents/S-TEC-CP5-2026-09-09.md:1-22`             | Não há veredito técnico independente para declarar o fechamento técnico `VERDE`; build no alvo e 11/12 continuam não demonstrados. |
| S-FORENSE / dívida tardia do bundle Vercel | `docs/evidence/subagents/S-FORENSE-pr41-vercel-2026-09-09.md:1-22` | Não há revisão forense independente dos dois failures; item permanece parado, sem reabertura como `RED` e sem aprovação.           |

Os registros acima distinguem explicitamente ausência de handoff de aprovação implícita. Foram entregues, com escopo limitado, os handoffs S-SEC CP-1, S-ALIN CP-1, S-ALIN CP-4 e S-SEC CP-5; o S-ALIN CP-5 entregou `RED` (`docs/evidence/subagents/S-ALIN-CP5-2026-09-09.md:9-19`).

## 4. Preview isolado em develop

### hPanel

O inventário hPanel não mostrou um Web App Node existente. O filtro de Web Apps ofereceu somente `Comece agora`; o site já existente `floralwhite-bat-153626.hostingersite.com` apareceu como PHP/HTML/other e foi mantido intacto (`artifacts/B1-hpanel-onboarding-before-submit.md:3-5`).

Foi aberto um fluxo de criação ainda não submetido, usando domínio temporário `darkblue-termite-767663.hostingersite.com`, repositório `preco-que-da-lucro`, preset Nitro, branch `develop`, Node exibido `24.x`, raiz `./`, build `npm run build`, saída `.output`, entrada `server/index.mjs` e **env vars `Nenhum`** (`artifacts/B1-hpanel-onboarding-before-submit.md:6-18`). O botão `Implantar` não foi acionado.

Há uma discrepância que permanece registrada, não resolvida por inferência: o contexto anterior dizia “app hPanel criada, `main` selecionada, sem env vars”; a observação N1 atual encontrou o site existente como PHP/HTML e o novo fluxo Node apenas em pré-submissão, já selecionado para `develop`. Portanto, não se afirma que exista um Node Web App publicado.

### Env vars — somente nomes

Estado obtido no painel: **nenhuma variável configurada**. Nenhum valor foi coletado ou escrito.

Nomes runtime esperados pelo contrato/runbook:

```text
DATABASE_URL
DATABASE_DRIVER
BETTER_AUTH_URL
BETTER_AUTH_SECRET
AUTH_TRUSTED_ORIGINS
PORT
NITRO_PORT
HOST
NITRO_HOST
RESEND_API_KEY
AUTH_EMAIL_FROM
AI_GATEWAY_URL
AI_GATEWAY_API_KEY
AI_MODEL
AI_REQUEST_TIMEOUT_MS
AI_MODEL_TIMEOUT_MS
AI_MODEL_MAX_ATTEMPTS
AI_MAX_TOOL_ROUNDS
AI_CHAT_LIMIT_PER_10_MINUTES
AI_DAILY_CHAT_LIMIT_PER_TENANT
OTEL_SERVICE_NAME
OTEL_EXPORTER_OTLP_ENDPOINT
CSP_ENFORCE
```

Nomes proibidos no processo web/runtime:

```text
DATABASE_ADMIN_URL
SUPABASE_MIGRATION_DATABASE_URL
MIGRATION_APPLY
MIGRATION_ALLOW_UPSERT
MIGRATION_REPORT_PATH
```

A lista nominal e a separação web/admin estão documentadas pelo supervisor S-SEC (`docs/evidence/subagents/S-SEC-2026-09-09.md:20-64`). Ela não é evidência de presença dos nomes no painel; o obtido continua sendo `Nenhum`.

### Neon A-BR

A branch de homologação foi criada com sucesso:

- projeto `preco-que-da-lucro-g3-pg17`, id `damp-forest-57346541`;
- branch `preview-hpanel-develop-2026-09-09`, id `br-aged-dream-aybu1ir4`;
- parent `production`;
- tipo `Branch data and schema`;
- expiração: `Sep 10, 2026 2:03 am (GMT-3)`;
- região Ohio, plano Free, PostgreSQL 17, histórico exibido de 6 horas;
- Postgres e BetterAuth exibidos como enabled.

Esses fatos registram criação e ciclo, não conectividade, migração, readiness, RLS, separação web/admin, fixture-free/journal 11/11 ou autorização de produção (`artifacts/B2-neon-branch-created.md:3-23`). A branch Neon `develop` existente não foi reativada. `production` foi somente parent; não recebeu escrita SQL nem configuração.

## 5. Build no alvo e 11/12

### Build no alvo

Contrato local observado:

- Node: `>=24.15.0` em `package.json:7-9`;
- `.nvmrc`: `24.15.0`;
- build: `node scripts/build.mjs`;
- start: `node .output/server/index.mjs`.

Resultado C1: **não iniciado no alvo**.

| Medida          | Esperado                           | Obtido no alvo Hostinger                |
| --------------- | ---------------------------------- | --------------------------------------- |
| tempo de build  | execução `npm ci && npm run build` | `NÃO OBTIDO`                            |
| `node -v` exato | `v24.15.0` ou superior             | `NÃO OBTIDO`; UI mostrou somente `24.x` |
| artefato        | `.output/server/index.mjs`         | `NÃO PRODUZIDO/CONFIRMADO` no alvo      |
| processo        | `node .output/server/index.mjs`    | `NÃO INICIADO`                          |
| URL HTTPS live  | preview temporário publicado       | `NÃO EXISTE` como deployment confirmado |

O PR contém relato de build Nitro local e de `live=200`/`ready=503` em check local. Esse relato é `REPORTED/HISTORICAL`; não substitui build, start e smoke na infraestrutura Hostinger (`artifacts/C1-C2-target-gates-not-started.md:13-20`).

Decisão de engines: **`BLOCKED`**. Não há `node -v` do alvo para abrir relaxamento de ADR ou declarar workaround. `24.x` no formulário não fecha o requisito minor.

### Matriz 11/11 do runbook

| Item            | Esperado                                                         | Obtido                                       | Classificação |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------- | ------------- |
| 1. Node         | `>=24.15.0`                                                      | somente `24.x` na tela; sem execução no alvo | `NOT-STARTED` |
| 2. Build        | `npm ci && npm run build`                                        | não executado no alvo                        | `NOT-STARTED` |
| 3. PORT         | `PORT`/`NITRO_PORT` efetivo                                      | não medido                                   | `NOT-STARTED` |
| 4. Host         | bind compatível com proxy                                        | não medido                                   | `NOT-STARTED` |
| 5. Persistência | 3× `live=200` em 15 min                                          | não executado                                | `NOT-STARTED` |
| 6. Restart      | novo PID e live em até 60 s                                      | não executado                                | `NOT-STARTED` |
| 7. Logs         | consulta e grep redigido = 0                                     | não há logs do alvo                          | `NOT-STARTED` |
| 8. Proxy >60 s  | conexão longa sem corte prematuro                                | não executado                                | `NOT-STARTED` |
| 9. Egress TLS   | Neon, Resend e gateway IA alcançáveis                            | não executado                                | `NOT-STARTED` |
| 10. Health      | live 200; ready 200, ou 503 degradado que bloqueia A4            | sem URL publicada                            | `NOT-STARTED` |
| 11. Secrets     | runtime nominal presente; admin/legacy/migration ausentes do web | painel sem env; nenhum nome inserido         | `BLOCKED`     |

O gate 11/11 é `BLOCKED`; não houve FAIL de runtime executado. Portanto, não existe bundle forense C3 de runtime para S-FORENSE nesta rodada. O S-FORENSE tardio foi acionado para o bundle GitHub/Vercel separado e ficou `TRANSCRIPT-UNAVAILABLE`; D2 continua sendo o registro dos dois failures e eles não foram tratados como resultado Hostinger.

## 6. Disposição de branches

### Inventário antes/depois

Antes, a UI GitHub listava `main`, `develop`, `codex/evidence-2026-09-08` e `vercel/install-vercel-web-analytics-w-vd9z0a`, com PR #41 aberto e PR #42 draft (`artifacts/D1-github-inventory-before.md:3-16`).

Depois, a mesma listagem continuou exibindo as quatro branches; `codex/evidence-*` seguia associado ao PR #41 e `vercel/install-*` ao PR #42 draft. Nenhum botão de delete ou merge foi acionado (`artifacts/D1-github-inventory-after.md:3-29`).

Reconciliação local read-only:

- checkout atual: `develop`;
- `HEAD` e `origin/develop`: `168bcf191f1335e05d8d5ec2618cefb9feb091ce`;
- branch local `main`: `ac2e8341bc416d0834a3fa22355416ba63b1d98e`;
- `origin/main`: `b706bd86348313f13ad21de1c552e6bfea9b8409`;
- branch local/remota `codex/evidence-2026-09-08`: `012f607ef1c19e8284d5e69c3112089d7c63c8d0`;
- `origin/vercel/install-vercel-web-analytics-w-vd9z0a`: `de8732eaa40bdb072d4e907b7bcd958983f368af`;
- branch local `vercel/install-vercel-web-analytics-w-vd9z0a`: não listada.

Esses refs e o WIP não rastreado estão registrados em `artifacts/D5-git-state-final.md:3-25`. Não houve `fetch`, `push`, reset, limpeza, commit ou `git add -A`.

### Diff da branch Vercel

O diff read-only de `origin/main` (`b706bd…`) para `origin/vercel/install-vercel-web-analytics-w-vd9z0a` (`de8732e…`) é 1 commit exclusivo, 3 arquivos, 5 inserções e 2 deleções:

- `package.json`: `@vercel/analytics`;
- `src/routes/__root.tsx`: `<Analytics />`;
- `src/start.ts`: CSP com `'unsafe-inline'` e novos destinos `connect-src`.

O impacto material de CSP aguardava revisão S-DIFF e não foi integrado (`artifacts/D3-vercel-install-diff.md:3-23`). Como o S-DIFF não entregou handoff e o S-ALIN declarou `NO-GO`, CP-4 ficou sem-veredito (`artifacts/CP-4-verdict.md:3-19`). A branch Vercel foi **mantida, sem merge e sem delete**.

A branch `codex/evidence-2026-09-08` também não foi apagada, porque o PR #41 não foi mergeado. O estado real, portanto, ainda não converge para somente `develop` + `main`.

## 7. Estado do substrato — bloco hPANEL

```yaml
hPANEL:
  data: "2026-09-09"
  plano: "Hostinger ativo; nome comercial não usado como prova de Web App Node"
  dominio_dns:
    canonico: "diretrizprecifica.com"
    estado: "INTACTO; nenhum apontamento ou zona DNS alterado"
  app_main:
    observado: "floralwhite-bat-153626.hostingersite.com"
    tipo_observado: "PHP/HTML/other"
    estado: "existente e intocada; Node Web App publicado não confirmado"
    discrepancia: "contexto anterior informava main/no-env; N1 encontrou fluxo Node pré-submit em develop"
  preview_develop:
    branch_git: "develop"
    url_temporaria_escolhida: "darkblue-termite-767663.hostingersite.com"
    estado: "ONBOARDING PRE-SUBMIT; não é URL live confirmada"
    env_names: "Nenhum"
    deploy: "NÃO EXECUTADO"
  branch_neon_homologacao:
    nome: "preview-hpanel-develop-2026-09-09"
    id: "br-aged-dream-aybu1ir4"
    parent: "production"
    ciclo: "expira em 2026-09-10 02:03 GMT-3"
    postgres: "17"
    historico_observado: "6 hours"
    develop_neon: "não reativada"
  onze_de_onze: "NOT-STARTED/BLOCKED"
  portao_canonico: "DESARMADO"
  neon_production: "somente leitura; sem escrita/configuração"
  ledger_marker: "NÃO EMITIDO; nenhum write-set publicável"
  m02_sums: "NÃO EXECUTADO; nenhum write-set publicável nesta rodada"
  wip: "PRESERVADO"
```

O bloco usa apenas nomes/estados e não contém valores de env. O artefato de criação Neon registra que a string de conexão foi vista mascarada, sem leitura ou cópia de senha/URL completa (`artifacts/B2-neon-branch-created.md:18-22`).

## 8. Dia-D, portões e riscos

### Datas

- Rodada e evidência: **09/09/2026**.
- Expiração atualmente declarada da branch Neon de homologação: **10/09/2026 às 02:03 GMT-3**.
- Dia-D canônico: **não agendado/autorizado**. Só pode ser reaberto após assinatura do canônico, G1, PITR mínimo de 7 dias, SEC-01, snapshot trio fresco, freeze, SHA de `main`, 11/11 PASS, `m02:cutover-t0` e demais pré-condições do SDD.

### Portões preservados

`G1`, `PITR`, `SEC-01`, `H1`, `42P01`, `A-ENV` e `H-DECL` permanecem não promovidos conforme os handoffs e a consolidação CP-5. Em particular, PITR não pode ser promovido a partir de retenção Neon observada de 6 horas; o requisito de produção é de pelo menos 7 dias (`docs/evidence/subagents/S-ALIN-CP5-2026-09-09.md:31-37`).

### Top-3 riscos

1. **Alvo Hostinger não confirmado:** não há Node Web App publicado, env configurada, build no alvo, URL live ou 11/11; o site existente observado é PHP/HTML e o fluxo Nitro ficou pré-submit.
2. **Substrato de recuperação e isolamento não comprovado:** a branch Neon Free mostrou 6 horas de histórico, sem prova de PITR ≥7 dias; o fork `Branch data and schema` não prova fixture-free/journal 11/11; e não houve validação de conectividade/readiness/RLS no preview.
3. **Governança Git/Vercel inconclusa:** PR #41 tem dois deployments Vercel falhos; branch protection/rulesets não estão configurados; PR #42 e `vercel/install-*` permanecem; S-DIFF e S-TEC têm dívidas `TRANSCRIPT-UNAVAILABLE`.

### Classificação exaustiva

- `LOCAL-VERIFIED`: contrato em `package.json`/`.nvmrc`, refs e estado do checkout registrados em D5.
- `REMOTE-OBSERVED`: telas GitHub/hPanel/Neon, inventários e estados de PR registrados em A1, B1, B2, D1 e D2.
- `REPORTED/HISTORICAL`: build/check local narrado na conversa do PR; não é prova do alvo Hostinger.
- `RED/BLOCKED`: CP-1, CP-5, merge do PR #41, A-ENV e gate 11/11.
- `SEM-VEREDITO / NO-GO`: CP-4, delete de `vercel/install-*`, configuração Vercel limitada, e gates sem selo compatível.
- `NOT-STARTED`: deploy Hostinger, C1, itens 1–10 de 11/11, health, restart, persistência, proxy e egress.
- `TRANSCRIPT-UNAVAILABLE`: handoffs S-TEC CP-1, S-DIFF CP-4, S-TEC CP-5 e S-FORENSE tardio do bundle Vercel, registrados sem aprovação implícita.
- `NO-MUTATION`: DNS/canônico, Vercel deployment/configuração, GitHub protection, merge/delete, Neon production e secrets permaneceram intocados.

## Registro final

Este documento é o fechamento documental da rodada, não um selo de promoção. Não há `m02:sums` porque não existe write-set publicável nesta rodada; o WIP de evidências permanece fora de qualquer limpeza ou reseal. O próximo avanço válido exige resolver os bloqueios acima, obter os handoffs pendentes e reabrir cada checkpoint somente com evidência atual compatível.
