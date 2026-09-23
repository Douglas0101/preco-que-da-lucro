# 01 — SPEC · SDD-20260923-boundary-guard-dbt19

- **ID:** `SDD-20260923-boundary-guard-dbt19`
- **Status:** `SPEC` — **aguardando aprovação humana** (nada implementado neste ciclo)
- **Data:** 2026-09-23
- **Nota de estrutura:** spec-only por decisão de escopo (item 6 do backlog). Conceitos de
  design/plano/risco em seções; expande para o conjunto multi-arquivo na promoção.

## 1. Problema

**DBT-19** (registry de dívidas, `docs/evidence/agent-state/DEBTS.md`, status **ABERTA**) registra que
**dois guards declarados contrato não rodam em push de código**:

- `m02:boundaries` — não aparece em `npm run check`, nem no passo direto do `verify` (heavy), nem na
  light. **Gate nenhum.** Verde medido **à mão** em 2026-09-22: _"M-02 BFF boundary is clean"_.
- `m02:secrets-audit` — roda **só** na light (`ci-light.yml`), que dispara apenas quando **todos** os
  arquivos alterados estão sob `docs/evidence/**`. Um push **só de código** nunca o executa.

A tabela de cobertura do `AGENTS.md` documenta essa lacuna honestamente (marca `✘` nomeado) — mas
**documentar não é executar**. O próprio `AGENTS.md` diz: _"Declarar contrato e não executá-lo é a
lacuna, não a guarda."_

**Condição de fechamento declarada por DBT-19 (verbatim):** fechada quando ambos aparecem no encadeamento
de um pipeline **com um caso negativo que os falsifica** (guard que nunca reprova não é guard) e a tabela
de cobertura do `AGENTS.md` bate com os YAMLs **por asserção de teste**.

## 2. Contexto

- **Assimetria medida:** a light executa `m02:secrets-audit` (e os quatro guards + prettier dos arquivos
  alterados); a heavy executa os quatro guards + `format:check` + `lint` + `typecheck` + `test` + `build`,
  mas **nenhum** dos dois. Logo, a interseção de cobertura por push de código é **vazia** para ambos.
- `m02:boundaries` existe e funciona (`scripts/m02-boundaries.ts`); o problema é **não estar encadeado**.
- A lacuna foi achada pelo **próprio S6** do WP-R8 (N7), a partir da correção de uma prosa que afirmava
  "os mesmos gates" — ou seja, o achado nasceu de prosa inflada, não de código.

## 3. Objetivo

Colocar os dois guards no encadeamento de um pipeline, de modo que um push só de código os execute, com
**caso negativo que os falsifique** e com a tabela do `AGENTS.md` **assertada por teste** contra os YAMLs.

## 4. Não objetivos

- Não alterar a **semântica** dos guards (o que eles verificam).
- Não duplicar execução (rodar o mesmo guard em dois pipelines sem necessidade queima cota — o recurso
  que está bloqueado).
- Não introduzir gate que dependa de rede/credencial (o `m02:secrets-audit` hoje é node built-ins only,
  e é isso que permite a light rodar **sem instalar dependências** — propriedade a preservar).

## 5. Requisitos

- **REQ-01** — `m02:boundaries` passa a rodar em **push de código** (isto é: no encadeamento do `check`
  e/ou em passo direto do `verify` do heavy), sem depender de `docs/evidence/**`.
- **REQ-02** — `m02:secrets-audit` passa a rodar em **push de código** (idem), fechando a janela em que um
  push só de código nunca o executa.
- **REQ-03** — **caso negativo para cada guard**: uma fixture que **viola** o contrato e faz o guard
  reprovar. Sem isso, o fechamento de DBT-19 não é aceito (exigência verbatim do registry).
- **REQ-04** — a tabela de cobertura do `AGENTS.md` é **assertada por teste** contra os YAMLs reais
  (`ui-stack.yml`, `ci-light.yml`) e contra a cadeia `check` do `package.json`: toda linha `✔` tem de
  corresponder a um passo existente; toda linha `✘` nomeada tem de corresponder a uma ausência real.
- **REQ-05** — nenhum guard é enfraquecido para "caber" no orçamento de cota.
- **REQ-06** — a mudança entra com **medição de custo** (segundos) do que foi adicionado a cada pipeline,
  porque a cota é o recurso escasso que motivou o tiering.

## 6. Critérios de aceite (a expandir na execução)

- **AC-01** RED de cada guard: fixture violadora ⇒ exit ≠ 0, capturado e versionado.
- **AC-02** GREEN: árvore válida ⇒ exit 0 para ambos.
- **AC-03** asserção da tabela do `AGENTS.md` passa; **e falha** quando um passo é removido do YAML
  (controle negativo da própria asserção).
- **AC-04** `checked === discovered` sobre a tabela: nº de linhas declaradas = nº de linhas assertadas.
- **AC-05** custo medido e declarado por pipeline.

## 7. Design (resumo)

Duas opções, a decidir na promoção:

- **D-A — encadear no `check`.** `m02:boundaries` e `m02:secrets-audit` entram na cadeia `npm run check`;
  como a heavy roda 12 dos 14 scripts da cadeia como passos diretos, é preciso também adicioná-los lá
  (a cadeia e os passos diretos são listas separadas). Custo local: ~1 s cada (medido: `boundaries` 0 s,
  `secrets-audit` 3 s).
- **D-B — passo direto no heavy + um no `check`.** Evita divergência entre a cadeia e o YAML, mas exige
  manter duas listas em sincronia — precisamente a classe de defeito do `N7`.

**Recomendação:** D-A, porque reduz a superfície de divergência e ambos os guards são baratos (≤ 3 s),
ao contrário do e2e (240 s) e do `db:test` (33 s) que motivaram o tiering.
**Observabilidade:** o `::notice` de tier continua para os tiers caros; estes dois não são tier — são
baratos e obrigatórios.

## 8. Plano (resumo)

T1 medir custo atual dos dois guards → T2 casos negativos (+ fixtures) → T3 encadear (decisão D-A) →
T4 teste que asserta a tabela × YAMLs, com controle negativo → T5 atualizar a tabela do `AGENTS.md` **no
mesmo commit** (regra do repo: quem muda o que o `AGENTS.md` documenta atualiza o `AGENTS.md`) →
T6 fechar DBT-19 no registry com o closure test apontando para o teste.

## 9. Riscos (resumo)

- **RISK-01 falso positivo do guard em árvore válida** ⇒ rodar contra a árvore real **antes** de encadear;
  rollback por revert do encadeamento.
- **RISK-02 asserção da tabela virar acoplamento frágil** (quebra a cada edição de YAML) ⇒ assertar
  **presença/ausência por identidade** de passo, não o texto do arquivo.
- **RISK-03 custo de cota** ⇒ medir; ambos são baratos, mas a medição é requisito (REQ-06), não opcional.
- **RISK-04 fechar DBT-19 sem o caso negativo** ⇒ proibido pelo próprio registry; o fechamento é
  condicionado a AC-01.

## 10. Traceabilidade

REQ-01…REQ-06 → T1…T6 → AC-01…AC-05.

## 11. Dependências e aprovações

- **Aprovação humana necessária:** muda contrato de CI (encadeamento de gates) ⇒ exige decisão, e
  provavelmente **ADR** (o repo exige ADR para mudança arquitetural; encadear gate é mudança de contrato).
- **Não** depende do desbloqueio de billing para ser **implementado**; a verificação do run real depende.
