# WP-B7 — margem de contribuição negativa é estado, não entrada inválida

- **Trilho / WP:** A · WP-B7 (prioridade máxima — correção matemática) · branch `trk-a-wp-b7`
- **Data:** 2026-09-17 · **base:** `648c029` (= `origin/develop`, CI verde)
- **Escopo tocado:** `src/lib/break-even.ts`, `src/test/break-even.negative-margin.test.tsx` (novo). Nada mais.
- **Isolamento:** worktree `.worktree-trk-a`; `env -u DATABASE_URL_UNPOOLED` em todo lançamento; sem `:5432`, sem Neon, sem `vercel`, sem push, sem `package.json`/lockfile, sem regenerar matriz M-02, sem escrever no ledger.

## Hipótese (pinada no ciclo 7, não re-hipotetizada)

Com `contributionMargin < 0`, o guard de decimal negativo em `parseDecimal` (chamado por
`parseBaseInputs`) rejeita o valor ⇒ `invalidResult` ⇒ `status:"invalid"` com
`INVALID_DECIMAL/contributionMargin`; o ramo já existente `NON_POSITIVE_CONTRIBUTION`
(`calculateUnits`) nunca roda no caminho do cliente. Sintoma: `/ponto-equilibrio` mostra
**"Erro de cálculo"** enquanto `/diagnostico` (motor `finance.ts`) mostra **"Não atingível"**
para o mesmo estado.

## Medição — antes (pai `648c029`), motor compartilhado

```console
$ npx tsx repro  # src/lib/break-even.ts vs src/lib/finance.ts
cm=-9.15 | break-even.ts=invalid     units=invalid     errs=["INVALID_DECIMAL/contributionMargin"] | finance.ts=unreachable
cm=    0 | break-even.ts=unreachable units=unreachable errs=[]                                     | finance.ts=unreachable
cm=  0.1 | break-even.ts=reachable   units=reachable   errs=[]                                     | finance.ts=reachable
```

`cm=−9.15` era a **única** discordância; `cm=0` e `cm>0` já concordavam.

## Resultado — depois da correção

```console
$ npx tsx repro
cm=-9.15 | break-even.ts=unreachable units=unreachable errs=[] | finance.ts=unreachable
cm=    0 | break-even.ts=unreachable units=unreachable errs=[] | finance.ts=unreachable
cm=  0.1 | break-even.ts=reachable   units=reachable   errs=[] | finance.ts=reachable
```

## RED → GREEN (medido, não afirmado)

O teste novo foi rodado **antes** de tocar o código, com o arquivo do motor restaurado ao pai
(`git stash push -- src/lib/break-even.ts`):

| artefato           | comando                                                                               | resultado                                 |
| ------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| `red-parent.txt`   | `npx vitest run src/test/break-even.negative-margin.test.tsx` (pai)                   | **5 failed \| 10 passed (15)** — exit 1   |
| `green-fix.txt`    | idem, com a correção aplicada                                                         | **15 passed (15)** — exit 0               |
| `scoped-suite.txt` | 7 arquivos de break-even/finance sob a correção                                       | **180 passed (180)** — exit 0             |
| `fix.patch`        | `git diff HEAD -- src/lib/break-even.ts src/test/break-even.negative-margin.test.tsx` | 20/-4 no motor + 463 linhas de teste novo |

As 5 falhas do RED são exatamente as asserções de **margem negativa** (as de `cm=0`/`cm>0`
passam desde o pai — é isso que mostra que o defeito é só a borda negativa):

```text
FAIL … margem negativa: status calculado é unreachable          → expected 'invalid' to be 'unreachable'
FAIL … margem negativa não é classificada como INVALID_DECIMAL  → expected 'invalid' not to be 'invalid'
FAIL … margem percentual negativa não suprime a classificação   → expected 'invalid' to be 'unreachable'
FAIL … margem negativa: mesma classificação (dois motores)      → expected 'invalid' to be 'unreachable'
FAIL … margem negativa: /ponto-equilibrio e /diagnostico concordam → esperado 0 elementos "Erro de cálculo", obtido 1
```

