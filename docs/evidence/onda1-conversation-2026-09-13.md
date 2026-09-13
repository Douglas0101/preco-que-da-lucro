# Onda 1 — item 1b/§9.1 Conversation: ConversationRepository + ConversationService

**Operador:** O9 · **Branch:** `ops/onda1-conversation` · **Base:** `27af175` · **Worktree:**
`.worktree-onda1-conversation` · **Data:** 2026-09-13 (UTC) · **Timebox:** 90 min (fechado dentro).

**Escopo:** extração de persistência de conversa para `conversation.repository.ts` +
`conversation.service.ts`, com `chat-data.ts` virando adapter de compatibilidade e
`numberSetting`/`createTenantTransaction` movidos para `src/lib/tenant-transaction.ts`.
Nenhuma mudança de comportamento pretendida.

## Invariantes preservadas

- **FSM:** `transitionConversationState` e a allowlist por estado continuam intocados; o executor
  apenas passou a receber `ConversationService` por parâmetro (DI) para persistir estado.
- **Replay:** `idempotencyKey: \`${conversationId}:${toolCall.id}\``permanece em`src/lib/chat-execution.server.ts:275`(era`:313` no base; arquivo encurtou).
- **GET não cria conversa:** `getChatHistory` usa `conversationService.findForUser` (somente leitura);
  verificado por `scripts/db/test-chat-semantics.ts`.
- **Tenant/usuário:** todos os métodos do repository usam `context.tenantId`/`context.userId`
  recebidos da identidade autenticada; nenhum valor de body/header.

## Arquivos

| Ação     | Arquivo                                              | Notas                                                                 |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| criado   | `src/lib/tenant-transaction.ts`                      | `numberSetting`, `createTenantTransaction`, `TenantTransactionRunner` |
| criado   | `src/server/repositories/conversation.repository.ts` | interface + `DrizzleConversationRepository` + singleton (só SQL)      |
| criado   | `src/server/services/conversation.service.ts`        | interface + `DefaultConversationService(repo)` + singleton (sem SQL)  |
| alterado | `src/lib/chat-data.ts`                               | adapter fino: reexporta service e tenant-transaction                  |
| alterado | `src/lib/chat-execution.server.ts`                   | usa o service; `conversationService?` em `ChatExecutionDependencies`  |
| alterado | `src/lib/chat.functions.ts`                          | usa o service nos 3 handlers; `getConversationForTests` mantido       |
| criado   | `src/test/conversation.service.test.ts`              | 6 testes de delegação com repo fake                                   |

**Interface do repositório (contrato):** `findForUser`, `getOrCreate`, `listMessages(context,
conversationId, { limit? })`, `countRecentUserMessages(context, since)`, `appendMessage(context,
{ conversationId, role, content, metadata? })`, `updateConversation(context, conversationId,
changes)`, `deleteMessages`, `findProduct`, `validateProduct`.
**Serviço:** interface equivalente; `DefaultConversationService` só delega ao repository
(nenhum import de `drizzle-orm`/`@/db/*`, nem `request.transaction`).

## Verificação (sem `| tail`)

| Comando                                                                                                                    | Resultado                                    |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `npx vitest run src/test/conversation.service.test.ts src/test/chat-fsm.server.test.ts src/test/query-performance.test.ts` | 3 arquivos, 27 testes, 0 falhas              |
| `./node_modules/.bin/tsx scripts/db/test-chat-semantics.ts` (token O9; env local)                                          | `Chat GET é somente leitura...: OK`          |
| `./node_modules/.bin/tsx scripts/db/test-ai-budget.ts` (token O9; env local)                                               | T1–T10 `OK`, suíte concluída                 |
| `./node_modules/.bin/prettier --check` (7 arquivos do escopo)                                                              | `All matched files use Prettier code style!` |
| `npm run typecheck`                                                                                                        | exit 0                                       |
| `npm run m02:boundaries`                                                                                                   | `M-02 BFF boundary is clean`                 |
| `npm run m02:matrix:check`                                                                                                 | exit 1 (drift esperado — ver S)              |

Env do banco (nomes/valores locais canônicos, token `/tmp/opencode/onda1-db.lock`): `DATABASE_URL`,
`DATABASE_ADMIN_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_RESTORE_URL` em
`postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test`, `DATABASE_DRIVER=node-postgres`.
Token liberado (`rmdir`) ao fim.

## Manifest request (S — não editei matrix)

`docs/specs/M-02/matrix.overlay.yaml`, catálogo:

```json
"ConversationRepository": {
  "status": "implemented",
  "path": "src/server/repositories/conversation.repository.ts"
},
"ConversationService": {
  "status": "implemented",
  "path": "src/server/services/conversation.service.ts"
}
```

- **`transient-chat-data`:** pode ser **removida** — `src/lib/chat-data.ts` não importa mais
  `drizzle-orm`/`@/db/*` (não é mais databasePath) e nenhum módulo o importa hoje; permanece só
  como superfície de compatibilidade até a remoção em M02-3.
- **`transient-chat-execution`:** **permanece** — o executor ainda importa `withTenantTransaction`
  de `@/db/client.server` (databasePath `src/lib/chat-execution.server.ts`), então
  `chat.functions.ts` continua alcançando um databasePath não-repository.
- **`transient-bff-chat-self`:** **permanece** — `chat.functions.ts` compõe a tenant tx
  (`withTenantTransaction`).
- **Unidade `chat-reservation-history`** (`transactionPolicies["src/lib/chat.functions.ts"].units`):
  a evidência atual aponta `src/server/services/conversation.service.ts:95-124`, mas a orquestração
  ficou em `src/lib/chat-execution.server.ts:93-124` (o service não abre transação). Atualizar a
  evidência para o executor, ou aceitar mover a orquestração ao service num follow-up.
- `npm run m02:matrix:check` acusa drift (esperado): `m02:matrix:generate` após aplicar o overlay
  atualiza `directDatabaseFiles` (+ `conversation.repository.ts`, − `chat-data.ts`) e realoca os
  `transactionSites` (8 no repository, 1 no executor, 0 no BFF).

## HANDOFF

- **Estado:** escopo do prompt concluído e verde localmente; sem push. Commit único com staging
  explícito: `refactor(chat): ConversationService/Repository extraidos sem mudanca de comportamento (§9.1)`.
- **Token DB:** liberado (`/tmp/opencode/onda1-db.lock` inexistente).
- **Próximo (S):** aplicar o manifest request no `matrix.overlay.yaml`, rodar
  `npm run m02:matrix:generate` + `m02:matrix:check` + `m02:boundaries` no HEAD integrado; decidir a
  evidência de `chat-reservation-history`; carimbar o journal/painel. Nada pendente de banco.
- **Fora do escopo (não tocado):** `package.json`, lockfile, `AGENTS.md`, PROGRESS,
  `EXECUTION-STATE-PROGRAM.md`, `plan-partials/**`, `.github/**`, `matrix*.yaml`; nenhum push/rebase.
