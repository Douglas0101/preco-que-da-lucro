# Release readiness — develop → main (wave1 / P1 closeout)

Data: 2026-09-03 · Executor: sessão de engenharia (opencode) · Aprovações humanas: merge #24, cutover Neon produção (confirmados na sessão).

## Artefatos publicados

- **PR #24** (`codex/wave1-neon-native` → `develop`): merge commit `b7c98f4`.
  - UI stack `verify` **PASS** no tip do PR (run 33715494554: lint/tsc/vitest 353/353 + `db:test` completo + build + `check:bundle` + Playwright matriz chromium/firefox/webkit) e **PASS** no push a develop (run 33829965081).
  - Secretless Neon preview boundary **PASS** (run 33715494562).
  - **SonarCloud Code Analysis: FAILURE** (reprodutível em 2 tips: 32s e 53s). Projeto privado; triagem do quality gate pendente de acesso humano ao dashboard. Sem branch protection o check é advisory; o gate mandado do programa (UI stack) está verde no tip publicado. Registrado como resíduo R5-open no ledger.
  - PR #23 (draft, docs) é ancestral deste histórico e fica encerrado por substituição.

## Migrations na produção Neon (aplicadas ANTES de tráfego 1.7.2 — ordem obrigatória)

Execução: `DATABASE_ADMIN_URL=<unpooled direto>` → `npm run db:migrate` → "Migrations PostgreSQL aplicadas com sucesso." (journal 8 → **11**).

| Passo                                                                         | Antes                                                                  | Depois                                              | Veredito                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `drizzle.__drizzle_migrations`                                                | 8 (0000–0007)                                                          | **11** (0000–0010)                                  | ✓                                                                   |
| `calculation_snapshots.idempotency_key` + UNIQUE `(tenant,type,key)`          | ausente                                                                | presente (`calculation_snapshots_idempotency_uidx`) | ✓ 0008                                                              |
| Colunas FSM em `chat_conversations` (`conversation_state`,`state_updated_at`) | ausentes                                                               | presentes (CHECK `…state_check` ativo)              | ✓ 0008                                                              |
| Colunas de custo (`ai_usage`×3, `tool_executions`×2)                          | ausentes                                                               | 5/5 presentes                                       | ✓ 0008/0009                                                         |
| **0010 backfill `accounts.issuer`**                                           | `issuer_null` = **0** de 4 credential accounts (já `local:credential`) | `issuer_null` = **0**                               | ✓ no-op; **reconciliação diferença = 0** (esperado 0 / aplicados 0) |

Compatibilidade: todas as mudanças são aditivas com defaults/backfill; o código hoje publicado (better-auth 1.6.27) não é afetado por `issuer` populated nem pelas colunas novas — sem janela de quebra.

## Rollback (se necessário antes do deploy)

- Aplicação ainda **não** rodou o código 1.7.2 em produção; para reverter o schema: `drizzle/rollback/0010_to_0009_down.sql` (no-op: backfill não alterou linhas) → `0009_to_0008_down.sql` → `0008_to_0007_down.sql`. Todos verificados na cadeia `db:test` do CI (downgrade 0010→0001 + replay).
- 0008/0009 apenas adicionam colunas/índices CHECKs novos; o down remove exatamente esses objetos.

## Plano de deploy + smoke (pós-merge main; deploys Hostinger são manuais)

1. Fazer o build/deploy do conteúdo de `main` no destino de produção.
2. **Smoke de auth (1.7.2)** — na sequência, todos precisam passar:
   - Login com conta credential **antiga** (pré-importação) → 200 + sessão HttpOnly (prova do backfill/compat 1.7.2).
   - Login com senha errada → 401 genérico (não pode virar 200 nem vazar mensagem diferente).
   - Sign-out + re-login → sessão nova, cookie rotacionado.
   - Rota protegida sem sessão → redirect ao login (INV-002/§8).
3. **Reconciliação A5 (24–72h)**: monitorar `accounts` novos (todo credential account deve nascer com `issuer='local:credential'`), contagens de `rate_limits`/429 anômalas, e zero spikes de 401 pós-deploy; registrar no ledger ao fim da janela.
4. Métricas `app.*` + KPIs §46 do Plano Mestre alimentam a janela S8 B3/B4 — **S9/F10 segue bloqueado até B4**.

## Resíduos/pendências

- R5-open: triagem SonarCloud (dono da conta).
- Deploy produção (Hostinger) + smoke de login: ações manuais humanas listadas acima.
- Janela de observação 24–72h (A5) e B4 (1–2 semanas) não comprimíveis.
