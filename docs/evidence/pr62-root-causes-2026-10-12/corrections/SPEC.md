# PR #62 — correções DBT-104/105/106 (S1)

- Data: 2026-10-12.
- Revisão de origem: `63efb76ebf8218d46bc0a766fc2f670bbf5cd5f1` em develop; main `40c1a35577c70c7d33424640648d52bfdedb8bde`.
- Autorização: pedido humano de implementação desta sessão, após a investigação. Escolha entre as opções explicitamente delegada; escolhida NOT_APPLICABLE apenas sob prova de ausência de delta no escopo. Nenhuma autorização para push, merge ou deploy.

## Fato-fonte

`docs/evidence/pr62-root-causes-2026-10-12/REPORT.md` §§1–3; registry `docs/evidence/agent-state/DEBTS.md`, DBT-104/105/106; run 38197746621 e journal L833–L839.

## Problema

- DBT-104: `scripts/sonar/main-baseline.mjs` exige `ceReadout()` incondicionalmente; consumidores PR anterior ao scanner e espelho separado não têm o arquivo. `GATE_READOUT_UNAVAILABLE` é determinístico.
- DBT-106: `scripts/sonar/lcov-provenance.ts` lê `gate.analysisId`/`gate.ceTaskId` mesmo no relatório NO-VERDICT com identidade validada em providerObservation. `LCOV provenance unavailable or unsealed` mascara a causa.
- DBT-105: CE OK com quatro controles, sem coverage/duplication, num PR sem arquivos alterados em src fora de src/test. A política existente recusa corretamente a evidência faltante; uma decisão explícita de aplicabilidade é necessária.

## Contrato

1. Baseline: três chamadas descobertas no workflow, modos obrigatórios `observe-main` (PR e espelho) e `post-ce-main` (pós-CE main). Ambos vinculam análise mais recente à revisão main e reconfirmam SHA/análise após medir. Apenas post-ce-main exige o próprio CE; re-execução com histórico da mesma revisão continua válida. Modo ausente/desconhecido ou identidade incompleta recusa.
2. Selo: normalização estrita dos relatórios root OK/ERROR e NO-VERDICT/providerObservation; identidade/revisão/superfície conferidas. Selar observação não aprova release, não altera o relatório e não fabrica IDs. Identidade ausente/ambígua recusa com código nomeado.
3. Aplicabilidade: ADR-044 autoriza NOT_APPLICABLE apenas para PR develop→main cuja lista completa de mudanças é obtida de Git imutável, vinculada ao evento e checkout e ao escopo efetivo do scanner. Qualquer caminho de fonte afetado (inclusive exclusão/renomeação) mantém ADR-042. Histórico raso, revisão/evento/escopo ilegível ou divergente, lista vazia, estado alterado e controles ignorados continuam NO-VERDICT. Main nunca recebe NOT_APPLICABLE. Coverage não recebe número; duplicação igualmente sem delta é explicitamente inaplicável. Ratings/hotspots e todas as condições ERROR permanecem veto.

## Mudanças

Conjunto planejado e fechado: `scripts/sonar/main-baseline.mjs`, `scripts/sonar/main-baseline-select.ts`, `.github/workflows/sonar.yml`, novo parser `scripts/sonar/readout-evidence.ts`, `scripts/sonar/lcov-provenance.ts`, novo `scripts/sonar/pr-applicability.ts`, `scripts/sonar/gate-readout.ts`, `scripts/lib/m02-ci-coverage.ts`, testes correspondentes em `src/test`, ADR-044, AGENTS.md, registry/handoff e este pacote. Catálogo real de consumidores deve ser reconciliado por descoberta antes de concluir.

Não mudam: escopo src/exclusão src/test, mínimo60, condições restantes, budgets/tiers/matriz, dependências/manifests, dados/infraestrutura/segredos, preservação dos relatórios originais da investigação. Qualquer necessidade adicional é registrada antes da mutação.

## DoD

- Comandos pré-registrados: `npm run test -- src/test/main-baseline-cli.test.ts src/test/main-baseline-select.test.ts src/test/sonar-readout-evidence.test.ts src/test/main-unit-adapter.test.ts src/test/sonar-gate-readout.test.ts src/test/sonar-pr-applicability.test.ts src/test/m02-ci-coverage.test.ts` e `npm run check`.
- Testes de CLI executam o script real nas três chamadas descobertas, com API fixture sem rede/credenciais, e conferem identidade/artefato/requests, não apenas exit.
- Testes de aplicabilidade constroem repositórios/eventos próprios; provam negativos de fonte alterada/excluída/renomeada, revisão/escopo/clone/estado e fronteiras60; teste do readout CLI preserva raw CE + política específica + exit.
- RED usa bytes do pai por export Git e asserts de hashes, sem mutação da bancada principal; diferenças esperadas identificam caso/sintoma. Capturas de GREEN, gate, hashes e manifestos não vazios.
- README/S5 declara checklist17 item a item, limites CI/S6 e status real. Sem run novo não existe closure remota nem selo final aprovado. Não há autorização atual para publicar a revisão.

