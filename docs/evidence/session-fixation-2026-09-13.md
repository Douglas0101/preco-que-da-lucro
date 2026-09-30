# §32 — Session fixation — 2026-09-13

- Item: §32 fixação (`docs/evidence/plan-partials-2026-09-13/part-2-banco-ci.md:52-59`)
- Branch: `ops/onda0-auth-boundaries` · base `f765406` · worktree `.worktree-onda0-auth-boundaries`
- Harness: `scripts/db/test-auth-integration.ts` (bloco novo, linhas 312-366)
- Ambiente: Postgres 17-alpine local em `127.0.0.1:5432/preco_que_da_lucro_test`; role runtime
  `app_runtime`; `DATABASE_ADMIN_URL` local; `BETTER_AUTH_URL=http://localhost:3000`; env explícito
  no processo — nenhum `.env` lido nem copiado.

## Método

1. Fixture atacante criada por SQL cru com `issuer='local:credential'` (mesmo contrato do fixture
   legado), e-mail novo em `TEST_EMAILS` e IP dedicado `198.51.100.45` em `TEST_IPS` para não
   disputar o bucket de rate limit da vítima (`/sign-in/email`, 5/min).
2. Login do atacante → cookie `S_A` (`sessionCookie` valida HttpOnly/SameSite=Lax/Path e ausência de
   `Domain`).
3. Login da vítima (fixture Maria, senha pós change-password) enviando `cookie: S_A` no header →
   `S_B`.
4. Asserções: `S_B !== S_A`; `set-cookie` da vítima não contém o token de `S_A`
   (`decodeURIComponent`); `get-session?disableCookieCache=true` de `S_A` retorna
   `attacker@example.test`; de `S_B` retorna `maria@example.test`.
5. Comentário no teste registra o limite: o Better Auth sempre cria sessão nova no login, mas não
   revoga a pré-existente; invalidação de token pré-login é promessa apenas do fluxo de
   change-password (bloco `:246-281`), que apaga todas as sessões do usuário.

## Saída

```text
$ npx tsx scripts/db/test-auth-integration.ts
Better Auth, tenant pessoal, cookie, bcrypt/scrypt, fixação de sessão: OK
exit 0
```

## Limites

- Prova o comportamento do runtime com o adapter Drizzle/Postgres deste repositório; não prova
  revogação de sessão no login (não é prometida) nem fixação via outros providers.
- Cleanup idempotente por prefixo de IP/e-mail em `cleanupFixtures`; sem valores de credencial no
  código, na saída ou neste documento (senhas aleatórias por execução).
