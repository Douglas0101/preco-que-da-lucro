# RELATÓRIO — MISSÃO SDD: fechamento verificado repo-local (2026-09-15)

**Base do round:** `1f94b56` (medição vigente) · **HEAD final:** `2173bf9` + gates (ver §5) · **método:** MAESTRO (orquestração, escrita exclusiva de ledger/QUEUE/PROGRESS) + 7 squads em worktrees próprios + 10 verificadores adversariais de contexto fresco (V0, V1/V2/V3 da medição, V-A1..V-A3b, V-B1..V-B3, V3-A/C/D) + auditor de integridade contínuo.

## 1. Veredicto (FASE 0 — bloqueante)

**H-BETA**, com componente **H-γ** quantificado (`docs/evidence/agent-state/RECONCILIACAO-BASE-2026-09-15.md`):

- A premissa da missão tratava `35` como **contagem de itens**; `35` é o **id do item §35** (perf-evidence) — a contradição **não existe**.
- As transições reais do round de medição: **`PARTIAL→DONE` = 10**, `PARTIAL→PARTIAL` = 22, `DONE→PARTIAL` = 1 (`10.7`), `NS→PARTIAL` = 2, `NS→UNVERIFIABLE` = 2, `NV→DONE` = 1 (`GATE-M02`) — soma 187.
- O «antes» foi **reproduzido item a item** a partir do raw: 129 D · 33 P · 25 NS = 187 (69,0% crua / 77,8% parcial).
- **Δ de base (H-γ):** as duas bases de 187 trocam 1 item em cada sentido (`GATE-M02` entra contado; o 4º item de §27 sai por reenumeração) ⇒ **+0,27 pp** no «antes». Base alinhada: **78,1%**.

## 2. Itens fechados nesta rodada

| id                             | spec_ref                 | commit(s)                                       | evidência no HEAD                                                                                                         | veredicto adversarial                                                            |
| ------------------------------ | ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `10.7` (PBT)                   | §10.7 · INV-004/006/007  | `2f42bf2` `ccce824` `bd57caa` → merge `25dd0f5` | `src/test/finance.properties.test.ts:266,286` (P1/P3) · 9/9 verdes                                                        | V-A2 **CORRECTED** (geradores com piso 0.01) → aplicado                          |
| `23.1` (outbox na tx)          | §23 · INV-009/013 · M-04 | `342a188` → merge `b5e880f`                     | `expense.service.ts:35-52` · `outbox.repository.ts:73-78` · `drizzle/0015_curved_riptide.sql:34-57`                       | V-B1 **CONFIRMED** (xmin idêntico; atomicidade 23502/23514)                      |
| `23.2` (worker idempotente)    | §23 · §22                | `543f29f` → merge `b5e880f`                     | `outbox.repository.ts:114-153,162-177,179-214` · `outbox.worker.ts:76`                                                    | V-B1 **CONFIRMED** (stress 3×9×3; 3 execuções ⇒ 1 efeito)                        |
| `35` (gate de evidência)       | §35 · §45                | `c5b7373` `91152be` `6ffa37e` → merge `d71be7b` | `src/test/perf-evidence.test.ts:71-95,108-111` · `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md`              | V-A1 **CONFIRMED** + correção de integração (fonte única; `agent-state/**` fora) |
| `28.1` (batch)                 | §28                      | `b37909c` → merge `0235084`                     | `scripts/db/backfill-runner.ts:130,174,323,362-363`                                                                       | V-B2 **CONFIRMED** (4 execuções reais)                                           |
| `28.3` (rate-limit)            | §28                      | `b37909c` → merge `0235084`                     | `backfill-runner.ts:135,144-145,201-215,332` · teste `:158`                                                               | V-B2 **CONFIRMED** (relógio virtual + sonda real 551ms/621ms)                    |
| `28.5` (observabilidade)       | §28                      | `b37909c` → merge `0235084`                     | `backfill-runner.ts:103-125,292-315,347` · teste `:249`                                                                   | V-B2 **CONFIRMED**                                                               |
| `16.3` (pg_stat_statements)    | §16.3–16.5               | `3b0fd55` `bc74e5f` `664ef65` → merge `406eb81` | `scripts/obs/pg-stat-statements.ts` (guarda+matcher+agregação+redação) · `docs/evidence/pg-stat-statements-2026-09-15.md` | V-A3 **INCORRECT** (4 defeitos) → **V-A3b: os 4 fechados**                       |
| `26.7` (E2E na branch efêmera) | §12.5 · §26              | `6b27212` `299b189` → merge `be87d87`           | `.github/workflows/neon-pr-branch.yml:351-385` (+ delete-proof `:424-431`)                                                | V-A4 **CORRECTED** (bug do `curl -f`+`pipefail` reproduzido e corrigido)         |
| `25.4` (Dependabot)            | §25                      | `9a473a2` → merge `be87d87`                     | `.github/dependabot.yml` (npm + github-actions; weekly; limites 5/3)                                                      | V-A4 **CORRECTED** aplicado                                                      |
| `9.1-ME` (EventService)        | §9.1                     | (herdado do WP-B1)                              | `outbox.repository.ts:70-75` · `outbox.worker.ts:118,162` · `schema.ts:849-912`                                           | V3-A (bloco A) — emenda do SPEC-STEWARD: NS → **PARTIAL**                        |

