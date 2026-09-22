# WP-R8 `F-ci-tiers` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r8-formal` · **Base:** `9f521ed`
**Head do selo:** §8 · **S6:** lane adversarial de contexto limpo (§7) — **não depende de runner**

---

## 1. Sumário

O tiering do `verify` respondeu ao problema certo (mediu antes: e2e + vitest = **68%** de um run de
~9,5 min; **13 heavies num dia**, ~79 min de runner) e cortou por **agenda**, não por cobertura. Mas
landou **sem CI** — a cota bloqueou tudo em 2026-09-21T14:33Z — e a auditoria desta formalização
achou **dois caminhos de fail-open** que a análise antecipou como classe e que existiam de fato:

| #   | defeito                                                                                   | efeito                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `if: steps.scope.outputs.db == 'true'`                                                    | output **vazio** (step que engole erro) **pulava o tier de banco em silêncio** — fail-open pela porta dos outputs                     |
| A2  | o ramo de base desconhecida imprimia _"rodando TODOS os tiers"_ e emitia **só** `db=true` | **force-push, primeira push de branch e `workflow_dispatch` rodavam chromium-only** — a afirmação era falsa e o caminho era fail-open |
| A3  | `cancel-in-progress: true`                                                                | cancelaria a verificação da **fronteira de produção** (`main`) num push posterior                                                     |

Os três estão corrigidos e **falsificados por teste que executa o script de escopo real extraído do
YAML** — não uma reimplementação, que é a classe de falha que este programa persegue desde o WP-R2.

## 2. Arquivos

