# PR #62 — DBT-104/105/106, checkpoint local S5 (não é selo final)

## 1. Fato-fonte e autorização

`SPEC.md` pré-registra o trabalho; `../REPORT.md` contém a investigação do run38197746621. Pedido humano de 2026-10-12 autorizou implementação e escolha da política, não push/merge/deploy. Origem: develop `63efb76ebf8218d46bc0a766fc2f670bbf5cd5f1`; main `40c1a35577c70c7d33424640648d52bfdedb8bde`. Código ainda é um delta local da origem, não uma revisão publicada. DBT-104/105/106 continuam ABERTAS até seus closure tests remotos; DBT-103 não é fechado por esta correção.

## 2. Delta implementado

- Baseline: `--mode observe-main` nos consumidores PR e espelho, `--mode post-ce-main` no pós-CE main. Sem fallback de modo. Observação independe do readout local, mas exige análise mais recente da revisão exata de main e reconfirma SHA/análise/data depois de medir; pós-CE conserva o analysisId do próprio run e tolera histórico repetido da mesma revisão. A baseline declara `approvesMain: false`. Discovery do workflow conhece exatamente os três sítios identificados e recusa quarto consumidor ou troca de modo.
- Selo LCOV: `readout-evidence.ts` valida schema, status, IDs, revisão e superfície root OK/ERROR ou NO-VERDICT/providerObservation. Layout misto/ausente/ilegível recebe recusa nomeada. Extração não altera o relatório; `approvesRelease: false`. CLI real prova selo de instrumentação válido mesmo com NO-VERDICT, nunca aprovação de release, e mantém ausência de arquivo em recusas.
- Aplicabilidade: ADR-044 escolhe NOT_APPLICABLE somente para PR develop→main sem fonte afetada no escopo comprovado. Git/evento/CE/scannerContext precisam concordar e estar completos; mudanças são enumeradas sem ocultar exclusões/renomeações. Toda fonte sob src fora de src/test é conservadoramente elegível. Prova in-process congelada e vinculada ao CE; lista vazia, falta de contexto, Git raso/sujo ou identidade divergente é NO-VERDICT. Coverage/duplicação continuam null, ratings/hotspots e controles ERROR permanecem bloqueantes. Elegíveis/main seguem ADR-042>=60, sem exceção de20linhas.
- Não foram alterados escopo/quotas, dependências, métricas brutas, budgets/tiers/matriz, rulesets, banco, destinos de publicação ou credenciais. AGENTS.md e o registry registram os contratos atuais.

## 3. Gate → captura → veredito

| Gate                                                          | Captura                                                      | Veredito                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RED por exportação Git dos bytes da origem e assert de SHA256 | `captures/red-parent.txt` + `captures/red-parent-source.txt` | PASS da reprodução: dois CLI contexts antigos recusam GATE_READOUT_UNAVAILABLE; política antiga recusa dois controles; selo antigo recusa layout preservado. Controle de normalização GREEN não altera NO-VERDICT. |
| Baseline/selo, CLIs reais e auditoria dos consumidores        | `captures/baseline-and-seal-tests.txt`                       | 180/180 PASS e typecheck PASS na fase anterior.                                                                                                                                                                    |
| Aplicabilidade, runtime CLI/eventos/Git e fronteiras60        | `captures/applicability-tests.txt`                           | 96/96 PASS e typecheck PASS na fase anterior.                                                                                                                                                                      |
| Conjunto integrado pré-registrado, sete suítes                | `captures/all-targeted-tests.txt`                            | 228/228 PASS e typecheck PASS em 2026-10-12T04:28:11Z.                                                                                                                                                             |
| Gate local completo                                           | `captures/check-local.txt`                                   | PASS: npm run check exit0, 145 suítes PASS +1 skip existente, 2266 testes PASS +18 skips existentes; guardas/format/lint/typecheck/build/bundle verdes. Captura iniciada em 2026-10-12T04:36:14Z.                  |
| S6 independente, contexto limpo                               | Não há captura nem execução                                  | PENDENTE; não é UNVERIFIABLE nem alegação de 0 REJECTED.                                                                                                                                                           |
| CI atual na revisão corrigida                                 | Não há revisão publicada/run novo                            | PENDENTE de autorização para publicar develop; nenhum run antigo prova esta revisão.                                                                                                                               |

