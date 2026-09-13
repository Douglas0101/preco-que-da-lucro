# Neon — prontidão de produção pós-cutover (F-3) — 2026-09-13

**Rodada:** produção `preco-que-da-lucro` · **Frente:** F-3 NEON (MCP) · **Medido:** 2026-09-13T01:0xZ · **Projeto:** `damp-forest-57346541` (org `free_v3`)

Todos os números abaixo são `[MEDIDO]` via MCP Neon (`run_sql`, branch default = produção) nesta janela, salvo indicação contrária. Nenhum valor de segredo/URL de sessão transcrito.

## 1. Journal de migrations — 12/12 ✅

```sql
SELECT count(*)::int FROM drizzle.__drizzle_migrations;  -- → n = 12
```

- **Resultado:** `n = 12` (esperado 12/12) → **PASS**.
- `max(created_at) = 1789046119111` → `2026-09-10T13:15:19.111Z`.
  **Nota de classe:** esse campo é metadado do journal do drizzle, **não** o instante de aplicação; a aplicação da 0011 ocorreu no cutover T-0 (2026-09-12T02:44Z, `docs/evidence/cutover-2026-09-12/`). Não usar este campo como prova de ordem temporal.

## 2. Row-Level Security — 26 tabelas / 30 políticas ✅

```sql
SELECT count(*)::int FROM pg_tables     WHERE schemaname='public' AND rowsecurity=true; -- → 26
SELECT count(*)::int FROM pg_policies   WHERE schemaname='public';                     -- → 30
```

- **Resultado:** `26` tabelas com RLS habilitado e `30` políticas no schema `public`.
- Observação: a expectativa histórica registrada em mandatos anteriores citava "20/20"; o número medido hoje é **26/30** — a diferença é compatível com migrations posteriores (0010/0011). **Fica registrado como o número canônico atual**; se algum gate exigir exatamente 20/20, é GAP-DOC a resolver no docmap, não uma falha de RLS.

## 3. Conexões ativas

```sql
SELECT count(*)::int AS total, count(*) FILTER (WHERE state='active')::int AS ativas
FROM pg_stat_activity WHERE datname=current_database();  -- → total=1, ativas=1
```

- **Resultado:** 1 conexão (a própria sessão MCP do orquestrador). Nenhuma conexão da aplicação no instante da medida — **esperado** para Vercel serverless ociosa e para o preview hPanel que ainda não sobe (build FAIL item 1).
- **Uso:** baseline A5 (contagem de conexões) a re-medir com o app servindo.

## 4. TTFF pós-cutover (baseline A5)

| Medida                          | Valor      | Classe     |
| ------------------------------- | ---------- | ---------- |
| `SELECT 1` (round-trip MCP, 1ª) | **630 ms** | `[MEDIDO]` |
| `SELECT 1` (round-trip MCP, 2ª) | **635 ms** | `[MEDIDO]` |

- O alvo do MCP é a branch **default (produção)**. Compute **aquecido** no momento das medidas (duas execuções consecutivas estáveis, Δ≈5 ms).
- **Nota de escopo:** este é o round-trip _via MCP_, que inclui serialização do tool call; **não** é o TTFF percebido pela aplicação. O TTFF de app será medido no item de probe do 11/12 (F-5) e no carimbo 0h do A5 (F-2/F-7) — usar este par como **baseline comparável apenas consigo mesmo**.

## 5. Retenção de histórico (PITR) — valor conhecido, re-medição inválida

- `current_setting('neon.history_retention_seconds', true)` → **NULL** (não é GUC exposto por SQL) — **tentativa inválida**, registrada para não ser repetida.
- Valor vigente (medido na rodada anterior por painel): **`21600 s` (6 h)** → **BAK-01b ABERTO** (viola SDD §16.6, mínimo 7 dias).
- Decisão: memo instrumentado `docs/evidence/neon-pitr-memo-2026-09-12.md` (v2, DOC-FIRST fechado) — **H-4 decide em minutos**: plano **Launch** (usage-based, ordem **US$1–3/mês**), configurar janela de histórico em **7 dias** (default de plano pago = 1 dia; teto do Launch = 7 dias) e **re-medir** (esperado `604800 s`).
- **BAK-01b fecha** com verificação de painel pós-contratação (F-3 → H-4) **e** com o dump externo verificado mantido (PITR restaura apenas branch raiz e sobrescreve — não substitui o dump).

## 6. Snapshot trio — NÃO agora (agendado)

- **Regra do mandato:** trio fresco **somente na janela <24h antes do go-live** (CP-G3). Não executado nesta rodada.
- Último trio fresco conhecido: `.artifacts/backup-drill/2026-09-12-fresco/` (sha256 `352f9ff4…`), 2026-09-12 — passará de 24h antes de qualquer dia-D provável.
- **Agenda registrada:** executar `npm run m02:snapshot` (script `scripts/m02-snapshot.mjs`) na abertura da janela do dia-D, e anexar sha256 dos três eixos ao pacote de evidência. **Dono:** orquestrador; **gatilho:** H-5 assinada + 11/12 PASS.

## 7. Branches (topologia)

- `production` = `br-snowy-violet-aymcvvvv` (12/12 migrações) — **read-only** por mandato.
- `preview-hpanel-2026-09-12` = `br-blue-silence-ayj9erkh` (parent produção; consumida pelo app preview).
- `develop` = `br-small-hill-aymcu14y` (parent produção, `parent_lsn 0/1C02618`, `current_state=ready`, criada 2026-08-23).
- Nenhuma alteração de branch/role nesta frente.

## Veredito F-3

| Item               | Estado                                                  |
| ------------------ | ------------------------------------------------------- |
| Journal 12/12      | **PASS**                                                |
| RLS (26/30)        | **PASS** (número canônico atual)                        |
| Conexões           | PASS (ocioso; baseline registrado)                      |
| TTFF baseline      | **REGISTRADO** (via MCP; não confundir com TTFF de app) |
| PITR ≥7d (BAK-01b) | **ABERTO** → H-4 (memo com números)                     |
| Snapshot trio      | **AGENDADO** para <24h do go-live                       |
