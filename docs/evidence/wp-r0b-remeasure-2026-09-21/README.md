# WP-R0b `F-remeasure-187` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r0b-remeasure` · **Base:** `a75a62b`
**Head do selo:** §8 · **S6:** lane adversarial de contexto limpo (§7)
**Escritor do placar:** MAESTRO — este WP **mede e propõe**; a §5 é proposta, não promoção.

---

## 1. Sumário

A régua ratificada para abrir o R0b é **sub-itens medidos individualmente; cluster não é unidade de
placar**, endurecida por cinco cláusulas (§2 da SPEC). O objeto é o bloco que a régua tornou
duvidoso: os **12 NS + 2 UNV** da camada de 2026-09-15.

**Resultado: 7 dos 14 itens se moveram — e nenhum promoveu.** O cluster de memória (§15 do plano)
saiu do zero: **6 tabelas `ai_mem*` migradas** com constraints e índices, `memory.repository.ts` com
`append`/`revise`/`search`/`delete`/`export`/`expireDue`, um **policy engine** real
(`evaluateMemoryPolicy`, chamado por `memory.service.ts:44`) e uma **suíte de banco** na cadeia do
`db:test`. Mas **nada em runtime importa o serviço** — 0 importadores fora de teste, 0 rotas —, e
cada item do §15 é conjuntivo: **nenhum** satisfaz o próprio texto por inteiro. Os 7 vão a **PARTIAL
com delta nomeado**; o placar **cru não se move** (`150/187 = 80,2139%`), porque DONE é conjunção e
nada cruzou a barra.

**O que NÃO se moveu também foi medido, e um dos "não" foi um erro meu:** FTS (`15.5`) é **0 hit
real** — a v1 do instrumento reportava 27, e os 27 eram `tsQuery` do TanStack Router. E o `15.2`,
que eu havia classificado **DONE** na primeira passada, é **PARTIAL**: o §15.2 lista **9** tabelas, e
existem **6** por nome (`+2` sob os nomes superseded de `15.2c`), faltando `ai_memory_embeddings` —
bloqueada pelo §44. A correção veio de **ler o plano**, não de recontar o grep: a linha de evidência
do anexo era uma _receita de medição_, não a definição do item.

## 2. Arquivos

| arquivo                                             | mudança                                                 |
| --------------------------------------------------- | ------------------------------------------------------- |
| `docs/evidence/wp-r0b-remeasure-2026-09-21/SPEC.md` | **novo** — régua, 5 cláusulas, comandos pré-registrados |
| `.../captures/instrumento-remedicao.sh.txt`         | **novo** — instrumento v1 (pré-registrado)              |
| `.../captures/remedicao.log.txt`                    | **novo** — saída da v1                                  |
| `.../captures/instrumento-remedicao-v2.sh.txt`      | **novo** — v2, com FP-A/FP-B/FP-C declarados            |
| `.../captures/remedicao-v2.log.txt`                 | **novo** — saída da v2 (a que decide)                   |
| `.../captures/gate-local.log.txt`                   | **novo** — `npm run check` exit 0 no commit selado      |
| `.../captures/isolamento.log.txt`                   | **novo** — bancada assertada + resíduo do WP-R6 achado  |
| `.../README.md`                                     | **novo** — este selo                                    |

**Não muda:** nenhuma linha de código de runtime, nenhuma migration, `package.json` intocado,
`:5432` intocado, `origin/main` intocado. Este WP só lê.

## 3. Evidência por fase

| fase                     | captura                            | número medido                                                                           |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------- |
| **Descoberta dos itens** | `captures/remedicao.log.txt` §0    | **14** itens vindos do parser do anexo (12 NS + 2 UNV), não de lista digitada           |
| **v1 (pré-registrada)**  | `captures/remedicao.log.txt`       | 2 falsos positivos do próprio instrumento (FP-A `tsQuery`, FP-B `cron`→"síncrona")      |
| **v2 (corrigida)**       | `captures/remedicao-v2.log.txt`    | 14 de 14 itens com classe, delta e o que decidiu; FP-C declarado (`wc -l` sem newline)  |
| **Controle negativo**    | `captures/remedicao-v2.log.txt` §C | `25.4` mede **DONE** (arquivo existe) e `22.1` mede **DONE** (14 hits em `drizzle/`)    |
| **Gate local**           | `captures/gate-local.log.txt`      | `npm run check` **exit 0**                                                              |
| **Isolamento**           | `captures/isolamento.log.txt`      | `origin/main` intocado · `:5432` 0 listeners · 0 migrations · resíduo do WP-R6 removido |

## 4. Tabela de transição — item a item

O **texto do plano** é o critério; a linha de evidência do anexo é a _receita de medição_ da camada.
Onde as duas leituras divergem, vale a **mais estrita** (cláusula C1: conjunção), e a divergência
fica declarada em §4.1.

