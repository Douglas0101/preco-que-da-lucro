# QUEUE — NAS-2 (navegação supervisionada por enxame SDD) · ciclo 3 em curso · 2026-09-17

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

## Fila humana (briefes emitidos no ciclo 1; H-12 em emissão no ciclo 3)

`DECISIONS-PENDING/{H-10,H-11,H-9,H-6}.md` + `REGISTRO-H.md` (+ H-12 e pós-gate registrados). Prioridade recomendada: **H-10 → H-6 → H-9 → H-11**. Nenhum squad para por espera humana: as trilhas desbloqueadas seguem. **H-12** (TTL/retenção por camada + escopo do export) tem briefe canônico emitido no ciclo 3 junto de D4; o **mecanismo** não depende dos valores.

## Estado do placar (recompute — só MAESTRO)

| momento                         | D       | P      | NS     | UNV   | parcial    | cru        |
| ------------------------------- | ------- | ------ | ------ | ----- | ---------- | ---------- |
| base NAS-2 (`4d500fc`)          | 147     | 26     | 12     | 2     | 85,56%     | 78,61%     |
| pós WP-0 (integridade da régua) | 147     | 26     | 12     | 2     | 85,56%     | 78,61%     |
| **pós ciclo 1** (`e7458fc`)     | **149** | **24** | **12** | **2** | **86,10%** | **79,68%** |
| **pós ciclo 2** (`53b2996`)     | **150** | **23** | **12** | **2** | **86,36%** | **80,21%** |
