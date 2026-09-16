# CLAIM — WP-1c (allowlist de legado do §35 → 0)

- **wp / squad / branch / commit:** WP-1c · `SQUAD-SEC-N2A` · `mission/n2a-allowlist` · **commit único do item** = gate + os 2 artefatos de legado + 3 docs vivos que descreviam a allowlist + este CLAIM (`git log -1 --format=%H` no worktree `.worktree-n2a`, base `bc4f8e7`); nada pushado.
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` §WP-1c (lido inteiro) · Plano §35 · `AGENTS.md:59` ("Evidência de performance") · SPEC-CARD `WP-1b-summarize-35.md` (follow-up declarado) · `CLAIMS-INBOX/35-perf-gate.md` (residual: allowlist de 2 legados) · `docs/evidence/_templates/performance-evidence.md` (contrato dos 7 rótulos) · `docs/runbooks/performance-evidence.md`.
- **status pleiteado:** **DONE** — evidência **E1** (provisória, no worktree); **E2** (`npm run check` no HEAD integrado, onde o gate roda) é do MAESTRO.
- **diff stat:**

```text
 docs/evidence/_templates/performance-evidence.md   |  11 ++-
 docs/evidence/perf-after-2026-08-29.md             |  90 ++++++++++++++++++
 docs/evidence/perf-baseline-2026-08-29.md          |  60 ++++++++++++
 .../perf-controlled-2026-09-13/perf-evidence.md    |   2 +-
 docs/runbooks/performance-evidence.md              |  13 +--
 src/test/perf-evidence.test.ts                     | 101 ++++++++++-----------
 6 files changed, 213 insertions(+), 64 deletions(-)
```

(+ este CLAIM é o 7º arquivo do commit do item; o stat acima cobre os 6 arquivos de produto/evidência.)

- **cadeia SDD:**
  1. SPEC-CARD: `docs/evidence/agent-state/SPEC-CARDS/CICLO-2.md` §WP-1c (lido inteiro antes da primeira linha; nenhum SPEC-DELTA necessário)
  2. TEST-FIRST: T4 reescrito exigindo **zero** isenções + T5 exigindo `checked === discovered` na árvore real — RED capturado apontando os 2 legados (§2.1)
  3. IMPLEMENT: `src/test/perf-evidence.test.ts:28-47,98-120,203-245` · `docs/evidence/perf-baseline-2026-08-29.md:114-172` · `docs/evidence/perf-after-2026-08-29.md:304-392` · `docs/evidence/_templates/performance-evidence.md:8-12,79-84` · `docs/runbooks/performance-evidence.md:43-49` · `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md:41-43`
  4. EVIDENCE: §2.3 (comandos + saída colada, não resumida)
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)

## 1. Problema atacado

O gate `src/test/perf-evidence.test.ts` descobria por caminho 4 artefatos e **isentava 2** deles
(`perf-baseline-2026-08-29.md`, `perf-after-2026-08-29.md`, regime `dev-evidence`) via
`LEGACY_ALLOWLIST` ancorada em conteúdo: bastava o arquivo declarar `dev-evidence` no corpo para
**não** ser checado contra os 7 rótulos de §35. A justificativa original (raw em
`/tmp/opencode/vite-dev.log`, não versionado ⇒ preencher os rótulos exigiria inventar número) era
honesta, mas deixava dois artefatos estruturalmente fora do contrato para sempre — e o próprio
`AGENTS.md`/runbook descreviam essa exceção como permanente.

O WP-1c elimina a isenção **sem inventar número e sem apagar medição**: os dois artefatos passam a
carregar o bloco §35 (cabeçalho obrigatório + os 7 rótulos) com os valores já publicados neles, e o
que o log bruto não permite re-derivar sai `N/A` com a lacuna declarada. O gate perde a allowlist e
ganha o invariante explícito `checked === discovered`.

## 2. Cadeia SDD

### 2.1 S2 — RED (teste primeiro, antes de tocar os artefatos)

T4 deixou de afirmar "a allowlist é explícita, mínima e ancorada em conteúdo" e passou a afirmar
"NÃO existe isenção de legado": para **cada** um dos dois caminhos de legado, um arquivo que apenas
declara o regime (`> **RÓTULO GLOBAL: \`dev-evidence\`.**`) agora **reprova** citando os 7 rótulos
ausentes; T5 passou a exigir o invariante `checked === discovered`na árvore real e que os dois
caminhos de legado estejam em`checked`. Saída real do estado inicial (com os artefatos ainda **sem**
o bloco §35):

