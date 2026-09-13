# V2 — Schema diff produção × branch de drill (2026-09-07, CUTOVER-READY)

Gate §42 ("schema diff revisado"). Comparação `pg_dump --schema-only` entre a
branch **production** (`br-snowy-violet-aymcvvvv`) e a branch de drill
**dryrun-2026-09-07** (`br-weathered-darkness-ayssv0qf`, cópia criada nesta
rodada), ambas via endpoint DIRECT, executada com o cliente `pg_dump
(PostgreSQL) 17.11` do container local `preco-que-da-lucro-postgres`
(`pg_dump` ausente no host). Nunca imprimir valores de URL/segredo.

- executado_em: 2026-09-06T23:33Z (dump) · 2026-09-06T23:45Z (checklist SQL)
- dumps: 2280 linhas por lado (`--schema-only --no-owner --no-privileges`)

## Resultado do diff bruto

```
DIFF_EXIT=1 (562 bytes) — única diferença:
-\restrict 1HMQupRmGZuUcsUw2tqfXA3KjGuQVaLTENeCB5c7TmDbWJdZL9OyNGswTIUrh8q
+\restrict FtJDwztbS2t6FFagsOVn8ki4OvDzFcbveM03Rl78zoeLyVSuqBPFQ7Fou9lOEQe
-\unrestrict 1HMQupRmGZuUcsUw2tqfXA3KjGuQVaLTENeCB5c7TmDbWJdZL9OyNGswTIUrh8q
+\unrestrict FtJDwztbS2t6FFagsOVn8ki4OvDzFcbveM03Rl78zoeLyVSuqBPFQ7Fou9lOEQe
```

Os tokens `\restrict`/`\unrestrict` são nonces aleatórios anti-injeção
gerados por execução do pg_dump 17.11 — não fazem parte do schema. Com esses
tokens normalizados:

```
NORM_DIFF_EXIT=0 (diff vazio)
sha256(prod-schema.norm.sql)  = 03e5f536c0466fc46ebc3f7ba90e92599c7cce020b6d8decf98fd882252c4b90
sha256(branch-schema.norm.sql) = 03e5f536c0466fc46ebc3f7ba90e92599c7cce020b6d8decf98fd882252c4b90
```

Diff de schema: **VAZIO** (cópia idêntica byte a byte), conforme esperado.

## Checklist §13.3 — veredito item a item

Verificação complementar por SQL read-only (`start transaction read only`,
apenas SELECT) nas duas pontas, comparando as linhas retornadas
(`m02-schema-check`, sessão de diagnóstico em /tmp, sem segredos em argv/env):

| Item §13.3      | Produção | Branch drill | Comparação | Veredito |
| --------------- | -------: | -----------: | ---------- | -------- |
| extensions      |        2 |            2 | EQUAL      | OK       |
| enums           |        0 |            0 | EQUAL      | OK       |
| constraints     |      108 |          108 | EQUAL      | OK       |
| indexes         |       77 |           77 | EQUAL      | OK       |
| functions       |        0 |            0 | EQUAL      | OK       |
| RLS (tabelas)   |       21 |           21 | EQUAL      | OK       |
| RLS (policies)  |       25 |           25 | EQUAL      | OK       |
| roles (cluster) |        9 |            9 | EQUAL      | OK       |

Detalhes:

- extensions: `pg_session_jwt 0.5.0`, `plpgsql 1.0` (iguais nos dois lados).
- enums: nenhum `CREATE TYPE ... AS ENUM` no schema público (0 valores de
  enum em `pg_enum` nos dois lados).
- functions: nenhuma função em `public` (`pg_proc` × `pg_namespace public` =
  0 nos dois lados).
- RLS: 21 tabelas `public` com row security habilitada nos dois lados
  (políticas idênticas, 25 policies em `pg_policies`); 0 tabelas com
  `FORCE ROW LEVEL SECURITY` em ambos.
- roles: `anonymous`, `app_runtime`, `authenticated`, `authenticator`,
  `cloud_admin`, `neon_auth`, `neon_service`, `neon_superuser`,
  `neondb_owner` — mesma lista e mesmos atributos (`rolsuper`, `rolcreatedb`,
  `rolcreaterole`, `rolcanlogin`, `rolinherit`) nos dois lados.

## Veredito final

**PASS** — schema da branch de drill é idêntico ao de produção (diff vazio
após normalização do nonce do pg_dump; checklist §13.3 8/8 itens EQUAL).
Nenhuma divergência encontrada — não há motivo para PARAR.

## Nota operacional para V3/V4/T+

Nas primeiras tentativas da checklist SQL (23:37–23:41Z) a passagem das URLs
de conexão por variáveis de ambiente via command substitution multi-linha do
shell falhou de forma intermitente no ambiente de execução (a env chegava
vazia ao processo, produzindo erros de conexão/SASL genéricos). Não foi
problema do banco nem do schema. Padrão adotado (e recomendado ao V4/T+):
ler as URLs em-processo (`.env` parseado pelo próprio script; `neon
connection-string` capturado via `spawnSync` com filtro `postgresql://`),
nunca por encadeamento de env no bash.
