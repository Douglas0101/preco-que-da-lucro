# CLAIM — MEM-D4 (degrau D4 da escada §43)

- **wp / squad / branch / commit:** MEM-D4 · SQUAD-MEM (`TrkB`) · branch **`trk-b-mem-d4`** · base `648c029` (= `origin/develop`) · entrega em `docs/evidence/trk-b-mem-d4-2026-09-17/` · **SHA do commit desta entrega: no rodapé (§Commit).**
- **spec_ref:** §43 (`PLANO:2181-2191`, gate "delete/export") · V7 §15.4 (`ai_memory_access_log`) e §23.2 (DoD "TTL" da área Memória) · **H-12 aprovado** (`DECISIONS-PENDING/H-12.md`, opção A: TTL L1–L5 + escopo do `export` + L0 não persistido) · **SD-C3-12** (`DECISOES-STEWARD-CICLO-3-POS-E1.md`: `DELETE` do expurgo para `app_runtime` em D4) · `MEM-D0-GAP-REPORT.md` §D4 (entrega e aceite a–e) · §27a (classificação) · §34/INV-008/INV-010/INV-012/INV-013
- **status pleiteado:** **DONE** (degrau D4). Sem auto-aprovação: o veredicto é do ADVERSARIAL.
- **worktree/container:** `.worktree-trk-b` (branch `trk-b-mem-d4`, `cwd` explícito em todo comando) · container efêmero **`trk-b-pg`** (`postgres:17-alpine`, `127.0.0.1:55440`, banco `pqdl_trk_b`) **removido na limpeza** · `env -u DATABASE_URL_UNPOOLED` em todo lançamento · `:5432`/Neon/`vercel`/host remoto **intocados** · **nada pushado** · `package.json`/`package-lock.json` intocados · `docs/specs/M-02/**` intocado.

## 1. Cadeia SDD (o que foi feito, em que ordem)

1. **SPEC (S1):** leitura integral de H-12, SD-C3-12, gap report §D4, §43, §15.4/§23.2, `drizzle/0017`/`0018`, `scripts/db/test-memory.ts` e `migration-classes.ts` (padrões de grants/RLS/classificação) antes da primeira linha.
2. **BUILD (S3):** schema + contratos + repositório + migration **gerada** (`npm run db:generate` → `0019_tiresome_robin_chapel`) com o bloco manual de grants/RLS/seed (molde 0017/0018) + down + registry + arquivos de integração + testes D4/T1–T6.
3. **MEDIÇÃO (S4/S5):** `db:test` completo (14 suítes) no banco recriado do zero · RED medido no pai (`648c029`) em dois eixos.
4. **DEFEITOS PRÓPRIOS CORRIGIDOS NA MEDIÇÃO (declarados, nenhum silenciado):**
   - `delete` do owner sobre memória pessoal de terceiro devolvia `false`: o predicado de autorização repetido no `WHERE` estava invertido. Corrigido para o **mesmo** predicado do banco (`has_tenant_owner_access`) — achado pela **própria suíte nova** (D4/T2) antes de qualquer entrega.
   - `STATUS_BY_VALUE` do repositório não conhecia `expired` → o `export` de uma linha expirada estourava `DATABASE_ERROR`. Achado por D4/T3; corrigido.
   - `MemoryAccessAction` faltando no import de tipos (o `tsc` pegou; o vitest não pegaria).
   - Teste D4/T3 mutava a política global sem repor a versão publicada (não reexecutável) → limpeza de `version > 1` no início do caso.
   - Expectativa do meu próprio teste D4/T2 estava errada (esperava uma chamada de delete que não existia) → corrigida a expectativa, não o código.
5. **EVIDÊNCIA (S5):** `docs/evidence/trk-b-mem-d4-2026-09-17/` com `README.md` (hipótese → medição → resultado), 10 capturas cruas seladas e `manifest.sha256` (`sha256sum -c` = **ALL MATCH**, `RAW-manifest-check.txt`).
6. **ADVERSARIAL (S6):** (vazio — é do verificador designado pelo MAESTRO.)
7. **LEDGER (S7):** (vazio — exclusivo do ESCRIVÃO/MAESTRO; não escrevi em `EXECUTION-STATE-PROGRAM.md`/`PROGRESS.md`.)

## 2. O que foi medido (comando + saída crua)