**Ganhos parciais (sem upgrade a DONE):** `28.2`/`28.4` (NS→PARTIAL — ledger de backfill só no banco de teste), `26.7`/`25.4` acima pleiteiam PARTIAL por execução live pendente (H-2). **Sem mudança:** `12.5`, `20.1`, `28.4`, `25.5` (duplicado), `30`. **⚠ ERRATA E-2 (WP-0, 2026-09-16):** esta frase está errada quanto a **`28.4`** — ele já era PARTIAL na base e permaneceu PARTIAL (identidade, `anexo:166`); quem promoveu a PARTIAL foi **`28.2`** (`anexo:164`). Ver §9.

## 3. Itens rebaixados / sem upgrade (e por quê)

| id                | pedido | decisão                                | motivo                                                                                                                                                                                                                      | destino                                                                                 |
| ----------------- | ------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `28.2`            | DONE   | **PARTIAL**                            | mecanismo provado por SIGKILL×2 e retomada, mas o ledger (`backfill_checkpoints`/`backfill_work_items`) só existe no banco de teste (`CREATE TABLE IF NOT EXISTS`); 0 hits de `backfill` em `drizzle/**`/`src/db/schema.ts` | migration do ledger (follow-up declarado) + CAS/lease para o gap de concorrência (V-B2) |
| `28.4`            | DONE   | **PARTIAL**                            | mesma razão do acima (marcador de idempotência fora do schema)                                                                                                                                                              | idem                                                                                    |
| `20.1`            | DONE   | **PARTIAL** (mantido)                  | enforcement real exige janela de relatório limpa; ambiente em placeholder (**H-6**) e virada por ambiente depende de H-2                                                                                                    | fila humana; procedimento testado em `docs/evidence/csp-2026-09-15/report.md` §6        |
| `12.5`            | DONE   | **PARTIAL** (mantido)                  | passo E2E agora existe e o delete-proof foi corrigido, mas o fluxo live nunca rodou (sem `NEON_API_KEY`)                                                                                                                    | H-2                                                                                     |
| `35` (1ª passada) | DONE   | **PARTIAL→DONE**                       | na medição anterior o gate era vacuoso; corrigido e verificado (V-A1)                                                                                                                                                       | fechado                                                                                 |
| `10.7` (medição)  | DONE   | **PARTIAL** na medição, **DONE** agora | só 1 das 3 propriedades existia; as 3 existem e foram verificadas                                                                                                                                                           | fechado                                                                                 |

## 4. SPEC-DELTAS e decisões do STEWARD

Nenhuma proposta de SPEC-DELTA ficou sem decisão. As decisões (arquivo `docs/evidence/agent-state/SPEC-DELTAS/DECISOES-STEWARD-2026-09-15.md`):

