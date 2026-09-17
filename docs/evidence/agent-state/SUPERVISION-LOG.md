# SUPERVISION-LOG — NAS-2 (append-only)

Formato de cada entrada (`LOG-ENTRY`): `timestamp · tier · decisão · racional · itens afetados · caminho de reversão`.

---

## 2026-09-16T12:0xZ · Tier A · adoção da NAS-2 e abertura do ciclo 1

- **Decisão:** adotar a máquina de estados **S0–S9** com a regra **E1/E2** (evidência de worktree = provisória; de HEAD integrado = autoritativa; ledger **só** com E2), contratos canônicos de handoff, WIP limit 1 por squad e escopo de arquivo exclusivo por WP.
- **Racional:** a rodada anterior só descobriu drift de matriz, contador de journal congelado e colisão de escopo do gate §35 **no HEAD integrado** — invisíveis nos worktrees. E1/E2 codifica essa lição como regra estrutural.
- **Itens afetados:** todos; `QUEUE.md` reescrito com os estados S0–S9.
- **Reversão:** 1 commit (o `QUEUE.md` anterior fica no histórico); nenhuma decisão de código.

## 2026-09-16T12:0xZ · Tier A · ciclo 1 despachado

- **Decisão:** despachar **WP-0** (bloqueante — matriz de transições 187×2), **WP-1a** (ledger de backfill + CAS), **WP-1b** (`summarize.mjs` emitindo o bloco §35) e **MEM-D0** (gap report §43), com escopos de arquivo disjuntos.
- **Racional:** WP-0 precede qualquer claim nova (integridade da régua); os demais são as trilhas desbloqueadas de maior destravamento/custo.
- **Itens afetados:** `QUEUE.md` (S0→S2 dos WPs), `SPEC-CARDS/` (cards semente herdados da NAS-2 §10).
- **Reversão:** cancelar dispatches e re-planejar (nada escrito em código neste passo).

## 2026-09-16T12:0xZ · Tier C · 4 briefes emitidos (H-10 · H-11 · H-9 · H-6)

- **Decisão:** emitir `DECISIONS-PENDING/{H-10,H-11,H-9,H-6}.md` no formato canônico + `REGISTRO-H.md`, com prioridade recomendada **H-10 → H-6 → H-9 → H-11**.
- **Racional:** regra anti-ócio — o enxame não espera; mas cada Tier C pendente é crédito que existe e não pode ser validado (CI) ou destravado (Neon live/tráfego).
- **Itens afetados:** `GATE-41`, `12.5`, `20.1`, `13.7`, baterias 3.1–3.3.
- **Reversão:** os briefes são arquivos; retirar do registro é 1 commit. Nenhuma ação externa foi tomada.

---

## 2026-09-17T02:4xZ · Tier A · ciclo 3 — alvo do QA-BROWSER é o **preview local**, não um alvo remoto

- **Decisão:** as baterias de computer-user (MCP Playwright) rodam contra um **preview local** (`node .output/server/index.mjs`, `127.0.0.1:4273`) conectado a um **container PG17 efêmero** (`nas2c3-pg`, `127.0.0.1:55432`) com a fixture `scripts/e2e/seed-auth.ts` — nunca produção, nunca `:5432`.
- **Racional:** o prompt da missão traz `{{APP_URL_PREVIEW}}` **sem valor**. Todas as alternativas remotas estão bloqueadas por gates nomeados: push/preview de branch exige **H-10**; o Web App de preview está em placeholder PHP (**H-6**); a branch Neon de preview exige **H-11/§42**. A única superfície viva e verificável hoje é a local, e o `AGENTS.md` sanciona override explícito para `127.0.0.1`. Produção é **negada** pelo quadro de permissões (§7).
- **Itens afetados:** baterias §18/§20/§23/§32/§33 (todas com evidência E1 em `docs/evidence/browser-batteries-2026-09-16/`).
- **Reversão:** subir o mesmo build contra outro alvo — as baterias são um artefato, não um contrato de ambiente.

