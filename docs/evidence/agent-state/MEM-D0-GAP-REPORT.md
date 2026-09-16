# MEM-D0 — Gap report do gate §43 (memória persistente)

- **Item:** MEM-D0 (SQUAD-MEM) — _gap report_ do gate §43. **Read-only sobre código**; único artefato escrito: este arquivo.
- **Base:** `79089bc96134b8fed322cc7f261b4afbe8daa650` (branch `develop`), leitura em 2026-09-16T03:04Z.
- **Método:** leitura direta das fontes canônicas + provas de ausência por busca (comandos raw na §7). Nenhum arquivo de código, migration, plano, ledger ou worktree de terceiro foi tocado.
- **Fontes normativas:** plano §43 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:2181-2191`), escada §15 (`:1264-1349`), ordem prática §40 (`:2103-2142`), INV-003/004/005 (`:255-257`), §15 (`:2967-3060`), gate de vetor V7 §9 (`:367-386`), VECTOR-GATE-01 (`V7:750`), DoD por área (`V7:3517`).

---

## 0. Veredito

> **Gate §43 = ABERTO. 0 de 7 exigências verificáveis.**
> Não há uma linha de runtime de memória, nenhuma tabela `ai_memory*`, nenhuma coluna `tsvector`, nenhum índice GIN, nenhuma extensão criada por migration.
> O que existe é: **(i)** contrato _type-only_ `PLANNED` (`src/server/contracts/memory.contracts.ts`), **(ii)** o Conversation Service já implementado, e **(iii)** a infraestrutura de tenant/RLS/outbox/migrations que serve de molde.

O degrau **não** é bloqueado por decisão humana: D1 pode começar imediatamente, e D2–D6 também, sob as premissas declaradas na §5. As decisões humanas pendentes são de **valor** (retenção, provider de embedding, promoção vetorial) e chegam depois do gate — ver §5.

---

## 1. As 7 exigências do gate §43 × estado real

| #   | Exigência (§43)             | Estado                                                     | Evidência principal                                                                                          |
| --- | --------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Conversation Service pronto | **PRESENTE** (com 2 lacunas menores de contrato)           | `src/server/services/conversation.service.ts:34,85`; `docs/specs/M-02/matrix.yaml:1340-1343` (`implemented`) |
| 2   | Memory Service pronto       | **AUSENTE** (só tipo)                                      | `src/server/contracts/memory.contracts.ts:2`; `matrix.yaml:1344-1347` (`contract-only`, target `M-05`)       |
| 3   | policy engine mínimo        | **AUSENTE** (só tipo)                                      | `memory.contracts.ts:41-47`; sem tabela `ai_memory_policies`                                                 |
| 4   | provenance                  | **AUSENTE** (só tipo)                                      | `memory.contracts.ts:19-26`; sem `ai_memory_sources`                                                         |
| 5   | tenant isolation            | **PRIMITIVAS PRESENTES / APLICAÇÃO AUSENTE**               | `drizzle/0001_p0_runtime_role_and_rls.sql:69-107,120-126,179-213`; `src/db/client.server.ts:120-130`         |
| 6   | delete/export               | **PARCIAL** (delete conversational-scoped só; export zero) | `conversation.service.ts:29`; `memory.contracts.ts:73`; prova P5 = zero                                      |
| 7   | FTS funcionando             | **AUSENTE** (zero `tsvector`/GIN/extensão)                 | prova P2/P3 = zero em `drizzle/`, `src/`, `scripts/`                                                         |

### 1.1 Conversation Service — **PRESENTE**

- `ConversationService` implementado e exportado: `src/server/services/conversation.service.ts:11,34,85` (matriz: `implemented`, `matrix.yaml:1340-1343`).
- Repositório concreto: `src/server/repositories/conversation.repository.ts:55,70,87,110,125,143,159` — todas as operações em `context.transaction` com predicado explícito de `tenantId`.
- Persistência: `chat_conversations` (`drizzle/0000_p0_postgres_foundation.sql:42-52`, com `UNIQUE(tenant_id,id)` na `:51` e `reset_at` na `:48`), `chat_messages` (`:54-64`, `CHECK role in ('user','assistant','system','tool')` na `:63`), FK composta `(tenant_id, conversation_id) → chat_conversations(tenant_id,id)` em `:277` (padrão §34).
- Isolamento: RLS `tenant_isolation` aplicada a `chat_conversations`/`chat_messages` no laço de `drizzle/0001_p0_runtime_role_and_rls.sql:179-213` (entradas do array em `:192-193`; corpo da policy em `:201-210`); grants `SELECT,INSERT,UPDATE` para `chat_conversations` (`:42`) e `SELECT,INSERT,DELETE` para `chat_messages` (`:54`).
- **Lacunas (não bloqueiam; entram em D1):**
  - `appendMessage` retorna `{id}` (`conversation.repository.ts:125`; assinatura `conversation.service.ts:20`) e `listMessages` retorna `ConversationMessageSummary` com `id` (`conversation.repository.ts:8-11`) — **suficiente** para proveniência citar `conversationId`+`messageId`. Falta apenas um _read path_ por mensagem para validar proveniência em O(1) (hoje só via `listMessages`).
  - **Divergência de nomenclatura (decisão pendente, §5-A):** V7 §15.4/plano §15.2 nomeiam `ai_conversations`/`ai_messages`; o runtime tem `chat_conversations`/`chat_messages`. Equivalência semântica presumida; a decisão (alias canônico documentado vs. renomeação) é do STEWARD e **bloqueia D2**, não D1.

### 1.2 Memory Service — **AUSENTE**

- Único artefato existente: `src/server/contracts/memory.contracts.ts`, cabeçalho `:2` = `PLANNED — alvo M-05`, explicitamente _"Sem runtime: nenhum valor, nenhum import de `@/db` ou `drizzle-orm`"_ (`:5-6`).
- Matriz: `MemoryService` = `contract-only`, path = o contrato de tipos, `target: M-05` (`matrix.yaml:1344-1347`; idem replica em `matrix.overlay.yaml:33-37`). `MemoryRepository` idem (`matrix.yaml:1400-1403`; overlay `matrix.overlay.yaml:89-93`).
- Não existe `src/server/services/memory.service.ts` nem `src/server/repositories/memory.repository.ts` (prova P6).
- Não existe `docs/specs/M-05/**` — só `M-02`, `M-04`, `M-06` (prova P7). A gating hoje vive em `docs/specs/M-02/spec.md:38` ("implementação completa de MemoryService, policy engine, FTS, delete/export e embeddings — M-05") e `matrix.yaml`.
- **Nenhuma tabela.** `grep -rc "ai_memory" drizzle/*.sql` → zero (prova P1). As 29 tabelas criadas em 0000–0015 não incluem nenhuma de memória (lista completa na prova P8).

### 1.3 Policy engine mínimo — **AUSENTE**

- Só o tipo: `MemoryPolicy` (`memory.contracts.ts:41-47`) com `allowedScopes`, `minConfidence`, `requireProvenance`, `maxContentLength`, `maxResults`.
- O invariante de arquitetura do §15.3 (**modelo propõe, backend decide**) não tem nenhum caminho de código que o implemente: não há função que avalie candidato → decisão, e não há tabela de políticas (`ai_memory_policies`, citada em `V7:3012`).
- **Lacuna de contrato para D3/D6:** `MemoryPolicy` não tem `ttl`/`retention` (V7 §23.2 exige TTL na área Memória) nem `dedupWindow`/`conflictThreshold`; `MemorySearchQuery` (`:56-60`) não expressa pesos de recência/importância/confiança exigidos pelo ranking §15.7. Ampliar o contrato é parte de D1 (ver §5-A, sem congelamento).

### 1.4 Provenance — **AUSENTE**

- Só o tipo `MemoryProvenance` (`memory.contracts.ts:19-26`): `sourceKind` (`user|tool|model|import`, `:15`), `sourceId`, `conversationId?`, `capturedAt`, `inferred`, `confidence` — cobre literalmente os cinco itens do plano §15.4 (quem/onde/quando/inferida/confiança).
- Não existe `ai_memory_sources` (V7 §15.4/§15.5) nem qualquer tabela que registre a origem de uma memória.
- **Precedentes de forma reaproveitáveis** (não são a fonte de verdade da memória): `audit_events` (`0000:30-40`: `correlation_id`, `resource_type`, `resource_id`, `safe_metadata`) e `outbox_events` (`0015:9-25`: `aggregate_type`, `aggregate_id`, `idempotency_key`, `payload jsonb`).
- **Lacuna de contrato:** V7 §15.5 pede `message_id`, `tool_id` e `domain_event_id` como fontes distintas; o contrato atual reduz tudo a um `sourceId` string + `conversationId` opcional. D2 deve decidir entre (a) manter `sourceId` polimórfico (mais simples, perde FK) ou (b) `ai_memory_sources` com FKs opcionais tipadas (recomendado — permite §34 cascade/restrict e auditoria).

### 1.5 Tenant isolation — **primitivas presentes, aplicação ausente**

- **Presente e testado:**
  - `app_private.current_tenant_id()` (`0001:69-76`) lê `current_setting('app.current_tenant_id', true)`; `has_tenant_access(uuid)` (`0001:78-91`) e `has_tenant_owner_access` (`:93-107`) são `SECURITY DEFINER` com `search_path` fixo; grants de execução só para `app_runtime` (`:120-126`), `REVOKE ... FROM PUBLIC` (`:112-118`).
  - GUCs são setadas **por transação, `is_local=true`**: `src/db/client.server.ts:124-125` (dentro de `withTenantTransaction`, `:111`) e `src/middleware/request-context.ts:43`; o role de conexão é `NOBYPASSRLS` por construção (`0001:4,6`).
  - Padrão de policy canônico e mais recente: `drizzle/0015_curved_riptide.sql:38-57` (grants mínimos + `ENABLE RLS` + `tenant_isolation` com `USING` **e** `WITH CHECK` incluindo `has_tenant_access`).
  - Harness de teste cross-tenant já existente e em uso: `scripts/db/test-outbox.ts:5-12` (T5 = isolamento de tenant via RLS), `:23-29` (`setDatabaseForTests`, `withTenantTransaction`, `bindTransactionContext`), `:42-53` (identidades A/B); unit tests de negação em `src/test/cross-tenant-denial.perf-waves.test.ts`.
- **Ausente:** não há tabela de memória, logo não há o que isolar. O §15.8 (**filtro de tenant **antes** de considerar candidatos; nunca busca global filtrando depois na aplicação**) não tem implementação nem teste — a garantia hoje é por tabela (cada tabela tem `tenant_id` + policy), não por retrieval.

### 1.6 Delete / export — **PARCIAL**

- **Delete existente:** apenas escopo de conversa — `ConversationService.deleteMessages` (`conversation.service.ts:29`) → `conversation.repository.ts:159-167` (delete por `tenantId` + `conversationId`); reset de conversa via `chat_conversations.reset_at` (`0000:48`). O contrato de memória já declara `delete(context, id, executor?) → Promise<boolean>` (`memory.contracts.ts:73`), sem implementação.
- **Export: inexistente.** Prova P5 → zero arquivos com endpoint/serviço de export de dados em `src/app` e `src/server`. Não há `ai_memory_access_log` (V7 §15.4, `V7:3011`) nem qualquer trilha de leitura de memória (o `audit_events` existente é append-only e orientado a mutação: `0001:57` `GRANT INSERT` só).
- Consequência: o critério §43 "delete/export" **não pode** ser marcado verde por reaproveitamento do delete de conversa — memória precisa de delete próprio (por id, por escopo, por tenant/usuário) e de export com autorização server-side.
- **Risco LGPD/§48:** export e delete de memória entram no mesmo regime do dado pessoal já governado (portabilidade e eliminação). O mecanismo é implementável agora; os **valores** (prazo de retenção, escopo do export, base legal para L2/L3 inferidas) são decisão humana — §5.

### 1.7 FTS funcionando — **AUSENTE**

- Prova P2: zero ocorrências de `tsvector|tsquery|to_tsvector|USING gin` em `drizzle/`, `src/` e `scripts/`.
- Prova P3: **nenhuma** `CREATE EXTENSION` em migration; a única ocorrência no repositório é `scripts/obs/pg-stat-statements.ts` (observabilidade, fora de `drizzle/`). Portanto `unaccent`, `pg_trgm` e `pgvector` **não estão habilitadas por migration** — ponto relevante para D5 e decisivo para o pós-gate.
- §15.5 ("criar representação lexical; testar configuração portuguesa") não tem artefato. V7 AUT-026/027 (`V7:104-105`) confirmam a decisão já tomada: FTS permanece no PostgreSQL (`tsvector`/`tsquery` nativos; GIN nativo), então D5 não precisa de nova extensão — apenas de coluna gerada/expressão + índice GIN.

---

## 2. O que já pode ser reaproveitado

| Ativo                                                           | Onde                                                                                                                                                                                                                                       | Como entra no M-05                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS + GUCs de tenant**                                        | `0001:69-107,120-126,179-213`; `src/db/client.server.ts:111-130`; `src/middleware/request-context.ts:43`                                                                                                                                   | D2/D4: tabelas de memória seguem o mesmo `tenant_id` + policy `tenant_isolation` com `has_tenant_access` (USING e WITH CHECK). Zero código novo de isolamento.                                                                                       |
| **Padrão §23 do outbox como precedente de append transacional** | contrato `src/server/contracts/event.contracts.ts:1-8,30-37` → migration `0015:1-57` → `src/server/repositories/outbox.repository.ts:70,73-76,117` → `src/server/services/outbox.worker.ts:76,120-140` → teste `scripts/db/test-outbox.ts` | **Molde exato de "contrato type-only → runtime"**: D2 copia a sequência (tabela + grants mínimos + RLS + repositório com `Executor` + teste DB encadeado). Também é o mecanismo para memória + evento na **mesma transação** (§21) com idempotência. |
| **`Executor` já declarado no contrato de memória**              | `memory.contracts.ts:11` importa de `event.contracts.ts:14`; uso em `:63-73`                                                                                                                                                               | Append/search/delete transacionais sem importar `@/db` (M02-D-003, `docs/specs/M-02/decisions/M02-D-003.md`). D2 só implementa.                                                                                                                      |
| **`chat_*` como histórico de conversa**                         | `0000:42-64,277`; `conversation.repository.ts:87-142`                                                                                                                                                                                      | Serve de _source_ de memória episódica (L2) e de âncora de proveniência: `conversationId` + `messageId` já existem e são legíveis (`ConversationMessageSummary`, `:8-11`).                                                                           |
| **`audit_events` + `auditRepository`**                          | `0000:30-40`; `src/server/repositories/audit.repository.ts:6-31`                                                                                                                                                                           | Precedente direto de `ai_memory_access_log` (D4): append-only, `safe_metadata`, sem conteúdo sensível.                                                                                                                                               |
| **Registry de classes de migration (§27a)**                     | `scripts/db/migration-classes.ts:1-40`; `docs/runbooks/migration-safety.md`; gate `scripts/db/check-migration-classes.ts`                                                                                                                  | D2–D6: toda migration nova entra classificada (`SAFE`, `AppliedOn: empty` — tabelas novas, sem dados) com `sha256` byte a byte; a cadeia `npm run db:test` (package.json:61) já roda o `check-migration-classes` **primeiro**.                       |
| **Matriz de integridade §34 já em CI**                          | `package.json:61` (`test-migrations`, `test-concurrency`, `test-sql-injection`, `test-chat-semantics`, `test-outbox`)                                                                                                                      | D2–D6 só acrescentam `scripts/db/test-memory.ts` à cadeia; FK composta, CHECK, UNIQUE e imutabilidade de histórico já têm forma canônica (`0000:275-278`, `0015:9-25`).                                                                              |
| **Harness de banco descartável (PG17 efêmero)**                 | `scripts/db/test-outbox.ts:19-23`; `scripts/db/migrate.ts:6,88,108` (`requireAdminUrl`, `runMigrations`, `ensureRuntimeRoleMembership`); `package.json:58` (`db:up`)                                                                       | D2+: os testes de memória rodam no mesmo modo (banco descartável, `app_runtime` real, GUC por transação), sem tocar 5432.                                                                                                                            |
| **Taxonomia de erro e Zod**                                     | `src/lib/api-error.ts` (`ApplicationError`, usado em `conversation.repository.ts:3`)                                                                                                                                                       | D1/D4: rejeições de policy e falhas de export usam a taxonomia existente (V7: "IA → Zod, auth, timeout, quota, audit, idempotência").                                                                                                                |
| **Contratos type-only como gargalo barato**                     | `matrix.yaml:1344-1347,1400-1403`; `docs/evidence/onda1-contracts-2026-09-13.md:23-30`                                                                                                                                                     | O overlay já sabe reconciliar `contract-only → implemented`; D1–D6 atualizam o status sem redesenho de governança.                                                                                                                                   |

---

## 3. Decomposição proposta D1–D7 (com dependências e aceite verificável)

Ordem derivada da escada §15.1 (`Memory Service → policy → persistence → provenance → dedup → conflict → FTS → embeddings → hybrid`) e da ordem prática §40 (`31 conversation-fsm · 32 memory-core · 33 memory-fts · 34 memory-vector · 35 hybrid-retrieval`), respeitando seriedade dentro do item e paralelismo entre itens onde não há dependência.

```text
D1 (service+policy, sem DB) ──► D2 (persistência+proveniência+tenant)
                                   ├──► D3 (dedup/versions/conflicts) ──┐
                                   ├──► D4 (delete/export/access log) ──┤
                                   ├──► D5 (FTS pt-BR) ──► D6 (ranking+context) ──► D7 (fechamento §43 + baseline §44)
                                   └────────────────────────────────────┘
```

### D1 — Memory Service + policy engine mínimo (sem persistência)

- **Entrega:** `src/server/services/memory.service.ts` (proposta de candidato → decisão), `src/server/services/memory.policy.ts` (avaliação de `MemoryPolicy`: `allowedScopes`, `minConfidence`, `requireProvenance`, `maxContentLength`, `maxResults`), ampliação do contrato (`ttl`/`retention`, pesos de ranking, `status`) em `memory.contracts.ts`, e status do `MemoryService` na matriz/overlay.
- **Depende de:** nada (contrato existe). **Não toca DB.**
- **Aceite verificável:** suíte unitária (sem banco) provando, com erro tipado da taxonomia existente: (a) rejeita confiança < `minConfidence`; (b) rejeita `scope` fora de `allowedScopes`; (c) rejeita ausência de proveniência quando `requireProvenance=true`; (d) rejeita conteúdo > `maxContentLength`; (e) aceita e normaliza (trim/NFC) nos casos válidos, preservando `inferred`/`confidence` intactos; (f) **INV-005**: o módulo não importa nada de `src/lib/finance*`/Financial Engine e nenhuma saída do serviço é consumida por cálculo canônico (asserção de grafo de import).

### D2 — Persistência + proveniência + tenant isolation (`ai_memories`, `ai_memory_sources`)

- **Entrega:** migration nova classificada `SAFE`/`AppliedOn: empty` no registry §27 + entrada no `_journal.json`; `ai_memories` (`tenant_id`, `scope`, `content`, `importance`, `confidence`, `status`, `created_at`, `updated_at`) com **FK composta `(tenant_id, id)` UNIQUE** e FK para `tenants`/`tenant_memberships` no padrão `0000:275-278`; CHECK de `confidence`/`importance` ∈ [0,1] e `content <> ''`; `ai_memory_sources` 1:N com FK em cascata; **RLS `tenant_isolation` com `USING` + `WITH CHECK` via `has_tenant_access`** e grants mínimos (incl. `DELETE`, exigido pelo §43) no molde de `0015:38-57`; `src/server/repositories/memory.repository.ts` implementando `MemoryRepositoryPort` (`append/search/delete`) com `Executor = context.transaction`; rollback `drizzle/rollback/<tag>_to_<prev>_down.sql`.
- **Depende de:** D1; decisão §5-A (nomenclatura) e §5-B (memória emite evento de domínio?).
- **Aceite verificável:** `scripts/db/test-memory.ts` encadeado em `npm run db:test` (package.json:61), contra PG17 efêmero, provando: (a) append com identidade A e busca com identidade B → **0 linhas**, e append forjando `tenant_id` de B → rejeitado por `WITH CHECK` (denegação no banco, não na aplicação — forma de `test-outbox.ts` T5); (b) proveniência órfã é impossível (FK/CHECK) e `search` retorna a proveniência junto; (c) append de memória **na mesma transação** de um efeito de domínio: rollback do domínio não deixa memória órfã (forma de `test-outbox.ts` T1); (d) `delete` afeta apenas a linha do tenant corrente e retorna `false` quando o id não existe (§43 delete); (e) `check-migration-classes` verde com a nova tag.

### D3 — Dedup + versionamento + conflitos (`ai_memory_versions`, `ai_memory_conflicts`)

- **Entrega:** chave de dedup determinística (hash normalizado de `scope` + conteúdo, por tenant), append-only de versões com marcação `superseded`, detecção de conflito (novo candidato contradiz ativo do mesmo escopo) com registro em `ai_memory_conflicts` e **sem** sobrescrever o ativo.
- **Depende de:** D2.
- **Aceite verificável:** teste DB provando: (a) segunda gravação idêntica **não** cria linha nova e devolve a existente com sinal de duplicidade (forma de `AppendEventResult.duplicate`, `event.contracts.ts:25-28`); (b) alteração de conteúdo gera nova linha em `ai_memory_versions` e a antiga permanece byte a byte inalterada (§34 _history immutability_); (c) conflito cria linha em `ai_memory_conflicts` e `search` continua retornando apenas `status='active'`; (d) o histórico sobrevive ao `delete` do ativo conforme a política de retenção escolhida (asserção explícita sobre a escolha, não implícita).

### D4 — Delete/export + access log (exigência §43 §6; V7 §15.4/§23.2)

- **Entrega:** `ai_memory_access_log` (append-only, `safe_metadata`-like, **sem** `content`), `export` e `delete` no repositório/serviço (`export(context, filter)`, `delete` por id e por escopo), superfície server-side autorizada (server action / route handler com `RequestContext` — nenhuma leitura/escrita de memória fora de service/repository, conforme fronteira M-02 `spec.md:57-60`).
- **Depende de:** D2 (e D3 para o histórico).
- **Aceite verificável:** teste provando: (a) export do tenant A devolve exatamente o conjunto de A e **nada** de B; (b) export sem `has_tenant_access` é negado antes de qualquer query; (c) delete é idempotente (2ª chamada → `false`, contrato `memory.contracts.ts:73`); (d) toda `search` grava linha de access log e nenhuma linha contém `content`; (e) usuário não-owner do tenant não apaga memória de outro usuário quando a política de escopo exigir (via `has_tenant_owner_access`).

### D5 — FTS em português (§15.5) — **primeiro critério lexical do gate**

- **Entrega:** representação lexical em `ai_memories` via coluna gerada/expressão indexada `to_tsvector('portuguese', content)`, índice **GIN**; busca lexical no repositório (`websearch_to_tsquery`/`plainto_tsquery` + `ts_rank`), query **parametrizada** e com predicado de tenant desde o primeiro `WHERE`; fallback degradado (§31) quando FTS indisponível. Nenhuma extensão nova é necessária (AUT-026/027).
- **Depende de:** D2.
- **Aceite verificável:** prova com `EXPLAIN` do plano real: (a) busca lexical usa `Bitmap Index Scan` no índice GIN (não `Seq Scan`); (b) o plano inclui o predicado de `tenant_id` **dentro** da varredura (§15.8 — nunca buscar global e filtrar depois); (c) teste de configuração portuguesa provando stemming/acentos (ex.: `preço`↔`precos`/`preços`) e que ruído não casa; (d) ausência de resultado não vira erro; (e) p95 **medido e registrado** em `docs/evidence/` (medido, não prometido — §29).

### D6 — Ranking §15.7 + context builder (lexical-only)

- **Entrega:** composição determinística **tenant → scope/status/TTL → lexical → recência/importância/confiança**, respeitando `maxResults` e o token budget do policy; `ai_memory_policies` versionada e lida pelo backend (§15.1 nível L5/procedural; `V7:3012`).
- **Depende de:** D5 (e D1 para o formato de policy).
- **Aceite verificável:** (a) snapshot determinístico da ordenação sobre fixtures fixas (mesma entrada → mesma ordem, sem dependência de relógio do host); (b) `maxResults` do **policy** é o teto efetivo (parâmetro do chamador nunca amplia); (c) asserção de que toda query de retrieval carrega `tenant_id` (nenhuma consulta sem predicado de tenant é emitida); (d) memória `inferred=true` é rotulada como contexto no payload do context builder (**INV-005**: nunca apresentada como dado canônico).

### D7 — Fechamento do gate §43 + baseline §44 (sem embeddings, sem HNSW)

- **Entrega:** documento de fechamento com as 7 exigências → `arquivo:linha` ou teste verde (E2-reproduzível); bloco §44 preenchido com números reais do comportamento **lexical** atual (`memory rows`, `exact-search p95`, `exact-search CPU`, `recall baseline`, `target latency`); decisão explícita "promover vetor: sim/não" com o gatilho registrado (VECTOR-GATE-01, `V7:750`; métricas exigidas em `V7:367-386`).
- **Depende de:** D1–D6.
- **Aceite verificável:** as 7 linhas da §1 verificadas no HEAD integrado, cada uma com prova executável; §44 preenchido com medição real (não placeholder); **nenhum** `CREATE INDEX ... USING hnsw` e **nenhuma** `CREATE EXTENSION vector` no diff.
- **Nota:** embeddings vêm **depois** deste degrau — §43 diz "Só então embeddings". D7 mede o baseline pré-vetorial; a promoção vetorial é um ciclo posterior (ver §4).

---

## 4. Riscos e invariantes a respeitar

| ID                                                 | Risco / invariante                                                                                                                     | Como D1–D7 respeitam                                                                                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-003** (`plano:255`)                          | IA não executa SQL                                                                                                                     | Retrieval é sempre via repository com SQL parametrizado (§20.3); o modelo só envia texto de consulta. D5/D6: query construída no servidor; teste dedicado de injeção reaproveita `scripts/db/test-sql-injection.ts`. |
| **INV-004** (`:256`)                               | IA não calcula valor financeiro canônico                                                                                               | Nenhuma memória entra no Financial Engine; D1 tem asserção de grafo de import.                                                                                                                                       |
| **INV-005** (`:257`)                               | Memória de IA não substitui dado financeiro                                                                                            | Toda resposta de memória carrega `inferred`/`confidence`/`status`; context builder rotula como contexto (V7 §15.1). D6 aceite (d).                                                                                   |
| **§15.8** (`:1349`)                                | Filtro de tenant **antes** de retrieval; nunca busca global filtrando na aplicação                                                     | Predicado de `tenant_id` dentro do `WHERE`/da varredura, validado por `EXPLAIN` (D5-b) e por asserção sobre o SQL emitido (D6-c). RLS é a segunda barreira (fail-closed), não a primeira.                            |
| **§27** (`:1835-1860`)                             | Toda migration classificada; expand/contract para mudanças incompatíveis                                                               | Tabelas novas = `SAFE`/`empty` no registry `scripts/db/migration-classes.ts` com `sha256`; gate `check-migration-classes` roda primeiro em `db:test`. Nenhuma alteração de tabela existente sem expand/contract.     |
| **§34** (`:1987-1997`)                             | Matriz de integridade: FK composta de tenant, CHECK, UNIQUE, NOT NULL seletivo, imutabilidade de histórico, cascade/restrict, rollback | D2: FK composta `(tenant_id, …)` no molde `0000:275-278`; CHECK de faixa; `ai_memory_versions`/`access_log` append-only (sem `UPDATE`/`DELETE` no grant); rollback por tag.                                          |
| **§44** (`:2195-2209`) + VECTOR-GATE-01 (`V7:750`) | HNSW só após registro de métricas                                                                                                      | D7 registra o bloco; HNSW e a extensão `vector` ficam fora do escopo até decisão humana com números.                                                                                                                 |
| **§21/§23** (`:1686-1770`)                         | Transação única + idempotência                                                                                                         | D2 aceite (c): memória + efeito de domínio na mesma transação; dedup de D3 funciona como idempotência de append; se §5-B for "sim", o evento de memória entra no outbox com `idempotency_key`.                       |
| **§29** (`:1875-1904`)                             | Não transformar target em promessa antes de medir                                                                                      | D5/D7 medem p95 e registram; nenhum SLO é declarado para memória antes do baseline.                                                                                                                                  |
| **Fail-closed de tenant**                          | `app_runtime` é `NOBYPASSRLS` (`0001:4,6`); `REVOKE ... FROM PUBLIC` (`0001:112-118`)                                                  | Tabelas novas nunca recebem grant a `PUBLIC`; policy inclui `has_tenant_access` no `USING` **e** no `WITH CHECK` (forma de `0015:44-57`). Denegação testada com identidade cruzada real.                             |
| **Fronteira M-02** (`spec.md:57-60`)               | Services/repositories não importam Drizzle direto fora de health/auth/rate-limit/migrations; gravação passa por services               | D1–D6 mantêm `memory.service.ts` + `memory.repository.ts`; nenhum acesso direto a DB em server function/tool de IA.                                                                                                  |
| **Ambiente**                                       | 5432 intocado; `env-guard` fail-closed; PG17 efêmero                                                                                   | Testes de D2+ usam o harness descartável (`scripts/db/migrate.ts:6,88`, `test-outbox.ts:19-23`), `127.0.0.1`, container efêmero removido ao fim; `npm install` não é necessário.                                     |
| **LGPD/§48**                                       | Dado pessoal: portabilidade e eliminação                                                                                               | D4 entrega delete/export completos com autorização; valores de retenção são decisão humana (§5-D).                                                                                                                   |

---

## 5. Precisa de decisão humana?

**Bloqueio imediato (D1): nenhum.** D1 pode começar agora — é contrato + policy pura, sem banco, sem migration, sem provider externo.

Decisões que **serão** necessárias e em que degrau entram (nenhuma impede iniciar, mas todas devem estar resolvidas antes do respectivo aceite):

- **A. Nomenclatura canônica (`ai_*` vs `chat_*`) — STEWARD, antes de D2.** V7 §15.4/plano §15.2 nomeiam `ai_conversations`/`ai_messages`; o runtime tem `chat_conversations`/`chat_messages`. Recomendação: manter `chat_*` e registrar o alias canônico (evita migration de renomeação sobre tabela em uso e preserva a matriz). `docs/specs/M-05` não existe — se o STEWARD quiser uma spec M-05 própria, ela precisa ser criada por quem tem esse escopo; **este item não a criou** (escopo de arquivo exclusivo).
- **B. Memória é evento de domínio? — STEWARD, D2.** Recomendação: sim para L2/L3 (append + evento no outbox na mesma transação, §21/§23), não para L0/L1. Impacta o aceite D2(c).
- **C. Forma da proveniência tipada — STEWARD/arquiteto, D2.** `sourceId` polimórfico (contrato atual) vs. `ai_memory_sources` com FKs opcionais (recomendado).
- **D. Valores de retenção/TTL e escopo do export — produto/jurídico, D4.** O mecanismo não depende disso; os defaults precisam de ratificação humana (V7 §23.2 exige TTL na área Memória).
- **E. Pós-gate, ciclo seguinte:** provider/custo de embeddings, habilitação da extensão vetorial no Neon e limiar de HNSW (`V7:367-386`). Explicitamente **fora** de D1–D7.

---

## 6. O que NÃO faremos agora

- **Embeddings.** §43: "Só então embeddings." Nenhuma chamada a provider de embedding, nenhum job de vetorização, nenhuma dependência nova (`package.json` hoje não tem `pgvector` nem SDK de embedding — prova P4).
- **Extensão `vector` / pgvector.** Nenhuma `CREATE EXTENSION` em migration (prova P3). Habilitar extensão no Neon é decisão humana §5-E.
- **HNSW / qualquer índice aproximado.** §44 + VECTOR-GATE-01. D4–D7 explicitamente não criam `USING hnsw`; a decisão só existe após o bloco §44 preenchido com números reais.
- **Retrieval híbrido / reranking semântico / reranking por LLM.** §15.7 combinando lexical+semântico só é possível com vetores; D6 entrega a metade lexical e o pipeline, sem a perna semântica.
- **Memória multi-tenant global / cross-tenant / "memória do produto".** §15.8 proíbe por construção; fora de escopo.
- **Qualquer vazamento da memória para o Financeiro.** INV-004/INV-005.
- **Backfill.** Não há dados de memória a migrar (nenhuma tabela existe); §28 não se aplica.
- **Promessas de SLO de memória.** §29: primeiro medir (D5/D7), depois declarar.
- **Renomear `chat_*` → `ai_*`** sem decisão do STEWARD (§5-A).
- **Cutover/produção.** Continua sendo do MAESTRO; este item é read-only sobre código e escreve só este relatório.
- **Atualizar matriz/plano/milestones.** Fora do meu `spec-card`; o relatório **precisa** de reconciliação de status na matriz (`contract-only → implemented`) quando D1–D2 landarem — apontado como pendência para o STEWARD, não executado aqui.

---

## 7. Provas de ausência (comandos raw)

Executados em `79089bc`, na raiz do repositório:

```bash
# P1 — nenhuma tabela/coluna de memória em nenhuma migration
grep -rc "ai_memory" drizzle/*.sql | grep -v ":0"        # → vazio (zero matches)

# P2 — nenhuma FTS em código, migrations ou scripts
grep -rl "tsvector\|tsquery\|to_tsvector\|USING gin" drizzle/*.sql src/ scripts/
#                                                         # → vazio

# P3 — nenhuma CREATE EXTENSION em migration
grep -rl "CREATE EXTENSION" drizzle/ src/ scripts/
#   → scripts/obs/pg-stat-statements.ts   (observabilidade; NÃO é migration)

# P4 — nenhuma dependência vetorial/embedding
grep -c "pgvector" package.json                          # → 0

# P5 — nenhuma superfície de export de dados
grep -rl "export-data\|exportData\|/api/export\|download.*dados" src/app src/server
#                                                         # → vazio

# P6 — nenhum runtime de memória
ls src/server/services/memory.service.ts src/server/repositories/memory.repository.ts
#                                                         # → não existem

# P7 — não existe docs/specs/M-05
ls docs/specs/
#   → M-02  M-04  M-06

# P8 — inventário de tabelas (nenhuma de memória)
grep -rn "CREATE TABLE" drizzle/*.sql
#   → accounts, ai_daily_budgets, audit_events, chat_conversations, chat_messages,
#     expenses, idempotency_records, market_prices, product_ingredients,
#     product_packaging, products, profiles, sales_fees, sessions, simulations,
#     tenant_memberships, tenants, tool_executions, users, verifications,
#     rate_limits, calculation_snapshots, purchase_price_history, sales, sales_items,
#     ai_usage, rum_vitals, outbox_consumptions, outbox_events

# P9 — estado declarado do MemoryService/MemoryRepository
grep -n "MemoryService\|MemoryRepository" docs/specs/M-02/matrix.yaml
#   → 1344-1347 e 1400-1403: status "contract-only", target "M-05"
```

---

## 8. Sumário executivo para o STEWARD

1. **Gate §43 está 0/7 verde.** Nada de memória existe em runtime: só tipos (`memory.contracts.ts`, `PLANNED`).
2. **A infraestrutura para construir está pronta e testada** (RLS/GUCs, outbox como precedente de contract→runtime, `chat_*` como histórico, registry de classes de migration, harness PG17 efêmero, matriz §34 em `db:test`).
3. **D1 pode começar sem nenhuma decisão pendente.** D1–D7 fecham o gate sem embeddings e sem HNSW.
4. **Duas decisões destravam D2:** nomenclatura `ai_*` vs `chat_*` (§5-A) e memória-como-evento (§5-B).
5. **Nenhuma alteração de código foi feita.** Este é o único arquivo escrito por MEM-D0.
