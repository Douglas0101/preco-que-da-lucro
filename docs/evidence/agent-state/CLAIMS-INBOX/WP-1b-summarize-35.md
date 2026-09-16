# CLAIM — WP-1b (summarize §35: o gerador não pode apagar o contrato)

- **wp / squad / branch / commit:** WP-1b · SQUAD-APP-N1B · `mission/n1b-summarize` · **commit único do item** = script + teste + template + artefato regenerado + este CLAIM (`git log -1 --format=%H` no worktree `.worktree-n1b`); nada pushado.
- **spec_ref:** SPEC-CARD `docs/evidence/agent-state/SPEC-CARDS/WP-1b-summarize-35.md` (lido na íntegra) · Plano Mestre §35 · `AGENTS.md` (evidência de performance: 7 rótulos, descoberta por caminho, fail-closed) · `docs/evidence/_templates/performance-evidence.md` · limite declarado no claim `CLAIMS-INBOX/35-perf-gate.md:142`.
- **status pleiteado:** DONE (evidência **E1** do worktree; **E2** — `npm run check` no HEAD integrado — é do MAESTRO).
- **escopo de arquivos tocados:** `scripts/perf/summarize.mjs` · `src/test/perf-summarize.test.ts` (o `perf-*.test.ts` de §35 que já existia) · `docs/evidence/_templates/performance-evidence.md` · `docs/evidence/perf-controlled-2026-09-13/report.md` (**artefato gerado**, regenerado no repo — declarado abaixo) · este CLAIM. Nada mais.

## 1. Problema atacado

`scripts/perf/summarize.mjs` regenerava `docs/evidence/perf-controlled-2026-09-13/report.md` **sem** o bloco §35: o bloco era mantido à mão e a próxima regeneração derrubava o gate `§35` sem que o operador tivesse feito nada errado. Reprodução do defeito **antes** do fix (gerador do `HEAD`, raw real, cópia em `/tmp`), com o mesmo predicado de presença de rótulo do gate:

```text
$ git show HEAD:scripts/perf/summarize.mjs > /tmp/oldfix/old/scripts/perf/summarize.mjs
$ node /tmp/oldfix/old/scripts/perf/summarize.mjs --dir /tmp/oldfix/raw-old
report.md gerado em ../raw-old/report.md (5 rotas, 5 rotas com query, 3 amostras de IA).
$ node /tmp/oldfix/new/scripts/perf/summarize.mjs --dir /tmp/oldfix/raw-new      # gerador atual
report.md gerado em ../raw-new/report.md (5 rotas, 5 rotas com query, 3 amostras de IA).

PRÉ-FIX  gerador do HEAD      → rótulos presentes: 0/7 | AUSENTES: hypothesis, metric, before, change, after, result, decision
PÓS-FIX  summarize.mjs atual  → rótulos presentes: 7/7 | bloco §35 completo
```

## 2. Cadeia SDD

### S2 — RED (teste primeiro)

5 casos novos em `src/test/perf-summarize.test.ts` (`describe("§35 — o report gerado carrega os rótulos do contrato")`), que replicam o predicado do gate (rótulo presente **e com valor não vazio**) sobre a seção `## §35` do markdown gerado:

```text
$ npx vitest run src/test/perf-summarize.test.ts
 ❯ src/test/perf-summarize.test.ts (13 tests | 5 failed)
     × T1: o bloco §35 traz os 7 rótulos, todos com valor
     × T1b: nada é inventado — os valores do bloco seguem o raw
     × T1c: rótulos de julgamento podem vir declarados no raw (`meta.section35`)
     × T1d: a decisão derivada é conservadora — métrica primária ausente ⇒ `follow-up`, captura medida ⇒ `keep`
     × T1e: o `report.md` gravado por summarizeDir carrega o bloco (é o arquivo que o gate varre)

AssertionError: o report gerado não tem a seção `## §35`: expected -1 to be greater than or equal to 0
 ❯ section35Block src/test/perf-summarize.test.ts:377:61

 Test Files  1 failed (1)
      Tests  5 failed | 8 passed (13)
```

Poder discriminante declarado por teste: T1 = presença dos 7 rótulos com valor (proxy do gate); T1b = os valores **seguem o raw** (dobra a prontidão medida no raw e exige que o bloco acompanhe: `120.0` → `240.0`/`276.0`) ⇒ nada inventado; T1c = precedência do texto declarado em `meta.section35`; T1d = precedência da decisão derivada; T1e = o arquivo **gravado** por `summarizeDir` (o que o gate varre).

### S3 — GREEN (implementação)

Em `scripts/perf/summarize.mjs` (~268 linhas, nenhuma exportação nova — `summarize.d.mts` intocado): o bloco `## §35 — rótulos de evidência de performance` passa a ser emitido por `section35Lines(data)` entre o cabeçalho e `## Método`, com os 7 rótulos derivados do raw:

