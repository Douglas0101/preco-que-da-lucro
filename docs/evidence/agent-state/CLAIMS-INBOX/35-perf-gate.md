# CLAIM — 35

- **wp / squad / branch / commit:** WP-A1 · SQUAD-PERF · `mission/a1-perf-gate` · `91152be` (gate/evidência) + commit seguinte (este claim) sobre a base `1f94b56`
- **spec_ref:** §35 (Plano Mestre `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:2001-2013`) · §45 (DoD) · `docs/evidence/agent-state/SPEC-CARDS/35-perf-gate.md` · AGENTS.md "Evidência de performance"
- **status pleiteado:** **DONE**
- **fix pós-integração (MAESTRO, `npm run check` em HEAD integrado):** o gate BASE reprovava o **próprio spec-card** (`docs/evidence/agent-state/SPEC-CARDS/35-perf-gate.md`, descoberto por basename). Neste branch isso não ocorre: a árvore de processo `agent-state/**` fica fora da varredura, aplicada pela **única** fonte de descoberta (`discoverPerfEvidence`) usada inclusive pelo teste da árvore real — com teste de regressão T6 nos dois lados (fluxo não reprova / artefato real sem rótulo continua reprovando).

## Cadeia SDD

### 1. SPEC-CARD

`docs/evidence/agent-state/SPEC-CARDS/35-perf-gate.md` (lido inteiro). Motivo da reabertura: a descoberta era por basename com allowlist de 3 nomes de legado; no HEAD os 2 descobertos estavam ambos na allowlist ⇒ a checagem dos 7 rótulos rodava sobre conjunto **vazio** e o artefato vigente `docs/evidence/perf-controlled-2026-09-13/report.md` (0/7 rótulos) escapava.

### 2. TEST-FIRST — prova de falha inicial

**(R0) gate BASE passa vazio** (estado inicial `1f94b56`, antes de qualquer edição):

