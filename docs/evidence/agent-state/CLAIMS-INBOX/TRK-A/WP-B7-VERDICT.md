# VERDICT — WP-B7 (TRILHO A) · verificação adversarial independente

- **claim verificado:** `docs/evidence/agent-state/CLAIMS-INBOX/TRK-A/WP-B7.md` (worktree `.worktree-trk-a`, branch `trk-a-wp-b7`, commit `93c1d62`, base `648c029`).
- **papel do verificador:** `VTrkA` — falsificação, contexto novo, nenhuma escrita em código/ledger/evidência do trilho. Única escrita: este arquivo.
- **método:** worktree do trilho **não modificado** (`git status --short` vazio no início e no fim). Cópias descartáveis em `/tmp` (`tar` do worktree + `node_modules` simbólico) para RED, sondas e regeneração de matriz; nenhum `:5432`, nenhum host remoto, nenhum push/commit. Todo lançamento com `env -u DATABASE_URL_UNPOOLED`.
- **árvores usadas:** `/tmp/wp-b7-cleanfix` (`git archive 93c1d62`), `/tmp/wp-b7-cleanparent` (`git archive 648c029`), `/tmp/wp-b7-verify` e `/tmp/wp-b7-parent` (cópias + sonda própria `src/test/vtrka-probe.test.tsx`, fora do worktree).
- **data:** 2026-09-17.

## Veredicto por alegação

