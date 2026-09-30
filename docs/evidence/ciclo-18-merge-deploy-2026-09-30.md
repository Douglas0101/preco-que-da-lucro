# Ciclo 18 — merge executado, deploy retido por uma pré-condição de banco que o brief não tinha

- **Data:** 2026-09-30 · **Branch de trabalho:** `feature/contract-guard-bff` → `develop`
- **Estado do ciclo:** **PARCIAL**. A meta C18-2 (merge do PR #49) foi cumprida; as metas C18-3
  (tag `v1.0.0`), C18-4 (deploy Hostinger) e C18-5 (validação pós-deploy) estão **retidas** por uma
  pré-condição medida. Este documento **não** afirma release entregue.
- **Decisão do MAESTRO que abriu o ciclo:** caminho A — release-plane correto, com pré-condições
  (ratificar `ADR-033` e o `N-2`, triar o quality gate, merge `#49 → develop`, PR de release
  `develop → main`, tag no merge de `main`, redeploy e validação visual).

---

## 1. As 8 premissas falsas ou não verificáveis do brief

Medidas **antes** de qualquer mutação. O enxame parou em C18-1 sem tocar a árvore.

| #   | Premissa do brief                            | Medição                                                                                                                          |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "PR #49 → `main`"                            | Falso: o PR é `feature/contract-guard-bff → **develop**`. `gh pr merge 49` mergeia em `develop`.                                 |
| 2   | "PR #49 verde de ponta a ponta"              | Falso: `SonarCloud Code Analysis` = `failure` nos **quatro** commits do range; `mergeStateStatus: UNSTABLE`.                     |
| 3   | "ADR-033 ratificado (ACEITO)"                | Não constava no artefato: `ADR-033` estava em `PROPOSTA`.                                                                        |
| 4   | "Chat funciona (DeepSeek responde)"          | Inexecutável: `deepseek` tem **0** ocorrências no código; o único call-site de IA lê `AI_GATEWAY_API_KEY ?? LOVABLE_API_KEY`.    |
| 5   | "DBT-41 / DBT-43 abertas, e DBT-40"          | Falso: nenhuma das três existia; o registry parava em `DBT-39`.                                                                  |
| 6   | Rollback como `git push origin main --force` | **Proibido** por `AGENTS.md:16` (nunca force-push em branch publicado) e pelo aviso de reescrita de histórico do Lovable.        |
| 7   | "15 commits" no PR #49                       | Falso: **120 commits / 547 arquivos** vs `develop`.                                                                              |
| 8   | Merge do PR #49 sem menção ao `N-2`          | O `N-2` (estreitamento de tipo público) seguia sem ratificação, e o §4 do próprio brief manda **pausar** em mudança de contrato. |

**Premissas que se confirmaram:** `npm run check` verde; 10 runs consecutivos verdes do GitHub
Actions em `df73aca`+`d38d481`; advisories `high` resolvidos (`{high: 0, moderate: 4}`); bug de
ordenação `f9b4c3e` presente; produção no ar.

---

## 2. O que foi executado

| fase                      | resultado                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C18-1** pré-condições   | `ADR-033` → `ACEITO`; `ADR-032` → `ACEITO` (é o artefato do `N-2`); `DBT-40` registrada; rollback runbook escrito (501 linhas).                                                                   |
| **Gate local**            | `npm run check` exit **0** no HEAD congelado `1f5d25d` — 20 gates, 113 arquivos, `1356 passed \| 14 skipped`.                                                                                     |
| **Push**                  | `d38d481..1f5d25d` fast-forward, **sem force**.                                                                                                                                                   |
| **CI do PR no HEAD novo** | `verify` **pass** 6m34s (matriz completa, e2e chromium+firefox+webkit+mobile), `Neon PR branch CI` **pass**, `Neon preview boundary` **pass**, `docs-light` ×2 **pass**, preview Vercel **pass**. |
| **C18-2** merge           | PR #49 mergeado em `develop` — merge commit **`ef589cb`**.                                                                                                                                        |
| **Marcador de estado**    | Estava **válido** no merge (o marcador viajou dentro da branch mergeada; distância 3, folga 1/13). Re-pinado a `ef589cb` por higiene — commit **`145de07`**.                                      |
| **Release PR**            | Aberto como **#50** (`develop → main`). **Não mergeado.**                                                                                                                                         |
| **C18-3/4/5**             | **Retidas.** Ver §3.                                                                                                                                                                              |

---

## 3. O bloqueio: produção não tem as 8 migrations que o código exige

**Medido nos dois lados.**

| lado                              | medição                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Migrations aplicadas em produção  | `drizzle.__drizzle_migrations` = **12**                                                        |
| Migrations na release (`develop`) | **20** ⇒ **8 pendentes** (`0012`–`0019`)                                                       |
| Classificação das 8               | **6 `SAFE` + 2 `ONLINE_WITH_CARE`** (`0013`, `0019`), **0 `BREAKING`**, **0 `DATA_MIGRATION`** |
| Schema de produção                | **26** tabelas públicas; **`ai_memories` ausente**; **`dedup_key` ausente**                    |
| Dado de aplicação em produção     | **vazio** — 0 em `users`, `tenants`, `sessions`, `products`, `expenses`, `sales`               |
| Código que exige o schema novo    | `src/db/schema.ts:1001` (`ai_memories`), `server/repositories/memory.repository.ts`            |

Projeto Neon `damp-forest-57346541`, branch de produção `br-snowy-violet-aymcvvvv` (somente leitura
para produzir esta medição).

**O caminho sancionado existe e não é executável daqui.** A **Emenda #3 (`cutover-window`)** de
`docs/runbooks/cutover-A4.md` §11 é o **único** caminho que abre o hard-deny do `env-guard` sobre
`db:migrate` contra produção, e exige `ALLOW_REMOTE_DB=<motivo>`,
`NEON_MIGRATION_TARGET_KIND=cutover-window` e `NEON_MIGRATION_FREEZE_START/END` **dentro da janela
declarada**. O `.env` local **não contém o endpoint de produção** (0 ocorrências), logo a credencial
não está nesta máquina. **Quem aplica é decisão do MAESTRO.**

**Por que a retenção é obrigatória, e não cautela excessiva:** se o hPanel auto-deployar em push
(capacidade **não medida**), promover `main` serviria código que consulta `ai_memories` contra um
schema onde a tabela não existe.

---

## 4. O que está vermelho, e não é declarado verde

`SonarCloud Code Analysis` = **failure**. Condição única reprovada: `new_reliability_rating` = **4**
contra o limite ≤ 1 (as outras quatro passam: security 1, maintainability 1, duplicação 0,0,
hotspots 100,0). **69** achados de impacto `RELIABILITY`, todos em ferramental:

| regra              | n   | onde                                                                                        |
| ------------------ | --- | ------------------------------------------------------------------------------------------- |
| `shelldre:S7688`   | 53  | `scripts/local-ci.sh`, `scripts/verify-mcp-relaunch.sh` (`[` em vez de `[[`)                |
| `typescript:S7503` | 8   | async sem `await`                                                                           |
| `typescript:S2871` | 4   | `sort` sem comparador — classe de defeito real                                              |
| `S8786`            | 3   | regex com backtracking super-linear (um em `src/lib/observability/visual-redaction.ts:100`) |
| `S7767`            | 1   | `Math.trunc`                                                                                |

Os arquivos acusados são **realmente novos** no PR (`git diff --name-status` = `A`); o Sonar conhece
**só** a branch `main` (última análise 2026-09-13 em `9724d2c`).

**Decisão: declarar, não consertar agora**, registrada como **`DBT-40`** com closure test fail-closed
(sem token/relatório → exit `2`; achado → exit `1`). Consertar 69 achados — incluindo 36 sítios de
`[` → `[[` num script de 1100 linhas, sem `shellcheck` local e sem e2e própria — injetaria mudanças
**nunca submetidas ao S6 adversarial** exatamente na branch que vai a produção, o que o `AGENTS.md`
proíbe ("no 'while I'm here' changes bundled into a fix").

---

## 5. Rollback

`docs/runbooks/rollback-v1.0.0-hostinger.md` — **501 linhas**, por **revert + redeploy**, com
force-push rejeitado e citado (`AGENTS.md:16`). Corrige outra premissa do brief: **o hPanel não tem
rollback por commit** (`hpanel-docmap-2026-09-12.md:258,260`) — as alavancas reais são revert+push e
o upload do archive anterior.

**Limites declarados no próprio runbook:** nenhum passo foi executado; auto-deploy em push **não
medido**; e sem `NPM_CONFIG_ENGINE_STRICT=false` o install falha (`EBADENGINE`, builder v24.6.0 ×
`engines >=24.15.0`) e **o rollback derruba a produção de volta no placeholder PHP** — daí a
varredura obrigatória de **nomes** de env vars e a proibição de snapshotar a tela `settings`
(incidente de exposição do `L239`).

---

## 6. Pré-condições para retomar (todas humanas)

1. **Aplicar `0012`–`0019` em produção** pelo caminho da Emenda #3, ou autorizar outro caminho.
   Produção está vazia ⇒ _expand_ aditivo de risco baixo.
2. **Decidir sobre `DBT-40`**: aceitar a dívida declarada e promover sem alegar "verde de ponta a
   ponta", ou consertar os 69 achados antes (paga um ciclo e invalida o S6 da linhagem).
3. **Mergear o PR #50** → `main`, taguear `v1.0.0` **no merge commit de `main`**, redeployar e rodar
   a validação (health checks, §32, §17.8, §29, ADR-033).

---

## 7. Limites deste documento

- **O deploy não foi executado** e nada aqui sugere o contrário. `v1.0.0` **não existe**: há 14 tags
  (13 `ci-local/*` e `v0.1.0-rc1`).
- A CI do PR de release (#50) roda sobre 526 commits e não estava concluída quando este registro foi
  escrito.
- `SonarCloud` **não** é passo da cadeia `check` nem consta da tabela de cobertura do `AGENTS.md`, e
  não há branch protection: o vermelho dele **não** bloqueia merge — bloquear a promoção por ele, ou
  ignorá-lo em silêncio, seriam ambos erros. A escolha foi **declarar**.
