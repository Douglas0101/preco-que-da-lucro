# Evidência — Reset Docker + Lotes P/M do plano mestre (2026-08-21)

## ETAPA 0 — Reset Docker

- `npm run db:down` → container removido.
- `docker volume rm preco-que-d-main_postgres-data` → dados locais destruídos (pedido explícito).
- `npm run db:up` → novo volume, container `preco-que-da-lucro-postgres` healthy,
  log "database system is ready to accept connections" (PostgreSQL 17-alpine).

## ETAPA 1 — Revalidação (executada 2×: antes e depois dos lotes)

| Gate                      | 1ª execução          | 2ª execução (pós-lote)                      |
| ------------------------- | -------------------- | ------------------------------------------- |
| format:check              | OK                   | OK                                          |
| lint scoped               | OK (15 arquivos)     | OK (31 arquivos)                            |
| typecheck                 | OK                   | OK                                          |
| db:test (4 scripts)       | OK                   | OK                                          |
| vitest                    | 21 arq. / 245 testes | **23 arq. / 257 testes**                    |
| check:ui-stack            | OK                   | OK (catálogo atualizado com calc-explainer) |
| check:no-supabase-runtime | OK                   | OK                                          |
| db:check (drizzle-kit)    | "Everything's fine"  | "Everything's fine" (com migration 0005)    |
| build + check:bundle      | PASS                 | PASS                                        |

## ETAPA 2 — Lote P

- **P1 (14.7 retry full jitter)**: já implementado no working tree (`src/lib/chat.functions.ts`
  `retryDelayMs`: jitter uniforme em `[0, base × attempt)`). Verificado, sem edição.
- **P2 (17.5 staleTime diferenciado)**: já implementado (`src/lib/query-options.ts`:
  AGGREGATE 60s / OPERATIONAL 30s / REALTIME 0). Verificado, sem edição.
- **P3 (18.5 Skeleton)**: componente existia sem uso. Aplicado em `precos.tsx` e
  `despesas.tsx` substituindo "Carregando..." por placeholders `aria-hidden` estáveis.
- **P4 (19.5 engine_version)**: já implementado (`financial.service.ts` registra
  `app.financial.engine_version`; teste espiando o contador). Verificado, sem edição.
- **P5 (20.5 rate limits diferenciados)**: nova regra extraída para
  `src/server/auth/rate-limit-rules.server.ts`:
  - `/sign-in/email`: 5/min (mais restritivo que o default 3/10s = 18/min);
  - `/sign-up/email`: 3/min (mantido);
  - `/forget-password*`: 3 por 15 min;
  - `/reset-password`: 10 por 5 min (não coberto por nenhuma regra default).
    Testes: `src/test/rate-limit-rules.test.ts` (5 casos).
- **P6 (16.4 EXPLAIN)**: script `scripts/db/explain-evidence.ts` + evidência em
  `docs/evidence/explain-critical-queries-2026-08-21.md`. Resultados (dataset sintético:
  2000 produtos / 10k insumos / 100k histórico):
  - products.list: 3,31 ms → 0,62 ms (Index Scan Backward evita sort);
  - purchasePrice.latest: **27,57 ms → 0,089 ms (~310×)** via
    `purchase_price_history_tenant_ingredient_valid_idx`;
  - dashboard.productIngredients: 5,36 ms → 0,034 ms (~158×).
    O cenário "antes" derruba índices em transação com rollback — banco intacto.
