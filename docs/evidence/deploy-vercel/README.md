# Deploy Vercel + Neon — release 2026-10-23

## Escopo

- PR `#65` (`release: Onda 1, CSP WebKit fix and dependency security floor`) merged into `main`.
- Merge commit: `21a6089aa3873c3b66a70cc596a100d91f3954db`.
- The release range contains **no** `drizzle/` migration. The uncommitted local migration `0020` and the other 75 WIP entries were **not** released; they remain preserved in the worktree.

## Gates

| Gate                     | Evidence                                                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR `verify-release`      | run `39906664910`, success (10m46s), full chromium + firefox + webkit + mobile                                                                                                                                                                                                                                      |
| PR `scan + cobertura`    | run `39906664839`, job success; CE task `AaFnRcUTZqMCwdzbU-DA`, analysis `26f9c077-c526-4649-b6c7-e0c37f3f8ed3`; provider `new_coverage=60.0` (ERROR only against the old 80% preset); releasePolicy ADR-042 `new_coverage>=60` **OK**; reliability/security/maintainability `1`, duplication `2.2`, hotspots `100` |
| Neon PR branch + cleanup | run `39906664867`, success (11m55s); cleanup job `120263587615` success; only the three permanent branches remain                                                                                                                                                                                                   |
| Main CE                  | run `39907868129`, success; CE task `AaFnUIPvtdTaAiBCqzjk`, analysis `aca6a09a-5adf-4e17-946b-e001821035b7`; provider status **OK**, `new_coverage=81.0`, releasePolicy **OK**                                                                                                                                      |
| Main push `verify`       | run `39907867951` attempt 2 success (chromium + mobile); attempt 1 failed only in `prepare-browsers` by the 12-minute job budget, and the full-workflow rerun passed                                                                                                                                                |

Non-required PR checks that remain red, with their limit:

- `main-coverage-mirror`: `coverage-lcov` from main run `38508788726` was uploaded with `retention-days: 7` and had expired; the job reports `EXECUTION_OR_UNCLASSIFIED` / `NO-VERDICT` and does **not** approve main. It is observational, not a required check; the mandatory CE above is the release decision. Retention should be extended in a follow-up.
- `SonarCloud Code Analysis`: the provider's old 80% preset remains ERROR at PR coverage 60.0. ADR-042 preserves that raw provider status; the required `scan + cobertura` check and its releasePolicy passed.

## Vercel

- Project: `prj_aKcy1gnNKvcQzxFlrYifMucpyJ8q`.
- Deployment: `dpl_AYh62JKPhjjrixJgEGbe4MuTTkzE`.
- Exact commit: `21a6089aa3873c3b66a70cc596a100d91f3954db`; target `production`; state `READY`.
- URL: `https://preco-que-da-lucro-prxao9avc.vercel.app`.
- Production aliases all resolve to this deployment:
  - `preco-que-da-lucro-sage.vercel.app`
  - `preco-que-da-lucro-douglasultimatesouza-5127s-projects.vercel.app`
  - `preco-que-da-lucro-git-main-douglasultimatesouza-5127s-projects.vercel.app`
- Health:
  - `GET /api/health/live` → HTTP 200 `{"status":"ok"}`
  - `GET /api/health/ready` → HTTP 200 `{"status":"ready","dependencies":{"postgres":"ok"}}`
  - `GET https://preco-que-da-lucro-sage.vercel.app/api/health/ready` → HTTP 200 with the same ready body.
- Rollback candidate: `dpl_3zbrc9hxuFff91V4LwgQAy5iXx1c` (`main@ef7568e`).

## Neon

- Project `damp-forest-57346541`; production branch `br-snowy-violet-aymcvvvv` is `ready` and `default`.
- Branches: production (ready/default), `ci-fixture-base` (archived), `develop` (archived). No PR branch was left behind.
- `select count(*)::int as applied from drizzle.__drizzle_migrations` → **20**; latest `created_at` `1789698474294`.
- Release range `ef7568e..21a6089` has no `drizzle/` path. Production is at the release's migration level (20/20); the local uncommitted `0020_runtime_delete_expenses` is outside the release.
- The Vercel readiness probe reports `postgres: ok`, proving the deployed app reaches the production Neon branch.

## Evidence files

- `captures/health.txt`: exact health response bodies and alias probe.
- `captures/vercel-deployment.txt`: deployment identity and aliases.
- `captures/neon-production-migrations.txt`: SQL and migration count.
