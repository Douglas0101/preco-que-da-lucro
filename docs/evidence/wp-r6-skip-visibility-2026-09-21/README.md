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

**KPI — `capturados pelo autor / total`:** 4 capturados pelo autor (A1–A4) + 1 achado **do gate**
(o falso positivo do contador, §7.2) + achados do S6.

## 7. S6 ADVERSARIAL

_(preenchido com o veredicto da lane de contexto limpo)_

## 8. CI e commits

| campo             | valor                |
| ----------------- | -------------------- |
| base              | `eb2f498`            |
| land em `develop` | _(preenchido no S7)_ |
| run@sha           | _(preenchido no S8)_ |
| `origin/main`     | `9724d2c` — intocado |
