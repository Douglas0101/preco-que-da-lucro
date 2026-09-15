# CLAIM — 28-backfill

- **wp / squad / branch / commit:** WP-B2 (`28.1` batch · `28.2` checkpoint · `28.3` rate-limit · `28.4` idempotência · `28.5` observabilidade) · SQUAD-DB2 · `mission/b2-backfill` · `b37909c` (código + testes; este claim é o commit seguinte)
- **spec_ref:** Plano Mestre §28 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1863-1871`) · §27 (expand/contract) · SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/28-backfill.md` (lido inteiro antes da primeira linha; nenhum SPEC-DELTA necessário) · INV-009/INV-012
- **status pleiteado (por item, após o veredicto adversarial V-B2):** `28.1` **DONE** (lote configurável, provado no unit e na integração) · `28.2` **PARTIAL** — **mecanismo** de checkpoint provado (persistido, retomável, só avança em lote fechado, sobrevive a `SIGKILL`), mas a **persistência só existe no banco de teste**: `backfill_checkpoints` não está em `drizzle/**` nem em `src/db/schema.ts` (a migration é proposta e pertence ao WP-B1) · `28.3` **DONE** (janela respeitada; tempo injetado no unit e espera real curta na integração) · `28.4` **PARTIAL** — **mecanismo** de idempotência provado ponta a ponta (chave de trabalho derivada da linha + `ON CONFLICT DO NOTHING` na mesma transação do efeito), mas o **marcador** (`backfill_work_items`) vive só no banco de teste pela mesma razão do `28.2` · `28.5` **DONE** (eventos por lote com linhas/taxa/erros/checkpoint + resumo do run). T1–T4 rodaram de fato, com integração real em PG17 (saída colada abaixo). Limites e residuais declarados no fim.
- **cadeia SDD:**
  1. **SPEC-CARD:** lido antes de qualquer linha. O card arbitra o escopo de arquivos: `scripts/db/backfill-runner.ts` (novo) · `scripts/db/backfill-*.ts` (caso de uso/teste) · `src/test/backfill-runner.test.ts` (novo), com `package.json`, `drizzle/**`, `scripts/db/migration-classes.ts` e `src/db/schema.ts` reservados ao WP-B1. Nada fora do escopo foi tocado (o ledger usa DDL idempotente próprio do script de teste, ver "propostas de integração").
  2. **TEST-FIRST:** `src/test/backfill-runner.test.ts` escrito antes da implementação. Prova da falha inicial (ausência do runner, não bug):
     ```text
     $ npx vitest run src/test/backfill-runner.test.ts
      FAIL  src/test/backfill-runner.test.ts [ src/test/backfill-runner.test.ts ]
     Error: Failed to resolve import "../../scripts/db/backfill-runner" from "src/test/backfill-runner.test.ts". Does the file exist?
       Plugin: vite:import-analysis
      Test Files  1 failed (1)
           Tests  no tests
     EXIT=1
     ```
  3. **IMPLEMENT:**
     - `scripts/db/backfill-runner.ts:164` `createBackfillRunner` — runner **puro** (nada conhece tabela/coluna/domínio) com três portas injetadas: `BackfillSource<T>.fetchChunk` (`:39`, keyset por cursor opaco — quem compara é a fonte/SQL), `BackfillSink<T>.apply` (`:55`, efeito de UMA linha, idempotente para a `workKey`) e `BackfillCheckpointStore` (`:70`). Contratos em `:33-148`; validação de `batchSize`/`workKey`/`rateLimit` falha alto (`:166-186`).
     - **Lote + checkpoint** (`:218` `run`, `:273` `commitBatch`): `batchSize` configurável; o checkpoint é persistido **em lote fechado** (o cursor só anda depois que o lote inteiro foi aplicado). Consequência projetada e provada: interrupção no meio do lote (falha de linha, crash, `SIGKILL`) deixa o cursor no lote anterior e a retomada relê o lote inteiro; o efeito já aplicado volta `duplicate` (at-least-once + efeito idempotente ⇒ nunca duplica).
     - **Rate-limit** (`:201` `acquireRateLimitSlot`, opções `:80`): no máximo `maxRows` linhas por janela de `windowMs`; `now`/`sleep` injetáveis (`:144-145`), logo o teste prova a janela com relógio virtual e **sem espera real**.
     - **Idempotência:** a chave de trabalho é **derivada da linha** — `<workKey>#<rowKey>` (`:337`) — e não da tentativa; `runKey` identifica só o checkpoint/log. Quem aplica o efeito usa `applyWorkItemOnce` (`scripts/db/backfill-ledger.ts:131`): `INSERT … ON CONFLICT (work_key) DO NOTHING RETURNING` + efeito na **mesma transação**, `duplicate` quando já marcado. `BackfillAbortedError` (`backfill-runner.ts:153`) carrega o resumo; `onRowError: "abort" | "skip"` (`:142`) com o default abortando e preservando o checkpoint (`:351`).
     - **Observabilidade** (`:103` `BackfillProgressEvent`, `:113` `BackfillRunSummary`): um evento por lote com linhas do lote, contadores acumulados da tentativa, taxa (`rowsPerSecond`, piso de 1 ms para não virar `Infinity`), erros, cursor, `completed` e o **checkpoint corrente**; o resumo final traz lotes, lidas/aplicadas/duplicadas/erros, esperas de rate-limit, duração, taxa e o checkpoint persistido.
     - `scripts/db/backfill-ledger.ts:29` `BACKFILL_LEDGER_DDL` (`backfill_checkpoints` + `backfill_work_items`, PK na work-key + índice por tentativa) · `:56` `createPostgresCheckpointStore` (upsert do checkpoint) · `:131` `applyWorkItemOnce`.
     - `scripts/db/test-backfill.ts` — integração real: fixture própria `backfill_demo_rows` (`:52`), fonte keyset (`:94`), sink transacional com o marcador (`:110`), impressão de progresso (`:139`) e de estado lido do banco (`:228`), fase de erro real do servidor + retomada (`:257`), fase de `SIGKILL` de verdade no processo filho + retomada + 2ª tentativa (`:302`), `--phase=crash` (`:237`) e `--phase=teardown` (`:399`).
  4. **EVIDENCE:** container efêmero PG17 próprio (`docker run … -p 5434:5432 postgres:17-alpine`, PostgreSQL 17.11) rodando a **cadeia real de migrations do repo** (16 migrations, 32 tabelas públicas, `expenses` presente — nenhuma tabela real alterada) e saídas reais coladas abaixo. O tipo dos arquivos novos passa em `tsc --strict` (`TSC_EXIT=0`).
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)
- **limites declarados (o que NÃO foi executado):**
  - **Dados sintéticos, sem volume real:** a coluna derivada é de uma fixture criada pelo próprio script (`backfill_demo_rows`); **nenhuma** tabela do schema real foi alterada e **nenhum** backfill de produção foi rodado (não existe volume real, como o card registra). O que está provado é o **mecanismo** (lote/checkpoint/rate-limit/idempotência/observabilidade), com um caso sintético de ponta a ponta.
  - **Porta 5433 indisponível:** o container `pqdl-integ` de outro squad já ocupava `5433` durante toda a execução, então usei `5434` com o nome exclusivo `pqdl-b2-backfill` (removido ao fim). `:5432` nunca foi usado (`preco_que_da_lucro_test` com 0 conexões antes/depois).
  - **Tabelas do ledger fora do schema:** `backfill_checkpoints`/`backfill_work_items` são criadas por `CREATE TABLE IF NOT EXISTS` do script de teste, **não** por migration (schema é do WP-B1 — o card proíbe eu criar migration). Levar o ledger a produção exige a migration proposta abaixo; até lá ele é infraestrutura de teste.
  - **`package.json` não editado:** a linha `db:test` é do WP-B1/MAESTRO (proposta abaixo). Rodei só os meus testes (`npx vitest run src/test/backfill-runner.test.ts` e o script tsx do caso de uso) + `tsc` escopado nos meus arquivos; **não** rodei a suíte completa, `npm run build`, `db:test` encadeado nem lint/format de projeto.
  - **`onProgress` não tem consumidor de produção:** o runner emite eventos estruturados por callback; ligar isso a log/métrica (e escolher o runner real de cron) é do item que compuser o primeiro backfill de verdade.
  - **Contadores com semântica explícita:** o resumo conta a **tentativa** (`rowsScanned` desta execução, taxa por segundo honesta); o **acumulado** vive no checkpoint. Num crash no meio do lote a linha aplicada conta como `duplicate` na retomada (por isso `attempt-1` fecha com `rows_applied=9`/`rows_duplicate=1` para 10 efeitos) — a verdade do efeito é o marcador (`backfill_work_items`), que fecha em 10/10 com `apply_count=1` em cada linha.
