# SPEC — pré-produção Vercel + Neon do chat (2026-10-23)

## Fato-fonte

- PR `#66` (chat com `MessageScroller`/`Message`/`Bubble`/`InputGroup`) e PR `#67` (zod 4.6.7), ambos mergeados em `main`.
- Merge final: `cf910bf4754b0097c7bdae653d476cbd9422cdc4`.
- CE real da `main`: run `40028082462`, análise `2580598b-7591-4545-9aa2-45c602aa1169`, `new_coverage=82.2`, releasePolicy OK.

## Problema

O chat novo precisava chegar à pré-produção Vercel + Neon sem Hostinger/VPS, mantendo a CSP em report-only e sem migration. Durante o release, a auditoria da `main` detectou um advisory high novo em `zod <4.6.6` (GHSA-mrhx-c7xc-m3w5); o primeiro deployment do chat (`2f18bdd`) não foi promovido.

## Contrato

- O deployment de produção tem `githubCommitSha === cf910bf...`, target `production` e estado `READY`.
- Os três aliases de produção resolvem para o novo deployment.
- `/api/health/live` responde 200 `{"status":"ok"}` e `/api/health/ready` responde 200 com `postgres: ok`.
- `npm audit --audit-level=high` sai 0.
- A branch Neon `production` permanece em 20 migrations; o release não contém `drizzle/`.
- A CSP permanece report-only; nenhum `unsafe-inline` é adicionado.

## Mudanças

- Chat: scroller com auto-scroll/scroll anchoring, turnos acessíveis, sugestões, composer e ações de copiar.
- Dependência `@shadcn/react@0.3.1`; quatro wrappers Base UI no catálogo pinado.
- Correção de segurança `zod@4.6.7`.
- Nenhuma migration, nenhuma mudança de DNS, nenhuma ação de Hostinger/OpenLIT.

## DoD

- [x] PR #66 com `verify-release` completo e CE 86.6% no PR.
- [x] PR #67 com `verify-release` completo e ADR-044 `NOT_APPLICABLE` por não haver delta em `src`.
- [x] CE final da `main` OK em 82.2%, security/reliability/maintainability 1.
- [x] Deployment `dpl_HfDw2V5Py2gd4CKswjaDjgMrjBJ4` READY no SHA exato.
- [x] Aliases `sage`, projeto e `git-main` apontando para o novo deployment.
- [x] Health live/ready 200 e `postgres: ok` no deployment e no alias.
- [x] Runtime errors 0 no período consultado; runtime logs com health 200.
- [x] Neon produção em 20 migrations; nenhum path `drizzle/` no release.
- [x] Pacote selado com `MANIFEST.sha256`.

## Testes

- `npm run test`: 155 arquivos / 2382 testes PASS.
- `verify-release`: Chromium + Firefox + WebKit + mobile; E2E visual do chat corrigido para Firefox/WebKit.
- `npm audit --audit-level=high`: 0.
- Health e runtime logs consultados no deployment e no alias.

## Riscos

- O primeiro deployment do chat (`dpl_CoCB...`, `2f18bdd`) foi construído com zod 4.6.5 e **não foi promovido**; ficou READY sem alias.
- O E2E do Neon PR no #66 não executou porque o job estourou 30 min instalando dependências de sistema do Playwright; migrations/RLS/integração/cleanup passaram. O `verify-release` cobre o E2E da aplicação.
- A CSP segue report-only; o `MessageScroller` usa style attribute dinâmico no espaçador. A promoção para enforcement continua bloqueada pelo ADR-043/gate de soak.
- Hostinger/VPS/OpenLIT/DNS seguem deferidos; o site Node.js pré-existente da Hostinger tem auto-deploy em `main`, mas não é o domínio canônico e não foi promovido por este release.

## Rollback

Promover o deployment anterior `dpl_AYh62JKPhjjrixJgEGbe4MuTTkzE` (`main@21a6089`) nos aliases. Não há migration a desfazer; Neon permanece em 20.
