# RUM persistido — `rum_vitals` + p75 (§17.8)

**Data:** 2026-09-13 · **Branch:** `ops/onda2-rum` (base `2ca0123`) · **Operador:** O15 (Onda 2, Batch 2A — schema lane)
**Decisão ratificada:** RUM persistido (variante (a) do §17.8) — série consultável em banco + agregação p75; log-only fica como fallback via flag.

## 1. Schema (migration 0014)

`src/db/schema.ts` + `drizzle/0014_mighty_veda.sql`:

| coluna            | tipo             | nulo | default             |
| ----------------- | ---------------- | ---- | ------------------- |
| `id`              | uuid             | não  | `gen_random_uuid()` |
| `metric_id`       | text             | não  | —                   |
| `name`            | text             | não  | —                   |
| `value`           | double precision | não  | —                   |
| `rating`          | text             | não  | —                   |
| `delta`           | double precision | não  | —                   |
| `navigation_type` | text             | sim  | —                   |
| `received_at`     | timestamptz      | não  | `now()`             |

- Índice `rum_vitals_name_received_at_idx` em `(name, received_at)` — cobre o filtro
  de janela + agrupamento por métrica do p75.
- **Sem `tenant_id` e sem RLS, por design:** é métrica de performance do browser
  (LCP/INP/CLS/FCP/TTFB), sem PII e sem escopo de tenant a isolar. A role de
  runtime (`app_runtime`) recebe **somente `INSERT`** (`REVOKE ALL FROM PUBLIC` +
  `GRANT INSERT`), mantendo a série append-only; leitura fica com o operador via
  `DATABASE_ADMIN_URL`. O teste de contrato verifica `relrowsecurity = false`,
  ausência de `tenant_id` e os privilégios exatos (`test-migrations.ts`).
- Classificação no registry: **SAFE**, `appliedOn: "empty"`,
  sha256 `069b97ae9f1658708d2a85d08c3b36fa36c988d217860c2c135230f1ae34c3f2`.
- Rollback: `drizzle/rollback/0014_to_0013_down.sql` (`DROP TABLE IF EXISTS rum_vitals`).
  O down global `0001_to_0000_down.sql` também dropa `rum_vitals`, o que mantém o
  replay completo do chain verde no `test-migrations.ts` (journal 15/15).

## 2. Ingestão (`src/routes/api/vitals.ts`)

- O handler POST continua validando JSON, limite de **2 KB**
  (`web-vitals-payload.ts`) e respondendo **204**; o log `rum.web_vitals` segue igual.
- Depois do log, faz `INSERT` **best-effort** em `rum_vitals` atrás de
  `RUM_PERSISTENCE_ENABLED` (**default ligado**; `"false"` volta ao log-only).
- Qualquer falha do banco é capturada e logada como
  `rum.web_vitals_persist_failed` (`warn`) — **o 204 nunca muda** por causa da
  telemetria. Sem PII: só id de métrica, nome, valor, rating, delta e
  navigationType. `src/instrumentation/telemetry.ts` não foi tocado
  (histogramas ficam para follow-up).
- Env **nova:** `RUM_PERSISTENCE_ENABLED` (`false` desliga a persistência;
  ausente/qualquer outro valor = ligado). Documentar no `.env.example` é
  follow-up do S (arquivo não pertence a esta lane).

## 3. Agregação p75 (`scripts/obs/rum-percentiles.ts`)

- Lê `rum_vitals` via `DATABASE_ADMIN_URL` **local-only**: host fora de
  `127.0.0.1`/`localhost`/`::1` é recusado (exit 2) antes de qualquer conexão.
- `percentile_cont(0.75)` por métrica na janela (`--window`, default `7 days`),
  com `N` e janela observada declarados no relatório.
- Compara com **LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1** no p75; `N < 20`
  (`MIN_SAMPLES`) → **N/A (N insuficiente)**; métricas sem target (FCP/TTFB)
  saem como "sem target declarado". Exit 0 = relatório gerado (não há gate de
  regressão ainda — baseline M-06/Q-020 pendente).
- Grava `docs/evidence/rum-p75-<data>/report.md` + `raw.json` (bruto).

## 4. Retenção e privacidade

- A série é telemetria descartável: sem PII, sem `user_id`/IP/sessão; a limpeza
  canônica é o down da 0014 (`DROP TABLE`) ou purge por janela via admin.
- Nenhuma policy de RLS foi criada — a proteção é de privilégio (INSERT-only) e
  o banco de produção é Neon; a leitura é local/operacional.

## 5. Como rodar

```bash
# p75 local (7 dias) contra o banco descartável
export DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test
npx tsx scripts/obs/rum-percentiles.ts --date=2026-09-13 --window="7 days"
```

Manifest requests para o S (arquivos de fora desta lane):

- `package.json` scripts (linha exata):
  - `"obs:rum-p75": "tsx scripts/obs/rum-percentiles.ts"`
  - `db:test`: acrescentar `&& tsx scripts/db/test-rum-persistence.ts` ao final da cadeia.

## 6. Validação executada (banco descartável recriado)

| Comando                                                    | Resultado                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run db:generate`                                      | 0 — `No schema changes, nothing to migrate`                                                                                          |
| `npx tsx scripts/db/check-migration-classes.ts`            | 0 — **15/15 classificadas**                                                                                                          |
| `npx tsx scripts/db/test-migrations.ts`                    | 0 — `migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK` (inclui contrato 0014: colunas, RLS off, INSERT-only) |
| `npx tsx scripts/db/test-rum-persistence.ts`               | 0 — `insert best-effort + grant app_runtime INSERT (0014): OK`                                                                       |
| `npx tsx scripts/obs/rum-percentiles.ts --date=2026-09-13` | 0 — relatório com LCP p75 2300 ms OK, INP p75 150 ms OK, CLS N/A (N=12 < 20), FCP sem target                                         |
| `npm run typecheck`                                        | 0                                                                                                                                    |
| `npm run build`                                            | 0 (primeira tentativa falhou por corrida em `node_modules/.nitro` compartilhado entre worktrees; retry imediato verde)               |
| `npm run m02:boundaries`                                   | 0 — `BFF boundary is clean`                                                                                                          |
| `prettier --check` (arquivos TS/JS/MD desta lane)          | 0                                                                                                                                    |

O `report.md`/`raw.json` desta data foram gerados com fixtures sintéticas locais
(sem PII), incluindo o ramo N/A de N insuficiente; as fixtures foram removidas
do banco após a geração.
