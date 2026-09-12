# Cutover Neon T-0 — aplicação da migration `0011_auth_rls_normalization`

- **Data:** 2026-09-12 · **Janela de freeze declarada:** 2026-09-12T02:05:00Z → 04:05:00Z (M02-D-009)
- **Autorização:** janela aprovada pelo operador; assinatura G1 transcrita por delegação explícita do operador (registro de auditoria no ledger e no próprio memo).
- **Escopo:** aplicar a migration pendente em Neon production (11/12 → 12/12) pela única via sancionada (`cutover-window`), garantir membership `app_runtime` e revalidar o substrato. Nenhuma outra escrita.

## Resultado

| #   | Passo                                                     | Resultado                                                                                                                                                                                        | Evidência                                                            |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | `m02:readiness` pré-execução                              | 7/8 (apenas `g1-assinada` pendente + `substrate-smoke` pré-migração)                                                                                                                             | `readiness-final.raw.txt`                                            |
| 2   | **`npm run db:migrate`** (guard `ALLOW`/`cutover-window`) | **exit 0 — "Migrations PostgreSQL aplicadas com sucesso"**                                                                                                                                       | guard ALLOW no `readiness-final.raw.txt`? Não — ver nota; log abaixo |
| 3   | `m02:role-membership --kind cutover-window`               | exit 0 — `has_set_membership: false → true`; `app_runtime` sem superuser/BYPASSRLS                                                                                                               | `role-membership-t0.md` / `.json`                                    |
| 4   | `npm run smoke:substrate`                                 | **PASS 7/7** (`postgres-major`, `journal-count` **12**, `journal-hashes` **12 reconciliados**, `app-runtime-role`, `tenant-tables-rls` 20/20, `accounts-issuer-null`, `production-fixture-free`) | `smoke-substrate.raw.txt`                                            |
| 5   | `m02:readiness` pós-migração                              | **PASS 8/8**                                                                                                                                                                                     | `readiness-final.json`                                               |

**Log de allow do guard (db:migrate):**

```json
{
  "guard": "env-guard",
  "result": "ALLOW",
  "path": "cutover-window",
  "script": "db:migrate",
  "env": "DATABASE_URL",
  "freezeStart": "2026-09-12T02:05:00Z",
  "freezeEnd": "2026-09-12T04:05:00Z",
  "motivo": "cutover A4 T-0: aplicar 0011_auth_rls_normalization na janela declarada (M02-D-009)"
}
```

Saída do runner: `Migrations PostgreSQL aplicadas com sucesso.` (exit 0, ~30 s).

## Proteções de rollback vigentes

- Snapshot do dia (trio sancionado): `.artifacts/backup-drill/2026-09-11-cutover2/` — `dump.pgc` 121.997 B, `sha256=29aa1ab264d4862e…`, `read_only: true`, `created_at 2026-09-11T11:36Z`.
- Snapshot nativo Neon: `snap-tiny-smoke-ayc382ji` — válido até **2026-10-10T23:59:59Z**.
- Guard de issuer: `drizzle/rollback/0010_to_0009_down.sql` permanece **LOCKED** (rollback pós-tráfego = snapshot, nunca down-migration).

## Estado resultante

- **Neon production: 12/12 migrations** aplicadas (journal reconciliado).
- Role `app_runtime` com membership `SET OPTION` garantida (idempotente).
- Tráfego de aplicação: **ainda NÃO EXISTE** — o deploy/homologação hPanel e a janela A5 continuam pendentes.
- Nenhuma outra configuração do Neon foi alterada (schema, dados, auth).

## Pendências na trilha de produção

1. **hPanel**: criar o Node Web App (preview), preencher env vars (aguarda `/tmp/hpanel-secrets.env`), executar 11/11 e só então domínio/SSL.
2. **A5**: carimbos `deployed_at`/`smoke_passed_at` e vigilância 0h/24h/72h após o deploy.
3. Reconciliação T+ (production × legacy): credenciais legacy desconhecidas — dono humano (D2 fechado por custódia).
