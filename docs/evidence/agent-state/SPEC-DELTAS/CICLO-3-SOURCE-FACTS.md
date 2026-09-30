# CICLO 3 — FATOS DE FONTE (extração read-only) — 2026-09-17

> **Método:** extração read-only por agente scout em contexto fresco sobre o HEAD `53b2996`
> (`develop`). Nenhum arquivo de código foi tocado.
> **Nota de transporte (declarada, não escondida):** o scout **não pôde gravar** este arquivo — o
> `write` dele é restrito a `xd://` e nenhum device montado grava no filesystem local; ele recusou
> explicitamente atalhos RCE-equivalentes. O material integral (≈54,8 KB) ficou preservado no
> payload do agente (`agent://SourceFacts`, campo `report`); esta versão é a **destilação fiel** com
> os ponteiros que o STEWARD usa nos spec-cards. Nenhuma linha foi inventada: onde a fonte é omissa,
> está escrito **AUSENTE**.

## 1. MEM-D3 — dedup + versionamento + conflitos

| #   | Fato                                                                                                                                                                                                                                                                                                                                                                                                                   | Fonte                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | A ordem do plano é **dedup antes de conflict**, e ambos antes de FTS/embeddings                                                                                                                                                                                                                                                                                                                                        | `PLANO:1273-1282` (dedup `:1277`, conflict `:1278`)                                           |
| 2   | Os nomes das tabelas vêm do plano: `ai_memory_versions` = "Histórico de versões"; `ai_memory_conflicts` = "Conflitos"                                                                                                                                                                                                                                                                                                  | `PLANO:1287-1295`; `V7:3008-3009`                                                             |
| 3   | Entrega canônica do degrau: "chave de dedup determinística (hash normalizado de `scope` + conteúdo, por tenant), append-only de versões com marcação `superseded`, detecção de conflito (novo candidato contradiz ativo do mesmo escopo) com registro em `ai_memory_conflicts` e **sem** sobrescrever o ativo"                                                                                                         | `MEM-D0-GAP-REPORT.md:130`                                                                    |
| 4   | **Aceite (4 itens):** (a) 2ª gravação idêntica **não** cria linha e devolve a existente **com sinal de duplicidade**; (b) alteração gera linha em `ai_memory_versions` e a antiga fica **byte a byte inalterada** (§34 imutabilidade de histórico); (c) conflito **registra** e `search` segue só `status='active'`; (d) histórico **sobrevive ao delete do ativo** conforme política de retenção — asserção explícita | `MEM-D0-GAP-REPORT.md:132`                                                                    |
| 5   | Dependência declarada: D3 depende de D2; D4 depende de D3 para o histórico                                                                                                                                                                                                                                                                                                                                             | `MEM-D0-GAP-REPORT.md:131,137`                                                                |
| 6   | Fixado pelo STEWARD em rodada anterior: nomes `ai_*` do plano; **outbox não entra** no append de memória; proveniência 1:N em `ai_memory_sources`                                                                                                                                                                                                                                                                      | `DECISOES-STEWARD-MEM-2026-09-16.md:7,13-15,19`                                               |
| 7   | Insumos já prontos no HEAD: `UPDATE` em `ai_memories` **já concedido** com o comentário "(ciclo de vida — D3)"; `MemoryStatus = active\|superseded`; `search` já filtra `status='active'`                                                                                                                                                                                                                              | `drizzle/0017:59-65`; `memory.contracts.ts:47`; `drizzle/0017:20`; `memory.repository.ts:199` |
| 8   | Ausência provada: **0 hits** de `ai_memory_versions`, `ai_memory_conflicts`, `access_log`, `policies`, `embeddings` em `drizzle/`, `src/`, `scripts/`                                                                                                                                                                                                                                                                  | busca do scout                                                                                |
| 9   | **Tensão real:** D3(d) (histórico sobrevive) depende da política de retenção remetida a **H-12/D4**; e a FK existente `ON DELETE cascade` (`drizzle/0017:49`) **apagaria** o histórico                                                                                                                                                                                                                                 | `DECISOES-STEWARD-MEM-2026-09-16.md:23-26`                                                    |
| 10  | O gate §43 **não** cita dedup/versões/conflitos; o único critério que os nomeia é o DoD da V7 §23.2: "Memória \| Proveniência, dedup, conflito, TTL, delete/export"                                                                                                                                                                                                                                                    | `PLANO:2183-2189`; `V7:3517`                                                                  |

