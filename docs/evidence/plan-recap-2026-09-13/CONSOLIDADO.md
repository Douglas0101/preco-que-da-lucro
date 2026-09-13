# Recapitulação do Plano Mestre — PROGRESSO REAL (2026-09-13)

**Fonte:** `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` (2.559 linhas; §5–§15)
**Método:** leitura em 4 fatias paralelas por subagentes **read-only**, cada item verificado contra o estado real
(ledger `EXECUTION-STATE-PROGRAM.md`, `docs/evidence/**`, `docs/adr/**`, código `src/**`, `drizzle/**`, scripts, git, testes).
**Árvore auditada:** `develop @ 143239e` (2026-09-13).
**Não houve execução** de npm/build/testes em nenhuma fatia (proibido por contrato) — ver "Limites declarados".

## 1. Placar geral — 79 itens auditados

| Status             | Qtd    | %   | Onde                                                                               |
| ------------------ | ------ | --- | ---------------------------------------------------------------------------------- |
| **DONE**           | **55** | 70% | FASE 0/1 (14) · FASE 2/3/4 (13) · FASE 5/6/7/8 (22) · FASE 9 (6)                   |
| **PARTIAL**        | **12** | 15% | F0-04 · AUTH-005 · BFF-002/003 · 9.1/9.2 · §12.4/§12.5/§12.6 · §13.6/§13.7 · §14.3 |
| **NOT STARTED**    | **8**  | 10% | **FASE 10 inteira** (7 itens) + 9.1 MemoryService/EventService                     |
| **SUPERSEDED**     | **3**  | 4%  | §12.2 (nomes de URL) · §13.4 (data migration) · §15.2 conversas (`ai_*`→`chat_*`)  |
| **NÃO VERIFICADO** | **1**  | 1%  | Gate M-02 `m02:boundaries` no HEAD (sem re-execução)                               |

Leitura executiva: **o plano está substancialmente cumprido** — 70% DONE e apenas **10% não iniciado, todo ele concentrado
num único bloco (FASE 10 — memória persistente), cujo não-início é um _deferral deliberado_ com gate próprio**, não um esquecimento.

## 2. Matriz por fase (itens com lacuna relevante)

### FASE 0 — Baseline obrigatório (§5) — 4 DONE · 1 PARTIAL

| Item                               | Status      | Lacuna                                                                                                                   |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| F0-01 inventário de rotas          | DONE        | snapshot de 09/08; 6 das 8 páginas autenticadas consultavam Supabase (histórico)                                         |
| F0-02 baseline de endpoints        | DONE        | cobre método/Zod/mutação por server function                                                                             |
| F0-03 baseline do Financial Engine | DONE        | golden tests existem e são o gate do plano                                                                               |
| **F0-04 baseline de performance**  | **PARTIAL** | **6 dos 8 itens medidos; os números são `dev-evidence` e NÃO são re-deriváveis** (log-fonte em `/tmp`, nunca versionado) |
| F0-05 error census                 | DONE        | vários itens corrigidos nas fases seguintes                                                                              |

> **Colisão de nome detectada:** `docs/evidence/fase0-2026-09-06/` é a **"Fase 0 A4" do programa M-02** (pré-cutover, veredito NO-GO) — **não** é a FASE 0 deste Plano Mestre.

### FASE 1 — P0 financeiro e segurança (§6) — 10 DONE

SEC-001 (XSS no chat: CSP ainda **report-only** por padrão, enforce só com `CSP_ENFORCE=true` — intencional) · FIN-001 Result Type · FIN-002 unknown≠zero · FIN-003 invalid≠zero · FIN-004 volume fictício (**0 ocorrências** de volume `100`) · FIN-005 markup arbitrário (**0 hits** de `* 1.5`) · FIN-006 unit model · FIN-007 ceil discreto (`rawUnits` preservado) · API-001 erro≠lista vazia · IA-001 Zod em toda tool (ordem parse→Zod→AuthZ→service nas 10 tools).
**Lacuna de rastro:** a Fase 1 tem evidência versionada (commits/testes) mas **não tem mapeamento item-a-item no ledger atual**.

### FASE 2 — Autenticação (§7) — 6 DONE · 1 PARTIAL

AUTH-001 (ADR aceito; addendum do cutover em DRAFT) · AUTH-002 (`__Host-` cookie) · AUTH-003 (sessão opaca; ADR-025 aceito, não implementado) · AUTH-004 (rotação com testes) · **AUTH-005 OAuth = PARTIAL — nunca verificado em runtime** (sem e2e de callback e sem credenciais) · AUTH-006 (verificação 1:1 nos 8 BFFs) · AUTH-007 (CSRF em todas as mutações).

