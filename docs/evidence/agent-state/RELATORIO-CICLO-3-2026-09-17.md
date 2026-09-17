# RELATÓRIO DO CICLO 3 — NAS-2 (2026-09-17)

**Base:** `53b2996` (= `develop` após o ciclo 2; 150 D · 23 P · 12 NS · 2 UNV = 86,36% parcial) · **commits deste ciclo:** `f3c56db` (baterias + H-12 + spec-cards) e `1f3a083` (journal/handoff) · **nada pushado** (H-10).

**Cunho do ciclo:** camada **computer-user** (MCP Playwright) sobre preview **local**, briefe **H-12** e **WP-D3** (dedup/versões/conflitos da memória). O prompt da missão veio sem valor em `{{APP_URL_PREVIEW}}`; a decisão de alvo (local, nunca produção) está registrada no `SUPERVISION-LOG`.

## 1. Ambiente e guardrails (como o ciclo provou o que tocou)

| item                  | valor                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Alvo das baterias     | `http://127.0.0.1:4273` — `node .output/server/index.mjs` (preset `node-server`), build do HEAD `53b2996`                       |
| Banco                 | container **efêmero** `nas2c3-pg` (PG17, `127.0.0.1:55432`) com a fixture `scripts/e2e/seed-auth.ts`                            |
| Prova de identidade   | `pid (2443804) → /proc/<pid>/cwd (este worktree) → DATABASE_URL (:55432)` **antes** de qualquer mutação                         |
| Proibido e não tocado | produção, Neon (`H-11`/§42), `:5432` (`H-9`, contém dado não-fixture), push (`H-10`)                                            |
| Guardas               | `env-guard --selftest` **13/13** · `m02:secrets-audit` exit 0 · `m02:boundaries`/`m02:matrix:check`/`m02:lockfile-guard` exit 0 |

**Armadilha medida (e o que ela quase custou):** a porta default do harness (`4173`) estava ocupada por um `nitro preview` **do repo principal** apontando para o `:5432` (H-9). Os primeiros probes de header foram respondidos por **esse** processo — build antigo, `CSP_ENFORCE=true` — e só a checagem `pid → cwd → banco` evitou que uma bateria inteira rodasse contra o banco errado. Correção registrada (C-1) e re-medida no servidor correto.

## 2. Baterias de computer-user — resultado

| bateria     | cenário central                                                                        | veredicto (E1)                                                                                                                                   | veredicto adversarial                                                          |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| §20.1/§20.2 | CSP/headers + canal de report                                                          | PASS (Report-Only estrita, `unsafe-inline` = 0, `POST /api/csp-report` → 204)                                                                    | CONFIRMED                                                                      |
| §18         | rótulos por classe (`REAL`, `DADOS INCOMPLETOS`, `Simulação`, `Informado manualmente`) | PASS em `/inicio`, `/produtos`, `/simulacoes`, `/diagnostico`                                                                                    | 2 CONFIRMED · 2 CORRECTED (raw ausente → raws recapturados)                    |
| §33         | regressão financeira                                                                   | PASS — `current_price := NULL` ⇒ **DADOS INCOMPLETOS** e `—`, **nunca `R$ 0,00`**; produto incompleto sai dos destaques                          | CONFIRMED (com restauração provada)                                            |
| §32         | matriz de segurança                                                                    | PASS — XSS inerte (usuário **e** assistente), sem sessão → **403** (4 variantes), tenant B → **404** sem vazamento, AUTH-002 sem token acessível | CONFIRMED (1 CORRECTED: `sessionStorage` tem chave de scroll, não token)       |
| §23         | outbox                                                                                 | PASS — `expense.saved` na mesma transação da despesa                                                                                             | CONFIRMED + **atomicidade falsificada** com trigger venenoso (503, nada órfão) |

**Veredicto adversarial consolidado:** `VERDICT-ADVERSARIAL.md` — **12 CONFIRMED · 5 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE**; **nenhum comportamento de produto refutado**. As 5 correções são defeitos de **evidência** do artefato (raw ausente para 2 rótulos, captura feita em sessão trocada, `sessionStorage` não vazio, `400` do `sign-out` não reproduzível, enumeração do diretório) — todas incorporadas e re-verificadas (rodada 2: 6 CONFIRMED · 1 CORRECTED, tratado).

**Evidência selada:** `docs/evidence/browser-batteries-2026-09-16/playwright-mcp/` (36 arquivos, manifesto `playwright-mcp.sha256` com `sha256sum -c` = ALL MATCH) + `playwright-mcp-verifier/` (30 entradas com proveniência declarada) + o PNG do payload inerte. A regra de selo (`.prettierignore`, sem reformatar prova) ficou documentada no `AGENTS.md`.

