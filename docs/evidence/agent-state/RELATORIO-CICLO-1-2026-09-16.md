# RELATÓRIO DO CICLO 1 — NAS-2 (2026-09-16)

**Pipeline:** S0–S9 com E1/E2 · **base do ciclo:** `4d500fc` (147 D · 26 P · 12 NS · 2 UNV = 85,56%) · **HEAD do ciclo:** `e7458fc` (149 · 24 · 12 · 2 = **86,10%**).

## 1. WPs despachados e destino

| wp                | itens                                 | dono                                   | estado final                                   | veredicto adversarial                                                                               | E2                                        |
| ----------------- | ------------------------------------- | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **WP-0**          | integridade da régua (matriz 187×2)   | VERIFICADOR-C + adversarial aritmético | **S9 — DONE**                                  | CONFIRMED na substância (recontagem independente idêntica) + CORRECTED (2 linhas de prosa) aplicado | recontagem re-executada no HEAD: idêntica |
| **WP-1a**         | `28.2`, `28.4`                        | SQUAD-DB                               | **S9 — DONE/DONE**                             | CONFIRMED (CAS provado sob contenção real) + 1 correção doc aplicada                                | `db:test` 14 suítes + `check` exit 0      |
| **WP-1b**         | `35` (o gerador não apaga o contrato) | SQUAD-APP                              | **S9 — DONE**                                  | CONFIRMED + F1/F2/reg fechados; 2ª verificação fechou o P2 do gatilho `change`-only                 | `check` exit 0                            |
| **MEM-D0**        | gap report §43                        | SQUAD-MEM                              | **S9 — DONE** (interno, sem crédito no placar) | — (relatório read-only; base do STEWARD)                                                            | artefato no HEAD                          |
| **MEM-D1**        | degrau D1 da escada §43               | SQUAD-MEM                              | **S9 — DONE** (interno)                        | **INCORRECT** → corrigido (`5410f00`) → **V-MEM-D1b: defeito fechado**                              | `check` exit 0                            |
| WP-1c/1g, MEM-D2+ | —                                     | —                                      | S0 (ciclo 2)                                   | —                                                                                                   | —                                         |

## 2. Placar (recompute ao item, só após E2)

| bloco               | denom   | D       | P      | NS     | UNV   | crédito    | antes  |
| ------------------- | ------- | ------- | ------ | ------ | ----- | ---------- | ------ |
| A §5–§15            | 76      | 61      | 8      | 7      | 0     | 85,5%      | 85,5%  |
| B §16–§20           | 34      | 25      | 8      | 1      | 0     | 85,3%      | 85,3%  |
| C §21–§28 + §32–§35 | 71      | 62      | 4      | 3      | 2     | **90,1%**  | 88,7%  |
| D §29–§31           | 6       | 1       | 4      | 1      | 0     | 50,0%      | 50,0%  |
| **Global**          | **187** | **149** | **24** | **12** | **2** | **86,10%** | 85,56% |

Δ = **+0,54 pp** (+1,0 item-equivalente: `28.2` NS→DONE, `28.4` PARTIAL→DONE). Crua: 79,68%.

## 3. O que o E2 pegou (e que o E1 não podia ver)

| defeito                                                                                      | onde apareceu                      | correção                                                                                                |
| -------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `EXPECTED_JOURNAL_COUNT = 16` com o journal em **17** (drill `m02:v2b` falharia fail-closed) | HEAD integrado pós-merge da `0016` | **estrutural**: constante eliminada, contagem derivada do `_journal.json` + 2 testes-guarda (`51a0023`) |
| `expectedJournalCount` exportado **sem declaração** em `scripts/m02-v2b.d.mts`               | `tsc` no HEAD (o `vitest` passava) | tipagem declarada (`3ca921f`)                                                                           |
| 5 arquivos fora do `format:check` (snapshot gerado, script, teste, claim, artefato)          | `npm run check`                    | prettier + snapshot conferido semanticamente idêntico                                                   |
| asserção de rate-limit **flaky** (medida com tempo real em host lento)                       | 3ª repetição do teste              | relógio injetado (`122e232`) — sem relaxar a asserção                                                   |

## 4. Lições do ciclo (incorporadas ao método)

1. **"Funciona no meu worktree" não é evidência** — 4 defeitos da rodada só existiam no HEAD integrado; a regra E1/E2 se pagou na primeira execução.
2. **Rode o `typecheck` e o `format:check`, não só o `vitest`** — dois dos quatro defeitos passavam no teste local.
3. **Não hardcode contagem que o repo deriva** — o literal de journal quebrou duas vezes (0015, 0016); agora deriva e há guarda.
4. **Adversarial de verdade refuta:** `MEM-D1` foi **INCORRECT** na 1ª passada (ensaio de invariante mais fraco que a alegação) e o `WP-1b` teve 2 defeitos de texto gerado — todos fechados com prova de poder discriminante.
5. **Card novo deve conferir o estado do pipeline no HEAD** (o card do WP-1a pedia linha de `package.json` para uma suíte que já estava encadeada) — erros do STEWARD são corrigidos no card, não no squad.

## 5. Fila humana (uma caixa de entrada: `DECISIONS-PENDING/`)

`H-10` (push/CI — recomendado **A: agora**) · `H-6` (homologação hPanel — recomendado **A**) · `H-9` (destino do `:5432` — **C/B**) · `H-11` (MCP — **B**) · `H-12` (retenção/TTL, briefe em D4) · pós-gate (embeddings/HNSW). Trilhas bloqueadas e com dono nomeado: BATERIA-CI, BATERIA-NEON, BATERIA-5432, OBSERVED/CSP-e2e.

## 6. Estado dos artefatos

`QUEUE.md` (estados S0–S9 por WP) · `SUPERVISION-LOG.md` · `DECISIONS-PENDING/**` · `SPEC-DELTAS/DECISOES-STEWARD-NAS2-2026-09-16.md` (+ `-MEM-2026-09-16`) · `CLAIMS-INBOX/{WP-0,WP-1a-backfill-ledger,WP-1b-summarize-35,MEM-D1}.md` · `TRANSICOES-ROUND-2026-09-15.md` · `MEM-D0-GAP-REPORT.md` · ledger com marcador parent-pinned.

**Próximo ciclo:** `WP-1c` (allowlist → 0) · `WP-1g` (resto do EventService) · **`MEM-D2`** (persistência + proveniência + tenant da memória, com A/B/C decididas) · re-despacho das baterias quando `H-*` responder.
