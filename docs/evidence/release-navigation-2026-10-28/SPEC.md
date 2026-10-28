# SPEC — Release da navegação agrupada (2026-10-28)

## Fato-fonte

`AGENTS.md` (Branching, Local quality gate, Deployment contract e Decisions and evidence),
`docs/MAPA-OPERACIONAL.md` (D4/D5/D7) e o work package
`docs/evidence/navigation-menu-2026-10-28/`. A instrução do dono foi aprovar o release completo
após o plano detalhado.

## Problema

O `develop` estava 6 commits à frente da `main` com dois blocos acoplados:

1. a navegação desktop agrupada (Início, Cadastro, Financeiro) com o `NavigationMenu` Base UI;
2. a atualização de segurança `better-auth` 1.7.2 → 1.7.14, exigida pelo audit
   (`GHSA-44jh-23m7-hpcf`) e acompanhada do ajuste do teste OAuth para `auth-state:<state>`.

Publicar sem medir cobertura nova, sem a matriz completa e sem o CE real da `main` arriscaria
quebrar auth ou bloquear a release.

## Contrato

Após a release:

1. A `main` contém o SHA `cb0b7fc` e o PR #74 mergeado.
2. O CE do PR e o CE da `main` ficam `OK` com `new_coverage >= 60%` (ADR-042).
3. A produção Vercel roda o deployment `dpl_C1H3sPiu3UHkKugoogVv9HiZNR7k`, com SHA igual ao
   `main`, e o alias `preco-que-da-lucro-sage.vercel.app` aponta para ele.
4. `/`, `/auth` e `/inicio` respondem 200; não há erro de runtime no deployment.
5. Nenhuma migration nova é aplicada; `production` permanece com 21 migrations.
6. O deployment anterior `dpl_Agfv4TXcA6fZHszn1fwbM3qTguSc` permanece como rollback.
7. O login/OAuth/dashboard/chat em produção é validado manualmente pelo dono.

## Mudanças

- Código: `src/components/app-navigation.ts`, `src/components/desktop-navigation.tsx`,
  `src/components/app-shell.tsx`, `src/components/ui/navigation-menu.tsx`.
- Testes: `src/test/app-navigation.test.ts`, `src/test/desktop-navigation.test.tsx`,
  `src/test/ui-stack.test.tsx`, `e2e/ui-stack.spec.ts`.
- Dependências: `better-auth`/`@better-auth/drizzle-adapter` 1.7.14 e `package-lock.json`.
- Teste de banco: `scripts/db/test-oauth-boundary.ts` (`auth-state:` namespace).
- Evidência: este pacote + `navigation-menu-2026-10-28`.
- Não muda: rotas, schema, RLS, env vars, CSP, drawer mobile.

## DoD

- [x] `npm run check` exit 0.
- [x] `npm run db:test` 18 suítes exit 0 em PG17 efêmero.
- [x] Cobertura global 68,96%; novos arquivos 85,7%/100%/88,9%.
- [x] Matriz local chromium+firefox+webkit+mobile 59 passed / 1 skipped.
- [x] `test:visual` 33 passed / 3 skipped; `test:e2e:hygiene` 136 passed / 4 skipped.
- [x] PR #74: `verify-release`, `scan + cobertura`, Neon RLS/E2E e mirror verdes.
- [x] CE do PR: `new_coverage 95.7%`, status OK.
- [x] CE da main: `new_coverage 82.8%`, status OK.
- [x] Deploy de produção READY com SHA `cb0b7fc`; alias promovido.
- [x] Probes 200 e zero erros de runtime.
- [ ] Smoke manual de login/OAuth/dashboard/chat (dono).

## Testes

- Unitários: modelo de navegação, `DesktopNavigation`, wrapper `NavigationMenu`.
- E2E: matriz completa, visual e higiene.
- Banco: 18 suítes contra PG17 efêmero.
- Sonar: CE do PR e da main com as condições completas preservadas.
- Vercel: probes HTTP, logs e runtime errors via MCP.

## Riscos

- `better-auth` mudou o namespace do state OAuth; o teste foi ajustado e o fluxo deve ser
  validado manualmente em produção.
- O `app-shell.tsx` não entra no LCOV; a cobertura nova medida pelo Sonar ficou em 95,7% no PR e
  82,8% na main, acima do mínimo.
- O deployment anterior permanece pronto para rollback; não há migration a reverter.

## Rollback

1. `vercel promote dpl_Agfv4TXcA6fZHszn1fwbM3qTguSc` para restaurar o SHA `a42f2ad`.
2. Confirmar alias, probes e runtime errors.
3. Se o problema for auth, o código volta a `better-auth` 1.7.2; usuários podem precisar relogar.
4. Registrar o incidente no journal e em `docs/evidence/`.
