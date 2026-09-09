# Evidência G-VER — decisão de provedor e plano operacional

| Campo           | Valor                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Data            | 2026-09-09                                                                      |
| Repositório     | `Douglas0101/preco-que-da-lucro`                                                |
| PR em revisão   | `#41`, base `develop`, head `codex/evidence-2026-09-08`                         |
| SHA observado   | `24aac4516c6d043f5764349022ae7898d6a7e73a`                                      |
| Classificação   | Evidência sanitizada; sem credenciais, tokens, cookies ou valores de env        |
| Execução remota | Hostinger não implantado; Vercel não redeployado; Neon `production` não escrito |

## 1. Veredito G-VER

**Decisão registrada:** `HOSTINGER-PROD` é o destino operacional da aplicação
Node/Nitro. A decisão é revogável por novo registro do owner, mas não autoriza
por si só promoção canônica, escrita em Neon `production`, mudança de DNS ou
reuso de secrets entre ambientes.

| Ramo             | Custo técnico confirmado                                                                                                                                                        | Estado                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `HOSTINGER-PROD` | Processo persistente Node/Nitro, preset `node-server`, configuração de start/restart, egress TLS, health externo, smoke, hPanel 11/11, backup/restore e dois ambientes isolados | Escolhido; preview e go/no-go ainda pendentes |
| `VERCEL-PROD`    | Projeto herdado espera `dist`; o build atual gera `.output/server/index.mjs`; exige ajuste de output/preset, nova homologação e medição de cold start/egress                    | Fora do caminho; sem redeploy autorizado      |
| `HÍBRIDO`        | Soma dos custos de dois provedores, duas cadeias de logs/env e duas superfícies de rollback                                                                                     | Não escolhido                                 |

Dependência de domínio: o domínio canônico declarado é `diretrizprecifica.com`,
com custódia operacional indicada para Hostinger. O apontamento DNS, NS, MX,
SPF, DKIM e DMARC não foi presumido nem alterado nesta rodada; o owner deve
confirmar autoridade e destino antes da associação canônica.

## 2. Regra permanente de branches

O repositório mantém somente duas branches Git persistentes:

- `develop`: trabalho, integração diária e origem do release;
- `main`: release, recebendo exclusivamente o PR final `develop -> main`.

Branches Git de automação, evidência, provedor ou revisão são transitórias e
exigem inventário e destino explícito. Elas não autorizam merge, deploy ou
alteração de produção. Branches Neon de preview são objetos de banco e não
contam como branches Git do repositório.

Estado observado nesta evidência: `codex/evidence-2026-09-08` continua como
head do PR #41 para `develop`, e `vercel/install-vercel-web-analytics-w-vd9z0a`
continua associado ao PR #42 draft direto para `main`. Nenhuma dessas refs foi
apagada, fechada ou mergeada; o PR #41 depende de revisão e o PR #42 precisa de
destino explícito do owner antes de qualquer descarte ou integração.

## 3. Mapa B — integrações por nomes e eventos

| Integração            | Capacidade observada ou documentada                                                                                                         | Eventos/escopo                                                                                                                                  | Classificação e limite                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Neon × GitHub Actions | Cria branch Neon efêmera, expõe configuração de teste ao job e remove a branch                                                              | PR `opened`, `reopened` e `synchronize` criam; `closed` limpa; TTL esperado de 14 dias; cleanup em `always()`                                   | `LOCAL-VERIFIED`/`REMOTE-OBSERVED`; somente os nomes `NEON_API_KEY` e `NEON_PROJECT_ID` podem aparecer em evidência       |
| Neon × Vercel         | Integração nativa aparece instalada no projeto                                                                                              | Injeção efetiva, connection/env de preview e produção e branch de banco precisam de confirmação autenticada                                     | `UNVERIFIED`; não é caminho de produção                                                                                   |
| GitHub App Vercel     | Pode observar o repositório/PR e participar de builds, checks e deployments; escrita de branches/configuração depende das permissões atuais | Contents, pull requests, checks, deployments, branches e Actions devem ser inventariados por nome                                               | Permissões exatas `UNVERIFIED`; recomendar leitura/build/checks mínimos e não conceder escrita sem necessidade registrada |
| Hostinger Git deploy  | Reconhece o repositório completo e oferece configuração Node/Nitro                                                                          | Página observada com preset Nitro, Node 24.x, root `./`, URL temporária e branch atualmente selecionada `main`; env vars exibidas como `Nenhum` | `REMOTE-OBSERVED`; reconhecimento não prova deploy, readiness ou produção                                                 |

Não há valores de variáveis de ambiente neste documento. Preview deve usar
valores próprios, callback próprio e branch Neon isolada; qualquer nome ou valor
de produção no preview é `NO-GO`.

## 4. Plano executável por ramo

### 4.1 `HOSTINGER-PROD`

1. Em `develop`, produzir checkout limpo, SHA imutável e artifact Nitro.
2. No hPanel, selecionar `develop` para o preview temporário; não usar `main`
   antes do PR final.