| id  | alegação (claim)                                                                                                                                                               | método próprio                                                                                                                                                                                                                                                                                                                                                 | veredicto                                                           | evidência bruta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | RED contra o pai `648c029` = `5 failed / 10 passed (15)`, exit 1; GREEN na entrega = `15 passed (15)`, exit 0 (RED→GREEN real, via stash do fix)                               | reproduzi por conta própria em cópia: instalei `git show 648c029:src/lib/break-even.ts` em `/tmp/wp-b7-verify` (`diff` = IDENTICAL_TO_PARENT), rodei `npx vitest run src/test/break-even.negative-margin.test.tsx`; depois restaurei o arquivo e rodei de novo. Repeti o GREEN em árvore limpa (`git archive 93c1d62`)                                         | **CONFIRMED** (contagens idênticas às seladas)                      | §E1: `Tests 5 failed \| 10 passed (15)` exit 1, 5 falhas nomeadas = exatamente as de margem negativa; §E2: `Test Files 1 passed (1) / Tests 15 passed (15)` exit 0 (2×, árvore limpa + cópia)                                                                                                                                                                                                                                                                                                                   |
| 2a  | a correção muda o **status calculado** `invalid` → `unreachable` (não é remendo de rótulo)                                                                                     | sonda própria A/C: `calculateBreakEvenSummary` por borda; mesma sonda contra o pai e `diff` linha a linha                                                                                                                                                                                                                                                      | **CONFIRMED**                                                       | §E3: fix `cm=-9.15 → {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[]}` × pai `{"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"]}`; somente as linhas de cm/cmPct negativo divergem (diff completo em §E4)                                                                                                                                                                                                                    |
| 2b  | o rótulo "Não atingível" vem do ramo `NON_POSITIVE_CONTRIBUTION`, não de mapeamento novo de `invalid`                                                                          | (i) escopo do diff; (ii) superfície de export; (iii) grep de produtores de `status:"unreachable"`; (iv) grep dos sítios do rótulo; (v) mutação causal: com o **mesmo** código de rota, `invalid` (preço negativo no BFF) renderiza "Erro de cálculo" e `unreachable` renderiza "Não atingível"; (vi) no pai, mesma rota + estado `invalid` → "Erro de cálculo" | **CONFIRMED**                                                       | §E5: commit toca só `src/lib/break-even.ts` (+teste/docs); bloco `^export` idêntico ao pai (só deslocamento de linha); produtor único de `unreachable` em `break-even.ts:145` (ramo `!contributionMargin.gt(0)`, `reason:"NON_POSITIVE_CONTRIBUTION"`); rótulo só em `ponto-equilibrio.tsx:376,381` e `diagnostico.tsx:427`, todos gated em `units.status === "unreachable"`; sonda D: `routePrice=-25 → pontoErroDeCalculo 1, pontoNaoAtingivel 0`; pai `cm=-9.15 → pontoErroDeCalculo 1, pontoNaoAtingivel 0` |
| 2c  | `allowZero` era parâmetro **morto** e o eixo real é o sinal; nada mais mudou de semântica                                                                                      | grep de todos os call sites na versão do pai e na entrega (o módulo não exporta `parseDecimal`/`parseBaseInputs`)                                                                                                                                                                                                                                              | **CONFIRMED**                                                       | §E6: pai tem 5 call sites (`fixedExpenses[]`, `price`, `contributionMargin`, `contributionMarginPct`, `desiredProfit`), **nenhum** passa 3º argumento; entrega: só `contributionMargin`/`contributionMarginPct` com `"signed"`, demais no default `"non-negative"`                                                                                                                                                                                                                                              |
| 3   | controles negativos seguem rejeitados (`price`, `fixedExpenses`, `desiredProfit`) e NaN/Infinity/vazio/null/1e309 continuam fora; `cm` negativo **gigante** aceito como estado | sonda própria B: 43 casos por campo, `fix` × `pai`, saída bruta lado a lado                                                                                                                                                                                                                                                                                    | **CONFIRMED**                                                       | §E3 (tabela B). `price=-1/-0 → INVALID_DECIMAL/price`; `fixedExpenses=[-1]/[-1000] → INVALID_DECIMAL/fixedExpenses[0]`; `desiredProfit=-1/-0 → INVALID_DECIMAL/desiredProfit`; `NaN/Infinity/-Infinity/''/' '/null/'1e3'/'1e309'/' -5'/'-5 '/'-05'/U+2212 → INVALID_DECIMAL`; `cm='-1e30'` rejeitado (notação não canônica) mas `cm='-1' + 30 zeros` **aceito** → `unreachable`; `cm='-0'`/`'-0.0'` → `unreachable`                                                                                             |
| 4   | os dois motores concordam por **estado** para `cm<0/=0/>0`                                                                                                                     | sonda própria C: `calculateBreakEvenSummary` (cliente) × `calculateBreakEvenUnits` (`finance.ts`), comparando `status`/`reason` e também a margem derivada (`calculateContributionMargin`)                                                                                                                                                                     | **CONFIRMED**                                                       | §E3 PROBE-C: `-9.15 → unreachable/NON_POSITIVE_CONTRIBUTION` nos dois; `0 → unreachable/…` nos dois; `0.1 → reachable` nos dois; `derivedCm` = `-9.15 / 0 / 0.1`                                                                                                                                                                                                                                                                                                                                                |
| 5   | `/ponto-equilibrio` e `/diagnostico` mostram o mesmo estado para `cm<0`                                                                                                        | render dos componentes de rota reais com motores reais (harness próprio de mock só na fronteira BFF; `getDiagnostic` real sobre transação em memória); contagem de rótulos por `within(container)`                                                                                                                                                             | **CONFIRMED**                                                       | §E3 PROBE-D: `cm=-9.15 → ponto{"Não atingível":2,"Erro de cálculo":0} diag{"Não atingível":1,"Erro de cálculo":0}`, `diagnostic breakEvenUnits.status=unreachable`, `currentStatus=ok`; `cm=0` idêntico; `cm=10.5 → 1 label "N un."` em cada superfície                                                                                                                                                                                                                                                         |
| 6   | a assinatura nova (`allowZero` → `DecimalDomain`) não muda o comportamento de nenhum outro call site                                                                           | grep exaustivo + **diferencial** de sondas fix×pai (mesma sonda, dois motores)                                                                                                                                                                                                                                                                                 | **CONFIRMED**                                                       | §E4: dos 68 registros da sonda, apenas as linhas de `cm<0/cm=-0/'-0.0'/'-5.000'/-(1e30 dígitos)'` e `cmPct<0` diferem; todo o resto — inclusive todas as rejeições de `price`, `fixedExpenses`, `desiredProfit`, `NaN`, `Infinity`, `null`, vazio, `1e309`, `1e3`, unidade inválida — é byte-idêntico entre pai e entrega                                                                                                                                                                                       |
| 7   | `src/lib/break-even.ts` na matriz M-02 gera drift de linhas?                                                                                                                   | grep no `matrix.yaml`; `m02:matrix:check` em **árvore limpa** do pai e do fix; `--check` não regrava (checado no script e por snapshot sha256 de `docs/specs`); `generate` só nas cópias                                                                                                                                                                       | **CORRECTED** (a conclusão do claim "sem matriz M-02" é incompleta) | §E7: `src/lib/break-even.ts` **não aparece** em `matrix.yaml` (zero drift de `bffs[].operations[].line`; a única entrada é `src/lib/break-even.functions.ts`, arquivo intocado). **Porém** `m02:matrix:check` passa no pai e **falha** no fix: `M-02 matrix drift` — `counts.directDatabaseFiles 47 → 48`, entrada nova `src/test/break-even.negative-margin.test.tsx` (importa `@/db/schema`). `--check` não regravou nada (snapshot sha256 de `docs/specs`: UNCHANGED)                                        |
| 8   | evidência selada íntegra e coerente com o claim                                                                                                                                | `sha256sum -c manifest.sha256` no diretório do trilho; conferência de `red-parent.txt`, `green-fix.txt`, `scoped-suite.txt`, `fix.patch` contra medições próprias e contra o commit                                                                                                                                                                            | **CONFIRMED**                                                       | §E8: 5/5 `OK` (ALL MATCH); `red-parent.txt` = `5 failed / 10 passed` com os mesmos 5 nomes; `green-fix.txt` = `15 passed`; `fix.patch` contém **todas** as 485 linhas adicionadas de `git show 93c1d62` (0 ausentes); `scoped-suite.txt` `180 passed (180)` é reproduzível com o conjunto exato de 7 arquivos do §E8                                                                                                                                                                                            |

