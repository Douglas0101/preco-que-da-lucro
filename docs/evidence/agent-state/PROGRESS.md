# PROGRESS — journal de agente (ponteiros, não conteúdo)

> **Para que serve:** é o handoff entre sessões/modelos. Um agente novo lê **este arquivo** e retoma em ~30 s
> sem depender de memória de agente (que é cache invalidável — ver `AGENTS.md`).
> **Regra dura:** este arquivo carrega **apenas ponteiros** (caminhos, SHAs, timestamps, estados, nomes de env).
> Nunca valores de segredo, nunca conteúdo longo — o conteúdo vive nos artefatos apontados.

## 0. Protocolo de escrita (obrigatório)

1. **Intenção ANTES da mutação** (linha `▶` com timestamp UTC e o que vai ser feito + onde).
2. **Resultado DEPOIS** (linha `✔` ou `✘` com timestamp UTC, veredito e ponteiro de evidência).
3. **Boot com intenção órfã** (linha `▶` sem `✔`/`✘`): **não reexecutar às cegas** — reconciliar o mundo primeiro
   (checar artefato/branch/deployment), registrar o que de fato ocorreu e só então decidir.
4. **Marcos:** commit deste arquivo a cada fronteira de fase. **Perda máxima aceitável:** reexecutar desde o
   último marco (declarado, não implícito).
5. Par intenção/resultado é **append-only**; correções entram como nova linha, nunca reescrevendo a anterior.

## 1. Estado corrente

- **Fase:** `J — PROGRESS-JOURNAL` (executando) → depois `1 — contrato duplo de build` → `2 — port P0` → `3 — ignore seletivo` → `4 — dormentes` → `5 — consolidação`.
- **Refs:** `develop` = `0115637` (pós-reconciliação) · `main` = `ef2110e7` · WIP `codex/p0-closeout` = `49eaf2b` (remoto).
- **Ledger:** `EXECUTION-STATE-PROGRAM.md`, marcador parent-pinned válido para o HEAD atual (ver último commit).
- **Árvore:** limpa no repo principal; worktree `.p0-closeout-docker` limpo (pós-`49eaf2b`).
- **Ambiente local:** Postgres Docker `preco-que-da-lucro-postgres` (127.0.0.1:5432, `preco_que_da_lucro_test`) usado nos gates; `.env` aponta para produção e por isso **todo** dev/test/build exige override explícito para `127.0.0.1` (sancionado por `AGENTS.md`).

## 2. Log intenção/resultado (append-only; **id maior = mais recente**)