## 2026-09-17T02:4xZ · Tier A · armadilha de porta medida (4173 já ocupada por servidor do repo principal em `:5432`)

- **Decisão:** toda bateria passou a subir em **porta dedicada** e só mutou estado depois de provar `pid → cwd → banco` (`/proc/<pid>/cwd` + env com host mascarado).
- **Racional:** a porta default do harness (4173) estava ocupada por um `nitro preview` do repo principal (`~/preco-que-d-main`, pid 935255) apontando para `:5432` — o container com dado não-fixture do **H-9**. Os primeiros probes de health (só leitura) foram respondidos por **esse** processo, não pelo servidor do worktree. Um detector ingênuo ("porta respondeu 200") teria rodado uma bateria **inteira** contra o banco errado.
- **Itens afetados:** `docs/evidence/browser-batteries-2026-09-16/CICLO-3-BATERIAS-UI.md` §1.1.
- **Reversão:** nenhuma (é diagnóstico); o processo do repo principal **não** foi tocado.

## 2026-09-17T06:0xZ · Tier A · navegação autônoma passa a usar o **Firefox do dono** (determinação humana) — método, limites e fatos de infra

- **Decisão:** adotar, como canal padrão de navegação para **infraestrutura** (hPanel/Vercel/Neon), o **Firefox do dono** com o perfil copiado para scratch e aberto pelo Firefox do Playwright — o MCP `playwright` do harness sobe Chromium **sem** os logins. A sessão viva do dono **não** é tocada (o Firefox dele segue aberto).
- **Racional:** o dono determinou explicitamente ("faça a navegação autônoma pelo firefox onde todo o ecossistema e infraestrutura está logada") e isso destrava leitura de estado que estava bloqueada por H-2/H-4. A técnica é read-only e reprodutível; nenhum modal de token/connection string foi aberto.
- **Fatos capturados (Neon, autoritativos):** plano **Free**; **History retention = 6 h** ⇒ **causa-raiz do H-4**; Postgres **17**; branch default **`production`** (`br-snowy-violet-aymcvvvv`, `Expires: Never`); 4 branches; endpoint **`ep-long-violet-aye9g0bn`** = o mesmo do **B-3** (severidade confirmada); IP restrictions: none; **BetterAuth habilitado**.
- **Limites declarados (sem contorno):** **hPanel** atrás de **Cloudflare Turnstile** mesmo em modo headed ⇒ **H-6 segue humano** (runbook de 2 min); **Vercel** autentica mas o SPA quebra ⇒ **H-2 segue humano** (token).
- **Itens afetados:** H-2, H-4, H-6, B-3, §42; artefato `docs/evidence/infra-recon-2026-09-17/` (método + 5 capturas seladas).
- **Reversão:** nenhuma (leitura); o scratch `/tmp/ff-profile` é descartável.

## 2026-09-17T05:2xZ · Tier A · **STOP CONDITION acionada** (credencial de produção no ambiente) — contida e convertida em regra

- **Decisão:** (1) **escalar ao dono** a condição de parada do loop SDD §8 ("credencial de produção detectada no ambiente"); (2) adotar como regra sistêmica o strip no lançamento (`env -u DATABASE_URL_UNPOOLED …`) para todo processo longo ou agente do enxame; (3) **não** iniciar o ciclo 4 (S0) até o aceite do dono.
- **Racional (fatos medidos, não inferidos):** `DATABASE_URL_UNPOOLED` aponta para o endpoint **de produção** do Neon e existe no ambiente **herdado** da sessão do dono (presente em `omp`, VS Code e `gnome-keyring-daemon`; ausente do shell interativo do agente) — logo **todo** processo supervisionado lançado pelo `hub` a herda (foi o caso do servidor de preview do ciclo 3). Contenção verificada: **nenhum código do repo a consome** (`scripts/env-guard.mjs` só a inspeciona; `scripts/m02-v2b.mjs:572` a define para o drill sancionado), o `env-guard` faz **DENY fail-closed** com o prefixo de produção (exit 3) e o strip foi **provado** com dois processos idênticos (`CONTROLE_SEM_STRIP=PRESENTE` / `COM_STRIP=AUSENTE`).
- **Itens afetados:** todo lançamento de processo do enxame; `AGENT-ENV-NOTES.md` §10 (lição durável); `CONFORMIDADE-LOOP-SDD-CICLO-3.md` §3–§4 (checklist de parada + escalonamento); S0 do ciclo 4 fica **bloqueado por aceite**.
- **Reversão:** a regra é operacional (1 linha em cada lançamento); o aceite do dono pode optar por remover a variável do perfil de login, o que extingue a condição na raiz.

