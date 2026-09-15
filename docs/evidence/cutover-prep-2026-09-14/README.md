# cutover-prep-2026-09-14 — §13.6 (Preparação do cutover), Onda 4 / O26

> **Base:** branch `ops/onda4-cutover` @ `f47318a` + commit de código `d3757d3`.
> **Plano:** `docs/evidence/plan-partials-2026-09-13/part-5-neon-auth.md` §13.6 (“Preparável agora:
> preflight de env por nome/estado … probes canônicos (live/ready/get-session + controle negativo de
> origem); procedimento de rollback app-level (R3) …; templates de assinaturas (H-3/H-5) e P9;
> snapshot <24 h na janela”).
> **Procedimento (não evidência):** as partes de procedimento foram escritas **dentro** do runbook
> existente — `docs/runbooks/dia-d-2026-09-12.md` §2 (R3 detalhado), §5 (pendência 7) e §6 (novo).
> Este diretório contém apenas **evidência bruta** e **templates prontos para assinar**.

## 1. O que foi preparado (executável) e o que é N/A por custódia

| Item do §13.6                        | Estado                                                                                                                                                | Prova                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Preflight de env por nome/estado     | **EXECUTÁVEL** — `scripts/m02-auth-preflight.ts` (reusa `src/server/auth/auth-policy.ts`)                                                             | `env-preflight-casos.txt`, `env-preflight-sentinel-proof.txt` |
| Probes canônicos em conjunto         | **EXECUTADOS localmente** contra o artefato Nitro node-server do HEAD da branch (7 verificações, todas PASS)                                          | `probe-canonico-branch-d3757d3.txt`                           |
| Controle negativo de origem          | **EXECUTADO**, com par positivo obrigatório; 403/`INVALID_ORIGIN` nas duas variantes (com e sem cookie)                                               | idem + `probe-bucket-429-inconclusivo.txt`                    |
| Rollback app-level (R3)              | **DOCUMENTADO** (passos, critérios de invocação, estado restaurado)                                                                                   | `dia-d-2026-09-12.md` §2 (bloco “R3 — detalhado”)             |
| Templates H-3 / H-5 / P9             | **PRONTOS PARA ASSINAR** (nada assinado por agente)                                                                                                   | `templates-assinaturas-h3-h5-p9.md`                           |
| Snapshot < 24 h na janela            | **REQUISITO DECLARADO + verificação por ferramenta existente**                                                                                        | `dia-d-2026-09-12.md` §6.3                                    |
| **Freeze / sync / origem read-only** | **N/A POR CUSTÓDIA** — não há tráfego real (H-6): não existe o que congelar, sincronizar ou tornar read-only                                          | `part-5-neon-auth.md:42`; runbook §0 P2                       |
| **Ensaio de R3 no preview**          | **N/A POR CUSTÓDIA** — sem preview publicado acessível nem token (H-2/H-6); o fluxo foi lido em doc, não ensaiado                                     | `hpanel-docmap-2026-09-12.md:257,259`                         |
| **Probes no host canônico**          | **NÃO EXECUTADOS** — o canônico não serve este artefato e não há domínio associado (D-0/H-5/H-6)                                                      | runbook §0 P8, §5                                             |
| **Troca de auth carimbada**          | **NÃO CARIMBADA** — a asserção que discrimina o valor de `BETTER_AUTH_URL` é o host do link de reset de senha (c1), que exige envio real (`RESEND_*`) | runbook §1.6 (c1/c2)                                          |

## 2. Preflight de env (`scripts/m02-auth-preflight.ts`)

**Forma da saída** (colunas): `VARIAVEL · PRESENCA(present/empty/absent) · EXIGENCIA · VEREDITO · DETALHE`,
mais duas linhas de veredito (`BLOQUEIOS`, `RESULTADO`). Exit `0` sem bloqueio, `1` com bloqueio,
`2` uso inválido. Bloqueiam a janela: `invalid` e `incomplete` (a instância de auth lança na
construção → 500 em toda requisição de auth); `missing` para exigência `required` e para
`required-in-production` em produção. O par de e-mail é **bloqueio condicional** (`--require-email`
o torna bloqueio).

**Prova de que nenhum valor é impresso:** os 4 casos rodaram com valores-sentinela
(`…sentinel-canonical.invalid`, `sentinel-secret-…`, `sentinel-resend-key`, URL com
`usuário:senha` sentinela) e o `grep -ci sentinel` deu **0** em todas as saídas
(`env-preflight-sentinel-proof.txt`). O relatório é produzido por `describeAuthEnv()`, que só devolve
nome, presença, exigência, veredito e mensagens fixas de política — nenhuma leitura de valor entra na
saída.

