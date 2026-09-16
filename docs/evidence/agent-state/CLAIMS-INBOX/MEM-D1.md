# CLAIM — MEM-D1

- **wp / squad / branch / commit:** MEM-D1 · SQUAD-MEM · `mission/n1c-mem-d1` · `9e910cc` (deliverable) + `HEAD` (este claim)
- **spec_ref:** degrau **D1** do `docs/evidence/agent-state/MEM-D0-GAP-REPORT.md` (linhas do bloco “D1 — Memory Service + policy engine mínimo”, §3) e §5 do mesmo relatório · decisões do STEWARD em `docs/evidence/agent-state/SPEC-DELTAS/DECISOES-STEWARD-MEM-2026-09-16.md` (A/B/C destravam **D2**; D1 não depende delas) · **INV-004** e **INV-005** (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:256-257`) · §15.3/§15.4/§15.7 · §23.2 (TTL)
- **status pleiteado:** DONE (degrau D1 apenas; a matriz/overlay **não** foi tocada — regeneração é do MAESTRO)

- **cadeia SDD:**
  1. SPEC-CARD: não há SPEC-CARD próprio de MEM-D1 no `SPEC-CARDS/`; a spec do item é o degrau D1 do gap report (lido na íntegra: §0–§8, com o bloco D1 e a §5).
  2. TEST-FIRST (S2): escritos **antes** da implementação `src/test/memory-policy.test.ts`, `src/test/memory-service.test.ts` e `src/test/memory-import-graph.test.ts`; a falha inicial é **por ausência de módulo/arquivo**, não por bug (saída em EVIDENCE-A).
  3. IMPLEMENT (S3):
     - `src/server/contracts/memory.contracts.ts` — ampliação **aditiva** (nada renomeado, nada removido): `MemoryStatus` (`active|superseded`), `MemoryRetention` (`ttlSeconds`), `MemoryRankingWeights` (`recency|importance|confidence`), `MemoryPolicy.retention`/`.ranking`, `MemoryCandidate` e `MemoryRecordInput` como alias do candidato aprovado, `MemoryRecord.status`/`expiresAt?`. Permanece **type-only** (o `contracts.test.ts` pré-existente continua verde).
     - `src/server/services/memory.policy.ts:1-173` — decisão discriminada (`MemoryPolicyDecision`) com precedência fixa **policy → escopo → conteúdo → proveniência → confiança → importância** (`evaluateMemoryPolicy:112-161`), validação fail-closed da própria política (`invalidPolicyDetail:51-75`), proveniência “utilizável” (origem não vazia + instante real, `hasUsableProvenance:77-83`), mapeamento único rejeição → taxonomia existente (`ERROR_CODE_BY_REASON:91-101`, `memoryPolicyError:103-110`) e teto de retrieval `resolveMemoryResultLimit:164-173` (o chamador **nunca** amplia `maxResults`).
     - `src/server/services/memory.service.ts:1-58` — `MemoryService.propose` (candidato → decisão): lança o erro tipado quando rejeitado, devolve `{ candidate normalizado, status: "active", expiresAt }` (TTL vem de `policy.retention`, relógio injetável por `options.now`). Nenhum import de `@/db`/`drizzle-orm`/finance; nenhuma persistência.
     - Normalização: `content.normalize("NFC").trim()` (`memory.policy.ts:128`); o limite de tamanho é medido **sobre a forma canônica**; `inferred`/`confidence` passam intactos (`value: { ...candidate, content }`, `:159`).
     - Limites são **dados**: nenhuma constante de limite no código — trocar `MemoryPolicy` muda o veredito (teste “rejeitado sob policy estrita, aceito sob permissiva”).
  4. EVIDENCE: EVIDENCE-A (RED), EVIDENCE-B (GREEN), EVIDENCE-C (`tsc`), EVIDENCE-D (poder discriminante da asserção de grafo), EVIDENCE-E (escopo do diff).
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

- **EVIDENCE-A — RED (falha por ausência, antes de existir qualquer runtime de memória):**
  ```text
  $ npx vitest run src/test/memory-policy.test.ts src/test/memory-service.test.ts
   RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n1c

   ❯ src/test/memory-policy.test.ts (0 test)
   ❯ src/test/memory-service.test.ts (0 test)

  ⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯

   FAIL  src/test/memory-policy.test.ts [ src/test/memory-policy.test.ts ]
  Error: Failed to resolve import "@/server/services/memory.policy" from "src/test/memory-policy.test.ts". Does the file exist?
    Plugin: vite:import-analysis
  ```
  ```text
  $ npx vitest run src/test/memory-policy.test.ts src/test/memory-service.test.ts src/test/memory-import-graph.test.ts
   FAIL  src/test/memory-import-graph.test.ts > INV-005 — grafo de import da memória > o fecho de runtime da memória não alcança o Financial Engine
  Error: ENOENT: no such file or directory, open '/home/douglas-souza/preco-que-d-main/.worktree-n1c/src/server/services/memory.service.ts'

   Test Files  3 failed (3)
        Tests  4 failed | 1 passed (5)
     Start at  00:12:28
  ```
  (o único teste que passava era `nenhuma saída de memória é consumida pelo cálculo canônico`, que percorre apenas o motor financeiro — os módulos de memória ainda não existiam, logo nada a apontar.)

- **EVIDENCE-B — GREEN (comando do aceite):**
  ```text
  $ npx vitest run src/test/memory-*.test.ts
   RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n1c

   Test Files  3 passed (3)
        Tests  55 passed (55)
     Start at  00:16:09
     Duration  1.94s
  ```
  ```text
  $ npx vitest run src/test/memory-policy.test.ts src/test/memory-service.test.ts src/test/memory-import-graph.test.ts
   RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n1c

   Test Files  3 passed (3)
        Tests  55 passed (55)
     Start at  00:14:38
     Duration  1.83s
  ```
  Cobertura nominal do aceite (rodado com `--reporter=verbose`, `4 passed / 63 tests` incluindo `src/test/contracts.test.ts`):
  ```text
   ✓ memory-policy.test.ts > (a) confiança mínima > rejeita candidato com confidence abaixo de minConfidence
   ✓ memory-policy.test.ts > (b) escopo permitido > rejeita scope fora de allowedScopes
   ✓ memory-policy.test.ts > (c) proveniência obrigatória > rejeita ausência de proveniência quando requireProvenance = true
   ✓ memory-policy.test.ts > (d) tamanho máximo de conteúdo > rejeita conteúdo acima de maxContentLength
   ✓ memory-policy.test.ts > (e) normalização preservando proveniência > normaliza trim + NFC e preserva inferred/confidence intactos
   ✓ memory-service.test.ts > rejeita (a) confiança abaixo do mínimo com VALIDATION_ERROR
   ✓ memory-service.test.ts > rejeita (b) escopo fora de allowedScopes com VALIDATION_ERROR
   ✓ memory-service.test.ts > rejeita (c) proveniência ausente com requireProvenance = true com VALIDATION_ERROR
   ✓ memory-service.test.ts > rejeita (d) conteúdo acima de maxContentLength com VALIDATION_ERROR
   ✓ memory-service.test.ts > aceitação e normalização > normaliza trim + NFC preservando inferred/confidence intactos
   ✓ memory-import-graph.test.ts > INV-005 > nenhum módulo de memória importa o Financial Engine — nem como tipo
   ✓ memory-import-graph.test.ts > INV-005 > o fecho de runtime da memória não alcança o Financial Engine
   ✓ memory-import-graph.test.ts > INV-005 > nenhuma saída de memória é consumida pelo cálculo canônico
   ✓ contracts.test.ts > 'src/server/contracts/memory.contracts.ts' é type-only (nenhum valor executável)
   ✓ contracts.test.ts > 'src/server/contracts/memory.contracts.ts' não importa @/db, drizzle-orm nem repositórios

   Test Files  4 passed (4)
        Tests  63 passed (63)
  ```
  Notas de método (fronteiras e determinismo, não só “caminho feliz”):
  - **Erro tipado**: as rejeições do serviço são `ApplicationError` da taxonomia (`VALIDATION_ERROR`, `status 400`, `retryable false`); política inválida é `INTERNAL_ERROR`/500 (falha de servidor, não de candidato).
  - **Normalização com poder discriminante**: o fixture do conteúdo NFD é verificado (`raw.normalize("NFC") !== raw`) antes de exigir a forma NFC; espaço interno é **preservado** (não colapsado); conteúdo só com espaços é `CONTENT_EMPTY`, não `CONTENT_TOO_LONG`.
  - **`inferred`/`confidence` intactos**: `parse` estrutural da proveniência devolvida (`toEqual` do objeto inteiro) + leitura campo a campo (`inferred true`, `confidence 0.73`) + asserção de que o candidato recebido **não** é mutado.
  - **Limites são dados**: as 6 políticas inválidas e a troca estrita→permissiva provam que o veredito vem de `MemoryPolicy`, não de constante.
  - **`maxResults` é teto**: pedir 100 com `maxResults = 5` devolve 5; pedido inválido (0, -1, 1.5, NaN, 0.5) lança `VALIDATION_ERROR`.

- **EVIDENCE-C — typecheck (S4):**
  ```text
  $ npx tsc -p tsconfig.json --noEmit
  EXIT=0
  ```
  (sem saída; nenhum erro de tipo introduzido no projeto)

- **EVIDENCE-D — a asserção de grafo do INV-005 é capaz de falhar (sonda descartável, revertida):**
  ```text
  $ # sonda 1: import de valor do motor financeiro injetado em memory.service.ts
  $ npx vitest run src/test/memory-import-graph.test.ts
       × nenhum módulo de memória importa o Financial Engine — nem como tipo
       × o fecho de runtime da memória não alcança o Financial Engine
  AssertionError: src/server/services/memory.service.ts → @/lib/financial-values: expected '@/lib/financial-values' not to match /financ/i
  AssertionError: expected [ 'src/lib/financial-values.ts' ] to deeply equal []
       Tests  2 failed | 3 passed (5)

  $ # sonda 2: apenas `import type` do motor financeiro
  $ npx vitest run src/test/memory-import-graph.test.ts
       × nenhum módulo de memória importa o Financial Engine — nem como tipo
       Tests  1 failed | 4 passed (5)
  ```
  Ambas as sondas foram revertidas; o estado final é o do commit (`git status --short` limpo para os dois módulos, EVIDENCE-E). A cláusula de aresta direta é a que pega acoplamento **de tipo**; o fecho de runtime é o que pega dependência executável — e o fecho é não-vacuoso por asserção explícita (`memory.service → memory.policy → @/lib/api-error`).

- **EVIDENCE-E — escopo (S5):**
  ```text
  $ git show --stat 9e910cc
   src/server/contracts/memory.contracts.ts |  36 +++-
   src/server/services/memory.policy.ts     | 173 +++++++++++++++++++
   src/server/services/memory.service.ts    |  58 +++++++
   src/test/memory-import-graph.test.ts     | 187 ++++++++++++++++++++
   src/test/memory-policy.test.ts           | 286 +++++++++++++++++++++++++++++++
   src/test/memory-service.test.ts          | 178 +++++++++++++++++++++++
   6 files changed, 916 insertions(+), 2 deletions(-)

  $ git status --short            # antes do commit do claim
  (vazio)
  ```
  Nenhum arquivo fora do escopo exclusivo do item. `docs/specs/M-02/matrix.yaml` **não** foi tocado (regeração é do MAESTRO).

- **riscos / limites conhecidos:**
  1. **`MemoryRecordInput` passou a ter `provenance` opcional** (era obrigatório). É o port de persistência de um contrato *type-only* sem nenhum consumidor no repositório (verificado: só `src/test/contracts.test.ts` referencia o arquivo). A coerção fica na persistência (D2), conforme a decisão **C** do STEWARD (proveniência 1:N com FKs; `sourceId` derivado/opcional). Se o MAESTRO preferir o `NOT NULL` no port, o ajuste é de uma linha — mas contradiria `requireProvenance = false`.
  2. **`MemoryRecord`/`MemoryPolicy` ganharam campos obrigatórios** (`status`, `expiresAt?`; `retention`, `ranking`). Aditivo para quem **consome** (nenhum consumidor hoje), mas qualquer policy literal futura precisa preencher os dois blocos novos. Justificado pelo próprio gap report (“Ampliar o contrato é parte de D1 … sem congelamento”).
  3. **Definição de “proveniência presente” é um pouco mais estrita que o tipo**: `sourceId` em branco ou `capturedAt` inválido rejeitam como `PROVENANCE_REQUIRED`. É a leitura substantiva de “ausência de proveniência” no aceite (c); D2 deve materializar isso como FK/CHECK.
  4. **`MemoryStatus` tem apenas `active|superseded`** — deliberadamente mínimo (é o que D3 §15.6 e o retrieval `status='active'` exigem). Estados extras (ex.: “em conflito”) só entram se D3 os pedir; `ai_memory_conflicts` é tabela própria.
  5. A rejeição **não** distingue “modelo propôs lixo” de “tool propôs lixo”: o erro é o mesmo `VALIDATION_ERROR`; o discriminante estruturado vai em `cause.reason` (mensagem inclui o `reason`), para log/telemetria.
  6. Nada aqui mede performance nem define SLO (§29) — o degrau é puramente de domínio.

- **o que NÃO foi feito (deliberadamente, por fronteira do degrau):**
  - Sem banco, sem migration, sem tabela, sem repositório, sem `scripts/db/test-memory.ts` (tudo isso é **D2**). Nenhum container, `:5432` intocado, nenhum `npm install`.
  - Sem FTS/`tsvector`, sem embeddings, sem `pgvector`, sem HNSW (§43 “só então embeddings”; D5–D7).
  - Sem ranking efetivo: `MemoryRankingWeights` foi declarado e validado pela policy, mas a composição de score é **D6**.
  - Sem delete/export/access log (**D4**), sem dedup/versões/conflitos (**D3**).
  - Sem `RequestContext`/tenant no serviço: sem persistência não há o que isolar; o predicado de tenant entra junto do repository (D2/D6, §15.8).
  - Sem tocar `docs/specs/M-02/matrix.yaml`/overlay (status `contract-only → implemented` é do MAESTRO), sem ledger/QUEUE/PROGRESS, sem push.
  - Sem rodar `npm run check`, ESLint, build ou a suíte completa (validação project-wide é do MAESTRO na integração).

- **propostas de integração (quem aplica é o MAESTRO):**
  1. `docs/specs/M-02/matrix.yaml:1344-1347` e `matrix.overlay.yaml` — `MemoryService`: `contract-only` → **`implemented`** (agora existe `src/server/services/memory.service.ts`); considerar o mesmo para o **policy engine** se a matriz tiver linha própria. `MemoryRepository`: continua `contract-only` (D2).
  2. Nenhuma alteração de `package.json`, registry de migrations ou `db:test` é exigida por este item (é puramente unitário, sem banco).
  3. Registro para o STEWARD: as decisões **A/B/C** já estão tomadas e foram respeitadas; **nenhum SPEC-DELTA** foi necessário (o contrato foi ampliado de forma aditiva, sem renomear `chat_*` e sem emitir evento de memória).

- **rollback:** `git revert 9e910cc` (o claim é o segundo commit e pode ser revertido junto).
