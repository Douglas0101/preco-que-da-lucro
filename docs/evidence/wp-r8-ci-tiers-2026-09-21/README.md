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

| #   | limite                                                                                          | por que é aceitável                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| L1  | **Nada deste WP foi verificado em CI** — a cota bloqueia todo job                               | declarado; a verificação local é o fallback do protocolo novo, e a varredura pós-bloqueio (D1/D2) precede qualquer land |
| L2  | firefox/webkit saem do push intermediário de `develop`                                          | a fronteira de release é o **PR**, que roda os 4 projetos; `workflow_dispatch` cobre o resto                            |
| L3  | o escopo por caminho é uma **lista declarada**; caminho de banco fora dela roda o tier? **Não** | é limite explícito, não silencioso: o pulo emite `::notice` nomeado e o `if` é fail-closed                              |
| L4  | `timeout-minutes: 12` calibrado por **n=1** (run de 9,5 min)                                    | `retries: 0` medido ⇒ sem dobra por retry; folga ≈ 2,5 min; reavaliar com o p95 dos primeiros runs (B4)                 |
| L5  | o `m02-ci-tiers` substitui expressões `github.*` para executar o script                         | é substituição declarada e explícita no teste; a alternativa (não executar o real) mediria uma cópia                    |

## 5. Checklist anti-vacoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                       |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | 7 casos de tier incluem os que **reprovam** se a polaridade voltar a `== 'true'` e se o ramo de base desconhecida perder o `crossbrowser` |
| 2   | Fronteira nas duas direções            | cada invariante tem o lado que roda e o lado que pula: `db=true`/`db=false` e `crossbrowser=true`/`false` medidos por execução            |
| 3   | Identidade, não cardinalidade          | o teste lê os **valores** dos outputs por cenário, não a contagem de passos; o SHA do cache é conferido contra a API                      |
| 4   | Proibido exit-code-only                | o teste assere `db`/`crossbrowser`/`motivo`, e o `::notice` de pulo nomeia o motivo                                                       |
| 5   | Proibido sleep fixo                    | não se aplica: nada temporal além de `timeout-minutes`                                                                                    |
| 6   | Sem valor degenerado na identidade     | nenhum cenário é "0 = 0": cada um tem diff real num repo git de fixture                                                                   |
| 7   | Precondição de estado compartilhado    | `captures/isolamento.log.txt`; o protocolo de bloqueio é a precondição do **ambiente externo**                                            |
| 8   | Sentinela real por cenário             | o script executado é o **do YAML versionado**, com as expressões substituídas — não uma reimplementação                                   |
| 9   | Fingerprint de revisão                 | `ARVORE` no cabeçalho das capturas; sha256 no selo                                                                                        |
| 10  | `checked === discovered`               | os 10 casos cobrem **todos** os `if:` de escopo do YAML; o teste A1 falha se um gate novo usar `== 'true'`                                |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                        |
| 12  | Falha alta (fail-closed)               | é o objeto do WP: `!= 'false'` na condição, `exit 0`+run-all na base desconhecida, e nenhum caminho de "pula por ausência"                |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`                                                                                                             |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta captura versionada                                                                                                |
| 15  | Run de CI atado ao commit selado       | **pendente do desbloqueio** — declarado na L1; nenhum `run@sha` é citado neste selo                                                       |
| 16  | Descoberta multi-sítio                 | os dois mecanismos de decisão (condição de workflow e `if` shell) foram corrigidos juntos; um terceiro sítio futuro falha pelo teste A1   |
| 17  | Precondição de estado ambiente         | o WP estende o item 17 ao **ambiente externo**: cota de CI é precondição, e falha de precondição ≠ veredito                               |

## 6. Auto-verificação pré-S6 e KPI

| #   | achado                                                                             | canal | disposição                                               |
| --- | ---------------------------------------------------------------------------------- | ----- | -------------------------------------------------------- |
| A1  | a polaridade `== 'true'` pulava o tier de banco com output vazio                   | autor | corrigida para `!= 'false'` + teste que a falsifica      |
| A2  | o ramo de base desconhecida afirmava "todos os tiers" e omitia `crossbrowser`      | autor | os dois outputs emitidos + polaridade shell invertida    |
| A3  | o teste criava o próprio repo e media SHAs de outro — `bad object`, medindo o nada | autor | o repo passa a vir do cenário; o erro era do instrumento |

**KPI — `capturados pelo autor / total`:** **3 autor / 3** (100% — o S6 ainda não rodou).

## 7. S6 ADVERSARIAL

_(preenchido no S6 — lane de contexto limpo, alvo congelado, sem dependência de runner)_

## 8. CI e commits

| campo             | valor                                    |
| ----------------- | ---------------------------------------- |
| base              | `9f521ed`                                |
| land em `develop` | _(preenchido no S7)_                     |
| run@sha           | _(pendente do desbloqueio da cota — L1)_ |
| `origin/main`     | `9724d2c` — intocado                     |
