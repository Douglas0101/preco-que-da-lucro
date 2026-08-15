# Evidência local do cutover P0 — 2026-08-12

Este snapshot registra somente o que foi comprovado no branch
`codex/p0-cutover-no-supabase`. Ele não substitui o dry run no Neon develop nem
o relatório de reconciliação da origem.

## Gates aprovados localmente

| Gate                           | Resultado                                                    |
| ------------------------------ | ------------------------------------------------------------ |
| Static runtime cutover         | sem SDK, Auth, imports ou variáveis Supabase no runtime      |
| Format, lint e typecheck       | verde                                                        |
| Testes unitários/regressão     | 197 testes em 10 arquivos, todos verdes                      |
| Build de produção              | verde e sem warnings não registrados                         |
| Bundle entry                   | 231.369 bytes minificados                                    |
| Grafo inicial                  | 448.350 bytes minificados, budget de 500.000 respeitado      |
| `npm audit --audit-level=high` | verde; 4 moderadas transitivas do `drizzle-kit` documentadas |

O frontend autentica exclusivamente pelo Better Auth em `/api/auth/*`; a
sessão é enviada por cookie `HttpOnly` e não há middleware que anexe bearer
token. O E2E agora cria usuário, tenant pessoal e fixtures no PostgreSQL
efêmero, autentica pela UI e verifica que nenhum token aparece em Web Storage.

As migrations anteriores foram movidas para `docs/archive/supabase/` e não
participam do build ou runtime. A única referência operacional à origem é
`SUPABASE_MIGRATION_DATABASE_URL`, consumida pelo export read-only de uso único.

## Gates ainda externos

- execução de migrations e E2E no PostgreSQL efêmero do GitHub Actions;
- dry run e reconciliação no Neon develop;
- validação de login Google com client/callback do ambiente;
- envio real de confirmação e recuperação pelo domínio validado no Resend;
- export final da origem, cutover de secrets e smoke em manutenção/read-only.

Sem essas credenciais não há autorização para migrar dados, ativar produção ou
abrir o PR final `develop → main`.