| item   | camada | hoje        | delta nomeado (cláusula C4)                                                                                                                  | o que decidiu                                                                    |
| ------ | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `15.1` | NS     | **PARTIAL** | ordem respeitada (embeddings **não** foram iniciados) **e** Memory Service existe; **falta o entrypoint de runtime**                         | 0 importadores de `memory.service` fora de teste · 0 rotas                       |
| `15.2` | NS     | **PARTIAL** | **6 das 9 tabelas** do §15.2 por nome; `ai_conversations`/`ai_messages` sob os nomes superseded de `15.2c`; **falta `ai_memory_embeddings`** | `CREATE TABLE` = 6 · `chat_conversations`/`chat_messages` existem · embeddings 0 |
| `15.3` | NS     | **PARTIAL** | o **backend decide** de verdade (`evaluateMemoryPolicy`); **o serviço que decide não tem entrypoint**                                        | engine chamado em `memory.service.ts:44` · 0 chamadores do serviço               |
| `15.4` | NS     | **PARTIAL** | proveniência **persistida** (`source_kind`/`origin`/`ref`/`confidence` com check); **nada em runtime a produz**                              | `ai_memory_sources` em 3 migrations · 11 usos no repositório                     |
| `15.5` | NS     | **NS**      | **sem FTS**: 0 `tsvector`/`tsquery`/GIN em código ou migration; configuração portuguesa não testada                                          | v2 case-sensitive com fronteira = **0** (v1 = 27, todos `tsQuery`)               |
| `15.6` | NS     | **NS**      | sem exact-NN, sem `pgvector`, sem ANN — §44 só abre depois do §43                                                                            | 0 hits em `src/`, `drizzle/`, `package.json`                                     |
| `15.7` | NS     | **PARTIAL** | ranking combina **tenant** (filtro) e **recency** (`createdAt desc`); **faltam lexical, semântico, importance e confidence**                 | `search()` ordena só por `createdAt, id` · 0 `ts_rank`/similaridade              |
| `19.6` | NS     | **NS**      | nenhum medidor emitido; os seis nomes só existem no plano                                                                                    | 0 hits no escopo de código                                                       |
| `21.3` | NS     | **NS**      | nível de isolamento e retry ausentes (ADR-029 adia para T3)                                                                                  | `SERIALIZABLE`/`40001` = 0 · os 8 `serializationError` são de **decimal**        |
| `22.4` | NS     | **NS**      | tabela usada para idempotência (20 usos), **sem purga**: só o índice de expiração existe                                                     | 0 funções de purga · 0 agendamento                                               |
| `25.5` | NS     | **NS**      | nenhum workflow usa `dependency-review-action`                                                                                               | 0 hits em `.github/`                                                             |
| `25.6` | UNV    | **UNV**     | ausência no repo é **verificável** (0 hits); a ativação é **settings-side** → inverificável de princípio                                     | 0 hits · os 6 workflows listados                                                 |
| `25.7` | UNV    | **UNV**     | idem `25.6`: o arquivo não existe no repo, a ativação é settings-side                                                                        | `ls` falha · 0 hits                                                              |
| `29.1` | NS     | **PARTIAL** | percentil e veredito existem para as baselines RUM/IA; **falta o p95 de backend** contra os alvos do §29                                     | `rum-percentiles.ts`/`ai-latency-baseline.ts` · 0 em `requestDuration`           |

**Composição (cláusula C2):** `0 + 7 + 5 + 2 = 14` itens — o denominador **187 não muda** e nenhum
item sai da conta.

### 4.1 Leituras divergentes e autos-correções declaradas

| #   | divergência                                                                                                        | disposição                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | o §15.1 do plano é **"Ordem correta"** (a ordem de implementação), não "Memory Service pronto" como o anexo resume | duas leituras medidas e declaradas; vale a **mais estrita** → PARTIAL. Ler só o anexo daria DONE por vacuidade ("não comecei por embeddings, logo respeitei a ordem")    |
| D2  | o §15.7 do plano é **"Ranking"** (7 sinais combinados), não "retrieval"                                            | medido pelos 7 sinais; 2 de 7 presentes → PARTIAL, delta nomeado                                                                                                         |
| D3  | **erro meu, achado por leitura do plano**: eu havia classificado `15.2` como **DONE** na primeira passada          | corrigido para **PARTIAL**: o §15.2 lista 9 tabelas e existem 6 (+2 superseded); `ai_memory_embeddings` não existe. A receita de grep do anexo não é a definição do item |
| D4  | **FP-A**: `grep -i tsquery` media `tsQuery` do TanStack Router (27 hits falsos)                                    | v2 com fronteira e case-sensitive → 0. Sem isso, o `15.5` teria sido promovido por engano                                                                                |
| D5  | **FP-B**: `grep -i cron` media "síncrona" em prosa                                                                 | v2 restrita a `\bcron\b`/`crontab`/`pg_cron`, com os 4 hits impressos e lidos um a um                                                                                    |
| D6  | **FP-C**: `wc -l` num arquivo sem newline final contou 13 para 14 itens                                            | contagem por `grep -c .` + a asserção de identidade `len(alvo) == 14`, que já era o critério real                                                                        |

