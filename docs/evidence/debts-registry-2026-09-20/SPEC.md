# SPEC — WP-R1 (registry de dívidas `DEBTS.md` + guard mecânico)

**Fato-fonte:** `L126` (ordem aprovada da Fase 0), selo do WP-R0 (`ledger-reconciliation-2026-09-20/README.md:93` — `DBT-01..08`), análises avançadas de 2026-09-20 (schema, regra "DBT sem closure test ⇒ NS", proveniência por DBT) e `L136` (caminho do registry decidido nesta rodada).
**Base:** `6d9b22f` · **Branch:** `mission/r1-debts` · **Worktree:** nenhum (branch no checkout principal; sem agente concorrente ativo).
**Natureza:** docs + tooling de contrato; nenhum runtime tocado.

## 1. Problema

As dívidas declaradas ao longo dos WPs (WP1–WP5, TRILHO C, WP-R0) vivem apenas em prosa no journal e nos selos. Sem ID, origem, classe, severidade e **closure test** mecânicos, uma dívida "sabe-se lá" some — e um registry sem guard degenera (registry vazio, ID duplicado, valor `N/A`) sem ninguém perceber. O próprio registry seria a dívida nº 13 se ficasse fora da matriz de cobertura dos pipelines.

## 2. Contrato

- `docs/evidence/agent-state/DEBTS.md` é o registry canônico; vive sob `docs/evidence/**` (coberto pela light) e é validado por `scripts/m02-debts-guard.mjs` (node-only).
- Schema enforçado: `id · origem · classe · severidade · closure test · evidência · status`, com `id` = `DBT-NN` único, `classe ∈ {conformidade, robustez, higiene}`, `severidade ∈ {alta, média, baixa}`, `status ∈ {ABERTA, EM_TRATAMENTO, FECHADA, NS}`.
- **Regra de completude, nas duas direções:** closure test ausente/`NS` ⇒ status `NS`; closure test presente ⇒ status ≠ `NS`.
- Registry vazio (0 = 0), coluna obrigatória ausente, célula degenerada, ID duplicado, **cabeçalho fora de ordem** (as colunas são achadas pelo nome, não pela posição) e **mais de uma tabela canônica** no mesmo arquivo **reprovam**.
- O guard roda em `npm run check`, no `verify` do `ui-stack` e no passo dedicado do `ci-light` (as três superfícies do work-package guard).

## 3. Mudanças

| #   | arquivo                                    | mudança                                                                  |
| --- | ------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | `scripts/m02-debts-guard.mjs`              | guard node-only, `--registry` (falsificável por fixture), sem catch mudo |
| 2   | `src/test/m02-debts-guard.test.ts`         | 10 casos em fixtures tmp (RED antes do guard existir)                    |
| 3   | `docs/evidence/agent-state/DEBTS.md`       | registry canônico com **12 dívidas** e proveniência por WP/N/L           |
| 4   | `package.json`                             | script `m02:debts-guard` + entrada na cadeia do `check`                  |
| 5   | `.github/workflows/ui-stack.yml`           | passo no `verify` (push misto/código)                                    |
| 6   | `.github/workflows/ci-light.yml`           | passo no leve (docs-only)                                                |
| 7   | `AGENTS.md`                                | contrato do registry; cadeia do gate e scripts do leve atualizados       |
| 8   | `docs/evidence/debts-registry-2026-09-20/` | este SPEC, README/selo, captures e `MANIFEST.sha256`                     |

**Não muda:** runtime, schema de banco, migrations, placar do Plano Mestre (`QUEUE.md` é do MAESTRO e fica intocado).

## 4. DoD

- [x] guard com 16/16 casos verdes (fixtures) e registry real OK no caminho default
- [x] RED capturado antes do guard existir (10/10 falhas), RED dirigido dos achados do S6 (2/16) e GREEN depois
- [x] 12 dívidas com `origem` rastreável a `Lnn`/selo/§ (`DBT-01..12`)
- [x] guard nos 3 pipelines (`check`, `verify` do ui-stack, `ci-light`)
- [x] `AGENTS.md` declara o contrato e o caminho do registry
- [x] `npm run check` exit 0 com `CHECK_EXIT=0` no log do selo (`captures/gate-local.log.txt`)
- [x] S6 adversarial de contexto limpo (veredicto verbatim em `captures/`; 8 N tratados)
- [x] selo com `MANIFEST.sha256` e `checked === discovered` (gerado e conferido no fecho)

## 5. Testes (planejados e medidos)