| id  | UTC      | par | descrição (ponteiro)                                                                                                                                                                                                                                                                                                                             |
| --- | -------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L17 | 02:33:42 | ▶   | Iniciar FASE J: criar este journal e gravar protocolo de boot no `AGENTS.md`; nenhuma mutação fora desses dois arquivos.                                                                                                                                                                                                                         |
| L16 | 02:19:07 | ✔   | CI `34732745897` (**success**, 7m8s) do commit `368ef37` (evidência do deploy Vercel falho + ledger).                                                                                                                                                                                                                                            |
| L15 | 02:16:00 | ✔   | Deploy do WIP corrigido: `49eaf2b` → **Ready em 18 s** (painel Vercel); `c0ef351` segue `Error` (retenção 30 d). Evidência: `docs/evidence/vercel-deploy-failure-2026-09-13.md`.                                                                                                                                                                 |
| L14 | 02:15:30 | ✔   | Push `c0ef351..49eaf2b` em `codex/p0-closeout` (fast-forward; só `vite.config.ts`).                                                                                                                                                                                                                                                              |
| L13 | 02:0x:00 | ✔   | Diagnóstico do deploy falho: `3uf5t5CtT4STAa4Dkj7EquVBjrRe` (Preview, 13 s, `No Output Directory named "dist"`); causa: preset `vercel` ausente na base 2026-08-15 (158 commits atrás; `f386d72`).                                                                                                                                               |
| L12 | 01:55:48 | ✔   | Ledger `a3d5db7` (inventário do trabalho ilhado + WIP `c0ef351`) com CI verde.                                                                                                                                                                                                                                                                   |
| L18 | 02:36:00 | ✔   | FASE J (J1–J4/J6): journal criado, protocolo de boot/memória gravado em `AGENTS.md`; marco **M0** (§7).                                                                                                                                                                                                                                          |
| L19 | 02:37:00 | ▶   | FASE 1 (contrato duplo de build): provar `.output/server/index.mjs` (preset node) **e** `.vercel/output` (`VERCEL=1`); limpar artefatos; evidência em artefato dedicado.                                                                                                                                                                         |
| L20 | 02:47:00 | ✔   | **J5 podagem**: stores core reduzidos a índice de boot (falhas 322%→6% · projeto 497%→12%); lições destiladas em `docs/evidence/agent-state/AGENT-ENV-NOTES.md`; backup em `~/.local/share/pi-fronts/memory-prune-2026-09-13/`; store estendido (`sessions.db`, ilimitado) segue como arquivo histórico.                                         |
| L21 | 02:38:00 | ▶   | **FASE 3** delegada (branch `chore/ci-path-filter`: leve p/ `docs/evidence/**`, completo p/ `src/**`) e **FASE 1** em execução (builds node + VERCEL=1).                                                                                                                                                                                         |
| L22 | 02:52:00 | ✘   | **Colisão de escrita (caso real da técnica):** o agente da FASE 3 fez checkout do branch `chore/ci-path-filter` no MESMO worktree; o commit M1 (`d49fc8b`) caiu no branch dele. Mitigação: steer imediato (escopo estrito: sem `git add -A`, sem `.vercel/**`, sem ledger) → agente commitou só os seus arquivos (`56727e7`, publicado) e parou. |
| L23 | 02:54:00 | ✔   | **Reconciliação:** `git checkout develop` + `cherry-pick d49fc8b` → `develop` = `0115637`; `.vercel/` adicionado ao `.gitignore` e build local limpo; artefato da FASE 1 em `docs/evidence/build-contract-2026-09-13.md`. Lição: agente que muta repo recebe **worktree próprio**.                                                               |
| L24 | 02:50:00 | ✔   | **FASE 1 = PASS:** `.output/server/index.mjs` (21.443 B) e `.vercel/output/*` (config 366 B) gerados, ambos exit 0 → preset condicional sem regressão cruzada; FASE 2 (port) desbloqueada.                                                                                                                                                       |
| L25 | 03:0x:00 | ✔   | **FASE 3 mergeada:** PR #45 (CI leve p/ `docs/evidence/**` + pesado preservado) com `verify` verde → `develop` = `bc91be0`; filtro ATIVO (ci-light.yml + paths-ignore). Provas de run em sequência (este push é a **PROVA A**: só-docs ⇒ leve roda, pesado pula).                                                                                |
| L26 | 03:1x:00 | ✔   | **PROVA A validada:** push só-docs `455ea7f` → rodou **apenas** `CI light` (success) e o `UI stack` foi **pulado**. A seguir, este commit MISTO (ledger+journal) é a **PROVA B**.                                                                                                                                                                |
| L27 | 03:2x:00 | ✔   | **PROVA B validada:** commit misto `36e9c63` → `UI stack` (pesado) rodou; guard do leve: "changed paths outside docs/evidence/ — heavy pipeline owns it". Ambas as provas do filtro registradas no artefato `docs/evidence/ci-path-filter-2026-09-13.md`.                                                                                        |

## 3. Fila humana (o que está bloqueado em pessoa)

