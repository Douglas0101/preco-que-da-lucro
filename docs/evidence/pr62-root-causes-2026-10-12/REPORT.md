# PR #62 — raízes das duas reprovações

## Escopo e identidade

- Pedido: investigar as duas reprovações do PR #62 para correções precisas, sem transformar ausência de evidência em aprovação.
- Medição em 2026-10-12, run [38197746621](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/38197746621), evento `pull_request`, attempt 1.
- PR: `develop` → `main`, head `63efb76ebf8218d46bc0a766fc2f670bbf5cd5f1`; main `40c1a35577c70c7d33424640648d52bfdedb8bde`.
- Checkout analisado no CE: `8d5daf49767dd6f2761e0b0bb5c687e7e53e4f9d`, revisão de merge de PR, não um erro de atribuição ao head. A identidade foi validada antes da recusa de política.
- CE task `AaEuDL3Y_VRRlkU-_fKk`, analysis `ca31e0f1-aca3-4431-9bbd-6a314159c532`, branch `develop`, PR `62`.
- Reprovados: `scan + cobertura` (job `114644123586`) e `main-coverage-mirror` (job `114644758426`).
- Na mesma revisão, `verify-release`, preparação Playwright, integração/migrations/RLS/E2E Neon e cleanup estavam verdes. A reprovação atual está na cadeia de evidência Sonar, não nessas suítes.
- Custódia: capturas abaixo e `MANIFEST.sha256`. Somente metadados públicos/artefatos sem credenciais; nenhuma alteração remota, de banco ou de política.

## 1. `scan + cobertura`: controles ausentes, não cobertura medida abaixo de 60%

### Evidência direta

O scanner e seu sensor de cobertura terminaram com sucesso. O LCOV tem **381.194 bytes**, SHA256 `8724979f0659378858e8d51e9a87dedba43b5de7012b01c19432a912069e5320`. O log registra 149 arquivos indexados e o consumo pelo `Sensor JavaScript/TypeScript Coverage`.

O CE retorna `status: OK`, `ignoredConditions: false`, com apenas quatro condições:

- `new_reliability_rating = 1`, OK;
- `new_security_rating = 1`, OK;
- `new_maintainability_rating = 1`, OK;
- `new_security_hotspots_reviewed = 100.0`, OK.

**Não retorna `new_duplicated_lines_density` nem `new_coverage`.** `releaseVerdict()` exige a duplicação em `scripts/sonar/gate-readout.ts:188-211` e só depois examina a cobertura em `scripts/sonar/gate-readout.ts:223-238`. A primeira ausência dispara exatamente:

```text
gate controle obrigatório ausente ou alterado: NO-VERDICT
```

O readout termina com exit 2. Portanto, o `OK` do app Sonar não equivale à aprovação ADR-042. O valor `0.0%` do comentário do bot não substitui uma condição de cobertura que não foi emitida no relatório do CE; não foi demonstrada cobertura numérica de PR abaixo de 60%.

### Raiz no contrato de escopo/aplicabilidade

O workflow fixa `sonar.sources=src` e exclui `src/test/**` em `.github/workflows/sonar.yml:137-138`. O diff do PR contém evidências, `scripts/sonar/**` e `src/test/main-baseline-select.test.ts`, mas **zero arquivos alterados no código analisado**:

```bash
git diff --name-only \
  40c1a35577c70c7d33424640648d52bfdedb8bde \
  63efb76ebf8218d46bc0a766fc2f670bbf5cd5f1 \
  -- src ':!src/test' ':!src/test/**'
```

Resultado vazio, assertado na bancada. O readout requer incondicionalmente controles numéricos que este CE de PR não retornou. É uma incompatibilidade de aplicabilidade para um PR sem delta analisável, **não uma falha comprovada dos testes de aplicação**. DBT-105 registra essa fronteira; não autoriza aceitar métricas ausentes.

Há 69 caminhos LCOV não resolvidos, começando por `scripts/m02-cutover-t0.mjs`. `scripts/**` está deliberadamente fora do escopo por ADR-034/035 e cota de LOC (comentário `.github/workflows/sonar.yml:12-14`, DBT-58). O aviso não é o passo que falhou; ampliar indiscriminadamente `sonar.sources` não é uma correção autorizada.