## 2. Item 9.2 — interfaces de repositório

- **Texto integral do item:** `PLANO:790-802` — "Criar contratos independentes de driver" + exemplo
  `ProductRepository`; `§9.3` (`PLANO:804-815`) exige contexto `tenantId`/`userId`/`correlationId`/`transaction`.
- **Critério de aceitação do item 9.2: AUSENTE** no plano (sem lista nominal de repositórios, sem
  testes, sem gate próprio).
- **Régua alternativa (M-02):** catálogo-alvo com Memory em serviços **e** repositórios
  (`SPEC-M02:94-98`); fronteira services ≠ Drizzle (`SPEC-M02:58-61`); congelamento (`SPEC-M02:105-112`).
- **Estado declarado:** `MATRIX:1411-1415` (`MemoryService = contract-only`) e `MATRIX:1467-1471`
  (`MemoryRepository = contract-only`), idem overlay `OVERLAY:33-37,89-93` — **mas** o scanner já
  indexa o `memory.repository.ts` real (`MATRIX:1349,1068-1090`), e o claim do MEM-D2 declara que a
  regeneração da matriz é ato do MAESTRO (`CLAIMS-INBOX/MEM-D2.md:5`).
- **Medição vigente:** `9.2 = PARTIAL`, residual = **4 pontos de acesso direto à transação**
  (`ANEXO-ITENS-2026-09-15.md:42`; `MEDICAO-2026-09-15.md:109`).
- **V7 §7** nomeia `MemoryService` (`V7:2482`) e `MemoryRepository` (`V7:2499`) e fixa:
  "Nenhuma regra de negócio deve viver no PostgreSQL Adapter" (`V7:2521`).

## 3. Lacunas de especificação (o que as fontes NÃO dizem)

`G1` forma da chave de dedup (hash/normalização; escopo `user` inclui `user_id`? enforçado por UNIQUE?) ·
`G2` onde a chave mora (coluna nova / migration 0018?) ·
`G3` colunas de `ai_memory_versions` (só `ARQ:1267-1275` as lista — fonte fora do contrato) ·
`G4` como gravar `superseded` (UPDATE × derivar; `superseded_at` não existe) ·
`G5` **mecanismo de detecção de conflito — AUSENTE (núcleo semântico)** ·
`G6` colunas/ciclo de vida de `ai_memory_conflicts` (quem resolve?) ·
`G7` sinal de duplicidade no port (`append` devolve `MemoryRecord`, sem campo) ·
`G8` superfície de leitura do histórico ·
`G9` retenção × `ON DELETE cascade` ·
`G10` concorrência do dedup (UNIQUE + `ON CONFLICT` × lock) ·
`G11` imutabilidade sem `UPDATE`/`DELETE` × expurgo TTL ·
`G12` qual é o gate de fechamento de D3 (§43 não cita; DoD V7 §23.2 cita) ·
`G13` aceite verificável do item 9.2 (AUSENTE) ·
`G14` quem regenera MATRIX/OVERLAY e com que status ·
`G15` se o residual de acesso direto à tx entra no aceite do 9.2 ·
`G16` se `RequestContext`/`TransactionContext` atuais satisfazem "contratos independentes de driver".

## 4. Restrições vinculantes citadas pelas fontes

- **§34 (matriz de integridade):** imutabilidade de histórico é critério de aceite — é o que sustenta
  o item (b) do aceite de D3 (`MEM-D0-GAP-REPORT.md:132`).
- **INV-004/005:** memória não calcula valor financeiro e não vaza para o Financeiro.
- **§43:** o gate **não** exige dedup/conflito; o fechamento de D3 se ancora no DoD da V7 §23.2.
- **Ambiente:** 5432 intocado; PG17 efêmero; `env-guard` fail-closed (regra permanente das rodadas).

---

## 5. Decisões do STEWARD sobre as lacunas (SD-C3-1…SD-C3-11)

Registradas aqui e aplicadas no spec-card `SPEC-CARDS/CICLO-3.md`; cada uma é reversível por 1 commit
antes da implementação e é citável pelo verificador adversarial.

