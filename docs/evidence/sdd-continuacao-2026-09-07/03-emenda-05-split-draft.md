# 03 — Emenda #5 DRAFT: split `.env` (B-00; ★ sela no commit, 2026-09-07)

> STATUS: DRAFT para selagem humana (B-00). Texto exato a anexar como §11
> de `docs/specs/M-02/emenda-2026-09-07-env-guard.md`. Não relaxa nenhum
> hard-deny (#2/#3 intactos).

## 11. Emenda #5 (2026-09-07, SDD-CONTINUAÇÃO) — split do `.env`

Arquivo prod: **`.env.sanctioned-remote`** (nunca `.env.production` /
`.env.prod`: o Vite auto-carrega `.env.[mode]` — violaria "carregado
exclusivamente pelas ops sancionadas"). Já ignorado por `.gitignore:12`
(`.env.*`).

- `.env` = somente dev-local (`DATABASE_*` → `127.0.0.1` container
  `preco_que_da_lucro_test`; `DRIVER=node-postgres`; demais placeholders
  dev). Remover: `DATABASE_URL_UNPOOLED` prod, `SUPABASE_*`/`VITE_SUPABASE_*`
  legado, `NEON_BRANCH`, `NEON_AUTH_*`, `NEON_DATA_API_URL`.
- `.env.sanctioned-remote` = somente nomes: `DATABASE_URL`,
  `DATABASE_ADMIN_URL`, `DATABASE_RESTORE_URL`, `DATABASE_URL_UNPOOLED`
  (endpoints prod) +, quando aplicável, `SUPABASE_MIGRATION_DATABASE_URL`,
  `NEON_MIGRATION_TARGET_KIND/FREEZE_START/FREEZE_END`, `ALLOW_REMOTE_DB`
  (motivo por invocação, não persistido).
- Loader exclusivo: `node --env-file=.env.sanctioned-remote <script
sancionado>` (sem `-if-exists`: fail-closed se ausente). Nunca em hooks
  DENY. Manter `--env-file-if-exists=.env` nos 9 hooks DENY
  (`predev/pretest/prebuild:dev/pree2e:prepare/pretest:e2e/predb:test/
predb:migrate/predb:generate/predb:check`); `prem02:snapshot` →
  `--env-file=.env.sanctioned-remote`; loaders explícitos (sem `pre*`)
  para `smoke:substrate`, `m02:readiness`, `m02:backup-verify`,
  `migration:legacy-to-neon`; `--env-file=.env` nos comandos principais
  DENY (`tsx`, `drizzle-kit`); selftest sem `--env-file`.
- Verificação (B-03): selftest 13/13; smokes deny(exit 3 remoto+test) /
  allow(local 0; sancionada `ALLOW_SANCTIONED`; migrate-remota-sem-kind 3);
  `npm test`/`db:migrate` ALLOW com `.env` local e DENY no `pre*` se
  remoto; `db:up→migrate→test` verdes só-local; `m02:snapshot` só via
  arquivo sancionado + motivo + recusa `-pooler`.
- Nunca commitar (lista fechada): `.env`, `.env.sanctioned-remote`,
  `gate.env`, `.env.*` (exceto `*.example`). O `m02:secrets-audit` os lê
  como definição (valores descartados); `possible_secret_literals` deve
  permanecer `[]`.
