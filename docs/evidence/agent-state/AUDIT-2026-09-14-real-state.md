# Auditoria independente do estado real do programa — 2026-09-14

**Método:** auditor **read-only** (subagente com contexto _fresh_, papel `oracle`), instruído a **verificar
alegações contra o repositório** em vez de repeti-las. Sem escrita de arquivo, sem suíte/build (só leitura
git/fs + 3 checkers leves de arquivo). Supervisor (S) re-verificou de forma independente os achados materiais
marcados com **[S]** abaixo.

**Escopo:** Ondas 0, 1 e 2A; journal/ledger; fila humana; watchers; aritmética do placar; ADRs.
**Base:** `develop`, `HEAD` = `9f8280e` no início da auditoria → `b88ebca` no fim (commit docs-only do próprio S
durante a auditoria, journalizando a Onda 2A).

**Resultado:** 26 alegações verificadas — **18 TRUE**, **5 PARTIAL**, **2 FALSE**, **1 RESOLVIDO**. As duas
alegações FALSE eram: (a) o journal afirmar `develop = e8a73ef` (desatualizado) e (b) os watchers declarados
como armados (mortos). Nenhum SHA citado estava faltando: **26/26 são ancestrais de `develop`**.

## 1. Tabela de verificação (26 alegações)

| #   | Alegação                                                                       | Fonte               | Verificação                                                                    | Veredito                       | Evidência                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Onda 0: 5 integrações I1–I5 (10 SHAs operador+merge)                           | `EXECUCAO-ONDA0.md` | `git merge-base --is-ancestor <sha> HEAD` (10×)                                | **TRUE**                       | `bf6fa77 a3ba381 53f09e4 f29e3da ee4855d f765406 ffc23e3 0d07260 c032c00 29804a6`                                                                                                |
| 2   | Onda 0: 7 artefatos citados existem e estão versionados                        | idem                | `git ls-files --error-unmatch`                                                 | **TRUE**                       | 7/7 `TRACKED`                                                                                                                                                                    |
| 3   | Hotfix I6 (`bd0a768`/`d6f5706`) + artefato                                     | idem §6             | idem                                                                           | **TRUE**                       | ancestral; `docs/evidence/bug-chat-fix-2026-09-13.md` tracked                                                                                                                    |
| 4   | Onda 0: gates `npm run check` + `db:test` verdes                               | idem                | não executado (escopo read-only)                                               | **UNVERIFIED**                 | —                                                                                                                                                                                |
| 5   | Onda 1: 8 integrações (19 SHAs)                                                | `EXECUCAO-ONDA1.md` | `is-ancestor` (19×)                                                            | **TRUE**                       | inclui `b92fd14 7206ce8 8c2664a 902bd7d b91065d 2ea4d07 4354a00 3c4799c e8a73ef`                                                                                                 |
| 6   | Migrations 0012/0013 em disco + journal/meta                                   | idem                | `ls drizzle`, `_journal.json`                                                  | **TRUE**                       | `0012_youthful_stellaris.sql`, `0013_robust_cammi.sql`, `meta/{0012,0013}_snapshot.json`                                                                                         |
| 7   | Registry 14/14 no estado da Onda 1                                             | `EXECUCAO-ONDA1.md` | tags no estado `e8a73ef`                                                       | **TRUE**                       | 14 tags ↔ 14 entradas de journal naquele estado                                                                                                                                  |
| 8   | `db:classify:check` bate com o disco                                           | `AGENTS.md`         | `npm run db:classify:check`                                                    | **TRUE**                       | `✔ 15/15 classificadas` (15 `.sql`, 15 tags, 15 entradas de journal)                                                                                                             |
| 9   | I13 `877bf71`: `http.status_code` + `bff.request`                              | task/commit         | `grep status_code\|bff.request`                                                | **PARTIAL**                    | atributo real é **`http.response.status_code`** (`http-request-span.ts:9`); `bff.request` real (`request-context.ts:59`)                                                         |
| 10  | I13: 10 testes in-memory                                                       | commit msg          | `grep -c 'it('`                                                                | **TRUE (estático)**            | `observability-spans.test.ts` = 10; incluído por `vitest.config.ts:12`                                                                                                           |
| 11  | I14 `645336e`: spans de query + pool saturation                                | task                | `grep` telemetry/client                                                        | **TRUE**                       | `db.system.name`/`db.operation.name`/`db.query.text` (telemetry.ts:153-156), `app.db.query.duration`, gauges de pool, `scripts/obs/pool-activity.ts`                             |
| 12  | I14: 20 testes                                                                 | commit msg          | `grep -c 'it('`                                                                | **TRUE (estático)**            | sql-redactor 8 + round-trip 12 = 20                                                                                                                                              |
| 13  | I15 `9f8280e`: migration 0014 `rum_vitals`                                     | task                | `ls`/`grep`                                                                    | **TRUE**                       | `drizzle/0014_mighty_veda.sql`, `meta/0014_snapshot.json`, `schema.ts:835`                                                                                                       |
| 14  | `scripts/obs/rum-percentiles.ts` + `docs/evidence/rum-p75-2026-09-13/`         | task                | `ls`+leitura                                                                   | **TRUE (dados locais)**        | script tracked; relatório com N e alvos — N=40 vem de série **local**, não de produção                                                                                           |
| 15  | Onda 2A journalizada (par `▶`/`✔`)                                             | PROGRESS §1/§2      | `grep L36`                                                                     | **TRUE a partir de `b88ebca`** | `9f8280e` **não** tinha entrada alguma de Onda 2 (nem no ledger)                                                                                                                 |
| 16  | `develop = e8a73ef`                                                            | PROGRESS §1         | `git rev-parse HEAD`                                                           | **FALSE**                      | journal de `9f8280e` parava em L35; §1 corrigido pelo S                                                                                                                          |
| 17  | Watchers armados, PIDs 753048/753051/377893, horizonte 7 d                     | PROGRESS §4         | `ps -p`, `/proc/<pid>`, `pgrep -af watch.sh`, `systemctl --user`, `crontab -l` | **FALSE** **[S]**              | nenhum processo; `/proc/…` inexistentes; sem unit/cron. `[S]` foi além: os **scripts** `h6-watch.sh`/`app-live-watch.sh` **não existiam em disco**                               |
| 18  | Marcadores `H6-ready.txt`/`app-live.txt`/`H2-ready.txt` ausentes               | PROGRESS §4         | `test -e`                                                                      | **TRUE** (ausentes)            | mas a ausência **não** significava "aguardando" — não havia watcher (ver #17)                                                                                                    |
| 19  | Drift F-REPO (`drizzle-kit ^0.18.1`)                                           | usuário/L36         | `package.json`+lock+`m02:lockfile-guard`                                       | **RESOLVIDO** **[S]**          | `^0.31.10` nos 3 pontos; guard `pass` 5/5, `reasons: []`                                                                                                                         |
| 20  | 194 itens / 187 acionáveis / 129 DONE / 33 PARTIAL / 25 NS = 69,0% cru / 77,8% | `part-E-medicao.md` | aritmética                                                                     | **TRUE (consistente)**         | 129+33+25 = 187; 129/187 = 68,98%; (129+16,5)/187 = 77,81%                                                                                                                       |
| 21  | Onda 0: 5 PARTIALs → 77,8% → ~79,1%                                            | ONDA0/ledger        | aritmética + part-E                                                            | **PARTIAL**                    | 5×0,5/187 = +1,34pp → 79,14 ✓; mas part-E dá **§27 P=2** e **§32 P=2** → possível **subcontagem** (real até ~79,4%)                                                              |
| 22  | Onda 1: 4 PARTIALs → ~79,1% → ~80,2%                                           | ONDA1/ledger        | aritmética + part-E                                                            | **PARTIAL**                    | 4×0,5/187 = +1,07pp → 80,17 ✓, porém "BFF-002/003" são **2 itens** (§8 P=2) → subdeclara ~0,27pp. **Nenhuma sobredeclaração**; a métrica oficial (`part-E`) **não foi remedida** |
| 23  | ADR-028 proposta/draft; último ratificado ADR-027                              | `AGENTS.md`         | `head docs/adr/ADR-0*`                                                         | **PARTIAL**                    | ADR-028 = `PROPOSTA / DRAFT` ✓; o mais recente é **ADR-029** (existe, também `PROPOSTA / DRAFT`) — `AGENTS.md` **omite o ADR-029**                                               |
| 24  | `m02:state:check` verde                                                        | L36/ledger          | `npm run m02:state:check`                                                      | **TRUE** **[S]**               | `valid for HEAD b88ebca… on develop`; `Worktree: clean`                                                                                                                          |
| 25  | Back-merge `origin/main`→`develop` feito; nada pushado                         | PROGRESS §1         | `merge-base --is-ancestor`, `rev-list`                                         | **TRUE** (+1 nº impreciso)     | `origin/main 9724d2c` é ancestral; journal dizia "46 atrás", medido **47**                                                                                                       |
| 26  | Onda 2B em finalização (3 worktrees, parciais não commitados)                  | L36                 | `git -C .worktree-onda2-* status/rev-list`                                     | **TRUE** **[S]**               | `ops/onda2-{finmetrics,slo,budget}` @ `9f8280e`, 0 commits à frente, mudanças não commitadas                                                                                     |

## 2. Discrepâncias

1. **[CONHECIDA, RESOLVIDA] F-REPO `drizzle-kit ^0.18.1`** — eliminada: `^0.31.10` nos 4 pontos,
   `m02:lockfile-guard` verde 5/5. Não é reincidência no HEAD atual.
2. **[NOVA, MATERIAL] Watchers mortos.** O journal declarava `h6-watch`/`app-live-watch`/`h2-watch` rearmados
   por 7 d; nenhum processo existia (PIDs inexistentes; sem `systemd`/`cron`), e o único registro de arme do
   `h6-watch` era de **2026-09-12T04:59Z**. Consequência: os detectores do caminho crítico
   (H-6 → redeploy → tráfego → dia-D) estavam **cegos**, e a ausência dos marcadores **não podia** ser lida como
   "ainda aguardando". **[S]** agravou o achado: `h6-watch.sh` e `app-live-watch.sh` **não existiam em disco**.
   → Tratado em **L37** (rearme com guarda anti-placeholder + controles; ver §4 do journal).
3. **[NOVA, RESOLVIDA EM VOO] Onda 2A sem rastro no log canônico.** `9f8280e` tinha as 3 integrações em
   `develop` sem par `▶`/`✔` e o ledger sem menção a "Onda 2". → Reconciliado em **`b88ebca`** (L36 + seção
   "Reconcílios de boot"). Residual menor: **não existe painel `EXECUCAO-ONDA2A.md`** (convenção das Ondas 0/1,
   com verificador por integração) — coberto pela preparação de `EXECUCAO-ONDA2.md` (2A+2B).
4. **[NOVA, GOVERNANÇA] ADR-029 é DRAFT mas sua implementação já está mergeada** (`0013` + CAS + lock ordering
   em `develop`); a fila humana cobria só a ratificação do ADR-028. `AGENTS.md` segue dizendo que o ADR mais
   recente é o 028. → Registrado como **H-8**.
5. **[NOVA, MENOR] Ruído numérico de rastreio:** `origin/develop` 46 vs medido **47**; a linha removida do
   journal dizia `main local = ac2e834 (59 atrás)` quando o medido é **108**; a projeção 80,2% **subdeclara**
   ~0,27pp. Nada disso **infla** resultado.
6. **[NOVA, INTERPRETAÇÃO] RUM p75 com vereditos "OK/N/A" sobre N=40 em base local** (sem tráfego de produção;
   H-6 aberto). O texto diz "série persistida", mas a coluna de veredito pode ser lida como conformidade de SLO;
   `part-E` registra **§29 (SLO) e §30 (error budget) como NOT STARTED** — **não existe SLO operacional hoje**.
7. **[CORREÇÃO DO ENUNCIADO]** O ledger está na **raiz** (`EXECUTION-STATE-PROGRAM.md`), não em
   `docs/evidence/agent-state/`; e o atributo é **`http.response.status_code`**, não `http.status_code`.

## 3. Posição real em 2026-09-14

- **Fechadas e rastreáveis a commits reais:** Onda 0 (I1–I5) e hotfix BUG-CHAT (I6); Onda 1 (I7–I12 + I10c/I10d/I11).
  **26+3 SHAs citados existem e são ancestrais de `develop`** — nenhuma integração "fantasma".
- **Integrada e agora journalizada:** Onda 2A (I13/I14/I15) — artefatos versionados (`onda2-spans`, `db-spans`,
  `pool-saturation`, `rum-persistence`, `rum-p75`); sem painel próprio; **V13–V15 ainda não executados**.
- **Em voo (não commitado):** Onda 2B — worktrees `ops/onda2-*` com parciais.
- **Pendentes:** Ondas 3 (segurança/UX) e 4 (Neon/Auth).
- **Bloqueado em humanos:** H-4 (PITR ≥7 d), H-5 (assinatura go-live), H-6 (Firefox `NPM_CONFIG_ENGINE_STRICT=false`
  - redeploy + vars), H-2 (token Vercel, opcional), **H-8 (ratificação ADR-029 — novo)**.
    Monitoramento: `app-live-watch` + `h2-watch` **ativos** (L37).
- **Estado git:** nada pushado — `develop` **47** à frente de `origin/develop`; `origin/main = 9724d2c`;
  árvore limpa; `m02:state:check` verde em `b88ebca`.

## 4. Verificado pelo auditor vs. relatado

- **Verificado por ele:** ancestralidade de 26+3 SHAs; versionamento de 12+ artefatos; migrations 0012/0013/0014
  em disco/meta/journal; `db:classify:check` 15/15; `m02:lockfile-guard` 5/5; `m02:state:check` verde; back-merge
  `origin/main`; árvore limpa; worktrees 2B; **ausência de processos de watcher**; contagens estáticas de `it()`;
  aritmética de `part-E` e dos deltas; estado `PROPOSTA/DRAFT` de ADR-028 **e** ADR-029.
- **Relatado, não verificado (fora do escopo read-only permitido):** `npm run check`/`db:test` verdes em cada onda
  (exigiriam build/suítes); números "444/495 testes" e "8/9 suítes"; O16/O17/O18 verdes/vermelhos; deploys Vercel,
  probes hPanel, PITR, H-2; existência de tráfego real para RUM.

## 5. Limites desta auditoria

- Não reexecutou gates de código nem suítes de banco — **os verdes por onda seguem apoiados em artefato**, não em
  execução independente. É exatamente o que o PC da Onda 2 (`npm run check` + `db:test` no HEAD integrado) fecha.
- Não remediu o placar oficial (`part-E` = 77,8%): 79,1% e 80,2% são **projeções por delta** e podem estar
  subdeclaradas em ~0,27–0,53pp. A remediação do `part-E` é trabalho próprio, não deste reconcilio.
- Não inspecionou estado externo (Vercel/Neon/hPanel) além das sondas públicas do watcher.
