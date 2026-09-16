# QUEUE — NAS-2 (navegação supervisionada por enxame SDD) · ciclo 1 · 2026-09-16

> **Escritor único: MAESTRO.** Este arquivo é o snapshot humano-legível do pipeline (O(1): em que estado está cada item, com quem está a bola, qual a próxima transição).
> **Objetivo unilateral:** completar as tarefas pendentes do Plano Mestre V2.0 sob SDD integral, maximizando **crédito verificado** (DONE + ½·PARTIAL, denom. 187), na ordem canônica §1, com os gates §41–§44 como critério de parada. O placar é consequência, não o trabalho.

## Base

- HEAD local `4d500fc` · árvore limpa · marcador parent-pinned válido · **153 commits à frente** de `origin/develop` (`8df3fe3`) · `origin/main` = `9724d2c` · 7 branches `mission/*` preservadas · worktrees podados.
- Placar vigente: **147 D · 26 P · 12 NS · 2 UNV** = **85,6% parcial / 78,6% crua** (A 85,5 · B 85,3 · C 88,7 · D 50,0).
- **Lacuna contábil da NAS-2 — WP-0 entregue em S6:** o artefato `TRANSICOES-ROUND-2026-09-15.md` (`c5d7bfe`) fecha as duas matrizes em 187 e **refuta** a alegação (bloco C: 54+6−0=60 · 5−2+3=6 · 10−7=3 · UNV 2 ⇒ resíduo **0,0**; busca exaustiva em 512 subconjuntos × 3 bases documentadas ⇒ **0** configurações com a assinatura (2,1)). A origem provável da alegação está identificada (§4.3 do artefato): leitura do `RELATORIO` §2 como lista de promoções a DONE (8 entradas em C em vez de 6 — `26.7`/`25.4` são NS→PARTIAL) + omissão de `28.2` na tabela de upgrades. **O bloqueio de claims novas será liberado com o veredicto do adversarial aritmético (S6).**
- Correção de rastro (apontada pelo WP-0): a frase anterior desta fila dizia "6 P→D" no bloco C — errado. O correto é **6 entradas em DONE (4 NS→D + 2 P→D), 3 NS→PARTIAL, 0 saídas de DONE** no bloco C.
- Ambiente: MCPs Linear/Neon descosados (H-11) · CI nunca viu este HEAD (H-10) · alvo em placeholder PHP (H-6) · `:5432` com dado não-fixture (H-9).

## Máquina de estados (S0–S9)

```text
S0 BACKLOG(M) → S1 SPEC'D(STEWARD) → S2 RED(SQUAD) → S3 GREEN(SQUAD) → S4 E1(SQUAD)
→ S5 CLAIMED(SQUAD) → S6 VERDICT(ADVERSARIAL) → S7 MERGED(M) → S8 E2(M/VERIFICADOR) → S9 LEDGERED(M)
```

- Transições: `S6→S7` só com **CONFIRMED**; `S6→S5` se CORRECTED (o squad aplica o diff; bound 2); `S6→S3` se REJECTED (bound 2); bounds esgotados ⇒ **escalonamento ao STEWARD** (SPEC-DELTA · downgrade honesto · re-planejamento) — nunca aprovação por exaustão.
- **E1** (S4) = evidência no worktree, **provisória**; **E2** (S8) = re-executada no **HEAD integrado**, com os gates do subconjunto tocado. **Ledger só grava com E2.**
- Serialidade **dentro** do item (S2→S3→S5→S6→S7→S8→S9, sem exceção); paralelismo **entre** itens (escopos de arquivo disjuntos, WIP limit 1 por squad).

## Ciclo 1 — despacho

