# Ciclo 22 — Fase 3: gatilho `pull_request` exercitado, com controle negativo OBSERVADO

- **Data:** 2026-10-01 · **PR de exercício:** #58 (descartável, fechada **sem merge**, branch apagado)
- **Base do exercício:** `develop` — de propósito: `origin/main` **não tem** `sonar.yml`, e os 7 PRs abertos vão todos para `main`, então nenhum deles exercita o gatilho.

---

## 1. Por que o exercício veio DEPOIS do fix de atribuição

Uma PR analisada **sem** `sonar.pullrequest.key/branch/base` produziria análise de branch gravada como `main` de novo — verde com a atribuição errada. Exercitar o gatilho antes do fix teria validado um pipeline defeituoso e produzido **outro verde sem significado**, que é a classe de problema que este ciclo existe para eliminar.

---

## 2. As três observações

| #   | observação                                                             | resultado medido                                                                                                                                                              |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | o gatilho `pull_request` dispara o `sonar.yml`?                        | **SIM** — run `36861864687`… o workflow `SonarCloud (scanner + cobertura)` rodou com `event=pull_request` e concluiu **success**, com o scanner atribuindo `pull request #58` |
| 2   | com `-Dsonar.javascript.lcov.reportPaths` **removido**, o guard falha? | **SIM** — run do commit mutado: `failure  Conferir que a cobertura foi CONSUMIDA`                                                                                             |
| 3   | com a propriedade **restaurada**, o guard passa?                       | **SIM** — `success  Conferir que a cobertura foi CONSUMIDA`                                                                                                                   |

**Controle negativo por OBSERVAÇÃO, não por construção** — que é a lição que o ERRATA do Ciclo 21 codificou: a mutação foi aplicada, o run foi observado, e o guard falhou de fato.

---

## 3. O achado que o exercício produziu: o guard anterior era mais fraco do que parecia

A mutação **não** derrubou o workflow: ele passou **8/8** com o relatório de cobertura presente e **não consumido**. Medição direta: com a propriedade removida, o sensor `Sensor JavaScript/TypeScript Coverage` **não rodou** (0 ocorrências no log) — ou seja, o analyze mediria **0 % em silêncio**.

É o modo de falha do `DBT-57` **renascendo dentro do próprio remédio**, e o guard que existia não o via: ele conferia que o **arquivo** lcov existe, não que o scanner o **leu**. Um guard que olha o arquivo não vê o relatório que ninguém leu.

**Remédio aplicado** (em `develop`, commit `9d197d0`): a saída do scanner passa por `tee` e um passo seguinte **falha** quando o sensor de cobertura não roda. Observado nos dois sentidos no branch de exercício.

---

## 4. O que o exercício também revelou (e foi corrigido no caminho)

O PR de exercício nasceu com o marcador de estado **14 commits atrás** (orçamento 13) e por isso `docs-light` e `verify` falharam em 42 s. A causa era minha: cinco commits do Ciclo 22 avançaram o `develop` sem re-pinar. Corrigido em `3354cca` — e o `temporal-guard` pegou, no mesmo passo, um erro meu de redação (um id de análise do Sonar em crases, que não resolve como objeto do git).

---

## 5. Limites

- A PR de exercício foi **fechada sem merge** e o branch **apagado** — nada dela entra na linhagem.
- O `sonar.yml` **não** está em `main`; o backport depende da release (DECISÃO 3), que é do MAESTRO.
- `DBT-59` segue **ABERTA** e pode continuar assim sem custo: com a atribuição explícita, o scanner é dono do veredito **independentemente** do estado do toggle da Automatic Analysis — que permanece **desconhecido**, nomeado e não bloqueante.