```console
$ npx vitest run src/test/perf-evidence.test.ts
 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n2a

stdout | src/test/perf-evidence.test.ts > gate §35 — evidência de performance > T5: ...
gate §35: 4 descoberto(s) por caminho, 4 checado(s) contra os 7 rótulos, 0 isento(s)

 ❯ src/test/perf-evidence.test.ts (8 tests | 1 failed) 39ms
     × T5: na árvore real nenhum artefato é isento (checked === discovered) e o baseline controlado entra 12ms

 FAIL  src/test/perf-evidence.test.ts > gate §35 > T5
AssertionError: expected 'docs/evidence/perf-after-2026-08-29.m…' to be '' // Object.is equality

- Expected
+ Received

+ docs/evidence/perf-after-2026-08-29.md: rótulo(s) ausente(s): hypothesis, metric, before, change, after, result, decision
+ docs/evidence/perf-baseline-2026-08-29.md: rótulo(s) ausente(s): hypothesis, metric, before, change, after, result, decision
 ❯ src/test/perf-evidence.test.ts:233:39

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

Poder discriminante: T4 é o teste de **isenção** (um legado sem rótulos deixa de passar, e um legado
com rótulos passa como qualquer artefato — a isenção foi substituída por conformidade); T5 é o
invariante da árvore real (`checked === discovered`, nenhum caminho escapa). T1/T1b/T2/T3/T6 ficaram
intocados e cobrem o fail-closed das duas pontas (descoberta vazia reprova; rótulo faltante reprova,
inclusive em `perf-*/report.md` e fora de `agent-state/**`).

### 2.2 S3 — GREEN (implementação)

**(a) Gate sem isenção** (`src/test/perf-evidence.test.ts`): `LEGACY_ALLOWLIST` **removida** (não
ficou constante vazia, nem campo morto); `PerfEvidenceAudit` perdeu `allowlisted`; o laço de
`auditPerfEvidence:104-120` agora empurra **todo** caminho descoberto para `checked` antes de
checar os rótulos — o único caminho de saída é `failures`. O comentário de cabeçalho (`:28-47`)
registra o histórico do que foi removido e o invariante.

**(b) Os 2 artefatos de legado cumprem o contrato** — bloco §35 anexado ao **fim** de cada arquivo,
sem tocar uma linha de §1–§6 (baseline) / §1–§9 (after):

- `docs/evidence/perf-baseline-2026-08-29.md:114-172` — 7 rótulos: `hypothesis` (o diagnóstico aceito
  de custo fixo ≈8–10 RTs/sessão), `metric` (p50 ms por endpoint; RT-count `N/A` no before),
  `before` (`N/A` + lacuna: **este artefato é o baseline S0**, não existe medição anterior),
  `change` (`N/A`: captura pura, sem mudança de código), `after` (os valores medidos em §1, marcados
  como **referência** e não como depois de mudança), `result` ("referência registrada, sem alegação
  de ganho"; leitura qualitativa calculateBreakEven 0 queries vs listExpenses 1 query),
  `decision` (`follow-up`, com o motivo: fonte `/tmp` não versionada não sustenta `keep`).
- `docs/evidence/perf-after-2026-08-29.md:304-392` — 7 rótulos: `hypothesis` (S1+S3 cortam RTs e o
  p50 dos endpoints-chave), `metric` (RT-count como primária — §2 declara ser a robusta —, RT-count
  before `N/A` porque a instrumentação não existia), `before` (tabela §2 transcrita, com n/janela e
  fonte = `perf-baseline-2026-08-29.md`), `change` (S1+S3 + patch pós-S4 em
  `src/lib/products.functions.ts`), `after` (p50/p95 por endpoint, RT-count n=81 e janela pós-patch,
  LCP RUM), `result` (caiu / não caiu / regrediu-corrigido, com os confundidores e as lacunas),
  `decision` (`follow-up` + 3 próximos passos nomeados).

Em nenhum dos dois blocos há número novo: todos os valores são transcrição do que já estava medido no
próprio arquivo (o `summarize.mjs` não se aplica — esses logs não têm raw versionado). Nada foi
apagado: `git diff` só **adiciona** nesses dois arquivos (60 e 90 linhas adicionadas, 0 removidas).

**(c) Docs vivos que descreviam a allowlist** (cutover limpo — deixar a descrição antiga seria
documentação falsa):

- `docs/evidence/_templates/performance-evidence.md:8-12` — descoberta descrita como é hoje:
  fail-closed + **sem allowlist nem isenção** (`checked === discovered`);
- `docs/evidence/_templates/performance-evidence.md:79-84` — nova regra de honestidade para artefato
  de legado sem raw versionado (preenche com o que está medido, `N/A` + lacuna onde não é
  re-derivável, `decision` = `follow-up`, nunca inventar nem apagar medição publicada);
- `docs/runbooks/performance-evidence.md:43-49` — o bullet "Allowlist de legado — 2 entradas" foi
  substituído pela regra vigente;
- `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md:41-43` — removida a oração
  "é por isso que ele segue na allowlist de legado do gate" (o artefato **não** é reescrito em
  números: só a referência ao mecanismo extinto saiu).

### 2.3 S4 — E1 (evidência provisória, worktree)

```console
$ npx vitest run src/test/perf-evidence.test.ts --disable-console-intercept
 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-n2a

gate §35: 4 descoberto(s) por caminho, 4 checado(s) contra os 7 rótulos, 0 isento(s)

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  00:49:33
   Duration  1.12s
```

```console
$ npx tsc -p tsconfig.json --noEmit
tsc exit=0
```

```console
$ npx prettier --check src/test/perf-evidence.test.ts docs/evidence/perf-baseline-2026-08-29.md \
      docs/evidence/perf-after-2026-08-29.md docs/evidence/_templates/performance-evidence.md \
      docs/runbooks/performance-evidence.md docs/evidence/perf-controlled-2026-09-13/perf-evidence.md
Checking formatting...
All matched files use Prettier code style!
prettier exit=0
```

Prova de **allowlist zero** por código (não por prosa):

```console
$ grep -rn "LEGACY_ALLOWLIST\|allowlisted\|legacyRegime" src/
(0 ocorrências — exit 1)

$ grep -rn "LEGACY_ALLOWLIST\|allowlisted\|legacyRegime" src/ scripts/
scripts/m02-boundaries.ts:191:    "M-02 BFF boundary is clean: all database reachability is allowlisted or repository-only.",
# único hit: mensagem do gate M-02, outro subsistema; nada do gate §35

$ grep -c "LEGACY_ALLOWLIST" src/test/perf-evidence.test.ts
0
```

Fail-closed nas duas pontas, provado no mesmo binário: T1/T1b (descoberta vazia ⇒ `failures` não
vazio), T2 (cada um dos 7 rótulos ausente ⇒ reprova, inclusive `perf-x/report.md`), T4 (legado sem
rótulos ⇒ reprova; com rótulos ⇒ passa), T5 (árvore real: `failures` vazio e `checked === discovered`
com os 2 legados dentro), T6 (fluxo `agent-state/**` fora da varredura; artefato real sem rótulo
segue reprovando).

## 3. Aceitação do card — item a item

| aceitação                                                           | como está satisfeita                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) zero entradas de allowlist                                      | `LEGACY_ALLOWLIST` removida (grep = 0 em `src/`); os 2 artefatos cumprem o contrato (§2.2b) sem perder informação — `git diff` só adiciona linhas; nenhum número inventado (`N/A` + lacuna onde o raw não re-deriva) |
| (2) gate fail-closed (vazio reprova; contratado sem rótulo reprova) | T1/T1b/T2/T4/T6 verdes cobrindo os dois sentidos; invariante `checked === discovered` em T5                                                                                                                          |
| (3) T4 atualizado: legado sem rótulos reprova                       | T4a: os 2 caminhos de legado, só com o regime declarado, reprovam citando os 7 rótulos; T4b: os mesmos caminhos com rótulos passam                                                                                   |

## 4. Riscos e limites declarados

- **E1 é provisório**: a árvore de evidência do worktree é a minha; a autoritativa é o `npm run check`
  do MAESTRO no HEAD integrado (é lá que o gate roda dentro do `test`). O que sustento aqui é: gate
  verde + `checked === discovered` com 4 descobertos, `tsc` 0 e prettier 0 nos 6 arquivos.
- **As remissões restantes à allowlist são de outro dono** (`AGENTS.md:59`, ledger, árvore
  `agent-state/**`, snapshots datados — §5): o gate em si não depende delas, mas o texto vigente fica
  inconsistente até o MAESTRO/STEWARD atualizar (proposta pronta no §6).
- **Regime dos 2 legados é `dev-evidence`** e continua sendo: o bloco §35 não promove nada a SLO nem
  mistura regimes — a `decision` de ambos é `follow-up` justamente por isso.
- **`matrix.yaml`/ledger/QUEUE não foram tocados** (regeneração é do MAESTRO).
- Nada de `scripts/perf/**`, nada de `:5432`, nenhum container, nenhum `npm install`, nenhum push,
  nenhum `EXECUTION-STATE-PROGRAM.md`/`AGENTS.md`.

## 5. O que NÃO foi feito (declarado, não varrido para debaixo do tapete)

1. `AGENTS.md:59` ainda diz que "a allowlist de legado (2 entradas, ancoradas em conteúdo
   `dev-evidence`) exige a marca no próprio arquivo". O card proíbe editar `AGENTS.md` ⇒ **proposta**
   no §6 para o MAESTRO/STEWARD aplicar.
2. `EXECUTION-STATE-PROGRAM.md` (ledger) e a árvore `docs/evidence/agent-state/**` (QUEUE.md,
   SPEC-CARDS, SPEC-DELTAS, claims antigos) mencionam a allowlist — fora do meu escopo por regra da
   missão; entradas históricas de claim **não** devem ser reescritas (são registro), mas QUEUE/ledger
   precisam refletir o novo estado quando o MAESTRO promover.
3. Snapshots datados (`docs/evidence/plan-recap-2026-09-15/*.md`,
   `docs/evidence/plan-partials-2026-09-13/part-2-banco-ci.md`) descrevem o gate de 2026-09-13/15 com
   allowlist — são fotos históricas, não documentação viva: **não** foram tocados de propósito.
4. Não rodei `npm run check`, suíte completa, build nem container (é do MAESTRO); rodei apenas o
   teste do item + `tsc` + `prettier` nos arquivos tocados, como o card manda.
5. Não consolidei/renomeei os 2 artefatos: os dois caminhos são citados por ledger, ADR-025, runbooks
   e artefatos de custódia; consolidar exigiria editar arquivos fora do meu escopo ⇒ escolhi a outra
   alternativa que o card oferece (cumprir o contrato no próprio arquivo).

## 6. Propostas de integração (quem aplica é o MAESTRO)

1. **`AGENTS.md:59`** — trocar a oração final (hoje):

```text
… e a allowlist de legado (2 entradas, ancoradas em conteúdo `dev-evidence`) exige a marca no próprio arquivo.
```

por:

```text
… e não há allowlist nem isenção de legado: todo artefato descoberto é checado (`checked === discovered`), os dois artefatos `dev-evidence` de 2026-08-29 inclusive.
```

2. **QUEUE.md / ledger** — fechar `WP-1c` (allowlist de legado do §35 → 0) apontando este CLAIM;
   nenhuma linha nova em `package.json`, nenhum registry, nenhuma migration.
3. Se o MAESTRO quiser tornar a ausência de isenção uma checagem própria do `check` (fora do teste),
   a evidência desta rodada mostra que **não** é necessária: `checked === discovered` em T5 já falha
   se alguém reintroduzir uma isenção com efeito.