**Limites declarados:** o script classifica o ambiente **do processo** (não lê o painel do alvo — use
`node --env-file=<export-do-painel>`); **não** julga o conteúdo da lista de origens confiáveis (a
presença da origem do preview durante a transição é item humano do runbook §1.2); **não** cobre
`DATABASE_*`, `AI_*`, `SUPABASE_*`, `MIGRATION_*` (checklist por NOME de `cutover-A4.md` §4.4).

## 3. Probes canônicos — o que rodou e o que não rodou

**Rodou (local/controlado, artefato Nitro node-server do HEAD da branch `d3757d3`):**

| #   | Verificação                                        | Resultado                                                                                 |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0   | warm-up `GET /api/health/live`                     | 200 (não é asserção; paga o TTFF)                                                         |
| 1   | `live` ×3                                          | **PASS** 200 `{"status":"ok"}`                                                            |
| 2   | `ready` ×3                                         | **PASS** 200 `{"status":"ready","dependencies":{"postgres":"ok"}}`                        |
| 3   | `get-session`                                      | **PASS** 200 corpo `null` — **só prova que a instância de auth subiu**                    |
| 4   | controle positivo (POST, Origin canônico)          | **PASS** 401 `INVALID_EMAIL_OR_PASSWORD` (origem aceita)                                  |
| 5   | **controle negativo** (POST, Origin não confiável) | **PASS** 403 `INVALID_ORIGIN`                                                             |
| 6   | controle positivo com cookie                       | **PASS** 401 (par do controle 7)                                                          |
| 7   | **controle negativo com cookie**                   | **PASS** 403 `INVALID_ORIGIN`                                                             |
| 8   | INFO: POST sem Origin nem cookie                   | 403 `MISSING_OR_NULL_ORIGIN` (comportamento depende dos headers `Sec-Fetch-*` do cliente) |

As latências registradas são **locais/controladas** — não são números de produção e não podem ser
rotuladas como tal (§29 do Plano Mestre; H-6).

**Mecanismo (por que `get-session` isolado é probe fraco):** `originCheckMiddleware` retorna cedo em
`GET/HEAD/OPTIONS` (`node_modules/better-auth/dist/api/middlewares/origin-check.mjs`), então
`GET /api/auth/get-session` não é validado contra `baseURL`/`trustedOrigins` — um `BETTER_AUTH_URL`
obsoleto passa verde. `validateOrigin` só valida com cookie (`useCookies`) ou com `forceValidate`
(caminho `formCsrfMiddleware`, que dispara quando há `Origin`/`Referer` ou headers `Sec-Fetch-*`).

**Não rodou:**

- probes no **host canônico** (`https://diretrizprecifica.com/...`): o canônico não serve este
  artefato e a associação de domínio é P8/H-5 (não executada) — §1.4/§1.6 do runbook não iniciam.
- probes contra a **Vercel** / preview: sem token e sem preview (H-2).
- `npm run smoke:substrate` e `m02:readiness`: são gates do supervisor na integração (proibidos a
  este operador); nada aqui os substitui.
- **asserção (c1)** (host do link de reset de senha) e o **login controlado no canônico**: exigem
  `RESEND_*` publicado e um host real; por isso a linha “troca de auth: **NÃO CARIMBADA**” é fixa na
  saída do probe.

## 4. Achado de ambiente (bloqueia repetir o probe no worktree, não na `main`)

O artefato construído **dentro deste worktree** responde **500 em todas as rotas**, com
`TypeError: createCsrfMiddleware is not a function` (`artefato-worktree-quebrado.txt`). O mesmo
commit construído a partir de `git archive` (árvore pristina, **mesmo** `node_modules`) serve
200/200/200. A diferença observada é de _spelling_ de caminho do `node_modules` compartilhado por
symlink (o worktree usa `<worktree>/node_modules`, a cópia pristina resolve para
`/home/douglas-souza/preco-que-d-main/node_modules`), o que muda os ids do serviço SSR do Nitro
(`node_modules/.nitro/vite/services/ssr`) e produz um bundle inconsistente. Consequências:

- o probe canônico de §13.6 **não** pode ser medido no artefato do worktree — foi medido no artefato
  do mesmo commit em árvore pristina (registrado acima);
- `npm run check:hostinger-runtime` (que sobe `.output/server/index.mjs`) tende a falhar em qualquer
  worktree com `node_modules` por symlink; `npm run check` **não** inclui esse gate, então CI verde
  não detecta;
