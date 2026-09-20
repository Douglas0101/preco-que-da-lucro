# SPEC — WP4 `F-B-mem-purge`

**Work package:** `F-B-mem-purge` (Bloco 3, quarto na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:89`
**Base:** `47d39a936f12961a2ff9922de5e1a319f49c8ea0` (develop pós-WP3)
**Branch:** `mission/wp4-mem-purge` · worktree `.worktree-wp4-mem-purge`

---

## 1. Problema

A migration 0019 criou `ai_memory_access_log` com FK composta
`(tenant_id, user_id) → tenant_memberships(tenant_id, user_id) ON DELETE RESTRICT`. A trilha é
**append-only por privilégio** (o `app_runtime` só tem `SELECT`/`INSERT`) e o `RESTRICT` é
intencional: apagar a membership não pode apagar a prova de que houve acesso a memória.

O efeito colateral é na **purga de fixture**. Cinco caminhos apagam `tenant_memberships`/`tenants`/
`users` (direta ou por cascade) sem apagar a trilha antes:

| caminho                               | onde                              | o que apaga hoje (sem a trilha)              |
| ------------------------------------- | --------------------------------- | -------------------------------------------- |
| `scripts/e2e/seed-auth.ts`            | lista fixa de tabelas, `:55-70`   | `tenant_memberships` → `tenants` → `users`   |
| `scripts/db/explain-evidence.ts`      | seed `:67-68`, cleanup `:215-221` | `tenant_memberships`/`tenants`/`users`       |
| `scripts/db/test-backfill.ts`         | teardown `:752-753`               | `tenants` (cascade p/ memberships) → `users` |
| `scripts/db/test-auth-integration.ts` | `cleanupFixtures` `:58-63`        | `users` (cascade p/ memberships) → `tenants` |
| `scripts/db/test-ai-budget.ts`        | finally `:786-787`                | `tenants` (cascade p/ memberships) → `users` |

Com **qualquer linha de memória** para o tenant (access log, memória, versão, conflito ou fonte), a
cadeia bate no `RESTRICT` e o caminho inteiro falha com **23503** — alto, nunca silencioso, mas
quebrando o E2E, o probe de EXPLAIN e as suítes de DB. O `scripts/db/purge-fixtures.ts` (purga de
produção) **já está correto**: é o único que lista a trilha, e na ordem FK-safe.

## 2. Contrato

- **Ordem da trilha**: `ai_memory_access_log` → `ai_memory_conflicts` → `ai_memory_versions` →
  `ai_memory_sources` → `ai_memories`. Razão medida no schema:
  - `access_log` é `RESTRICT` para memberships ⇒ sai antes de qualquer delete de memberships;
  - `conflicts` e `versions` são `RESTRICT` para `ai_memories` ⇒ saem antes das memórias;
  - `sources` é `CASCADE` para memórias, mas sai explicitamente para o delete ser determinístico;
  - `ai_memories`/`sources` cascateiam de memberships, mas não podem depender do cascade por causa
    dos filhos `RESTRICT`.
- **Fonte única**: a ordem vive em `scripts/db/purge-fixtures.ts` como `MEMORY_TRAIL_TABLES`,
  exportada; `TENANT_SCOPED_TABLES` passa a ser derivada dela. Decisão humana
  (ask_user_question): **reuso**, não listas inline duplicadas.
- **Nada de novo em runtime/schema**: sem migration, sem mudança de grant, sem tocar a trilha em
  produção. O WP é a purga dos caminhos de fixture.
- **Falha continua alta**: se uma migration futura acrescentar outro `RESTRICT` sem atualizar a
  purga, o erro é 23503 persistido — nunca um sucesso vazio. O WP não instala `try/catch` nenhum.

## 3. Mudanças

1. `scripts/db/purge-fixtures.ts` — extrai `MEMORY_TRAIL_TABLES` (as 5, na ordem acima) e deriva
   `TENANT_SCOPED_TABLES` dela. Comportamento do purger inalterado (mesma sequência de tabelas).
2. `scripts/e2e/seed-auth.ts` — importa `TENANT_SCOPED_TABLES` e substitui a lista inline. Ganho
   colateral: a limpeza do E2E passa a cobrir também `outbox_*` e `backfill_*`, que a lista inline
   esquecia (mesmo tenant de fixture).
3. `scripts/db/explain-evidence.ts` — loop da trilha por `tenant_id` **nos dois** pontos (seed e
   cleanup), antes de membros/tenant/users.
4. `scripts/db/test-backfill.ts` — loop da trilha por `tenant_id in ($1,$2)` antes do delete de
   `tenants` no teardown.
5. `scripts/db/test-auth-integration.ts` — loop da trilha por
   `tenant_id in (select tenant_id from tenant_memberships m join users u ... where u.email = any($1) or u.id = $2)`
   antes do delete de `users` (o cascade users → memberships é o que bate no `RESTRICT`).
6. `scripts/db/test-ai-budget.ts` — loop da trilha por `tenant_id = any($1::uuid[])` antes do delete
   de `tenants` no finally.

## 4. DoD

- [ ] para cada um dos 5 caminhos, a prova **RED → GREEN**: com a trilha presente, os bytes do pai
      falham com **23503** (nunca em silêncio) e os bytes novos concluem exit 0
- [ ] prova com **linha real** de memória: o access log e a memória existem de fato no banco do
      probe (não é inferência de lista)
- [ ] `npm run db:test` completo (17 suítes) verde contra container PG17 efêmero
- [ ] `npm run check` exit 0 nos bytes finais
- [ ] `m02:matrix:check` determinista sem regenerar quando aplicável
- [ ] `origin/main` intocado; `:5432` (H-9) com 0 listeners antes e depois; container efêmero
      removido no fim
- [ ] transcripts por fase com `HEAD` + sha256 dos 6 arquivos; RED com diff vazio; GREEN com
      precondição de estado e `23503 == 0`
- [ ] nenhum runtime (`src/**`), schema (`drizzle/**`) ou migration tocado no diff

## 5. Método de prova (E1)

Container `wp4-pg` PG17 efêmero em porta livre (`127.0.0.1:54xx`), migrations aplicadas uma vez.
Sem ids determinísticos em dois caminhos, o probe usa **duas técnicas declaradas**:

- **Pré-semeio por id fixo** (`seed-auth`, `explain-evidence`): as fixtures usam ids constantes no
  código; o probe cria users/tenants/memberships + trilha completa (access log, memória, fonte,
  versão, conflito) antes de rodar o caminho.
- **Trigger de probe** (`test-backfill`, `test-auth-integration`, `test-ai-budget`): como os ids são
  aleatórios por execução (ou as fixtures nascem dentro da suíte), o probe instala um trigger
  temporário em `tenant_memberships` (depois do insert, grava uma linha de access log) — a condição
  que o WP precisa suportar. O trigger é scaffold de probe: vive só no container efêmero, aparece na
  captura e não entra em commit.

Cada fase **fixa a revisão** no transcript (`wp4-probe-<fase>.log`: `HEAD`, sha256 dos 6 arquivos);
o RED asserta **diff vazio** contra o pai. O GREEN **recusa rodar** sem a precondição do RED
(container, trigger e ≥ 1 linha de trilha) e exige `exit 0` **e** zero 23503 por caminho — sem isso
um GREEN num banco limpo passaria vazio.

A prova RED roda os **bytes do pai** (`git show HEAD^:<arquivo>` em cópia de scratch) e a GREEN os
bytes novos, contra o mesmo container e a mesma fixture.

## 6. Fora de escopo

- `ai_memory_policies` (global, sem RLS, sem escritor) — `F-B-mem-policies`, decisão de política.
- `scripts/db/purge-fixtures.ts` já está correto; só ganha a exportação canônica.
- `scripts/db/test-memory.ts` já purga a própria trilha; não é tocado.
- N2 do WP3 (composição do piso do runner) permanece declarado.
- Nada de `try/catch` compensatório: a falha alta é o contrato.

## 7. Rollback

Descartar a branch e o worktree. Sem migration, sem schema, sem runtime: o diff é `scripts/**` +
este selo. Nada fica em `develop` antes do Gate C.