| id  | tema                                       | decisão                                                                                             |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| D1  | CSP enforçado e diretivas de report        | enforçado serve **só** as diretivas de fonte (reversão de 1 linha documentada)                      |
| D2  | fronteira transacional do worker de outbox | `claim+efeito+marca` na mesma tx **não** viola o §23; idempotência via inbox                        |
| D3  | crédito de `28.2`/`28.4`                   | PARTIAL (mecanismo provado, persistência fora do schema)                                            |
| D4  | `25.6`/`25.7`                              | UNVERIFIABLE (settings-side; visibilidade do repo não medida)                                       |
| D5  | `9.1-ME`                                   | **EMENDA:** NS → PARTIAL (o EventService ganhou runtime com o WP-B1)                                |
| D6  | escopo da varredura do §35                 | árvore de processo (`agent-state/**`, `_templates/**`) fora; evidência de perf continua fail-closed |

**ADRs emitidos nesta rodada: nenhum** — nenhuma decisão alterou arquitetura; todas são leituras do Plano Mestre ou classificações de status. (O ADR-029 segue com ratificação pendente em **H-8**.)

## 5. Placar (recompute item a item) e gates

| bloco      | escopo               | denom   | DONE    | PARTIAL | NS     | UNVERIF. | crédito   | antes (base do round) | Δ           |
| ---------- | -------------------- | ------- | ------- | ------- | ------ | -------- | --------- | --------------------- | ----------- |
| A          | §5–§15               | 76      | 61      | 8       | 7      | 0        | **85,5%** | 84,2%                 | +1,3 pp     |
| B          | §16–§20              | 34      | 25      | 8       | 1      | 0        | **85,3%** | 82,4%                 | +2,9 pp     |
| C          | §21–§28 + §32–§35    | 71      | 60      | 6       | 3      | 2        | **88,7%** | 79,6%                 | +9,1 pp     |
| D          | §29–§31              | 6       | 1       | 4       | 1      | 0        | **50,0%** | 50,0%                 | +0,0 pp     |
| **Global** | **§5–§35 + §29–§31** | **187** | **147** | **26**  | **12** | **2**    | **85,6%** | **81,0%**             | **+4,5 pp** |

- **Crédito parcial: 85.56% → 85,6%** · **crua: 78.61% → 78,6%** · contra a base **alinhada** do round anterior (78,1%): **+7,5 pp**; contra o placar oficial de 2026-09-13 (77,8%): **+7,8 pp**.
- **Gates do fechamento (container PG17 efêmero `pqdl-final`, porta 5433):** ver o bloco de execução abaixo.

## 6. Fila humana (inalterada — fora do escopo do enxame)

| id              | ação                                                                                                                                                                                                                                 | destrava                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **H-6**         | Firefox: `NPM_CONFIG_ENGINE_STRICT=false` → reimplantar → `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS`                                                                                                                                   | tráfego real; promove `12.5`/`20.1` e cria as séries `OBSERVED` (`17.8`/`29`/`30`)                      |
| **H-2**         | token/CLI Vercel + `NEON_API_KEY`                                                                                                                                                                                                    | execução live do branch Neon (`12.5`/`26.7`), inventário de drift, visibilidade do repo (define `25.6`) |
| **H-4**         | PITR ≥ 7 d (Launch) ou exceção assinada                                                                                                                                                                                              | `13.7`/`GATE-42`                                                                                        |
| **H-5**         | assinatura do go-live                                                                                                                                                                                                                | dia-D                                                                                                   |
| **H-8**         | ratificação do ADR-029 (implementação já mergeada)                                                                                                                                                                                   | governança §21/§29                                                                                      |
| **H-9 (novo)**  | **reset/decisão sobre o container `:5432`** — contém dado não-fixture (2 contas; 8 usuários fora do marcador) e por isso os guards fail-closed recusam `db:test`/`db:purge-fixtures` ali; a rodada usou containers efêmeros por isso | higiene local                                                                                           |
| **H-10 (novo)** | **push/CI dos commits locais** — o HEAD local segue à frente de `origin/develop` (sem push por decisão da rodada); a CI não viu nenhum destes commits                                                                                | run de CI do HEAD (§41 critério 'CI verde')                                                             |
| **H-11 (novo)** | **OAuth Linear/Neon** — credenciais MCP expiram (Linear 2026-09-16T03:26Z; Neon 2026-09-15T04:35Z) e ficaram **fora** desta rodada por contrato                                                                                      | reconexão quando necessário                                                                             |

