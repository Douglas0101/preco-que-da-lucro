# Evidência — TRILHO B · MEM-D4 (delete/export + `ai_memory_access_log` + TTL L1–L5)

- **Item:** MEM-D4 (degrau **D4** da escada §43) · gate §43 "delete/export" + DoD V7 §23.2 ("TTL") + §15.4 (`ai_memory_access_log`)
- **Branch:** `trk-b-mem-d4` · **base:** `648c029` (= `origin/develop`)
- **Worktree:** `.worktree-trk-b` (todo comando com `cwd` explícito)
- **Ambiente:** container efêmero **`trk-b-pg`** (`postgres:17-alpine`, `127.0.0.1:55440`, banco `pqdl_trk_b`), `env -u DATABASE_URL_UNPOOLED` em todo lançamento. `:5432`, Neon, `vercel` e qualquer host remoto **intocados**; `git push` **não** executado; container **removido** ao fim (ver §7).
- **Specs lidas antes da primeira linha:** `H-12.md` (TTL L1–L5 + escopo do `export`, opção **A** aprovada), `SD-C3-12` (`DELETE` do expurgo para `app_runtime` em D4), `MEM-D0-GAP-REPORT.md` §D4 (entrega + aceite a–e), §43 (`PLANO:2181-2191`), §15.4/§23.2 da V7, §27a/§34, `drizzle/0017`, `drizzle/0018`, `scripts/db/test-memory.ts` (padrão das suítes).

## 1. Hipóteses e o que cada uma mediu

| #   | Hipótese                                                                                                                                                                | Medição (raw)                                                      | Resultado  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| H1  | `export` devolve **exatamente** o conjunto do tenant do contexto, com fontes e versões, e **nada** de outro tenant                                                      | `RAW-db-test.txt` → D4/T1 (+ sondas `RAW-red-green-probes.txt`)    | CONFIRMADA |
| H2  | Identidade sem `has_tenant_access` é **negada antes de qualquer consulta**, sem "pacote vazio" (INV-013)                                                                | `RAW-db-test.txt` → D4/T1 (`AUTHORIZATION_ERROR` + RLS = 0 linhas) | CONFIRMADA |
| H3  | Toda `search`/`delete`/`export` grava linha em `ai_memory_access_log` (quem/quando/o quê/resultado), sem `content`, e o delete recusado é auditado                      | `RAW-db-test.txt` → D4/T2, D4/T6                                   | CONFIRMADA |
| H4  | TTL por camada vem da **policy versionada** (não de constante), expiração é **idempotente**, tenant-scoped, e ausência de policy **falha alta** em vez de sucesso vazio | `RAW-db-test.txt` → D4/T3                                          | CONFIRMADA |
| H5  | A migration `0019` é **reproduzível do zero** e o par up→down→up roda **com dado**, com classificação §27a e `sha256` byte a byte                                       | `RAW-db-test.txt` → D4/T4, D4/T5 · `RAW-classify.txt`              | CONFIRMADA |

## 2. RED → GREEN (medido, não afirmado)

- **RED**: worktree `--detach` em `648c029` (mesmo container, banco `pqdl_trk_b_red` do zero) com **apenas** o `scripts/db/test-memory.ts` novo copiado:
  - saída crua em `RAW-red-memory.txt` → `error: relation "ai_memory_access_log" does not exist` (`42P01`, na primeira fixture) · **EXIT=1**.
  - sondas de schema lado a lado em `RAW-red-green-probes.txt`: journal `19` vs `20` · `status_check` sem `expired` vs com `expired` · colunas `layer`/`expires_at` `(nenhuma)` vs `expires_at,layer` · grant `DELETE` em `ai_memory_versions` `false` vs `true` (SD-C3-12) · tabelas da trilha/políticas `(ausente)` vs presentes.
  - segunda medição de RED (mesmo código do pai, banco de trabalho **já migrado até 0019**): `TypeError: memoryRepository.export is not a function` — a API nova do repositório não existe no pai mesmo com o schema presente (`RAW-red-memory-with-schema.txt`, **EXIT=1**).
