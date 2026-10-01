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

_(preenchido depois das medições, sem editar o §4 acima)_
