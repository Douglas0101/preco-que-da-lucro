# SPEC — deploy Vercel + Neon da release 2026-10-23

## Fato-fonte

- PR `#65` (`release: Onda 1, CSP WebKit fix and dependency security floor`), merge `21a6089aa3873c3b66a70cc596a100d91f3954db`.
- Gate obrigatório da `main`: run `39907868129`, CE `aca6a09a-5adf-4e17-946b-e001821035b7`, `new_coverage=81.0`.
- Evidência de release: `docs/evidence/agent-state/PROGRESS.md` (L989–L992).

## Problema

A release precisava ser publicada na Vercel a partir do SHA exato de `main` e o banco de produção precisava ser reconciliado com o nível de migrations do release, sem usar `drizzle-kit push` e sem publicar antes do CE real da `main`.

## Contrato

- O deployment de produção tem `githubCommitSha === 21a6089aa3873c3b66a70cc596a100d91f3954db`, target `production` e estado `READY`.
- Os aliases de produção resolvem para esse deployment.
- `GET /api/health/live` responde 200 com `{"status":"ok"}` e `GET /api/health/ready` responde 200 com `{"status":"ready","dependencies":{"postgres":"ok"}}`.
- A branch Neon `production` está `ready`/`default`, com 20 migrations aplicadas e sem migration no range `ef7568e..21a6089`.
- O WIP não commitado (incluindo `0020_runtime_delete_expenses`) não é publicado nem aplicado.

## Mudanças

- Publicação manual de `dpl_AYh62JKPhjjrixJgEGbe4MuTTkzE` via `gitSource` no SHA exato.
- Promoção do deployment para os aliases de produção.
- Registro de evidência em `README.md` e `captures/`.
- Nenhuma alteração de código de aplicação, migration ou CSP.

## DoD

- [x] CE da `main` OK em `new_coverage>=60` (81.0) e releasePolicy OK.
- [x] `verify-release` do PR verde na matriz completa.
- [x] Deployment `READY` no SHA exato.
- [x] Aliases `sage`, projeto e `git-main` apontando para `dpl_AYh62JKPhjjrixJgEGbe4MuTTkzE`.
- [x] Health live/ready 200 com `postgres: ok`.
- [x] Neon produção com 20 migrations e nenhum path `drizzle/` no range.
- [x] Evidência selada com `MANIFEST.sha256`.

## Testes

- `GET /api/health/live` e `/api/health/ready` no deployment e no alias `sage`; respostas em `captures/health.txt`.
- Leitura autenticada do deployment/aliases (`get_deployment`, `get_alias`) e contagem de migrations no Neon (`run_sql` read-only).
- Controle negativo de escopo: `git diff --name-only ef7568e..21a6089 -- drizzle` vazio; a migration local `0020` permanece fora.

## Riscos

- `main-coverage-mirror` segue `NO-VERDICT` porque o artefato `coverage-lcov` da run main `38508788726` expirou (retenção de 7 dias); não é check obrigatório e não aprova `main`.
- `SonarCloud Code Analysis` preserva o ERROR do preset de 80% no PR (60.0); o ADR-042 aplica o mínimo de 60 e o CE da `main` está OK em 81.0.
- Alertas Dependabot de `vite` podem permanecer abertos até o próximo rescan; `main` fixa `8.2.4` e o audit high está em zero.
- O `@shadcn/react` usa estilos inline para o espaçador do scroll; a CSP de produção está em `report-only` e a promoção para enforcement exigirá uma decisão separada.

## Rollback

Reverter os aliases para `dpl_3zbrc9hxuFff91V4LwgQAy5iXx1c` (`main@ef7568e`). Não há migration a desfazer; a branch de produção permanece em 20 migrations.
