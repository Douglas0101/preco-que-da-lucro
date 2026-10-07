# SPEC — cobertura mínima de 60% e recuperação do chat em produção

## Fato-fonte

Pedido humano de 2026-10-06: o chat continua indisponível na produção e o limiar de 80% de cobertura impede o progresso; resposta humana escolheu mínimo obrigatório de 60%. O deployment de produção da foto é `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`, revisão `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`; o preview corrigido é `ce9bd44e6a22228ec623cbb4a99ac2c1be5f2fff`. PR #60 segue aberta, com congelamento `update` e `main-coverage-mirror` obrigatório.

## Problema

A correção do chat existe apenas em develop. A política aceita pelo usuário passa a exigir new_coverage >=60 na análise real do CE, mantendo o espelho incompleto como observação. O CI Neon também herda contas reais ao testar rollback, embora o banco descartável deva conter somente fixtures.

## Contrato

Cobertura, baseline e espelho conservam métricas e veredictos originais como observações. New_coverage >=60 continua obrigatório no CE real da superfície correta. O release continua bloqueado por testes, instalação, build, auditoria, falhas não relacionadas a cobertura do Sonar ou falta de identidade/conclusão do Compute Engine. Nenhuma falha é reclassificada como cobertura por inferência. Somente develop integra implementação, seguida de PR develop → main. Publicação exige a revisão exata e configuração efetiva; nenhum teste atinge production.

## Mudanças

- ADR-042 e AGENTS.md: ratificação da mudança de política solicitada, substituindo o bloqueio de 80% e o congelamento condicionado a ele.
- scripts/sonar/gate-readout.ts e testes: espera limitada pelo CE e decisão explícita que conserva a resposta do provedor, exigindo cobertura mínima de 60% e preservando os demais controles.
- .github/workflows/sonar.yml, scripts/lib/m02-ci-coverage.ts e testes: scanner, relatórios e guardas preservados; baseline/espelho informativos e decisão real do CE obrigatória a 60%.
- .github/workflows/neon-pr-branch.yml e testes aplicáveis: branch efêmera schema-only sem dados herdados e scripts/ci/prepare-neon-fixture.ts para verificar identidade/ausência antes de preparar schema sintético; src/test/neon-fixture.test.ts; expiry e descarte mantidos.
- Este pacote e journal: evidência por revisão, custódia e regras remotas antes/depois. Ajustes finais do write-set serão declarados antes de editar.

## DoD

1. Controles negativos distinguem cobertura de segurança, confiabilidade, duplicação e CE inconclusivo.
2. npm run check verde no candidato isolado; PG17 local para mudanças de CI/banco; PR com matriz completa atual.
3. Ruleset mantém PR, base atualizada, checks de testes/scanner, proibição de force push e bypass vazio. Somente o espelho obrigatório e o congelamento condicionado a 80% são removidos; cobertura real >=60% continua obrigatória.
4. main recebe a revisão aprovada por merge commit e retorna a develop; produção usa esse SHA e o chat é verificado com sessão legítima.
5. WIP anterior conserva seus hashes, fora do append autorizado ao journal.

## Testes

RED: a política anterior bloqueia exclusivamente cobertura e o rollback anterior recusa conta herdada. GREEN: cobertura de 60 até menos de 80 não veta; abaixo de 60 veta, outras condições vermelhas e identidade ausente continuam vetando; cópia de teste não herda contas. Negativos de workflow detectam remoção de testes/scanner, polling e cleanup.

## Riscos

A cobertura observada pode ficar entre 60 e 80; isso é decisão de política, não melhora da métrica. Scanner sem conclusão ou precondição ausente continua NO-VERDICT. Credenciais e login requerem entrada humana pela Via A. Produção antiga pode conter configuração vazia; deploy Ready não prova chat funcional. S6 formal permanece IN-PROGRESS até o relatório da revisão independente autorizada.

## Rollback

Reverter os commits desta mudança por commits ordinários e restaurar o payload anterior do ruleset. Se o candidato em produção falhar, retornar ao deployment anterior identificado, sem reescrever histórico nem aplicar rollback de dados de produção.
