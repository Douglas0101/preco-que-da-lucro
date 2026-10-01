# Ciclo 22 — F4.5: o `DBT-57` em LINHAS, não em pontos percentuais

- **Data:** 2026-10-01 · **Fonte:** Web API do SonarCloud, mesma sessão da Fase 1
- **Para que serve:** a decisão do `DBT-57` (manter 80 × fixar no medido) sai de "63,3 contra 80" —
  que não diz quanto trabalho é — para **quantas linhas faltam cobrir**.

---

## 1. Medições

`GET /api/measures/component?component=Douglas0101_preco-que-da-lucro&metricKeys=…`

| métrica           | valor      |
| ----------------- | ---------- |
| `coverage`        | **63,6 %** |
| `lines_to_cover`  | **4.797**  |
| `uncovered_lines` | **1.742**  |
| `ncloc`           | 20.256     |

Gate (`GET /api/qualitygates/project_status`): **6 condições, 5 OK**, e a única reprovada é
`new_coverage` = **63,3** contra `LT 80`.

**As métricas `new_*` (`new_lines_to_cover`, `new_uncovered_lines`, `new_coverage`) devolvem
`undefined` fora do contexto de pull request / período de new code com baseline** — testado também com
`branch=main`. O que se pode afirmar, medido: o `new_coverage` do gate (**63,3**) é praticamente igual
à cobertura geral (**63,6**), o que é coerente com o fato de a janela de new code cobrir quase todo o
código (a última análise de `main` anterior era de 2026-09-13 e a janela é de 30 dias).

---

## 2. A conta que a decisão precisa

```
linhas a cobrir ............ 4.797
linhas descobertas ......... 1.742
linhas cobertas ............ 3.055   (63,6 %)

alvo de 80 % ............... 0,80 × 4.797 = 3.837 linhas cobertas
faltam cobrir .............. 3.837 − 3.055 = 782 linhas
```

> **Para atingir o limiar de 80 %, faltam cobrir ~782 linhas.**

Como o `new_coverage` do gate (63,3) coincide com a cobertura geral (63,6), esse número é o
**denominador real** da decisão — não uma extrapolação.

---

## 3. O que isso muda na decisão

| rota                                  | custo medido                                                                 | o que preserva                               |
| ------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| **(a) manter 80 e pagar a cobertura** | **~782 linhas** de teste novo, com a disciplina de prova dos outros remédios | o limiar do "Sonar way", sem recalibrar nada |
| **(b) fixar o limite no medido**      | zero linhas de teste; **um** ADR com o roadmap de retorno                    | o esforço, ao custo de um limiar mais frouxo |

**Não decidido.** As duas rotas ficam registradas; a escolha é do MAESTRO, e agora com o número certo
em mãos em vez de uma diferença de pontos percentuais.

---

## 4. Limites desta medição

- `new_lines_to_cover` **não é exposto** por esta API no contexto atual — o número de 782 linhas vem de
  `lines_to_cover`/`uncovered_lines`, que são **gerais**. A equivalência com o new code está
  **medida** (63,3 ≈ 63,6), não suposta, mas é uma equivalência, não uma identidade.
- O `ncloc` medido (20.256) é a superfície **em escopo** (`sonar.sources=src`), não o repositório
  inteiro — `scripts/**` está fora por cota (`DBT-58`).
- A análise em vigor é a de `revision 2d73fa3` atribuída a `main` (`DBT-61`), com cobertura importada
  do lcov de 289.837 bytes.
