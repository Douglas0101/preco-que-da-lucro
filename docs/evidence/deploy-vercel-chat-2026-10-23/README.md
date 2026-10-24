# Deploy Vercel + Neon — chat 2026-10-23

## Resultado

- `main`: `cf910bf4754b0097c7bdae653d476cbd9422cdc4` (PRs #66 e #67).
- Deployment: `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4`.
- URL: `https://preco-que-da-lucro-kcxoavfay.vercel.app`.
- Target: `production`; estado: `READY`.
- Aliases: `preco-que-da-lucro-sage.vercel.app`, `preco-que-da-lucro-douglasultimatesouza-5127s-projects.vercel.app` e `preco-que-da-lucro-git-main-douglasultimatesouza-5127s-projects.vercel.app` → `dpl_HfDw...`.
- Health: live 200 `{"status":"ok"}`; ready 200 `{"status":"ready","dependencies":{"postgres":"ok"}}`; alias `sage` ready 200.
- Runtime: 0 erros no período consultado; logs de health 200. CSP permanece report-only.
- Neon produção: 20 migrations aplicadas; release sem `drizzle/`.

## Gates

| Gate                      | Evidência                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| PR #66 `verify-release`   | run `40018576143` attempt 2, success, 8m24s, matriz completa                 |
| PR #66 `scan + cobertura` | run `40018575998`, CE 86.6%, security 1, releasePolicy OK                    |
| PR #67 `verify-release`   | run `40025352913` attempt 2, success, 8m46s, matriz completa                 |
| PR #67 `scan + cobertura` | run `40025352932`, ADR-044 `NOT_APPLICABLE` (sem delta em `src`), security 1 |
| PR #67 Neon PR            | run `40025353036`, branch/RLS/integração/E2E/cleanup success                 |
| Main CE final             | run `40028082462`, status OK, `new_coverage=82.2`, releasePolicy OK          |
| Main push `verify`        | run `40028082555`, success, auditoria high 0                                 |
| Vercel build              | `dpl_HfDw...`, READY                                                         |
| Neon production           | 20 migrations; `latest_created_at=1789698474294`                             |

## Segurança

A auditoria da `main@2f18bdd` detectou o advisory high `zod <4.6.6` (GHSA-mrhx-c7xc-m3w5). O deployment candidato `dpl_CoCB7gRSUTmwtbuDZ9N6FuTSCSrm` ficou READY sem alias; o PR #67 subiu `zod` para `4.6.7` e o deployment final foi refeito no novo SHA. `npm audit --audit-level=high` sai 0.

A CSP não foi promovida: a resposta continua `content-security-policy-report-only`, sem `unsafe-inline`. O `MessageScroller` usa atributos `style` dinâmicos no espaçador; enforcement segue o gate do ADR-043.

## Escopo não executado

Hostinger/VPS/OpenLIT/DNS não foram tocados. O site Node.js pré-existente da Hostinger tem auto-deploy em `main` (buildou `2f18bdd`), mas não é o domínio canônico e não foi promovido por este release. O E2E do Neon PR no #66 não executou por timeout de 30 min na instalação de dependências de sistema do Playwright; migrations/RLS/integração/cleanup passaram e o `verify-release` cobre o E2E da aplicação.

## Evidências

- `captures/health.txt`
- `captures/vercel.txt`
- `captures/runtime.txt`
- `captures/neon.txt`
- `captures/checks.txt`
