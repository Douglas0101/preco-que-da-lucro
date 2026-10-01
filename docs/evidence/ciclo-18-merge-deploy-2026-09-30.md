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
| **Release PR**            | Aberto como **#50** (`develop → main`). **Não mergeado.** CI do candidato **verde**: `verify` **pass** 6m49s e `Branch efêmera · migrate · integração · RLS probe · E2E` **pass** 5m31s.          |
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
- A CI do PR de release (#50) **concluiu verde** sobre os 526 commits do candidato: `verify` **pass**
  6m49s e `Branch efêmera · migrate · integração · RLS probe · E2E` **pass** 5m31s. O segundo job
  **aplicou as 8 migrations numa branch Neon efêmera** e rodou integração e RLS probe contra ela — o
  que é evidência de que as migrations `0012`–`0019` migram limpo e que a aplicação funciona sobre o
  schema resultante. **Isso não é a produção:** a branch efêmera nasce de `production` e é descartada,
  e o que falta continua sendo aplicar as 8 no banco de produção.
- `SonarCloud` **não** é passo da cadeia `check` nem consta da tabela de cobertura do `AGENTS.md`, e
  não há branch protection: o vermelho dele **não** bloqueia merge — bloquear a promoção por ele, ou
  ignorá-lo em silêncio, seriam ambos erros. A escolha foi **declarar**.

---

## 8. O impedimento do SonarCloud: dois problemas, não um

**Primeiro — a cota.** O check do PR de release **não estava reprovando por qualidade: não estava
rodando**. Cinco tarefas do compute engine falharam com a mesma causa, medida em `/api/ce/activity`:

> _This analysis will make your organization 'douglas0101' reach the maximum allowed lines limit of 50000. Current LOC usage is: 0. LOC count in this analysis: 58226._

`main` tem 35.666 LOC e analisa; a árvore da release tem 58.226 (ts=51.851, js=4.516, shell=1.001,
yaml=858). A análise abortava antes de inspecionar um arquivo, então o gate não ficava vermelho nem
verde — **não ficava nada**, e o check aparecia como `cancelled`. Resolvido por decisão do MAESTRO
(entre quatro caminhos medidos): `src/test/**` e `e2e/**` saem do escopo, registrado em `ADR-034` e
`DBT-54`. A análise voltou a rodar (`SUCCESS` em 2026-09-30T15:09:32Z).

**Segundo — o que a cota escondia, e é grande.** Com a análise rodando, o gate reprova em **408**
achados abertos no código novo: 356 `MAINTAINABILITY` (**passa**, rating 1), **71 `RELIABILITY`**
(rating 4 vs ≤ 1) e **19 `SECURITY`** (rating **5** vs ≤ 1) — **90 bloqueiam**. A última análise do
`main` é de **2026-09-13** e a release traz **535 commits**, então _todo_ esse código é "código novo"
e o gate mede a dívida estática acumulada de 2,5 semanas de vários ciclos, não uma regressão desta
entrega. Distribuição: `scripts/perf` 125, `scripts/db` 73, `scripts` 64, `scripts/lib` 38,
`scripts/secret-sidecar` 35, `scripts/obs` 28, `docs/evidence/…` 12, `src/**` ~20. Entre os 19 de
segurança há 2 `BLOCKER` de path traversal e 1 de SSRF em script dentro de evidência selada.

**Decisão do MAESTRO:** liberar a release e quitar o Sonar em **ciclo dedicado** (`DBT-55`), sem
nunca alegar gate Sonar verde. Justificativa medida: enquanto `main` estiver 535 commits atrás, o
"código novo" é a release inteira; depois da promoção a análise do `main` re-baselina o período e
cada PR volta a ter gate significativo.

---

## 9. Deploy e validação pós-deploy — o que foi medido, e o que não pôde ser

**O deploy aconteceu, e a capacidade antes desconhecida foi medida.** O brief e o runbook de
rollback declaravam "auto-deploy em push: **não medido**". Agora está medido: o Hostinger
**auto-deploya** ao receber o merge em `main`.

| prova                  | antes                       | depois                          |
| ---------------------- | --------------------------- | ------------------------------- |
| sha256 do HTML servido | `2429cc97f9c336df`          | `0c48a02b8272c34f`              |
| bundle principal       | `/assets/index-BfoIlnr6.js` | **`/assets/index-oW6bmarj.js`** |

E o bundle servido é **exatamente o artefato que o gate local mediu** (`npm run check`:
`PASS assets/index-oW6bmarj.js … sha256=a67e89b47cb5`). A Vercel também construiu um deployment de
**Production** a partir do merge commit `fd9449f`.

**Saúde:** `/` **200**, `/api/health/ready` **200**, `/api/health/live` **200**.

**§32 — segurança (medida):** `content-security-policy-report-only` com política estrita
(`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`),
`content-security-policy: upgrade-insecure-requests`, `strict-transport-security: max-age=31536000;
includeSubDomains`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`,
`permissions-policy` com câmera/microfone/geolocalização/pagamento negados. `http → https` = **301**.
`localStorage` e `sessionStorage` **vazios**. Rota protegida `/inicio` → **`/auth?redirect=%2Finicio`**.
Uma chamada de server function **sem sessão** devolve **401** — rejeição correta, não defeito.

**§29 — latência (5 amostras por rota):** `/` 1,32 s na primeira (fria) e 0,30–0,81 s depois;
`/api/health/live` 0,15–0,55 s; `/api/health/ready` 1,17 s na primeira (fria, o Neon acordando) e
~0,30 s depois. Em regime, dentro dos alvos; a **primeira** amostra é partida a frio e está
declarada, não escondida.

**ADR-033 — observabilidade visual: parcial, e o limite é duro.** Na superfície pública: **0**
`NaN`, **0** `Infinity`, **0** `R$ 0,00`. Os badges (REAL/SIMULAÇÃO/DADOS INCOMPLETOS) e as
asserções de INV-006/007/008 vivem na **área autenticada**, e a produção tem **zero usuários**
(medido: 0 em `users`, `tenants`, `sessions`) — **não há conta com que entrar**, então essa
superfície não é validável em produção hoje. O chat também não responde: o app lê
`AI_GATEWAY_API_KEY ?? LOVABLE_API_KEY` e o Hostinger não tem nenhuma das duas (`L241`), então
`sendChatMessage` devolve `DEPENDENCY_ERROR`. **Nenhuma das duas coisas é regressão desta release**,
e nenhuma é declarada validada.

**Limites declarados desta validação:** não houve sessão autenticada (não existe conta); a
observabilidade visual da ADR-033 foi validada **no tier de e2e do CI**, não em produção; e o
redeploy no hPanel **não foi necessário** — o auto-deploy fez o trabalho, o que também significa que
o procedimento manual do runbook de rollback segue **não executado**.
