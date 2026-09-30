# WP-R7 `F-hardenings` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r7-hardenings` · **Base:** `332da9e`
**Head do selo:** §8 · **S6:** lane adversarial de contexto limpo (§7)
**Escritor do placar:** MAESTRO — a ratificação de 2026-09-21 está registrada na §1.

---

## 1. Sumário

Três endurecimentos não-bloqueantes que a análise de 2026-09-21 pediu **depois** do R0b, mais o
registro da ratificação.

**(a) Guarda temporal (§6.2).** O programa escreve SHAs e prazos **em prosa** — journal, ledger, fila
humana — e os dois envelhecem em silêncio: o `L141` registra um prazo de watcher 5 dias velho no
`REGISTRO-H.md` e o `L131` um `run@sha` que apontava para o commit **anterior** ao WP que dizia
cobrir. Nada reprovava, porque prosa não é executada por gate nenhum. `scripts/m02-temporal-guard.mjs`
define uma **superfície viva** (recortada por _parsing_, não por lista: §1 do `PROGRESS.md`, último
bloco do ledger, tabela aberta do `REGISTRO-H.md`) e duas invariantes: âncora `` `sha` `` que não
resolve reprova, prazo com data no passado reprova. O **journal append-only fica fora por
construção** — linha histórica com prazo vencido é registro do que era verdade então.

**(b) Declaração gerada (§6.3 / DBT-16).** O `scripts/m02-seal.d.mts` era mantido **à mão**: o WP-R5
achou três exports novos sem declaração, com `vitest` verde (esbuild ignora a declaração) e só o
`tsc` reprovando; a trava que entrou naquele WP comparava **nomes**. Agora os tipos vivem no **JSDoc do
módulo** e o `.d.mts` é **gerado** por `scripts/generate-seal-dts.mjs` (`tsc --declaration` +
prettier). A diferença é medida: uma mutação que troca um tipo de retorno de `string[]` para `number`
**compila e mente**, e o teste de nomes do WP-R5 teria passado — a geração reprova.

**(c) Regra de elegibilidade (§7).** A régua do R0b passa a estar escrita no `AGENTS.md`, onde o
próximo agente a lê: sub-item é a unidade, cluster não é; promoção exige conjunção; `PARTIAL` exige
delta nomeado; denominador fixo em 187; fórmula congelada; escritor é o MAESTRO; ausência verificável
é `NS`, nunca `U`.

## 2. Arquivos

| arquivo                                           | mudança                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `scripts/m02-temporal-guard.mjs`                  | **novo** — âncoras e prazos da prosa viva                     |
| `src/test/m02-temporal-guard.test.ts`             | **novo** — 7 casos com fixture git real                       |
| `scripts/generate-seal-dts.mjs`                   | **novo** — gerador do `.d.mts`, com `--check` e `--destino`   |
| `scripts/m02-seal.mjs`                            | JSDoc de tipos nos 16 exports (fonte única)                   |
| `scripts/m02-seal.d.mts`                          | passa a ser **artefato gerado**                               |
| `src/test/m02-seal.test.ts`                       | sincronia de nomes → **geração** + controle negativo          |
| `package.json`                                    | `m02:temporal-guard`, `m02:seal-dts:check`, cadeia do `check` |
| `.github/workflows/ui-stack.yml` · `ci-light.yml` | passo da guarda temporal nos dois pipelines                   |
| `AGENTS.md`                                       | guardas derivadas + **elegibilidade do placar**               |
| `docs/evidence/agent-state/PROGRESS.md`           | §1 com o placar **ratificado** e refs atuais                  |
| `docs/evidence/agent-state/DEBTS.md`              | **DBT-16 FECHADA**                                            |
| `docs/evidence/wp-r7-hardenings-2026-09-21/**`    | este selo                                                     |

**Não muda:** nenhum código de runtime, nenhuma migration, `:5432` intocado, `origin/main` intocado.

## 3. Evidência por fase

