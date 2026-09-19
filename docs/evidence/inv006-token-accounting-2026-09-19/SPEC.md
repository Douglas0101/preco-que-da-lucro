# SPEC — INV-006: contabilização de tokens de IA (variante B)

**Missão:** `mission/inv006-token-accounting` · **Data:** 2026-09-19 · **Base:** `fd37678` (develop)
**Autoridade:** despacho do MAESTRO ("Decisão aprovada — implementar variante B") · **Land:** ❌ **BLOQUEADO** até B1 + aprovação explícita

## 1. Problema (fato-fonte)

| #   | Fato                                                                                                         | Fonte                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | `GatewayResponse.usage` é **opcional** no tipo e nada o valida em runtime (interface TS, apagada em runtime) | `src/lib/chat-execution.server.ts:49-57`                                                |
| 2   | O único tratamento converte a ausência em **0**                                                              | `:486-488` (`usage?.prompt_tokens ?? 0`)                                                |
| 3   | O `settle` persiste esse 0 como **consumo real** e libera a reserva integralmente                            | `src/lib/ai/budget-ledger.server.ts:646,664,666-667`                                    |
| 4   | O custo estimado também é afirmado como **"known" = 0** quando os tokens são 0                               | `estimateModelCost` devolve `{status:"known", cost:0}` com preço conhecido (`:282-294`) |
| 5   | Consequência: consumo **invisível** ao teto `AI_DAILY_*`                                                     | P0-17 / §14.6 / INV-006 / INV-013                                                       |

## 2. Escopo

**Dentro:** `src/lib/ai/budget-ledger.server.ts`, `src/lib/chat-execution.server.ts`, `src/instrumentation/telemetry.ts`, **novo** módulo puro `src/lib/ai/token-usage.ts`, testes unitários novos.
**Fora (explícito):** qualquer migration; qualquer arquivo de trilho A–D do ciclo 6; `e2e/`; `.github/workflows/**`; `src/db/schema.ts`.

**Arquivos bloqueados que esta missão NÃO toca (verificado):** `src/test/products-fk-conflict.test.ts` (trilho B), `scripts/db/test-products-fk-conflict.ts` (B), `scripts/e2e/seed-auth.ts` (A), `scripts/db/test-ai-budget.ts` (**A**), `scripts/m02-matrix.ts` (C), `scripts/lib/m02-transaction-sites.ts` (C), `e2e/**` (D), `.github/workflows/ui-stack.yml`.

> **Restrição de desenho derivada disso:** `settle(usageId, realTokens: number, …)` **preserva a compatibilidade** para chamadas numéricas existentes — os 10 call sites de teste (2 em `src/test/ai-estimated-cost.test.ts`, 8 em `scripts/db/test-ai-budget.ts` — **arquivo bloqueado**) continuam compilando e comportando-se **byte a byte** igual. O caminho novo é aditivo.

## 3. Nenhuma migration é necessária (verificado)

| coluna                 | estado real                                                                                      | suficiente para a variante B?                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `ai_usage.real_tokens` | `integer("real_tokens")` — **nulável**; CHECK `is null or >= 0` (`src/db/schema.ts:803,815-816`) | ✅ `NULL` já é aceito                                                                                                     |
| `ai_usage.outcome`     | `text("outcome")` — nulável, **sem CHECK** (`:804`)                                              | ✅ aceita `usage_unknown`                                                                                                 |
| `ai_usage.status`      | CHECK limita a `('reserved','settled','expired')` (`:811`)                                       | ⚠️ **não** criar estado novo ⇒ o desconhecido fica `status='settled'` + `real_tokens IS NULL` + `outcome='usage_unknown'` |

**Zero migration ⇒ zero risco de coordenação com os trilhos em voo.**

## 4. Especificação comportamental

Novo módulo puro `src/lib/ai/token-usage.ts`:

```ts
export type TokenUsage =
  | { kind: "known"; inputTokens: number; outputTokens: number }
  | { kind: "unknown"; reason: "absent" | "partial" | "invalid" };

export function parseAiUsage(raw: unknown): TokenUsage;
```

Schema Zod exigido (INV-014 — validação runtime de entrada externa):

```ts
const aiUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
});
```

`z.number()` rejeita `NaN`; `.int()` rejeita `Infinity` e float; `.nonnegative()` rejeita negativo; string/objeto malformado falha no parse.

| caso | entrada                                                     | `kind`               | razão                          |
| ---- | ----------------------------------------------------------- | -------------------- | ------------------------------ |
| 1    | `usage` ausente/`null`                                      | `unknown`            | `absent`                       |
| 2    | `usage` presente, um dos campos ausente                     | `unknown`            | `partial`                      |
| 3    | string / negativo / `NaN` / `Infinity` / float / malformado | `unknown`            | `invalid`                      |
| 4    | `{prompt_tokens: 0, completion_tokens: 0}`                  | **`known`** (0,0)    | — (zero explícito é conhecido) |
| 5    | `{prompt_tokens: 120, completion_tokens: 35}`               | **`known`** (120,35) | —                              |

**Proibição dura:** nenhum caminho pode produzir `known` a partir de ausência/ inválido.

## 5. Comportamento do `settle`

Assinatura estendida (aditiva, retrocompatível):

```ts
settle(usageId: string, usage: number | TokenUsage, outcome: string, options?: SettleOptions)
```

