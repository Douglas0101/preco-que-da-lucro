# Escalação de defeito — INV-006 no orçamento de IA (tokens) · 2026-09-19

**Status:** **CONFIRMADO como violação de INV-006 no código** · exploitability em produção **não provada**
**Classificação proposta:** defeito de classe **P0** (P0-17 quota/budget da IA · §14.6 · OWASP A4)
**Ação pedida:** decisão humana sobre entrada na fila e posição na ordem (não implementado — a fila de código está congelada até a reconciliação B1)

> **Origem:** achado da verificação adversarial do §41 (`ERRATA-4` do ledger). O MAESTRO pediu: _"se confirmado como violação de INV-006, escalar para P0; não deixar diluir em follow-up genérico"_. Esta é a confirmação, com a fonte.

## 1. INV-006 em disputa

> **INV-006 — "Unknown não é zero."** (Plano Mestre §3; é invariante **de programa**, não restrita ao domínio financeiro.)

## 2. Cadeia de evidência (medida no HEAD `de8c232`)

**(a) O tipo declara que `usage` pode faltar — e nada valida em runtime.**

```ts
// src/lib/chat-execution.server.ts:49-57
interface GatewayResponse {
  choices: Array<{ message: { content?: string | null; tool_calls?: GatewayToolCall[] } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number }; // ← opcional, e cada campo também
}
```

`GatewayResponse` é uma `interface` TypeScript: **apagada em runtime**. Não há Zod/`safeParse` validando a
resposta do gateway (o `safeParse` existe para _tools e saída de tool_, não para o envelope do modelo).

**(b) O código converte a ausência em zero.**

```ts
// src/lib/chat-execution.server.ts:486-488
inputTokens = modelResponse.usage?.prompt_tokens ?? 0;
outputTokens = modelResponse.usage?.completion_tokens ?? 0;
realTokens = inputTokens + outputTokens;
```

**(c) O zero é persistido como consumo real e libera a reserva.**

```ts
// src/lib/ai/budget-ledger.server.ts:646 (settle)
real_tokens = ${realTokens}
// :666-667 (contadores diários do tenant)
input_tokens  = input_tokens  + ${breakdown.inputTokens},
output_tokens = output_tokens + ${breakdown.outputTokens},
// :664 (a reserva volta integralmente)
tokens_reserved = tokens_reserved - ${budgetTokens},
```

**(d) O consumo é o que o limite de quota observa** (`AI_DAILY_*`), logo uma chamada com `usage` ausente é
**invisível para o orçamento** — e a reserva é devolvida como se nada tivesse sido gasto.

**(e) A ironia verificável:** o próprio system prompt do chat enuncia a invariante que o código ao lado viola:

```
// src/lib/chat-execution.server.ts:64
3) Nunca invente preço, custo, alíquota ou imposto. Ausência continua ausente, nunca zero.
```

## 3. Veredito, com o dimensionamento honesto

| dimensão                             | veredito                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Violação da invariante no código** | **CONFIRMADA.** O valor é _desconhecido_ (o tipo admite ausência; não há guarda) e é **escrito como 0**, não como "desconhecido". Não é um `?? 0` defensivo em caminho inalcançável: é o **único** tratamento do campo.                                                                                         |
| **Alcance em produção**              | **NÃO PROVADO.** Gateways OpenAI-compatible normalmente devolvem `usage`. Não observei o gateway real (sem tráfego; H-6 aberto) nem encontrei caminho que force a ausência. A falha é **latente e condicional**.                                                                                                |
| **Classe de risco**                  | **Alta se materializada:** subcontagem **silenciosa** de um controle de custo/quota — exatamente o padrão que o §14.6 cita (OWASP API4:2023, consumo irrestrito de recursos). Viola também a classe do **INV-013** ("erro não vira sucesso vazio"), porque o settle **sucede** com um número que não mede nada. |
| **Escopo do dano**                   | Por tenant/dia: o teto `AI_DAILY_*` deixa de ser enforçável; o custo estimado (`estimated_cost`) herda o mesmo zero.                                                                                                                                                                                            |

## 4. Correção proposta (não implementada — aguarda decisão de fila)

Não é "usar um default": é **não afirmar um número que não se tem**. Duas variantes:

| variante                    | comportamento                                                                                                                               | trade-off                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **(A) falhar alto**         | `usage` ausente ⇒ settle **não** grava `real_tokens = 0`; marca o settle como `usage_unknown` e **mantém a reserva** (ou lança erro tipado) | alinhada ao INV-013; risco de transformar indisponibilidade do gateway em erro de produto          |
| **(B) marcar desconhecido** | persistir `real_tokens = NULL` + `outcome = 'usage_unknown'` e **não** liberar a reserva como consumo zero                                  | preserva a operação e mantém a contabilidade honesta; exige coluna nulável + revisão dos agregados |

**Preferência registrada: (B), com o alarme de (A)** — manter a operação, mas nunca registrar 0 como se fosse medição, e emitir métrica/log quando ocorrer. Qualquer variante exige: teste de regressão com gateway que **omite** `usage` (hoje inexistente) e verificação de que os agregados diários não passam a somar `NULL` como 0.

## 5. O que esta escalação NÃO afirma

- Não afirma que o gateway real omite `usage` — isso exigiria tráfego real (bloqueado por H-6).
- Não afirma impacto financeiro ao usuário: o dano é de **controle de custo/quota**, não de valor cobrado.
- Não foi implementada: a fila de código está **congelada** até a reconciliação do ciclo 6 (B1), por decisão do MAESTRO.

---

# Follow-up rastreado · `F-D2-runner-failopen` (lado vitest) — especificação

**Pedido do MAESTRO:** _"definir `DATABASE_URL_UNPOOLED` no env da CI pesada para os testes de banco pararem de skippar em silêncio. Hoje eles dão falso conforto."_

**Estado medido hoje:** `src/test/product-contracts.test.ts:177-183` e `src/test/products-fk-conflict.test.ts:243-247` dependem de
`isLoopbackUrl(process.env.DATABASE_URL_UNPOOLED)`; o job de `ui-stack.yml` **não** define essa variável
(`grep -rn DATABASE_URL_UNPOOLED .github/` ⇒ **0 hits**) e não há mapeamento `${{ vars.* }}` ⇒ **13 testes skippam**.

**Mudança necessária (1 linha, no bloco `env:` do job — hoje `ui-stack.yml:34-44`):**

```yaml
DATABASE_URL_UNPOOLED: >-
  postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test
```

**Cuidados obrigatórios antes de ligar (senão troca-se falso conforto por CI vermelho):**

1. Os testes passam a **executar** de verdade — validar localmente contra **container PG17 efêmero** antes de publicar.
2. Não afrouxar a guarda `isLoopbackUrl`: a variável precisa apontar para `127.0.0.1` (o `env-guard` recusa remoto por desenho).
3. Verificar que os 13 testes **não** dependem de fixture ausente na CI (semear/verificar como o `db:test` faz).
4. Assertar que **executaram** (não apenas que a suíte ficou verde): `numTotalTests >= N` ou equivalente — o mesmo remédio do `F-D2-runner-failopen` no runner encadeado.