## 3. Achados, anomalias e riscos declarados

| id      | tipo              | conteúdo                                                                                                                                                         | estado                                                   |
| ------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **B-1** | defeito menor     | `@vercel/analytics` montado sem condição (`src/routes/__root.tsx:11,119`) ⇒ 404 + recusa por MIME em **toda** navegação no preset `node-server` (21×21 nos raws) | WP proposto, **não** executado (fora do escopo do ciclo) |
| **A-1** | anomalia aberta   | `500 Seroval` no read path do diagnóstico por `curl` com sessão do owner (UI normal; sem controle `200` por `curl`)                                              | follow-up `F-C3-1` — **não** afirmado como defeito       |
| **B-3** | risco de ambiente | `DATABASE_URL_UNPOOLED` com host **de produção** presente no ambiente de execução do enxame (nenhum código consome; nenhuma escrita remota)                      | follow-up `F-C3-2` — manter no `DENY_SET` do guard       |
| **O-1** | observação        | `Custo dos ingredientes: R$ 0,00` com lista vazia é semântica explícita do motor (`finance.ts:246-260`)                                                          | limite declarado                                         |

**Correção de método para as próximas baterias:** `curl` autenticado **não** lê telas autenticadas neste app (SSR é shell cliente; `/produtos` responde 200 sem cookie) — rótulo financeiro se falsifica **no DOM**.

## 4. Fila humana e briefes

- **H-12 emitido** (`DECISIONS-PENDING/H-12.md`): TTL/retenção por camada **persistida** (L1–L5, com a taxonomia real da V7 §15.2 / ARQ §13 — **L0 não é persistido**, tensão resolvida por escrito) + escopo do `export`; recomendação **A**; consequência registrada para D4 (estados `expired`/`deleted`/`rejected` do Apêndice C). O **mecanismo** não depende dos valores.
- Fila inalterada nos demais: **H-10** (push/CI) · **H-6** (homologação) · **H-9** (`:5432`) · **H-11** (MCP Linear/Neon) · **H-2** (token Vercel) · **H-4** (PITR) · **H-5** (go-live) · **H-8** (ADR-029). Nenhum squad ficou ocioso esperando resposta: as trilhas desbloqueadas seguiram.

## 5. WP-D3 — dedup + versionamento + conflitos da memória (S7 mergeado · E2 verde)

