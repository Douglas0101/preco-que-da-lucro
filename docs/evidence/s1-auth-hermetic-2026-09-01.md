# S1 — Hermetic auth integration test (2026-09-01)

## CI verdict evidence (orchestrator-verified, not re-run)

- `develop@12c90a1` — UI stack run **33037007387**: GREEN.
- `main@55cb550` — UI stack run **33037810871**: GREEN.
- Local-only red on branch `codex/wave1-neon-native`: `scripts/db/test-auth-integration.ts`
  assertion at the legacy bcrypt sign-in (`assert.equal(legacyLogin.status, 200)`) failed with `401 !== 200`.

## Root cause

**Not** the `DATABASE_URL` role and **not** rate-limit leakage. The script never reads
`DATABASE_URL` — it derives its own `app_runtime` pool from `DATABASE_ADMIN_URL`, so admin
vs runtime `DATABASE_URL` behaves identically.

Real mechanism: this branch bumps the lockfile from `better-auth` **1.6.27** (what the green
CI tips installed) to **1.7.2**. Since 1.7.x, `sign-in/email` resolves the credential account as
`providerId === "credential" && issuer === createLocalAccountIssuer("credential") && accountId === user.id`
(`node_modules/better-auth/dist/api/routes/sign-in.mjs:318-324`). Migration
`drizzle/0007_add_accounts_issuer.sql` added the `issuer` column nullable with no backfill,
and the raw-SQL legacy fixture inserted `accounts` **without `issuer`** → `issuer IS NULL` →
Better Auth logs `User not found` → **401**. Fresh scratch DB reproduced it identically under the
admin URL, confirming it is fixture/schema-version drift, not environment state.

## What was made hermetic (`scripts/db/test-auth-integration.ts` only)

1. **Legacy fixture carries the issuer** (`CREDENTIAL_ISSUER = "local:credential"`,
   documented at lines 16-41; used in the `insert into accounts … issuer …` at ~line 264).
   Works under every role and both better-auth majors.
2. **Explicit TEST-NET IPs (RFC 5737) on every auth request** (`198.51.100.42` burst,
   `198.51.100.44` maria signup, `198.51.100.43` sign-ins/change-password/get-session/verify),
   so requests never land in Better Auth's shared `no-trusted-ip` bucket and the run emits no
   "falling back to a single shared per-path bucket" warning.
3. **`cleanupFixtures()` at start and in `finally`** (lines 43-63, 133, 291): deletes only the
   test's own artifacts — `rate_limits` rows under the test IP prefixes plus stale
   `no-trusted-ip|%` counters, `verifications` for the test emails, test `users` by email
   (+ fixed legacy id; FK cascades cover accounts/sessions/memberships/profiles), and orphaned
   `personal-%` tenants. Repeated runs on the same database are idempotent.
4. No dependence on ambient env beyond `DATABASE_ADMIN_URL` (`BETTER_AUTH_SECRET`/
   `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` are already generated inside the script).
5. No temporary debug prints were needed (the Better Auth `User not found` warning plus
   `sign-in.mjs` source inspection identified the mechanism); none were left in the file.

## Proof (scratch DB `s1_verify`, Postgres 17 container, `DATABASE_DRIVER=node-postgres`)

`npx tsx scripts/db/migrate.ts` against the fresh scratch DB first. All runs print
`Better Auth, tenant pessoal, cookie, bcrypt/scrypt e rotação de sessão: OK`, exit 0:

| #   | DATABASE_URL role                                           | Result                                                               |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | `postgres` superuser (admin)                                | PASS (pre-fix repro of the CI-oracle: **401 fail** on first attempt) |
| 2   | `postgres` (admin) — fixed script, run A                    | PASS                                                                 |
| 3   | `postgres` (admin) — fixed script, immediate re-run same DB | PASS (hermetic repeat)                                               |
| 4   | `app_runtime` (password via `ALTER ROLE`, CI-equivalent)    | PASS                                                                 |
| 5   | `app_runtime` — after final edit                            | PASS                                                                 |

Residue after the final runs: `users@%example.test=0`, `rate_limits=0`, `tenants personal-%=0`.
Scratch DB dropped at the end of the session.

Regressions: `npx vitest run src/test/rate-limit-rules.test.ts` → 5/5 pass;
`npx tsc --noEmit -p tsconfig.json` → clean; `npx prettier --write` → unchanged.

## Scope confirmation

`src/server/auth/*` (password.server.ts, auth.server.ts, rate-limit storage/rules, cookies/
`__Host-` policy), `src/middleware/*`, `src/start.ts`, and the matrix §32 tests were **not
touched**. Only `scripts/db/test-auth-integration.ts` and this evidence file changed.

## Follow-up flagged (out of scope for S1)

`drizzle/0007` does not backfill `issuer` for pre-existing credential accounts. Any real
(imported Supabase) database whose `accounts.issuer` is NULL will fail sign-in under
better-auth 1.7.2 for the same reason as the fixture — worth a wave decision (backfill
migration or import-time normalization).
