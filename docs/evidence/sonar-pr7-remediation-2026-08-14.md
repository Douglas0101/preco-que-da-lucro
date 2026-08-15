# Evidência de remediação SonarCloud — PR #7

## Bloqueador confirmado

O Quality Gate do novo código falhava por uma única vulnerabilidade:

- regra `githubactions:S6505`;
- severidade Major / impacto Medium;
- arquivo `.github/workflows/neon-preview.yml`, linha 56;
- causa: instalação npm sem `--ignore-scripts`;
- correção: `npm ci --ignore-scripts` em `neon-preview.yml` e `ui-stack.yml`.

O projeto possui vulnerabilidades antigas que mantêm o rating geral em `C`.
Isso é diferente do Security Rating do novo código do PR, que deve ser
reavaliado pelo SonarCloud depois da publicação do commit.

## Matriz das anotações do PR

| Grupo                                   | Evidência local                                               | Estado                       |
| --------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| S6505 / lifecycle scripts               | Workflows usam `npm ci --ignore-scripts`                      | Corrigido                    |
| índices React em `chat-markdown.tsx`    | Chaves incluem ocorrência estável por linha/parte             | Corrigido                    |
| `Set` em `finance.ts`                   | Conjunto somente leitura usado para classificação de unidades | Revisar no Sonar             |
| props readonly                          | Props de componentes recebem `Readonly`                       | Corrigido                    |
| ternários aninhados                     | Reavaliar após o próximo scan                                 | Pendente de evidência remota |
| output/status e TypeError               | Estados de cálculo e erro são discriminados no BFF/UI         | Revisar no Sonar             |
| TODO, SQL multiline e literal duplicado | Reavaliar contra o diff final                                 | Pendente de evidência remota |
| complexidade em telas                   | Revisar no scan atualizado após integração                    | Pendente de evidência remota |

O SonarCloud deve ser consultado novamente após o push; a análise local não
substitui o Quality Gate remoto. A cobertura LCOV ainda não está configurada
como condição de falha neste projeto.

## Validações locais registradas

- `npm ci --ignore-scripts`
- `npm test`: 16 arquivos e 222 testes passaram após a integração e os novos testes de segurança financeira.
- `npm run typecheck`: passou após a migration de rate limit.
- `npm run lint`: passou.
- `npm run format:check`: passou.
- `npm run build`: passou.
- `npm run check:bundle`: passou.
- `npm run db:check`: passou.
- `npm run check:no-supabase-runtime`: passou.
- `npm audit --audit-level=high`: passou no limiar alto; a auditoria reportou quatro vulnerabilidades moderadas transitivas em `esbuild` via `drizzle-kit`, cuja correção automática exigiria downgrade/breaking change.

## Limitações

O token local do GitHub CLI está inválido nesta execução. Portanto, logs de
Actions e o novo resultado do check SonarCloud ainda dependem da publicação e
da consulta remota autenticada.

O PostgreSQL local não estava disponível (`ECONNREFUSED 127.0.0.1:5432`), então
`npm run db:test` e a execução real dos E2E não foram comprovados localmente.
`npx playwright test --list` confirmou 32 casos (8 cenários em Chromium,
Firefox, WebKit e Mobile); o gate remoto precisa executar a matriz com banco e
credenciais reais.

## Teste assistido CI/CD — 2026-08-14

Execução realizada no commit `c6b5575593a8bb927dd7bbbc7b9d007a73f9612`, no
worktree isolado `codex/pr7-sonar-remediation`:

- `npm ci --ignore-scripts`: passou.
- `npm run check`: passou; inclui UI stack, ausência de Supabase em runtime,
  formatação, lint, typecheck, 222 testes unitários, build e bundle.
- `npm run db:check` com `DATABASE_ADMIN_URL`: passou.
- `git diff --check`: passou.
- `npm audit --audit-level=high`: passou; o registry reportou quatro
  vulnerabilidades moderadas transitivas em `esbuild` via `drizzle-kit`.
- `npx playwright test --list`: 32 testes descobertos, sem retries ocultos.
- `npm run db:test`: não executado até o banco; falhou com
  `ECONNREFUSED 127.0.0.1:5432`, mesmo fora do sandbox.
- `npm run test:e2e`: não executado até os testes; o `webServer` falhou no
  `e2e:prepare` pelo mesmo `ECONNREFUSED`.

### Estado remoto durante o teste

- PR #7 continua apontando para `develop` em `d66e53a1a63395ab70dbb21f279c31a90c971ca6`;
  a remediação local ainda não foi publicada.
- O último workflow `UI stack` remoto associado a esse SHA foi o run
  `31665926134`, concluído com sucesso e incluindo `db:test`, build, audit e
  Playwright.
- SonarCloud ainda mostra o resultado do SHA remoto antigo: Quality Gate
  `Failed`, Security Rating de novo código `C`, 40 issues e
  `githubactions:S6505` aberta em `.github/workflows/neon-preview.yml:L56`.
- Não há análise Sonar nova do commit local; `sonar-scanner` não está
  disponível no ambiente e não houve push/execução remota deste branch.

Assim, o gate local determinístico está verde, mas o fechamento completo do
CI/CD ainda requer PostgreSQL/credenciais no executor e uma nova análise
SonarCloud depois da publicação do commit remediado.

## Resultado remoto final — 2026-08-15

### Causa raiz da falha "The last analysis has failed"

O plano Free da organização `douglas0101` limita projetos privados a 50.000
LOC. O uso estava em 42.639 e a análise do PR adicionava 11.311
(ts=10.721, plsql=385, yaml=160, js=45), totalizando 53.950 — acima do limite,
com a tarefa de análise abortada em ~3s em todos os pushes.

Os projetos privados inativos `vitruviano-v2-runtime` (41.728 ncloc, sem
análise desde mai/2026) e `agent-coding-framework-main` (911 ncloc, desde
abr/2026) consumiam ~85% da cota.

### Correção aplicada

- Exclusão no SonarCloud de `vitruviano-v2-runtime`,
  `agent-coding-framework-main` e `Projeto-Contabilidade-AI` (sem análise).
- Commit de retrigger `65281b4` no branch `codex/pr7-sonar-remediation`.

### Estado remoto após a correção

- SonarCloud Code Analysis no PR #8: **SUCCESS — Quality Gate OK**.
- Novo código: Security Rating **A** (1.0), 0 vulnerabilidades novas
  (`githubactions:S6505` fechada), Reliability A, Maintainability A,
  duplicação 0%, security hotspots 100% revisados.
- CI GitHub no commit `65281b4`: `verify` (UI stack) SUCCESS e `migration`
  (Neon preview) SUCCESS.
