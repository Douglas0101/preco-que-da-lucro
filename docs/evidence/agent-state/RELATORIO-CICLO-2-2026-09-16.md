# RELATÓRIO DO CICLO 2 — NAS-2 (2026-09-16)

**Base:** `65cd71e` (149 D · 24 P · 12 NS · 2 UNV = 86,10%) · **HEAD:** `c3e5972` + E2 (**150 · 23 · 12 · 2 = 86,36% parcial / 80,21% crua**).

## 1. WPs despachados e destino

| wp         | itens                                           | dono      | estado                    | veredicto adversarial                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------- | --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WP-1c**  | allowlist de legado do §35 → 0                  | SQUAD-SEC | **S9 — DONE** (`a242af5`) | CONFIRMED: zero resíduo (`LEGACY_ALLOWLIST`/`legacyRegime`/`allowlisted` = 0 em `src/`), 2 artefatos com números transcritos do próprio arquivo, falsificações (rótulo removido, descoberta vazia) reprovam, `checked === discovered`                                            |
| **WP-1g**  | `EventService` runtime                          | SQUAD-APP | **S9 — DONE** (`84fc9f9`) | CONFIRMED no código (7 sondas: 3+1+1 testes mortos; `test-outbox` morre quando o `append` sai do `save`; `save` byte-idêntico) + 1 correção documental aplicada (re-atribuição do EVIDENCE-E)                                                                                    |
| **MEM-D2** | persistência + proveniência + tenant da memória | SQUAD-MEM | **S9 — DONE** (`881af59`) | CONFIRMED: sha256 byte a byte (arquivo ↔ registry ↔ banco), T1–T5 em container virgem, RLS 0 rows/42501 **com controle positivo**, CHECKs/FKs com SQLSTATE, atomicidade nos dois sentidos, delete idempotente, poder discriminante (drop da policy mata T1), sem drift de schema |
| `9.1-ME`   | item do plano (§9.1)                            | —         | **PARTIAL → DONE**        | emenda do STEWARD com os dois lados verificados (ressalva: o _uso_ da memória é §15/F10, deferido com gate §43)                                                                                                                                                                  |

**Placar:** +1,0 item-equivalente = **+0,26 pp**. Bloco A sobe a 86,2% (61 D + `9.1-ME`).

## 2. O que o E2 pegou neste ciclo

| defeito                                                                                                      | onde                              | correção                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 7 arquivos fora do `format:check` (claims, snapshots gerados, 4 arquivos de memória)                         | `npm run check` no HEAD integrado | prettier no resultado do merge (novo passo do checklist de integração)                                                 |
| atribuição errada de evidência no claim do WP-1g (2 linhas do `psql` eram do T5, não do caminho via serviço) | veredicto adversarial             | claim corrigido (`84fc9f9`), com re-atribuição de aceite por camada                                                    |
| `MEMORY_MIGRATION_TAG` acoplado à tag sorteada                                                               | risco declarado no claim          | **aceito** com prova: `db:classify:check` falha **alto** nos dois sentidos (tag renomeada e journal sem classificação) |

## 3. Convergência NAS-2 §12 (status ao fim do ciclo 2)

- [x] **Pipeline:** zero item em S9 sem cadeia S1→S9; zero entrada de ledger sem E2; zero veredito sem re-derivação fresh-context (7 verificadores nos 2 ciclos).
- [x] **Enxame:** zero auto-aprovação · zero corrida de escrita (escopo exclusivo por WP) · zero retry além do bound sem escalonamento registrado.
- [x] **WP-0 fechado:** matriz 187 nos dois sentidos, residuais do bloco C = (0,0), alegação refutada com busca exaustiva e origem identificada.
- [x] **Briefes:** emitidos no ciclo 1 (`H-10/H-11/H-9/H-6`) + `REGISTRO-H` vivo (+ `H-12`, pós-gate).
- [x] **Trilha 1:** **4 WPs em S9** (WP-0, WP-1a, WP-1b, WP-1c) + WP-1g. **Escada §43:** **D0→D2 em S9** (D3 fica para o ciclo 3, com o briefe H-12 a emitir em D4).
- [~] **Baterias pós-desbloqueio:** todas com "aguardando H-x" explícito (CI→H-10; Neon→H-2/H-11; 5432→H-9; séries/CSP-e2e→H-6) — nenhuma silenciada.
- [x] **Gates:** `check` exit 0 · `db:test` **15 suítes** exit 0 · `m02:boundaries`/`matrix:check` exit 0 · drill `m02:v2b` com **18/18 derivado** do journal (a correção estrutural do ciclo 1 segurou a migration nova).
- [x] **Placar recomputado == ledger**, ao item. `SUPERVISION-LOG` íntegro.

## 4. Fila humana (inalterada) e próximo ciclo

Briefes: **H-10** (push/CI — recomendado agora) · **H-6** (homologação) · **H-9** (`:5432`) · **H-11** (MCP) · **H-12** (TTL, em D4) · pós-gate (embeddings/HNSW). **Ciclo 3 proposto:** `MEM-D3` (dedup/versões/conflitos) · `MEM-D4` (delete/export + access log, com o briefe H-12) · `9.2` (interfaces de repositório — re-avaliar com os repositórios novos) · `WP-1d`/baterias quando `H-*` responder.