| fase                  | captura                         | número medido                                                                                                                                               |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RED temporal**      | `captures/red-temporal.log.txt` | mutação **versionada** (`mutacao-temporal.sh.txt`) assertada no §1 → **T1 e T2 nomeados** (T2 duas vezes, incluindo `sha@run`), `EXIT=1`; sha256 restaurado |
| **RED declaração**    | `captures/red-seal-dts.log.txt` | tipo trocado à mão → `--check` `EXIT=1` **e** `2 failed \| 40 passed`; sha256 restaurado                                                                    |
| **GREEN das guardas** | `captures/verde.log.txt`        | 3 guardas `EXIT=0` · `49 passed` (as duas suítes)                                                                                                           |
| **Gate local**        | `captures/gate-local.log.txt`   | `npm run check` **exit 0**                                                                                                                                  |
| **Isolamento**        | `captures/isolamento.log.txt`   | `origin/main` intocado · `:5432` 0 listeners · 0 migrations                                                                                                 |

**Lição de método registrada na própria captura:** a primeira tentativa de mutação **não aplicou** o
padrão da âncora (o SHA estava entre `**`, e o padrão não o previa) e a captura ficou vacuosa em T2
**sem que o sha256 acusasse** — o hash prova que _algo_ mudou, não que a mutação _pretendida_ foi
aplicada. As capturas passaram a **assertar cada mutação** (texto mutado presente, original ausente).
É a mesma família que a série vem medindo, agora no instrumento da própria captura.

## 4. Riscos e limites declarados

| #   | limite                                                                                                                               | por que é aceitável                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | A guarda mede **resolubilidade** da âncora, não **atualidade** da afirmação                                                          | atualidade do estado é o marcador parent-pinned (`m02:state:check`); a guarda cobre a classe "não resolve"                                      |
| L2  | A superfície viva é de **três** documentos nomeados e cobre **~3%** das linhas de prosa do repo (S6 A4: 80 de 2 719)                 | é declaração explícita, não descoberta por varredura; ampliar é uma linha em `SUPERFICIE`                                                       |
| L3  | **Intenções órfãs não são cobertas** (S6 D2): 16 linhas `▶` sem `✔`/`✘` vivem no journal e são estado vivo pelo protocolo de escrita | o journal fica fora por construção; fechar isso exige recorte por id, que é WP próprio                                                          |
| L4  | T1 é **cego a tempo verbal** e a isenção de errata é uma janela de ±45 caracteres                                                    | o substantivo `prazo` como marcador reprovava a data de re-arme do watcher; isentar a linha inteira escondia o prazo vivo que ela carrega junto |
| L5  | O gerador do `.d.mts` depende de `tsc` e `prettier` do projeto                                                                       | roda no `vitest` (heavy) e no `--check` local, **encadeado no `check`**; a light não instala deps e não o executa                               |
| L6  | `QUEUE.md` continua com o placar anterior                                                                                            | o escritor é o MAESTRO; a divergência está declarada no §1 do `PROGRESS.md`, não corrigida por agente                                           |

