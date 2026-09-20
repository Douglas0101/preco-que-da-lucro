# SPEC — WP3 `F-D2-depth-pin`

**Work package:** `F-D2-depth-pin` (Bloco 3, terceiro na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:84`
**Base:** `524ec542d069f04132342ca276b1809468b0e75c`
**Branch:** `mission/wp3-depth-pin` · worktree `.worktree-wp3-depthpin`

---

## 1. Problema

A fronteira de profundidade da cadeia de `cause` — quantos embrulhos o mapeamento de violação de
chave estrangeira ainda atravessa antes de desistir — **não está fixada por nenhum teste**. A fila
o descreve assim:

> a fronteira de profundidade da cadeia de `cause` **não está pinada** por teste (o caso rotulado
> `depth=4` mede `depth=5`; a suíte passaria com limite 3 ou 4)

Um limite de profundidade existe para **parar** — é o que impede uma cadeia circular ou
patologicamente longa de virar laço infinito ou busca sem fim. Uma constante de parada cuja
fronteira não é exercitada é uma constante que qualquer edição futura pode mover **em silêncio**:
nem o `tsc` nem a suíte notariam. Este WP pina a fronteira; **não** move o limite.

## 2. Fato-fonte medido

### 2.1 A implementação (leitura direta)

`src/lib/products.functions.ts:203`

```ts
const FK_CAUSE_CHAIN_LIMIT = 4;

function foreignKeyViolation(error: unknown): { constraint: string | null } | null {
  let current: unknown = error;
  for (let depth = 0; depth < FK_CAUSE_CHAIN_LIMIT; depth += 1) {
    if (typeof current !== "object" || current === null) return null;
    if ("code" in current && current.code === "23503") {
      const { constraint } = current as { constraint?: unknown };
      return { constraint: typeof constraint === "string" ? constraint : null };
    }
    if (!("cause" in current)) return null;
    current = current.cause;
  }
  return null;
}
```

O laço inspeciona os índices **0, 1, 2 e 3** da cadeia — quatro erros, o `error` de entrada
incluído. O índice 4 nunca é olhado.

### 2.2 A construção dos casos de teste (leitura direta)

`src/test/products-fk-conflict.test.ts:105-112` — `wrapCause(error, count)` embrulha `error` em
`count` erros genéricos, cada um com o anterior em `.cause`; `count = 0` devolve o próprio erro.

`src/test/products-fk-conflict.test.ts:80-93` — `drizzleWrappedError(code, constraint)` devolve um
`DrizzleQueryError` **sem `code`** cuja `.cause` é o `DatabaseError` **com** `code = '23503'`. Ou
seja: no erro base, o SQLSTATE está no **índice 1**, não no 0.

Consequência aritmética: `wrapCause(drizzleWrappedError(...), n)` deixa o SQLSTATE no índice
**n+1**.

### 2.3 Os dois casos que existem hoje

| `it`                                                                | linha  | `wrapCause` | índice do 23503 | achado? | rótulo                  |
| ------------------------------------------------------------------- | ------ | ----------- | --------------- | ------- | ----------------------- |
| "o SQLSTATE em `depth=2` é encontrado com uma constraint a mais"    | `:165` | `1`         | 2               | **sim** | `depth=2` — **correto** |
| "um 23503 em `depth=4` fica fora do limite e é relançado como veio" | `:184` | `4`         | 5               | não     | `depth=4` — **mede 5**  |

### 2.4 A lacuna

Os dois casos são **indiferentes ao valor do limite** dentro de uma faixa larga:

| `FK_CAUSE_CHAIN_LIMIT` | índice 2 é achado? | índice 5 é achado? | suíte atual |
| ---------------------- | ------------------ | ------------------ | ----------- |
| 3                      | sim (2 < 3)        | não                | **verde**   |
| 4 (hoje)               | sim                | não                | **verde**   |
| 5                      | sim                | não                | **verde**   |
| 6                      | sim                | **sim**            | vermelha    |

O limite só é sentido pela suíte antiga **fora** da faixa 3–5: abaixo de 3 o caso `depth=2` cai, e
a partir de 6 o caso `depth=5` cai. Dentro da faixa (3, 4 e 5) ela é **cega** — ver `f5`
(`Tests 9 passed | 4 skipped (13)`, EXIT=0), medição registrada na ERRATA §9. O valor que ela
deveria distinguir é o par de fronteira:

- índice **3** (a última volta do laço) ⇒ **encontrado** — um limite 3 falharia aqui;
- índice **4** (a primeira volta que o laço não dá) ⇒ **não encontrado** — um limite 5 falharia
  aqui.

Nenhum dos dois existe. A lacuna não é de cobertura de _linha_ (o `return null` final é alcançado
pelo caso `depth=5`); é de **cobertura de fronteira**, que é a única que pinar valor.

**Isto é hipótese, não fato medido** até a seção 5 §1 da bateria: a tabela acima é leitura de
código, e a prova é mutar a constante e ver a suíte se comportar como previsto.

## 3. Âncoras

- Fila vigente: `docs/evidence/agent-state/QUEUE.md:84` e `:128` (`F-D2-depth-pin` +
  `F-D2-runner-failopen`, este último **já landado** como TRILHO A — ver `5fba8e7`).
- INV-009 (idempotência) — não se aplica: sem escrita.
- A família de defeito já combatida nesta rodada: **cardinalidade não é identidade** (WP1 §8.4,
  TRILHO C §2.1, WP2 §9). Aqui a lacuna é prima dela: **um caso que passa não é um limite
  exercitado**.

## 4. DoD

- [ ] os dois casos de fronteira existem: índice 3 encontrado, índice 4 não encontrado
- [ ] o caso existente rotulado `depth=4` **ou** é corrigido para `depth=5`, **ou** passa a ser o
      caso do índice 4 — o rótulo nunca diz um número diferente do que ele mede
- [ ] a suíte **nova reproduz** a suíte **antiga** contra o código real (`FK_CAUSE_CHAIN_LIMIT`
      inalterado em 4): nenhum caso novo passa por acidente
- [ ] **falsificação de fronteira, nas duas direções:** com `FK_CAUSE_CHAIN_LIMIT = 3` a suíte
      **nova reprova** (caso `depth=3`) e a **antiga continuaria verde**; com `= 5` a nova reprova
      (caso `depth=4`) e a antiga continua verde — é o que prova que a fronteira está pinada
- [ ] `npm run check` exit 0 sobre os bytes finais
- [ ] `m02:matrix:check` verde **sem regenerar** a matriz
- [ ] `check:bundle` byte-idêntico ao WP2 (`473230` minified / `assets/index-eXg04t5H.js: 237694`)
- [ ] **`FK_CAUSE_CHAIN_LIMIT` continua 4** — o WP pina, não move
- [ ] `src/lib/products.functions.ts` **não** aparece no diff

## 5. Testes

Acrescentar a `src/test/products-fk-conflict.test.ts`, dentro do `describe("mapeamento FK 23503 →
CONFLICT (WP-C4-1)")`:

1. **"fronteira: um 23503 no último elo inspecionado (depth=3) ainda é encontrado"** —
   `wrapCause(drizzleWrappedError("23503", HISTORY_INGREDIENT_FK), 2)`, esperando CONFLICT/409 com
   `cause: deep` e `message: HISTORY_MESSAGE`. Falha se o limite baixar para 3.
2. **"fronteira: um 23503 em depth=4 (o primeiro elo fora do limite) é relançado como veio"** —
   `wrapCause(drizzleWrappedError("23503", HISTORY_INGREDIENT_FK), 3)`, esperando
   `rejects.toBe(deep)`. Falha se o limite subir para 5.
3. **correção de rótulo** — o caso `:184` deixa de dizer `depth=4` e diz o que mede (`depth=5`), ou
   é absorvido pelo caso 2; a escolha fica registrada no README do selo.

Os três são **aditivos**: nenhum caso existente é enfraquecido, e os dois `it`s atuais continuam
valendo como estão (salvo o rótulo).

## 6. Riscos

| risco                                                                                  | por que é baixo                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| mexer no teste e não no produto não muda comportamento                                 | é exatamente o objetivo: o WP pina uma fronteira existente                    |
| o caso 1 pode passar por motivo errado (o erro ser mapeado por outra via)              | o `expect` é `toMatchObject` com `cause: deep` **e** `message`, não só `code` |
| a falsificação com limite 3 pode reprovar por outro motivo (erro de tipo, por exemplo) | a bateria registra a **mensagem** da falha, não só o exit code                |
| a suíte nova pode "provar" a fronteira com um caso vacuamente verdadeiro               | o caso 2 assere `rejects.toBe(deep)` — identidade do objeto, não forma        |

## 7. Rollback

Descartar a branch e o worktree. O WP não toca runtime, schema, migration nem configuração: o diff
são **dois** arquivos (`src/test/products-fk-conflict.test.ts` e
`scripts/db/test-products-fk-conflict.ts`) mais a prosa do selo. Nada fica em `develop` antes do
Gate C.

## 8. Fora de escopo

- **mudar `FK_CAUSE_CHAIN_LIMIT`** — o WP pina o valor corrente; discuti-lo é outro WP, com
  medição de cadeias reais do driver.
- `products-fk-conflict.test.ts` já tem, do TRILHO A, o piso de cardinalidade
  (`MIN_TOTAL_TESTS = 13`) e, do WP2, nenhuma mudança. O piso **sobe** com os casos novos — isso é
  consequência, não objetivo.
- `F-D1-raw-sha` (`QUEUE.md:88`) segue com o MAESTRO/ESCRIVÃO.
- A fricção recorrente do `.artifacts/` fora do `ignores` do ESLint 9 flat config, que custou duas
  corridas de gate nesta rodada, fica **declarada** e não é consertada aqui.

## 9. ERRATA (S6 adversarial, 2026-09-20)

O veredicto S6 (`captures/adversarial-wp3-verdict.md.txt`, `89da19af…`) auditou esta SPEC e
encontrou duas afirmações contra o fato medido; ambas foram corrigidas **antes** do selo, com o
dado bruto preservado (`f5`, `wp3-falsifica.log:67`):

1. §2.4, linha `| 5 | sim | **sim** | vermelha |` era **falsa**: com limite 5 o laço inspeciona os
   índices 0..4, e o índice 5 só é achado com limite 6. A suíte antiga é cega no intervalo 3–5.
   A frase "O limite só começa a ser sentido em 5" caiu pela mesma medição.
2. §7 dizia "um único arquivo de teste" quando o diff tem dois (teste + runner do piso).

O DoD da §4 também foi alargado para exigir a falsificação nas duas direções, que é o que o
instrumento final mede.