- **residuais declarados (V-B2):**
  - **(a) Ledger fora do schema/migrations.** `backfill_checkpoints` e `backfill_work_items` são criadas por `CREATE TABLE IF NOT EXISTS` dentro do script de teste (`scripts/db/backfill-ledger.ts:29`), **não** por migration: `grep backfill drizzle/**` ⇒ 0 e `src/db/schema.ts` sem `backfill`. É a causa direta do rebaixamento de `28.2`/`28.4` para **PARTIAL**: o **mecanismo** está provado (retomada após `SIGKILL`, retomada após 22012, 2ª tentativa sem reaplicar, `apply_count=1` em 10/10), mas a **persistência durável** só existe no banco de teste. Follow-up (escopo do WP-B1, proposta já registrada): migration com `BACKFILL_LEDGER_DDL` + classificação em `scripts/db/migration-classes.ts` + down.
  - **(b) Concorrência: efeito seguro, checkpoint _last-write-wins_ sem CAS (achado do verificador V-B2, não declarado por mim antes).** Com **dois runners concorrentes**, o **efeito** permanece seguro (o verificador observou `max(apply_count)=1`, 12/12 linhas derivadas, distintas, sem reaplicação) porque quem arbitra é a PK do marcador (`ON CONFLICT (work_key) DO NOTHING`). O **checkpoint**, porém, não tem arbitragem: `save` é um upsert simples por `run_key` (`scripts/db/backfill-ledger.ts:56`) e o runner não serializa tentativas que compartilham o mesmo `runKey` ⇒ _last-write-wins_. O verificador observou contadores **inflados** (`lotes=5` para 4 lotes de cada runner) e um run mais lento pode reescrever cursor/contadores; os números convergem para o estado final, mas os metadados de progresso de tentativas concorrentes não são confiáveis. **Não estava no card e eu não testei concorrência** (meu desenho assume `runKey` = uma tentativa). Follow-up se concorrência no mesmo `runKey` for necessária: CAS no upsert (coluna de versão / `where excluded.updated_at > …`) ou lock/lease por `runKey` — o ledger de efeito já está pronto para múltiplos runners.
