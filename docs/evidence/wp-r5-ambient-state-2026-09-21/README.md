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

| #   | limite                                                                                                                                                                | por que é aceitável / o que fica aberto                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | A precondição vale para **geração e verificação**: verificar um selo exige árvore limpa, então um selo histórico não pode ser conferido enquanto outro WP está em voo | fail-closed no lado seguro; contornável por `git worktree` limpo (foi o método usado na captura §B de `selos-sob-deriva`)                                               |
| L2  | Caminhos com caracteres não-ASCII saem na forma citada/escapada do git (`caf\303\251.txt`)                                                                            | direção do erro é **false positive, nunca false negative** — medido em `captures/precondicao-escopo-e-ordem.log.txt`; o arquivo continua sendo classificado como deriva |
| L3  | `--dir .` (raiz do repo como selo) reporta **tudo** como deriva                                                                                                       | over-strict deliberado: selar o repo inteiro não é caso de uso; falha fechado                                                                                           |
| L4  | O item 17 é enforçado **estruturalmente** (contagem, sequência, colunas, origem não degenerada), não semanticamente                                                   | é o mesmo contrato dos itens 1–16: o guard valida forma, a vacuidade semântica é objeto do S6 e da revisão do WP                                                        |
| L5  | O RED determinístico por mutação rende **2** falhas, não as 3 do RED pré-fix                                                                                          | a mutação B não é isomórfica ao estado pré-fix (o ramo N/A sobrevive e passa trivialmente); declarado no rodapé da própria captura                                      |
| L6  | `m02-seal` **não** roda em CI                                                                                                                                         | a precondição não pode quebrar pipeline; em compensação, a deriva só é pega no fluxo local de selagem                                                                   |

**Nenhum defeito novo ficou declarado sem correção neste WP** (ver §7).

## 5. Checklist anti-vacuoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                                                                                                                                                    |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | mutação determinística com sha256: `0b773b90…` → `6e0a8777…` → restaurado `0b773b90…` (`captures/red-mutacao-restaurada.log.txt`); o par reprova com o defeito presente (2 failed) e passa restaurado (28 passed)                                                      |
| 2   | Fronteira nas duas direções            | a taxonomia distingue os **três** lados: `exit 2` indeterminado · `exit 1` provado-falso · `exit 0` provado-verdadeiro (`captures/precondicao-taxonomia.log.txt`), e a suíte pré-existente passa nos dois lados                                                        |
| 3   | Identidade, não cardinalidade          | as asserções nomeiam o caso e o caminho: `PRECONDICAO …: .gitignore` e `revisao nao resolve neste repositorio: deadbeefdeadbeef`; o restore é conferido por sha256, não por contagem de testes                                                                         |
| 4   | Proibido exit-code-only                | o RED da deriva real assere o **texto** (`PRECONDICAO` + `.gitignore`) e o RED do indeterminado assere `not.toContain("ancestralidade falsa")` — não basta o código de saída                                                                                           |
| 5   | Proibido sleep fixo                    | não se aplica: não há sincronização temporal em nenhum ponto do WP                                                                                                                                                                                                     |
| 6   | Sem valor degenerado na identidade     | a identidade é o sha256 do arquivo mutado (64 hex, distinto nos dois estados) e o caminho do arquivo em deriva; nada serializa para `undefined`                                                                                                                        |
| 7   | Precondição de estado compartilhado    | o próprio WP é sobre isso: o selo assere a precondição de árvore antes de tocar no manifesto — provado por `git status` vazio no diretório do R1 após um `--write` que falhou                                                                                          |
| 8   | Sentinela real por cenário             | as capturas usam repos git descartáveis reais (`/tmp/r5-cap`, `/tmp/r5-uall`) e o selo real do R1; nenhuma inferência de lista                                                                                                                                         |
| 9   | Fingerprint de revisão                 | `HEAD` + sha256 do arquivo antes/depois da mutação, e `HEAD` no cabeçalho de cada captura                                                                                                                                                                              |
| 10  | `checked === discovered`               | `m02-seal` no próprio selo (não-vacuidade `0 = 0`, `D ≠ L`); R4 17/17 e R1 13/13 com 0 órfãos contra `git ls-files`                                                                                                                                                    |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                                                                                                                                                     |
| 12  | Falha alta (fail-closed)               | `PreconditionError` → `exit 2` com mensagem nomeada; nenhum `try/catch` converte indeterminado em veredito; a direção dos limites L2/L3 é sempre false positive                                                                                                        |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`: `origin/main` = `9724d2c`, `:5432` 0 listeners, 0 migrations, manifesto/lockfile intocados                                                                                                                                              |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta para uma captura versionada; o `--write` do selo do R1 é um check impresso **com asserção** de não-mutação                                                                                                                                     |
| 15  | Run de CI atado ao commit selado       | §8                                                                                                                                                                                                                                                                     |
| 16  | Descoberta multi-sítio                 | os sítios da precondição são descobertos por `git status`, não por lista; a enumeração dos padrões do `.gitignore` foi feita por `git check-ignore -v` **por padrão** (6 padrões, contagem individual), e o sítio novo (padrão adicionado depois) entra por construção |
| 17  | **Precondição de estado ambiente**     | o WP **é** o item: precondição declarada e verificada em runtime, `exit 2` distinto do `exit 1`, fixture própria nos testes que dependem de estado de repo (repos git descartáveis)                                                                                    |

## 6. Auto-verificação pré-S6 e KPI

Achados capturados **pelo autor antes do S6** (o checklist mede prevenção, não só detecção):

| #   | achado                                                                                                                     | tipo                           | disposição                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | a afirmação "0 ocorrências de `ls-files\|--porcelain`" ficou **falsa no HEAD** (2 ocorrências: a própria precondição nova) | **claim corrigida pelo autor** | `SPEC.md` §2.1 passou a declarar a base (`eef2238` = 0) e o HEAD (= 2, ambas a precondição); captura `selos-sob-deriva` §A registra os dois números |
| A2  | a precondição bloqueia **verificação**, não só geração (selo do R1 recusado enquanto as capturas estavam por commitar)     | limite declarado               | L1                                                                                                                                                  |
| A3  | caminhos não-ASCII são reportados na forma escapada do git                                                                 | limite declarado               | L2 (direção do erro medida)                                                                                                                         |
| A4  | `--dir .` reporta tudo como deriva                                                                                         | limite declarado               | L3                                                                                                                                                  |
| A5  | o `--write` poderia mutar o manifesto antes da precondição falhar                                                          | **verificado e refutado**      | a precondição roda antes de qualquer escrita; provei por `git status` vazio no diretório do R1                                                      |

**KPI:** `capturados pelo autor / total` = **5 / (5 + achados do S6)**. Densidade do S6: ver §7
(série no journal).

## 7. S6 ADVERSARIAL

_(preenchido com o veredicto da lane de contexto limpo)_

## 8. CI e commits

| campo             | valor                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| base              | `eef2238`                                                             |
| commits do WP     | `f986b9c` · `57e0cd5` · `fea7417` · `b6b0b31` · `125ecd5` · `3c6f4ea` |
| land em `develop` | _(preenchido no S7)_                                                  |
| run@sha           | _(preenchido no S8)_                                                  |
| `origin/main`     | `9724d2c` — intocado em todo o arco                                   |
