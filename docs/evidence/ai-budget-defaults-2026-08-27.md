# Q-005 — defaults do orçamento de IA

Registro técnico da decisão do agente para Q-005, após a auditoria ambiental F1-2 e a
implementação F2-3. Este documento não contém credenciais, endpoints reais ou conteúdo de
mensagens.

## Valores efetivos

| Variável                               |   Default | Papel                                  | Evidência de implementação                                  |
| -------------------------------------- | --------: | -------------------------------------- | ----------------------------------------------------------- |
| `AI_DAILY_MODEL_CALL_LIMIT_PER_TENANT` |     `500` | máximo diário de model rounds          | `src/lib/ai/budget-ledger.server.ts`, `budgetConfigFromEnv` |
| `AI_DAILY_TOKEN_LIMIT_PER_TENANT`      | `1500000` | teto diário de tokens reais + reservas | `src/lib/ai/budget-ledger.server.ts`, `budgetConfigFromEnv` |
| `AI_DAILY_CHAT_LIMIT_PER_TENANT`       |     `200` | limite diário de chats já existente    | `src/lib/ai/budget-ledger.server.ts`, `budgetConfigFromEnv` |
| `AI_IN_FLIGHT_LIMIT_PER_TENANT`        |       `2` | chamadas de modelo simultâneas         | `src/lib/ai/budget-ledger.server.ts`, `reserveAtomic`       |
| `AI_CONSERVATIVE_TOKEN_BUDGET`         |   `64000` | reserva conservadora por model round   | `src/lib/ai/budget-ledger.server.ts`, `reserveAtomic`       |
| `AI_BUDGET_RESERVATION_TTL_MS`         |  `120000` | TTL para recuperar reservas órfãs      | `src/lib/ai/budget-ledger.server.ts`, `sweepOrphans`        |

## Justificativa

- `AI_DAILY_CHAT_LIMIT_PER_TENANT=200` preserva o limite diário observado na auditoria
  ambiental; `AI_CHAT_LIMIT_PER_10_MINUTES=20` continua sendo o limite de janela curta.
- `500` rounds e `1500000` tokens fornecem limites diários explícitos para a reserva,
  sem alterar o billing do provedor. O teto de tokens considera tokens já liquidados e
  tokens reservados, portanto um burst não pode ultrapassar o orçamento por corrida.
- `2` slots em voo é o limite conservador que mantém a pressão de concorrência bounded por
  tenant enquanto o gateway continua externo.
- `64000` é o teto conservador por round usado antes do gateway; o valor é debitado na
  reserva e devolvido na liquidação/expiração, evitando admissão baseada em estimativa
  otimista.
- `120000` ms fornece janela bounded para chamadas legítimas e permite que um novo request
  recupere contador de um processo morto por meio do sweep lazy por tenant. O código
  também rejeita/faz fallback para valores abaixo de `120000` ms: o limite é duas vezes
  o timeout máximo de request de 60 s, evitando que uma chamada viva seja expirada.

Os valores são validados como inteiros positivos e podem ser substituídos por env. A
interface pública do ledger recebe configuração e clock injetáveis para os testes de
contrato. `.env.example` não foi alterado para cumprir a proibição do mandato v3 sobre
commits `.env*`; os nomes e defaults estão documentados no código, neste registro e no
`EXECUTION-STATE.md`.

## Verificação

- T1–T10 passaram contra PostgreSQL 17 local via `node-postgres`.
- T-CN reproduziu o race no baseline sem fix (`gateway=20`) e T1 confirmou uma invocação
  com o fix.
- Nenhum endpoint Neon real foi usado; o segundo caminho é coberto pelo contract adapter
  da interface, conforme H-003/Q-008.
- T8 também verifica o fallback ambiental e a rejeição de override abaixo do TTL mínimo
  seguro.
