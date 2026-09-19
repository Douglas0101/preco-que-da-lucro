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
