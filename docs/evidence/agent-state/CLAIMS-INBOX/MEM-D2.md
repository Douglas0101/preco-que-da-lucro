# CLAIM — MEM-D2

- **wp / squad / branch / commit:** MEM-D2 · SQUAD-MEM · `mission/n2c-mem-d2` · `82acf93` (deliverable) + `HEAD` (este claim)
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` (§MEM-D2) · degrau **D2** do `MEM-D0-GAP-REPORT.md:122-126` · decisões **A/B/C** do STEWARD (`SPEC-DELTAS/DECISOES-STEWARD-MEM-2026-09-16.md`) · §11.9/§34 (RLS/FK/CHECK) · §27 (classificação) · §21 (transação única) · §15.4/§15.8 · §43 (delete)
- **status pleiteado:** DONE (degrau D2; `matrix.yaml` **não** foi tocado — regeneração é do MAESTRO)
- **worktree/container:** `.worktree-n2c` (branch `mission/n2c-mem-d2`) · container efêmero **`pqdl-n2c-mem-d2`** (`postgres:17-alpine`, `127.0.0.1:5437`, criado para este item e **removido** na limpeza). `:5432` e `docker-compose.yml` intocados; nenhum `npm install`; nada pushado.

- **cadeia SDD:**
  1. SPEC-CARD: `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` §MEM-D2 (lido na íntegra) + degrau D2 do gap report + decisões A/B/C.
  2. TEST-FIRST (S2 — RED): `scripts/db/test-memory.ts` escrito **antes** da migration existir. O repositório já existia (o contrato do port é type-only, então ele compila sem as tabelas), o que faz a falha inicial ser **por ausência das tabelas** — mais forte que a falha por ausência de módulo admitida pelo card. Saída em EVIDENCE-A.
  3. IMPLEMENT (S3 — GREEN):
     - `src/db/schema.ts:969-1098` — `aiMemories` e `aiMemorySources` (detalhes em “decisões declaradas”) + `AiMemory`/`AiMemorySource` (`:1113-1114`).
     - `drizzle/0017_past_gideon.sql` — migration **gerada** (`npm run db:generate`, tag sorteada pelo Drizzle) com as duas tabelas, FK composta, CHECKs e índices; cabeçalho (nota de equivalência `ai_*` × `chat_*`, decisão A) e, no fim, o bloco de **grants mínimos + RLS** com `USING` **e** `WITH CHECK` via `has_tenant_access` (molde de `drizzle/0015_curved_riptide.sql:38-57`).
     - `drizzle/rollback/0017_to_0016_down.sql` — down (políticas → grants → tabelas, filho antes do pai). `drizzle/rollback/0001_to_0000_down.sql:10-11` — as duas tabelas entram no DROP global do rollback de raiz.
     - `scripts/db/migration-classes.ts:301-316` — entrada `SAFE`/`appliedOn: empty` com `sha256` byte a byte (`ba66a3f3…`) e evidências.
     - `src/server/repositories/memory.repository.ts:1-252` — `DrizzleMemoryRepository implements MemoryRepositoryPort` (`append`/`search`/`delete`) com `Executor = context.transaction` por padrão, **sem** evento no outbox (decisão B) e sem SQL concatenado (INV-003).
     - `src/server/contracts/memory.contracts.ts:32-37` — **único** ajuste de contrato: `MemoryRecord.provenance` passa a opcional (habilitado pela decisão C; coerção do `provenance?` do input).
     - `scripts/db/test-memory.ts` (novo, 785 linhas) — T1–T5.
  4. EVIDENCE: EVIDENCE-A (RED), B (`db:classify:check`), C (`test-memory` 5/5), D (`test-outbox` + `test-migrations` sem regressão) , E (vitest afetados + `tsc` + prettier + psql das policies + up→down→up).
  5. (este arquivo) + `SPEC-DELTAS/MEM-D2-scope-chain-and-purge.md`.
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

- **EVIDENCE-A — RED (falha por ausência das tabelas, antes da migration):**
  Cópia descartável do worktree em `/tmp/n2c-red` com o `_journal.json` **sem** a entrada 0017 (chain parada em 0016), para reproduzir exatamente o estado anterior à migration:

  ```text
  $ cd /tmp/n2c-red && npx tsx scripts/db/test-memory.ts
  error: relation "ai_memory_sources" does not exist
      at async resetMemory (/tmp/n2c-red/scripts/db/test-memory.ts:125:3)
      at async seedFixtures (/tmp/n2c-red/scripts/db/test-memory.ts:156:3)
      at async t1TenantIsolation (/tmp/n2c-red/scripts/db/test-memory.ts:223:3)
      at async main (/tmp/n2c-red/scripts/db/test-memory.ts:772:5) {
    severity: 'ERROR', code: '42P01', routine: 'parserOpenTable'
  }
  Node.js v24.15.0
  EXIT=1
  ```

  (a cópia foi removida depois; o worktree nunca ficou nesse estado)

- **EVIDENCE-B — classificação (§27a):**

  ```text
  $ npm run db:classify:check
  > tsx scripts/db/check-migration-classes.ts

  ✔ 18/18 classificadas
  EXIT=0
  ```

- **EVIDENCE-C — GREEN (os 5 casos do aceite, container efêmero PG17):**

  ```text
  $ npx tsx scripts/db/test-memory.ts
  T1 isolamento: busca de B = 0 linhas sob RLS + append forjado recusado por WITH CHECK (42501): OK
  T2 proveniência: search devolve a fonte mais antiga; órfã/sem origem impossíveis (23503/23514): OK
  T3 atomicidade: rollback e falha cruzadas entre memória e despesa deixam zero linhas: OK
  T4 delete: só o tenant corrente apaga, cascata na fonte, false para id inexistente e de terceiro: OK
  T5 classificação: 18/18 classificadas · 0017_past_gideon = SAFE/empty + down: OK
  Memória §43/D2 (persistência + proveniência + tenant isolation): OK
  EXIT=0
  ```

  Cobertura nominal de (a)–(e) e o que cada caso prova **no banco** (não por filtro de aplicação):
  - **(a)** append com identidade A; `search` com B devolve `[]`; sob `set local role app_runtime` (NOSUPERUSER/NOBYPASSRLS) com o GUC de **B**, `count(*) from ai_memories` = **0** e `ai_memory_sources` = **0** — e, com o GUC de **A**, = **1** (a contagem negativa não é vacuosa). `insert into ai_memories … values (tenant_id de B …)` sob GUC de A ⇒ **42501** (`new row violates row-level security policy`) e zero linhas gravadas. Bônus: memória atribuída a `user_id` de outro tenant ⇒ **23503** (FK composta para `tenant_memberships`).
  - **(b)** `search` devolve a proveniência pelo objeto inteiro (`sourceKind`/`sourceId`/`conversationId`/`capturedAt`/`inferred`/`confidence`); com **duas** fontes o read model expõe a mais antiga (`captured_at` asc, `id` asc — regra determinística); fonte com rótulo opaco e **sem** FK tipada é aceita (FKs opcionais de verdade); fonte apontando para memória inexistente ⇒ **23503**; fonte de B para memória de A ⇒ **23503** (a FK é composta: `(tenant_id, memory_id)`); conversa de outro tenant na proveniência ⇒ **23503**; fonte sem nenhuma origem ⇒ **23514** (`origin_check`); `content = ''` ⇒ **23514**; `confidence = 1.5` ⇒ **23514**; `importance = -0.1` ⇒ **23514**. O filtro de escopo da busca exclui escopo que não casa.
  - **(c)** despesa + memória na **mesma** `withTenantTransaction`: rollback depois das duas deixa 0 memórias, 0 fontes e 0 despesas; e a memória recusada pelo banco (`content = ''`, 23514) **desfaz a despesa** da mesma transação; no commit, memória e despesa persistem juntas.
  - **(d)** o delete feito **sob `app_runtime`** devolve `true` (prova de que o `DELETE` concedido e o `USING` da policy alcançam a linha) e remove a memória **e** a fonte em cascata; id inexistente ⇒ `false`; id de A apagado por B ⇒ `false` com a linha de A intacta; segunda chamada de A ⇒ `false` (idempotente). Metadados conferidos no catálogo: `ai_memories` com `relrowsecurity` e `SELECT/INSERT/UPDATE/DELETE` para `app_runtime`, `ai_memory_sources` com `SELECT/INSERT`, **nada** para `PUBLIC`, e a policy `tenant_isolation` com `USING` **e** `WITH CHECK` contendo `current_tenant_id()` + `has_tenant_access`; limite de busca inválido falha alto com `VALIDATION_ERROR`.
  - **(e)** `classifyProject` roda dentro do próprio script: 0 erros, `18/18`, `0017_past_gideon` = `SAFE`/`appliedOn: empty`/`ok`, e o arquivo de down existe.

- **EVIDENCE-D — sem regressão nas suítes de banco:**

  ```text
  $ npx tsx scripts/db/test-outbox.ts
  T4 falha: attempts++ + available_at futuro + retry limitado por maxAttempts: OK
  T5 isolamento: RLS por tenant sob app_runtime + WITH CHECK do append cruzado: OK
  Outbox §23 (23.1 + 23.2): atomicidade, claim concorrente, idempotência: OK
  EXIT=0

  $ npx tsx scripts/db/test-migrations.ts
  PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
  EXIT=0
  ```

  `test-migrations` exercita a chain com **18** migrations: aplica `DOWNS_TIP_TO_0003` (com `0017_to_0016_down.sql` no topo), reduz o journal a 0000/0001, aplica `0003→0002`/`0002→0001`, e **replaya** `0002→0017` conferindo `journal = 18` — é o up→down→up da cadeia inteira. O rollback de raiz (`0001→0000`) também passa com as duas tabelas no DROP global.

- **EVIDENCE-E — up→down→up do par 0017 (explícito), psql das policies/grants e checagens estáticas:**

  ```text
  == 1. UP ==                                  (estado herdado do test-migrations: chain em 0000/0001)
  Migrations PostgreSQL aplicadas com sucesso.
  ai_memories=ai_memories|ai_memory_sources=ai_memory_sources|journal=18
  == 2. DOWN 0017→0016 ==
  DELETE 1
  ai_memories=AUSENTE|ai_memory_sources=AUSENTE|journal=17
  == 3. UP de novo ==
  Migrations PostgreSQL aplicadas com sucesso.
  ai_memories=ai_memories|ai_memory_sources=ai_memory_sources|journal=18|linhas=0
  2 policies
  ```

  ```text
  $ psql -c "select tablename, policyname, roles, cmd, qual, with_check from pg_policies where tablename like 'ai_memo%' order by tablename;"
       tablename     |    policyname    |     roles     | cmd |                     qual                      |                  with_check
  -------------------+------------------+---------------+-----+-----------------------------------------------+----------------------------------------------
   ai_memories       | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))
   ai_memory_sources | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))

  $ psql -c "select relname, relrowsecurity, has_table_privilege('app_runtime','public.'||relname,'select') sel, … 'insert' ins, … 'update' upd, … 'delete' del, has_table_privilege('public','public.'||relname,'select') public_sel from pg_class …"
        tabela       | rls | sel | ins | upd | del | public_sel
  -------------------+-----+-----+-----+-----+-----+------------
   ai_memories       | t   | t   | t   | t   | t   | f
   ai_memory_sources | t   | t   | f   | f   | f   | f
  ```

  ```text
  $ npx vitest run src/test/contracts.test.ts src/test/migration-classes.test.ts src/test/m02-purge-fixtures.test.ts src/test/memory-policy.test.ts src/test/memory-service.test.ts src/test/memory-import-graph.test.ts src/test/m02-grant-repair.test.ts
   Test Files  7 passed (7)
        Tests  76 passed (76)
  EXIT=0

  $ npx vitest run src/test/m02-v2b.test.ts src/test/cross-tenant-denial.perf-waves.test.ts
   Test Files  2 passed (2)      Tests  16 passed (16)
  EXIT=0

  $ npx tsc -p tsconfig.json --noEmit
  TSC_EXIT=0

  $ npx prettier --check src/db/schema.ts src/server/repositories/memory.repository.ts src/server/contracts/memory.contracts.ts scripts/db/test-memory.ts scripts/db/migration-classes.ts scripts/db/test-migrations.ts scripts/db/purge-fixtures.ts
  All matched files use Prettier code style!     (PRETTIER_EXIT=0)
  ```

  (os `drizzle/*.sql` não têm parser no Prettier — `format:check` do repo não os cobre, como nas migrations anteriores)

- **decisões declaradas (o que o card não fixa explicitamente):**
  1. **`ai_memories.user_id NOT NULL` + FK composta `(tenant_id, user_id) → tenant_memberships`** — o `spec_ref` (gap report §D2: “FK para `tenants`/`tenant_memberships` no padrão `0000:275-278`”) exige a âncora de membro; é também o que D4 precisa para delete/export por usuário. A lista de colunas do card não a cita (também não cita `id`), então foi lida como abreviada e a exigência do `spec_ref` prevaleceu.
  2. **Sem `expires_at`/TTL** — o card não lista a coluna e o port do D2 (`MemoryRecordInput = MemoryCandidate`) **não carrega TTL**: o `expiresAt` é derivado no serviço (`memory.service.ts:46-56`) e não tem por onde entrar no repositório. Persistir TTL exige ampliar o port; fica para D3/D6, quando o ranking §15.7 consumir a expiração. Consequência: `MemoryRecord.expiresAt` sai `undefined` (nunca fabricado) e o `search` do D2 não filtra por expiração.
  3. **`ai_memories.confidence` nulável com CHECK de faixa; `importance NOT NULL DEFAULT 0`** — confiança só existe quando há proveniência (`MemoryProvenance.confidence`); `importance` é numérico no read model, então `0` é o neutro documentado em vez de inventar sinal. A cópia em `ai_memories` evita o join nas fontes no ranking de D6.
  4. **`ai_memory_sources` sem `DELETE`** — a proveniência é append-only e a remoção acontece pela cascata da memória; **provado empiricamente** em T4 (o delete da memória rodou sob `app_runtime`, que só tem `SELECT/INSERT` em `ai_memory_sources`, e a fonte caiu). O “grants mínimos incluindo `DELETE`” do card está satisfeito na tabela de memória (é o que o §43 exige). Se o STEWARD preferir `DELETE` explícito também nas fontes, é uma linha no bloco de grants + ajuste do assert de T4.
  5. **`sourceId` permanece obrigatório no tipo** e o `source_ref` do banco é nulável — a decisão C (“`sourceId` derivado/opcional”) é materializada no **banco** (FKs tipadas + rótulo opaco opcional) e no read model (quando o rótulo é nulo, o `sourceId` derivado é o id da linha de fonte). Tornar `MemoryProvenance.sourceId` opcional no tipo quebraria `hasUsableProvenance` (`memory.policy.ts:77-83`, arquivo de D1, fora do escopo deste item) e não é necessário para nenhum caso do aceite.
  6. **`MemoryRecord.provenance` opcional** — único ajuste de contrato, exigido pela coerção do input (o card autoriza ajuste de tipo “só se a decisão C exigir”). O `contracts.test.ts` pré-existente continua verde.
  7. **Busca do D2** — substring parametrizada (`position(lower($1) in lower(content)) > 0`, sem wildcard interpretável) e ordenação determinística `created_at desc, id`; **não** é FTS (D5) nem ranking (D6), e a query sempre carrega `tenant_id` **e** o `status = 'active'` antes de qualquer filtro (§15.8).
  8. **`scripts/db/test-migrations.ts` + `scripts/db/purge-fixtures.ts` fora do escopo exclusivo do card** ⇒ registrado em `SPEC-DELTAS/MEM-D2-scope-chain-and-purge.md` (mesma classe de omissão já sanada por **SD-1**, aprovada para o WP-1a).

- **diff stat (deliverable):**

  ```text
   drizzle/0017_past_gideon.sql                 |   82 +
   drizzle/meta/0017_snapshot.json              | 4825 ++++++++++++++++++++++++++
   drizzle/meta/_journal.json                   |    9 +-
   drizzle/rollback/0001_to_0000_down.sql       |    2 +
   drizzle/rollback/0017_to_0016_down.sql       |   15 +
   scripts/db/migration-classes.ts              |   16 +
   scripts/db/purge-fixtures.ts                 |    2 +
   scripts/db/test-memory.ts                    |  785 +++++
   scripts/db/test-migrations.ts                |    9 +-
   src/db/schema.ts                             |  134 +
   src/server/contracts/memory.contracts.ts     |    7 +-
   src/server/repositories/memory.repository.ts |  252 ++
   12 files changed, 6132 insertions(+), 6 deletions(-)
  ```

- **riscos / limites conhecidos:**
  1. **`MEMORY_MIGRATION_TAG = "0017_past_gideon"` é acoplado à tag sorteada pelo Drizzle.** Se a migration for **regerada** no merge (nova tag), o T5 do `test-memory.ts` e a entrada do registry precisam acompanhar — o `db:classify:check` (1º da cadeia) falha alto se não acompanharem, então não há falha silenciosa.
  2. **O registry guarda o `sha256` do arquivo com o bloco de grants anexado.** Qualquer edição posterior no SQL (inclusive ordem dos `--> statement-breakpoint`) invalida o hash e exige reclassificação — é o comportamento desejado do §27a, mas é o passo que se esquece ao editar a migration.
  3. **Proveniência órfã é impossível por FK/CHECK; a memória _sem_ fonte é possível por desenho** (policy com `requireProvenance = false`). Quem exigir proveniência usa `requireProvenance` (D1), não o banco; o read model devolve `provenance: undefined` nesse caso, nunca um objeto sintético.
  4. **`scope = 'user'` não tem coluna de alvo** (só o autor em `user_id`): uma memória “sobre” outro usuário do tenant não é distinguível de uma memória do autor. D3/D6 podem precisar de `scope_target`; neste degrau não há requisito de aceite para isso.
  5. **Sem dedup/versões/conflitos** (`ai_memory_versions`/`ai_memory_conflicts` são D3) e sem `ai_memory_access_log`/export (D4): o delete do D2 é físico e a cascata leva a proveniência junto — a política de retenção de histórico é decisão de D3/D4 (§5-D do gap report).
  6. **Nenhuma medição de performance** foi feita (§29): o índice `(tenant_id, status, created_at)` existe para o retrieval de D5/D6, mas não há `EXPLAIN`/p95 neste degrau.
  7. **A denegação de RLS é provada com `set local role app_runtime` + GUC por transação** (admin do container é superuser e bypassaria a policy) — mesma técnica de `test-outbox.ts:317-400`. Não há login `app_runtime` real, como em todos os testes de banco do repo.
  8. `npm run check`, ESLint, build/bundle e a suíte vitest **completa** não rodaram (validação project-wide é do MAESTRO/E2).

- **o que NÃO foi feito (por fronteira do degrau):**
  - **FTS/`tsvector`/GIN/`unaccent`** e representação lexical portuguesa (**D5**) · **embeddings/`pgvector`/HNSW** (**D7/pós-gate §44**) · **ranking §15.7** e `ai_memory_policies` (**D6**).
  - **Dedup, versionamento e conflitos** (`ai_memory_versions`/`ai_memory_conflicts` — **D3**).
  - **`ai_memory_access_log`, export e delete por escopo/usuário** (**D4**); o delete entregue é por id, no tenant corrente (§43).
  - **Evento no outbox a partir da memória** — decisão **B** do STEWARD: não (nenhum consumidor hoje).
  - **Policy engine** — D1 já entregou (`memory.policy.ts`); nada foi duplicado aqui.
  - **`matrix.yaml`/overlay** (`MemoryRepository`: `contract-only → implemented` é regeneração do MAESTRO) · `package.json` (linha proposta abaixo) · ledger/QUEUE/PROGRESS/EXECUTION-STATE-PROGRAM · `docs/specs/M-02/**`.
  - **Consumo de memória em KPI/financeiro** (INV-004/INV-005) e qualquer superfície server-side que leia memória fora de service/repository.
  - Nada pushado; nenhum merge feito.

- **propostas de integração (quem aplica é o MAESTRO):**
  1. **`package.json` — linha exata para o `db:test`** (acrescentar `test-memory.ts` ao **final** da cadeia, depois de `test-backfill.ts`):
     ```diff
     -    "db:test": "tsx scripts/db/check-migration-classes.ts && tsx scripts/db/test-migrations.ts && tsx scripts/db/test-concurrency.ts && tsx scripts/db/test-auth-integration.ts && tsx scripts/db/test-oauth-boundary.ts && tsx scripts/db/test-tool-security.ts && tsx scripts/db/test-sql-injection.ts && tsx scripts/db/test-chat-semantics.ts && tsx scripts/db/test-ai-budget.ts && tsx scripts/db/test-rum-persistence.ts && tsx scripts/db/test-rate-limit-burst.ts && tsx scripts/db/test-outbox.ts && tsx scripts/db/test-backfill.ts",
     +    "db:test": "tsx scripts/db/check-migration-classes.ts && tsx scripts/db/test-migrations.ts && tsx scripts/db/test-concurrency.ts && tsx scripts/db/test-auth-integration.ts && tsx scripts/db/test-oauth-boundary.ts && tsx scripts/db/test-tool-security.ts && tsx scripts/db/test-sql-injection.ts && tsx scripts/db/test-chat-semantics.ts && tsx scripts/db/test-ai-budget.ts && tsx scripts/db/test-rum-persistence.ts && tsx scripts/db/test-rate-limit-burst.ts && tsx scripts/db/test-outbox.ts && tsx scripts/db/test-backfill.ts && tsx scripts/db/test-memory.ts",
     ```
     (14 → 15 suítes, como o card prevê; o `check-migration-classes` continua **primeiro** e o `test-memory` é o último porque é o que menos acopla com os anteriores)
  2. **`docs/specs/M-02/matrix.yaml:1400-1403` (+ overlay)** — `MemoryRepository`: `contract-only` → **`implemented`** (agora existe `src/server/repositories/memory.repository.ts`). `MemoryService` continua `implemented` (D1).
  3. **Registry/journal/snapshot**: já propagados nesta branch (`0017_past_gideon` no `_journal.json` idx 17, snapshot `meta/0017_snapshot.json`, registry `SAFE`, down em `drizzle/rollback/`, DROP global em `0001_to_0000_down.sql`). Nada mais a propagar.
  4. **`scripts/db/test-migrations.ts`/`scripts/db/purge-fixtures.ts`** — já ajustados; ratificação registrada no SPEC-DELTA deste item.
  5. **Aplicação da migration no ambiente alvo é pré-requisito de qualquer deploy** que use o repositório de memória (as tabelas não existem fora do chain).

- **rollback:** `git revert 82acf93` (o claim e o SPEC-DELTA são o segundo commit e podem ser revertidos junto). O DDL reversível é `drizzle/rollback/0017_to_0016_down.sql`; pós-tráfego, o caminho canônico é restore de snapshot — o down descarta as memórias já gravadas (§48).
