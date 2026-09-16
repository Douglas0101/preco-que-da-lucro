# CLAIM — WP-1a BACKFILL-LEDGER

- **wp / squad / branch / commit:** WP-1a (`28.2` checkpoint · `28.4` idempotência) · SQUAD-DB-N1A · `mission/n1a-backfill-ledger` · `1800252` (código + migration + testes; este claim é o commit seguinte)
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/WP-1a-backfill-ledger.md` (lido inteiro antes da primeira linha) · Plano Mestre §28 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1863-1871`) · §27 · §21 T2 · INV-009/INV-012 · decisão **D3** do STEWARD · base V-B2 `b37909c` (claim `CLAIMS-INBOX/28-backfill.md`, residual de CAS)
- **status pleiteado:** **DONE** — T1–T5 verdes com saída real; CAS provado sob concorrência; ledger schema-managed (migration gerada + registry + down); `db:classify:check` 17/17. E1 é provisório: a evidência autoritativa (E2) é do MAESTRO no HEAD integrado.

## 1. Diff stat (escopo exclusivo do card + 1 arquivo de chain, ver SPEC-DELTA)

```text
$ git show --stat 1800252
 drizzle/0016_slim_imperial_guard.sql   |   55 +
 drizzle/meta/0016_snapshot.json        | 4417 ++++++++++++++++++++++++++++++++
 drizzle/meta/_journal.json             |    7 +
 drizzle/rollback/0001_to_0000_down.sql |    2 +
 drizzle/rollback/0016_to_0015_down.sql |   16 +
 scripts/db/backfill-ledger.ts          |  118 +-
 scripts/db/backfill-runner.ts          |   41 +-
 scripts/db/migration-classes.ts        |   16 +
 scripts/db/purge-fixtures.ts           |    2 +
 scripts/db/test-backfill.ts            |  494 +++-
 scripts/db/test-migrations.ts          |   11 +-
 src/db/schema.ts                       |   58 +
 12 files changed, 5082 insertions(+), 155 deletions(-)
```

`package.json`, `docker-compose.yml`, `EXECUTION-STATE-PROGRAM.md`, `QUEUE.md`, `PROGRESS.md`, `SUPERVISION-LOG.md`, `DECISIONS-PENDING/**`, `scripts/db/test-outbox.ts` e o repo principal: **intocados**. `:5432` intocado (o container efêmero rodou em `5433`).

## 2. S2 (RED) — os testes primeiro, falhando por AUSÊNCIA (não por bug)

`scripts/db/test-backfill.ts` foi reescrito (T1–T5, incluindo o novo T2 de contenção) **antes** de qualquer linha de implementação. Estado inicial, com o banco migrado até 0015:

