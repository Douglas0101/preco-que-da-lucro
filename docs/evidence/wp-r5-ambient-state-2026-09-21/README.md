# WP-R5 `F-ambient-state` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r5-ambient-state` · **Base:** `eef2238`
**Head do selo:** preenchido na §8 · **S6:** lane adversarial de contexto limpo (verdicto na §7)

---

## 1. Sumário

Três incidentes em cinco work packages foram a mesma classe de falha — **pressuposto de estado
ambiente não declarado**:

| incidente              | pressuposto                         | como foi pego                                                               |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| WP-R0                  | dependências instaladas no worktree | um teste que spawna `node_modules/.bin/tsx` falhou                          |
| WP-R4                  | histórico git completo              | a heavy falhou no caso positivo e a investigação revelou o negativo vacuoso |
| deriva do `.gitignore` | worktree estável                    | **observação humana** — nenhum mecanismo                                    |

A vacuidade de _asserção_ já estava mecanizada (não-vacuidade, `D ≠ L`, ≥ 1 check aplicável no
`m02-seal`). A vacuidade de _ambiente_ ainda dependia de descoberta reativa. Este WP fecha a classe:

1. **`.gitignore` versionado** — a deriva de 2026-09-20T20:27:41Z sai do worktree e entra na
   história com motivação própria (não de carona num land grande).
2. **Precondição de estado ambiente no selo** — o selo recusa selar com qualquer deriva fora do
   próprio diretório, nomeando os caminhos. É o mecanismo que teria pegado a deriva.
3. **Taxonomia provado × indeterminado** — uma revisão que não resolve deixa de virar veredito.
4. **Item 17 do checklist** — a regra vira contrato enforçado pelo guard nas três superfícies.

## 2. Arquivos

sha256 por arquivo em `captures/hashes.txt`; o manifesto do selo é `MANIFEST.sha256`.