- **divergências do §28 (nenhuma SPEC-DELTA):** o plano pede batch/checkpoint/rate-limit/idempotência/observabilidade sem detalhar API; o card fixa o contrato de "chunk source injetável" e foi seguido (runner puro + fonte/sink/checkpoint injetáveis, testável sem banco). Não há divergência de coluna/tabela a registrar.
- **propostas de integração (aplica o MAESTRO):**
  - `package.json` — acrescentar `&& tsx scripts/db/test-backfill.ts` ao **final** da linha `db:test` (o script reseta as próprias fixtures no início, então roda tanto isolado quanto encadeado).
  - Migration do ledger (WP-B1): `drizzle/00XX_*.sql` com `BACKFILL_LEDGER_DDL` (`scripts/db/backfill-ledger.ts:29`) + classificação em `scripts/db/migration-classes.ts` + down, se o MAESTRO quiser o ledger disponível fora do banco de teste.
  - Primeiro consumidor real: escolher o backfill alvo (o candidato natural é uma coluna derivada de `products`/`expenses`) e compor `createBackfillRunner` com um `sink` que use o marcador do ledger e um `onProgress` ligado ao logger — o runner já aceita isso sem mudança.
- **rollback:** `git revert b37909c` (tudo é aditivo; nenhuma migration, nenhum DDL em produção, nenhuma linha do `package.json`).

## EVIDENCE (comando + saída real, não resumida)

### 1. Contrato puro — T1–T4 (`npx vitest run src/test/backfill-runner.test.ts`)