```text
$ npx tsx scripts/db/test-backfill.ts
== T1 — SIGKILL no meio do run (10 linhas, batchSize=3, rate-limit 4/50ms) ==
  estado (antes): linhas=10 derivadas=0 max_apply_count=0 linhas_duplicadas=0 marcadores=0 checkpoint=ausente
  [filho] run backfill-demo:attempt-1 batchSize=3 · SIGKILL após processar a linha 4
    [batch lote 1] linhas=3 lidas=3 aplicadas=3 duplicadas=0 erros=0 cursor=d03 versão=1 taxa=3000.0/s checkpoint=em curso
  [pai] filho: status=null signal=SIGKILL (morte real no meio do run)
  estado (após o SIGKILL): linhas=10 derivadas=4 max_apply_count=1 linhas_duplicadas=0 marcadores=4 checkpoint=d03/lotes=1/lidas=3/aplicadas=3/dup=0/erros=0/v=1/em curso
  -- retomada (mesmo runKey) --
    [batch lote 1] linhas=3 lidas=3 aplicadas=2 duplicadas=1 erros=0 cursor=d06 versão=2 taxa=3000.0/s checkpoint=em curso
    [batch lote 2] linhas=3 lidas=6 aplicadas=5 duplicadas=1 erros=0 cursor=d09 versão=3 taxa=120.0/s checkpoint=em curso
    [completed lote 3] linhas=1 lidas=7 aplicadas=6 duplicadas=1 erros=0 cursor=d10 versão=4 taxa=140.0/s checkpoint=concluído
  retomada: lotes=3 lidas=7 aplicadas=6 duplicadas=1 erros=0 taxa=140.0/s esperas=1(50ms) checkpoint=d10/concluído versão=4 retomada=true duração=50ms
  estado (após a retomada): linhas=10 derivadas=10 max_apply_count=1 linhas_duplicadas=0 marcadores=10 checkpoint=d10/lotes=4/lidas=10/aplicadas=9/dup=1/erros=0/v=4/concluído
  -- T4: 2ª tentativa completa (checkpoint novo, mesma workKey) --
    [batch lote 1] linhas=3 lidas=3 aplicadas=0 duplicadas=3 erros=0 cursor=d03 versão=1 taxa=3000.0/s checkpoint=em curso
    [batch lote 2] linhas=3 lidas=6 aplicadas=0 duplicadas=6 erros=0 cursor=d06 versão=2 taxa=120.0/s checkpoint=em curso
    [batch lote 3] linhas=3 lidas=9 aplicadas=0 duplicadas=9 erros=0 cursor=d09 versão=3 taxa=90.0/s checkpoint=em curso
    [completed lote 4] linhas=1 lidas=10 aplicadas=0 duplicadas=10 erros=0 cursor=d10 versão=4 taxa=100.0/s checkpoint=concluído
  2ª tentativa: lotes=4 lidas=10 aplicadas=0 duplicadas=10 erros=0 taxa=100.0/s esperas=2(100ms) checkpoint=d10/concluído versão=4 retomada=false duração=100ms
  estado (após a 2ª tentativa): linhas=10 derivadas=10 max_apply_count=1 linhas_duplicadas=0 marcadores=10 checkpoint=d10/lotes=4/lidas=10/aplicadas=0/dup=10/erros=0/v=4/concluído

== T3 — erro real do Postgres (22012) no meio do lote: aborta, checkpoint no lote anterior, retoma ==
  estado (antes): linhas=4 derivadas=0 max_apply_count=0 linhas_duplicadas=0 marcadores=0 checkpoint=ausente
    [batch lote 1] linhas=2 lidas=2 aplicadas=2 duplicadas=0 erros=0 cursor=d02 versão=1 taxa=33.3/s checkpoint=em curso
  abortado: lotes=2 lidas=4 aplicadas=3 duplicadas=0 erros=1 taxa=31.3/s esperas=0(0ms) checkpoint=d02/em curso versão=1 retomada=false duração=128ms
  estado (após o abort): linhas=4 derivadas=3 max_apply_count=1 linhas_duplicadas=0 marcadores=3 checkpoint=d02/lotes=1/lidas=2/aplicadas=2/dup=0/erros=0/v=1/em curso
    [batch lote 1] linhas=2 lidas=2 aplicadas=1 duplicadas=1 erros=0 cursor=d04 versão=2 taxa=23.8/s checkpoint=em curso
    [completed lote 1] linhas=0 lidas=2 aplicadas=1 duplicadas=1 erros=0 cursor=d04 versão=3 taxa=20.0/s checkpoint=concluído
  retomada: lotes=1 lidas=2 aplicadas=1 duplicadas=1 erros=0 taxa=20.0/s esperas=0(0ms) checkpoint=d04/concluído versão=3 retomada=true duração=100ms
  estado (final): linhas=4 derivadas=4 max_apply_count=1 linhas_duplicadas=0 marcadores=4 checkpoint=d04/lotes=3/lidas=4/aplicadas=3/dup=1/erros=0/v=3/concluído

== T2 — contenção CAS: 2 workers no mesmo runKey (mesma versão de partida) ==
    [worker 2 lote 1] lidas=3 aplicadas=3 duplicadas=0 v=1
    [worker 2 lote 2] lidas=6 aplicadas=6 duplicadas=0 v=2
    [worker 2 lote 3] lidas=9 aplicadas=9 duplicadas=0 v=3
    [worker 2 lote 4] lidas=10 aplicadas=10 duplicadas=0 v=4
  perdedor: backfill-runner: checkpoint de "backfill-demo:contention" está em outra versão (CAS esperava a versão 0); outro runner avançou primeiro — este run foi descartado sem sobrescrever nada
  vencedor: lotes=4 lidas=10 aplicadas=10 duplicadas=0 erros=0 taxa=35.7/s esperas=0(0ms) checkpoint=d10/concluído versão=4 retomada=false duração=280ms
  estado (após a contenção): linhas=10 derivadas=10 max_apply_count=1 linhas_duplicadas=0 marcadores=10 checkpoint=d10/lotes=4/lidas=10/aplicadas=10/dup=0/erros=0/v=4/concluído
  checkpoint do vencedor: aplicadas=10 duplicadas=0 (repartição depende da corrida)

== T5 — RLS/grants do ledger sob app_runtime (NOSUPERUSER/NOBYPASSRLS) ==
T5 isolamento: RLS por tenant no ledger + WITH CHECK da escrita cruzada: OK

Backfill §28 (28.1 lote · 28.2 checkpoint+CAS · 28.3 rate-limit · 28.4 idempotência · 28.5 observabilidade): OK
EXIT=0
```

