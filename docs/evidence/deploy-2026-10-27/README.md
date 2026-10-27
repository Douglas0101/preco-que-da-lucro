# Deploy full — Vercel + Neon (2026-10-27)

## Release

- PR: #72 (`develop` → `main`), merged at `2d309ffba2146d26382ef1751bece21806922b49`.
- Required checks: `verify-release` SUCCESS, `scan + cobertura` SUCCESS (Sonar CE), Neon ephemeral branch + RLS probe SUCCESS, `main-coverage-mirror` SUCCESS.
- Back-merge `main` → `develop` performed immediately after the release merge.

## Vercel

- Production deployment: `dpl_7LAMQDiquHuYVr6x4WnLnPh9fFxr`.
- Source SHA: `2d309ffba2146d26382ef1751bece21806922b49` (matches `main`).
- State: `READY`.
- Production alias `preco-que-da-lucro-sage.vercel.app` promoted to the deployment above.
- Probe: `GET /`, `GET /auth`, `GET /inicio` → HTTP 200 via `vercel curl`.
- Runtime errors: none in the observed window.
- Deployment protection: preview deployment URLs remain protected; production alias is public.

## Neon

- Branch: `production` (`br-snowy-violet-aymcvvvv`), state `ready`.
- Permanent branches only: `production`, `develop`, `ci-fixture-base`.
- Drift found before publication: production had 20 migrations and lacked
  `0020_runtime_delete_expenses`; `app_runtime` lacked `DELETE` on `public.expenses`.
- Applied the idempotent migration body (`GRANT DELETE ON TABLE public.expenses TO app_runtime`)
  and recorded the migration row (`hash=439a98d87193fd0120e2b3120453b1eb95ed3503691cbb3902bc1f78166f28d8`,
  `created_at=1792647688990`).
- Post-check: 21 migrations; `app_runtime` privileges on `expenses` = `DELETE,INSERT,SELECT,UPDATE`.

## Notes

- `.vercelignore` added to avoid uploading `.artifacts` (Playwright CDP sockets), `.playwright-mcp`,
  `test-results`, `docs/evidence`, `node_modules`, `.output` and `.vercel` to the build archive.
- No production data was used as a test target. The only production writes were the migration grant
  and its bookkeeping row.
