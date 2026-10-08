# Análise avançada de CI/CD e PRs abertos — 2026-10-01

- Observação remota: 2026-10-01, consultas encerradas aproximadamente às 19:22 UTC.
- Repositório: `Douglas0101/preco-que-da-lucro`, público; default branch `main`.
- HEAD local e `origin/develop`: `48ffb6bb8106c78781416ffd49fa8a906985f174`.
- `main` observado pela API: `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`.
- Escopo: metadados, checks, steps, logs filtrados, diffs, lockfiles e contrato de CI/CD.
- Classes: `REMOTE-OBSERVED`, `LOCAL-VERIFIED`, `REPORTED/HISTORICAL` e inferência explicitada.
- Alterações desta análise: este relatório, quatro novas dívidas e pares de journal. WIP preexistente preservado.
- Este relatório não é selo de work package, S6, aprovação de merge ou prova comportamental de produção.

## 1. Veredito

**Há execução real de CI, mas a política de qualidade não é imposta à publicação.** O commit atual de
`main` tem `verify` verde, scanner verde, **Quality Gate vermelho** e deploy Vercel de produção concluído.
`main` e `develop` estão sem proteção; nenhum ruleset foi retornado pela API. O scanner não espera o
Quality Gate, e os ambientes GitHub não têm regras de proteção. Portanto, sucesso do scanner e sucesso
do deploy não estabelecem conformidade com o gate de qualidade.

**Sete PRs continuam abertos**, todos Dependabot, não draft, sem reviews submetidos na consulta:
quatro com checks verdes observados e três com checks vermelhos. Nenhum recebe aprovação por esta análise.
Os seis PRs não sincronizados desde 30/09 ainda têm checks anteriores ao contrato Sonar publicado em
`main` em 01/10. O PR #56 já foi sincronizado e falhou antes de executar o scanner.

## 2. Estado reconciliado

| Superfície             | Evidência atual                                                                                         | Implicação                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `main`                 | `d4b9395`; `verify` success, run `36879749959`                                                          | CI de aplicação executada neste SHA                                                          |
| Scanner de `main`      | `scan + cobertura` success, run `36879749754`                                                           | Upload/análise e guarda de sensor executados                                                 |
| Quality Gate de `main` | check `110429239867` failure; MCP Sonar `ERROR`, `new_coverage=63.2`, limite 80                         | Qualidade exigida não atingida; cinco outras condições passam                                |
| Deploy Vercel          | deployment `6787444790`, `Production – preco-que-da-lucro`, status success                              | Metadado de publicação, sem smoke funcional nesta análise                                    |
| Proteções              | branches `protected=false`; protection endpoints 404 `Branch not protected`; rulesets `[]`              | Ausência confirmada, não indisponibilidade da API                                            |
| Ambientes GitHub       | 7 ambientes; todos `protection_rules=[]`, `deployment_branch_policy=null`                               | A superfície GitHub de environments também não impõe a política                              |
| `develop`              | `48ffb6b`; último run no tip é light `36880713286`, success                                             | O tip documental não tem novo heavy; não transportar a identidade do run de outro SHA        |
| Divergência Git        | `git rev-list --left-right --count origin/main...origin/develop` → `1 2`; refs locais coincidem com API | Falta incorporar o merge `d4b9395` em `develop`; há dois commits documentais só em `develop` |
| Secrets, apenas nomes  | Actions: `NEON_API_KEY`, `SONAR_TOKEN`; Dependabot: zero secrets                                        | O mesmo workflow recebe capacidades diferentes conforme o ator                               |
| Watcher                | arm de 28/09; último log em 30/09 01:14:03 UTC, `/ready=404`                                            | Não é observação viva de disponibilidade em 01/10                                            |

Linha do tempo do **mesmo SHA `d4b9395`**, observada em GitHub:

1. 14:52:06 UTC: workflows de push disparados.
2. 14:52:31/14:52:37 UTC: statuses do deployment de produção `success`.
3. 14:54:25 UTC: `SonarCloud Code Analysis` conclui `failure` por 63,2% < 80%.
4. 14:54:28 UTC: workflow `scan + cobertura` conclui `success`.
5. 14:56:08 UTC: `verify` conclui `success`.

