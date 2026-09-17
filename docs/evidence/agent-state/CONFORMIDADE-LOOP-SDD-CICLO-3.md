# CONFORMIDADE AO LOOP SDD — ciclo 3 (2026-09-17)

> **Por que este artefato existe:** o prompt canônico do loop (S0 SELECT → S9 LAND, checklists por fase,
> baterias mínimas §6, gates §41–§44 e **condições de parada §8**) chegou **depois** do fechamento do
> ciclo 3 — o material anterior trazia apenas o cabeçalho do §9, truncado. Aqui o ciclo fechado é
> reconciliado **contra o contrato completo**, marcando explicitamente o que **não** foi coberto.
> Nenhuma evidência foi reescrita; nada aqui promove crédito.

## 1. Loop S0–S9 — mapa fase a fase

| fase               | o que o contrato exige                                                                                                                                                      | o que o ciclo 3 fez                                                                                                                                                        | conformidade                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **S0 SELECT**      | WP do ledger, sem depender de `H-*`, dependências mapeadas, **ambiente sem credencial de produção**, SHA registrado                                                         | WP-D3 selecionado do `QUEUE` (dependência D2 satisfeita); SHA `53b2996` registrado; **porém** o ambiente herdado **carrega** `DATABASE_URL_UNPOOLED` de produção           | **PARCIAL → stop condition acionada** (§3)                                                                               |
| **S1 SPEC**        | problema, DoD, critérios testáveis, âncoras no Plano, riscos, testes mínimos, evidências, hipótese/reversão                                                                 | `SPEC-CARDS/CICLO-3.md`: aceitação (a)–(d) do gap report, decisões **SD-C3-1…11**, testes T1–T7 nomeados, escopo exclusivo, E1/E2, "NÃO fazer"                             | CONFORME — 1 lacuna: o card não listava 3 arquivos que a integração exigia (ratificado em **SD-C3-13**)                  |
| **S2 ISOLATE**     | worktree, branch, container efêmero, seed, **cwd explícito**, manifesto inicial, ninguém externo escrevendo                                                                 | worktree + branch + container do squad; **o `cwd` não foi explícito no primeiro passo** ⇒ `db:generate` e edições caíram no worktree do MAESTRO                            | **NÃO CONFORME no 1º passo** → incidente contido (8 arquivos movidos com sha256 8/8) + regra "cwd explícito"             |
| **S3 BUILD**       | escopo mínimo, fronteiras BFF/service/repo, sem catch vazio, sem `data ?? []`, migrations classificadas (SAFE/ONLINE_WITH_CARE/BREAKING/IRREVERSIBLE_AFTER_TRAFFIC), outbox | entrega no escopo (+3 arquivos de integração ratificados); migration `SAFE`/`appliedOn: empty` com down; nenhum catch vazio; outbox não tocado (decisão B)                 | CONFORME — a classificação **IRREVERSIBLE_AFTER_TRAFFIC** do down só apareceu no veredicto e foi qualificada na correção |
| **S4 VERIFY**      | typecheck, lint, format, unit, integration, `db:test` em container virgem, mutação/falsificação, tenant, 401/403/404                                                        | **E1:** `tsc` 0, vitest 80/80, `test-memory` T1–T8, `test-migrations` (cadeia+replay), classify 19/19 · **E2:** `check` 9/9 exit 0, `db:test` 15 suítes exit 0 (virgem)    | CONFORME                                                                                                                 |
| **S5 BROWSER**     | preview local (nunca produção), snapshot→ação→snapshot, console, network, sem erro silencioso, capturas seladas, estados/badges, XSS, 401/403, tenant                       | baterias §18/§20/§23/§32/§33 contra preview local + **36 capturas seladas** com manifesto                                                                                  | CONFORME — com **lacunas de itens** em §32/§33 (§2 abaixo)                                                               |
| **S6 ADVERSARIAL** | claims listados, camada correta, sha256, falsificação, nenhum raw ausente, veredicto + rodada de re-verificação                                                             | **2** verificadores em contexto novo: baterias (**12 CONFIRMED · 5 CORRECTED · 0 REJECTED** + rodada 2 **6 · 1**) e WP-D3 (**39 · 1 · 0 · 2 UNVERIFIABLE**)                | CONFORME                                                                                                                 |
| **S7 GUARD**       | sem credencial de produção no ambiente, sem `:5432`, RLS, menor privilégio, fail-closed, logs sem segredo                                                                   | `env-guard --selftest` **13/13**; `:5432` intocado; RLS/grants provados por `psql` (T7 com controle positivo); **mas** a credencial de produção existe no ambiente herdado | **PARCIAL → stop condition** (§3)                                                                                        |
| **S8 SEAL**        | ledger, claims, veredicto anexado, manifesto `sha256sum -c` ALL MATCH, placar == ledger, `checked === discovered`                                                           | ledger com marcador parent-pinned; manifesto **36/36 ALL MATCH**; placar recomputado == ledger (inalterado: D3 é degrau)                                                   | CONFORME                                                                                                                 |
| **S9 LAND**        | gates aplicáveis, nenhum auto-aprovação, merge só em branch autorizada, push só com H-10, dívidas registradas, incidentes → regra, próximo WP, relatório                    | merge em `develop` (branch diária); **nada pushado** (H-10 aberto); F-C3-1…3 + WP-B1 registrados; incidentes convertidos em regras; relatório emitido                      | CONFORME                                                                                                                 |