- **não é regressão de `f47318a`** (o build pristino do mesmo commit serve 200/200/200) e não foi
  introduzido pelo commit `d3757d3` (o primeiro build quebrado foi feito com `git status --short`
  limpo, antes de qualquer edição deste operador).

## 5. Snapshot < 24 h na janela (requisito e verificação)

- **Requisito:** na janela do dia-D deve existir **trio externo com idade < 24 h por `created_at`**
  (nunca por `mtime`) **mais** snapshot nativo Neon com ID e validade registrados — P4 do runbook §0,
  `cutover-A4.md` §2.3.
- **Produtor:** `npm run m02:snapshot -- --out-dir .artifacts/backup-drill/<data>/` com
  `DATABASE_ADMIN_URL`/`ALLOW_REMOTE_DB=<motivo>` e conexão **direct**; emite o trio
  `dump.pgc` + `dump.pgc.sha256` + `metadata.json` (`created_at` UTC). Trio pré-existente ⇒ exit 2
  (nunca sobrescreve).
- **Verificador:** check `snapshot-fresco` de `npm run m02:readiness`
  (`scripts/m02-readiness.mjs`, glob `.artifacts/backup-drill/*/dump.pgc`): exige `producer`,
  `source=production`, `connection_kind=direct`, `read_only=true`, motivo não-vazio, sha256 conferido
  contra o dump e contra o sidecar, e idade `0 ≤ created_at < 24 h`.
- **Restauração:** `npm run m02:backup-verify` (drill em branch isolada) — NFR-RES-005.
- **Nota operacional:** `.artifacts/` é por checkout; o check precisa rodar **no checkout que recebe a
  janela** (a `main`), então um trio ausente no worktree não é evidência de nada — hoje este worktree
  não tem `.artifacts/backup-drill/`, e por isso o frescor **não foi medido aqui** (residual).

## 6. Residuais declarados

1. **N/A por custódia:** freeze / sync / origem read-only (sem tráfego, H-6) e ensaio de R3 no
   preview (sem preview/token, H-2). Não foram ensaiados — declarados, não simulados.
2. Probes no canônico, SSL, DNS pós-associação e asserção (c1) de e-mail: não executáveis antes de
   D-0/H-5/H-6.
3. Snapshot < 24 h: requisito e ferramenta citados; **frescor não medido** neste worktree (sem
   `.artifacts/backup-drill/`).
4. R3 continua sem rollback por commit no hPanel; a mitigação (`git revert` + push, ou archive
   anterior) foi **lida** no docmap e **não ensaiada**.
5. Achado do artefato de worktree (§4): resolvido por medir em árvore pristina; a validação
   definitiva de `.output`, com `check:hostinger-runtime`, continua sendo do supervisor, na `main`.
6. O build do repositório falha o gate de _build warnings_ por warning não registrado
   (`INEFFECTIVE_DYNAMIC_IMPORT` em `src/lib/query-options.ts`) — pré-existente ao commit de código
   desta fatia e fora do escopo §13.6; registrado para quem detém `src/routes/**`.

## 7. Arquivos e comandos

| Arquivo                             | Conteúdo                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| `env-preflight-casos.txt`           | saída bruta dos 4 casos + exit codes                           |
| `env-preflight-sentinel-proof.txt`  | prova de que nenhum valor é impresso                           |
| `probe-canonico-branch-d3757d3.txt` | saída bruta do conjunto canônico (PASS)                        |
| `probe-bucket-429-inconclusivo.txt` | duas execuções seguidas: PASS (exit 0) e INCONCLUSIVO (exit 2) |
| `artefato-worktree-quebrado.txt`    | 500 em todas as rotas no artefato do worktree                  |
| `templates-assinaturas-h3-h5-p9.md` | H-3, H-5 e P9 prontos para assinar                             |

Comandos (todos read-only; sem rede externa; DB local `127.0.0.1`):

```bash
node node_modules/tsx/dist/cli.mjs scripts/m02-auth-preflight.ts [--json] [--require-email] [--target-label <rotulo>]
node node_modules/tsx/dist/cli.mjs scripts/m02-canonical-probe.ts --base-url <url> [--samples 3] [--max-time-ms 3000] [--bucket-ip <ipv4>]
npx prettier --check scripts/m02-auth-preflight.ts scripts/m02-canonical-probe.ts src/server/auth/auth-policy.ts
npx eslint   scripts/m02-auth-preflight.ts scripts/m02-canonical-probe.ts src/server/auth/auth-policy.ts
npx tsc -p tsconfig.json --noEmit
npx vitest run src/test/auth-policy.test.ts      # 8/8 PASS (regressão da política preservada)
```
