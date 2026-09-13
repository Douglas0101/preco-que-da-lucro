# V4 — Drill de restore BAK-01 (2026-09-07, CUTOVER-READY)

Fase V4 da rodada CUTOVER-READY (D0): drill de restore do caminho
`pg_dump → pg_restore` contra produção, sem tocar em produção além de
`pg_dump` read-only via DIRECT (sancionado; nenhuma escrita em produção nesta
rodada — toda escrita ocorreu exclusivamente na branch de restore isolada).

## 0. ESCOPO REDUZIDO — declaração

**Este drill valida o MECANISMO, não a metade de dados.**

- O dump foi tomado da produção Neon atual, que está **vazia**
  (fixture-free, confirmado no V2 — `dryrun-notes.md` §3). O restore portanto
  exercita o caminho completo dump→restore→reconciliação, mas com carga de
  dados zero.
- **Risco residual**: a metade de DADOS (carga legacy Supabase → reconciliação
  com linhas reais) fica **em aberto nesta rodada** e fecha no **V2b**, quando
  `SUPABASE_MIGRATION_DATABASE_URL` (read-only) existir. O mecanismo de
  reconciliação é o mesmo script-âncora (`m02-reconcile.mjs`); o que muda no
  V2b é o volume de linhas sob comparação.
- Consequência: os tempos (RPO/RTO) observados aqui são **lower bound** —
  escalam com o tamanho do dump quando houver dados.

## 1. Ambiente

- Projeto Neon: `damp-forest-57346541`
- Branch de origem do dump: **production** `br-snowy-violet-aymcvvvv`, endpoint
  DIRECT `ep-long-violet-aye9g0bn.<region>.aws.neon.tech` (mascarado;
  `DATABASE_URL_UNPOOLED` do `.env`, lido em-processo — nota operacional do
  `schema-diff-2026-09-07.md`: nunca por command substitution multi-linha)
- Branch de restore: **restore-2026-09-07** → id
  **`br-tiny-waterfall-ay6a51b9`**, criada às 2026-09-07T00:02:28Z com
  `--parent br-snowy-violet-aymcvvvv` e expiração **2026-09-07T23:59:59Z**
  (+24h, §12.5 efêmera)
- Endpoint da restore-branch (DIRECT): **`ep-jolly-grass-ayo27gsq`**, tipo
  `read_write`, `disabled: false` (confirmado via GET de endpoints, só leitura)
- Cliente dump/restore: `pg_dump`/`pg_restore` (PostgreSQL) **17.11** do
  container local `preco-que-da-lucro-postgres` (padrão do V2; binários
  ausentes no host)
- Segredos: URLs nunca impressas, nunca em argv; lidas em-processo (parse do
  `.env` e `neon connection-string` via `spawnSync`), e entregues ao container
  por stdin-script. Sessões de diagnóstico em `/tmp` (fora do repo).

## 2. Dump de produção (read-only)

- Comando (dentro do container, via `docker exec -i … sh -s` com script por
  stdin): `pg_dump -h <DIRECT> -U neondb_owner -d neondb -Fc --no-owner
--no-privileges -f /tmp/dump-prod.pgc`
- Produção recebeu **apenas leitura** (pg_dump toma ACCESS SHARE; nenhuma
  escrita emitida).
- Artefato: `/tmp/restore-drill-2026-09-07/dump-prod.pgc` (**fora do repo**,
  conforme regra da rodada)
- Tamanho: **120.757 bytes** (~118 KB — coerente com produção vazia)
- **SHA-256**: `6e5761263414c49ee4576f1f10eb91b1e2683c670896d59b0edfc74483e9ff7a`
- Timing: início 2026-09-07T00:01:46Z → fim 2026-09-07T00:02:09Z =
  **22,95 s**

## 3. Preparação da branch de restore

1. `neon branches create --project-id damp-forest-57346541 --name
restore-2026-09-07 --parent br-snowy-violet-aymcvvvv --expires-at
2026-09-07T23:59:59Z` — estado `ready` confirmado.
2. **Reset do schema** (escrita sancionada — branch isolada, NUNCA produção):
   via DIRECT da restore-branch, `DROP SCHEMA IF EXISTS public CASCADE;`
   `DROP SCHEMA IF EXISTS drizzle CASCADE;` seguido de `CREATE SCHEMA public;`
   `CREATE SCHEMA drizzle;` — objetivo: o restore não conflitar com a cópia
   já migrada que a branch herda do parent. Verificação pós-reset: 0 tabelas,
   0 rotinas nos dois schemas (2026-09-07T00:03:28Z).
