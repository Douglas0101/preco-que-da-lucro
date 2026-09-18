# QUEUE — NAS-2 (navegação supervisionada por enxame SDD) · ciclo 5 em curso · 2026-09-17

> **Escritor único: MAESTRO.** Snapshot humano-legível do pipeline (O(1): estado de cada item, dono da bola, próxima transição).
> **Objetivo unilateral:** completar as tarefas pendentes do Plano Mestre V2.0 sob SDD integral, maximizando **crédito verificado** (DONE + ½·PARTIAL, denom. 187), na ordem canônica §1, com os gates §41–§44 como critério de parada. O placar é consequência, não o trabalho.

## Base

- HEAD do ciclo 3: `53b2996` (ciclo 2 fechado) · árvore limpa · marcador parent-pinned válido · **198 commits à frente** de `origin/develop` (`8df3fe3`) · `origin/main` = `9724d2c` · branches `mission/*` preservadas.
- Placar vigente (pós-ciclo 2): **150 D · 23 P · 12 NS · 2 UNV** = **86,36% parcial / 80,21% crua**.
- Baterias de computer-user (MCP Playwright) executadas contra **preview local** (decisão registrada em `SUPERVISION-LOG`): §18/§20/§23/§32/§33 com E1 em `docs/evidence/browser-batteries-2026-09-16/`.
- Ambiente: MCPs Linear/Neon descosados (H-11) · CI nunca viu este HEAD (H-10) · alvo em placeholder PHP (H-6) · `:5432` com dado não-fixture (H-9).
- **WP-0 (bloqueante, ciclo 1) fechado:** a "lacuna contábil" da NAS-2 foi **REFUTADA** com busca exaustiva (512 subconjuntos × 3 bases = 0 configurações com a assinatura alegada; residuais do bloco C = **(0,0)**) e o adversarial aritmético recontou do zero (CONFIRMED). Claims novas **liberadas**. Artefato: `TRANSICOES-ROUND-2026-09-15.md`.

## Máquina de estados (S0–S9)

```text
S0 BACKLOG(M) → S1 SPEC'D(STEWARD) → S2 RED(SQUAD) → S3 GREEN(SQUAD) → S4 E1(SQUAD)
→ S5 CLAIMED(SQUAD) → S6 VERDICT(ADVERSARIAL) → S7 MERGED(M) → S8 E2(M/VERIFICADOR) → S9 LEDGERED(M)
```

- Transições: `S6→S7` só com **CONFIRMED**; `S6→S5` se CORRECTED (o squad aplica o diff; bound 2); `S6→S3` se REJECTED (bound 2); bounds esgotados ⇒ **escalonamento ao STEWARD** (SPEC-DELTA · downgrade honesto · re-planejamento) — nunca aprovação por exaustão.
- **E1** (S4) = evidência no worktree, **provisória**; **E2** (S8) = re-executada no **HEAD integrado**, com os gates do subconjunto tocado. **Ledger só grava com E2.**
- Serialidade **dentro** do item (S2→S3→S5→S6→S7→S8→S9, sem exceção); paralelismo **entre** itens (escopos de arquivo disjuntos, WIP limit 1 por squad).

## Ciclo 1 — resultado

| wp         | itens                                            | dono                                   | estado                  | branch/HEAD                               | spec-card                             |
| ---------- | ------------------------------------------------ | -------------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------- |
| **WP-0**   | matriz de transições 187×2 + refutação da lacuna | VERIFICADOR-C + adversarial aritmético | **S9 — DONE**           | develop · `57290da`                       | `SPEC-CARDS/WP-0-transicoes.md`       |
| **WP-1a**  | `28.2`, `28.4` (ledger schema-managed + CAS)     | SQUAD-DB                               | **S9 — DONE/DONE**      | `mission/n1a-backfill-ledger` · `8fe8756` | `SPEC-CARDS/WP-1a-backfill-ledger.md` |
| **WP-1b**  | `35` (gerador emite o bloco §35)                 | SQUAD-APP                              | **S9 — DONE**           | `mission/n1b-summarize` · `6da4a9d`       | `SPEC-CARDS/WP-1b-summarize-35.md`    |
| **MEM-D0** | gap report §43 (0/7 verdes)                      | SQUAD-MEM                              | **S9 — DONE** (interno) | develop                                   | gap report §D1–D7                     |
| **MEM-D1** | degrau D1 (service + policy, sem banco)          | SQUAD-MEM                              | **S9 — DONE** (interno) | `mission/n1c-mem-d1` · `5410f00`          | gap report §D1                        |

## Ciclo 2 — resultado (fechado em 2026-09-16)

