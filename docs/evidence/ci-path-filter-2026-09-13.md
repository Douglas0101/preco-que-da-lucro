# Filtro de caminhos no CI — pipeline leve para `docs/evidence/**` (FASE 3)

**Rodada:** produção `preco-que-da-lucro` · **Frente:** FASE 3 (aprovação do operador: leve obrigatório · pesado ignorado · `src/**` sem ignore)
**Branch:** `chore/ci-path-filter` (base `origin/develop` = `87bea24`) · **Autor:** subagente `worker` (FRENTE 3)
**Data:** 2026-09-13 · **Classe de evidência:** `[MEDIDO]` (comandos executados nesta máquina) e `[DOC-FIRST]` onde citado

## 1. Desenho — duas pipelines, selecionadas por caminho

| Pipeline   | Workflow                                                                        | Gatilhos                                                                                               | O que roda                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pesado** | `UI stack` (`.github/workflows/ui-stack.yml`, job `verify`)                     | **todo** `pull_request` (sem filtro) + `push` em `main`/`develop` com `paths-ignore: docs/evidence/**` | 20 passos atuais: `check:ui-stack` · `check:no-supabase-runtime` · `format:check` · `typecheck` · `lint` · `test` · `db:test` · `db:check` · build · `check:bundle` · `npm audit` · e2e (chromium/firefox/webkit) + upload de evidências |
| **Leve**   | `CI light (docs/evidence)` (`.github/workflows/ci-light.yml`, job `docs-light`) | `push` **e** `pull_request` com `paths: docs/evidence/**`                                              | 6 passos: checkout (`fetch-depth: 0`) · setup-node (`.nvmrc`) · **scope guard** · `node scripts/m02-lockfile-guard.mjs` · `node scripts/m02-secrets-audit.ts` · `prettier --check` nos arquivos alterados                                |

**Regra de posse (a peça central):** o leve só executa trabalho quando **todos** os arquivos alterados estão sob `docs/evidence/`. Push misto (código + docs) → o guard sai com sucesso **sem trabalho** (`applicable=false`) e o pesado é quem julga, porque `paths-ignore` só ignora quando **todos** os arquivos casam. Nenhum caminho de código (`src/**`, `scripts/**`, `.github/**`, manifests) é filtrado em lugar nenhum.

## 2. Arquivos tocados

| Arquivo                          | Mudança                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ui-stack.yml` | + `paths-ignore: ["docs/evidence/**"]` no gatilho `push`; comentário de 3 linhas; ajustes **semanticamente neutros** de largura de linha (ver §5) |
| `.github/workflows/ci-light.yml` | **novo** — workflow leve (nome próprio, `concurrency` por ref, job `docs-light`)                                                                  |
| `AGENTS.md`                      | § "Local quality gate (definition of done)": documenta as duas pipelines e a regra de posse (+4 linhas)                                           |

## 3. Gatilhos — diff conceitual

```yaml
# heavy (ui-stack.yml)
on:
  pull_request: # inalterado: PRs seguem com cobertura completa
  push:
    branches: [main, develop]
    paths-ignore: ["docs/evidence/**"] # NOVO: pula quando TODOS os arquivos são de evidência

# light (ci-light.yml — novo)
on:
  push: { paths: ["docs/evidence/**"] }
  pull_request: { paths: ["docs/evidence/**"] }
