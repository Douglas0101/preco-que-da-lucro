# Ciclo 19 — Quarentena DBT-55 (gate do SonarCloud) — registro do slice (2026-09-30)

Slice **somente-leitura**. Não tocou em workflow, não tocou em `DEBTS.md` nem no diário, não
fechou/marcou/degradou nenhum achado do Sonar, não fez push nem merge em nenhum branch.

A medição completa está em [`sonar-baseline-2026-09-30.md`](./sonar-baseline-2026-09-30.md); as
capturas brutas em `sonar-baseline/captures/`. Este arquivo registra **o que foi consultado, o que
foi observado e o que não foi possível** — e por quê.

---

## 1. Veredito do slice

**Caminho (b) do aceite: NÃO é disparável deste ambiente.** Nenhuma análise foi criada, nenhuma foi
re-baselineada, nenhum número pós-baseline existe — e nenhum é reportado como se existisse.

O bloqueio não é "não tenho token". **Token válido existe** e a API respondeu 200 em todas as
consultas. O bloqueio é de **plataforma**: o projeto está em **Automatic Analysis**, e o SonarQube
Cloud **não expõe nenhum endpoint de disparo de análise** (`POST /api/analysis_engine/reanalyze` →
`404 Unknown url`; nenhuma ação de disparo em toda a superfície de 33 serviços da API).

---

## 2. O que foi consultado

### 2.1 Repositório

| consulta                                                  | resultado                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `grep -i sonar` no repo                                   | chave do projeto **só** em `docs/**` e `.gitignore`; nenhum `sonar.*` de execução                            |
| `.sonarcloud.properties`                                  | `sonar.exclusions=drizzle/**,src/test/**,e2e/**`; header diz _"SonarCloud Automatic Analysis configuration"_ |
| `.github/workflows/**` (6 arquivos) + `grep sonar\|SONAR` | **0** ocorrências. Nenhum step de Sonar, nenhum secret de Sonar                                              |
| `printenv \| grep -i sonar`                               | vazio — `SONAR_TOKEN` **UNSET** (confirma o terreno do MAESTRO)                                              |
| `git log -1 fd9449f` / `9724d2c` / `789e9a1`              | merge do PR #50 tem `9724d2c` como primeiro pai                                                              |

### 2.2 SonarQube Cloud (API, token de `Sonar.txt`, injetado por `curl -K -` — fora de `argv`)

| #   | chamada                                                      | o que devolveu                                                                                               |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | `GET /api/authentication/validate`                           | **200** `{"valid":true}` · identidade `Douglas0101-LJ0jL@github`                                             |
| 2   | MCP `search_my_sonarqube_projects`                           | 2 projetos; alvo = `Douglas0101_preco-que-da-lucro`                                                          |
| 3   | MCP `get_component_measures` (`main`)                        | `ncloc 35666`, `violations 205`, sem `new_*`                                                                 |
| 4   | `GET /api/project_branches/list`                             | **só** `main`; `analysisDate 2026-09-13T03:19:58Z`; `sha 9724d2c`                                            |
| 5   | `GET /api/project_analyses/search?ps=100`                    | **9** análises, última `8ddc102a` 2026-09-13                                                                 |
| 6   | `GET /api/project_pull_requests/list`                        | **34** PRs; #50 em `21:09:03Z`; #51–#57 em `21:50:08Z`–`21:50:44Z`                                           |
| 7   | `GET /api/components/show?pullRequest=50`                    | `analysisDate 2026-09-30T21:09:03Z`, `version "not provided"`                                                |
| 8   | `GET /api/measures/component?pullRequest=50`                 | `violations 408`, `new_violations 408`, `ncloc 40181`, ratings `4.0 / 5.0 / 1.0`, dup `2.68`, hotspots `100` |
| 9   | `GET /api/qualitygates/project_status?pullRequest=50`        | **`ERROR`** — 5 condições, **2** em ERROR                                                                    |
| 10  | `GET /api/qualitygates/project_status?branch=main`           | **`NONE`**, `conditions: []`                                                                                 |
| 11  | `GET /api/issues/search?pullRequest=50`                      | `total 408`                                                                                                  |
| 12  | `GET /api/issues/search?pullRequest=50&sinceLeakPeriod=true` | `total 408` ← **a prova**                                                                                    |
| 13  | `GET /api/issues/search?branch=main`                         | `total 250` (237/7/6)                                                                                        |
| 14  | `GET /api/issues/search` por tipo, PR #50                    | smells **374**, vulns **19**, bugs **15**                                                                    |
| 15  | `GET /api/settings/values` (`sonar.leak.period`, `.type`)    | `{"settings":[]}`                                                                                            |
| 16  | `GET /api/webservices/list`                                  | 33 serviços; **nenhuma** ação de disparo de análise                                                          |
| 17  | **`POST /api/analysis_engine/reanalyze?…&branch=main`**      | **404** `Unknown url`                                                                                        |
| 18  | **`POST /api/analysis_engine/reanalyze?…`**                  | **404** `Unknown url`                                                                                        |