## 5. Checklist anti-vacoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                             |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | duas mutações reais (prazo vencido + âncora inventada; tipo de retorno trocado) reprovam e são restauradas por sha256 com a aplicação assertada |
| 2   | Fronteira nas duas direções            | T1 e T2 têm caso RED e caso GREEN; a precondição tem caso próprio (`exit 2`)                                                                    |
| 3   | Identidade, não cardinalidade          | as mensagens nomeiam **o token**, **a data** e **a linha**; o `.d.mts` é comparado byte a byte, não por contagem de exports                     |
| 4   | Proibido exit-code-only                | as capturas trazem a mensagem nomeada, não só `EXIT=1`; o teste assere o texto                                                                  |
| 5   | Proibido sleep fixo                    | não se aplica: nada temporal além de comparação de datas                                                                                        |
| 6   | Sem valor degenerado na identidade     | a superfície real tem 3 âncoras e 1 prazo — não é 0 = 0; recorte vazio é **precondição** (`exit 2`)                                             |
| 7   | Precondição de estado compartilhado    | `captures/isolamento.log.txt`; fixture de teste é repositório git próprio                                                                       |
| 8   | Sentinela real por cenário             | as mutações rodam sobre o arquivo versionado e são restauradas; o fixture é git real                                                            |
| 9   | Fingerprint de revisão                 | `ARVORE` no cabeçalho de cada captura; sha256 antes/depois de cada mutação                                                                      |
| 10  | `checked === discovered`               | a superfície é **recortada por parsing** dos três documentos; recorte vazio reprova com `exit 2` em vez de passar                               |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                              |
| 12  | Falha alta (fail-closed)               | `exit 2` para precondição, `1` para violação, `0` só quando mediu; nada de "sem superfície = OK"                                                |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`                                                                                                                   |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta captura versionada                                                                                                      |
| 15  | Run de CI atado ao commit selado       | §8                                                                                                                                              |
| 16  | Descoberta multi-sítio                 | os dois pipelines recebem o passo; a superfície cobre três documentos; o `.d.mts` cobre os 16 exports                                           |
| 17  | Precondição de estado ambiente         | a guarda declara e verifica as próprias precondições (git, superfície presente, recorte não vazio) e falha fechado                              |

## 6. Auto-verificação pré-S6 e KPI

| #   | achado                                                                                                     | canal | disposição                                               |
| --- | ---------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| A1  | a primeira mutação **não aplicou** e a captura ficou vacuosa sem o sha256 acusar                           | autor | capturas passaram a assertar a aplicação de cada mutação |
| A2  | `resolve` do `node:path` estava **sombreado** pelo resolvedor de git e a guarda dizia "superfície ausente" | autor | renomeado para `resolveGit`; os 7 casos cobrem           |
| A3  | o `tsc` emite `m02-seal.d.mts` (não `.d.ts`) e preserva o caminho sob `--outDir`                           | autor | o gerador procura o emitido e aceita as duas extensões   |
| A4  | o artefato gerado reprovava no `format:check`                                                              | autor | o gerador formata com o prettier do projeto              |

**KPI — `capturados pelo autor / total`:** **4 autor / 4** (100% nesta rodada, que é de ferramenta).

## 7. S6 ADVERSARIAL

**Lane:** subagente de contexto limpo, read-only, alvo **congelado** por `git archive` em `/tmp/s6-r7`
no commit `83b7fc5`; `HEAD` conferido no fim — **inalterado**, worktree limpo. Nenhum `STOP-THE-LINE`
bloqueante (os dois avisos de apresentação estão tratados abaixo).

**Veredicto: 23 CONFIRMED · 6 CORRECTED · 11 REJECTED · 0 UNVERIFIABLE** (40 claims).

### 7.1 O que o S6 derrubou

| #         | achado                                                                                                                                                       | disposição                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1**    | **HIGH** — T1 dava **falso positivo na prática de errata que o próprio repo manda escrever**, e `vence` casava dentro de "con**vence**"                      | corrigido: fronteira de palavra nos marcadores + **isenção por data** (±45 caracteres), não por linha                                                          |
| **N2**    | **HIGH** — T2 era **cego ao construto que motivou a guarda**: 4 dos 6 tokens do §1 são pares `sha@run` e nenhum era auditado                                 | corrigido: `sha@run` auditado pelo sha à esquerda — a captura mostra T2 disparando **duas vezes**, uma no par                                                  |
| **N3**    | **HIGH** — id de run **todo-decimal** era lido como âncora e reprovava                                                                                       | corrigido: hex exige **ao menos uma letra**                                                                                                                    |
| **A3/A5** | **HIGH** — o prazo **vivo** do `REGISTRO-H` (a motivação da §6.2) estava **fora** do recorte                                                                 | corrigido: o recorte passou a "arquivo **menos** a seção `## Fechados`", e a guarda audita a linha (1 prazo vivo)                                              |
| N4        | cache do resolvedor ignorava `prefixo` ⇒ veredicto dependia da ordem                                                                                         | corrigido: chave `token\|prefixo`                                                                                                                              |
| N5        | âncora nua rejeitava árvore/blob, contra a própria INV-R7-a — e a convenção do repo carimba **árvore**                                                       | corrigido: resolução aceita qualquer objeto                                                                                                                    |
| N6        | `2026-13-45` **passava** (rolava para 2027) e `2026-9-1` era invisível                                                                                       | corrigido: validação de data (rollover reprova) e mês/dia com 1 ou 2 dígitos                                                                                   |
| N7        | `tabela-aberta` degradava para o **arquivo inteiro** se o cabeçalho de fronteira sumisse                                                                     | corrigido: fronteira ausente é **precondição** (`exit 2`)                                                                                                      |
| N8        | o passo na light é **incondicional**, ao contrário dos irmãos                                                                                                | **declarado por desenho** no `AGENTS.md`: é a única guarda cuja superfície pode ser quebrada por push só-docs                                                  |
| N9        | `m02:seal-dts:check` não estava encadeado no `check`                                                                                                         | corrigido: encadeado                                                                                                                                           |
| **N10**   | **a captura RED entregue era autocontraditória**: continha um `AssertionError` que o próprio corpo falsificava, e nenhum script de mutação estava versionado | corrigido: `captures/mutacao-temporal.sh.txt` versionado, asserção feita **no recorte** (§1) e não no arquivo — a captura agora mostra a asserção **passando** |
| N11       | `invocadoDiretamente` casava **sufixo de basename**                                                                                                          | corrigido: `pathToFileURL(...).href === import.meta.url`                                                                                                       |
| N12/N13   | contagem impressa imprecisa e janela documentada defasada                                                                                                    | corrigido no texto e no código                                                                                                                                 |

