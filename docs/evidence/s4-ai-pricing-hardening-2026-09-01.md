# S4 — AI pricing hardening (fail-fast, redação, reserva R3)

Data: 2026-09-01 · Agent: A4 (step S4) · WS-05 follow-up
Refs: Plano §6.9 (API-001 taxonomia de erros), §14.6 (orçamento), §19.4 (sanitização
de logs), INV-006 (desconhecido ≠ zero), INV-014 (validação em runtime de tudo não-confiável).

## 1. Validação Zod em boot (fail-fast explícito, nunca silencioso)

`AI_MODEL_PRICING_JSON` agora é validada com Zod (`ModelPriceSchema` /
`ModelPricingSchema` em `src/lib/ai/budget-ledger.server.ts:214-221`):

- formato: objeto → nome de modelo (string 1..200) → `{ inputPerMillion,
outputPerMillion }` números finitos **não negativos**;
- **0 é aceito deliberadamente**: um modelo configurado como gratuito deve
  estimar `"0.0000"` com status `known` (preserva o teste/unit existente
  "zero by config"), enquanto negativo/NaN/Infinity/string/ausente falham —
  a distinção INV-006 (desconhecido ≠ zero) fica intacta;
- variável **ausente/vazia** → defaults conservadores documentados
  (config ausente ≠ config inválida; dev não precisa de nada configurado);
- variável **definida e inválida** → `modelTokenPricesFromEnv` **lança** com
  prefixo de código estilo API-001. Formas reais do erro (capturadas em
  execução):

  ```text
  CONFIG_ERROR: AI_MODEL_PRICING_JSON inválida — não é JSON válido. Corrija a variável ou remova-a para usar os preços padrão documentados.

  CONFIG_ERROR: AI_MODEL_PRICING_JSON inválida — formato inesperado (broken.inputPerMillion: Too small: expected number to be >=0). esperado {"<modelo>":{"inputPerMillion":<número finito ≥ 0>,"outputPerMillion":<número finito ≥ 0>}}

  CONFIG_ERROR: AI_MODEL_PRICING_JSON inválida — formato inesperado (<raiz>: Invalid input: expected record, received array). esperado {...}
  ```

- Mudança de comportamento intencional: `AI_MODEL_PRICING_JSON="{}"` agora
  retorna **mapa vazio** (todo custo fica `unknown`), não os defaults — o
  operador pediu explicitamente "sem preços"; reavivar defaults silenciosamente
  violaria INV-006/§6.9.
- O fallback silencioso anterior (descartar entradas inválidas uma a uma e/ou
  engolir `JSON.parse`) foi **removido** (`isPriceRecord` excluída).

## 2. Fio de boot (o app não sobe com config inválida)

`assertPricingConfigForBoot()` (`src/lib/ai/budget-ledger.server.ts:260-270`)
é chamado no topo do entry do servidor Nitro (`src/server.ts:5,10` — módulo
avaliado no boot do `node-server`, ver `vite.config.ts:11-13`). Sem dependências
novas além de zod (já no projeto).

Validação de boot executada (teste descartável, removido após rodar):

- `AI_MODEL_PRICING_JSON="not-json"` → `import("@/server")` **rejeita** com
  `/^CONFIG_ERROR: AI_MODEL_PRICING_JSON inválida/` (processo não sobe);
- variável ausente → import limpo (dev não quebra).

## 3. Redação §19.4 (preços nunca em logs)

- `SENSITIVE_KEY` ganhou `pricing` e `ai_model_pricing`
  (`src/lib/structured-logger.ts:2-5`). Cobre `aiModelPricing`,
  `AI_MODEL_PRICING_JSON` (substring `pricing`, case-insensitive), `pricing`,
  `ai_model_pricing` em qualquer profundidade do payload — verificado por
  teste de redação (`src/test/ai-estimated-cost.test.ts:186`).
- Verificado por grep que nenhum `logJson` existente carrega preços/objeto de
  pricing (zero ocorrências de `pricing|prices` nos campos dos chamadas).
- A mensagem de erro de boot **não ecoa valores**: issues do Zod mostram apenas
  caminho + tipo esperado ("received string"), nunca o número/string recebidos
  (assert "does not echo raw pricing values" no teste).

## 4. `ai_usage.tool_execution_id` — reservado para R3 (não escrito)

- Comentário de reserva em `src/lib/ai/budget-ledger.server.ts:47-50`
  (coluna nullable da migração 0009; orquestrador assume atribuição por-tool
  mais tarde; hoje o custo é por rodada de modelo — desvio intencional já
  documentado junto a `budgetCostSetterSql`).
- **Asserção unit via contrato in-memory do ledger**: `createCapturingLedger()`
  (`src/test/ai-estimated-cost.test.ts:198-241`) executa `reserveAtomic` +
  `settle` reais com um `TransactionManager` fake e renderiza o SQL via
  `PgDialect.sqlToQuery`; o teste em `:250` afirma que **nenhuma** instrução
  que toca `ai_usage` (INSERT da reserva nem UPDATE da liquidação) contém
  `tool_execution_id` → a coluna permanece NULL.

## 5. INV-006 reafirmado (regression note)

- Desconhecido continua ≠ zero em três camadas cobertas por teste:
  1. `estimateModelCost` sem preço/modelo nulo → `{cost: null, status: "unknown"}`;
  2. settle sem custo → SQL parametrizado com `estimated_cost = NULL`,
     `cost_status = 'unknown'` e `estimated_cost_unknown_count + 1`, sem
     incremento de `estimated_cost` (testes `:273` e `:295`);
  3. `"{}"` explícito → tudo `unknown` (item 1 acima).

## Arquivos alterados

| Arquivo                              | Linhas principais                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/ai/budget-ledger.server.ts` | 4 (import zod), 47-50 (reserva R3), 213-270 (schemas, `modelTokenPricesFromEnv` fail-fast, `assertPricingConfigForBoot`) |
| `src/server.ts`                      | 5, 7-10 (chamada de boot fail-fast)                                                                                      |
| `src/lib/structured-logger.ts`       | 2-5 (`pricing`, `ai_model_pricing` no regex sensível)                                                                    |
| `src/test/ai-estimated-cost.test.ts` | reescrito: 93-157 validação/throw, 159-184 boot, 186-196 redação, 198-316 contrato do ledger (R3 + INV-006)              |
| `.env.example`                       | 44-52 (exemplo `AI_MODEL_PRICING_JSON` + nota de defaults/redação)                                                       |

## Verificação

- `npx tsc --noEmit -p tsconfig.json` → limpo;
- `npx vitest run src/test/ai-estimated-cost.test.ts src/test/model-gateway.test.ts` → 21 testes passando;
- suíte completa `npx vitest run` → 34 arquivos / 353 testes passando;
- boot guard validado com import dinâmico de `@/server` (seção 2);
- `prettier --write` + `eslint` nos arquivos tocados → limpos.
