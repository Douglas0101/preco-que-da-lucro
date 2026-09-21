# WP-R6 `F-skip-visibility` — selo

**Data:** 2026-09-21 · **Branch:** `mission/r6-skip-visibility` · **Base:** `eb2f498`
**Head do selo:** §8 · **S6:** lane adversarial de contexto limpo (§7)

---

## 1. Sumário

O E2 local reportava `952 passed | 13 skipped`. Skip é o primo do falso verde um nível acima — um
teste que **não roda e não reprova** — e a análise avançada de 2026-09-20 §6.1 exigiu disposição
nominal dos 13 antes da ratificação do R0b, porque _"skip não explicado durante uma re-medição é NS
por contágio"_.

Os 13 vêm de **dois** sítios (descoberta: `grep` por `describe.skip`, não lista): 9 em
`product-contracts.test.ts` e 4 em `products-fk-conflict.test.ts`, ambos gated por
`dbEnabled = Boolean(admin) && isLoopbackUrl(admin) && isLoopbackUrl(DATABASE_URL) && …` — a mesma
expressão duplicada, com `isLoopbackUrl(undefined)` devolvendo **`true`**.

Medido: com **3 URLs remotas** o ambiente _declara_ banco e a suíte fica **`1 passed`** — verde com a
prova de banco ausente. O mesmo vale para **só `DATABASE_URL` remota**. Dois fail-opens reais,
alcançáveis pelo fluxo `npx vitest run <arquivo>`.

## 2. Arquivos

| arquivo                                             | mudança                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| `src/test/helpers/db-precondition.ts`               | **novo** — fonte única da precondição (tudo ou nada, falha alta)  |
| `src/test/product-contracts.test.ts`                | usa o helper; `isLoopbackUrl`/`dbEnabled` locais removidos        |
| `src/test/products-fk-conflict.test.ts`             | idem                                                              |
| `src/test/db-precondition.test.ts`                  | **novo** — 7 casos, inclui o booleano invertido                   |
| `scripts/lib/m02-database-module.ts`                | **novo** — classificador de "módulo de banco" extraído e testável |
| `scripts/m02-matrix.ts`                             | passa a importar o classificador (regra estrita)                  |
| `src/test/m02-database-module.test.ts`              | **novo** — 5 casos, inclui o falso positivo                       |
| `.github/workflows/ui-stack.yml`                    | comentário do gate atualizado para a semântica nova               |
| `docs/evidence/wp-r6-skip-visibility-2026-09-21/**` | este selo                                                         |

**Não muda:** nenhum código de runtime, nenhuma migration, `package.json` intocado, `:5432`
intocado, `origin/main` intocado.

## 3. Evidência por fase

| fase                           | captura                                 | número medido                                                                                                                            |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Inventário dos 13**          | `captures/inventario-skips.log.txt`     | 2 sítios por descoberta (`grep`); 9 + 4; motivo nomeado; CI declara as 3 em loopback                                                     |
| **RED (fail-open)**            | `captures/red-fail-open.log.txt`        | sob a semântica antiga **A, B e C todas `1 passed`**; sha256 `e2fa3518…` → `7ee051be…` → restaurado `e2fa3518…`                          |
| **GREEN**                      | idem                                    | A passa com skip nomeado · B, C, D **falham alto** nomeando chave e problema                                                             |
| **Falso positivo do contador** | `captures/red-classificador-db.log.txt` | mutação para a regra frouxa → **2 failed** (os casos do falso positivo); sha256 restaurado; matriz **49** entradas, sem o falso positivo |
| **Gate local**                 | `captures/gate-local.log.txt`           | `npm run check` **exit 0** · 95 arquivos · **964 passed \| 13 skipped** · os 13 **nomeados** na saída                                    |
| **Isolamento**                 | `captures/isolamento.log.txt`           | `origin/main` = `9724d2c` · `:5432` 0 listeners · 0 migrations · lockfile intocado                                                       |

## 4. Riscos e limites declarados

