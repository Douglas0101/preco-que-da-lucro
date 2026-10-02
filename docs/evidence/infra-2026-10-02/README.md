# Infraestrutura — reconciliação e correções 2026-10-02

Status: EM EXECUÇÃO. Pedido humano direto autoriza análise e correções das conexões nos provedores já ligados ao projeto; uso de uma única sessão Chrome. ADR-036 permanece aplicável aos guardrails de credenciais/sessão; esta sessão amplia o perímetro para Vercel, GitHub, Hostinger e Neon. Freeze de main, limiar 80 e Via A continuam.

Boot: worktree e62702c limpo, state guard PASS folga 3/13; original 48ffb6b com WIP preservado. Main d4b9395, develop 0b78acb, PR60 OPEN/BLOCKED. Watcher app-live sem poll posterior a 2026-09-30T01:14:03Z; não equivale a supervisão ativa.

Hipóteses iniciais reconciliadas: Neon 10 branches/limite 10 com causa de capacidade confirmada por resposta HTTP 422; preview Vercel recusada pelo piso vulnerável do TanStack. Production Ready do provedor não prova login/DB/gate.

## Inventário Neon (metadata, credenciais fora do fluxo)

```json
{
  "projectId": "damp-forest-57346541",
  "orgId": "org-purple-snow-18870527",
  "permission": "ADMIN",
  "pgVersion": 17,
  "retentionSeconds": 21600,
  "branchLimit": 10,
  "branches": [
    {
      "id": "br-small-hill-aymcu14y",
      "name": "develop",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "console",
      "default": false,
      "protected": false,
      "createdAt": "2026-08-23T04:42:49Z",
      "updatedAt": "2026-10-01T23:05:22Z"
    },
    {
      "id": "br-steep-hill-ayl7n27p",
      "name": "preview/dependabot/npm_and_yarn/multi-7f19880bf6",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-10-01T14:54:49Z",
      "updatedAt": "2026-10-01T23:05:17Z"
    },
    {
      "id": "br-blue-silence-ayj9erkh",
      "name": "preview-hpanel-2026-09-12",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "console",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-12T04:10:37Z",
      "updatedAt": "2026-10-01T21:05:18Z"
    },
    {
      "id": "br-snowy-violet-aymcvvvv",
      "name": "production",
      "state": "ready",
      "source": "console",
      "default": true,
      "protected": false,
      "createdAt": "2026-08-17T14:58:47Z",
      "updatedAt": "2026-10-01T21:05:17Z"
    },
    {
      "id": "br-jolly-credit-aydbmhf6",
      "name": "preview/dependabot/github_actions/neondatabase/create-branch-action-6.4.0",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-30T21:50:07Z",
      "updatedAt": "2026-10-01T11:05:15Z"
    },
    {
      "id": "br-fragrant-feather-aybbagq7",
      "name": "preview/dependabot/github_actions/actions/cache-6.1.0",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-30T21:50:01Z",
      "updatedAt": "2026-10-01T04:05:18Z"
    },
    {
      "id": "br-withered-rice-aym8xrba",
      "name": "preview/dependabot/npm_and_yarn/testing-library/user-event-14.6.7",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-30T21:50:19Z",
      "updatedAt": "2026-10-01T04:05:17Z"
    },
    {
      "id": "br-sweet-night-ayv525d2",
      "name": "preview/dependabot/npm_and_yarn/tanstack/react-router-1.170.40",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-30T21:50:17Z",
      "updatedAt": "2026-10-01T04:05:15Z"
    },
    {
      "id": "br-red-bonus-ayx82svs",
      "name": "preview/feature/contract-guard-bff",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "ready",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-26T20:33:14Z",
      "updatedAt": "2026-09-30T18:05:21Z"
    },
    {
      "id": "br-raspy-wildflower-ay41jd97",
      "name": "vercel-dev",
      "parentId": "br-snowy-violet-aymcvvvv",
      "state": "archived",
      "source": "vercel",
      "default": false,
      "protected": false,
      "createdAt": "2026-09-08T05:37:58Z",
      "updatedAt": "2026-09-22T05:42:39Z"
    }
  ],
  "endpoints": [
    {
      "id": "ep-still-hill-aydejkzn",
      "branchId": "br-jolly-credit-aydbmhf6",
      "state": "idle",
      "lastActive": "2026-09-30T21:50:09Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-steep-snow-ayz1qmqn",
      "branchId": "br-raspy-wildflower-ay41jd97",
      "state": "idle",
      "lastActive": "2026-09-09T00:15:56Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-ancient-cell-ayk4a4gr",
      "branchId": "br-withered-rice-aym8xrba",
      "state": "idle",
      "lastActive": "2026-09-30T21:50:21Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-orange-cake-ayonq7cg",
      "branchId": "br-sweet-night-ayv525d2",
      "state": "idle",
      "lastActive": "2026-09-30T21:50:29Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-crimson-heart-aywl9zrt",
      "branchId": "br-fragrant-feather-aybbagq7",
      "state": "idle",
      "lastActive": "2026-09-30T21:50:13Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-long-violet-aye9g0bn",
      "branchId": "br-snowy-violet-aymcvvvv",
      "state": "active",
      "lastActive": "2026-10-02T00:48:12Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-wandering-glitter-ayzrgv28",
      "branchId": "br-small-hill-aymcu14y",
      "state": "idle",
      "lastActive": "2026-10-01T22:59:41Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-royal-violet-ay04k0mq",
      "branchId": "br-steep-hill-ayl7n27p",
      "state": "idle",
      "lastActive": "2026-10-01T16:17:10Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-wandering-tooth-aysvnkny",
      "branchId": "br-red-bonus-ayx82svs",
      "state": "idle",
      "lastActive": "2026-09-30T11:50:43Z",
      "pooledHostAvailable": true
    },
    {
      "id": "ep-lively-recipe-ayuct9gp",
      "branchId": "br-blue-silence-ayj9erkh",
      "state": "idle",
      "lastActive": "2026-10-01T14:52:53Z",
      "pooledHostAvailable": true
    }
  ]
}
```

