# WP3 `F-D2-depth-pin` — a fronteira de profundidade da cadeia de `cause`

**Work package:** `F-D2-depth-pin` (Bloco 3, terceiro na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:84`
**Base:** `524ec542d069f04132342ca276b1809468b0e75c`
**Branch:** `mission/wp3-depth-pin`

---

## 1. Sumário

O mapeamento de violação de chave estrangeira percorre a cadeia de `cause` até um limite
(`FK_CAUSE_CHAIN_LIMIT`). A suíte exercitava o caso **dentro** do limite e um caso **muito fora**,
mas não o **par de fronteira** — o último elo inspecionado e o primeiro que o laço não dá. Com
isso, a suíte era indiferente a qualquer limite no intervalo **3–5**: qualquer edição futura
poderia mover a constante em silêncio, e é exactamente para **parar** que um limite de profundidade
existe.

Este WP acrescenta os dois casos de fronteira, corrige um rótulo que dizia um número diferente do
que media, e **sobe o piso de cardinalidade do runner** de 13 para 15 para que os casos novos não
possam ser apagados em silêncio. **A constante não foi tocada** — o WP pina a fronteira, não a move.

## 2. O que muda

### 2.1 Os dois casos novos, e o par que eles formam

| caso novo                                                                              | `wrapCause` | índice do 23503 | espera                                             | falha se…                 |
| -------------------------------------------------------------------------------------- | ----------- | --------------- | -------------------------------------------------- | ------------------------- |
| `fronteira: um 23503 no último elo inspecionado (depth=3) ainda é encontrado`          | `2`         | **3**           | CONFLICT/409, `cause: deep`, mensagem de histórico | o limite **cair** para 3  |
| `fronteira: um 23503 em depth=4 (o primeiro elo fora do limite) é relançado como veio` | `3`         | **4**           | `rejects.toBe(deep)`                               | o limite **subir** para 5 |

A aritmética que os situa: o laço `for (let depth = 0; depth < FK_CAUSE_CHAIN_LIMIT; depth += 1)`
inspeciona os índices **0 a 3**; e `drizzleWrappedError` devolve um `DrizzleQueryError` **sem
`code`** cuja `.cause` é o `DatabaseError` **com** `code = '23503'`, de modo que
`wrapCause(drizzleWrappedError(...), n)` deixa o SQLSTATE no índice **n+1**.

### 2.2 O rótulo corrigido

O caso que existia dizia `depth=4` e media **5** (`wrapCause(..., 4)` ⇒ índice 5). Passou a dizer o
que mede: `profundidade: um 23503 em depth=5 fica bem fora do limite e é relançado como veio`. Um
caso de teste cujo nome afirma um número que ele não mede é um documento que mente — na mesma
família que esta rodada vem combatendo.

### 2.3 O piso de cardinalidade

`scripts/db/test-products-fk-conflict.ts:45` — `MIN_TOTAL_TESTS` subiu de **13** para **15**, com o
comentário explicando por quê. O piso existe desde o `F-D2-runner-failopen` para que apagar casos
seja detectado: um arquivo com menos casos que o contrato, **todos passando**, sairia 0 e deixaria
o passo verde com a cobertura encolhida em silêncio. Um piso que fica para trás permite apagar em
silêncio exactamente a prova que ele existe para proteger — subir junto é **consequência direta**
da adição, não emenda de ocasião. O limite declarado deste piso (composição, não contagem) está na
§4.

## 3. Evidência

### 3.1 A falsificação de fronteira — a prova central, nas duas direções

`bash .artifacts/zz-wp3-falsifica.sh` → `.artifacts/wp3-falsifica.log`, `FALSIFICA_EXIT=0`:

| corrida                                           | resultado                                                                | leitura                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| suite **nova**, limite **4** (real)               | `Test Files 1 passed (1)` · `Tests 11 passed \| 4 skipped (15)` · EXIT=0 | verde                                                                                |
| suite **nova**, limite **3** (mutado)             | `Tests 1 failed \| 10 passed \| 4 skipped (15)` · EXIT=1                 | falha **exactamente** no caso de fronteira `depth=3`, e é o **único** caso que falha |
| suite **antiga** (do pai, 13 casos), limite **3** | `Tests 9 passed \| 4 skipped (13)` · EXIT=0                              | **não distingue**                                                                    |
| suite **nova**, limite **5** (mutado)             | `Tests 1 failed \| 10 passed \| 4 skipped (15)` · EXIT=1                 | falha **exactamente** no caso de fronteira `depth=4`, e é o **único** caso que falha |
| suite **antiga** (do pai, 13 casos), limite **5** | `Tests 9 passed \| 4 skipped (13)` · EXIT=0                              | **não distingue**                                                                    |

O veredicto é **calculado** pelo script, e prende a **identidade** do caso que falha: o nome tem de
aparecer ancorado na linha de falha (`×`), e a contagem de casos que falharam tem de ser
**exactamente 1** — contar o nome em qualquer lugar da saída não bastaria (o reporter lista também
os `✓`):

```text
  suite nova verde com limite 4:       1 (esperado 1)
  suite nova com falhas no limite 3:   1 (esperado >= 1)
  casos que falharam no limite 3:      1 (esperado 1)
  a falha e no caso de FRONTEIRA 3:    1 (esperado 1)
  suite antiga verde com limite 3:     1 (esperado 1)
  suite antiga NAO falhou:             0 (esperado 0)
  suite nova com falhas no limite 5:   1 (esperado >= 1)
  casos que falharam no limite 5:      1 (esperado 1)
  a falha e no caso de FRONTEIRA 4:    1 (esperado 1)
  suite antiga verde com limite 5:     1 (esperado 1)
  suite antiga NAO falhou:             0 (esperado 0)
  VEREDITO: FRONTEIRA PINADA NAS DUAS DIRECOES - a nova distingue 3 e 5 de 4; a antiga nao distinguia nenhum
```

Sem o par (nova reprova / antiga passa) com o **mesmo** limite mutado, "pinar a fronteira" seria só
uma afirmação: o que prova o WP não é a suíte ficar vermelha, é ela ficar vermelha **onde a antiga
ficava verde** — nas duas direções. O limite foi restaurado e conferido **byte a byte**
(`f9a89220622e02f8283889253227f593b07e9a62d026b04ac1240b1c8ee01647` antes e depois).

**Duas correções de instrumento vieram desta retomada**, e ambas são declaradas:

1. O `NO_COLOR` era **ambiente implícito** na primeira rodada: sem ele, o vitest emite ANSI e os
   `grep` de texto puro do veredicto falhavam sobre a evidência certa. O script agora força
   `NO_COLOR=1` internamente — o veredicto não depende de quem executa.
2. O S6 adversarial (N1) falsificou a **identidade** do veredicto: o nome do caso aparecia em
   linhas `✓` do reporter, então `nome presente + qualquer falha` passava. O parser foi ancorado
   na linha `×` e passou a exigir queda **única** (tabela acima). O que salva a rodada anterior é a
   evidência bruta (`f2`/`f4` mostram a asserção da fronteira falhando com `arquivo:linha`) — o
   gate é que estava frouxo.

### 3.2 A bateria — `bash .artifacts/zz-wp3-verify.sh` → `.artifacts/wp3-verify.log`

Container efêmero `wp3-pg` em `127.0.0.1:5438`, PostgreSQL **17.11**, `docker run rc=0`, pronto em
3 s (a espera é pela **consulta real** — `pg_isready` responde antes de o `POSTGRES_DB` existir, e
essa presunção já imprimiu uma linha de versão vazia neste instrumento).

| verificação                              | resultado                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| runner com piso, contra o container      | `RUNNER_EXIT=0` · `Test Files 1 passed (1)` · **`Tests 15 passed (15)`** · `prova de banco (src/test/products-fk-conflict.test.ts) contra 127.0.0.1: 15 passed (15), 0 skipped — admin=127.0.0.1:5438` |
| **piso com dentes**: piso mutado para 16 | `PISO_EXIT=1` · `AssertionError: a prova de banco não produziu casos suficientes: 15 < 16 — … (fail-open, F-D2-runner-failopen)`; runner restaurado (`RESTAURO=0`, sha conferido)                      |
| suíte direta                             | `VITEST_EXIT=0` · `Tests 15 passed (15)`                                                                                                                                                               |
| matriz                                   | `MATRIX_EXIT=0` · `M-02 matrix is deterministic and up to date.` — **sem regenerar**                                                                                                                   |
| a fronteira não moveu o runtime          | **assertado**: `FK_CAUSE_CHAIN_LIMIT == 4` → `1`; `products.functions.ts` no diff → `0`                                                                                                                |
| H-9                                      | **assertado**: porta 5432 com `0` listener(es) **no início e no fim**                                                                                                                                  |

Os **4 skipped** das corridas fora do runner são os casos gated por loopback, que só rodam quando
há alvo de banco: `Boolean(adminUrl) && isLoopbackUrl(adminUrl) && …` é falso com as variáveis
ausentes, e é por isso que a prova de banco de verdade vive no runner e no `env:` do job da CI, não
em `npm run check`.

### 3.3 Gate local

`npm run check` exit 0 sobre os bytes finais (`CHECK_EXIT=0` em `.artifacts/wp3-gate.log`), com a
matriz determinista sem regenerar e o bundle idêntico ao WP2: `assets/index-eXg04t5H.js: 237694
minified` / inicial de `473230 minified` (9 chunks).

## 4. Riscos e limites declarados

| item                                                                                                             | situação                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| o valor `4` continua sendo uma escolha, não um número medido                                                     | **declarado** — o WP pina a fronteira corrente; discuti-la é outro WP, com medição de cadeias reais do driver                                                                                                                                                          |
| o caso de fronteira poderia passar por outra via de mapeamento                                                   | mitigado: o `expect` é `toMatchObject` com `cause: deep` **e** a mensagem, não só o `code`                                                                                                                                                                             |
| a falsificação muta um arquivo de runtime                                                                        | mitigada: `sed` de uma linha, restauro conferido por sha256, e a mutação **não** entra em nenhum commit                                                                                                                                                                |
| o piso subir acopla o runner à contagem do arquivo                                                               | intencional — é o que dá dentes; toda adição futura de caso precisa subir o piso no mesmo commit                                                                                                                                                                       |
| **N2 (declarado, do S6):** o piso garante `total >= 15` e `0 skipped`, mas não que os **casos de banco** existam | apagar os 4 gated e compensar com 4 casos puros mantém 15/15 verdes. Correção candidata (não neste WP): segunda corrida sem `env` de banco exigindo **exactamente 4 skipped**. Declarado por ser pré-existente do `F-D2-runner-failopen` e não ter caso vivo na árvore |
| `.artifacts/` fora do `ignores` do ESLint 9 flat config                                                          | **declarado, não corrigido aqui** — já custou duas corridas de gate nesta rodada (WP1 e WP2); candidato a WP próprio                                                                                                                                                   |
| o veredicto S6 foi colhido por subagente read-only, não pela lane `.pi/delegate`                                 | **declarado** — a lane externa dos WPs 1–2 não está disponível como ferramenta na retomada; o veredicto foi selado **verbatim** com sha256 e a substituição de método está na §7                                                                                       |

## 5. Arquivos tocados

| arquivo                                   | mudança                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/test/products-fk-conflict.test.ts`   | +2 casos de fronteira, 1 rótulo corrigido, `13 → 15` casos (`febe27fa…`)                                                                         |
| `scripts/db/test-products-fk-conflict.ts` | `MIN_TOTAL_TESTS` `13 → 15` + comentário (`95fa8576…`)                                                                                           |
| `docs/evidence/d2-depth-pin-2026-09-20/`  | este selo                                                                                                                                        |
| `docs/evidence/agent-state/PROGRESS.md`   | journal: `L119 ▶` está no **working tree** de `develop` desde a abertura e é comitado junto com `L120 ✔` no commit de land, **não** nesta branch |

**Fora do diff:** `src/lib/products.functions.ts` — conferido por `git status` e **assertado** pelo
S7 e pela bateria (sha `f9a89220…`).

## 6. Como reproduzir

```bash
# a fronteira (veredicto calculado; NO_COLOR forcado dentro do script)
bash .artifacts/zz-wp3-falsifica.sh   # FALSIFICA_EXIT=0

# a bateria (sobe e derruba o container efemero; asserta H-9 e runtime)
bash .artifacts/zz-wp3-verify.sh      # VERIFY_EXIT=0

# o guard S7 (grava o proprio log com o sha256 do artefato examinado)
bash .artifacts/zz-wp3-s7.sh          # S7_EXIT=0

# o gate do repositorio, sobre os bytes finais
npm run check                          # CHECK_EXIT=0
```

## 7. S6 ADVERSARIAL

**Revisão auditada (R_a):** testes `febe27fa…`, runner `95fa8576…`, runtime `f9a89220…`;
instrumentos `zz-wp3-falsifica.sh` `1c25ec02…`, `zz-wp3-verify.sh` `e5b7887f…`,
`zz-wp3-s7.sh` `9b36c9fa…`. **Método:** auditoria read-only por **subagente de contexto limpo**
(substituição declarada da lane `.pi/delegate` dos WPs 1–2, indisponível como ferramenta nesta
retomada), sem execução de testes; veredicto selado verbatim em
`captures/adversarial-wp3-verdict.md.txt` (`89da19af…`).

**Veredicto:** **8 CONFIRMED** (C1, C2, C3, C4, C6, C7, C8, C9) · **2 CORRECTED** (C5, C10) ·
**0 REJECTED** · **0 UNVERIFIABLE**. Nada no veredicto invalida a prova de fronteira: os bytes
congelados batem, o runtime está fora do diff, e a fronteira cai nas duas direções onde a suíte
antiga passava.

**Correções aplicadas na revisão final (R_b), todas seladas em `captures/`:**

| achado                                                                                                                      | correção                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **N1** — identidade da falsificação aceitava qualquer falha                                                                 | âncora na linha `×` + queda **única** (`zz-wp3-falsifica.sh` `8fcdb23c…`; `wp3-falsifica.log` `d6a5c469…`)   |
| **N3** — restauro falho do runner ainda saía `VERIFY_EXIT=0`                                                                | flag `RESTAURO` própria no veredicto (`zz-wp3-verify.sh` `2208986f…`; `wp3-verify.log` `348d5b3f…`)          |
| **N4** — FK/H-9/diff do runtime eram impressos, não assertados                                                              | asserções fail-closed no veredicto da bateria e no S7 (`zz-wp3-s7.sh` `17ac7c1d…`; `wp3-s7.log` `a5f36e5c…`) |
| **C10/N5** — README/SPEC contra o fato medido (uma direção; veredicto citado que não existe no log; linhas; SPEC §2.4 e §7) | errata neste README e seção `## 9. ERRATA` no `SPEC.md`; dados brutos preservados                            |

**Declarado, não corrigido:** **N2** (composição do piso do runner) — §4, com a correção candidata
e a razão de não pertencer a este WP.

**Custódia:** o veredicto foi escrito a partir do texto retornado pela lane; um glifo corrompido do
transporte (`�码`, na claim C1) foi **preservado** na cópia selada, por custódia — a correção dele
seria uma edição silenciosa do veredicto. O `MANIFEST.sha256` bindo o vínculo
commit ↔ selo é re-verificado no commit de land.
