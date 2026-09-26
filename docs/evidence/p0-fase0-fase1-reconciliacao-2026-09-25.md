# Fase 0 §5 e Fase 1 §6 (P0) — reconciliação de estado e matrizes

- **Data:** 2026-09-25
- **Base medida:** `develop` local = `7c54eae` · `origin/develop` = `a2f5ff6` (51 commits não publicados) ·
  `origin/main` = `9724d2c`
- **Pedido:** kickoff da Fase 0 (F0-03) e dos P0 da Fase 1 (SEC-001, FIN-001…FIN-004) do
  `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md`
- **Método:** leitura direta no HEAD com `arquivo:linha` + **execução** das suítes. Nenhum artefato
  anterior foi tratado como prova — inclusive `MEDICAO-2026-09-24.md`, que é usado abaixo apenas
  como correlato.

## 1. Achado principal: o escopo pedido já está implementado

Os seis itens nomeados no despacho **existem, estão testados e passam** no HEAD. Nenhum foi
reimplementado — duplicá-los violaria a atomicidade do INV-009 e criaria uma segunda convenção para
o mesmo contrato.

| item           | onde está                                                                                             | teste que cobre                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| F0-03 (§5)     | `src/test/finance.golden.test.ts` (1.085 linhas)                                                      | 158 testes verdes em `finance.golden` + `finance.properties` + `format`                             |
| SEC-001 (§6.1) | `src/lib/chat-markdown.tsx:11-31` — allowlist de componentes React, **sem** `dangerouslySetInnerHTML` | `src/test/chat-markdown.test.tsx:14-21` (6 vetores) + `security-headers.test.ts` → 27 testes verdes |
| FIN-001 (§6.2) | `src/lib/finance.ts:41-63` — `CalculationResult<T>` com `calcOk`/`calcIncomplete`/`calcInvalid`       | `finance.golden.test.ts:182`, `:197`                                                                |
| FIN-002 (§6.3) | varredura: nenhum `?? 0` semântico no caminho financeiro (15 ocorrências, todas contadores/chaves)    | `finance.golden.test.ts:93`, `:105`, `:160`                                                         |
| FIN-003 (§6.4) | `src/lib/format.ts:24-43` — `numericDisplayState` com `ok`/`incomplete`/`invalid`/`infinite`          | `src/test/format.test.ts:16-18`, `:95-96`                                                           |
| FIN-004 (§6.5) | `src/lib/finance.ts:473-484` — `VolumeSource` + `isFactualVolumeSource`; o `100` sumiu                | `simulation-volume-source.test.tsx:106-142`, `finance.golden.test.ts:306-377`                       |

Correlato: a medição de 2026-09-24 (`docs/evidence/medicao-plano-mestre-2026-09-24/MEDICAO-2026-09-24.md:20`)
já havia dado **S1 (§5–§6) = 15 itens, 15 DONE**, com 10 auditores paralelos. Este documento
**re-deriva** o veredicto no HEAD `7c54eae` em vez de herdá-lo.

## 2. Matriz de Regressão Financeira (§33) — 9/9 verde por execução

Cada linha foi conferida contra o teste que a cobre; o resultado é o do `npx vitest run` de 2026-09-25
(**99 arquivos, 1.024 testes verdes, 13 pulados**, 65 s).

| caso (§33)               | esperado                     | onde está provado                                                                                                      | veredito  |
| ------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| package price null       | incomplete                   | `finance.golden.test.ts:93-103` (`calculateIngredientCost` → `null`)                                                   | **verde** |
| unit incompatible        | incomplete/invalid           | `finance.golden.test.ts:105-134` (`status: "incomplete"`, `missing: conversion_context`)                               | **verde** |
| yield null               | incomplete                   | `finance.golden.test.ts:165`                                                                                           | **verde** |
| tax null                 | incomplete quando necessária | `finance.golden.test.ts:182`                                                                                           | **verde** |
| contribution ≤ 0         | break-even não atingível     | `finance.golden.test.ts:224`, `:234`; `finance.required-sales.test.ts:40-41`                                           | **verde** |
| required units 10.1 → 11 | 11                           | `finance.golden.test.ts:253-257` (`calculateBreakEvenUnits(101, 10, "discrete")` → `rawUnits` 10.1, `roundedUnits` 11) | **verde** |
| volume unknown           | não chamar real              | `finance.golden.test.ts:338-356`; `simulation-volume-source.test.tsx:124`                                              | **verde** |
| markup arbitrário        | inexistente                  | sem `1.5` em `src/lib/finance.ts`; `finance.golden.test.ts:379-427` (formação explícita, FIN-005)                      | **verde** |
| NaN                      | nunca formatado como zero    | `format.test.ts:16-18` (`brl/pct/num(NaN) === "Erro de cálculo"`), `:95-96`                                            | **verde** |

Os 12 casos canônicos de F0-03 (§5, linhas 343-354) também estão todos presentes no golden:
custo normal `:82` · custo faltante `:93` · unidade incompatível `:105` · yield zero `:156` ·
yield null `:165` · tax null `:182` · margem negativa `:209` · contribuição zero `:224` ·
break-even impossível `:234` · quantidade fracionária `:263` · cenário real `:275` · cenário simulado `:299`.

## 3. Matriz de Segurança XSS (§32) — a linha do escopo, 6/6 vetores

`src/test/chat-markdown.test.tsx:14-21` — cada vetor é testado em **três** asserções (nenhum elemento
perigoso criado, payload inerte como texto, nenhum atributo de event handler no DOM), mais a
asserção estrutural de que o renderer não produz `dangerouslySetInnerHTML` (`:51-64`).

