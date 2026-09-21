# SPEC — WP-R0b `F-remeasure-187`

**Data:** 2026-09-21 · **Branch:** `mission/r0b-remeasure` · **Base:** `a75a62b`
**Autor:** MAESTRO · **S6:** lane adversarial de contexto limpo
**Escritor do placar:** MAESTRO (humano) — este WP **mede e propõe**, não promove.

---

## 1. Fato-fonte

| fato                                                    | ponteiro                                                                                                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordem canônica da Fase 0                                | `PROGRESS.md` §1: "próximo passo canônico = **`WP-R0b`** (re-mediação item a item da matriz de 187 + ratificação)"                                                                 |
| Régua ratificada para abrir o R0b                       | análise avançada de 2026-09-21 (`wpR5-regua`) §"régua": **sub-itens medidos individualmente; cluster não é unidade de placar**, endurecida por 5 cláusulas                         |
| Exigência §6.1 (pré-requisito desta abertura)           | disposição nominal dos 13 skips — **cumprida e fechada** pelo WP-R6 (`docs/evidence/wp-r6-skip-visibility-2026-09-21/`, land `4983c11`, S6 com 11 C · 1 CORR · 0 REJ · 0 U · 10 N) |
| Camada medida em 2026-09-15 e recomputada em 2026-09-19 | `docs/evidence/plan-recap-2026-09-15/ANEXO-ITENS-2026-09-15.md` (bloco RECOMPUTADA) e `docs/evidence/trilho-c-recompute-36-40-2026-09-19/`                                         |
| Placebo proibido                                        | `L111`/`L143`: nenhum WP de processo promove item; promoção exige medida, não inferência                                                                                           |

## 2. Régua (ratificada) e as 5 cláusulas de endurecimento

**Régua:** cada **sub-item** da matriz de 187 é medido **individualmente**. O **cluster não é
unidade de placar**: `15` não é uma linha, são `15.1…15.7`; `25` não é uma linha, são `25.1…25.7`. Um
sub-item DONE não carrega os irmãos, e um cluster com 6 de 9 não é "meio DONE" — é **PARTIAL com
delta nomeado**.

| #   | cláusula                                  | consequência operacional                                                                                                                                   |
| --- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Promoção por conjunção**                | um item só vira DONE quando **todos** os sub-itens exigidos estão DONE; maioria, "quase tudo" ou "o principal" não promovem — no máximo rebaixam a PARTIAL |
| C2  | **Denominador estável em 187**            | nenhuma medição muda o denominador; item que se revelar inaplicável vira `NA` **dentro** dos 187, nunca sai da conta                                       |
| C3  | **Comandos de evidência pré-registrados** | cada item tem comando e predicado **declarados na §4 desta SPEC antes da medição**; comando novo descoberto depois é declarado como tal, não retro-datado  |
| C4  | **PARTIAL exige delta nomeado**           | `P` sem a frase "falta X" é inválido; o delta é o que separa P de D e vira closure candidate (DBT) quando não é trabalho imediato                          |
| C5  | **Fórmula congelada**                     | crédito parcial = `(D + ½·P) / 187`; `P` conta **meio**, e a nota do WP não inventa peso novo nem arredonda para cima                                      |

**Nota de escopo:** esta rodada mede os **12 NS + 2 UNV** (o bloco que a régua tornou duvidoso) e
**não** re-mede os 23 P nem os 150 D — re-medir o que já está verde sem fato-fonte novo seria
trabalho sem pergunta. A série completa fica para a ratificação do MAESTRO.

## 3. Objeto — os 14 itens, como a camada os declarou

| item   | classe na camada | razão declarada em 2026-09-15                                              |
| ------ | ---------------- | -------------------------------------------------------------------------- |
| `15.1` | NS               | Memory Service não existe em runtime (só contrato type-only)               |
| `15.2` | NS               | nenhuma tabela `ai_memor*`, nenhum `tsvector`                              |
| `15.3` | NS               | `MemoryPolicy` é interface type-only, sem engine                           |
| `15.4` | NS               | `MemoryProvenance` type-only, sem persistência                             |
| `15.5` | NS               | FTS inexistente (`tsvector`/`gin` → 0)                                     |
| `15.6` | NS               | sem `pgvector`/embedding/ANN                                               |
| `15.7` | NS               | sem retrieval de memória no runtime                                        |
| `19.6` | NS               | os medidores de memória (`candidate_count`, `recall`…) só existem no plano |
| `21.3` | NS               | sem `SERIALIZABLE`/`40001`/retry (ADR-029 adia para T3)                    |
| `22.4` | NS               | `idempotency_records` sem purga agendada                                   |
| `25.5` | NS               | nenhum workflow usa `dependency-review-action`                             |
| `25.6` | UNV              | CodeQL: 0 hits em `.github`                                                |
| `25.7` | UNV              | sem `.github/secret_scanning.yml`                                          |
| `29.1` | NS               | `requestDuration` sem percentil/veredito; `p95` só em teste                |

## 4. Comandos e predicados **pré-registrados** (cláusula C3)

Escopo declarado: a árvore do commit de base `a75a62b`. `ESC` = árvore inteira, excluídos
`.git/`, `node_modules/`, `.output/`, `docs/` (a camada conta **código**, não prosa) — a exclusão de
`docs/` é declarada porque três dos itens têm a _única_ ocorrência no próprio plano mestre, e contar
prosa como implementação é exatamente o falso positivo que este WP existe para não repetir.

