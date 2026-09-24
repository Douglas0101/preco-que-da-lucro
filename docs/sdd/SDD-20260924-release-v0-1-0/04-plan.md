# 04 — Plano T0–T11

O plano é sequencial e reversível. Tarefas de implementação permanecem condicionadas a despacho; este SDD apenas as prepara e exige a prova de execução.

| Tarefa  | Objetivo                                  | Entrada                                                                   | Saída esperada                                                 | Condição de parada / estado                                  |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **T0**  | Congelar identidade e inventariar o mundo | branch, refs e árvore                                                     | snapshot de HEAD, status e exclusão explícita do checkout sujo | qualquer divergência de base bloqueia                        |
| **T1**  | Confirmar as fontes P0 e §41              | §36/§41 e ponteiros de código/teste                                       | inventário dos 17 P0 e 11 gates, sem inferência                | fonte ausente ou ambígua → `blocked`                         |
| **T2**  | Revisar escopo e estados                  | `SCOPE_FREEZE`, blockers e política de evidência                          | tabela de estados permitidos, sem `done` sem prova             | qualquer promoção indevida → `blocked`                       |
| **T3**  | Fazer triage dos testes executáveis       | testes de chat, finanças, tools, auth, request-context, persistência e DB | matriz teste→P0, com skip/precondição nomeados                 | teste não executado no SHA → `partial`                       |
| **T4**  | Especificar a rodada de prova             | `LOCAL_CI_DB_TIER=auto ./scripts/local-ci.sh` e escopo exato              | comando, precondições, artefatos metadata-only e hash do SHA   | execução ausente → `partial`                                 |
| **T5**  | Verificar consistência do veredicto       | `result.txt`, manifesto, relatório e selos                                | prova de igualdade dos três veredictos                         | divergência → `blocked`; nunca reescrever rodada histórica   |
| **T6**  | Verificar integridade em clone limpo      | commit/árvore exata e `evidence.git.sha256`                               | saída independente de `sha256sum -c`                           | falha ou clone não isolado → `blocked`                       |
| **T7**  | Resolver blockers P0 mínimos              | `DBT-09`, `DBT-19` e `23.2`                                               | decisão de código/ADR, se autorizada, ou lista de pendências   | `23.2` não pode ser `done`; dívida aberta não se altera aqui |
| **T8**  | Fazer revisão de escopo e segurança       | rotas, segredos, worktrees, banco, sistemas remotos                       | revisão dos três desenhos de rota e das proibições             | qualquer aprovação implícita → `blocked`                     |
| **T9**  | Preparar relatório de release             | inventário, riscos, ações e controles de veto                             | relatório `OPEN / NOT VERIFIED` com pendências                 | Sem run oficial/local aplicável → permanece aberto           |
| **T10** | Fazer decisão de promoção                 | todos os T anteriores                                                     | parecer humano por item e decisão de publicação                | sem decisão humana → nada é publicado                        |
| **T11** | Encerrar ou reabrir o pacote              | decisão registrada e prova selada                                         | estado final por item, reversão e arquivos preservados         | evidência histórica defeituosa permanece divulgada           |

## Ordem obrigatória

`T0 → T1 → T2 → T3 → T4 → T5 → T6`. `T7` pode ser um triage de blocker antes de qualquer promoção, mas não pode substituir a prova de T4–T6. `T8–T11` só começam com identidade e escopo confirmados.

## Comandos candidatos, não executados nesta tarefa

- `git rev-parse HEAD` e `git status --short --branch` para T0.
- inspeção de `src/lib/chat-markdown.tsx`, `src/lib/finance.ts`, `src/lib/ai/*`, `src/lib/api-error.ts`, `src/middleware/request-context.ts`, `src/server/auth/*`, `src/lib/chat-execution.server.ts`, `src/lib/chat.functions.ts`, `src/db/schema.ts` e testes correspondentes para T1/T3.
- `LOCAL_CI_DB_TIER=auto ./scripts/local-ci.sh` para T4, somente em worktree limpa e sem artefato histórico como prova.
- `sha256sum -c evidence.git.sha256` em clone limpo para T6.
- nenhum comando de push, PR, release, billing, alteração de banco ou edição de registry está no plano executável desta SDD.

## Critério de salida

O pacote pode sair de `OPEN` somente quando cada estado tiver evidência e cada bloqueio tiver decisão explícita. A ausência de qualquer item mantém o release em `NOT VERIFIED`; não é permitido preencher a lacuna com um placeholder.