## Causas observadas

- Preview Vercel 8wUJ19L3tr38aNaidmx4KGKoo3v6 no SHA 0b78acb: Build Failed em 3 s, antes de install/build; mensagem Vulnerable TanStack Start package detected (@tanstack/react-start@1.168.49). Advisory oficial GHSA-qx66-fv34-fjm8 (CVE-2026-102989), piso corrigido Start 1.168.60/server-core 1.169.39. Hipótese de cascata do Neon refutada para esta falha.
- Neon: probe isolado de criação infra-capacity-probe-20261002, parent develop, no_compute=true: `isError=true`, `INVALID_ARGUMENT`, resposta textual `[HTTP 422] branches limit exceeded`. Nenhuma branch criada. O inventário já mostrava 10/10. Causa de capacidade CONFIRMADA por resposta da API; token de Actions não foi transferido ao agente, diagnóstico usou a conexão MCP delegada do mesmo projeto.
- Hostinger target darkgray-pony-545965: main d4b93953, deploy concluído 2026-10-01 11:52, Nitro/Node24.x, automatic deploy active. Painel aponta 3 CVEs: dois altos do advisory GHSA-gv7w-rqvm-qjhr explicitamente Withdrawn (esbuild0.18.20/0.25.12), e moderado GHSA-67mh-4wv8-2f99 (esbuild0.18.20). Não elevar/fechar por severidade do painel sem confrontar a fonte primária.
- Ambos os alvos respondem aplicação/auth/live/ready200 e sessão anônima null. HSTS em ambos. CSP Vercel somente report-only; Hostinger também enforça CSP. Lookup inicial de HSTS Hostinger estava errado por casing do header e foi corrigido sem alterar o alvo. Esses GETs não comprovam login autenticado, RLS multi-tenant ou durabilidade.
- Vercel integração Neon legada presente; storage nativo sem database conectado. Ausência de recurso nativo não significa ausência de conexão: readinessPostgres200.

## Correção em validação

