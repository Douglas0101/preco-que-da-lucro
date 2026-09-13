# BUG-CHAT — hotfix do `AbortSignal` ausente no dispatch HTTP (2026-09-13)

**Item:** BUG-CHAT descoberto pelo O1 e confirmado por V3 na Onda 0
(`docs/evidence/plan-partials-2026-09-13/EXECUCAO-ONDA0.md` §3).
**Branch/base:** `ops/hotfix-chat`, worktree `.worktree-hotfix-chat`, base `85c3e72`.
**Arquivos tocados:** `src/middleware/request-context.ts` (fix),
`e2e/ui-stack.spec.ts` (regressão), este documento.
**Ambiente:** PostgreSQL 17 local (`127.0.0.1:5432`, `preco_que_da_lucro_test`);
preview Nitro local em `127.0.0.1:4173`; `AI_GATEWAY_API_KEY` vazio (caminho
controlado `DEPENDENCY_ERROR`, sem rede externa). Nomes de env apenas — nenhum
valor secreto neste documento.

## 1. Causa raiz

Cadeia confirmada por reprodução local:

1. `src/middleware/request-context.ts:70` copiava `signal: options.signal` para
   `RequestIdentity`. No dispatch HTTP de server function do TanStack Start, o
   `signal` declarado no tipo do middleware chega `undefined` em runtime.
2. `src/lib/chat-execution.server.ts:488` executa
   `AbortSignal.any([identity.signal, AbortSignal.timeout(...)])`; com o primeiro
   elemento `undefined`, o Node lança
   `TypeError: The "signals[0]" argument must be an instance of AbortSignal. Received undefined`.
3. O erro era transportado no envelope de server function com **HTTP 200**
   (`$TSR/Error` serializado), mascarando a falha: o chat ficava 100% quebrado no
   HTTP sem que status/código denunciassem o crash.
4. `requireDatabaseAuth` (`:119`) tinha o mesmo defeito latente no contexto
   transacional; `src/lib/ai/tool-runner.ts:277,312` consome `context.signal` e
   também dependia de um `AbortSignal` válido.

O `request` do adapter está sempre em escopo (`getRequest()` em `:56`/`:97`) e
`Request.signal` é, por spec, um `AbortSignal` válido — o fallback correto.

## 2. Diff conceitual (mudança mínima)

```diff
 async function authenticateRequest(options: {
   context: unknown;
-  signal: AbortSignal;
+  signal: AbortSignal | undefined; // o dispatch HTTP não injeta em runtime
 }): Promise<RequestIdentity> {
   const request = getRequest();
   ...
-    signal: options.signal,
+    signal: options.signal ?? request.signal,
   };
 }
 ...
-                  signal,
+                  signal: signal ?? request.signal,
```

Semântica preservada quando o signal existe (`??` só cai no fallback em
`undefined`/`null`); nenhuma outra linha alterada.

## 3. Vermelho → verde

Rota real descoberta por log de `page.on("request")`:
`POST /_serverFn/<hash>` com `postData` contendo a mensagem (padrão do teste:
`/_serverFn/` + método POST + `postData` com o probe).

**Vermelho (pré-fix)** — mesma base `85c3e72`, sem o fix:

```
npx playwright test e2e/ui-stack.spec.ts -g "BUG-CHAT" --project=chromium  # EXIT=1
```

Falha na asserção `expect(body).not.toContain("signals[0]")`; resposta observada:
`status: 200`, corpo serializado contendo
`The \"signals[0]\" argument must be an instance of AbortSignal. Received undefined`
(`$TSR/Error`). O Onda 0 registrava "200 mascarando a falha" — reproduzido.

**Verde (pós-fix)** — com o diff da §2:

```
npx playwright test e2e/ui-stack.spec.ts -g "BUG-CHAT" --project=chromium  # EXIT=0
```

O teste asserta: corpo sem `signals[0]`/`TypeError`; `status < 500`; UI
recupera (textarea reabilitada, mensagem controlada no `role="log"` e botão
reabilitado após novo input — ele só desabilita com input vazio/loading).
Screenshot do passo: `⚠️ Um serviço necessário está indisponível.`
(`DEPENDENCY_ERROR`, sem gateway configurado).

## 4. Gates executados

| Gate                                                               | Exit                  |
| ------------------------------------------------------------------ | --------------------- |
| `npx playwright test e2e/ui-stack.spec.ts -g "BUG-CHAT"` (pré-fix) | 1 (vermelho esperado) |
| `npx playwright test e2e/ui-stack.spec.ts -g "BUG-CHAT"` (pós-fix) | 0                     |
| `npm run typecheck`                                                | 0                     |
| `npx vitest run src/test/request-context.test.ts`                  | 0 (2 testes)          |
| `./node_modules/.bin/prettier --check` (arquivos do escopo)        | 0                     |

## 5. Limites e riscos

- **Não cobre o gateway real:** o verde usa o caminho controlado
  `DEPENDENCY_ERROR` (sem `AI_GATEWAY_API_KEY`), que prova que o dispatch chegou
  ao `callModel` sem o `TypeError`; a chamada HTTP ao gateway e a resposta de
  sucesso ficam cobertas pelos testes de unidade/integração já existentes de
  `callModel`/`executeSendChatMessage`.
- **`AUTH-005` intocado:** o fix não altera autenticação, sessão, CSRF nem a
  semântica de autorização; apenas a origem do `AbortSignal`.
- **Workaround de ambiente local:** o build atual divide `createCsrfMiddleware`
  em chunk circular (Onda 0 §4.2); o preview local foi iniciado com pré-import
  do chunk SSR via `NODE_OPTIONS` (padrão do harness
  `scripts/perf/capture-baseline.mjs`), sem mudança de lógica do app. No CI o
  caminho é o do workflow.
- **Escopo:** a suíte e2e completa não foi executada nesta rodada; rodou-se o
  teste focado do hotfix, typecheck e prettier; o `src/test/request-context.test.ts` é pré-existente e
  cobre apenas autorização owner/admin/member — a cobertura do fallback de `signal` é o e2e (vermelho→verde acima).

## 6. Decisão

**Keep:** o fallback `signal ?? request.signal` (com `Request.signal`) elimina o
crash do chat no dispatch HTTP e mantém a semântica anterior quando o framework
injeta o signal; a regressão e2e passa a cobrir o caminho HTTP que antes não
tinha teste algum.