**Contagem final: CONFIRMED 9 · CORRECTED 1 · REJECTED 0 · UNVERIFIABLE 0.**
(Nenhum item foi UNVERIFIABLE: as duas linhas do gate do trilho sem artefato selado — `tsc` e `build` — foram medidas por conta própria; `tsc` exit 0 sem saída, consistente com a tabela do claim. `build` não foi re-executado por não constar das 8 alegações atribuídas; ver resíduos.)

## Adequação para land

**SIM — o fix é adequado para land**, porque: a causa-raiz está correta e é a única alterada (guard de sinal em `parseDecimal` + domínio explícito em `parseBaseInputs`); o estado calculado muda nas duas superfícies (`unreachable`/`NON_POSITIVE_CONTRIBUTION`) sem nenhum rótulo novo; os controles negativos continuam rejeitados e o diferencial fix×pai só diverge nas linhas de margem sinalizada; os dois motores concordam por estado; RED e GREEN foram reproduzidos por mim, com as mesmas contagens das evidências seladas, e o selo está íntegro.

**Risco que o land precisa mitigar (único bloqueante real):**

1. **Drift de matriz M-02 introduzido pelo próprio item.** `npm run m02:matrix:check` passa em `648c029` e **falha** em `93c1d62` (`counts.directDatabaseFiles 47 → 48`), porque o teste novo entra em `directDatabaseFiles`. O claim lista "sem matriz M-02" como ausência de impacto, mas o impacto existe: o land precisa rodar `npm run m02:matrix:generate` (regrava `docs/specs/M-02/matrix.yaml` + `matrix.generated.yaml`, +1 entrada, apenas o contador muda) e revisar. Nenhum workflow de CI-light roda esse check, mas `scripts/m02-cutover-t0.mjs` exige zero drift — o gate de cutover/reconciliação M-02 quebra sem a regeneração.

**Riscos secundários (declarar, não bloqueiam):**