Commit local `05307b4` (4/13 C25) fixa Start 1.168.60 / Router 1.170.41 / router-plugin 1.168.42 e resolve um único router-core 1.171.34 e server-core 1.169.39. Guard upgrade PASS; negativo em memória rejeita Start 1.168.49 e aceita 1.168.60; audit 624 pacotes, 0 high / 0 critical / 4 moderate. Piso de dependência e AGENTS no mesmo commit; selo `dependency-fix.manifest.sha256`. src/ não alterado. Não foi aplicada variável de bypass do provedor.

Exclusão de vercel-dev br-raspy-wildflower-ay41jd97 foi preparada e está pendente de autorização explícita (MCP exige confirmação); branch arquivada,33.6MB,endpointidle,último uso09/09. Não é prova absoluta de desuso. Production/develop/Hostinger preservados.

## Runtime e autenticação — medição 2026-10-02T00:58:13Z

| Alvo                                   | live   | ready / Postgres | sessão anônima | HSTS     | CSP                    |
| -------------------------------------- | ------ | ---------------- | -------------- | -------- | ---------------------- |
| preco-que-da-lucro-sage.vercel.app     | 200 ok | 200 ready / ok   | 200 null       | presente | report-only            |
| darkgray-pony-545965.hostingersite.com | 200 ok | 200 ready / ok   | 200 null       | presente | enforced e report-only |

Vercel e Hostinger `/inicio` no browser sem sessão redirecionaram a `/auth?redirect=%2Finicio`; formulário de email/senha/Google visível. Não foram fornecidas credenciais nem executados login, signup ou recuperação de senha. A aplicação usa Better Auth próprio e adapter Drizzle; não confundir com Neon Auth gerenciado. Readiness prova acesso ao Postgres, não a identidade da branch usada nem isolamento de tenants.

ERRATA de medição: o primeiro probe usou lookup case-sensitive e leu HSTS da Hostinger como ausente. A repetição com `HTTPMessage.get` confirmou o header; não houve alteração no alvo. Retenção Neon medida em 21600 s (6 h), production sem proteção e snapshot schedule vazio: estes metadados não provam ausência de backups externos. Backup diário do painel Hostinger não comprova backup do Postgres Neon.

## Superfícies e decisões

GitHub: PR60 develop→main bloqueada; ruleset 24333849 ativo, checks verify/scan, base atualizada, regra update e bypass vazio. Sete ambientes sem regras próprias. Secrets Actions somente nomes NEON_API_KEY/SONAR_TOKEN; nenhum valor transferido. Neon e CI usam canais separados do deploy Vercel.

Vercel: produção Ready no SHA d4b9395; integração Neon Previews legada instalada. Recursos Storage nativos não exibem database. A documentação visível da integração diz que branches são criadas por preview; inventário Neon mostra branches `preview/...` com source=vercel. A ligação de cada variável/endpoint real não foi inferida de um badge nem exposta por leitura de credenciais.

Hostinger: produção main d4b93953 com deploy automático ligado, Nitro/Node 24.x e domínio temporário. Painel de variáveis evitado por blindagem do ADR-036. A evidência de runtime confirma disponibilidade do alvo, sem provar a correção da versão vulnerável em produção.

Sonar: sessão aberta está na tela de login; autenticação humana solicitada, sem tokens/senhas no agente. DBT-36 mantém Via A/EM_TRATAMENTO; não houve rotação nesta retomada.

## Limites e próximos gates

DBT-69 aberta até release segura e verificação da versão real em produção. Main permanece imóvel: os checks de PR não equivalem ao gate de new code de main; espelho e sequência de thaw ainda não ratificados/validados. Correção de dependências pode chegar à preview após check e push develop; não autoriza produção vermelha.

DBT-67 causa de capacidade agora nomeada, mas fechamento ainda exige criação → outputs → cleanup com branch_id observado. A branch arquivada vercel-dev só será excluída após confirmação humana explícita. DBT-68 não é promovida por um run verde anterior; o cache já existia, e lentidão APT foi o fato medido.

Registry 52 = 42 abertas + 9 fechadas + 1 em tratamento. Placar ratificado 150 D / 29 P / 8 NS / 0 UNV de 187; D todos os subitens provados, P delta faltante, NS não iniciado, UNV inverificável de princípio. Nenhuma promoção nesta reconciliação.