- **GREEN**: `npm run db:test` completo (14 suítes) no banco recriado do zero → **EXIT=0** (`RAW-db-test.txt`), incluindo `D4/T1…T6`.

## 3. Decisões declaradas (nenhuma silenciada)

1. **Delete = HARD delete (físico).** É a policy já vigente no repositório (D2/D3: `DELETE` físico por id + cascata na proveniência) e o caminho que o **SD-C3-12** pressupõe (conceder `DELETE` a `app_runtime` para o expurgo LGPD). Consequências: **não** existe estado `deleted` em `ai_memories` (a linha não existe para carregá-lo) e o rastro da eliminação é a linha de `ai_memory_access_log`.
2. **Vocabulário de estados estendido só com `expired`** (`active|superseded|expired`). `deleted` fica fora pela razão acima; `rejected` nunca é persistido (a policy de D1 recusa antes da gravação). Escrito no comentário do `CHECK` em `src/db/schema.ts`.
3. **`layer` com default `L2` (episódica)** no `append` sem camada declarada: é a observação de conversa/tool que o write path de hoje produz; `L1` (sessão, 30 d) como default silencioso descartaria memória cedo demais. `L0` (working) **não** é persistido — gravar nessa camada falha alto (`VALIDATION_ERROR`, medido em D4/T3).
4. **TTL como dado versionado** (`ai_memory_policies`, tabela **global**, sem `tenant_id`: retenção é política do sistema §15.1/L5). Valores do H-12 (opção A) entram como **linhas**: L1 30 d · L2 180 d · L3 365 d · L4 `null` (acompanha a entidade referenciada) · L5 `null` (versionada). Nenhum TTL em constante de código nem em SQL de consulta; o backend lê `max(version)` por camada. Publicar política nova é `INSERT` (grant `INSERT`, sem `UPDATE`/`DELETE` — reverter é republicar). **Interpretação declarada:** o seed da migration é o registro inicial das linhas (a alternativa seria não ter policy alguma, o que faria todo append falhar).
5. **L4 sem TTL de relógio**: a validade de L4 "acompanha a entidade referenciada", e a referência já cai por `ON DELETE cascade` na proveniência (`ai_memory_sources`); o TTL de L4 fica `null` por decisão, não por omissão (distinto de L5, versionada).
6. **Expirar é transição de estado, não exclusão**: `expireDue` passa a `expired` (a linha continua auditável e exportável); a eliminação física é `delete` (com `purgeHistory` quando há histórico). O expirador **não** grava linha na trilha (as ações auditadas do §15.4/D4 são `access`/`delete`/`export`; o `CHECK` fecha o vocabulário — medido em D4/T6).
7. **`search` respeita a validade** (`expires_at` nulo ou futuro) além do expirador: defesa em profundidade para a janela entre o vencimento e a passada do expirador.
8. **`ai_memory_access_log` sem FK para `ai_memories`**: a trilha tem de sobreviver ao delete que ela audita (cascata apagaria o rastro; `RESTRICT` impediria o delete). Âncora de tenant = FK composta para `tenant_memberships`, no molde de `audit_events` (`ON DELETE restrict`), com `...tenantIdentity` e RLS `tenant_isolation` (`USING`+`WITH CHECK`).
9. **Trilha append-only por privilégio** (`SELECT`+`INSERT`; sem `UPDATE`/`DELETE`) — medido com negação real (`42501`) sob `app_runtime`.
10. **Colunas do log**: `id, tenant_id, user_id, action, memory_id, result, row_count, created_at` — **sem** `content` e **sem** o texto da consulta (o log não é superfície de dado pessoal). O conjunto exato de colunas é asserido em D4/T6.
11. **`export` é tenant-wide por padrão** (todas as camadas e **todos os estados**, inclusive `expired` — portabilidade LGPD) com recorte opcional por `scopes`/`layers`. Sem FK de papéis/roles no repositório: a autoridade é `app_private.has_tenant_access` (checada **antes** de qualquer consulta) + RLS em todas as consultas (INV-008).
12. **Autorização do delete por escopo** (§43 aceite e): memória `scope='user'` de outro autor só cai com `app_private.has_tenant_owner_access` — o mesmo predicado do banco é repetido na cláusula `WHERE` do `DELETE` (sem janela TOCTOU entre a checagem auditada e a remoção). Memória de escopo do tenant continua apagável por membro (medido como controle).
13. **`revise` não recalcula `expires_at`**: a janela é do nascimento da linha; prorrogar por revisão não está no card (declarado como não-implementado).
14. **Arquivos de integração fora do escopo exclusivo** (precedente SD-C3-13, ratificado no ciclo 3): `scripts/db/test-migrations.ts` (lista de downs + contagem do journal 19→20), `scripts/db/purge-fixtures.ts` (ordem de expurgo: trilha antes de `tenant_memberships`) e `drizzle/rollback/0001_to_0000_down.sql` (DROP global do teardown). Nenhum `package.json` tocado; `docs/specs/M-02/**` intocado.