| wp         | itens                                                                     | dono      | estado                    | veredicto adversarial                    |
| ---------- | ------------------------------------------------------------------------- | --------- | ------------------------- | ---------------------------------------- |
| WP-1c      | allowlist de legado do §35 → 0                                            | SQUAD-SEC | **S9 — DONE** (`a242af5`) | CONFIRMED (zero resíduo + falsificações) |
| WP-1g      | resto do `EventService` (runtime)                                         | SQUAD-APP | **S9 — DONE** (`84fc9f9`) | CONFIRMED (7 sondas)                     |
| MEM-D2     | persistência + proveniência + tenant (`ai_memories`, `ai_memory_sources`) | SQUAD-MEM | **S9 — DONE** (`881af59`) | CONFIRMED (sha256, RLS com controle)     |
| **placar** | 150 D · 23 P · 12 NS · 2 UNV = **86,36% parcial / 80,21% crua**           | —         | —                         | +0,26 pp                                 |

## Ciclo 3 — fila (despacho pelo MAESTRO, 2026-09-17)

| wp                   | itens                                                                           | dono         | estado                                                                                                                                                                                               | dep  |
| -------------------- | ------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| BATERIAS-UI          | §18 rótulos · §20 CSP/headers · §23 outbox · §32 matriz · §33 regressão         | QA-BROWSER   | **fechado** — E1 + veredicto adversarial (12 CONFIRMED · 5 CORRECTED · 0 REJECTED; rodada 2: 6 CONFIRMED · 1 CORRECTED, tratado) · evidência selada em `docs/evidence/browser-batteries-2026-09-16/` | —    |
| **WP-D3**            | dedup + versionamento + conflitos (`ai_memory_versions`, `ai_memory_conflicts`) | SQUAD-MEM    | **S7 — mergeado** (`8c97651` → `5de19af`) · **E2 verde** (`check` + `db:test` com T1–T8) · veredicto adversarial em curso                                                                            | D2 ✔ |
| WP-D4                | delete/export + access log (LGPD)                                               | SQUAD-MEM    | S1 — briefe **H-12 emitido** (recomendação **A** aguardando resposta)                                                                                                                                | D3   |
| `9.2`-residual       | 4 pontos de acesso direto à transação (fronteira services ≠ Drizzle)            | SQUAD-APP    | S1 — spec-card a validar contra `PLANO:790-802`                                                                                                                                                      | —    |
| WP-1d                | CSP enforçado + asserções e2e                                                   | SQUAD-SEC    | **bloqueado** (H-6)                                                                                                                                                                                  | H-6  |
| BATERIA-CI           | CI verde no HEAD publicado                                                      | todos        | **bloqueado** (H-10)                                                                                                                                                                                 | H-10 |
| BATERIA-NEON         | `12.5`/`13.7`/`ORD-28` + §42 em ambiente real                                   | SQUAD-DB+SEC | **bloqueado** (H-2/H-11)                                                                                                                                                                             | H-2  |
| BATERIA-5432         | verificação pós-reset                                                           | SQUAD-DB     | **bloqueado** (H-9)                                                                                                                                                                                  | H-9  |
| OBSERVED/RUM/CSP-e2e | séries reais                                                                    | —            | **bloqueado** (H-6)                                                                                                                                                                                  | H-6  |

## Ciclo 4 — fila (despacho pelo MAESTRO, 2026-09-17)

| wp                                      | itens                                                                                                                                           | dono       | estado                                                                           | dep  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------- | ---- |
| **WP-9.2R**                             | `9.2` residual: os 4 pontos de acesso direto à transação (`products.functions.ts` ×2, `purchase-price.service.ts`, `product-detail.service.ts`) | SQUAD-APP  | **S2/S3 em execução** (branch `mission/n4a-9-2-residual`, a partir de `fdd7e4d`) | —    |
| WP-BAT-1                                | lacunas de bateria §32/§33 (replay idempotente, session fixation, rate abuse, unit/yield/tax null, break-even, 10.1→11)                         | QA-BROWSER | S0 — proposto (sem crédito de placar)                                            | —    |
| WP-B1                                   | `@vercel/analytics` incondicional (`src/routes/__root.tsx:11,119`)                                                                              | SQUAD-APP  | S0 — proposto (achado menor)                                                     | —    |
| MEM-D4                                  | delete/export + access log (LGPD) com **SD-C3-12** aplicado                                                                                     | SQUAD-MEM  | **bloqueado** — aguarda resposta ao briefe **H-12**                              | H-12 |
| WP-1d · BATERIA-CI/NEON/5432 · OBSERVED | —                                                                                                                                               | —          | **bloqueados** (H-6 / H-10 / H-2 / H-11 / H-9)                                   | H-*  |

## Ciclo 5 — fila (despacho pelo MAESTRO, 2026-09-17)

> **Pré-requisito satisfeito:** **H-10 executado** — `develop` publicado (`8df3fe3..1fc8197`), **CI verde** no tip `5d9169b3` (run `35237829581`, 26/26 passos) após **parada + correção** de um locator de e2e frágil; `main` intocado (`9724d2c`) e **nenhum deploy de produção**.

