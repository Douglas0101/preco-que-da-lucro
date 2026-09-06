# DB-01 — purge de fixtures do Neon production + guarda 0010 recalibrada + smoke re-baseline

- **Data:** 2026-09-06 (UTC) · **Rodada:** pré-A4 burn-down · **Autorização:** A3 (purge somente após snapshot; guarda recalibrada com re-drill)
- **Artefatos:** `rehearsal-dry-run.json`, `rehearsal-apply.json`, `production-dry-run.json`, `production-apply.json`, `smoke-post-purge.json` (neste diretório)

## 0. Matriz requisito → verificação → estado

| Requisito (fonte)                      | Verificação                                                                                                                                                                   | Estado    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Purge só após snapshot (A3)            | dump externo imediato (sha256 `1e7aa351…`, 135.416 B, 2026-09-06T01:52:17Z) + snapshot nativo `snap-tiny-smoke-ayc382ji` (válido até 2026-10-10) + drill de restore do PR #32 | CONFORME  |
| Purge restrito a markers de fixture    | script fail-closed por marcador `@preco-que-da.test`; abortaria com qualquer usuário real                                                                                     | CONFORME  |
| Recontagem pós-purge = 0 por categoria | inventário read-only independente + smoke                                                                                                                                     | CONFORME  |
| Guarda 0010 calibrada para o futuro    | predicado `count(accounts) > 0` bloqueia down; re-drill antes/depois                                                                                                          | CONFORME  |
| Re-drill obrigatório da guarda         | executado em scratch restaurado (ver §3)                                                                                                                                      | CONFORME  |
| Production permanece fixture-free      | check novo `production-fixture-free` no `smoke:substrate` (gate contínuo)                                                                                                     | CONFORME  |
| Re-seedar fixtures em production       | proibido — recriaria DB-01; seeds pertencem a branches efêmeras/locais                                                                                                        | NORMATIVO |

## 1. Snapshot pré-purge (rede de segurança A3)

- **Dump externo:** `pg_dump -Fc` via container `postgres:17-alpine`, gravado em
  `.artifacts/purge-drill/20260906T015217Z/dump.pgc` (gitignored),
  135.416 bytes, sha256 do arquivo em disco
  `1e7aa3515269815432ae94aae7f75bfed77ffd23c9710896f216753305809440`,
  capturado 2026-09-06T01:52:17Z, minutos antes do APPLY.
- **Snapshot nativo Neon:** `snap-tiny-smoke-ayc382ji` (PR #32, validade
  2026-10-10) — restore verificado em branch isolada `br-floral-pond-ayltjy2t`.
- **Nota de integridade (GAP-DOC menor):** o dump do drill anterior
  (`backup-restore-drill`) tem sha256 registrado `f5659573…` no relatório, mas o
  arquivo em disco hashia diferente — tamanho idêntico (135.416 B), conteúdo
  divergente apenas no cabeçalho de timestamp do formato custom do pg_dump,
  indicando re-escrita do arquivo após o hash. Nenhum impacto de segurança: o
  snapshot deste passo foi hasheado do arquivo final em disco e o restore foi
  reprovado a partir dele (§2). Lição registrada: hash sempre do arquivo final.

## 2. Rehearsal em scratch (prova antes da produção)

Scratch `drill_purge` no Postgres 17 local (docker), restaurado do dump do §1
(`pg_restore --no-owner --no-privileges`; 2 warnings de ownership de roles Neon,
idênticos ao drill do PR #32). Conteúdo confirmado: 4 users / 4 accounts /
3 tenants — idêntico ao inventário read-only de produção.

1. **Guarda 0010 contra contas presentes:** `psql -f 0010_to_0009_down.sql` →
   `ERROR: rollback 0010 BLOQUEADO: 4 conta(s) presentes` → transação
   abortada → `ROLLBACK` → `issuer` inalterado (4 × `local:credential`).
2. **Purge dry-run:** plano = 4 usuários fixture, 3 tenants, 0 não-fixture;
   zero deletes (`rehearsal-dry-run.json`).
3. **Purge APPLY:** 34 linhas deletadas, todas fixture
   (`rehearsal-apply.json`): users 4, accounts 4, sessions 2, tenants 3,
   memberships 4, profiles 4, products 1, expenses 2, conversations 1,
   messages 1, market_prices 1, packaging 1, sales_fees 1, rate_limits 5.
4. **Guarda 0010 pós-purge:** `DO` passa → `UPDATE 0` → `COMMIT` (no-op).
5. **Forward 0010 idempotente:** 2 execuções → `UPDATE 0` / `UPDATE 0`.
6. Scratch destruído (`drop database drill_purge`; artefatos /tmp removidos).

### Falha intermediária documentada (re-drill valeu)

A primeira versão da guarda (RAISE sem transação única) foi **derrotada pelo
re-drill**: `psql` em autocommit executou o `UPDATE 4` mesmo após a exceção.
Correção: guarda + down em `BEGIN…COMMIT` único — após o RAISE, o UPDATE é
ignorado ("current transaction is aborted") e o COMMIT vira ROLLBACK.
Evidência: §2.1 refeito com a versão corrigida.

Segunda falha intermediária: o APPLY falhou com
`could not determine data type of parameter $1` — placeholders `$2`/`$3` sem
`$1` na mesma statement. Corrigido re-numerando para `$1` por statement com
casts explícitos (`uuid[]`/`text[]`). O scratch estava íntegro (rollback da
transação) e o rehearsal foi reexecutado do zero.

## 3. Purge em produção (A3)

- Dry-run em produção: plano idêntico ao rehearsal — os 4 usuários
  `*@preco-que-da.test`, 3 tenants, `non_fixture_user_count: 0`
  (`production-dry-run.json`). A guarda fail-closed confirmou ausência de
  tráfego real no momento da escrita.
- **APPLY em produção: 2026-09-06, exit 0.** Deletes idênticos ao rehearsal
  (34 linhas; `production-apply.json`). Pós: `fixture_users_remaining: 0`,
  `fixture_tenants_remaining: 0`, `users_total_remaining: 0`.
- Recontagem independente (inventário read-only): **26/26 tabelas com 0 linhas**;
  users/accounts/sessions/tenants = 0.
- `npm run smoke:substrate` em produção: **PASS 7/7** (`smoke-post-purge.json`),
  incluindo o novo `production-fixture-free`.

## 4. Guarda 0010 — novo predicado (recalibração para o futuro)

`drizzle/rollback/0010_to_0009_down.sql`:

- `count(accounts) > 0` → `RAISE EXCEPTION` e rollback da transação. Racional:
  após o purge DB-01, qualquer conta em produção é tráfego real; anular issuer
  quebraria sign-in (better-auth 1.7.x). Rollback de issuer pós-tráfego =
  **restore de snapshot** (BAK-01), nunca este arquivo.
- Execução automática permanece proibida; pré-requisitos documentados no
  próprio arquivo (reconciliação, versão better-auth, entrada no ledger).
- Com zero contas, down é no-op e o forward 0010 permanece idempotente —
  comprovado em §2.4/§2.5.

## 5. Limites da evidência

- O purge é irreversível por SQL; a reversão é o restore do dump §1 ou do
  snapshot nativo (drill do PR #32 provou ambos os caminhos).
- A branch de restore `br-floral-pond-ayltjy2t` (PR #32) segue existindo até o
  cleanup via workflow `neon-drill-ops` após release em `main`.
- O smoke cobre marcadores de fixture (`@preco-que-da.test`, `tenant-e2e`);
  fixtures futuras com outros marcadores exigiriam novo marcador no check.
