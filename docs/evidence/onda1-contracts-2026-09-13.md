# Onda 1 — item 1d: contratos Event (M-04) + Memory (M-05) apenas-tipo — 2026-09-13

- Item: §9.1 Memory/Event contracts gated (`docs/evidence/plan-partials-2026-09-13/part-1-arquitetura.md:30-31`,
  ordem do plano §15 em `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1264-1342`)
- Operador: O12 (Onda 1, Batch 2) · branch `ops/onda1-contracts` · base `111218b` · worktree
  `.worktree-onda1-contracts`
- Escopo entregue: os dois paths do catálogo M-02 declarados `contract-only` deixam de ser mortos —
  `src/server/contracts/event.contracts.ts` (alvo M-04) e `src/server/contracts/memory.contracts.ts`
  (alvo M-05), ambos somente-tipo. Nenhuma implementação de M-04/M-05 iniciada; nenhuma mudança de
  migration, dependência, matrix ou runtime.

## Contratos

### `src/server/contracts/event.contracts.ts` (PLANNED, alvo M-04)

- `DomainEventInput`, `AppendEventResult` e `EventRepositoryPort` copiados **verbatim** de
  `docs/specs/M-04/spec.md:231-254` (outbox de domínio); `EventRepositoryPort.append`/`publishPending`
  idênticos à spec.
- `export type Executor = RequestContext["transaction"]` (M02-D-003) resolve o tipo citado pela spec
  sem importar `@/db`; `RequestContext` entra apenas como `import type` de `@/lib/request-context`.
- Cabeçalho marca `PLANNED — alvo M-04`: o repositório concreto chega com M-04 (spec DRAFT v2, sem RAT).

### `src/server/contracts/memory.contracts.ts` (PLANNED, alvo M-05)

- Mínimo derivado da ordem §15: `MemoryRecord`, `MemoryPolicy` (**§15.3** — modelo propõe, backend decide)
  e `MemoryRepositoryPort` com `append`/`search`/`delete`; apoios `MemoryScope`, `MemorySourceKind`,
  `MemoryProvenance` (**§15.4** — quem disse, onde, quando, inferida, confiança), `MemoryRecordInput` e
  `MemorySearchQuery`.
- `Executor` reutilizado via `import type` de `./event.contracts` (dependência M-05→M-04 declarada no
  ledger). Cabeçalho marca `PLANNED — alvo M-05`; memória segue **gated** (nenhuma tabela/policy/FTS/
  embedding implementados).

## Teste de fonte

`src/test/contracts.test.ts` (novo, 8 testes, padrão `src/test/ai-tool.repository.security.test.ts` com
`readFileSync` + AST do TypeScript, precedente `scripts/m02-matrix.ts:92-94`):

- (a) os dois arquivos existem e exportam `DomainEventInput`/`AppendEventResult`/`EventRepositoryPort` e
  `MemoryRecord`/`MemoryPolicy`/`MemoryRepositoryPort`;
- (b) nenhum import de `@/db`, `drizzle-orm` ou `src/server/repositories`;
- (c) type-only de fato: toda declaração de topo é `import type`, `interface` ou `type` — zero valor
  executável;
- portas conferidas por AST: `EventRepositoryPort` = `append`/`publishPending`; `MemoryRepositoryPort`
  contém `append`/`search`/`delete`.

## Validação (sem `| tail`; sem banco, sem `.env`)

| Comando                                             | Exit | Resultado                                      |
| --------------------------------------------------- | ---- | ---------------------------------------------- |
| `npx vitest run src/test/contracts.test.ts`         | 0    | 1 arquivo / 8 testes                           |
| `npm run typecheck`                                 | 0    | `tsc --noEmit` sem erros                       |
| `./node_modules/.bin/prettier --check` (3 arquivos) | 0    | `All matched files use Prettier code style!`   |
| `./node_modules/.bin/eslint` (3 arquivos)           | 0    | sem avisos                                     |
| `npm run m02:boundaries`                            | 0    | `M-02 BFF boundary is clean`                   |
| `npm run m02:matrix:check`                          | 0    | `M-02 matrix is deterministic and up to date.` |

## Manifest request

**Nenhum.** O overlay já apontava os dois paths para `src/server/contracts/*` (`contract-only`,
`docs/specs/M-02/matrix.overlay.yaml:35,44,91,104`) e `m02:matrix:check` segue verde no HEAD do escopo:
os arquivos novos não importam banco (nem type-only de `@/db`), não contêm
`context.transaction`/`request.transaction` e não entram em `directDatabaseFiles`/`transactionSites`.
Nenhum arquivo `matrix*` foi tocado; `contract-only` permanece a classificação correta (declaração
adiantada, sem implementação).

## HANDOFF

- **Estado:** escopo do prompt concluído e verde localmente; sem push. Commit único com staging
  explícito (3 arquivos novos + esta evidência): `feat(contracts): contratos Event (M-04) e Memory (M-05) — apenas tipos`.
- **Token DB:** não usado (nenhum teste toca banco); nenhum lock `/tmp/opencode/onda1-db.lock` tomado.
- **Próximo (S):** nada a aplicar em matrix; seguir para a integração da Onda 1 Batch 2. M-04/M-05
  continuam PENDING — estes contratos não autorizam iniciar outbox nem memória.
- **Fora do escopo (não tocado):** `package.json`, lockfile, `AGENTS.md`, PROGRESS,
  `EXECUTION-STATE-PROGRAM.md`, `plan-partials/**`, `.github/**`, `matrix*.yaml`, `src/db/**`;
  nenhum push/rebase/amend/force, nenhum `git add -A`, nenhum `npm install`.
