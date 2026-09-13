# Onda 1 — §14.3 ToolExecution (migration 0012) + §9.2 AiToolRepository

**Operador:** O10 (início) → O10b (retomada) · **Branch:** `ops/onda1-toolexec` · **Base:** `111218b`
· **Worktree:** `.worktree-onda1-toolexec` · **Data:** 2026-09-13 (UTC)
· **Fonte do escopo:** `docs/evidence/plan-partials-2026-09-13/part-1-arquitetura.md` (§14.3 e §9.2 ai-tool).

## Entregas

### Migration 0012 (commit `b91065d`, não reaberta)

- `tool_executions.tool_call_id text`, `input jsonb`, `usage_id uuid` + índice
  `tool_executions_tenant_usage_idx (tenant_id, usage_id)`; sem FK (deliberado: `ai_usage` não tem
  `UNIQUE(tenant, id)`); rollback aditivo `drizzle/rollback/0012_to_0011_down.sql`.
- Registry: `0012_youthful_stellaris` class `SAFE`/`appliedOn: empty`, sha256 byte a byte;
  `test-migrations.ts` cobre o down na cadeia 0012→0003 e o replay completo (13 no journal);
  `scripts/m02-v2b.mjs` passou a esperar 13/13.

### Sanitizador `src/lib/ai/tool-payload.ts` (novo)

- `sanitizeToolInput` aplica limites (string 8 000, array 100, **chaves por objeto 100**, chave 120,
  profundidade 8; `NaN`/`Infinity` → `null`) e redação por chave inteira normalizada
  (`api_key` → `apikey`; `Authorization`/`Cookie`/`token`/`secret`/`password` redigem;
  `access_token`/`pricing`/`authorization_ref` **não** casam — diferente do `SENSITIVE_KEY` do logger,
  que casa por substring).
- `JSON.parse` inválido → `input: null`; payload JSON que não é objeto → `null`.
- **Limite do input cru:** o que chega ao banco é sempre o objeto sanitizado (limites + redação);
  o input cru do modelo nunca é persistido. `input_hash` continua calculado sobre o payload cru
  canonicalizado, sem interferência da sanitização.

### Threading `toolCallId`/`usageId` (§14.3)

- `runRegisteredTool({ toolCallId?, usageId? })` ← `runToolCall` ← `appendToolCalls` ←
  `handleModelResponse` ← `executeReservedRound(reservationResult.usageId)` em
  `src/lib/chat-execution.server.ts`.
- Rejeições (JSON inválido, tool desconhecida, validação, autorização/confirmação) também persistem
  `tool_call_id`/`usage_id` e o input sanitizado quando há objeto; replay idempotente não cria linha.

### Decisão `M04-D-012` (`docs/specs/M-04/decisions.md`, Emenda v3)

- Vínculo canônico round↔tool é **N:1 via `tool_executions.usage_id`** (um round = um `usage_id`,
  D-002; N execuções por round). `ai_usage.tool_execution_id` permanece **reservada**, sem
  "last tool wins" — preenchê-la sobrescreveria o vínculo das execuções anteriores.
- Estado `AGENT-PROPOSED`; ratificação por Q-019 junto de D-011.

### §9.2 `AiToolRepository`

- `interface AiToolRepository` cobre os 6 métodos (`persistRejected`, `findClaim`, `claim`,
  `startExecution`, `markSucceeded`, `markFailed`) com tipos de payload exportados
  (`RejectedToolWrite`, `ToolExecutionStart`); `DrizzleAiToolRepository implements AiToolRepository` e
  o singleton é tipado (`export const aiToolRepository: AiToolRepository`). SQL confinado ao
  repositório; nenhuma mudança de comportamento.

## Ajustes declarados na retomada

1. **`scripts/db/test-tool-security.ts` — asserção contraditória (corrigida):** a checagem final usava
   `jsonb_object_keys(input)` e exigia a **ausência da chave** sensível, mas o contrato do sanitizador
   (e as asserções anteriores do próprio script e do teste unitário) preserva a chave e redige o
   **valor** para `[REDACTED]`. Trocada por `jsonb_each_text` + `entry.value <> '[REDACTED]'`, mais
   uma checagem de que nenhum literal secreto cru (`super-secret`, `chave-secreta`, `session=abc`)
   aparece em `input::text`.
2. **`src/server/repositories/ai-tool.repository.ts` — comentário incorreto:** dizia que "o runner
   consome o singleton tipado", mas o runner segue com SQL inline (wiring opcional da §9.2); comentário
   reescrito para não afirmar consumo inexistente.
