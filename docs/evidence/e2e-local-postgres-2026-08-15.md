# Evidência — PostgreSQL 17 local e E2E — 2026-08-15

## Base e isolamento

- Checkout: `codex/local-dev-postgres`, SHA
  `71b0dc14de2b43bd606e122695cd97bb0c1eb5f0`.
- A base usada para a prova era `develop` em `a03d29d`, merge do PR #12.
- Depois da prova, o PR #13 foi mergeado em `develop` no commit
  `c232141726baf95285cac796a653905a396af77e`.
- Banco utilizado exclusivamente no container `preco-que-da-lucro-postgres`,
  `postgres:17-alpine`, em `127.0.0.1:5432`.
- O diretório não versionado preexistente `.worktree-pr7-sonar/` foi
  preservado; não houve alteração rastreada durante os testes.

## Sequência executada

| Etapa                                              | Resultado                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `docker compose up -d --wait`                      | PostgreSQL saudável                                                                               |
| `npm run e2e:prepare`                              | migrations e fixture Better Auth/tenant/produto/chat preparadas                                   |
| `npm run build`                                    | aprovado; bundle e warnings gerados                                                               |
| `npm run db:test` com `EXPECTED_POSTGRES_MAJOR=17` | aprovado: migration zero, constraints, RLS, P1, cross-tenant, rollback, Better Auth, tools e chat |
| `npm run preview -- --host 127.0.0.1 --port 4173`  | preview ouvindo em `http://127.0.0.1:4173`                                                        |
| `npm run test:e2e`                                 | **32 passed** em aproximadamente 1,1 minuto                                                       |

Após o merge, o workflow remoto `UI stack` do push para `develop` também
terminou com `success` no SHA `c232141726baf95285cac796a653905a396af77e`:
[run 31897480841](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/31897480841).

Os 32 testes correspondem aos oito cenários de `e2e/ui-stack.spec.ts` nos
projetos Chromium, Firefox, WebKit e mobile Pixel 7. A execução confirmou
acessibilidade sem violações críticas/sérias, autenticação, autorização 401/403,
sessão HttpOnly, isolamento de membro, simulações, diagnóstico e tratamento de
falha financeira.

## Nota ambiental do WebKit

Chromium, Firefox e mobile passaram na primeira matriz. O WebKit inicialmente
não iniciou porque o host Zorin não possuía `libavif.so.16`; a instalação oficial
`npx playwright install --with-deps webkit` pediu senha `sudo` e foi interrompida.
Para concluir a prova local, `libavif16`, `libgav1-1` e `libyuv0` foram apenas
extraídos em `/tmp/preco-avif.npZqmW` e pré-carregados durante o Playwright.
Nenhum pacote foi instalado globalmente e nenhum arquivo do repositório foi
alterado. Com esse isolamento, os oito testes WebKit passaram.

O primeiro `npm run test:e2e` automatizado também encontrou `EPERM` no pipe IPC
do `tsx` dentro do sandbox. Seed, build e preview foram então executados
explicitamente, e a mesma rotina `npm run test:e2e` foi repetida contra o
preview validado no mesmo contexto elevado, resultando em 32/32.

## Limites

Esta é evidência local contra PostgreSQL 17. Ela não comprova projeto/branch Neon,
URLs pooled/direct, migração Supabase, reconciliação, OAuth Google, Resend,
backup/restore ou cutover. O estado de credenciais externas continua bloqueado.