| #   | limite                                                                                                                     | por que é aceitável                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | O CI passou a depender de as três URLs estarem declaradas no job; remover uma agora **reprova** em vez de pular            | é o desenho: o comentário do workflow documenta a razão e o job as declara; a alternativa era indistinguibilidade                                  |
| L2  | `console.log` no topo dos dois arquivos de teste                                                                           | é o ponto — visibilidade. `describe.skip` mudo era o defeito                                                                                       |
| L3  | O skip legítimo continua sendo **13** no E2 local                                                                          | correto: sem banco local os casos não têm contra o que executar; o que mudou é que agora é **nomeado**, e qualquer configuração parcial falha alto |
| L4  | A regra estrita do classificador foi medida contra a matriz real (1 entrada mudava) e não contra um corpus sintético amplo | declarado; o teste unitário cobre a fronteira (segmento × substring)                                                                               |
| L5  | Os 13 rodam no CI, mas a **prova disso** é por leitura do workflow + o comentário do job, não por execução do job neste WP | o E2 local e a heavy no commit selado são a verificação disponível                                                                                 |

## 5. Checklist anti-vacuoso — demonstração item a item

| #   | item                                   | como foi satisfeito                                                                                                                                                             |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | mutação da precondição restaura a semântica antiga e **B e C voltam a passar** (`red-fail-open`); mutação do classificador faz 2 casos reprovarem; ambas restauradas por sha256 |
| 2   | Fronteira nas duas direções            | `isLoopbackUrl` testado nos dois lados (ausente/vazio/loopback/remoto/inválido); a precondição distingue **zero URL** (skip) de **qualquer URL** (exigir as três)               |
| 3   | Identidade, não cardinalidade          | as mensagens nomeiam **a chave** e **o problema** (`DATABASE_URL nao aponta para loopback`), não só o número; o restore é conferido por sha256                                  |
| 4   | Proibido exit-code-only                | os casos asseram o **texto** da falha (`precondicao de banco invalida`, `N/A-sem-DB`), não só o exit                                                                            |
| 5   | Proibido sleep fixo                    | não se aplica: não há sincronização temporal                                                                                                                                    |
| 6   | Sem valor degenerado na identidade     | a identidade é o sha256 do arquivo mutado e o nome da chave de ambiente                                                                                                         |
| 7   | Precondição de estado compartilhado    | é o objeto do WP: a precondição do banco é declarada **e** verificada; `enabled: true` no CI é asserido pela leitura do job                                                     |
| 8   | Sentinela real por cenário             | as quatro configurações usam URLs reais de loopback e remotas, executadas de fato (`npx vitest run`)                                                                            |
| 9   | Fingerprint de revisão                 | `HEAD` + sha256 antes/depois de cada mutação                                                                                                                                    |
| 10  | `checked === discovered`               | os sítios de skip foram enumerados por `grep`, não por lista; os **dois** achados (9+4) fecham 13                                                                               |
| 11  | S6 adversarial de contexto limpo       | §7                                                                                                                                                                              |
| 12  | Falha alta (fail-closed)               | `dbPrecondition` lança; nenhum caminho converte ambiente inválido em verde                                                                                                      |
| 13  | Isolamento de bancada assertado        | `captures/isolamento.log.txt`                                                                                                                                                   |
| 14  | Todo check impresso tem gate e captura | cada linha da §3 aponta captura versionada                                                                                                                                      |
| 15  | Run de CI atado ao commit selado       | §8                                                                                                                                                                              |
| 16  | Descoberta multi-sítio                 | sítios de skip por `grep`/descoberta; e o classificador estrito foi validado contra a **matriz real** (não contra lista de exemplos)                                            |
| 17  | **Precondição de estado ambiente**     | o WP aplica o item 17 ao caso que faltava: a suíte de testes                                                                                                                    |

## 6. Auto-verificação pré-S6 e KPI

