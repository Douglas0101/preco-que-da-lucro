# DECISÕES DO SPEC-STEWARD — NAS-2 ciclo 1 (2026-09-16)

## SD-1 — SPEC-DELTA `WP-1a-test-migrations-chain` → **APROVADA**

- **Pedido:** sanção para o WP-1a tocar `scripts/db/test-migrations.ts` (fora do escopo exclusivo do card) e incluir o down da migration `0016` na cadeia `DOWNS_TIP_TO_0003` + atualizar a expectativa do journal para **17**.
- **Decisão: APROVADA.** Razões: (a) **toda** migration nova precisa entrar na cadeia de downs do teste de migrations, senão o próprio teste falha ao tentar voltar de um estado que não conhece; (b) **precedente idêntico e já mergeado** — o WP-B1 fez exatamente isso para a `0015` (commit `342a188`, merge `b5e880f`) e o STEWARD da rodada anterior sanou o resultado; (c) o card do WP-1a listou `purge-fixtures.ts` e omitiu `test-migrations.ts` — **omissão do card**, não excesso do squad; (d) a mudança é aditiva e verificável (`test-migrations.ts` verde: rollback 0016→0003, downgrade a 0001, replay com journal=17).
- **Propagação obrigatória:** a migration `0016` já está no registry (`SAFE`), no `_journal.json` (idx 16) e no `meta/0016_snapshot.json`; o down consta em `drizzle/rollback/0016_to_0015_down.sql` e no `DROP` global de `0001_to_0000_down.sql`. Nada mais a propagar.

## SD-2 — Correção do SPEC-CARD `WP-1a` (premissa desatualizada) → **CARD CORRIGIDO**

- **Fato apurado pelo squad:** o card dizia "suíte `db:test` 13→14" e pedia proposta de linha para o `package.json`. **Errado:** `tsx scripts/db/test-backfill.ts` **já é a 13ª suíte** do `db:test` (fio `d96a889`, da rodada anterior) — não há linha a propor.
- **Decisão:** o card fica corrigido por esta nota; a aceitação efetiva passa a ser "suíte de backfill verde **dentro** do `db:test` já existente (13 suítes)", sem mudança de `package.json`. O erro é do STEWARD (card escrito antes de conferir o fio do `db:test`), não do squad.
- **Lição registrada:** card novo deve **verificar o estado do pipeline no HEAD** (ex.: quais suítes o `db:test` já encadeia) antes de fixar aceitação — evita pedir trabalho já feito.

## SD-4 — SPEC-DELTA `MEM-D2-scope-chain-and-purge` → **APROVADA** (2026-09-16)

- **Pedido:** sanção para o MEM-D2 tocar `scripts/db/test-migrations.ts` (down da `0017` na cadeia + journal 17→18) e `scripts/db/purge-fixtures.ts` — ambos fora do escopo exclusivo do card.
- **Decisão: APROVADA**, pelo mesmo fundamento do **SD-1**: (a) toda migration nova **precisa** entrar na cadeia de downs do teste de migrations, senão o próprio teste falha; (b) `purge-fixtures` enumera tabelas tenant-scoped e ficaria inconsistente sem as novas; (c) o card listou o escopo de forma abreviada — omissão do STEWARD, não excesso do squad; (d) a mudança é aditiva e verificada (`test-migrations.ts` verde: chain de 18, replay + down de 0017).
- **Propagação obrigatória:** `0017_past_gideon` no registry (`SAFE`, sha256 `ba66a3f3…`), no `_journal.json` (idx 17 → 18 entradas) e no `meta/0017_snapshot.json`; down em `drizzle/rollback/0017_to_0016_down.sql` + `DROP` no global `0001_to_0000_down.sql`.
- **Observação de risco registrada pelo squad (aceita):** `MEMORY_MIGRATION_TAG` fica acoplado à tag sorteada — regerar a migration exige atualizar registry/hash **e** o T5; o `db:classify:check` falha alto se não acompanhar (fail-closed, aceitável).

## SD-5 — Decisões de coluna do MEM-D2 → **RATIFICADAS**

| decisão do squad                                                                         | decisão do STEWARD                                                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `user_id NOT NULL` + FK composta `(tenant_id,user_id)` → `tenant_memberships`            | **ratificada** (o spec_ref exige; a lista do card era abreviada)                                   |
| sem `expires_at`/TTL no D2 (o port não carrega TTL)                                      | **ratificada** — TTL é D3/D6 e depende do briefe **H-12**                                          |
| `confidence` nulável com CHECK de faixa; `importance` NOT NULL DEFAULT 0                 | **ratificada**                                                                                     |
| `ai_memory_sources` append-only (SELECT/INSERT); o `DELETE` do §43 vive em `ai_memories` | **ratificada** (cascata provada sob `app_runtime`)                                                 |
| `search` = substring parametrizada + tenant/status antes de tudo                         | **ratificada** — FTS é D5, ranking é D6; o §15.8 (filtro de tenant **pré**-retrieval) está honrado |

## SD-3 (histórico) — `WP-1b` e o runbook de evidência de performance → **executado como `WP-1b-reg`**

- **Achado (fora do escopo do WP-1b, corretamente não tocado):** `docs/runbooks/performance-evidence.md:37-39` listava **3** entradas de allowlist de legado, enquanto o gate tinha **2** (a de `explain-critical-queries-2026-08-21.md` foi removida como entrada morta no WP-A1).
- **Decisão:** virou **`WP-1b-reg`** (docs-only, 1 commit) e foi **executada** no ciclo 1 (`a37ae76`): runbook alinhado à descoberta por caminho + `checked === discovered`. **Superado no ciclo 2** pelo `WP-1c`, que eliminou a allowlist de vez (`a242af5`) — o runbook e o `AGENTS.md` já refletem zero isenções.