**T2 (contenção CAS) — como o "exatamente 1 avança" é determinístico:** os dois workers compartilham o mesmo `runKey` e uma **barreira de arranque** garante que ambos leiam a mesma versão persistida (`v=0`) antes de qualquer `save` (sem a barreira, o segundo apenas retomaria o checkpoint do primeiro — caminho seguro, mas não a corrida). A partir daí a arbitragem é do banco: o `INSERT … ON CONFLICT … WHERE version = excluded.version - 1` faz um avançar e o outro receber `rowCount = 0` ⇒ `BackfillCheckpointConflictError`. Os contadores provados no ledger são **só os do vencedor**: `lotes=4`, `lidas=10`, `aplicadas + duplicadas = 10`, `versão=4` — a inflação `lotes=5 para 4 lotes` observada por V-B2 não é mais alcançável. Rodadas sucessivas alternam o vencedor (a captura acima: worker 2 aplicando as 10; em outra rodada, o worker 1 venceu e o perdedor morreu depois de já ter aplicado o lote 1), então nada no teste está fixado à ordem de chegada.

### 4.2 Não regrediu: outbox + unit tests + chain + gates M-02

```text
$ npx tsx scripts/db/test-outbox.ts
T1 atomicidade: rollback do domínio sem evento órfão + falha do evento sem despesa: OK
T2 claim concorrente: 2 workers com SKIP LOCKED dividem o lote sem repetir: OK
T3 idempotência: mesmo evento 2× ⇒ 1 efeito (inbox persistida por consumidor): OK
T4 falha: attempts++ + available_at futuro + retry limitado por maxAttempts: OK
T5 isolamento: RLS por tenant sob app_runtime + WITH CHECK do append cruzado: OK
Outbox §23 (23.1 + 23.2): atomicidade, claim concorrente, idempotência: OK

$ npx tsx scripts/db/test-migrations.ts
PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
   # inclui rollback 0016→0003, downgrade até 0001, replay 0002→0016 (journal=17) e o rollback global 0001→0000

$ npx vitest run src/test/backfill-runner.test.ts src/test/migration-classes.test.ts
 Test Files  2 passed (2)
      Tests  8 passed (8)

$ npx vitest run src/test/m02-purge-fixtures.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)

$ npm run m02:matrix:check && npm run m02:boundaries
M-02 matrix is deterministic and up to date.
M-02 BFF boundary is clean: all database reachability is allowlisted or repository-only.

$ npx tsc -p tsconfig.json --noEmit        # achou 1 defeito meu (ver §5) e depois ficou verde
TSC_EXIT=0

$ npm run format:check                    # idem: achou 4 arquivos meus sem prettier
All matched files use Prettier code style!
FORMAT_EXIT=0
```

### 4.3 `psql` — tabelas, policies e grants novas (reproduzir: `docker exec pqdl-n1a-pg17 psql -U postgres -d preco_que_da_lucro_test …`)