**Limite externo:** as consultas anônimas a medidas/histórico/quality gate retornaram HTTP 404, sem acesso aos dados autenticados. Não é prova de inexistência. A documentação do provedor descreve o tratamento de pequenos deltas, mas `ignoredConditions` foi **false** neste artefato. Não se atribui a falha, sem evidência adicional, à configuração de “fudge factor”, a mudança de plano, a segredo inválido ou a um gate removido na plataforma.

### Correção precisa proposta, ainda não aplicada

1. Decidir formalmente como ADR-042 trata PR **comprovadamente sem delta analisável**, preservando a exigência real de `new_coverage >=60%` para mudança elegível e para a revisão real de main. Ausência não pode virar `0`, `100` ou aprovação silenciosa.
2. Se essa distinção for autorizada, provar por identidade de revisão e pelo escopo efetivo do scanner — não apenas contagem — que o delta analisável é vazio. Qualquer alteração de fonte elegível, configuração de análise, identidade inconclusiva ou descoberta incompleta deve manter a recusa.
3. Outra possibilidade exige decisão de escopo/cota: incluir os scripts realmente alterados na análise e exigir os controles/60% sobre a superfície nova. Isso não pode ser inferido como permitido pela investigação.
4. Testar PR sem delta, pequeno delta elegível, métrica ausente inesperadamente, duplicação/security/hotspots reprovados, identidade errada e cobertura abaixo/acima de 60%. O main pós-merge continua exigindo seu CE real, sem crédito transferido do PR.

## 2. `main-coverage-mirror`: regressão de contexto na coleta da baseline

### Evidência direta

O primeiro passo real que falha é `Read authoritative main units at the current SHA`. `c24-main-baseline.json` traz:

```text
verdict: NO-VERDICT
reasonCode: GATE_READOUT_UNAVAILABLE
requests: GET GitHub branches/main → HTTP 200; nenhuma consulta Sonar
```

O mesmo código aparece antes do scanner no job `scan`; ali `continue-on-error` faz o passo figurar como sucesso, mas o artefato conserva a recusa. No espelho não há esse override, logo a falha bloqueia o job. O adapter falha depois, na fase `baseline`, com `EXECUTION_OR_UNCLASSIFIED`; o mirror também falha. São efeitos em cascata, não três causas independentes.

### Raiz de código

O commit `182754f` (`fix(ci): select the main baseline by the run's own CE analysis`) corrige DBT-103 para **o pós-CE de main**, mas aplica a exigência do readout próprio a todos os consumidores:

- `scripts/sonar/main-baseline.mjs:45-64`: `ceReadout()` exige `RUNNER_TEMP/c25-gate-readout.json`, `analysisId` e identidade de main;
- `scripts/sonar/main-baseline.mjs:77-83`: chamada incondicional de `ceReadout()` e seleção pelo CE do próprio job;
- `.github/workflows/sonar.yml:60-66`: consumidor de PR **antes** do scanner/readout;
- `.github/workflows/sonar.yml:175-181`: consumidor pós-CE de main, onde o requisito é correto;
- `.github/workflows/sonar.yml:227-231`: consumidor em job **novo**, sem esse arquivo. O download do readout de PR só ocorre depois e vai para outro diretório; além disso sua identidade não é main.

Não há problema de credenciais demonstrado: o GET de GitHub teve HTTP 200, e o script recusa **antes de chamar Sonar**. Também não é ausência histórica de proveniência já confirmada: essa descoberta ainda nem foi alcançada.

### Reprodução negativa e controle positivo

CLI real executado com `fetch` substituído por fixture fechada, sem rede e sem credenciais reais:

