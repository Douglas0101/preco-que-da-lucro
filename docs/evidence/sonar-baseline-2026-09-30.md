# SonarCloud — linha de base e viabilidade de re-análise (2026-09-30)

Artefato de medição do corte **DBT-55** (gate do SonarCloud reprovando no _código novo_ da release).
Escopo: **somente leitura**. Nenhum workflow foi editado, nenhum achado foi fechado/marcado como falso
positivo, nenhum arquivo de `DEBTS.md` ou do diário foi tocado. Capturas brutas em
`docs/evidence/sonar-baseline/captures/`.

---

## 1. Hipótese

A reprovação do gate não é uma regressão desta entrega: é dívida estática acumulada entre
**2026-09-13** e **2026-09-30** sendo medida como "código novo", porque a branch `main` **não é
analisada** desde 2026-09-13.

**Teste decisivo da hipótese (medido, não teorizado):** se a branch-base da PR #50 tivesse uma análise
recente, só o diff da PR estaria no período de _new code_. Se ela não tem, **todo** o histórico da
release entra.

---

## 2. Identificação do projeto

| item                    | valor medido                                                                      | fonte                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Host                    | `sonarcloud.io`                                                                   | `https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis.md` |
| Organização             | `douglas0101` (plano gratuito)                                                    | `ADR-034`, `.sonarcloud.properties`                                                        |
| **Project key**         | **`Douglas0101_preco-que-da-lucro`**                                              | `GET /api/users/current` + busca via MCP `search_my_sonarqube_projects`                    |
| Projeto irmão           | `Douglas0101_preco-que-da-lucro-public`                                           | mesma busca (não é o alvo)                                                                 |
| Arquivo de configuração | `.sonarcloud.properties` (raiz, `sonar.exclusions=drizzle/**,src/test/**,e2e/**`) | repositório                                                                                |
| Método de análise       | **Automatic Analysis** (SonarQube Cloud GitHub App)                               | header do próprio `.sonarcloud.properties` + docs                                          |

Não há `sonar-project.properties` no repositório e não há nenhuma chave `sonar.*` / `SONAR_*` em
`.github/workflows/` (6 workflows lidos: `ci-light.yml`, `neon-drill-ops.yml`, `neon-pr-branch.yml`,
`neon-preview.yml`, `neon-readiness.yml`, `ui-stack.yml`). **Não existe action de Sonar neste repo** —
a análise vem só do app de análise automática.

---

## 3. Estado da branch `main` (antes)

`GET /api/project_branches/list?project=Douglas0101_preco-que-da-lucro`

```
main  isMain=true  LONG
analysisDate = 2026-09-13T03:19:58+0000
commit.sha   = 9724d2c73b269d0a0199ea305308f3237b38fa09   ("Merge pull request #47 …")
status       = bugs 2 · vulnerabilities 5 · codeSmells 198
```

| métrica (branch `main`)                                              | valor                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Última data de análise                                               | **2026-09-13T03:19:58Z** (17 dias atrás na data desta evidência)                                       |
| Último commit analisado                                              | `9724d2c`                                                                                              |
| `ncloc` indexado                                                     | **35.666**                                                                                             |
| Issues abertas                                                       | `violations = 205` · `maintainability_issues = 193` · `reliability_issues = 8` · `security_issues = 5` |
| Issues abertas (contagem por tipo, `/api/issues/search?branch=main`) | **250** = 237 code smells + 7 vulnerabilidades + 6 bugs                                                |
| Quality gate em `main`                                               | `status = NONE`, **zero condições** (`qualitygates/project_status?branch=main`)                        |

Histórico completo de análises do projeto — **9 análises, nenhuma depois de 2026-09-13**:
`e5c26e2a` 2026-08-02 · `7cb72399` 2026-08-23 · `3a72eefe` 2026-09-05 · `8ccdc2ba` 2026-09-06 ·
`68c9fa2e` 2026-09-08 · `1f9f1a9b` 2026-09-10 · `d35bbd2a` 2026-09-11 · `43921279` 2026-09-12 ·
`8ddc102a` 2026-09-13 (a última).