| caminho                | `real_tokens` | `outcome`           | `status`  | `tokens_reserved`                   | contadores diários      | `in_flight` |
| ---------------------- | ------------- | ------------------- | --------- | ----------------------------------- | ----------------------- | ----------- |
| numérico (legado)      | valor         | o do chamador       | `settled` | `- budgetTokens` (inalterado)       | incrementa (inalterado) | `-1`        |
| `known` (`TokenUsage`) | soma          | o do chamador       | `settled` | inalterado                          | incrementa              | `-1`        |
| **`unknown`**          | **`NULL`**    | **`usage_unknown`** | `settled` | **NÃO decrementa** (reserva retida) | **NÃO incrementa**      | `-1`        |

**Decisões declaradas (com justificativa):**

1. **`in_flight` é decrementado mesmo no desconhecido.** Mantê-lo incrementado seria afirmar que a chamada continua em voo (falso) e poderia bloquear reservas futuras do tenant. O que se retém é a **reserva de tokens**, não o "em voo".
2. **`tokens_reserved` é retido** ⇒ o orçamento permanece consumido: o erro cai para o lado **seguro** (superestimar em vez de subestimar). Trade-off declarado: cada evento desconhecido retém `conservativeTokenBudget` até uma reconciliação — **follow-up** (job de reconciliação), com a métrica de alarme tornando o vazamento visível.
3. **`outcome = 'usage_unknown'`** segue o precedente da coluna (`ttl_expired`, `chat_limit`, `budget_limit` já são razões, não resultados de fluxo). Trade-off declarado: o resultado do fluxo (`success`/`tool_round`/`error_*`) **não é perdido** — vai no alarme estruturado (§6).
4. **Nenhuma afirmação de custo**: no desconhecido, `estimateModelCost` **não** é chamado com zeros fabricados; `costStatus: "unknown"`, `estimatedCost: null` (reusa o status `unknown` que já existe em `EstimatedCostResult`).

## 6. Observabilidade (alarme auditável)

- **Nova métrica:** `app.ai.usage_unknown_total` (`applicationMetrics.aiUsageUnknownTotal`), com atributos `reason` (`absent|partial|invalid`).
- **Reuso:** `app.ai.cost_unknown_total` (`aiCostUnknownTotal`) já existe e passa a ser emitido também no caminho desconhecido.
- **Evento estruturado** (`logJson`, nível `warn`) `ai.usage_unknown` com: `usageId`, `reason`, `flowOutcome`, `model`, `round`, e o `correlationId` que o logger já anexa. **Nunca** logar: prompt, token, connection string, PII.
- Registro de métrica **guardado** (try/catch), como no caminho existente (`:516-528`) — telemetria não quebra o settle.

## 7. Testes mínimos (S4)

**Unit — `src/test/token-usage.test.ts` (novo):** os 5 casos da §4 + falsificações:

- [ ] `usage` ausente ⇒ `unknown/absent` (nunca `known`).
- [ ] `{prompt_tokens: 10}` ⇒ `unknown/partial`.
- [ ] `{prompt_tokens: -1}` · `"10"` · `NaN` · `Infinity` · `1.5` ⇒ `unknown/invalid`.
- [ ] `{0,0}` ⇒ `known(0,0)` (zero explícito preservado).
- [ ] `{120,35}` ⇒ `known(120,35)`.
- [ ] **falsificação:** reintroduzir `?? 0` faz o teste falhar.

**Unit — `src/test/ai-usage-unknown.test.ts` (novo, ledger com dublê):**

- [ ] `settle(usageId, {kind:'unknown'}, …)` persiste `real_tokens = NULL` e `outcome='usage_unknown'`.
- [ ] não incrementa `input_tokens`/`output_tokens`/`tool_call_count`.
- [ ] **não** decrementa `tokens_reserved`.
- [ ] `in_flight` decrementado.
- [ ] emite `ai.usage_unknown` e a métrica.
- [ ] caminho numérico legado permanece idêntico (regressão).

**DB (bloqueado nesta sessão — Docker indisponível):** os testes de `scripts/db/test-ai-budget.ts` (arquivo bloqueado) **não serão editados**; a verificação de banco fica **declarada como NÃO EXECUTADA**, não como verde.

## 8. DoD

- [x] Ausência nunca vira zero · [x] inválido nunca vira zero · [x] zero explícito segue zero
- [x] `real_tokens = NULL` para desconhecido · [x] `outcome='usage_unknown'` persistido
- [x] reserva não liberada como zero · [x] contadores não incrementados
- [x] alarme/métrica emitida · [x] validação runtime (Zod)
- [x] testes cobrem as bordas · [ ] evidência selada · [x] nenhum arquivo bloqueado tocado
- [ ] **land apenas após B1 + aprovação explícita**

## 9. Riscos e rollback

| risco                                         | mitigação                                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Reserva retida acumular (vazamento de budget) | métrica de alarme + follow-up de reconciliação; direção do erro é segura                                                                  |
| Alarme sem estado persistente                 | o estado **é** persistido (`real_tokens IS NULL` + `outcome`), satisfazendo a regra adversarial "não aceitar alarme sem estado auditável" |
| Regressão no caminho conhecido                | assinatura aditiva; testes de regressão do caminho legado                                                                                 |
| Verdade do gateway omitir `usage`             | **não provada**; a correção é preventiva e não altera o caminho feliz                                                                     |

**Rollback:** reverter os commits da missão — nenhuma migration, nenhum estado de banco novo ⇒ rollback é `git revert`, sem janela de dados.
