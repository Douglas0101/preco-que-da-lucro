# DECISÕES DO SPEC-STEWARD — NAS-2 ciclo 1 (2026-09-16)

## SD-1 — SPEC-DELTA `WP-1a-test-migrations-chain` → **APROVADA**

- **Pedido:** sanção para o WP-1a tocar `scripts/db/test-migrations.ts` (fora do escopo exclusivo do card) e incluir o down da migration `0016` na cadeia `DOWNS_TIP_TO_0003` + atualizar a expectativa do journal para **17**.
- **Decisão: APROVADA.** Razões: (a) **toda** migration nova precisa entrar na cadeia de downs do teste de migrations, senão o próprio teste falha ao tentar voltar de um estado que não conhece; (b) **precedente idêntico e já mergeado** — o WP-B1 fez exatamente isso para a `0015` (commit `342a188`, merge `b5e880f`) e o STEWARD da rodada anterior sanou o resultado; (c) o card do WP-1a listou `purge-fixtures.ts` e omitiu `test-migrations.ts` — **omissão do card**, não excesso do squad; (d) a mudança é aditiva e verificável (`test-migrations.ts` verde: rollback 0016→0003, downgrade a 0001, replay com journal=17).
- **Propagação obrigatória:** a migration `0016` já está no registry (`SAFE`), no `_journal.json` (idx 16) e no `meta/0016_snapshot.json`; o down consta em `drizzle/rollback/0016_to_0015_down.sql` e no `DROP` global de `0001_to_0000_down.sql`. Nada mais a propagar.

## SD-2 — Correção do SPEC-CARD `WP-1a` (premissa desatualizada) → **CARD CORRIGIDO**

- **Fato apurado pelo squad:** o card dizia "suíte `db:test` 13→14" e pedia proposta de linha para o `package.json`. **Errado:** `tsx scripts/db/test-backfill.ts` **já é a 13ª suíte** do `db:test` (fio `d96a889`, da rodada anterior) — não há linha a propor.
- **Decisão:** o card fica corrigido por esta nota; a aceitação efetiva passa a ser "suíte de backfill verde **dentro** do `db:test` já existente (13 suítes)", sem mudança de `package.json`. O erro é do STEWARD (card escrito antes de conferir o fio do `db:test`), não do squad.
- **Lição registrada:** card novo deve **verificar o estado do pipeline no HEAD** (ex.: quais suítes o `db:test` já encadeia) antes de fixar aceitação — evita pedir trabalho já feito.

## SD-3 — `WP-1b` e o artefato de runbook (`docs/runbooks/performance-evidence.md`) → **FOLLOW-UP `WP-1b-reg`**

- **Achado (fora do escopo do WP-1b, corretamente não tocado):** `docs/runbooks/performance-evidence.md:37-39` lista **3** entradas de allowlist de legado, enquanto o gate tem **2** (a de `explain-critical-queries-2026-08-21.md` foi removida como entrada morta no WP-A1).
- **Decisão:** virar **`WP-1b-reg`** (docs-only, 1 commit, dono SQUAD-APP) para alinhar o runbook ao gate vigente. Não bloqueia o WP-1b; entra depois do veredicto adversarial do WP-1b (para o verificador não inspecionar branch em movimento).
