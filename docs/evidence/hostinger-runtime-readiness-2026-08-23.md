# Evidência — Hostinger Cloud Startup / Runtime Node-Nitro

Data do registro: 2026-08-23

## Limite da evidência

Este documento separa a validação local da operação externa. Ele não é aprovação de CI, Neon, Hostinger, migration ou cutover.

## Estado inicial

| Campo          | Valor                                                     |
| -------------- | --------------------------------------------------------- |
| Branch         | `codex/local-dev-postgres`                                |
| SHA            | `71b0dc14de2b43bd606e122695cd97bb0c1eb5f0`                |
| Checkout       | dirty, com alterações preexistentes fora deste incremento |
| Node/NPM       | `PASS` — Node `v24.15.0`, npm `11.14.1`                   |
| Processo       | `node .output/server/index.mjs`                           |
| Banco canônico | PostgreSQL externo, preferencialmente Neon                |

## Resultados

| Verificação                      | Status       | Evidência                                                                                                                               |
| -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                  | `PASS`       | build fresco concluído; Nitro `node-server` gerado sem warning bloqueante                                                               |
| `.output/server/index.mjs`       | `PASS`       | artefato gerado e utilizado pelo smoke                                                                                                  |
| Smoke com `NITRO_PORT`           | `PASS`       | `live=200`, `ready=503`, precedência `NITRO_PORT/NITRO_HOST` validada                                                                   |
| Smoke com `PORT`                 | `PASS`       | `live=200`, `ready=503`, precedência `PORT/HOST` validada                                                                               |
| Processo filho encerrado         | `PASS`       | smoke encerrou os dois processos sem órfãos observados                                                                                  |
| Logs sem secrets                 | `PASS`       | saída do smoke não expôs credenciais; falhas são redigidas pelo script                                                                  |
| `ready` 200 com PostgreSQL local | `PASS`       | `ready=200` com `{"status":"ready","dependencies":{"postgres":"ok"}}` via role `app_runtime`; ver seção de closeout                     |
| UI stack                         | `PASS`       | `npm run check:ui-stack`                                                                                                                |
| Runtime sem Supabase             | `PASS`       | `npm run check:no-supabase-runtime`                                                                                                     |
| Format                           | `PASS`       | `npm run format:check`                                                                                                                  |
| Typecheck                        | `PASS`       | `npm run typecheck`                                                                                                                     |
| Unit tests                       | `PASS`       | 25 arquivos / 273 testes                                                                                                                |
| Lint global                      | `PASS`       | resolvido ignorando a árvore preexistente `.p0-closeout-docker/` em `eslint.config.js`, `.prettierignore` e `.gitignore`, sem alterá-la |
| `db:check`                       | `PASS`       | `DATABASE_ADMIN_URL=postgresql://placeholder npm run db:check`                                                                          |
| `db:test` PostgreSQL 17          | `PASS`       | `EXPECTED_POSTGRES_MAJOR=17`: migrations do zero, constraints, RLS, P1, cross-tenant, rollback, auth, tools e chat OK                   |
| Bundle                           | `PASS`       | entry 223681 bytes; initial graph 463494 bytes, abaixo do limite de 500000                                                              |
| CI no SHA atual                  | `UNVERIFIED` | workflow remoto não foi consultado nesta execução                                                                                       |
| Hostinger hPanel                 | `BLOCKED`    | requer acesso e confirmação externa                                                                                                     |
| Neon/migration/cutover           | `BLOCKED`    | requer credenciais e autorização                                                                                                        |

## Variáveis e segurança

Nenhum secret, password, token ou URL real de conexão deve ser registrado neste arquivo. O runtime web usa `DATABASE_URL`; `DATABASE_ADMIN_URL` permanece restrita a migrations/admin. Resend e o gateway de IA continuam externos.

## Próxima atualização

Substituir os estados `UNVERIFIED` somente por resultados observados no checkout e no comando correspondente. Não promover `BLOCKED` para `PASS` sem evidência externa específica.

## Closeout local de 2026-08-23

Execução posterior no mesmo checkout, com o daemon Docker disponível
(`docker info` OK), promoveu três estados `BLOCKED` para `PASS`:

1. **Lint global** — a causa era a árvore preexistente `.p0-closeout-docker/`,
   não coberta pelos ignores (a exceção `jsx-a11y/label-has-associated-control`
   vale apenas para `src/components/ui/label.tsx` da raiz). Correção mínima:
   `.p0-closeout-docker` adicionado a `eslint.config.js` (ignores),
   `.prettierignore` e `.gitignore`, espelhando o tratamento de `.worktree-*`.
   A árvore não foi alterada nem removida. `npm run lint`,
   `npm run format:check`, `npm run typecheck` e `npm run check:ui-stack`: PASS.
2. **`db:test` PostgreSQL 17** — primeira tentativa falhou no rollback/replay
   (`DROP ROLE app_runtime` com 55 objetos dependentes herdados de volume
   persistido de execuções anteriores). O volume descartável foi resetado
   conforme `docs/runbooks/postgres-local-docker.md`
   (`db:down` + `docker volume rm preco-que-d-main_postgres-data` + `db:up`).
   Em banco limpo: `PostgreSQL 17, migration zero, constraints, RLS, P1
tables, cross-tenant e rollback: OK`; Better Auth: OK; tool registry: OK;
   chat semantics: OK. `db:check` com admin real: sem drift.
3. **`ready` 200 com PostgreSQL local** — senha local descartável definida para
   a role `app_runtime` via conexão admin (mesmo mecanismo de
   `scripts/e2e/seed-auth.ts`), artefato recém-construído iniciado com
   `DATABASE_URL` da role de menor privilégio, `PORT=4173`:
   `GET /api/health/live` → 200; `GET /api/health/ready` → 200 com corpo
   `{"status":"ready","dependencies":{"postgres":"ok"}}`. Processo encerrado
   com SIGTERM sem órfãos; `npm run check:hostinger-runtime` reexecutado e o
   cenário degradado (`ready=503` sem banco) continua PASS. Banco derrubado
   com `npm run db:down`.

Foi criado também `docs/evidence/hostinger-hpanel-verification.md`, checklist
dos 11 itens externos do hPanel (todos `BLOCKED` até verificação assistida com
o usuário). Permanecem pendentes: `CI no SHA atual` (`UNVERIFIED`, requer
commit/push/PR), `Hostinger hPanel` (`BLOCKED`, requer acesso externo) e
`Neon/migration/cutover` (`BLOCKED`, requer credenciais e autorização).