| id  | ação                                                                                                                             | tempo  | destrava                   | desde      |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------- | ---------- |
| H-6 | Firefox: `NPM_CONFIG_ENGINE_STRICT=false` → Reimplantar → `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` no app `darkgray-pony-545965` | ~2 min | 11/12 · dia-D              | 2026-09-12 |
| H-4 | PITR ≥ 7 d (Launch, ~US$1–3/mês) **ou** exceção assinada (P9)                                                                    | ~5 min | carimbo de tráfego / §16.6 | 2026-09-12 |
| H-5 | Assinatura do go-live (após 11/12)                                                                                               | ~1 min | CP-G3 / dia-D              | 2026-09-12 |
| H-2 | (opcional) token Vercel → inventário de config/drift `NEON_AUTH_*`                                                               | ~1 min | F-VER completo             | 2026-09-12 |

Instrução clique-a-clique do H-6: `docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md`.

## 4. Watchers (último sinal conhecido)

| watcher                          | PID    | último sinal                                                                  | marcador                                          |
| -------------------------------- | ------ | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| `h6-watch.sh` (mudança de `jwt`) | 125663 | sondagem bloqueada (Cloudflare) em 2026-09-13T00:55Z; aguardando nova mudança | `~/.local/share/pi-fronts/H6-ready.txt` (ausente) |
| `app-live-watch.sh` (health 200) | 227273 | poll 1020 em 02:20:09Z → `http=404` (app ainda não sobe)                      | `~/.local/share/pi-fronts/app-live.txt` (ausente) |
| `h2-watch.sh` (token Vercel)     | 377893 | sem token/CLI até agora                                                       | `~/.local/share/pi-fronts/H2-ready.txt` (ausente) |

## 5. Ponteiros de artefatos (o "onde está o quê")

- Estado do programa: `EXECUTION-STATE-PROGRAM.md` · consolidação da rodada: `docs/evidence/F7-consolidacao-2026-09-13.md`
- hPanel: `docs/runbooks/hpanel-homologacao.md` · `docs/evidence/hpanel-homologacao-2026-09-12/` (item 1 FAIL + `SESSION-LIMIT.md`)
- Neon: `docs/evidence/neon-prontidao-2026-09-13.md` · PITR: `docs/evidence/neon-pitr-memo-2026-09-12.md`
- Vercel: `docs/evidence/vercel-docmap-2026-09-12.md` · falha/correção: `docs/evidence/vercel-deploy-failure-2026-09-13.md`
- Runbook do dia-D: `docs/runbooks/dia-d-2026-09-12.md` · ADR engines: `docs/adr/ADR-028-node-engines-24-6-fallback.md`
- Port P0 (a executar): WIP `codex/p0-closeout` + `docs/evidence/p0-closeout-local-2026-08-19.md`
- Infra do agente: `docs/evidence/agent-infra-findings-2026-09-12.md` (INFRA-MEM-01)
- Ambiente do agente (destilado na poda J5): `docs/evidence/agent-state/AGENT-ENV-NOTES.md` · backup: `~/.local/share/pi-fronts/memory-prune-2026-09-13/` · store estendido (`sessions.db`, ilimitado) preserva o histórico · auto-review: ver §6

## 6. Eventos de infra do agente

| id           | UTC               | estado                                                                                                                         | ponteiro                                                                                                                                                                                                                                                                                                        |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INFRA-MEM-01 | 2026-09-13T02:2xZ | **saturação medida**: projeto 24.872/5.000 chars (497%) · falhas 32.261/10.000 (322%); auto-review com `parse_error`/`timeout` | `docs/evidence/agent-infra-findings-2026-09-12.md` PODAGEM J5 **aplicada** 2026-09-13: falhas 32.261→600 chars (322%→6%) · projeto 24.872→638 chars (497%→12%); lições destiladas em `docs/evidence/agent-state/AGENT-ENV-NOTES.md`; backup dos 4 stores em `~/.local/share/pi-fronts/memory-prune-2026-09-13/` |

## 7. Marcos (commits deste journal)

| marco | commit                                        | escopo                                                    |
| ----- | --------------------------------------------- | --------------------------------------------------------- |
| M0    | `git log --grep='agent-state' -1 --format=%h` | criação do journal + regra de boot/memória no `AGENTS.md` |
