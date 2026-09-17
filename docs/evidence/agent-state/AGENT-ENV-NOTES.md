# Notas de ambiente do agente — destilado da memória (poda 2026-09-13)

**Por que existe:** a podagem J5 (INFRA-MEM-01) reduziu os stores de memória do pi-hermes a um **índice de boot**.
Conhecimento durável de ambiente/ferramentas foi **demovido de cache para artefato versionado** — esta é a fonte;
a memória voltou a ser cache invalidável (`AGENTS.md` §Session boot and progress journal).
**Backup integral (texto original, 4 stores):** `~/.local/share/pi-fronts/memory-prune-2026-09-13/` (fora do repo; ponteiro no journal).

Data da destilação: **2026-09-13** · Escopo: lições ainda correntes (entradas obsoletas foram descartadas de propósito).

## 1. Ferramentas de edição e verificação

- **Edição/patch:** hooks do pi podem auto-formatar/autofixar; após edição falha ou parcial, **reler do disco** antes de editar de novo; nunca escrever sobre conteúdo velho. Antes de commitar: `git status` + diffs staged/unstaged; commitar só o pretendido. (2026-07-11)
- **pi-lens:** resultados dependem de escopo/cache/turno — `paths`/`delta` podem devolver só findings em cache e totais podem estar stale. Antes de fechar, rodar `mode=full` nos caminhos exatos; `timeout`/“unconfirmed” = desconhecido. (2026-07-16)
- **`npm run preview` (Nitro) sobe na porta 3000**, não 4173 (a 4173 é do `vite preview`). (2026-08-29)

## 2. context-mode / hypa / shell

- **`ctx_execute_file` é confinado ao root do projeto** — não lê `/tmp/pi-subagents-uid-*` nem `docs/evidence` fora do cwd; para esses casos usar `bash` + Node com resumo limitado. Colunas de tabela e one-liners com aspas aninhadas quebram no wrapper do ctx; preferir script em arquivo. (2026-08-11/2026-09-13)
- **O reducer do hypa pode truncar/“fabricar” saída** quando o comando contém certos padrões — sintoma real desta rodada: `wc -l` via pipe devolveu 4 quando o real era 125. **Medir com arquivo intermediário** (`cmd > /tmp/x; wc -l < /tmp/x`) em vez de confiar em pipe comprimido. (2026-09-13, refinado nesta poda)
- **O tool `bash` estripa intermitentemente atribuições/expansões `$VAR`** em one-liners multi-comando. Workaround que funciona: escrever a lógica num arquivo e rodar `bash script.sh`. (2026-08-29)
- **Nunca rodar `npm ci`** (ou qualquer reinstalação que apague `node_modules`) **enquanto subagentes estão ativos** — eles quebram no meio. (2026-09-11)

## 3. Subagentes

- **Fan-out sobre um MESMO arquivo mutável colide** — um escritor por arquivo/diretório; paralelizar só com escopos disjuntos. (2026-09-11)
- **Contrato do `worker` exige edições de arquivo** para tarefas de implementação (verificação read-only não satisfaz). (2026-09-13)
- **`researcher` não tem ferramentas web neste runtime** (devolve “need_decision”) — DOC-FIRST é feito pelo parent. (2026-09-12)
- Subagente pode expor **apenas** `read`/`write`/`contact_supervisor` quando o protocolo pede supervisor. (2026-09-11)

## 4. Sessões de navegador real

- **Cookies de sessão de navegador real:** a via que funciona é **Firefox Flatpak** (não o Chrome snap, criptografado); normalizar `PRTime` (÷1e6) e nulos→-1 ao injetar em contexto Playwright Firefox. (2026-09-11)
- **hPanel + Cloudflare:** rajadas de navegação automatizada disparam challenge intermitente (headed + espera não resolvem); 429 após ~7 páginas por IP, compartilhado entre contextos. **Não martelar** — canal negado = limite declarado; watcher de re-login em vez de re-sondagem. (2026-09-11/12)
- **Automação do painel Vercel** (`flow.mjs --site vercel`): linhas da lista de deployments **não são âncoras** (abrir por clique JS usando o texto do SHA; `data-testid` traz `deployments/deployment-entity/dpl-…`); `text=` do Playwright não casa o título truncado; **build log e valores de campos não saem no dump de innerText** (extrair via `eval` em `select`/`input` por `aria-label`). (2026-09-13)

