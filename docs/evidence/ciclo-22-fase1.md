# Ciclo 22 — Fase 1: as 4 probes e o denominador do DBT-57

- **Data:** 2026-10-01 · **Base:** `a2f14f6` (develop)
- **Regra desta fase:** a semântica de nulo foi declarada **antes** de qualquer request, e está no §4
  abaixo, commitada separadamente. Probe com nulo ambíguo e **sem controle positivo** não é evidência.

---

## 4. Semântica de nulo — DECLARADA ANTES DE MEDIR

Para cada probe: o que **POS** significa, o que **nulo** significa, e qual nulo é **ambíguo**.

| #   | request                                                                                | POS significa                                                                                 | nulo significa                        | nulo ambíguo?                                                                          | controle positivo                                                                        |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| P1  | `GET api/project_branches/list?project=<key>`                                          | `develop` com análise recente ⇒ **o scanner produziu** (a Automatic Analysis não cria branch) | "só `main`"                           | **SIM** — "só `main`" é indistinguível de "nada foi pushado para branch"               | correlacionar com **P3** (a análise por commit nomeia a origem)                          |
| P2  | `GET api/ce/activity?component=<key>` + `submittedAt` na janela 02:53–02:56Z           | **duas identidades de submitter** ⇒ duas superfícies de análise                               | uma só tarefa na janela               | parcial                                                                                | correlação temporal com P3                                                               |
| P3  | `GET api/project_analyses/search?component=<key>&from=…` → casar `revision` por commit | **nomeia a análise em vigor por commit**                                                      | nenhuma análise com aquele `revision` | **NÃO** — é o oráculo desta fase                                                       | é ele mesmo o controle                                                                   |
| P4  | `GET api/autoscan/eligibility?project=<key>`                                           | idem P1                                                                                       | "não elegível" / vazio                | **SIM, GRAVE** — vazio pode ser "não elegível", "chave sem permissão" ou "não exposto" | **OBRIGATÓRIO**: chave real + chave falsa, mesmo shape. **Sem o par 200/404, descartar** |

**Regra de descarte, escrita antes:** qualquer probe cujo resultado seja **nulo ambíguo** e que não
tenha passado pelo controle positivo é registrada como **NULO-AMBÍGUO-DESCARTADO** — nunca como NEG.

**Armadilha declarada:** token via **env/stdin**, nunca no `argv` do comando. Se qualquer probe falhar
por autenticação, **parar e reportar** — não repetir três vezes (limite do Modo Fechamento).

---

## 5. Resultados

### 5.1 Placar das probes

| #   | veredito                 | resultado medido                                                                                                                                                                                                                                        |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **POS**                  | `main` com análise de **2026-10-01T02:55:04Z**, `commit = 2d73fa32`; **`develop` = "nunca" analisada**. A Automatic Analysis não analisa push de `develop` e deixaria a branch criada — como `develop` não existe no Sonar, **a análise é do scanner**. |
| P2  | **NEG** (não discrimina) | As duas tarefas do CE têm **a mesma identidade** de submitter (`Douglas0101-LJ0jL@github`) e `hasScannerContext: true` nas duas. O campo **não** separa App de scanner.                                                                                 |
| P3  | **POS**                  | Oráculo por commit, sem ambiguidade: para `2d73fa3` a análise é **`12c3d53a`**, submetida 02:55:55Z, executada 02:56:01Z.                                                                                                                               |
| P4  | **POS (probe válido)**   | Controle positivo **funcionou**: chave real → **200** com `{"eligible": true, languages:[…]}`; chave falsa → **404** `Project 'Douglas0101_nao-existe-xyz' doesn't exist`. **Mas o campo responde elegibilidade, não o estado do toggle.**              |

**Estado do toggle da Automatic Analysis: continua DESCONHECIDO.** P4 prova que o projeto **é elegível**, e nada além disso; P2 não discrimina. Era exatamente o que o `DBT-59` reescrito previa — e a resposta honesta é "não verificado", não "coexistem".

### 5.2 F1.5 — o enigma do 63,3 % RESOLVIDO

O `new_coverage` = 63,3 pertence à análise **`12c3d53a`**, de `revision` **`2d73fa3`** — um commit de **`develop`** — **atribuída à branch `main`**. E `develop` **nunca** foi analisada (P1). Conclusões medidas:

1. O `branch=main` do check-run **não é artefato de re-atribuição**: é o que o Sonar realmente gravou.
2. Quem produziu foi o **scanner do CI**, não a Automatic Analysis — a App não analisa push de `develop` sem criar a branch, e a branch não existe.
3. **Achado novo, e é um defeito:** o scanner do workflow roda **sem `sonar.branch.name`**, então **toda** análise de qualquer branch é arquivada como análise de `main`. Consequência: a árvore de `develop` **sobrescreve** a análise de `main`, e o "código novo" do gate passa a ser medido contra um histórico que não corresponde à branch analisada. Registrado como **`DBT-61`** — não consertado aqui (a F2 entrega o closure test; a correção da atribuição é decisão da fase seguinte).
4. O denominador do `DBT-57` é, portanto, **o código novo de `develop` medido sob a análise de `main`** — o que a F4.5 traduz de p.p. para linhas.

### 5.3 Capturas

`/tmp/c22/captures/` — `p1-branches.json`, `p2-ce.json`, `p3-analyses.json`, `p4a-real.json`, `p4b-falsa.json`. Nenhuma contém segredo (só respostas da API pública do projeto).
