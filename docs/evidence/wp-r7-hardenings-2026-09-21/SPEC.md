# SPEC — WP-R7 `F-hardenings`

**Data:** 2026-09-21 · **Branch:** `mission/r7-hardenings` · **Base:** `332da9e`
**Autor:** MAESTRO · **S6:** lane adversarial de contexto limpo

---

## 1. Fato-fonte

| fato                                        | ponteiro                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Ratificação do placar pelo MAESTRO          | decisão humana de 2026-09-21: **150 D · 29 P · 8 NS · 0 UNV / 187** = 87,9679% parcial · 80,2139% crua (WP-R0b §5)    |
| §6.2 — guarda temporal das âncoras em prosa | análise de 2026-09-21: SHAs e prazos escritos em prosa envelhecem em silêncio; `L141` (prazo de watcher 5 dias velho) |
| §6.3 / DBT-16 — gerar o `.d.mts`            | `DEBTS.md` DBT-16; o WP-R5 achou 3 exports sem declaração com `vitest` verde e só o `tsc` reprovando                  |
| §7 — regra de elegibilidade no `AGENTS.md`  | análise de 2026-09-21: a régua do R0b precisa estar escrita onde o próximo agente a lê                                |

## 2. Contrato (invariantes falsificáveis)

| id           | invariante                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-R7-a** | Toda âncora `` `sha` `` de 7–40 hex na **superfície viva** de prosa resolve como objeto do git; âncora que não resolve **reprova com `exit 1`**.          |
| **INV-R7-b** | Todo prazo (`caduca\|expira\|vence\|deadline\|prazo`) com data no passado, na superfície viva, **reprova com `exit 1`**; o journal append-only fica fora. |
| **INV-R7-c** | O `.d.mts` de `m02-seal` é **byte a byte** o que o gerador emite do JSDoc do módulo; edição à mão reprova.                                                |
| **INV-R7-d** | Falha de precondição (sem git, superfície ausente, recorte vazio) sai com **`exit 2`**, distinto do `1` de violação.                                      |

**Superfície viva (declarada, descoberta por parsing):** §1 do `PROGRESS.md` · último bloco `###` do
`EXECUTION-STATE-PROGRAM.md` · tabela aberta do `REGISTRO-H.md` (antes de `## Fechados`).

## 3. Mudanças (lista fechada)

| arquivo                                           | mudança                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/m02-temporal-guard.mjs`                  | **novo** — guarda das âncoras e prazos da prosa viva                   |
| `src/test/m02-temporal-guard.test.ts`             | **novo** — 7 casos, fixture git real, 4 RED e 2 de precondição         |
| `scripts/generate-seal-dts.mjs`                   | **novo** — gerador do `.d.mts` (tsc + prettier), `--check`/`--destino` |
| `scripts/m02-seal.mjs`                            | JSDoc de tipos nos 16 exports (fonte única dos tipos)                  |
| `scripts/m02-seal.d.mts`                          | passa a ser **artefato gerado**                                        |
| `src/test/m02-seal.test.ts`                       | teste de sincronia → teste de **geração** + controle negativo          |
| `package.json`                                    | `m02:temporal-guard`, `m02:seal-dts:check` e a cadeia do `check`       |
| `.github/workflows/ui-stack.yml` · `ci-light.yml` | passo da guarda temporal nos dois pipelines                            |
| `AGENTS.md`                                       | guardas derivadas + **regra de elegibilidade do placar**               |
| `docs/evidence/agent-state/PROGRESS.md`           | §1 com o placar **ratificado**, refs atuais e a guarda citada          |
| `docs/evidence/agent-state/DEBTS.md`              | **DBT-16 fechada**                                                     |
| `docs/evidence/wp-r7-hardenings-2026-09-21/**`    | este selo                                                              |

**Não muda:** nenhuma migration, nenhum código de runtime, `package.json` só ganha scripts,
`:5432` intocado, `origin/main` intocado.

## 4. DoD

| #   | critério                                                                | prova                                           |
| --- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | RED T1: prazo vencido na superfície viva reprova, nomeando data e linha | `captures/red-temporal.log.txt`                 |
| 2   | RED T2: âncora que não resolve reprova, nomeando token e linha          | idem                                            |
| 3   | GREEN: superfície real confere                                          | idem                                            |
| 4   | RED: `.d.mts` editado à mão reprova na conferência **e** no teste       | `captures/red-seal-dts.log.txt`                 |
| 5   | mutações restauradas por **sha256**, com a aplicação **assertada**      | ambas as capturas                               |
| 6   | precondição com `exit 2` distinta da violação                           | `src/test/m02-temporal-guard.test.ts` (2 casos) |
| 7   | guardas nos três pipelines                                              | `check` + `ui-stack` verify + `ci-light`        |
| 8   | `npm run check` exit 0                                                  | `captures/gate-local.log.txt`                   |

## 5. Riscos

| risco                                                   | disposição                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| a guarda virar lista de afirmações em vez de descoberta | a superfície é **recortada por parsing** (cabeçalho de seção, último bloco, tabela aberta), não por lista de SHAs |
| a guarda reprovar o journal histórico                   | o journal é **excluído por construção**: só o §1 é superfície viva; caso de teste cobre isso                      |
| a guarda ser barulhenta e alguém a desligar             | ela é **precisa**: 3 âncoras e 1 prazo hoje, 0 violação; falso positivo é bug, não ruído                          |
| gerar o `.d.mts` com `tsc` custar tempo no gate         | o custo é uma invocação de `tsc` por execução do teste; o `typecheck` do projeto já roda `tsc`                    |

## 6. Rollback

`git checkout develop && git branch -D mission/r7-hardenings`. Sem migration, sem estado externo.