3. Configurar HP-3 exclusivamente por secret manager, registrando somente os
   nomes esperados (`DATABASE_URL` pooled, `DATABASE_ADMIN_URL` direct quando
   estritamente necessário, Better Auth, Resend e gateway de IA) e o estado
   `configured`/`missing`.
4. Confirmar processo `node .output/server/index.mjs`, porta, restart, timeout,
   logs redigidos e egress TLS.
5. Implantar o mesmo artifact somente na URL temporária; validar health live,
   readiness contra dados não produtivos, smoke degradado e completo, ausência
   de escrita em Neon `production` e matriz hPanel 11/11.
6. Encerrar branch Neon/TTL, migrations direct, runtime pooled,
   reconciliação, backup/restore e rollback; depois registrar go/no-go.
7. Abrir ou atualizar somente o PR final `develop -> main`; após CI verde e
   revisão, promover o mesmo artifact ao domínio canônico.

O passo de preview remoto não foi executado: a configuração observada ainda
está com `main` selecionada e sem env vars. Isso mantém HP-3/HP-5/HP-6/HP-7 e
produção como `NOT-EXECUTED`/`BLOCKED`, sem inferência de aprovação.

### 4.2 `VERCEL-PROD`

Não executar nesta rodada. O deployment observado compila o bundle Nitro e
gera `nitro.json`, mas falha porque o projeto procura um diretório `dist` que
não existe. Qualquer correção exigiria ajuste explícito de preset/output,
homologação independente, env isolado e health/smoke antes de novo deploy.

### 4.3 `HÍBRIDO`

Não executar. Só pode ser reaberto por nova assinatura que defina o owner de
cada provedor, a fonte de verdade do preview, a segregação de env, os dois
rollbacks e o custo operacional adicional.

## 5. Execução e checks desta rodada

### 5.1 Checks remotos no SHA observado

| Check                   | Run                      | Resultado                                                                                    |
| ----------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| UI stack                | `34307096481`            | `success`; format, typecheck, lint, testes, banco, build, bundle, auditoria e E2E concluídos |
| Neon preview boundary   | `34307096476`            | `success`                                                                                    |
| Neon PR branch CI       | `34307096514`            | `success`; migration direct, integração, probe RLS, journal e cleanup concluídos             |
| Vercel Preview Comments | check run `102326042803` | `succeeded`; sem feedback pendente                                                           |
| Deployments Vercel      | status do commit         | `failure`; causa do projeto/output já classificada e não removida por atalho                 |

`success` nos checks de CI não prova deploy remoto, readiness de Hostinger,
backup/restore independente, cutover ou autorização de produção.

### 5.2 Validação local

- `npm run build`: passou, gerando `.output/server/index.mjs`; o build cliente
  transformou 2.441 módulos.
- `npm run check:hostinger-runtime`: passou no cenário degradado com
  `live=200` e `ready=503` para os mapeamentos Nitro/Port, sem conexão de
  produção.
- `npm run check:bundle`: passou; o entry medido ficou abaixo do limite
  registrado pelo checker.
- `SDD.md`: passou no Prettier e `git diff --check` passou.
- Head local e remoto da branch do PR coincidem no SHA observado.

## 6. Estado do substrato

```text
VERCEL
  conta: própria do owner
  projeto: herdado
  causa: CONFIRMED — configuração espera dist; build Nitro gera .output
  integrações: Neon×Vercel instalada, injeção efetiva UNVERIFIED;
               GitHub App Vercel inventariada por capacidade, permissões exatas UNVERIFIED
  deployment checks: nenhum configurado conforme observação do projeto
  decisão: Vercel fora do caminho de produção; sem redeploy nesta rodada

HOSTINGER
  conta/plano: painel autenticado; Cloud Startup ativo conforme contexto operacional
  projeto: repositório reconhecido, mas sem deploy iniciado nesta rodada
  preview: URL temporária disponível; branch observada main, deve ser corrigida para develop
  env: nenhum configurado na tela observada; HP-3 pendente
  decisão: destino autorizado, produção NO-GO até preview, 11/11 e go/no-go

NEON
  projeto/branches: mapeados em superfície autenticada
  runtime: pooled; migrations/admin: direct
  preview: branch efêmera com TTL/cleanup nos checks
  produção: nenhuma escrita autorizada ou realizada nesta rodada
```

## 7. Retenção e bloqueios

- WIP de `docs/evidence/` fora da allowlist permanece não rastreado e
  preservado; nenhum checksum antigo foi regenerado ou resealado.
- Não houve token, cookie, senha, connection URL, PII ou valor de env em
  evidência.
- Não houve deploy/redeploy, DNS, associação canônica, alteração de integração,
  merge para `main` ou escrita em Neon `production`.
- Estado final desta evidência: `PARTIAL / NO-VERDICT` para entrada em
  operação, porque o preview Hostinger e o smoke remoto ainda não existem.
