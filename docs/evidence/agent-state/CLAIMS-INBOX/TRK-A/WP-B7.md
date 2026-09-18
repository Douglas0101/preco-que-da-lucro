# CLAIM — WP-B7 (margem de contribuição negativa é estado, não entrada inválida)

- **wp / trilho / branch / commit:** WP-B7 · TRILHO A (`trk-a-wp-b7`, worktree `.worktree-trk-a`) · base **`648c029`** (= `origin/develop`, CI verde) · commit único do item = `fix(break-even): accept signed contribution margin so the unreachable branch runs` (SHA em §6). **Nada pushado**; merge/regeneração de matriz/E2 são do MAESTRO.
- **status pleiteado:** **DONE** (evidência provisória E1) — correção de código + testes de regressão com RED e GREEN **medidos** + evidência selada.
- **spec_ref:** defeito pinado no ciclo 7 (`CLAIMS-INBOX/WP-BAT-1-VERDICT.md` §4.1 — B-7) · `src/lib/break-even.ts` (guard ~L70–94, `parseBaseInputs` ~L209–218, ramo `NON_POSITIVE_CONTRIBUTION` ~L126–139) · `src/lib/finance.ts:383-423` (`calculateBreakEvenUnits`) · `src/routes/_authenticated/ponto-equilibrio.tsx:375-377` × `diagnostico.tsx:424-428`.
- **baseline de não-regressão:** `npm run check`/`db:test`/e2e **não** rodados (do E2 integrado do MAESTRO); gates do trilho na tabela §4.

## 1. Objetivo

`cm<0` (preço abaixo do custo variável) é um estado econômico legítimo. O motor compartilhado
rejeitava o decimal negativo e devolvia `status:"invalid"` ("Erro de cálculo" em
`/ponto-equilibrio`), enquanto o motor numérico de `/diagnostico` devolvia `unreachable`
("Não atingível") para o **mesmo** estado. O objetivo é que o **status calculado** mude nas
duas superfícies para "Não atingível" — sem remendo de rótulo.

## 2. O que foi medido (comando + saída crua)

**Antes (pai `648c029`)** — motor compartilhado × motor numérico:

```text
cm=-9.15 | break-even.ts=invalid     units=invalid     errs=["INVALID_DECIMAL/contributionMargin"] | finance.ts=unreachable
cm=    0 | break-even.ts=unreachable units=unreachable errs=[]                                     | finance.ts=unreachable
cm=  0.1 | break-even.ts=reachable   units=reachable   errs=[]                                     | finance.ts=reachable
```

**Depois da correção** (mesmos comandos):

```text
cm=-9.15 | break-even.ts=unreachable units=unreachable errs=[] | finance.ts=unreachable
cm=    0 | break-even.ts=unreachable units=unreachable errs=[] | finance.ts=unreachable
cm=  0.1 | break-even.ts=reachable   units=reachable   errs=[] | finance.ts=reachable
```

**RED→GREEN real** (o teste novo foi rodado contra o pai via `git stash push -- src/lib/break-even.ts`):

```text
$ npx vitest run src/test/break-even.negative-margin.test.tsx     # pai
 Test Files  1 failed (1)
      Tests  5 failed | 10 passed (15)                            # exit 1   (red-parent.txt)

$ npx vitest run src/test/break-even.negative-margin.test.tsx     # com a correção
 Test Files  1 passed (1)
      Tests  15 passed (15)                                       # exit 0   (green-fix.txt)
```

As 5 falhas do RED são exclusivamente as asserções de **margem negativa** (as de `cm=0`/`cm>0`
já passavam no pai — prova de que o defeito é só a borda negativa): status `invalid`≠`unreachable`
(×3 ocorrências), `INVALID_DECIMAL` presente, e `/ponto-equilibrio` renderizando **1** elemento
"Erro de cálculo" onde deveria haver 0. Saída completa: `red-parent.txt`.

**Concordância das duas superfícies** (`green-fix.txt`, 15/15): inclui o serviço real
`getDiagnostic` sobre transação em memória (`currentStatus:"ok"` + `breakEvenUnits.status` nas
três bordas) e o **rótulo renderizado** das duas rotas — `cm<0` e `cm=0` ⇒ "Não atingível"
(exatamente 2 rótulos em `/ponto-equilibrio`: volume + faturamento; 1 em `/diagnostico`);
`cm>0` ⇒ volume em unidades; **nunca** "Erro de cálculo".

## 3. Correção (causa-raiz)

`parseDecimal(value, field, allowZero = true)` → `parseDecimal(value, field, domain)` com
`DecimalDomain = "non-negative" | "signed"`. `contributionMargin` e `contributionMarginPct`
passam a aceitar `signed`; `price`, `fixedExpenses[i]` e `desiredProfit` seguem `non-negative`.
O parâmetro `allowZero` era **morto** (nenhum call site passava `false`) e some; o único eixo
real é o sinal. `decimalStringSchema` + `isFinite()` continuam rejeitando NaN/notação não
canônica/overflow. A margem negativa flui até `calculateUnits` (`!contributionMargin.gt(0)`)
⇒ `unreachable`/`NON_POSITIVE_CONTRIBUTION`; `calculateRevenue` (`!contributionMarginPct.gt(0)`)
⇒ `revenue:null`. Nenhum rótulo foi alterado.

## 4. Gates do trilho

| gate                           | comando                                          | resultado                                         |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| testes do alvo                 | `npx vitest run` (7 arquivos break-even/finance) | **180 passed (180)** — `scoped-suite.txt`         |
| tipos                          | `npx tsc -p tsconfig.json --noEmit`              | exit 0 (sem saída)                                |
| build (toca módulo de cliente) | `env -u DATABASE_URL_UNPOOLED npm run build`     | exit 0 — `✓ built in 1.24s`, `.output/nitro.json` |
| formatação                     | `npx prettier --check <arquivos tocados>`        | "All matched files use Prettier code style!"      |

## 5. Evidência selada + limites declarados

- `docs/evidence/trk-a-wp-b7-2026-09-17/` — `README.md`, `red-parent.txt`, `green-fix.txt`,
  `scoped-suite.txt`, `fix.patch`, `manifest.sha256` (`sha256sum -c` = ALL MATCH).
- **Não** toquei `src/lib/finance.ts`: medido que já classifica `cm<0` como `unreachable`
  (nenhum ajuste necessário); `cm=0`/`cm>0` nele intocados.
- O teste de superfície mocka a fronteira BFF (`@/lib/query-options`, `@tanstack/react-query`);
  motores e `getDiagnostic` são reais.
- Resíduo: os rótulos são duplicados nas rotas (sem helper exportado); o teste os mede pelo
  texto exato renderizado.
- Sem `package.json`/lockfile, sem matriz M-02, sem ledger, sem push, sem `:5432`/Neon.

## 6. Branch + commit

- branch: `trk-a-wp-b7` · base `648c029`.
- commit único do item: `fix(break-even): accept signed contribution margin so the unreachable branch runs` — SHA reportado no handoff do trilho (`git log --oneline -1 trk-a-wp-b7`). Sem push.
