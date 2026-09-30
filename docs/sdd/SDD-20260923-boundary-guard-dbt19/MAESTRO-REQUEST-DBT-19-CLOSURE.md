# Pedido ao MAESTRO — fechamento de `DBT-19` no registry

> **Por que este arquivo existe e não uma edição no registry:** `docs/evidence/agent-state/DEBTS.md`
> declara o **MAESTRO** como escritor (assim como `QUEUE.md`). O agente **não** edita nenhum dos dois.
> Este é o pedido auditável de fechamento, com o closure test já executável.

- **Solicitante:** agente supervisionado, ciclo `SDD-20260923`
- **Data:** 2026-09-23
- **Dívida:** `DBT-19` — status atual no registry: **ABERTA**
- **ADR:** `docs/adr/ADR-030-boundary-guard-dbt19.md` (aprovado como contrato; errata §9 registra o
  achado que mudou o plano no meio do caminho)

## Estado técnico: **implementação local concluída e validada**

### Condição de fechamento do registry (verbatim) × como foi cumprida

> _"Fechada quando ambos aparecem no encadeamento de um pipeline **com um caso negativo que os
> falsifica** (guard que nunca reprova não é guard) e a tabela de cobertura do `AGENTS.md` bate com os
> YAMLs por asserção de teste."_

| Cláusula                                | Cumprimento                                                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ambos no encadeamento de um pipeline    | `npm run check` (cadeia, 16 membros) **e** passos diretos do `verify` do `ui-stack.yml`                                                                                                                         |
| **caso negativo que os falsifica**      | `src/test/m02-boundary-gate.test.ts` — **6 casos**: boundary violada ⇒ exit 1; precondição ⇒ exit 2; literal de segredo ⇒ exit 1; cobertura incompleta ⇒ exit 2; verde na árvore real; detecção sem vazar valor |
| tabela do `AGENTS.md` bate com os YAMLs | tabela, lista da cadeia e contagem ("14 dos 16") atualizadas **no mesmo commit** do encadeamento                                                                                                                |

### Achado que **mudou o plano** (e é o motivo de a dívida valer a pena ter sido perseguida)

`m02:secrets-audit` **detectava** literais de segredo (`possible_secret_literals`, três padrões: PEM,
`ghp_`/`github_pat_`/`sk-proj-`, `AKIA…`) e **saía `0`** — o veredicto olhava **apenas** a cobertura
(`coverage.failures.length ? 2 : 0`). Encadeá-lo sem corrigir isso teria produzido **cobertura de segredo
apenas aparente**: o pior resultado possível, porque pareceria resolvido. O exit code passou a
distinguir `2` (precondição), `1` (literal) e `0` (limpo), nomeando `arquivo:linha` em stderr e **nunca**
o valor.

## Closure test

```text
src/test/m02-boundary-gate.test.ts   →  6 casos, ~1,1 s
```

Roda em `npm run test` (já encadeado no `check`), portanto **executável por gate**, não por cortesia.

## Custo medido (3 execuções cada, nesta máquina)

| Guarda                                                 |  exec 1 |  exec 2 |  exec 3 |       média |
| ------------------------------------------------------ | ------: | ------: | ------: | ----------: |
| `m02:boundaries`                                       |  213 ms |  202 ms |  210 ms |  **208 ms** |
| `m02:secrets-audit`                                    | 2101 ms | 1926 ms | 1934 ms | **1987 ms** |
| trecho encadeado (`temporal→boundaries→secrets-audit`) | 2356 ms | 2345 ms | 2280 ms | **2327 ms** |

`npm run check` exit 0; `local-ci` `verdict=success` (351 s) no commit selado.

## Evidência

- `docs/evidence/local-ci/c7e6a558e0da3abc7e30e36ab698d0119e078b80/` — rodada completa, **árvore limpa**
  fora da evidência (`git-status.txt` só tem entradas sob `docs/evidence/local-ci/`), tier de banco
  **executado e verde**, e2e verde, `pendencies` vazio.
