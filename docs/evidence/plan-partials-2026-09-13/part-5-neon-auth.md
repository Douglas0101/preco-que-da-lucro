# PART-5 — Neon (branch model/lifecycle/spending) e Auth (cutover/rollback/OAuth)

**Fonte:** auditoria read-only de 2026-09-13 sobre `develop @ 83efb16`; Plano Mestre §§7.5, 12, 13.6–13.7.
**Distinção:** a branch de banco `develop` é `br-small-hill-aymcu14y` (`neon-prontidao-2026-09-13.md:64`), não a branch Git;
as branches efêmeras de PR nascem de `production` (`neon-pr-branch.yml:92`).

## §12.4 — Branch model

- Alvo: `production → develop → preview/pr-123`; hoje parent = production. `neon-readiness.yml:160-165` já usa develop
  ("Production is never a readiness target").
- Passos: (1) checar staleness develop×production via `compare_schema` (API Neon) e, se preciso, restore sancionado de develop;
  (2) trocar parent no workflow (proposta: `${{ github.base_ref == 'main' && 'production' || 'develop' }}`);
  (3) `scripts/m02-v2b.mjs:29` — default de produção permanece com comentário/norma (script aposentado) ou vira parâmetro explícito;
  (4) registrar a política de dados: produção é fixture-free 26/26 → parent-data aceitável hoje; ao surgir PII → `schema-only`
  ou mascaramento, **somente após spike** (schema-only não copia `drizzle.__drizzle_migrations` → `db:migrate` tentaria
  reaplicar e falharia; mitigar pulando migrate/semeando journal).
- Evidência `docs/evidence/neon-branch-data-policy-<data>.md`.

## §12.5 — Branch lifecycle (E2E + schema diff)

- Lifecycle existe (create/migrate/db:test/seed/RLS/cleanup `always()` com prova); faltam E2E e schema diff.
- **Schema diff (S):** step após `neon-pr-branch.yml:151-167` chamando
  `GET /projects/{id}/branches/{branch}/compare_schema?base_branch_id=<production>&db_name=neondb`; baseline produção
  (branch pós-migrate já tem as migrations do PR); diff vazio quando o PR não mexe em `drizzle/**`, artefato + comentário quando mexe.
- **E2E (M):** job com `DATABASE_ADMIN_URL` direct + `DATABASE_URL` pooled com role **`app_runtime`** (senha via
  `E2E_DB_RUNTIME_PASSWORD`/`seed-auth.ts:37-42`), `DATABASE_DRIVER=neon-serverless`, `BETTER_AUTH_*` de teste,
  `ALLOW_REMOTE_DB=<motivo>` (env-guard), `e2e:prepare`, chromium only, aquecimento `select 1`; declarar que fork/sem
  `NEON_API_KEY` dá skip (não substitui o e2e local do `ui-stack`).
- Evidência `docs/evidence/neon-branch-ci-<data>.md`.

## §12.6 — Spending guardrails

- Cleanup DONE; budget/alertas/métricas não verificados. `spending_limit` e consumption v2 exigem plano pago (H-4);
  hoje é possível inventário local (`GET /projects/{id}` → `history_retention_seconds`; `GET .../branches`).
- Passos: `scripts/m02-neon-spend.mjs` (só hostnames na saída) + operação `spend-status` em workflow manual;
  pós-H-4: configurar `spending_limit` (PUT org billing) e medir consumption v2 por projeto/branch, anexando ao artefato
  `docs/evidence/neon-spending-guardrails-<data>.md`; alerta é e-mail-only (não suspende compute) — não vender como guardrail forte.
- Depende de chave com escopo org/billing (verificar) + H-4.

## §13.6 — Cutover

- Tráfego NÃO EXISTE (H-6); freeze/sync/origem read-only são N/A por custódia (emenda :29-32).
- Preparável agora: preflight de env por **nome/estado** (sem valor) reusando `auth-policy.ts:35-94`; probes canônicos
  (live/ready/get-session + controle negativo de origem); procedimento de rollback app-level (R3) e ensaio no preview;
  templates de assinaturas (H-3/H-5) e P9; snapshot <24 h na janela.
- Humano: H-6 (Firefox env + redeploy + `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS`), D-0 (domínio), H-3/H-5, P9.
- Nunca medir troca de auth pelo `get-session` isolado (probe fraco — `dia-d:202-210`).

## §13.7 — Rollback / PITR

- PITR atual 6 h (`neon-prontidao-2026-09-13.md:47-52`) viola §16.6 (≥7 d) — **BAK-01b = H-4**; memo v2 completo
  (`neon-pitr-memo-2026-09-12.md`).
- Passos agora: memo v3 com endpoints oficiais (`PATCH /projects/{id}` `history_retention_seconds`; máx. por plano) e
  `scripts/m02-pitr-check.mjs` (GET projeto → janela) + operação `pitr-status`.
- Pós-H-4: upgrade Launch + configurar 7 d (o default pago é 1 d), medir e anexar; drill de PITR **sem tocar produção**
  (projeto/branch descartável; PITR só restaura branches raiz e sobrescreve a branch) com marcador + reconciliação +
  `m02:backup-verify`; ou P9 assinada (exceção) — não descrever como conformidade.
- `0010_to_0009_down.sql` permanece LOCKED; rollback pós-tráfego é snapshot/PITR, nunca down-migration.

## AUTH-005 — OAuth runtime

- Credenciais: `GOOGLE_CLIENT_ID/SECRET` (`auth-policy.ts:84-94`; provider condicional `auth.server.ts:56`); botão
  "Continuar com Google" sempre renderizado (`auth.tsx:173-181`) mesmo sem provider (decisão de UX pendente).
- **A+B (fecháveis sem credenciais reais):** teste `scripts/db/test-oauth-boundary.ts` com credenciais dummy →
  URL de autorização contém `state`, PKCE S256, `redirect_uri` exato `${BETTER_AUTH_URL}/api/auth/callback/google`,
  scopes; `verifications` com expiração ~10 min; callback com state forjado → erro sem sessão; POST com `Origin`
  `https://evil.example` → 403 (usar POST: `originCheckMiddleware` retorna cedo em GET/HEAD/OPTIONS — `dia-d:202-210`).
  Estender `src/test/auth-policy.test.ts` (par completo/ausente).
- **C (opcional, M):** e2e com provider fake (preload roteando Google/JWKS para stub) — acoplado a internals do better-auth.
- **D (humano):** OAuth client real no Google Cloud com redirect do canônico; rodar o mesmo teste contra o provider real.
- Evidência `docs/evidence/oauth-boundary-<data>.md`.

## Ordem

`AUTH-005 A+B → §12.5 schema diff → §12.5 E2E → §12.4 parent/política → §13.7 memo/verificação → §12.6 scaffolding → §13.6 preparação`.
Caminho crítico do dia-D: **H-4/P9** e **H-6**; §12.x não bloqueiam tráfego.
