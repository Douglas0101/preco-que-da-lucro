# Política da migration toolchain

> Guard: `scripts/lib/migration-toolchain-guard.ts` · Núcleo puro: `auditMigrationToolchain(input)`
> · Testes: `src/test/migration-toolchain-guard.test.ts` · Faixas: `scripts/dependency-policy.json`
> · Saída: JSON no stdout, exit `0` pass · `1` veredito · `2` precondição.

## 1. O que o guard cobre

O guard é o **check específico** da migration toolchain. Ele lê dados e reprova, fail-closed, quando:

| #   | Check                    | Reprova quando                                                                                                                                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Faixa da política        | `drizzle-kit` não está em `scripts/dependency-policy.json`, ou `min`/`max` são ilegíveis, invertidos ou degenerados (`min >= max`)                                                                 |
| 2   | Versão instalada         | `node_modules/drizzle-kit/package.json` ausente, ou a versão está fora de `[min, max]` — a mensagem distingue **downgrade** (abaixo de `min`) de **fora da faixa aprovada** (acima de `max`)       |
| 3   | Símbolo `defineConfig`   | O arquivo de tipos de `drizzle-kit` não existe, ou não declara `defineConfig`                                                                                                                      |
| 4   | `drizzle.config.ts`      | O config não carrega (erro de load, sem `default`), ou declara `dialect !== "postgresql"` / `out !== "./drizzle"`                                                                                  |
| 5   | Migrations classificadas | `drizzle/*.sql` está vazio (**descoberta vazia não é aprovação**), ou alguma migration não tem entrada no registry, ou a classificação está fora da taxonomia de `scripts/db/migration-classes.ts` |
| 6   | Ambiente declarado       | `.env.example` não declara `DATABASE_URL` **e** `DATABASE_ADMIN_URL`                                                                                                                               |

Ausência é violação em todas as seis. O guard nunca assume o que não leu.

A taxonomia de classes (`SAFE`, `ONLINE_WITH_CARE`, `DATA_MIGRATION`, `BREAKING`) é **importada** de
`scripts/db/migration-classes.ts` — o guard não a reimplementa, para que as duas fontes não possam divergir.

## 2. O que o guard **não** cobre

- **Conectividade real com o banco.** O guard roda sem container e sem rede. Ele carrega
  `drizzle.config.ts` com `DATABASE_ADMIN_URL` apontando para uma URL loopback _dummy_
  (`postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test`); `defineConfig` só valida o
  objeto recebido e **nenhuma conexão é aberta**. Replay do chain, grants, RLS e concorrência continuam no
  tier `db:test`, que exige o container PG17 (`npm run db:up`). É essa separação que permite rodar o
  guard no pipeline leve, onde não há Docker.
- **Integridade do lockfile.** SHA-256 do lock, spec do `package.json` e espelhamento são do
  `scripts/m02-lockfile-guard.mjs`. O guard de toolchain consome a versão _instalada_, não a resolvida.
- **Vulnerabilidades de CVE.** Não é scan de segurança; é política de faixa aprovada.
- **Qualidade da migration em si.** O guard verifica que ela está _classificada_, não que o SQL está
  correto — isso é `npm run db:classify:check` e a suíte `db:test`.

## 3. Por que a toolchain é classe `critical`

1. **INV-012 — migrations são reproduzíveis.** A reprodutibilidade inclui a _versão da ferramenta_ que as
   gerou. Um chain aplicável com `drizzle-kit` A não é garantidamente aplicável com a versão B: o
   formato de `drizzle/meta/_journal.json`, a semântica de `generate` e a geração de SQL mudam entre
   minors. Um rebaixamento silencioso quebra a premissa antes de qualquer migration ser aplicada.
2. **O config depende de um símbolo versionado.** `drizzle.config.ts:1` faz
   `import { defineConfig } from "drizzle-kit"`. `defineConfig` não existe nas versões antigas da
   toolchain. Ou seja: a dependência do repo sobre `drizzle-kit` não é "a CLI funciona", é **um símbolo
   nomeado que existe a partir de uma certa versão**. Rebaixar a versão não é uma escolha de flavor, é
   cortar a dependência.

## 4. O incidente real, como caso

Um WIP do MAESTRO rebaixou `drizzle-kit` de `^0.31.10` para `^0.18.1`. A `0.18.1` é **anterior ao
símbolo `defineConfig`**.

**Sintoma observado:** o `tsc` só reclamou depois, em `npm run typecheck`:

```text
drizzle.config.ts(1,10): error TS2305: Module '"drizzle-kit"' has no exported member 'defineConfig'
```