2. `contributionMarginPct` também passou a `signed`: `cmPct<0` com `cm>0` deixa de ser `invalid` e passa a `reachable` com `revenue:null` (a UI mostra "—" em faturamento, via `brl(null)` → `displayFallback("incomplete")`). É a mesma família de defeito e está coerente com o motor numérico, mas é uma segunda ampliação de domínio além do `contributionMargin` do título do WP.
3. Divergência residual entre superfícies para um payload impossível: com `current_price<0` no BFF, `/ponto-equilibrio` mostra "Erro de cálculo" e `/diagnostico` mostra "Não atingível" (o motor numérico deriva a margem do custo e ignora o preço). Mitigado por `products_current_price_check (price is null or price >= 0)` no schema — não alcançável por dado real; e é fail-safe (nunca fabrica número).
4. A política de forma canônica continua rejeitando notação exponencial (`-1e30`, `1e309`) enquanto aceita a forma por dígitos; comportamento pré-existente, não regressivo, mas explica por que "cm negativo gigante" tem duas respostas dependendo da forma.
5. `unitMode` inválido continua não sendo validado em `break-even.ts` (`reachable` com `unitMode:"bogus"`); pré-existente e idêntico no pai — resíduo fora do escopo do WP-B7.
6. Gate `build` do claim não tem artefato selado (só a linha da tabela); não re-executado aqui por não ser alvo das 8 alegações.

## Resíduos da verificação (declarados)

- A sonda própria mora só em `/tmp` (throwaway); nada dela foi escrito no repositório ou na evidência do trilho. Worktree do trilho terminou limpo (`git status --short` vazio).
- `m02:matrix:generate` foi executado **apenas** em cópias `/tmp` (nunca no worktree do trilho). O `--check` foi provado não-destrutivo por leitura do script (`checkOutputs` só lê) **e** por snapshot sha256 de `docs/specs` antes/depois (UNCHANGED).
- O teste novo não foi avaliado quanto a mérito de estilo/duplicação (rótulos duplicados já declarados pelo trilho); verifiquei apenas comportamento observável.
- Não subi preview/container efêmero: a medição de superfície foi por render dos componentes de rota reais com motores e serviço `getDiagnostic` reais, fronteira BFF mockada — explicitamente permitido pelo contrato de verificação.
- Não reexecutado: `npm run check`, `db:test`, e2e (fora das 8 alegações; o claim já os declara como do E2 do MAESTRO).

## Apêndice — evidência bruta

### E1 · RED reproduzido por mim contra o pai (`/tmp/wp-b7-verify`, `src/lib/break-even.ts` = `git show 648c029:…`, `diff` → IDENTICAL_TO_PARENT)

```text
 ❯ src/test/break-even.negative-margin.test.tsx (15 tests | 5 failed) 250ms
     × margem negativa: status calculado é unreachable 10ms
     × margem negativa não é classificada como INVALID_DECIMAL 1ms
     × margem percentual negativa não suprime a classificação (mesmo estado, sem fabricar zero) 1ms
     × margem negativa: mesma classificação pelo preço/custo e pela margem crua 1ms
     × margem negativa: /ponto-equilibrio e /diagnostico concordam 116ms

AssertionError: expected 'invalid' to be 'unreachable' // Object.is equality   (break-even.negative-margin.test.tsx:321)
AssertionError: expected 'invalid' not to be 'invalid' // Object.is equality   (:340)
AssertionError: expected 'invalid' to be 'unreachable' // Object.is equality   (:355)
AssertionError: expected 'invalid' to be 'unreachable' // Object.is equality   (:382)
AssertionError: expected [ <div …(1)></div> ] to have a length of +0 but got 1  (:445, "Erro de cálculo")

 Test Files  1 failed (1)
      Tests  5 failed | 10 passed (15)
   Duration  2.50s
exit=1
```

### E2 · GREEN na entrega (cópia restaurada para o fix, e árvore limpa `git archive 93c1d62`)