**GREEN — alvo do trilho, banco recriado do zero (`RAW-db-test.txt`):**

```text
$ env -u DATABASE_URL_UNPOOLED DATABASE_ADMIN_URL=<trk-b-pg> DATABASE_URL=<idem> npm run db:test
✔ 20/20 classificadas
… test-migrations: PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK
… test-outbox / test-backfill / test-concurrency / … : OK
T1 isolamento: busca de B = 0 linhas sob RLS + append forjado recusado por WITH CHECK (42501): OK
T4 delete: só o tenant corrente apaga, cascata na fonte, false para id inexistente e de terceiro: OK
D3/T7 imutabilidade: UPDATE negado (42501) e DELETE concedido com alcance limitado por RLS em ai_memory_versions + grants/RLS: OK
D4/T1 export: conjunto exato do tenant com fontes+versões, recortes por camada/escopo e AUTHORIZATION_ERROR sem has_tenant_access: OK
D4/T2 auditoria: allow/refused/not_found por chamada, recusa de escopo pessoal com controle positivo, trilha tenant-scoped e sem conteúdo: OK
D4/T3 TTL: janela por camada vinda da policy versionada, expiração idempotente e tenant-scoped, retrieval sem vencida e falha alta sem policy: OK
D4/T6 privilégios: trilha append-only medida (42501), WITH CHECK e CHECKs de vocabulário, políticas globais com SELECT+INSERT: OK
D4/T5 classificação: 20/20 classificadas · 0019_tiresome_robin_chapel = ONLINE_WITH_CARE/empty + idempotent + down: OK
D4/T4 migration: cadeia 20/20 do zero + up→down→up da 0019 com dado preservado e políticas re-semeadas: OK
Memória §43/D2+D3+D4 (persistência, proveniência, tenant, dedup, versões, conflitos, delete/export, TTL): OK
EXIT=0
```

**RED → GREEN medido no pai `648c029` (não afirmado):**

```text
$ cd /tmp/trkb-red   # worktree --detach em 648c029 + SÓ o test-memory.ts novo; banco pqdl_trk_b_red do zero
$ npx tsx scripts/db/test-memory.ts
error: relation "ai_memory_access_log" does not exist   (42P01, primeira fixture)      EXIT=1
```

```text
$ # mesmo código do pai, banco de trabalho JÁ migrado até a 0019
TypeError: memoryRepository.export is not a function                                     EXIT=1
```

```text
# sondas de schema lado a lado (RAW-red-green-probes.txt)
probe                 | RED (648c029)              | GREEN (trk-b-mem-d4)
journal               | 19                         | 20
status_check          | 'active','superseded'      | 'active','superseded','expired'
layer/expires_at      | (nenhuma)                  | expires_at,layer
versions DELETE grant | false                      | true            (SD-C3-12)
access_log_table      | (ausente)                  | ai_memory_access_log
policies_table        | (ausente)                  | ai_memory_policies
```

**Gates estáticos e alvo (`RAW-classify.txt`, `RAW-static-gates.txt`, `RAW-vitest-scoped.txt`, `RAW-boundaries-and-matrix.txt`):** `check-migration-classes` **20/20** EXIT=0 · `tsc --noEmit` EXIT=0 · `prettier --check` (7 arquivos tocados) limpo · vitest dos 6 arquivos afetados **74 passed** · `m02:boundaries` EXIT=0 · `m02:matrix:check` EXIT=1 (**drift esperado** — regeneração é do MAESTRO no land, conforme a instrução do despacho).

**Metadados de RLS/grants e seed (`RAW-grants-and-seed.txt`):** `ai_memory_access_log` RLS **on**, `app_runtime` SELECT+INSERT, sem UPDATE/DELETE, nada para PUBLIC, policy `tenant_isolation` com `USING` **e** `WITH CHECK` (`current_tenant_id` + `has_tenant_access`) · `ai_memory_policies` sem RLS (tabela global), SELECT+INSERT · seed L1 `2592000` (30 d) · L2 `15552000` (180 d) · L3 `31536000` (365 d) · L4/L5 `NULL`.

## 3. Evidência selada

