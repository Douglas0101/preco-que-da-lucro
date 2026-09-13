# C-02 — Drill em seis passos (2026-09-07, pós-PS-S1) — STOP em 4/6

Pré-condições: PS-S1 emitido; diretório do trio inexistente antes;
before-proof Neon: só `production` (`br-snowy-violet-aymcvvvv`, ready) +
`develop` (archived). Produção: **zero escritas** em todos os passos
(apenas `pg_dump` read-only + SELECTs). Origem quiescente: tráfego
inexistente por ledger; fixture-free confirmada pelo reconcile.

Hosts mascarados como `<DIRECT-ORIGEM>` (production DIRECT) e
`<DIRECT-RESTORE>` (branch efêmera DIRECT). URLs nunca em argv, nunca
impressas (env por nome, em-processo).

## Passo 1 — snapshot trio (exit 0)

`DATABASE_ADMIN_URL=<direct origem> ALLOW_REMOTE_DB="C-02 drill pós-PS-S1
(DP5=(b); motivo por invocação)" npm run m02:snapshot -- --out-dir
.artifacts/backup-drill/2026-09-07-c02/` → `event:done mode:trio`,
**121.790 bytes**, sha256 `7611425d5537ab099ba59be175a794f6f0312b67865e082899c6d95821e203f5`,
`server_version 17.11`, `duration 34,8 s`. Metadata N-6 exata
(`producer/source/connection_kind/read_only/motivo/created_at` =
`2026-09-07T18:28:18.134Z`). `sha256sum -c dump.pgc.sha256` OK no subdir.

## Passo 2 — restore em efêmera (kind drill-branch)

`neon branches create --project-id damp-forest-57346541 --name
restore-2026-09-07-c02 --parent br-snowy-violet-aymcvvvv --expires-at
2026-09-08T06:00:00Z` → id `br-tiny-dust-ayng3ajh`, `ready` 18:29:11Z.
Identidade registrada (nome/id/estado/parent/expires).
Reset de schemas **só na efêmera** (sancionado; NUNCA produção):
`DROP SCHEMA public/drizzle CASCADE` (27 objetos) + `CREATE` ambos;
pós-reset: 0 tabelas. Schemas de plataforma intocados.
`pg_restore --no-owner --no-privileges` do trio → **exit 1, padrão
conhecido**: 39 linhas `already exists/duplicate key/permission denied`

- linhas de contexto `Command was:` — **zero erro em objetos `public`**;
  pós-restore: **26 tabelas em `public`**.

## Passo 3 — reconcile origem×restore (exit 0)

`node scripts/m02-reconcile.mjs --source-env SRC_URL --target-env DST_URL
--out docs/evidence/pós-rat-2026-09-07/reconcile-c02.md` →
**26 tabelas · differences_total = 0 · pass = true** (diff financeiro
zero). Arquivo `.md` sem URLs/hostnames (verificado: 0 `://`, 0 `ep-`).

## Passo 4 — backup-verify → STOP RATIFICADO (exit 1)

`DATABASE_ADMIN_URL=<direct origem> DATABASE_RESTORE_URL=<direct restore>
npm run m02:backup-verify -- --snapshot-id snap-tiny-smoke-ayc382ji
--source-branch br-snowy-violet-aymcvvvv --restore-branch
br-tiny-dust-ayng3ajh` → `result: FAIL`.
`comparison: pass=false, tables_compared=27, failures=["catalog"]`;
`journal: pass=true, 11/11`; identidades conferem (projeto/branches/
endpoints distintos); `read_only: true`.
**Causa isolada (investigada, sem improviso): 178 linhas `grant`
só-na-origem, 0 linhas só-no-restore, 0 linhas divergentes** — os grants
a `app_runtime` não foram aplicados no restore porque o `pg_restore`
sancionado usa `--no-privileges` (precedente: evita o `SET ROLE
"neon_service"` do drill 09-05). Tabelas, policies, constraints, índices
e roles: idênticos. **É artefato das flags do drill, não divergência de
dados.** Sem loop de retry: STOP aplicado, sem PS-S5.
Implicação registrada para o runbook: restore via `dump.pgc` exige passo
de reparo de grants (ou restore com privilégios, com tratamento do
`SET ROLE`) — decisão humana pendente, não executada aqui.

## Passo 5 — cleanup always() com prova (COMPLETO)

`neon branches delete br-tiny-dust-ayng3ajh` → listagem depois: só
`production` (ready) + `develop` (archived). **Nenhuma efêmera
remanescente.** O stop "efêmera sem cleanup" NÃO foi acionado.

## Passo 6 — gate snapshot-fresco alimentado pelo trio

`npm run m02:readiness` (DATABASE_ADMIN_URL, read-only) →
`snapshot-fresco: PASS — trio válido em 2026-09-07-c02; idade 0.1h por
created_at (mtime ignorado)`. Gate geral FAIL somente pelos itens de
agenda humana conhecidos (`m02-state`, `g1-assinada`, `sec01-fechada`,
`freeze-ativo`) — esperados pré-cutover, fora do escopo C-02.
Substrate 7/7, matrix, boundaries: PASS.

## Veredito C-02

**INCOMPLETO POR STOP DEFINIDO** (passo 4). Mecanismo dump→restore→
reconcile→cleanup **provado**; comparador estrito aponta causa isolada e
documentada. Condições de retomada: (a) aceitar-com-causa + nota de
reparo de grants no runbook, ou (b) re-drill com privilégios (nova
decisão; exige tratamento do `SET ROLE`).
