# Redeployment crítico — plano e correção de audit

## Fato-fonte

Captura fornecida pelo operador: Vercel recusou TanStack Start 1.168.49 no commit main d4b9395. Reconciliação atual em 2026-10-06: develop 97a23bfb85f5b57ea42f5ca774c61374855f872e; main d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9. PR #60 aberta e BLOCKED.

## Problema

A correção TanStack já está publicada em develop (Start 1.168.60/core 1.169.39). Repetir o deployment da revisão antiga conserva a dependência vulnerável. O verify-release atual reprovou em npm audit por shell-quote 1.10.0 (GHSA-pqg4-j6r4-53mv), dependência dev transitiva de launch-editor 2.14.1. CI Neon e mirror têm bloqueios independentes.

## Contrato

O lockfile deve resolver shell-quote 1.11.0 sem alterar outra entrada, pins TanStack, package.json, código ou testes. npm audit deve ter zero vulnerabilidades. As quatro terminações após um token comment devem causar TypeError sem executar shell. O gate check completo deve passar antes da integração e push develop. Publicação de produção continua condicionada a ADR-037/038, revisão main aprovada e gates atuais.

## Mudanças

Write-set: package-lock.json (uma entrada), docs/evidence/agent-state/DEBTS.md (DBT-99), append docs/evidence/agent-state/PROGRESS.md append EXECUTION-STATE-PROGRAM.md (marcador local ancestral) e este pacote. Bancada gerenciada destacada do head observado; o WIP anterior tem recibo privado em /tmp/pqd-critical-redeployment-20261006-custody.json.

## DoD

1. Audit RED identifica shell-quote 1.10.0; GREEN tem zero vulnerabilidades e a versão instalada 1.11.0.
2. Quatro controles de terminador distinguem pai/candidato; quoting normal continua igual; nenhuma string é executada por shell.
3. npm ci --ignore-scripts e npm run check passam na bancada. A diff do lockfile é exclusivamente node_modules/shell-quote.
4. Commit/push somente develop com hooks; checks são consultados pelo SHA publicado.
5. Preview manual usa a revisão corrigida e permanece associado a develop. Estado READY e contrato runtime são medidos separadamente.
6. Release só pode avançar com todos os gates e precondições de ADR038; audit isolado não fecha release, DBT-96 ou DBT-64.

## Testes

captures/shell-quote-red.json e shell-quote-green.json exercitam os bytes instalados reais nas duas árvores. npm-audit-red.json e npm-audit-green.json identificam advisory, versão e ausência do sintoma. O check existente cobre guardas, lint, tipos, unidade, build e bundle. A matriz de PR precisa de um run novo após a correção.

## Riscos

A captura inicial é uma observação histórica; refs e gates atuais são fontes distintas. O preview atual é da revisão 38bd376, ancestral de develop, com o mesmo lockfile anterior. O check local pode conter testes DB condicionais; isso nunca prova db:test completo nem substitui a matriz PR. O mirror precisa do LCOV original do scanner com proveniência e identidade por unidade. A integração Neon copiada de production não pode ser higienizada nem ter seu guard de rollback afrouxado para obter verde.

## Rollback

Antes de integrar, a bancada é descartável e o checkout principal conserva o lockfile pai. Depois de publicar, qualquer reversão usa um novo commit em develop e refaz os gates; a reversão para1.10.0 torna o audit vermelho. Reescrita de histórico ou retorno de produção a uma revisão vulnerável não fazem parte do plano.