| wp                   | itens                                                    | dono                                           | estado                   | branch/worktree                                 | escopo de arquivos (exclusivo)                                                                                                                                      | dep    | spec-card                      |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------- | ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------ |
| **WP-0**             | matriz de transições 187×2                               | VERIFICADOR-C (+ adversarial aritmético em S6) | **S2**                   | read-only                                       | `docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` (novo)                                                                                                   | —      | NAS-2 §10                      |
| **WP-1a**            | `28.2`/`28.4` → ledger persistente + CAS                 | SQUAD-DB                                       | **S2**                   | `.worktree-n1a` · `mission/n1a-backfill-ledger` | `drizzle/**` · `src/db/schema.ts` · `scripts/db/backfill-*.ts` · `scripts/db/test-backfill.ts` · `scripts/db/migration-classes.ts` · `scripts/db/purge-fixtures.ts` | —      | NAS-2 §10                      |
| **WP-1b**            | `35` (regeneração do `report.md` sem perder o bloco §35) | SQUAD-APP                                      | **S2**                   | `.worktree-n1b` · `mission/n1b-summarize`       | `scripts/perf/summarize.mjs` · `src/test/perf-*.test.ts` · `docs/evidence/_templates/performance-evidence.md`                                                       | —      | NAS-2 §10 + F-§35 do relatório |
| **MEM-D0**           | gap report §43 (o que falta para o gate da memória)      | SQUAD-MEM (read-only)                          | **S2**                   | read-only                                       | `docs/evidence/agent-state/MEM-D0-GAP-REPORT.md` (novo)                                                                                                             | —      | NAS-2 §8 trilha 4              |
| WP-1c                | allowlist de legado do §35 → 0                           | SQUAD-SEC                                      | S0 (fila)                | —                                               | `src/test/perf-evidence.test.ts` · `docs/evidence/perf-*/**`                                                                                                        | WP-1b  | NAS-2 §7                       |
| WP-1d                | flag de CSP + asserções e2e enforçado                    | SQUAD-SEC                                      | **bloqueado** (H-6)      | —                                               | `src/lib/security-headers.ts` · `e2e/ui-stack.spec.ts`                                                                                                              | H-6    | NAS-2 §7                       |
| WP-1g                | EventService runtime (resto de `9.1-ME`)                 | SQUAD-APP                                      | S0 (fila)                | —                                               | `src/server/contracts/event.contracts.ts` · `src/server/services/**`                                                                                                | —      | NAS-2 §7                       |
| MEM-D1..D7           | escada §43                                               | SQUAD-MEM                                      | S0                       | —                                               | schema/migrations + testes                                                                                                                                          | MEM-D0 | NAS-2 §8 trilha 4              |
| BATERIA-CI           | CI verde no HEAD publicado                               | todos                                          | **bloqueado** (H-10)     | —                                               | —                                                                                                                                                                   | H-10   | NAS-2 §7                       |
| BATERIA-NEON         | `12.5`/`13.7`/`ORD-28` + §42 em ambiente real            | SQUAD-DB+SEC                                   | **bloqueado** (H-2/H-11) | —                                               | —                                                                                                                                                                   | H-2    | NAS-2 §7                       |
| BATERIA-5432         | verificação padrão pós-reset                             | SQUAD-DB                                       | **bloqueado** (H-9)      | —                                               | —                                                                                                                                                                   | H-9    | NAS-2 §7                       |
| OBSERVED/RUM/CSP-e2e | séries reais                                             | —                                              | **bloqueado** (H-6)      | —                                               | —                                                                                                                                                                   | H-6    | NAS-2 §7                       |

## Fila humana (briefes emitidos no ciclo 1)

`DECISIONS-PENDING/{H-10,H-11,H-9,H-6}.md` + `REGISTRO-H.md`. Prioridade recomendada: **H-10 → H-6 → H-9 → H-11**. Nenhum squad para por espera humana: as trilhas desbloqueadas seguem.

## Estado do placar (recompute — só MAESTRO)

| momento                | D   | P   | NS  | UNV | parcial | cru   |
| ---------------------- | --- | --- | --- | --- | ------- | ----- |
| base NAS-2 (`4d500fc`) | 147 | 26  | 12  | 2   | 85,6%   | 78,6% |
| após WP-0              | —   | —   | —   | —   | —       | —     |
| após ciclo 1           | —   | —   | —   | —   | —       | —     |