## 4. O que **não** foi feito (resíduos declarados)

- **Delete por escopo/usuário em massa**: o card exige delete por id (idempotente, tenant-scoped, auditado) e o gap report citava também "delete por escopo". Não implementado: um expurgo em massa é mutação de dado pessoal e precisa de superfície/política próprias (fora do escopo de arquivo desta trilha). Resíduo: `deleteByScope` para D5/D7.
- **Superfície server-side autorizada** (server action / route handler) do gap report D4: fora do escopo exclusivo desta trilha (a rota pertence ao trilho de app); o port está pronto para ser consumido por ela.
- **`retrieval_score`, `used_in_context`, `conversation_id`** do §15.4: não entraram na trilha — pertencem a D5/D6 (score/consumo de contexto inexistentes hoje). Colunas aditivas depois são trivialmente compatíveis.
- **`seed-auth.ts` (e2e)** não limpa as tabelas de memória (lacuna herdada de D2/D3); a trilha nova adiciona FK `RESTRICT` para `tenant_memberships`, então um e2e que **escrevesse** memória precisaria incluí-la na lista. Nenhum e2e escreve memória hoje (medido: 0 hits de `ai_memory` em `scripts/e2e/`).
- **`m02:matrix:check` acusa drift** (`RAW-boundaries-and-matrix.txt`): esperado — os métodos novos do `MemoryRepository` entram como `transactionSites`. A regeneração é do **MAESTRO no land** (instrução do despacho). `m02:boundaries` = EXIT 0 (limpo).
- **Sem medição de performance** (§29): nenhum `EXPLAIN`/p95 nesta trilha — TTL/export não declaram SLO.
- **`npm run check` / suíte vitest completa / e2e**: não rodados (validação project-wide é do MAESTRO/E2); rodados apenas os alvos do trilho (§5).

## 5. Gates executados (comando exato e resultado)

| gate               | comando                                                                                                                                | resultado                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| banco (alvo)       | `env -u DATABASE_URL_UNPOOLED DATABASE_ADMIN_URL=<trk-b-pg> DATABASE_URL=<idem> npm run db:test`                                       | **EXIT=0** — 14 suítes, incl. `test-migrations` (cadeia 0019 up→down→up) e `test-memory` D2+D3+D4 (`RAW-db-test.txt`)                               |
| classificação §27a | `npx tsx scripts/db/check-migration-classes.ts`                                                                                        | **20/20 classificadas**, EXIT=0 (`RAW-classify.txt`)                                                                                                |
| tipos              | `npx tsc --noEmit`                                                                                                                     | **EXIT=0** (`RAW-static-gates.txt`)                                                                                                                 |
| meta do Drizzle    | `npx prettier --write drizzle/meta/{_journal,0019_snapshot}.json`                                                                      | gerados pelo `db:generate` saem fora do padrão do repo; alinhados para o `format:check` (JSON lido pelo migrator — o hash do Drizzle é o do `.sql`) |
| formatação         | `npx prettier --check .` (repo-wide)                                                                                                   | **All matched files use Prettier code style!** (`RAW-static-gates.txt`)                                                                             |
| unitários afetados | `npx vitest run src/test/{memory-policy,memory-service,memory-import-graph,memory-dedup,migration-classes,m02-purge-fixtures}.test.ts` | **6 arquivos / 74 testes passed** (`RAW-vitest-scoped.txt`)                                                                                         |
| fronteira BFF      | `npm run m02:boundaries`                                                                                                               | **EXIT=0** (limpo)                                                                                                                                  |
| matriz M-02        | `npm run m02:matrix:check`                                                                                                             | **EXIT=1** — drift esperado, regeneração do MAESTRO (`RAW-boundaries-and-matrix.txt`)                                                               |