3. Schemas de plataforma (`app_private`, `auth`, `neon_auth`, `pgrst`)
   **não** foram dropados (fora do escopo sancionado) — consequência
   registrada no §5.

## 4. Restore (pg_restore)

- Comando: `pg_restore -h <DIRECT da restore-branch> -U neondb_owner -d neondb
--no-owner --no-privileges /tmp/dump-prod.pgc` (lição do drill 09-05:
  `must be able to SET ROLE "neon_service"` — evitada com `--no-owner
--no-privileges`)
- Timing: início 2026-09-07T00:04:14Z → fim 2026-09-07T00:05:18Z = **63,93 s**
- Exit 1 com **erros conhecidos e esperados** (padrão do drill anterior:
  registrar e seguir). Todos os erros são de objetos dos schemas de plataforma
  que não foram dropados e que já existiam idênticos na branch (cópia do
  parent): `schema "app_private"/"neon_auth"/"pgrst" already exists`,
  `function current_tenant_id/… already exists` (app_private),
  `relation account/session/… already exists` (neon_auth), `COPY failed for
table "project_config": duplicate key` (neon_auth),
  `permission denied for schema pgrst`, e índices/constraints duplicados
  correspondentes. **Nenhum erro em objetos de `public`.**
- Verificação pós-restore (read-only, 2026-09-07T00:06:59Z): **26 tabelas em
  `public`** nos dois lados, lista de nomes idêntica, schemas
  `app_private, auth, drizzle, neon_auth, pgrst, public` idênticos.

## 5. Reconciliação (reuso nº 2 do script-âncora `scripts/m02-reconcile.mjs`)

```
node scripts/m02-reconcile.mjs \
  --source-env DATABASE_PROD_DIRECT --target-env DATABASE_RESTORE_DIRECT \
  --out docs/evidence/cutover-2026-09-07/reconciliation-restore-2026-09-07.md
```

- source = production DIRECT (`DATABASE_URL_UNPOOLED`), target = restore-branch
  DIRECT; URLs lidas em-processo e entregues ao filho via env do `spawnSync`
  (valores nunca impressos, nunca em argv). Script estritamente SELECT com
  transações `read only` + rollback.
- Timing: **68,98 s** (gerado_em 2026-09-07T00:08:52Z), exit 0.
- Resultado: **26 tabelas comparadas · differences_total = 0 · pass = true**

| table                  | source_count | target_count | difference | status |
| ---------------------- | -----------: | -----------: | ---------: | ------ |
| accounts               |            0 |            0 |          0 | OK     |
| ai_daily_budgets       |            0 |            0 |          0 | OK     |
| ai_usage               |            0 |            0 |          0 | OK     |
| audit_events           |            0 |            0 |          0 | OK     |
| calculation_snapshots  |            0 |            0 |          0 | OK     |
| chat_conversations     |            0 |            0 |          0 | OK     |
| chat_messages          |            0 |            0 |          0 | OK     |
| expenses               |            0 |            0 |          0 | OK     |
| idempotency_records    |            0 |            0 |          0 | OK     |
| market_prices          |            0 |            0 |          0 | OK     |
| product_ingredients    |            0 |            0 |          0 | OK     |
| product_packaging      |            0 |            0 |          0 | OK     |
| products               |            0 |            0 |          0 | OK     |
| profiles               |            0 |            0 |          0 | OK     |
| purchase_price_history |            0 |            0 |          0 | OK     |
| rate_limits            |            0 |            0 |          0 | OK     |
| sales                  |            0 |            0 |          0 | OK     |
| sales_fees             |            0 |            0 |          0 | OK     |
| sales_items            |            0 |            0 |          0 | OK     |
| sessions               |            0 |            0 |          0 | OK     |
| simulations            |            0 |            0 |          0 | OK     |
| tenant_memberships     |            0 |            0 |          0 | OK     |
| tenants                |            0 |            0 |          0 | OK     |
| tool_executions        |            0 |            0 |          0 | OK     |
| users                  |            0 |            0 |          0 | OK     |
| verifications          |            0 |            0 |          0 | OK     |

Artefatos: `reconciliation-restore-2026-09-07.md` + `.json` (companheiro).

## 6. Verificação adicional

- **Journal de migrations 11/11**: `select count(*), min(created_at),
max(created_at) from drizzle.__drizzle_migrations` (read-only) —
  produção: count = 11, min = 1786510674427, max = 1788320100000;
  restore-branch: **count = 11, mesmos min/max** → journal 11/11 confirmado e
  restaurado pelo dump (o journal `drizzle` não precisou de re-migração).
