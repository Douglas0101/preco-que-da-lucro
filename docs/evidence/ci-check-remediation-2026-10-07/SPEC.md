# SPEC — correções dos três checks do PR #60

## Fato-fonte

Pedido do usuário: analisar e corrigir os checks Neon branch-ci, cleanup e Sonar main-coverage-mirror (9 sucessos/3 falhas). Revisão publicada `1ff8a7749c05854bafe0c62cb6dd2e07b0be724c`; base main `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9`. Intenção L753 em `docs/evidence/agent-state/PROGRESS.md`.

## Problema observado

- [Neon run 37556250921](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37556250921): create-branch-action retorna `Request failed with status code 412`; nenhum branch_id entregue. Migrations/integração/RLS/E2E não executaram. Cleanup mantém exit 2 por ausência de identidade, corretamente sem presumir descarte.
- [Sonar run 37556250974](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/37556250974): main-unit-adapter e gate-mirror retornam exit 2; `NO-VERDICT: complete per-unit mapping/provenance unavailable or inconsistent`. O LCOV histórico de main não inclui a proveniência exigida. O scan obrigatório passou. ADR-042 já define espelho como observação, mas o workflow usa continue-on-error no job, mantendo check vermelho.
- Candidato local anterior preservado: provisionador REST é chamado por `npx --no-install tsx` antes de `npm ci --ignore-scripts`, inviável num checkout limpo com somente cache npm. Prova local anterior não demonstra execução remota desse candidato.

## Contrato

1. Instalar dependências antes de executar scripts TypeScript do workflow Neon.
2. Schema-only, fonte explícita production/develop, TTL24h no POST, isolamento de identidade/conexão, mascaramento/redação e produção fora dos testes permanecem obrigatórios.
3. Entregar branch_id ao cleanup assim que a criação é identificada; recusa ou resultado incerto não autoriza teste nem falso descarte. GET404 pós-delete é a única confirmação de ausência; GET200 falha (1), acesso/rede/identidade inconclusivos falham (2). Prova deve executar mesmo após delete falhar.
4. Espelho observacional preserva status/condições/NO-VERDICT nos relatórios, logs e summary; erros inesperados de execução/artefato não viram sucesso vazio. O CE real da análise mantém exit1/2 bloqueante e mínimo60%, sem permissividade no passo obrigatório.
5. Não repetir runs antigos para confirmar erros reportados. Verificação de código é isolada e executada sobre os bytes corrigidos.

## Mudanças e limites

Escopo fechado: `.github/workflows/neon-pr-branch.yml`, `.github/workflows/sonar.yml`, helpers Neon/Sonar diretamente implicados e suas suítes descobertas, `scripts/lib/m02-ci-coverage.ts`/teste, contrato correspondente em `AGENTS.md`, este pacote e append ao journal. Delta L754 após revisão: incluir `.github/workflows/neon-readiness.yml` e normalização do consumidor indireto de `neon-drill-ops.yml` em `NeonResources.connections`, porque ambos recebem saídas brutas da action e são afetados pela exigência compartilhada de porta explícita. Custódia anterior, selos e manifests de outros pacotes permanecem intocados. Nenhuma mudança em main, rulesets, publicação, segredos, migrations ou dados permanentes. Inventário/diagnóstico remoto apenas leitura; criação real depende do mecanismo autorizado de CI. Nenhum commit/push prometido sem gate local verde.

## DoD e testes

- Regressões de comportamento: instalação em checkout limpo; output branch_id preservado se compute/URI falham; erros HTTP412 sem segredo; cleanup404/200/403/000/semID e deletefalho; observação Sonar NO-VERDICT distinta de aprovação de release.
- Smoke: executar entrypoints e/ou scripts reais extraídos dos workflows numa bancada sem credenciais, com transporte isolado e sentinelas de identidade; observar arquivos/summary e códigos, não apenas mocks ou texto fonte.
- `npm run check` completo sobre a árvore final e focused tests aplicáveis. Testes de infraestrutura não demonstram aprovação remota Neon/Sonar.
- Capturas RED/GREEN e fingerprints em `captures/`; README distingue local, histórico remoto e limites; MANIFEST.sha256 inclui exatamente os arquivos descobertos do pacote.
- Revisão adversarial independente após implementação com achados nomeados; não alegar S6 integral aprovado sem lane e precondições correspondentes.

## Riscos

HTTP412 sem código de provedor observável não prova quota, plano ou permissão. REST não é garantia de que a plataforma aceitará a criação. Ausência de proveniência histórica não pode ser corrigida inventando um sidecar. Continue-on-error indiscriminado ocultaria falhas de infraestrutura e é proibido no CE/cleanup. Os checks atuais continuarão na revisão antiga até publicação de uma nova revisão.

## Rollback

Reverter somente os deltas deste pacote por commit ordinário em develop, sem descartar o candidato anterior nem alterar histórico publicado. Nenhuma operação de rollback de banco integra o escopo.