## 2026-09-17T03:1xZ · Tier A · **reincidência da colisão de escrita** (lição do L22) — squad escreveu no worktree do MAESTRO

- **Decisão:** o MAESTRO **moveu** os artefatos do WP-D3 para o worktree do squad (`/tmp/wt-mem-d3`, branch `mission/n3a-mem-d3`) com verificação `sha256` (8/8 byte-idênticos) e restaurou o próprio worktree ao HEAD; o squad recebeu steer com a regra de `cwd` explícito e a lista de armadilhas do ambiente dele (sem `node_modules`, sem `.env`).
- **Racional:** apesar de o squad ter criado o worktree próprio, ele executou `drizzle-kit generate` e as edições de schema com o `cwd` da sessão (meu worktree). É exatamente a falha do L22 — **worktree próprio não basta; o `cwd` tem de ser explícito em cada comando**. Sem a movimentação, o commit de código do WP-D3 se misturaria ao meu commit documental e o gate `format:check` acusou os artefatos do squad no meu lado (17 arquivos).
- **Itens afetados:** `drizzle/**` (0018 + meta + journal + rollback), `scripts/db/migration-classes.ts`, `src/db/schema.ts`, `src/server/contracts/memory.contracts.ts`; `QUEUE`/relatório do ciclo 3 registram o incidente.
- **Reversão:** o squad segue no worktree dele; meu lado está no HEAD menos os arquivos documentais desta rodada.

## 2026-09-17T02:5xZ · Tier A · capturas brutas do browser são **seladas**

- **Decisão:** `docs/evidence/*/playwright-mcp/**` entra no `.prettierignore` (com comentário) e a regra é registrada no `AGENTS.md`; o markdown autoral das baterias é formatado normalmente.
- **Racional:** o `npm run check` reprovou no `format:check` por 18 YAMLs de snapshot de acessibilidade. Reformatá-los mutaria a **prova**; o repositório já tem o precedente explícito para evidência selada (`docs/evidence/security-scan/**`). Escopo do gate preservado — nenhum teste/lint/budget afrouxado.
- **Itens afetados:** `.prettierignore`, `AGENTS.md` (seção "Decisions and evidence").
- **Reversão:** remover as 2 linhas + a menção no `AGENTS.md` (1 commit).

## 2026-09-17T02:5xZ · Tier B · achado **B-1** registrado, WP proposto e **não** executado

- **Decisão:** registrar B-1 (`@vercel/analytics` incondicional ⇒ 404 + recusa por MIME em `/_vercel/insights/script.js` em toda navegação no preset `node-server`; `src/routes/__root.tsx:11,119`) como achado com **WP-B1 proposto fora deste ciclo**; nenhuma correção aplicada.
- **Racional:** o papel adversarial reporta, não conserta; e a correção exige uma decisão de design (como expor o alvo Vercel ao bundle cliente) que não está no escopo dos WPs despachados. Impacto medido: ruído de console + analytics quebrado fora da Vercel — **sem** risco de segurança (o script não executa; CSP estrita intacta).
- **Itens afetados:** `docs/evidence/browser-batteries-2026-09-16/CICLO-3-BATERIAS-UI.md` §3.
- **Reversão:** o WP pode ser promovido a spec-card a qualquer momento (1 arquivo).