- regime (`meta.label`), **n**/**warmup** (`meta.iterations`/`warmupIterations`), **ambiente** (`baseUrl`, `database{host,database,driver}`, `aiMock{enabled,latencyMs}`, `node`/`platform`, `playwright`), **janela** (`startedAt → finishedAt`) e **commit de origem** (`meta.commit`);
- `after` derivado das métricas medidas (`route-samples.jsonl` → prontidão p50/p95 por rota, TTFB, server fn, LCP/CLS; `context-tx.jsonl` → RT/evento e transação p50; `bundle-report.json` → entry/grafo/PASS-FAIL; `ai-model-attempts.jsonl`/`chat-samples.jsonl` → AI latency e chat);
- o que o raw não tem vira `N/A`/lacuna declarada (`before`/`change`), **nunca número inventado**;
- rótulos de **julgamento** têm precedência quando declarados verbatim no raw (`meta.section35.<rótulo>`);
- `decision` derivada e conservadora: `keep` quando a métrica primária (amostras de rota) existe — lacunas ficam declaradas —, `follow-up` quando não há amostra de rota; `revert` nunca é derivado;
- **fail-closed no próprio gerador**: rótulo vazio lança `§35: rótulo \`x\` ficou vazio — o gate reprovaria o report` em vez de gravar um artefato incompleto.

```text
$ npx vitest run src/test/perf-summarize.test.ts
 Test Files  1 passed (1)
      Tests  13 passed (13)
```

### S4 — E1 (evidência provisória)

**(a) Regenerar mantém o gate verde** — o artefato versionado **foi regenerado no repo** (`node scripts/perf/summarize.mjs`, comando sem argumentos = diretório padrão), como o card autoriza:

```text
$ node scripts/perf/summarize.mjs
report.md gerado em docs/evidence/perf-controlled-2026-09-13/report.md (5 rotas, 5 rotas com query, 3 amostras de IA).

$ npx vitest run src/test/perf-evidence.test.ts          # gate §35, arquivo do WP-1c: INTOCADO
gate §35: 4 descoberto(s) por caminho, 2 checado(s) contra os 7 rótulos, 2 na allowlist de legado
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**(b) Idempotência**: duas regenerações seguidas diferem **só** na linha `- Gerado em:` (nenhuma variação de número/label):

```text
$ cp docs/evidence/perf-controlled-2026-09-13/report.md /tmp/perf-n1b/gen1.md && node scripts/perf/summarize.mjs
$ diff /tmp/perf-n1b/gen1.md docs/evidence/perf-controlled-2026-09-13/report.md
6c6
< - Gerado em: 2026-09-16T03:11:25.409Z
---
> - Gerado em: 2026-09-16T03:13:04.678Z
```

**(c) Diff do artefato regenerado (21 inserções / 12 deleções; o resto do relatório é byte-idêntico)** — nenhum número mudou em relação ao bloco mantido à mão; o que mudou foi a **proveniência** (nota “mantido à mão” → “gerado”) e o acréscimo de métricas derivadas que o texto à mão não tinha (`server fn p50 17.7–31.1 ms`, RT/evento por rota, faixa de CLS), mais a `decision` que permaneceu **`keep`**:

```diff
-- Gerado em: 2026-09-13T15:30:04.880Z
+- Gerado em: 2026-09-16T03:13:04.678Z
-> Bloco mantido à mão: `scripts/perf/summarize.mjs` não o emite (regenerar este
-> arquivo exige recolocá-lo). O artefato §35 completo — método, n, janela,
-> limites e follow-ups — é `perf-evidence.md`, neste mesmo diretório.
+> Bloco **gerado** por `scripts/perf/summarize.mjs` a partir do raw deste diretório (...):
+> nenhum número é estimado — o que o raw não tem vira lacuna declarada. (...)
 - **after:** prontidão p50/p95 (n=5 por rota): `/inicio` 2490,0/2526,6 ms; ...
+- **after:** valores desta captura, no mesmo método e regime do `before`:
+  - prontidão p50/p95 — `/diagnostico` 2476.0/2518.0 ms; `/inicio` 2490.0/2526.6 ms; ...
+  - TTFB p50 3.8–6.3 ms; server fn p50 17.7–31.1 ms
+  - bundle `assets/index-BfoIlnr6.js` 268.4 KiB min / 83.6 KiB gzip, grafo inicial 459.0 KiB ≤ 500000 B → PASS
+  - AI latency n=3 p50 36.0/p95 36.9 ms; chat HTTP n=0 — circuito completo não medido
+- **decision:** `keep` — adotar como referência do regime `CONTROLADO`: métrica primária medida
+  (prontidão de rota, 5 rota(s)), 5 lacuna(s) declarada(s) no raw (§Lacunas declaradas). (...)
```

**(d) Mutação morta (T2 do card) — em CÓPIA, nunca no repo.** Cópia integral de `scripts/perf/summarize.mjs`, `src/test/perf-summarize.test.ts`, `vitest.config.ts`, `package.json` e `src/test/setup.ts` em `/tmp/mut` (com `node_modules` simbólico), removendo o rótulo `result` do gerador:

```text
$ diff <(sed -n '/^const SECTION_35_LABELS/,/^];/p' scripts/perf/summarize.mjs) \
       <(sed -n '/^const SECTION_35_LABELS/,/^];/p' /tmp/mut/scripts/perf/summarize.mjs)
7d6
<   "result",

$ cd /tmp/mut && <worktree>/node_modules/.bin/vitest run src/test/perf-summarize.test.ts
 ❯ src/test/perf-summarize.test.ts (13 tests | 3 failed)
     × T1: o bloco §35 traz os 7 rótulos, todos com valor
     × T1c: rótulos de julgamento podem vir declarados no raw (`meta.section35`)
     × T1e: o `report.md` gravado por summarizeDir carrega o bloco (é o arquivo que o gate varre)

AssertionError: expected [ 'result' ] to deeply equal []
- []
+ [ "result" ]

 Test Files  1 failed (1)
      Tests  3 failed | 10 passed (13)
```

O repo **nunca** teve o rótulo removido: `grep -c '"result"' scripts/perf/summarize.mjs` = `1` (o mutante só existiu em `/tmp/mut`).

**(e) Mutação extra (gerador fail-closed)** — mesma montagem em `/tmp/mut-b`, agora com o valor do rótulo `result` vazio em vez do rótulo ausente:

```text
$ cd /tmp/mut-b && <worktree>/node_modules/.bin/vitest run src/test/perf-summarize.test.ts
Error: §35: rótulo `result` ficou vazio — o gate reprovaria o report
 ❯ section35Lines scripts/perf/summarize.mjs:435:13
 Test Files  1 failed (1)
      Tests  10 failed | 3 passed (13)
```

**(f) Verificação auxiliar (fora do pedido, para não deixar o E2 do MAESTRO quebrar por causa deste item):** `npx tsc -p tsconfig.json --noEmit` → `exit=0`; `npx prettier --check` nos 4 arquivos tocados → *All matched files use Prettier code style*.

### Como reproduzir

```bash
cd /home/douglas-souza/preco-que-d-main/.worktree-n1b
npx vitest run src/test/perf-summarize.test.ts src/test/perf-evidence.test.ts   # 21 passed
node scripts/perf/summarize.mjs && npx vitest run src/test/perf-evidence.test.ts # gate verde após regenerar
```

## 3. Diff do item

```text
 docs/evidence/_templates/performance-evidence.md   |  20 ++
 docs/evidence/perf-controlled-2026-09-13/report.md |  33 ++-   (artefato gerado, regenerado no repo)
 scripts/perf/summarize.mjs                         | 268 ++++++
 src/test/perf-summarize.test.ts                    | 112 ++++
 4 files changed, 422 insertions(+), 12 deletions(-)   (+ este CLAIM, 1 arquivo novo)
```

## 4. Auto-avaliação de riscos (declarados, não escondidos)

1. **Julgamento declarado vs derivado.** O bloco gerado troca a prosa histórica do bloco à mão por padrões derivados: `before`/`change` saem `N/A` + ponteiro para `meta.section35.<rótulo>`. As informações que só existiam na prosa à mão (o `before` de `dev-evidence` não é comparável; o harness `scripts/perf/*` nasceu no commit `42d4b76`) **não** desaparecem do repositório — seguem em `perf-evidence.md:antes/depois`, que é o artefato §35 revisável e é para onde o bloco aponta. Re-ancorar essa prosa no bloco exigiria declarar `meta.section35` no raw, e **o raw (`meta.json`) está fora do meu escopo** — não o toquei.
2. **`decision` derivada é mecânica.** `keep` se existe amostra de rota (lacunas ficam declaradas em `result`/§35), `follow-up` se não existe **ou se o raw declara um par antes/depois sem decisão declarada** (regra acrescentada em F1, §6); `revert` nunca sai do gerador. Para o baseline controlado a decisão **permaneceu `keep`** (consistente com `perf-evidence.md`), mas o critério agora é do gerador, não do autor — quem quiser outro valor declara `meta.section35.decision`.
3. **Nenhum número mudou**, mas o artefato tem `- Gerado em:` novo (`2026-09-16T03:13:04.678Z`); janela/commit da captura seguem `2026-09-13` / `42d4b76`. Regenerar no repo foi autorizado pelo card (“artefato gerado somente se a regeneração for executada no repo — diga no claim”): **foi**.
4. **Detalhe a mais, não a menos:** o `after` gerado é mais granular que o texto à mão (`server fn p50`, RT/evento por rota, faixa de CLS). Todos derivados do mesmo raw — conferi que prontidão/TTFB/bundle/AI/chat batem valor a valor com o bloco removido.
5. **Formato numérico:** o bloco gerado usa ponto decimal (`.`) como o resto do relatório gerado; o bloco à mão usava vírgula pt-BR. Cosmético, mas é um diff visível.
6. **`hypothesis` do bloco** afirma a re-derivabilidade da captura (a alegação do artefato), não uma hipótese de produto de §5. Hipótese de produto se declara em `meta.section35.hypothesis` — limite do que o raw permite derivar.
7. **Risco residual do gate:** nada foi afrouxado — `src/test/perf-evidence.test.ts` está **intocado** (é do WP-1c) e continua fail-closed com descoberta vazia; a allowlist de legado segue com 2 entradas de conteúdo; o gerador agora é *adicionalmente* fail-closed (lança em rótulo vazio).
8. **Drift de runbook achado fora do escopo — RESOLVIDO por ordem do STEWARD** (ver §6, `WP-1b-reg`/`a37ae76`): `docs/runbooks/performance-evidence.md:37-39` listava **3** entradas na “allowlist de legado”, incluindo `explain-critical-queries-2026-08-21.md` — o gate atual tem **2** (a terceira foi removida como entrada morta, `src/test/perf-evidence.test.ts:47-49`). Não era defeito da minha spec-card ⇒ **sem SPEC-DELTA**; corrigido em commit separado depois do veredicto.
9. **Falso alarme já corrigido durante o trabalho:** uma edição com caminho relativo caiu no repo principal (`preco-que-d-main`) em vez do worktree; restaurei o blob do `HEAD` no mesmo instante (`git show HEAD:src/test/perf-summarize.test.ts > src/test/perf-summarize.test.ts`, `git status` limpo, sem `git checkout -f`/stash) e segui só com caminhos absolutos do worktree. Todos os artefatos deste claim vêm do worktree.

## 5. O que explicitamente NÃO foi feito

- **Não** toquei `src/test/perf-evidence.test.ts` (WP-1c) nem enfraqueci o gate; a suíte do gate roda o arquivo do HEAD, sem edição.
- **Não** toquei `scripts/perf/capture-baseline.mjs` (desnecessário): o item é sobre o sumarizador.
- **Não** editei o raw da captura (`meta.json`, `*.jsonl`, `bundle-report.json`, `server-stdout.txt`): nenhum `meta.section35` foi declarado; nenhum artefato de evidência foi apagado ou renomeado (só `report.md` foi regenerado).
- **Não** gerei exportação nova em `summarize.mjs` ⇒ `scripts/perf/summarize.d.mts` intocado.
- **Não** rodei `npm run check`, suíte completa, `npm run build` nem `check:bundle` (E2 é do MAESTRO); rodei apenas os 2 testes do item (`perf-summarize`, `perf-evidence`), `tsc -p tsconfig.json --noEmit` e `prettier --check` dos 4 arquivos.
- **Não** subi container, não usei o PG17 efêmero e **não** toquei `:5432`: o item não executa banco (nenhum env de conexão foi usado).
- **Não** escrevi no `EXECUTION-STATE-PROGRAM.md`, `QUEUE.md`, `PROGRESS.md`, `SUPERVISION-LOG.md`, `DECISIONS-PENDING/**`, ledger ou em qualquer arquivo de outro worktree.
- **Não** commitei nada em `main`/outras branches nem dei `push`; o item saiu em `9f6f158` e as correções do veredicto em commits separados (§6).
- **Não** atualizei `CLAIMS-INBOX/35-perf-gate.md` (arquivo de outro item já encerrado); o drift do runbook (item 4.8) só foi corrigido depois de ordem explícita do STEWARD (§6, `WP-1b-reg`).

## 6. Correções pós-veredicto adversarial (S6 = CONFIRMED, 2026-09-16)

O verificador confirmou DONE (7 rótulos re-derivados, 21/21 testes, idempotência, gate verde pós-regeneração, nenhum número medido alterado) e apontou 2 defeitos não bloqueantes + 1 item docs-only do STEWARD. Todos corrigidos em **commits separados**, com os testes re-executados ao final.

### F1 (P2) — `a75eec8`

`resultText`/`decisionText` **nunca consultavam `meta.section35`**: com `before`/`change` declarados, o bloco se contradizia. Reprodução (raw real + par declarado em `/tmp/n1b-f1/raw`), ANTES do fix:

```text
- **before:** p50 3000 ms (n=5, captura 2026-09-10, fonte docs/evidence/perf-baseline-2026-09-10.md)
- **result:** referência registrada, **sem alegação de ganho**: não há par antes/depois no mesmo regime; …
- **decision:** `keep` — adotar como referência do regime `CONTROLADO`: …
```

Regressão escrita antes (T1f) e capturada em RED:

```text
$ npx vitest run src/test/perf-summarize.test.ts
 ❯ src/test/perf-summarize.test.ts (14 tests | 1 failed)
     × T1f: par antes/depois declarado no raw não é contradito pelo `result`/`decision` derivados
AssertionError: expected '- **result:** referência registrada, …' not to contain 'sem alegação de ganho'
 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```

DEPOIS do fix (`hasDeclaredPair()`: com par declarado, o `result` aponta o par e o ganho como leitura do autor; a `decision` derivada vira `follow-up` exigindo `meta.section35.decision` declarado):

```text
$ node scripts/perf/summarize.mjs --dir /tmp/n1b-f1/raw
- **result:** referência registrada: o par antes/depois é declarado em `meta.section35` — o ganho não é calculado pelo gerador (a leitura do par é do autor); …
- **decision:** `follow-up` — par antes/depois declarado em `meta.section35` sem decisão declarada: o gerador não calcula ganho nem perda; declare `meta.section35.decision` (`keep`/`revert`) com o julgamento …

$ npx vitest run src/test/perf-summarize.test.ts src/test/perf-evidence.test.ts
 Test Files  2 passed (2)
      Tests  22 passed (22)
```

O artefato versionado **não** mudou com o fix: regenerar em `/tmp/n1b-f1/plain` difere do commitado **só** na linha `- Gerado em:`. Sem par declarado nada muda (`sem alegação de ganho` + `keep` continuam, cobertos por T1f).

### F2 (P3) — `3c081a1`

`docs/evidence/perf-controlled-2026-09-13/perf-evidence.md`: follow-up (3) do rótulo `decision` marcado como **concluído no WP-1b (`9f6f158`)** e "Cadeia de proveniência" passa a descrever o bloco §35 **gerado** pelo sumarizador (antes: "mantido à mão (o gerador não o emite)"). Nenhum número medido do artefato foi alterado.

### WP-1b-reg (docs-only, ordem do STEWARD) — `a37ae76`

`docs/runbooks/performance-evidence.md`: descoberta do gate descrita como é hoje (**por caminho**, incluindo o `report.md` gerado; `_templates/**` e `agent-state/**` fora; descoberta vazia reprova); **allowlist de legado 3 → 2 entradas** (`perf-baseline-2026-08-29.md`, `perf-after-2026-08-29.md`), com a justificativa de que `explain-critical-queries-2026-08-21.md` era entrada morta (nunca descoberta por caminho); nota de que o bloco §35 gerado não é mais mantido à mão.

### Verificação final (após os três commits)

```text
$ npx vitest run src/test/perf-summarize.test.ts src/test/perf-evidence.test.ts
 Test Files  2 passed (2)
      Tests  22 passed (22)
$ npx prettier --check scripts/perf/summarize.mjs src/test/perf-summarize.test.ts \
      docs/evidence/_templates/performance-evidence.md \
      docs/evidence/perf-controlled-2026-09-13/perf-evidence.md docs/runbooks/performance-evidence.md
All matched files use Prettier code style!
$ git log --oneline -4
a37ae76 docs(runbook): descoberta e allowlist do gate §35 alinhadas ao gate vigente (WP-1b-reg)
3c081a1 docs(evidence): a proveniência do baseline controlado cita o gerador §35 (F2)
a75eec8 fix(perf): bloco §35 não pode contradizer par antes/depois declarado (F1)
9f6f158 perf(evidence): gerador do report passa a emitir o bloco §35 (WP-1b)
```
