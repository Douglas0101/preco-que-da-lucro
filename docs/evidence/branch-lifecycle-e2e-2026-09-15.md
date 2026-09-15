# Ciclo de vida da branch efêmera com E2E — §12.5 / §26.7

- **data:** 2026-09-15
- **wp / squad / branch:** WP-A4 · SQUAD-APP-SUPPLY · `mission/a4-supply` (worktree `.worktree-mA4`, base `1f94b56`)
- **spec_ref:** Plano Mestre §12.5 "Branch lifecycle" (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1090-1105` — `create branch → apply migrations → seed safe data → integration tests → E2E`, e `delete branch` no close) e §26 "Database CI com Neon Branching" (`:1811-1832`)
- **artefato:** `.github/workflows/neon-pr-branch.yml` (único arquivo de workflow tocado; **51 inserções, 1 deleção**)
- **claim:** `docs/evidence/agent-state/CLAIMS-INBOX/12.5-25.4-supply.md`
- **status pleiteado:** **PARTIAL** — o desenho do ciclo está completo e verificado localmente; a **execução live** do ciclo depende de `NEON_API_KEY` (H-2) e não foi exercitada.

## 1. O ciclo, fase a fase, no workflow

Job `gate` (`:46-76`) → job `branch-ci` (`:78-385`) → job `cleanup` (`:387-444`).

| # | fase (§12.5/§26) | passo/ação | `arquivo:linha` | condição |
| - | ---------------- | ---------- | --------------- | -------- |
| 0 | gate de fork + presença de segredo | job `gate`, `Decide` (fork-guard `HEAD_REPO != BASE_REPO`) | `.github/workflows/neon-pr-branch.yml:46-76` (`:57-66` fork-guard) | sempre; para fork, `run=false` e nada mais roda |
| 1 | **create branch** | `neondatabase/create-branch-action`, `parent_branch` = `production` (PR p/ `main`) ou `develop` | `:104-114` | `needs.gate.outputs.run == 'true'` (`:81`) |
| 2 | rede de segurança | `expires-at` +24 h + URIs (direct/pooled) em `RUNNER_TEMP` | `:116-136` | sucesso do passo anterior |
| 3 | install | `npm ci --ignore-scripts` | `:138-139` | idem |
| 4 | **migrate** | `npm run db:migrate` com `DATABASE_ADMIN_URL` = DIRECT da branch, `NEON_MIGRATION_TARGET_KIND=drill-branch` | `:141-147` | idem |
| 5 | schema diff | `compare_schema` branch vs produção (+ artefato e comentário) | `:149-286`; upload `:288-298` (`if: always()`) | idem |
| 6 | **integration** | `npm run db:test` contra a branch | `:300-306` | idem |
| 7 | **seed** | `npm run m02:rls-probe` (seed sintético + sonda RLS adversarial) | `:308-321` | idem |
| 8 | prova de journal | contagem read-only de `drizzle.__drizzle_migrations` vs `_journal.json` | `:323-334` | idem |
| 9 | **E2E (novo)** | `npx playwright install --with-deps chromium firefox webkit` + `npm run test:e2e` | **`:351-385`** | idem — sem `if:` próprio |
| 10 | delete + prova | `delete-branch-action`; GET pós-delete `≠ 200` e comentário no PR | `:400-406`; `:408-444` | **`always()`** (`:390`) e `branch_id != ''` |

Ordem provada estruturalmente (T3, §3.3): `provisionamento(2) < migração(5) < integração(8) < seed(9) < E2E(11)` — o E2E é o **último** passo de `branch-ci`, depois de provisionar/migrar/seed, como o spec-card exige. `cleanup` mantém `if: always() && needs.gate.outputs.run == 'true'` (`:390`) inalterado.

## 2. Contrato do passo E2E (por que ele é "a mesma invocation do `ui-stack.yml`")

Invocação idêntica à do `ui-stack.yml:97-98`:

```
npx playwright install --with-deps chromium firefox webkit
npm run test:e2e
```

O `webServer` de `playwright.config.ts:29-31` faz `e2e:prepare && build && preview --host 127.0.0.1 --port 4173`; `e2e:prepare` (`package.json` → `scripts/e2e/seed-auth.ts`) roda migrations na branch e re-escreve a senha de `app_runtime` com `E2E_DB_RUNTIME_PASSWORD` (`scripts/e2e/seed-auth.ts:37-42`).

Ambiente produzido no runner (nenhum segredo novo; tudo gerado por `openssl` no próprio passo):

| variável | valor | fonte |
| -------- | ----- | ----- |
| `DATABASE_ADMIN_URL` | DIRECT da branch | `$RUNNER_TEMP/branch_direct_url` (fase 2) |
| `DATABASE_URL` | **`app_runtime`** sobre o pooler da branch | derivado do `branch_pooled_url` (fase 2) |
| `E2E_DB_RUNTIME_PASSWORD` | `openssl rand -hex 24` | gerado no passo |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` | gerado no passo |
| `E2E_AUTH_PASSWORD` | `openssl rand -base64 24` | gerado no passo |
| `E2E_AUTH_EMAIL` | `teste@example.test` | literal (igual ao `ui-stack.yml:44`) |
| `BETTER_AUTH_URL` / `AUTH_TRUSTED_ORIGINS` | `http://127.0.0.1:4173` | literal (igual ao `ui-stack.yml:38-39`) |
| `ALLOW_REMOTE_DB` | motivo rotulado, com o nº do PR | literal no passo |
| `DATABASE_DRIVER` | **não definido** (default `neon-serverless`, o driver de produção — `src/db/client.server.ts:68,90`) | decisão explícita |

Diferença consciente vs. `ui-stack.yml`: lá o alvo é um Postgres local e o `ui-stack.yml` fixa `DATABASE_DRIVER: node-postgres`. Aqui o alvo é uma branch Neon real, então o E2E roda no driver de produção — é o que dá valor ao E2E na branch.

## 3. Provas executadas (locais, sem rede)

### 3.1 T1 — parse dos YAMLs, com controle negativo

Controle negativo primeiro (YAML quebrado em `/tmp` **deve** falhar), com o mesmo runner usado depois:

```
$ node -e '<parseDocument(yaml)>' /tmp/broken-workflow.yaml /tmp/broken-dependabot.yaml
PARSE FAIL	/tmp/broken-workflow.yaml	BLOCK_AS_IMPLICIT_KEY,MULTILINE_IMPLICIT_KEY,MISSING_CHAR
PARSE FAIL	/tmp/broken-dependabot.yaml	MISSING_CHAR,BAD_INDENT
TOTAL_FILES=2 TOTAL_FAILED=2
exit=1

$ node -e '<parseDocument(yaml)>' .github/workflows/neon-pr-branch.yml .github/dependabot.yml
PARSE OK	.github/workflows/neon-pr-branch.yml
PARSE OK	.github/dependabot.yml
TOTAL_FILES=2 TOTAL_FAILED=0
exit=0

$ node -e '<parseDocument(yaml)>' .github/workflows/{ci-light,neon-drill-ops,neon-pr-branch,neon-preview,neon-readiness,ui-stack}.yml
PARSE OK	× 6            (TOTAL_FILES=6 TOTAL_FAILED=0, exit=0)
```

O parser é o `yaml` do próprio `node_modules` do repo (`parseDocument`, que reporta erros em vez de lançar). O controle negativo prova que a checagem **pega** YAML quebrado nos dois formatos (workflow e `dependabot.yml`).

### 3.2 Lógica de shell do passo E2E, com as duas invocações reais capturadas

`run:` extraído do YAML parseado, `${{ github.event.pull_request.number }}` expandido para `12345` (o GitHub faz essa expansão antes de entregar ao shell), `RUNNER_TEMP` e `npx`/`npm` substituídos por shims:

```
SHIM npx playwright install --with-deps chromium firefox webkit
  DATABASE_ADMIN_URL=postgresql://neondb_owner:***@ep-drill-9999-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
  DATABASE_URL=postgresql://app_runtime:***@ep-drill-9999-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
  E2E_DB_RUNTIME_PASSWORD=set(48 chars)   BETTER_AUTH_SECRET=set(64 chars)
  E2E_AUTH_EMAIL=set(18 chars)            E2E_AUTH_PASSWORD=set(32 chars)
  BETTER_AUTH_URL=set(21 chars)           AUTH_TRUSTED_ORIGINS=set(21 chars)
  ALLOW_REMOTE_DB=set(53 chars)
SHIM npm run test:e2e
  (mesmo ambiente)
step_exit=0
```

### 3.3 T3 — ordem e condição de sucesso (estrutural, não grep de texto)

Dump dos passos de `branch-ci` na ordem do array:

```
11	if=<default success()>	E2E Playwright contra a branch efêmera (§12.5 · §26.7)
ORDEM	provisionamento (create branch)=2 < migração (Migrations via DIRECT)=5 < integração (suites db:test)=8 < seed (Seed sintético + sonda RLS)=9 < E2E (Playwright)=11
CONDICAO_E2E	if ausente => success() default do job (mesma condição dos passos anteriores)
CLEANUP_ALWAYS	always() && needs.gate.outputs.run == 'true'
TOTAL_STEPS_BRANCH_CI=12 PROBLEMS=0
```

O passo E2E **não** tem `if:`, logo herda `success()` — a mesma condição dos passos de provisionamento/migração/seed; falha nele deixa `branch-ci` vermelho e o `cleanup` roda de todo modo. O único passo com `if` divergente em `branch-ci` é o upload do artefato de schema diff (`if: always()`, pré-existente).

### 3.4 O `env-guard` continua honrado (controle negativo incluso)

O passo E2E aciona dois hooks do `env-guard` (`pretest:e2e` e `pree2e:prepare`, ambos em `DENY_SET` em `scripts/env-guard.mjs:16-25`). Rodando o `env-guard` real sob o ambiente que o passo produz, com host remoto sintético de drill:

```
A) com ALLOW_REMOTE_DB (o que o passo exporta):
{"guard":"env-guard","result":"ALLOW","override":true,"script":"test:e2e","env":"DATABASE_URL","host":"ep-drill-9999-pooler...","motivo":"CI Neon PR branch 12345 — E2E em branch efêmera (§26)"}
{"guard":"env-guard","result":"ALLOW","override":true,"script":"e2e:prepare", ... }
  guard test:e2e=0 e2e:prepare=0
step_exit=0

B) controle negativo, mesmo passo sem ALLOW_REMOTE_DB:
{"guard":"env-guard","result":"DENY","script":"test:e2e","env":"DATABASE_URL","host":"ep-drill-9999-pooler...","remedio":"usar banco local (npm run db:up) + .env local"}
  guard_exit=3
step_exit=3
```

Leitura: o override é o caminho sancionado de drill (§26) e o guard **falha fechado** quando ele falta — o passo não enfraquece o gate. Nenhuma URL real de produção foi usada (o host é sintético; o guard só inspeciona strings e nunca conecta).

## 4. Execução live: o que falta e por quê

- **Dependência declarada:** a execução do ciclo em si (criar branch Neon, migrar, semear, rodar E2E, deletar) exige `NEON_API_KEY` + `vars.NEON_PROJECT_ID` no repositório. **H-2** = sem token/API (e sem push, por regra da missão), não há como disparar nem observar o workflow. O próprio arquivo já trata o caso: sem a chave, `gate` marca `run=false` com rótulo (`:57-71`) e o schema diff escreve um artefato de PULO rotulado — **nunca** fail silencioso.
- **Consequência honesta no status:** `12.5`/`26.7` = **PARTIAL** — o desenho está completo e verificado localmente (T1–T3 + controles negativos), mas a primeira execução live e o `delete` provado em execução real ficam pendentes de H-2. Não há inflação para DONE.
- **Nenhuma chamada de rede** foi feita por este WP; nenhuma branch Neon foi criada ou apagada; produção intocada.

## 5. Limites declarados

1. **E2E não executado live** (sem `NEON_API_KEY`). O que está provado é: parse dos YAMLs, lógica de shell + ambiente produzido, ordem/condição do passo e aderência ao `env-guard`. Não provado: que o Playwright passa contra a branch (depende de H-2).
2. **Artefato de browser não é publicado.** O `ui-stack.yml:100-113` sobe `playwright-report`/`test-results`/`playwright-results.json`; aqui **não** foi adicionado upload, por decisão de diff mínimo do WP. Consequência: numa falha de E2E em CI, a evidência de browser morre com o runner (o log e o `GITHUB_STEP_SUMMARY` do job permanecem). Proposta para o MAESTRO: passo `upload-artifact` de 8 linhas, espelhando o `ui-stack.yml`, se quiser rastreabilidade.
3. **Orçamento de tempo inalterado.** `branch-ci` segue com `timeout-minutes: 30` (`:79`); o E2E (`playwright install` + `build` + 4 projetos) entra nesse mesmo orçamento. Se a primeira execução live estourar o teto, o knob é o timeout — decisão do MAESTRO, não deste WP.
4. **Ordem §26 vs. §12.5 (observação, não divergência).** O texto de §26 lista `… → E2E → schema diff`; no workflow o schema diff roda imediatamente após as migrations (pré-existente, `:149`) e o E2E fecha o job (`:351`). O spec-card deste WP fixa "depois de provisionar/migrar/seed", que é exatamente onde o E2E ficou; §12.5 (`create → migrate → seed → integration → E2E`) também é satisfeito. Mover o schema diff para depois do E2E seria uma troca de 2 blocos e **não** foi feita por não estar no spec-card.
5. **Regime:** CONTROLLED (inspeção local + execução de scripts em ambiente local com shims); nenhuma execução remota.