O deploy ocorreu antes das conclusões de verificação do push. Isso demonstra desacoplamento; não
estabelece que um run de PR anterior não tenha sido consultado pela plataforma.

Fontes: [verify de main](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36879749959),
[scanner de main](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36879749754),
[Quality Gate de main](https://sonarcloud.io/dashboard?id=Douglas0101_preco-que-da-lucro&branch=main),
[deployment Vercel](https://vercel.com/douglas-dias-de-souzas-projects/preco-que-da-lucro/FGSEKqCNkXeA7jeeHkwWT5mA4ax6).

## 3. PRs, por identidade de revisão

| PR                                                               | HEAD observado                             | Mudança                                                | Checks observados                                                                                              | Avaliação                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [#51](https://github.com/Douglas0101/preco-que-da-lucro/pull/51) | `d08b7621bba0dc18d4fc5f939ccc0cdeefa28763` | `actions/cache` 4.3.0 → 6.1.0; um workflow             | UI stack, App Sonar e Vercel verdes; cache realmente executado; Neon skipped                                   | Candidato após atualização da base e CI atual; a action permanece pinada por SHA        |
| [#52](https://github.com/Douglas0101/preco-que-da-lucro/pull/52) | `f39f4751b2d97083fad8b89c410f604081cc049d` | `create-branch-action` 6.3.1 → 6.4.0 em três workflows | UI stack verde; Sonar failure; Neon branch e cleanup skipped; db tiers locais pulados por escopo               | **BLOCKED**: resolver/validar achados e exercitar a action alterada em ambiente isolado |
| [#53](https://github.com/Douglas0101/preco-que-da-lucro/pull/53) | `b2ae9d5dcdb4872b5be61a3c4f5f195ac9f69bd9` | Router 1.170.32 → 1.170.40                             | `typecheck` failure; etapas posteriores não executadas                                                         | **BLOCKED** por incompatibilidade de dependências/tipos                                 |
| [#54](https://github.com/Douglas0101/preco-que-da-lucro/pull/54) | `4d42135545b717968c6ae272a77bc275ef0704f1` | `user-event` 14.6.6 → 14.6.7                           | UI stack, App Sonar e Vercel verdes; db tiers executados                                                       | Candidato de menor risco depois de validar na base atual                                |
| [#55](https://github.com/Douglas0101/preco-que-da-lucro/pull/55) | `1070bb98b32fb97a956f6d7bca82d6aadfd65d27` | `tailwind-merge` 3.6.0 → 3.7.0                         | UI stack, App Sonar e Vercel verdes; db tiers executados                                                       | Candidato após CI atual e revisão de regressões de composição de classes                |
| [#56](https://github.com/Douglas0101/preco-que-da-lucro/pull/56) | `7c24df54f32cf2d9436473c6592554878fddcabb` | React + tipos, 19.3.0                                  | `verify` e workflow Sonar failure; 116 suítes falham na preparação; zero testes executados no run de cobertura | **BLOCKED**: `react=19.3.0`, `react-dom=19.2.8`                                         |
| [#57](https://github.com/Douglas0101/preco-que-da-lucro/pull/57) | `8285312dda617b51788ef1c0b3c10965e917db95` | Analytics 1.6.1 → 2.0.1                                | UI stack, App Sonar e Vercel verdes; db tiers executados                                                       | Candidato com revisão de integração Vercel/CSP no browser e CI atual                    |

### #56: um defeito de preparação, não 116 regressões independentes

O log de cobertura é explícito: `Incompatible React versions`; React e React DOM devem ter a mesma
versão exata. O lockfile confirma 19.3.0 versus 19.2.8. O grupo automático atualizou `react` e
`@types/react`, deixando `react-dom` e `@types/react-dom` fora. O workflow Sonar falha no passo
`Suíte com cobertura (lcov)`; `sonar-scanner` fica skipped. Não há veredito novo de análise nesse run.

Correção proposta: agrupar os pacotes relacionados, exigir igualdade exata dos dois runtimes
resolvidos e validar a combinação de tipos. A política atual checa faixas de cada pacote;
`guard:upgrade` passou no PR antes da falha de testes, logo esse caminho não detectou a incompatibilidade.

Evidência: [log do job de cobertura](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36880111402/job/110429427823),
[verify](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36880111515/job/110429427911),
[lockfile da revisão](https://github.com/Douglas0101/preco-que-da-lucro/blob/7c24df54f32cf2d9436473c6592554878fddcabb/package-lock.json).

### #53: o framework carrega duas linhagens do Router

O lockfile instala Router **1.170.40** na raiz, mas Start **1.168.49** depende explicitamente de Router
**1.170.32**, que fica instalado em subárvores de Start/client/server/RSC. Também aparecem dois
`router-core`: 1.171.33 e 1.171.27. O `typecheck` reprova com `error: unknown` versus `Error` em
`src/routes/__root.tsx:108` e com `server` ausente nas opções de rotas de auth, CSP, health e vitals.

O mecanismo consistente com essas evidências é o upgrade isolado de uma família de pacotes que
compartilha tipos e extensão de rotas. Validar uma combinação compatível de Start/Router/plugin e
adaptar o error boundary é necessário; editar casts para esconder os erros não demonstra compatibilidade.

Evidência: [typecheck](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36781952563/job/110114109920),
[lockfile da revisão](https://github.com/Douglas0101/preco-que-da-lucro/blob/b2ae9d5dcdb4872b5be61a3c4f5f195ac9f69bd9/package-lock.json).

### #52: verde da aplicação não exercita o provisionamento alterado

Sonar reporta `new_security_rating=3` (C), exigindo 1 (A), com duas anotações em
`.github/workflows/neon-pr-branch.yml:384`: instalação sob demanda/lifecycle por `npx` e ausência de
versão explícita. A linha é `npx playwright install --with-deps chromium firefox webkit`; o diff deste
PR altera só os SHAs de `create-branch-action` em três sítios. Os alertas não são prova de uma
vulnerabilidade nova introduzida pelo bump: `npm ci` e o Playwright resolvido no lockfile precisam
entrar na validação do achado. Exigir resolução local comprovada e impedir fallback remoto é um
critério técnico de fechamento; apenas retirar `.github/**` do escopo do scanner não fecha a questão.

Além disso, o job que invoca a action atualizada está skipped, e os tiers `db:test`/`db:check` do
UI stack foram pulados por escopo. O verde de `verify` não comprova criação/outputs/cleanup da nova action.

Evidência: [Sonar do PR](https://sonarcloud.io/dashboard?id=Douglas0101_preco-que-da-lucro&pullRequest=52),
[Neon run](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36781934793),
[UI stack](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36781934723).

### #57: revisão de dist reduz a incerteza, mas não substitui teste de plataforma

Foi inspecionado em memória o tarball oficial `@vercel/analytics@2.0.1`,
`package/dist/react/index.mjs`: o caminho padrão de produção continua
`/_vercel/insights/script.js` (linha 85), com `document.createElement("script")` e atribuição a
`script.src` (149–150). Não há motivo demonstrado para relaxar `script-src 'self'` por esse trecho.
No modo development, a mesma função escolhe um host externo (79–80); o gate de build do projeto
desativa o componente fora da Vercel (`src/lib/vercel-analytics.ts`, `vite.config.ts`).

A suíte local/CI usa esse componente desligado fora da plataforma. O deploy preview verde não
comprova que o script carregou, que não houve violação de CSP, ou que o fluxo financeiro permanece
correto no preset Vercel. Essa validação de browser é a pendência específica do PR.

## 4. Novas dívidas registradas

### DBT-64 — imposição dos gates na publicação (alta)

O problema tem duas camadas observadas: scanner sem espera de Quality Gate e publicação sem
proteção/checks exigidos. `.github/workflows/sonar.yml:105` termina após envio e conferência do sensor;
não passa `sonar.qualitygate.wait=true` nem consulta um `analysisId` para reprovar pelo veredito.
A documentação oficial declara que essa opção, por padrão falsa, faz o pipeline falhar se o gate falhar.

Closure: exigir checks aplicáveis na política de branch e impedir promoção/publicação até o
veredito correspondente ao SHA. Controles negativos: gate `ERROR`, ausente, ambíguo, pendente e check
de SHA anterior bloqueiam; controle positivo: SHA atual com gates conformes pode avançar. A
configuração da integração Vercel deve entrar na evidência, pois não vive integralmente nos YAMLs.

### DBT-65 — upgrades de dependências acopladas (média)

Os PRs #53 e #56 demonstram que bumps isolados passam nas guardas de faixa e quebram contratos entre
pacotes. `.github/dependabot.yml` não declara grupos próprios para essas famílias. O grupo inferido
do PR #56 é insuficiente para a igualdade React/React DOM.

Closure: agrupar React/runtimes/tipos e a família TanStack pertinente, checar relações sobre versões
resolvidas e exercitar TypeScript/testes/e2e. Controles negativos devem usar os dois lockfiles que
falharam: React/React DOM distintos e Router/Start incompatíveis reprovam antes da suíte; combinações
compatíveis passam. O agrupamento sozinho não substitui a verificação de compatibilidade.

### DBT-66 — guarda de LCOV removida continua aprovada pelo contrato (média)

`auditSonarPipeline` declara a claim “recusa lcov ausente ou vazio”, mas a verifica apenas procurando
`coverage/lcov.info` em qualquer ponto do YAML (`scripts/lib/m02-ci-coverage.ts:335`). A flag do scanner
e o upload também contêm esse caminho. O teste negativo enumera quatro remoções para cinco claims;
a guarda pré-envio não entra na enumeração (`src/test/m02-ci-coverage.test.ts:317`).

Probe executada nesta sessão, **somente em memória**, removendo o bloco real
`Conferir o relatório antes de enviar`:

```json
{
  "probe": "remove-only-lcov-precondition-in-memory",
  "originalFindings": [],
  "mutatedFindings": [],
  "changed": true,
  "lcovGuardExistsInMutation": false,
  "persisted": false
}
```

O workflow real ainda possui a guarda. O defeito é a auditoria que deixa sua remoção passar.
Closure: controle negativo executado que remove apenas o bloco de guarda e reprova; fixture de LCOV
ausente/vazio reprova e fixture não vazia passa. Mensagens ou caminhos em comentários/upload não
podem satisfazer a claim. Nenhum YAML foi alterado pela probe.

### DBT-67 — capacidade/elegibilidade dos checks de Dependabot (média)

Todos os sete PRs apresentam Neon branch e cleanup skipped. A API lista os dois secrets de Actions
por nome e **zero secrets de Dependabot**. O log do fork-guard da #52 mostra `NEON_API_KEY` vazia;
o workflow transforma ausência em `run=false` e sucesso do job de gate.

O comportamento seguro de não executar provisionamento sem credencial está correto. A lacuna é
usar o sucesso agregado como prova suficiente de um PR que altera o próprio provisionamento.
No novo workflow Sonar, `SONAR_TOKEN` ausente é erro explícito. **Inferência:** assim que uma
sincronização do Dependabot superar a suíte de cobertura, esse passo também encontrará a
precondição ausente, dadas as capacidades consultadas; na #56 ele ainda não foi alcançado.

Closure: checks distinguem `executado`, `não aplicável` e `precondição ausente`; PRs que alteram
provisionamento exigem exercício isolado da action. Resolver a capacidade do Sonar com o menor
escopo necessário, sem expor credenciais a código não confiável. Um rerun humano preserva as
restrições de um evento Dependabot; não é uma solução de privilégio.

Referências primárias:

- [Sonar: parâmetros de Quality Gate](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui#quality-gate).
- [GitHub: Dependabot em Actions e secrets](https://docs.github.com/en/code-security/reference/supply-chain-security/troubleshoot-dependabot/dependabot-on-actions).
- [GitHub: target-branch e grupos](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

## 5. Outras pendências e limites

- **Fluxo de branches:** `ADR-017` determina PR `develop → main`. O Dependabot não define
  `target-branch`, usa a default `main` e abre os sete PRs diretamente nela. Corrigir o alvo dos
  version updates para `develop`, ou ratificar a exceção e seus gates. Security updates conservam
  comportamento próprio sobre a default branch, conforme a documentação GitHub.
- **Back-merge pendente:** a API confirmou refs equivalentes às locais. A divergência `1 2` tem o
  merge de release somente em `main` e duas documentações somente em `develop`.
- **DBT-63:** a intermitência de login permanece declarada. Runs do PR #59 constam success na
  segunda tentativa; isso não elimina o defeito. O closure existente exige pelo menos cinco
  execuções consecutivas e um negativo com redirecionamento suprimido, sem remover teste nem
  aumentar timeout como remédio.
- **Escopo Sonar:** o scanner cobre `src`, excluindo `src/test`. `scripts/**` e workflows não
  fazem parte desse recorte. `ncloc=20256` e cobertura total 63,4% foram observados pelo MCP.
  A exclusão de tooling segue em DBT-58; não confundir a cobertura do Sonar com a local, cujo
  denominador inclui scripts (`ciclo-23-faseR.md:58`).
- **Reconciliação de dívida/prosa:** DBT-61/DBT-62 ainda estão `ABERTA` no registry, embora o código
  atual atribua PRs e descubra workflows. Isso pede reconciliação dos closures, não promoção automática.
  A probe DBT-66 mostra um limite concreto remanescente do contrato de claims.
- **Handoff desatualizado:** §1 de `PROGRESS.md` continua descrevendo cota bloqueada e refs antigas.
  Jobs atuais com passos executados refutam o bloqueio como estado corrente. Guardas temporais
  verificam âncoras/prazos, não equivalência da prosa com a API.
- **Supply chain do scanner:** a imagem `sonarsource/sonar-scanner-cli:latest` é mutável, apesar de
  as GitHub Actions estarem pinadas por SHA. Fixar versão/digest e registrar a atualização melhora
  a reprodução do analyze; não foi medida uma regressão causada por essa imagem nesta sessão.

## 6. Checkout local e verificação realizada

`npm run m02:state:check` passou: marcador ancestral válido em `48ffb6b`, folga 7/13; worktree dirty.

Os arquivos `package.json` e `package-lock.json` já continham downgrade de `drizzle-kit` para
0.18.1, e `node_modules` também estava em 0.18.1. Três guardas de leitura foram executadas:

| Comando                             | Resultado | Causa                                                                  |
| ----------------------------------- | --------- | ---------------------------------------------------------------------- |
| `npm run guard:upgrade`             | exit 1    | spec/lock/installed fora de 0.31.0–0.31.99 e Downgrade Request ausente |
| `npm run m02:lockfile-guard`        | exit 1    | versão fora da faixa e lock do worktree diferente de HEAD              |
| `npm run check:migration-toolchain` | exit 1    | 0.18.1 não exporta `defineConfig`; config não carregável               |

Isso é `LOCAL-VERIFIED` sobre o WIP; não é a causa atribuída aos PRs remotos. A cadeia completa
`npm run check` não foi repetida nem declarada verde. Não houve instalação de dependências,
reset/clean/stash, commit/push, rerun de Actions, merge, alteração de secrets/proteções ou novo deploy.

Há evidência positiva independente: o PR de release #59 executou o job Neon com integração e E2E
e concluiu cleanup em `36877026247`. A falta de capacidade é específica dos eventos Dependabot
consultados, não prova de que o pipeline Neon inteiro seja inoperante.

## 7. Ordem de fechamento proposta

1. **Imposição de release:** DBT-64; proteção/required checks e bloqueio de promoção pelos gates atuais.
2. **Compatibilidade:** DBT-65; corrigir os pares da #56 e a família da #53 em mudanças revisáveis.
3. **Capacidade de checks:** DBT-67; alcançar o scanner e exercitar a action da #52 com isolamento.
4. **Prova do contrato:** DBT-66; negativo específico da guarda LCOV, com fixture própria.
5. **Integração:** back-merge; fluxo Dependabot; validar os candidatos #54, #51, #55 e #57 sobre a
   base vigente, em ordem de risco e com checks atados a cada novo SHA.
6. **Dívidas existentes:** cobertura Sonar ≥ 80 sem reduzir escopo, DBT-63 e reconciliação do handoff/registry.

Esses passos são propostas de fechamento, não ações executadas por esta análise. O veredito de
governança permanece condicionado aos gates vermelhos e às provas que faltam.
