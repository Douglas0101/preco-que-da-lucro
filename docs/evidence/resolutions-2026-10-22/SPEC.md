# SPEC — resoluções direcionadas (DBT-160 / DBT-157 / DBT-123+159 / DBT-148 / `check:own`)

> **Natureza:** work package de correção, executado na bancada local (`:4173`, PostgreSQL 17
> local) em 2026-10-22. **Nenhum commit, push, deploy, alias ou alvo remoto foi tocado.**
> O S6 foi executado por uma lane de contexto limpo (subagente independente) e os achados
> foram tratados; a taxonomia e os números estão no `README.md`.

## 1. Fato-fonte

- `docs/evidence/bug-hunt/README.md` (bateria de 2026-10-21): achado nº 1 (`DBT-160`), nº 2
  (`DBT-148`), nº 5 (`DBT-157`), nº 6 (`DBT-123` + `DBT-159`).
- `docs/evidence/agent-state/DEBTS.md` — closure tests originais.
- Prompt do dono de 2026-10-22 com as fases 1–8.
- Journal: `docs/evidence/agent-state/PROGRESS.md` L982 (intenção) e L983 (resultado).

## 2. Problema (medido, não presumido)

1. **DBT-160:** `drizzle/0001_p0_runtime_role_and_rls.sql:42` concede
   `SELECT, INSERT, UPDATE` a `app_runtime` em `products, expenses, simulations, …`; **nunca
   houve `DELETE` em `expenses`**. `DrizzleExpenseRepository.remove` executa
   `delete from expenses`; o PostgreSQL responde **42501 antes de avaliar a RLS**, a server fn
   devolve **503** e a linha permanece. Medido em `information_schema.role_table_grants`:
   `DELETE` em 12 tabelas, com `expenses`, `products`, `sales` e `simulations` fora da lista.
2. **DBT-157:** `securityHeaders()` não emitia `x-frame-options`; a CSP está em Report-Only,
   então `frame-ancestors 'none'` não bloqueia embed. Medido: iframe de outra origem carregou a
   landing; o controle com XFO foi bloqueado.
3. **DBT-123/159:** `.text-success` (`--success: oklch(0.74 0.17 155)`) media **2,15:1** sobre
   branco e o badge `text-amber-600` media **3,20:1**; `/produtos` não estava no gate de axe.
4. **DBT-148:** o SDK OTel iniciava, mas **0 requisições OTLP** chegavam no build compilado. O
   bundle empacotava `@opentelemetry/api` enquanto o SDK era importado por specifier bare
   (duas cópias da API); além disso, os instrumentos de métrica nasciam no import, antes do
   provider, e nunca eram re-vinculados.
5. **Gate local:** `npm run check` parava no passo 1 (`m02:lockfile-guard`) por WIP alheio
   (`package.json`/`package-lock.json` com `vite` 8.2.4 sem commit). O remédio sugerido
   descartaria trabalho de outra sessão.

## 3. Contrato (falsificável)

- Excluir despesa como `app_runtime` responde 2xx, a linha some do banco e do reload; continua
  impossível excluir linha de outro tenant; `products`, `sales` e `simulations` **não** ganham
  `DELETE`.
- Toda resposta de documento carrega `x-frame-options: DENY`; um iframe de outra origem não
  carrega conteúdo, enquanto um controle sem XFO carrega.
- `/produtos` atinge ≥4,5:1 nos dois nós medidos e passa no axe (wcag2a/2aa/21a/21aa); a rota
  entra no gate de e2e.
- O build compilado entrega ≥1 `POST /v1/traces` e ≥1 `POST /v1/metrics` a um coletor OTLP; sem
  endpoint o app funciona e não importa o SDK; a função da Vercel não tem import bare de
  `@opentelemetry/*`.
- `npm run check:own` verde sem tocar no WIP alheio; o gate completo continua vermelho **apenas**
  no `m02:lockfile-guard` pré-existente.

## 4. Mudanças (lista fechada)

| arquivo                                                                     | mudança                                                                                  |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `drizzle/0020_runtime_delete_expenses.sql`                                  | `GRANT DELETE ON public.expenses TO app_runtime`                                         |
| `drizzle/rollback/0020_to_0019_down.sql`                                    | `REVOKE DELETE` (rollback)                                                               |
| `drizzle/meta/_journal.json`                                                | entrada idx 20                                                                           |
| `scripts/db/migration-classes.ts`                                           | classificação SAFE + sha256 + rollback                                                   |
| `scripts/db/test-migrations.ts`                                             | grants (positivo/negativo), DELETE real com RLS, downs head→0003, journal dinâmico       |
| `scripts/db/test-memory.ts`                                                 | journal derivado + downs acima de 0019 derivados do journal                              |
| `scripts/db/reconcile-ai-usage.ts`                                          | comentários: métricas agora exportam (DBT-148)                                           |
| `src/lib/security-headers.ts`                                               | `x-frame-options: DENY` em ambos os modos                                                |
| `src/test/security-headers.test.ts`                                         | T2b: XFO + `frame-ancestors 'none'` nos dois modos                                       |
| `src/styles.css`                                                            | `--success` do `:root` para green-700 (4,95:1)                                           |
| `src/routes/_authenticated/produtos.tsx`                                    | badge `text-amber-700`                                                                   |
| `e2e/ui-stack.spec.ts`                                                      | asserção XFO + teste de contraste de `/produtos` (canvas, 3 engines no CI)               |
| `src/instrumentation/telemetry.ts`                                          | instrumentos lazy via Proxy mutável; SDK+API no mesmo grafo; piso do intervalo = timeout |
| `src/start.ts`                                                              | `await ensureTelemetryStarted()` antes de instrumentar a request                         |
| `vite.config.ts`                                                            | OTel externo **só** no cliente; SSR empacota SDK+API                                     |
| `src/lib/observability/visual-correlation.ts`                               | comentário: F-otel-provider-order fechado                                                |
| `src/test/otel-batch-config.test.ts`, `src/test/env-empty-defaults.test.ts` | piso de 5 s do intervalo de métricas                                                     |
| `package.json`                                                              | script `check:own`                                                                       |
| `eslint.config.js`                                                          | ignora `.vercel` (build output)                                                          |
| `docs/runbooks/reconcile-ai-usage.md`                                       | métricas exportam; alerta possível com OTLP                                              |
| `docs/evidence/agent-state/DEBTS.md`                                        | DBT-148/157/159/160 FECHADAS; DBT-123 PARCIAL                                            |
| `AGENTS.md`                                                                 | contrato do `check:own`                                                                  |
| `docs/evidence/resolutions-2026-10-22/**`                                   | este pacote                                                                              |