| id       | lacuna   | decisão                                                                                                                                                                                                                                                                                                                               | racional (curto)                                                                                                                         |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SD-C3-1  | G1       | `dedup_key = sha256(scope ‖ 0x1f ‖ discriminador ‖ 0x1f ‖ conteúdo normalizado)`, hex minúsculo; normalização = NFC + `trim` + colapso de espaços internos; **discriminador** = `user_id` quando `scope='user'`, `provenance.conversationId` quando `scope='conversation'`, vazio em `'tenant'`                                       | o texto do plano diz "scope + conteúdo"; sem discriminador, dois usuários com o mesmo texto colapsariam numa linha só (perda silenciosa) |
| SD-C3-2  | G2       | coluna nova `ai_memories.dedup_key text NOT NULL` + índice **parcial** único `(tenant_id, dedup_key) WHERE status='active'`; migration `0018` gerada por `npm run db:generate`                                                                                                                                                        | a tabela não tem escritor antes de D3 ⇒ `NOT NULL` é seguro e falha alto se houver dado                                                  |
| SD-C3-3  | G3       | `ai_memory_versions(id, tenant_id, memory_id, version int >0, content <>'', dedup_key, created_at)` + `UNIQUE (tenant_id, memory_id, version)` + FK composta `(tenant_id, memory_id) → ai_memories(tenant_id,id)` **ON DELETE RESTRICT**                                                                                              | RESTRICT é o que torna o item (d) do aceite implementável sem corrida                                                                    |
| SD-C3-4  | G4 + G11 | **supersessão derivada**: não existe `UPDATE` em versões; uma versão está superseded se existir versão de número maior na mesma memória; o **head** (`ai_memories`) é atualizado in-place na revisão (grant de UPDATE já existe, `0017:59-65`); `ai_memories.status='superseded'` fica reservado a substituição por **outra** memória | torna "byte a byte inalterada" (aceite b) uma propriedade estrutural, não uma disciplina de código                                       |
| SD-C3-5  | G5       | D3 **não julga** contradição semântica: expõe `recordConflict()` como **enforcement** e garante o invariante "o ativo nunca é sobrescrito por conflito". Detecção é do policy/service (D1)                                                                                                                                            | §43 não exige juiz semântico; inventá-lo seria escopo não pedido (e uma promessa não medida)                                             |
| SD-C3-6  | G6       | `ai_memory_conflicts(id, tenant_id, memory_id FK RESTRICT, candidate_content <>'', candidate_dedup_key, status ∈ {open,dismissed,resolved} default open, detected_at, resolved_at NULL)`                                                                                                                                              | ciclo de vida explícito e auditável; quem resolve é o serviço (D4+)                                                                      |
| SD-C3-7  | G7       | o port **muda** para devolver `{ record, duplicated }` em `append` e o teste de D2 é atualizado no mesmo ciclo (sem shim, sem alias)                                                                                                                                                                                                  | é o único jeito de o chamador distinguir dedup de criação — o aceite (a) exige o sinal                                                   |
| SD-C3-8  | G8       | port ganha `listVersions(context, memoryId)` e `listConflicts(context, status?)`                                                                                                                                                                                                                                                      | leitura é exigência de verificação do próprio aceite                                                                                     |
| SD-C3-9  | G9       | `delete(context, id)` mantém semântica D2 e **recusa** (retorna `false`, sem erro) memória com histórico; a eliminação completa passa a exigir `delete(context, id, { purgeHistory: true })`, que apaga versões+fontes+conflitos+memória **na mesma transação**                                                                       | satisfaz (d) por padrão e mantém o caminho LGPD explícito e auditável                                                                    |
| SD-C3-10 | G10      | dedup por `INSERT … ON CONFLICT (tenant_id, dedup_key) WHERE status='active' DO NOTHING RETURNING *` + leitura da linha existente quando nada é inserido; **sem** advisory lock                                                                                                                                                       | concorrência resolvida pelo índice, não por coordenação em código; testável com duas sessões                                             |
| SD-C3-11 | G12      | o fechamento de D3 se ancora no DoD da **V7 §23.2** (dedup + conflito, com proveniência herdada de D2); TTL/delete-export seguem para **D4/H-12**                                                                                                                                                                                     | o gate §43 não cita dedup; prometer fechamento de §43 aqui seria crédito indevido                                                        |

**Fora de escopo (não pedido):** FTS/`tsvector`, embeddings, HNSW, ranking §15.7, resolução automática
de conflito, memória cross-tenant.
