# §20.5 — Rate limits para chat/tool/exports — 2026-09-14

- Item: Onda 3 · 20.5 (`docs/evidence/plan-partials-2026-09-13/part-4-seguranca-ux.md`, seção 20.5)
- Branch: `ops/onda3-ratelimit` · base `2382636` · worktree `.worktree-onda3-ratelimit`
- Ambiente: Postgres 17-alpine local `127.0.0.1:5432/preco_que_da_lucro_test` (env explícito no
  processo; nenhum `.env` lido), Docker Compose do repo, execução sob
  `flock /tmp/opencode/onda2-db.lock`

## 1. Regras e onde são aplicadas

As regras de usuário ficaram ao lado das de auth, em
`src/server/auth/rate-limit-rules.server.ts`, com a chave `<bucket>|<userId>`:

| Bucket   | Regra                      | Chave consumida  | Aplicação                                                        | Superfície                                                                         |
| -------- | -------------------------- | ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `chat`   | `{ window: 600, max: 20 }` | `chat\|<userId>` | `reserveChatAndLoadHistory` (`src/lib/chat-execution.server.ts`) | `ApplicationError("RATE_LIMIT")` → 429                                             |
| `tool`   | `{ window: 600, max: 40 }` | `tool\|<userId>` | `runRegisteredTool` (`src/lib/ai/tool-runner.ts`)                | `{ ok: false, code: "RATE_LIMIT" }` + `tool_executions`/`audit_events` de rejeição |
| `export` | —                          | —                | **N/A** (ver §5)                                                 | —                                                                                  |

O helper transacional foi extraído de `createDatabaseRateLimitStorage.consume` para
`consumeRateLimitInTransaction(transaction, key, rule, now?)` em
`src/server/auth/rate-limit-storage.server.ts` (o `consumeInTransaction` citado no plano). O
`consume` do Better Auth passou a ser um wrapper fino: mesmo SQL, mesmo instante de captura do
`now` (antes de abrir a transação), portanto o comportamento dos buckets de auth não mudou — o
`diff` do arquivo só move o corpo para a função exportada. O bucket passa a ser reaproveitável
dentro da transação do request, que é o que chat/tool precisam.

Atomicidade: `INSERT ... ON CONFLICT DO NOTHING` materializa a linha, e o `UPDATE` condicional
(`where last_request < cutoff or count < max`) toma o lock da linha; dois requests concorrentes
serializam no mesmo registro, de modo que o total admitido é exatamente `max` — inclusive entre
instâncias diferentes (§4).

## 2. Ordem mandatória

- **Chat**: `executeSendChatMessage` é chamado pelo server fn `sendChatMessage` depois de
  `.middleware([requireDatabaseIdentity])` (authn/AuthZ) e `.validator(sendInput.parse)` (Zod) —
  `src/lib/chat.functions.ts:342-347`. Dentro da execução, o consumo do bucket é a **primeira**
  instrução de `reserveChatAndLoadHistory`, antes da reserva de orçamento de IA, do `getOrCreate`,
  do `appendMessage` e da leitura de histórico. Um turno recusado não grava mensagem, não reserva
  orçamento e não chama o modelo.
- **Tool**: em `runRegisteredTool` a admissão entra **depois** do parse/Zod (`prepareToolRequest` →
  `definition.prepare`) e do AuthZ (`allowedToolNames`, `requireConfirmation`) e **antes** do claim
  de idempotência. Isto é o ponto crítico: se o bucket fosse consumido depois do claim, uma chamada
  recusada ocuparia a chave `(tenant, user, operation, key)` e o retry seguinte faria replay de uma
  execução que nunca aconteceu. O teste de unidade
  `src/test/tool-runner.persistence.test.ts` ("admissão por rate limit (§20.5)") prova as duas
  metades: com bucket saturado há 0 inserts em `idempotency_records`; com bucket aprovado há 1.
- O `Retry-After` calculado pelo bucket é registrado no log estruturado
  (`ai.chat_rate_limited`, simétrico ao `ai.chat_budget_rejected` do limite diário). O header HTTP
  `Retry-After` não é emitido: a resposta 429 ao cliente é montada por `apiErrorResponse`
  (`src/lib/api-error.ts`, política `RATE_LIMIT` → `status: 429`), chamada do handler de erro de
  `src/start.ts` — nenhum dos dois recebe o `retryAfter` do bucket. O `429` de
  `src/lib/chat.functions.ts` é o do **gateway upstream** (mapeia o 429 do `fetch` em
  `ApplicationError("RATE_LIMIT")`), não a resposta ao cliente. Fora do escopo desta fatia (ver §7).

