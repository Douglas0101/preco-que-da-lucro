# Análise detalhada conforme o Plano Mestre — 2026-09-10

**Fonte normativa:** `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md`
(v2.0), lida com o realinhamento V7 (`docs/REALINHAMENTO_OPERACIONAL_V7_PLANO.md`:
numeração canônica F0–F14, P0 com 17 itens, INV-001..022).
**Método:** confronto do ledger `EXECUTION-STATE-PROGRAM.md` (última entrada
2026-09-08) + auditoria direta do código-fonte, migrações e workflows nesta data,
cruzada com a verificação de produção de 2026-09-10
(`docs/evidence/verificacao-producao-2026-09-10.md`).

## 1. Sumário executivo

O programa cumpriu, em código publicado, **todo o P0 (17/17)** e **todo o P1
(15/15)** — a ordem de execução do plano (correção → auth → BFF → services →
repos → engine → schema → Neon → IA) foi respeitada e está evidenciada. O P2 está
parcialmente entregue (FSM sim; memória/FTS/vector corretamente não iniciados por
causa dos gates §43/44). A disciplina de gates do plano funcionou enquanto o
programa era o único vetor de mudança.

O problema não é o código: é que **a produção real de 2026-09-10 saiu por fora do
programa**. O deploy Vercel de `main` (02:59 UTC, via PR #42) invalidou a premissa
operacional do ledger ("Tráfego inexistente"), ignorou o runbook de cutover
A4/A5, e introduziu três drifts out-of-band: (i) `DATABASE_URL` sem valor
utilizável no runtime (503 em readiness, 500 em auth, ~33% de erro); (ii) RLS
habilitado sem políticas nas 5 tabelas de autenticação **sem nenhuma migration
correspondente**; (iii) variáveis `NEON_AUTH_*` = segunda implementação de auth
sem ADR (viola AUTH-001). Pela cláusula N-10 do próprio programa, o selo
"Tráfego: EXISTE" **reabre formalmente a exceção BAK-01** (PITR de 6 h < 7 dias).

## 2. Scorecard por fase (especificação F0–F15 ↔ canônica V7 F0–F14)

| Fase                       | Status                                              | Evidência essencial                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0 Baseline                | **DONE** (rótulo dev-evidence onde aplicável)       | golden tests `src/test/finance.golden.test.ts`, `financial-values.test.ts`, `products-read-models.golden.perf-waves.test.ts`; perf before/after `docs/evidence/perf-{baseline,after}-2026-08-29.md`; F0-04 fechado com limitação single-user/Vite-dev                                                                                                                                                                                                                                                |
| F1 Financeiro/segurança P0 | **DONE**                                            | `src/lib/chat-markdown.tsx` (renderer React, sem `dangerouslySetInnerHTML`, regressão em `chat-markdown.test.tsx:51`); Result states em `src/lib/finance.ts` + services; `src/lib/format.ts:3-39` (`ok/incomplete/invalid/infinite`, "Erro de cálculo", "Não atingível") + `decimalInput`/`qty`; `VolumeSource` 4 valores (`finance.ts:499`); markup 1.5 inexistente; unidades com contexto de conversão (`finance.ts:198-243`); break-even discreto/contínuo com raw+rounded (`finance.ts:385-397`) |
| F2 Auth server-driven      | **DONE** no código; **RISCO em produção**           | better-auth (ADR-020); zero `localStorage`/`sessionStorage` em src; `requireDatabaseAuth` (`src/middleware/request-context.ts:93`); CSRF middleware serverFn (`src/start.ts:148`); rate limits auth (`rate-limit-rules.server.ts`: sign-in 5/60 s, sign-up 3/60 s, forget-password 3/15 min, reset 10/5 min). Ressalvas: prefixo `__Host-` não adotado (cookie padrão better-auth); ADR-025 ACCEPTED mas marker não implementado; e o RLS out-of-band das tabelas de auth (ver §6)                   |
| F3 BFF único               | **DONE**                                            | 8 domínios em `src/lib/*.functions.ts` (products, expenses, financial, break-even, sales, dashboard, diagnostic, chat); `supabase.from(` = 0 em src; `m02:boundaries` PASS com 11 exceções `transient-*` documentadas (`docs/specs/M-02/excecoes.md`) com fase-alvo M02-2/3/4                                                                                                                                                                                                                        |
| F4 Services + Repos        | **DONE** com pendência registrada                   | 13 services, 8 repositories; `ai-tool.repository.ts` órfão (0 importadores — pendência arquitetural do scan S3, não dead code oculto); TransactionManager com GUCs tenant (`client.server.ts`); spec M-02 segue DRAFT (congelamento é gate humano Q-023)                                                                                                                                                                                                                                             |
| F5 Financial Engine 2.0    | **DONE**                                            | `finance-engine/2.0.0` (`financial.service.ts:13`); NUMERIC no schema; snapshots com `engine_version` + `idempotency_key` (`src/db/schema.ts:537,556,567`); cenários real/simulado distinguidos (CHECK `scenario_type` 0003:80)                                                                                                                                                                                                                                                                      |
| F6 Schema hardening        | **DONE** no código; **drift em produção**           | FKs compostas `(tenant_id, id)` (0000:164, 0003:63-78); CHECKs (status produto 5 estados 0003:79; `net <= gross`; `cost_status` known/unknown/invalid); `purchase_price_history` imutável; RLS+policies nas 14 tabelas tenant via DO-loop (`0001:179-213`) + nomeadas em tenants/memberships + `ai_usage` (0006:27-29); role `app_runtime` `NOBYPASSRLS` (0001:4-6)                                                                                                                                  |
| F7 Preparação Neon         | **DONE**                                            | pooled/direct com env-guard (`scripts/env-guard.mjs` trata `DATABASE_URL`/`UNPOOLED`/`ADMIN`); PG 17 fixado (ADR-023 + E5: PG 18 recusado); branch model production/develop (workflows neon-*)                                                                                                                                                                                                                                                                                                       |
| F8 Migração/cutover        | **Código DONE; cutover NÃO executado pelo runbook** | 11/11 hashes reconciliados na produção (2026-09-05); purge DB-01 com snapshot+dump; mas o deploy de produção real (Vercel, 2026-09-10) ocorreu sem o runbook `docs/runbooks/a4-a5-cutover.md` e sem smoke — resultado: produção quebrada                                                                                                                                                                                                                                                             |
| F9 Orquestração IA         | **DONE**                                            | FSM grafo executado (ADR-026: idle→collecting_context→completed/failed+RESET; estados reserved com allowlist vazia); Zod `safeParse` em tool output (`tool-runner.ts:68`); timeout `AI_REQUEST_TIMEOUT_MS` 60 s com `AbortSignal.any` (`chat-execution.server.ts:487-490`); budget ledger com reserva/settle (fix csf_58b444f mergeado); `tool_executions` persistido com índice unique de idempotência (`schema.ts:692-717`); códigos `AI_TIMEOUT`/`AI_QUOTA` no contrato de erro                   |
| F10 Memória                | **NÃO INICIADO (correto)**                          | zero tabelas `ai_memor*`; zero `tsvector`/pgvector — gates §43/44 respeitados                                                                                                                                                                                                                                                                                                                                                                                                                        |
| F11 Performance            | **DONE (dev-evidence); M-06 pendente**              | read models UNION ALL (−50% p50 produtos, −27% preços); TanStack Query com staleTime por natureza (`query-stale-time.ts`); dynamic imports nos loaders; bundle budget 500 kB entry+graph no CI (`scripts/check-bundle.mjs:10-11`; atual 84,9/148,9 kB gzip); baseline CONTROLADO + SLO (M-06) não executado                                                                                                                                                                                          |
| F12 UX financeira          | **PARCIAL→DONE**                                    | badges DADOS INCOMPLETOS (`inicio.tsx:189`) e REAL/SIMULAÇÃO (wave S2-FIN-APPLY; evidência UI em perf-after §4.1); skeleton; calc-explainer (chunk `calc-explainer-*.js` no deploy); retryable flag distingue retry UX                                                                                                                                                                                                                                                                               |
| F13 Observabilidade        | **DONE core**                                       | 20 métricas `app.*` (incl. `app.financial.states`, `app.financial.engine_version`, `app.ai.quotas/timeouts`, `app.db.duration`, `app.snapshot.failure_total`); span `http.request` + correlationId propagado (`start.ts:110-117`); logger estruturado; sanitização (`output-sanitizer.ts`, redação S4) — logs próprios conforme §19.1                                                                                                                                                                |
| F14 Hardening produção     | **PARCIAL**                                         | CSP Report-Only por padrão + `CSP_ENFORCE=true` para enforcement (`start.ts:24-32`) — exatamente o estágio intermediário do §20.1; HSTS/Permissions/Referrer/nosniff/frame-ancestors presentes; rate limits auth + quota IA; **mas** produção com 33% de erro de invocação e sem smoke                                                                                                                                                                                                               |

## 3. Prioridades (listas canônicas V7)

**P0 (17/17): DONE e publicado** (wave1: main `b1f9468`→`c2c84f6`, CI verde).
Cada item verificado no código nesta auditoria (§2, F1/F2/F9). Ressalva: o item 13
(sessão server-driven) funciona em código, mas o login em produção está travado
por infraestrutura (env + RLS drift), não por implementação.

**P1 (15/15): CLOSED 2026-09-01, publicado 2026-09-05** (`p1-closeout`,
`pub-wave1`). BFF, services, repos, TransactionManager, money decimal (ADR-018),
sales model, product completeness, price history, FK composta, RLS, simulations,
N+1, TanStack Query, Neon branch CI, migração de banco.

**P2 (10): PARCIAL** — FSM DONE; OTel parcial (metrics/spans sim, logs próprios);
CSP enforcement: flag pronta, decisão pendente (agora acionável — há tráfego);
outbox, memória, FTS, pgvector, hybrid retrieval: não iniciados (correto);
advanced perf: parcial (M-06 pendente).

## 4. Invariantes — conformidade por amostragem

Conformes no código: INV-001 (zero acesso DB direto na UI), INV-002
(`requireDatabaseAuth` no servidor, não só `beforeLoad`), INV-003/004 (IA passa
por services; cálculo canônico é do engine), INV-006/007 (format states; NaN
nunca vira zero), INV-008 (RLS + FK composta + testes cross-tenant), INV-009
(idempotency keys + unique index em tool_executions), INV-010 (`app_runtime`
NOBYPASSRLS, não-owner), INV-011 (drivers trocáveis neon-serverless/node-postgres),
INV-013 (taxonomia com 11 códigos, `api-error.ts:3-15`), INV-014 (Zod em tool),
INV-015 (`engine_version` em snapshots). INV-016..022 (design system) cobertos
pelo gate `m02:boundaries`/import-protection, verdes.

**INV-012 (migrations reproduzíveis) é a invariante quebrada — não no repositório,
mas na produção**: ver §6, divergência 3.

## 5. Gates do plano

- **§41 (encerramento P0):** verde — 17 itens com teste/regressão, CI verde nos
  tips publicados (runs 33940307955 main, develop `e540638`).
- **§42 (antes de produção Neon): VIOLAÇÃO ABERTA** — PITR 6 h (< 7 d), snapshot
  único expira 2026-10-10, drills C-02/C-02A encerrados em STOP (probe `42P01`
  causa desconhecida), backup/restore com limites de grants registrados. Com o
  tráfego agora existente, a cláusula N-10 reabre BAK-01 formalmente.
- **§43/§44 (memória/HNSW):** respeitados — nada iniciado sem o pipeline.

## 6. Divergências críticas plano × realidade (2026-09-10)

1. **Premissa "Tráfego inexistente" caducou.** Deploy Vercel de produção
   (02:59 UTC, `main`@`c2c84f6`, PR #42). A regra 2 de retomada do programa
   (mudança estrutural = parar e decidir de novo) aplica-se: o ledger termina em
   2026-09-08 descrevendo um mundo que não existe mais.
2. **Cutover fora do runbook.** A4 (deploy+smoke) e A5 (0h/24h/72h) não foram
   executados; resultado visível: `/api/health/ready` 503, `/api/auth/*` 500
   (`DATABASE_URL não configurada`), ~33% de erro de invocação no painel.
3. **Drift de schema out-of-band (viola INV-012).** RLS habilitado sem políticas
   em `users`, `sessions`, `accounts`, `verifications`, `rate_limits` na produção
   Neon — nenhuma das 11 migrações faz isso (o DO-loop de 0001 cobre outras 14
   tabelas com política `tenant_isolation`). Consequência em ambos os cenários:
   se o runtime conectar como `app_runtime`, essas tabelas são **default-deny**
   (login quebra mesmo após corrigir `DATABASE_URL`); se conectar como owner,
   RLS não se aplica ao owner e **toda** a defesa em profundidade das políticas
   tenant (§2.7) fica inoperante nesse caminho.
4. **Segunda implementação de auth sem ADR (viola AUTH-001/§7.1).** Variáveis
   `NEON_AUTH_BASE_URL`/`VITE_NEON_AUTH_URL` criadas no dashboard (2026-09-10)
   coexistindo com better-auth; decisão de provedor exige ADR dedicado.
5. **Menor privilégio violado no escopo web.** `DATABASE_ADMIN_URL`,
   `SUPABASE_MIGRATION_DATABASE_URL`, `MIGRATION_*` no escopo Production and
   Preview da função (o env-guard que existe localmente não tem equivalente
   aplicado na Vercel).
6. **Caminho Hostinger obsoleto.** Os runbooks `a4-a5-cutover.md` e
   `hpanel-homologacao.md` assumem hPanel/Node; a produção real é Vercel;
   `diretrizprecifica.com` serve outro site. Nenhuma decisão registrada.
7. **Fila humana H1–H6 / RAT S0 (PS-01) parcialmente suprimida** pela publicação
   — precisa de re-triagem (C-16), não de execução cega.

## 7. Ordem de correção recomendada

1. **Restaurar a produção** (humano, dashboard Vercel): re-salvar o Secret
   `DATABASE_URL` (Production and Preview, connection string pooled, valor
   verificado) e disparar redeploy de `main`; critério: `/api/health/ready` 200,
   `/api/auth/get-session` sem 500, erro no Observability → ~0%.
2. **Determinar a role do runtime e normalizar o RLS das 5 tabelas de auth por
   migration** (tornar a produção reproduzível novamente — INV-012): ou políticas
   explícitas, ou remoção do RLS out-of-band + GRANT revisado; validar login
   ponta a ponta. Registrar em `docs/evidence/`.
3. **Re-baseline do programa**: ledger atualizado com o carimbo
   "Tráfego: EXISTE", reabertura formal de BAK-01 (decisão: upgrade de PITR ≥ 7 d
   ou aceitação registrada com controles), re-triagem de H1–H6/RAT S0 à luz da
   produção Vercel, e decisão de enforcement CSP (`CSP_ENFORCE`), agora acionável
   pelo §20.1.
4. **Higiene de configuração**: remover segredos admin/migração do escopo web;
   decidir better-auth × Neon Auth por ADR e limpar a implementação perdedora.
5. **Domínio**: apontar `diretrizprecifica.com` para a Vercel ou registrar o
   abandono formal da marca/caminho Hostinger (os runbooks correspondentes
   precisam de emenda).
6. **Só então retomar a Fase C** (S8/B4 → S9/F10), que permanece bloqueada até o
   baseline B3/B4 existir — agora contra a produção Vercel, não Hostinger.

## 8. Fontes

- Plano Mestre v2.0 e realinhamento V7 (docs/ raiz).
- `EXECUTION-STATE-PROGRAM.md` (v5; entradas 2026-08-27 → 2026-09-08).
- Auditoria de código de 2026-09-10: `src/lib/{finance,format,api-error,start}` ,
  `src/lib/ai/`, `src/lib/chat-execution.server.ts`, `src/middleware/`,
  `src/server/`, `src/db/schema.ts`, `drizzle/000{0..9}*.sql`, `0010_*.sql`,
  `.github/workflows/`, `scripts/{env-guard.mjs,check-bundle.mjs}`.
- Verificação de produção 2026-09-10 (`docs/evidence/verificacao-producao-2026-09-10.md`).
- Evidências citadas: perf-{baseline,after}, p1-closeout, pub-wave1,
  pre-a4-2026-09-05/06, pós-rat-2026-09-07 (C-02/C-02A), preflight-rat-2026-09-07.
