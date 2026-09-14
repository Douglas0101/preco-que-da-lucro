# EXECUÇÃO ONDAS 3 e 4 — painel de supervisão (2026-09-14)

**Plano:** `docs/evidence/plan-partials-2026-09-13/PLANO-ONDAS-3-4.md` (propriedade de arquivo por operador; ordem `18.5 → 18.1 → 18.3 → 20.5 → 20.1` na Onda 3, e Onda 4 disjunta correndo em paralelo).
**Método:** WIP 3 · worktree+branch por operador · integração `--no-ff` com manifests e **marcador parent-pinned por commit** · verificador adversarial por integração · token DB · sem push.
**Partida reconferida por recon direto:** F0-04 e AUTH-005 A+B já fechados nas ondas 0/1 (não re-executados).

## 1. Integrações

| Int.  | Item                                      | Operador | Commits   | Merge    | V        | Gates                                                                                                                             |
| ----- | ----------------------------------------- | -------- | --------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| I-O24 | §12.5 schema diff + §12.4 parent/política | O24      | `84b576f` | pendente | pendente | secrets-audit `failures=[]` · YAML parse OK · m02-v2b 9/9 · ui-stack/boundaries/matrix limpos · lockfile ok · format 0 · eslint 0 |

## 2. Detalhe por integração

### I-O24 — §12.5 schema diff + §12.4 branch model

**§12.4 parent:** `.github/workflows/neon-pr-branch.yml:109` passa a usar `${{ github.base_ref == 'main' && 'production' || 'develop' }}`. O operador **simulou a expressão** (extraindo a string do YAML e avaliando) em vez de afirmar: `main → production` · `develop → develop` · `release/1.0 → develop`. É a prova correta para uma expressão que só roda dentro do runner.

**§12.5 schema diff:** step `schema_diff` após o migrate, chamando `GET /projects/{id}/branches/{branch}/compare_schema?base_branch_id=<production>&db_name=neondb`, com baseline produção e **diff vazio** quando o PR não mexe em `drizzle/**`; artefato + resumo em forma de comentário quando mexe.

**Skip sem chave — declarado, não silencioso:** sem `NEON_API_KEY` o step sai **exit 0** e escreve `summary=PULADO (NEON_API_KEY ausente)` + um `schema-diff.md` que registra explicitamente: _"nenhuma chamada de rede foi feita; nenhuma chave ou project id foi presumido"_ e _"a semântica de baseline/empty-diff fica NÃO VERIFICADA até a chave existir"_. Esse é o comportamento certo: um skip que se declara não verificável em vez de fingir cobertura.

**Verificações do supervisor (independentes do relato):**

| checagem                                  | resultado                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `br-snowy-violet-aymcvvvv` foi inventado? | **NÃO** — pré-existente no `develop` com proveniência `REMOTE-VERIFIED` (`checagens-pos-publicacao-2026-09-05/report.md:23`, `cutover-2026-09-07/`) e no próprio ledger `:1148` |
| `m02-v2b.mjs` é comment-only?             | **SIM** — todas as linhas `+` do diff são `//`; **zero** linha executável alterada; a norma ficou registrada no lugar certo                                                     |
| identificadores de secret/var alterados?  | **NENHUM** (diff vazio nesse padrão)                                                                                                                                            |
| expressão de parent presente?             | **SIM**, em `:109`, exatamente como especificado                                                                                                                                |
| skip explícito?                           | **SIM** — `SKIP-GRACIOSO-ROTULADO` + **fork-guard** (`head_repo ≠ repository`) que **não** estava no meu briefing                                                               |

**Decisão de valor em §12.4b:** fazer o parent virar parâmetro obrigatório do `m02-v2b.mjs` mudaria o comportamento de `--plan`/preflight de um script **aposentado** sem ganho — porque o parent **já** é parâmetro explícito (`NEON_PARENT_BRANCH_ID` tem precedência sobre o default). Escolheu a variante de comentário-norma. Julgamento correto: mudança menor, zero comportamento alterado.

**Política de dados registrada** (`neon-branch-data-policy-2026-09-14.md`): produção é fixture-free hoje (26/26 + smoke 7/7 contínuo), logo herdar o **dado** do parent é aceitável **agora**; gatilho de revisão = PII ou tráfego real (H-6); `schema-only`/mascaramento **só após spike**; e a **caveat ratificada**: `schema-only` **não** copia `drizzle.__drizzle_migrations`, então `db:migrate` tentaria reaplicar e falharia — mitigação registrada (pular o migrate e semear o journal).

**Residuais declarados:** (1) sem `NEON_API_KEY` a chamada **ao vivo**, a criação de branch com parent novo e a resolução de base-id ficam **não verificáveis** (construção + simulação mock apenas); (2) quando `develop` estiver à frente, um diff não-vazio é **staleness develop×production** (§12.4 passo 1), não mudança do PR — documentado; (3) decisão declarada: HTTP≠200 **falha** o step (o job já depende da API Neon; cleanup `always()` remove a branch); (4) sem teste de regressão commitado para o step shell (harness em `/tmp`, 6 casos reproduzidos no doc); (5) `.github/**` roteia CI pelo pipeline **pesado** — o `npm run check` de integração é do supervisor.
