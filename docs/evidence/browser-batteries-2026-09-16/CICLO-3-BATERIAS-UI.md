# BATERIAS UI — NAS-2 ciclo 3 (computer-user via MCP Playwright)

> **Escopo:** validação da aplicação como **usuário de computador** (navegação real por árvore de
> acessibilidade) contra um preview **local**, com fixture seguro. Nenhuma bateria tocou produção.
> **Status:** evidência **E1** (worktree) já submetida a **verificação adversarial em contexto novo** —
> `VERDICT-ADVERSARIAL.md`: **12 CONFIRMED · 5 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE**, sem nenhuma
> refutação de comportamento de produto. As 5 correções são defeitos **deste artefato** e estão
> incorporadas abaixo (coluna "adversarial" e §6).

## 1. Ambiente e guardrails

| item            | valor                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Commit avaliado | `53b2996` (= `develop` local, nenhum push — H-10)                               |
| Alvo            | `http://127.0.0.1:4273` (preset `node-server`, build de `53b2996`)              |
| Banco           | container **efêmero** `nas2c3-pg` (PG17-alpine, `127.0.0.1:55432`), removível   |
| Fixture         | `scripts/e2e/seed-auth.ts` (`owner@preco-que-da.test`, tenant `tenant-e2e`)     |
| Driver          | `DATABASE_DRIVER=node-postgres`; env-guard verde (todo host = `127.0.0.1`)      |
| Browser         | MCP Playwright (Chromium), navegação por `ref` da árvore de acessibilidade      |
| Não tocado      | produção, Neon (H-11/§42), `:5432` (H-9 — contém dado não-fixture), push (H-10) |

### 1.1 Achado de ambiente (não é defeito do produto)

A porta `4173` (default do harness e2e) estava **ocupada** por um `nitro preview` do repo principal
(`~/preco-que-d-main`, pid 935255) apontando para `:5432` — o container com dado não-fixture do H-9.
O servidor desta bateria foi subido em **4273** e sua identidade foi provada por
`/proc/<pid>/cwd` + env (host mascarado): `cwd` = este worktree, `DATABASE_URL` = `127.0.0.1:55432`.
**Lição:** "porta respondeu 200" não prova qual processo respondeu; em ambiente com múltiplas
sessões, provar `pid → cwd → banco` antes de qualquer mutação. O verificador adversarial repetiu essa
prova por conta própria (§0 do veredicto) e chegou ao mesmo `pid 2443804`.

### 1.2 Correções de evidência em voo (C-1, C-2, C-3) — declaradas, não silenciadas

- **C-1 — headers de §20 medidos no servidor errado.** Os primeiros probes (`02:47:19Z`) foram feitos
  contra **4173** (processo estranho, build antigo) e mostraram um header `content-security-policy`
  **enforçado** — que **não** descreve o HEAD avaliado. Ressalva de lastro: essa captura de header
  **não** entrou no conjunto selado (`grep 4173 playwright-mcp/` = 0), de modo que o enforçamento do
  processo 4173 fica como **inferência** a partir do `CSP_ENFORCE=true` medido no env dele pelo
  verificador (`/proc`), não como raw selado. Re-medido em `02:58:47Z` no 4273, o
  comportamento é o esperado pela suíte e2e: header **`content-security-policy-report-only`**.
- **C-2 — dois rótulos citados sem raw.** As linhas §18b (`/produtos`) e §18c (`/simulacoes`) citavam
  textos que **não existiam** em nenhum dos snapshots selados (o verificador provou por `grep` que os
  dois snapshots dessas rotas tinham 100 B / `Carregando...`). Os comportamentos foram reproduzidos em
  DOM pelo verificador e os raws foram **recapturados** com a sessão certa:
  `playwright-mcp/nas2c3-produtos-owner.yml` ("1 produto cadastrado", `REAL`,
  `Custo: R$ 10,00 · Preço: R$ 20,00 · Margem: 35,00%`) e
  `playwright-mcp/nas2c3-simulacoes-owner.yml` (`Simulação manual`, `Estimativa (projeção)`,
  `Faturamento simulado`, `Informado manualmente`,
  `Resultado operacional simulado dentro do escopo informado`).
- **C-3 — captura com sessão trocada.** Uma tentativa de recaptura (`03:02`) saiu na sessão do
  **tenant B** (o browser MCP é compartilhado entre a sessão principal e os subagentes). O arquivo foi
  renomeado para `playwright-mcp-verifier/nas2c3-produtos-TENANT-B-0302.yml` (raw legítimo da visão de
  B, insumo do §32c) e a sessão passou a ser **conferida** (`GET /api/auth/get-session` → e-mail) antes
  de cada captura.

