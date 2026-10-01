# Ciclo 25 — base e escalada por premissas medidas

D0: **Opção A ratificada pelo prompt do MAESTRO**. Fase B documental preparada; Fase V suspensa por ERRATA; E/80 não iniciadas. Main está em d4b9395 com freeze, PR #60 aberta/BLOCKED. Nenhum bypass, merge ou deploy executado neste ciclo.

Semântica de nulo antes dos gates: métrica omitida/API inacessível/precondição ausente = NO-VERDICT, não zero; cancelled/skipped não prova teste; cache hit prova restauração do cache, não instalação das dependências do sistema. HTTP 422 nomeia a resposta da plataforma, não por si só a causa (payload, estado, quota ou validação devem vir do corpo). Preview verde após outro job verde não demonstra causalidade sem vínculo/configuração verificável.

## B — publicação e reenquadro

O commit herdado f7c4b9a8bedb3fe49ed4d5a774559156087d66a0 está íntegro. Check completo executado nesta sessão exit 0: 117 suítes, 1411 passed, 14 skipped, build/bundle PASS; log SHA-256 4582cbda19ca488e28facec6a378616f173e355f385a62b01d3357e19b9915b5. Publicação planejada junto ao lote B, em um único push para evitar duplicar runs. Registro final deve confirmar ancestry e refs remotas; não afirmar publicado antes do endpoint.

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

DBT-57 closure atualizada para conjunção: gate real main ≥80 AND denominador ≥ceil(50% de M1_total) AND unidades pagas contra baseline registrada. Baseline C25 no runner ainda pendente. O snapshot C24 era 2995 totais/1894 cobertas/gap 502; não foi vendido como nova medição. Com essa base histórica o piso matemático seria 1498 unidades, mas o piso vigente só nasce de M1 fresco. Nenhum lote de testes de cobertura escrito; Loop A não iniciado, sem HARD/SKIPPED-REFACTOR por tentativa inexistente.

## Registros e orçamento

Registry 51: 41 ABERTA/9 FECHADA/1 EM_TRATAMENTO. Nenhuma closure nova no ciclo. DBT-61 reenquadrada/ABERTA, DBT-57 piso declarado/ABERTA, DBT-64 e DBT-68 ABERTAS; DBT-36 Via A sem sinal. Placar preservado. Original package/lock/node_modules e WIP preservados; o journal original apenas recebe ponteiros aditivos. Watchers sem rearme ou claim de disponibilidade atual.

C25: primeiro lote B documental de 5 arquivos, selo por revisão. Commit herdado f7 não é commit novo do C25. Esta preparação não afirma EXIT V/E/80 e não toma pipeline automático como closure de fix que não ocorreu. Relatório final deve registrar os runs do único push, a medição fresca e os commits realmente gastos.

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
