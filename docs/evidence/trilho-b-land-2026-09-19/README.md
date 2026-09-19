# LAND DO TRILHO B — `F-D2-reconcile-usage-unknown`

Evidência do **land** (não do desenho). O desenho, as correções e os veredictos
adversariais estão no selo próprio:
`docs/evidence/trilho-b-reconcile-unknown-2026-09-19/`.

## 1. Estado

| campo           | valor                                                               |
| --------------- | ------------------------------------------------------------------- |
| branch          | `develop`                                                           |
| base            | `f06c6d8e3d9749e13b59277a98c32334ad4d2cf0` (fecho do TRILHO A)      |
| head            | `9be9956f078002d5ccc27d649dad3ef9002e8de1`                          |
| commits         | `c393a6b` · `b705416` · `74d4ea1` · `db341a7` (merge) · `9be9956`   |
| CI local        | `captures/local-gate-land.log.txt` (`DBTEST_EXIT=0 TEST_EXIT=0`)    |
| CI origin       | `UI stack` run **`35465442629`** · `CI light` run **`35465442633`** |
| container local | `trk-land-pg` em `127.0.0.1:5435`, PostgreSQL 17.11, **virgem**     |
| container CI    | `127.0.0.1:5432` (service `postgres:17-alpine` do job)              |
| `origin/main`   | `9724d2c` — **intocado** em todo o arco                             |

## 2. O land

`develop` tinha avançado para `c393a6b` (registro do achado `D7`) depois de a
branch `mission/b-reconcile-unknown` ser cortada em `f06c6d8`. Os dois conjuntos
de arquivos são disjuntos, mas o `--ff-only` do TRILHO A deixou de ser possível.

**Decisão: merge `--no-ff`, não rebase.** Rebase reescreveria `b7054164`, o sha
que a tabela _commit ↔ selo_ do selo pina. Sem esse sha, a única prova de que os
hashes do selo são os do commit deixa de existir — o rebase seria mais barato e
destruiria a evidência, que é o pior negócio possível nesta trilha.

O commit documental `9be9956` avança o marcador parent-pinned do ledger para
`db341a7` (o pai de `9be9956`), como o contrato de `scripts/m02-state-check.ts`
exige: o marcador aceito é o **pai do HEAD**, não o HEAD.

## 3. Verificação local (container virgem)

| verificação                             | resultado                                                  |
| --------------------------------------- | ---------------------------------------------------------- |
| `porta 5432 (H-9) tocada?`              | **0 listener(es)**                                         |
| `db:test` — 17 suítes                   | `DBTEST_EXIT=0`, 0 skipped                                 |
| `products-fk-conflict.test.ts`          | `13 passed (13), 0 skipped — admin=127.0.0.1:5435`         |
| `product-contracts.test.ts`             | `14 passed (14), 0 skipped`                                |
| reconciliação `TRILHO-B`                | 6 casos OK                                                 |
| `vitest run` **com** o banco            | `Test Files 87 passed (87)` / **`Tests 865 passed (865)`** |
| `vitest run` **sem** o banco (controle) | `Test Files 87 passed (87)` / `852 passed \| 13 skipped`   |
| `npm audit --audit-level=high`          | exit 0 (4 `moderate` de esbuild, abaixo do limiar)         |
| higiene                                 | `tenants_trilho=0`, `ai_usage=0`                           |

**A comparação das duas linhas do vitest é a medida que importa.** Os mesmos 13
casos aparecem nas duas: com loopback definido eles **executam**, sem loopback
eles **pulam** — e o `npm run check` puro, sem banco, sai 0 do mesmo jeito. É
exatamente por isso que `db:test` existe como cadeia separada, e é o fail-open
de cardinalidade que o `F-D2-runner-failopen` fechou no passo de cima.

O `tenants=13` que o log de higiene imprime é **dado semeado pelas migrations**,
não fixture vazada (`tenants_trilho=0`, `ai_usage=0`). A checagem contava todos
os tenants em vez de procurar as fixtures do WP — grosseira, e por isso o número
sozinho não provava nada.

## 4. As duas linhas de prova na CI

`captures/ci-db-test-9be9956.log.txt`, extraído do job `verify` do run
`35465442629`, passo `Run npm run db:test`:

```
prova de banco (src/test/products-fk-conflict.test.ts) contra 127.0.0.1: 13 passed (13), 0 skipped — admin=127.0.0.1:5432
prova de banco (src/test/product-contracts.test.ts) contra 127.0.0.1: 14 passed (14), 0 skipped — admin=127.0.0.1:5432
TRILHO-B: prova de banco da reconciliação concluída (6 casos)
```

O job `verify` rodou **27 passos**, todos `success` — inclusive `npm run test`
(com o banco apontado pelo `env:` do job, portanto sem skip), `Audit
dependencies` e o e2e em chromium/firefox/webkit.

O alarme do WP também aparece na captura, emitido pelo próprio caminho de
reconciliação:

```json
{
  "level": "warn",
  "event": "ai.reconciliation_failed",
  "usageId": "fbcd23d1-…",
  "budget": 100,
  "real": null,
  "outcome": "reconciliation_failed",
  "reason": "gateway_retrieval_unavailable"
}
```

`"real":null` é o contrato: o job não inventa uma medição que não teve.

## 5. Falhas de harness desta trilha (nenhuma tocou o repositório)

Três, todas minhas, todas expostas pela própria verificação:

1. **`docker run` sem `POSTGRES_PASSWORD`/`POSTGRES_DB`** — a imagem oficial sai
   com código 1 (`Database is uninitialized and superuser password is not
specified.`). O `docker run` devolveu um id e parecia ter funcionado; o
   container estava `Exited (1)`.
2. **Laço de espera que não falhava fechado** — `pg_isready` com `break` mas sem
   contador: esperava 30 s e **seguia adiante de qualquer forma**. Um container
   morto virou "17 suítes falharam", três camadas abaixo da causa. Corrigido para
   parar com código 9 e despejar `docker logs`.
3. **`sha256sum -c` lido em locale pt-BR** — imprime `SUCESSO`, não `OK`; um
   `grep ': OK'` sobre a saída traduzida contaria **0** e ainda pareceria uma
   verificação. Corrigido com `LC_ALL=C`.

As três são a mesma família: uma verificação cujo resultado negativo é
indistinguível de sucesso. É a forma de defeito que este WP passou a trilha
inteira fechando.

## 6. O que NÃO está provado

- **Nenhuma métrica deste WP é provada como exportada.** O `D7` mostra que os
  instrumentos nascem noop; nenhuma corrida teve receiver OTLP real. O alarme
  que funciona é a linha estruturada no log, e é ele que o runbook manda
  monitorar. O `F-otel-provider-order` existe para isso.
- **O isolamento por tenant provado é o predicado explícito**, não o RLS: os
  scripts conectam por `DATABASE_ADMIN_URL` (superusuário, que ignora RLS), então
  o que se demonstra é o `tenant_id` explícito mais a recusa de identidade
  alheia na aplicação — não que o RLS pegaria uma consulta sem predicado.
- **A `reserva` continua retida.** O job marca `reconciliation_failed` e não
  libera nada; a liberação é comando humano com `--confirm`. Este land **não**
  mudou o comportamento de reserva.
