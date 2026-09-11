# Correção de produção — env Vercel × Neon (CP-1) — 2026-09-10

Restauração da produção `preco-que-da-lucro-sage.vercel.app` depois da publicação
de `main` @ `c2c84f6` que subiu sem `DATABASE_URL` utilizável (ver
`docs/evidence/verificacao-producao-2026-09-10.md`). Operação de dashboard
executada de forma autônoma na sessão do navegador do mantenedor; valores de
segredos nunca foram lidos nem impressos (apenas nomes, escopos e tamanhos).

## Cadeia causal real (4 elos)

O sintoma inicial (`DATABASE_URL não configurada`) mascarava segredos vazios em
cadeia. Cada elo só se revelou após corrigir o anterior, pelos runtime logs:

| #   | Sintoma no `/api/auth/get-session`                          | Causa                                       | Correção                                                                                                                                                           |
| --- | ----------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `DATABASE_URL não configurada`                              | Secret `DATABASE_URL` sem valor útil        | re-salvo com a URL pooled de produção (148 chars, `-pooler`, role `neondb_owner`, `sslmode=require`), validada antes por conexão read-only local (`select 1` → OK) |
| 2   | `DATABASE_DRIVER deve ser neon-serverless ou node-postgres` | Secret `DATABASE_DRIVER` com valor inválido | re-salvo como `neon-serverless` (contrato do runtime Vercel; `node-postgres` é do caminho `node-server`/Hostinger)                                                 |
| 3   | `BETTER_AUTH_URL é obrigatória em produção`                 | Secret `BETTER_AUTH_URL` vazio              | re-salvo como `https://preco-que-da-lucro-sage.vercel.app` (origem, sem path)                                                                                      |
| 4   | `BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres`      | Secret `BETTER_AUTH_SECRET` vazio           | rotacionado com 48 bytes aleatórios (64 chars base64url); seguro pois não havia sessão válida (auth nunca funcionou em produção)                                   |

Evidência da cadeia: runtime logs do projeto em 2026-09-11 02:44–02:57Z; o
`ready` passou a 200 já no elo 2 (DB), e o auth só ficou 200 após o elo 4.

## Remoção de segredos administrativos do escopo web

Removidos do escopo Production and Preview (via menu → Delete → confirmação
com checkbox), conforme H-11/H-14 do `docs/runbooks/a4-matriz-hipoteses.md`:

- `DATABASE_ADMIN_URL`
- `SUPABASE_MIGRATION_DATABASE_URL`
- `MIGRATION_APPLY`
- `MIGRATION_ALLOW_UPSERT`
- `MIGRATION_REPORT_PATH`

Consequência operacional registrada: esses valores passam a ser fornecidos **em
execução** pelo dono humano nos fluxos que os exigem (V2b
`scripts/m02-v2b.mjs`, migração sancionada `scripts/db/migrate.ts`), como os
runbooks já determinavam. O secret homônimo do GitHub
(`neon-readiness.yml`) não foi tocado.

Fora do escopo desta rodada (pendências registradas): `DATABASE_URL_UNPOOLED`
em Production (Config, gerido pela integração Neon, "Needs Attention"),
`DATABASE_DRIVER` explícito (valor agora correto), `NEON_AUTH_BASE_URL` /
`VITE_NEON_AUTH_URL` (segunda implementação de auth, aguarda ADR de AUTH-001).

## Deploys

Quatro redeploys de produção do mesmo commit `main` @ `c2c84f6`, todos Ready
(~25–30 s), nomes de deployment registrados pelo painel:

1. `Redeploy of 3GArcic1H` — DATABASE_URL → ainda 503 (elo 2 pendente)
2. `Redeploy of DRsVCHb5A` (`preco-que-da-lucro-f6zbpvvt`) — driver → `ready` 200 às 02:49:05Z
3. `Redeploy of HdA6dgfnQ` — BETTER_AUTH_URL → auth ainda 500 (elo 4 pendente)
4. redeploy final — BETTER_AUTH_SECRET → verificação verde

Critério da evidência anterior atendido em **2026-09-11 02:59:54Z**:

| Prova                       | Resultado                                                                   |
| --------------------------- | --------------------------------------------------------------------------- |
| `GET /api/health/ready`     | **200** `{"status":"ready","dependencies":{"postgres":"ok"}}`               |
| `GET /api/health/live`      | **200**                                                                     |
| `GET /api/auth/get-session` | **200** com corpo `null` (sem sessão; não é mais 500)                       |
| Runtime logs                | erro `request.failed` deixa de ocorrer; `health.readiness_failed` encerrado |

## Snapshot nativo (pré-escrita)

Não houve escrita no banco nesta rodada (apenas mudanças de env + redeploy). O
snapshot manual do Neon continua **um só** (`snap-tiny-smoke-ayc382ji`, nome
`pre-a4-prepurge-20260905`, válido até 2026-10-10) porque o plano Free limita a
1 snapshot manual — a criação de um novo retornou `422 snapshots limit exceeded`.
**Antes de aplicar a migration 0011 em produção**, decidir com o mantenedor:
rotacionar o snapshot único (apagar o antigo) ou aceitar o ponto de recuperação
vigente; PITR cobre 6 h.

## Verificação pós-correção (pendências)

- Login ponta a ponta com usuário real ainda não exercitado; e-mail de
  verificação/reset exige `RESEND_API_KEY`/`AUTH_EMAIL_FROM` válidos (não
  verificados nesta rodada) e login social exige `GOOGLE_CLIENT_*` (opcional).
- A migration 0011 permanece **não aplicada** em produção (journal 11/11); o
  runtime atual conecta como `neondb_owner` (BYPASSRLS), então a política não o
  afeta. Aplicação futura somente pelo caminho sancionado com snapshot.
- `diretrizprecifica.com` continua servindo outro site; `BETTER_AUTH_URL` aponta
  para o domínio Vercel de produção. Mudança de domínio exige nova rodada de env.
