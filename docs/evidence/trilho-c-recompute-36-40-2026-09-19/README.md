# TRILHO C — recomputação da camada §36–§40 (2026-09-19)

**WP:** `F-D2-recompute-36-40` (último item do Bloco 1 do despacho SDD).
**Base da recomputação:** `develop @ d9e58a28d21c0178f2b810d00e38d4b4866e82d8` (2026-09-19).
**Base da medição original:** `develop @ 724594c` (2026-09-15T00:54:23-03:00).

---

## 1. O problema

A camada §36–§40 (`P0-01..17`, `P1-01..15`, `P2-01..10`, `ORD-01..38`, `GATE-41..44`, `DEF-01..05`
= **89 itens**) foi medida em **2026-09-15** contra `724594c` e carrega um aviso literal de
**⚠ CAMADA OBSOLETA** (`ANEXO-ITENS-2026-09-15.md:205`). Entre a medição e hoje a árvore recebeu o
outbox, a escada de memória D1–D4, o runner de backfill, o coletor de `pg_stat_statements`, o
TRILHO A e o TRILHO B. O DoD do WP pede a camada **refletindo o estado atual**, com **deltas
explicados item a item** e **`checked === discovered` preservado**.

## 2. O que foi e o que não foi reexecutado

| verificação                                        | como                                                                              | resultado                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 18 afirmações de `grep … → N` da camada            | `rg` reexecutado contra o HEAD (`.artifacts/zz-verify-36-40-v2.py`)               | 8 confirmadas, **8 quebradas** (1 fora de alcance, 1 de substância)                             |
| 172 referências `arquivo:linha`                    | arquivo existe + tem linhas suficientes                                           | **152 ok**, 1 fora de alcance, 19 não são arquivos                                              |
| 89 linhas ↔ 89 linhas                              | gerador `.artifacts/zz-trilho-c-recompute.py` — **identidade**, não cardinalidade | `checked === discovered` **OK** (mesma sequência de 89 ids; linhas sem override byte-idênticas) |
| leitura direta dos artefatos que decidem cada item | `read` nos arquivos citados                                                       | 18 itens com override declarado                                                                 |

O gerador **não mede nada**: lê as 89 linhas da camada **do commit** `d9e58a2` (nunca do working
tree), seleciona-as por **padrão de id** e aplica apenas os overrides declarados. Ele recusa override
para id inexistente, recusa id duplicado, exige sequência de ids idêntica na saída e aborta com exit 1
em qualquer divergência.

### 2.1 Defeito do próprio guard, encontrado e corrigido neste WP

A **primeira** versão do gerador indexava a camada por **número de linha absoluto** (209–297). Quando
esta própria recomputação inseriu o aviso `RECOMPUTADA` acima da tabela no ANEXO, as linhas
**deslocaram**, e a regeração produziu uma tabela **errada**: 67 DONE em vez de 69, com a linha de
cabeçalho e a de separação ocupando o lugar de dois itens reais. **O guard não pegou.**

`checked === discovered` naquela versão comparava **cardinalidade** (89 linhas de entrada, 89 de saída)
e não **identidade** — e 89 linhas erradas contam 89. É exatamente o defeito que o TRILHO A fechou nos
guards de runner (`F-D2-runner-substitution`: _guards que pinam cardinalidade, não identidade_), aqui
reproduzido por mim, no mesmo dia, no meu próprio instrumento de verificação.

Correção: a origem passou a ser lida **do commit** por padrão de id, e o invariante passou a exigir
(a) mesma sequência de ids na entrada e na saída e (b) linhas sem override **byte-idênticas**. A versão
antiga virou um caso de teste do próprio guard: ela é rejeitada.

A lição que fica é mais forte que a correção: **um gate que conta linhas não vê linhas trocadas**.

Capturas: `captures/verificacao-mecanica-camada-v2.log.txt` (autoritativa, 3 579 B),
`captures/verificacao-mecanica-camada.log.txt` (v1, com o defeito de parsing visível, 12 586 B),
`captures/fatos-do-tree*.log.txt`, `captures/quando-entrou.log.txt`.

## 3. Inventário recomputado

|         | antes (724594c) | depois (d9e58a2) |
| ------- | --------------- | ---------------- |
| DONE    | 67              | **69**           |
| PARTIAL | 10              | **10**           |
| NS      | 11              | **9**            |
| NA      | 1               | **1**            |
| total   | 89              | **89**           |

A camada **não é somada ao denominador de 187** (ela tem overlap declarado com o placar). Portanto:
**o placar permanece 150 D · 23 P · 12 NS · 2 UNV / 187 = 86,36% parcial · 80,21% crua.**

## 4. Deltas de status — 3

