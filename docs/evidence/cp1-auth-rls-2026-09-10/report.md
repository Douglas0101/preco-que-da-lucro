# CP-1 — Normalização do RLS das tabelas de autenticação (migration 0011) — 2026-09-10

Validação local da 12ª migration (`drizzle/0011_auth_rls_normalization.sql`),
que torna canônico o estado observado em produção em 2026-09-10: RLS habilitado
sem políticas em `users`, `sessions`, `accounts`, `verifications` e
`rate_limits` (drift out-of-band, violação de INV-012, default-deny para
qualquer role não-owner — ver `docs/evidence/verificacao-producao-2026-09-10.md`
§Achados e `docs/evidence/analise-plano-mestre-2026-09-10.md` §6.3).

- **Classificação (§27):** SAFE — aditiva e idempotente, zero mudança de dados.
- **Alvo:** política única de serviço `auth_service_access` (FOR ALL, permissiva,
  exclusiva de `app_runtime`) nas 5 tabelas de identidade global; roles sem
  política permanecem negadas; owner/BYPASSRLS (role de conexão atual) não é
  afetado.
- **Rollback:** `drizzle/rollback/0011_to_0010_down.sql` (lab/reprodução; nunca
  automático — pós-tráfego o caminho é restore de snapshot).

## Artefatos e hashes (SHA-256)

| Arquivo                                   | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `drizzle/0011_auth_rls_normalization.sql` | `6c9d62a66e40edfb53e6f1eb2be1d0195390192ab75ea17af0ac87f897138fef` |
| `drizzle/rollback/0011_to_0010_down.sql`  | `8a21875e95a50c0a32ad7c072cf0b3935ac3dc8bc23b5f6c8aaf56127a35e35a` |
| `drizzle/meta/_journal.json`              | `4e4050238c0421f5031ed44154a95ffc631b73a4cc1e46b9641ada5507972863` |
| `scripts/db/test-migrations.ts`           | `bd4f34250e89da2fca80fcecb4c48968086b7a9cdc3a1cc229949080a5f6b175` |
| `scripts/m02-v2b.mjs`                     | `bd29cc9f426e090e05855f175f22d085eda87fddd3eaea854f6da98b98338cb2` |

Registro: `sha256sums.txt`.

## Ambiente

- Container `preco-que-da-lucro-postgres` (`postgres:17-alpine`, compose do
  repo), volume zerado (`docker compose down -v && up -d --wait`) antes da
  cadeia canônica.
- Overrides locais sancionados pelo env-guard apontando para `127.0.0.1:5432`;
  o `.env` local contém URL pooled de produção e foi ignorado por precedência de
  ambiente. Nenhum socket remoto foi aberto.

## Probes (transcrição bruta: `probes-local.txt`)

### Probe 1 — reprodução do drift pré-0011 (RLS ligado, sem política)

1. Estado de partida: 5 tabelas com `relrowsecurity = t` e 1 política cada.
2. Drop das 5 políticas (mantendo RLS) = estado de produção de 2026-09-10.
3. Como `app_runtime` personificado (`set local role app_runtime`):
   - `SELECT count(*) FROM users` → **0 linhas, sem erro** (deny-all silencioso);
   - `INSERT INTO users (...)` → **ERROR 42501 `new row violates row-level security policy`**.

Resultado: **PASS** — o drift explica o bloqueio do ciclo better-auth para
qualquer runtime conectado como `app_runtime`.

### Probe 2 — normalização (aplicação da 0011 real, 2×)

1. `drizzle/0011_auth_rls_normalization.sql` aplicado por inteiro; reaplicado
   em seguida (idempotência): apenas `DO` sem erro, catálogo continua com
   exatamente 1 política por tabela.
2. Como `app_runtime`:
   - `SELECT` em `users` (3 linhas visíveis), `sessions`, `accounts`,
     `verifications`, `rate_limits` → **ok**;
   - `INSERT` em `users` + `SELECT` da própria linha → **ok**;
   - `INSERT ... ON CONFLICT` + `DELETE` em `rate_limits` → **ok**.
3. Journal: **12 entradas** (`drizzle.__drizzle_migrations`).

Resultado: **PASS** — política resolve o deny-all e é idempotente.

### Probe 3 — superfície exata e caminho owner

1. Sessão owner (`postgres` local; análogo de `neondb_owner` com BYPASSRLS):
   `SELECT count(*) FROM users` → **ok** (RLS não se aplica ao owner).
2. Catálogo `auth_service_access`: **5 linhas**, `polpermissive = t`,
   `polcmd = *`, role **exatamente `app_runtime`** (sem PUBLIC/roles legadas).
3. Cleanup dos fixtures do probe verificado: **0** usuários `cp1-probe-%`.

Resultado: **PASS**.

## Cadeia canônica `db:test` (transcrição bruta: `db-test-2026-09-10.txt`)

Exit code **0**, banco zerado, com os ajustes de harness desta rodada
(`DOWNS_TIP_TO_0003` inclui `0011_to_0010_down.sql`; replay do journal espera
12; contrato de RLS de auth assertado em `assertDatabaseContract`):

- `PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK`
  (0000→0011 do zero; upgrade a partir de 0003 com preflight da 0004;
  downgrade 0011→0001; replay; rollback final 0001→0000 e nova cadeia completa);
- `Better Auth, tenant pessoal, cookie, bcrypt/scrypt e rotação de sessão: OK`
  (better-auth operando como `app_runtime` com RLS ligado — prova end-to-end da
  política);
- `Tool registry...: OK`, `Chat GET...: OK`, `T1–T10: OK`.

## Gate em árvore limpa (dependências do lockfile commitado)

O working tree local tem drift pré-existente não commitado em
`package.json`/`package-lock.json` (`drizzle-kit` 0.18.1, sem `check`;
`@vercel/analytics` ausente do `node_modules`), que quebra `typecheck` e
`format:check` local. Para validar o gate autoritativo, foi criado um worktree
destacado no HEAD (`e540638`), aplicadas as mudanças deste commit e rodado
`npm ci --ignore-scripts` com o lockfile commitado:

| Gate                                     | Resultado                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:check` (drizzle-kit 0.31.10) | exit 0 — `Everything's fine`                                                                                                                   |
| `npm run check`                          | exit 0 — format/lint/typecheck verdes, **423 testes** em 46 arquivos, build `vercel`/`node-server` ok, `check:bundle` PASS (entry 85.636 gzip) |

## Observações de fronteira

- **Produção ainda está em 11/11**: a 0011 não foi aplicada em produção nesta
  rodada. O runner (`scripts/db/migrate.ts`, `DATABASE_ADMIN_URL`) é manual — o
  redeploy da Vercel não aplica migração. A aplicação em produção exige o
  caminho sancionado (`NEON_MIGRATION_TARGET_KIND=cutover-window` +
  `ALLOW_REMOTE_DB` + janela vigente, `docs/runbooks/cutover-A4.md` §11) e
  snapshot nativo antes de qualquer escrita.
- **Drift local não commitado** de `package.json`/`package-lock.json`
  (`drizzle-kit` rebaixado para `^0.18.1`, sem `check`) é pré-existente e ficou
  fora deste commit; o gate local autoritativo desta rodada foi `db:test`.
- A conexão de produção atual (`neondb_owner`, BYPASSRLS) não é afetada pela
  política; se/quando o runtime migrar para `app_runtime`, a política já estará
  no lugar.