```text
$ npx vitest run src/test/backfill-runner.test.ts
 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-mB2

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  02:27:10
   Duration  748ms (transform 57ms, setup 91ms, import 45ms, tests 9ms, environment 497ms)

$ npx tsc --noEmit --skipLibCheck --strict --target es2022 --module esnext --moduleResolution bundler \
    --types node --lib es2022,dom scripts/db/backfill-runner.ts scripts/db/backfill-ledger.ts \
    scripts/db/test-backfill.ts src/test/backfill-runner.test.ts
TSC_EXIT=0
```

Cobertura por teste (`src/test/backfill-runner.test.ts`): `T1` (`:100`) 10 linhas/batchSize 3 com falha simulada em `r05` ⇒ aborta com `checkpoint.cursor="r03"`, 4 efeitos gravados, e a retomada relê o lote (`fetches2[0].cursor="r03"`), conta **1 duplicata** e termina com **1 gravação por linha** (`[1,1,1,1,1,1,1,1,1,1]`); `T2` (`:158`) 9 linhas, 4 por janela de 1000 ms ⇒ `sleeps=[1000,1000]`, `rateLimitWaits=2`, `durationMs=2000`, `rowsPerSecond=4.5` e **<250 ms de tempo real**; `T3` (`:189`) 2ª tentativa com checkpoint novo ⇒ `rowsApplied=0`/`rowsDuplicate=10` e estado idêntico, e a repetição da mesma tentativa concluída ⇒ 0 `fetchChunk`; `T4` (`:249`) eventos `["batch","batch","batch","completed"]` com `rows=[2,2,2,0]`, `rowsScanned=[2,4,6,6]`, `cursor=["r02","r04","r06","r06"]`, `checkpoint.completed=[false,false,false,true]` e `events.at(-1).checkpoint === summary.checkpoint`; validação (`:293`) `batchSize`/`workKey`/`rateLimit` inválidos falham alto.

### 2. Integração real no container efêmero PG17 (fixture sintética, 16 migrations do repo aplicadas)

