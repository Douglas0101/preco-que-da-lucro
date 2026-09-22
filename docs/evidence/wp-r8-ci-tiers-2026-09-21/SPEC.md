# SPEC — WP-R8 `F-ci-tiers`

**Data:** 2026-09-21 · **Branch:** `mission/r8-formal` · **Base:** `9f521ed`
**Autor:** MAESTRO · **S6:** lane adversarial de contexto limpo (não depende de runner)

---

## 1. Fato-fonte

| fato                                                  | ponteiro                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| O bloqueio, na palavra da plataforma                  | anotação do check-run: _"The job was not started because recent account payments have failed or your spending limit needs to be increased"_ |
| Custo medido que motivou o tiering                    | run `35611793799`: e2e 240 s (42%) + vitest 151 s (26%) = **68%**; soma dos passos ≈ 570 s = wall-clock (DAG serial)                        |
| Volume                                                | **13** execuções da `UI stack` em 2026-09-21 (~79 min de runner)                                                                            |
| Tiering já landado                                    | merge `4be813c` (parent `ff4c379`), fechado em `9f521ed`                                                                                    |
| Defeitos de fail-open achados na auditoria desta SPEC | A1 polaridade `== 'true'`; A2 base desconhecida/`dispatch` sem `crossbrowser`                                                               |

## 2. Contrato (invariantes falsificáveis)

| id           | invariante                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **INV-R8-a** | Nenhuma condição de gate usa `== 'true'`: a polaridade é **fail-closed** (`!= 'false'`), de modo que output vazio **roda** o tier.                     |
| **INV-R8-b** | Base desconhecida (force-push, primeira push de branch) e `workflow_dispatch` emitem `db=true` **e** `crossbrowser=true` — "todos os tiers" é literal. |
| **INV-R8-c** | O `if` shell do passo de browsers só escolhe chromium-only com `false` **explícito**.                                                                  |
| **INV-R8-d** | `concurrency` cancela run supersedido de `develop`, **nunca** de `main` (fronteira de produção).                                                       |
| **INV-R8-e** | O contrato de cobertura heavy↔light (`m02-ci-coverage`) segue válido: os filtros de `on:` não foram tocados.                                           |
| **INV-R8-f** | Os testes de tier **executam o script real extraído do YAML**, não uma reimplementação.                                                                |

## 3. Mudanças (lista fechada)

| arquivo                                      | mudança                                                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ui-stack.yml`             | A1 polaridade · A2 base-desconhecida/dispatch com os dois outputs · A2b polaridade shell · A3 `main` fora do cancelamento · A4 cache de navegadores · A5 justificativa do timeout |
| `src/test/m02-ci-tiers.test.ts`              | **novo** — 10 casos, script real extraído do YAML, fixture git própria                                                                                                            |
| `AGENTS.md`                                  | protocolo de bloqueio de CI · `cancelled` não é evidência · precisão do "sempre" · guarda dos tiers                                                                               |
| `docs/evidence/wp-r8-ci-tiers-2026-09-21/**` | este selo                                                                                                                                                                         |
| `EXECUTION-STATE-PLAN`                       | ledger da janela sem verificação + critério de reversão                                                                                                                           |

**Não muda:** nenhum teste removido, nenhuma regra afrouxada, nenhum orçamento renegociado; matriz completa em todo PR; `npm run check` local idêntico; `origin/main` intocado.

## 4. DoD

| #   | critério                                                                         | prova                                                      |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | A1: nenhuma ocorrência de `== 'true'` em gate; 2× `!= 'false'` e 1× `== 'false'` | `captures/tiers.log.txt` + `src/test/m02-ci-tiers.test.ts` |
| 2   | A2: base desconhecida e dispatch emitem os dois outputs                          | idem                                                       |
| 3   | A2b: o ramo shell do `if` é o chromium-only                                      | idem                                                       |
| 4   | A3: `cancel-in-progress` condicional a não-`main`                                | idem                                                       |
| 5   | A4: SHA do `actions/cache` resolvido da API oficial, não de memória              | `captures/tiers.log.txt` (saída do `gh api`)               |
| 6   | A5: `retries: 0` medido ⇒ pior caso 1× e 12 min com folga                        | `captures/tiers.log.txt`                                   |
| 7   | INV-R8-e: `m02-ci-coverage` verde contra o YAML novo, **localmente**             | `captures/tiers.log.txt`                                   |
| 8   | `npm run check` exit 0                                                           | `captures/gate-local.log.txt`                              |
| 9   | Janela sem verificação enumerada e critério de reversão registrado               | ledger + `captures/janela.log.txt`                         |

## 5. Riscos

| risco                                                     | disposição                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| corrigir YAML sem CI verde é corrigir às cegas            | mitigado: YAML parseia, `bash -n` no script extraído, 10 casos executam o script real, `m02-ci-coverage` 9/9 e `npm run check` verde — tudo local |
| o S6 sem runner não pega erro de runtime do step          | declarado: o escopo é shell puro, sem rede; o que só o runner prova é a varredura D1, que é a primeira coisa do pós-bloqueio                      |
| a projeção de 322 s pode não se confirmar                 | critério B4 pré-comprometido: fora de ±15% ⇒ `git revert` do merge `4be813c`                                                                      |
| cache de navegadores com chave errada serve binário velho | chave = `hashFiles('package-lock.json')`; `restore-keys` parcial só completa; `playwright install` baixa o que faltar                             |

## 6. Rollback

`git revert -m 1` do merge `4be813c` (o workflow antigo volta inteiro) e `git checkout develop && git branch -D mission/r8-formal`. Sem migration, sem estado externo.