3. **`src/lib/ai/tool-payload.ts` — limite ausente:** o parcial não limitava o número de chaves de
   objeto (só arrays); adicionado `MAX_OBJECT_KEYS = 100` (paridade com o `sanitizeJson` do runner e
   defesa contra jsonb ilimitado) + caso no teste unitário.

## Arquivos

| Ação     | Arquivo                                            | Notas                                                    |
| -------- | -------------------------------------------------- | -------------------------------------------------------- |
| criado   | `src/lib/ai/tool-payload.ts`                       | sanitizador do input (§14.3)                             |
| criado   | `src/test/tool-runner.persistence.test.ts`         | fake transaction: trace, input, redação, limites         |
| alterado | `src/lib/ai/tool-runner.ts`                        | threading `toolCallId`/`usageId` + persistência do input |
| alterado | `src/lib/chat-execution.server.ts`                 | passa `reservationResult.usageId` até `runToolCall`      |
| alterado | `src/server/repositories/ai-tool.repository.ts`    | interface + singleton tipado + campos novos              |
| alterado | `scripts/db/test-tool-security.ts`                 | novas colunas, redação e literais crus no banco          |
| alterado | `docs/specs/M-04/decisions.md`                     | Emenda v3 com `M04-D-012`                                |
| criado   | `docs/evidence/onda1-tool-execution-2026-09-13.md` | esta evidência                                           |

Fora deste commit: migration 0012 e artefatos (`b91065d`), `matrix*.yaml`, `package.json`/lockfile,
`AGENTS.md`, PROGRESS, `EXECUTION-STATE-PROGRAM.md`, `plan-partials/**`, `.github/**`.

## Validação (sem `| tail`)

| Comando                                                                                                                                                        | Exit | Resultado                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `npx tsx scripts/db/check-migration-classes.ts`                                                                                                                | 0    | `✔ 13/13 classificadas`                                                                   |
| `npx vitest run src/test/tool-runner.persistence.test.ts src/test/ai-estimated-cost.test.ts src/test/tool-registry.test.ts src/test/migration-classes.test.ts` | 0    | 4 arquivos, 37 testes, 0 falhas                                                           |
| `npm run typecheck`                                                                                                                                            | 0    | sem erros                                                                                 |
| `./node_modules/.bin/prettier --check` (arquivos do escopo)                                                                                                    | 0    | `All matched files use Prettier code style!`                                              |
| `npm run m02:boundaries`                                                                                                                                       | 0    | `M-02 BFF boundary is clean`                                                              |
| `docker exec preco-que-da-lucro-postgres psql -U postgres -c "DROP DATABASE ... WITH (FORCE);" -c "CREATE DATABASE ..."` (banco descartável recriado)          | 0    | `DROP DATABASE` / `CREATE DATABASE`                                                       |
| `npx tsx scripts/db/test-migrations.ts` (env local, `DATABASE_DRIVER=node-postgres`)                                                                           | 0    | `PostgreSQL 17, migration zero, constraints, RLS, P1 tables, cross-tenant e rollback: OK` |
| `npx tsx scripts/db/test-tool-security.ts` (env local)                                                                                                         | 0    | `Tool registry: validação, AuthZ, idempotência, auditoria e isolamento: OK`               |

Env do banco (nomes/valores locais canônicos, token `/tmp/opencode/onda1-db.lock`): `DATABASE_URL`,
`DATABASE_ADMIN_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_RESTORE_URL` em
`postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test`, `DATABASE_DRIVER=node-postgres`.

## Riscos e limites

- `usage_id` sem FK é intencional (0012); a integridade do vínculo é garantida na aplicação
  (`reservationResult.usageId`), não no banco.
- `AiToolRepository` é contrato exportado; o wiring do runner ao singleton (SQL inline → repositório)
  segue como opcional da §9.2 e não foi feito aqui para não mudar comportamento.
- O sanitizador redige valor, não remove chave; logs/eventos não recebem o input (audit usa
  `inputHash`/código), então a superfície de exposição é só a coluna `input`.

## Manifest request

Nenhum além do `M04-D-012` aplicado nesta retomada (`docs/specs/M-04/decisions.md`, autorizado no
escopo). Nenhum `matrix*.yaml` tocado; regeneração/`m02:matrix:check` ficam para o supervisor.

## HANDOFF

- Commit da retomada (staging explícito, sem push):
  `feat(ai): persistencia 14.3 (tool_call_id/input/usage_id) + sanitizador + interface AiToolRepository`.
- Migration 0012 permanece no commit anterior `b91065d`.
- Token DB liberado (`/tmp/opencode/onda1-db.lock` removido).
- Próximo (S): incorporar a branch e resolver o manifest request de matriz, se houver; nenhum pendente
  de banco.
