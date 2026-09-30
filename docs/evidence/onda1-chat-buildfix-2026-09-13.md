# Onda 1 — buildfix `import-protection` (chat.functions → conversation.service)

**Operador:** O10d (fix dirigido) · **Branch:** `ops/onda1-chat-buildfix` · **Base:** `32154b7` ·
**Worktree:** `.worktree-onda1-chat-buildfix` · **Data:** 2026-09-13 (UTC).

**Escopo:** destravar `npm run build` sem mudança de comportamento. Edição restrita a
`src/lib/chat.functions.ts`, `src/lib/chat-execution.server.ts` e
`scripts/db/test-chat-semantics.ts`; nenhum push.

## Causa raiz

`npm run build` falhava no `generateBundle` do ambiente client:

```
[plugin tanstack-start-core:import-protection]
[import-protection] Import denied in client environment
  Denied by file pattern: **/server/**
  Importer: src/lib/chat.functions.ts
  Import: "src/server/services/conversation.service"
  Resolved: src/server/services/conversation.service.ts
  Trace:
    1. src/router.tsx:4:27 (entry) (import "./routeTree.gen")
    2. src/routeTree.gen.ts:12:62 (import "./routes/_authenticated/novo-produto")
    3. src/routes/_authenticated/novo-produto.tsx (import "src/lib/chat.functions")
    4. src/lib/chat.functions.ts (import "src/server/services/conversation.service")
```

Regra do host Lovable: `importProtection.client.files: ["**/server/**"]` (behavior `error`). Nos
demais `*.functions.ts` o import de `@/server/**` só é referenciado dentro de handlers
`createServerFn`; o compilador do TanStack os elimina do bundle client e o import vira módulo mock
que não sobrevive ao tree-shaking. Em `chat.functions.ts`, o export plano
`getConversationForTests` (usado só por `scripts/db/test-chat-semantics.ts`) referenciava
`conversationService` fora de qualquer handler, mantendo o mock vivo no bundle client e disparando
a violação.

## Fix

- `src/lib/chat-execution.server.ts:541` — `getConversationForTests` movido para o módulo `.server`
  que já importa o service (usa `defaultConversationService.findForUser`, mesma semântica).
- `src/lib/chat.functions.ts` — função e o import de tipo `RequestContext` (então órfão) removidos.
  O import de `conversationService` **permanece**: os três handlers `createServerFn` ainda o usam;
  removê-lo quebraria o typecheck. O padrão é idêntico ao de `expenses.functions.ts` e
  `products.functions.ts` (import top-level usado apenas em handlers, ambos verdes).
- `scripts/db/test-chat-semantics.ts:6` — import atualizado para
  `../../src/lib/chat-execution.server`.

Instrução original pedia remover o import de `conversationService` de `chat.functions.ts`; mantido
por necessidade dos handlers — desvio declarado. Nenhum segundo símbolo ofensor apareceu no build.

## Build antes/depois

| Momento | Comando         | Resultado                                                                    |
| ------- | --------------- | ---------------------------------------------------------------------------- |
| antes   | `npm run build` | exit 1 — `import-protection` nega `chat.functions.ts → conversation.service` |
| depois  | `npm run build` | exit 0 — 0 ocorrências de `import-protection`; client + Nitro `node-server`  |

## Verificação (sem `| tail`)

| Comando                                                                          | Resultado                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `npm run build`                                                                  | exit 0, sem violação de import-protection                      |
| `npx vitest run src/test/model-gateway.test.ts src/test/chat-fsm.server.test.ts` | 2 arquivos, 17 testes, 0 falhas                                |
| `npx tsx scripts/db/test-migrations.ts` (token; DB descartável recriado)         | `PostgreSQL 17, migration zero, ... rollback: OK`              |
| `npx tsx scripts/db/test-chat-semantics.ts` (token)                              | `Chat GET é somente leitura; criação fica restrita a POST: OK` |
| `npm run typecheck`                                                              | exit 0                                                         |
| `./node_modules/.bin/prettier --check` (3 arquivos do escopo)                    | `All matched files use Prettier code style!`                   |
| `npm run m02:boundaries`                                                         | `M-02 BFF boundary is clean`                                   |

Env do banco (valores locais canônicos): `DATABASE_URL`, `DATABASE_ADMIN_URL`,
`DATABASE_URL_UNPOOLED`, `DATABASE_RESTORE_URL` em
`postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test`, `DATABASE_DRIVER=node-postgres`.
Token `/tmp/opencode/onda1-db.lock` adquirido (`mkdir`) e liberado (`rmdir`); banco descartável
recriado via `DROP ... WITH (FORCE)` + `CREATE DATABASE`.

## HANDOFF

- **Estado:** build destravado e demais gates verdes localmente; commit único com staging explícito
  `fix(chat): move helper de teste para .server e destrava o build (import-protection)`. Sem push.
- **Arquivos tocados:** `src/lib/chat.functions.ts`, `src/lib/chat-execution.server.ts`,
  `scripts/db/test-chat-semantics.ts`, este artefato.
- **Desvio declarado:** import de `conversationService` mantido em `chat.functions.ts` (handlers).
- **Token DB:** liberado (`/tmp/opencode/onda1-db.lock` inexistente).
- **Fora do escopo (não tocado):** `package.json`, lockfile, `AGENTS.md`, PROGRESS,
  `EXECUTION-STATE-PROGRAM.md`, `plan-partials/**`, `.github/**`, `matrix*.yaml`; sem push/rebase.
