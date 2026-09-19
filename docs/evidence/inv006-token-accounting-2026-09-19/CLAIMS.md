# CLAIMS — INV-006 / contabilização de tokens de IA (variante B)

**Missão:** `mission/inv006-token-accounting` · **Base:** `a69a47e` · **Data:** 2026-09-19
**Estado:** `READY_TO_LAND_BLOCKED` — implementação e verificação concluídas; **land bloqueado** até B1 + aprovação explícita.

Cada claim abaixo tem camada, evidência e reprodução. Nenhum claim foi aceito sem execução.

| #   | claim                                                                                                   | camada       | evidência                                                                                                                                | reprodução                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| C1  | Uso de tokens **desconhecido** (ausente/parcial/inválido) nunca é classificado como conhecido           | unidade      | `src/lib/ai/token-usage.ts:44-58` · `src/test/token-usage.test.ts` (8 testes, 32 asserções)                                              | `npx vitest run src/test/token-usage.test.ts` → 8 passed                                                              |
| C2  | Zero **explícito** (`{0,0}`) continua conhecido e liquida com `real_tokens = 0`                         | unidade      | `src/test/token-usage.test.ts` (caso 4) · `src/test/ai-usage-unknown.test.ts` (último caso)                                              | idem → asserção `boundTo(claim, "real_tokens") === 0`                                                                 |
| C3  | No caminho desconhecido o ledger grava `real_tokens = NULL` e `outcome = 'usage_unknown'`               | persistência | `budget-ledger.server.ts:660-668` · `src/test/ai-usage-unknown.test.ts`                                                                  | asserção **posicional** do parâmetro (`boundTo`) → `null` / string                                                    |
| C4  | No caminho desconhecido a reserva **não** é liberada e os contadores de token **não** são incrementados | persistência | `budget-ledger.server.ts:687-706` · `src/test/ai-usage-unknown.test.ts`                                                                  | asserção negativa no SQL: ausência de `tokens_reserved = tokens_reserved -` e de `input_tokens +` / `output_tokens +` |
| C5  | `in_flight` continua sendo decrementado (a chamada terminou; não está mais em voo)                      | persistência | idem C4                                                                                                                                  | asserção positiva `in_flight = in_flight - 1`                                                                         |
| C6  | O caminho numérico **legado** permanece byte-equivalente (release da reserva + incrementos)             | regressão    | `src/test/ai-usage-unknown.test.ts` (caso de regressão) + `src/test/ai-estimated-cost.test.ts` (18 testes, intactos)                     | `npx vitest run` nos dois arquivos → verde                                                                            |
| C7  | Um `TokenUsage` conhecido usa os valores **medidos**, ignorando `options.inputTokens/outputTokens`      | unidade      | `src/test/ai-usage-unknown.test.ts` (caso "usa os valores medidos")                                                                      | asserção de que `999` (options) não aparece nos parâmetros                                                            |
| C8  | O custo estimado **não** é afirmado como "known 0" quando o uso é desconhecido                          | código       | `chat-execution.server.ts:521-524` (`est = {cost:null, status:"unknown"}` sem chamar o estimador)                                        | leitura dirigida + mutação (ver ADVERSARIAL A4)                                                                       |
| C9  | Nenhum arquivo dos trilhos A–D do ciclo 6 foi tocado                                                    | contenção    | `captures/diff-and-matrix.txt` (6 arquivos, todos fora dos trilhos)                                                                      | `git status --porcelain` contra a lista de arquivos bloqueados                                                        |
| C10 | O gate local completo fica **verde** com a mudança                                                      | integração   | `captures/gate-check.txt` (`npm run check EXIT=0`; bundle 473.230 B inalterado)                                                          | `npm run check` (sem pipe — exit code real)                                                                           |
| C11 | A suíte completa **executou** os testes novos (sem skip silencioso disfarçado)                          | integração   | `captures/gate-check.txt:365-366` → **87 arquivos / 852 passaram · 13 skipped**; 838 (baseline medida por terceiro) + **14** novos = 852 | `grep -E 'Test Files\|Tests ' captures/gate-check.txt`                                                                |

> **Sobre os 13 skipped:** são exatamente os testes de banco que exigem `DATABASE_URL_UNPOOLED`, ausente em
> workflow algum — o achado `ERRATA-1` / `F-D2-runner-failopen`, **pré-existente**. Não é regressão desta missão:
> eram 13 antes e continuam 13. Um log **truncado** de execução interrompida foi **removido** do selo em vez de
> versionado como se fosse suíte completa.

## Notas de honestidade