| vetor (SEC-001 §6.1 "Testes") | payload                             | veredito   |
| ----------------------------- | ----------------------------------- | ---------- |
| `<script>`                    | `<script>alert(1)</script>`         | **inerte** |
| `<img onerror>`               | `<img src=x onerror=alert(1)>`      | **inerte** |
| `javascript:`                 | `<a href="javascript:alert(1)">`    | **inerte** |
| SVG malicioso                 | `<svg onload=alert(1)></svg>`       | **inerte** |
| iframe                        | `<iframe src=https://evil.example>` | **inerte** |
| atributo event handler        | `<div onmouseover=alert(1)>`        | **inerte** |

**CSP §20.1 já implementada em Report-Only:** `src/lib/security-headers.ts:48` emite
`content-security-policy-report-only` com os dois canais de coleta; `src/test/csp-report.test.ts` e
`security-headers.test.ts` (27 testes verdes juntos com o XSS).

As demais linhas de §32 (401 sem auth, 403 cross-tenant, tool inválida, SQL injection, replay
idempotente, rate limit de IA) **não pertencem ao escopo deste despacho** — são Fase 2/3 — e têm
cobertura própria (`cross-tenant-denial.perf-waves.test.ts`, `ai-tool.repository.security.test.ts`,
`chat-rate-limit.test.ts:429`, `sql-redactor.test.ts`, `snapshot-idempotency.test.ts`).

## 4. Trabalho realmente entregue: a asserção que faltava em DBT-19

O único item **aberto** encontrado no caminho pedido era de governança, e é o que
`reconciliacao-plano-mestre-2026-09-24.md:§6.2` e o `AGENTS.md` nomeam como o ciclo de código mais
urgente: **nenhum teste pinava a cadeia `check`**. A condição de fechamento de DBT-19 tem duas metades;
a primeira (os dois guards encadeados, com caso negativo) foi cumprida no commit `c7e6a55`; a segunda
— _a tabela de cobertura do `AGENTS.md` bater com os YAMLs por asserção de teste_ — não existia.

Entregue agora:

- `scripts/lib/m02-ci-coverage.ts:120-255` — `parseCoverageTable`, `gateInCheckChain`, `gateInHeavy`,
  `gateInLight` e `auditDeclaredCoverage`. Reusa o módulo de cobertura já existente em vez de abrir
  um segundo mecanismo. A invocação na light é detectada nas duas formas reais (`npm run <gate>` e
  `node scripts/<kebab>.<ext>`); a heavy só conta passo de lista `- run:`, nunca comentado.
- `src/test/m02-ci-coverage.test.ts:110-198` — 12 asserções, incluindo **seis controles negativos**:
  gate acrescentado ao `check` sem entrar na tabela · gate declarado e inexistente em
  `package.json` · guard removido da heavy · guard removido da light · gate removido do `check` ·
  ✔ virado ✘ na tabela · marca ilegível · guard comentado contando como ausente · tabela ausente.

**Fail-closed nas duas direções:** a tabela que discorda dos fatos reprova, e também a ausência da
tabela, a marca irreconhecível, o gate fantasma e o passo da cadeia `check` sem cobertura declarada.
Uma marca ilegível **não** vira `true` silencioso.

**Prova de vivacidade (fora da suíte):** a linha 34 do `AGENTS.md` foi mutada de
``| `m02:boundaries` | ✔ | ✔ (passo direto) |`` para `✘` real; a suíte reprovou com
`m02:boundaries (heavy): a tabela declara ✘ e o gate roda ali`; o arquivo foi restaurado
(`git diff` vazio) e a suíte voltou a 21/21 verde.

## 5. Limites declarados

1. **`npm run check` não fecha enquanto o WIP do usuário estiver na árvore.** O WIP rebaixa
   `drizzle-kit` de `^0.31.10` para `^0.18.1` (`package.json` + lockfile, sem commit). Medido:
   `m02:lockfile-guard` reprova com 4 razões (spec, lock resolvido, sha do lock, instalado) e
   `typecheck` reprova com `drizzle.config.ts(1,10): TS2305 — Module '"drizzle-kit"' has no
exported member 'defineConfig'` (o símbolo não existe em 0.18.1). **Nenhum dos dois arquivos foi
   tocado** — é WIP do usuário, e revertê-lo é decisão dele. Os dois arquivos mudados por este ciclo
   (`scripts/lib/m02-ci-coverage.ts`, `src/test/m02-ci-coverage.test.ts`) não participatem dessa
   causa: o `typecheck` acusa **uma** erros e é em `drizzle.config.ts`.
2. **Verde local, não CI.** O CI por push está bloqueado por cota de plataforma desde 2026-09-21
   (ver `PROGRESS.md` §1). Nenhum selo aqui cita `run@sha` — não houve run para citar. O
   `concurrency` dos workflows dispara apenas em `main`/`develop`, então **push de branch de
   feature não consome cota**; PR aberto consome (a heavy roda a matriz inteira).
3. **Nenhum push foi feito.** `develop` local segue 51 commits à frente de `origin/develop`; publicar
   é decisão do MAESTRO, não efeito colateral deste ciclo.
4. **Este documento mede e propõe.** O registry (`DEBTS.md`) é do MAESTRO: a linha de DBT-19
   **continua ABERTA** e o que existe aqui é a metade que faltava da condition de fechamento.
