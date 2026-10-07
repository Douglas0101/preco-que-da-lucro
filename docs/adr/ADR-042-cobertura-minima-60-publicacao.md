# ADR-042 — Cobertura mínima obrigatória de 60% e publicação verificada

- Status: ACEITA — decisão humana nesta sessão de 2026-10-06: “Reduzir o mínimo obrigatório para 60%”. Execução externa registrada separadamente.
- Data: 2026-10-06
- Escopo: política de cobertura e promoção develop → main; recuperação do serviço na Vercel.
- Substitui: limiar de 80%, congelamento condicionado a esse limiar e obrigatoriedade do espelho de ADR-037/ADR-038. Os demais contratos dessas decisões permanecem.

## Contexto

A produção da Vercel continua na revisão antiga de main, enquanto develop contém a atualização de segurança do TanStack e a correção da configuração do chat. O ruleset exige um espelho de cobertura que continua sem provenance suficiente e uma regra update impede qualquer merge. A decisão humana altera a política, sem declarar que a cobertura aumentou ou que o espelho se tornou verificável.

## Decisão

1. A condição obrigatória é **new_coverage >= 60%**. O CI mede a análise real do Compute Engine da revisão e superfície esperadas. Valor ausente, estado pendente, timeout, identidade divergente ou condição ignorada são NO-VERDICT e bloqueiam. Cobertura abaixo de 60% bloqueia.
2. O scanner submete o relatório com qualitygate.wait=false. O passo obrigatório gate-readout espera a conclusão do mesmo task por até 300 segundos, confirma analysisId, projeto, SHA, branch/PR e calcula a decisão ADR-042. A submissão do scanner isoladamente nunca aprova.
3. O relatório conserva status, condições e limiar originais do provedor. Se o preset Sonar way ainda exigir 80%, um ERROR exclusivamente de cobertura entre 60% e 80% pode coexistir com releasePolicy.status=OK. Esse resultado é uma decisão explícita de política; não é apresentado como Quality Gate verde do provedor.
4. Permanecem os controles observados de segurança, confiabilidade e manutenibilidade (rating A), duplicação new <=3% e revisão de hotspots de segurança =100%. Seus comparadores, limites, valores e veredictos são conferidos. Outras condições ERROR também bloqueiam. Nenhuma condição não relacionada a cobertura é dispensada.
5. Baseline e main-coverage-mirror conservam a observação original, inclusive ERROR e NO-VERDICT, e tornam-se informativos. Não projetam aprovação de main. O ruleset deixa de exigir o espelho e retira a regra update condicionada à política anterior, conservando PR, base atualizada, verify-release e scan + cobertura, proibição de exclusão/force push e bypass vazio.
6. Implementação integra develop após npm run check. A PR develop → main exige a matriz completa atual, banco/RLS e decisão ADR-042 da PR. Após o merge, o **CE real do novo SHA de main deve aprovar a política de 60% antes da publicação em produção**. Durante essa transição, a publicação automática da Vercel fica suspensa. Merge e publicação são ações distintas. Main retorna a develop por merge ordinário.
7. Este reparo operacional publica a revisão verificada na Vercel e valida sessão e chat reais. Hostinger, recuperação independente e dívidas sem relação com a mudança conservam sua qualificação própria. Credenciais permanecem sob entrada humana Via A; dados de production não são alvo de testes.

## CI Neon e isolamento

Uma cópia comum de production herdou uma conta real e o rollback de teste recusou apagá-la. O CI passa a criar uma raiz schema-only por PR, run e attempt, com prazo de 24 horas. Antes de preparar o fixture, confirma init_source=schema-only, criação nova, identidade não permanente, endpoint correspondente, prazo e inventário vazio. Toda tabela é bloqueada e verificada; registros, relações externas, grandes objetos ou inventário desconhecido abortam sem apagar dados. Somente schemas copiados e vazios são reconstruídos. As migrations aplicadas geram o ledger verdadeiro. Todas as 18 suítes, RLS, matriz Playwright e descarte always com GET 404 permanecem obrigatórios.

## Validação e consequências

Os negativos exercitam os dois lados de 60%, todos os controles preservados, métricas ausentes/contraditórias, CE tardio/pendente, origem e identidade. A preparação Neon recusa conta herdada e conexão permanente; prova local PG17 e execução remota são registradas no pacote de evidências. O limiar menor aumenta a quantidade de código que pode permanecer sem cobertura; o número observado continua visível e não é substituído por testes locais ou pela cobertura da PR.

## Rollback

Reverter por commits ordinários, restaurar o payload anterior do ruleset e suspender nova publicação. A reversão do deployment usa o identificador anterior observado; não envolve rollback de dados de production nem reescrita de histórico.

## Evidência

- Pedido e resposta humana desta sessão; docs/evidence/release-unblock-2026-10-06/.
- scripts/sonar/gate-readout.ts e src/test/sonar-gate-readout.test.ts.
- .github/workflows/sonar.yml e guardas de contrato de CI.
- scripts/ci/prepare-neon-fixture.ts e src/test/neon-fixture.test.ts.

---

## Emenda — implementação do fixture (2026-10-07): `init_source` parent-schema

O §CI Neon e isolamento exige uma raiz schema-only por PR, run e attempt. A implementação
(`scripts/ci/provision-neon-fixture.ts`) usava `init_source: "schema-only"`, que cria uma branch
**ROOT** sem linhagem. O provedor recusa essa criação no projeto `damp-forest-57346541`: papéis
SQL-created de _legacy web access_ (`app_runtime`) não comportam branches root schema-only — HTTP
412 observado nas runs `37556250921` e `37634147956` e no diagnóstico de console de 2026-10-07
(request `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`); a leitura read-only de 2026-10-07 confirma
somente as duas branches permanentes (`production` root/default, `develop` child) e nenhuma
operação de criação agendada para as tentativas recusadas. Evidência:
`docs/evidence/neon-parent-schema-2026-10-07/`.

**Substituto:** `init_source: "parent-schema"` — branch **CHILD** de pai explícito (`production`
para base `main`, `develop` nos demais), com o schema copiado **sem linhas herdadas**. A
substituição preserva todas as invariantes desta decisão: identidade verificada (pai explícito por
base, criação nova, não-permanente), endpoint correspondente, prazo de 24h, inventário vazio
(nenhuma linha, nenhum grande objeto, nenhum schema desconhecido), reconstrução apenas de schemas
copiados e vazios, migrations reais que geram o ledger verdadeiro, as 18 suítes, a sonda RLS, a
matriz Playwright e o descarte `always()` com GET 404. O `neon_auth` (schema gerenciado do Neon
Auth, presente na `develop`) aparece na cópia schema-only, é verificado vazio como os demais e é
reconstruído no fixture descartável.

Esta emenda é de **implementação**: não altera a decisão de cobertura mínima de 60%
(`new_coverage >= 60%`), nem qualquer condição de segurança, confiabilidade ou manutenibilidade
desta ADR. A aceitação do provedor só é demonstrável pelo CI corrente (run real) — limite
declarado no pacote de evidências; nenhuma prova remota é inferida localmente.
