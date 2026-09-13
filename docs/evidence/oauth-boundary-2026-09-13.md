# AUTH-005 A+B — Boundary OAuth — 2026-09-13

- Item: AUTH-005 A+B (`docs/evidence/plan-partials-2026-09-13/part-5-neon-auth.md:60-71`)
- Branch: `ops/onda0-auth-boundaries` · base `f765406` · worktree `.worktree-onda0-auth-boundaries`
- Artefatos: `scripts/db/test-oauth-boundary.ts` (novo); `src/test/auth-policy.test.ts:39-47`
- Ambiente: Postgres 17-alpine local em `127.0.0.1:5432/preco_que_da_lucro_test`; role runtime
  `app_runtime`; `BETTER_AUTH_URL=http://localhost:3000`; credenciais Google dummy definidas apenas
  no processo do teste (nomes `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, sem valores no repositório,
  na saída ou neste documento); nenhum `.env` lido nem copiado.

## Método

1. `POST /api/auth/sign-in/social` (`provider: google`, `disableRedirect: true`) com as credenciais
   dummy → 200 com `redirect: false` e `url` de autorização. Asserções sobre a URL:
   endpoint `accounts.google.com/o/oauth2/v2/auth`; `response_type=code`;
   `redirect_uri` exatamente `${BETTER_AUTH_URL}/api/auth/callback/google`; `scope` exatamente
   `email profile openid`; `code_challenge_method=S256`; `code_challenge` base64url de 43 chars;
   `state` presente.
2. Linha correspondente ao `state` em `verifications` (consulta admin): `identifier` presente,
   `expires_at` entre 9 e 11 min, payload JSON com `oauthState` igual ao `state` e `codeVerifier`
   de 128 chars (PKCE persistido).
3. `GET /api/auth/callback/google?state=forged-state&code=forged-code` → resposta ≥ 300; quando
   redirect, `Location` contém `error=state_mismatch`; nenhum `Set-Cookie` de `session_token`.
4. `POST /api/auth/sign-in/social` com `Origin: https://evil.example` e cookie presente (o
   `originCheckMiddleware` só valida origem com cookie ou `forceValidate`) → 403 com
   `code: INVALID_ORIGIN`. POST é obrigatório: o middleware retorna cedo em GET/HEAD/OPTIONS.
5. `globalThis.fetch` instrumentado durante todo o teste: qualquer chamada externa incrementa o
   contador e lança; asserção final `outboundRequests === 0` — o state forjado falha no parse antes
   da troca de código, portanto os casos negativos não tocam o Google.

## Par de credenciais (unit)

`resolveGoogleCredentials` com par completo retorna `{ clientId, clientSecret }`; ausência total
retorna `undefined`; parcial continua lançando `/juntos/` (teste pré-existente, `:32-37`).

## Saída

```text
$ npx tsx scripts/db/test-oauth-boundary.ts
[Better Auth]: Invalid origin: https://evil.example   # log esperado da rejeição
AUTH-005 A+B: boundary OAuth (state, PKCE, redirect, scopes, origem): OK
exit 0

$ npx vitest run src/test/auth-policy.test.ts
Test Files  1 passed (1)
Tests       8 passed (8)
exit 0
```

## Limites

- Exercita a superfície do runtime com credenciais dummy; não autentica um usuário Google real —
  isso é a parte D (humana, OAuth client real no Google Cloud) e permanece pendente.
- A estratégia de state em uso é a de banco (`verifications`); o callback forjado é barrado antes
  de qualquer contato com o provider, comprovado pelo contador de fetch.