## 3. `AI_CHAT_LIMIT_PER_10_MINUTES` e a divergência com o SDD

- O contador por mensagens persistidas (`conversationService.countRecentUserMessages` +
  `CHAT_LIMIT_WINDOW_MS`) foi **removido** do caminho do chat: era uma contagem, não um bucket
  atômico, e dois turnos concorrentes podiam passá-la juntos. Não restaram dois limitadores
  concorrentes.
- A variável **continua sendo o teto efetivo**, agora como `max` do bucket, via
  `chatRateLimitRule()` em `src/lib/chat-execution.server.ts`:
  `max = numberSetting("AI_CHAT_LIMIT_PER_10_MINUTES", USER_RATE_LIMIT_RULES.chat.max, 1, 1_000)`.
  A janela passa a ser fixa na regra (600 s), não configurável. `.env.example:41` (`"20"`), ADR-021
  arquivado (item 7: "20 chats por usuário em dez minutos e 200 chats diários por tenant") e o
  default implementado convergem: 20/10 min é a fonte de verdade, o SDD era a divergência.
- SDD §13.9 alinhado (mesma linha, sem tocar em mais nada): a célula de chat passa a
  "20 turnos por 10 min/usuário (bucket atômico em DB, `AI_CHAT_LIMIT_PER_10_MINUTES`) e 200 por
  dia/tenant" e a de ferramentas ganha "40 execuções por 10 min/usuário". As dimensões diárias
  (200/tenant) não mudam: já são aplicadas pelo budget ledger
  (`AI_DAILY_CHAT_LIMIT_PER_TENANT`, `reserveChatInTransaction`), com teste próprio.
  Nenhum limite numérico foi alterado para casar com o texto antigo.

## 4. Prova de atomicidade (rajada distribuída)

Script: `scripts/db/test-rate-limit-burst.ts` — dois pools (duas "instâncias", `max: 24` cada) contra
a mesma chave; cada requisição consome o bucket na própria transação. O script afirma exatamente
`max` admissões, `concurrency - max` recusas, contador persistido igual a `max`, **uma única linha**
para a chave e `retryAfter` na ordem da janela; grava o relatório cru em `--report`.

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test
export DATABASE_ADMIN_URL=$DATABASE_URL DATABASE_DRIVER=node-postgres
flock /tmp/opencode/onda2-db.lock -c "cd .worktree-onda3-ratelimit && \
  timeout 100 npx tsx scripts/db/test-rate-limit-burst.ts \
  --report docs/evidence/rate-limits-2026-09-14/burst.json"
