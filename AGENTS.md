<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Branching

- `develop` is the daily working branch (development, engineering, cybersecurity). Direct commits are allowed and every push runs the full `ui-stack` CI.
- `main` is the release branch and the repository default. It only receives merges via PR `develop → main` with green CI. There is no active Lovable connection — this project is a source-code export for engineering work; if a connection is established later, `main` is the branch to connect.
- Never force-push, rebase, or amend commits already pushed to any published branch.
- Formal branch protection is pending GitHub Pro or a public repository; see `docs/adr/ADR-017-branching-strategy.md`.
- Whenever `main` moves ahead of `develop` (release PRs, bot PRs merged straight to `main`), merge `main` back into `develop` immediately. A `develop` that falls behind the release line redeploys stale configuration and hides drift — PR #42's Vercel fix only turned `develop` deployments green after the back-merge.

## Local quality gate (definition of done)

- Before pushing, run `npm run check` and keep it green. It chains `m02:lockfile-guard`, `check:ui-stack`, `check:no-supabase-runtime`, `format:check`, `lint`, `typecheck`, `test`, `build`, and `check:bundle`.
- The CI `verify` job (`.github/workflows/ui-stack.yml`) runs those same gates plus `db:test`, `db:check`, `npm audit --audit-level=high`, and Playwright e2e on chromium/firefox/webkit. A push that skips the local gate wastes a CI cycle; treat any red as debt, never as noise.
- **Two CI pipelines, selected by changed paths:**
  - **Heavy — `UI stack`** (`.github/workflows/ui-stack.yml`): every pull request, plus pushes to `main`/`develop` whose changed files are **not** all under `docs/evidence/**` (`paths-ignore`).
  - **Light — `CI light (docs/evidence)`** (`.github/workflows/ci-light.yml`): pushes and pull requests whose changed files are **all** under `docs/evidence/**` — runs `scripts/m02-lockfile-guard.mjs`, `scripts/m02-secrets-audit.ts` and `prettier --check` on the changed files only. It installs **no** dependencies: both scripts import node built-ins only. A mixed push (code + docs) belongs to the heavy pipeline; the light job's scope guard exits without work instead of failing.
  - Neither filter applies to code: anything under `src/**`, `scripts/**`, `.github/**` or the manifests always goes through the heavy pipeline.
- Never claim work is done with a red gate, and never delete, skip, or loosen a test, lint rule, or budget to force a green.

## Dependency discipline

- Every `package.json` change ships with a synchronized `package-lock.json` in the same commit. CI installs with `npm ci --ignore-scripts` and hard-fails (`EUSAGE`) on lockfile drift — this exact mismatch broke PR #42's install step.
- Do not assume a library is available because it is common: confirm it in `package.json`/lockfile first, and match the version and idiom already in use.

## Local database

- `npm run db:up` / `npm run db:down` manage a Docker `postgres:17-alpine` container that mirrors CI (`docker-compose.yml`); see `docs/runbooks/postgres-local-docker.md`.
- `npm run db:test` is self-contained against that container with `DATABASE_URL`/`DATABASE_ADMIN_URL` pointing at `127.0.0.1:5432` and `DATABASE_DRIVER=node-postgres`.
- Author migrations with `npm run db:generate` (drizzle-kit), validate them with `npm run db:check`, and exercise them with `npm run db:test` — always against the local container.
- Classifique toda migration no registry sidecar (`scripts/db/migration-classes.ts`) e valide com `npm run db:classify:check` (prepend do `db:test`); a política expand/contract está em `docs/runbooks/migration-safety.md`.
- `scripts/env-guard.mjs` runs as a pre-hook on dev/test/build/db commands and denies remote (Neon) targets. Never bypass it with ambient environment variables; explicit overrides may only point at `127.0.0.1`.

## Security baseline

- The Content Security Policy in `src/start.ts` is strict (`script-src 'self'`). Never add `'unsafe-inline'` or new hosts without first verifying the package's actual runtime behavior in its published dist and documenting that evidence in the PR. (PR #42 lesson: `@vercel/analytics` injects an external same-origin script via DOM — the strict CSP already covered it, and the proposed relaxation was reverted.)
- Keep `m02:secrets-audit`, `m02:boundaries`, and the env guard green; they are contract, not decoration.
- Never commit secrets: `.env` stays local and gitignored; deployments read from the platform's env store.

## Deployment contract (Vercel)

- `vite.config.ts` selects the Nitro preset by environment: `"vercel"` when `VERCEL=1` (emits the Build Output API to `.vercel/output`), `"node-server"` otherwise (`npm start` serves `.output/server/index.mjs`; local, CI, and Hostinger keep the Node server output). Never hardcode one preset for every target.
- Settings that live only in the Vercel dashboard (install/build commands, env vars, domains) are out-of-repo drift. A custom Install Command replaces `npm ci` entirely — a stray project failed every deployment that way and polluted PR checks until deleted. Record every dashboard-side change in `docs/evidence/`.
- Previews build per branch/PR; production deploys only from `main`.

## Decisions and evidence

- Architectural changes require a new ADR in `docs/adr/`, following the `ADR-0XX-kebab.md` sequence (latest: ADR-028, **proposta/draft** — pendente de ratificação; último ratificado: ADR-027). Read the relevant ADRs before touching an architected area.
- Operational evidence belongs in `docs/evidence/`; operational procedures belong in `docs/runbooks/`.

## Session boot and progress journal

- `docs/evidence/agent-state/PROGRESS.md` is the **session handoff**: one file, pointers only (paths, SHAs, timestamps, env **names**), never secret values and never long content. A new model reads it and resumes without agent memory.
- **Boot protocol (~30 s), in this order:** (1) read `PROGRESS.md`; (2) verify the parent-pinned marker in `EXECUTION-STATE-PROGRAM.md` (`npm run m02:state:check`); (3) check watchers and their marker files' last signal; (4) **reconcile** the world first (git refs, artifacts, deployments) — never re-execute blindly; (5) resume from the declared phase.
- **Write protocol:** record intent (`▶`) **before** any mutation and result (`✔`/`✘`) **after**, append-only. An orphan intent means the next boot must reconcile before acting.
- **Milestones:** commit the journal at every phase boundary; the maximum acceptable loss is re-executing from the last milestone (declared, never implicit).
- **Agent memory is an invalidatable cache:** nothing that belongs in an artifact or in the journal is written to agent memory — journal + ledger are the source of truth. Memory carries at most a boot index pointing here.

## Commits

- Conventional Commits in English (`fix(ci):`, `docs(evidence):`, `chore(format):`). The message states the root cause, not the symptom.

## Long-horizon maintenance

- Keep `develop` green — a broken daily branch compounds into every PR cut from it.
- Debug systematically: reproduce → gather evidence → form one hypothesis → apply one fix → verify. No "while I'm here" changes bundled into a fix.
- Bundle budgets (`check:bundle`) and e2e hygiene (`test:e2e:hygiene`) are contracts; renegotiate them only through an explicit ADR, never silently.

## Note for agents

- When you change anything this file documents — commands, gates, contracts — update this file in the same commit.
