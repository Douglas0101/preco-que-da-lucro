# RECONCILIAÇÃO DA BASE — FASE 0 (2026-09-15)

**Papel:** registro do MAESTRO sobre o veredicto do reconciliador dedicado `V0-Reconciliador` (contexto _fresh_, read-only), que leu o **raw** item a item (`ANEXO-ITENS-2026-09-15.md`) e a medição oficial anterior (`plan-recap-2026-09-13/part-E-medicao.md` + `CONSOLIDADO.md` + `part-A..D`), nunca o headline.

## 1. Veredicto

**H-BETA**, com **componente H-γ** declarado e quantificado:

- **H-α (34 itens re-earnados DONE) — REFUTADA.** No round não há 34 upgrades: as transições reais são **`PARTIAL→DONE` = 10** e **`PARTIAL→PARTIAL` = 22**.
- **A premissa era leitura equivocada de `35`:** `35` é o **id do item §35** (perf-evidence), não uma contagem de itens. Prova: `ANEXO-ITENS-2026-09-15.md:201` traz `35` na coluna **item** (`prev = PARTIAL`, `status = PARTIAL`), e `part-E-medicao.md:66` registra §35 como **1 item** (0 D / 1 P / 0 NS).
- **H-β (o «antes» está correto) — CONFIRMADO, reproduzido do raw:** a coluna `prev` do anexo dá **129 D · 32 P · 25 NS · 1 NÃO VERIFICADO**; com o item `PARTIAL` que a reenumeração removeu (4º item de §27) fecha **129 D · 33 P · 25 NS = 187**, exatamente `part-E-medicao.md:24`. Reforço fase a fase: os totais de `prev` reproduzem `part-E-medicao.md:3` (F0 4/1/0 · F1 10/0/0 · F2 6/1/0 · F3 6/2/0 · F4 1/2/1 · F5 7/0/0 · F6 9/0/0 · F7 2/3/0 · F8 4/2/0 · F9 6/1/0 · F10 0/0/7 = 55/12/8 + 1 NV, e bloco B 22/10/2).
- **H-γ (bases diferentes) — componente real, ±1 item:** as duas bases de 187 trocam **1 item em cada sentido** — **entra** `GATE-M02` (não verificado → **DONE**, verificado por execução; a enumeração antiga o excluía) e **sai** o 4º item de §27 (era `PARTIAL`; a enumeração vigente conta §27 com 3 itens, conforme `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1835-1859`). Efeito: **+1 crédito (M-02) − 0,5 crédito (§27) = +0,5 item-equivalente = +0,27 pp na base «antes»**.

## 2. Matriz de transições (fecha em 187)

| transição           | n       |
| ------------------- | ------- |
| DONE→DONE           | 128     |
| PARTIAL→DONE        | 10      |
| DONE→PARTIAL        | 1       |
| PARTIAL→PARTIAL     | 22      |
| NS→PARTIAL          | 2       |
| NS→NS               | 21      |
| NS→UNVERIFIABLE     | 2       |
| NÃO VERIFICADO→DONE | 1       |
| **total**           | **187** |

Base antes: **129 D · 33 P · 25 NS** (denom. 187 → 69,0% cru / 77,8% parcial).
Base atual: **139 D · 25 P · 21 NS · 2 UNV** (denom. 187 → 74,3% cru / **81,0%** parcial).
Blocos atuais: A 76 = 60/8/8/0 · B 34 = 24/8/2/0 · C 71 = 54/5/10/2 · D 6 = 1/4/1/0.

## 3. Lista nominal das 16 transições não-identidade (com âncora no HEAD)

| id         | transição        | âncora do estado atual (`arquivo:linha`)                                                                         | linha do anexo |
| ---------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| `F0-04`    | PARTIAL→DONE     | `scripts/perf/capture-baseline.mjs:1-969` · `scripts/perf/summarize.mjs:36-47` · `package.json:74-75`            | :12            |
| `BFF-002`  | PARTIAL→DONE     | `src/lib/products.functions.ts:507,521,612,617,632` (+alias `:642`)                                              | :32            |
| `BFF-003`  | PARTIAL→DONE     | `src/lib/expenses.functions.ts:71,106,111,126`                                                                   | :33            |
| `GATE-M02` | NV→DONE          | execução `npm run m02:boundaries` / `m02:matrix:check` (`package.json:34-35`)                                    | :39            |
| `10.7`     | **DONE→PARTIAL** | `src/test/finance.properties.test.ts:89-119` (1 das 3 propriedades)                                              | :50            |
| `12.4`     | PARTIAL→DONE     | `.github/workflows/neon-pr-branch.yml:109` · `neon-readiness.yml:162`                                            | :63            |
| `14.3`     | PARTIAL→DONE     | `drizzle/0012_youthful_stellaris.sql:1-4` · `src/db/schema.ts:710-712,726` · `src/lib/ai/tool-runner.ts:313-325` | :75            |
| `18.5`     | PARTIAL→DONE     | `src/components/loading-skeleton.tsx:12-22` (conferido: `role=status` + `sr-only` fora do `aria-hidden`)         | :108           |
| `19.5`     | PARTIAL→DONE     | `src/instrumentation/telemetry.ts:113-114` · `src/services/product-read-model.service.ts:35-38`                  | :115           |
| `21.2`     | PARTIAL→DONE     | `drizzle/0013_robust_cammi.sql:1-4` · `src/server/repositories/product.repository.ts:73-92` (CAS conferido)      | :123           |
| `25.6`     | NS→UNVERIFIABLE  | `.github/` só tem `workflows/`; 0 hits `codeql` (settings-side)                                                  | :149           |
| `25.7`     | NS→UNVERIFIABLE  | sem `.github/secret_scanning.yml` (settings-side)                                                                | :150           |
| `26.8`     | NS→PARTIAL       | `.github/workflows/neon-pr-branch.yml:145-282,284-298,386-390` (skip rotulado sem `NEON_API_KEY`)                | :158           |
| `30`       | NS→PARTIAL       | `scripts/obs/error-budget.ts:11-20` · `src/test/error-budget.test.ts:170,235-275`                                | :171           |
| `32.5`     | PARTIAL→DONE     | `scripts/db/test-sql-injection.ts:240-334,349,357-370`                                                           | :179           |
| `32.9`     | PARTIAL→DONE     | `scripts/db/test-auth-integration.ts:312-348,351-353` (conferido)                                                | :183           |

## 4. Consequência obrigatória para o placar (correção de precisão)

Com as bases **alinhadas** (mesma composição dos dois lados):

```text
antes alinhado  = 145,5 (crédito) + 0,5 (§27 removido) = 146,0  → 78,1%
agora           = 151,5 (crédito)                            → 81,0%
Δ alinhado      = +5,5 item-equivalentes = +2,9 pp
```

O headline anterior (**+3,2 pp**) embute a troca de composição de +0,27 pp; o **delta comparável é +2,9 pp**. Ambos ficam registrados (o ledger usa o delta alinhado, com a nota).

## 5. Estado da FASE 0

**FECHADA** em 2026-09-15. Nenhuma claim nova pode ser promovida sem citar este veredicto. O ledger recebe a nota de reconciliação no fechamento da rodada (FASE 4), com marcador parent-pinned.
