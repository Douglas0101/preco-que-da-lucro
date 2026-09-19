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

### 2.2 Os instrumentos de verificação passam a estar versionados no selo (D12)

A crítica estrutural do veredicto adversarial é correta e foi aceita: a evidência de verificação
mecânica (`captures/*.log.txt`) foi **autorada pela mesma sessão** que produziu as afirmações, e os
scripts que a geraram viviam apenas em `.artifacts/` — scratch **gitignored**. Ou seja, a
adjudicação dos overrides **não era re-executável a partir do commit**. Agravante medido: a v1 do
gerador **já produziu uma tabela silenciosamente errada** (§2.1).

Correção: os instrumentos passaram a ser versionados no selo, com sufixo `.txt` — extensão que nem
o ESLint nem o prettier processam, e que o `.gitignore` não engole (verificado com
`git check-ignore`, rc=1).

| arquivo no selo                     | instrumento                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `captures/recompute-camada.py.txt`  | o gerador — lê a origem **do commit** `d9e58a2` e aplica os 19 overrides        |
| `captures/verifica-mecanica.py.txt` | o verificador mecânico da camada (afirmações de grep e referências `arquivo:N`) |
| `captures/verifica-camada.py.txt`   | o verificador independente (identidade, **não** cardinalidade)                  |
| `captures/procedimento-selo.sh.txt` | o procedimento de selagem (prettier → manifesto → `sha256sum -c` da raiz)       |
| `captures/colhe-transcript.py.txt`  | o coletor do transcript adversarial                                             |

**Ressalva que permanece:** são **cópias de snapshot**, não um pipeline executável. Reexecutá-las
exige o repo no commit do selo e um container PG17 efêmero. O que prova que os bytes selados são os
bytes do commit é o vínculo `git show <sha>:<path>` × manifesto (ver §9).

## 3. Inventário recomputado

|         | antes (724594c) | depois (d9e58a2) |
| ------- | --------------- | ---------------- |
| DONE    | 67              | **68**           |
| PARTIAL | 10              | **11**           |
| NS      | 11              | **9**            |
| NA      | 1               | **1**            |
| total   | 89              | **89**           |

A camada **não é somada ao denominador de 187** (ela tem overlap declarado com o placar). Portanto:
**o placar permanece 150 D · 23 P · 12 NS · 2 UNV / 187 = 86,36% parcial · 80,21% crua.**

## 4. Deltas de status — 3

| item      | antes   | depois      | razão medida                                                                                                                                                                                                                                                                                                              |
| --------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `P2-02`   | NS      | **PARTIAL** | a mecânica do §23 existe **inteira e testada** (ver §4.1) — mas **nada a executa**: `new OutboxWorker` só aparece em `scripts/db/test-outbox.ts` (8×), nenhum cron/`setInterval`/plugin em `src/`, nenhum runbook, nenhum `vercel.json`. Em produção a tabela só cresce. **Rebaixada de DONE→PARTIAL no S6 adversarial.** |
| `GATE-41` | PARTIAL | **DONE**    | as 11 condições do §41 reconferidas uma a uma; a única que faltava era o literal **"CI verde"**, observado em 2026-09-19 (`UI stack` run `35465442629` em `9be9956` e run `35461588021` em `f06c6d8`, ambos `success`).                                                                                                   |
| `GATE-43` | NS      | **PARTIAL** | **6 das 7 condições** do §43 têm artefato medido (Conversation Service, Memory Service, policy engine, proveniência, tenant isolation, delete/export). A 7ª — **FTS** — está ausente: `rg -w tsvector / to_tsvector / to_tsquery` → 0 hits, e o único `search` é `position(lower($1) in lower(content)) > 0`.             |

`GATE-43` é o delta que mais importa: a nota original dizia "faltam Memory Service, policy engine,
proveniência, isolamento, delete/export e FTS" — **6 dos 7 itens dessa lista existem hoje**. O gate
continua **não** passado, e §43 diz "Só então embeddings", logo `P2-05`/`P2-06`/`GATE-44` seguem
bloqueados.

