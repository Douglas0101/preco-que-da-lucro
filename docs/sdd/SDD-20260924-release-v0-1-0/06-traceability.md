# 06 — Rastreabilidade

Regra: cada linha contém um identificador, uma evidência observável ou explicitamente pendente, e uma ação. `done` só é permitido quando todos os requisitos de `07-evidence.md` estiverem satisfeitos. Nesta tarefa, nenhum teste executável foi produzido e nenhuma execução do SHA final é citada; portanto os itens observados ficam `partial` ou `blocked`.

## Os 17 P0 do §36

| ID        | P0 canônico                                           | Evidência/ponteiro observado                                                    | Estado    | Ação de release                                                          |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------ |
| **P0-01** | XSS                                                   | `src/lib/chat-markdown.tsx`; `src/test/chat-markdown.test.tsx`                  | `partial` | executar teste de regressão no SHA exato e selar                         |
| **P0-02** | Result Type financeiro                                | `src/lib/finance.ts`; golden/boundaries/required-sales tests                    | `partial` | executar suítes financeiras e verificar semântica de estado              |
| **P0-03** | unknown ≠ zero                                        | `src/lib/finance.ts`; `finance.boundaries.test.ts`                              | `partial` | provar que desconhecido nunca é convertido em zero                       |
| **P0-04** | NaN/Infinity                                          | `src/lib/finance.ts`; `finance.boundaries.test.ts`                              | `partial` | provar fronteiras finitas e ausência de NaN/Infinity                     |
| **P0-05** | volume fictício                                       | `src/lib/finance.ts`; testes de fronteiras e vendas                             | `partial` | provar que cenário sem volume real não é apresentado                     |
| **P0-06** | markup arbitrário (`custo × 1,5`)                     | `src/lib/finance.ts`; testes financeiros                                        | `partial` | provar remoção do markup arbitrário e preservar preço configurado        |
| **P0-07** | rendimento default                                    | `src/lib/finance.ts`; testes financeiros                                        | `partial` | demonstrar default somente quando permitido, nunca silencioso            |
| **P0-08** | imposto default                                       | `src/lib/finance.ts`; testes financeiros                                        | `partial` | demonstrar default somente com origem e incerteza explícitas             |
| **P0-09** | validar unidades (conversão incompatível)             | `src/lib/finance.ts`; `finance.boundaries.test.ts`                              | `partial` | executar conversão incompatível e rejeitar unidade inválida              |
| **P0-10** | tool Zod                                              | `src/lib/ai/tool-registry.ts`; `src/test/tool-registry.test.ts`                 | `partial` | provar validação runtime com entrada malformada                          |
| **P0-11** | error taxonomy                                        | `src/lib/api-error.ts`; `src/test/api-error-contract.test.ts`                   | `partial` | provar status/código/mensagem e não-vazamento                            |
| **P0-12** | auth por endpoint                                     | `src/server/auth/auth-policy.ts`, `auth.server.ts`; testes de auth              | `partial` | provar autorização server-side em cada endpoint privado                  |
| **P0-13** | sessão server-driven (remover tokens de localStorage) | `src/server/auth/auth.server.ts`; `src/test/auth-policy.test.ts`                | `partial` | inspecionar ausência de token sensível no cliente e provar cookie seguro |
| **P0-14** | persistir conversation state                          | `src/lib/chat-execution.server.ts`, `src/lib/chat.functions.ts`; testes de chat | `partial` | provar persistência e recuperação após reload                            |
| **P0-15** | tool execution audit                                  | `src/lib/ai/tool-runner.ts`; `src/test/tool-runner.persistence.test.ts`         | `partial` | provar registro de execução e correlação sem segredo                     |
| **P0-16** | timeout da IA                                         | `src/lib/chat-execution.server.ts`; testes de chat/latência                     | `partial` | executar caso de timeout e confirmar estado/erro explícito               |
| **P0-17** | quota/budget da IA                                    | `src/lib/ai/budget-ledger.server.ts`; testes de budget/chat                     | `partial` | provar concorrência, reserva, release e limite de consumo                |

## Gate §41

| Gate       | Condição                                  | Evidência/ponteiro                                                              | Estado    | Ação                                                         |
| ---------- | ----------------------------------------- | ------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| **G41-01** | XSS regression test verde                 | teste de markdown citado acima; execução não produzida nesta tarefa             | `partial` | rodar e registrar saída no SHA final                         |
| **G41-02** | unknown nunca vira zero                   | teste financeiro de boundaries citado                                           | `partial` | executar regressão                                           |
| **G41-03** | NaN/Infinity nunca viram zero             | teste financeiro de boundaries citado                                           | `partial` | executar regressão                                           |
| **G41-04** | cenário sem volume real não é apresentado | testes de finanças citados                                                      | `partial` | executar caso nominal e negativo                             |
| **G41-05** | arbitrary markup removido                 | testes financeiros citados                                                      | `partial` | executar e selar                                             |
| **G41-06** | tools runtime-validated                   | registry/tool-runner tests citados                                              | `partial` | executar entradas válida e inválida                          |
| **G41-07** | endpoint privado autoriza servidor        | auth policy/server tests citados                                                | `partial` | executar matriz allow/deny                                   |
| **G41-08** | token sensível não fica em localStorage   | auth/server pointers citados; inspeção ainda pendente                           | `partial` | provar ausência no bundle e sessão server-driven             |
| **G41-09** | estado da IA sobrevive reload             | chat execution/functions pointers citados                                       | `partial` | executar persistência/reload                                 |
| **G41-10** | AI possui timeout                         | chat execution/latency pointers citados                                         | `partial` | executar timeout                                             |
| **G41-11** | CI verde                                  | nenhuma execução oficial do SHA atual citada; nenhum `local-ci` novo neste HEAD | `blocked` | produzir execução aplicável no SHA exato; não publicar antes |

## Linha de blocker não-P0

| ID         | Fato                                                                                                  | Evidência                                                                                            | Estado    | Ação                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------- |
| **B-23.2** | `23.2` não pode receber `done` enquanto o outbox não tiver runtime runner; `DBT-09` está aberta/alta. | `docs/evidence/agent-state/DEBTS.md`; recontagem de outbox; ausência de dispatcher runtime observada | `blocked` | implementar/autorizar runner, agendamento, backlog e teste de drenagem; não editar registry neste SDD |

## Invariantes

- P0 descobertos = 17; P0 rastreados = 17.
- Gates §41 descobertos = 11; gates rastreados = 11.
- Blocker explícito = 1 (`23.2`).
- `checked === discovered`; qualquer item novo exige linha e revisão antes de qualquer promoção.