Primeiro gate completo interrompido em duas violações no-regex-spaces no teste de descoberta (`captures/check-local-first-attempt.txt`). Quantificadores {2}/{6} substituíram espaços repetidos, sem modificar comportamento ou a regra de lint; a nova execução completa terminou verde, com a recusa inicial preservada.

As falhas de desenvolvimento do harness não foram apagadas: `captures/baseline-and-seal-first-attempt.txt`, `captures/applicability-tests-first-attempt.txt`, `captures/applicability-cli-diagnostic.txt`. Causas: it.each desempacotou argv vazio e um código esperado não distinguia own-CE; mkdir de diretório existente e parêntese excedente em preload. Os casos de produto permanecem e os negativos não foram removidos.

Verificações adicionais (`captures/audit-and-lcov-path.txt`, 2026-10-12T04:43:31Z): `npm run sonar:lcov-path` PASS (propriedades/workflow/test:coverage concordam em coverage/lcov.info); `npm audit --audit-level=high` PASS, **0 vulnerabilidades**.

## 4. Identidade e materialidade

`captures/source-fingerprint.json` registra a origem e os SHA256 dos arquivos de código/contrato/teste corrigidos. `MANIFEST.sha256` liga SPEC, README e todas as capturas não vazias pelos bytes finais; não inclui a si próprio. O manifesto/checkpoint não autoriza release nem substitui o selo final com commit/CI/S6. Manifesto da investigação pai conserva seus bytes originais. `captures/parent-manifest-check.txt` verifica os16 arquivos históricos a partir da raiz do repositório: a primeira invocação usou cwd incorreto e recusou abrir os caminhos, sem alterar os bytes; a invocação corrigida passou.

As fixtures possuem Git/eventos próprios e API fechada, sem usar produção, rede real ou credenciais operacionais. O selo CLI intercepta **somente no subprocesso** a leitura do caminho fixo do scanner log; não escreve `/tmp/scanner.log` nem compartilha estado entre workers. O contexto/evento e os corpos de erro carregam sentinelas privadas que não podem aparecer nos relatórios/logs. Capturas0600, processo umask022 preserva as precondições de fixtures Debian.

## 5. Auto-verificação pré-S6 — checklist anti-vacuoso

| #   | Item                            | Demonstração / captura                                                                                          | Estado     |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Controle negativo               | RED nos mesmos bytes identificados da origem; GREEN atual por CLI/unit, report e digest                         | PASS local |
| 2   | Fronteira nas duas direções     | Fonte modificada/adicionada/excluída/renomeada, fora/dentro de src;59.99/60/80 para PR/main                     | PASS local |
| 3   | Identidade, não cardinalidade   | Três consumidores descobertos e identificados, SHA/analysis/date/period/source/LCOV e evento/merge conferidos   | PASS local |
| 4   | Proibido exit-code-only         | CLIs assertam reports, requests, paths, IDs, source hashes, raw status e arquivo ausente em recusa              | PASS local |
| 5   | Proibido sleep fixo             | Nenhum sleep; fetch fixtures fechado, deadlines absolutos e processos bounded                                   | PASS local |
| 6   | Sem identidade degenerada       | Repositórios/commits reais nas fixtures; lista vazia, SHAs curtos/IDs ausentes rejeitados; sentinelas diversas  | PASS local |
| 7   | Estado compartilhado explícito  | Cada caso possui temp/Git/RUNNER_TEMP próprios; log do scanner interceptado por filho, não globalmente alterado | PASS local |
| 8   | Sentinela por cenário           | Campos privados de contexto/evento/API não persistem; SHA/digest/superfície variam nos negativos                | PASS local |
| 9   | Fingerprint de revisão          | Exportação Git com hash assertado; fingerprint dos arquivos corrigidos e da prova completa de PR                | PASS local |
| 10  | checked === discovered          | Auditoria recusa quarto consumidor, caller removido/trocado; lista de mudanças vazia recusa                     | PASS local |
| 11  | S6 de contexto limpo            | Não há revisor independente nem veredito nesta execução; não usar este checklist como revisão                   | PENDENTE   |
| 12  | Falha alta/fail-closed          | Modo/refs/revisão/corrida/transporte/contador/contexto/controle/identidade ilegíveis recusam com exit2          | PASS local |
| 13  | Isolamento de bancada           | Fixture local, endpoint fechado/token fictício, sem chamadas de banco nem autoridade de produção                | PASS local |
| 14  | Check impresso com gate+captura | Tabela acima e logs registram comando, timestamp e origem, com status explícito                                 | PASS local |
| 15  | CI atado ao commit selado       | Ainda não há commit publicado nem CI atual; verify antigo não é delegado para bytes novos                       | PENDENTE   |
| 16  | Descoberta multi-sítio          | Workflow PR antes scanner/main pós-CE/espelho; parser compartilhado por baseline e sealer; mutantes dos sítios  | PASS local |
| 17  | Precondição ambiente            | Runtime exige Git completo/limpo/evento/checkout/escopo; fixtures próprias não dependem do estado externo       | PASS local |