- `docs/sdd/SDD-20260923-boundary-guard-dbt19/07-evidence.md` — as provas de falsificabilidade.
- Commit `c7e6a55` (`ci(guards): chain m02:boundaries and m02:secrets-audit into check`).

## Ação requerida do MAESTRO

1. Avaliar o fechamento de **`DBT-19`** no registry, com closure test apontando para
   `src/test/m02-boundary-gate.test.ts` e evidência no commit `c7e6a55`.
2. Se aceito, escrever a linha no `DEBTS.md` (o agente não escreve).

## O que este pedido **não** pede

- Não pede push, billing, status no GitHub, `full-logs` ou mudança de visibilidade.
- Não pede fechamento de `DBT-23` (pedido separado, em `SDD-20260923-evidence-policy/MAESTRO-REQUEST-DBT-23.md`).
- Não pede ratificação do ADR-030 (decisão humana própria, se desejada).

---

# Complemento — 2026-09-25 — a segunda metade da condição foi entregue

A tabela acima mapeia a condição de fechamento clause a clause. Na data daquele pedido, a última linha
("tabela do `AGENTS.md` bate com os YAMLs por asserção de teste") estava declarada como cumprida **por
atualização editorial no mesmo commit** — o que é mais fraco do que a própria cláusula pede. O
`reconciliacao-plano-mestre-2026-09-24.md` (§6.2) nomeou isso: _"Nenhum teste pinna a cadeia `check` de
16 gates: um gate pode ser removido com tudo verde. Isso desarma em silêncio qualquer gate do plano que
dependa dela. É o item mais urgente do próximo ciclo de código."_

**Entregue agora** — a asserção que faltava, por comparação de dados e não por edição de prosa:

| Peça   | Onde                                                                                                                               | O que faz                                                                                                                                                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| núcleo | `scripts/lib/m02-ci-coverage.ts` — `parseCoverageTable`, `gateInCheckChain`, `gateInHeavy`, `gateInLight`, `auditDeclaredCoverage` | Lê a tabela do `AGENTS.md`, a cadeia `check` do `package.json` e os dois YAMLs, e compara as três colunas                                                                                                                                                        |
| teste  | `src/test/m02-ci-coverage.test.ts` — 12 casos, **6 controles negativos**                                                           | Gate acrescentado ao `check` sem entrar na tabela · gate declarado e inexistente · guard removido da heavy · guard removido da light · gate removido do `check` · ✔ virado ✘ na tabela · marca ilegível · guard comentado contando como ausente · tabela ausente |

**Fail-closed nas duas direções:** a tabela que discorda dos fatos reprova, e também a ausência da
tabela, a marca irreconhecível, o gate fantasma e o passo da cadeia `check` sem cobertura declarada.
Marca ilegível **não** vira `true` silencioso.

**Prova de vivacidade fora da suíte:** a linha real do `m02:boundaries` na tabela do `AGENTS.md` foi
mutada de `✔ | ✔ (passo direto)` para `✘`; a suíte reprovou com
`m02:boundaries (heavy): a tabela declara ✘ e o gate roda ali`; o arquivo foi restaurado
(`git diff` vazio) e a suíte voltou a 21/21.

Commits `ceec343` (teste) e `abd5e6d` (evidência
`docs/evidence/p0-fase0-fase1-reconciliacao-2026-09-25.md`), branch
`feature/p0-financial-security-baseline`.

**Ação requerida do MAESTRO, atualizada:** avaliar o fechamento de `DBT-19` com closure test apontando
para **os dois** arquivos — `src/test/m02-boundary-gate.test.ts` (falsificabilidade das guardas) **e**
`src/test/m02-ci-coverage.test.ts` (a tabela não mente). O registry segue intocado; `DBT-19` permanece
**ABERTA** até a linha ser escrita por quem o escreve.
