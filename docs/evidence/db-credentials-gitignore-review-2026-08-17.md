# Revisão técnica — credenciais geradas de banco e conformidade do `.gitignore` — 2026-08-17

## Escopo

Revisão da organização da conexão de banco por credenciais geradas localmente
(`npx neon@latest init`) e da cobertura do `.gitignore`, em conformidade com o
[PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md](../PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md)
(§2.4, §12.1, §12.2), ADR-019 e ADR-023. Nenhum segredo foi lido, copiado,
alterado ou registrado neste arquivo.

## Modelo de camadas de conexão (plano ↔ repositório)

O plano nomeia `DATABASE_URL_POOLED` / `DATABASE_URL_DIRECT` (§2.4, §12.2). O
repositório implementa o mesmo modelo em duas camadas com nomes consolidados:

| Camada | Plano (§12.2) | Variável no repositório | Consumidor |
| --- | --- | --- | --- |
| Runtime da aplicação (request/background curto) | `DATABASE_URL_POOLED` | `DATABASE_URL` (endpoint pooled, PgBouncer `transaction`) | `src/db/client.server.ts:33`, driver via `DATABASE_DRIVER` (`neon-serverless` em produção) |
| Migrations / admin / dump / restore | `DATABASE_URL_DIRECT` | `DATABASE_ADMIN_URL` (endpoint direct) | `drizzle.config.ts:3`, `scripts/db/migrate.ts:7`, `scripts/migration/source-to-neon.ts:566` |
| Migração legada (processo único, read-only) | — | `SUPABASE_MIGRATION_DATABASE_URL` | transação forçada read-only, ver `.env.example:14-19` |
| PostgreSQL local Docker (PG17, espelha CI) | — | `DATABASE_URL`/`DATABASE_ADMIN_URL` → `127.0.0.1:5432`, `DATABASE_DRIVER=node-postgres` | `npm run db:up` / `npm run db:test` (ver `AGENTS.md`) |

Controles já existentes que complementam as camadas:

- Nenhuma URL de banco é exposta via variável `VITE_*` (ADR-019).
- `src/lib/structured-logger.ts:6-9` redige URLs `postgres(ql)://`, tokens
  bearer e e-mails antes de logar.
- `.env.example` documenta o modelo com placeholders, sem segredo real.

## Inventário dos artefatos gerados na raiz do checkout principal

O `npx neon@latest init` gerou credenciais locais na raiz de
`/home/douglas-souza/preco-que-d-main`:

| Arquivo | Tipo | Coberto pelo `.gitignore` anterior? | Situação após este patch |
| --- | --- | --- | --- |
| `.env` (raiz) | dotenv local | sim (linha `.env`) | ignorado |
| `neon-storage.env` | dotenv gerado com credenciais Neon | **não** — gap: padrões `.env`/`.env.*` exigem prefixo `.env` | ignorado via `*.env` |
| `.neon` | JSON de estado local do CLI/agente | **não** | ignorado via `.neon` |

Verificação de vazamento no repositório (checkout principal, 2026-08-17):

- `git ls-files`: nenhum arquivo `.env*`/`.neon` rastreado, exceto o template
  `.env.example`.
- `git log --all --oneline -- neon-storage.env .neon`: vazio — os artefatos
  nunca foram commitados em nenhum branch.

## Mudança aplicada

Commit `c4eb356` (`chore(security): ignore generated neon credential
artifacts`) neste branch, somente no `.gitignore`:

```diff
 # Local environment
 .env
 .env.*
+*.env
 !.env.example
 !.env.*.example
+!*.env.example
 .dev.vars*
+
+# Local CLI/agent state (may hold project-scoped credentials metadata)
+.neon
```

Verificação pós-patch (`git check-ignore -v --stdin`):

- ignorados: `neon-storage.env` (`*.env`), `.neon` (`.neon`), `.env`,
  `backup.env`, `.env.local` (`*.local`);
- **não** ignorados (templates preservados): `.env.example`,
  `neon-storage.env.example` (negação `!*.env.example`);
- nenhum arquivo já rastreado passa a ser ignorado.

## Camadas hierárquicas de proteção resultantes

1. **Repositório:** `.gitignore` cobre dotenv em qualquer nome (`*.env`),
   material de chave (`*.pem`/`*.key`/`*.p12`/…), dumps (`*.dump`) e estado
   local de CLI (`.neon`); somente templates `*.example` são comitáveis.
2. **Templates:** `.env.example` com placeholders, sem credencial real.
3. **CI/GitHub:** segredos somente como Secrets/Variables de environment
   protegido (pendente: `NEON_API_KEY`, `NEON_PROJECT_ID` — ver
   `neon-readiness-2026-08-17.md`).
4. **Runtime:** nenhuma credencial em bundle cliente (`VITE_*`); redação de
   URLs no logger estruturado.
5. **Banco (Neon):** papéis separados — role de runtime não-owner sobre pooled
   e owner somente via direct administrativa; runtime role não-owner e sem
   `BYPASSRLS` (§11, RLS).

## Riscos residuais e pendências

- O checkout principal segue sujo e preservado (G0): `neon-storage.env` e
  `.neon` continuam **não ignorados lá** até este branch ser mergeado ou as
  mesmas linhas serem aplicadas localmente. Evitar `git add -A`/`.`
  naquele checkout enquanto isso.
- Projeto Neon encontrado (`fragrant-fog-45101956`, `aws-us-east-2`) está em
  PostgreSQL 18; o gate exige major 17 (ADR-023, §12.1: não atualizar major
  apenas por novidade). Nenhuma alteração, recriação ou migração desse projeto
  foi feita — decisão de destino compatível permanece pendente.
- MCP Neon sem `neon.api_key` registrado: consultas de leitura via MCP
  (confirmar `project_id`, branches, estado da branch principal, branch
  descartável, versão PG, separação direct/pooled, dry-run) continuam
  pendentes.
- Workflow `neon-readiness.yml` ainda não disponível no default branch.
- Recomendação já registrada: rotacionar/revogar qualquer senha embutida em
  URL compartilhada em conversa antes de qualquer conexão.

## Limite de evidência

Não houve: leitura ou cópia de segredo; conexão com Neon; criação de branch
Neon; migration, drift, backup, restore ou reconciliação; alteração de
produção ou cutover; alteração do checkout principal; push para o GitHub a
partir deste patch (sincronização do remoto GitHub permanece etapa separada).