| Cenário                                               | Resultado assertado                                        |
| ----------------------------------------------------- | ---------------------------------------------------------- |
| PR, baseline antes do scanner, sem readout            | exit 2, `GATE_READOUT_UNAVAILABLE`, apenas GitHub HTTP 200 |
| Espelho, job novo, sem readout                        | exit 2, mesmo código e mesmas requisições                  |
| Copiar o readout real NO-VERDICT de PR                | exit 2, `CE_ANALYSIS_ID_UNAVAILABLE`                       |
| Readout positivo de PR com ID na raiz                 | exit 2, `READOUT_SURFACE_NOT_MAIN`                         |
| Pós-CE de main, readout main da mesma revisão/análise | exit 0, SHA/analysisId/period/6 requisições conferidos     |

Os **80%** do último controle são **dados de fixture**, não cobertura medida de main. Esse controle demonstra que a bancada alcança a fase correta e que o requisito só é válido para o consumidor pós-CE.

### Correção precisa proposta, ainda não aplicada

Separar explicitamente os dois contextos no CLI e atualizar **os três sítios** descobertos:

1. **Pós-CE de main:** manter seleção pelo `analysisId` do CE próprio, revisão exata, newest-main correspondente e verificações de estabilidade. Preservar DBT-103 e seus negativos de re-execução.
2. **Observação read-only de main em PR/espelho:** descobrir a análise mais recente da revisão imutável atual de main, coletar medidas/período/gate dessa identidade e repetir a validação de SHA e análise depois da leitura. Não exigir um arquivo local do CE que esse job não produz.
3. Não copiar o relatório de PR como se fosse main, escolher análise por cardinalidade, reutilizar LCOV local como proveniência histórica nem mascarar a falha com `continue-on-error` no espelho.
4. Adicionar testes do **CLI real e seus chamadores**, cobrindo falta/readout de PR/readout de main, re-execução com duas análises da mesma revisão, análise/revisão divergentes, main ou análise movendo durante a coleta, transporte/metadata incompletos. As suítes atuais testam o seletor e o selo, mas não essas duas chamadas de PR; por isso permanecem verdes apesar da regressão.

Registro: **DBT-104**, ABERTA. Sua correção é de código e não necessita reduzir o limite de cobertura.

## 3. Cascata adicional: o selo LCOV não lê a forma NO-VERDICT que o readout preserva

O readout mantém a identidade validada em `providerIdentity` e os IDs da tarefa/análise em `providerObservation`, conforme `scripts/sonar/gate-readout.ts:279-293`. Isso é deliberado: não apagar evidência válida só porque a política ficou inconclusiva.

Mas `scripts/sonar/lcov-provenance.ts:71-72` usa somente `gate.analysisId` e `gate.ceTaskId`. O CLI lança um cast em `scripts/sonar/lcov-provenance.ts:162` sem validar/normalizar a união dos dois formatos. Os IDs ficam ausentes no objeto selado, e `scripts/sonar/main-unit-adapter.ts:153` lança:

```text
LCOV provenance unavailable or unsealed
```

O código de diagnóstico cai em `PROVENANCE_UNCLASSIFIED` (`scripts/sonar/lcov-provenance.ts:123`), exatamente como no run remoto. O artefato `coverage-lcov` contém apenas `lcov.info`; não há `lcov-provenance.json` do candidato.

A bancada com o relatório/LCOV reais reproduz esse erro. Um **controle positivo de instrumentação**, extraindo a observação validada sem mexer em seu veredito, sela 115 hashes de fonte e conserva revision/task/analysis/LCOV digest. Isso demonstra a incompatibilidade de formato, **não uma autorização de release**.

Correção proposta: parser compartilhado e estrito para os formatos sucesso/NO-VERDICT, validando a origem/identidade e preservando seu status. Dar nome específico às recusas de readout/IDs, em vez de cast seguido de código genérico. Permitir persistência da evidência válida, se o contrato autorizar, não deve transformar `releasePolicy` ausente em OK. Testar IDs ausentes/divergentes, observação não validada, SHA/PR/sensor/LCOV divergentes e prova de que o gate continua reprovado. Registro: **DBT-106**, ABERTA.

## Validação e conclusão