KPI provisório: **15/17 demonstrados localmente pelo autor**, dois pendentes nomeados (S6 e CI). Isso não é KPI de review nem selo aprovado; qualquer falha do gate completo mantém o checkpoint em andamento.

## 6. Limites e próximos passos

- CI novo só após autorização explícita de push em develop e verificação do SHA/run/attempt. Sem isso não se fecha o aceite remoto. Main/merge/deploy continuam sem autorização.
- O serviço real precisa entregar scannerContext com o escopo exato. Falta de contexto recusa; fixture não garante disponibilidade da API.
- Baseline precisa de análise atual de main. Mirror pode continuar sem crédito por falta histórica de proveniência original, ou falhar por outro controle. Não se fabricou evidência original, nem se suavizou seu classificador.
- S6 independente continua pendente, verificável por ausência de review/artefato; não é inverificabilidade de princípio. Nenhum sub-item do placar foi promovido.
- DB/audit/e2e da revisão corrigida não são provados pelo gate local. Nenhum teste ou budget foi alterado para produzir verde.

## 7. Taxonomia e correções

**CORR = não medido; N = não medido; correções forçadas S6 = não medidas**: S6 não executado, portanto não publicar zeros fictícios. As quatro correções de harness capturadas pelo autor são verificações internas, não achados de S6. Riscos declarados constam da §6; não há REJECTED promovido como PASS.

## Autorização posterior ao checkpoint

Em 2026-10-12T04:52Z o dono autorizou explicitamente **Commit + push develop** para gerar CI novo. As referências acima a autorização pendente descrevem o checkpoint local anterior; a autorização atual não inclui main, merge, deploy, SQL, bypass ou fechamento sem evidência. Bloco aditivo parent-pinned em EXECUTION-STATE-PROGRAM.md e nova execução completa precedem o commit. `captures/source-fingerprint.json` continua sendo a identidade dos15 arquivos de implementação, todos inalterados desde o GREEN; o marcador aditivo é metadado de estado e recebe identidade no recibo pré-publicação. CI e S6 seguem pendentes até observar execução atual. Reconfirmação pré-push: `captures/pre-push-check.txt`, npm run check exit0/2266 PASS/18 skips existentes, audit high0 e LCOV-path PASS; `captures/publication-preconditions.json` conserva autorização, refs e hash do marker aditivo. O marcador é válido0/13 antes do commit e deverá ficar1/13 depois, sem mudança do orçamento.

## 8. Rollback

Commit ordinário de reversão em develop, preservando evidência e errata. Não mover main, reescrever história ou modificar produção. Remover ADR-044 restaura a recusa estrita por controles ausentes; a correção de identidade não dá crédito de release.