```text
$ \d backfill_checkpoints
 tenant_id | uuid | not null |            ← PK composta (tenant_id, run_key)
 run_key   | text | not null |
 cursor    | text |
 … rows_scanned/rows_applied/rows_duplicate/errors | integer not null default 0
 version   | integer | not null |        ← token do CAS
 updated_at| timestamp with time zone | not null |
Indexes: "backfill_checkpoints_tenant_id_run_key_pk" PRIMARY KEY, btree (tenant_id, run_key)
Check constraints: counters (>= 0), identity (run_key <> ''), version (>= 0)
Foreign-key constraints: backfill_checkpoints_tenant_id_tenants_id_fk → tenants(id) ON DELETE CASCADE
Policies: POLICY "tenant_isolation" TO app_runtime
  USING (((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)))
  WITH CHECK (((tenant_id = app_private.current_tenant_id()) AND app_private.has_tenant_access(tenant_id)))

$ \d backfill_work_items
 tenant_id | uuid | not null |   work_key | text | not null |   run_key | text | not null |   row_key | text | not null |
 applied_at| timestamp with time zone | not null default now()
Indexes: PK (tenant_id, work_key); "backfill_work_items_tenant_run_key_idx" btree (tenant_id, run_key)
Policies: POLICY "tenant_isolation" TO app_runtime (USING/WITH CHECK idênticos)

$ select c.relname, c.relrowsecurity as rls, has_table_privilege('public', c.oid,'insert') as public_insert …
 backfill_checkpoints | t | f
 backfill_work_items  | t | f

$ select 'checkpoints', has_table_privilege('app_runtime','public.backfill_checkpoints','select'), … insert, update, delete
 checkpoints | s=t | i=t | u=t | d=f
 work_items  | s=t | i=t | u=f | d=f

$ select rolname, rolsuper, rolbypassrls from pg_roles where rolname='app_runtime';
 app_runtime | f | f
```

T5 exercita esse contrato sob a role real (não só o catálogo): dentro de uma transação `set local role app_runtime` + GUCs do tenant A, A enxerga o próprio checkpoint/marcador, **não** enxerga os de B (`0` linhas), grava o próprio marcador (policy permissiva, não só deny-all), não alcança o checkpoint de B (`UPDATE … rowCount 0`) e é recusado com `42501` ao inserir marcador com `tenant_id` de B.

## 5. Autoverificação adversarial (mutações — o verificador deve reconferir do zero)