### 4.1 `P2-02` — a metade operacional do outbox não existe (achado do S6)

A primeira versão desta recomputação promoveu `P2-02` de NS para **DONE**. Isso estava **errado**, e a
correção veio da verificação adversarial de contexto limpo (S6).

O que **existe** e é sólido — a mecânica do §23 do Plano ("Outbox strategy"):

| peça                                 | evidência medida                                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| append na mesma transação do domínio | `src/server/services/expense.service.ts:8,21,30-31,38` — o evento entra no `context.transaction`                                                                                                     |
| tabela + idempotência                | `src/db/schema.ts:871` `outbox_events`; `:892` uniqueIndex sobre `(tenant_id, idempotency_key)`; `:894` `outbox_events_claim_idx`; `drizzle/0015_curved_riptide.sql` (+ `outbox_consumptions`)       |
| repositório                          | `src/server/repositories/outbox.repository.ts` (241 l.)                                                                                                                                              |
| worker                               | `src/server/services/outbox.worker.ts` (182 l.) — lote, `maxAttempts`, `backoffMs(attempts)`, CAS no claim, inbox idempotente `(consumer_name, event_id)`, para de reclamar ao atingir `maxAttempts` |
| serviço de aplicação                 | `src/server/services/event.service.ts` — `append` / `publishPending`                                                                                                                                 |
| prova                                | `scripts/db/test-outbox.ts` (731 l.) — etapa 12 da cadeia `db:test`, verde                                                                                                                           |

O que **não** existe — a metade operacional:

| ausência                           | comando que a mede                                                    | resultado                                                                             |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| nada instancia o worker em runtime | `rg -n 'new OutboxWorker' src scripts e2e`                            | 8 hits, **todos** em `scripts/db/test-outbox.ts` (`:467,472,561,577,589,611,637,690`) |
| nenhum agendador                   | `rg -niE 'cron\|setInterval\|nitro.*plugin' package.json src scripts` | **0**                                                                                 |
| nenhum procedimento operacional    | `rg -l 'outbox' docs/runbooks docs/adr`                               | **0** arquivos                                                                        |
| nenhum trigger de plataforma       | `ls vercel.json`                                                      | **não existe**                                                                        |
| nenhuma métrica de backlog         | `rg -n 'outbox' src/instrumentation/telemetry.ts`                     | **0**                                                                                 |

**Consequência:** o §23 pede worker (existe) e o append transacional (existe) — mas **nada drena**.
Em produção a tabela só cresce, e nada percebe, porque não há métrica de backlog nem runbook.
É o mesmo modo de falha do TRILHO A: um mecanismo correto e testado, cuja **existência** foi confundida
com **funcionamento**.

**Ressalva declarada:** um agendador **externo ao repositório** (cron no hPanel/Hostinger) não é
verificável daqui. A metade operacional é, portanto, **UNVERIFIABLE** — não "falsa".

**Divergência aberta com o placar de 187:** os itens `23.1`/`23.2` contam **DONE** no placar desde
2026-09-15. A camada agora discorda deles **com base no mesmo fato**. Resolver essa divergência é
decisão da **régua do MAESTRO** — não foi tomada aqui, e o placar não foi tocado.

### 4.2 O subsistema de memória também não tem entrada de runtime (achado do S6, C10)

A mesma pergunta feita ao outbox, feita a **todos** os serviços e repositórios, por contagem de
**importadores de runtime** (import apontando para o módulo, fora de `src/test/**` e de
`scripts/db/test-*`) — [`captures/verificacao-s6-followup.log.txt`](captures/verificacao-s6-followup.log.txt):

| módulo                                          | importadores de runtime |
| ----------------------------------------------- | ----------------------- |
| `src/server/services/memory.service.ts`         | **0**                   |
| `src/server/repositories/memory.repository.ts`  | **0**                   |
| `src/server/services/outbox.worker.ts`          | **0**                   |
| `src/server/repositories/ai-tool.repository.ts` | **0**                   |
| todos os outros serviços e repositórios         | ≥ 1                     |

