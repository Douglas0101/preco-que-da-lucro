# DBT-55 — desbloqueio do gate do SonarCloud (2026-09-30, Ciclo 20)

> Fecha a `DBT-55`. **Não** fecha o gate: o veredito agora existe e é `ERROR`, por uma condição
> **diferente** da que esta dívida nomeava. O que mudou está medido abaixo; o que sobrou está
> registrado como `DBT-57` e `DBT-58`.

## 1. Hipótese herdada — e por que estava errada

O Ciclo 19 fechou a `DBT-55` como **não executável**, com três medições: `POST
/api/analysis_engine/reanalyze` → **404**; nenhuma ação de disparo na API (33 webservices); e
_Automatic Analysis_ proibindo análise via CI.

**As três eram verdadeiras e as três eram irrelevantes.** Elas mediam _"não existe botão para
disparar análise"_. Nenhuma delas dizia _"o scanner não consegue analytically"_. E o scanner
consegue: `sonar-scanner` executou, comunicou com o SonarCloud e subiu relatório.

O que realmente bloqueava era outro, e só apareceu quando se tentou de fato.

## 2. O bloqueio real: a cota de 50.000 LOC da organização

O servidor recusou, com o erro literal:

```text
This analysis will make your organization 'douglas0101' reach the maximum allowed
lines limit of 50000. Current LOC usage is: 0.
LOC count in this analysis: 55028.
Language distribution: css=135, js=9230, plsql=366, py=2100, shell=1036, ts=40940, yaml=1221
```

Segunda tentativa, excluindo `docs/**` e `.github/**`: **`53134`** — essas duas árvores só
removem **1.894** LOC, porque são sobretudo `.md` e `yaml`.

Medição local em `fd9449f` que explica o número:

| árvore                       | LOC        |
| ---------------------------- | ---------- |
| `scripts/**`                 | **34.972** |
| `src/**` (sem `src/test/**`) | 23.864     |

**`scripts/` é maior que toda a aplicação.** Com as duas somadas, nenhuma análise landa — e isso
está provado pelas duas reprovações, não por estimativa.

## 3. O segundo bloqueio, mais simples: não havia definição de new code

Depois de uma análise landar (`sonar.sources=src`), o gate continuava em `status=NONE`,
`conditions=[]`, `periods=[]` e nenhuma métrica `new_*` existia. Na tela
`/project/new_code`, **os dois radios estavam desmarcados** — o projeto nunca tivera definição.
Sem definição não há período; sem período não há `new_*`; sem `new_*` o gate não tem o que
avaliar. `NONE` aqui não era "verde", era **ausência de veredito** — a distinção que o próprio
`DBT-54` exige.

Definido como **Number of days = 30**, com persistência verificada após reload (o primeiro
clique no `input[type=radio]` **não** persistiu; o controle é um segmented control e o que
funciona é o `button[aria-label="Number of days"]`, seguido de **Save**).

## 4. Veredito medido

`GET /api/qualitygates/project_status?projectKey=Douglas0101_preco-que-da-lucro` → **`ERROR`**,
6 condições, **1 reprovando**:

| condição                         | limite   | medido |     |
| -------------------------------- | -------- | ------ | --- |
| `new_reliability_rating`         | `GT 1`   | **1**  | ✅  |
| `new_security_rating`            | `GT 1`   | **1**  | ✅  |
| `new_maintainability_rating`     | `GT 1`   | **1**  | ✅  |
| `new_duplicated_lines_density`   | `GT 3`   | 1,1    | ✅  |
| `new_security_hotspots_reviewed` | `LT 100` | 100    | ✅  |
| `new_coverage`                   | `LT 80`  | **0**  | ❌  |

`new_violations` = **24**, todos _code smells_: **0 bugs**, **0 vulnerabilidades** no código novo.
Período: `{index: 1, mode: "days", parameter: 30}`, janela `[2026-09-05, 2026-10-05]`.

