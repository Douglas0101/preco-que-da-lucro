# WP-R0b `F-remeasure-187` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r0b-remeasure` · **Base:** `a75a62b`
**Head do selo:** §8 · **S6:** lane adversarial de contexto limpo (§7)
**Escritor do placar:** MAESTRO — este WP **mede e propõe**; a §5 é proposta, não promoção.

---

## 1. Sumário

A régua ratificada para abrir o R0b é **sub-itens medidos individualmente; cluster não é unidade de
placar**, endurecida por cinco cláusulas (§2 da SPEC). O objeto é o bloco que a régua tornou
duvidoso: os **12 NS + 2 UNV** da camada de 2026-09-15.

**Resultado: 6 dos 14 itens se moveram de classe — e nenhum promoveu.** O cluster de memória (§15 do plano)
saiu do zero: **6 tabelas `ai_mem*` migradas** com constraints e índices, `memory.repository.ts` com
`append`/`revise`/`search`/`delete`/`export`/`expireDue`, um **policy engine** real
(`evaluateMemoryPolicy`, chamado por `memory.service.ts:44`) e uma **suíte de banco** na cadeia do
`db:test`. Mas **nada em runtime importa o serviço** — 0 importadores fora de teste, 0 rotas —, e
cada item do §15 é conjuntivo: **nenhum** satisfaz o próprio texto por inteiro. Os 6 vão a **PARTIAL
com delta nomeado**; o placar **cru não se move** (`150/187 = 80,2139%`), porque DONE é conjunção e
nada cruzou a barra.

**O que NÃO se moveu também foi medido, e um dos "não" foi um erro meu:** FTS (`15.5`) é **0 hit
real** — a v1 do instrumento reportava 27, e os 27 são a **substring** `tsQuery` dentro de
`productsQuery` (5 rotas + 1 teste), não um token. E o `15.2`,
que eu havia classificado **DONE** na primeira passada, é **PARTIAL**: o §15.2 lista **9** tabelas, e
existem **6** por nome (`+2` sob os nomes superseded de `15.2c`), faltando `ai_memory_embeddings` —
bloqueada pelo §44. A correção veio de **ler o plano**, não de recontar o grep: a linha de evidência
do anexo era uma _receita de medição_, não a definição do item.