| item   | comando pré-registrado                                                                                                     | DONE se                                         | PARTIAL se                                            | NS se               |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- | ------------------- |
| `15.1` | `grep -rn 'memory' src/lib src/server src/app --include=*.ts` fora de `contracts/`                                         | ≥1 service **e** ≥1 chamador de runtime         | existe camada mas nenhum entrypoint (rota/BFF/worker) | 0 fora do contrato  |
| `15.2` | `grep -c 'CREATE TABLE.*ai_memor' drizzle/**/*.sql` + colunas `tsvector` no schema                                         | tabela **migrada** + repositório                | tabela parcial (n de 9) com delta nomeado             | 0 tabelas           |
| `15.3` | `grep -rn 'MemoryPolicy' ESC` classificando uso por posição (tipo × valor)                                                 | engine em runtime (decisão executada)           | política existe só como tipo + validação estática     | type-only           |
| `15.4` | `grep -rn 'MemoryProvenance\|sourceKind\|confidence' ESC`                                                                  | proveniência **persistida** e lida              | tipo + validação sem persistência                     | type-only           |
| `15.5` | `grep -rniE 'tsvector\|tsquery\|to_tsvector\|using gin' src drizzle`                                                       | índice FTS migrado + consulta de runtime        | só a migração, sem consulta                           | 0 hits              |
| `15.6` | `grep -rniE 'pgvector\|embedding\|vector\(' src drizzle package.json`                                                      | extensão + coluna + busca ANN                   | coluna/dep sem busca                                  | 0 hits              |
| `15.7` | `grep -rn 'memory' src/server/services src/server/repositories src/lib` (retrieval)                                        | retrieval servindo rota                         | repositório sem rota                                  | 0 hits              |
| `19.6` | `grep -rnE 'candidate_count\|persisted_count\|rejected_count\|retrieval_latency\|user_correction_rate\|conflict_rate' ESC` | ≥1 medidor emitido em runtime                   | medidor instrumentado sem emissão                     | só prosa            |
| `21.3` | `grep -rnE '\bSERIALIZABLE\b\|40001\|serialization_failure\|serializationError' src scripts drizzle`                       | nível + retry no caminho de escrita             | nível declarado sem retry                             | 0 hits              |
| `22.4` | `grep -rnE 'idempotency_records' src scripts drizzle` + busca de agendamento (`.github/workflows`, `cron`)                 | purga agendada **e** testada                    | função de purga existe sem agendamento                | só cleanup de teste |
| `25.5` | `grep -rn 'dependency-review' .github/`                                                                                    | workflow ativo                                  | arquivo existe sem rodar                              | 0 hits              |
| `25.6` | `grep -rni 'codeql' .github/` + `ls .github/workflows/`                                                                    | workflow versionado                             | —                                                     | 0 hits              |
| `25.7` | `ls .github/secret_scanning.yml` + `grep -rni 'secret.scanning' .github/`                                                  | arquivo versionado                              | —                                                     | 0 hits              |
| `29.1` | `grep -rnE 'p95\|p99\|percentile\|SLO\|slo_' src scripts drizzle`                                                          | percentil **e** veredito contra alvo em runtime | percentil calculado sem veredito                      | só teste            |

**Precedência de classe (declarada antes de medir):** `UNV` só se a ausência for **inverificável de
princípio** (estado externo inalcançável daqui). Ausência **verificável** por `grep`/`ls` é `NS` — a
regra já está no `AGENTS.md` desde o WP-R4. Os dois `UNV` de `25` serão reclassificados por esse
critério, e a reclassificação é **achado**, não promoção.

## 5. Saídas exigidas (duais)

1. **Tabela de transição** — por item: classe na camada · classe medida hoje · **delta nomeado** ·
   comando que decidiu · evidência (captura). Sem linha sem comando.
2. **Baseline de KPI** — a mesma medição expressa no placar (`D`, `P`, `NS`, `UNV`, `NA`), com a
   fórmula congelada `(D + ½·P) / 187` aplicada **antes** e **depois**, para o MAESTRO decidir.

**Nada é promovido por este WP.** A saída é uma **proposta de placar**, com o delta explícito; o
escritor é o MAESTRO.

## 6. DoD

| #   | critério                                                                    | prova                                                               |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 14 de 14 itens com comando **pré-registrado** e saída medida                | §4 + `captures/remedicao.log.txt`                                   |
| 2   | `checked === discovered` — o instrumento enumera por descoberta             | a lista de itens vem do parser da camada, não de uma lista digitada |
| 3   | controle negativo: um item comprovadamente DONE medido pelo mesmo predicado | `22.1`/`25.4` (Dependabot já fechado) medidos e classificados DONE  |
| 4   | nenhum `P` sem delta nomeado (C4)                                           | coluna delta preenchida em toda linha P                             |
| 5   | denominador 187 inalterado (C2)                                             | soma das classes = 187                                              |
| 6   | os dois `UNV` reclassificados por critério escrito, não por opinião         | §4 precedência + decisão por item                                   |
| 7   | `npm run check` exit 0 no commit selado                                     | captura do gate                                                     |
| 8   | selo com `checked === discovered`                                           | `m02-seal`                                                          |

## 7. Riscos

| risco                                                               | disposição                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| o instrumento mede prosa e promove por engano                       | escopo exclui `docs/` por construção, e o predicado exige **uso em runtime**, não ocorrência de string                   |
| promoção por inferência (o cluster "parece pronto")                 | C1 exige conjunção item a item; a §5 proíbe promoção e o S6 audita a tabela                                              |
| reclassificar `UNV` → `NS` parecer "endurecer para parecer honesto" | a reclassificação é decidida pelo critério escrito na §4 e **piora** o placar em crédito parcial; não há ganho a extrair |
| falso DONE por `grep` de string em comentário                       | cada predicado exige uso em **posição de valor** (chamada/import/emit), não menção                                       |

## 8. Rollback

`git checkout develop && git branch -D mission/r0b-remeasure`. Sem migration, sem estado externo,
`:5432` intocado, `origin/main` intocado.