| item      | antes   | depois      | razão medida                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P2-02`   | NS      | **DONE**    | outbox completa: `outbox_events` + índice único de idempotência (`src/db/schema.ts:871,892,894`), `0015_curved_riptide.sql`, `outbox.repository.ts` (241 l.), `event.service.ts`, `outbox.worker.ts` (182 l.) e `scripts/db/test-outbox.ts` (731 l., etapa 12 do `db:test`). Os itens `23.1`/`23.2` **já contam DONE no placar** desde 2026-09-15 — a camada é que não havia sido recomputada. |
| `GATE-41` | PARTIAL | **DONE**    | as 11 condições do §41 reconferidas uma a uma; a única que faltava era o literal **"CI verde"**, observado em 2026-09-19 (`UI stack` run `35465442629` em `9be9956` e run `35461588021` em `f06c6d8`, ambos `success`).                                                                                                                                                                        |
| `GATE-43` | NS      | **PARTIAL** | **6 das 7 condições** do §43 têm artefato medido (Conversation Service, Memory Service, policy engine, proveniência, tenant isolation, delete/export). A 7ª — **FTS** — está ausente: `rg -w tsvector / to_tsvector / to_tsquery` → 0 hits, e o único `search` é `position(lower($1) in lower(content)) > 0`.                                                                                  |

`GATE-43` é o delta que mais importa: a nota original dizia "faltam Memory Service, policy engine,
proveniência, isolamento, delete/export e FTS" — **6 dos 7 itens dessa lista existem hoje**. O gate
continua **não** passado, e §43 diz "Só então embeddings", logo `P2-05`/`P2-06`/`GATE-44` seguem
bloqueados.

## 5. Correções de evidência sem mudança de status — 15

| item      | afirmação da camada                                                              | medido no HEAD                                                                                                                                                         | status                                      |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `P0-01`   | grep `dangerouslySetInnerHTML/DOMPurify` → 1 hit                                 | **2** arquivos (o módulo e o teste), ambos comentário/asserção                                                                                                         | DONE mantido                                |
| `P1-02`   | "MemoryService e EventService seguem contratos sem runtime (bloqueio M-05/M-04)" | **falsificado**: os dois existem como runtime; `matrix.overlay.yaml:33,41` e `matrix.yaml:1372,1380` declaram-nos `implemented`                                        | PARTIAL mantido, razão corrigida            |
| `P1-03`   | "10 arquivos" em `src/server/repositories/`                                      | **12**                                                                                                                                                                 | DONE mantido                                |
| `P1-11`   | `src/lib/financial.functions.ts:54-70`                                           | **fora de alcance** (arquivo tem 64 linhas); `saveSimulation` em `:54`                                                                                                 | DONE mantido                                |
| `P1-15`   | "`_journal.json` idx 0..14, último `0014_mighty_veda`"                           | **20 entradas**, `idx` 0..19, último `0019_tiresome_robin_chapel`                                                                                                      | DONE mantido                                |
| `P2-03`   | "nenhuma tabela de memória, nenhum serviço"                                      | **falsificado**: 6 tabelas, `memory.service.ts`, `memory.policy.ts`, `memory.repository.ts` (1160 l.), `test-memory.ts` (2919 l.)                                      | NS mantido por régua (§4)                   |
| `P2-04`   | grep `tsvector/to_tsvector/tsquery/GIN` → 0 hits                                 | `tsvector` 0, mas `GIN` **1** — comentário em `memory.repository.ts:14`                                                                                                | NS mantido                                  |
| `P2-06`   | grep `hybrid/retrieval/rrf` → 0 hits                                             | `hybrid` 0, `rrf` 0, **`retrieval` 9 arquivos** — todos prosa/comentário                                                                                               | NS mantido                                  |
| `P2-07`   | grep `memory/memória` em `src/routes/`, `drizzle/`, `schema.ts` → 0 hits         | **4 arquivos** em `drizzle/` + `schema.ts`; 0 rotas                                                                                                                    | NS mantido                                  |
| `P2-10`   | "faltam pg_stat_statements (grep → 0 hits)"                                      | **falsificado**: `scripts/obs/pg-stat-statements.ts` (505 l.) + teste + artefato de performance com raw versionado (2026-09-15); o item `16.3` do placar **já é DONE** | PARTIAL mantido (resta §16.8 scale-to-zero) |
| `ORD-32`  | "nenhuma tabela, nenhum serviço"                                                 | falsificado; espelha `P2-03`                                                                                                                                           | NS mantido por régua                        |
| `ORD-33`  | grep → 0 hits                                                                    | verdadeiro; espelha `P2-04`                                                                                                                                            | NS mantido                                  |
| `ORD-35`  | grep `hybrid/retrieval` → 0 hits                                                 | `retrieval` em 9 arquivos de prosa; espelha `P2-06`                                                                                                                    | NS mantido                                  |
| `ORD-36`  | (observabilidade)                                                                | acrescenta-se o achado **D7**: instrumentos existem mas **nunca exportam** (meter obtido no module scope antes do provider)                                            | PARTIAL mantido                             |
| `GATE-44` | grep embutia `pg_stat_statements` no mesmo padrão → 0 hits                       | `pg_stat_statements` **existe**; `pgvector`/`hnsw`/`embedding(s)` → 0 e `ai_memory_embeddings` inexistente                                                             | NA mantido                                  |
| `P2-09`   | CSP report-only por default                                                      | confirmado (`security-headers.ts:45`, `process.env.CSP_ENFORCE === "true"`)                                                                                            | PARTIAL mantido                             |

## 6. Defeito sistemático de evidência da camada (achado)

A camada escreve as afirmações de `grep` na forma `grep 'a/b/c' → 0 hits`, usando **`/` como
alternância**. Sempre que **um** dos termos aparece em prosa ou comentário, a afirmação "0 hits" é
**falsa na letra**, mesmo quando **verdadeira na substância**. Foi o que aconteceu em `P2-04`
(`GIN`), `P2-06`/`ORD-35` (`retrieval`) e `P2-07`/`ORD-32` (`memory`). O efeito é nos dois sentidos:
quebra a reprodutibilidade da camada (**18 → 8 afirmações confirmadas**) e, se alguém "corrigir"
lendo só o número, rebaixa item que está certo.

**Correção proposta para a próxima medição:** uma afirmação de grep por termo, com o termo entre
crases, e o resultado medido por extenso — nunca `a/b/c → 0`.

## 7. O que NÃO está provado

- **Nenhum item promovido ganhou crédito no placar de 187** — a camada é uma vista com overlap, e o
  DoD deste WP é a camada, não o placar. `P2-02` já era DONE no placar; `GATE-41`/`GATE-43` são
  gates, não itens do denominador.
- **`P2-03`/`ORD-32` são decisão de régua, não medida.** O artefato existe; creditar o item como
  DONE (contando FTS/vetor como `P2-04`/`P2-05` separados) é legítimo e está declarado como
  alternativa. Mantive **NS** pela leitura conservadora já fixada no ciclo anterior
  ("a escada §43 é degrau de gate, não item do Plano") e porque a §43 exige FTS.
- **`P2-07` depende de uma definição que o Plano não dá.** "central de memória" aparece **uma única
  vez** em todo o Plano (linha 2071, como rótulo de lista). Interpretei como superfície de
  gestão/UI por continuidade com a medição anterior — o MAESTRO pode redefinir.
- **A divergência `registry × placar` do `9.1` está aberta, não resolvida.** O registry do projeto
  (`matrix.overlay.yaml`, `matrix.yaml`) declara os **10/10** serviços `implemented`; o placar de 187
  mantém `9.1` como PARTIAL (8/10 dedicados). A recomputação **não escolhe**: mantém PARTIAL
  alinhado ao placar e registra a divergência como decisão da régua.
- **`P1-14`/`ORD-28` (Neon branch CI) e `ORD-30` (cutover) não foram remedidos** — dependem de
  `NEON_API_KEY` (H-2) e de tráfego real (H-6). O que existe é o sinal do watcher: `app-live.txt`
  e `H2-ready.txt` **ausentes** (correto: alvo segue em placeholder PHP).
- **Nenhum número de produção foi tocado.** `:5432` intocado; nenhuma credencial de produção no
  ambiente; `origin/main` = `9724d2c` intocado.

## 8. Rollback

Não há migration nem código de runtime neste WP: são **dois documentos de evidência**
(`MEDICAO-2026-09-15.md`, `ANEXO-ITENS-2026-09-15.md`), **um artefato novo**
(`camada-36-40-recomputada.md`) e uma **seção nova no ledger**. Reversão = `git revert` do commit
documental; os avisos de OBSOLETA dos dois documentos originais voltam no mesmo revert.

## 9. Artefatos

| arquivo                                           | conteúdo                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `camada-36-40-recomputada.md`                     | as **89 linhas** da camada, recomputadas, com o inventário no cabeçalho                               |
| `captures/verificacao-mecanica-camada-v2.log.txt` | verificação mecânica autoritativa (89 == 89)                                                          |
| `captures/verificacao-mecanica-camada.log.txt`    | v1, preservada com os **28 falsos "ARQUIVO AUSENTE"** e os **127 falsos positivos** de `GIN` visíveis |
| `captures/fatos-do-tree.log.txt` · `-2` · `-3`    | contagens de serviços, repositórios, migrações, tabelas, tamanhos                                     |
| `captures/quando-entrou.log.txt`                  | commit e data de entrada de cada artefato que decide um delta                                         |
| `captures/recompute-camada.log.txt`               | saida do gerador: `89 -> 89`, os 3 deltas de status e as contagens 69/10/9/1                          |
| `captures/verificacao-independente.log.txt`       | **a prova do escopo**: 89 ids idênticos à origem e **exatamente 18** linhas com células diferentes    |
| `captures/diff-documentos-originais.log.txt`      | o diff dos dois documentos de origem (o aviso de recomputada que foi acrescentado)                    |
| `MANIFEST.sha256`                                 | selo de tudo acima (conferido **da raiz do repo** — o manifesto carrega caminhos relativos à raiz)    |