| wp                                    | itens                                                                                                                                                                                                                                      | dono                      | estado                                                                                                          | dep |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- | --- |
| **WP-9.2T**                           | desacoplar o **tipo** de `RequestContext.transaction` do driver ⇒ **fecha o item `9.2`**                                                                                                                                                   | SQUAD-APP                 | **S7 — mergeado** (`8ff51b7` → `538bcb1`) · **E2 verde** · bateria Firefox 3/3 · veredicto adversarial em curso | —   |
| **F-C4-1**                            | mapeamento `23503→CONFLICT` latentemente morto (pré-existente, `products.functions.ts:189-192`)                                                                                                                                            | SQUAD-APP                 | S0 — proposto (WP próprio)                                                                                      | —   |
| **F-C5-1**                            | rodar `test:e2e` local antes de publicar WP que toque UI/rotas (o gate local não o inclui)                                                                                                                                                 | todos                     | **regra adotada** (registrada no `SUPERVISION-LOG`)                                                             | —   |
| WP-BAT-1                              | lacunas de bateria §32/§33 (replay idempotente, session fixation, rate abuse, unidade/yield/tax null, break-even, 10.1→11)                                                                                                                 | QA-BROWSER                | S0 — proposto                                                                                                   | —   |
| **WP-B7** (novo — defeito confirmado) | classificação errada do break-even com margem negativa: `break-even.ts:78` rejeita decimal negativo ⇒ rótulo "Erro de cálculo" em vez de "Não atingível" (veredicto do WP-BAT-1)                                                           | SQUAD-APP + adversarial   | —                                                                                                               |
| F-C5-2 · F-C5-3 (S0 resgatado)        | scanner `transactionSites` por binding + comentário fora da contagem (`scripts/m02-matrix.ts`, sem guarda de entrypoint: importá-lo **regrava** a matriz) e o gate da matriz no E2/CI (`package.json:77` + `ui-stack.yml`)                 | SQUAD-INFRA + adversarial | **DISJUNTO** de A/B/C; serial após A/B/C; F-C5-3 depois de F-C5-2                                               |
| F-C6-1 · F-C6-2 (S0 resgatado)        | `23503` agnóstico de constraint + folga de profundidade (`src/lib/products.functions.ts:188-201,527-541`) e a prova de banco no `db:test`/E2 (`package.json:61`)                                                                           | SQUAD-APP + adversarial   | F-C6-1 **DISJUNTO**; F-C6-2 **INTERSECTA** B/F-C5-3/F-C6-1 ⇒ serial após o land de B                            |
| **CORREÇÃO S0 (F-C6-2)**              | a premissa "a prova de banco não entra na CI" é **falsa** para `ui-stack.yml` (env de job `:44-53`, loopback ⇒ os 4 casos rodam); o buraco real é o **E2 local** (`npm run check` ⇒ `5 passed \| 4 skipped`) e o encadeamento em `db:test` | ESCRIVÃO (registro)       | —                                                                                                               |
| WP-B1                                 | `@vercel/analytics` incondicional (`src/routes/__root.tsx:11,119`)                                                                                                                                                                         | SQUAD-APP                 | S0 — proposto                                                                                                   | —   |
| MEM-D4                                | delete/export + access log com **SD-C3-12** e **H-12 aprovado**                                                                                                                                                                            | SQUAD-MEM                 | S1 — pronto para despacho (após o `9.2` fechado)                                                                | —   |
| WP-1d · BATERIA-NEON/5432 · OBSERVED  | —                                                                                                                                                                                                                                          | —                         | **bloqueados** (H-6 / H-2 / H-11 / H-9)                                                                         | H-* |

`DECISIONS-PENDING/{H-10,H-11,H-9,H-6}.md` + `REGISTRO-H.md` (+ H-12 e pós-gate registrados). **H-10 fechado** (CI verde no tip publicado) e **H-12 aprovado** pelo supervisor (TTL L1–L5 + export + L0 não persistido + delete/export auditável + access log, respeitando o §43). Prioridade recomendada restante: **H-6 → H-4 → H-9 → H-2**. Nenhum squad para por espera humana: as trilhas desbloqueadas seguem.

## Estado do placar (recompute — só MAESTRO)

| momento                         | D       | P      | NS     | UNV   | parcial    | cru        |
| ------------------------------- | ------- | ------ | ------ | ----- | ---------- | ---------- |
| base NAS-2 (`4d500fc`)          | 147     | 26     | 12     | 2     | 85,56%     | 78,61%     |
| pós WP-0 (integridade da régua) | 147     | 26     | 12     | 2     | 85,56%     | 78,61%     |
| **pós ciclo 1** (`e7458fc`)     | **149** | **24** | **12** | **2** | **86,10%** | **79,68%** |
| **pós ciclo 2** (`53b2996`)     | **150** | **23** | **12** | **2** | **86,36%** | **80,21%** |