**E os dois `UNV` viraram `NS`:** eu os havia mantido como inverificáveis por "settings-side", e a API
do GitHub **responde** o estado dos dois recursos (`403` "Code scanning is not enabled for this
repository"; `404` "Secret scanning is disabled on this repository"). `UNV` foi a **0** — que é o
ponto: `U` é reservado a inverificabilidade **de princípio**, e aqui havia um caminho de verificação
que eu não tinha tentado. A composição final é **`0 DONE · 6 PARTIAL · 8 NS · 0 UNV`**, e o **cru
não se move**: `150/187 = 80,2139%` antes e depois.

## 2. Arquivos

| arquivo                                             | mudança                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `docs/evidence/wp-r0b-remeasure-2026-09-21/SPEC.md` | **novo** — régua, 5 cláusulas, comandos pré-registrados           |
| `.../captures/instrumento-remedicao.sh.txt`         | **novo** — instrumento v1 (pré-registrado)                        |
| `.../captures/remedicao.log.txt`                    | **novo** — saída da v1                                            |
| `.../captures/instrumento-remedicao-v2.sh.txt`      | **novo** — v2, com FP-A/FP-B/FP-C declarados                      |
| `.../captures/remedicao-v2.log.txt`                 | **novo** — saída da v2 (não decide mais: fail-open na descoberta) |
| `.../captures/instrumento-remedicao-v3.sh.txt`      | **novo** — v3, a que **decide** (fecha os 3 achados ALTOS do S6)  |
| `.../captures/remedicao-v3.log.txt`                 | **novo** — saída da v3 (composição calculada e assertada)         |
| `.../captures/gate-local.log.txt`                   | **novo** — `npm run check` exit 0 no commit selado                |
| `.../captures/isolamento.log.txt`                   | **novo** — bancada assertada + resíduo do WP-R6 achado            |
| `.../README.md`                                     | **novo** — este selo                                              |

**Não muda:** nenhuma linha de código de runtime, nenhuma migration, `package.json` intocado,
`:5432` intocado, `origin/main` intocado. Este WP só lê.

## 3. Evidência por fase

| fase                     | captura                            | número medido                                                                                                                              |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Descoberta dos itens** | `captures/remedicao.log.txt` §0    | **14** itens vindos do parser do anexo (12 NS + 2 UNV), não de lista digitada                                                              |
| **v1 (pré-registrada)**  | `captures/remedicao.log.txt`       | 2 falsos positivos do próprio instrumento (FP-A `tsQuery`, FP-B `cron`→"síncrona")                                                         |
| **v2 (corrigida)**       | `captures/remedicao-v2.log.txt`    | 14 de 14 itens com classe e delta; FP-C declarado — mas **fail-open na descoberta** (S6 N3)                                                |
| **v3 (a que decide)**    | `captures/remedicao-v3.log.txt`    | descoberta **dentro** do script com asserção de identidade; composição **calculada** das classes emitidas                                  |
| **Controle negativo**    | `captures/remedicao-v3.log.txt` §C | mesmo comando, veredicto oposto: `dependabot`=1 (DONE) × `dependency-review`=0 (NS); arquivo: `dependabot.yml`=1 × `secret_scanning.yml`=0 |
| **Gate local**           | `captures/gate-local.log.txt`      | `npm run check` **exit 0**                                                                                                                 |
| **Isolamento**           | `captures/isolamento.log.txt`      | `origin/main` intocado · `:5432` 0 listeners · 0 migrations · resíduo do WP-R6 removido                                                    |

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
| `25.6` | UNV    | **NS**      | **verificável, não indeterminável**: a API responde "Code scanning is not enabled for this repository" (403); habilitar depende do plano     | `gh api .../code-scanning/default-setup` → 403 de estado de recurso              |
| `25.7` | UNV    | **NS**      | **verificável, não indeterminável**: "Secret scanning is disabled on this repository" (404); o arquivo não existe no repo                    | `gh api .../secret-scanning/alerts` → 404 de estado de recurso · `ls` falha      |
| `29.1` | NS     | **PARTIAL** | percentil e veredito existem para as baselines RUM/IA; **falta o p95 de backend** contra os alvos do §29                                     | `rum-percentiles.ts`/`ai-latency-baseline.ts` · 0 em `requestDuration`           |

**Composição (cláusula C2):** `0 + 6 + 8 + 0 = 14` itens — o denominador **187 não muda** e nenhum
item sai da conta. A soma é **calculada das classes emitidas pelo instrumento**, não digitada (§E da
v3), e o instrumento **asserta** que fecha em 14 e que o placar fecha em 187.

### 4.1 Leituras divergentes e autos-correções declaradas

| #   | divergência                                                                                                                              | disposição                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | o §15.1 do plano é **"Ordem correta"** (a ordem de implementação), não "Memory Service pronto" como o anexo resume                       | duas leituras medidas e declaradas; vale a **mais estrita** → PARTIAL. Ler só o anexo daria DONE por vacuidade ("não comecei por embeddings, logo respeitei a ordem")    |
| D2  | o §15.7 do plano é **"Ranking"** (7 sinais combinados), não "retrieval"                                                                  | medido pelos 7 sinais; 2 de 7 presentes → PARTIAL, delta nomeado                                                                                                         |
| D3  | **erro meu, achado por leitura do plano**: eu havia classificado `15.2` como **DONE** na primeira passada                                | corrigido para **PARTIAL**: o §15.2 lista 9 tabelas e existem 6 (+2 superseded); `ai_memory_embeddings` não existe. A receita de grep do anexo não é a definição do item |
| D4  | **FP-A**: `grep -i tsquery` media `tsQuery` do TanStack Router (27 hits falsos)                                                          | v2 com fronteira e case-sensitive → 0. Sem isso, o `15.5` teria sido promovido por engano                                                                                |
| D5  | **FP-B**: `grep -i cron` media "síncrona" em prosa                                                                                       | v2 restrita a `\bcron\b`/`crontab`/`pg_cron`, com os 4 hits impressos e lidos um a um                                                                                    |
| D6  | **FP-C**: `wc -l` num arquivo sem newline final contou 13 para 14 itens                                                                  | contagem por `grep -c .` + a asserção de identidade `len(alvo) == 14`, que já era o critério real                                                                        |
| D7  | **autocorreção antes do veredicto, confirmada e endurecida pelo S6**: `25.6`/`25.7` estavam como `UNV` por "settings-side, inalcançável" | **`NS`**: a API responde o estado do recurso, com mensagem explícita; `UNV` vai a **0** — ausência verificável nunca foi `U` neste programa                              |
| D8  | **o S6 achou que a composição estava errada por um** (a tabela media `0/6/6/2` e o registro escriturava `0/7/5/2`)                       | corrigida: o `15.2` mudou de `DONE` para `PARTIAL` na v1→v2, não de `NS`; a v3 **calcula** a composição das classes emitidas em vez de somar literais                    |

**Leitura de método:** três dos seis achados desta rodada são **defeitos do próprio instrumento**, e
os três são da mesma família que a série já vinha medindo — _casar substring onde o critério é o
token_, e _contar cardinalidade onde o critério é identidade_. O instrumento não foi poupado pela
régua que ele aplica.

## 5. Baseline de KPI — proposta ao MAESTRO (fórmula congelada, cláusula C5)

| grandeza                        | antes (vigente) | proposto     | delta            |
| ------------------------------- | --------------- | ------------ | ---------------- |
| DONE                            | 150             | **150**      | **0**            |
| PARTIAL                         | 23              | **29**       | +6               |
| NS                              | 12              | **8**        | −4               |
| UNVERIFIABLE                    | 2               | **0**        | **−2**           |
| total                           | 187             | 187          | **0**            |
| crédito parcial `(D + ½·P)/187` | **86,3636%**    | **87,9679%** | **+1,6043 p.p.** |
| cru `D/187`                     | **80,2139%**    | **80,2139%** | **0,0000 p.p.**  |

**Isto é uma proposta.** O WP não escreve no placar: a régua diz que o escritor é o MAESTRO, e o
crédito só entra depois da ratificação. **Nenhum item foi promovido** — o ganho é inteiramente de
`NS → PARTIAL` com delta nomeado, mais dois `UNV → NS` que **não valem crédito nenhum** e ainda
assim são ganho: o placar deixa de ter itens indeterminados. O **cru não se move** — é o resultado
que a régua conservadora previa: medir mais não é o mesmo que valer mais.

## 6. Checklist anti-vacoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                                                                                                                             |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | §C da v3, **no mesmo predicado**: `grep dependabot` → 1 (`25.4` DONE) × `grep dependency-review` → 0 (`25.5` NS); e existência de arquivo: `dependabot.yml` → 1 × `secret_scanning.yml` → 0. A v2 usava predicado diferente — corrigido (S6 N7) |
| 2   | Fronteira nas duas direções            | cada item tem os três ramos (DONE/PARTIAL/NS); a v3 mostra o lado que **reprova** (0 hits de FTS) e o lado que **aprova** (6 tabelas)                                                                                                           |
| 3   | Identidade, não cardinalidade          | a v3 imprime **nomes** — as 6 tabelas, os sítios que chamam o engine, os arquivos do FP-A — e **asserta a identidade da lista de itens**, não só o comprimento                                                                                  |
| 4   | Proibido exit-code-only                | a saída é a classe com o motivo ao lado, e a §4 nomeia o que decidiu; o gate é a única captura com exit code, e ele vem **com** `CHECK_EXIT` e a árvore no cabeçalho                                                                            |
| 5   | Proibido sleep fixo                    | não se aplica: medição estática, sem sincronização temporal                                                                                                                                                                                     |
| 6   | Sem valor degenerado na identidade     | cada classe tem ≥1 evidência nomeada; nenhuma linha é "0 = 0"                                                                                                                                                                                   |
| 7   | Precondição de estado compartilhado    | §3 do isolamento: worktree limpo fora do selo, `:5432` 0 listeners, `origin/main` conferido; a v3 **sai com `exit 2`** se a memória ganhar alcance de runtime                                                                                   |
| 8   | Sentinela real por cenário             | os comandos rodam sobre a árvore real no commit declarado, não sobre fixtures                                                                                                                                                                   |
| 9   | Fingerprint de revisão                 | o rótulo é a **árvore** (`git rev-parse HEAD^{tree}`), não o commit — três SHAs apontam para a mesma árvore fora de `docs/` (S6 N13); o gate carrega a árvore no cabeçalho                                                                      |
| 10  | `checked === discovered`               | a v3 **re-deriva os 14 itens dentro do script**, imprime a identidade e asserta contra a lista esperada. A v2 lia a contagem de `/tmp` e imprimia `= 14` mesmo sem o arquivo — **fail-open corrigido** (S6 N3)                                  |
| 11  | S6 adversarial de contexto limpo       | §7 — **14 CONFIRMED · 10 CORRECTED · 1 REJECTED · 0 UNVERIFIABLE**                                                                                                                                                                              |
| 12  | Falha alta (fail-closed)               | a v3 asserta `len == 14`, a identidade da lista, a composição calculada e o denominador 187; qualquer divergência **quebra** o instrumento em vez de passar despercebida                                                                        |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt` — que **achou e removeu** o container residual do WP-R6                                                                                                                                                           |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 e da §4 aponta captura versionada                                                                                                                                                                                              |
| 15  | Run de CI atado ao commit selado       | **pendente até o S7/S8**: no selo não existe run do commit selado (o mais recente é `a75a62b`, ancestral). A §8 é preenchida no land, com `sha@run(conclusion)`                                                                                 |
| 16  | Descoberta multi-sítio                 | descoberta pelo parser do anexo **e** por `grep` no código; os três falsos positivos do instrumento mostram por que a fronteira importa                                                                                                         |
| 17  | Precondição de estado ambiente         | o instrumento declara **árvore** e `HEAD`; o trabalho é **read-only** e o resíduo de bancada foi removido antes do selo                                                                                                                         |

**Limites declarados do instrumento (achados LOW do S6, não corrigidos por serem de desenho):** o filtro
de comentário `grep -vc '^\S*: *\*'` descartaria um `import * as …` genuíno (hoje não há nenhum); o
`--include=*.ts` é cego a `.tsx` em alguns comandos; `22.4` mede a purga por `delete +from
idempotency_records`, que não é a forma do predicado pré-registrado; e `15.4` teve o probe
pré-registrado substituído por outro (declarado em §E, com a razão: o escopo `ESC` da SPEC conta prosa
na raiz e JSON em `drizzle/meta`).

## 7. S6 ADVERSARIAL

**Lane:** subagente de contexto limpo, read-only, instruído a falsificar. Alvo **congelado** por
`git archive` em `/tmp/s6-r0b`, no commit `59e2119`; ao fim, `HEAD` conferido — **inalterado**, worktree
limpo. Nenhum `STOP-THE-LINE`.

**Veredicto: 14 CONFIRMED · 10 CORRECTED · 1 REJECTED · 0 UNVERIFIABLE.**

### 7.1 O que o S6 derrubou (e por que isso é o valor da lane)

| #       | achado                                                                                                                                                                                                                                                                                                                                                                | disposição                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1**  | **HIGH — a composição estava errada por um.** A tabela media `0 DONE · 6 PARTIAL · 6 NS · 2 UNV` e o registro escriturava `0/7/5/2`; todo o KPI herdava o erro                                                                                                                                                                                                        | **corrigido**: o `15.2` mudou de `DONE`→`PARTIAL` na v1→v2, não de `NS`→`PARTIAL`. KPI passa a `PARTIAL 23→29`, `NS 12→8`, `87,9679%`, `+1,6043 p.p.`    |
| **N2**  | **HIGH — `25.6`/`25.7` são `NS`, não `UNV`** (claim REJECTED): a API responde o estado dos dois recursos, com mensagem explícita e calibrada contra um 404 de repositório inexistente                                                                                                                                                                                 | **corrigido**: `UNV` vai a **0**. Eu já havia achado o mesmo por conta própria (D7); o S6 confirmou e deu a calibração                                   |
| **N3**  | **HIGH — o instrumento que decidia era fail-open na descoberta:** a v2 não lia o anexo, não assertava nada, contava itens de um arquivo em `/tmp` e imprimia `= 14 (== 14 itens descobertos)` com `exit 0` mesmo sem o arquivo; a checagem `$((0+7+5+2))` somava literais e não podia falhar                                                                          | **corrigido pela v3**: descoberta dentro do script, asserção de identidade, composição calculada das classes emitidas e assertada contra 14 e contra 187 |
| N4      | o controle negativo de `22.1` media outro predicado (N7) e a v2 ainda imprimia a composição velha da v1 e um `15.2 DONE` antes do §E                                                                                                                                                                                                                                  | corrigido na v3 (controle no mesmo predicado; as duas linhas obsoletas saíram)                                                                           |
| N5      | a causa do FP-A estava **mal atribuída**: não é um token `tsQuery` do router, é a substring dentro de `productsQuery` (27 ocorrências, 5 rotas + 1 teste)                                                                                                                                                                                                             | corrigido no §4.1 e no §D da v3                                                                                                                          |
| N6      | violação da cláusula C3 por substituição não declarada: o probe pré-registrado de `15.4` não foi executado; o de `22.4` perdia `.github/workflows`; a metade "colunas `tsvector`" de `15.2` nunca rodou                                                                                                                                                               | declarado em §6 (limites) e em §E; a v3 executa os que restam e nomeia os que não                                                                        |
| N7      | o controle negativo da v2 usava predicado diferente do item que ele controlava                                                                                                                                                                                                                                                                                        | corrigido: `dependabot` × `dependency-review` é o **mesmo comando** com veredicto oposto                                                                 |
| N8      | a captura do gate não assertava exit code nem estava atada ao commit; §6 itens 9 e 15 afirmavam satisfação com a §8 em placeholder                                                                                                                                                                                                                                    | corrigido: a captura carrega `CHECK_EXIT` e a árvore; o item 15 passa a **"pendente até o S7/S8"**                                                       |
| N9      | `15.3`, `15.4` e `29.1` foram classificados sob ramos que o predicado pré-registrado não continha, sem entrada `D`                                                                                                                                                                                                                                                    | declarado em §4.1/§E com a razão (o texto do plano prevalece sobre a receita do anexo) e a leitura mais estrita aplicada                                 |
| N10–N15 | LOW: escopo `ESC` permeável (conta prosa e JSON de `drizzle/meta`); v1 não byte-reproduzível e grepando `src/app` inexistente; erros latentes de substring/cardinalidade na v2; o controle de `25.4` cobre só a metade "arquivo" (o repo é privado e `dependabot/alerts` responde 403); três rótulos de commit para uma árvore; a supersessão de `15.2c` sem ponteiro | declarados em §6 (limites) e no §D; o rótulo passou a ser a **árvore**, e a supersessão ganhou ponteiro (`annex:87`, `MEDICAO:188`)                      |

### 7.2 O que o S6 confirmou (não re-verificado aqui)

O parser independente do revisor reproduz os **14 itens exatamente**; a dedup `24.13 ≡ 25.5` é **fato
de fonte** (`MEDICAO-2026-09-15.md:189` — "duplicado … contado uma vez"), não suposição; **nenhum
caminho de runtime em toda a árvore alcança a camada de memória** (importadores são só
`src/test/memory-service.test.ts`, `src/test/memory-dedup.test.ts` e `scripts/db/test-memory.ts`, mais
um comentário em `src/lib/products.functions.ts:208`; 0 em `src/routes/**`, `src/server.ts`,
`src/start.ts`, `src/router.tsx`, `routeTree.gen.ts`, `src/instrumentation` e `e2e/`), de modo que os
quatro `PARTIAL` de memória **se sustentam e nenhum deveria ser DONE**; o §15.2 lista mesmo 9 tabelas e
a equivalência dos nomes superseded é **decisão registrada**; a v2 é **byte-reproduzível**; e as seis
linhas `PARTIAL` têm delta concreto, não vazio.

### 7.3 Nota de método

O achado mais desconfortável não é de código nem de banco: é que **o instrumento que eu usei para
medir era fail-open na própria descoberta** (N3), e a checagem de composição **somava literais** — ou
seja, não podia falhar. É a mesma família que a série vinha medindo, agora dentro da ferramenta que
media a série. A resposta foi a mesma que o programa já adotou para o `m02-seal`: **fazer a ferramenta
aplicar a si mesma a invariante que ela enforça nos outros** — descoberta re-derivada e assertada
dentro do script, composição calculada e assertada, precondição que sai com `exit 2`.

## 8. CI e commits

| campo             | valor                |
| ----------------- | -------------------- |
| base              | `a75a62b`            |
| land em `develop` | _(preenchido no S7)_ |
| run@sha           | _(preenchido no S8)_ |
| `origin/main`     | `9724d2c` — intocado |