- **Entrega:** commit `8c97651` (branch `mission/n3a-mem-d3`), integrado por merge `--no-ff` (`5de19af`).
- **O que entrou:** migration `0018_polite_living_tribunal` (registry `SAFE` / `appliedOn: empty`, down testado **up→down→up**) com `ai_memory_versions` (histórico append-only **por privilégio**: `SELECT`+`INSERT`; supersessão **derivada**) e `ai_memory_conflicts` (status `open|dismissed|resolved`), `dedup_key` + **índice único parcial** `(tenant_id, dedup_key) WHERE status='active'` em `ai_memories`, port ampliado (`append → {record, duplicated}`, `revise`, `recordConflict`, `listVersions`, `listConflicts`, `delete({ purgeHistory })`) e a suíte `scripts/db/test-memory.ts` estendida com **D3/T1–T8** + `src/test/memory-dedup.test.ts`.
- **E1 (squad):** `db:classify:check` 19/19 · `test-memory` com D2 + D3/T1–T8 **OK** · vitest dirigido **80/80** · `tsc` exit 0 · `test-migrations` OK (cadeia + replay; journal 19) · `psql` de policies/índices/grants (versões com `sel/ins=t`, `upd/del=f`).
- **E2 (MAESTRO, HEAD integrado `5de19af`, container PG17 virgem em `:55450`):** `npm run check` **exit 0** (9/9; bundle PASS 475.253 B) · `npm run db:test` **exit 0** com **D3/T1–T8 OK** · `m02:boundaries`/`m02:matrix:check`/`m02:lockfile-guard` exit 0 · `db:check` ("Everything's fine") após normalizar os metadados.
- **E2 pegou (a regra se pagou de novo):** `drizzle/meta/_journal.json` e `drizzle/meta/0018_snapshot.json` fora do `format:check` — normalizados por prettier e revalidados por `db:check`.
- **Regeneração da matriz (ato do MAESTRO):** `transactionSites` **119 → 123** (os 4 métodos novos do repositório) e as **4 entradas do overlay** que ainda diziam `contract-only` — `MemoryService`, `MemoryRepository`, `EventService`, `EventRepository` — passaram a `implemented` com o caminho de runtime. Consequência relevante: o gate `m02:boundaries` **filtra `contract-only` por desenho**, então essas trilhas estavam **cegas** para ele; agora são verificadas e o gate segue verde.
- **Decisões do STEWARD pós-E1** (`SPEC-DELTAS/DECISOES-STEWARD-CICLO-3-POS-E1.md`): **SD-C3-12** (em D4, `DELETE` em versões/conflitos para `app_runtime` — a eliminação por LGPD precisa ser executável pela role da aplicação; a imutabilidade continua enforçada pela **negação do `UPDATE`**, e as FKs seguem `RESTRICT` para forçar a ordem filho→pai) · **SD-C3-13** (ratifica os 3 arquivos fora do escopo exclusivo do card) · **SD-C3-14** (`superseded` derivado, constante nas linhas arquivadas — aceito) · **SD-C3-15** (`revise`/`listConflicts` como extensões mínimas do port).
- **Crédito de placar: nenhum** — D3 é **degrau** da escada §43 (o crédito do §43 vem com D7); a entrega entra como progresso **registrado**, nunca como item promovido sem E2.
- **Veredicto adversarial do WP (`CLAIMS-INBOX/MEM-D3-VERDICT.md`, 162 linhas, sondas próprias em worktree `--detach` e containers `:55460`/`:55461`):** **39 CONFIRMED · 1 CORRECTED · 0 REJECTED · 2 UNVERIFIABLE**. A correção é de **afirmação**, não de código: o par `up→down→up` da `0018` só vale com **`ai_memories` vazia** — com uma memória pré-existente o 2º up falha (`ADD COLUMN … NOT NULL … contains null values`) e o banco fica preso em 0017 ⇒ **o down é irreversível pós-tráfego** (o caminho canônico passa a ser restore de snapshot).
- **Achados não reivindicados pelo claim ⇒ rodada de correção dirigida (S6→S5, `SquadD3b`):** (a) `revise` para uma chave que já é o head ativo de outra memória vaza **`23505` cru** (não `ApplicationError`) ⇒ vira 500 — **defeito real**; (b) a normalização deixa passar **format chars invisíveis** (U+200B/U+2060/U+FEFF) ⇒ texto visualmente idêntico cria memória nova — **lacuna do próprio WP**; (c) o invariante "mesmo conteúdo ⇒ 1 ativa" vale para quem passa pelo repositório (o índice garante unicidade de **chave**, não `chave = hash(conteúdo)`) — fica **declarado** como fronteira de confiança, sem mudança de código.
- **Não sondado de forma independente:** concorrência e isolamento por tenant do dedup (T5/T6) — a evidência permanece a do E1 do squad (EXIT=0 reproduzido pelo verificador em cluster limpo, mas não por sonda própria). Declarado, não silenciado.

## 6. Incidentes de supervisão

1. **Colisão de escrita (reincidência do L22, contida):** o squad executou `db:generate` e as edições de schema com o `cwd` da sessão (worktree do MAESTRO), apesar de ter worktree próprio. O MAESTRO moveu os **8** arquivos para o worktree do squad com `sha256` byte a byte (8/8) e restaurou o próprio worktree; o squad refez o trabalho lá. **Lição:** worktree próprio **não basta** — `cwd` explícito em todo comando que muta.
2. **Browser MCP compartilhado:** sessão principal e verificadores dirigem o **mesmo** browser/contexto; capturas caem no mesmo scratch e `ref` de um pode invalidar o do outro. Mitigação: partição por manifesto + aviso mútuo + sessão conferida (`/api/auth/get-session`) antes de capturar.
3. **Gate de formatação vs. prova crua:** o `format:check` reprovou 18 snapshots crus; a solução não foi mutar a prova, e sim **selá-la** (precedente `docs/evidence/security-scan/**`), com a regra registrada no `AGENTS.md`.

## 7. Convergência NAS-2 §12 (status ao fim do ciclo 3)

- [x] **Pipeline:** zero item em S9 sem cadeia S1→S9; zero entrada de ledger sem **E2**; zero veredito sem re-derivação em contexto novo.
- [x] **Baterias:** §18/§20/§23/§32/§33 executadas como usuário real, com veredicto adversarial e correções re-verificadas.
- [x] **Briefes:** H-12 emitido; fila humana viva; baterias remotas com bloqueio **nomeado** (H-10/H-6/H-2/H-11/H-9) — nenhuma silenciada.
- [x] **WPs:** **WP-D3 mergeado** (`5de19af`) com **E2 verde** no HEAD integrado; veredicto adversarial do WP registrado em `CLAIMS-INBOX/MEM-D3-VERDICT.md`.
- [x] **Guardrails:** `:5432` intocado, nenhum host remoto tocado, nenhum guard enfraquecido, capturas cruas seladas e hasheadas.
- [x] **Placar:** **inalterado** (86,36% parcial / 80,21% crua) — nenhum item foi promovido sem E2; D3 é degrau da escada §43.