| #   | achado                                                                                                             | canal | disposição                                          |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----- | --------------------------------------------------- |
| A1  | o caso **parcial** (só `ADMIN` loopback) **não** era o fail-open; li a linha `Tests` e perdi `Test Files 1 failed` | autor | premissa corrigida na §2 do SPEC; o caso real é B/C |
| A2  | **só `DATABASE_URL` remota** também era fail-open — achado ao medir a variante                                     | autor | coberto pelo mesmo fix (caso C da captura)          |
| A3  | o `env-guard` já bloqueia remoto no caminho npm ⇒ o alcance do defeito é `npx vitest` direto                       | autor | declarado na §2 do SPEC com a medição (exit 3)      |
| A4  | primeiro `sed` da mutação do classificador **não aplicou** e o bloco ficou vacuoso                                 | autor | refeito com python e sha256 conferido               |

**KPI — `capturados pelo autor / total`:** **5 autor + 1 gate / 16** (≈ 37%).

| canal          | achados | quais                                                                                       |
| -------------- | ------- | ------------------------------------------------------------------------------------------- |
| autor (pré-S6) | 5       | A1–A5 — incluindo o A5 (a regressão do `db:test`), o mais caro da série                     |
| gate mecânico  | 1       | o falso positivo do contador `directDatabaseFiles`                                          |
| S6 adversarial | 10      | N1–N10 — o S6 **confirmou o A5 independentemente** (N1) e achou 9 que nenhum dos outros viu |

Nenhum canal é superset do outro, e isso agora está medido em **dois WPs seguidos**: no WP-R5 o S6
achou o falso verde que o gate não via e o gate achou o `.d.mts` que o S6 não viu; aqui o autor achou
a regressão de contrato e o S6 achou a fronteira de hostname (N8) e o furo de artefato (N4). A série
`autor × gate × S6` vai para o journal como densidade por canal, não como ponto.

## 7. S6 ADVERSARIAL

**Lane:** subagente de contexto limpo, read-only, instruído a falsificar. Alvo pinado: `edb504c`
(congelado por `git archive` em `/tmp` — o revisor montou cópias imutáveis em vez de confiar no
working tree).

### 7.1 Claims × veredicto

| claim                                                      | veredicto     | nota                                                                                                                                  |
| ---------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| C1 os 13 saem de 2 sítios, por descoberta                  | CONFIRMED     | `grep` independente por 7 mecanismos de skip: exatamente 2 hits; 0 fora de `src/test`                                                 |
| C2 o fail-open existia sob a semântica antiga              | CONFIRMED     | reproduzido em bytes congelados do pai (`Test Files 1 passed` em A/B/C, `1 failed` em D)                                              |
| C3 a precondição é tudo-ou-nada e falha alta               | CONFIRMED     | 7 fronteiras testadas pelo revisor, incluindo URL malformada                                                                          |
| C4 o skip é visível                                        | CONFIRMED     | com a nuance: **2 linhas de rótulo** (uma por arquivo), não 13 nomes por teste                                                        |
| C5 `isLoopbackUrl` distingue ausente de loopback           | CONFIRMED     | + 8 sondas de hostname que viraram N8                                                                                                 |
| C6 o CI declara as três em loopback ⇒ transparente         | CONFIRMED     | workflow parseado + helper avaliado sobre os literais                                                                                 |
| C7 a regra estrita muda exatamente 1 entrada               | CONFIRMED     | réplica do classificador sobre a árvore real: 50→49, perdida só `db-precondition.test.ts`, nenhuma ganha                              |
| C8 a regra nova ⊆ antiga                                   | CONFIRMED     | 38 sondas, 13 divergem, **todas** antigas-apenas (a nova só remove)                                                                   |
| C9 a matriz é idêntica à base                              | CONFIRMED     | sha256 `cd885606…` == `git show eb2f498:…`                                                                                            |
| C10 `npm run check` exit 0                                 | CONFIRMED     | 95 arquivos, 964 passed \| 13 skipped; todos os gates baratos exit 0                                                                  |
| C11 sem runtime/migration/lockfile; `origin/main` intocado | CONFIRMED     |                                                                                                                                       |
| C12 o comentário do workflow descreve a semântica nova     | **CORRECTED** | semântica correta, **número errado**: "13/13 e 14/14" — o arquivo FK tem **15** testes (o 13 era anterior ao depth-pin de 2026-09-20) |

