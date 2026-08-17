# G1 — Validação local do fix Sonar do PR #16 — 2026-08-16

## Identificação

- Base do PR #15: `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`.
- Head do PR #16 validado localmente: `07e3c05a46a0fe8f6142276e746900b8a2ada28f`.
- Clone: `/tmp/preco-pr16-head-20260816-v2`.
- Branch de validação: `codex/pr16-sonar-dedupe-head`.
- Commit de implementação: `11c07e8b24e718f1cdb7e54c6191b8fda390c3eb`.
- A evidência será versionada em commit separado após o commit de
  implementação, mantendo a vinculação explícita com o SHA acima.

## Hipótese e métrica

**Hipótese:** centralizar a derivação pura de produtos, seleção e detalhe
selecionado elimina a duplicação detectada pelo Sonar nas três rotas sem
alterar queries, contratos financeiros ou read models.

**Métricas:**

- testes focados de fronteira/query/helper;
- testes completos;
- typecheck, lint e format;
- build e bundle;
- migrations/RLS/rollback locais;
- audit high;
- E2E nos quatro projetos Playwright;
- Quality Gate Sonar externo.

## Antes

- O bloco de derivação de `products`, `selectedProductId` e `selectedDetail`
  era repetido em `diagnostico.tsx`, `ponto-equilibrio.tsx` e
  `simulacoes.tsx`.
- O SonarCloud registrou 5,2% de duplicação em código novo, acima do limite de
  3%.

## Alteração

- Criado `src/lib/product-selection.ts` com derivação pura e fallback
  determinístico para o primeiro produto.
- As três rotas passaram a consumir o helper.
- `src/test/query-performance.test.ts` recebeu casos de lista vazia,
  seleção válida e fallback inválido.
- `useQueries`, `useQuery`, factories, cache, invalidação, `loadStatus`,
  contratos de erro/retry, N+1 batch, dashboard set-based e
  `finance.boundaries.test.ts` foram preservados.
- Não houve alteração em Neon, produção ou PR #12.

## Resultado local

| Gate                                | Resultado                         | Limite                                                  |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `npm ci --ignore-scripts`           | PASS — 612 pacotes                | —                                                       |
| teste focado                        | PASS — 9/9                        | —                                                       |
| `npm run check:ui-stack`            | PASS                              | —                                                       |
| `npm run check:no-supabase-runtime` | PASS                              | —                                                       |
| `npm run typecheck`                 | PASS                              | —                                                       |
| `npm run lint`                      | PASS                              | —                                                       |
| `npm test`                          | PASS — 21 arquivos, 245 testes    | —                                                       |
| `npm run format:check`              | PASS após formatar esta evidência | —                                                       |
| `npm run build`                     | PASS                              | —                                                       |
| `npm run check:bundle`              | PASS                              | —                                                       |
| `npm run db:test`                   | PASS nos quatro blocos            | PostgreSQL 17 descartável em `127.0.0.1:55432`          |
| `npm run db:check`                  | PASS                              | PostgreSQL 17 descartável em `127.0.0.1:55432`          |
| `npm audit --audit-level=high`      | PASS no exit code                 | 4 advisories moderados transitivos de `esbuild`         |
| `npm run test:e2e`                  | PASS — 32/32                      | quatro projetos Playwright, credenciais locais efêmeras |
| SonarCloud                          | PENDENTE                          | precisa reanálise no SHA publicado                      |

`db:up` não criou um novo container porque `preco-que-da-lucro-postgres` já
existia. O container existente foi preservado; a versão observada foi
PostgreSQL 17.11. Para fechar a lacuna de isolamento, foi iniciado um
container separado `preco-pr16-postgres` com a imagem `postgres:17-alpine`,
porta local `55432`, e os comandos `db:test`, `db:check`, `e2e:prepare` e
`test:e2e` foram executados contra ele. O container foi parado ao final e não
há container com esse nome remanescente. As credenciais do fixture foram
geradas somente no processo e não foram registradas.

A primeira tentativa de E2E foi interrompida por uma variável de ambiente do
fixture membro expandida antes da variável de senha estar definida; ela não é
evidência de falha do produto. A execução corrigida preparou o fixture e
terminou com 32/32 testes aprovados.

## Decisão

**G1 local PASS; aceitação externa PENDENTE.** Todos os gates locais
executados, incluindo PostgreSQL descartável e os quatro projetos Playwright,
passaram. O patch ainda não pode ser aceito como correção do PR enquanto a
reanálise do SonarCloud e o CI externo do SHA publicado não estiverem verdes.

Não foi executado `npm audit fix`, não houve alteração de threshold/exclusão do
Sonar, e nenhum segredo foi registrado.