## Correção

`parseDecimal(value, field, allowZero = true)` → `parseDecimal(value, field, domain)` com
`DecimalDomain = "non-negative" | "signed"`. `contributionMargin` e `contributionMarginPct`
passam a usar o domínio `signed`; `price`, `fixedExpenses[i]` e `desiredProfit` permanecem
`non-negative`. O parâmetro morto `allowZero` (nenhum call site passava `false`) deixa de
existir — o único eixo real é o sinal. NaN/overflow/`-0`/notação não canônica continuam
rejeitados por `decimalStringSchema` + `isFinite()`.

O valor negativo flui até `calculateUnits`, cujo guard `!contributionMargin.gt(0)` devolve
`unreachable`/`NON_POSITIVE_CONTRIBUTION`; `calculateRevenue` (`!contributionMarginPct.gt(0)`)
devolve `revenue:null`. **Nenhum rótulo foi tocado** — o status calculado mudou, que é o
requisito (remendo de rótulo foi explicitamente rejeitado).

## Concordância das duas superfícies

`src/test/break-even.negative-margin.test.tsx` cobre as três bordas em três níveis:

1. **motor compartilhado** (`calculateBreakEvenSummary`, o que `/ponto-equilibrio` chama);
2. **motor numérico** (`calculateBreakEvenUnits`, o que `/diagnostico`/`diagnostic.service`
   chama) — mesma classificação para `cm<0`, `=0`, `>0`;
3. **serviço real `getDiagnostic`** (transação em memória) → `currentStatus:"ok"` +
   `currentAnalysis.breakEvenUnits.status` = `unreachable`/`unreachable`/`reachable`, com o
   alerta "não cobre as despesas fixas" só nas duas primeiras;
4. **rótulos renderizados**: as duas rotas são renderizadas (BFF mockado na fronteira, motores
   reais) e o valor visível é medido por texto exato — `cm<0`/`cm=0` ⇒ "Não atingível" nas
   duas; `cm>0` ⇒ volume em unidades nas duas; jamais "Erro de cálculo".

INV-006/007: resultados `unreachable` serializam `rawUnits/roundedUnits/revenue` como `null`
(nunca `NaN`/`Infinity`), o JSON do resultado não contém `NaN`/`Infinity`, e `/ponto-equilibrio`
exibe **dois** rótulos "Não atingível" (volume e faturamento) — nenhum `R$ 0,00` fabricado.
`cm=0` continua "Não atingível" (unknown ≠ zero), sem mudança de semântica.

## Gates do trilho

| gate                                      | resultado                                                |
| ----------------------------------------- | -------------------------------------------------------- |
| `npx vitest run` (7 arquivos do alvo)     | **180 passed (180)** — `scoped-suite.txt`                |
| `npx tsc -p tsconfig.json --noEmit`       | exit 0 (sem saída)                                       |
| `npm run build` (toca módulo cliente)     | exit 0 — `✓ built in 1.24s`, `.output/nitro.json` gerado |
| `npx prettier --check` (arquivos tocados) | "All matched files use Prettier code style!"             |

`npm run check` / `db:test` / e2e **não** foram rodados neste trilho (do E2 integrado, do MAESTRO).

## Limites e resíduos declarados

- **Não** toquei `src/lib/finance.ts`: verifiquei por medição que ele já classifica a margem
  negativa como `unreachable` (nenhum ajuste necessário). Nada de `cm=0`/`cm>0` mudou nele.
- O teste de superfície mocka a fronteira BFF (`@/lib/query-options` + `@tanstack/react-query`);
  os motores e o serviço `getDiagnostic` são **reais**.
- O rótulo é duplicado nas rotas (não há helper exportado); o teste o mede pelo texto exato
  renderizado, não por leitura de fonte.
- Não alterei `package.json`/lockfile; nenhuma dependência nova.
- Sem push. Merge é do MAESTRO.

## Selo

`manifest.sha256` — `sha256sum -c manifest.sha256` = **ALL MATCH**.
