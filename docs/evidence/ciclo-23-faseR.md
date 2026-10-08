# Ciclo 23 — Fase R: release `v1.0.1` e verificação pós-release

- **Data:** 2026-10-01 · **PR:** #59 · **Merge:** `d4b9395` · **Tag:** `v1.0.1`
- **Regra aplicada:** semântica de nulo declarada antes de medir; premissa caída vira ERRATA.

---

## 1. R1 — release

| passo | resultado medido                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R1.1  | PR #59 `develop → main` aberta; `mergeable=MERGEABLE`                                                                                       |
| R1.2  | `ui-stack`/`verify`: **vermelho 2×** por e2e intermitente → **`DBT-63`** registrada; re-execução do **mesmo commit** passou (4m56s e 6m47s) |
| R1.3  | merge commit `d4b9395` — **merge commit, não squash/rebase**: o repo proíbe reescrever histórico publicado (`AGENTS.md`, aviso Lovable)     |
| R1.4  | push de `main` **disparou** o `SonarCloud (scanner + cobertura)` = **success**                                                              |
| R1.5  | tag anotada **`v1.0.1`** publicada                                                                                                          |

### R1.4 — o instrumento da F2 provou o desenho

`which-analysis.ts d4b9395`:

```json
{
  "revision": "d4b9395",
  "named": true,
  "branch": "main",
  "analysisKey": "1dc2baf9-…",
  "origin": "scanner",
  "importedCoverage": true,
  "attributionMismatch": false
}
```

Análise **nomeada por commit**, atribuída a `main`, origem **provada** por cobertura importada (a
Automatic Analysis não importa cobertura), **sem desvio de atribuição**. É a verificação que o Ciclo
22 construiu sendo usada no primeiro release depois dele.

---

## 2. R2 — verificação pós-release

| #    | verificação          | resultado                                                                                      |
| ---- | -------------------- | ---------------------------------------------------------------------------------------------- |
| R2.1 | cota do maior branch | **20.256 / 50.000** → folga **29.744**; gatilho D2 (45k) **não disparado**                     |
| R2.2 | **F4.4 FECHADA**     | `main` agora tem `sonar.sources=src` e `sonar.javascript.lcov.reportPaths`                     |
| R2.3 | os 7 PRs abertos     | agora `main` tem `sonar.yml`; sincronizações disparam o scanner. **Registrado, não bloqueado** |

---

## 3. Loop M — baseline e a ERRATA que o M3 exigia

| medição                        | linhas a cobrir | descobertas | cobertura |
| ------------------------------ | --------------- | ----------- | --------- |
| **M1** local (`test:coverage`) | **9.054**       | 3.131       | 65,42 %   |
| **M2** Sonar (`main`)          | **4.797**       | **1.744**   | 63,4 %    |
| gate (`new_coverage`)          | —               | —           | **63,2**  |

**M3 disparou: |M2 − M1| ≫ 5 %.** Causa medida: o lcov local instrumenta **também `scripts/**`**, e o
Sonar mede apenas `sonar.sources=src` (com `src/test/**` excluído). Os dois números não são o mesmo
denominador, e decidir pelo local fixaria um alvo quase **duas vezes** maior que o real.

**Decisão (declarada, não implícita): mede-se pelo Sonar.** O local é guia de _onde_ cobrir, não de
_quanto_ — é a autoridade que o próprio prompt fixa.

**Alvo vivo, medido no início do Loop M:** `1.744 − (4.797 × 0,20)` = **~785 linhas**.

⚠️ **O alvo rola.** Entre a medição do Ciclo 22 (1.742 descobertas) e esta (1.744), a janela de 30 dias
do _new code_ moveu o denominador — a cobertura do gate caiu de 63,3 para **63,2** sem que uma linha de
código mudasse. O número tem de ser re-medido a cada lote, nunca herdado.

---

## 4. Orçamento

- **Commits:** 3 de 13 usados (`881b8f8` ADR-036 · `b6e0e99` Fase C · `DBT-63`).
- **CI:** 1 push de `develop` (heavy) + 1 PR (heavy + scanner) + 1 push de `main` (scanner) — janelas
  declaradas, custo financeiro zero (repo público).
- **Pendências do ciclo:** Fase 80 (cobertura), Fase P (required check), Fase X (rotação).