```

Concorrência e contagens observadas (cru em `burst.json`, stdout em `burst-stdout.txt`):

| Bucket          | Concorrência | Instâncias | Admitidas | Recusadas | Contador persistido | Linhas |
| --------------- | ------------ | ---------- | --------- | --------- | ------------------- | ------ |
| chat (`max=20`) | 25           | 2          | **20**    | 5         | 20                  | 1      |
| tool (`max=40`) | 50           | 2          | **40**    | 10        | 40                  | 1      |

`retryAfter` observado: 600–601 s (o `now` é capturado antes do lock da linha, então um concorrente
que esperou pode devolver 1 s acima da janela; mesma semântica do caminho de auth). O script apaga
apenas as suas duas chaves antes e depois da rajada (`cleanupBuckets`), para permanecer repetível no
banco local. Saída crua das duas rajadas em `burst-stdout.txt` e `burst.json`.

### 4.1 Verificação do caminho de tool contra Postgres real

`scripts/db/test-tool-security.ts` (12 chamadas a `runRegisteredTool`, `userId` fixo) passa verde com a
admissão nova, sob `set local role app_runtime` — ou seja, a escrita em `rate_limits` atravessa a
política `auth_service_access` da migration 0011. Medição do bucket `tool|71000000-…` após a
execução: **6** consumos em 12 chamadas; as outras 6 são recusadas **antes** da admissão (JSON
inválido, tool desconhecida e AuthZ), o que confirma na prática a ordem "após Zod+AuthZ". Duas
execuções consecutivas terminam no mesmo valor (`6`), e não em `12`, provando que a limpeza de
bucket acrescentada ao script o torna repetível dentro da mesma janela de 10 min. Saída crua da
execução em `tool-security.txt` (o helper temporário citado ali foi local, fora do commit).

## 5. Exports — N/A com condição de reabertura

**N/A**: não existe superfície de exportação no produto. Verificação factual em `2382636`:
`src/routes/api/` contém apenas `auth/`, `health/` e `vitals.ts`, e nenhum arquivo em
`src/routes/**` ou `src/lib/**` produz `text/csv`, `.csv` ou `Content-Disposition`. Não há, portanto,
nada a limitar; implementar bucket para um endpoint inexistente seria scaffolding especulativo.

**Condição de reabertura (explícita):** quando a primeira rota de exportação for criada (CSV/PDF/
relatório com `Content-Disposition` ou geração server-side de arquivo), esta fatia deve ser reaberta
para adicionar `USER_RATE_LIMIT_RULES.export = { window: 600, max: <definir> }` com chave
`export|<userId>`, consumida no mesmo ponto do caminho (após Zod/AuthZ, antes de gerar o arquivo), e
uma rajada distribuída equivalente em `scripts/db/test-rate-limit-burst.ts`. Gatilho de detecção:
novo arquivo em `src/routes/api/**` ou novo handler que devolva `Content-Disposition`/`text/csv`.

## 6. Gates

- `npx tsc -p tsconfig.json --noEmit` → exit 0
- `npx eslint <9 arquivos alterados>` → exit 0
- `npx prettier --check <arquivos alterados> SDD.md` → exit 0
- `npx vitest run` → 65 arquivos / 587 testes, todos verdes (`vitest-full.txt`)
- `npx tsx scripts/m02-matrix.ts --check` → "deterministic and up to date"; `npx tsx
scripts/m02-boundaries.ts` → clean. A matriz foi regerada (`transactionSites` 98 → 100, o novo
  site por bucket + deslocamento de `line`); o diff é puramente mecânico.
- Saída crua dos quatro primeiros em `gates.txt`; fontes de teste novas: `src/test/chat-rate-limit.test.ts`,
  casos de regra em `src/test/rate-limit-rules.test.ts`, caso de ordem em
  `src/test/tool-runner.persistence.test.ts`.
- `npx tsx scripts/db/test-tool-security.ts` (duas vezes, sob `flock`) → OK; ver §4.1.

## 7. Limites / residuais

- A prova de atomicidade exercita `consumeRateLimitInTransaction` com as mesmas regras e chaves do
  runtime, mas não sobe o servidor Nitro: não há e2e HTTP de 429 de chat nesta fatia (a rota pertence
  ao O19).
- O script `scripts/db/test-rate-limit-burst.ts` **está** encadeado como o **último passo** da
  cadeia `db:test` do `package.json` (`… && tsx scripts/db/test-rate-limit-burst.ts`, passo 11) e
  portanto roda no CI pelo `db:test` do job `verify` (`.github/workflows/ui-stack.yml:60`). O
  encadeamento não foi feito por esta fatia (o operador não podia tocar `package.json`): é ação de
  manifest do supervisor, commit `46812f6` ("chore(obs): wire the burst test into db:test …",
  12:44 -0300), 11 min depois da redação desta lista — a frase anterior descrevia o estado da
  entrega, não o estado do branch.
- `Retry-After` no 429 continua ausente (SDD §13.9 o promete): a resposta nasce em
  `apiErrorResponse` (`src/lib/api-error.ts`, `RATE_LIMIT` → 429), chamada de `src/start.ts`, que não
  recebem o `retryAfter` do bucket; exige mudança nesses arquivos, não em `chat.functions.ts` (ali o
  429 é o do gateway upstream).
- `conversationService.countRecentUserMessages` / `conversation.repository.countRecentUserMessages`
  ficaram sem uso no runtime (eram o contador antigo). Não foram removidos para não alargar o escopo
  (têm testes próprios em `src/test/conversation.service.test.ts`).
- Replays idempotentes de tool (mesma chave já executada) consomem um token do bucket, porque a
  admissão precede o claim por mandato do plano.
- A admissão de tool roda dentro da transação do request: o lock do bucket `tool|<userId>` fica
  retido durante a execução da tool (só mutações de banco; o I/O do modelo acontece fora da
  transação), serializando tool calls do mesmo usuário. Trade-off aceito para não separar admissão
  de claim de idempotência.
- Observação pré-existente (não introduzida aqui): `scripts/db/test-tool-security.ts` não é
  repetível no banco local — ele usa ids fixos e não limpa o resíduo de `products`/`tool_executions`/
  `idempotency_records`/`audit_events`, então uma segunda execução falha nas contagens (resíduo de um
  `db:test` anterior às 05:41 UTC). A fixture desse tenant foi restaurada ao estado de primeira
  execução antes da entrega; a limpeza de resíduo do script fica como dívida fora de §20.5.
- A prova de rajada consome rate_limits reais e o script limpa as suas chaves; nenhuma chave
  `chat|`/`tool|` ficou no banco ao final desta fatia.