**Correção de método para as próximas baterias:** `curl` autenticado **não** lê telas autenticadas
neste app — o SSR é um _shell_ cliente (4231 B, `Carregando...`, sem conteúdo de rota) e `/produtos`
responde `200` **sem** cookie. Rótulo financeiro se falsifica **no DOM**, não por `curl`.

## 2. Veredictos por bateria

| #      | bateria (§Plano)            | cenário                                                                                     | esperado                                               | observado                                                                                                                                                                                                                                                                                                                                                  | veredito                                                    | adversarial |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------- |
| B-§20  | §20.1/§20.2 CSP/headers     | `GET /` e `GET /api/health/live` em **4273**                                                | CSP estrita, sem `unsafe-inline`; canal de report vivo | `content-security-policy-report-only` com `script-src 'self'` + `report-uri`/`report-to`; `reporting-endpoints: csp-endpoint="/api/csp-report"`; HSTS, `nosniff`, Referrer-Policy, Permissions-Policy; `POST /api/csp-report` → **204**; `grep unsafe-inline` = 0                                                                                          | **PASS** (Report-Only; `CSP_ENFORCE=false`)                 | CONFIRMED   |
| B-§18a | §18 rótulos                 | `/inicio` sem vendas                                                                        | não presumir volume/margem                             | `Faturamento real: —` + "Nenhuma venda real registrada."; badge **DADOS INCOMPLETOS** na margem consolidada                                                                                                                                                                                                                                                | **PASS**                                                    | CONFIRMED   |
| B-§18b | §18 rótulos                 | `/produtos`                                                                                 | rótulo de classe por item                              | badge **REAL** + `Custo: R$ 10,00 · Preço: R$ 20,00 · Margem: 35,00%` (raw recapturado, §1.2 C-2)                                                                                                                                                                                                                                                          | **PASS**                                                    | CORRECTED   |
| B-§18c | §18 rótulos                 | `/simulacoes`                                                                               | hipótese ≠ factual                                     | badge **Simulação** ("não é dado factual e não alimenta KPIs"); `Volume real: —`; `Simulação manual` × `Estimativa (projeção)`; resultado com `Origem do volume: Informado manualmente` e `Faturamento simulado` (raw recapturado, §1.2 C-2)                                                                                                               | **PASS**                                                    | CORRECTED   |
| B-§18d | §18 rótulos                 | `/diagnostico`                                                                              | cálculo com escopo explícito                           | rótulos por linha: "Cálculo do motor financeiro", "Valor praticado cadastrado", "Referência externa sem fonte estruturada", "Simulação não salva", "Cálculo no escopo informado"; `—` no preço mínimo                                                                                                                                                      | **PASS**                                                    | CONFIRMED   |
| B-§33a | §33 regressão financeira    | `products.current_price := NULL` → `/produtos`                                              | incompleto, nunca `R$ 0,00`                            | badge **DADOS INCOMPLETOS**; `Custo: — · Preço: — · Margem: —`; dado **restaurado** (`20.0000`/`draft`, `updated_at` original) e restauração provada por psql                                                                                                                                                                                              | **PASS** (falsificação executada)                           | CONFIRMED   |
| B-§33b | §33 regressão financeira    | mesmo estado → `/inicio`                                                                    | não destacar número fabricado                          | produto **excluído** dos destaques + alerta "1 produto(s) não participa(m) dos destaques por ter dados incompletos"; após restaurar, o destaque volta e o alerta desaparece                                                                                                                                                                                | **PASS**                                                    | CONFIRMED   |
| B-§32a | §32 XSS no chat             | `<script>`, `<img onerror>`, `<svg onload>`, `[x](javascript:)`, `<iframe src=javascript:>` | payload inerte                                         | renderizado como **texto**; `window.__xss` `undefined`; `scriptsInLog=0`, `iframes=0`, `anchorsInLog=[]`; os `<svg>` do log são ícones `aria-hidden`. O verificador ainda atacou com payloads alternativos **no caminho do assistente** (linha inserida em `chat_messages`) e no código não há `dangerouslySetInnerHTML`                                   | **PASS**                                                    | CONFIRMED   |
| B-§32b | §32 chamada direta sem auth | `POST`/`GET` no `_serverFn` de despesa sem cookie                                           | 401/403                                                | **403** em **4/4** variantes (corpo vazio; `x-tsr-serverfn` + JSON; GET com payload; cookie **forjado**)                                                                                                                                                                                                                                                   | **PASS**                                                    | CONFIRMED   |
| B-§32c | §32 tenant A acessa B       | sessão do tenant B replay do read path com `product_id` do tenant A                         | 403 / zero rows                                        | **404 `NOT_FOUND`** com `correlationId`, sem vazamento e sem revelar existência; UI de B: "0 produtos cadastrados"; setup do tenant B verificado no banco                                                                                                                                                                                                  | **PASS**                                                    | CONFIRMED   |
| B-§32d | §32 AUTH-002                | `document.cookie` / `localStorage` / `sessionStorage` na sessão autenticada                 | nenhum token acessível                                 | `document.cookie` **vazio**; `localStorage` **vazio**; cookie de sessão `HttpOnly` + `SameSite=Lax` (servidor); **porém** `sessionStorage` contém a chave **`tsr-scroll-restoration-v1_3`** (não é token)                                                                                                                                                  | **PASS** (com a correção de que storage **não** está vazio) | CORRECTED   |
| B-§23  | §23 outbox                  | "Adicionar despesa" (`/despesas`)                                                           | evento na **mesma transação**                          | `expense.saved` para `expense/816b6e5b-…` no tenant `…0002` em `02:52:09.66Z`, com a UI em `R$ 723,45`. **Atomicidade falsificada de verdade pelo verificador:** com trigger `BEFORE INSERT` venenoso em `outbox_events` → **503** e **nada órfão** (expenses 3, outbox 1); sem veneno → despesa+evento entram juntos; controle pós-drop volta a funcionar | **PASS**                                                    | CONFIRMED   |
| B-§23b | §23 inventário              | inventário do módulo                                                                        | —                                                      | `outbox_events`, `outbox_consumptions`, `audit_events` presentes; outbox `1` após a mutação (o "0 antes" não é reconstruível a posteriori — ressalva do verificador)                                                                                                                                                                                       | **PASS**                                                    | CONFIRMED   |

