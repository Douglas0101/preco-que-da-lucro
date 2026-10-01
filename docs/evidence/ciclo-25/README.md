# Ciclo 25 — base e escalada por premissas medidas

D0: **Opção A ratificada pelo prompt do MAESTRO**. B publicada/reconciliada, com DBT-61 ABERTA; V suspensa por ERRATA, E/80 não iniciadas. Main permanece d4b9395 com freeze, develop avançou para 0b78acb e PR #60 continua aberta/BLOCKED. Nenhum bypass, merge ou deploy de produção foi executado pelo ciclo; preview e CI automáticos são observados separadamente.

Semântica de nulo antes dos gates: métrica omitida/API inacessível/precondição ausente = NO-VERDICT, não zero; cancelled/skipped não prova teste; cache hit prova restauração do cache, não instalação das dependências do sistema. HTTP 422 nomeia a resposta da plataforma, não por si só a causa (payload, estado, quota ou validação devem vir do corpo). Preview verde após outro job verde não demonstra causalidade sem vínculo/configuração verificável.

## B — publicação e reenquadro

O commit herdado f7c4b9a8bedb3fe49ed4d5a774559156087d66a0 está íntegro. Check completo executado nesta sessão exit 0: 117 suítes, 1411 passed, 14 skipped, build/bundle PASS; log SHA-256 4582cbda19ca488e28facec6a378616f173e355f385a62b01d3357e19b9915b5. Publicado junto aos dois lotes C25 em um único push às 22:59:36Z. API confirmou develop=0b78acb e main inalterada; ancestry confirma f7 incluído. A PR propagou o novo head depois da atualização de ref; o assert imediato viu a versão anterior, foi reconciliado por leitura, sem repetir push. O log de check completo do candidato tem SHA-256 255ecafeef0a92b5cf913883bede71324ac4713d40a3ba89316108c7c4d25c34.

DBT-61 reenquadrada por autorização do prompt para atribuição correta nas superfícies main/PR; o requisito legado de análise acessível de develop sai da closure. **Continua ABERTA:** which-analysis.ts só consulta project_analyses/search principal e project_branches/list, sem seletor de PR; inspeção da API pública search lista branch/category/from/p/project/ps/to e não pullRequest. Detector puro não prova uma análise real da PR. Há também dispatch de develop sem guarda de main: cai no ramo padrão que atribui à principal. Nenhum scanner foi disparado por dispatch para testar esse desvio. Nova closure declara recusa do dispatch fora de main.

Placar com legenda no registry: D=DONE (todos os subitens provados), P=PARTIAL (delta nomeado), NS=NOT-STARTED, UNV=inverificável de princípio. 150 D/29 P/8 NS/0 UNV, denominador 187 e fórmula (D+0,5P)/187 preservados; sem promoção do agente.

## ERRATA temporal — janela vigente

Clock desta sessão no boot: 2026-10-01T22:37:49Z. Teto ADR-037: 2026-10-02T02:59:59Z. Portanto a afirmação EXPIRADA do estado inicial estava adiantada. Não renovada, removida ou reinterpretada como permissão de release vermelha. Ruleset persiste quando a janela terminar.

## V — cache existente, dependências APT

V1.2 propõe exatamente um cache que já está em ui-stack.yml: action pinada 0057852bfaa89a56745cba8c7296529d2fc39830, path ~/.cache/ms-playwright e key playwright-${runner.os}-${hashFiles(package-lock.json)}. Job PR 110591560363: hit às 21:27:37.647Z, restored às 21:27:39.939Z. Após isso playwright install --with-deps instalou dependências APT; os downloads seguem até 21:37, quando ocorreu cancelamento pelo limite de 12 min. Push job 110591521529 também teve hit e passou. **Adicionar cache não corrige ausência de cache: essa ausência foi refutada.**

ERRATA V1: Fase V suspensa conforme regra universal 2. A primeira leitura parcial do log omitiu downloads posteriores a Reading package lists; o recorte completo corrigiu isso nesta sessão. A lentidão observada está nos downloads de pacotes do sistema; causa de rede/espelho específica não medida. Não foi duplicado cache, reduzido navegador/teste/limite ou implementado substituto sem reconciliação da fase.

