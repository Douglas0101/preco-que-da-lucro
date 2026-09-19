# VEREDICTO ADVERSARIAL — INV-006 / contabilização de tokens de IA

**Modo:** `ADVERSARIAL-LIMITED` (mesma sessão do CODER, sem agente independente) ⇒ **o land permanece bloqueado também por esta razão**, além de B1.
**Data:** 2026-09-19 · **Base:** `a69a47e` · **Método:** mutação do código + execução, não inspeção.

| #   | hipótese a falsificar                                                  | mutação executada                                                                       | resultado medido                                                      | veredicto                                       |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| A1  | "os testes novos passariam mesmo **sem** o fix"                        | `git stash push -- src/lib src/instrumentation` (código volta ao pai; testes mantidos)  | **5 testes falham** no arquivo de ledger (`ai-usage-unknown.test.ts`) | **CONFIRMED** (o teste tem poder discriminante) |
| A2  | "consigo fazer o desconhecido virar 0"                                 | `real_tokens = … : null` → `… : 0` em `budget-ledger.server.ts`                         | **2 testes falham** (asserção posicional do parâmetro)                | **REJECTED** (a mutação é detectada)            |
| A3  | "consigo remover a guarda de validação sem quebra"                     | `if (!parsed.success) return {kind:"unknown",reason:"invalid"}` → `{kind:"known", 0,0}` | **2 testes falham** em `token-usage.test.ts`                          | **REJECTED**                                    |
| A4  | "consigo liberar a reserva tratando desconhecido como conhecido"       | `settlement.kind === "known" ? [` → `true ? [`                                          | **3 testes falham**                                                   | **REJECTED**                                    |
| A5  | "consigo contar tokens desconhecidos como zero nos contadores diários" | coberto por A4 (mesma cláusula) + asserção negativa em C4                               | detectado                                                             | **REJECTED**                                    |
| A6  | "o teste de zero explícito é indistinguível do desconhecido"           | inspeção dirigida: `{0,0}` → `known`; `undefined` → `unknown`                           | casos separados e ambos asseridos (C2 vs C1)                          | **REJECTED**                                    |

## Limites declarados (o que esta verificação NÃO cobre)

1. **Sem agente adversarial independente.** As mutações foram executadas pelo mesmo autor do código:
   reduz o valor probatório. Mitigação: toda mutação foi medida por **execução** (RED observado), não por leitura.
2. **Sem verificação de banco real.** O daemon Docker está **indisponível** nesta sessão ⇒ `db:test` **não foi executado**.
   Riscos residuais não cobertos: comportamento do driver ao **vincular `NULL`** em `real_tokens`; a CHECK
   `ai_usage_real_tokens_check` (`is null or >= 0`) contra `NULL` real; e o caminho `settle` sobre um banco PG17.
   Os testes de banco existentes (`scripts/db/test-ai-budget.ts`) **não foram editados** por serem de trilho bloqueado.
3. **A omissão de `usage` pelo gateway real não foi observada** — depende de tráfego (H-6).
4. **A reserva retida não foi exercitada sob concorrência** (dois settles simultâneos do mesmo `usage_id`).

## Superfície de risco residual (para o supervisor ponderar)

- O caminho desconhecido **retém** `conservativeTokenBudget` (64.000 tokens por padrão) por evento. Sem job de
  reconciliação, N eventos desconhecidos consomem o teto diário do tenant sem consumo real correspondente —
  **falha segura** (bloqueia, não libera), mas com impacto de disponibilidade se o gateway oscilar. Recomendação:
  follow-up de reconciliação antes de ligar em produção com tráfego real.
- `tool_call_count` **é** incrementado no caminho desconhecido (valor medido em `choices`, não derivado de `usage`).
  Direção segura; declarado porque o §5 da spec lista "não incrementar contadores" de forma ampla.
