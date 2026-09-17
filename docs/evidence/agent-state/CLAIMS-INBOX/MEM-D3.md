# CLAIM — MEM-D3

- **wp / squad / branch / commit:** MEM-D3 · SQUAD-MEM · `mission/n3a-mem-d3` · **commit único do branch** (deliverable + este claim; o SHA exato é reportado no retorno ao MAESTRO — o claim entra no próprio commit, então escrever o SHA aqui o invalidaria a cada `--amend`)
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-3.md` (§WP-D3) · degrau **D3** do `MEM-D0-GAP-REPORT.md:128-133` (entrega + aceite (a)–(d)) · **SD-C3-1…SD-C3-11** de `SPEC-DELTAS/CICLO-3-SOURCE-FACTS.md:§5` · `PLANO:1273-1295` · `V7:3008-3009` e `V7:3517` (DoD §23.2) · §34 (imutabilidade de histórico) · §27a (classificação) · §15.6/§15.8 · §43 · §48 (LGPD)
- **status pleiteado:** DONE no degrau D3 (fechamento ancorado no DoD da V7 §23.2, conforme **SD-C3-11**; o gate §43 **não** cita dedup). `matrix.yaml`/overlay **não** foram tocados — regeneração é do MAESTRO.
- **worktree/container:** `/tmp/wt-mem-d3` (branch `mission/n3a-mem-d3`, a partir de `53b2996` = `develop`) · container efêmero **`n3a-pg`** (`postgres:17-alpine`, `127.0.0.1:55440`, criado para este item e **removido** na limpeza). `:5432` (`preco-que-da-lucro-postgres`) intocado, Neon/produção intocados, `ALLOW_REMOTE_DB` **nunca** usado, nada pushado, nenhum PR, nenhum `--force`.
- **nota de ambiente:** `npm ci --ignore-scripts` no worktree; `node_modules` presente; todas as mutações (npm/tsx/drizzle-kit/git) rodaram com `cwd=/tmp/wt-mem-d3`.

- **cadeia SDD:**
  1. SPEC-CARD lido na íntegra + `CICLO-3-SOURCE-FACTS.md` §1 e §5 (SD-C3-1…SD-C3-11) + aceite (a)–(d) do gap report + decisões A/B/C do STEWARD (2026-09-16).
  2. IMPLEMENT (S3 — GREEN):
     - `src/db/schema.ts` — `ai_memories.dedupKey` + índice **único parcial** `ai_memories_tenant_dedup_key_active_uidx` (+95 linhas), `aiMemoryVersions` e `aiMemoryConflicts` com FK composta `ON DELETE RESTRICT`, CHECKs e índices; tipos `AiMemoryVersion`/`AiMemoryConflict`.
     - `drizzle/0018_polite_living_tribunal.sql` — DDL **gerado** por `npm run db:generate` (tag sorteada pelo Drizzle) + bloco de **grants mínimos + RLS** anexado no mesmo molde de `0017:59-82` (`USING` **e** `WITH CHECK` via `app_private.has_tenant_access`).
     - `drizzle/meta/0018_snapshot.json` + entrada idx 18 do `_journal.json` (efeito do `db:generate`).
     - `drizzle/rollback/0018_to_0017_down.sql` — down (políticas → grants → tabelas → índice → coluna, filho antes do pai). `drizzle/rollback/0001_to_0000_down.sql` — as duas tabelas entram no DROP global do rollback de raiz (padrão do D2, confirmado correto pelo STEWARD).
     - `scripts/db/migration-classes.ts` — entrada `0018_polite_living_tribunal` = `SAFE`/`appliedOn: empty` com `sha256` byte a byte (`4cdeecf7…`) e evidências.
     - `src/server/contracts/memory.contracts.ts` — ampliação **aditiva** do port: `MemoryAppendResult` (`{record, duplicated}` — SD-C3-7), `MemoryRevisionInput`, `MemoryVersionRecord`, `MemoryConflictStatus`/`MemoryConflictRecord`/`MemoryConflictFilter`, `MemoryDeleteOptions`; `MemoryRepositoryPort` ganha `revise`/`listVersions`/`recordConflict`/`listConflicts` e `delete(context, id, options?, executor?)` (SD-C3-8/9). Continua **type-only** (`contracts.test.ts` verde).
     - `src/server/repositories/memory.repository.ts` — `computeMemoryDedupKey`/`normalizeMemoryContent`/`memoryDedupDiscriminator` (função pura, `node:crypto`), `append` com `INSERT … ON CONFLICT (tenant_id, dedup_key) WHERE status='active' DO NOTHING RETURNING *` + leitura da existente (SD-C3-10), `revise` (arquiva o estado substituído e atualiza o head in-place, `SELECT … FOR UPDATE`), `recordConflict` (sem tocar o ativo), `listVersions` (com `superseded` derivado em SQL), `listConflicts`, `delete` com recusa por histórico/conflito e expurgo transacional.
     - `scripts/db/test-memory.ts` — D2 mantido (ajustado ao novo retorno de `append` e ao `dedup_key` NOT NULL) + **D3/T1–T8** (977 linhas no arquivo).
     - `src/test/memory-dedup.test.ts` — unitários da chave pura (normalização NFC/trim/espaços, caixa não dobrada, discriminador por escopo, fronteira de campo com 0x1f, determinismo contra uma implementação independente da fórmula).
  3. EVIDENCE: E1-A a E1-F abaixo.
  4. (este arquivo).
  5. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  6. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

- **E1-A — classificação (§27a):**

  ```text
  $ npm run db:classify:check
  > db:classify:check
  > tsx scripts/db/check-migration-classes.ts

  ✔ 19/19 classificadas
  EXIT=0
  ```

  A entrada nova (`scripts/db/migration-classes.ts:317-332`) é `SAFE` / `appliedOn: empty` / `ok`, com `sha256: 4cdeecf7a61efeba31d0ee9e1f3d04a1a5dfe1a03f22b9b403738cf41de4176a` (hash do arquivo **com** o bloco de grants anexado) e down `drizzle/rollback/0018_to_0017_down.sql`.

- **E1-B — GREEN do script de banco (container efêmero PG17, `app_runtime` real, GUC por transação):**

  ```text
  $ npx tsx scripts/db/test-memory.ts
  T1 isolamento: busca de B = 0 linhas sob RLS + append forjado recusado por WITH CHECK (42501): OK
  T2 proveniência: search devolve a fonte mais antiga; órfã/sem origem impossíveis (23503/23514): OK
  T3 atomicidade: rollback e falha cruzadas entre memória e despesa deixam zero linhas: OK
  T4 delete: só o tenant corrente apaga, cascata na fonte, false para id inexistente e de terceiro: OK
  T5 classificação: 19/19 classificadas · 0017_past_gideon = SAFE/empty + down: OK
  D3/T1 dedup: 2ª gravação idêntica = duplicated:true + contagem inalterada (memória/fonte/versão): OK
  D3/T2 revisão: versão incremental arquivada, anterior byte a byte inalterada, head atualizado: OK
  D3/T3 conflito: registrado e visível só no tenant, ativo byte a byte intacto, search só do ativo: OK
  D3/T4 delete × expurgo: recusa sem apagar + expurgo transacional (rollback devolve tudo): OK
  D3/T5 concorrência: 2 sessões no mesmo conteúdo ⇒ 1 linha ativa (índice único parcial): OK
  D3/T6 isolamento: mesmo conteúdo em 2 tenants = 2 linhas (B não vê A) + discriminador de conversa: OK
  D3/T7 imutabilidade: INSERT permitido e UPDATE/DELETE negados (42501) em ai_memory_versions + grants/RLS: OK
  D3/T8 classificação: 19/19 classificadas · 0018_polite_living_tribunal = SAFE/empty + down: OK
  Memória §43/D2+D3 (persistência, proveniência, tenant, dedup, versões, conflitos): OK
  EXIT=0
  ```

  Cobertura nominal T1–T7 (o que cada caso prova **no banco**):
  - **T1 (dedup idempotente)** — 1ª gravação `duplicated:false`; 2ª gravação do mesmo conteúdo com outra **forma** (`"  Preferência:\trelatórios\n semanais com margem  por produto  "`) devolve `duplicated:true`, o **mesmo `id`** e o conteúdo **armazenado** da 1ª (o dedup não reescreve); o agregado do tenant fica `{memories:1, sources:1, versions:0, conflicts:0}` (contagem de memória **e** de fonte **e** de versão inalterada) e sob `app_runtime` com o GUC de A a contagem segue 1 (não vacuosa). Controle negativo: `"preferência: …"` (caixa diferente) cria memória nova (a caixa **não** é normalizada — decisão documentada).
  - **T2 (revisão)** — a revisão mantém o `id`, muda o conteúdo e a `importance` no head; `ai_memory_versions` ganha `version = 1` com o conteúdo/chave do estado **substituído**; a 2ª revisão cria `version = 2` (`[1, 2]`) e a linha da v1, relida do banco (`content`/`dedup_key`/`created_at`), fica **byte a byte igual**; `dedup_key` do head difere da v1 e da v2; a proveniência da revisão entra como fonte (2 fontes) e o read model segue expondo a **mais antiga**; revisão sem alteração de conteúdo ⇒ `VALIDATION_ERROR` **sem** arquivar versão; revisão de memória de outro tenant ⇒ `NOT_FOUND`.
  - **T3 (conflito)** — `recordConflict` grava `status:'open'`, `resolved_at null` e `candidate_dedup_key` no formato sha256 hex; a memória ativa fica **byte a byte** igual (todas as colunas comparadas) e o agregado só ganha o conflito; `search` continua devolvendo **só** o ativo (o candidato não entra no retrieval) e o filtro por status/memória de `listConflicts` não é vacuoso; sob `app_runtime` o conflito de A é invisível para B (0) e visível para A (1); conflito contra memória inexistente ⇒ `NOT_FOUND`.
  - **T4 (delete × expurgo)** — memória sem histórico continua apagável (`true`, semântica D2); com histórico **e** conflito o delete devolve `false` **e nada é apagado** (agregado idêntico antes/depois); o expurgo rodado dentro de uma transação que **falha depois** devolve tudo (prova de mesma-transação); o expurgo efetivo zera `{memories:0, sources:0, versions:0, conflicts:0}` e é idempotente (`false` na 2ª); e as duas FKs novas são `confdeltype = 'r'` (**RESTRICT**, não CASCADE) no catálogo.
  - **T5 (concorrência)** — duas **conexões reais** (sessões próprias, `begin` manual, `set local role app_runtime` + GUCs), o mesmo conteúdo: a 2ª fica **comprovadamente bloqueada** em lock (barreira em `pg_stat_activity.wait_event_type = 'Lock'` — sem ela o teste poderia passar por acidente, com duas gravações sequenciais) até a 1ª commitar; depois disso o `DO NOTHING` manda a 2ª ler a existente ⇒ `duplicated:false` + `duplicated:true` apontando para o **mesmo `id`**, `{memories:1, sources:0, versions:0, conflicts:0}` e **1** linha ativa para a chave disputada (sem 23505 vazando).
  - **T6 (isolamento de tenant)** — o mesmo conteúdo (mesmo escopo) em dois tenants ⇒ 2 linhas, `ids` diferentes e `duplicated:false` nos dois; B vê a própria memória (busca não vacuosa) e **não** vê a de A; `runtimeCount` = 1 para cada tenant. Discriminador: o mesmo conteúdo, mesmo escopo `conversation`, em duas conversas do **mesmo** tenant ⇒ 2 memórias (sem colapso silencioso).
  - **T7 (imutabilidade por privilégio)** — controle **positivo** primeiro: `app_runtime` **consegue** `INSERT` em `ai_memory_versions` (a linha entra, 2 versões visíveis para a role); depois `UPDATE` e `DELETE` são negados com **42501** e a versão continua byte a byte igual. Catálogo: `ai_memory_versions` = RLS ligado, `SELECT/INSERT` **sim**, `UPDATE/DELETE` **não**; `ai_memory_conflicts` = `SELECT/INSERT/UPDATE` **sim**, `DELETE` não; nada para `PUBLIC`; as duas policies `tenant_isolation` com `USING` **e** `WITH CHECK` contendo `current_tenant_id()` + `has_tenant_access`.
  - **T8 (classificação)** — `classifyProject` dentro do script: 0 erros, `19/19`, `0018_polite_living_tribunal` = `SAFE`/`appliedOn: empty`/`ok` e o down existe.

- **E1-C — psql das policies, índices e grants (container efêmero):**

  ```text
  $ psql -c "select tablename, policyname, roles, cmd, qual, with_check from pg_policies where tablename like 'ai_memo%' order by tablename;"
        tablename      |    policyname    |     roles     | cmd |                                             qual                                             |                                          with_check
  ---------------------+------------------+---------------+-----+----------------------------------------------------------------------------------------------+----------------------------------------------------------------------------------------------
   ai_memories         | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))
   ai_memory_conflicts | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))
   ai_memory_sources   | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))
   ai_memory_versions  | tenant_isolation | {app_runtime} | ALL | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)) | ((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id))
  (4 rows)

  $ psql -c "select indexname, indexdef from pg_indexes where tablename like 'ai_memo%' order by tablename, indexname;"
                     indexname                   |                                                            indexdef
  -----------------------------------------------+----------------------------------------------------------------------------------------------------------------------------------
   ai_memories_pkey                              | CREATE UNIQUE INDEX ai_memories_pkey ON public.ai_memories USING btree (id)
   ai_memories_tenant_dedup_key_active_uidx      | CREATE UNIQUE INDEX ai_memories_tenant_dedup_key_active_uidx ON public.ai_memories USING btree (tenant_id, dedup_key) WHERE (status = 'active'::text)
   ai_memories_tenant_id_id_uidx                 | CREATE UNIQUE INDEX ai_memories_tenant_id_id_uidx ON public.ai_memories USING btree (tenant_id, id)
   ai_memories_tenant_status_created_idx         | CREATE INDEX ai_memories_tenant_status_created_idx ON public.ai_memories USING btree (tenant_id, status, created_at)
   ai_memory_conflicts_pkey                      | CREATE UNIQUE INDEX ai_memory_conflicts_pkey ON public.ai_memory_conflicts USING btree (id)
   ai_memory_conflicts_tenant_memory_idx         | CREATE INDEX ai_memory_conflicts_tenant_memory_idx ON public.ai_memory_conflicts USING btree (tenant_id, memory_id)
   ai_memory_conflicts_tenant_status_idx         | CREATE INDEX ai_memory_conflicts_tenant_status_idx ON public.ai_memory_conflicts USING btree (tenant_id, status)
   ai_memory_sources_pkey                        | CREATE UNIQUE INDEX ai_memory_sources_pkey ON public.ai_memory_sources USING btree (id)
   ai_memory_sources_tenant_memory_idx           | CREATE INDEX ai_memory_sources_tenant_memory_idx ON public.ai_memory_sources USING btree (tenant_id, memory_id)
   ai_memory_versions_pkey                       | CREATE UNIQUE INDEX ai_memory_versions_pkey ON public.ai_memory_versions USING btree (id)
   ai_memory_versions_tenant_memory_version_uidx | CREATE UNIQUE INDEX ai_memory_versions_tenant_memory_version_uidx ON public.ai_memory_versions USING btree (tenant_id, memory_id, version)
  (11 rows)

  $ psql -c "select c.relname, c.relrowsecurity rls, has_table_privilege('app_runtime','public.'||c.relname,'select') sel, … 'insert' ins, … 'update' upd, … 'delete' del, has_table_privilege('public','public.'||c.relname,'select') pub from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'ai_memo%' order by c.relname;"
        tabela          | rls | sel | ins | upd | del | pub
  ----------------------+-----+-----+-----+-----+-----+-----
   ai_memories         | t   | t   | t   | t   | t   | f
   ai_memory_conflicts | t   | t   | t   | t   | f   | f
   ai_memory_sources   | t   | t   | t   | f   | f   | f
   ai_memory_versions  | t   | t   | t   | f   | f   | f
  (4 rows)
  ```

- **E1-D — up→down→up explícito do par 0018:**

  ```text
  == 1. UP (estado herdado do test-migrations/replay) ==
  journal=19
  tabelas=ai_memory_versions,ai_memory_conflicts
  dedup_key_col=1
  == 2. DOWN 0018→0017 ==  (psql -f drizzle/rollback/0018_to_0017_down.sql)
  DROP POLICY / DROP POLICY / REVOKE / REVOKE / DROP TABLE / DROP TABLE / DROP INDEX / ALTER TABLE
  == 3. verificação pós-down ==
  ai_memory_versions=AUSENTE ai_memory_conflicts=AUSENTE
  dedup_key_col=0
  indice_dedup=AUSENTE
  memorias_removidas=0
  == 4. journal -1 ==
  DELETE 1
  journal=18
  == 5. UP de novo ==
  Migrations PostgreSQL aplicadas com sucesso.
  == 6. verificação pós-up ==
  journal=19
  tabelas=ai_memory_versions,ai_memory_conflicts
  dedup_key_col=1
  linhas_versao=0
  ```

- **E1-E — cadeia de migrations/rollback (o down novo entra em `DOWNS_TIP_TO_0003`):**

  ```text
  $ npx tsx scripts/db/test-migrations.ts
  PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
  EXIT=0
  ```

  O script aplica `0018→0003` (com `0018_to_0017_down.sql` no topo), reduz o journal a 0000/0001, aplica `0003→0002`/`0002→0001` e **replaya** `0002→0018` conferindo `journal = 19` — é o up→down→up da cadeia inteira, com o rollback de raiz (`0001→0000`, que agora dropa as duas tabelas novas) incluído.

- **E1-F — vitest dirigido, tipos e prettier:**

  ```text
  $ npx vitest run src/test/memory-dedup.test.ts src/test/contracts.test.ts src/test/memory-import-graph.test.ts src/test/migration-classes.test.ts src/test/m02-purge-fixtures.test.ts src/test/memory-policy.test.ts src/test/memory-service.test.ts
   Test Files  7 passed (7)
        Tests  80 passed (80)
  EXIT=0

  $ npx tsc -p tsconfig.json --noEmit
  TSC_EXIT=0

  $ npx prettier --write src/db/schema.ts src/server/contracts/memory.contracts.ts src/server/repositories/memory.repository.ts scripts/db/migration-classes.ts scripts/db/test-memory.ts scripts/db/test-migrations.ts scripts/db/purge-fixtures.ts src/test/memory-dedup.test.ts
  (8 arquivos; 4 alterados na escrita, 4 já formatados)  PRETTIER_EXIT=0
  ```

  (`drizzle/*.sql` não têm parser no Prettier — o `format:check` do repo não cobre migrations, como em 0017.)

- **decisões declaradas (o que o card não fixa explicitamente):**
  1. **`revise` como método do port.** O card descreve a revisão (SD-C3-4) e exige o teste T2, mas **não nomeia** o método: o port só cita `append` (SD-C3-7), `listVersions`/`listConflicts` (SD-C3-8) e `delete` (SD-C3-9). Sem uma entrada explícita, a revisão só seria alcançável por SQL direto no teste — o que não provaria o caminho da aplicação. Assinatura escolhida: `revise(context, memoryId, { content, importance?, provenance? }, executor?)`, restrita ao tenant corrente e ao `status='active'` (`NOT_FOUND` fora disso).
  2. **`listConflicts(context, filter?, executor?)`** — SD-C3-8 escreve `listConflicts(context, status?)`; o parâmetro virou um filtro `{ status?, memoryId? }` (superconjunto compatível) porque a verificação de T3 precisa distinguir "conflito desta memória" de "conflito do tenant", e D4 vai querer o mesmo recorte.
  3. **A proveniência da revisão vira fonte.** O input da revisão aceita `provenance` e, quando presente, ela é gravada em `ai_memory_sources` (mesma transação) — coerente com a proveniência 1:N da decisão C. O read model continua expondo a fonte **mais antiga** (regra do D2), então a revisão **não** muda `record.provenance` enquanto existir fonte anterior.
  4. **Discriminador da revisão com fallback.** Para `scope='conversation'`, o discriminador é a conversa da proveniência declarada **ou**, se ela vier sem conversa, a conversa da fonte primária da memória. Sem o fallback, uma revisão só-de-conteúdo derivaria uma chave de discriminador vazio e a memória perderia a continuidade do dedup.
  5. **Recusa do delete inclui conflito.** SD-C3-9 fala em "memória com histórico"; como a FK de `ai_memory_conflicts` também é `RESTRICT` (SD-C3-6), apagar uma memória com conflito levantaria 23503 — a recusa (`false`, sem erro) cobre **histórico ou conflito**. Se o STEWARD quiser que conflito não bloqueie o delete, a FK do conflito precisa virar `CASCADE` (1 linha + mudança de down + teste).
  6. **Dedup não grava nada na duplicata.** SD-C3-10 só descreve o `INSERT … DO NOTHING` + leitura; a duplicata **não** acrescenta fonte nem versão (o `append` duplicado não reescreve o agregado). Documentado em comentário no repositório e provado por T1.
  7. **`superseded` derivado com o head como versão corrente.** SD-C3-4 diz "uma versão está superseded se existir versão de número maior na mesma memória" e chama `ai_memories` de _head_ atualizado in-place. O head **é** a versão corrente da memória; logo toda versão arquivada tem sucessor de número maior e a derivação (`version < max(version) over (partition by memory_id) + 1`) é `true` para toda linha arquivada. Ver "pontos de contrato" §1 abaixo.
  8. **Caixa não entra na normalização** (como o card manda decidir e documentar): `"Margem"` ≠ `"margem"`; o conteúdo **armazenado** segue sendo o do chamador (a normalização alimenta só a chave).
  9. **A chave pura mora no repositório, não nos contratos.** `memory.contracts.ts` é **type-only** por invariante documentada e verificada (`src/test/contracts.test.ts`: "nenhum valor executável"); a função de chave é runtime, então ficou em `memory.repository.ts` (exportada, sem import de `@/db`). O arquivo `drizzle/0018_*.sql` mantém o nome sorteado pelo Drizzle (`0018_polite_living_tribunal`), como em 0017.

- **pontos de contrato — onde o spec-card ficou ambíguo ou errado (reporte, não consertei):**
  1. **SD-C3-3/4 × T7 × SD-C3-9 são mutuamente insatisfatóveis para `app_runtime`.** SD-C3-3/4 dão a `ai_memory_versions` apenas `SELECT`+`INSERT`, e T7 exige que `app_runtime` **não** consiga `DELETE` (42501). SD-C3-9 exige que `delete(..., {purgeHistory:true})` apague versões+conflitos+memória na mesma transação — o que exige `DELETE` em `ai_memory_versions` (e em `ai_memory_conflicts`, que só tem `SELECT`/`INSERT`/`UPDATE`). Com a FK `ON DELETE RESTRICT` (SD-C3-3/6) não há como contornar pelo cascade. Implementei o expurgo no repositório (semântica correta: mesma transação, ordem filho→pai, fontes pela cascata) e o provei no script sob a sessão de teste do D2 (admin/superuser, como os testes T3/T4 do D2 fazem), enquanto T7 prova a denegação da role de aplicação. **Decisão do STEWARD necessária:** (a) conceder `DELETE` nas duas tabelas e trocar a asserção de `DELETE` do T7 por `UPDATE` só; ou (b) declarar o expurgo um caminho administrativo (owner/ops, sem a role de aplicação) — hoje o expurgo **falharia** com 42501 sob `app_runtime`.
  2. **SD-C3-4 (derivação de `superseded`) contra o desenho do head.** Com o head fora da tabela de versões, a leitura literal da regra ("versão de número maior na **mesma memória**") só é satisfeita se o head contar como a versão corrente — caso contrário a versão mais recente arquivada ficaria sem marcação e um leitor que filtrasse `superseded=false` acharia que o conteúdo anterior é o atual. Implementei a leitura com o head contando (consequência: toda versão arquivada é `superseded=true`); o campo nasce portanto constante para linhas arquivadas. Se o STEWARD quiser a marcação informativa, o caminho é uma coluna/espelho da versão corrente (fora do que SD-C3-2 autoriza em 0018) — **não** inventei schema.
  3. **SD-C3-5 vs. "detecção de conflito" do aceite (c).** O gap report fala em "detecção de conflito (novo candidato contradiz ativo do mesmo escopo)"; SD-C3-5 decide que D3 **não julga** contradição e expõe `recordConflict()` como enforcement. Segui SD-C3-5 (a decisão posterior e explícita): o test T3 prova o **registro** e o invariante, não um juiz semântico.
  4. **Ausência de método de revisão no port** (SD-C3-4 descreve o comportamento, SD-C3-7/8/9 não o nomeiam) — resolvido com `revise` (decisão declarada §1).
  5. **Escopo de arquivos incompleto para a migration integrar.** O card lista como escopo exclusivo `drizzle/0018_*`, `meta/**`, `schema.ts`, `migration-classes.ts`, `contracts`, `repository`, `test-memory.ts`, `src/test/memory-*.test.ts`, `MEM-D3.md` e `package.json` — mas a migration nova **exige** três arquivos fora dessa lista: `scripts/db/test-migrations.ts` (a lista `DOWNS_TIP_TO_0003` e a contagem do journal `18→19`), `scripts/db/purge-fixtures.ts` (`ai_memory_conflicts`/`ai_memory_versions` antes de `ai_memories`, senão o expurgo de fixture esbarra no RESTRICT) e `drizzle/rollback/0001_to_0000_down.sql` (DROP global do teardown, padrão do D2 — confirmado correto pelo STEWARD no incidente de colisão). Foram os três alterados (**+4/-2 linhas** no total, sem mudança de comportamento fora do par 0018) e **nada** de `docs/specs/M-02/**`. `package.json` **não** foi tocado: `test-memory.ts` já estava encadeado no `db:test` (último da cadeia, herdado do D2).
  6. **`PLANO`/`V7` não fixam colunas de `ai_memory_versions`/`ai_memory_conflicts`** (lacunas G3/G6): implementei exatamente as colunas de SD-C3-3/SD-C3-6, sem extras (nem `superseded_at`, nem `resolved_by`, nem índice para busca por `candidate_dedup_key`).

- **resíduos declarados:**
  1. **Expurgo precisa de executor privilegiado** (ponto de contrato §1) — o caminho existe e é transacional, mas **não** roda sob `app_runtime` com os grants de SD-C3-3/6.
  2. **`superseded` é constante para linhas arquivadas** (ponto de contrato §2) — a marcação é derivada e correta com o head como versão corrente, mas não distingue "a última versão arquivada" de "as anteriores".
  3. **Transições de status do conflito** (`open → dismissed|resolved`) têm `UPDATE` concedido, mas **nenhum** método as executa: quem resolve é o serviço (SD-C3-6, D4+).
  4. **`listVersions`/`listConflicts` não paginam** — leitura do histórico inteiro da memória/tenant; o teto de retrieval (`policy.maxResults`) é do `search`, não do histórico.
  5. **Nenhuma medição de performance** (§29): sem `EXPLAIN`/p95 do dedup ou do histórico. O índice parcial é quem sustenta a corrida; não há número medido neste degrau.
  6. **`revise` não re-valida a policy** (D1): como no D2, o repositório persiste o que a camada de serviço aprovou; `recordConflict` também não julga contradição (SD-C3-5).
  7. **`append` duplicado não registra a nova observação** (fonte) — decisão declarada §6; se o produto quiser contagem de observações por memória, é evolução aditiva.
  8. **A tag `0018_polite_living_tribunal` é acoplada ao sorteio do Drizzle**: regenerar a migration muda tag/hash e exige acompanhar `migration-classes.ts`, o nome do down e as duas constantes do `test-memory.ts`. O `db:classify:check` (primeiro da cadeia) falha alto se não acompanharem — não há falha silenciosa.
  9. **`npm run check`, ESLint, build/bundle e a suíte vitest completa NÃO rodaram** (E2 é do MAESTRO). Rodaram: `db:classify:check`, `test-memory.ts`, `test-migrations.ts`, o vitest dirigido e `tsc`.
  10. **Incidente de colisão de worktree (resolvido, registrado por transparência):** durante a fase inicial eu editei/rodei `db:generate` dentro do worktree do STEWARD (`wt-20260916-234317-7609fed`) por engano; o STEWARD moveu os 8 arquivos para `/tmp/wt-mem-d3` (sha256 idênticos) e restaurou o worktree dele; todo o trabalho posterior rodou apenas em `/tmp/wt-mem-d3` e o conteúdo final foi revalidado (E1-B/E1-E) no worktree próprio.

- **o que NÃO foi feito (fronteira do degrau):**
  - **FTS/`tsvector`/GIN/`unaccent` e busca lexical portuguesa** (D5) · **embeddings/`pgvector`/HNSW** (pós-gate §44) · **ranking §15.7**, contexto e `ai_memory_policies` (D6).
  - **`ai_memory_access_log`, export e delete por escopo/usuário** (D4) · **resolução automática de conflito** (D4+) · **TTL/expiração e política de retenção** (H-12/D4 — SD-C3-11 remete o fechamento a §23.2).
  - **Memória cross-tenant** e **`outbox` no append** (decisão B do STEWARD).
  - **`matrix.yaml`/overlay** (`MemoryRepository`: `contract-only → implemented` é regeneração do MAESTRO) · ledger/QUEUE/PROGRESS/EXECUTION-STATE-PROGRAM · `docs/specs/M-02/**` · `package.json`.
  - **Consumo de memória em KPI/financeiro** (INV-004/INV-005) e qualquer superfície server-side fora de service/repository.
  - Nada pushado; nenhum merge; `:5432` intocado.

- **diff stat (deliverable, `git show --stat` do commit do branch; este claim entra no mesmo commit e não está contado abaixo):**

  ```text
   drizzle/0018_polite_living_tribunal.sql      |   67 +
   drizzle/meta/0018_snapshot.json              | 5103 ++++++++++++++++++++++++++
   drizzle/meta/_journal.json                   |    9 +-
   drizzle/rollback/0001_to_0000_down.sql       |    2 +
   drizzle/rollback/0018_to_0017_down.sql       |   24 +
   scripts/db/migration-classes.ts              |   16 +
   scripts/db/purge-fixtures.ts                 |    2 +
   scripts/db/test-memory.ts                    |  977 ++++-
   scripts/db/test-migrations.ts                |    9 +-
   src/db/schema.ts                             |   95 +
   src/server/contracts/memory.contracts.ts     |   92 +-
   src/server/repositories/memory.repository.ts |  501 ++-
   src/test/memory-dedup.test.ts                |  126 +
   13 files changed, 6961 insertions(+), 62 deletions(-)
  ```

  `git diff --stat -- docs/specs/M-02/` = **vazio** (matrix intocada). `git status` limpo após o commit.

- **propostas de integração (quem aplica é o MAESTRO):**
  1. **`docs/specs/M-02/matrix.yaml` (+overlay)** — `MemoryRepository`/`MemoryService` já aparecem como `contract-only`; com D3 o repositório tem dedup/versão/conflito implementados (a mudança de status e a regeneração são do MAESTRO).
  2. **Registry/journal/snapshot/down/root-rollback** — já propagados nesta branch; nada mais a propagar.
  3. **E2** — `npm run check` + `npm run db:test` no HEAD integrado. A cadeia `db:test` já executa `test-memory.ts` (15 suítes); nenhuma linha de `package.json` é necessária.
  4. **Aplicação da migration 0018 é pré-requisito** de qualquer deploy que use o repositório de memória (a coluna `dedup_key` é NOT NULL e o schema a exige).
  5. **Ponto de contrato §1 (expurgo × privilégio)** — precisa de decisão do STEWARD antes de D4 prometer delete-export sob a role de aplicação.

- **rollback:** `git revert <commit do branch>` (deliverable + claim no mesmo commit). O DDL reversível é `drizzle/rollback/0018_to_0017_down.sql` (testado up→down→up em E1-D/E1-E); pós-tráfego o caminho canônico é restore de snapshot — o down descarta histórico/conflitos e a coluna de dedup (§48).