## ERRATA de compatibilidade e estabilidade

O primeiro `npm run check` da família corrigida parou em `typecheck`: TS2322 no `errorComponent` da rota raiz. O Router atualizado recebe `ErrorComponentProps`, cujo `error` é `unknown`; o callback local exigia `Error`. Não houve push com esse gate vermelho. Ajuste mínimo: importar o tipo oficial e usá-lo na assinatura existente; somente dois trechos de tipo mudam, sem comportamento ou refatoração. `reportLovableError` já recebe `unknown`. `npm run typecheck` após ajuste PASS. O check completo será repetido antes do push.

Neon production recebeu diagnósticos somente leitura `stalled-queries` e `replication-slots`: zero consultas ativas por mais de 30 s; dois slots físicos, lag observado 0 e 3248 bytes. Sem extensão, SQL de escrita ou leitura de dados de usuários. É uma amostra de saúde, não garantia de disponibilidade contínua ou capacidade de restore.

## Timeline de browser (UTC; nenhuma mutação externa)

| ts                                                    | superfície / URL                                                                                                                         | ação                          | resultado                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------- |
| 2026-10-02T00:48:50.376Z                              | https://vercel.com/douglasultimatesouza-5127s-projects/preco-que-da-lucro                                                                | Ler projeto vinculado ao repo | Production Ready d4b9395; preview PR60 Error        |
| 2026-10-02T00:51:12.556Z                              | https://vercel.com/douglasultimatesouza-5127s-projects/preco-que-da-lucro/8wUJ19L3tr38aNaidmx4KGKoo3v6                                   | Ler build logs                | Recusa TanStack vulnerável, 3 s                     |
| 2026-10-02T00:54:42.120Z                              | https://hpanel.hostinger.com/websites/darkgray-pony-545965.hostingersite.com                                                             | Ler dashboard                 | Deploy automático main d4b93953; Nitro/Node24.x     |
| 2026-10-02T01:00:00.219Z                              | https://hpanel.hostinger.com/websites/darkgray-pony-545965.hostingersite.com/hosting-security/vulnerabilities?redirectLocation=side_menu | Ler achados nominais          | Dois altos withdrawn, um moderado                   |
| 2026-10-02T01:13:17.430682+00:00 (registro posterior) | https://vercel.com/douglasultimatesouza-5127s-projects/~/integrations/neon/icfg_eDeLFTSX3j7fPem6tn88RkGS                                 | Ler instalação                | Integração Previews presente; sem mudança de acesso |
| 2026-10-02T01:07:03.996Z                              | https://preco-que-da-lucro-sage.vercel.app/inicio                                                                                        | Navegar anônimo               | Redirect /auth, login visível                       |
| 2026-10-02T01:09:28.667Z                              | https://darkgray-pony-545965.hostingersite.com/inicio                                                                                    | Navegar anônimo               | Redirect /auth, login visível                       |
| 2026-10-02T01:13:17.430682+00:00 (registro posterior) | https://sonarcloud.io                                                                                                                    | Ler aba delegada              | Sessão não autenticada, humano solicitado           |

As leituras de integração e Sonar usam timestamp de registro posterior do resultado; a hora de captura não foi guardada. Os demais timestamps vêm da captura. Os selos são verificados contra a revisão que os publicou; alterações posteriores de journal/relatório não substituem silenciosamente selos anteriores.

A segunda execução completa passou typecheck e 116/117 suítes (1410 testes PASS / 14 skipped); a única falha era uma expectativa legada do teste da política: aceitar Start 1.168.26, agora abaixo do piso. A fixture mantém os controles de major coringa e passou a rejeitar explicitamente 1.168.26/1.168.49, aceitando a corrigida 1.168.60. Nenhuma guarda foi afrouxada. Execução focada: 39/39 PASS. Terceira execução completa será feita antes do push; nova falha de causa não resolvida suspende a publicação.