## 9. Segunda rodada — checkpoint local (run 38206302116)

O run 38206302116 mediu a revisão publicada `d90f8f5` e reprovou os dois jobs do Sonar. Fato, causa e correção:

| job / passo                                  | medição                                                   | causa                                                                                            | correção                                                                                                      |
| -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `scan + cobertura` 114670429042 passo 10     | exit 2, `PR_EVENT_IDENTITY_DIVERGENT`                     | a prova ADR-044 exigia `merge_commit_sha` do payload; o checkout real é o test-merge `ee4616d8…` | duas formas provadas por objetos Git; diff até a revisão analisada; recusas nomeadas                          |
| `main-coverage-mirror` 114671097630 passo 11 | exit 1, `EXECUTION_OR_UNCLASSIFIED` → `observation: null` | segundo sítio de DBT-106: `gate.analysisId` lido na raiz de um readout NO-VERDICT                | `candidateGate()` usa o parser estrito; NO-VERDICT preservado vira `CANDIDATE_READOUT_UNAVAILABLE` bloqueante |

Checkpoint 2 (medido localmente nesta revisão ainda não publicada): 7 suítes pré-registradas → **234/234 PASS** (`captures/round2-tests.txt`); `typecheck`, `eslint` e `npm run check` → `captures/round2-check.txt`; identidade dos arquivos da rodada → `captures/round2-source-fingerprint.json`; artefatos brutos do run 38206302116 → `captures/run-38206302116/` (9 JSON, bytes brutos selados no `.prettierignore`, nunca reformatados); prova de ausência de proveniência original na run de main → `captures/run-38112535521/main-lcov-artifact.txt`.

A primeira tentativa do gate completo foi recusada pelo `format:check` nos três JSON brutos do provedor; os bytes foram preservados sem reformatação e o subdireção foi selada no `.prettierignore` (captura da recusa em `captures/round2-check-first-attempt.txt`).

Checklist 17: itens 1–10 e 12–14, 16–17 seguem PASS local com os nomes atualizados; item 11 (S6 de contexto limpo) e item 15 (CI atado ao commit selado) continuam **PENDENTE** — agora com duas medições remotas reprovadas (38197746621 e 38206302116) que _são_ o fato-fonte das correções, não verificação do estado atual. KPI provisório 15/17 (nenhuma promoção nesta rodada).

Limites: nada nesta captura prova que o run corrigido ficará verde; o aceite remoto exige nova publicação autorizada. DBT-104/105/106 permanecem ABERTAS e DBT-107 foi aberta para o defeito de identidade de checkout; S6 independente continua pendente.

## 10. Nota de reprodutibilidade da fingerprint

A fingerprint da rodada 1 (`captures/source-fingerprint.json`) foi produzida por um cálculo ad hoc cujo script não ficou versionado. A rodada 2 grava o algoritmo dentro da própria captura `round2-source-fingerprint.json` (`sha256DaFingerprint = sha256(concatenação ordenada de "caminho" + " " + sha256(bytes) + "\n")`), para que qualquer reexecução seja verificável sem depender de memória.

## 11. Terceira rodada — checkpoint local (run 38259113709)

O run 38259113709 mediu a revisão publicada `d8f77f93d48cbde3d999ba311f8e4050c2595cc0` (rodada 2) e reprovou os dois jobs do Sonar; os demais checks ficaram verdes (`verify-release`, `verify`, Neon, cleanup, light e o check do provedor).

| job / passo                                  | medição                                                       | causa                                                                                                                                                                                                  | correção                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `scan + cobertura` 114844760543 passo 10     | exit 2, `C25_CE_GATE` NO-VERDICT `PR_WORKTREE_DIRTY`          | o passo do scanner estagia `.scannerwork/report-task.txt` DENTRO do checkout antes do readout; o `.gitignore` real não declarava `.scannerwork/` (a fixture declarava — divergência fixture×realidade) | `.scannerwork/` declarado ignorado; guarda pina todo caminho `$PWD/**` do `sonar.yml` contra as regras de ignore |
| `main-coverage-mirror` 114845837000 passo 11 | exit 1, `CANDIDATE_READOUT_UNAVAILABLE` → `observation: null` | cascata por desenho: o readout candidato é NO-VERDICT e o classificador só reconhece NO-VERDICT informacional em `ORIGINAL_PROVENANCE_UNAVAILABLE`/`SOURCE_DIVERGENCE_MAIN_VS_CANDIDATE`               | nenhuma mudança de código no espelho: corrigido o readout candidato, o adapter volta a classificar informacional |