```

## 4. Verificação executada (comandos + resultado)

| #   | Comando                                                                                        | Resultado                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `python3 /tmp/verify-ci-filter.py` (`yaml.safe_load` do atual **e** do `origin/develop`)       | `OK: YAML parses, heavy pipeline semantics preserved, filters as designed` — **20 passos → 20**, **4 SHAs de action inalterados**, `pull_request` **sem filtro**, `push` com `branches [main, develop]` + `paths-ignore [docs/evidence/**]`, leve com 6 passos **sem install** |
| 2   | `npx prettier --check .github/workflows/ui-stack.yml .github/workflows/ci-light.yml AGENTS.md` | `All matched files use Prettier code style!`                                                                                                                                                                                                                                   |
| 3   | `node scripts/m02-lockfile-guard.mjs`                                                          | exit **0** (sem `node_modules`)                                                                                                                                                                                                                                                |
| 4   | `node scripts/m02-secrets-audit.ts`                                                            | exit **0** — `result: COMPLETE_WITH_LIMITS` (type stripping nativo; **sem** `npm ci`)                                                                                                                                                                                          |
| 5   | dry-run do guard: `changed.txt` = só `docs/evidence/…`                                         | `applicable=true` (correto)                                                                                                                                                                                                                                                    |
| 6   | dry-run do guard: `changed.txt` = `docs/evidence/x.md` + `src/lib/finance.ts`                  | `applicable=false` (correto — o pesado assume)                                                                                                                                                                                                                                 |

**Por que o leve não instala dependências:** ambos os scripts importam **apenas built-ins** — `m02-lockfile-guard.mjs` usa `node:fs`/`node:crypto`/`node:child_process`/`node:path`/`node:process`; `m02-secrets-audit.ts` usa `node:fs`/`node:path`/`node:url`. O `.ts` roda sob `node` por _type stripping_ (comprovado no passo 4; `.nvmrc` fixa a linha 24). O `prettier` é resolvido do `package.json` (hoje `^3.7.3` → `3.7.3`) e executado via `npx --yes`, então o leve **não pode divergir** do `npm run format:check`.

## 5. Ajustes de largura de linha no `ui-stack.yml` (pré-existentes, neutros por construção)

Cinco linhas do arquivo **anterior à minha mudança** excediam 80 colunas (regra do linter local, não do gate do repo — prettier é o formatador canônico). Reflowei-as sem alterar semântica:

| Linha                                         | Antes                            | Depois                                                        |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------- |
| `DATABASE_ADMIN_URL` / `DATABASE_URL`         | string longa em uma linha        | bloco dobrado `>-` (valor idêntico)                           |
| `actions/setup-node` (e 2× `upload-artifact`) | comentário `# vX` na mesma linha | comentário em linha própria acima                             |
| `echo "DATABASE_URL=…"` (credencial E2E)      | URL literal na linha             | `db_host` + `runtime_url` como variáveis (mesma string final) |

**Prova de neutralidade:** o parsing YAML compara o arquivo atual com o de `origin/develop` — env idêntico, mesmos 20 passos, mesmos SHAs pinados, e o script do passo E2E continua produzindo exatamente `postgresql://app_runtime:${runtime_password}@127.0.0.1:5432/preco_que_da_lucro_test`.

## 6. Riscos e limites declarados

1. **Required check / branch protection:** o repositório **não tem** proteção de branch nem required checks (`gh api …/branches/develop/protection` → **403**, "Upgrade to GitHub Pro or make the repository public"; `AGENTS.md` § Branching confirma). Logo, pular o pesado em push docs-only **não** pode deixar check obrigatório pendente. **Se** proteção for habilitada, revisar este filtro.
2. **Push docs-only deixa de rodar build/db/e2e/audit.** Aceito por decisão do operador. Mitigação embutida: o leve garante lockfile íntegro, ausência de segredos e formatação. Nada sob `docs/evidence/**` é insumo de build: os 3 arquivos de `src/` que citam o caminho o fazem **apenas em comentários** (`calculation-snapshot.service.ts:11`, `ai-endpoint.server.ts:27`, `budget-ledger.server.ts:50`); os demais citantes são tooling de evidência (`scripts/m02-*`, `scripts/db/explain-evidence.ts`, `scripts/env-guard.mjs`) e testes (`src/test/m02-*`), que **escrevem/leem** evidência fora do caminho de build.
3. **Premissa de "sem install"** depende de Node ≥ 22.6 (type stripping) — `.nvmrc` = `24.15`. Se a linha do Node cair, o passo 2 do leve precisa voltar a instalar dependências.
4. **`npx --yes prettier@X` baixa do npm em tempo de execução** (rede). A versão vem do `package.json`, então não há drift de versão — apenas dependência de rede (mesma classe dos workflows atuais).
5. **Observação para o orquestrador (fora do meu escopo):** `.vercel/` **não** está no `.gitignore`; um build local com `VERCEL=1` deixa ~138 arquivos não rastreados que quebram `prettier --check .` no gate local (já observado nesta rodada).
6. **Não provado por este agente:** os **runs de prova** no GitHub Actions (push docs-only → só o leve; push com `src/**` → só o pesado). Ficam para o orquestrador, em dois pushes de teste.

## 7. Coordenação (colisão de escrita)

- Este agente usou **caminhos explícitos** em `git add`; **nenhum** `git add -A`/`git add .` foi executado.
- **Não** foram tocados: `.vercel/**` (138 arquivos de build do orquestrador), `docs/evidence/agent-state/**`, `EXECUTION-STATE-PROGRAM.md`.
- Arquivos de terceiros na árvore permaneceram intactos; ver §9 do relatório de handoff.