PRs abertos reconsultados: #60 bloqueada por Neon/preview e contenção; #56 verify/scan vermelhos, #53 verify vermelho, #52 Sonar externo vermelho e provisionamento skipped; #51/#54/#55/#57 com checks anteriores verdes e base BEHIND. São oito PRs, sete Dependabot. Nenhum merge/rebase/rewrite executado; os checks antigos não são revalidação da família corrigida. #53 propõe Router 1.170.40, abaixo do novo candidato 1.170.41, portanto requer reconciliação da atualização já feita antes de qualquer promoção.

## Publicação da correção em develop — revisão f27de2d

Push fast-forward `0b78acb → f27de2ddc180600dcfaeaca2f56d43d8c0e95b2e`, após gate completo verde no HEAD limpo. Cinco commits enviados incluem o handoff documental herdado e quatro desta retomada. Produção main d4b9395 não se moveu. Custódia: 932 caminhos originais verificados por sha256, zero divergências, HEAD original preservado.

| Superfície     | Evidência no mesmo SHA                                | Veredito observado                                                                  |
| -------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Local          | npm run check, 117 suítes / 1411 PASS / 14 skipped    | PASS; typecheck/lint/build/bundle verdes                                            |
| UI stack PR    | run 36950531373, job 110662254608, 01:21:23–01:28:17Z | SUCCESS, 414 s; install 36 s; 4 projetos E2E executados                             |
| UI stack push  | run 36950527753                                       | SUCCESS                                                                             |
| CI light       | runs 36950531439 / 36950527777                        | SUCCESS                                                                             |
| Vercel preview | DPYoGLvxjnnFCxW4vrAmaUR7Wd4w, 01:21:44Z, f27de2d      | Ready em 23 s; bloqueio vulnerável corrigido                                        |
| Neon           | run 36950531344, create job 110662275877              | HTTP 422; Delete skipped no cleanup 110662331995; sem closure                       |
| Sonar          | run 36950531332                                       | scanner enviado/processado, CE QUALITY GATE STATUS FAILED; condições ainda a nomear |

A preview `https://preco-que-da-lucro-puni5ruwu.vercel.app` mostrou no browser o redirecionamento anônimo de /inicio para /auth em 2026-10-02T01:40:18.268Z. Probes HTTP sem sessão delegada foram redirecionados a vercel.com/login (200 HTML), portanto não são respostas dos endpoints de health da aplicação. Sem bypass da proteção. Browser bloqueou navegação direta a /api/health/ready com ERR_BLOCKED_BY_CLIENT; readiness da preview permanece NO-VERDICT, distinto de Ready do deploy.

## Baseline de main renovada pelo runner

Leitura 2026-10-02T01:21:31.151Z, análise `1dc2baf9-b289-42f4-b2ca-dd7b662b3679` de 2026-10-01T14:53:36Z no SHA main d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9. API fresca lê a análise armazenada; não prova reprocessamento da janela desde essa análise. Gate ERROR, única condição new_coverage 63,2. Linhas 1904/690 descobertas e condições 1091/411 descobertas: 2995 totais, 1894 cobertas, gap 502 para 80%, piso 1498. A correção de preview não paga esse déficit automaticamente.

## Observabilidade do gate — commit local 27681df

Nova leitura somente no runner: `scripts/sonar/gate-readout.ts` nomeia o veredito pelo ceTaskId/analysisId deste scanner, valida origem sonarcloud.io, projeto e identidade e registra condições sem segredo. Valores ausentes preservados como null, gate ausente/ilegível produz NO-VERDICT/exit2, ERROR exit1, OK exit0. Nove testes de identidade/origem/nulo e os contratos de CI/tier passaram: 62/62; typecheck PASS.

Medição venceu a premissa de filesystem: log do scanner mostrou working dir `/tmp/.scannerwork` dentro do container, fora do volume. Workflow agora compartilha somente report-task.txt vazio antes do scan e grava metadata nele, de modo que o leitor não use uma análise anterior. Upload lcov original mantido; baseline/readout em artefato separado. Pipeline mantém wait=true e nenhum gate é relaxado. Novo push depende de check completo; condições e execução remota desse leitor ainda pendentes.