Os três primeiros não têm **nenhum** importador de runtime: o repositório de memória (1160 l.) só é
referido em doc-comments (`memory.service.ts:6`, `products.functions.ts:208`) e na declaração da porta
(`memory.contracts.ts:215`); `memoryService` aparece apenas em `src/test/memory-service.test.ts`; o
`OutboxWorker` só é importado por `scripts/db/test-outbox.ts:39`. **Não existe rota nem BFF que
exponha memória** (`rg 'memory|memoria' src/routes/ src/lib/` → só um doc-comment).

**Controle negativo, para não exagerar o achado.** "Sem importador" **não** é o mesmo que
"capacidade ausente". `ai-tool.repository.ts` também tem 0 importadores, e **a trilha de auditoria
funciona assim mesmo**: `src/lib/ai/tool-runner.ts:104` e `:317` escrevem em `tool_executions`
**direto**, pela transação, sem passar pelo repositório. A diferença que importa: para a trilha de
tool existe **caminho alternativo** (o item `P0-15` segue DONE, corretamente); para o outbox e para a
memória **não existe outro caminho** — nada os alcança.

**Efeito na camada:** `GATE-43` credita "Memory Service pronto" e "delete/export" como 2 das 6
condições satisfeitas. Essas duas repousam em código que **nada chama**. `GATE-43` permanece
**PARTIAL** (não poderia ser DONE de qualquer forma: falta FTS), mas a nota passa a declarar o fato em
vez de creditar as duas condições sem ressalva. Levá-lo a NS seria a leitura estritamente consistente
com o rebaixamento do `P2-02` — e é a mesma **decisão de régua** que a §4.1 deixa aberta, não uma
decisão minha.

## 5. Correções de evidência sem mudança de status — 16

