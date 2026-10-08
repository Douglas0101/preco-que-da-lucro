# Ciclo 24 — encerramento com escalada medida

**Veredito: publicação congelada; Fases I/80 interrompidas por ERRATA; cobertura e DBT-64 continuam abertas.** D0 Opção A ratificada pelo prompt do MAESTRO. Em 2026-10-01, main ficou em d4b9395; o código do ciclo foi publicado em develop 0b59423 e a [PR #60](https://github.com/Douglas0101/preco-que-da-lucro/pull/60) continua aberta/bloqueada. O 13º commit é handoff documental local e não altera o SHA remoto observado.

Semântica de nulo, declarada antes dos gates: campo ausente, resposta inacessível, CE pendente/NONE e métricas `measures=[]` são precondição/NO-VERDICT. Não significam zero nem aprovação. Check cancelado/skipped não prova execução. Uma observação de API é REMOTE-OBSERVED; check/teste local é LOCAL-VERIFIED; configuração e metadados de deploy não provam comportamento em produção.

## B — base e custódia

B1: a versão 0.18.1 é WIP da árvore original, não a versão publicada. Mantida a política 0.31.x; `npm ci --ignore-scripts` na worktree isolada instalou 0.31.10. Nenhum package.json/lockfile foi alterado pelo ciclo e a guarda não foi afrouxada. As três guardas na original reprovaram o downgrade; a original segue com HEAD 48ffb6b e node_modules/WIP preservados.

Gate inicial B1 PASS: 116 suítes, 1397 passed/14 skipped. Gate completo pré-push no SHA 0b5942331989ee156da99b297de3ca9f2f2c3c94 PASS: 117 suítes, 1411 passed/14 skipped; build/bundle e todos os passos da cadeia check PASS. Comando: `env -u NO_COLOR npm run check`. Hash do log desta sessão: 3fe3dbaf8cffdf8f5032af5f81a9bcd24a9bd5423c28a7ae8f079c63ec126031.

B2: handoff documental seletivo commitado; back-merge de main em de82dc9 sem alterar arquivos. Main é ancestral da linha de develop, 0 commits exclusivos de main. Os commits novos de desenvolvimento/documentação mantêm develop adiante: não se declara igualdade literal dos dois HEADs.

Custódia reconferida: 929 arquivos, 0 diferenças; `wip-custody.json` contém caminhos/hashes, sem credenciais. Os 11 selos históricos foram conferidos nos blobs de suas revisões de criação: 42 hashes, 0 falhas. Um selo antigo de journal aplica-se àquela revisão, não à versão aditiva atual.

B3: DBT-62 FECHADA. Descoberta real enumerou os sete workflows; original sem findings, workflow novo sem declaração reprovou, remoção de sonar reprovou, descoberta vazia produziu sete findings. DBT-61 permanece ABERTA: which-analysis tem detector puro/negativos e flags PR, mas a closure legada exige análise acessível de develop, não provada no plano vigente (limite 403). A existência do detector não substitui a closure operacional.

## I — imposição e quebra da premissa

`sonar.qualitygate.wait=true` e timeout=300 foram publicados em develop. No job scanner 110591560381, o log registrou espera do CE às 21:27:15.357Z e QUALITY GATE STATUS: PASSED às 21:27:21.306Z; polling observado ~5,95 s. A estimativa +1–3 min/run do ADR era planejamento, não uma medição. Esse run observou espera e aprovação da PR; não observou scanner falhando com o gate de main em 63,2.

ERRATA E4: PR #60 tem gate OK com quatro condições (reliability, security, maintainability, hotspots), **sem condição de cobertura**; o gate de main da análise identificada permanece ERROR 63,2. Os recortes PR e main diferem, e o contrato de PR por si só não assegura o gate de main em janela de 30 dias. A [documentação Sonar](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates) descreve a diferença de recorte e a supressão de cobertura em mudanças pequenas; as métricas new da PR retornaram `measures=[]`, portanto não se afirma quantidade de linhas da PR nem causalidade exata do toggle D5. Fases I/80 paradas na premissa medida; DBT-64 ABERTA.

Ruleset [24333849 — C24-main-release-gates](https://github.com/Douglas0101/preco-que-da-lucro/rules/24333849) ativo em main: PR, merge commit, base atualizada, required checks verify e scan + cobertura vinculados à Actions (15368), sem deletion/force-push e bypass vazio. O push direto normal foi observado rejeitado GH013 com exigência de PR/checks. Depois da ERRATA, foi acrescentada regra update com bypass vazio para congelar todas as atualizações de main, inclusive merge. GET reconfirmou regra ativa e current_user_can_bypass=never.

Controle de merge normal com SHA exato: HTTP 405, mensagem explicitou conversa pendente, verify cancelled e Cannot update this protected ref. Main antes/depois igual. É prova de bloqueio agregado e freeze; não é prova de bloqueio por cobertura equivalente. Não houve bypass, merge ou publicação de produção neste ciclo.

Exceção C24-PUBLICATION-FREEZE: owner MAESTRO, justificativa ciclo de 80%, janela até fim do ciclo/teto **2026-10-01T23:59:59-03:00 (2026-10-02T02:59:59Z)**, bypass=[]; vigente no encerramento. A janela não se autoestende nem remove o ruleset automaticamente; seu vencimento exige decisão operacional, sem autorizar promoção vermelha. ADR-037 aceito; ERRATA E4 prevalece sobre a hipótese de suficiência dos checks da PR. A UI Vercel não foi operada.

## M — baseline e alvo corrigido

M2 remoto, em 2026-10-01T21:24:43.687Z: main d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9; analysisId 1dc2baf9-b289-42f4-b2ca-dd7b662b3679; analysisDate 2026-10-01T14:53:36+0000; período days/30. Gate ERROR, única condição reprovada new_coverage, limiar 80. Script read-only `scripts/sonar/main-baseline.mjs` leu o Web API dentro do runner com secret já em Actions, identificou e reconfirmou SHA/analysisId. Nenhum valor de token entrou no fluxo do agente.

| Medida new em main | Total | Descoberto | Coberto |
| ------------------ | ----: | ---------: | ------: |
| Linhas             |  1904 |        690 |    1214 |
| Condições          |  1091 |        411 |     680 |
| Unidades agregadas |  2995 |       1101 |    1894 |

new_coverage = 1894/2995 = 63,238731%, exibido 63,2 no gate. O alvo de linha isolado do prompt resulta em 310 linhas, mas só isso levaria o agregado a 73,589316%. Para 80% são necessárias **502 unidades cobertas adicionais entre linhas e condições** (ceil(0,8×2995)−1894). Exemplo matemático: 310 linhas + 192 condições; não é promessa de que testes nessas linhas cubram automaticamente essas condições. A [definição oficial de coverage](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/metric-definitions) combina linhas e condições. Alvo é snapshot, deve ser re-medido no próximo loop porque a janela é viva.

ERRATA E5: o alvo anterior misturava overall e new; 785 não é alvo vigente. A fórmula somente em linhas é insuficiente para new_coverage. DBT-57 foi reconciliada para D1 (80 mantido, lcov JavaScript/TypeScript, sem rota de remoção da condição), com alvo, data e denominador registrados; permanece ABERTA.

M1 local: test:coverage exit 0, linhas 5992/9122 (65,68%), condições 4005/6643 (60,28%); src-only LF3930/LH2823. lcov SHA-256 dc339070e8e5629426bd6da687588a2699411e2bee534a9e13934c8206ec0197. M1 inclui superfícies distintas das métricas new do Sonar; a divergência de denominadores supera 5%, não autoriza comparar percentuais como se fossem a mesma população. Sonar M2 é a autoridade do alvo; M1 guia diagnóstico.

Nenhum teste de cobertura de produção foi escrito após a queda da premissa. Loop A não iniciado, sem alvos fechados, HARD ou SKIPPED-REFACTOR declarados por tentativa inexistente. Guia local overall dos maiores descobertos (não são alvos new confirmados):

| Arquivo                                       | Linhas descobertas locais |
| --------------------------------------------- | ------------------------: |
| src/server/repositories/memory.repository.ts  |                       190 |
| src/lib/ai/budget-ledger.server.ts            |                        95 |
| src/lib/products.functions.ts                 |                        61 |
| src/lib/ai/tool-registry.ts                   |                        42 |
| src/server/auth/auth-policy.ts                |                        38 |
| src/server/repositories/product.repository.ts |                        37 |
| src/instrumentation/telemetry.ts              |                        34 |
| src/lib/chat.functions.ts                     |                        31 |
| src/server/repositories/sales.repository.ts   |                        31 |
| src/lib/ai/tool-runner.ts                     |                        30 |

## Au e P — concluído localmente / preparação

Au: mutação em memória removeu somente o bloco condicional LCOV, preservando menções do path em scanner/upload, e a auditoria reprovou. Fixtures shell reais: ausente exit 1, vazio exit 1, válido exit 0. Uma remoção por cada uma das seis guardas observada; 34 testes focados PASS, cadeia completa local e push verify PASS no candidato. DBT-66 FECHADA com fase-au e correção lint por revisão; não há review S6 de contexto limpo declarado neste ciclo.

P: grupos React/react-dom/types e TanStack Router/Start/plugin, target-branch develop. A guarda de lockfile verifica as famílias **resolvidas** e está encadeada em guard:upgrade. Negativos usam projeções dos lockfiles reais de #53/#56 (SHA, blob e hash em dependency-family-guard.test.ts); ambos reprovam antes da suíte. Positivo do lockfile vigente passa; 49 testes focados PASS. DBT-65 ABERTA até correção/revalidação dos PRs no Ciclo 25.

P provisioning: workflow_dispatch de neon-drill-ops reutilizado, operation exercise-provisioning, confirm=true, somente main/develop. Pin candidato 6.4.0, nome exclusivo run/attempt, identidade branch parent/not primary/default, validade +24h e cleanup com GET 404. Não foi disparado; DBT-67 ABERTA. Código está em develop/PR #60, ainda não em main. As atualizações Dependabot futuras só adotarão a configuração após ela estar na superfície de configuração consumida pelo GitHub. Rerun de evento Dependabot não transforma secrets indisponíveis em credenciais.

## CI e impedimentos remotos

Seis runs novos no SHA 0b59423, nenhum re-run. O orçamento aproximado de 3–5 runs foi excedido por um run (light push/PR e Neon automático incluídos); orçamento de commits é 13/13 e não será excedido.

| Run                              | Evento       | Conclusão | Evidência                                                                                     |
| -------------------------------- | ------------ | --------- | --------------------------------------------------------------------------------------------- |
| CI light (docs/evidence)         | pull_request | success   | [run 36928472369](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472369) |
| Neon PR branch CI                | pull_request | failure   | [run 36928472633](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472633) |
| SonarCloud (scanner + cobertura) | pull_request | success   | [run 36928472488](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472488) |
| UI stack                         | pull_request | cancelled | [run 36928472435](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472435) |
| CI light (docs/evidence)         | push         | success   | [run 36928460215](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928460215) |
| UI stack                         | push         | success   | [run 36928460220](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928460220) |

UI stack PR: annotation oficial “The job has exceeded the maximum execution time of 12m0s”. Browser install 21:27:39–21:37:19 cancelled; passo de E2E skipped. Cancelled não é verde/vermelho de testes nem selo run@sha. DBT-68 ABERTA registra limite de ambiente/tempo observado; não se atribui ao login intermitente DBT-63, que não executou. Nenhum projeto removido e limite de 12 min mantido.

Neon run 36928472633: action 6.3.1 falhou criação com HTTP 422; migrações/RLS/integração/e2e não rodaram. Cleanup job success com Delete Neon branch **skipped** por saída branch_id ausente não comprova descarte. Causa específica além de 422 não verificada; exercício candidato 6.4.0 ficou para Ciclo 25.

Vercel preview metadata do mesmo SHA: failure, deployment dpl_2gBDcZPxRZSdDRWUGM8guDoALoBp. Causa UNVERIFIED; sem leitura de credencial, comando Vercel ou UI. Main ficou no SHA anterior; não há claim de “primeira publicação verde”.

Oito PRs abertos: #60 e os sete Dependabot #51/#52/#53/#54/#55/#56/#57, todos com base main. Candidatos históricos #51/#54/#55/#57 exigem revalidação, não são aprovação atual. #53/#56 mantêm incompatibilidades e #52 exige provisionamento isolado. Nenhum dos sete foi editado/mergeado pelo ciclo.

## Registry, placar e gate de saída

Registry final: **51 = 41 ABERTA + 9 FECHADA + 1 EM_TRATAMENTO**. FECHADAS neste ciclo: DBT-62 e DBT-66. ABERTAS relevantes: DBT-57, DBT-61, DBT-64, DBT-65, DBT-67 e nova DBT-68. DBT-36 EM_TRATAMENTO/Via A, sem sinal humano para rotação. D2 recorte/gatilho 45k LOC, D3 release PR, D4 Via A, D5 toggle desconhecido não bloqueante e ADR-036 permanecem. ncloc main 20256 não aciona 45k.

Placar ratificado mantido: 150 D, 29 P, 8 NS, 0 UNV / 187. Fórmula congelada (150 + 0,5×29)/187 = 87,9679%; crua 150/187 = 80,2139%. Esses 80,2139% do placar **não são** os 80% do Quality Gate. Não houve promoção do agente.

| Gate de saída              | Estado medido                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| D0A                        | Ratificada; freeze ativo, sem bypass                                                      |
| B base/check/registry      | Main ancestral; check candidato PASS; DBT-61 permanece aberta pela closure não satisfeita |
| I wait falhando com 63,2   | NÃO observado: PR passou e main ficou vermelho; ERRATA E4                                 |
| I push rejeitado           | OBSERVADO GH013; merge normal HTTP 405; main inalterada                                   |
| DBT-64                     | ABERTA; freeze é contenção, imposição equivalente não provada                             |
| DBT-57                     | ABERTA; escalada com gap agregado 502 e alvo de linhas 310                                |
| DBT-66                     | FECHADA; mutação/3 fixtures/remoções observadas                                           |
| P grupos/dispatch/lockfile | Preparados em develop; exercícios e PRs passam ao Ciclo 25                                |
| Break-glass                | Janela vigente até 2026-10-02T02:59:59Z; não expira o bloqueio automaticamente            |
| Commits                    | 13/13; 12 publicados, 13º documental local; sem novo CI                                   |

A próxima promoção exige: reconciliar um controle que examine o candidato no recorte de release de main, medir novamente M2 por analysisId/SHA, obter execução integral da matriz PR dentro do orçamento e resolver Neon 422/prova de descarte. Não remover freeze apenas porque a PR Sonar está OK, nem usar um check de outro SHA. A diferença de denominadores deve ser resolvida antes de escrever lotes de testes ou retomar o Loop V.

## ERRATAs e linhagem

- E0: estado inicial dizia 49 dívidas; medição inicial mostrou 50. Final é 51 após DBT-68.
- E1: detector de DBT-61 não prova análise acessível de develop; permanece ABERTA.
- E2: formatter documental B3 reprovou e o lote não interrompeu o commit; corrigido em commit novo, sem amend nem alteração da história append-only.
- E3: lote M2 inicialmente tinha seis arquivos; último commit privado foi reagrupado antes da publicação em lotes 4 e 3 por índice temporário e CAS de ref. Nenhum commit publicado reescrito, nenhum reset da árvore e nenhum byte de código alterado.
- E4: PR gate OK sem cobertura não impõe main ERROR 63,2; Fases I/80 paradas e update freeze aplicado.
- E5: alvo overall/line-only não fecha new_coverage; alvo agregado corrigido para 502 unidades.
- Errata L284→L286: suíte I1 teve 38 testes, não 47. Journal preservou a linha antiga e acrescentou correção.

| Commit    | Lote                                                                   |
| --------- | ---------------------------------------------------------------------- |
| 0d33250   | B1 handoff/custódia (5 arquivos)                                       |
| de82dc9   | B2 back-merge main (sem alteração de arquivos)                         |
| 2406047   | B3 registry/ledger/selos (5)                                           |
| 2307b65   | Correção de formatação documental (4)                                  |
| 1df9c18   | I1 wait/ADR-037/AGENTS (5)                                             |
| 012feb8   | I2 ruleset/Dependabot/ADR-017 (5)                                      |
| da8d8b6   | Au bloco LCOV/fixtures/DBT-66 (5)                                      |
| 730f218   | P grupos/canal dispatch (5)                                            |
| 9d9783b   | P guarda de famílias resolvidas (5)                                    |
| 827c21a   | M2 baseline read-only no runner (4)                                    |
| 6d90e2f   | M2 protocolo/selo documental (3)                                       |
| 0b59423   | Regex lint/check completo (4)                                          |
| 13º local | Encerramento: AGENTS, DEBTS, PROGRESS, README, selo final (5 arquivos) |

Selos históricos selecionam revisão git de criação. Selo final `fase-final.manifest.sha256` cobre os quatro arquivos documentais na revisão final. Nenhum selo inventa run do 13º commit; CI se refere explicitamente ao candidato remoto 0b59423. Validação documental final PASS: work-package guard, debts guard (51), temporal guard (0 violações), state check (folga 10/13 antes do commit), Prettier e git diff --check. Histórico do journal append-only e linhas antigas do registry preservados por asserção. O estado e o selo serão reconferidos depois do commit; sem declarar CI no commit documental.

## Capturas sanitizadas da sessão

Leitura do main Web API no runner (identidade, métricas e gate; sem token):

```json
{
  "schema": "ciclo24-main-baseline/1",
  "observedAt": "2026-10-01T21:24:43.687Z",
  "mainSha": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "analysisId": "1dc2baf9-b289-42f4-b2ca-dd7b662b3679",
  "analysisDate": "2026-10-01T14:53:36+0000",
  "gate": {
    "status": "ERROR",
    "conditions": [
      {
        "status": "OK",
        "metricKey": "new_reliability_rating",
        "comparator": "GT",
        "periodIndex": 1,
        "errorThreshold": "1",
        "actualValue": "1"
      },
      {
        "status": "OK",
        "metricKey": "new_security_rating",
        "comparator": "GT",
        "periodIndex": 1,
        "errorThreshold": "1",
        "actualValue": "1"
      },
      {
        "status": "OK",
        "metricKey": "new_maintainability_rating",
        "comparator": "GT",
        "periodIndex": 1,
        "errorThreshold": "1",
        "actualValue": "1"
      },
      {
        "status": "ERROR",
        "metricKey": "new_coverage",
        "comparator": "LT",
        "periodIndex": 1,
        "errorThreshold": "80",
        "actualValue": "63.2"
      },
      {
        "status": "OK",
        "metricKey": "new_duplicated_lines_density",
        "comparator": "GT",
        "periodIndex": 1,
        "errorThreshold": "3",
        "actualValue": "1.1"
      },
      {
        "status": "OK",
        "metricKey": "new_security_hotspots_reviewed",
        "comparator": "LT",
        "periodIndex": 1,
        "errorThreshold": "100",
        "actualValue": "100.0"
      }
    ],
    "periods": [
      {
        "index": 1,
        "mode": "days",
        "date": "2026-09-05T02:52:52+0000",
        "parameter": "30"
      }
    ],
    "ignoredConditions": false
  },
  "metrics": {
    "new_lines_to_cover": 1904,
    "new_uncovered_lines": 690,
    "new_conditions_to_cover": 1091,
    "new_uncovered_conditions": 411,
    "new_coverage": 63.23873121869783,
    "new_line_coverage": 63.760504201680675,
    "new_branch_coverage": 62.32813932172319,
    "lines_to_cover": 4797,
    "uncovered_lines": 1744,
    "coverage": 63.4,
    "ncloc": 20256
  },
  "lineOnlyGapTo80": 310,
  "nullSemantics": "valor ausente/ilegível é NO-VERDICT; overall não substitui new; gap só de linhas não inclui conditions"
}
```

PR/main reconferidos pelo conector; métricas omitidas são indisponíveis:

```json
{
  "projectKey": "Douglas0101_preco-que-da-lucro",
  "pullRequest": "60",
  "main": {
    "conditions": [
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_reliability_rating",
        "status": "OK"
      },
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_security_rating",
        "status": "OK"
      },
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_maintainability_rating",
        "status": "OK"
      },
      {
        "actualValue": "63.2",
        "errorThreshold": "80",
        "metricKey": "new_coverage",
        "status": "ERROR"
      },
      {
        "actualValue": "1.1",
        "errorThreshold": "3",
        "metricKey": "new_duplicated_lines_density",
        "status": "OK"
      },
      {
        "actualValue": "100.0",
        "errorThreshold": "100",
        "metricKey": "new_security_hotspots_reviewed",
        "status": "OK"
      }
    ],
    "status": "ERROR"
  },
  "pullRequestGate": {
    "conditions": [
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_reliability_rating",
        "status": "OK"
      },
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_security_rating",
        "status": "OK"
      },
      {
        "actualValue": "1",
        "errorThreshold": "1",
        "metricKey": "new_maintainability_rating",
        "status": "OK"
      },
      {
        "actualValue": "100.0",
        "errorThreshold": "100",
        "metricKey": "new_security_hotspots_reviewed",
        "status": "OK"
      }
    ],
    "status": "OK"
  },
  "pullRequestMetrics": {
    "component": {
      "key": "Douglas0101_preco-que-da-lucro",
      "name": "preco-que-da-lucro",
      "qualifier": "TRK"
    },
    "measures": [],
    "metrics": [
      {
        "custom": false,
        "description": "New lines",
        "domain": "Size",
        "hidden": false,
        "key": "new_lines",
        "name": "New Lines",
        "type": "INT"
      },
      {
        "custom": false,
        "description": "Coverage of new/changed code",
        "domain": "Coverage",
        "hidden": false,
        "key": "new_coverage",
        "name": "Coverage on New Code",
        "type": "PERCENT"
      },
      {
        "custom": false,
        "description": "Conditions to cover on new code",
        "domain": "Coverage",
        "hidden": false,
        "key": "new_conditions_to_cover",
        "name": "Conditions to Cover on New Code",
        "type": "INT"
      },
      {
        "custom": false,
        "description": "Uncovered lines on new code",
        "domain": "Coverage",
        "hidden": false,
        "key": "new_uncovered_lines",
        "name": "Uncovered Lines on New Code",
        "type": "INT"
      },
      {
        "custom": false,
        "description": "Uncovered conditions on new code",
        "domain": "Coverage",
        "hidden": false,
        "key": "new_uncovered_conditions",
        "name": "Uncovered Conditions on New Code",
        "type": "INT"
      },
      {
        "custom": false,
        "description": "Lines to cover on new code",
        "domain": "Coverage",
        "hidden": false,
        "key": "new_lines_to_cover",
        "name": "Lines to Cover on New Code",
        "type": "INT"
      }
    ]
  },
  "nullSemantics": "measures=[] means unavailable, not zero"
}
```

Push direto rejeitado, gate local e refs:

```json
{
  "candidateSha": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
  "prepushCheck": {
    "exit": 0,
    "logSha256": "3fe3dbaf8cffdf8f5032af5f81a9bcd24a9bd5423c28a7ae8f079c63ec126031",
    "filesPassed": 117,
    "testsPassed": 1411,
    "testsSkipped": 14
  },
  "mainBefore": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "developBefore": "48ffb6bb8106c78781416ffd49fa8a906985f174",
  "intentAt": "2026-10-01T21:24:20Z",
  "developAfter": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
  "publishedAt": "2026-10-01T21:24:23.730877+00:00",
  "directPush": {
    "exit": 1,
    "output": "remote: error: GH013: Repository rule violations found for refs/heads/main.        \nremote: Review all repository rules at https://github.com/Douglas0101/preco-que-da-lucro/rules?ref=refs%2Fheads%2Fmain        \nremote: \nremote: - Changes must be made through a pull request.        \nremote: \nremote: - 2 of 2 required status checks are expected.        \nremote: \nTo https://github.com/Douglas0101/preco-que-da-lucro.git\n ! [remote rejected] HEAD -> main (push declined due to repository rule violations)\nerror: failed to push some refs to 'https://github.com/Douglas0101/preco-que-da-lucro.git'\n",
    "observedAt": "2026-10-01T21:24:25.312180+00:00"
  },
  "mainAfterProbe": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "pullRequest": {
    "number": 60,
    "url": "https://github.com/Douglas0101/preco-que-da-lucro/pull/60",
    "headSha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
  }
}
```

Ruleset final efetivo (inicial ruleset.json preservado como observação anterior):

```json
{
  "id": 24333849,
  "name": "C24-main-release-gates",
  "target": "branch",
  "source_type": "Repository",
  "source": "Douglas0101/preco-que-da-lucro",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "exclude": [],
      "include": ["refs/heads/main"]
    }
  },
  "rules": [
    {
      "type": "deletion"
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "require_extra_approval_for_unattributed_changes": true,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          {
            "context": "verify",
            "integration_id": 15368
          },
          {
            "context": "scan + cobertura",
            "integration_id": 15368
          }
        ]
      }
    },
    {
      "type": "update"
    }
  ],
  "node_id": "RRS_lACqUmVwb3NpdG9yec5Oqd2QzgFzThk",
  "created_at": "2026-10-01T17:56:27.008-03:00",
  "updated_at": "2026-10-01T18:31:58.078-03:00",
  "bypass_actors": [],
  "current_user_can_bypass": "never",
  "_links": {
    "self": {
      "href": "https://api.github.com/repos/Douglas0101/preco-que-da-lucro/rulesets/24333849"
    },
    "html": {
      "href": "https://github.com/Douglas0101/preco-que-da-lucro/rules/24333849"
    }
  }
}
```

Merge normal rejeitado:

```json
{
  "observedAt": "2026-10-01T21:41:15Z",
  "headSha": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
  "mainBefore": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "mainAfter": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "freezeRulesetId": 24333849,
  "updateRulePresent": true,
  "bypassActors": [],
  "currentUserCanBypass": "never",
  "exitCode": 1,
  "response": "{\"message\":\"Repository rule violations found\\n\\nA conversation must be resolved before this pull request can be merged.\\n\\nRequired status check \\\"verify\\\" is cancelled.\\n\\nCannot update this protected ref.\\n\\n\",\"documentation_url\":\"https://docs.github.com/rest/pulls/pulls#merge-a-pull-request\",\"status\":\"405\"}",
  "diagnostic": "gh: Repository rule violations found\n\nA conversation must be resolved before this pull request can be merged.\n\nRequired status check \"verify\" is cancelled.\n\nCannot update this protected ref.\n\n (HTTP 405)"
}
```

Runs/annotations e PRs atuais:

```json
{
  "runs": [
    {
      "id": 36928472369,
      "name": "CI light (docs/evidence)",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472369",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    },
    {
      "id": 36928472633,
      "name": "Neon PR branch CI",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "failure",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472633",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    },
    {
      "id": 36928472488,
      "name": "SonarCloud (scanner + cobertura)",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472488",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    },
    {
      "id": 36928472435,
      "name": "UI stack",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "cancelled",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928472435",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    },
    {
      "id": 36928460215,
      "name": "CI light (docs/evidence)",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928460215",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    },
    {
      "id": 36928460220,
      "name": "UI stack",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36928460220",
      "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94"
    }
  ],
  "prVerify": {
    "id": 36928472435,
    "head_sha": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
    "status": "completed",
    "conclusion": "cancelled",
    "updated_at": "2026-10-01T21:37:22Z"
  },
  "browserInstall": [
    {
      "name": "Run npx playwright install --with-deps chromium firefox webkit",
      "started_at": "2026-10-01T21:27:39Z",
      "completed_at": "2026-10-01T21:37:19Z",
      "conclusion": "cancelled"
    },
    {
      "name": "Run npx playwright test --project=chromium --project=firefox --project=webkit --project=mobile",
      "started_at": "2026-10-01T21:37:19Z",
      "completed_at": "2026-10-01T21:37:19Z",
      "conclusion": "skipped"
    }
  ],
  "timeoutAnnotations": [
    {
      "annotation_level": "failure",
      "message": "The job has exceeded the maximum execution time of 12m0s"
    },
    {
      "annotation_level": "failure",
      "message": "The operation was canceled."
    }
  ],
  "vercelStatuses": [
    {
      "context": "Vercel – preco-que-da-lucro",
      "state": "failure",
      "description": "Deployment has failed — run this Vercel CLI command: npx vercel inspect dpl_2gBDcZPxRZSdDRWUGM8guDoALoBp --logs",
      "target_url": "https://vercel.com/douglas-dias-de-souzas-projects/preco-que-da-lucro/2gBDcZPxRZSdDRWUGM8guDoALoBp",
      "updated_at": "2026-10-01T21:24:34Z"
    }
  ],
  "openPRs": [
    {
      "baseRefName": "main",
      "headRefName": "develop",
      "headRefOid": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
      "number": 60,
      "title": "fix(ci): enforce release checks and restore coverage guard integrity"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/npm_and_yarn/vercel/analytics-2.0.1",
      "headRefOid": "8285312dda617b51788ef1c0b3c10965e917db95",
      "number": 57,
      "title": "chore(deps): bump @vercel/analytics from 1.6.1 to 2.0.1"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/npm_and_yarn/multi-7f19880bf6",
      "headRefOid": "7c24df54f32cf2d9436473c6592554878fddcabb",
      "number": 56,
      "title": "chore(deps): bump react and @types/react"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/npm_and_yarn/tailwind-merge-3.7.0",
      "headRefOid": "1070bb98b32fb97a956f6d7bca82d6aadfd65d27",
      "number": 55,
      "title": "chore(deps): bump tailwind-merge from 3.6.0 to 3.7.0"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/npm_and_yarn/testing-library/user-event-14.6.7",
      "headRefOid": "4d42135545b717968c6ae272a77bc275ef0704f1",
      "number": 54,
      "title": "chore(deps-dev): bump @testing-library/user-event from 14.6.6 to 14.6.7"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/npm_and_yarn/tanstack/react-router-1.170.40",
      "headRefOid": "b2ae9d5dcdb4872b5be61a3c4f5f195ac9f69bd9",
      "number": 53,
      "title": "chore(deps): bump @tanstack/react-router from 1.170.32 to 1.170.40"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/github_actions/neondatabase/create-branch-action-6.4.0",
      "headRefOid": "f39f4751b2d97083fad8b89c410f604081cc049d",
      "number": 52,
      "title": "chore(deps): bump neondatabase/create-branch-action from 6.3.1 to 6.4.0"
    },
    {
      "baseRefName": "main",
      "headRefName": "dependabot/github_actions/actions/cache-6.1.0",
      "headRefOid": "d08b7621bba0dc18d4fc5f939ccc0cdeefa28763",
      "number": 51,
      "title": "chore(deps): bump actions/cache from 4.3.0 to 6.1.0"
    }
  ]
}
```

Custódia e selos por revisão:

```json
{
  "observedAt": "2026-10-01T21:45:06.725760+00:00",
  "historicalSeals": 11,
  "hashesChecked": 42,
  "sealFailures": [],
  "custodyFiles": 929,
  "custodyDifferences": [],
  "sourceHead": "48ffb6bb8106c78781416ffd49fa8a906985f174"
}
```
