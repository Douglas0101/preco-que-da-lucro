# V2 — Dry-run de cutover em branch de drill (2026-09-07, CUTOVER-READY)

Fase V2 da rodada CUTOVER-READY (D0). Objetivo: exercitar o caminho de
migração em cópia de produção (gate §42 "migrations em cópia de produção"),
reconciliação de dados (§13.4/§13.5) e schema diff (§42 "schema diff
revisado"), sem tocar em produção além de SELECT.

## 1. Branch de drill

- Comando: `neon branches create --project-id damp-forest-57346541 --name
dryrun-2026-09-07 --parent br-snowy-violet-aymcvvvv --expires-at
2026-09-08T23:59:59Z` (CLI Neon 3.6.0; expiração +~24h como rede de
  segurança, §12.5 efêmera).
- Branch: `dryrun-2026-09-07` → id **`br-weathered-darkness-ayssv0qf`**
- Parent: `br-snowy-violet-aymcvvvv` (production)
- Endpoint (DIRECT): **`ep-frosty-mode-ayaemvhy`**, host
  `ep-frosty-mode-ayaemvhy.<region>.aws.neon.tech` (mascarado), tipo
  `read_write`
- Compute confirmado via GET (`neon api /projects/<id>/endpoints`, só
  leitura): estado `active`, `disabled: false`
- Banco na branch: `neondb` (owner `neondb_owner`) — igual à produção
- Expira em: 2026-09-08T23:59:59Z. **NÃO deletada nesta rodada** — V3/V4
  usam; a deleção com prova de cleanup é do V4 (§12.5 always())
- Criada em: 2026-09-06T23:12Z

## 2. Migrations na cópia (caminho sancionado da emenda #2)

Comando executado (URLs jamais impressas; as três envs de conexão do
processo apontavam para o DIRECT da branch de drill — o `.env` não carregou
production porque env de processo tem precedência sobre
`--env-file-if-exists`):

```
ALLOW_REMOTE_DB="V2 CUTOVER-READY dry-run em branch efêmera" \
NEON_MIGRATION_TARGET_KIND=drill-branch \
DATABASE_URL=<branch-direct> DATABASE_URL_UNPOOLED=<branch-direct> \
DATABASE_ADMIN_URL=<branch-direct> npm run db:migrate
```

Pre-flight do guard (evidência, host mascarado):

```json
{
  "guard": "env-guard",
  "result": "ALLOW",
  "path": "drill-branch",
  "script": "db:migrate",
  "env": "DATABASE_URL",
  "host": "ep-frosty-mode-ayaemvhy.<region>.aws.neon.tech",
  "motivo": "V2 CUTOVER-READY dry-run em branch efêmera",
  "norma": "docs/specs/M-02/emenda-2026-09-07-env-guard.md"
}
```

Saída do `db:migrate`: exit 0 — `Migrations PostgreSQL aplicadas com
sucesso.` (no-op: a cópia já contém o journal completo). Único ruído: warning
do pg sobre aliasing dos modos SSL (`prefer`/`require` → `verify-full` até a
próxima major), sem efeito nesta operação.

Verificação posterior (read-only, `start transaction read only`, apenas
SELECT):

- Branch de drill: `select count(*), min(created_at), max(created_at) from
drizzle.__drizzle_migrations` → **count = 11**, min = 1786510674427
  (2026-08-12T04:57:54Z), max = 1788320100000 (2026-09-02T03:35:00Z)
- Produção (SELECT): count = **11** — journal 11/11 confirmado nos dois lados

## 3. Reconciliação production × dryrun (§13.4/§13.5)

Script novo: `scripts/m02-reconcile.mjs` (reutilizável no V4 e no T+).
Execução (ambas DIRECT, script estritamente SELECT com transações
`read only`):

```
node scripts/m02-reconcile.mjs \
  --source-env DATABASE_ADMIN_URL --target-env DATABASE_RESTORE_URL \
  --out docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.md
```

- source = production DIRECT, target = branch DIRECT (valores das envs,
  nunca argv, nunca impressos)
- Resultado: **26 tabelas comparadas · differences_total = 0 · pass = true**
  (exit 0). Produção está fixture-free (todas as tabelas vazias) e a cópia é
  idêntica — esperado confirmado.
- Artefatos: `reconciliation-dryrun-2026-09-07.md` +
  `reconciliation-dryrun-2026-09-07.json` (companheiro).

Nota: invocação direta via `node` (não há npm script nesta fase e
`package.json` não pode ser editado nesta rodada). O guard não está no
caminho de invocação direta — gap documentado em
`env-guard-drill.md` ("invocação direta/npx bypassa hooks npm"). Compensação:
o script é somente leitura por construção (transações `read only` +
rollback), não aceita URL em argv e exigiria env nomeada explícita.

## 4. Schema diff (§42) — ver completo em `schema-diff-2026-09-07.md`

- `pg_dump --schema-only` (cliente 17.11 do container local, DIRECT nas duas
  pontas): diff vazio após normalizar o nonce `\restrict`/`\unrestrict`
  (aleatório por execução do pg_dump); SHA-256 idênticos nos dois lados.
- Checklist §13.3 por SQL read-only: extensions 2/2, enums 0/0, constraints
  108/108, indexes 77/77, functions 0/0, RLS tabelas 21/21, policies 25/25,
  roles 9/9 — **todos EQUAL**. Veredito: **PASS, sem divergências**.

## 5. Carga legacy (Supabase)

**DESCONHECIDO — exige dono humano.**

- `.env` NÃO contém `SUPABASE_MIGRATION_DATABASE_URL` (verificado nesta
  rodada; presentes apenas `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_URL` e variantes `VITE_*`).
- Por regra da rodada, NÃO houve tentativa de acesso ao Supabase via API ou
  publishable key.
- Desbloqueio exigido (humano, via G1): fornecer URL read-only do legacy
  para inventário/reconciliação, OU decisão formal no G1 de que a carga
  legacy não migra (baseline = Neon atual).
- **Paridade de dados com o legacy permanece DESCONHECIDA até credenciais
  read-only ou decisão do G1.** A reconciliação desta rodada cobre apenas
  produção Neon × cópia (ambas vazias).

## 6. Falhas e incidentes da rodada

- 23:37–23:41Z: três falhas seguidas da checklist SQL com erros genéricos
  (SASL/SSL). Diagnóstico: a passagem de URLs por env via command
  substitution multi-linha do shell chega vazia ao processo de forma
  intermitente no ambiente de execução — problema do ferramental, não do
  banco (pg_dump das 23:33 com o mesmo destino teve sucesso). Não caracteriza
  2 falhas do próprio passo: resolvido com padrão mais robusto (URLs lidas
  em-processo), checklist concluída 8/8 EQUAL. Registrado como nota
  operacional no `schema-diff-2026-09-07.md`.
- Nenhum allow sancionado foi negado; nenhum override falhou. Guard rodou
  uma única vez (predb:migrate) e permitiu com log `path:"drill-branch"`.
- Produção recebeu apenas SELECT (journal count, checklist SQL, pg_dump
  schema-only). Nenhuma escrita em produção.

## 7. Arquivos desta rodada

- `scripts/m02-reconcile.mjs` (NOVO, reutilizável)
- `docs/evidence/cutover-2026-09-07/dryrun-notes.md` (este arquivo)
- `docs/evidence/cutover-2026-09-07/reconciliation-dryrun-2026-09-07.md` + `.json`
- `docs/evidence/cutover-2026-09-07/schema-diff-2026-09-07.md`

Sem commits nesta rodada. Branch de drill permanece para V3/V4 (expira
2026-09-08T23:59:59Z como rede de segurança).