## 3. Achados

### B-1 (defeito, menor) — `@vercel/analytics` incondicional quebra fora da Vercel

- **Medido:** **21×** `GET /_vercel/insights/script.js → 404` e **21×** `Refused to execute script … MIME type ('text/html') is not executable` nos logs de console selados (uma dupla por navegação).
- **Causa:** `<Analytics />` de `@vercel/analytics/react` montado **sem condição** em `src/routes/__root.tsx:11,119`; no preset `node-server` (local **e** Hostinger) o script de insights não existe.
- **Impacto:** ruído de console + analytics quebrado fora da Vercel. **Sem risco de segurança** (o script não executa; a CSP estrita segue válida).
- **Encaminhamento:** **WP-B1 proposto, fora deste ciclo** (exige decidir como expor o alvo Vercel ao bundle cliente). Não corrigido aqui: o papel adversarial reporta, não conserta.

### O-1 (observação, sem veredicto de defeito)

`Custo dos ingredientes: R$ 0,00` em `/diagnostico` para produto **sem ingredientes cadastrados** é
semântica **explícita do motor**: `calculateRecipeCost` (`src/lib/finance.ts:246-260`) devolve `null`
(desconhecido) apenas quando **alguma linha** é desconhecida; lista vazia soma `0`. Reproduzido em DOM
pelo verificador. Fica registrado como limite declarado: "produto sem ingredientes = custo de receita
zero, não desconhecido".

### A-1 (anomalia ABERTA — reportada pelo verificador, não resolvida)

`GET /_serverFn/98bc963f…` (caminho de leitura do diagnóstico) com **cookie do owner** via `curl`
respondeu **500 `INTERNAL_ERROR`** com `Seroval Error (step: 3)` em **4** combinações de premissas,
enquanto a **UI do owner renderiza `/diagnostico` normalmente**; a mesma URL com sessão do tenant B
devolve `404`. O `500` discrimina a sessão, mas **não** foi possível obter controle `200` por `curl`.
**Não é afirmado como defeito** — hipóteses não descartadas: serialização da resposta dependente de
contexto do browser, hash de `serverFn` de build anterior, ou assimetria real de tratamento de erro.
**Registrado como follow-up `F-C3-1`** (ver §6). Não bloqueia nenhuma bateria.

### B-3 (risco latente de ambiente — declarado)