- Reproduções reais dos formatos do run + cinco cenários de CLI/identidade: PASS; sem rede nos cenários de CLI.
- `npm run test -- src/test/main-baseline-select.test.ts src/test/sonar-gate-readout.test.ts src/test/sonar-api.test.ts src/test/gate-mirror.test.ts`: **4 arquivos / 102 testes PASS**. Isso não prova o cenário de chamadores que hoje não está no conjunto.
- Erro inicial da própria bancada: `.ts` em `/tmp` foi interpretado como CJS e recusou top-level await (`ERR_REQUIRE_ASYNC_MODULE`). Corrigido apenas no artefato de bancada, renomeando para `.mts`; não foi alteração no código do projeto.
- Primeira tentativa de `npm run check` local recusada: a inserção das três dívidas depois de uma linha vazia interrompeu a tabela canônica (86 contadas pelo guard contra 89 descobertas); e `umask 077` da captura privada fez a fixture Debian criar controle 0700 (`dpkg-deb` exige 0755). São erros locais da bancada/edição documental, não causas do CI remoto. Registro corrigido ao remover a linha vazia; execução usa `umask 022`, mantendo as capturas em modo0600. Testes e guardas não foram alterados. Log preservado separadamente.
- Nova execução de **`npm run check`: exit 0**, incluindo format/lint/typecheck, guardas, **142 arquivos de teste PASS + 1 skip**, **2.180 testes PASS + 18 skips existentes**, build e bundle. Registry: 89 dívidas reconhecidas; os dois testes focados da correção documental/precondição: 37/37 PASS. Essa validação é local e não substitui os checks remotos do PR.
- Reconsulta final: PR #62 OPEN, mesmo head `63efb76ebf8218d46bc0a766fc2f670bbf5cd5f1`, os dois jobs do run `38197746621` continuam reprovados, nenhum check pendente.
- A investigação não implementou as correções, não alterou ADR-042/limiares, testes/workflows/rulesets, não fez re-run, push, merge, deploy ou SQL. O PR continua bloqueado; esse relatório não é selo S5/S6 nem fechamento das dívidas.
- Prioridade recomendada: reparar o contexto da baseline; validar/normalizar os formatos de evidência; obter decisão explícita para a aplicabilidade do gate no PR sem delta. Só então executar CI novo no head resultante. Reexecutar a revisão atual sem reparo mantém as falhas determinísticas.

## Capturas

- `captures/run.json`: identidade do run, jobs e conclusões de cada passo.
- `captures/c25-gate-readout.json`: relatório bruto da recusa do CE, com observação validada preservada.
- `captures/c24-scan-main-baseline.json` e `captures/c24-mirror-main-baseline.json`: refusals antes de qualquer consulta Sonar.
- `captures/c29-main-unit-adapter-observation.json` e `captures/c29-main-mirror-observation.json`: exits crus e ausência de aprovação de main.
- `captures/failed-steps.txt`: trechos dos logs dos passos reprovados e sensor.
- `captures/reproduce.txt`: resultados assertados, com controles negativos e positivos nomeados.
- `captures/reproduction-source.txt` e `captures/baseline-api-fixture-source.txt`: código da bancada usada, preservado como captura; caminhos privados sob `/tmp/pr62-rootcause-20261012` não são novos consumidores do sistema.
- `captures/targeted-tests.txt`: saída crua das quatro suítes existentes.
- `captures/public-api-limits.json`: HTTP 404 das leituras anônimas, sem credenciais; não há medida inventada.
- `captures/check-local-first-attempt.txt`: primeira execução completa interrompida nos dois erros locais de bancada/documentação, sem ocultação.
- `captures/local-preconditions-tests.txt`: validação focada do registry e do recurso Playwright com permissão de diretório correta.
- `captures/check-local.txt`: saída da nova execução do gate completo desta investigação documental.

Referências contratuais: `docs/adr/ADR-042-cobertura-minima-60-publicacao.md`, `docs/adr/ADR-038-espelho-conservador-de-cobertura.md`, ADR-034/035 e DBT-58/102/103. Documentação contextual: [quality gates de PR e pequenos deltas](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates); ela não substitui o relatório autenticado de uma análise.