## Testes

Positivos: observação PR/espelho sem readout, own-CE main com histórico duplicado, root e NO-VERDICT com IDs preservados, PR sem arquivos no escopo com quatro controles restantes, cobertura elegível60/80 e main ≥60.

Negativos: modo ausente/incorreto, SHA/análise trocados antes/depois, transporte/contadores nulos, CE estranho/ausente, IDs root/nested ambíguos, fonte/revisão/sensor divergente; PR com qualquer fonte elegível sem métricas, prova forjada/desatualizada/incompleta, scanner sem escopo comprovável, clone raso, ratings/hotspots ERROR, ignoredConditions, main sem cobertura e59.99. Os bytes do pai devem reproduzir os dois defeitos de contrato e rejeitar o PR sem delta por sua política antiga, sem atribuir-lhe verde.

## Riscos

- ScannerContext real pode não expor a configuração necessária: recusa segura; fixture não prova a disponibilidade remota.
- Baseline read-only exige uma análise atual de main; uma análise antiga é precondição, nunca fallback.
- Espelho pode continuar NO-VERDICT por falta histórica verificada de proveniência ou falhar por outros controles. Não alteramos sua classificação para forçar verde.
- S6 independente e novo CI ainda não existem; não serão declarados PASS por testes locais. DBT-104/105/106 não são fechadas sem seus closure tests remotos.
- Mudanças fora de src permanecem sem análise estática Sonar conforme ADR-035, mas todos os gates locais/CI permanecem.

## Rollback

Reverter por commit ordinário em develop, mantendo evidência e registrando errata. Não reescrever história publicada, não mover main nem estado de produção; retirar a política ADR-044 restaura NO-VERDICT para PR sem delta e o comportamento pós-CE anterior. Não modificar testes/regras para fabricar verde.

## Autorização ulterior e precondição de publicação (2026-10-12T04:52Z)

O texto acima registra a autorização de implementação no momento do S1. Depois do GREEN local, o dono escolheu explicitamente **Commit + push develop** na pergunta estruturada, autorizando commit ordinário e publicação somente em develop para obter CI novo. Main/merge/deploy/SQL/bypass continuam fora do escopo. Antes do commit, acrescentar bloco parent-pinned em `EXECUTION-STATE-PROGRAM.md`: a folga atual é13/13 e o próximo commit a excederia; o orçamento13 permanece inalterado. Reconfirmar o gate completo e conservar seus bytes/capturas. Nenhuma dessas ações fecha dívidas ou substitui CI/S6.

## Segunda rodada — run 38206302116 (2026-10-12)

**Fato-fonte.** A revisão publicada `d90f8f5` (commit das correções acima) produziu o run `38206302116`. O job `scan + cobertura` (`114670429042`, passo «Nomear veredito do CE desta análise») saiu 2 com `gate aplicabilidade indisponível: NO-VERDICT (PR_EVENT_IDENTITY_DIVERGENT)`: o checkout/analisado do runner é o commit sintético de test-merge `ee4616d81db263456c7b312d243cc08dafae40b4` de `d90f8f5` em `40c1a355`, e a prova ADR-044 exigia o campo volátil `merge_commit_sha` do payload. O job `main-coverage-mirror` (`114671097630`, passo «Observe the conservative mirror…») saiu 1 porque o readout do CE candidato veio NO-VERDICT (IDs aninhados) e `mirror-runner.ts` lia `gate.analysisId`/`gate.ceTaskId` na raiz (segundo sítio de DBT-106) → `EXECUTION_OR_UNCLASSIFIED` → `observation: null` → FAILURE. Os artefatos brutos ficam em `captures/run-38206302116/` (bytes byte-a-byte, selados no `.prettierignore` e nunca reformatados).

**Mudanças (conjunto fechado).** `scripts/sonar/pr-applicability.ts` (duas formas de checkout provadas por objetos Git, `analyzedShape`, recusas nomeadas, diff até a revisão analisada), `scripts/sonar/mirror-runner.ts` (`candidateGate()` sobre o parser estrito, recusa nomeada `CANDIDATE_READOUT_UNAVAILABLE`, diagnóstico de fase), `src/test/sonar-pr-applicability.test.ts`, `src/test/main-unit-adapter.test.ts`, `docs/adr/ADR-044-aplicabilidade-pr-sem-delta-analisavel.md` (emenda), `AGENTS.md`, `docs/evidence/agent-state/DEBTS.md` (DBT-104/105/106 + DBT-107), este pacote. Nada mais.

**Contrato.** (1) Nenhuma checagem de identidade usa `merge_commit_sha` do payload: a forma do analisado é provada por pais/árvore do objeto Git e testemunhada por `GITHUB_SHA`; (2) readout NO-VERDICT preservado não fornece identidade de CE para o espelho — a ausência é recusa nomeada e bloqueante, sem crédito; (3) nenhuma métrica é inventada e nenhuma dívida é declarada fechada por teste local.