- **Checksums de amostra (`m02-reconcile`)**: 26/26 tabelas com checksum
  sha256 da amostra (≤100 linhas por PK) — **todos iguais** entre produção e
  restore (sha do conjunto vazio, coerente com produção vazia; ex.:
  `accounts`, `ai_daily_budgets`, `ai_usage` → `e3b0c44298fc1c14…`,
  `equal: true`).

## 7. RPO/RTO observados (escopo mecanismo, produção vazia)

| Etapa                                 | Início (UTC) |  Duração |
| ------------------------------------- | ------------ | -------: |
| pg_dump produção (read-only)          | 00:01:46     |  22,95 s |
| criação + ready da branch             | 00:02:28     |    ~40 s |
| reset de schemas (public/drizzle)     | 00:03:28     | segundos |
| pg_restore                            | 00:04:14     |  63,93 s |
| verify (journal + tabelas, read-only) | 00:06:59     | segundos |
| reconcile completo (26 tabelas)       | 00:07:44     |  68,98 s |

- **RTO observado** (dump pronto → restore verificada): ~**4 min 50 s**;
  ponta a ponta incluindo o dump: ~**5 min 13 s**. Lower bound — com dados
  reais (V2b) escala com o tamanho do dump/transferência.
- **RPO**: o dump é point-in-time de 2026-09-07T00:01:46Z; em rollback real,
  o RPO é limitado pela janela entre o snapshot pré-deploy e o incidente
  (runbook A4 §7 passo 7 — snapshot nativo + `dump.pgc`, PITR 6h como camada
  adicional). Neste drill, produção vazia → RPO trivial.

## 8. Ligação com o rollback (Plano Mestre §13.7 / runbook cutover-A4 §7)

O caminho exercitado neste drill é **o mesmo mecanismo** que o rollback A4
usaria no passo 7 ("Pós-escrita"): **restore do snapshot pré-deploy (nativo +
`dump.pgc`)** — `pg_dump -Fc` de produção → `pg_restore --no-owner
--no-privileges` num alvo limpo → validação (journal 11/11 + reconciliação
`m02-reconcile.mjs`). O drill confirma que: (a) o dump custom (`-Fc`) da
produção é restaurável end-to-end em uma branch Neon recém-criada a partir do
parent; (b) o `--no-owner --no-privileges` neutraliza a falha de `SET ROLE
"neon_service"` do drill 09-05; (c) os erros residuais são apenas de schemas
de plataforma pré-existentes (`neon_auth`/`pgrst`/`app_private`), que no
rollback real seriam cobertos pelo snapshot nativo; (d) a validação
pós-restore é a mesma do T+ (script-âncora, reuso nº 2). §13.7 "não tentar
consertar em produção sem reconciliação" permanece o guard: nenhuma mutação
ad-hoc — correção só via reconciliação.

## 9. Falhas da rodada

- Nenhuma falha de passo. Uma tentativa por etapa (dump, branch, reset,
  restore, verify, reconcile), todas com sucesso na primeira execução.
- `pg_restore` exit 1 com erros esperados/de plataforma (§4) — registrado,
  padrão "registrar e seguir" do drill anterior; não caracteriza falha do
  mecanismo (objetos de `public` e `drizzle` 100% restaurados, journal 11/11,
  reconcile 0 diffs).
- Produção recebeu apenas `pg_dump` read-only + SELECTs de verificação.
  Nenhuma escrita em produção. Toda escrita limitada à branch de restore
  isolada (sancionada pelo brief da rodada).

## 10. Branches deixadas de pé (para deleção no fechamento da rodada)

- **restore-2026-09-07** (`br-tiny-waterfall-ay6a51b9`, endpoint
  `ep-jolly-grass-ayo27gsq`) — criada nesta fase; expira
  2026-09-07T23:59:59Z como rede de segurança. **NÃO deletada aqui** — a
  deleção com prova de cleanup acontece no fechamento da rodada, após o V3
  (orquestrador, §12.5 always()).
- **dryrun-2026-09-07** (`br-weathered-darkness-ayssv0qf`, endpoint
  `ep-frosty-mode-ayaemvhy`) — da fase V2, idem: permanece até o fechamento.

## 11. Arquivos desta fase

- `docs/evidence/cutover-2026-09-07/restore-drill-2026-09-07.md` (este arquivo)
- `docs/evidence/cutover-2026-09-07/reconciliation-restore-2026-09-07.md` + `.json`
- Dump e scripts de sessão: `/tmp/restore-drill-2026-09-07/dump-prod.pgc` e
  `/tmp/bak01-*.mjs` (fora do repo, por regra da rodada)

Sem commits nesta rodada.