**Leitura de método:** três dos seis achados desta rodada são **defeitos do próprio instrumento**, e
os três são da mesma família que a série já vinha medindo — _casar substring onde o critério é o
token_, e _contar cardinalidade onde o critério é identidade_. O instrumento não foi poupado pela
régua que ele aplica.

## 5. Baseline de KPI — proposta ao MAESTRO (fórmula congelada, cláusula C5)

| grandeza                        | antes (vigente) | proposto     | delta            |
| ------------------------------- | --------------- | ------------ | ---------------- |
| DONE                            | 150             | **150**      | **0**            |
| PARTIAL                         | 23              | **30**       | +7               |
| NS                              | 12              | **5**        | −7               |
| UNVERIFIABLE                    | 2               | **2**        | 0                |
| total                           | 187             | 187          | **0**            |
| crédito parcial `(D + ½·P)/187` | **86,3636%**    | **88,2353%** | **+1,8717 p.p.** |
| cru `D/187`                     | **80,2139%**    | **80,2139%** | **0,0000 p.p.**  |

**Isto é uma proposta.** O WP não escreve no placar: a régua diz que o escritor é o MAESTRO, e o
crédito só entra depois da ratificação. **Nenhum item foi promovido** — o ganho é inteiramente de
`NS → PARTIAL` com delta nomeado, e o **cru não se move**, o que é o resultado que a régua
conservadora previa: medir mais não é o mesmo que valer mais.

## 6. Checklist anti-vacoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                     |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | §C da v2: `25.4` e `22.1`, itens com fato-fonte de fechamento, medem **DONE** no mesmo predicado que reprova os NS                      |
| 2   | Fronteira nas duas direções            | cada item tem os três ramos (DONE/PARTIAL/NS) e a v2 mostra o lado que **reprova** (0 hits de FTS) e o lado que **aprova** (6 tabelas)  |
| 3   | Identidade, não cardinalidade          | o instrumento imprime **nomes** (as 6 tabelas, os arquivos que chamam o engine, os 4 hits de `cron`), não só contagens                  |
| 4   | Proibido exit-code-only                | a saída é a string `PARTIAL/NS/DONE` com o motivo ao lado, e a §4 nomeia o que decidiu                                                  |
| 5   | Proibido sleep fixo                    | não se aplica: medição estática, sem sincronização temporal                                                                             |
| 6   | Sem valor degenerado na identidade     | cada classe tem ≥1 evidência nomeada; nenhuma linha é "0 = 0"                                                                           |
| 7   | Precondição de estado compartilhado    | §3 do isolamento: worktree limpo fora do selo, `:5432` 0 listeners, `origin/main` conferido                                             |
| 8   | Sentinela real por cenário             | os comandos rodam sobre a árvore real no commit declarado, não sobre fixtures                                                           |
| 9   | Fingerprint de revisão                 | `HEAD` impresso na 1ª linha de cada captura; `m02-seal` no fecho                                                                        |
| 10  | `checked === discovered`               | os 14 itens vêm do **parser do anexo** (12 NS + 2 UNV pós-dedução), com asserção de identidade — não de lista digitada                  |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                      |
| 12  | Falha alta (fail-closed)               | o parser **asserta** `len == 14` e a identidade da lista; item novo no anexo quebra o instrumento em vez de passar despercebido         |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt` — que **achou e removeu** o container residual do WP-R6                                                   |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 e da §4 aponta captura versionada                                                                                      |
| 15  | Run de CI atado ao commit selado       | §8                                                                                                                                      |
| 16  | Descoberta multi-sítio                 | descoberta pelo parser do anexo **e** por `grep` no código; os três falsos positivos do instrumento mostram por que a fronteira importa |
| 17  | Precondição de estado ambiente         | o instrumento declara o `HEAD` que mediu; o trabalho é **read-only** e o resíduo de bancada foi removido antes do selo                  |

## 7. S6 ADVERSARIAL

_(preenchido no S6 — lane de contexto limpo, alvo congelado)_

## 8. CI e commits

| campo             | valor                |
| ----------------- | -------------------- |
| base              | `a75a62b`            |
| land em `develop` | _(preenchido no S7)_ |
| run@sha           | _(preenchido no S8)_ |
| `origin/main`     | `9724d2c` — intocado |
