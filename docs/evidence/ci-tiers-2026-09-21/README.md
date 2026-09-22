# Enxugamento do CI/CD por tiers — 2026-09-21

**Fato-fonte:** o `verify` da `UI stack` **parou de iniciar** em 2026-09-21T14:33Z. A anotação do
próprio GitHub diz a causa, verbatim:

> The job was not started because recent account payments have failed or your spending limit needs
> to be increased. Please check the 'Billing & plans' section in your settings

Medido em `repos/Douglas0101/preco-que-da-lucro/commits/<sha>/check-runs` → `check-runs/<id>/annotations`.
**Não é o repositório:** os mesmos arquivos de workflow rodaram verdes minutos antes (`f293368`), o
YAML valida, e `actions/permissions` responde `enabled:true, allowed_actions:all`.

## 1. O custo, medido (run `35611793799`, 30 passos, ~9,5 min)

| passo                                 | tempo     | % do run |
| ------------------------------------- | --------- | -------- |
| `npm run test:e2e` (4 projetos)       | **240 s** | 42%      |
| `npm run test` (vitest, 96 arquivos)  | **151 s** | 26%      |
| `playwright install --with-deps` (3)  | 47 s      | 8%       |
| `npm run db:test`                     | 33 s      | 6%       |
| `format:check` + `lint` + `typecheck` | 50 s      | 9%       |
| containers + checkout + `npm ci`      | 45 s      | 8%       |
| build + bundle + audit + artefatos    | 10 s      | 2%       |
| as 5 guardas + matriz + ui-stack      | 4 s       | <1%      |

**e2e + vitest = 68% do custo.** E o volume: **13 execuções da `UI stack` em um dia** (30 runs no
total, ~84 min de runner só em 2026-09-21) — a 6 min por execução, um dia de trabalho bate a cota.

## 2. O desenho (sem remover verificação)

| tier | o que roda                                                                            | quando                                                                              |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 0    | guardas (5) · matriz · ui-stack · no-supabase · `format:check` · `lint` · `typecheck` | **sempre**                                                                          |
| 1    | `npm run test` (96 arquivos, 987 casos)                                               | **sempre** que o push não é só-docs                                                 |
| 2    | `db:test` + `db:check`                                                                | diff toca `drizzle/`, `src/db/`, repositórios, serviços, `scripts/db/` ou manifests |
| 3    | `build` + `check:bundle` + `audit` + artefatos                                        | **sempre**                                                                          |
| 4    | e2e **chromium + mobile**                                                             | push em `develop`/`main`                                                            |
| 5    | e2e **firefox + webkit + mobile**                                                     | **PR** (fronteira de release) e `workflow_dispatch`                                 |

Mais: `concurrency: cancel-in-progress` por ref (um push em rajada cancela o run anterior da mesma
ref em vez de pagar pelos dois) e `timeout-minutes: 20 → 12` (medido 9,5; corta run pendurado).

## 3. O que **não** muda

- **Nenhum teste removido, nenhuma regra de lint afrouxada, nenhum orçamento renegociado.**
- A suíte completa continua rodando em **todo** PR, com os **4 projetos** de browser.
- `npm run check` local continua exatamente o mesmo comando — é a definição de pronto.
- O tier de banco **não é silencioso**: quando pula, emite `::notice` nomeando o motivo. Skip mudo é
  a classe de falha que o WP-R6 fechou.
- O escopo é **fail-closed**: base desconhecida (primeira push de branch, force-push, dispatch) ⇒
  todos os tiers rodam.

## 4. Impacto projetado (projeção declarada, **não** medição)

| cenário                                     | antes   | depois (projetado)                        |
| ------------------------------------------- | ------- | ----------------------------------------- |
| push de código que não toca o tier de banco | ~570 s  | **~320 s** (−44%)                         |
| push que toca `scripts/db/**` ou manifests  | ~570 s  | **~355 s** (−38%)                         |
| PR (fronteira de release)                   | ~570 s  | ~570 s (inalterado)                       |
| dia de trabalho com 13 pushes               | ~79 min | **~30-35 min** (−57%, com o cancelamento) |

**A projeção não foi medida em CI** — a cota bloqueada impede executar o workflow novo. Ela é
derivada dos tempos por passo do run `35611793799` e do número de projetos de browser; a medição
fica pendente do desbloqueio do billing.

## 5. Riscos declarados

| #   | risco                                                             | disposição                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | firefox/webkit deixam de rodar no push intermediário de `develop` | declarado: a fronteira de release é o **PR**, que roda os 4 projetos; `workflow_dispatch` cobre o resto                                                                                                    |
| R2  | o `if:` do tier de banco pode mascarar um caminho não previsto    | o escopo é por `git diff` sobre uma lista declarada e **fail-closed**; caminho novo fora da lista roda o tier? **não** — roda o resto e o skip é visível no `::notice`: é limite declarado, não silencioso |
| R3  | `cancel-in-progress` pode cancelar um run que alguém esperava     | o grupo é por workflow+ref; o run mais recente da ref sempre roda até o fim                                                                                                                                |