```text
$ npx vitest run src/test/break-even.negative-margin.test.tsx     # /tmp/wp-b7-verify (fix)
 Test Files  1 passed (1)
      Tests  15 passed (15)      Duration 2.62s   exit=0

$ npx vitest run src/test/break-even.negative-margin.test.tsx     # /tmp/wp-b7-cleanfix (git archive 93c1d62)
 Test Files  1 passed (1)
      Tests  15 passed (15)      exit=0
```

### E3 · sonda própria (fix) — PROBE A/B/C/D (saída literal de `/tmp/vtrka-probe-out.txt`)

```text
===PROBE-A===
A cm=-9.15 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
A cm=0 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
A cm=0.1 :: {"status":"reachable","units":"reachable","reason":null,"errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
A cm=-0 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
A cm=-0.00000001 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
A cm=0.00000001 :: {"status":"reachable","units":"reachable","reason":null,"errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}

===PROBE-B===
B price=-1 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=-0 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=0 :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
B price=NaN :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=Infinity :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=1e309 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price='' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=' ' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=null :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=1e3 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/price"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B price=25.000000001 :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
B fixedExpenses=[-1] :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/fixedExpenses[0]"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B fixedExpenses=[''] :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/fixedExpenses[0]"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B fixedExpenses=['NaN'] :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/fixedExpenses[0]"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B fixedExpenses=[] :: {"status":"reachable","units":"reachable","errors":[],"revenue":"0.0000","targetUnits":null,"fixedExpenses":"0.0000"}
B fixedExpenses=['-1e30'] :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/fixedExpenses[0]"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B fixedExpenses=['-1000'] :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/fixedExpenses[0]"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B desiredProfit=-1 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/desiredProfit"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B desiredProfit=-0 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/desiredProfit"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B desiredProfit=0 :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":"reachable","fixedExpenses":"1000.0000"}
B desiredProfit=NaN :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/desiredProfit"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B desiredProfit='' :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
B desiredProfit=' ' :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
B cm=NaN :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=Infinity :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=-Infinity :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm='' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=null :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=' -5' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm='-5 ' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm='-5.000' :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cm='-05' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=U+2212 5 :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm='-1e30' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm=-(1 followed by 30 zeros) :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cm='1e309' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMargin"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm='1'+309 zeros :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}
B cm='-0.0' :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cmPct=-36.6 :: {"status":"reachable","units":"reachable","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cmPct=-0 :: {"status":"reachable","units":"reachable","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cmPct=NaN :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMarginPct"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cmPct='' :: {"status":"invalid","units":"invalid","errors":["INVALID_DECIMAL/contributionMarginPct"],"revenue":null,"targetUnits":null,"fixedExpenses":null}
B cm<0 + cmPct>0 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cm>0 + cmPct<0 :: {"status":"reachable","units":"reachable","errors":[],"revenue":null,"targetUnits":null,"fixedExpenses":"1000.0000"}
B cm<0 + desiredProfit=500 :: {"status":"unreachable","units":"unreachable","reason":"NON_POSITIVE_CONTRIBUTION","errors":[],"revenue":null,"targetUnits":"unreachable","fixedExpenses":"1000.0000"}
B unitMode bogus :: {"status":"reachable","units":"reachable","errors":[],"revenue":"2380.9524","targetUnits":null,"fixedExpenses":"1000.0000"}

===PROBE-C===
C cm=-9.15 :: {"sharedUnitsState":"unreachable","sharedReason":"NON_POSITIVE_CONTRIBUTION","numericState":"unreachable","numericReason":"NON_POSITIVE_CONTRIBUTION","numericErrors":[],"derivedCm":-9.15,"derivedNumericState":"unreachable"}
C cm=0 :: {"sharedUnitsState":"unreachable","sharedReason":"NON_POSITIVE_CONTRIBUTION","numericState":"unreachable","numericReason":"NON_POSITIVE_CONTRIBUTION","numericErrors":[],"derivedCm":0,"derivedNumericState":"unreachable"}
C cm=0.1 :: {"sharedUnitsState":"reachable","sharedReason":null,"numericState":"reachable","numericReason":null,"numericErrors":[],"derivedCm":0.1,"derivedNumericState":"reachable"}

===PROBE-D===
D cm=-9.15 routePrice=25 :: {"numericEngineState":"unreachable","diagnosticCurrentStatus":"ok","diagnosticBeStatus":"unreachable","pontoNaoAtingivel":2,"pontoErroDeCalculo":0,"pontoUnidades":0,"diagNaoAtingivel":1,"diagErroDeCalculo":0,"diagUnidades":0}
D cm=0 routePrice=25 :: {"numericEngineState":"unreachable","diagnosticCurrentStatus":"ok","diagnosticBeStatus":"unreachable","pontoNaoAtingivel":2,"pontoErroDeCalculo":0,"pontoUnidades":0,"diagNaoAtingivel":1,"diagErroDeCalculo":0,"diagUnidades":0}
D cm=10.5 routePrice=25 :: {"numericEngineState":"reachable","diagnosticCurrentStatus":"ok","diagnosticBeStatus":"reachable","pontoNaoAtingivel":0,"pontoErroDeCalculo":0,"pontoUnidades":1,"diagNaoAtingivel":0,"diagErroDeCalculo":0,"diagUnidades":1}
D cm=-9.15 routePrice=-25 :: {"numericEngineState":"unreachable","diagnosticCurrentStatus":"ok","diagnosticBeStatus":"unreachable","pontoNaoAtingivel":0,"pontoErroDeCalculo":1,"pontoUnidades":0,"diagNaoAtingivel":1,"diagErroDeCalculo":0,"diagUnidades":0}
D cm=10.5 routePrice=-25 :: {"numericEngineState":"reachable","diagnosticCurrentStatus":"ok","diagnosticBeStatus":"reachable","pontoNaoAtingivel":0,"pontoErroDeCalculo":1,"pontoUnidades":0,"diagNaoAtingivel":0,"diagErroDeCalculo":0,"diagUnidades":1}
```