| item      | afirmação da camada                                                                              | medido no HEAD                                                                                                                                                                                                                                                                                                                                                                                                                               | status                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `P0-01`   | grep `dangerouslySetInnerHTML/DOMPurify` → 1 hit                                                 | **2** arquivos (o módulo e o teste), ambos comentário/asserção                                                                                                                                                                                                                                                                                                                                                                               | DONE mantido                                                                                                                 |
| `P1-02`   | "MemoryService e EventService seguem contratos sem runtime (bloqueio M-05/M-04)"                 | **falsificado**: os dois existem como runtime; `matrix.overlay.yaml:33,41` e `matrix.yaml:1372,1380` declaram-nos `implemented`                                                                                                                                                                                                                                                                                                              | PARTIAL mantido, razão corrigida                                                                                             |
| `P1-03`   | "10 arquivos" em `src/server/repositories/`                                                      | **12**                                                                                                                                                                                                                                                                                                                                                                                                                                       | DONE mantido                                                                                                                 |
| `P1-11`   | `src/lib/financial.functions.ts:54-70`                                                           | **fora de alcance** (arquivo tem 64 linhas); `saveSimulation` em `:54`                                                                                                                                                                                                                                                                                                                                                                       | DONE mantido                                                                                                                 |
| `P1-15`   | "`_journal.json` idx 0..14, último `0014_mighty_veda`"                                           | **20 entradas**, `idx` 0..19, último `0019_tiresome_robin_chapel`                                                                                                                                                                                                                                                                                                                                                                            | DONE mantido                                                                                                                 |
| `P2-03`   | "nenhuma tabela de memória, nenhum serviço"                                                      | **falsificado**: 6 tabelas, `memory.service.ts`, `memory.policy.ts`, `memory.repository.ts` (1160 l.), `test-memory.ts` (2919 l.)                                                                                                                                                                                                                                                                                                            | NS mantido por régua (§4)                                                                                                    |
| `P2-04`   | grep `tsvector/to_tsvector/tsquery/GIN` → 0 hits                                                 | `tsvector` 0, mas `GIN` **1** — comentário em `memory.repository.ts:14`                                                                                                                                                                                                                                                                                                                                                                      | NS mantido                                                                                                                   |
| `P2-06`   | grep `hybrid/retrieval/rrf` → 0 hits                                                             | `hybrid` 0, `rrf` 0, **`retrieval` 9 arquivos** — todos prosa/comentário                                                                                                                                                                                                                                                                                                                                                                     | NS mantido                                                                                                                   |
| `P2-07`   | grep `memory/memória` em `src/routes/`, `drizzle/`, `schema.ts` → 0 hits                         | **4 arquivos** em `drizzle/` + `schema.ts`; 0 rotas                                                                                                                                                                                                                                                                                                                                                                                          | NS mantido                                                                                                                   |
| `P2-08`   | nota herdada (2026-09-15): observabilidade instrumentada; gap declarado "sem coletor OTLP local" | o achado de produção **D7** — meter obtido no module scope (`src/instrumentation/telemetry.ts:12`) **antes** de qualquer provider existir — torna **inertes os instrumentos de métrica** deste módulo, igual aos de reconciliação. O que sustenta o DONE é a metade de **traces**: o único proxy de re-vinculação da API é o `ProxyTracerProvider` (`api/trace.js`), então `http-request-span.ts:24-28` e `withSpan ai.chat.round` funcionam | DONE mantido, **com a ressalva D7 anexada** (mesmo registro de `ORD-36`/`P2-10`; WP próprio `F-otel-provider-order` na fila) |
| `P2-10`   | "faltam pg_stat_statements (grep → 0 hits)"                                                      | **falsificado**: `scripts/obs/pg-stat-statements.ts` (505 l.) + teste + artefato de performance com raw versionado (2026-09-15); o item `16.3` do placar **já é DONE**                                                                                                                                                                                                                                                                       | PARTIAL mantido (resta §16.8 scale-to-zero)                                                                                  |
| `ORD-32`  | "nenhuma tabela, nenhum serviço"                                                                 | falsificado; espelha `P2-03`                                                                                                                                                                                                                                                                                                                                                                                                                 | NS mantido por régua                                                                                                         |
| `ORD-33`  | grep → 0 hits                                                                                    | verdadeiro; espelha `P2-04`                                                                                                                                                                                                                                                                                                                                                                                                                  | NS mantido                                                                                                                   |
| `ORD-35`  | grep `hybrid/retrieval` → 0 hits                                                                 | `retrieval` em 9 arquivos de prosa; espelha `P2-06`                                                                                                                                                                                                                                                                                                                                                                                          | NS mantido                                                                                                                   |
| `ORD-36`  | (observabilidade)                                                                                | acrescenta-se o achado **D7**: instrumentos existem mas **nunca exportam** (meter obtido no module scope antes do provider)                                                                                                                                                                                                                                                                                                                  | PARTIAL mantido                                                                                                              |
| `GATE-44` | grep embutia `pg_stat_statements` no mesmo padrão → 0 hits                                       | `pg_stat_statements` **existe**; `pgvector`/`hnsw`/`embedding(s)` → 0 e `ai_memory_embeddings` inexistente                                                                                                                                                                                                                                                                                                                                   | NA mantido                                                                                                                   |
| `P2-09`   | CSP report-only por default                                                                      | confirmado (`security-headers.ts:45`, `process.env.CSP_ENFORCE === "true"`)                                                                                                                                                                                                                                                                                                                                                                  | PARTIAL mantido                                                                                                              |