- **A verdade do gateway real não foi observada.** Não se afirma que o gateway omite `usage`; afirma-se que,
  _se_ omitir, o sistema deixa de registrar consumo e o teto deixa de ser enforçável. H-6 (tráfego) continua aberto.
- **`outcome` é sobrescrito com `usage_unknown`** no caminho desconhecido, seguindo o precedente da coluna
  (`ttl_expired`, `chat_limit`, `budget_limit`). O resultado do fluxo (`success`/`tool_round`/`error_*`) **não se perde**:
  vai no evento estruturado `ai.usage_unknown` (`flowOutcome`).
- **Reserva retida é um trade-off declarado**: erra para o lado seguro (superestimar consumo) e mantém a
  contabilidade honesta; o vazamento é visível pela métrica `app.ai.usage_unknown_total`. Reconciliação é follow-up.

---

## Adendo — prova em PostgreSQL 17 real (2026-09-19)

Ambiente: container efêmero `inv006-pg` (`postgres:17-alpine`, **PostgreSQL 17.11**) em `127.0.0.1:5433`.
O `:5432` **não foi tocado** (contém dado não-fixture — H-9 aberto). As três URLs exigidas
(`DATABASE_URL`, `DATABASE_ADMIN_URL`, `DATABASE_URL_UNPOOLED`) apontaram para loopback.

| #   | claim                                                                                                                                          | evidência                                                                    | reprodução                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| C12 | `ai_usage.real_tokens` aceita **`NULL`** pelo driver real, e a CHECK `is null or >= 0` não bloqueia a linha                                    | `captures/db-test-unknown-path.txt` (caso 1, `real_tokens` lido como `null`) | `npx tsx scripts/db/test-ai-usage-unknown.ts` → EXIT 0 |
| C13 | No desconhecido, `tokens_reserved` **permanece retido**, `input_tokens`/`output_tokens` **não** avançam e `in_flight` decrementa               | idem (asserções sobre `ai_daily_budgets`)                                    | idem                                                   |
| C14 | O caminho conhecido e o numérico legado continuam liberando a reserva e contando os tokens medidos                                             | idem (casos 2 e 3)                                                           | idem                                                   |
| C15 | A suíte `db:test` completa (**15 passos**, 48 marcas `OK`) fica **verde** no HEAD corrigido, com a prova-FK em **`13 passed (13), 0 skipped`** | `captures/db-test.txt` (`DB_TEST_EXIT=0`)                                    | `npm run db:test` com as três URLs em loopback         |
| C16 | Os guards do script **recusam** rodar sem URL e contra host remoto, **antes** de abrir conexão                                                 | executado nesta sessão (sem `ENOTFOUND`/`ECONNREFUSED`)                      | sem URL ⇒ EXIT 1; host remoto ⇒ EXIT 1                 |

> **Nota sobre `requireAdminUrl`:** ele verifica **presença**, não loopback. Como este script é invocado por
> `npx tsx` (sem o pre-hook do `env-guard`), ele traz o **próprio** guard de loopback — mesma disciplina do land
> D2. Sem isso, uma `DATABASE_ADMIN_URL` remota seria aceita e o script poderia tocar produção.

## Defeito encontrado pelo gate de banco (e corrigido)

A primeira execução de `db:test` **reprovou** em `T3/E3` (`actual: 100, expected: 0`) — e a causa era **deste WP**:

- `T3/E3` faz o `modelCaller` **lançar** `AI_TIMEOUT`; a linha que atribui `usage` nunca executava, então a variável
  mantinha o valor inicial `{ kind: "unknown" }` e a liquidação passava a **reter a reserva** (100) em vez de
  liberá-la, trocando também `outcome` de `error_ai_timeout` para `usage_unknown`.
- **Causa-raiz:** o WP conflacionava duas situações distintas — _"o gateway respondeu e o `usage` não era
  utilizável"_ (desconhecido real) e _"a chamada falhou antes de medir"_ (contrato legado da falha).
- **Correção:** `usage` passa a ser `TokenUsage | null`, com `null` = **nenhuma resposta recebida**; nesse caso a
  liquidação volta a ser a legada (`0`, libera a reserva, outcome do erro) e o estimador de custo é alimentado com
  zero exatamente como antes.
- **Valor da prova:** nenhum teste unitário pegou isso (o dublê exercita o ledger, não o caminho de erro do
  `chat-execution`); foi a **suíte de banco existente** que pegou. Log da falha preservado em
  `captures/db-test-FAILED-E3-regression.txt`.
- **Fronteira declarada:** `usage === null` (falha) mantém o contrato antigo — inclusive o custo estimado com zero.
  Alterar isso seria mudança de produto com outra análise (uma chamada que expira pode ter consumido tokens no
  provedor) e está **fora do escopo** deste WP.