## 2. Baterias mínimas (§6) — cobertura real, item a item

### §32 — Security testing matrix

| item                              | coberto?                            | camada que cobre                                                                                            |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| XSS em resposta da IA não executa | ✅                                  | QA-BROWSER (payload no caminho do **usuário** e do **assistente**) + adversarial                            |
| Chamada direta sem auth → 401/403 | ✅                                  | QA-BROWSER (**403** em 4 variantes, incl. cookie forjado)                                                   |
| Tenant A acessa B → 403/zero rows | ✅                                  | QA-BROWSER (**404** + 0 rows) e `db:test` (RLS)                                                             |
| Tool inválida → validation error  | ⚠️ **não medido nesta bateria**     | `db:test` (`test-tool-security`)                                                                            |
| SQL injection parametrizada       | ⚠️ **não medido por sonda própria** | `db:test` (`test-sql-injection`)                                                                            |
| CSRF cross-site bloqueado         | ⚠️ **não medido por sonda própria** | e2e `ui-stack` (replay cross-site → 403)                                                                    |
| **Replay mutation idempotente**   | ❌ **não medido**                   | nenhum (`idempotency_records` = 0 no fim da bateria)                                                        |
| Token em localStorage inexistente | ✅                                  | QA-BROWSER + adversarial (`document.cookie`/`localStorage` vazios; `sessionStorage` só com chave de scroll) |
| Session fixation rotaciona sessão | ❌ **não medido**                   | e2e parcial (cookie HttpOnly/SameSite=Lax)                                                                  |
| Rate abuse de IA → 429/limit      | ⚠️ **não medido por sonda própria** | `db:test` (`test-rate-limit-burst`)                                                                         |

### §33 — Financial regression matrix

| item                                        | coberto?                                                                                | evidência                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| Package price null → incomplete             | ⚠️ **análogo** medido (`current_price := NULL` ⇒ DADOS INCOMPLETOS, `—`, sem `R$ 0,00`) | QA-BROWSER §33a/b                          |
| Unit incompatible → incomplete/invalid      | ❌ não medido na UI                                                                     | `finance.ts` (FIN-006) + unit tests        |
| Yield null → incomplete                     | ❌ não medido na UI                                                                     | unit tests                                 |
| Tax null → incomplete                       | ❌ não medido                                                                           | —                                          |
| Contribution ≤ 0 → break-even não atingível | ❌ não medido na UI                                                                     | unit tests (`unreachable`)                 |
| Required units 10.1 → 11                    | ❌ não medido                                                                           | unit tests                                 |
| Volume unknown → não chamado de real        | ✅                                                                                      | QA-BROWSER (`Volume real: —`)              |
| Markup arbitrário → inexistente             | ✅                                                                                      | e2e + QA-BROWSER (nenhum "preço sugerido") |
| NaN → nunca formatado como zero             | ✅ (parcial: os casos exercitados)                                                      | QA-BROWSER §33a/b                          |