**Não muda:** CSP de fonte (nenhum host, `unsafe-inline` ou nonce novo); `CSP_ENFORCE` continua
sendo o único switch de enforcement (ADR-043); RLS e policies; schema; bundle do cliente; nenhum
workflow de CI; nenhuma dependência nova.

## 5. DoD

| fase | critério binário                                                        | prova                             |
| ---- | ----------------------------------------------------------------------- | --------------------------------- |
| 1    | DELETE real como `app_runtime` + RLS de tenant + grants negativos       | `captures/db-test-migrations.txt` |
| 1    | exclusão pela UI 2xx e linha ausente após reload                        | `captures/resolutions-probe.json` |
| 2    | XFO em 200 e 404; iframe bloqueado e controle carregando                | `captures/headers-*.txt`, probe   |
| 3    | contraste ≥4,5:1 medido por canvas + axe sem violação serious/critical  | `captures/e2e-targeted.txt`       |
| 6    | ≥1 trace e ≥1 métrica no coletor; sem import bare OTel na função Vercel | `captures/otel-collector.jsonl`   |
| 7    | `check:own` exit 0; gate completo vermelho só no lockfile alheio        | `captures/check-own.txt`          |
| 8    | S6 com 0 REJECTED e achados tratados/declarados                         | `README.md` §S6                   |

## 6. Testes (RED/GREEN e falsificação)

- **DBT-160 RED:** como `app_runtime`, `delete from expenses` ⇒ 42501; UI ⇒ 503 e linha 1→1.
  **GREEN:** 200 e linha 0. **Falsificação:** se o grant não existir, o teste de delete falha;
  se for amplo demais, as asserções `products/sales/simulations.delete = false` falham.
- **DBT-157 RED:** iframe carrega a landing. **GREEN:** frame termina em
  `chrome-error://chromewebdata/`. **Falsificação:** o controle em `:4179` sem XFO carrega
  `CONTROL-FRAME-CONTENT` — o método distingue bloqueio de falha de rede.
- **DBT-123/159 RED:** razões 2,15/3,20 e axe `color-contrast`. **GREEN:** 4,95/5,03 e axe
  vazio. **Falsificação:** reverter os tokens volta a reprovar (medido na bateria original).
- **DBT-148 RED:** 0 OTLP no compilado. **GREEN:** 3 métricas + 1 trace. **Falsificação:** o
  smoke só é aceito com `POST` no coletor; `started`/`flushed` não contam.

## 7. Riscos e limites declarados

- **Fases 4 e 5 do prompt não foram concluídas.** Baselines de pixel e Lighthouse CI exigem
  geração no ambiente do CI e um run real; sem push autorizado isso não é verificável. Também
  não havia baseline Lighthouse versionada, e adicionar `@lhci/cli` sobre um lockfile já sujo
  misturaria WIP alheio. Fica declarado, não maquiado.
- **DBT-123 permanece ABERTA** pelo `scrollable-region-focusable` do log de `/novo-produto`;
  só a metade de contraste foi fechada.
- **Vercel runtime** não foi exercitado: o build `.vercel/output` foi inspecionado (sem import
  bare), mas a entrega em produção não é afirmada.
- **WIP alheio:** `vite` 8.2.4 e o lockfile já estavam modificados antes desta sessão; este
  pacote não os reivindica. `visual-correlation.ts` e `DEBTS.md` são desta sessão.
- **S6** foi uma lane de contexto limpo por subagente; não é um verificador humano nem um run
  de CI.

## 8. Rollback

- Migration: `drizzle/rollback/0020_to_0019_down.sql` (REVOKE DELETE; quebra a exclusão de novo,
  por desenho).
- Headers/CSP: reverter `src/lib/security-headers.ts` remove o XFO; `CSP_ENFORCE` nunca foi
  alterado.
- Contraste: reverter o token e a classe do badge.
- OTel: reverter `telemetry.ts`/`start.ts`/`vite.config.ts` restaura o comportamento anterior
  (sem entrega comprovada); não há estado persistido.
- Nada é publicado antes do gate completo e da decisão humana.