| arquivo                                           | mudança                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.gitignore`                                      | land do bloco já presente no worktree (MCP configs + `deepseek-harness`)                                   |
| `scripts/m02-seal.mjs`                            | `PreconditionError`, precondição de worktree, `parsePorcelain`, `driftForaDoSelo`, taxonomia de exit codes |
| `src/test/m02-seal.test.ts`                       | 3 casos novos (2 invariantes materiais + 1 declaração de N/A)                                              |
| `scripts/m02-work-package-guard.mjs`              | `EXPECTED_ITEMS` 16 → 17                                                                                   |
| `docs/evidence/_templates/work-package.md`        | item 17 + linha de origem                                                                                  |
| `src/test/m02-work-package-guard.test.ts`         | fixture 16 → 17                                                                                            |
| `AGENTS.md`                                       | item 17 na âncora do contrato                                                                              |
| `docs/evidence/wp-r5-ambient-state-2026-09-21/**` | este selo                                                                                                  |

## 3. Evidência por fase

| fase                               | evidência                                     | número medido                                                                                                                           |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Triagem da deriva**              | `SPEC.md` §2.1                                | `.gitignore` com mtime 25 s após `8a981f6`; único padrão que casa arquivo hoje é `deepseek-harness` (=1); os outros 5 casam 0           |
| **Não contaminação dos selos**     | `captures/selos-sob-deriva.log.txt`           | R4 **17 arquivos OK** · R1 **13 arquivos OK** · `checked === discovered`                                                                |
| **Órfãos selado × rastreado**      | `captures/selos-sob-deriva.log.txt` §C        | R4 **17/17** · R1 **13/13** · **0 órfãos**                                                                                              |
| **RED (pré-fix)**                  | `captures/red-seal.log.txt`                   | **3 failed \| 25 passed**                                                                                                               |
| **RED (deriva real)**              | `captures/red-precondicao-real.log.txt`       | `exit 2` nomeando `.gitignore`                                                                                                          |
| **RED determinístico por mutação** | `captures/red-mutacao-restaurada.log.txt`     | sha256 antes `0b773b90…` → mutado `6e0a8777…` → restaurado `0b773b90…`; **2 failed \| 26 passed** sob mutação, **28 passed** restaurado |
| **Taxonomia de exit codes**        | `captures/precondicao-taxonomia.log.txt`      | indeterminado **exit 2** · provado-falso **exit 1** · provado-verdadeiro **exit 0**                                                     |
| **Escopo e ordem da precondição**  | `captures/precondicao-escopo-e-ordem.log.txt` | selo do R1 **intacto** após falha de precondição (`--write` não mutou o manifesto)                                                      |
| **`-uall` necessário**             | `captures/precondicao-untracked-all.log.txt`  | default colapsa em `?? docs/` · `-uall` lista arquivo a arquivo                                                                         |
| **Guard 17 itens**                 | `captures/guard-17.log.txt`                   | `OK (17 itens, 5 secoes, taxonomia e layout do selo)`                                                                                   |
| **Gate local**                     | `captures/gate-local.log.txt`                 | `npm run check` **exit 0** · 93 arquivos · **938 passed \| 13 skipped** · build + bundle                                                |
| **Isolamento**                     | `captures/isolamento.log.txt`                 | `origin/main` = `9724d2c` · `:5432` 0 listeners · 0 migrations · `package.json`/lockfile intocados                                      |

## 4. Riscos e limites declarados

| #   | limite                                                                                                                                                                           | por que é aceitável / o que fica aberto                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | A precondição vale para **geração e verificação**: verificar um selo exige árvore limpa, então um selo histórico não pode ser conferido enquanto outro WP está em voo            | fail-closed no lado seguro; contornável por `git worktree` limpo (método usado na captura §B de `selos-sob-deriva`)                                                                 |
| L2  | `--dir .` na raiz do repo inverte a semântica: `relative(raiz, dir)` vira `""` e **toda** entrada é reportada como deriva                                                        | over-strict deliberado (selar o repo inteiro não é caso de uso); declarado como **DBT-15**                                                                                          |
| L3  | O guard enforça **forma e piso de não-vacuidade** do checklist (contagem, sequência, aridade, demonstração ≥ 40 caracteres e origem não degenerada), **não** vacuidade semântica | um texto longo e vazio de conteúdo passa; é o mesmo contrato dos itens 1–16 e o objeto do S6. Piso calibrado: a menor célula de demonstração do template real tem **84** caracteres |
| L4  | O RED determinístico por mutação rende **2** falhas, não as 3 do RED pré-fix                                                                                                     | a mutação B não é isomórfica ao estado pré-fix (o ramo N/A sobrevive e passa trivialmente); declarado no rodapé da própria captura                                                  |
| L5  | `m02-seal` **não** roda em CI                                                                                                                                                    | a precondição não pode quebrar pipeline; em compensação a deriva só é pega no fluxo local de selagem                                                                                |
| L6  | **N7** (pré-existente): filtrar `endsWith("/MANIFEST.sha256")` não pega a chave nua, então verificar com o diretório do selo como cwd reprova por `hash diverge`                 | fora do escopo deste WP; declarado como **DBT-13** com closure test                                                                                                                 |
| L7  | **N9** (pré-existente): `scanSelo` usa chaves relativas ao cwd, então um manifesto só é válido para o cwd que o escreveu                                                         | fora do escopo; declarado como **DBT-14**                                                                                                                                           |
| L8  | `--run` num clone raso: se o `headSha` do run não existir localmente, a auditoria para em **exit 2** (indeterminado) em vez de reprovar                                          | comportamento pretendido (é a lição do `81cc7ed`); o caso comum `headSha === commit` nem chega a chamar a ancestralidade                                                            |

Nenhum dos três defeitos pré-existentes (N5/N7/N9) foi corrigido aqui — por disciplina de escopo
ficaram **declarados** com closure test em `DEBTS.md`, como manda a taxonomia.

## 5. Checklist anti-vacuoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                                                                                                                                                       |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | mutação determinística com sha256: `0b773b90…` → `6e0a8777…` → restaurado `0b773b90…` (`captures/red-mutacao-restaurada.log.txt`); o par reprova com o defeito presente e passa restaurado                                                                                |
| 2   | Fronteira nas duas direções            | a taxonomia distingue os **três** lados: `exit 2` indeterminado · `exit 1` provado-falso · `exit 0` provado-verdadeiro (`captures/precondicao-taxonomia.log.txt`)                                                                                                         |
| 3   | Identidade, não cardinalidade          | as asserções nomeiam o caso e o caminho (`PRECONDICAO …: .gitignore`, `revisao nao resolve …: deadbeefdeadbeef`); o restore é conferido por sha256, não por contagem de testes                                                                                            |
| 4   | Proibido exit-code-only                | o RED da deriva real assere o **texto** (`PRECONDICAO` + `.gitignore`) e o do indeterminado assere `not.toContain("ancestralidade falsa")`                                                                                                                                |
| 5   | Proibido sleep fixo                    | não se aplica: não há sincronização temporal em nenhum ponto do WP                                                                                                                                                                                                        |
| 6   | Sem valor degenerado na identidade     | a identidade é o sha256 do arquivo mutado (64 hex, distinto nos dois estados) e o caminho em deriva                                                                                                                                                                       |
| 7   | Precondição de estado compartilhado    | o WP **é** sobre isso: o selo assere a precondição antes de tocar no manifesto — provado por `git status` vazio no diretório do R1 após um `--write` que falhou                                                                                                           |
| 8   | Sentinela real por cenário             | repos git descartáveis reais (`/tmp/r5-cap`, `/tmp/r5-uall`) e o selo real do R1; nenhuma inferência de lista                                                                                                                                                             |
| 9   | Fingerprint de revisão                 | `HEAD` + sha256 do arquivo antes/depois de **cada** mutação (três capturas de mutação), e `HEAD` no cabeçalho de todas as capturas                                                                                                                                        |
| 10  | `checked === discovered`               | `m02-seal` no próprio selo; R4 17/17 e R1 13/13 com 0 órfãos contra `git ls-files`; e a **mesma invariante** aplicada às claims de ancestralidade (`mencoes === claims`, S6 N3)                                                                                           |
| 11  | S6 adversarial de contexto limpo       | §7 — 12 claims, 10 CONFIRMED · 2 CORRECTED · **0 REJECTED · 0 UNVERIFIABLE**                                                                                                                                                                                              |
| 12  | Falha alta (fail-closed)               | `PreconditionError` → `exit 2` nomeado; nenhum `try/catch` converte indeterminado em veredito; claims não reconhecidas **reprovam** em vez de serem puladas                                                                                                               |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`: `origin/main` = `9724d2c`, `:5432` 0 listeners, 0 migrations, `package.json`/lockfile intocados                                                                                                                                            |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta para captura versionada; o `--write` no selo do R1 é um check impresso **com asserção** de não-mutação                                                                                                                                            |
| 15  | Run de CI atado ao commit selado       | §8                                                                                                                                                                                                                                                                        |
| 16  | Descoberta multi-sítio                 | a precondição descobre por `git status`, não por lista; os padrões do `.gitignore` foram enumerados por `git check-ignore -v` **padrão a padrão** (6 padrões, contagem individual); e a completude das claims de ancestralidade é uma invariante `checked === discovered` |
| 17  | **Precondição de estado ambiente**     | o WP **é** o item: precondição declarada e verificada em runtime, `exit 2` distinto do `exit 1`, repositório ancorado no diretório do selo, e fixture própria nos testes que dependem de estado de repo                                                                   |

## 6. Auto-verificação pré-S6 e KPI

Achados capturados **pelo autor antes do S6** (o checklist mede prevenção, não só detecção):

| #   | achado                                                                                                                     | tipo                       | disposição                                                   | o S6 também achou?                  |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| A1  | a afirmação "0 ocorrências de `ls-files\|--porcelain`" ficou **falsa no HEAD** (2 ocorrências: a própria precondição nova) | claim corrigida pelo autor | `SPEC.md` §2.1 passou a declarar a base (= 0) e o HEAD (= 2) | corroborou (C3)                     |
| A2  | a precondição bloqueia **verificação**, não só geração                                                                     | limite declarado           | L1                                                           | não                                 |
| A3  | caminhos não-ASCII eram reportados na forma escapada do git                                                                | limite declarado           | **superado**: virou defeito material e foi corrigido (`-z`)  | sim — generalizou para **N1**       |
| A4  | `--dir .` reporta tudo como deriva                                                                                         | limite declarado           | L2 / **DBT-15**                                              | sim (**N5**), com o mecanismo exato |
| A5  | o `--write` poderia mutar o manifesto antes de a precondição falhar                                                        | **verificado e refutado**  | precondição roda antes de qualquer escrita                   | confirmou (sem defeito)             |

**KPI — `capturados pelo autor / total`: 5 / 14 ≈ 36%.**

Composição: 5 capturados pelo autor (A1–A5; A3 e A4 foram depois corroborados e ampliados pelo S6)
e **9 achados que só o S6 viu** — C6/N8 (âncora no cwd: a precondição era tão forte quanto o
diretório de quem chama), C7 (`-uall` superestimado), C9/N4 (célula de demonstração não validada),
N1 (selo com nome não-ASCII inselável), N2 (`->` truncado), **N3 (falso verde: claim não
reconhecida pulada em silêncio)**, N6 (cláusula de ancestral morta), N7 e N9 (pré-existentes).
Densidade do S6: **9 achados novos / 12 claims** — série no journal.

O achado mais importante da lane não foi uma borda de parsing: foi **N3**, um falso verde na
ferramenta anti-vacuidade, exatamente a classe que o programa combate. A resposta não foi só
ampliar o regex — foi aplicar à própria ferramenta a invariante que ela enforça nos outros
(`mencoes === claims`).

## 7. S6 ADVERSARIAL

**Lane:** subagente de contexto limpo, read-only, instruído a falsificar. Veredicto contra
`b6b0b31` (o HEAD andou 5 vezes durante a revisão; o revisor re-verificou os casos afetados no HEAD
final).

### 7.1 Claims × veredicto

| claim                                                                | veredicto                       | nota                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| C1 `.gitignore` versionado, árvore limpa                             | CONFIRMED (dependente de tempo) | medido 0 linhas, depois 5 (capturas novas), depois 0                                                                                  |
| C2 o defeito do symlink é reproduzido, não hipotético                | CONFIRMED (o mais forte)        | `git ls-tree 7716f63 deepseek-harness` → `120000 blob 88708ddd…`; `git ls-tree HEAD` → vazio                                          |
| C3 a deriva não contaminou selo nenhum                               | CONFIRMED (os três)             | 17 e 13 arquivos OK; 17/17 e 13/13 rastreados, 0 órfãos                                                                               |
| C4 taxonomia provado × indeterminado                                 | CONFIRMED                       | fixture própria do revisor                                                                                                            |
| C5 a precondição pega deriva e não dá falso positivo no próprio selo | CONFIRMED                       |                                                                                                                                       |
| C6 precondição ancorada no repo do selo                              | **CORRECTED**                   | em `b6b0b31` o repo vinha do **cwd**; corrigido em `47306e1` (achado independente meu e do revisor)                                   |
| C7 `-uall` é necessário                                              | CONFIRMED **com precisão**      | a necessidade depende da geometria (diretório pai não rastreado) — meu texto dizia "necessário" sem qualificar                        |
| C8 RED honesto                                                       | CONFIRMED                       | base tem 0 ocorrências de `PRECONDICAO` e `…status ?? 1` verbatim                                                                     |
| C9 item 17 enforçado pelo guard                                      | **CORRECTED**                   | enforçava só forma: `\| 17 \| x \| x \| aaaa \|` passava e célula vazia passava; corrigido (piso de 40 + coluna resolvida por header) |
| C10 `npm run check` exit 0                                           | CONFIRMED                       | 12 passos encadeados, 938 passed \| 13 skipped                                                                                        |
| C11 sem runtime/migration/lockfile; `origin/main` intocado           | CONFIRMED                       |                                                                                                                                       |
| C12 reformat do template não perdeu conteúdo                         | CONFIRMED                       | `--ignore-all-space` → 4 hunks: 2 separadores + 2 linhas do item 17                                                                   |

### 7.2 Defeitos novos e disposição

| id  | defeito                                                                                      | disposição                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | selo em diretório com nome não-ASCII era **inselável** (os próprios arquivos viravam deriva) | **corrigido**: `git status -z` (não cita caminhos) + teste                                                                                            |
| N2  | caminho contendo `->` era truncado                                                           | **corrigido**: `-z` separa rename em campo próprio + teste                                                                                            |
| N3  | claim de ancestralidade em hex maiúsculo/tag era **pulada em silêncio** ⇒ **falso verde**    | **corrigido**: regex `[^\s\`]+`+ invariante`mencoes === claims` + 3 testes                                                                            |
| N4  | célula de demonstração do checklist nunca era validada                                       | **corrigido**: coluna resolvida por header + piso de 40 + 2 testes                                                                                    |
| N5  | `--dir .` inverte a semântica                                                                | **declarado** (L2, **DBT-15**)                                                                                                                        |
| N6  | cláusula de ancestral era morta para a forma com barra                                       | **corrigido**: barra normalizada + teste unitário que a exercita                                                                                      |
| N7  | `endsWith("/MANIFEST.sha256")` não pega a chave nua (pré-existente)                          | **declarado** (**DBT-13**)                                                                                                                            |
| N8  | ramo N/A rotulado "selo fora do repositório" para selo **dentro** de um repo                 | **corrigido** em `47306e1` (é o C6); a captura `precondicao-escopo-e-ordem.log.txt` §C dizia "nunca toma o ramo N/A" e **estava errada** nesse commit |
| N9  | `scanSelo` com chaves relativas ao cwd (pré-existente)                                       | **declarado** (**DBT-14**)                                                                                                                            |

**Taxonomia:** CORR = **2** (C6, C9) · N = **9** · **N corrigidos = 6** (N1, N2, N3, N4, N6, N8) ·
**N declarados = 3** (N5, N7, N9) · **correções forçadas = CORR + N corrigidos = 8**.
`0 REJECTED` e `0 UNVERIFIABLE` na lane.

### 7.3 Achado do próprio GATE (não do S6): superfície de tipos em deriva

Ao aplicar as correções acima, o gate local **reprovou no `typecheck`**: `scripts/m02-seal.d.mts` é
uma declaração **mantida à mão** que o `tsc` usa no lugar de inferir do `.mjs`, e os três exports
novos (`countAncestryMentions`, `parseStatusZ`, `driftForaDoSelo`) não estavam lá. O `vitest`
passava — esbuild não consulta a declaração — então o buraco só aparecia no `tsc`.

É a mesma classe do WP inteiro: um artefato que parece autoritativo e não é verificado contra a
fonte. Além de sincronizar, o WP adicionou a trava: um teste assere que **os exports de runtime e
as declarações são o mesmo conjunto** (`checked === discovered` da superfície de tipos, nas duas
direções). Falsificação em `captures/red-superficie-tipos.log.txt` (mutação: declaração removida →
1 falha; restaurada por sha256 → 40 passed).

### 7.4 Correção de escrita declarada

A captura `captures/precondicao-escopo-e-ordem.log.txt` §C afirmava que "o selo REAL **nunca** toma
o ramo N/A". Isso era **falso** no commit em que foi escrito (`b6b0b31`), porque a âncora era o
cwd — o próprio revisor reproduziu o selo real imprimindo a linha N/A. O texto foi corrigido e o
caso virou o teste "ancorar no diretório do selo fecha o contorno por cwd". Registrado aqui em vez
de reescrito em silêncio.

## 8. CI e commits

| campo                                 | valor                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| base                                  | `eef2238`                                                                                                                                            |
| commits do WP                         | `f986b9c` · `57e0cd5` · `fea7417` · `b6b0b31` · `125ecd5` · `3c6f4ea` · `150aab8` · `47306e1` · `347239d` · `ea2c6af` · `9411135` · `83cfd6d` (selo) |
| land em `develop`                     | merge `--no-ff` **`500096e`** (parent `eef2238`)                                                                                                     |
| tip que carrega o **código** sob selo | **`c80ea84`**                                                                                                                                        |
| run@sha (heavy)                       | **`c80ea84@35551394325`** — `UI stack`, `completed/success`, **29/29 passos success**                                                                |
| run@sha (light)                       | `c80ea84@35551394301` — `CI light`, success, 7 de 12 passos aplicáveis ⇒ citado como **cobertura delegada ao heavy do mesmo commit**                 |
| E2 no integrado                       | `npm run check` **exit 0** — 93 arquivos, **952 passed \| 13 skipped** (`captures/e2-integrado.log.txt`)                                             |
| `origin/main`                         | `9724d2c` — **intocado em todo o arco** (conferido antes do merge, depois do merge e depois do push)                                                 |
| ancestralidade                        | `git merge-base --is-ancestor 83cfd6d 500096e` → **exit 0** · `git merge-base --is-ancestor 500096e c80ea84` → **exit 0**                            |

### Regra de parada

O commit que **carrega este selo** é posterior a `c80ea84` e altera **apenas** `docs/evidence/**`
(manifesto e esta seção). Pela garantia de cobertura do `AGENTS.md`, um push só-docs roda a
**light** e o `paths-ignore` pula a heavy — comportamento esperado, não falha. Por isso o run heavy
citado é o do último commit que carrega **código** (`c80ea84`), e a relação entre ele e o commit
selado é **asserida por ancestralidade**, não afirmada em prosa. Este artefato registra a CI de
todos os commits substantivos, inclusive a do fecho no journal, mas **não** afirma o resultado da
execução que o carrega (regra declarada em `L112`).