### 7.2 Defeitos novos e disposição

| id     | defeito                                                                                                                                               | disposição                                                                                                                                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N1** | **HIGH** — o `db:test` documentado (par, sem `UNPOOLED`) passava a **falhar alto**; os comentários dos runners ficaram descrevendo a semântica antiga | **corrigido** (achado **independentemente pelo autor** antes do veredicto): `UNPOOLED` opcional + comentários atualizados + **provado com PG17 efêmero** (15/15 e 14/14, 0 skipped)                                   |
| N2     | `neon-readiness.yml` e `neon-pr-branch.yml` rodam `db:test` com o par **remoto**                                                                      | **declarado**: já eram vermelhos por desenho (ERRATA-5); muda o modo de falha, não o resultado                                                                                                                        |
| N3     | 4 de 5 capturas tinham `# HEAD=eb2f498` (a **base**) e a de isolamento dizia "(nao commitado)"                                                        | **corrigido**: capturas regeradas no commit que carrega o código                                                                                                                                                      |
| N4     | `MANIFEST.sha256` ausente no alvo pinado; e o guard **não inspeciona o diretório do WP**                                                              | manifesto existe a partir do selo; o buraco do guard virou **DBT-18**                                                                                                                                                 |
| N5     | a "lista fechada" do SPEC omitia 4 arquivos entregues                                                                                                 | **corrigido**                                                                                                                                                                                                         |
| N6     | "13/13" obsoleto (mesma raiz do C12)                                                                                                                  | **corrigido** junto com o C12                                                                                                                                                                                         |
| N7     | presença por `Boolean`: três valores vazios voltavam ao skip                                                                                          | **corrigido**: presença por `!== undefined`                                                                                                                                                                           |
| N8     | `127.1`, `LOCALHOST`, `localhost.`, IPv4-mapeado eram recusados ⇒ erro duro onde antes pulava                                                         | **corrigido**: host normalizado + 127/8 + mapeado aceitos; `0.0.0.0` segue recusado (bind-wildcard)                                                                                                                   |
| N9     | a regra estrita deixa de contar `./db.ts`; fronteira não pinada                                                                                       | **declarado** como **DBT-17**                                                                                                                                                                                         |
| N10    | **o workspace mutou durante a verificação** (5 arquivos sujos vs o alvo)                                                                              | **lição de processo**: o S6 exige alvo **congelado**. O revisor reagiu corretamente (recongelou por `git archive` e refez tudo), mas o WP gastou uma rodada. Regra adotada: **commitar tudo antes de despachar o S6** |

**Taxonomia:** CORR = **1** (C12) · N = **10** · **N corrigidos = 6** (N1, N3, N5, N6, N7, N8) ·
**N declarados = 4** (N2, N4→DBT-18, N9→DBT-17, N10→lição) · **correções forçadas = 1 + 6 = 7**.
`0 REJECTED` e `0 UNVERIFIABLE`.

### 7.3 Nota de método

O N10 é o achado mais instrutivo da lane, e não é sobre o código: **o alvo de uma verificação
adversarial precisa estar congelado**. Este WP despachou o S6 e continuou commitando — o revisor
detectou 5 arquivos divergentes do alvo pinado e reconstruiu cópias imutáveis para não medir o
working tree. Foi o comportamento certo dele; o custo foi meu. A regra que fica: **commit, depois
despachar** — o journal registra a lição em `L143`.

## 8. CI e commits

| campo             | valor                |
| ----------------- | -------------------- |
| base              | `eb2f498`            |
| land em `develop` | _(preenchido no S7)_ |
| run@sha           | _(preenchido no S8)_ |
| `origin/main`     | `9724d2c` — intocado |
