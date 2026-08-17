# G3 — Neon readiness — 2026-08-17

## Estado

**BLOQUEADO antes da execução do workflow.** O dry-run não foi iniciado porque
os parâmetros protegidos exigidos pelo workflow não estão configurados. A URL
pooled enviada na conversa não foi usada, armazenada ou registrada.

## Referência do ciclo

- PR: [#16](https://github.com/Douglas0101/preco-que-da-lucro/pull/16).
- Branch: `codex/p1-tanstack-query`.
- SHA validado: `5ffc15b06c9341014479d08cea07660512a7d98d`.
- Workflow planejado: `.github/workflows/neon-readiness.yml`.
- Modo planejado: `dry-run`, `confirm_apply=false`.

O arquivo do workflow está presente no branch do PR com SHA
`d7fbdb560e61c3fb8ac4f48d0beb14ff78fb8deb`, mas não está registrado no
default branch. A consulta `gh run list --workflow neon-readiness.yml` retorna
HTTP 404; o workflow Neon atualmente listado pelo repositório é somente
`neon-preview.yml`. Portanto, não existe dispatch executável desse readiness
workflow enquanto ele não estiver disponível no default branch.

## Verificação nominal sem secrets

| Escopo                       | `NEON_API_KEY` | `NEON_PROJECT_ID` | `SUPABASE_MIGRATION_DATABASE_URL` |
| ---------------------------- | -------------- | ----------------- | --------------------------------- |
| Ambiente local da sessão     | ausente        | ausente           | ausente                           |
| Secrets do repositório       | nome ausente   | nome ausente      | nome ausente                      |
| Variables do repositório     | —              | nome ausente      | nome ausente                      |
| Environment `neon-readiness` | nome ausente   | nome ausente      | nome ausente                      |

O environment `neon-readiness` existe, mas a consulta nominal retornou zero
protection rules e nenhum wait timer. A consulta de organização retornou
`404`, portanto não há evidência de configuração organizacional aplicável.

## Limite de evidência

Não houve:

- criação de branch Neon;
- obtenção de URLs direct/pooled pelo workflow;
- conexão com Neon;
- `npm run db:test` ou `npm run db:check` contra Neon;
- migration, drift, RLS, smoke ou artifact protegido;
- acesso, alteração ou cutover de produção.
- run `neon-readiness` neste ciclo; o dispatch foi impedido pelo workflow não
  registrado no default branch.

A senha embutida na URL compartilhada deve ser rotacionada/revogada antes de
qualquer conexão. A URL pooled não substitui `NEON_API_KEY`, `NEON_PROJECT_ID`
nem a URL direta administrativa.

## Desbloqueio seguro

1. Rotacionar a senha exposta no provedor.
2. Configurar `NEON_API_KEY` como secret e `NEON_PROJECT_ID` como variable no
   environment protegido `neon-readiness`.
3. Disponibilizar o workflow no default branch por mudança revisável e
   aprovada; não fazer merge automaticamente neste ciclo.
4. Configurar `protection rules`/reviewers do environment antes de qualquer
   modo `apply`.
5. Configurar `SUPABASE_MIGRATION_DATABASE_URL` somente se houver uma fonte
   legada read-only real.
6. Executar o workflow em `dry-run` e registrar os artifacts sanitizados.

## Critério de aceite

G3 só passa com branch descartável criada e removida, URLs direct/pooled
distintas, conexões reais, PostgreSQL 17, `db:test`, `db:check`, RLS,
privilégios e smoke aprovados, sem skips substantivos e sem secrets expostos.