### 2.3 GitHub (via `gh`, já autenticado)

| #   | consulta                                          | resultado                                                                                       |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 19  | check runs de `fd9449f` (merge em `main`)         | 7 runs: `docs-light` ×2, `verify`, `Dependabot` ×3, `dependabot.yml` — **nenhum Sonar**         |
| 20  | check runs de `789e9a1`                           | 2 runs: `Vercel Preview Comments`, `docs-light` — **nenhum Sonar**                              |
| 21  | check runs de `98d1b93e` (head da PR #50)         | `SonarCloud Code Analysis` = **failure**, `110099550817`, `21:09:03Z`→`21:10:14Z`               |
| 22  | resumo do check `110099550817`                    | **duas** condições: _E Security on New Code_ e _D Reliability on New Code_                      |
| 23  | check runs de `9724d2c` (última `main` analisada) | `SonarCloud Code Analysis` = **neutral**, _"Quality Gate not computed"_, `2026-09-13T03:20:54Z` |
| 24  | check runs de `d08b7621` (PR #51)                 | `SonarCloud Code Analysis` = **success**, `21:50:46Z`                                           |
| 25  | `gh pr list --state open`                         | PRs #51–#57 abertas, todas `MERGEABLE`, base `main`                                             |

---

## 3. O que foi observado

1. **A causa-raiz do briefing está confirmada por um teste, não por inferência.**
   `pullRequest=50` → 408 achados; `pullRequest=50&sinceLeakPeriod=true` → **408 achados**.
   _Todos_ os achados da release estão no período de vazamento, porque `main` não tem análise desde
   2026-09-13. Não há um achado da release que esteja "fora" do baseline.
2. **`fd9449f` nunca foi analisado** e **não tem check Sonar**, apesar de `main` ter avançado.
3. **`789e9a1` nunca foi analisado** e não pode ser pela via atual: a análise automática só cobre a
   branch default e branches de PR (limitação documentada), e `project_branches/list` devolve só `main`.
4. **O app de análise automática estava funcionando.** No minuto do push em `main` ele analisou
   **7 PRs** (#51–#57) com check verde na #51. A ausência em `main` não é indisponibilidade do serviço.
5. **Correção factual ao terreno recebido** (para o MAESTRO, que decide o fechamento):
   - distribuição real = **374 maintainability / 15 reliability / 19 security** (não 356/71/19);
   - **duas** condições reprovam, não uma: `new_reliability_rating = 4` **e** `new_security_rating = 5`;
   - duplicação real = `2.7` (limite `3`), hotspots `100` (limite `100`), maintainability `1` (limite `1`).
     Isto muda o alcance do fechamento: fechar DBT-55 exige resolver **segurança** também, não só
     confiabilidade — ou declarar explicitamente que o re-baseline apenas move o marco.
6. **A cota de 50.000 LOC não está bloqueando agora:** `main` = 35.666 ncloc, release = 40.181 ncloc.
   A redução de escopo da `ADR-034` **não** pode ser contada como o fechamento de DBT-55, como o
   próprio briefing já determinava.

---

## 4. O que NÃO foi possível, e por quê

### 4.1 Não foi possível disparar uma re-análise — bloqueio de plataforma

- `POST /api/analysis_engine/reanalyze` → **404 `Unknown url`** (o endpoint não existe no SonarQube Cloud).
- Varredura de toda a API (33 serviços): **nenhuma** ação de trigger.
- CI-based analysis: **proibida** enquanto a análise automática estiver ligada — a doc é explícita
  (_"these CI-based analyses will fail and cause a failure in your build process"_), e desligar a
  análise automática na organização é restrito ao plano **Enterprise**; esta org é **Free**.
- Nenhum workflow pode ser editado (proibido pelo slice), e nenhum botão de UI é alcançável de cá.

### 4.2 Não foi possível saber **por que** o push em `main` não gerou análise

A documentação declara _"Automatic analysis logs are not available"_. Não há check run, não há
`analysisDate` novo, não há tarefa em `api/ce/task`. As hipóteses restantes — análise enfileirada e
descartada, filtro de evento na app, limite de análises de branch default no plano Free — **não são
distinguíveis pela API pública**. Registrado como **N/A**. Nenhuma foi adotada como verdade.

### 4.3 Não foi possível ler a definição de _new code_

`GET /api/settings/values` devolve `{"settings":[]}` para `sonar.leak.period` e
`sonar.leak.period.type`. O valor efetivo é o default da organização e só aparece em
**Administration ▸ New Code**. Registrado como **N/A** com o gap declarado — não como chute.

### 4.4 Não foi executado `set_baseline` — e por quê

`POST /api/project_analyses/set_baseline` existe e está documentado
(_"Set an analysis as the baseline of the New Code Period on a project or a long-lived branch"_,
requer `Administer`). Não foi chamada por duas razões medidas:

- **não alcança o alvo** — pull requests não são aceitos por essa rota, e a PR #50 está mergeada;
- **é mutação de semântica de gate**, não disparo de análise: mudaria _o que é medido_ sem reduzir
  um único defeito, o que o contrato do slice proíbe.

### 4.5 Ausência de veredito nunca foi lida como verde

`qualitygates/project_status?branch=main` → `status = NONE` com `conditions: []`. Registrado como
**ausência de veredito**, que é exatamente o que é. Não há, neste slice, nenhuma afirmação de verde.

---

## 5. Ação humana exata

**Um push em `main`.** É o único gatilho de análise da branch default que existe nesta plataforma.
Detalhamento, critério de verificação falhado-fechado e a variante alternativa (desligar a análise
automática no nível do projeto e passar a CI) estão em
[`sonar-baseline-2026-09-30.md` §8](./sonar-baseline-2026-09-30.md).

Em uma linha: **mergear um dos PRs #51–#57 (preferencialmente squash/rebase, não merge commit) ou
commitar direto em `main`; o re-baseline só vale quando `main.analysisDate > 2026-09-30` e existir
check `SonarCloud Code Analysis` no commit de `main`.**

---

## 6. Higiene do slice

- Nenhum segredo entrou no contexto, no `argv` ou nesta evidência. Token lido de `Sonar.txt` via
  `curl -K -` (stdin); só `len=40` e `{"valid":true}` foram registrados.
- Capturas verificadas por varredura: **nenhum** header `Bearer`, prefixo `squ_`/`sqa_`, e-mail ou
  login de autor. `author`/`contributors` removidos das capturas de análise; as capturas de issues
  guardam só agregados (`total` + `facets`).
- Nenhum arquivo rastreado foi modificado exceto os dois documentos desta evidência; nenhum arquivo
  em `docs/evidence/local-ci/**` foi tocado.
- `npm run check`, `npm run build`, formatadores e linters **não** foram executados — são do
  MAESTRO, uma vez, depois da integração.

## 7. Recomendação ao MAESTRO (decisão, não executada)

O estado de DBT-55 **permanece o que é**. Este slice entrega a medição que faltava — inclusive a
correção de que o gate falha em **duas** dimensões, não uma — e o caminho de desbloqueio com critério
de verificação. O fechamento, a política de segurança e qualquer mutação no SonarQube Cloud são
decisão do MAESTRO.