```text
$ docker run -d --name pqdl-b2-backfill -e POSTGRES_DB=preco_que_da_lucro_test -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:17-alpine
$ export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5434/preco_que_da_lucro_test \
    DATABASE_URL_UNPOOLED=… DATABASE_ADMIN_URL=… DATABASE_DRIVER=node-postgres
$ npx tsx scripts/db/test-backfill.ts
== T1/T4 — erro real do Postgres (22012) no meio do lote: aborta, checkpoint no lote anterior, retoma ==
  estado (antes): linhas=4 derivadas=0 max_apply_count=0 linhas_duplicadas=0 marcadores=0 checkpoint=ausente
    [batch lote 1] linhas=2 lidas=2 aplicadas=2 duplicadas=0 erros=0 cursor=d02 taxa=181.8/s checkpoint=em curso
  abortado: lotes=2 lidas=4 aplicadas=3 duplicadas=0 erros=1 taxa=235.3/s esperas=0(0ms) checkpoint=d02/em curso retomada=false duração=17ms
  estado (após o abort): linhas=4 derivadas=3 max_apply_count=1 linhas_duplicadas=0 marcadores=3 checkpoint=d02/lotes=1/lidas=2/aplicadas=2/dup=0/erros=0/em curso
    [batch lote 1] linhas=2 lidas=2 aplicadas=1 duplicadas=1 erros=0 cursor=d04 taxa=333.3/s checkpoint=em curso
    [completed lote 1] linhas=0 lidas=2 aplicadas=1 duplicadas=1 erros=0 cursor=d04 taxa=250.0/s checkpoint=concluído
  retomada: lotes=1 lidas=2 aplicadas=1 duplicadas=1 erros=0 taxa=250.0/s esperas=0(0ms) checkpoint=d04/concluído retomada=true duração=8ms
  estado (final): linhas=4 derivadas=4 max_apply_count=1 linhas_duplicadas=0 marcadores=4 checkpoint=d04/lotes=3/lidas=4/aplicadas=3/dup=1/erros=0/concluído

== T1/T2 — SIGKILL no meio do run (10 linhas, batchSize=3, rate-limit 4/50ms) ==
  estado (antes): linhas=10 derivadas=0 max_apply_count=0 linhas_duplicadas=0 marcadores=0 checkpoint=ausente
  [filho] run backfill-demo:attempt-1 batchSize=3 · SIGKILL após processar a linha 4
    [batch lote 1] linhas=3 lidas=3 aplicadas=3 duplicadas=0 erros=0 cursor=d03 taxa=107.1/s checkpoint=em curso
  [pai] filho: status=null signal=SIGKILL (morte real no meio do run)
  estado (após o SIGKILL): linhas=10 derivadas=4 max_apply_count=1 linhas_duplicadas=0 marcadores=4 checkpoint=d03/lotes=1/lidas=3/aplicadas=3/dup=0/erros=0/em curso
  -- retomada (mesmo runKey) --
    [batch lote 1] linhas=3 lidas=3 aplicadas=2 duplicadas=1 erros=0 cursor=d06 taxa=333.3/s checkpoint=em curso
    [batch lote 2] linhas=3 lidas=6 aplicadas=5 duplicadas=1 erros=0 cursor=d09 taxa=100.0/s checkpoint=em curso
    [completed lote 3] linhas=1 lidas=7 aplicadas=6 duplicadas=1 erros=0 cursor=d10 taxa=107.7/s checkpoint=concluído
  retomada: lotes=3 lidas=7 aplicadas=6 duplicadas=1 erros=0 taxa=107.7/s esperas=1(37ms) checkpoint=d10/concluído retomada=true duração=65ms
  estado (após a retomada): linhas=10 derivadas=10 max_apply_count=1 linhas_duplicadas=0 marcadores=10 checkpoint=d10/lotes=4/lidas=10/aplicadas=9/dup=1/erros=0/concluído
  -- 2ª tentativa completa (checkpoint novo, mesma workKey) --
    [batch lote 1] linhas=3 lidas=3 aplicadas=0 duplicadas=3 erros=0 cursor=d03 taxa=428.6/s checkpoint=em curso
    [batch lote 2] linhas=3 lidas=6 aplicadas=0 duplicadas=6 erros=0 cursor=d06 taxa=105.3/s checkpoint=em curso
    [batch lote 3] linhas=3 lidas=9 aplicadas=0 duplicadas=9 erros=0 cursor=d09 taxa=83.3/s checkpoint=em curso
    [completed lote 4] linhas=1 lidas=10 aplicadas=0 duplicadas=10 erros=0 cursor=d10 taxa=88.5/s checkpoint=concluído
  2ª tentativa: lotes=4 lidas=10 aplicadas=0 duplicadas=10 erros=0 taxa=88.5/s esperas=2(85ms) checkpoint=d10/concluído retomada=false duração=113ms
  estado (após a 2ª tentativa): linhas=10 derivadas=10 max_apply_count=1 linhas_duplicadas=0 marcadores=10 checkpoint=d10/lotes=4/lidas=10/aplicadas=0/dup=10/erros=0/concluído

Backfill §28 (28.1 lote · 28.2 checkpoint · 28.3 rate-limit · 28.4 idempotência · 28.5 observabilidade): OK
EXIT=0
```

> Nota de revisão: a saída acima é do run da revisão `b37909c`. Depois dela o
> `prettier --write` do repo (`printWidth: 100`) reformatou 3 dos 5 arquivos
> (espaçamento/quebra de linha, sem mudança de semântica) e o caso completo foi
> reexecutado no mesmo tipo de container efêmero: `INTEG_EXIT=0` com a mesma
> linha final `Backfill §28 (…): OK`, unit `5 passed` e `tsc --strict` limpo na
> revisão formatada. `prettier --check` nos 5 arquivos ⇒ `All matched files use
Prettier code style!`.

Leitura dos números (prova de retomada, linhas por lote antes/depois):

- **erro real do servidor (22012) em `d04`:** o lote 1 fecha (2 aplicadas), `d03` é aplicado e `d04` explode ⇒ lote 2 **não** fecha: `abortado: lotes=2 lidas=4 aplicadas=3 erros=1 checkpoint=d02`. O script consulta o banco e assevera (`test-backfill.ts:280-283`) `derivadas=3`, `marcadores=3` e **zero** marcador para a linha que falhou (`select count(*) from backfill_work_items where row_key = 'd04'` ⇒ 0) — marcador e efeito caem na mesma transação. Depois de limpar o veneno: `retomada: lidas=2 aplicadas=1 duplicadas=1` (`d03` volta como duplicata) e o estado final fecha `derivadas=4 max_apply_count=1`.
- **`SIGKILL` de verdade:** o filho morre no meio do run (`status=null signal=SIGKILL`); o efeito de `d04` está commitado (`derivadas=4 marcadores=4`) mas o checkpoint atrasou (`checkpoint=d03`). A retomada relê o lote interrompido: `lidas=7 aplicadas=6 duplicadas=1` — **antes** 4 linhas aplicadas / **depois** 10, com `max_apply_count=1` (nenhuma linha aplicada 2×).
- **rate-limit em produção de verdade:** 7 linhas em janelas de 4 ⇒ `esperas=1(37ms)` na retomada e `esperas=2(85ms)` na 2ª tentativa (espera real, curta, medida pelo relógio do sistema — a janela é do runner, não do teste).
- **idempotência:** 2ª tentativa completa (checkpoint novo, mesma `workKey`) ⇒ `aplicadas=0 duplicadas=10` e o estado não muda.