`docs/evidence/trk-b-mem-d4-2026-09-17/` — `README.md` + `RAW-db-test.txt` + `RAW-red-memory.txt` + `RAW-red-memory-with-schema.txt` + `RAW-red-green-probes.txt` + `RAW-classify.txt` + `RAW-static-gates.txt` + `RAW-vitest-scoped.txt` + `RAW-grants-and-seed.txt` + `RAW-boundaries-and-matrix.txt` + `RAW-manifest-check.txt` + `manifest.sha256`.
`sha256sum -c manifest.sha256` → **10/10 OK** (`RAW-manifest-check.txt`). `manifest.sha256` não se auto-referencia.
**Hashes migration ↔ registry:** `sha256(drizzle/0019_tiresome_robin_chapel.sql)` = `9d81a7857157191a289b41d798684631434504ebde3e09f30711f83aeb44d663` = `sha256` da entrada 0019 no registry (`RAW-classify.txt`); classe `ONLINE_WITH_CARE` · `appliedOn: empty` · `idempotent: true` · `onlineCare` declarado · down `drizzle/rollback/0019_to_0018_down.sql` testado **com dados**.

## 4. Decisões declaradas (resumo; detalhe no README §3)

- **Delete = HARD delete (físico)**, a policy já vigente no repositório e o pressuposto do SD-C3-12 ⇒ **sem** estado `deleted`; o rastro é a linha da trilha. Vocabulário estendido só com `expired`.
- **TTL por camada como dado versionado** (`ai_memory_policies`, global, append-only por privilégio; backend lê `max(version)`); valores do H-12 opção A como linhas; L4/L5 `null` (L4 acompanha a entidade; L5 versionada); `layer` default declarado `L2`; L0 não persistido (falha alto).
- **Expirar é transição de estado** (não exclusão), **idempotente**, tenant-scoped, sem gravar linha na trilha; `search` também respeita `expires_at` (defesa em profundidade); camada sem policy ⇒ **falha alta** e nada gravado (INV-013, medido).
- **Trilha** registra `access`/`delete`/`export` (quem, quando, o quê, resultado) na **mesma transação**; **sem** FK para `ai_memories` (a trilha sobrevive ao delete que audita); **sem** `content` nem texto de consulta.
- **Export** tenant-wide por padrão (todas as camadas/estados, com fontes e versões), recortes por `scopes`/`layers`, negação **fail-loud** sem `has_tenant_access` (INV-013).
- **Delete por escopo** (§43 aceite e): memória pessoal de outro autor só cai com `app_private.has_tenant_owner_access`, repetido na cláusula `WHERE` do `DELETE` (sem janela TOCTOU).
- **Arquivos de integração fora do escopo exclusivo** (precedente SD-C3-13): `scripts/db/test-migrations.ts`, `scripts/db/purge-fixtures.ts`, `drizzle/rollback/0001_to_0000_down.sql`.

## 5. Limites / resíduos declarados

- **Não implementado nesta trilha:** delete **por escopo/usuário em massa** (exige superfície/política próprias) · **superfície server-side** (server action/route handler) do gap report D4 — fora do escopo de arquivo desta trilha, port pronto para consumo · **`retrieval_score`/`used_in_context`/`conversation_id`** do §15.4 (D5/D6) · **prorrogação de TTL por `revise`** (janela é do nascimento da linha) · **limpeza das tabelas de memória no `seed-auth.ts`** (lacuna herdada de D2/D3; nenhum e2e escreve memória hoje) · **regeneração da matriz M-02** (MAESTRO no land — `m02:matrix:check` acusa drift esperado).
- **Não rodado (por desenho):** `npm run check`, suíte vitest completa, `db:test` do HEAD integrado e e2e — validação project-wide é do MAESTRO/E2. `npm run build` não se aplica (nenhum módulo de cliente tocado).
- **Ambiente:** a primeira execução de `db:test` falhou por **erro meu de ambiente** (o banco de RED `pqdl_trk_b_red` ainda existia no container, e `test-migrations` derruba a role global `app_runtime` → `2BP01`). Contido: banco de RED removido, `pqdl_trk_b` recriado do zero, `db:test` **EXIT=0** e selado. `:5432`/Neon/produção intocados em todo o ciclo.
- **Sem medição de performance** (§29): nenhum `EXPLAIN`/p95/SLO nesta trilha.

## 6. Commit

- **branch:** `trk-b-mem-d4` (worktree `.worktree-trk-b`), base `648c029`.
- **SHA da entrega:** reportado no retorno ao MAESTRO (commit único com código + migration + testes + evidência + este claim). **Nada pushado.**