Checkpoint 3 (medido localmente nesta revisão ainda não publicada): RED do acoplamento → `captures/round3-guard-red.txt` (o teste novo reprova nomeando `.scannerwork/report-task.txt`, com os demais 49 passando); GREEN → `captures/round3-guard-green.txt` (`git check-ignore` exit 0, nenhuma entrada do scannerwork visível no `git status --porcelain`, 50/50 PASS); sete suítes pré-registradas → `captures/round3-tests.txt`; `npm run check` → `captures/round3-check.txt`; identidade dos arquivos da rodada → `captures/round3-source-fingerprint.json`; artefatos brutos do run → `captures/run-38259113709/` (9 JSON + `logs.txt`, selados no `.prettierignore`, nunca reformatados).

A primeira execução final do gate foi recusada pelo `m02:temporal-guard` por uma âncora hex não resolvível na prosa viva (`30ca04baaa66`, digest de bundle, na §1 do journal) — o guard funcionando: o conserto foi remover a âncora da §1 do journal, preservar a captura integral em `captures/round3-check-first-attempt.txt` e reexecutar o gate verde.

A terceira emenda da ADR-044 registra a classe do defeito — **fixture que declara uma precondição diferente do repositório real é medição divergente** — e a ADR/AGENTS descrevem o contrato novo: o estagiamento do pipeline no checkout é declarado ignorado e pinado por teste. DBT-108 aberta com closure test remoto (run atual com `scan + cobertura` verde, readout `OK` + `releasePolicy NOT_APPLICABLE`, e espelho informacional). A thread de review do Codex (`scripts/sonar/main-baseline.mjs`, P1, achada em `63efb76`) foi respondida e **resolvida** com a evidência do split de modos observado nos dois jobs deste run (`observe-main` sem readout), citando DBT-104 e a causa independente do check. Checklist 17: itens 1–10 e 12–14, 16–17 seguem PASS local; itens 11 (S6 de contexto limpo) e 15 (CI atado ao commit selado) continuam **PENDENTE** — as três medições remotas reprovadas (38197746621, 38206302116, 38259113709) são o fato-fonte das correções, não verificação do estado atual. KPI provisório 15/17 (nenhuma promoção nesta rodada).

**Aceite remoto observado (run 38270836613, head `1f559ff`).** Com a correção publicada, o run fechou **success** nos dois jobs: `scan + cobertura` com `C25_CE_GATE` status `OK` e `releasePolicy.status=NOT_APPLICABLE` (`policy=ADR-044/pr-no-analyzed-delta`, cobertura/duplicação `null`, quatro controles preservados) e `main-coverage-mirror` com `observation: NO-VERDICT`, `outcome: INFORMATIONAL`, `approvesMain:false` (recusa por ausência histórica verificada de proveniência original de main). O PR #62 ficou **MERGEABLE/CLEAN com 12/12 checks SUCCESS** (`verify-release` e o check exigido `scan + cobertura` inclusos), sem threads de review abertas; o job Neon reprovou uma vez por timeout transitório do provedor (`compare_schema` HTTP 408) e fechou verde no re-run com cleanup por GET 404. Artefatos brutos do run selados em `captures/run-38270836613/`. O closure test da DBT-108 está satisfeito por esta observação; a promoção de status no registry é do MAESTRO, como as de DBT-104/105/106/107.

Limites: o espelho segue sem crédito (informacional por desenho) e o merge para `main` continua decisão humana pós-checks, com a análise real de main e a publicação manual; nada nesta rodada aprova main ou publica.
