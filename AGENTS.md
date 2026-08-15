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