### FASE 3 — BFF (§8) — 5 DONE · 2 PARTIAL · 1 não verificado

DONE: BFF-001 Dashboard · BFF-004 Preços (há **entrada morta** em `matrix.yaml`/`matrix.overlay.yaml` apontando módulo renomeado) · BFF-005 Break-even (cálculo client-side com o mesmo módulo — desvio consciente) · BFF-006 Diagnóstico (zero imports de `@/db` em rotas/componentes) · BFF-007 Simulações (persistência server-side; efêmero por desenho).
PARTIAL: **BFF-002/BFF-003** — o plano pedia `createProduct`/`updateProduct` e `createExpense`/`updateExpense` separados; o código **consolidou em `upsert*`** (mudança de contrato, não dívida).
Gate `supabase.from(`: **DONE com escopo ampliado** (todo o runtime, não só UI). Gate M-02 `m02:boundaries`: **não verificado** (sem execução).

### FASE 4 — Services/Repositórios (§9) — 1 DONE · 2 PARTIAL · 1 NOT STARTED

9.3 contexto obrigatório DONE · **9.1 PARTIAL** (5 de 10 serviços dedicados) · **9.1 MemoryService/EventService NOT STARTED** — _declaração sem artefato: o checker foi deliberadamente afrouxado para não exigi-los_ · **9.2 PARTIAL** (repositórios sem interface em 2 de 3 casos).

### FASE 5 — Financial Engine 2.0 (§10) — 7 DONE

Money (NUMERIC + escalas 19,4 / 24,8 / 9,6 / 24,6) · Percent (tipo marcado; `percentPoints*` explícito) · Quantity (5 dimensões, conversão contextual) · Completeness (propaga para o status do produto) · Engine version (persistida + métrica) · Calculation snapshot (idempotência por unique index — bônus) · PBT (as 3 propriedades literais do plano não estão todas presentes).

### FASE 6 — Schema hardening (§11) — 9 DONE

PK+tenant (exceções auxiliares: `audit_events`, `ai_usage`) · índices no lado referenciado (EXPLAIN local PG17; **sem gate automatizado**) · CHECKs (valores e matemática) · nullability (desconhecido ≠ 0) · product status (5 estados; completude derivada — ADR-024) · price history (append-only **por privilégio**, sem trigger) · sales · simulations · **RLS (26 tabelas/30 políticas; GAP-DOC-RLS-01: expectativa antiga "20/20")**.

### FASE 7 — Preparação Neon (§12) — 4 DONE · 3 PARTIAL · 1 SUPERSEDED

§12.1 major PostgreSQL DONE · **§12.2 SUPERSEDED** (nomes `DATABASE_URL_POOLED/DIRECT` não existem; o repo usa `DATABASE_URL`/`DATABASE_URL_UNPOOLED`) · §12.3 transações curtas (evidência **estrutural**, sem teste executado) · **§12.4 branch model PARTIAL** · **§12.5 lifecycle PARTIAL (falta o passo E2E na branch efêmera)** · **§12.6 spending guardrails PARTIAL — alertas de gasto e métricas de compute NÃO VERIFICADOS**.

### FASE 8 — Migração para Neon (§13) — 3 DONE · 2 PARTIAL · 2 SUPERSEDED

§13.1 pré-requisitos DONE (INV-012 restaurada pela 0011; spec M-02 ainda DRAFT) · §13.2 dry run DONE (cópia; produção só SELECT) · §13.3 schema migration DONE (**journal 12/12**) · **§13.4 SUPERSEDED** (origem Supabase sob custódia de terceiro; emenda de reconstrução é o ato normativo) · §13.5 reconciliação DONE (Neon×cópia; legado×Neon N/A por decisão) · **§13.6 PARTIAL** (itens "freeze/read-only da origem" N/A por custódia) · **§13.7 rollback PARTIAL — PITR 6 h < 7 d (BAK-01b ABERTO, = H-4)**.

### FASE 9 — Orquestração da IA (§14) — 6 DONE · 1 PARTIAL

14.1 FSM (grafo executado alcança 4/7 estados) · 14.2 allowlist por estado (só `collecting_context` autoriza as 10 tools) · **14.3 PARTIAL** (persiste `input_hash` e não o input cru; `tool_call_id` sem coluna própria; `ai_usage.tool_execution_id` nunca escrito) · 14.4 idempotência (replay `replayed:true`; hash divergente bloqueia) · 14.5 timeout/cancelamento (o corpo das tools não recebe o signal) · 14.6 budget (requests/tokens/tools) · 14.7 retry (não faz retry de validação/autorização/conflito).