| caso | entrada                            | esperado                               |
| ---- | ---------------------------------- | -------------------------------------- |
| real | `node scripts/m02-debts-guard.mjs` | exit 0, "OK (12 dividas"               |
| 1    | registry só com header             | exit 1, "registry vazio"               |
| 2    | closure `—` + status `ABERTA`      | exit 1, "exige status NS"              |
| 3    | closure `N/A` + status `NS`        | exit 0                                 |
| 4    | closure presente + status `NS`     | exit 1, "closure test presente"        |
| 5    | header sem `evidência`             | exit 1, "evidencia"                    |
| 6    | origem `N/A`                       | exit 1, "origem degenerada"            |
| 7    | `DBT-01` duplicado                 | exit 1, "id duplicado"                 |
| 8    | classe `inventada`                 | exit 1, "classe"                       |
| 9    | caminho inexistente                | exit 2, "registry ilegivel"            |
| 10   | header com `id` fora da 1ª coluna  | exit 0 (colunas achadas pelo nome)     |
| 11   | segunda tabela canônica no arquivo | exit 1, "mais de uma tabela canonica"  |
| 12   | id `DBT-1` (fora do padrão)        | exit 1, "fora do padrao DBT-NN"        |
| 13   | linha com 6 células contra 7       | exit 1, "6 celulas"                    |
| 14   | severidade `crítica`               | exit 1, "severidade fora da taxonomia" |
| 15   | status `PRONTA`                    | exit 1, "status fora da taxonomia"     |

Os casos 10–15 fecham os achados **N2/N5** do S6 (grupos de regra sem teste e header posicional); os casos 12–15 são os pinos de regressão que a matriz de mutação do S6 mostrou ausentes.

**Falsificação:** o guard é a ferramenta; o par que reprova com o defeito presente é a fixture (mutação real do registry), não uma renomeação de caso.

## 6. Riscos

| risco                                                | tratamento                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| o guard valida **estrutura**, não o mérito da dívida | declarado: conteúdo é julgado pelo S6 humano/lane; o guard só impede degeneração e closure ausente com status ativo          |
| a numeração `DBT-01..12` foi consolidada neste WP    | declarado: só `01`, `02`, `07` e `08` tinham dono no registro; os demais vêm de N declarados com `origem` por linha          |
| `DEBTS.md` tem dono MAESTRO (`L126`)                 | declarado: a execução desta sessão foi autorizada explicitamente pelo humano; o guard é o que impede o registry de apodrecer |
| `EM_TRATAMENTO` é convenção, não regra de máquina    | declarado no registry: o guard não tem como medir "WP aberto"; `FECHADA` exige o selo que executou o closure (humano/S6)     |

## 7. Rollback

Descartar a branch `mission/r1-debts`; nada em `develop` antes do Gate C.

## 8. Checklist anti-vacuoso demonstrado (auto-aplicação)

| #   | item                            | demonstração                                                                                                           |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo               | RED 10/10 com o guard ausente + fixtures mutadas reprovam (`captures/red-vitest.log.txt`)                              |
| 2   | Fronteira nas duas direções     | closure ausente+`NS` passa × closure presente+`NS` reprova (casos 3 e 4)                                               |
| 3   | Identidade, não cardinalidade   | colunas achadas pelo **nome** (header em qualquer ordem); ID único; falha nomeia o ID e a coluna; tabela dupla reprova |
| 4   | Proibido exit-code-only         | os testes asseram a **mensagem** nomeada, não só o status                                                              |
| 5   | Proibido sleep fixo             | N/A — nenhuma espera temporal                                                                                          |
| 6   | Sem valor degenerado            | `N/A`/`—`/`TBD` rejeitados em todas as colunas obrigatórias                                                            |
| 7   | Precondição de estado           | cada fixture escreve seu registry em `mkdtemp`; o registry real é a precondição do caso default                        |
| 8   | Sentinela real por cenário      | cada caso tem sua fixture própria (arquivo nomeado), não inferência de lista                                           |
| 9   | Fingerprint de revisão          | `captures/hashes.txt` + sha256 dos arquivos; RED/GREEN logs datados                                                    |
| 10  | `checked === discovered`        | `MANIFEST.sha256` conferido por `sha256sum -c`                                                                         |
| 11  | S6 de contexto limpo            | lane read-only; veredicto verbatim em `captures/adversarial-r1-verdict.md.txt`                                         |
| 12  | Falha alta                      | exit 1/2 nomeado; nenhum `catch` converte erro em sucesso vazio                                                        |
| 13  | Isolamento de bancada assertado | S7: escopo do diff, `:5432` 0 listeners, zero credencial herdada, `origin/main` conferido                              |
| 14  | Check impresso tem gate/captura | RED, GREEN, gate e S7 têm captura versionada em `captures/`                                                            |
| 15  | Run de CI atado ao commit       | o land cita `run@sha` conferido por API após o push (journal/L137)                                                     |