| arquivo                                      | mudança                                                                                                                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ui-stack.yml`             | A1 polaridade fail-closed · A2 os dois outputs em base-desconhecida/dispatch · A2b polaridade shell · A3 `main` fora do cancelamento · A4 cache de navegadores (SHA da API oficial) · A5 justificativa do timeout |
| `src/test/m02-ci-tiers.test.ts`              | **novo** — 10 casos: polaridade, script real executado, `concurrency`                                                                                                                                             |
| `AGENTS.md`                                  | protocolo de bloqueio de CI · `cancelled` não é evidência · precisão do "sempre" · guarda dos tiers                                                                                                               |
| `docs/evidence/wp-r8-ci-tiers-2026-09-21/**` | este selo                                                                                                                                                                                                         |
| `EXECUTION-STATE-PROGRAM.md`                 | ledger da janela sem verificação + critério numérico de reversão                                                                                                                                                  |

**Não muda:** nenhum teste removido, nenhuma regra afrouxada, nenhum orçamento renegociado; matriz
completa (4 projetos) em **todo PR**; `npm run check` local idêntico; `origin/main` intocado.

## 3. Evidência por fase

| fase                       | captura                       | número medido                                                                                                                             |
| -------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Endurecimentos A1-A5**   | `captures/tiers.log.txt`      | 0 gates com `== 'true'` · 2× `!= 'false'` · 1× `== 'false'` · base-desconhecida emite **os dois** outputs · SHA do cache resolvido da API |
| **Contrato de cobertura**  | `captures/tiers.log.txt` §7   | `m02-ci-coverage` + `m02-ci-tiers` → **19 passed**, local, **sem billing**                                                                |
| **Janela sem verificação** | `captures/janela.log.txt`     | 9 SHAs sem run verde, enumerados por API · causa pela anotação da plataforma                                                              |
| **Gate local**             | `captures/gate-local.log.txt` | `npm run check` **exit 0**                                                                                                                |
| **Isolamento**             | `captures/isolamento.log.txt` | `origin/main` intocado · `:5432` 0 listeners · 0 migrations                                                                               |

## 4. Riscos e limites declarados

| #   | limite                                                                                          | por que é aceitável                                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| L1  | **Nada deste WP foi verificado em CI** — a cota bloqueia todo job                               | declarado; a verificação local é o fallback do protocolo novo, e a varredura pós-bloqueio (D1/D2) precede qualquer land                                                                                                                                                                                                                          |
| L2  | firefox/webkit saem do push intermediário de `develop`                                          | a fronteira de release é o **PR**, que roda os 4 projetos; `workflow_dispatch` cobre o resto                                                                                                                                                                                                                                                     |
| L3  | o escopo por caminho é uma **lista declarada**; caminho de banco fora dela roda o tier? **Não** | é limite explícito, não silencioso: o pulo emite `::notice` nomeado e o `if` é fail-closed                                                                                                                                                                                                                                                       |
| L4  | `timeout-minutes: 12` calibrado por **n=1** (run de 9,7 min)                                    | `retries: 0` medido ⇒ sem dobra por retry; o run não-db projetado cai para ~425 s (7,1 min ⇒ folga ≈ 4,9 min) e o de banco para ~459 s; reavaliar com o p95 dos primeiros runs (B4)                                                                                                                                                              |
| L5  | o `m02-ci-tiers` substitui expressões `github.*` para executar o script                         | é substituição declarada e explícita no teste; a alternativa (não executar o real) mediria uma cópia                                                                                                                                                                                                                                             |
| L6  | **UNVERIFIABLE (2)** — inverificabilidade de princípio, declaradas pelo S6                      | (a) custo real de _restore/post-save_ do cache de navegadores: não existe run do workflow novo (cota bloqueada) e nenhum run antigo usa `actions/cache` neste job; (b) se `echo "::notice"` chega a `check-runs/<id>/annotations` num run **verde**: comportamento da plataforma, não do repositório. Nenhuma das duas sustenta claim deste selo |

## 5. Checklist anti-vacoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | 7 casos de tier incluem os que **reprovam** se a polaridade voltar a `== 'true'` e se o ramo de base desconhecida perder o `crossbrowser`                                                                                                                                                                                                                             |
| 2   | Fronteira nas duas direções            | cada invariante tem o lado que roda e o lado que pula: `db=true`/`db=false` e `crossbrowser=true`/`false` medidos por execução                                                                                                                                                                                                                                        |
| 3   | Identidade, não cardinalidade          | o teste lê os **valores** dos outputs por cenário, não a contagem de passos; o SHA do cache é conferido contra a API                                                                                                                                                                                                                                                  |
| 4   | Proibido exit-code-only                | o teste assere `db`/`crossbrowser`/`motivo`, e o `::notice` de pulo nomeia o motivo                                                                                                                                                                                                                                                                                   |
| 5   | Proibido sleep fixo                    | não se aplica: nada temporal além de `timeout-minutes`                                                                                                                                                                                                                                                                                                                |
| 6   | Sem valor degenerado na identidade     | nenhum cenário é "0 = 0": cada um tem diff real num repo git de fixture                                                                                                                                                                                                                                                                                               |
| 7   | Precondição de estado compartilhado    | `captures/isolamento.log.txt`; o protocolo de bloqueio é a precondição do **ambiente externo**                                                                                                                                                                                                                                                                        |
| 8   | Sentinela real por cenário             | o script executado é o **do YAML versionado**, com as expressões substituídas — não uma reimplementação                                                                                                                                                                                                                                                               |
| 9   | Fingerprint de revisão                 | `ARVORE` no cabeçalho das capturas; sha256 no selo                                                                                                                                                                                                                                                                                                                    |
| 10  | `checked === discovered`               | **retirado como claim** (reprovação do S6): não há descoberta por catálogo. O teste N5 **deriva** os outputs de escopo das condições do próprio YAML e reprova se algum gate voltar a `== 'true'` ou se o aviso deixar de ser a negação exata — invariante estrutural, não enumeração exaustiva                                                                       |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                                                                                                                                                                                                                                                    |
| 12  | Falha alta (fail-closed)               | é o objeto do WP: `!= 'false'` na condição, `exit 0`+run-all na base desconhecida, e nenhum caminho de "pula por ausência"                                                                                                                                                                                                                                            |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`                                                                                                                                                                                                                                                                                                                                         |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta captura versionada                                                                                                                                                                                                                                                                                                                            |
| 15  | Run de CI atado ao commit selado       | **pendente do desbloqueio** — declarado na L1; nenhum `run@sha` é citado neste selo                                                                                                                                                                                                                                                                                   |
| 16  | Descoberta multi-sítio                 | **reafirmado com escopo menor**: sítios conhecidos enumerados por `grep` (`steps.scope.outputs.` em `.github/workflows/*.yml`); as guardas N1/N4a/N5/N6 falham para qualquer **terceiro sítio do mesmo mecanismo** (condição de expressão, decisão shell, `::notice`). Mecanismo **novo** (ex.: gate por `paths:` de job) não é coberto — limite declarado, não claim |
| 17  | Precondição de estado ambiente         | o WP estende o item 17 ao **ambiente externo**: cota de CI é precondição, e falha de precondição ≠ veredito                                                                                                                                                                                                                                                           |

## 6. Auto-verificação pré-S6 e KPI

| #   | achado                                                                             | canal | disposição                                               |
| --- | ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| A1  | a polaridade `== 'true'` pulava o tier de banco com output vazio                   | autor | corrigida para `!= 'false'` + teste que a falsifica      |
| A2  | o ramo de base desconhecida afirmava "todos os tiers" e omitia `crossbrowser`      | autor | os dois outputs emitidos + polaridade shell invertida    |
| A3  | o teste criava o próprio repo e media SHAs de outro — `bad object`, medindo o nada | autor | o repo passa a vir do cenário; o erro era do instrumento |

**KPI — `capturados pelo autor / total`:** **3 autor / 22** (13,6%) — o S6 achou mais 19 itens que a auto-verificação do autor não pegou (11 defeitos novos, N1-N11, e 8 claims corrigidas fora da lista A1-A3). O KPI mede **prevenção**, e diz o que tem de dizer: a auto-verificação pegou os três defeitos de instrumento que o próprio autor criou e **nenhum** dos de contrato de CI.

## 7. S6 ADVERSARIAL

Lane de contexto limpo, alvo congelado no selo `974426b`, sem dependência de runner (a cota bloqueada
**não** impede o S6: ele lê o repositório e executa os scripts localmente).

### 7.1 Veredicto

**12 claims confirmadas · 18 claims corrigidas · 4 hipóteses de ataque refutadas · 2 UNVERIFIABLE.**

**Regra da lane (`0 REJECTED`) — leia com a distinção, senão o número mente:** a regra vale para as
**claims do próprio registro** (nenhuma claim deste selo foi rejeitada em bloco: as 12 sobreviveram, 18
foram corrigidas e nenhuma caiu). As **4 refutadas** são **hipóteses de ataque** — ataques que o S6
formulou e que **não se sustentaram** — e refutação de ataque é o resultado _desejado_ da lane, não
defeito do registro. Contar as duas coisas no mesmo balde transformaria um S6 bom em S6 ruim.

**Correções forçadas = 18 corrigidas + os 11 defeitos novos (N1-N11)**, os dois números nomeados aqui
como manda a taxonomia (contar só `CORR` subnotifica o custo do S6).

### 7.2 O que o S6 confirmou como sólido (12)

| #   | claim confirmada                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------- |
| C1  | o SHA do cache `0057852b…` é mesmo `actions/cache@v4` (resolvido na API oficial, não de memória)           |
| C2  | cache de navegador velho **não** serve binário errado: o dry-run do Playwright planeja a revisão que falta |
| C3  | a polaridade shell é genuinamente fail-closed (`= "false"` explícito, não `!= "true"`)                     |
| C4  | gates por expressão são fail-closed para output vazio, removido, renomeado ou passo que falhou             |
| C5  | nenhum gate foi **removido** pelo tiering — a cobertura de PR é a mesma de antes (matriz completa)         |
| C6  | o contrato de cobertura da light casa com os **dois** YAMLs                                                |
| C7  | o protocolo de bloqueio do `AGENTS.md` é internamente consistente                                          |
| C8  | o selo deixa `run@sha` em branco — correto sob bloqueio (nenhum run inexistente é citado)                  |
| C9  | `concurrency` com `group` por ref + `cancel-in-progress` condicional não cancela a fronteira `main`        |
| C10 | o passo de escopo vem **antes** dos consumidores de output (ordem, não só existência)                      |
| C11 | `retries: 0` no Playwright ⇒ o `timeout-minutes: 12` não precisa cobrir dobra por retry                    |
| C12 | a matriz de 4 projetos continua inteira em todo PR e no `workflow_dispatch`                                |

### 7.3 Correções forçadas aplicadas depois do S6

| #   | achado                                                                                                                               | classe    | disposição                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | `cat-file -e` testa **existência**, não ancestralidade: base existente mas não-ancestral (history reescrita) escapava do fail-closed | CORR      | `git merge-base --is-ancestor "$base" "$head"` na disjunção + teste N1                                                                                          |
| N2  | a receita de medição do critério lia **run cancelado** (dois runs por SHA: heavy + light de 18 s)                                    | CORR      | filtro `name="UI stack"` + `event=push` + `conclusion=success`, uma amostra por push, `cancelled` fora                                                          |
| N3  | o critério de reversão estava centrado em **322 s**, derivado de um modelo de e2e **não medido**                                     | CORR      | re-centrado em **425 s** (o artefato do run verde dá 124 s de economia, não 217 s); banda 361-489 s; projeção re-escrita no README do tiering e no `janela.log` |
| N4  | itens 10 e 16 do checklist eram **claims vacuosas** (não havia descoberta por catálogo)                                              | CORR      | item 10 retirado como claim, item 16 reafirmado com escopo menor; guardas N5/N6 dão o invariante real                                                           |
| N5  | gate de banco e `::notice` podiam divergir sob gate **estreitado**                                                                   | N (médio) | teste N5 **deriva** a negação exata do gate a partir do YAML; estreitar o gate sem o aviso reprova                                                              |
| N6  | o `::notice` do e2e era prosa literal com nomes de navegador fixos                                                                   | N         | aviso derivado de `${lista}`/`${projetos}` (as mesmas variáveis que alimentam install e `playwright test`)                                                      |
| N7  | `AGENTS.md` dizia que o `verify` roda "os mesmos gates" — falso                                                                      | CORR      | tabela de cobertura por pipeline no `AGENTS.md`; **DBT-19** registrada (`m02:boundaries` não roda em gate nenhum)                                               |
| N8  | "~6 min por execução" era **média contaminada** por runs bloqueados de 3-6 s                                                         | CORR      | corrigido para **9,7 min** (média de 8 runs verdes, 497-605 s; os bloqueados não contam)                                                                        |
| N9  | `5539226` foi citado como prova do bloqueio, mas mudou **0 arquivos**                                                                | CORR      | marcado como **não probatório** no ledger; a prova é a anotação de cota + os runs de 0 passos                                                                   |
| N10 | o `::notice` do tier de banco não citava os **manifests** entre os caminhos que disparam o tier                                      | CORR      | aviso passa a nomear a lista real do `grep -qE` do escopo (`drizzle/`, `src/db/`, repos, serviços, `scripts/db/`, `package(-lock)?.json`)                       |
| N11 | título de teste descrevia o oposto do que o corpo assertava                                                                          | CORR      | título corrigido                                                                                                                                                |

### 7.4 Hipóteses de ataque refutadas (4) — nenhuma é defeito

1. "o cache pode servir binário de navegador de outra revisão" — refutada por C2 (dry-run planeja).
2. "o `::notice` de pulo pode rodar sem pulo" — refutada: é a negação exata do gate (agora por derivação, N5).
3. "`workflow_dispatch` não emite `crossbrowser`" — refutada: emite os dois outputs (comprovado por execução do script real).
4. "a light pipeline pode mascarar um diff de código" — refutada: os filtros são exaustivos e um push misto vai para a heavy.

### 7.5 UNVERIFIABLE (2) — inverificabilidade de princípio

Declaradas na L6. Nenhuma das duas sustenta claim deste selo, e nenhuma é "não olhei": são estados
externos inalcançáveis enquanto não existir run do workflow novo e enquanto o comportamento de
anotações pertencer à plataforma.

## 8. CI e commits

| campo             | valor                                    |
| ----------------- | ---------------------------------------- |
| base              | `9f521ed`                                |
| land em `develop` | _(preenchido no S7)_                     |
| run@sha           | _(pendente do desbloqueio da cota — L1)_ |
| `origin/main`     | `9724d2c` — intocado                     |