### FASE 10 — Memória persistente (§15) — 7 NOT STARTED · 1 SUPERSEDED

**Bloco inteiro não iniciado, por deferral deliberado com gate (§43 exige FTS antes de embeddings):** 15.1 ordem · 15.2 sete tabelas de memória · 15.3 política · 15.4 proveniência · 15.5 FTS · 15.6 vector · 15.7 ranking.
§15.2 conversas: **SUPERSEDED** — `ai_conversations`/`ai_messages` foram entregues como `chat_*` no escopo F9.

## 3. O que NÃO está feito (a lista honesta)

1. **FASE 10 completa** (7 itens) — memória persistente: FTS, vector, ranking, proveniência, política e as 7 tabelas.
2. **`MemoryService`/`EventService`** (§9.1) — contratos inexistentes; checker afrouxado para não exigi-los.
3. **OAuth em runtime** (AUTH-005) — sem e2e de callback nem credenciais; verificação só por leitura do pacote.
4. **F0-04 baseline de performance** — não re-derivável (log-fonte perdido em `/tmp`).
5. **Spending guardrails** (§12.6) — alertas/teto de gasto não verificados.
6. **Branch lifecycle** (§12.5) — falta o passo E2E na branch efêmera de PR.
7. **ToolExecution** (§14.3) — input cru não persistido; vínculo com `ai_usage` incompleto.
8. **Rollback real** (§13.7) — limitado ao PITR de 6 h (**BAK-01b = H-4**, já na fila humana).

## 4. Divergências que são DECISÕES (não dívidas)

| Plano                                                        | Realidade                                | Motivo                                    |
| ------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------- |
| `ai_conversations`/`ai_messages`                             | `chat_*`                                 | escopo F9 entregou com nomes próprios     |
| `DATABASE_URL_POOLED` / `_DIRECT`                            | `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | convenção do provedor/driver              |
| `createProduct/updateProduct`, `createExpense/updateExpense` | `upsert*`                                | consolidação de contrato na BFF           |
| Data migration tabela-a-tabela do Supabase                   | emenda de reconstrução (custódia)        | origem nunca operada por nós              |
| FASE 0 "do plano"                                            | ≠ "Fase 0 A4" (M-02)                     | colisão de nome em `docs/evidence/`       |
| Break-even exibido client-side                               | mesmo módulo, cálculo no cliente         | desvio consciente (server sem round-trip) |

## 5. Impacto no dia-D

**Nada aqui bloqueia o dia-D.** As lacunas vivem em (a) fases futuras já deferidas com gate (FASE 10, 9.1), (b) itens
de verificação/custódia (AUTH-005, F0-04, §12.6) e (c) **um item que já está na fila humana: BAK-01b/PITR (H-4)** —
o único que o plano exige antes do primeiro tráfego (§16.6).

## 6. Limites declarados desta auditoria

1. **Read-only, sem execução:** nenhum `npm`/build/teste/migração foi rodado; números ao vivo (12/12, 26/30) vêm de artefatos versionados.
2. **Ausência provada por busca:** itens NOT STARTED foram inferidos por `grep` em `src/**`/`drizzle/**` e pelo índice git (`-S`) — ausência de evidência nesses escopos, não prova universal.
3. **Drift temporal:** `docs/specs/M-02/matrix.yaml` tem mtime 2026-09-11; commits posteriores podem tê-lo deixado defasado (o gate `m02:boundaries` não foi re-executado por contrato).
4. **Evidência indireta sinalizada:** §11.2 (EXPLAIN local com dataset sintético), §12.3 (estrutural), AUTH-005 (leitura de pacote em `node_modules`).
5. **Fora de escopo:** §15.8+ (tenant filter e além) não classificados; fila humana (H-4…H-7) é tratada em `F8-consolidacao-2026-09-13.md`.

## 7. Fatias (evidência bruta)

| Parte | Escopo                                            | Arquivo                        |
| ----- | ------------------------------------------------- | ------------------------------ |
| A     | §5 FASE 0 + §6 FASE 1                             | `part-A-fase0-fase1.md`        |
| B     | §7 AUTH + §8 BFF + §9 services                    | `part-B-auth-bff-services.md`  |
| C     | §10 engine + §11 schema + §12 prep + §13 migração | `part-C-engine-schema-neon.md` |
| D     | §14 IA + §15 memória (+ §1/§4 prioridades)        | `part-D-ia-memoria.md`         |