`npm run build` **não** foi rodado: a trilha não toca módulo de cliente (schema/repository/contratos/migrations/testes de banco).

## 6. Hashes migration ↔ registry (§27a)

- `sha256(drizzle/0019_tiresome_robin_chapel.sql)` = `9d81a7857157191a289b41d798684631434504ebde3e09f30711f83aeb44d663`
- registry `scripts/db/migration-classes.ts` → **mesmo** hash (`RAW-classify.txt`), classe `ONLINE_WITH_CARE` / `appliedOn: empty` / `idempotent: true` / `onlineCare` declarado / rollback `drizzle/rollback/0019_to_0018_down.sql`.
- Down testado **com dados** (D4/T4, `RAW-db-test.txt`): conteúdo preservado, `layer` de volta com default, `expires_at` nula, políticas re-semeadas, trilha recriada vazia.
- Verificação de integridade dos artefatos de evidência: `sha256sum -c manifest.sha256` → **ALL MATCH** (executado; ver `RAW-manifest-check.txt`).

## 7. Ambiente e limpeza

- Container `trk-b-pg` criado para este item e **removido ao fim** (`docker rm -f trk-b-pg`), junto com o worktree temporário de RED (`/tmp/trkb-red`, `git worktree remove --force`) e o banco `pqdl_trk_b_red`.
- **Incidente contido (auto-infligido, corrigido):** a primeira execução de `npm run db:test` falhou com `role "app_runtime" cannot be dropped because some objects depend on it` — o banco de RED (`pqdl_trk_b_red`) ainda existia no container e `test-migrations` derruba a role global. Removido o banco de RED e recriado `pqdl_trk_b` do zero, o `db:test` rodou **EXIT=0** (`RAW-db-test.txt`). Lição: `test-migrations` exige container com **um** banco (o de trabalho).
- Nada foi pushado. `:5432`/Neon/produção intocados (`env -u DATABASE_URL_UNPOOLED` em todo lançamento; `.env` do worktree ausente — nenhum host remoto no ambiente).

## 8. Arquivos da entrega

- `src/db/schema.ts` — `ai_memories.layer`/`expires_at`, `CHECK` de `layer`, vocabulário de status com `expired`, `aiMemoryPolicies`, `aiMemoryAccessLog`.
- `src/server/contracts/memory.contracts.ts` — `MemoryLayer`, `MemoryStatus += expired`, `layer?` no candidato, `MemoryExportFilter/Bundle/Memory`, `MemoryAccessAction/Result/LogEntry/Filter`, port: `export`, `expireDue`, `listAccessLog`.
- `src/server/repositories/memory.repository.ts` — TTL lido da policy, `expires_at` no relógio do banco, retrieval com validade, trilha de auditoria em `search`/`delete`/`export`, delete com autorização de escopo (`has_tenant_owner_access`) repetida no `WHERE`, `export` tenant-scoped com fontes+versões e negação fail-loud, `expireDue` idempotente, `listAccessLog`.
- `drizzle/0019_tiresome_robin_chapel.sql` (+ `drizzle/meta/0019_snapshot.json`, `_journal.json`) — DDL gerado + grants/RLS/seed/SD-C3-12 no cabeçalho manual (padrão de 0017/0018).
- `drizzle/rollback/0019_to_0018_down.sql`, `drizzle/rollback/0001_to_0000_down.sql` (DROP global).
- `scripts/db/migration-classes.ts` (entrada 0019), `scripts/db/test-migrations.ts` (chain), `scripts/db/purge-fixtures.ts` (ordem de expurgo), `scripts/db/test-memory.ts` (D4/T1–T6).