## 5. Vercel (projeto `preco-que-da-lucro`)

- **Contrato de build:** só passa quem emite a **Build Output API** (`.vercel/output`) — exige `nitro: { preset: process.env.VERCEL ? "vercel" : "node-server" }`; sem isso o preset de framework do projeto (`TanStack Start`, importado do Lovable) exige `dist` e falha com `No Output Directory named "dist" found`. Node do projeto = `24.x`. Config vive só no painel (drift fora do repo). (2026-09-13)
- **Criar token pela UI está bloqueado** por combobox customizado (H-2 aberto; sem token/CLI, inventário de config não é possível). (2026-09-12)

## 6. Neon / MCP

- **MCP Neon usa `snake_case`**: `neon_run_sql`/`neon_get_connection_string` exigem `project_id`, `database_name`, `branch_id`. (2026-09-13)
- Topologia e estado: ver `EXECUTION-STATE-PROGRAM.md` e `docs/evidence/neon-prontidao-2026-09-13.md` (produção `damp-forest-57346541`, 12/12, PITR 6 h → BAK-01b aberto).

## 7. Gates locais e ambiente de build

- **`.env` local aponta para produção** (hazard estrutural): todo `dev`/`test`/`build`/`db` exige **override explícito para `127.0.0.1`** (postgres Docker `preco_que_da_lucro_test`); o `env-guard` faz DENY em alvo remoto — nunca contornar com variável ambiente apontando para fora de `127.0.0.1`. (2026-09-12/13)
- **`npm run check | tail -N` mascara o exit code** (o 0 vem do `tail`): preservar o código real (`cmd > log; echo $?`). (2026-09-13)
- **`m02:state:check` exige marcador parent-pinned = `HEAD^`**: todo commit que toca o ledger precisa atualizar o marcador **no mesmo commit**. (2026-09-13)
- **Lockfile:** `m02:lockfile-guard` é fail-closed e roda como primeiro passo do `check`/CI; houve drift fantasma do `drizzle-kit` sem log npm (causa aberta, dono Douglas). (2026-09-12)

## 8. Alvo hPanel e bloqueio de engines

- **Node do alvo Hostinger 24.x = v24.6.0** (npm 11.5.1) e o repo exige `engines >= 24.15.0` com `engine-strict=true` → **EBADENGINE**; workaround: env não-secreta `NPM_CONFIG_ENGINE_STRICT=false` (transição; ADR-028 pendente de ratificação = H-7). H-6 (2 min no Firefox) segue sendo o desbloqueio humano. (2026-09-12/13)
- **Probe de auth:** `GET /api/auth/get-session` 200 com corpo `null` **não** prova troca de `baseURL` (o `originCheckMiddleware` retorna cedo em GET) — a asserção que discrimina é o host do link de reset. (2026-09-13)

## 9. Processo

- **DOC-FIRST é permanente:** toda afirmação operacional sobre sistema externo cita doc oficial; divergência doc↔runbook = GAP-DOC com emenda. (2026-09-12)
- **Escopo/autorização:** revisões e implementações ficam dentro do trabalho explicitamente aprovado; “continuidade conforme o Plano Mestre” autoriza **análise** do próximo lote, não implementação; aprovar plano antes de mudanças amplas/sensíveis. (2026-08-10/11)
- **Verificação de entrega:** nunca inferir push/CI de refs locais; conferir `git ls-remote`/`gh run list` e o SHA remoto == HEAD. (2026-07-23)
- **Worktrees aninhados** (`.p0-closeout-docker`, `.worktree-*`, `~/.codex/worktrees/*`) aparecem como “pendentes” na IDE e não pertencem ao repo principal — inventariados; port do lote P0 em curso. (2026-09-13)