Precisão sobre a contagem, vinda do veredicto adversarial (C7): das **18** afirmações de grep
reexecutadas, **7** eram declarações literais de zero-hit que quebraram (`P2-04`, `P2-06`,
`P2-07`, `ORD-32`, `ORD-35`, `GATE-43`, `GATE-44`) e **1 não era zero-hit** (`P0-01`, que
esperava **1** e mediu **2**). `P2-02` e `DEF-01` não declararam expectativa e ficam fora dos dois
conjuntos. O “18 → 8” segue correto como **afirmações confirmadas**; “zero-hit quebrado” são
**7**, não 8.

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
  DoD deste WP é a camada, não o placar. `GATE-41`/`GATE-43` são gates, não itens do denominador.
  `P2-02` **não** foi promovido (e a camada agora **discorda** do DONE que o placar mantém para
  `23.1`/`23.2` — divergência declarada na §4.1).
- **O S6 adversarial emitiu veredicto na 3ª lane, e ele é CONFIRMED em C2–C10.** A 1ª tentativa
  (`db7b0df0c3aad48f575a12d6d03d4205d`) morreu em `child_turn_limit` (31 turnos, 50 tool calls,
  nenhuma conclusão) — **falha de lane, não veredicto**; dela sobreviveu só a **pista**
  (_"Critical lead: runOnce may have no caller."_), que **eu mesmo verifiquei** por leitura direta
  e que produziu a correção da §4.1. A 3ª (`d35eb97c6d66ff29743bc553b110c52e2`, 60 turnos de teto,
  11 usados, 39 tool calls) fechou `completed`; o veredicto está selado em
  `captures/adversarial-c-verdict.md.txt` **com o sha256 que o próprio delegate reportou**
  (`c10935da…c35017`, 11 864 bytes) — vínculo conferido na selagem.
  **Veredicto: C2–C10 CONFIRMED**, nenhuma promoção não sustentada além do `P2-02` já corrigido,
  com três residuais nomeados: (a) `P2-08` sem referência cruzada ao D7 — **corrigido nesta
  revisão**; (b) delete/export de memória sem consumidor de runtime, que **não** infla status;
  (c) `ORD-27`/`ORD-29` artefato-only, já declarados nas próprias linhas.
- **O gap do outbox é medido no repositório, não em produção.** A ausência de agendador é
  verificável para tudo que vive no repo. Um cron configurado **fora** dele (painel do provedor) não
  é verificável daqui — por isso a metade ausente é **UNVERIFIABLE**, não "falsa".
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

### 7.1 Falhas engolidas como sucesso — onde a evidência não distingue ausência de sucesso

Lista produzida pelo S6 e **não** silenciada. **Nenhuma** foi remediada neste WP: ficam como
follow-up declarado. Este é o ponto em que “evidência verde” e “evidência ausente” se confundem.

| #   | onde                                          | por que não distingue                                                                                                                                       | consequência                                                                                                                                |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `e2e/ui-stack.spec.ts:232-236`                | a asserção filtra **só nomes de chave** (`/token\|session\|auth/i`) e é vacuosamente verde com storage vazio — cega ao **valor**                            | a condição 8 do §41 sobrevive pelo grep zero-hit em `src/` **e** pelas asserções de cookie HttpOnly (`:229-231`), **não** por essa asserção |
| 2   | condição 11 do §41 (“CI verde”)               | a evidência são run IDs em commits específicos; uma run verde em **outro** commit é indistinguível sem acesso externo à CI                                  | condição validada, mas **não re-derivável read-only** da árvore                                                                             |
| 3   | `GATE-43` condição 6 (delete/export)          | o único executor é `scripts/db/test-memory.ts` + testes unitários; da árvore, “implementado e autorizado” e “seria chamado em produção” são indistinguíveis | mesmo achado C10 da §4.2 — declarado, e **não** infla status (§43 segue PARTIAL)                                                            |
| 4   | a verificação mecânica **deste próprio selo** | os instrumentos viviam em `.artifacts/` **não versionado**, autorados pela mesma sessão que fez as afirmações                                               | **corrigido nesta revisão** — ver §2.2 (D12)                                                                                                |

## 8. Rollback

Não há migration nem código de runtime neste WP: são **dois documentos de evidência**
(`MEDICAO-2026-09-15.md`, `ANEXO-ITENS-2026-09-15.md`), **um artefato novo**
(`camada-36-40-recomputada.md`) e uma **seção nova no ledger**. Reversão = `git revert` do commit
documental; os avisos de OBSOLETA dos dois documentos originais voltam no mesmo revert.