### E4 · diferencial sonda fix × pai (`diff /tmp/vtrka-probe-out.txt /tmp/vtrka-probe-parent.txt`, 68 linhas cada)

```text
3c3
< A cm=-9.15 :: {"status":"unreachable",...,"reason":"NON_POSITIVE_CONTRIBUTION","errors":[]}
---
> A cm=-9.15 :: {"status":"invalid",...,"errors":["INVALID_DECIMAL/contributionMargin"]}
6,7c6,7
< A cm=-0 / cm=-0.00000001 :: unreachable/NON_POSITIVE_CONTRIBUTION
---
> A cm=-0 / cm=-0.00000001 :: invalid/INVALID_DECIMAL/contributionMargin
41c41  B cm='-5.000' :: unreachable  |  > invalid/INVALID_DECIMAL/contributionMargin
45c45  B cm=-(1 seguido de 30 zeros) :: unreachable  |  > invalid/INVALID_DECIMAL/contributionMargin
48,50c48,50
< B cm='-0.0' :: unreachable ; B cmPct=-36.6 :: reachable (revenue null) ; B cmPct=-0 :: reachable (revenue null)
---
> B cm='-0.0' :: invalid/…contributionMargin ; B cmPct=-36.6 :: invalid/…contributionMarginPct ; B cmPct=-0 :: invalid/…contributionMarginPct
53,55c53,55
< B cm<0+cmPct>0 :: unreachable ; B cm>0+cmPct<0 :: reachable(revenue null) ; B cm<0+desiredProfit=500 :: unreachable(targetUnits unreachable)
---
> B cm<0+cmPct>0 :: invalid/contributionMargin ; B cm>0+cmPct<0 :: invalid/contributionMarginPct ; B cm<0+desiredProfit=500 :: invalid/contributionMargin
59c59
< C cm=-9.15 :: sharedUnitsState unreachable (numericState unreachable)
---
> C cm=-9.15 :: sharedUnitsState invalid (numericState unreachable)
64c64
< D cm=-9.15 routePrice=25 :: pontoNaoAtingivel 2 / pontoErroDeCalculo 0
---
> D cm=-9.15 routePrice=25 :: pontoNaoAtingivel 0 / pontoErroDeCalculo 1
diff-exit=1   # nenhuma outra linha difere
```