## 7. Ressalvas e limites declarados

1. **Sem CI no HEAD:** todos os commits desta rodada são locais. `npm run check`/`db:test` rodaram **neste host**, não na CI — o critério literal 'CI verde' do gate §41 continua pendente para o HEAD medido (H-10).
2. **Artefato-only / confiança baixa:** planos `EXPLAIN` (`11.2`), PASS da sonda RLS no Neon (`11.9`), janela de PITR 21600 s (`13.7`/`GATE-42`), teto de gasto Neon (`12.6`), execução live do branch Neon (`12.5`/`26.7`), séries de RUM/latência (`17.8`/`29.*`/`30` — `OBSERVED-UNAVAILABLE n=0`), CLS/LCP (`18.5`).
3. **Regime CONTROLADO, nunca OBSERVED:** as medições desta rodada (pg_stat_statements, backfill, baseline de perf) usam fixtures/datasets sintéticos em container efêmero, com `n` e ambiente declarados. **Nenhum** número de produção foi medido (H-6 aberto).
4. **`db:test` nunca no `:5432`:** o container padrão recusou os passos de higiene por design (dado não-fixture) e **nenhum guard foi burlado**; todas as suítes rodaram em containers efêmeros criados e removidos na rodada.
5. **Limitações herdadas/decorrentes:** `summarize.mjs` regenera `perf-controlled-*/report.md` sem o bloco §35 (fail-closed, sem gatilho automático); diretório `*-perf-*` sem prefixo `perf-` fora do contrato literal do §35; `[::1]` passa a guarda de host mas o driver não disca IPv6 entre colchetes (fail-closed, herdado de `pool-activity.ts`); checkpoint do backfill é last-write-wins sem CAS sob runners concorrentes (efeito permanece seguro).
6. **Fora de escopo (por contrato da missão):** F10 inteira (gate §43 — memória), Neon live, GitHub settings, OAuth. Nada disso foi tocado.

## 8. Lições operacionais registradas

- **A verificação no branch não substitui a verificação no HEAD integrado.** O gate §35 passou no worktree do squad e falhou no HEAD integrado porque só lá existiam os artefatos de processo (`SPEC-CARDS/35-perf-gate.md`) que o próprio gate varria — a correção virou a fonte única de descoberta (V-A1 + `npm run check`).
- **Arquivo gerado é dono do MAESTRO:** a matriz M-02 e o `EXPECTED_JOURNAL_COUNT` do drill só ficaram consistentes depois de regenerar/atualizar no merge (achados do V3-A/C) — o mesmo padrão de rodadas anteriores.
- **Rejeitar um claim não é fracasso do processo:** o `16.3` foi **refutado** (INCORRECT, 4 defeitos, incluindo um vazamento de literal em evidência versionada que passaria batido) e só virou DONE depois de correção + re-verificação independente.
- **Mutação como prova de poder:** os squads de outbox e backfill mataram 10 mutações auto-aplicadas com testes específicos — o padrão que o V-A2 exigiu do WP-A2 (geradores com piso) segue como régua de qualidade da rodada.

---

**Fim do relatório.** Artefatos: `QUEUE.md` · `SPEC-CARDS/*` · `CLAIMS-INBOX/*` · `SPEC-DELTAS/*` · `RECONCILIACAO-BASE-2026-09-15.md` · este relatório · ledger e `PROGRESS.md` (L44).

### 5.1 Gates executados no fechamento (HEAD `2173bf9`, container efêmero `pqdl-final` :5433)