| mutação aplicada                                                                                                      | teste que morreu                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripts/db/backfill-ledger.ts`: remover `where backfill_checkpoints.version = excluded.version - 1` (upsert sem CAS) | **T2**: `AssertionError: exatamente 1 worker pode avançar o checkpoint`                      |
| banco: `drop policy tenant_isolation on backfill_work_items`                                                          | **T5**: `AssertionError: A deve enxergar o próprio marcador de T5`                           |
| banco: `drop policy tenant_isolation on backfill_checkpoints`                                                         | **T5**: `AssertionError: A deve enxergar o próprio checkpoint de T5`                         |
| banco: policy com `using (true) with check (true)` nas duas tabelas                                                   | **T5**: `AssertionError: A deve enxergar o próprio checkpoint de T5` (vê 2+, o esperado é 1) |

A 2ª/3ª/4ª linhas expuseram uma fraqueza real do meu primeiro T5 (ele só provava _fail-closed_, e uma tabela com RLS ligada e **nenhuma** policy também é fail-closed): o teste foi endurecido com "o dono enxerga o próprio" e "o dono grava o próprio" antes de fechar o item. Ou seja, o teste que está no commit é mais forte do que o que passou na primeira rodada.

- **Veredicto S6 (S5→S6, verificador independente):** **CONFIRMED** — recomendação `28.2 = DONE` e `28.4 = DONE`. O verificador re-derivou o item no próprio container (porta 5438), reconferiu o sha256 do registry, achou o CAS no **único** caminho de escrita e provou o valor dele (sem o `WHERE`, numa cópia `/tmp`, uma leitura obsoleta regride um checkpoint `completed` de `v4` para `v1` **sem erro** — exatamente a sobrescrita silenciosa que a aceitação proíbe); `drop` das tabelas ⇒ suíte morre (nada é autocriado em tempo de teste), up→down→up com diff vazio, RLS `0 rows` + `42501` nas duas tabelas.
- **Correção docs-only pós-veredicto (aplicada neste branch):** o comentário do downgrade em `scripts/db/test-migrations.ts` afirmava "16 arquivos aplicados"; o total real é o da lista (`DOWNS_TIP_TO_0003` = 13 + `0003→0002` + `0002→0001` = **15**). Em vez de trocar por outro número que envelhece, o comentário passou a derivar o total de `downFiles.length` (`:858-862`). A asserção do journal (`17`) estava correta e não mudou; `npx tsx scripts/db/test-migrations.ts` rodou verde depois da correção.
- **Três achados do E2 no HEAD integrado, todos corrigidos neste branch** (o E1 não podia vê-los: ele roda no meu worktree, não no HEAD integrado nem com os gates de repo):
  1. `scripts/m02-v2b.mjs` tinha `EXPECTED_JOURNAL_COUNT = 16` com o journal em 17 (2ª ocorrência da classe; a 0015 exigiu `ed29d4b`). Corrigido **estruturalmente**: a constante saiu e `expectedJournalCount()` deriva de `drizzle/meta/_journal.json` (fail-closed com caminho na mensagem; derivado antes de criar a branch de drill). Commit `51a0023`.
  2. `src/test/m02-v2b.test.ts` importava `expectedJournalCount`, mas `scripts/m02-v2b.d.mts` não declarava o export ⇒ `TS2305` no typecheck (o vitest não checa tipos). Corrigido em `b98185b` com a assinatura + JSDoc.
  3. `npm run format:check` reprovava **4 arquivos meus** (o claim, o snapshot gerado de 0016, `test-backfill.ts` e `m02-v2b.mjs`): o `drizzle-kit` não formata o snapshot no padrão do repo e eu não rodei o prettier nos arquivos novos. Corrigido aplicando o prettier (snapshot verificado semanticamente idêntico: `JSON.stringify` igual ao anterior).
- **Um flake meu, encontrado ao re-rodar a suíte depois da formatação:** a asserção de rate-limit de T1 (`7 linhas em janelas de 4 ⇒ 1 espera`) media a janela com **tempo real**, então em host mais lento a 5ª linha chegava depois dos 50 ms e a espera virava 0 — ora passava, ora não. Não relaxei a asserção: o caso com `rateLimit` passou a injetar **relógio virtual** (`now`/`sleep`, como o unit test já fazia), o que a torna **exata** (`esperas=1`, `espera=50ms = windowMs`), e os casos sem janela continuam medindo tempo real. 3 rodadas seguidas verdes depois disso.

## 6. Auto-avaliação de riscos

- **Efeito seguro × checkpoint descartado (T2):** o worker que perde o CAS pode ter aplicado efeitos antes de falhar no `save`. Isso é intencional e seguro (o marcador é por linha e a mesma transação do efeito ⇒ `max(apply_count)=1`, provado), mas o lote inteiro dele é descartado; a próxima tentativa relê e vê `duplicate`. **Não** há retry automático do perdedor — o contrato é falhar explícito (a aceitação pede "conflito explícito", não retry). Se no futuro se quiser orquestração com retry, é decisão de quem opera o runner.
- **Repartição aplicadas/duplicadas no T2 depende da corrida** (nesta captura `10/0`; em outra rodada já foi `1/9`): as asserções são estruturais (`aplicadas + duplicadas = 10`, `lotes = 4`, `lidas = 10`, `versão = 4`), nunca a divisão exata. Um teste que fixasse `aplicadas=10` seria flaky.
- **`version` é monotônica por `runKey` e nunca reinicia:** quem tentar reaproveitar uma linha de checkpoint fora do contrato `save(…)` (ex.: um `UPDATE` manual zerando `version`) trava o run com conflito até a versão bater. É a semântica desejada do CAS, mas exige cuidado operacional documentado no cabeçalho do módulo.
- **Grants do ledger são `SELECT/INSERT/UPDATE`** (sem `DELETE`): não há caminho de aplicação para limpar checkpoints/marcadores; a remoção é por `ON DELETE CASCADE` do tenant ou operação de DBA. Escolha consciente (o ledger é histórico de idempotência; apagar marcador reintroduziria efeito).
- **`applyWorkItemOnce`/`createPostgresCheckpointStore` recebem `tenantId` explicitamente** — sob `app_runtime`, um `tenantId` errado é recusado pela policy (42501), mas o parâmetro não é derivado de contexto de request (é um script operacional, não BFF). Um consumidor futuro que o ligue a request deve passar o tenant do contexto, não entrada de usuário.
- **Migration 0016 é SAFE/aditiva, mas o down descarta o progresso de backfills em curso** — declarado no cabeçalho do down; pós-tráfego o caminho é restore de snapshot (mesmo padrão de 0015).
- **E2 (MAESTRO):** `npm run db:test` completo em container novo e `m02:boundaries`/`m02:matrix:check`. Rodei os dois gates M-02 aqui e ficaram verdes com a nova migration; a regeneração da matrix que o card reserva ao MAESTRO não se mostrou necessária nesta rodada.

## 7. Proposta de `package.json` (aplica o MAESTRO)

**Nenhuma linha nova.** A premissa do card ("`db:test` 13→14 suítes") está desatualizada: `tsx scripts/db/test-backfill.ts` **já** é a 13ª suíte da cadeia em `package.json:61`, incluída por `d96a889 chore(db): wire the backfill suite into db:test (WP-B2 integration)`. Este WP **endurece** a suíte existente (T1–T5, com o T2 de contenção) em vez de acrescentar outra. Se o MAESTRO quiser mesmo 14 suítes, a decisão é dele — não inventei um script novo só para bater a contagem.

## 8. O que explicitamente NÃO foi feito

- **Não** criei consumidor de negócio nem liguei o ledger a nenhuma rota/BFF (o card proíbe; o runner segue genérico e injetável).
- **Não** toquei `scripts/db/test-outbox.ts`, `docker-compose.yml`, o repo principal, `:5432`, `EXECUTION-STATE-PROGRAM.md`, `QUEUE.md`, `PROGRESS.md`, `SUPERVISION-LOG.md` nem `DECISIONS-PENDING/**`.
- **Não** escrevi no ledger/QUEUE/PROGRESS nem no `PLANO_MESTRE`.
- **Não** rodei `npm run db:test` completo, `npm run build`, lint/format de projeto, a suíte vitest inteira nem `npm install` (é do MAESTRO; `node_modules` é symlink). Rodei apenas as suítes do item (§4), as unit tests dos arquivos tocados e os dois gates M-02.
- **Não** relaxei teste/gate para passar: ao contrário, o T5 foi **endurecido** depois que as mutações mostraram que ele não distinguia "policy por tenant" de "RLS sem policy".
- **Não** apliquei a linha do `package.json` (§7) — é do MAESTRO, e não há linha a aplicar.
- **Não** regenerei `m02:matrix`/`m02:boundaries` (reservado ao MAESTRO no merge; verifiquei que estão verdes).
- **Não** mexi em `scripts/db/test-migrations.ts` por gosto: foi o **único** arquivo fora do escopo do card que o item exigiu (§ SPEC-DELTA `SPEC-DELTAS/WP-1a-test-migrations-chain.md`), com precedente idêntico no WP-B1 (`342a188`).
- **Não** rodei `--write` do checker nem gerei `docs/evidence/migration-classification-<data>.md` (é saída de evidência do MAESTRO).

## 9. Rollback

`git revert 1800252` (código + migration + testes) + `drizzle/rollback/0016_to_0015_down.sql` para o DDL; as fixtures de teste são recriadas no próximo run (o ledger, por ser schema-managed, sai pelo down/rollback global). Rollback pós-tráfego: restore de snapshot (o down descarta progresso de backfill).