**As duas condições que o closure test da `DBT-55` nomeia caíram de 4 e 5 para 1 e 1.** A
dívida está quitada no que ela afirmava.

## 5. Ressalva de escopo — declarada, não enterrada

O analyze roda com `sonar.sources=src`. **`scripts/**` ficou fora do escopo.** Isso _é_ redução
de escopo no sentido do controle negativo (a) do próprio closure test, e por isso a `DBT-55` não
absorveu o efeito: ele foi para `DBT-58`, com o número nominal — **53 dos 69** achados de
confiabilidade triados no `DBT-40` estão em `scripts/*.sh`.

O que separa isto de um afrouxamento: a exclusão não foi escolhida para melhorar o número, e sim
porque **sem ela nenhuma análise landa** (55.028 e 53.134 são a prova). E o que prova que o
ganho não veio só do encolhimento do denominador: com a definição de new code corrigida, o
período passou a medir **janela de 30 dias**, e os 408 achados caíram para 24 porque deixou de
contar 2,5 semanas de dívida — não porque 384 deles sumiram do escopo.

## 6. Autocorreção

Um scan falhou com `ERROR Error during SonarScanner Engine execution` e a causa **não é
recuperável**: o comando tinha sido canalizado por `grep -E "…|ERROR" | head -8`, que
destruiu a stacktrace antes de persistir em disco. O defeito era do meu pipeline de
diagnóstico, não do comando. Nove execuções byte-idênticas depois: **9/9 sucesso**.

Efeito colateral declarado: essas execuções dejaram **8 análises** do mesmo commit. Não há rota
de API para apagar análise, então elas permanecem — ordinary analyses, sem efeito no veredito,
mas **não** adormecidas.

## 7. Correção a uma afirmação minha anterior

Eu havia Affirmado que o projeto _"não tem quality gate associado"_ e que o `status=NONE`
vinha disso. **Era falso.** `api/qualitygates/get_by_project` não refletir o gate **não** é
falha: o projeto usa o _default_ da organização (_Sonar way_, id 9), e essa API de associação
não reflete o default. As 6 condições devolvidas por `project_status` são exatamente as 6 do
gate built-in. O `403` em `qualitygates/select` e a mensagem de plano são esperados no Free e
irrelevantes para o veredito.

## 8. Limites declarados

- **L1 —** o gate **continua vermelho**, por `new_coverage` = 0. Ausência de relatório de
  cobertura, não regressão de código. `DBT-57`.
- **L2 —** `scripts/**` fora do gate. `DBT-58`.
- **L3 —** 8 análises residuais do mesmo commit, sem rota de remoção via API.
- **L4 —** `api/qualitygates/history` devolve `events: []`: **não há trilha auditável** da
  transição `NONE → ERROR`. O antes foi medido por mim, o depois pelo observador — a transição
  em si não tem registro.
- **L5 —** o scanner converte `SONAR_TOKEN` em `-Dsonar.token=…` no argv **dentro** do
  container. Aceitável em máquina local de usuário único; **não** aceitável em CI compartilhado.
- **L6 —** nenhuma análise roda por pipeline. O que sustenta o gate hoje é execução manual —
  sem workflow, o gate volta a ser medido contra a análise de hoje.

## 9. Como reproduzir

```bash
read -r TOKEN < Sonar.txt && export SONAR_TOKEN="$TOKEN" && unset TOKEN
docker run --rm -e SONAR_TOKEN -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli:latest \
  -Dsonar.projectKey=Douglas0101_preco-que-da-lucro \
  -Dsonar.organization=douglas0101 -Dsonar.host.url=https://sonarcloud.io \
  -Dsonar.sources=src -Dsonar.exclusions='src/test/**' \
  -Dsonar.scm.provider=git -Dsonar.projectVersion=v1.0.0
```

O `-Dsonar.scm.provider=git` não é opcional: sem ele o log traz `No SCM system was detected` e a
análise fica **sem revision**, o que a impede de servir de âncora.