### 7.2 O que o S6 confirmou

O gerador (5 sondas: tipo errado, export novo, JSDoc removido, `import` sem efeito, teste que lê o
disco em vez de se autocomparar), a presença nos três pipelines, o registro da ratificação e a
aritmética (`87,9679%`/`80,2139%`), o `MANIFEST` e a taxonomia de exit codes. O S6 **reproduziu a
mutação da captura byte a byte** (mesmos 4337/4339 B, mesmo sha256) e mediu a cobertura real da
superfície: **80 de 2 719 linhas (2,94%)** — número que passa a estar declarado na L2.

### 7.3 Nota de método

Os dois achados mais caros (N1, N2) são da mesma família: **a guarda media a coisa errada do jeito
certo**. N2 é o mais instrutivo — a guarda nasceu por causa de um `run@sha` stale (`L131`) e **não
enxergava `run@sha`**. Uma ferramenta anti-envelhecimento que não lê o construto que a motivou é
decoração com teste verde; o S6 só descobriu porque injetou o construto exato do fato-fonte.

## 8. CI e commits

| campo                  | valor                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| base                   | `332da9e`                                                                                                        |
| commits do WP          | `c9aeb7c` (guardas + gerador + docs) · `83b7fc5` (selo) · `64da9d6` (correções do S6) · `bccf1bf` (reselo)       |
| land em `develop`      | merge `--no-ff` **`4c2e35d`** (parent `332da9e`)                                                                 |
| run@sha (heavy)        | **`f293368@35611793799`** — `UI stack`, **success** (o fix do incidente abaixo)                                  |
| run@sha (light)        | `90d12f9@35611826235` — `CI light`, success                                                                      |
| **vermelho declarado** | **`4c2e35d@35611076990`** — `UI stack`, **failure** em `npm run m02:temporal-guard` (7 âncoras "não resolvidas") |
| E2 no integrado        | `npm run check` **exit 0** — 96 arquivos, **987 passed \| 13 skipped** (`captures/e2-integrado.log.txt`)         |
| `origin/main`          | `9724d2c` — **intocado em todo o arco**                                                                          |
| ancestralidade         | `git merge-base --is-ancestor bccf1bf 4c2e35d` → **exit 0**                                                      |

### Incidente de CI declarado

A **primeira** heavy do land ficou **vermelha**. Causa-raiz: o checkout do job `verify` é **raso**
(`actions/checkout` sem `fetch-depth`), então os objetos citados na prosa **não existem** no
repositório local e a guarda os reportou como "não resolve" — o modo de falha apontava para a âncora
quando a causa era o **clone**. A light já usava `fetch-depth: 0` e por isso ficou verde no mesmo
commit, o que isolou o diagnóstico.

**Correção em duas direções:** o `verify` passou a `fetch-depth: 0` com o motivo no comentário, e a
guarda passou a declarar a **precondição de ambiente** — clone raso é `exit 2` **nomeado**, nunca
"âncora inexistente". É a **quinta** ocorrência da mesma família na série: o WP-R4 já tinha apanhado
de um teste que dependia de histórico e passava por vacuidade em clone raso.

### Regra de parada

Os commits que carregam este selo e a correção tocam `scripts/**`, `.github/**` e o ledger — **não**
são só-docs, então a heavy roda de verdade neles. O último run heavy verde citado é o do fix
(`f293368`), e o commit que **carrega esta seção** é posterior: altera **apenas** `docs/evidence/**` e
o `MANIFEST`, e por isso roda a light. Esta seção registra a CI dos commits substantivos, **incluindo
a vermelha**, mas **não** afirma o resultado da execução que a carrega (regra de `L112`).
