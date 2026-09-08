# 08 — Fase A: diagnóstico 42P01 (2026-09-08)

## Veredito

- **H-QUOT (nome deformado pela sonda/shell): DESCARTADO como causa do 42P01.**
  A sonda é parametrizada (`$1/$2/$3`, savepoints fixos,
  `scripts/rls-probe.mjs:307-312,365-385,392-533`); o quoting do shell explica
  apenas a ignorância (o diagnóstico pós-falha não executou).
- **H-GUC (role-GUCs não viajam no `pg_dump`): PLAUSÍVEL, NÃO PROVADO.**
  `pg_dump -Fc --no-owner --no-privileges` nunca captura globals
  (`pg_db_role_setting`); `backup-verify.ts:67-77` e `grant-repair.ts:113-338`
  comparam grants de tabela + 8 attrs de role, sem `rolconfig`/`setconfig`,
  sem `USAGE ON SCHEMA` / `EXECUTE ON FUNCTION` / `ALTER ... SET`.
  As funções RLS têm `search_path` fixo, então H-GUC só morde se a produção
  depender de GUC para os nomes não-qualificados da sonda.
- **Causa: DESCONHECIDA com dono (engenharia).** O abort `exit 2` só sai do
  `catch` externo de `probeSession` (`rls-probe.mjs:806-811`); os únicos
  caminhos abort-capable são `products` (`a/a2`), `users+tenant_memberships`
  (`d`) e `users` direto (`obs`). Sem re-drill às cegas.

## A3 — hardening fail-loud (FEITO)

- Novo `scripts/rls-probe-errors.mjs` + `.d.mts`: erro completo visível
  (code, severity, message, detail, hint, table/schema/constraint/routine),
  com URLs, emails, hosts Neon e `password=` redigidos; relação preservada.
- Testes `src/test/rls-probe-errors.test.ts` (4 casos) + contrato existente:
  6/6 PASS. A supressão total anterior é proibida.

## A1/A2 — SQL pronto, execução BLOQUEADA (sem credenciais DB no env)

Regra de quoting: arquivo `-f` ou driver com `$1`; nunca `psql -c '...'` com
quote interno; URLs só por NOME de env em-processo; tudo
`REPEATABLE READ READ ONLY` + `ROLLBACK`; só `SELECT`.

```sql
-- A1: existência/visibilidade como app_runtime (sem SET ROLE)
SELECT n.nspname, c.relname, c.relkind,
       has_table_privilege('app_runtime', n.nspname || '.' || c.relname, 'SELECT') AS can_select
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE (n.nspname, c.relname) IN (('public','products'), ('public','users'),
        ('public','tenant_memberships'), ('public','profiles'));
SELECT n.nspname, p.proname,
       has_function_privilege('app_runtime', p.oid, 'EXECUTE') AS can_exec
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'app_private'
   AND p.proname IN ('current_user_id','current_tenant_id','has_tenant_access','has_tenant_owner_access');
SELECT has_schema_privilege('app_runtime','public','USAGE'),
       has_schema_privilege('app_runtime','app_private','USAGE');

-- A2: role-GUCs produção × restaurada (diff decide H-GUC)
SELECT d.datname AS db, r.rolname AS role, s.setconfig
  FROM pg_db_role_setting s
  LEFT JOIN pg_database d ON d.oid = s.setdatabase
  LEFT JOIN pg_roles r ON r.oid = s.setrole
 ORDER BY 1, 2;
SELECT rolname, rolconfig FROM pg_roles
 WHERE rolname IN ('app_runtime','authenticated','neondb_owner') ORDER BY 1;
```

Bloqueio: env local sem `DATABASE_*` (checagem só-NOMES); A2 exige branch
efêmera nova (criação = escrita no painel → autorização explícita do operador

- `expires-at` + delete com prova). B segue bloqueado até A confirmada.