**Cota não é o bloqueio agora:** `ncloc` de `main` = 35.666 e a análise da release = 40.181, ambos
abaixo do teto de 50.000 do plano gratuito. As exclusões da `ADR-034` estão em vigor e já cabem.

---

## 4. Prova da causa-raiz

### 4.1 Estado da PR #50 (a que reprovou)

| item                            | valor medido                                            | fonte                                    |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------- |
| Check run                       | `110099550817` · `SonarCloud Code Analysis` · `failure` | GitHub API                               |
| Início / fim                    | `2026-09-30T21:09:03Z` → `21:10:14Z`                    | GitHub API                               |
| Commit analisado                | `98d1b93e` (head da PR #50)                             | `/api/project_pull_requests/list`        |
| `analysisDate` do componente PR | `2026-09-30T21:09:03Z`                                  | `/api/components/show?pullRequest=50`    |
| `ncloc` analisado               | **40.181**                                              | `/api/measures/component?pullRequest=50` |
| `violations`                    | **408**                                                 | idem                                     |
| `new_violations` (período 1)    | **408**                                                 | idem                                     |

### 4.2 O teste decisivo

```
GET /api/issues/search?componentKeys=…&pullRequest=50                 → total = 408
GET /api/issues/search?componentKeys=…&pullRequest=50&sinceLeakPeriod=true → total = 408
```

**Os 408 achados são, todos, achados de _new code_.** Zero achado da PR está fora do período de
vazamento. É a assinatura exata de uma branch-base sem análise recente: o diff inteiro da release é
contado como código novo. **Hipótese confirmada por medição.**

### 4.3 Distribuição (medida, por tipo × severidade)

| tipo (qualidade)               | total   | BLOCKER | CRITICAL | MAJOR | MINOR | INFO |
| ------------------------------ | ------- | ------- | -------- | ----- | ----- | ---- |
| `CODE_SMELL` (maintainability) | **374** | 0       | 30       | 74    | 268   | 2    |
| `VULNERABILITY` (security)     | **19**  | 2       | 2        | 5     | 10    | 0    |
| `BUG` (reliability)            | **15**  | 0       | 11       | 4     | 0     | 0    |
| **total**                      | **408** | 2       | 43       | 83    | 278   | 2    |

> **Correção factual ao terreno do MAESTRO.** O briefing e a linha da `DEBTS.md` dizem
> _356 maintainability, 71 reliability, 19 security_ e _"a única condição que falha é
> `new_reliability_rating = 4`"_. A API e o check run medem outra coisa:
> **374 / 15 / 19**, e **duas** condições reprovam, não uma — `new_reliability_rating = 4` **e**
> `new_security_rating = 5`.
> Fonte: `captures/qg_pr50.json` + `captures/gh-checkrun-pr50-sonar.json`, cujo resumo literal é
> _"Failed conditions — E Security Rating on New Code (required ≥ A) · D Reliability Rating on New
> Code (required ≥ A)"_.

### 4.4 Quality gate da PR #50 — condição por condição

`GET /api/qualitygates/project_status?projectKey=…&pullRequest=50` → `status = ERROR`

| condição                         | comparador | limite | valor   | veredito  |
| -------------------------------- | ---------- | ------ | ------- | --------- |
| `new_reliability_rating`         | `GT`       | `1`    | **4.0** | **ERROR** |
| `new_security_rating`            | `GT`       | `1`    | **5.0** | **ERROR** |
| `new_maintainability_rating`     | `GT`       | `1`    | 1.0     | OK        |
| `new_duplicated_lines_density`   | `GT`       | `3`    | 2.7     | OK        |
| `new_security_hotspots_reviewed` | `LT`       | `100`  | 100.0   | OK        |

`maintainability` e `duplication` estão dentro do limite; **`security` reprova com rating E** e não
passa. Um re-baseline de `main` resolveria a _origem_ (o gate voltaria a medir a release inteira como
código já existente), mas os 19 `VULNERABILITY` e os 15 `BUG` **continuam abertos** e continuam a ser
o que um PR futuro mediria como código novo. Isso é fato medido, não previsão.

---

## 5. `fd9449f` e `789e9a1`: foram analisados?

| commit                                     | é o que                                           | análise no Sonar?                                                                                                                                                     | check run no GitHub?                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fd9449f3a29a0c93221fb682c646c4e444c314b8` | merge do PR #50 em `main`, `2026-09-30T21:49:05Z` | **NÃO.** `analysisDate` de `main` continua `2026-09-13T03:19:58Z`; o SHA não aparece em `project_branches/list` nem em `project_analyses/search`                      | **NÃO.** Os 7 check runs do commit são `docs-light` ×2, `verify`, `Dependabot` ×3, `.github/dependabot.yml` — **nenhum Sonar** (`captures/gh-checkruns-main-merge.json`) |
| `789e9a1`                                  | HEAD de `c18/sonar-exclusion`                     | **NÃO.** `project_branches/list` devolve **só** `main`; e a análise automática **não suporta** branch que não seja a default nem branch de PR (limitação documentada) | **NÃO.** 2 check runs: `Vercel Preview Comments`, `docs-light` (`captures/gh-checkruns-head-789e9a1.json`)                                                               |

### 5.1 O app está vivo — e mesmo assim nada analisou `main`

Este é o ponto que fecha o diagnóstico. No mesmo minuto do push em `main`:

| evento                             | horário (UTC)                      | resultado                                                                                    |
| ---------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| push do merge `fd9449f` em `main`  | `2026-09-30T21:49:05Z`             | **nenhum** check Sonar                                                                       |
| PR #51 (head `d08b7621`) analisada | `2026-09-30T21:50:08Z`             | check `SonarCloud Code Analysis` = **success**, "Quality Gate passed", concluído `21:50:46Z` |
| PRs #52–#57 analisadas             | `2026-09-30T21:50:12Z`–`21:50:44Z` | 6 análises de PR em 32 s                                                                     |

O GitHub App do SonarQube Cloud estava **plenamente operacional** — analisou 7 PRs em menos de um
minuto — e mesmo assim não produziu análise nem check para o push em `main`. A documentação afirma que
_"automatic analysis runs whenever you push to the default branch"_; o comportamento medido diverge.

`git log -1 fd9449f` → primeiro pai = `9724d2c`, exatamente o commit da última análise de `main`;
autor e committer datados de `2026-09-30T21:49:05Z`. Não é problema de data de commit.

**Motivo: não determinável deste ambiente.** Ver §7.

---

## 6. É possível disparar uma re-análise daqui?

### 6.1 Token

| pergunta                      | resposta medida                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SONAR_TOKEN` no ambiente?    | **UNSET** (`printenv \| grep -i sonar` → vazio). Confirma o terreno do MAESTRO.                                                                                                                                                                                                                                                                                      |
| Existe credencial utilizável? | **SIM.** O arquivo gitignored `Sonar.txt` (41 B, `0600`) contém um token de 40 caracteres. `GET /api/authentication/validate` → **`{"valid": true}`**, HTTP **200**. Identidade: `Douglas0101-LJ0jL@github`. **O valor jamais foi impresso, copiado para fora do processo, nem para esta evidência.** O header foi injetado por `curl -K -` (stdin), fora de `argv`. |

### 6.2 Trigger manual por API — **NÃO EXISTE** (medido)

```
POST /api/analysis_engine/reanalyze?project=…&branch=main   → HTTP 404
     {"errors":[{"msg":"Unknown url : /api/analysis_engine/reanalyze"}]}
POST /api/analysis_engine/reanalyze?project=…                → HTTP 404 (mesma resposta)
```

O endpoint não existe no SonarQube Cloud. Varredura completa da superfície da API
(`GET /api/webservices/list` → 33 serviços) procurando `analy*`/`trigger*`: **nenhuma** ação de
disparo de análise. As únicas relacionadas são
`api/project_analyses/{search,delete,create_event,delete_event,update_event,set_baseline,unset_baseline}`
e `api/ce/task` (leitura de tarefa).

### 6.3 `set_baseline` — existe, mas **não serve** para DBT-55 (e não foi executado)

```
POST /api/project_analyses/set_baseline
  "Set an analysis as the baseline of the New Code Period on a project or a long-lived branch.
   This manually set baseline overrides the `sonar.leak.period` setting.
   Requires the permission 'Administer' on the specified project."
  params: analysis (obrigatório) · project (obrigatório) · branch (opcional)
```

Duas razões para **não** executá-lo, ambas medidas:

1. **Escopo insuficiente:** a descrição diz _"a project or a long-lived branch"_ — **pull requests não
   são aceitos**. A PR #50 está mergeada/fechada; o período de vazamento dela não é re-baselineável
   por esta rota.
2. **É uma mutação de semântica de gate**, não um disparo de análise. Ela mudaria _o que o gate mede_
   sem reduzir um único achado. O briefing deste slice proíbe explicitamente enfraquecer achado
   existente. Não foi chamada — nem em dry-run, porque um dry-run não existe.

### 6.4 Trigger por CI — **bloqueado por desenho**

Documentação (`automatic-analysis` → _Conflict with CI-based analysis_):

> _"If you enable automatic analysis, you must ensure that you do not have any CI-based analyses
> configured. If you do then these CI-based analyses will fail and cause a failure in your build
> process."_

Adicionar `sonarqube-scan-action` ao `ui-stack.yml` **quebraria o build** enquanto a análise
automática estiver ligada — e o briefing proíbe editar workflow. E desligar a análise automática é
ação de UI, inacessível por API: `POST /api/settings/set` não controla o método de análise, e o
toggle da organização é restrito ao plano **Enterprise**
(`…/setting-config-at-org-level/disabling-automatic-analysis.md`: _"This feature is only available in
the Enterprise plan"_). O projeto é **Free**.

### 6.5 Trigger pela UI

O modo Automatic Analysis substitui o botão _"Manually trigger"_ por _"Analyzed by SonarQube Cloud"_
(Last analysis method, em _Project information_); não há re-run de análise automática para a branch
default na documentação. Não verificável por API — declarado em §7.

---

## 7. Limites declarados

1. **O motivo pelo qual o push em `main` não gerou análise é desconhecido.** A documentação diz
   explicitamente _"Automatic analysis logs are not available"_, e o `analysis_date` de `main` não
   mudou. As hipóteses que sobram — a análise foi enfileirada e descartada sem check; ou a app está
   com um filtro de evento; ou o limite de análises de branch default do plano Free — **não são
   distinguíveis a partir da API pública**. Não chutei.
2. **Nenhuma mutação no SonarQube Cloud foi executada.** Zero `POST` que altere estado (as duas
   tentativas de `reanalyze` retornaram 404 sem efeito; `set_baseline` não foi chamada). Consequência:
   **não existe análise nova para reportar** — caminho (b) do aceite.
3. **A definição de _new code_ não pôde ser lida.** `GET /api/settings/values` para
   `sonar.leak.period` / `sonar.leak.period.type` (as chaves reais, conforme
   `configuring-new-code-calculation.md`) devolve **`{"settings":[]}`** — o valor efetivo é o default
   da organização e só é visível na tela **Administration ▸ New Code**. Registrado como **N/A**, não
   como chute. Indício lateral: `/api/components/show?pullRequest=50` devolve
   `version = "not provided"`, o que torna a opção _Previous version_ inoperante para este projeto.
4. **`/api/qualitygates/project_status` para `main` devolve `status = NONE` com zero condições.**
   Não interpretei como "verde" nem como "gate vazado": é ausência de veredito, e ausência de
   veredito nunca é verde.
5. **Não houve push, merge ou alteração em nenhum branch.** Nada nesta evidência muda `main`,
   `develop`, `c18/sonar-exclusion` nem `c18/state-marker`.
6. **`789e9a1` nunca será analisado por esta via.** A branch `c18/sonar-exclusion` não é a default e
   não é branch de PR; a limitação é documentada. O gate do ciclo vive na branch de release/PR.

---

## 8. A ação humana exata que desbloqueia

**Uma só, e ela é um push em `main`** — nada mais nesta plataforma dispara uma análise da branch
default. O MAESTRO decide; o slice só nomeia o caminho e o critério de verificação.

### Ação

Abrir um PR para `main` (por exemplo, mesclar um dos 7 PRs `#51`–`#57` do Dependabot, todos
`MERGEABLE` nesta data) **ou** fazer um commit direto em `main` — e **aguardar o check
`SonarCloud Code Analysis` aparecer no commit de `main`**.

Preferência do documento, se houver escolha de estratégia de merge
(`configuring-new-code-calculation` → _Additional setup and recommendations_):

> _"We also recommend completing your merges using the fast-forward option without a merge commit;
> examples include GitHub's squash and merge or rebase and merge options. That way, blame for merged
> commits will always have a more recent commit date."_

Isto é, dado que o merge `fd9449f` **não** produziu análise, **usar squash ou rebase em vez de merge
commit** é a variante com menor chance de repetir o silêncio.

### Critério de verificação (falha fechada)

O re-baseline **só vale** quando, e somente quando, estas quatro medições voltarem:

1. `GET /api/project_branches/list?project=Douglas0101_preco-que-da-lucro` →
   `main.analysisDate` **> 2026-09-30** e `main.commit.sha` = o commit de `main` recién empurrado.
2. O check `SonarCloud Code Analysis` **existe** nesse commit de `main` (`gh api …/check-runs`).
3. `GET /api/issues/search?componentKeys=…&pullRequest=<novo PR>&sinceLeakPeriod=true` → o total cai
   para o tamanho real do diff do PR, não para o tamanho da release inteira.
4. `GET /api/qualitygates/project_status?…&pullRequest=<novo PR>` → o gate passa a medir o PR.

**Enquanto (1) e (2) não forem verdade, DBT-55 continua aberto.** Ausência de análise não é verde.

### Caminho alternativo, se a análise automática continuar muda em `main`

Desligar a análise automática no nível do **projeto** —
`https://sonarcloud.io/dashboard?id=Douglas0101_preco-que-da-lucro` ▸ **Administration ▸ Analysis
Method** ▸ _Automatic Analysis_ **OFF** — e só então adicionar a action
`sonarqube-scan-action` ao CI usando o secret **`SONAR_TOKEN`** (nome do secret; **valor nunca sai da
conta emissora**). Custo desta variante: **muda o método de análise do projeto inteiro**, tira a
análise de PR de graça e reintroduz o custo de CI por push — decisão do MAESTRO, não deste slice.

### O que este slice **não** recomenda

Não marcar os 19 `VULNERABILITY` nem os 15 `BUG` como falso positivo, não excluí-los do escopo e não
chamar `set_baseline`: as três coisas fariam o gate passar sem reduzir um único defeito, e as três
estão proibidas pelo contrato desta slice e pela `ADR-034`.

---

## 9. Índice de capturas

`docs/evidence/sonar-baseline/captures/`

| arquivo                                       | o que prova                                                           |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `branches.json`                               | `main.analysisDate = 2026-09-13`, `ncloc 35.666`, commit `9724d2c`    |
| `analyses.json`                               | as 9 análises do projeto; nenhuma depois de 2026-09-13                |
| `prs.json`                                    | PR #50 e PRs #51–#57 com datas de análise de 2026-09-30               |
| `qg_pr50.json` / `qg_main.json`               | veredito `ERROR` da PR #50 e `NONE` (sem condições) de `main`         |
| `pr50_new.json` / `newmeas.json`              | `new_violations = 408`, ratings de código novo, `ncloc = 40.181`      |
| `iss_pr50.json` / `iss_pr50_new.json`         | **408 = 408** — todos os achados da PR são _new code_                 |
| `iss_main.json`                               | 250 achados abertos em `main` (dívida da linha de base de 2026-09-13) |
| `reanalyze_main.json` / `reanalyze_proj.json` | o endpoint de disparo **não existe** (404)                            |
| `settings.json` / `leak.json`                 | `{"settings":[]}` — a definição de _new code_ não é legível por API   |
| `gh-checkruns-main-merge.json`                | `fd9449f` **não tem** check Sonar                                     |
| `gh-checkruns-head-789e9a1.json`              | `789e9a1` **não tem** check Sonar                                     |
| `gh-checkrun-pr50-sonar.json`                 | check `110099550817` = `failure`, **duas** condições em ERROR         |

Verificado por varredura: nenhuma captura contém header `Bearer`, prefixo `squ_`/`sqa_`, e-mail ou
login de autor. Blocos `author`/`contributors` foram removidos das capturas de análise; as capturas
de issues trazem só agregados (`total` + `facets`), nunca as linhas.
