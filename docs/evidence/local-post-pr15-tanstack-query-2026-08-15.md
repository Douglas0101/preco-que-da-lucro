# Evidência local pós-PR #15 — base limpa e lote N+1/TanStack Query

Data: 2026-08-15

SHA-base: `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`

SHA do patch validado: `c0c8ed87e4eb334bb3904ad3357da3d492fee144`

Branch de referência: `develop`

## Limite da evidência

Esta evidência separa quatro estados: validação local, CI/Sonar externo, readiness
Neon e cutover. Apenas a validação local foi exercitada neste ciclo. Nenhuma
credencial Neon foi usada, nenhuma ação foi feita no GitHub e nenhuma alteração
de produção foi realizada.

O checkout principal estava sujo e foi preservado. Como `.git/worktrees` não
estava gravável, a base foi materializada em `/tmp/preco-pr15-local-gate` por
`git archive` do SHA acima, sem resetar, sobrescrever ou parar o container/preview
existente. A cópia não contém `.git`; portanto, a correspondência do SHA é a do
comando de archive e de `origin/develop`, não uma segunda verificação de
metadados dentro do snapshot.

## Local Gate Agent — base limpa

| Comando                             | Resultado | Observação                                                                 |
| ----------------------------------- | --------- | -------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`           | PASS      | Snapshot limpo                                                             |
| `npm run check:ui-stack`            | PASS      | Boundary Base UI/shadcn limpa                                              |
| `npm run check:no-supabase-runtime` | PASS      | Runtime sem Supabase/token em Web Storage                                  |
| `npm run format:check`              | PASS      | Snapshot limpo                                                             |
| `npm run typecheck`                 | PASS      | Snapshot limpo                                                             |
| `npm run lint`                      | PASS      | Snapshot limpo                                                             |
| `npm run test`                      | PASS      | 20 arquivos, 236 testes na base                                            |
| `npm run db:up`                     | BLOCKED   | Container PostgreSQL 17 existente; não foi parado nem substituído          |
| `npm run db:test`                   | PASS      | Migrations, RLS/AuthZ, rollback, chat/tool security                        |
| `npm run db:check`                  | PASS      |                                                                            |
| `npm run build`                     | PASS      |                                                                            |
| `npm run check:bundle`              | PASS      | Entry 222859 minified / 68416 gzip / 59612 Brotli                          |
| `npm audit --audit-level=high`      | PASS      | 4 advisories moderados de `esbuild`; nenhum high/critical; sem `audit fix` |
| `npm run test:e2e` equivalente      | PASS      | 32/32 nos quatro projetos: Chromium, Firefox, WebKit e mobile              |

O E2E da base foi executado contra preview isolado em `4174`, porque `4173`
estava ocupado. Os artefatos do gate limpo ficaram em:

- `/tmp/preco-pr15-local-gate/.artifacts/playwright-results.json`
- `/tmp/preco-pr15-local-gate/playwright-report/index.html`
- `/tmp/preco-pr15-local-gate/.artifacts/bundle-report.json`
- `/tmp/preco-pr15-local-gate/.artifacts/build-warnings.json`
- `/tmp/preco-pr15-local-gate/.artifacts/e2e-auth.json`
- `/tmp/preco-pr15-local-gate/test-results/.last-run.json`

### Conclusão do gate

A matriz funcional local passou, mas a base **não é declarada totalmente verde**
porque `db:up` não conseguiu criar seu container descartável isolado. O resultado
é compatível com o PostgreSQL 17 já existente e com `db:test`/RLS/rollback
passando, mas não prova a criação limpa do serviço pelo compose. O audit passou
seu limiar solicitado, com a pendência moderada de `esbuild` registrada acima.

## Performance/P1 Agent — N+1 e TanStack Query

### Before

- A simulação usava uma chave inline e `staleTime: 0` em
  `src/routes/_authenticated/simulacoes.tsx`.
- Diagnóstico, ponto de equilíbrio e simulações mantinham em `useState` dados
  derivados de queries e efeitos para sincronizá-los.
- A prova de contagem fixa do read model e a prova de invalidação seletiva ainda
  não existiam.

### Change

- `src/lib/query-options.ts:9-99` centraliza `queryKeys`, a política de cache
  autenticada e `financialSimulationQueryOptions`, incluindo todos os campos
  relevantes da simulação nas factories.
- `src/routes/_authenticated/diagnostico.tsx`,
  `src/routes/_authenticated/ponto-equilibrio.tsx` e
  `src/routes/_authenticated/simulacoes.tsx` passaram a derivar dados de
  `useQueries`/`useQuery`; estado local ficou restrito a seleção e inputs
  controlados.
- A simulação exibe erro remoto, referência `SIM-*` e retry também quando a
  chamada de cálculo (`simulationQuery`) falha.
- O read model batch existente de produtos e o dashboard set-based foram
  preservados; não houve retorno de query por produto.
- `src/test/query-performance.test.ts:59-112` cobre chave estável, mudança de
  cada campo, `staleTime`/retry, invalidação seletiva e contagem fixa do
  dashboard.
- `src/test/finance.boundaries.test.ts` foi atualizado apenas para refletir a
  nova representação declarativa dos estados de erro, sem mudar o contrato
  financeiro testado.

### After / result

- Testes focados: **22/22** em `finance.boundaries.test.ts` e
  `query-performance.test.ts`.
- A prova do read model set-based do dashboard observou **6 operações** tanto
  para 1 quanto para 3 produtos; não houve crescimento de queries por produto.
- A prova direta do read model batch de produtos observou **5 operações** tanto
  para 1 quanto para 3 produtos; não houve crescimento de queries por produto.
- Suíte completa do checkout após o patch: **21 arquivos, 242 testes**.
- `lint`, `typecheck`, `format:check`, `check:ui-stack`,
  `check:no-supabase-runtime`, `build` e `check:bundle`: PASS.
- E2E após o patch: **32/32 PASS** nos quatro projetos Playwright, com preview
  isolado em `4174` e fixture PostgreSQL local.

Não foi possível registrar neste ciclo uma medição de latência por rota
autenticada ou um `EXPLAIN ANALYZE` representativo. A prova automatizada de
contagem fixa cobre agora tanto o dashboard quanto diretamente o read model de
produtos; latência/EXPLAIN continuam critério do lote seguinte quando houver um
ambiente de medição controlado.

## Observability/Roadmap Agent — auditoria sem sobreposição

| Área          | Estado encontrado                                                                          | Próximo critério de aceite                                                       |
| ------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| HTTP          | Span e correlação existem; status/handler e cobertura de erro inesperado não são uniformes | Span deve fechar com status/handler e métrica também em erro inesperado          |
| DB            | Span cobre a transação de tenant                                                           | Medir contagem, linhas, p95 e correlação por operação sem registrar SQL sensível |
| IA/tools      | Spans, duração e redaction parcial existem                                                 | Acrescentar correlação, tenant e custo/tokens sem PII/secrets                    |
| Financeiro    | Há métricas do read model de produtos                                                      | Cobrir simulação, diagnóstico e break-even com status, incompletude e versão     |
| Redaction     | Logger faz redaction; `withSpan` não é uma fronteira autossanitizante                      | Testes de redaction e atributos permitidos                                       |
| Exporter      | OTLP é opt-in e falha sem bloquear o startup                                               | Teste explícito de exporter indisponível e telemetria degradada                  |
| UX financeira | Ainda falta diferenciar origem, completude, hipótese e erro recuperável                    | Badges/origem, explicação, retry e estado incompleto verificáveis no E2E         |

Nenhum código de observabilidade foi alterado por esse agente. O próximo lote
local recomendado é UX financeira e hardening da telemetria, condicionado aos
testes acima; Neon readiness e cutover permanecem fora deste ciclo.

## Estados administrativos

- Local: matriz funcional e patch P1 comprovados, com o bloqueio de `db:up`
  documentado.
- CI/Sonar: estado externo não foi reexecutado nem alterado neste ciclo.
- Neon readiness: pendente por ausência de credenciais.
- Cutover/produção: não iniciado.
- Thread P1 do PR #14: permanece administrativamente pendente; não houve
  mutação GitHub.