Neon 422 permanece sem resposta detalhada e sem exercício completo neste ciclo; não executar uma criação remota como se V tivesse passado. Hipótese de colisão, payload e estado não promovida a diagnóstico. A conexão causal com Vercel preview permanece NÃO VERIFICADA. O workflow mantém URIs efêmeras em RUNNER_TEMP e não contém entrega explícita à Vercel; configuração externa não foi examinada. A falha de preview às 21:24:34Z precedeu o erro de criação Neon às 21:24:52Z no run C24: isso não comprova cascata do 422. Metadados não substituem logs/configuração; perímetro vercel.com permanece humano.

## E — controle de granularidade e ordem do freeze

Controle negativo em memória para a interpretação de E1 que agrega delta **por arquivo**: arquivo tem 100 linhas new-main, 60 cobertas; PR passa a cobrir 20 linhas **antigas do mesmo arquivo**. Delta de lcov do arquivo=20, floor=20, projeção=(60+20)/100=80%; cobertura real no recorte new continua 60%. O controle reproduziu falso positivo. Excluir arquivos de teste e aplicar floor não resolve mistura de unidades antigas/novas dentro do mesmo arquivo. É necessário recorte por unidade de main e comparabilidade das identidades de linha/condição, incluindo baseline; nenhuma ponte confiável foi demonstrada por esse agregado.

Outro impedimento: V3 permite remover update SOMENTE com gate real de main verde; esse gate pós-merge depende do merge que update proíbe. Regra efetiva update+bypass=[] e main ERROR foram observadas. Sem alterar a sequência autorizada, não há caminho para E2.2. Não se concedeu bypass ou removeu freeze para romper o ciclo. D0 A está ratificada; isto não é uma ratificação de thaw antes do gate real.

Via B deploy-no-workflow é evolução pendente de DBT-64, fora do perímetro ADR-036. Via A conserva o resíduo: projeção errada pode publicar antes do gate de push; wait no push observa/falha depois, não cancela a publicação externa por si só. ADR-038 deve registrar estes limites antes de qualquer construção.

## M — piso e baseline

DBT-57 closure atualizada para conjunção: gate real main ≥80 AND denominador ≥ceil(50% de M1_total) AND unidades pagas contra baseline registrada. M1 C25 fresco no runner em 2026-10-01T22:59:49.985Z reconfirmou 2995 totais/1894 cobertas/gap 502 e piso vigente 1498. A consulta é nova; a análise identificada ainda é a de main d4b9395 de 14:53:36, analysisId 1dc2baf9-b289-42f4-b2ca-dd7b662b3679. Não houve nova submissão de main. O LCOV da CI foi obtido como evidência auxiliar; test:coverage local não foi reexecutado no C25 após a suspensão, e esse artefato não substitui a máscara new da API. Nenhum lote de testes de cobertura escrito; Loop A não iniciado, sem HARD/SKIPPED-REFACTOR por tentativa inexistente.

## Registros e orçamento

Registry 51: 41 ABERTA/9 FECHADA/1 EM_TRATAMENTO. Nenhuma closure nova no ciclo. DBT-61 reenquadrada/ABERTA, DBT-57 piso declarado/ABERTA, DBT-64 e DBT-68 ABERTAS; DBT-36 Via A sem sinal. Placar preservado. Original package/lock/node_modules e WIP preservados; o journal original apenas recebe ponteiros aditivos. Watchers sem rearme ou claim de disponibilidade atual.

C25: primeiro lote B documental de 5 arquivos, selo por revisão. Commit herdado f7 não é commit novo do C25. Esta preparação não afirma EXIT V/E/80 e não toma pipeline automático como closure de fix que não ocorreu. Os runs do único push, a medição fresca e os commits gastos estão registrados no encerramento abaixo.

## Capturas sanitizadas

Cache/APT do job cancelado (recorte de log real):

