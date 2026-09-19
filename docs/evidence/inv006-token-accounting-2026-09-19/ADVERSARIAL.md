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
2. ~~**Sem verificação de banco real.**~~ **RESOLVIDO em 2026-09-19** (adendo abaixo): o Docker subiu e a
   verificação foi executada contra **PostgreSQL 17.11** real.
   ~~Riscos residuais não cobertos: comportamento do driver ao **vincular `NULL`** em `real_tokens`; a CHECK
   `ai_usage_real_tokens_check` (`is null or >= 0`) contra `NULL` real; e o caminho `settle` sobre um banco PG17.~~
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

---

## Adendo — a suíte de banco como adversarial (2026-09-19)

| #   | hipótese a falsificar                                                     | como foi testada                                         | resultado medido                                                    | veredicto                                         |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- |
| A7  | "a correção não quebra nenhum contrato existente"                         | `npm run db:test` (**15 passos**) contra PG17 real       | **FALHOU** em `T3/E3` (`actual: 100, expected: 0`)                  | **REJECTED** — o WP tinha defeito real            |
| A8  | "o defeito de A7 é visível sem banco"                                     | suíte unitária dirigida (32 testes) e `npm run check`    | **passaram** antes e depois ⇒ o defeito era **invisível sem banco** | **CONFIRMED** (o gate de banco era indispensável) |
| A9  | "o `settle` grava `NULL` sem lançar no driver real"                       | prova nova, caso 1, com leitura da linha persistida      | `real_tokens = null`, `outcome = usage_unknown`, `applied = true`   | **CONFIRMED**                                     |
| A10 | "o desconhecido libera a reserva"                                         | prova nova, caso 1, `ai_daily_budgets.tokens_reserved`   | permanece **1000** (retida)                                         | **REJECTED** (não libera)                         |
| A11 | "os testes de banco existentes continuam verdes com a assinatura aditiva" | `db:test` passa por `test-ai-budget.ts` **sem editá-lo** | `DB_TEST_EXIT=0`                                                    | **CONFIRMED**                                     |
| A12 | "a prova-FK roda de fato (sem skip silencioso)"                           | saída do runner encadeado                                | `13 passed (13), 0 skipped — admin=127.0.0.1:5433`                  | **CONFIRMED**                                     |
| A13 | "o script poderia tocar produção por acidente"                            | execução com `DATABASE_ADMIN_URL` remota                 | recusado **antes** de conectar (sem `ENOTFOUND`/`ECONNREFUSED`)     | **REJECTED**                                      |

**Lição registrada:** o achado A7/A8 é o argumento empírico de por que o land **não podia** ser autorizado só com
unidade + dublê. A verificação adversarial mais forte não veio de uma mutação minha, e sim da **suíte de banco que
já existia** — exatamente o que o gate da Condição B foi desenhado para capturar.

## Limites que permanecem (após o adendo)

- **Sem agente adversarial independente** (mesma sessão do CODER) — o veredicto continua `ADVERSARIAL-LIMITED`.
- **Comportamento do gateway real não observado** (H-6): assume-se que ele _pode_ omitir `usage`; não se afirma que omite.
- **Reserva retida não exercitada sob concorrência** (dois `settle` simultâneos do mesmo `usage_id`).
- **Contrato da falha preservado por decisão** (`usage === null` ⇒ liquida com 0): se o produto quiser tratar
  timeout como uso possivelmente consumido, é **outro** WP, com análise própria.