---

## 10. Credencial de produção no ambiente da sessão — **stop condition do loop SDD** (2026-09-17)

- **Fato medido:** `DATABASE_URL_UNPOOLED` aponta para o endpoint **de produção** do Neon (`ep-long-violet-aye9g0bn…`, o mesmo prefixo que o guard hard-deny) e existe no ambiente **herdado** da sessão do dono — não no shell interativo do agente, mas em processos do harness (`omp`, VS Code, `gnome-keyring-daemon`) e, por herança, em **todo processo supervisionado** lançado pelo `hub` (o servidor de preview do ciclo 3 subiu com ela presente).
- **Contenção verificada:** (i) **nenhum código do repo consome** a variável — `scripts/env-guard.mjs` apenas a inspeciona e `scripts/m02-v2b.mjs:572` a define para o drill sancionado; (ii) o `env-guard` faz **DENY fail-closed** (`exit 3`) com o prefixo de produção detectado (`npm run pretest` → `DENY`, host mascarado na saída).
- **Regra sistêmica (obrigatória a partir do ciclo 3):** **todo processo longo ou agente lançado pelo enxame** sobe com `env -u DATABASE_URL_UNPOOLED …` — e, por extensão, com strip de qualquer variável capaz de carregar credencial de produção — para que o runtime do enxame **nunca** porte credencial de produção.
- **Prova do mecanismo (medida, não inferida):** dois processos supervisionados idênticos, um sem e outro com o strip → `CONTROLE_SEM_STRIP=PRESENTE` / `COM_STRIP=AUSENTE`.
- **Ação do dono (mais limpa, opcional):** remover a variável do perfil de login se nenhum outro fluxo local a usa.
- **FECHAMENTO NA RAIZ (2026-09-17, apuração forense):** a variável **não** vinha de rc/profile/`environment.d`/config do harness — vinha do **`.env` do repo principal**, que o harness **carrega no start da sessão** e injeta nos seus processos. Prova: **17 de 17** chaves daquele arquivo estão no env do processo worker do harness (`pi-coding-agent`) enquanto seus ancestrais (`omp`, `bash`, `gnome-terminal-server`, `systemd --user`) **não** têm nenhuma. Ou seja: o achado B-3 era **maior** que uma variável — era o **arquivo inteiro** (incl. `DATABASE_URL` de produção, `AWS_SECRET_ACCESS_KEY`, `BETTER_AUTH_SECRET`) disponível a todo processo do enxame.
  - **Correção aplicada:** `~/preco-que-d-main/.env` (produção, 17 chaves) foi **movido** para `.env.production-local-<ts>` (com cópia em `.env.production-backup-<ts>`) e um **`.env` novo, local-only** (8 chaves, todas `127.0.0.1`/local, zero referência a produção) foi criado — `.env` é gitignored, então não há efeito no repo.
  - **Efeito:** sessões **novas** passam a ingerir só o ambiente local. A **sessão corrente mantém a cópia em cache** (processo já iniciado) ⇒ **a regra `env -u` continua obrigatória** para todo lançamento do enxame.
  - **Verificação do DoD** (ausência definitiva) numa sessão nova: `tr '\0' '\n' < /proc/<pid-do-worker>/environ | grep -c '^DATABASE_URL_UNPOOLED='` = **0**; e nenhuma das 17 chaves do antigo arquivo deve aparecer.
- **Nota de boot:** ao subir qualquer serviço, confira o env do processo (`/proc/<pid>/environ`, host mascarado) **antes** de apontar o browser ou rodar mutação — a checagem `pid → cwd → banco` do ciclo 3 nasceu de uma armadilha real (porta 4173 respondida por um `nitro preview` de outro repo apontando para `:5432`).

---

**Nota de manutenção:** este artefato é a fonte durável; a memória do agente guarda apenas um índice de boot apontando
para o journal e para cá. Acrescentar lições aqui **antes** de qualquer nova gravação em memória (regra `AGENTS.md`).