O processo do servidor carrega `DATABASE_URL_UNPOOLED` apontando para o endpoint **de produção** do
Neon (prefixo `ep-long-violet-aye9g0bn`, o mesmo que o `env-guard` **nega por hard-deny**). Nenhum
código do app consome essa variável hoje (só `scripts/env-guard.mjs:41` a inspeciona e
`scripts/m02-v2b.mjs:572` a define) e **nenhuma operação desta bateria tocou host remoto** — provado
pelo verificador. Ainda assim, o quadro de permissões da missão diz que "a credencial de produção não
deve existir no ambiente de execução do enxame": **o ambiente ambiente viola isso**. Encaminhamento:
manter `DATABASE_URL_UNPOOLED` no `DENY_SET` e exigir que qualquer script novo que a leia passe pelo
`env-guard` (registro como `F-C3-2`).

## 4. Artefatos brutos

- `playwright-mcp/` — **36 arquivos** selados da bateria: snapshots de acessibilidade por página, logs
  de console por navegação, `xss-chat-payload-inert-2026-09-17.png` e os dois raws recapturados
  (`nas2c3-produtos-owner.yml`, `nas2c3-simulacoes-owner.yml`).
- `playwright-mcp-verifier/` — **30 entradas**: **26** capturas do papel adversarial (12 `page-*.yml` + 14 `console-*.log`, janela `02:57–03:07Z`) + **3 do STEWARD** (as navegações `page-…03-02-42-506Z.yml` — a que saiu na sessão do tenant B — e `page-…03-03-39-996Z.yml`, mais o arquivo renomeado `nas2c3-produtos-TENANT-B-0302.yml` para dizer a verdade) + `README.md` de proveniência. A partição **não** é limpa nesses 2 `page-*` — declarado no `README.md` do diretório.
- **Integridade:** `playwright-mcp.sha256` (36 linhas; `sha256sum -c` → `ALL MATCH`). O selo casa com a
  exclusão do `format:check` documentada no `AGENTS.md` (evidência crua não é reformatada).
- `VERDICT-ADVERSARIAL.md` — veredicto linha a linha (17 linhas), com as restaurações provadas e os
  resíduos.

## 5. Limites declarados (o que esta bateria **não** cobre)

1. Só **Chromium** (MCP). Firefox/WebKit são cobertos pela suíte `e2e` no CI, não por esta bateria.
2. **Sem sweep de axe/a11y** aqui (a suíte `ui-stack.spec.ts` cobre violações bloqueantes).
3. **Idempotência de replay** de mutação não foi exercitada pela UI (`idempotency_records = 0` no fim);
   a cobertura é a de `db:test`. Registrar como **não-medido nesta bateria**.
4. Rotas `/precos`, `/vendas`, `/ponto-equilibrio` e o fluxo completo de cadastro por conversa não foram
   percorridos (o chat depende de gateway de IA com chave; o envio devolveu "⚠️ Um serviço necessário
   está indisponível.", que é o comportamento honesto esperado de INV-013).
5. Nenhuma série `OBSERVED`/RUM foi promovida por esta bateria (depende de H-6).
6. `curl` autenticado não substitui DOM neste app (§1.2, correção de método) — as próximas baterias
   devem medir rótulos no browser.

## 6. Veredicto adversarial — o que mudou por causa dele

`VERDICT-ADVERSARIAL.md` re-derivou cada alegação com sondas próprias (incluindo ataques **mais fortes**
que os originais: payloads alternativos no caminho do assistente, trigger venenoso para provar
atomicidade do outbox, replay cross-tenant de dentro do browser, cookie forjado). Resultado:
**12 CONFIRMED · 5 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE**.

Correções aplicadas a este artefato: (i) §18b/§18c — raw inexistente na verificação → raws
recapturados e conferidos por `grep`; (ii) §32d — `sessionStorage` **não** está vazio (tem a chave de
restauração de scroll, não um token); (iii) O-2 — o `400` do `sign-out` **não** se reproduz (sem
`content-type` → `415`; com JSON+Origin → `200`), substituído pela medição do verificador;
(iv) inventário do §4 — o PNG citado não estava no diretório na medição (foi movido depois);
(v) §20 — a captura original veio do servidor errado (C-1).

Follow-ups abertos por esta rodada: **F-C3-1** (anomalia `500` do read path por `curl`, §3) ·
**F-C3-2** (`DATABASE_URL_UNPOOLED` no ambiente, §3) · **WP-B1** (`@vercel/analytics`, §3).