**DoD (pré-registrado).** `npm run test -- src/test/main-baseline-cli.test.ts src/test/main-baseline-select.test.ts src/test/sonar-readout-evidence.test.ts src/test/main-unit-adapter.test.ts src/test/sonar-gate-readout.test.ts src/test/sonar-pr-applicability.test.ts src/test/m02-ci-coverage.test.ts`; `npm run typecheck`; `npx eslint` nos arquivos alterados; `npm run check`; capturas `round2-tests.txt`, `round2-check.txt`, `round2-source-fingerprint.json`, `run-38206302116/*`, `run-38112535521/main-lcov-artifact.txt`; README com checkpoint 2 e checklist atualizado; nenhuma publicação sem nova autorização.

**Riscos.** A forma `head` aceita um checkout que não é test-merge — mitigado exigindo `revision === head.sha` e `GITHUB_SHA` igual. O caminho informativo do espelho depende de ausência real de proveniência original na origem (provada em `run-38112535521/main-lcov-artifact.txt`), nunca de leitura impossível.

## Terceira rodada — run 38259113709 (2026-10-12)

**Fato-fonte.** A revisão publicada `d8f77f93d48cbde3d999ba311f8e4050c2595cc0` (rodada 2) produziu o run `38259113709`. `verify-release`, `verify`, Neon, cleanup, light e o check do provedor ficaram verdes; o check EXIGIDO `scan + cobertura` (job `114844760543`) saiu exit 2 com `C25_CE_GATE` status NO-VERDICT e razão `gate aplicabilidade indisponível: NO-VERDICT (PR_WORKTREE_DIRTY)` — a prova ADR-044 mede worktree git-limpo e o próprio passo do scanner estagia `.scannerwork/report-task.txt` dentro do checkout antes do readout, enquanto o `.gitignore` real não declarava `.scannerwork/` (a fixture de `src/test/sonar-pr-applicability.test.ts` declarava: divergência fixture×realidade). O `main-coverage-mirror` (job `114845837000`) saiu exit 1 com `CANDIDATE_READOUT_UNAVAILABLE` — cascata por desenho: o readout candidato é NO-VERDICT e o classificador só reconhece NO-VERDICT informacional em `ORIGINAL_PROVENANCE_UNAVAILABLE`/`SOURCE_DIVERGENCE_MAIN_VS_CANDIDATE`; o adapter já classificava informacional (`c29` observation). Artefatos brutos em `captures/run-38259113709/` (9 JSON + `logs.txt`).

**Mudanças (conjunto fechado).** `.gitignore` (declara `.scannerwork/`), `src/test/sonar-pr-applicability.test.ts` (guarda de acoplamento workflow×ignore, com controle negativo), `docs/adr/ADR-044-aplicabilidade-pr-sem-delta-analisavel.md` (terceira emenda), `AGENTS.md`, `docs/evidence/agent-state/DEBTS.md` (DBT-108), este pacote. Nada mais: nenhuma alteração de política, escopo, métrica, orçamento, workflow ou teste existente.

**Contrato.** (1) O estagiamento do pipeline dentro do checkout é declarado ignorado, como `coverage/`; (2) a guarda exige descoberta não vazia e que todo caminho `$PWD/**` do `sonar.yml` real passe por `git check-ignore`, com controle negativo que mostra o comando distinguindo um caminho não declarado; (3) fonte ignorada sob `src`, untracked e dirty de fonte continuam recusados; (4) nenhuma dívida fecha por teste local e nenhum crédito de cobertura é criado.

**DoD (pré-registrado).** `npm run test -- src/test/sonar-pr-applicability.test.ts`; as sete suítes da rodada 2 (mesmo conjunto) para regressão; `npm run check`; capturas `round3-guard-red.txt`, `round3-guard-green.txt`, `round3-tests.txt`, `round3-check.txt`, `round3-source-fingerprint.json`, `run-38259113709/*`; README atualizado; nenhuma publicação sem nova autorização.

**Riscos.** A guarda depende da sintaxe `$PWD/<path>` do workflow — um refactor para outra forma de estagiamento exige atualizar a guarda por decisão (fail-closed, nunca silencioso). O espelho continua podendo reprovar por outro controle, que não será suavizado; a ausência de proveniência original de main é histórica e re-verificada no produtor, nunca presumida.

**Aceite remoto (2026-10-12, run 38270836613).** Na revisão publicada `1f559ff47dfc274f7e631337e479b7ab6ad2ee88`, o run fechou success nos dois jobs: `scan + cobertura` com `C25_CE_GATE` `OK` e `releasePolicy.status=NOT_APPLICABLE` (ADR-044; cobertura/duplicação `null`, quatro controles preservados) e o espelho informacional (`NO-VERDICT`, `ORIGINAL_PROVENANCE_UNAVAILABLE`, `approvesMain:false`); o PR #62 ficou MERGEABLE/CLEAN com 12/12 checks success, sem threads abertas. O closure test da DBT-108 está satisfeito por esta observação; a promoção de status no registry é do MAESTRO, que também decide sobre DBT-104/105/106/107, cujas condições remotas ficaram observadas nesta mesma run.
