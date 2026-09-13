# Pré-flight RAT — resultados da rodada 🤖 (2026-09-07)

- **Base:** branch `develop`, HEAD `8d26a2c954172a4fee8ecfc9fad1d7fbab8a117f`, STACK_MODE `uncommitted`
- **Escopo:** somente-leitura + este bundle novo. Nenhuma escrita em produção,
  nenhum estado selado alterado, nada commitado. S1 NÃO executado (regra de
  stop da lacuna 3: exige RAT S0). C-02 NÃO executado (depende de S1 selado).
- **Método:** comandos oficiais do repo (npm/node), saídas brutas em `logs/`.

## 1. Quadro de resultados

| #   | Verificação                       | Resultado                                                                                                                                                                                                                                                                                                                            | Evidência                                                  |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 1   | env-guard selftest                | **PASS 13/13** (exit 0)                                                                                                                                                                                                                                                                                                              | `logs/env-guard-selftest.log`                              |
| 2   | SUMS verify — baseline            | **PASS** — 6/7 bundles GREEN; `gsec-2026-09-06` RED-LABELED (2 pins, exceção ativa até assinatura do memo V0)                                                                                                                                                                                                                        | `logs/sums-verify-before.log`                              |
| 3   | SUMS verify — pós-testes          | **PASS** — zero drift; nenhum arquivo novo em bundle existente                                                                                                                                                                                                                                                                       | `logs/sums-verify-after-tests.log`                         |
| 4   | Decisão formal do guard p/ `test` | **DENY exit 3** — `.env` local tem `DATABASE_URL` apontando `ep-long-violet-aye9g0bn-pooler…` (produção). Guard segurou o hazard B-00 a fechado. Remédio = Emenda #5 (split), ainda DRAFT                                                                                                                                            | `logs/env-guard-decisao-test.log`                          |
| 5   | Suíte de testes                   | `npm test` **bloqueada pelo guard** (comportamento correto). Em condição CI-equivalente (nenhum env de DB presente = condição ALLOW do próprio guard, sem contornar decisão): **42/42 arquivos, 396/396 testes PASS** (27.5s)                                                                                                        | `logs/npm-test-deny.log`, `logs/vitest-ci-equivalente.log` |
| 6   | `m02:v2b --plan`                  | **exit 0** — DAG 9 passos com cleanup always()                                                                                                                                                                                                                                                                                       | `logs/m02-v2b-plan.log`                                    |
| 7   | `m02:v2b` sem credencial          | **exit 3 pré-conexão** (`sockets_abertos: 0`); falta `SUPABASE_MIGRATION_DATABASE_URL` → risco NO-GO datado 10/09 (pedido literal pronto em `pedido-d2-credencial.md`)                                                                                                                                                               | `logs/m02-v2b-sem-credencial.log`                          |
| 8   | `m02:readiness` (8 gates)         | **exit 2 INCOMPLETE honesto**: matrix **PASS**, boundaries **PASS**; substrate-smoke **DESCONHECIDO** (`DATABASE_ADMIN_URL` ausente do `.env` — loader sancionado pendente); `m02-state`/`g1-assinada`/`sec01-fechada`/`freeze-ativo` **FAIL** (atos humanos H1/H4/H5); `snapshot-fresco` **FAIL** (dump stale 45.6h — C-02 pós-RAT) | `logs/readiness.json`                                      |
| 9   | CI GitHub                         | run `34011409054` **success** (UI stack) no HEAD `8d26a2c`; PR #34 aberto (`fix/pre-a4-guard-safety`); workflows presentes: ui-stack, neon-pr-branch, neon-preview, neon-readiness, neon-drill-ops                                                                                                                                   | gh CLI                                                     |
| 10  | Neon (API, read-only)             | projeto `damp-forest-57346541` (pg17, us-east-2); branches: `production` `br-snowy-violet-aymcvvvv` (ready/default) e `develop` `br-small-hill-aymcu14y` (archived); **zero efêmeras**; snapshot único `snap-tiny-smoke-ayc382ji` (05/09, expira 10/10); `history_retention` = **21600s = 6h** → gap N-10 confirmado (< 7 dias)      | API Neon                                                   |
| 11  | Docker local                      | container `preco-que-da-lucro-postgres` up 40h (healthy)                                                                                                                                                                                                                                                                             | docker ps                                                  |
| 12  | Git / B-00                        | `.env` **não trackeado**; só `.env.example` + artefatos de auditoria de segredos trackeados; `.gitignore` cobre `.env`/`.env.*`/`*.env`; working tree = stack V0+V4+V5 empilhado aguardando H1 (humano)                                                                                                                              | git ls-files/status                                        |

## 2. Leitura executiva

- O conjunto de 5 gates FAIL reproduz **exatamente** o esperado pré-RAT
  (mapa de flips em `mapa-flips-readiness.md`) — nenhum flip fora do mapa.
- Achado novo desta rodada: **o `.env` local ainda aponta `DATABASE_URL`
  para o endpoint pooled de produção** — é o estado exato do hazard B-00;
  o guard o DENY-a em todo script dev/test (exit 3 comprovado). Aplicar a
  Emenda #5 (B-02 rewiring) é o que destrava `npm test` local.
- Nada bloqueia o RAT: material de assinatura pronto em
  `rat-s0-signature-block.md`.

## 3. Integridade deste bundle

`SHA256SUMS` deste diretório foi gerado exclusivamente por `node
scripts/m02-sums.mjs` (paths root-relative, compatível com
`sha256sum -c`), após a última edição destes arquivos. A verificação final
(`m02:sums --verify`) foi executada após a geração e o resultado está
registrado no relatório da sessão; os SUMS dos 7 bundles pré-existentes
foram conferidos byte-idênticos antes/depois da regeneração.