## 9. Artefatos

| arquivo                                           | conteúdo                                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `camada-36-40-recomputada.md`                     | as **89 linhas** da camada, recomputadas, com o inventário no cabeçalho                                                                           |
| `captures/verificacao-mecanica-camada-v2.log.txt` | verificação mecânica autoritativa (89 == 89)                                                                                                      |
| `captures/verificacao-mecanica-camada.log.txt`    | v1, preservada com os **28 falsos "ARQUIVO AUSENTE"** e os **127 falsos positivos** de `GIN` visíveis                                             |
| `captures/fatos-do-tree.log.txt` · `-2` · `-3`    | contagens de serviços, repositórios, migrações, tabelas, tamanhos                                                                                 |
| `captures/quando-entrou.log.txt`                  | commit e data de entrada de cada artefato que decide um delta                                                                                     |
| `captures/recompute-camada.log.txt`               | saida do gerador: `89 -> 89`, os 3 deltas de status e as contagens 68/11/9/1                                                                      |
| `captures/verificacao-independente.log.txt`       | **a prova do escopo**: 89 ids idênticos à origem e **exatamente 19** linhas com células diferentes                                                |
| `captures/diff-documentos-originais.log.txt`      | o diff dos dois documentos de origem (o aviso de recomputada que foi acrescentado)                                                                |
| `captures/verificacao-outbox-runtime.log.txt`     | **a medicao do S6 que falsificou o Delta 1**: os 5 comandos que provam a ausencia da metade operacional, e os 2 que provam a presenca da mecanica |
| `captures/verificacao-s6-followup.log.txt`        | follow-up do S6: FTS (C4, 9 termos → 0), contagem independente da camada (C9, 68/11/9/1) e o C10 com o controle negativo                          |
| `captures/adversarial-c-transcript.txt`           | transcript da 1a tentativa adversarial — 7 mensagens, 50 tool calls, **nenhum veredicto**, e a pista que sobreviveu                               |
| `captures/adversarial-c-lane-failure.log.txt`     | `child-terminal.json` (`child_turn_limit`) e `runtime-budget.json` da 1a tentativa: a prova de que foi **falha de lane**, nao veredicto           |
| `captures/db-test-efemero.log.txt`                | a cadeia `db:test` inteira (17 passos) em PG17 efemero, com as 3 provas de guarda dos Trilhos A/B                                                 |
| `captures/db-test-efemero.sh.txt`                 | o script que rodou a cadeia (container virgem em 127.0.0.1:5436, `:5432` intocado, removido ao fim)                                               |
| `captures/verifica-camada.py.txt`                 | o verificador independente (identidade, nao cardinalidade), copiado para o selo                                                                   |
| `captures/verifica-vinculo.py.txt`                | o verificador do vinculo `git show <sha>:<path>` x linha do manifesto                                                                             |
| `captures/adversarial-c-verdict.md.txt`           | o **veredicto adversarial da 3ª lane** (C2–C10 CONFIRMED), selado com o sha256 reportado pelo próprio delegate                                    |
| `captures/recompute-camada.py.txt`                | o **gerador** versionado — lê a origem do commit e aplica os 19 overrides (D12)                                                                   |
| `captures/verifica-mecanica.py.txt`               | o **verificador mecânico** da camada, versionado (D12)                                                                                            |
| `captures/procedimento-selo.sh.txt`               | o **procedimento de selagem** (prettier → manifesto → `sha256sum -c` da raiz), versionado (D12)                                                   |
| `captures/colhe-transcript.py.txt`                | o coletor do transcript adversarial, versionado (D12)                                                                                             |
| `MANIFEST.sha256`                                 | selo de tudo acima (conferido **da raiz do repo** — o manifesto carrega caminhos relativos à raiz)                                                |