O atraso é o problema. O rebaixamento entrou, o `typecheck` quebrou, e a falha apareceu num stage do
pipeline em vez de no commit que a causou — com o lockfile já reescrito e o `m02:lockfile-guard`
derrotado como sintoma, não como causa.

**Onde o guard teria pego:** em duas razões independentes, no commit, sem banco e sem rede:

```text
drizzle-kit (installed): observado 0.18.1, esperado >=0.31.0 (downgrade abaixo do mínimo aprovado 0.31.0..0.31.99)
drizzle-kit (types): observado tipos sem defineConfig, esperado defineConfig declarado — a versão instalada é anterior ao símbolo importado por drizzle.config.ts
```

As duas mensagens importam: a primeira diz _o que_ foi feito (downgrade), a segunda diz _por que isso
quebra_ (a versão é anterior ao símbolo). Se o check 3 não existisse, um downgrade de 0.31.10 para
0.30.x — que ainda tem `defineConfig` — passaria; se o check 2 não existisse, uma versão futura com o
símbolo removido passaria. Os dois são necessários.

## 5. O que fazer quando reprova

1. **Leia `reasons` no JSON.** A finding nomeia pacote, lado, observado e esperado. Ela já diz se é
   downgrade, faixa invertida, símbolo ausente, config quebrado, migration sem classificação ou env
   por declarar.
2. **Restaure a faixa aprovada.** `npm ci --ignore-scripts` reconstrói `node_modules` a partir do
   `package-lock.json`; se a faixa em si mudou, corrija `scripts/dependency-policy.json` e o
   `package.json` juntos — eles não podem divergir.
3. **Reexecute o guard** antes de seguir. Ele é barato: sem banco, sem rede, sem container.
4. **Se o rebaixamento for intencional**, não é downgrade de toolchain, é mudança de contrato: abra
   **Downgrade Request** em `scripts/dependency-approvals/` com (a) justificativa, (b) **teste
   comparativo** — gerar e aplicar o chain com a versão antiga num banco descartável e comparar o
   resultado com a faixa aprovada — e (c) o efeito em `drizzle.config.ts`, que é onde o símbolo
   importado deixa de existir. Sem Downgrade Request aprovado, um pacote `critical` não tem a faixa
   estreitada para baixo.

Exit `2` não é "reprovou": é **precondição** (política ausente/malformada, `drizzle.config.ts`
ilegível). O guard não pôde formar veredito — isso é falha de ambiente do guard, não da política, e
precisa ser resolvida antes de o exit `1` passar a significar alguma coisa.

## 6. Relação com o `upgrade-guard`

`scripts/lib/upgrade-guard.ts` é o **guard geral de política de dependências**: ele varre todos os
15 pacotes de `scripts/dependency-policy.json`, confere faixa, approved Downgrade Requests e remoção
de pacote listado. Este arquivo é o **check específico de migration toolchain**: ele desce ao detalhe
que só a migration toolchain tem — o símbolo `defineConfig` nos tipos publicados, o `dialect`/`out`
de `drizzle.config.ts`, a cobertura de classificação de `drizzle/*.sql` e a separação pooled/direct de
§12.2.

Os dois se **complementam** e rodam em paralelo: o `upgrade-guard` é o **portão de entrada** (nenhum
pacote sai da faixa aprovada sem passar por ele) e este é a **checagem derivada** (para o pacote de
maior consequência, "a faixa aprovada ainda é executável aqui?"). Um `pass` do `upgrade-guard` com
`drizzle-kit` na faixa não dispensa este guard, porque faixa correta não garante símbolo presente nem
config carregável — foi exatamente o que o incidente mostrou.

Por que o `compareVersions`/`inRange` estão duplicados nos dois arquivos: são ~20 linhas de
aritmética, e um guard de política não pode falhar porque o outro arquivo foi movido ou renomeado. A
decisão de extrair para um módulo compartilhado, se um dia a duplicação custar caro, é do MAESTRO.

## 7. Adicionar um check novo

O núcleo (`auditMigrationToolchain`) recebe **dados já lidos** e devolve `string[]`; o CLI faz o I/O.
Mantenha essa fronteira: um check que precisa de `fs`, rede ou banco dentro do núcleo não é testável
hermeticamente, e um teste que precisa de um segundo `node_modules` para falsificar não é hermético.
Toda finding nova segue o formato compartilhado:

```text
${pacote} (${lado}): observado ${observado}, esperado ${esperado}
```

E todo check novo vem acompanhado de um caso negativo que **altera um único campo** e afirma o
**conteúdo** da finding. Um teste que passa com a lógica removida não é teste.