### §18 / §20 / §23

- **§18** ✅ — 4 superfícies (`/inicio`, `/produtos`, `/simulacoes`, `/diagnostico`) com badges `REAL` / `DADOS INCOMPLETOS` / `Simulação` e explicação de cálculo ("Como calculamos?") presente.
- **§20** ✅ — `content-security-policy-report-only` estrita (sem `unsafe-inline`), HSTS/nosniff/Referrer-Policy/Permissions-Policy, canal de report → **204**.
- **§23** ✅ — evento na **mesma transação** (provado com trigger venenoso: 503 e **nada órfão**); **consumidor idempotente não medido** nesta bateria.

## 3. Condições de parada (§8) — acionadas no ciclo

| condição                                         | acionada?        | tratamento                                                                                                                                                                                                                                            |
| ------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Credencial de produção detectada no ambiente** | ✅ **SIM**       | **Escalado ao dono** (§4). Contenção medida: nenhum código consome; `env-guard` nega (DENY/exit 3, prefixo de produção); regra sistêmica `env -u DATABASE_URL_UNPOOLED` **provada** (`PRESENTE` → `AUSENTE`) e registrada em `AGENT-ENV-NOTES.md` §10 |
| Colisão de escrita em worktree                   | ✅ SIM (contida) | 8 arquivos movidos com **sha256 8/8**; regra "cwd explícito" reafirmada no `SUPERVISION-LOG`                                                                                                                                                          |
| Sessão de browser compartilhada sem partição     | ✅ SIM (contida) | partição por manifesto + sessão conferida (`get-session`) antes de capturar                                                                                                                                                                           |
| Erro mascarado como sucesso vazio                | ❌ não houve     | —                                                                                                                                                                                                                                                     |
| Ledger divergindo do placar                      | ❌ não houve     | placar recomputado == ledger ao item                                                                                                                                                                                                                  |
| Heredoc não quotado com texto rico               | ❌ não houve     | entradas do ledger escritas por script/heredoc citado                                                                                                                                                                                                 |

## 4. Escalonamento (decisão humana)

1. **Credencial de produção no ambiente (stop condition — bloqueia o início do ciclo 4 pelo S0):**
   - **A (recomendada):** remover `DATABASE_URL_UNPOOLED` do perfil de login do dono (nenhum código do repo a consome; só o drill `m02:v2b` a define pontualmente).
   - **B:** manter e tornar obrigatória a regra `env -u …` em **todo** lançamento do enxame (já provada e documentada).
2. **Lacunas de bateria (§32/§33):** propor **WP-BAT-1** para medir por sonda própria os itens hoje cobertos só por e2e/`db:test` (replay idempotente, session fixation, rate abuse, unit incompatible, yield/tax null, break-even não atingível, unidades 10.1→11).
3. **Próximo WP (S0 do ciclo 4):** **`9.2`-residual** (4 pontos de acesso direto à transação) — **não** depende de `H-*`; spec-card a emitir no aceite.

## 5. Formato de entrega (§9) — onde cada peça está

| entrega exigida       | artefato                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Relatório do ciclo    | `docs/evidence/agent-state/RELATORIO-CICLO-3-2026-09-17.md`                                            |
| Veredicto adversarial | `docs/evidence/browser-batteries-2026-09-16/VERDICT-ADVERSARIAL.md` + `CLAIMS-INBOX/MEM-D3-VERDICT.md` |
| Evidência selada      | `browser-batteries-2026-09-16/playwright-mcp/` + `playwright-mcp.sha256` (`ALL MATCH`)                 |
| Ledger atualizado     | `EXECUTION-STATE-PROGRAM.md` (marcador parent-pinned do commit `70a802c`)                              |
| Próximo despacho      | `QUEUE.md` (§Ciclo 3) + §4 deste artefato                                                              |
