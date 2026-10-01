# Ciclo 22 — Fase 4: governança (o que fechou, o que escalou)

- **Data:** 2026-10-01 · **Base:** `20bb24a` (develop) · **Gate:** `npm run check` **exit 0** (115 arquivos, 1383 passed | 14 skipped)

---

## F4.1 — ✅ FECHADA: actions pinadas por SHA

`sonar.yml` usava tags flutuantes (`@v4`); todo outro workflow do repositório fixa SHA de 40. As três
actions passaram a usar **os mesmos SHAs que o `ui-stack.yml` já usa** — não versões novas, as mesmas
já auditadas:

| action                    | SHA                                        |
| ------------------------- | ------------------------------------------ |
| `actions/checkout`        | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node`      | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/upload-artifact` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |

**Closure test:** `grep -E "uses:.*@v" .github/workflows/sonar.yml` → **0 hits**.

---

## F4.3 — ✅ FECHADA: prefixos `sqa_`/`squ_` na varredura — e a correção real era OUTRA

**Achado que mudou o remédio.** O primeiro teste que escrevi marcava o prefixo no
`local-ci-secret-scan.mjs` e checava que um literal falso virava `HIT`. **Ele passava com o defeito
presente** — o controle negativo revelou que o classificador marca **qualquer** linha não permitida
(`total=1 hits=1`, `ids=nenhum`), então aquele teste não media nada. O classificador recebe linhas
**já filtradas**; quem decide o que chega é o `PATTERN` do `git grep -E` em `local-ci.sh:884`.

**Correção aplicada nos dois lugares, na ordem certa:**

1. **Filtro** (`scripts/local-ci.sh:884`): `(squ_|sqa_)[A-Za-z0-9]{20,}` entra no `PATTERN`.
2. **Vivacidade**: dois probes novos (`sqa_`/`squ_`, montados em runtime como os demais) — família
   sem probe é família que pode quebrar em silêncio, que é o fail-open que o próprio script documenta.
3. **Classificador** (`local-ci-secret-scan.mjs`): `sonar-token` entra em `HARD_PATTERNS` (segunda
   camada, não suprimível por allowlist).
4. **O N6 vacuoso foi REMOVIDO** — teste que passa com o defeito presente engana quem lê.

**Closure test:** `src/test/local-ci-secret-pattern.test.ts` extrai o `PATTERN` **do próprio
`local-ci.sh`** e roda `grep -E` (o mesmo motor do pipeline):

| verificação                         | com o fix | com o defeito (família removida)           |
| ----------------------------------- | --------- | ------------------------------------------ |
| POS `sqa_`/`squ_` selecionados      | ✅ passa  | ❌ **falha** (`expected false to be true`) |
| regressão (famílias antigas)        | ✅ passa  | ✅ passa                                   |
| NEG (linha benigna não selecionada) | ✅ passa  | ✅ passa                                   |

Vivacidade do shell: **7/7** famílias casam. Suítes de segredo: **19 testes verdes**.

---

## F4.5 — ✅ FECHADA: o `DBT-57` em linhas

`docs/evidence/ciclo-22-dbt57-data.md`: `lines_to_cover` **4.797**, `uncovered_lines` **1.742**,
cobertura **63,6 %**, e o `new_coverage` do gate (63,3) é praticamente igual ao geral. **Faltam cobrir
~782 linhas** para atingir 80 %. A decisão sai de pontos percentuais para linhas.

---

## F4.2 — ⛔ ESCALADA (diagnóstico feito, remédio maior que a fase)

`sonar` tem **0 ocorrências** em `AGENTS.md` e em `scripts/lib/m02-ci-coverage.ts`: o pipeline novo é
**invisível** ao contrato de cobertura de CI — exatamente o buraco `checked === discovered`.

**Premissa a corrigir:** o critério citado é `npm run check:ci-table` verde, mas **esse script não
existe**. Medido: `m02-ci-coverage.ts` **não é invocado por script nenhum** — é enforçado apenas pelo
teste `src/test/m02-ci-coverage.test.ts`, dentro de `npm run test`. O closure real é: o teste passa a
assercar que **todo** workflow descoberto em `.github/workflows/` está ou na tabela declarada ou
declarado como fora de contrato — hoje ele só conhece `ui-stack` e `ci-light`, e `sonar.yml` escapa
por omissão. É mudança em contrato fail-closed + AGENTS.md + teste: registrada como **`DBT-62`**, não
executada nesta fase.

---

## F4.4 — ⛔ ESCALADA: `main` sem `sonar.sources=src`

Confirmado por medição: `git show origin/main:.sonarcloud.properties` **não** tem `sonar.sources`.
Se a Automatic Analysis re-analisar `main`, a cota pode recusar de novo — e já há **cinco recusas
medidas**. O backport depende da **release `develop → main`** (DECISÃO 3), que é do MAESTRO.

---

## Limites desta fase

- `F4.2` e `F4.4` **não** foram executadas; ambas nomeiam a decisão ou o trabalho que falta.
- O `DBT-62` é a única dívida nova desta fase; nenhum defeito foi consertado fora de escopo.
- Zero CI consumido até aqui: todos os commits são locais.
