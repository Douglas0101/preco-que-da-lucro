# Neon PR branch CI — schema diff (§12.5) e parent (§12.4)

**Rodada:** Onda 4 · operador O24 · base `2382636` · branch `ops/onda4-branchpolicy` · 2026-09-14
**Escopo:** `docs/evidence/plan-partials-2026-09-13/part-5-neon-auth.md` §12.5 (schema diff) e §12.4 itens 2–3
(parent do PR + default de `scripts/m02-v2b.mjs`). A política de dados da mesma §12.4 está em
`docs/evidence/neon-branch-data-policy-2026-09-14.md`.
**Limite desta rodada:** não há `NEON_API_KEY` no ambiente (H-2), logo a chamada live `compare_schema` e o
parent live **não** são verificáveis aqui — prova por construção + verificações estáticas + harness local com
`fetch` mockado (nenhuma rede externa).

## 1. Mudanças

| Arquivo                                | Ponto                         | Mudança                                                                                                                   |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/neon-pr-branch.yml` | `:109`                        | `parent_branch` deixa de ser fixo `production` (§12.4)                                                                    |
| `.github/workflows/neon-pr-branch.yml` | `:82-84`                      | `permissions` do job `branch-ci`: `contents: read` + `pull-requests: read` (só para rotular se o PR mexe em `drizzle/**`) |
| `.github/workflows/neon-pr-branch.yml` | `:145-282`                    | novo passo `schema_diff` (§12.5), após o `db:migrate` e antes do `db:test`                                                |
| `.github/workflows/neon-pr-branch.yml` | `:284-298`                    | `upload-artifact` do diff (`@043fb46d…` v7.0.1, retenção 7 d, `if-no-files-found: warn`)                                  |
| `.github/workflows/neon-pr-branch.yml` | `:88`, `:362`, `:382`, `:390` | output `schema_diff` propagado do passo ao comentário do PR no job `cleanup`                                              |
| `scripts/m02-v2b.mjs`                  | `:29-36`                      | norma §12.4 do default de parent (comentário; ver §6 abaixo)                                                              |

## 2. Contrato do passo

```
GET $NEON_API_BASE/projects/$NEON_PROJECT_ID/branches/<branch_id do PR>/compare_schema
      ?base_branch_id=<id de production>&db_name=neondb
```

- **Baseline = `production`**, head = branch efêmera do PR **já migrada** (`db:migrate` roda antes) → o diff
  mostra o que o PR muda face ao que está publicado. Comparação read-only; produção nunca é alvo.
- **Resolução do baseline:** `GET /projects/{id}/branches` → `branch.name == 'production'` → senão
  `branch.default` → senão o literal `production` (a API aceita nome ou id no path; `neon-readiness.yml:160`
  já usa nome como parent). O id resolvido aparece no artefato e no sumário.
- **Forma do corpo não presumida:** o corpo bruto é persistido em `compare-schema-response.json` e o "vazio" é
  reconhecido por contenção recursiva (objetos/arrays/strings vazios). A forma exata só é confirmável com a
  chave (H-2) — por isso o bruto vai junto.
- **Rotulagem:** quando o PR **não** mexe em `drizzle/**` e o diff sai vazio → "consistente: diff vazio". Quando
  mexe e o diff não é vazio → "consistente: mudança de schema visível". Divergências viram leitura explícita
  (nunca silêncio), com a ressalva de que um diff não vazio em PR sem `drizzle/**` é staleness
  develop×produção (§12.4 passo 1), não o PR.
- **Falha declarada:** `compare_schema` com HTTP ≠ 200 **falha** o passo (o job já depende da API da Neon para
  criar a branch, e o `cleanup always()` roda de todo modo) — a branch é removida e o corpo/erro fica no
  artefato. Sem `NEON_API_KEY` **não** há falha: pula com rótulo.
- **Evidência publicada:** `.artifacts/neon-pr-branch/pr-<n>/{schema-diff.md,compare-schema-response.json}`
  como artefato do run, resumo de mesmo formato em `$GITHUB_STEP_SUMMARY`, e uma linha no comentário do PR
  postado pelo job `cleanup` (`gh pr comment`, permissão `pull-requests: write` já existente).

## 3. Skip sem chave (H-2) — declarado, não silencioso

`.github/workflows/neon-pr-branch.yml:159-169`. Harness local (`NEON_API_KEY` ausente), saída literal:

```
--- exit=0 ---
--- github_output ---
summary=PULADO (NEON_API_KEY ausente)
--- schema-diff.md ---
# Schema diff §12.5 — PULADO

- motivo: NEON_API_KEY ausente no evento (H-2) — compare_schema NAO foi chamado
- branch do PR: br-pr-42-12345 · baseline: production · db_name: neondb
- nenhuma chamada de rede foi feita; nenhuma chave ou project id foi presumido
- consequência: a semântica de baseline/empty-diff fica NÃO VERIFICADA até a chave existir
```

Nenhuma credencial, project id ou host novo foi introduzido: o diff de identificadores do workflow é vazio
(`grep -oE '(secrets|vars)\.[A-Za-z_]+'` = `secrets.NEON_API_KEY`, `vars.NEON_PROJECT_ID` antes **e** depois).

## 4. Casos simulados localmente (sem rede)

`fetch` global substituído por um mock em memória (`NODE_OPTIONS=--import`), `gh` substituído por um stub.

| Caso                              | Mock                                                 | PR em `drizzle/**` | `summary`                                                 | Exit |
| --------------------------------- | ---------------------------------------------------- | ------------------ | --------------------------------------------------------- | ---- |
| sem chave                         | — (não chamado)                                      | sim                | `PULADO (NEON_API_KEY ausente)`                           | 0    |
| diff vazio                        | `{"schema":{"schemas":[],"tables":[],"enums":[]}}`   | não                | `vazio`                                                   | 0    |
| diff não vazio                    | `{"schema":{"tables":[{"name":"tool_executions"}]}}` | sim                | `nao-vazio (50 B)`                                        | 0    |
| diff não vazio + sem `drizzle/**` | idem                                                 | não                | `nao-vazio (50 B)` + leitura "staleness develop×produção" | 0    |
| API de PRs indisponível           | idem                                                 | `unknown`          | `nao-vazio (50 B)`                                        | 0    |
| `compare_schema` HTTP 500         | erro                                                 | sim                | `ERRO (HTTP 500)`                                         | 1    |

URL efetivamente requisitada (nome → **id** resolvido, `Authorization` presente):

```
MOCK-FETCH .../projects/damp-forest-57346541/branches auth=true
MOCK-FETCH .../projects/damp-forest-57346541/branches/br-pr-42-12345/compare_schema?base_branch_id=br-snowy-violet-aymcvvvv&db_name=neondb auth=true
```

Vazio (caso "PR não mexe em `drizzle/**`"):

```
### Schema diff §12.5 — branch do PR vs produção

- head: br-pr-42-12345 · base: production (br-snowy-violet-aymcvvvv) · db_name: neondb
- PR mexe em drizzle/**: no
- compare_schema: VAZIO (nenhuma mudança de schema)
- leitura: consistente: diff vazio (PR não mexe em drizzle/**)
- artefato: schema-diff.md + compare-schema-response.json (retenção 7 d)
- produção intocada: comparação read-only; a branch do PR é descartável (§12.5 always()).
```

HTTP 500 (corpo bruto persistido antes de falhar):

```
# Schema diff §12.5 — ERRO

- compare_schema respondeu HTTP 500 (corpo bruto em compare-schema-response.json)
- head: br-pr-42-12345 · base: production (br-snowy-violet-aymcvvvv) · db_name: neondb
- a branch efêmera é removida de todo modo pelo cleanup always() (§12.5)
```

## 5. Parent expression (§12.4 item 2)

```yaml
parent_branch: ${{ github.base_ref == 'main' && 'production' || 'develop' }}
```

Simulação da própria expressão (`node`, avaliando o texto extraído do YAML):

| `github.base_ref` | `parent_branch` resultante |
| ----------------- | -------------------------- |
| `main`            | `production`               |
| `develop`         | `develop`                  |
| `release/1.0`     | `develop`                  |

Modelo alvo `production → develop → preview/pr-<n>`: PR contra `main` (release) copia `production`; todo o
resto copia `develop`, para a cópia refletir o schema de desenvolvimento em vez de uma produção defasada.

## 6. `scripts/m02-v2b.mjs` (§12.4 item 3)

Escolha: **manter o default com norma explícita** (comentário em `:29-36`), não convertê-lo em parâmetro
obrigatório. Motivo: o parent **já** é parâmetro explícito (`NEON_PARENT_BRANCH_ID`, lido em `:413` com
precedência sobre o default); transformar o default em requisito mudaria o comportamento do caminho
`--plan`/preflight do script aposentado (fail-closed novo) sem ganho — o menor e mais claro é registrar a
norma no ponto onde ela vale. Nenhuma linha executável mudou; `src/test/m02-v2b.test.ts` segue 9/9.

## 7. Verificações estáticas executadas

| Verificação                                                                 | Resultado                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Parse YAML (`yaml` 1.2, extrai steps/jobs/env)                              | ok — 3 jobs, passo `schema_diff` e `upload` presentes |
| `bash -n` no `run` extraído do passo                                        | ok                                                    |
| `npx prettier --check .github/workflows/neon-pr-branch.yml`                 | `All matched files use Prettier code style!`          |
| `npx prettier --check scripts/m02-v2b.mjs` + `docs/evidence/*2026-09-14.md` | ok                                                    |
| `npx vitest run src/test/m02-v2b.test.ts`                                   | 9 passed                                              |
| Identificadores `secrets.`/`vars.` antes × depois                           | idênticos (nenhuma credencial nova)                   |
| Harness local dos 6 casos (tabela §4)                                       | conforme a coluna Exit                                |

## 8. Residuals (o que exige a chave / ambiente real)

1. **Chamada live `compare_schema` (H-2):** endpoint, formato do corpo e a semântica "diff vazio quando o PR
   não mexe em `drizzle/**`" **não** foram exercitados contra a API — só o caminho de skip e o contrato por
   simulação. Primeiro run com `NEON_API_KEY` deve confirmar a forma do corpo e, se preciso, estreitar o
   predicado de vazio.
2. **`base_branch_id`:** o passo resolve o id por nome/`default` com fallback para o literal `production`; o
   fallback só se sustenta se a API aceitar nome no path (precedente: `neon-readiness.yml:160` usa
   `parent_branch: develop`). Confirmar no primeiro run.
3. **Parent live (§12.4):** o valor da expressão foi simulado, mas a criação real de uma branch filha de
   `develop` pelo `create-branch-action` (nome vs id) só se confirma com a chave.
4. **Equivalência do empty-diff:** a propriedade "PR sem `drizzle/**` ⇒ diff vazio" vale quando o schema de
   `production` é igual ao do ponto de partida do PR (nenhuma migração de `develop` ainda não promovida). Com
   `develop` à frente, o diff não vazio é staleness e aparece rotulado como tal — pela nova expressão de
   parent, o baseline de comparação passa a diferir do parent só nesse caso declarado.
5. **Permissão:** `pull-requests: read` foi adicionada ao job `branch-ci` para rotular `drizzle/**`; se a
   organização restringir, o rótulo degrada para `unknown` (o diff continua sendo medido) — verificado no
   harness, sem falha do passo.
