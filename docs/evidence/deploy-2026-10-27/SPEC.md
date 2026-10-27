# SPEC — Deploy full Vercel + Neon (2026-10-27)

## Fato-fonte

Fila de release do `EXECUTION-STATE-PROGRAM.md` e contrato de publicação do `AGENTS.md`
(seções "Branching", "Deployment contract" e "Decisions and evidence"). O gatilho foi a
instrução do dono para realizar o deploy full após o merge do PR #72.

## Problema

O release `develop` → `main` precisava ser publicado na Vercel e a branch Neon `production`
precisava estar alinhada ao schema do repositório. A inspeção read-only encontrou duas
divergências antes da publicação:

- `production` com 20 migrations e o repositório com 21 (faltava `0020_runtime_delete_expenses`);
- `app_runtime` sem `DELETE` em `public.expenses`, embora o repositório já tivesse o caminho
  de exclusão (`DrizzleExpenseRepository.remove`).

## Contrato

Após a publicação:

1. A deployment de produção da Vercel aponta para o SHA exato de `main` (`2d309ff`).
2. O alias de produção responde `200` em `/`, `/auth` e `/inicio`.
3. O readout de runtime não registra erros no deployment publicado.
4. `production` tem o mesmo conjunto de migrations do repositório (21) e `app_runtime` tem
   `DELETE` em `public.expenses`.
5. Nenhuma branch Neon adicional é criada; apenas as três permanentes existem.

## Mudanças

- `docs/evidence/deploy-2026-10-27/` (este pacote).
- `.vercelignore` no `develop` para excluir `.artifacts`, `.playwright-mcp`, `test-results`,
  `docs/evidence`, `node_modules`, `.output` e `.vercel` do arquivo de upload.
- Em produção: `GRANT DELETE ON TABLE public.expenses TO app_runtime` e o registro de
  bookkeeping da migration `0020` em `drizzle.__drizzle_migrations`.
- Nenhuma alteração de código de aplicação neste pacote.

## DoD

- [x] Deployment `dpl_7LAMQDiquHuYVr6x4WnLnPh9fFxr` `READY`, `target=production`,
      `sha=2d309ffba2146d26382ef1751bece21806922b49`.
- [x] Alias `preco-que-da-lucro-sage.vercel.app` promovido para esse deployment.
- [x] `/`, `/auth`, `/inicio` respondem `200`.
- [x] `get_runtime_errors` sem erros no deployment.
- [x] `production` com 21 migrations e `app_runtime` com `DELETE` em `expenses`.
- [x] `m02:work-package-guard` e `m02:debts-guard` verdes.

## Testes

- `curl`/`vercel curl` para os três caminhos.
- `tools.neon.run_sql` read-only para contagem de migrations e privilégios.
- `npm run m02:work-package-guard`, `npm run m02:debts-guard`.

## Riscos

- O fluxo autenticado completo em produção não foi exercitado: exigiria credenciais reais ou
  criação de usuário de teste em produção, o que o contrato proíbe.
- A promoção foi manual, conforme o contrato de publicação condicional.
- O alias de produção é público; previews continuam protegidos.

## Rollback

- Reverter o alias de produção para o deployment anterior (`dpl_GcsE1qJy7zSV6rvkTUZfS35m3iHc`).
- Reverter o `GRANT DELETE` com `REVOKE DELETE ON TABLE public.expenses FROM app_runtime` e
  remover a linha de bookkeeping `0020` se necessário.
- O código de `main` permanece no merge `2d309ff`.
