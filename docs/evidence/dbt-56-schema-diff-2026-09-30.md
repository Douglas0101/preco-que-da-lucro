# DBT-56 — Schema diff §12.5: veredito por nível de migration

- **Data:** 2026-09-30
- **Dívida:** DBT-56 (`docs/evidence/agent-state/DEBTS.md`)
- **Run medido:** `36776521098` (PR #50), job `Branch efêmera · migrate · integração · RLS probe · E2E`
- **Arquivos:**
  - `scripts/db/schema-diff-verdict.ts` (novo — o predicado)
  - `src/test/schema-diff-verdict.test.ts` (novo — 23 testes)
  - `.github/workflows/neon-pr-branch.yml` (passo `schema_diff` reescrito)

## 1. Hipótese

O passo `Schema diff §12.5` classificava o resultado por **uma** pergunta — "o
`compare_schema` saiu vazio?" — combinada com "o PR mexe em `drizzle/**`?". Com a
ordem sancionada _expand antes de promover_, um diff vazio é o estado **esperado**
depois que as migrations do PR já chegaram à produção: as duas pontas estão no
mesmo nível e não há schema diferindo para reportar. O predicado lia esse estado
como defeito.

## 2. O que foi medido (antes)

**Falha do job** (`gh run view 36776521098 --json jobs`):

```
Branch efêmera · migrate · integração · RLS probe · E2E  → failure
  ├ Fork-guard + presença de segredo                        → success
  ├ Branch efêmera · …                                      → failure
  │    └ Schema diff §12.5                                  → failure
  └ Cleanup always() com prova (§12.5)                      → success
```

**Predicado removido** (`neon-pr-branch.yml:235-268` no HEAD anterior), a forma
exata que classificava:

```js
const reading =
  touched === "yes"
    ? empty
      ? "INCONSISTENTE: o PR mexe em drizzle/** mas o diff saiu vazio — checar journal/migrations da branch"
      : "consistente: mudança de schema do PR visível contra produção"
    : touched === "no"
      ? empty
        ? "consistente: diff vazio (PR não mexe em drizzle/**)"
        : "diff não vazio em PR sem drizzle/**: atribuível a …"
      : "indeterminado: lista de arquivos do PR indisponível";
```

Duas entradas colapsam no mesmo rótulo — a que o run medido produziu e a que é o
defeito real:

| Estado real                                | `empty` | Rótulo antigo   | Correto?          |
| ------------------------------------------ | ------- | --------------- | ----------------- |
| Produção **já migrada** (journals iguais)  | `true`  | `INCONSISTENTE` | ❌ falso vermelho |
| Migration **não aplicou** (produção atrás) | `true`  | `INCONSISTENTE` | ✅ por sorte      |

O predicado não tinha entrada alguma para distinguir as duas, porque a variável
que as separa — o conjunto de migrations aplicadas — não era lida.

**Log do passo** (o `empty` veio de um corpo persistido; `compare_schema` também
respondeu HTTP 408 nesse run, caminho de erro já declarado que reprova o passo por
`exit 1` — inalterado por esta correção).

**Estado de produção no momento** (fonte: `DEBTS.md`/PROGRESS L257, 2026-09-30):
migrations `0012`–`0019` aplicadas; `drizzle/meta/_journal.json` do repo declara
**20** entradas (última `0019_tiresome_robin_chapel`).

## 3. A mudança

O veredito passa a ser decidido pelos **journals**, não pelo vazio. O passo do
workflow continua sendo quem fala com `compare_schema` (e persiste o corpo bruto
como artefato); a decisão é de `scripts/db/schema-diff-verdict.ts`.

**Entradas** (`julgarSchemaDiff`): os conjuntos de hashes de
`drizzle.__drizzle_migrations` na branch do PR e em produção, o `vazio` do
`compare_schema`, e `drizzle/meta/_journal.json`.

**Regras, na ordem de decisão:**

| #   | Condição                              | Veredito                                                                           |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | leitura do journal da branch falhou   | `INCONSISTENTE`, motivo nomeado                                                    |
| 2   | leitura do journal de produção falhou | `INCONSISTENTE`, motivo nomeado                                                    |
| 3   | journal da branch vazio               | `INCONSISTENTE` — não-vacuidade                                                    |
| 4   | journal de produção vazio             | `INCONSISTENTE` — a base não é a base migrada                                      |
| 5   | chain da branch ≠ `_journal.json`     | `INCONSISTENTE`                                                                    |
| 6   | journals **iguais**                   | `consistente: produção já migrada` (diff vazio) · alerta de drift (diff não vazio) |
| 7   | produção **atrás** + diff vazio       | `INCONSISTENTE` — schema igual com journals diferentes é contradição               |
| 8   | produção **atrás** + diff não vazio   | `consistente: mudança de schema do PR visível`                                     |
| 9   | branch atrás / divergente             | `INCONSISTENTE`                                                                    |

`DRIZZLE_TOUCHED` deixa de ser discriminador: qualifica a mensagem.

**Não-vacuidade.** A regra 3 é o que impede o gate de passar por omissão: dois
bancos recém-criados são "iguais" por construção (conjunto vazio = conjunto
vazio) e isso não é consistência. É a mesma razão pela qual `corpoVazio` nunca é
consultado antes de a leitura ter dado certo.

**Fail-closed.** `lerJournalAplicadas` devolve `LeituraJournal` falho em erro de
conexão, erro de query ou hash fora do formato sha256 — **nunca** um conjunto
vazio. A leitura é `select` numa transação `read only` com SQL constante, sem
interpolação: nenhuma escrita é possível por construção.

**Política de alvo.** Nenhum check de loopback ad-hoc foi reintroduzido em
`scripts/db/` (as quatro cópias de `assertLoopback` que este repositório removeu
continuam removidas):

- branch do PR → `exigirAlvoDeBanco` (`exigirAlvoDaBranch`): recusa produção com
  ou sem motivo; remoto exige `ALLOW_REMOTE_DB` com frase.
- baseline de produção → `classificarAlvo` (`exigirAlvoDoBaseline`): aceita
  loopback, override com motivo e produção; recusa URL inválida e remoto sem
  motivo. A distinção é deliberada e está no cabeçalho do módulo:
  `exigirAlvoDeBanco` existe para bloquear alvos _escrevíveis_, e este lado é
  leitura pura.

A URI da baseline é emitida pela própria API da Neon
(`GET /projects/{id}/connection_uri?branch_id=…&database_name=…&role_name=…`) —
**nenhum segredo novo no repo**, é a mesma `NEON_API_KEY` que o passo já usava
para `compare_schema`.

## 4. Depois — os cinco casos exigidos

Testes em `src/test/schema-diff-verdict.test.ts`
(`npx vitest run src/test/schema-diff-verdict.test.ts` → **23 passed**, exit 0):

| Caso                                                   | Teste                                                                                    | Veredito                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------ |
| **(a)** produção já migrada + PR toca `drizzle/**`     | `(a) journals IGUAIS + diff vazio + PR tocando drizzle/** ⇒ consistente`                 | `consistente`                  |
| (a)                                                    | `(a) o predicado antigo reprovava exatamente esta entrada — a regressão está provada`    | prova o delta                  |
| (a)                                                    | `(a) o rótulo DRIZZLE_TOUCHED qualifica a mensagem mas não decide o veredito`            | `consistente` nos três rótulos |
| **(b)** PR sem migrations, produção atrás, diff vazio  | `(b) branch tem 20, produção tem 12, diff VAZIO ⇒ INCONSISTENTE`                         | `inconsistente`                |
| (b)                                                    | `(b) o mesmo estado com diff NÃO vazio continua consistente`                             | `consistente`                  |
| (b)                                                    | `(b) a branch ATRÁS de produção é INCONSISTENTE mesmo com diff vazio`                    | `inconsistente`                |
| (b)                                                    | `(b) branch com chain incompleta é INCONSISTENTE pelo journal, não pela comparação`      | `inconsistente`                |
| (b)                                                    | `(b) journals divergentes sem subconjunto são INCONSISTENTES`                            | `inconsistente`                |
| **(c)** bancos frescos, zero migrations dos dois lados | `(c) journal VAZIO dos dois lados ⇒ INCONSISTENTE, não 'iguais portanto consistente'`    | `inconsistente`                |
| (c)                                                    | `(c) journal vazio só na branch ⇒ INCONSISTENTE nomeando o db:migrate`                   | `inconsistente`                |
| (c)                                                    | `(c) journal vazio só em produção ⇒ INCONSISTENTE`                                       | `inconsistente`                |
| (c)                                                    | `(c) chain da branch ≠ _journal.json é INCONSISTENTE mesmo com journals iguais entre si` | `inconsistente`                |
| **(d)** erro de leitura                                | `(d) erro ao ler o journal da branch ⇒ INCONSISTENTE, distinguível de (a)`               | `inconsistente`                |
| (d)                                                    | `(d) erro ao ler o journal de produção ⇒ INCONSISTENTE, distinguível de (a)`             | `inconsistente`                |
| (d)                                                    | `(d) leitura falhada NUNCA vira 'conjuntos iguais' — nem quando os dois lados falham`    | `inconsistente`                |
| (d)                                                    | `(d) a leitura real devolve falha, não vazio: shape inválido vira LeituraJournal falho`  | `ok: false`                    |
| **(e)** regressão do caso genuinamente divergente      | `(e) produção atrás + diff não vazio ⇒ 'consistente: mudança visível', como antes`       | `consistente`                  |
| (e)                                                    | `(e) journals iguais + diff NÃO vazio ⇒ drift nomeado, sem esconder o paradoxo`          | `consistente` + drift          |
| (e)                                                    | `(e) o resumo do passo mantém 'nao-vazio' com bytes, como o output antigo`               | idem                           |

### 4.1 Prova de que (a) falhava com a lógica antiga

O teste `(a) o predicado antigo reprovava exatamente esta entrada` reconstrói a
forma literal do predicado removido e roda **as duas** sobre a mesma entrada:

```js
const predicadoAntigo = (touched, empty) => touched === "yes"
  ? empty ? "INCONSISTENTE: o PR mexe em drizzle/** mas o diff saiu vazio — …"
          : "consistente: mudança de schema do PR visível contra produção"
  : …;
expect(predicadoAntigo("yes", true)).toMatch(/^INCONSISTENTE/);
expect(julgarSchemaDiff(entrada()).leitura).not.toMatch(/^INCONSISTENTE/);
```

O literal `INCONSISTENTE: o PR mexe em drizzle/** mas o diff saiu vazio` não
existe mais no workflow — verificado por parse do YAML:

```
$ node -e "…yaml.load(…).jobs['branch-ci'].steps.find(s=>s.id==='schema_diff')…"
step name: Schema diff §12.5 (compare_schema + veredito por nível de migration)
calls module: true
still has old verdict literal: false
```

### 4.2 Prova de execução contra Postgres real (não só unidade)

O `julgarSchemaDiff` puro é testado com fixtures; o caminho de I/O foi exercitado
contra um Postgres local real com tabelas `drizzle.__drizzle_migrations` de
verdade (20 / 12 / 0 linhas) e um endpoint recusado. Saída observada:

```
LEITURAS REAIS: { igual: 20, atras: 12, vazio: 0,
                  quebrada: 'falhou: quebrada: connect ECONNREFUSED 127.0.0.1:1' }

(a) journals iguais, diff vazio  -> consistente    | consistente: produção já migrada — os journals …
(b) produção atrás, diff vazio   -> inconsistente  | INCONSISTENTE: produção está atrás (12 de 20 …)
(c) bancos vazios, diff vazio    -> inconsistente  | INCONSISTENTE: a branch do PR não tem migration …
(d) leitura falhou em produção   -> inconsistente  | INCONSISTENTE: não foi possível ler drizzle.__dri…

POLITICA: remoto sem motivo recusado -> PRODUCTION_READ_URL aponta para "ep-frosty-bread-ayi2pg4p.aw…
POLITICA: validarHashes('lixo') -> {"ok":false,"motivo":"hash fora do formato sha256 esperado: \"lixo\""}
```

O smoke foi **descartado** junto com os bancos `smoke_igual` / `smoke_atras` /
`smoke_vazio` que ele criou (script e drop verificados); nenhum resíduo.

Observação de fidelidade: nesta primeira execução as quatro leituras falharam
(`The server does not support SSL connections` — o container local não tem TLS), e
o veredito foi `INCONSISTENTE` nos quatro casos. Isso é o fail-closed funcionando
como deve; a execução acima, com `sslmode=disable` apenas na URI do smoke local, é
a que exercita o caminho de leitura bem-sucedido. O módulo mantém
`ssl: { rejectUnauthorized: true }` — Neon exige TLS e afrouxar seria errado.

## 5. O que NÃO mudou

- O caminho **PULADO com rótulo** (H-2, `NEON_API_KEY` ausente) está intacto: CI
  verde com o skip declarado, sem chamada de rede e sem credencial presumida.
- O tratamento de **`compare_schema` HTTP ≠ 200** está intacto: artefato de erro,
  `summary=ERRO (HTTP …)`, `exit 1`. O `HTTP 408` do run medido é erro de
  transporte da API da Neon, não o defeito deste passo — declarado, não corrigido
  aqui.
- O job `cleanup` com `always()` e a prova de delete não foram tocados.
- Nenhum outro workflow foi editado. Nenhuma linha de `DEBTS.md` ou do journal foi
  tocada (propriedade do integrador).

## 6. Limites declarados

1. **`npm run check` não foi executado** — o gate de 20 scripts é do integrador,
   uma vez, após o merge das fatias. Só este arquivo de vitest foi rodado
   (23 passed, exit 0), conforme instruído.
2. **O caminho real da API da Neon não foi exercitado ao vivo.** A sequência
   `GET /branches` → `GET /branches/{id}/databases` → `GET /connection_uri` foi
   escrita contra a referência publicada da API v2
   (`neon.com/docs/reference/api/projects/get-connection-uri`), mas o
   `NEON_API_KEY` do repositório não está disponível fora do CI. Se a chave for
   apenas de escopo _branch_, `connection_uri` pode negar — e nesse caso o passo
   **reprova** (fail-closed, `INCONSISTENTE` com o motivo), em vez de degradar
   para verde. Esse é o comportamento correto, mas significa que o primeiro PR
   real após o merge pode reprovar por falta de permissão, e não por schema.
   `N/A` para o comportamento observado ao vivo.
3. **Role da leitura.** O `role_name` é resolvido pelo `owner_name` do banco
   (`neondb_owner`), que é quem tem `SELECT` sobre `drizzle`. Se o layout de roles
   mudar, a resolução falha com `owner do banco "…" não resolvido` — nomeado, não
   silencioso.
4. **Sem retry.** `connection_uri` e as leituras não têm retry. Um 408 (o que
   aconteceu no run medido, no `compare_schema`) reprova o passo. Adicionar
   retry seria escopo novo; fica declarado para decisão do integrador.
5. **Ordem de comparação.** A igualdade exige os hashes na **mesma ordem** de
   `order by created_at, id`. Ordem diferente com o mesmo conteúdo cairia em
   "divergente" e reprovaria — False Negative seguro, nunca o inverso.
6. `docs/evidence/local-ci/**` (artefatos brutos de outra fatia) foi deixado
   intacto, conforme instruído.

## 7. Reprodução

```bash
# unidade + regressão (único comando de teste permitido nesta fatia)
npx vitest run src/test/schema-diff-verdict.test.ts     # → 23 passed, exit 0

# o workflow não usa mais o predicado inline
grep -c "npx tsx scripts/db/schema-diff-verdict.ts" .github/workflows/neon-pr-branch.yml   # → 1
grep -c "mas o diff saiu vazio" .github/workflows/neon-pr-branch.yml                     # → 0
```
