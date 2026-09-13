# SQL injection adversarial (§32) — 2026-09-13

**Item:** §32 (SQLi) do Plano Mestre, parte 2 — banco/CI.
**Branch/base:** `ops/onda0-sqli`, worktree `.worktree-onda0-sqli`, base `f765406`.
**Harness novo:** `scripts/db/test-sql-injection.ts` (padrão `test-tool-security.ts`: admin +
`set local role app_runtime` + `set_config`, cleanup em `finally`).
**Caminhos exercitados:** tool `create_product` (`name`) via `runRegisteredTool` e
`DrizzleProductRepository.save`, ambos sob `app_runtime`.
**Ambiente:** PostgreSQL 17 local (`docker-compose.yml`, `postgres:17-alpine`);
`DATABASE_URL`/`DATABASE_ADMIN_URL` explícitos em `127.0.0.1:5432` (nomes de env; nenhum
valor secreto neste documento). n = 6 payloads × 2 caminhos = 12 gravações + 6 controles
positivos.

## Método

1. **Controle positivo (obrigatório):** para cada payload, uma transação dedicada cria
   `temp table sqli_canary(value text)` com uma linha canário e concatena a MESMA string em
   SQL (concatenação vulnerável deliberada). A transação é sempre revertida (`rollback` no
   sucesso e no erro) e `to_regclass('public.products')` é reafirmado após cada rollback.
2. **Caminho real:** cada payload é enviado como dado ao tool e ao repositório em transações
   `app_runtime` que **commitam**.
3. **Asserções:** retorno do tool/repositório idêntico ao payload; linha relida do banco byte
   a byte (`encode(convert_to(name, 'UTF8'), 'hex')` = hex do payload);
   `to_regclass('public.products') is not null` ao final; zero linhas `name = 'pwned'` no
   tenant; duração dos caminhos reais para `1; SELECT pg_sleep(2); --` < 1 s.

Comando: `npx tsx scripts/db/test-sql-injection.ts` → **exit 0**.

## Tabela payload → resultado → controle positivo

| #   | Payload                                                  | Controle positivo (concatenação)                                                 | Potência       | `create_product` | `save`      | Duração (tool / save) |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------- | ---------------- | ----------- | --------------------- |
| 1   | `' OR '1'='1`                                            | tautologia selecionou 1 linha do canário; com `$1`, 0                            | sim            | byte a byte      | byte a byte | 23 ms / 2 ms          |
| 2   | `x'); DROP TABLE products; --`                           | abortou: `cannot drop table products because other objects depend on it`         | sim            | byte a byte      | byte a byte | 12 ms / 3 ms          |
| 3   | `1; SELECT pg_sleep(2); --`                              | `pg_sleep(2)` concatenado bloqueou por 2005 ms                                   | sim            | byte a byte      | byte a byte | 10 ms / 2 ms          |
| 4   | `'); UPDATE products SET name='pwned' WHERE '1'='1'; --` | alterou 4 linhas de `products` para `pwned` (revertido)                          | sim            | byte a byte      | byte a byte | 10 ms / 2 ms          |
| 5   | `{"$ne":null}`                                           | literal inerte em SQL; canário permaneceu intacto                                | não (esperado) | byte a byte      | byte a byte | 12 ms / 3 ms          |
| 6   | `%'); COPY (SELECT '') TO PROGRAM 'true'; --`            | executou `INSERT` + `COPY … TO PROGRAM 'true'` sem erro (papel admin, revertido) | sim            | byte a byte      | byte a byte | 9 ms / 2 ms           |

Todos os 6 payloads foram armazenados uma vez por caminho (12 linhas), cada uma byte a byte
igual ao payload e **sem nenhuma mutação colateral**.

## Invariantes finais

- `to_regclass('public.products')` = `products` (tabela intacta após todos os controles).
- `products` do tenant de teste: 0 linhas (cleanup do `finally`); fixtures do teste: 0.
- Linhas `name = 'pwned'`: **0**.
- `name like '%pwned%'`: exatamente as 2 linhas do payload 4 (o próprio payload contém a
  substring `pwned`), ambas idênticas byte a byte ao payload.
- Verificação externa pós-execução:
  `products_table = products`, `tenant_rows = 0`, `fixture_users = 0`, `pwned_exact = 0`.

## Limites e riscos

- O controle do payload 2 aborta por dependências de FK (o `DROP TABLE` é reconhecido e
  executado; o PostgreSQL recusa). O rollback restaura a tabela — reafirmado após o controle.
- `{"$ne":null}` é um operador NoSQL, inerte em SQL por construção (`potent: false`
  esperado); ele valida que o parâmetro não vira estrutura de consulta.
- O `COPY … TO PROGRAM` do controle roda como admin; `app_runtime` é
  `NOSUPERUSER … NOBYPASSRLS` sem `pg_write_server_files` (migration 0001), então privilégio
  de role é uma segunda camada mesmo sob concatenação hipotética.
- Escopo: Postgres 17 local. A suíte entra na cadeia `db:test` via manifest request
  (`tsx scripts/db/test-sql-injection.ts` após `test-tool-security.ts`).

## Decisão

Manter (keep): as duas camadas reais (`create_product` e `save`) resistem aos 6 payloads com
linha gravada byte a byte e zero mutação; o controle positivo prova que os payloads são
potentes quando a concatenação é vulnerável.