- **P7 (PR12#2 recorded_at ≠ valid_from)**: já implementado
  (`purchase-price.repository.ts` grava `recordedAt: new Date()`; teste dedicado em
  `purchase-price.service.test.ts`). Verificado, sem edição.

## ETAPA 3 — Lote M

- **M1 (14.2 allowlist por estado)**: `gatewayToolsForState(currentProductId)` em
  `tool-registry.ts`. Sem produto confirmado o gateway expõe apenas `create_product` e
  `add_expense`; com produto, catálogo completo. `chat.functions.ts` recalcula a lista a
  cada round (criar produto libera as tools de produto no mesmo turno). A fronteira de
  autorização continua sendo `runRegisteredTool`. Testes: 4 novos em
  `tool-registry.test.ts`.
- **M8 (14.6 tool count no budget)**: coluna `tool_call_count` em `ai_daily_budgets`
  (migration `drizzle/0005_ai_tool_call_count.sql` + snapshot/journal + rollback
  `0005_to_0004_down.sql`), constraint nonnegative atualizada, incremento atômico por
  round de tools em `recordToolUsage`. Aplicada localmente e validada pelo drizzle-kit.
- **M2 (16.6 limites server-side)**: `src/lib/list-limits.ts` (products 500,
  productChildren 2000, expenses 1000, simulations 200) aplicado com `.limit()` em
  `loadProductReadModels`, `listPurchasePrices`, `expense.repository.list` e
  `simulation.repository.list`. Teste: `list-limits.test.ts`.
- **M3 (17.6 lazy routes)**: `router.autoCodeSplitting: true` no plugin TanStack Start
  (`vite.config.ts`). Build gera 11 chunks de rota (~80 KB) fora do grafo inicial
  (ex.: `despesas-*.js` 6,7 KB, `diagnostico-*.js` 14 KB), carregados sob demanda.
- **M4 (18.3 Como calculamos?)**: componente CSP-safe `calc-explainer.tsx`
  (`<details>/<summary>` nativo, zero JS) com explicações/fórmulas dos 5 KPIs do
  diagnóstico e do card de ponto de equilíbrio, reutilizando a terminologia do engine.
- **M5 (18.2 badges)**: badge sistemático REAL/DADOS INCOMPLETOS na listagem de produtos,
  derivado de `completeness.status` (product-completeness), com tooltip explicativo.

## Incidente registrado — downgrade externo de drizzle-kit (00:09:38)

Durante a sessão, um processo externo (não npm CLI segundo logs; não esta sessão)
substituiu `drizzle-kit@^0.31.10` (HEAD) por `^0.18.1` em package.json, package-lock.json
e node_modules no mesmo segundo. Isso quebrou `db:check` (0.18 não tem comando `check`) e
o typecheck (`defineConfig` inexistente), além de violar o peer-range do better-auth
(`>=0.31.4`). Restaurado o estado do HEAD (`git checkout -- package.json
package-lock.json` + `npm install`) → drizzle-kit 0.31.10, gates normalizados.

## Pendências resolvidas após aprovação do usuário (dependências novas)

- **M6 (17.8 RUM)**: `web-vitals@^6.1.1` adicionado. Coletor client em
  `src/lib/web-vitals.client.ts` (CLS/INP/LCP + FCP/TTFB) registrado no bootstrap via
  `createIsomorphicFn().client()` em `src/router.tsx`; beacon `navigator.sendBeacon`
  (fallback fetch keepalive) para `POST /api/vitals`
  (`src/routes/api/vitals.ts`, padrão das health routes). Validação zod +
  limite de 2KB (`src/lib/web-vitals-payload.ts`), log `rum.web_vitals`, 204 sem banco.
  Chunk async `web-vitals-*.js` só no client. Testes: `web-vitals-payload.test.ts` (9).
- **M7 (R1 property-based tests)**: `fast-check@^4.9.0` adicionado como devDependency.
  `src/test/finance.properties.test.ts` com 7 propriedades: preço mínimo finito/não
  negativo e >= custo modelado; monotonicidade do preço formado na margem alvo;
  identidade e monotonicidade da margem de contribuição; break-even monotônico em
  despesas fixas e margem unitária (+ arredondamento ceil); margem não positiva →
  inatingível (não inválido); sumFiniteNumbers finito/exato (referência Decimal) e NaN
  com veneno não finito; round-trip estável de toDecimalString.

## Estado final dos gates (pós M6/M7)

vitest: **25 arquivos / 273 testes** passando · format/lint/typecheck OK ·
check:ui-stack OK · check:no-supabase-runtime OK · build + check:bundle PASS
(entry 223 kB min / 68,8 kB gzip).
