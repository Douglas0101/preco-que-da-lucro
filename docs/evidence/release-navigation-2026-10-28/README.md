# Release da navegação agrupada — resultado

## Sumário

O PR #74 (`develop → main`) foi mergeado em **`cb0b7fcd5d084ce3bb594e5b7225206366f932da`** e
publicado na Vercel como **`dpl_C1H3sPiu3UHkKugoogVv9HiZNR7k`**, com o alias
`preco-que-da-lucro-sage.vercel.app`. O release contém a navegação desktop agrupada e o bump de
segurança `better-auth` 1.7.14. Nenhuma migration foi aplicada; a branch `production` permanece
com 21 migrations.

## Evidência por fase

| fase       | comando/ferramenta                | resultado                                                         | captura                                                   |
| ---------- | --------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| gate local | `npm run check`                   | exit 0                                                            | `navigation-menu-2026-10-28/captures/check.txt`           |
| banco      | `npm run db:test` em PG17 efêmero | 18 suítes, exit 0                                                 | `navigation-menu-2026-10-28/captures/db-test.txt`         |
| cobertura  | `npm run test:coverage`           | 68,96% linhas                                                     | `navigation-menu-2026-10-28/captures/coverage.txt`        |
| e2e local  | matriz completa                   | 59 passed / 1 skipped                                             | `navigation-menu-2026-10-28/captures/e2e-full-matrix.txt` |
| visual     | `npm run test:visual`             | 33 passed / 3 skipped                                             | `navigation-menu-2026-10-28/captures/visual.txt`          |
| higiene    | `npm run test:e2e:hygiene`        | 136 passed / 4 skipped                                            | `navigation-menu-2026-10-28/captures/hygiene.txt`         |
| PR #74     | GitHub checks                     | `verify-release`, `scan + cobertura`, Neon RLS/E2E, mirror verdes | `captures/pr-74.json.txt`                                 |
| CE do PR   | Sonar gate readout                | `new_coverage 95.7%`, status OK                                   | `captures/sonar-pr-readout.json`                          |
| CE da main | Sonar gate readout                | `new_coverage 82.8%`, status OK                                   | `captures/sonar-main-readout.json`                        |
| deploy     | Vercel MCP/CLI                    | `READY`, SHA `cb0b7fc`, alias promovido                           | `captures/vercel-deployment.txt`                          |
| probes     | `curl`                            | `/`, `/auth`, `/inicio` = 200                                     | `captures/probes.txt`                                     |
| runtime    | Vercel MCP                        | zero erros; auth 200 e RUM good                                   | `captures/runtime-errors.txt`                             |

## Checklist anti-vacuoso (resumo)

| #   | item                            | demonstração                                                                                       |
| --- | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo               | A cobertura caiu para 95,7% no PR sem depender do e2e; a matriz local reprova se o menu não abrir. |
| 2   | Fronteira nas duas direções     | Testes abrem e fecham Cadastro/Financeiro; `/produtos-outro` não casa com `/produtos`.             |
| 3   | Identidade, não cardinalidade   | Asserções por nome acessível, `aria-current`, `data-active` e SHA do deployment.                   |
| 4   | Proibido exit-code-only         | Probes HTTP, runtime errors e CE readout além dos exits.                                           |
| 5   | Proibido sleep fixo             | Testes usam `expect`/`waitFor`, não `waitForTimeout`.                                              |
| 6   | Sem valor degenerado            | `data-active` true/ausente, `aria-current` page/ausente, SHA exato.                                |
| 7   | Precondição de estado           | DB efêmero, preview local, branch `production` verificada antes/depois.                            |
| 8   | Sentinela real                  | Rotas reais, usuário fixture e deployment real.                                                    |
| 9   | Fingerprint                     | `cb0b7fc` no PR, main, CE e deployment.                                                            |
| 10  | `checked === discovered`        | `MANIFEST.sha256` cobre todos os arquivos deste pacote.                                            |
| 11  | S6                              | 0 REJECTED; 0 UNVERIFIABLE.                                                                        |
| 12  | Falha alta                      | PR bloqueado se CE <60%, matriz ou RLS falharem.                                                   |
| 13  | Isolamento de bancada           | PG17 efêmero; produção sem fixture.                                                                |
| 14  | Check impresso com gate/captura | Tabela acima.                                                                                      |
| 15  | Run atado ao commit             | PR #74 e main no SHA `cb0b7fc`.                                                                    |
| 16  | Descoberta multi-sítio          | Desktop, drawer mobile, auth e banco cobertos.                                                     |
| 17  | Precondição de ambiente         | Banco, envs, preview e Vercel declarados; smoke manual pendente do dono.                           |

## S6 adversarial

| claim                                            | veredito | tratamento                                                      |
| ------------------------------------------------ | -------- | --------------------------------------------------------------- |
| "Cobertura nova ≥60% sem e2e"                    | ACEITO   | CE do PR 95,7%; main 82,8%.                                     |
| "Navegação desktop agrupada e mobile preservado" | ACEITO   | Matriz completa 59 passed; teste desktop-only pulado no mobile. |
| "better-auth 1.7.14 compatível com o schema"     | ACEITO   | 18 suítes de banco e auth E2E verdes; sem migration.            |
| "Deploy de produção corresponde ao main"         | ACEITO   | SHA `cb0b7fc` no deployment e no CE da main.                    |
| "Fluxo autenticado em produção validado"         | PENDENTE | Smoke manual do dono (login/OAuth/dashboard/chat).              |

- CORR: 0 · N: 0 · REJECTED: 0 · UNVERIFIABLE: 0.

## Rollback

- Deployment anterior: `dpl_Agfv4TXcA6fZHszn1fwbM3qTguSc` (SHA `a42f2ad`).
- Ação: `vercel promote dpl_Agfv4TXcA6fZHszn1fwbM3qTguSc` e confirmar alias/probes/runtime.
- Sem migration a reverter.