```text
verify	UNKNOWN STEP	2026-10-01T21:27:37.6470971Z Cache hit for: playwright-Linux-41076b54edb03871e7324a3b487c54fa7ea8c145c1c58d2d7c099c8652b43ec8
verify	UNKNOWN STEP	2026-10-01T21:27:39.9396100Z Cache restored from key: playwright-Linux-41076b54edb03871e7324a3b487c54fa7ea8c145c1c58d2d7c099c8652b43ec8
verify	UNKNOWN STEP	2026-10-01T21:27:40.7003101Z Installing dependencies...
verify	UNKNOWN STEP	2026-10-01T21:27:41.2156080Z Get:20 http://azure.archive.ubuntu.com/ubuntu noble-backports/universe amd64 Components [12.6 kB]
verify	UNKNOWN STEP	2026-10-01T21:27:41.2312262Z Get:21 http://azure.archive.ubuntu.com/ubuntu noble-security/main amd64 Packages [1069 kB]
verify	UNKNOWN STEP	2026-10-01T21:31:58.3724399Z Get:20 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libcodec2-1.2 amd64 1.2.0-2build1 [8998 kB]
verify	UNKNOWN STEP	2026-10-01T21:33:45.4598204Z Get:21 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libdav1d7 amd64 1.4.1-1build1 [604 kB]
verify	UNKNOWN STEP	2026-10-01T21:35:00.0968947Z Get:29 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libshine3 amd64 3.1.1-2build1 [23.2 kB]
verify	UNKNOWN STEP	2026-10-01T21:35:32.6433820Z Get:33 http://azure.archive.ubuntu.com/ubuntu noble/universe amd64 libswresample4 amd64 7:6.1.1-3ubuntu5 [63.8 kB]
verify	UNKNOWN STEP	2026-10-01T21:37:19.9260773Z ##[error]The operation was canceled.
```

Controle em memória (fixture, não análise Sonar do projeto):

```json
{
  "fixture": true,
  "sameFile": "src/example.ts",
  "newMainLines": [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
    27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
    51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
    75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98,
    99, 100
  ],
  "baseHitsNew": 60,
  "newCoveredAfter": 60,
  "extraOldCovered": 20,
  "fileDelta": 20,
  "fileProjectedPercent": 80,
  "maskedActualPercent": 60,
  "floorDelta": 20,
  "falsePositive": true
}
```

Marcadores: somente presença/mtime, sem valores:

```json
[
  {
    "name": "app-live.txt",
    "present": false,
    "mtimeUtc": null
  },
  {
    "name": "H2-ready.txt",
    "present": false,
    "mtimeUtc": null
  },
  {
    "name": "H1-ready.txt",
    "present": true,
    "mtimeUtc": "2026-09-12T04:25:44.362916+00:00"
  }
]
```

## ADR corretivo

ADR-038-espelho-conservador-de-cobertura.md é PROPOSTA documental. D0 A permanece ratificada, mas agregado por arquivo não prova ganho em unidades new e a ordem do thaw não foi reconciliada. Via B é evolução pendente dentro da DBT-64, sem extensão de perímetro. Sem implementação de espelho, sem required check novo e sem mudança de update/bypass.

## Encerramento medido

C25 escalado com **3/13 commits**: 916d573 (B, 5 arquivos) e 0b78acb (ADR-038 PROPOSTA, 4) publicados; terceiro lote documental final local, 4 arquivos com selo. Commit herdado f7 também está no remote e não é contado como commit novo C25. Um push, seis runs automáticos, nenhum rerun manual, nenhum merge/thaw e nenhum lote de testes de cobertura de aplicação.