| gate                        | resultado              | saída                                                                                                              |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run check`             | **exit 0** (9/9)       | suíte completa + build + `check:bundle` **PASS** — grafo inicial 475.253 B < 500.000 B                             |
| `npm run db:test`           | **exit 0** (13 suítes) | inclui `Outbox §23 (23.1 + 23.2): OK` e `Backfill §28 (28.1…28.5): OK`                                             |
| `npm run m02:boundaries`    | **exit 0**             | _boundary is clean: all database reachability is allowlisted or repository-only_                                   |
| `npm run m02:matrix:check`  | **exit 0**             | _matrix is deterministic and up to date_ (após regenerar: `transactionSites` 100→108, `directDatabaseFiles` 44→47) |
| `npm run m02:secrets-audit` | **exit 0**             | `COMPLETE_WITH_LIMITS`, `failures: []` — nenhum segredo nos artefatos da rodada                                    |
| `npm run m02:state:check`   | **exit 0**             | marcador parent-pinned válido para o HEAD do fechamento (ver ledger)                                               |

> **Nota de integração (achados dos verificadores, todos corrigidos antes do fechamento):** drift da matriz M-02 (`c121497`), `EXPECTED_JOURNAL_COUNT` preso em 15 (`ed29d4b`), escopo da varredura do §35 colidindo com os nomes dos próprios cartões (`91152be`), ponteiros de linha do anexo (`2173bf9`) e o vazamento de literal no artefato do pgstat (`bc74e5f`).

### 9. ERRATA — WP-0 (2026-09-16): semântica das tabelas §2/§3 e matriz de transições da rodada

> **Origem:** a matriz 187×2 do WP-0 (`docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md`) recontou o raw e provou que a aritmética da rodada **fecha exatamente nos dois sentidos** (base `139/25/21/2` → final `147/26/12/2`, 12 transições nomeadas, **zero saídas de DONE**). A "lacuna contábil" apontada pela diretiva NAS-2 (2 saídas de DONE no bloco C + 1 NS→P residual) **não existe**: ela é artefato de leitura **deste** relatório, pelas duas razões abaixo. Nenhuma transição está faltando (as 12 aparecem no §2/§3), mas o **status por linha** e a **visão matricial** faltavam — daí a errata.
>
> - **E-1 (§2):** a tabela "Itens fechados nesta rodada" lista **claims adjudicados**, **não** promoções a DONE (a coluna de status por item não existe). Efeito líquido real: **8** promoções a DONE (`10.7`, `23.1`, `23.2`, `28.1`, `28.3`, `28.5`, `16.3`, `35`) + **4** a PARTIAL (`9.1-ME`, `26.7`, `25.4`, `28.2`) = **12** transições — e não 10 DONE. Em particular `26.7` e `25.4` **não** são DONE: terminaram `NS→PARTIAL` (§LEDGER do claim `12.5-25.4-supply`), por H-2. `28.4` (`anexo:166`) é **`PARTIAL→PARTIAL`** — identidade, **não** é transição (o §3 o lista como "pedido DONE negado", sem mudança de estado).
> - **E-2 (§2/§3):** o §3 reúne "rebaixados / sem upgrade" e por isso sugere, erradamente, que `28.2` não mudou. `28.2` é **`NS→PARTIAL`** (`anexo:164`, +0,5 crédito); a menção à sua promoção está só na **prosa** do §2. **A mesma prosa do §2 (`:30`: "`28.2`/`28.4` (NS→PARTIAL — ledger de backfill só no banco de teste)") está errada quanto a `28.4`** — ver E-1: `28.4` já era PARTIAL na base e permanece PARTIAL. Sem mudança de fato: `12.5`, `20.1`, `28.4`, `30` e `26.8` (`PARTIAL→PARTIAL`) e `25.5` (duplicado, fora do denominador).
> - **E-3 (§5):** a tabela por bloco (Δ de crédito) não trazia a decomposição por transição. Ela está publicada em `TRANSICOES-ROUND-2026-09-15.md` §3: A `9.1-ME`+`10.7` · B `16.3` · C 4 `NS→D` + 2 `P→D` + 3 `NS→P` · D nenhuma; `DONE→PARTIAL` = **0** nesta rodada e nenhum item DONE da base deixou de ser DONE.
>
> **Base final reconfirmada:** `147 D · 26 P · 12 NS · 2 UNV = 187` (85,56% parcial / 78,61% crua), idêntica ao §5 e ao ledger (`PROGRESS.md` L44) — recontagem independente do raw reproduzível pelo script do apêndice do artefato do WP-0.
