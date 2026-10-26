# SPEC — WP `dashboard-periodo-2026-10-26`

- Status: **em execução (F1 RED ✔ · F2 GREEN ✔ · F3 UI+E2E ✔ · F4 governança pendente)**
- Fato-fonte: sessão de 2026-10-25/26; diagnóstico do seletor Mês/Trimestre/Ano em `/inicio`
- Branch: `develop` (única). Sem schema, sem migration, sem dependência nova.

## 1. Problema (medido)

| #   | Camada                             | Medição                                                                                                                                                                             |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Janela sem limite superior         | `src/server/repositories/sales.repository.ts:108-119,121-134` usam só `gte(occurredAt, from)`. SQL local: venda de `2027-01-15` satisfaz o predicado de outubro (`true`).           |
| P2  | Fronteira no fuso do processo      | `src/server/services/dashboard.service.ts:51-62` usa `setHours/setDate/setMonth` locais. Com `TZ=UTC`, o início de outubro vira `00:00Z` = `2026-09-30 21:00` BRT (medido por SQL). |
| P3  | Período nunca exibido              | `SDD.md:161` exige o período **sempre exibido**; a tela só diz "no período selecionado".                                                                                            |
| P4  | Períodos misturados sem unidade    | `fixedExpenses` é mensal, exibido ao lado de faturamento trimestral/anual. `SDD.md:1517` e `:1623`; `/despesas:152` e `/ponto-equilibrio:262` já dizem "/ mês".                     |
| P5  | Troca de período desmonta a página | `main.innerText` 657 → 13 chars, 23 skeletons, seletor ausente; retorno em ~40 ms. Sem `keepPreviousData` no repo. **DBT-165** (foco → `<body>`, WCAG 2.4.3/3.2.2).                 |
| P6  | `empty` rotulado como incompleto   | `src/routes/_authenticated/inicio.tsx:377-389` usa `MARGIN_UNAVAILABLE_BADGE` ("DADOS INCOMPLETOS") para `state:"empty"`. ADR-041 §3 distingue três estados.                        |
| P7  | `payload.period` decorativo        | `src/lib/dashboard-summary-guard.ts:64-70` valida domínio, nunca igualdade com o período pedido.                                                                                    |
| P8  | Testes só provam inclusão          | `e2e/sales-dashboard.spec.ts:238-270`; `dashboard-consolidated-margin.db.test.ts:145-146` usa `now()` e só `month`. Nenhuma exclusão de fronteira.                                  |

Inerente (não é defeito): em 2026-10-25 `month ≡ quarter` (Q4 começa em 01/10); em 2027-01-10 os três coincidem. Precisa ser comunicado, não corrigido.

## 2. Contrato (falsificável)

- Toda leitura de vendas do dashboard usa `[from, to)`: `occurredAt >= from AND occurredAt < to`, com `from`/`to` calculados uma vez e usados nas **duas** consultas.
- A janela é calculada em `America/Sao_Paulo`, independente do `TZ` do processo.
- A tela exibe a janela concreta derivada do `period` atestado no payload.
- Métricas cadastrais/unitárias ficam em grupo próprio, rotuladas como invariantes.
- `empty` tem badge próprio; `incomplete` mantém "DADOS INCOMPLETOS".
- Payload com `period` divergente do pedido cai no estado de erro.
- Ativar período preserva `document.activeElement` no botão (DBT-165).

## 3. Mudanças (lista fechada)

| Arquivo                                                                  | Fase                                      |
| ------------------------------------------------------------------------ | ----------------------------------------- |
| `src/lib/period-window.ts` (novo)                                        | F1 (legado verbatim) → F2 (correto)       |
| `src/test/period-window.test.ts` (novo)                                  | F1                                        |
| `src/test/dashboard-consolidated-margin.db.test.ts`                      | F1 (fronteiras)                           |
| `scripts/db/test-dashboard-margin.ts` (identidades)                      | F1                                        |
| `src/server/services/dashboard.service.ts`                               | F2                                        |
| `src/server/repositories/sales.repository.ts`                            | F2                                        |
| `src/server/services/sales.service.ts`                                   | F2                                        |
| `src/routes/_authenticated/inicio.tsx`                                   | F3                                        |
| `src/lib/query-options.ts`                                               | F3                                        |
| `src/lib/dashboard-summary-guard.ts`                                     | F4                                        |
| `e2e/sales-dashboard.spec.ts`, `e2e/visual/visual-observability.spec.ts` | F3/F4                                     |
| `docs/adr/ADR-049-*.md`, `DEBTS.md`                                      | F4                                        |
| `docs/specs/M-02/matrix.{generated.,}yaml`                               | F2 (regenerado por `m02:matrix:generate`) |

