# Deploy full — Vercel + Neon (2026-10-27)

## Release

- PR: #72 (`develop` → `main`), merged at `2d309ffba2146d26382ef1751bece21806922b49`.
- Required by the main ruleset: `verify-release` SUCCESS and `scan + cobertura` SUCCESS (Sonar CE).
- Additional observations (not release gates): Neon ephemeral branch + RLS probe SUCCESS; `main-coverage-mirror` SUCCESS is informational only — ADR-042 removed it as a requirement and it never grants release credit.
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

## Follow-up PR #73

- PR #73 carries `.vercelignore` and this sealed evidence package from `develop` to `main`.
- The `.vercelignore` prevents the Vercel archive from uploading `.artifacts` (Playwright CDP sockets),
  `.playwright-mcp`, `test-results`, `docs/evidence`, `node_modules`, `.output` and `.vercel`.
- No runtime code changes in this PR.

## Checklist anti-vacuoso (item a item)

| #   | item                                   | demonstração neste pacote                                                                                                                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | N/A — pacote operacional de publicação, sem correção de código; o controle negativo do gate é o próprio `verify-release` do PR #72, que reprova em qualquer regressão de teste. |
| 2   | Fronteira nas duas direções            | N/A — não há limite/constante de código neste pacote.                                                                                                                           |
| 3   | Identidade, não cardinalidade          | Deployment identificado por `dpl_7LAMQDiquHuYVr6x4WnLnPh9fFxr` e SHA `2d309ff…`, não por contagem; migration identificada por `hash=439a98…`.                                   |
| 4   | Proibido exit-code-only                | A verificação de produção mediu HTTP 200 em `/`, `/auth` e `/inicio` e ausência de erros de runtime, além do exit dos comandos.                                                 |
| 5   | Proibido sleep fixo como sincronização | N/A — a promoção e o alias foram verificados por leitura de estado (`list_aliases`), não por espera cega.                                                                       |
| 6   | Sem valor degenerado na identidade     | Deployment ID, SHA e migration hash são valores distintos e serializáveis; nenhum campo é `undefined`.                                                                          |
| 7   | Precondição de estado compartilhado    | Branch `production` verificada em estado `ready` antes e depois da migration; as três branches permanentes foram inventariadas.                                                 |
| 8   | Sentinela real por cenário             | Os três caminhos (`/`, `/auth`, `/inicio`) foram consultados no domínio de produção real, não inferidos.                                                                        |
| 9   | Fingerprint de revisão                 | SHA do deployment = `2d309ffba2146d26382ef1751bece21806922b49`, igual ao `main`; evidência em `captures/vercel-deployment.txt`.                                                 |
| 10  | `checked === discovered`               | `MANIFEST.sha256` lista todos os arquivos do pacote; nenhuma allowlist de legado.                                                                                               |
| 11  | S6 adversarial de contexto limpo       | Ver §S6 abaixo; 2 achados P2 corrigidos, 0 REJECTED, 0 UNVERIFIABLE.                                                                                                            |
| 12  | Falha alta (fail-closed)               | A publicação só avançou com `verify-release` e `scan + cobertura` verdes; ausência de erro de runtime foi medida, não presumida.                                                |
| 13  | Isolamento de bancada assertado        | Nenhuma fixture de produção foi criada; a única escrita em produção foi o `GRANT DELETE` e sua linha de bookkeeping.                                                            |
| 14  | Todo check impresso tem gate e captura | `captures/vercel-deployment.txt` e `captures/neon-post-migration.txt` registram os valores medidos.                                                                             |
| 15  | Run de CI atado ao commit selado       | PR #72: `verify-release` e `scan + cobertura` SUCCESS no SHA `2d309ff`; PR #73 repete a matriz no SHA `90fcda3`.                                                                |
| 16  | Descoberta multi-sítio                 | Inventário das branches Neon por `list_branches` (3 permanentes) e dos checks por `statusCheckRollup`; nenhum sítio fixo presumido.                                             |
| 17  | Precondição de estado ambiente         | O pacote declara que a validação autenticada de produção não foi executada por ausência de credenciais autorizadas; o teste manual fica com o dono.                             |

## Auto-verificação pré-S6

- KPI `capturados pelo autor / total`: **0 / 2**.
- Os dois achados (checklist ausente e `main-coverage-mirror` rotulado como gate obrigatório) foram
  capturados pelo S6 adversarial (Codex) e corrigidos neste pacote.

## S6 ADVERSARIAL

| claim                                                   | veredicto | tratamento                                                                                            |
| ------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| "Pacote de evidência completo"                          | CORR      | Checklist, KPI e seção S6 adicionados.                                                                |
| "`main-coverage-mirror` é check obrigatório de release" | CORR      | Reclassificado como observação informacional; apenas `verify-release` e `scan + cobertura` são gates. |
| "Deploy de produção corresponde ao SHA de `main`"       | ACEITO    | `dpl_7LAMQDiquHuYVr6x4WnLnPh9fFxr` + SHA `2d309ff…`.                                                  |
| "Neon `production` alinhado ao schema do repositório"   | ACEITO    | 21 migrations; `app_runtime` com `DELETE` em `expenses`.                                              |
| "Fluxo autenticado validado em produção"                | N/A       | Teste manual reservado ao dono; nenhuma credencial de produção usada.                                 |

- CORR: 2 · N: 0 · REJECTED: 0 · UNVERIFIABLE: 0.

## Follow-up redeploy (PR #73)

- PR #73 merged at `a42f2adc40d00d1ea7f1539b125c4ed1ef517592` (merge commit).
- New production deployment: `dpl_Agfv4TXcA6fZHszn1fwbM3qTguSc`.
- Source SHA: `a42f2adc40d00d1ea7f1539b125c4ed1ef517592` (`main`), which now tracks
  `.vercelignore` and this evidence package.
- Production alias `preco-que-da-lucro-sage.vercel.app` promoted to this deployment.
- Probes: `GET /`, `/auth`, `/inicio` → HTTP 200; no runtime errors in the observed window.
- The `Branch efêmera · migrate · integração · RLS probe · E2E` check of PR #73 was cancelled
  by the workflow timeout (30 min) while `npx playwright install --with-deps` was still installing
  OS packages from the apt mirror. It is not a required check under ruleset `24333849`; the
  required `verify-release` (full Playwright matrix) and `scan + cobertura` passed. The cancelled
  run is not counted as evidence for or against the code.
- Evidence capture: `captures/vercel-followup.txt`.