### 3. Estado persistido lido direto do banco (depois do run acima)

```text
$ docker exec pqdl-b2-backfill psql -U postgres -d preco_que_da_lucro_test \
    -c "select id, amount, derived_amount, apply_count, poison from backfill_demo_rows order by id;" \
    -c "select run_key, cursor, completed, batches, rows_scanned, rows_applied, rows_duplicate, errors from backfill_checkpoints order by run_key;"
 id  | amount | derived_amount | apply_count | poison
-----+--------+----------------+-------------+--------
 d01 | 110.00 |         132.00 |           1 | f
 d02 | 120.00 |         144.00 |           1 | f
 d03 | 130.00 |         156.00 |           1 | f
 d04 | 140.00 |         168.00 |           1 | f
 d05 | 150.00 |         180.00 |           1 | f
 d06 | 160.00 |         192.00 |           1 | f
 d07 | 170.00 |         204.00 |           1 | f
 d08 | 180.00 |         216.00 |           1 | f
 d09 | 190.00 |         228.00 |           1 | f
 d10 | 200.00 |         240.00 |           1 | f
(10 rows)

         run_key         | cursor | completed | batches | rows_scanned | rows_applied | rows_duplicate | errors
-------------------------+--------+-----------+---------+--------------+--------------+----------------+--------
 backfill-demo:attempt-1 | d10    | t         |       4 |           10 |            9 |              1 |      0
 backfill-demo:attempt-2 | d10    | t         |       4 |           10 |            0 |             10 |      0
(2 rows)

$ docker exec pqdl-b2-backfill psql -U postgres -d preco_que_da_lucro_test -t \
    -c "select 'fixture: ' || count(*) || ' linhas, derivadas=' || count(derived_amount) || ', max_apply_count=' || max(apply_count) || ', duplicadas=' || count(*) filter (where apply_count > 1) from backfill_demo_rows;" \
    -c "select 'marcadores=' || count(*) from backfill_work_items;" \
    -c "select 'migrations=' || count(*) from drizzle.__drizzle_migrations;"
 fixture: 10 linhas, derivadas=10, max_apply_count=1, duplicadas=0
 marcadores=10
 migrations=16

# nenhuma linha derivada errada (a coluna é round(amount*1.2, 2)):
$ docker exec pqdl-b2-backfill psql -U postgres -d preco_que_da_lucro_test \
    -c "select count(*) as derivadas_erradas from backfill_demo_rows where derived_amount is distinct from round(amount*1.2,2);"
 derivadas_erradas
-------------------
                 0
```

O caso roda sobre a cadeia real de migrations do repo (não um banco vazio): `migrations=16`, 32 tabelas em `public`, `to_regclass('public.expenses')` presente ao lado do ledger.

### 4. Autoverificação adversarial do squad (mutações — o verificador deve reconferir do zero)

Cada mutação foi aplicada ao código **commitado** e revertida em seguida (`git status` limpo depois de todas):