**Não muda:** schema, migrations, `migration-classes.ts`, contadores `transactionSites(114)`/`directDatabaseFiles(55)`, baseline de contratos (`serverFunctions:35`), dependências, bundle.

## 4. Testes (RED primeiro)

Unit (T1–T7) em `src/test/period-window.test.ts`: mês/trimestre/ano com ISO literal (`03:00Z` = meia-noite BRT), colapso de janeiro, `now` explícito, fevereiro (trava o offset) e guarda de fonte que proíbe mutadores de relógio local — com controle negativo do próprio regex.

Banco (D) em `dashboard-consolidated-margin.db.test.ts`, um tenant por fronteira:

| Caso             | Instante                       | Esperado                   |
| ---------------- | ------------------------------ | -------------------------- |
| TENANT_START     | início do mês corrente (BRT)   | mês conta 1                |
| TENANT_END       | início do mês seguinte (BRT)   | mês conta 0                |
| TENANT_FUTURE    | 1º/01 do ano seguinte (BRT)    | mês/trimestre/ano contam 0 |
| TENANT_PAST_YEAR | último segundo do ano anterior | mês/trimestre/ano contam 0 |

Oráculo independente: offset literal `-03:00` e calendário BRT via `Intl`, nunca a implementação sob teste.

**RED é condicional ao fuso:** `TZ=America/Sao_Paulo` faz o código defeituoso passar (`setHours` local coincide com BRT). O RED é capturado sob `TZ=UTC`, que é o fuso dos runners do CI. A guarda de fonte (T7) existe para o gate não depender disso.

## 5. DoD

1. `TZ=UTC npx vitest run src/test/period-window.test.ts` falha por asserção (não por módulo ausente).
2. `npx tsx scripts/db/test-dashboard-margin.ts` falha nos casos de fronteira com contagem observada.
3. F2: os mesmos comandos verdes; `TZ=Asia/Tokyo` e `TZ=America/Sao_Paulo` idem.
4. F3/F4: e2e da matriz completa, `npm run check` 21/21, `m02:matrix:generate` sem diff, `check:bundle` dentro do limite do script (`initialGraphLimitBytes = 500_000`) — **ERRATA**: a versão anterior desta linha dizia "≤ 487.544 B", que era a **medição** da sessão anterior, não o orçamento. Medição de F3: **487.577 B** minificados (11 chunks), sob o limite.
5. Selo: `MANIFEST.sha256` com `checked === discovered` não vazio.

## 6. Riscos

- **R1** `keepPreviousData` pode mostrar número da janela anterior: exigir rótulo derivado de `metrics.period` + `aria-busy`.
- **R2** Specs penam no vazio: `e2e/sales-dashboard.spec.ts:220`, `e2e/visual/visual-observability.spec.ts:42`. `e2e/ui-stack.spec.ts:269` é `/produtos` (não afetado).
- **R3** Locator `div.grid.gap-4 > div.bg-card` (`sales-dashboard.spec.ts:188`) só sobrevive se cada grupo mantiver `grid gap-4`.
- **R4** Oráculo com `-03:00` fixo trava o regime sem DST; se o Brasil reintroduzir horário de verão, o teste falha alto (desejado).
- **R5** Caminho de erro continua substituindo o painel — limite declarado.

## 7. Rollback

Reverter por commit; F1/F2 (matemática) e F3/F4 (apresentação) são independentes. Nada vai a `develop` sem F4 verde.

## 8. Decisões abertas

Normalização de `periodicity` não-mensal (dívida DBT-173) e rótulo divergente em `/diagnostico:409` (DBT-174) ficam declarados fora deste WP.