O verify da PR agora passou: job 110623659242 começou 22:59:43Z e terminou 23:06:40Z, **417 s**. Cache step 3 s; install dos três browsers **40 s**; E2E chromium/firefox/webkit/mobile **152 s**, SUCCESS. Comparação: run C24 teve install 580 s e cancelled, embora ambos tenham restaurado cache. Libera a precondição deste SHA; não comprova um fix de cache inexistente nem a causa específica da lentidão APT. A [documentação Playwright](https://playwright.dev/docs/ci#caching-browsers) distingue cache dos binários das dependências de sistema Linux. DBT-68 permanece ABERTA pela closure causa/solução ainda não demonstrada; não se declara EXIT V com Neon/preview sem causa.

Sonar PR passou após espera CE (~5,55 s); API PR OK com quatro condições e nenhuma de cobertura. Main permanece ERROR 63,2 na análise identificada. Gap fresco **502 unidades**, piso **1498**, zero lotes/unidades pagas creditadas C25. E2 bloqueio POR COBERTURA e erro do espelho pós-merge não existem: espelho não foi implantado e nenhum merge ocorreu.

Neon repetiu o 422 no run automático: action só capturou a string AxiosError/status 422, não o corpo de validação do servidor. Delete skipped e saída branch_id ausente **não provam ausência ou descarte da branch**; estado remoto precisa ser reconciliado no runner antes de outra criação. Dois runs da mesma classe (C24/C25) não geraram diagnóstico mais preciso, portanto escalada; não tentar outra criação às cegas. Preview FAILURE às 22:59:44Z precedeu o erro 422 às 22:59:59.801Z; vínculo causal não foi demonstrado. O target URL Vercel também tem escopo/team slug diferente do snapshot C24, cuja identidade externa não foi reconciliada. Logs/configuração Vercel seguem humanos pelo perímetro.

Registry 51 = 41 abertas + 9 fechadas + 1 em tratamento, sem closure nova. Placar 150 D/29 P/8 NS/0 UNV, 187 fixos, (150+0,5×29)/187=87,9679%; crua 80,2139%, sem promoção. O percentual do placar não é o gate Sonar. DBT-61 está reenquadrada mas o CLI não prova PR; DBT-57 recebeu baseline/piso; DBT-64 mantém via B pendente/resíduo e ADR-038 PROPOSTA.

| Gate do prompt              | Resultado                                                                       |
| --------------------------- | ------------------------------------------------------------------------------- |
| f7 no remote                | PASS, ancestry e API                                                            |
| DBT-61 reenquadrada/legenda | Reenquadrada, ABERTA por suporte PR ausente; legenda registrada                 |
| D0 A                        | Ratificada; construção de espelho não iniciada                                  |
| Verify PR                   | SUCCESS 417 s, cache existente; correção proposta V1 refutada                   |
| Neon exercício/causa        | Não concluído; 422 repetido, corpo detalhado ausente, Delete skipped            |
| Preview causa               | NÃO VERIFICADA, sem uso de UI Vercel                                            |
| Espelho negativo/erro real  | Não executados; controle preparatório mostrou agregado por arquivo insuficiente |
| Gate main/anti-janela       | ERROR 63,2; 2995 unidades, gap 502, piso 1498, pagamento 0                      |
| DBT-64/publicação           | ABERTA; freeze mantido, sem release de produção                                 |
| Orçamento                   | 3/13 commits, 6 runs, 1 push                                                    |

A retomada precisa corrigir a hipótese de V1 para dependências APT/ambiente, capturar o corpo sanitizado do 422 e reconciliar branches no runner, definir o mapeamento por unidade do espelho e reconciliar V3 antes de thaw. Não exige reabrir D1–D5; exige resolver precondições e a sequência que a medição contrariou. Os sete Dependabot seguem para Ciclo 26; Via B e DBT-36 continuam dependentes dos handshakes já definidos. Nenhum controle de cobertura é substituído pelo freeze.

### Reproduzir o controle de arquivo misto

O controle executado em memória é uma fixture, não análise do projeto:

```python
main_units = set(range(1, 101))
base_hits = set(range(1, 61))
pr_hits = base_hits | set(range(101, 121))
delta_file = len(pr_hits) - len(base_hits)
projected = (len(base_hits & main_units) + delta_file) / len(main_units)
actual = len(pr_hits & main_units) / len(main_units)
assert projected == 0.80 and actual == 0.60
```

### Capturas finais sanitizadas

Publicação/gate local:

```json
{
  "candidateSha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852",
  "mainBefore": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "developBefore": "0b5942331989ee156da99b297de3ca9f2f2c3c94",
  "pushExit": 0,
  "pushOutput": "To https://github.com/Douglas0101/preco-que-da-lucro.git\n   0b59423..0b78acb  HEAD -> develop\n",
  "prepushCheck": {
    "exit": 0,
    "logSha256": "255ecafeef0a92b5cf913883bede71324ac4713d40a3ba89316108c7c4d25c34",
    "filesPassed": 117,
    "testsPassed": 1411,
    "testsSkipped": 14
  },
  "observedAt": "2026-10-01T22:59:36.716845+00:00",
  "mainAfter": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "developAfter": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852",
  "inheritedF7Published": true
}
```

M1 fresco e piso:

```json
{
  "schema": "ciclo24-main-baseline/1",
  "observedAt": "2026-10-01T22:59:49.985Z",
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
  "nullSemantics": "valor ausente/ilegível é NO-VERDICT; overall não substitui new; gap só de linhas não inclui conditions",
  "cycle25Derived": {
    "totalUnits": 2995,
    "coveredUnits": 1894,
    "gapTo80": 502,
    "minimumDenominator": 1498,
    "creditedCoverageWorkPackages": 0,
    "note": "no new application coverage tests in C25; API snapshot is of the identified existing main analysis"
  }
}
```

PR gate:

```json
{
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
}
```

CI final/preview:

```json
{
  "observedAt": "2026-10-01T23:12:02Z",
  "runs": [
    {
      "id": 36938300886,
      "name": "CI light (docs/evidence)",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938300886",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    },
    {
      "id": 36938300872,
      "name": "Neon PR branch CI",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "failure",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938300872",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    },
    {
      "id": 36938300921,
      "name": "SonarCloud (scanner + cobertura)",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938300921",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    },
    {
      "id": 36938300944,
      "name": "UI stack",
      "event": "pull_request",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938300944",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    },
    {
      "id": 36938298750,
      "name": "CI light (docs/evidence)",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938298750",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    },
    {
      "id": 36938298811,
      "name": "UI stack",
      "event": "push",
      "status": "completed",
      "conclusion": "success",
      "html_url": "https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/36938298811",
      "head_sha": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852"
    }
  ],
  "prVerify": [
    {
      "id": 110623659242,
      "startedAt": "2026-10-01T22:59:43Z",
      "completedAt": "2026-10-01T23:06:40Z",
      "conclusion": "success",
      "steps": [
        {
          "name": "Cache dos navegadores do Playwright",
          "conclusion": "success",
          "startedAt": "2026-10-01T23:03:21Z",
          "completedAt": "2026-10-01T23:03:24Z"
        },
        {
          "name": "Run npx playwright install --with-deps chromium firefox webkit",
          "conclusion": "success",
          "startedAt": "2026-10-01T23:03:24Z",
          "completedAt": "2026-10-01T23:04:04Z"
        },
        {
          "name": "Run npx playwright test --project=chromium --project=firefox --project=webkit --project=mobile",
          "conclusion": "success",
          "startedAt": "2026-10-01T23:04:04Z",
          "completedAt": "2026-10-01T23:06:36Z"
        }
      ]
    }
  ],
  "neonCleanup": [
    {
      "id": 110623762015,
      "conclusion": "success",
      "steps": [
        {
          "name": "Set up job",
          "conclusion": "success"
        },
        {
          "name": "Delete branch efêmera",
          "conclusion": "skipped"
        },
        {
          "name": "Prova de cleanup + comentário no PR",
          "conclusion": "success"
        },
        {
          "name": "Complete job",
          "conclusion": "success"
        }
      ]
    }
  ],
  "preview": [
    {
      "context": "Vercel – preco-que-da-lucro",
      "state": "failure",
      "description": "Deployment has failed — run this Vercel CLI command: npx vercel inspect dpl_8wUJ19L3tr38aNaidmx4KGKoo3v6 --logs",
      "target_url": "https://vercel.com/douglasultimatesouza-5127s-projects/preco-que-da-lucro/8wUJ19L3tr38aNaidmx4KGKoo3v6",
      "updated_at": "2026-10-01T22:59:44Z"
    }
  ]
}
```

Neon erro e passos:

```json
{
  "run": 36938300872,
  "errors": [
    "Branch efêmera · migrate · integração · RLS probe · E2E\tCreate ephemeral branch pr-<num> (§12.4 parent production para main, develop para os demais)\t2026-10-01T22:59:59.8013506Z ##[error]Failed to create branch. AxiosError: Request failed with status code 422"
  ],
  "jobs": [
    {
      "id": 110623658548,
      "name": "Fork-guard + presença de segredo",
      "conclusion": "success",
      "steps": [
        {
          "name": "Complete job",
          "conclusion": "success"
        }
      ]
    },
    {
      "id": 110623694145,
      "name": "Branch efêmera · migrate · integração · RLS probe · E2E",
      "conclusion": "failure",
      "steps": [
        {
          "name": "Run actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
          "conclusion": "success"
        },
        {
          "name": "Create ephemeral branch pr-<num> (§12.4 parent production para main, develop para os demais)",
          "conclusion": "failure"
        },
        {
          "name": "Rede de segurança §12.5 (expires-at +24h) + URIs da branch em RUNNER_TEMP",
          "conclusion": "skipped"
        },
        {
          "name": "Install dependencies",
          "conclusion": "skipped"
        },
        {
          "name": "Migrations via DIRECT da branch (drill-branch, journal no-op esperado)",
          "conclusion": "skipped"
        },
        {
          "name": "Schema diff §12.5 (compare_schema + veredito por nível de migration)",
          "conclusion": "skipped"
        },
        {
          "name": "Upload schema diff §12.5",
          "conclusion": "success"
        },
        {
          "name": "Integração (suites db:test) contra a branch",
          "conclusion": "skipped"
        },
        {
          "name": "Seed sintético + sonda RLS adversarial contra o DIRECT da branch (H-07)",
          "conclusion": "skipped"
        },
        {
          "name": "Prova de journal (read-only)",
          "conclusion": "skipped"
        },
        {
          "name": "E2E Playwright contra a branch efêmera (§12.5 · §26.7)",
          "conclusion": "skipped"
        },
        {
          "name": "Post Run actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
          "conclusion": "skipped"
        },
        {
          "name": "Post Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
          "conclusion": "success"
        },
        {
          "name": "Complete job",
          "conclusion": "success"
        }
      ]
    },
    {
      "id": 110623762015,
      "name": "Cleanup always() com prova (§12.5)",
      "conclusion": "success",
      "steps": [
        {
          "name": "Prova de cleanup + comentário no PR",
          "conclusion": "success"
        },
        {
          "name": "Complete job",
          "conclusion": "success"
        }
      ]
    }
  ]
}
```

LCOV CI auxiliar por escopo:

```json
{
  "artifactId": 11199540353,
  "lcovSha256": "31b6fa3a58cdfca55984b40f5ca06ee0493b3d14d8aba29a9bb20d1f23e860e5",
  "total": {
    "LF": 9122,
    "LH": 5992,
    "BRF": 6643,
    "BRH": 4005
  },
  "scope": "CI lcov auxiliary, not a new local run or main-new unit mask",
  "srcIncludingTestHelpers": {
    "LF": 4048,
    "LH": 2931,
    "BRF": 2968,
    "BRH": 1898
  },
  "productionSrcExcludingTests": {
    "LF": 3930,
    "LH": 2823,
    "BRF": 2918,
    "BRH": 1848
  }
}
```

Integridade final e estado remoto reconfirmado:

```json
{
  "observedAt": "2026-10-01T23:20:35.219735+00:00",
  "historicalSeals": 14,
  "hashesChecked": 53,
  "sealFailures": [],
  "custodyFiles": 929,
  "custodyDifferences": [],
  "historicalJournalAppendOnly": true
}
```

```json
{
  "observedAt": "2026-10-01T23:22:32.447009+00:00",
  "main": "d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9",
  "develop": "0b78acbf588a351d3d56ebe94dfefce3ba9f2852",
  "pr": 60,
  "prState": "open",
  "prMergeState": "blocked",
  "rulesetId": 24333849,
  "enforcement": "active",
  "bypassActors": [],
  "updateRulePresent": true,
  "currentUserCanBypass": "never"
}
```

Validação documental final PASS: debts guard (51), temporal guard (0 violações), state marker (folga 2/13 antes do commit), Prettier, git diff --check e histórico append-only. Integridade: 14 selos históricos/53 hashes por revisão e 929 arquivos de custódia sem diferenças. O selo final cobre registry/journal/README no commit documental local; nenhum run é inventado para essa revisão.