### E5 · escopo do diff, exports, produtor de `unreachable` e sítios do rótulo

```text
$ git show --stat 93c1d62
 .../CLAIMS-INBOX/TRK-A/WP-B7.md                    |  92 ++++
 docs/evidence/trk-a-wp-b7-2026-09-17/README.md     | 117 +++++
 docs/evidence/trk-a-wp-b7-2026-09-17/fix.patch     | 518 +++++++++++++++++++++
 docs/evidence/trk-a-wp-b7-2026-09-17/green-fix.txt |   9 +
 docs/evidence/trk-a-wp-b7-2026-09-17/manifest.sha256 |   5 +
 docs/evidence/trk-a-wp-b7-2026-09-17/red-parent.txt |  97 ++++
 docs/evidence/trk-a-wp-b7-2026-09-17/scoped-suite.txt |   9 +
 src/lib/break-even.ts                              |  24 +-
 src/test/break-even.negative-margin.test.tsx       | 463 ++++++++++++++++++
 9 files changed, 1330 insertions(+), 4 deletions(-)

$ diff <(git show 648c029:src/lib/break-even.ts | grep -n "^export") <(grep -n "^export" src/lib/break-even.ts)
6c6
< 269:export function calculateBreakEvenSummary(input: BreakEvenServiceInput): BreakEvenServiceResult {
---
> 285:export function calculateBreakEvenSummary(input: BreakEvenServiceInput): BreakEvenServiceResult {
   # único export tocado: deslocamento de linha. Nenhum export novo/renomeado.

$ grep -n '"unreachable"' src/lib/break-even.ts
22:export type BreakEvenServiceStatus = "reachable" | "unreachable" | "invalid";
47:      status: "unreachable";            # declaração de tipo (BreakEvenUnits)
145:      status: "unreachable",            # ÚNICO produtor: calculateUnits, ramo !contributionMargin.gt(0) → reason NON_POSITIVE_CONTRIBUTION
229:  if (units.status === "unreachable" || !contributionMarginPct.gt(0)) {   # consumidor (calculateRevenue)

$ grep -n '"unreachable"' src/lib/finance.ts
369:      status: "unreachable";            # declaração de tipo
404:      status: "unreachable",            # produtor único: calculateBreakEvenUnits, if (cmUnit <= 0) → NON_POSITIVE_CONTRIBUTION

$ grep -rn "Não atingível" src/ | grep -v "\.test\."
src/routes/_authenticated/diagnostico.tsx:427:   ? "Não atingível"          # gated em breakEvenUnits.status === "unreachable"
src/routes/_authenticated/ponto-equilibrio.tsx:366:  exibido como &ldquo;Não atingível&rdquo;.   # texto explicativo estático
src/routes/_authenticated/ponto-equilibrio.tsx:376:  if (result?.units.status === "unreachable") return "Não atingível";
src/routes/_authenticated/ponto-equilibrio.tsx:381:  if (result?.units.status === "unreachable") return "Não atingível";
src/lib/format.ts:39:      return "Não atingível";    # displayFallback("infinite") — caminho de +Infinity, não do estado unreachable
   # nenhum mapeamento novo de "invalid" → "Não atingível"
```

### E6 · call sites de `parseDecimal` / `parseBaseInputs`