| mutação aplicada                                                                                                                    | teste que falhou (mensagem real)                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backfill-ledger.ts`: `ON CONFLICT (work_key) DO NOTHING` → `DO UPDATE SET run_key = excluded.run_key` (marcador deixa de arbitrar) | integração: `retomada: lotes=1 lidas=2 aplicadas=2 duplicadas=0 … checkpoint=d04/concluído` (o correto é `aplicadas=1 duplicadas=1`) ⇒ `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 0 !== 1` |
| `backfill-runner.ts`: checkpoint avança no lote interrompido (`cursor = rowKey; await commitBatch(0,false)` antes de abortar)       | `T1`: `AssertionError: expected 2 to be 1` (o cursor pularia a linha que falhou)                                                                                                                                       |
| `backfill-runner.ts`: rate-limit sem janela (`if (false)`)                                                                          | `T2`: `AssertionError: expected [] to deeply equal [ 1000, 1000 ]`                                                                                                                                                     |
| `backfill-runner.ts`: workKey derivada da **tentativa** (`${workKey}#${runKey}#${rowKey}`)                                          | `T3`: `AssertionError: expected 10 to be +0` (a 2ª passada reaplicaria tudo)                                                                                                                                           |

### 5. Escopo, containers e higiene

```text
$ git show --stat --format="" b37909c
 scripts/db/backfill-ledger.ts    | 158 +++++++++++++++
 scripts/db/backfill-runner.ts    | 369 +++++++++++++++++++++++++++++++++++
 scripts/db/test-backfill.ts      | 406 +++++++++++++++++++++++++++++++++++++++
 src/test/backfill-runner.test.ts | 315 ++++++++++++++++++++++++++++++++
 4 files changed, 1248 insertions(+)

$ docker ps --format '{{.Names}}\t{{.Ports}}'          # durante a execução
pqdl-b2-backfill	0.0.0.0:5434->5432/tcp, [::]:5434->5432/tcp
pqdl-integ	0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp

$ npx tsx scripts/db/test-backfill.ts --phase=teardown
Fixtures do backfill removidas.
$ docker exec pqdl-b2-backfill psql -U postgres -d preco_que_da_lucro_test \
    -c "select to_regclass('public.backfill_checkpoints') as ledger, to_regclass('public.backfill_demo_rows') as fixture;"
 ledger | fixture
--------+---------
        |
(1 row)

$ docker rm -f pqdl-b2-backfill
pqdl-b2-backfill
$ docker ps --format '{{.Names}}\t{{.Ports}}'          # depois: :5432 intocado, nada meu sobrou
pqdl-integ	0.0.0.0:5433->5432/tcp, [::]:5433->5432/tcp
preco-que-da-lucro-postgres	0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp

$ docker exec preco-que-da-lucro-postgres psql -U postgres -c "select datname, numbackends from pg_stat_database where datname is not null order by datname;"
         datname         | numbackends
-------------------------+-------------
 postgres                |           1   # ← a própria conexão deste comando
 preco_que_da_lucro_test |           0
 template0               |           0
 template1               |           0
```

Nenhum arquivo do WP-B1 aparece no diff (`package.json`, `drizzle/**`, `scripts/db/migration-classes.ts`, `src/db/schema.ts`, `scripts/db/test-migrations.ts` intocados — o commit toca exatamente os quatro arquivos do escopo do card). `EXECUTION-STATE-PROGRAM.md`, `docs/evidence/agent-state/{QUEUE.md,PROGRESS.md}` e arquivos de outros worktrees/repo principal não foram tocados.

## ADVERSARIAL (preenchido pelo verificador designado)

- **verificador:** V-B2 (fresh, read-only)
- **veredicto:** **CONFIRMED** — batch (4 execuções reais), rate-limit (relógio virtual + sonda real 551ms/621ms), observabilidade (T4), retomada após SIGKILL×2 e erro 22012 sem pular nem replicar (`max_apply_count=1`), 4 mutações mortas. Achado declarado: contadores de checkpoint last-write-wins sob runners concorrentes (efeito permanece seguro).
- **status recomendado:** 28.1 DONE · 28.2 PARTIAL · 28.3 DONE · 28.4 PARTIAL · 28.5 DONE

## LEDGER (preenchido pelo MAESTRO)

- **promoção:** 28.1 NS → DONE · 28.2 NS → PARTIAL · 28.3 NS → DONE · 28.4 PARTIAL → PARTIAL · 28.5 PARTIAL → DONE
- **integração:** I-M6 · merge `0235084` (+ wiring `db:test` em `d96a889`)
- **placar após a integração:** 83,16% → 84,76%
- **nota:** ver `docs/evidence/agent-state/SPEC-DELTAS/DECISOES-STEWARD-2026-09-15.md` para as interpretações ratificadas.