```console
$ cd .worktree-mA1 && npx vitest run src/test/perf-evidence.test.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**(R0b) contagem de candidatos da descoberta BASE** (predicado por basename + allowlist de 3 nomes, replicados do arquivo base):

```console
$ node -e '<reprodução da descoberta BASE>'
BASE descobertos (basename perf-*/*-perf-*): 2
  - docs/evidence/perf-after-2026-08-29.md (allowlist → ISENTO)
  - docs/evidence/perf-baseline-2026-08-29.md (allowlist → ISENTO)
BASE checados de verdade: 0
BASE perf-controlled-2026-09-13/report.md descoberto? false
```

⇒ 2 descobertos, **0 checados de fato**, artefato vigente nem descoberto: vacuidade reproduzida.

**(R1) os testes novos contra a lógica BASE** (cópia descartável `src/test/tmp-perf-base.test.ts`, removida logo após o run):

```console
$ npx vitest run src/test/tmp-perf-base.test.ts --disable-console-intercept
     × T1: descoberta vazia REPROVA (fail-closed) 6ms
     × T1b: diretório `perf-*` sem nenhum `.md` contratado REPROVA 1ms
     × T2: falta de QUALQUER um dos 7 rótulos REPROVA (bundle `perf-*/report.md` incluído) 4ms
     × T3: artefato contratado completo PASSA (e o que está fora do contrato não é inspecionado) 2ms
     × T4: a allowlist de legado é explícita, mínima e ancorada em conteúdo 2ms
     × T5: na árvore real o gate inspeciona > 0 artefatos e inclui o baseline controlado 5ms
 Test Files  1 failed (1)
      Tests  6 failed | 1 passed (7)
```

**(R2) gate endurecido, ainda SEM o artefato contratado** — ele passa a reprovar exatamente o artefato que escapava:

```console
$ npx vitest run src/test/perf-evidence.test.ts
 FAIL  … > T5: na árvore real o gate inspeciona > 0 artefatos e inclui o baseline controlado
AssertionError: expected 'docs/evidence/perf-controlled-2026-09…' to be ''
+ docs/evidence/perf-controlled-2026-09-13/report.md: rótulo(s) ausente(s): hypothesis, metric, before, change, after, result, decision
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

### 3. IMPLEMENT

- `src/test/perf-evidence.test.ts:71-76` — `isPerfEvidencePath`: contrato **por caminho** — todo `.md` sob `docs/evidence/**` que esteja dentro de um diretório iniciado por `perf-` (bundle) **ou** se chame `perf-*.md`/`*-perf-*.md`.
- `src/test/perf-evidence.test.ts:78-95` — `discoverPerfEvidence`: varre `docs/evidence/**`, ignora `SKIPPED_DIRS` (`:55`) e devolve caminhos relativos normalizados.
- `src/test/perf-evidence.test.ts:108-111` — **fail-closed**: descoberta vazia ⇒ `failures = [EMPTY_DISCOVERY_FAILURE]` (`:52-53`), mensagem explícita; nunca passa.
- `src/test/perf-evidence.test.ts:28-50` — allowlist de legado **reduzida de 3 para 2** entradas com justificativa escrita: `perf-baseline-2026-08-29.md` e `perf-after-2026-08-29.md` são `dev-evidence` pré-gate (commit `53f09e4`) com raw em `/tmp` não versionado (preencher os 7 rótulos exigiria inventar número). A isenção é **ancorada em conteúdo** — o arquivo precisa declarar o regime `dev-evidence` (`:118-128`); nome sozinho **não** isenta. A 3ª entrada (`explain-critical-queries-2026-08-21.md`) foi **removida**: nunca casou nenhum predicado de caminho (entrada morta).
- `src/test/perf-evidence.test.ts:55-69` — `SKIPPED_DIRS`: fora da varredura ficam `_templates/**` (esqueleto) e `agent-state/**` (árvore de processo da missão SDD). Sem a segunda, nomes mandatórios de fluxo como `35-perf-gate.md` (spec-card e este claim) casariam `*-perf-*` e reprovariam o gate — foi exatamente o defeito pego pelo `npm run check` no HEAD integrado. A exclusão vive na **única** função de descoberta (`discoverPerfEvidence`, `:78-95`), consumida tanto pelo laço de rótulos quanto pelo teste da árvore real.
- `src/test/perf-evidence.test.ts:241-253` (T5) — árvore real: `failures` vazio, >0 descobertos/checados, o artefato novo e o `report.md` entre os checados, e `discovered.some(p => p.startsWith("agent-state/")) === false` (`:250`).
- `src/test/perf-evidence.test.ts:256-271` (T6, regressão exigida na integração) — fixture com `agent-state/SPEC-CARDS/35-perf-gate.md` **e** `agent-state/CLAIMS-INBOX/35-perf-gate.md`: nenhum é varrido nem reprova, enquanto `perf-captura-2026-01-01/report.md` sem o rótulo `decision` **continua reprovando** (fail-closed preservado).
- `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md:1-73` — artefato §35 contratado do baseline CONTROLADO: cabeçalho obrigatório (ambiente/método/n/janela/fonte) + os 7 rótulos (`:31-62`), com números do raw já versionado (n=5 por rota, commit `42d4b76`, IA mockada, chat HTTP n=0). Sem sugestão de produção.
- `docs/evidence/perf-controlled-2026-09-13/report.md:14-26` — bloco §35 no artefato que antes escapava; agora **descoberto e checado**.
- `docs/evidence/_templates/performance-evidence.md:3-10` — contrato de descoberta atualizado (antes descrevia o predicado por basename, obsoleto).

Nada fora desses 4 arquivos foi tocado: sem `scripts/perf/**`, sem `src/lib/**`, sem evidência de outra pasta.

### 4. EVIDENCE — comando + saída colada

```console
$ cd /home/douglas-souza/preco-que-d-main/.worktree-mA1 && npx vitest run src/test/perf-evidence.test.ts --disable-console-intercept

 RUN  v4.1.11 /home/douglas-souza/preco-que-d-main/.worktree-mA1

gate §35: 4 descoberto(s) por caminho, 2 checado(s) contra os 7 rótulos, 2 na allowlist de legado

 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  02:22:39
   Duration  728ms (transform 38ms, setup 91ms, import 24ms, tests 15ms, environment 493ms)
```

**(R3b) simulação do HEAD integrado** — com o spec-card REAL copiado para `docs/evidence/agent-state/SPEC-CARDS/35-perf-gate.md` (o cenário que reprovava no `npm run check`), o gate continua verde e o card **não** entra na varredura; a cópia temporária foi removida logo depois (worktree limpo):

```console
$ cp docs/evidence/agent-state/SPEC-CARDS/35-perf-gate.md .worktree-mA1/docs/evidence/agent-state/SPEC-CARDS/  # simulação
$ npx vitest run src/test/perf-evidence.test.ts --disable-console-intercept
gate §35: 4 descoberto(s) por caminho, 2 checado(s) contra os 7 rótulos, 2 na allowlist de legado
 Test Files  1 passed (1)
      Tests  8 passed (8)
   Start at  02:22:26
   Duration  730ms (transform 41ms, setup 91ms, import 30ms, tests 17ms, environment 490ms)
$ rm -rf docs/evidence/agent-state/SPEC-CARDS   # artefato temporário removido (git status limpo)
```

Não-vacuidade provada: **4 descobertos** por caminho — `perf-baseline-2026-08-29.md`, `perf-after-2026-08-29.md`, `perf-controlled-2026-09-13/perf-evidence.md`, `perf-controlled-2026-09-13/report.md` — **2 checados** contra os 7 rótulos: o artefato novo **é um deles**, e `report.md` (o que escapava) também. Os 2 legados seguem isentos pelo regime declarado no próprio arquivo.

```console
$ git diff --stat 91152be~1
 docs/evidence/_templates/performance-evidence.md   |  13 +-
 .../perf-controlled-2026-09-13/perf-evidence.md    |  73 ++++++
 docs/evidence/perf-controlled-2026-09-13/report.md |  14 ++
 src/test/perf-evidence.test.ts                     | 271 ++++++++++++++++++---
 4 files changed, 328 insertions(+), 43 deletions(-)
```

Verde também sem o flag de console (o `console.log` do T5 fica oculto pelo reporter padrão): `Test Files 1 passed (1) / Tests 8 passed (8)`.

### 5. (este arquivo)

### 6. ADVERSARIAL

(vazio — preenchido pelo verificador designado pelo MAESTRO)

### 7. LEDGER

(vazio — preenchido pelo MAESTRO)

## Cobertura da aceitação do SPEC-CARD

| #   | critério                                                                                                        | onde                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | descoberta vazia ⇒ falha com mensagem explícita                                                                 | `:108-111` + T1 `:178` e T1b `:188`                                          |
| 2   | descoberta por caminho (`docs/evidence/perf-*/**` e `**/*perf-*.md`)                                            | `:71-76` + T2 `:195` (bundle `perf-*/report.md`) e T5 `:241`                 |
| 3   | artefato do baseline no caminho contratado com os 7 rótulos + `CONTROLLED`/n/ambiente/commit                    | `docs/evidence/perf-controlled-2026-09-13/perf-evidence.md`                  |
| 4   | rejeita rótulo faltante, rejeita conjunto vazio, aceita artefato novo; allowlist de legado reduzida/justificada | T2 `:195-205` (7 casos), T1/T1b, T3 `:206-219`, T4 `:220-240`, T6 `:256-271` |
| 6   | (fix de integração) artefato de processo sob `agent-state/**` não reprova e a régua segue fail-closed           | T5 `:250` (árvore real) + T6 `:256-271`                                      |
| 5   | evidência com comando + saída + vermelho→verde + contagem > 0                                                   | seções 2 e 4 acima (R0→R3)                                                   |

## Limites declarados

- **Regime `CONTROLLED`, não `OBSERVED`:** todos os números do artefato vêm do raw de `docs/evidence/perf-controlled-2026-09-13/` (preview Nitro local + PostgreSQL 17 em Docker + IA mockada; n=5 por rota; chat HTTP n=0). Nada foi estimado nem re-medido: `npm run perf:capture` **não** foi executado nesta missão (harness intocado, container `:5432` intocado).
- **`report.md` é gerado** por `scripts/perf/summarize.mjs`; o bloco §35 nele é mantido à mão. Regenerar o arquivo apaga o bloco e o gate **reprova** com a lista dos 7 rótulos ausentes (aviso explícito no próprio bloco, `report.md:15-18`). Corrigir o gerador está fora do escopo de WP-A1 (SPEC: "não mexer em `scripts/perf/**`").
- **Escopo de varredura:** `docs/evidence/agent-state/**` fica fora por ser árvore de processo da missão (SPEC-CARDS/CLAIMS-INBOX/PROGRESS), não de evidência de performance; sem isso o nome mandatório `35-perf-gate.md` (card e claim) seria reprovado — defeito real observado no `npm run check` do HEAD integrado, onde o gate BASE ainda reprovava o próprio spec-card. Fora dessa árvore o predicado literal do SPEC (`**/*perf-*.md`) permanece, inclusive para arquivos profundos fora de `perf-*/` (T6 fixa os dois lados). **Enquanto este branch não for integrado, o `npm run check` do HEAD integrado continua reprovando o card** — a correção é esta branch.
- **Não executado:** suíte completa (`npm run test`), `typecheck`, `lint`, `format:check` project-wide e `build` — validação global é do MAESTRO. Rodei somente o arquivo tocado e `prettier --write` nos 3 arquivos editados.
- `AGENTS.md:59` ainda descreve o predicado antigo por basename — não editado (arquivo compartilhado entre worktrees; proposta abaixo evita conflito de merge).

## Propostas de integração (quem aplica é o MAESTRO)

1. `AGENTS.md:59` → "Evidência de performance segue `docs/evidence/_templates/performance-evidence.md` (7 campos) e é enforçada por `src/test/perf-evidence.test.ts`, que descobre por **caminho** (`docs/evidence/perf-*/**` e `perf-*.md`/`*-perf-*.md`), reprova descoberta vazia e isenta apenas 2 artefatos `dev-evidence` pré-gate."
2. Ao copiar este worktree para o repositório principal, trazer `docs/evidence/agent-state/CLAIMS-INBOX/` (diretório novo neste branch).
3. Backlog §35 (fora de WP-A1): `scripts/perf/summarize.mjs` emitir o bloco §35 no `report.md` gerado, eliminando o bloco mantido à mão.
4. Backlog §35: migrar os 2 artefatos de legado para o contrato (exige raw re-derivável) e então **zerar** a allowlist.

## Rollback

`git revert 91152be` (commit atômico; nada fora de `src/test/perf-evidence.test.ts`, `docs/evidence/perf-controlled-2026-09-13/**` e `docs/evidence/_templates/performance-evidence.md` foi tocado). O commit do claim é independente e pode ser revertido junto.

## ADVERSARIAL (preenchido pelo verificador designado)

- **verificador:** V-A1 (fresh, read-only)
- **veredicto:** **CONFIRMED** — vacuidade da base reproduzida (2 candidatos por basename, 0 checados), gate novo 8/8 com fail-closed provado, 7 rótulos testados um a um, 6 números do artefato re-derivados do raw. Correção de integração aplicada em `91152be` (fonte única de descoberta + `agent-state/**` fora da varredura), achada pelo `npm run check` no HEAD integrado.
- **status recomendado:** DONE

## LEDGER (preenchido pelo MAESTRO)

- **promoção:** PARTIAL → DONE
- **integração:** I-M5 · merge `d71be7b`
- **placar após a integração:** 82,89% → 83,16%
- **nota:** ver `docs/evidence/agent-state/SPEC-DELTAS/DECISOES-STEWARD-2026-09-15.md` para as interpretações ratificadas.