```text
# ENTREGA (93c1d62)
src/lib/break-even.ts:78   function parseDecimal(
src/lib/break-even.ts:196  value.plus(parseDecimal(expense, `fixedExpenses[${index}]`))          → non-negative (default)
src/lib/break-even.ts:204  function parseBaseInputs(
src/lib/break-even.ts:211  price: parseDecimal(input.price, "price")                             → non-negative
src/lib/break-even.ts:212  contributionMargin: parseDecimal(input.contributionMargin, "contributionMargin", "signed")
src/lib/break-even.ts:213  contributionMarginPct: parseDecimal(input.contributionMarginPct, "contributionMarginPct", "signed")
src/lib/break-even.ts:252  const desiredProfit = parseDecimal(input.desiredProfit, "desiredProfit")  → non-negative
src/lib/break-even.ts:287  const baseInputs = parseBaseInputs(input)

# PAI (648c029)
70: function parseDecimal(value: string, field: string, allowZero = true): Decimal {
78: if (!parsed.isFinite() || (allowZero ? parsed.isNegative() : !parsed.gt(0))) {
184/199/200/201/236: os MESMOS 5 call sites, NENHUM com terceiro argumento → allowZero era morto
# parseDecimal/parseBaseInputs não são exportados; grep em src/, scripts/, e2e/ não achou outro consumidor
# consumidores do módulo: ponto-equilibrio.tsx, break-even.parity.test.ts, server/services/break-even.service.ts, memory-import-graph.test.ts (só path)
```

### E7 · matriz M-02 (comando + saída)

```text
$ grep -n '"src/lib/break-even\.ts"' docs/specs/M-02/matrix.yaml            → exit 1 (ZERO ocorrências)
$ grep -n "break-even" docs/specs/M-02/matrix.yaml
18:      "path": "src/lib/break-even.functions.ts",      # arquivo intocado pelo commit
35:        "@/server/services/break-even.service",
1395 / 1628: entradas de policy para "src/lib/break-even.functions.ts" (sem linha de código)

$ cd /tmp/wp-b7-cleanparent && env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check
M-02 matrix is deterministic and up to date.          # exit 0 (PAI)

$ cd /tmp/wp-b7-cleanfix && env -u DATABASE_URL_UNPOOLED npm run m02:matrix:check
M-02 matrix drift: execute npm run m02:matrix:generate and review the result.   # exit 1 (FIX)

# snapshot sha256 de docs/specs antes/depois do --check  →  added: [] removed: [] changed: []  →  UNCHANGED (--check não regrava)
# atribuição (generate só nas cópias, saída do matcher):
counts: committed 47  parent-gen 47  fix-gen 48
FIX-gen minus PARENT-gen: ['src/test/break-even.negative-margin.test.tsx']
PARENT-gen minus FIX-gen: []
COMMITTED minus PARENT-gen: []
fix-gen vs committed → /counts/directDatabaseFiles value 48 -> 47 ; /directDatabaseFiles len 48 -> 47
# (o teste novo importa @/db/schema + drizzle-orm/pg-core; 20 outros src/test/* já são directDatabaseFiles por desenho)
```

### E8 · selo e conferência da evidência

```text
$ cd docs/evidence/trk-a-wp-b7-2026-09-17 && sha256sum -c manifest.sha256
README.md: OK
red-parent.txt: OK
green-fix.txt: OK
scoped-suite.txt: OK
fix.patch: OK
exit=0        → ALL MATCH (5/5)

# red-parent.txt (selado): "Tests 5 failed | 10 passed (15)" + os 5 nomes → idêntico à minha reprodução (§E1)
# green-fix.txt (selado):  "Tests 15 passed (15)"              → idêntico à minha reprodução (§E2)
# fix.patch (selado): contém 485/485 linhas adicionadas de `git show 93c1d62` (0 ausentes)
# scoped-suite.txt (selado): "Test Files 7 passed (7) / Tests 180 passed (180)"
$ cd /tmp/wp-b7-cleanfix && npx vitest run <negative-margin parity service boundaries golden properties financial-values>
 Test Files  7 passed (7)
      Tests  180 passed (180)          # conjunto exato que reproduz a linha selada
$ npx vitest run <negative-margin parity service boundaries golden properties required-sales>   # o conjunto literal "break-even/finance"
 Test Files  7 passed (7)
      Tests  188 passed (188)
# contagens individuais: negative-margin 15 · parity 6 · service 2 · boundaries 16 · golden 127 · properties 9 · required-sales 13 · financial-values 5
$ npx tsc -p tsconfig.json --noEmit   →  exit 0, sem saída (consistente com a tabela do claim)
```
