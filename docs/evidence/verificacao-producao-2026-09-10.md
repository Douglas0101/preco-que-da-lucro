# Verificação operacional da publicação — 2026-09-10

Verificação pós-publicação de `main` varrendo Vercel, GitHub CI, Hostinger e Neon.
Sessão interrompida por limite de uso e retomada; os painéis de GitHub, Hostinger e
Neon da primeira metade foram perdidos no restart do navegador — os achados deles
constam abaixo como registrados na sessão. Os valores de segredos nunca foram
revelados; apenas nomes, tipos e escopos.

## Estado atual comprovado

- Deployment de produção `3GArcic1HKEfaiMyUZrhFiFWbmwq`: fonte `main` @ `c2c84f6`
  (merge do PR #42), criado 2026-09-10 02:59:06 UTC (33 s), status Ready,
  environment Production marcado como Current.
- Domínios atribuídos: `preco-que-da-lucro-sage.vercel.app` (+1 não expandido),
  `preco-que-da-lucro-git-main-douglasultimatesouza-5127s-projects.vercel.app`,
  `preco-que-da-lucro-bw8xgxqee.vercel.app`.
- Resources do deployment: 1 função `/__server` (Node.js 24.x, região IAD1,
  1.07 MB, duração máxima ≤ 300 s) e 48 assets estáticos.
- Probes de 2026-09-10T04:23Z contra `https://preco-que-da-lucro-sage.vercel.app`:
  | Endpoint                    | Resultado                                                                       |
  | --------------------------- | ------------------------------------------------------------------------------- |
  | `GET /`                     | 200 (verificado na primeira metade da sessão)                                   |
  | `GET /api/health/live`      | 200 `{"status":"ok"}` (1,5 s)                                                   |
  | `GET /api/health/ready`     | 503 `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}` (0,76 s) |
  | `GET /api/auth/get-session` | 500 (página de erro genérica da Vercel)                                         |
- Runtime logs (03:54–04:01 UTC, todas após o deploy das 02:59):
  `request.failed` `INTERNAL_ERROR` em `/api/auth/get-session` e
  `/api/auth/sign-in/social` com `{"message":"DATABASE_URL não configurada"}`.
  O painel de Observability registrava ~33,3% de erros nas invocações (janela de 6 h).

## Diagnóstico — cadeia causal do bloqueio principal

1. `src/db/client.server.ts` (`createDatabase()`): lê `process.env.DATABASE_URL`
   na primeira chamada de `getDatabase()` e lança exatamente a mensagem dos logs
   quando ela é falsy. É leitura genuína em runtime — `vite.config.ts` não usa
   `define`/inlining para env; o preset Nitro é `vercel` quando `VERCEL=1`.
2. O dashboard lista `DATABASE_URL` como Secret com escopo **Production and
   Preview**, adicionada ~2 dias antes do deploy atual.
3. O deployment é posterior à variável e mesmo assim o runtime não a enxerga.
   Conclusão: **o deployment de produção não recebeu valor utilizável**, apesar do
   segredo existir no escopo correto. Hipóteses residuais, não distinguíveis de
   fora do dashboard: (a) valor do Secret vazio/em branco; (b) falha na aplicação
   do env ao deployment. Ambas têm o mesmo caminho de correção: re-salvar o
   segredo com valor válido e disparar novo deploy de produção.

Critério de verificação pós-correção: `GET /api/health/ready` → 200;
`GET /api/auth/get-session` sem 500; taxa de erro do Observability caindo de
~33% para ~0%; ausência de `DATABASE_URL não configurada` nos runtime logs.

## Inventário de variáveis do projeto (nomes, tipos e escopos)

| Nome                            | Tipo   | Escopo                   | Adicionada |
| ------------------------------- | ------ | ------------------------ | ---------- |
| NEON_AUTH_BASE_URL              | Config | Preview (branch develop) | 44 min     |
| VITE_NEON_AUTH_URL              | Config | Preview (branch develop) | 44 min     |
| NEON_AUTH_BASE_URL              | Config | Production               | 59 min     |
| VITE_NEON_AUTH_URL              | Config | Production               | 59 min     |
| DATABASE_URL                    | Config | Preview (branch develop) | 2 d        |
| DATABASE_URL_UNPOOLED           | Config | Preview (branch develop) | 2 d        |
| DATABASE_URL                    | Config | Development              | 2 d        |
| DATABASE_URL_UNPOOLED           | Config | Development              | 2 d        |
| DATABASE_URL_UNPOOLED           | Config | Production               | 2 d        |
| DATABASE_URL                    | Secret | Production and Preview   | 2 d        |
| DATABASE_ADMIN_URL              | Secret | Production and Preview   | 2 d        |
| DATABASE_DRIVER                 | Secret | Production and Preview   | 2 d        |
| SUPABASE_MIGRATION_DATABASE_URL | Secret | Production and Preview   | 2 d        |
| MIGRATION_APPLY                 | Secret | Production and Preview   | 2 d        |
| MIGRATION_ALLOW_UPSERT          | Secret | Production and Preview   | 2 d        |
| MIGRATION_REPORT_PATH           | Secret | Production and Preview   | 2 d        |
| BETTER_AUTH_URL                 | Secret | Production and Preview   | 2 d        |
| BETTER_AUTH_SECRET              | Secret | Production and Preview   | 2 d        |
| AUTH_TRUSTED_ORIGINS            | Secret | Production and Preview   | 2 d        |

Observações de contrato:

- Segredos administrativos e de migração (`DATABASE_ADMIN_URL`,
  `SUPABASE_MIGRATION_DATABASE_URL`, `MIGRATION_*`) estão expostos ao runtime web
  (Production and Preview) — viola menor privilégio; devem sair do escopo da
  função web. É o equivalente production do que `scripts/env-guard.mjs` bloqueia
  localmente.
- `NEON_AUTH_BASE_URL`/`VITE_NEON_AUTH_URL` foram adicionadas hoje diretamente no
  dashboard (mudança out-of-repo; este arquivo registra o estado observado).
- `SUPABASE_MIGRATION_DATABASE_URL` tem nome legado num projeto que roda em Neon;
  conferir se algum pipeline ainda a consome antes de remover.

## Achados fora da Vercel (registrados na primeira metade da sessão)

- **Neon**: os 11 hashes de migração conferem com os arquivos locais; endpoints
  direto e pooled aceitam TLS válido; retention de histórico/restore limitada a
  **6 horas**.
- **RLS**: cinco tabelas de autenticação com RLS habilitado **sem políticas**,
  enquanto `app_runtime` tem permissões SQL. Isso pode bloquear o login mesmo
  depois de corrigida a conexão da Vercel.
- **Esquema × contrato**: o schema atual difere do contrato de autenticação do
  código; journal de migrações correto não garante que configurações posteriores
  permaneceram corretas.
- **Autenticação duplicada**: duas implementações coexistem sem integração —
  better-auth nas rotas/assets `/api/auth/*` (contrato do código) e as variáveis
  `NEON_AUTH_*` adicionadas hoje no dashboard.
- **Hostinger**: `diretrizprecifica.com` serve outro site com login próprio; não
  aponta para a aplicação TanStack publicada na Vercel.
- **Local**: checks acusaram ledger e matriz M-02 desatualizados (`m02:sums`).

## Ordem de correção sugerida

1. **DATABASE_URL em produção (humano, dashboard Vercel)**: re-salvar o Secret
   Production and Preview com a connection string pooled do Neon
   (`sslmode=require`), disparar novo deploy de `main` e verificar
   `/api/health/ready` → 200. Sem isso, login e toda rota de banco falham.
2. **Escopo dos segredos admin/migração**: remover `DATABASE_ADMIN_URL`,
   `SUPABASE_MIGRATION_DATABASE_URL` e `MIGRATION_*` do escopo Production and
   Preview da função web.
3. **RLS (engenharia)**: políticas nas cinco tabelas de auth ou desabilitar RLS
   onde o acesso é pela camada de serviço; validar com `db:check`/`db:test`
   contra o container local.
4. **Unificar autenticação (ADR)**: decidir better-auth × Neon Auth, registrar em
   ADR e limpar variáveis órfãs.
5. **Domínio (humano)**: decidir o destino de `diretrizprecifica.com`; apontar
   para a Vercel somente após os itens 1–3 verdes.
6. **Retenção Neon**: avaliar aumento dos 6 h (custo × RPO desejado).
7. **Local**: repactuar ledger/matriz M-02 com `m02:sums` e resolver as
   modificações pendentes em `package.json`/`package-lock.json`.
8. **Commit de evidências**: `docs(evidence):` com este arquivo.
