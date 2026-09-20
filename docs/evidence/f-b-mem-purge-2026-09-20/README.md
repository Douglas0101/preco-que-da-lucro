# WP4 `F-B-mem-purge` — a trilha de memória na cadeia de purga

**Work package:** `F-B-mem-purge` (Bloco 3, quarto na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:89`
**Base:** `47d39a936f12961a2ff9922de5e1a319f49c8ea0` (develop pós-WP3)
**Branch:** `mission/wp4-mem-purge`

---

## 1. Sumário

A migration 0019 deu à trilha de auditoria de memória uma FK composta
`ai_memory_access_log(tenant_id, user_id) → tenant_memberships(tenant_id, user_id) ON DELETE RESTRICT`
— `RESTRICT` **de propósito**: apagar a membership não pode apagar a prova de que houve acesso.
Cinco caminhos de purga de fixture apagavam `tenant_memberships`/`tenants`/`users` **sem apagar a
trilha antes**, então qualquer linha de memória derrubava o E2E, o probe de EXPLAIN e as suítes de
banco com **23503** — alto, nunca silencioso, mas quebrando a cadeia.

O WP põe a trilha na cadeia de purga, com a **ordem FK-safe** (`access_log` → `conflicts` →
`versions` → `sources` → `memories`) vinda de uma **fonte única** (`MEMORY_TRAIL_TABLES` em
`scripts/db/purge-fixtures.ts`), em vez de listas inline duplicadas. Nada de runtime, schema ou
grant muda; nada de `try/catch` compensatório — a falha continua alta.

## 2. O que muda

| #   | arquivo                               | mudança                                                                                          |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `scripts/db/purge-fixtures.ts`        | exporta `MEMORY_TRAIL_TABLES` (as 5, ordem FK-safe); `TENANT_SCOPED_TABLES` passa a derivar dela |
| 2   | `scripts/e2e/seed-auth.ts`            | usa a lista canônica em vez da inline (que esquecia a memória, o outbox e o backfill)            |
| 3   | `scripts/db/explain-evidence.ts`      | loop da trilha por `tenant_id` nos **dois** pontos (seed `:67` e cleanup `:215`)                 |
| 4   | `scripts/db/test-backfill.ts`         | loop da trilha por `tenant_id in ($1,$2)` antes do delete de `tenants` no teardown               |
| 5   | `scripts/db/test-auth-integration.ts` | loop por tenant dos users de teste (join por e-mail/legacy) antes do delete de `users`           |
| 6   | `scripts/db/test-ai-budget.ts`        | loop da trilha por `tenant_id = any($1)` antes do delete de `tenants` no finally                 |

## 3. Evidência

Container efêmero `wp4-pg` em `127.0.0.1:5439`, PostgreSQL **17.11**, migrations aplicadas uma vez.
O probe (`zz-wp4-probe.sh`) usa duas técnicas declaradas — pré-semeio por id fixo (`seed-auth`,
`explain`) e um **trigger de probe** em `tenant_memberships` que grava a linha de access log para
os ids aleatórios (`backfill`, `auth-integration`, `ai-budget`) — e roda os **mesmos** 5 caminhos
contra o mesmo estado nas duas fases.

### 3.1 RED — bytes do pai (`47d39a9`), 5/5 falham alto com 23503

| caminho            | execução                                      | resultado       | violação                                                       |
| ------------------ | --------------------------------------------- | --------------- | -------------------------------------------------------------- |
| `seed-auth`        | `npm run e2e:prepare`                         | `EXIT=1`, 23503 | `ai_memory_access_log_..._tenant_memberships_tenan` (RESTRICT) |
| `explain`          | `npx tsx scripts/db/explain-evidence.ts`      | `EXIT=1`, 23503 | idem                                                           |
| `backfill`         | suite completa + `--phase=teardown`           | `EXIT=1`, 23503 | idem                                                           |
| `auth-integration` | `npx tsx scripts/db/test-auth-integration.ts` | `EXIT=1`, 23503 | idem                                                           |
| `ai-budget`        | `npx tsx scripts/db/test-ai-budget.ts`        | `EXIT=1`, 23503 | idem                                                           |

O nome truncado em 63 bytes (`..._tenan`) é o esperado com `NAMEDATALEN=64`; o erro nomeia a
constraint e a tabela, e o exit code prova que nada foi engolido.

### 3.2 GREEN — bytes novos, 5/5 concluem exit 0

| caminho            | resultado                         |
| ------------------ | --------------------------------- |
| `seed-auth`        | `EXIT=0` · 0 ocorrências de 23503 |
| `explain`          | `EXIT=0` · 0 ocorrências de 23503 |
| `backfill`         | `EXIT=0` · 0 ocorrências de 23503 |
| `auth-integration` | `EXIT=0` · 0 ocorrências de 23503 |
| `ai-budget`        | `EXIT=0` · 0 ocorrências de 23503 |

O `explain` roda a história completa (seed de 2000 produtos, os 3 planos) e o cleanup; o artefato
`docs/evidence/explain-critical-queries-<dia>.md` que ele gera **como efeito colateral do probe foi
removido** antes do commit — é saída de outra ferramenta, medida contra o banco de probe, e não
pertence a este selo.

### 3.3 O que a prova cobre, e o que não cobre

- Cobre a condição real: as duas fases partem do **mesmo** banco com a trilha completa (access log,
  memória, fonte, versão e conflito), não de listas em memória.
- O trigger de probe é scaffold (vive só no container, aparece no `wp4-trigger.log`, não entra em
  commit) e **não substitui a migração**: ele reproduz o estado que a migration 0019 permite.
- Não cobre o `scripts/db/purge-fixtures.ts` além da exportação: ele já estava na ordem correta e o
  comportamento da sequência de deletes é o mesmo.
- A revisão de cada fase fica fixada no transcript (`wp4-probe-red.log` / `wp4-probe-green.log`):
  `HEAD`, sha256 dos 6 arquivos e — no RED — a asserção de **diff vazio** contra o pai. Os bytes
  examinados não são inferidos pelo relógio do diretório (correção do S6 N5).
- O GREEN **recusa rodar** sem a precondição do RED (container presente, trigger `probe_trail`
  instalado e ≥ 1 linha de trilha) e exige `exit 0` **e** zero ocorrências de 23503 por caminho
  (correções do S6 N2/N3). Os exits de migrations/trigger/pre-semeio são assertados (N4).

### 3.4 Estático

`npm run typecheck` exit 0 e `npm run lint` exit 0 sobre os bytes finais. `npm run check` e
`npm run db:test` (17 suítes) rodam no fecho do selo; as capturas entram no MANIFEST.

## 4. Riscos e limites declarados

| item                                                                                                                          | situação                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| o trigger de probe cria trilha que o produto não criaria sozinho                                                              | declarado: é a condição que o WP precisa suportar; os ids reais não são pré-semeáveis e o mecanismo é auditável                                                                                                                                                                                                                                       |
| uma migration futura pode acrescentar outro `RESTRICT` sem purga                                                              | a falha é 23503 persistido (nunca sucesso vazio); a cadeia `db:test` da CI é o guard                                                                                                                                                                                                                                                                  |
| `explain-evidence.ts` gera um `.md` a cada execução                                                                           | declarado; o artefato do probe foi removido e a remoção está registrada aqui                                                                                                                                                                                                                                                                          |
| **N1 (declarado, do S6):** há caminhos de purga **fora dos 5** que ainda apagam memberships/tenants/users sem a trilha        | latentes, sem caso vivo: nenhum deles é alcançado pelo único escritor de `ai_memory_access_log` (`memory.repository.ts`). Candidatos: `test-sql-injection.ts:204`, `test-ai-usage-unknown.ts:238`, `test-reconcile-ai-usage.ts:396`, `rls-probe.mjs:621`, `e2e/sales-dashboard.spec.ts:82` (purgeTenant). O WP fica no escopo da fila (`QUEUE.md:89`) |
| **N7 (declarado, do S6):** o GREEN limpa apenas os próprios tenants; fixtures do RED (ids aleatórios) sobrevivem no container | não afeta as execuções seguintes (cada caminho varre o próprio escopo) e o container é descartado no fecho; `GREEN 5/5` prova o cleanup dos 5 caminhos, não "banco limpo"                                                                                                                                                                             |
| `.artifacts/` fora do `ignores` do ESLint 9 flat config                                                                       | segue declarado (WP1/WP2/WP3); as capturas do selo usam `.txt`                                                                                                                                                                                                                                                                                        |

## 5. Arquivos tocados

Os 6 da §2 (sha256 na captura `hashes.txt`) + este selo. Nenhum arquivo de `src/**`, `drizzle/**`,
`docs/specs/**` ou manifest.

## 6. Como reproduzir

```bash
# sobe container, aplica migrations, trigger e pre-semeio; roda o PAI e espera 23503 nos 5
bash .artifacts/zz-wp4-probe.sh red

# com os bytes novos e o mesmo estado, espera exit 0 nos 5
bash .artifacts/zz-wp4-probe.sh green
```

## 7. S6 ADVERSARIAL

**Revisão auditada (R_a):** os 6 arquivos com os sha256 da captura `hashes.txt`; instrumento
`zz-wp4-probe.sh` (`540a0924…`); logs RED/GREEN desta rodada. **Método:** auditoria read-only por
**subagente de contexto limpo** (substituição declarada da lane `.pi/delegate`, indisponível como
ferramenta nesta retomada); veredicto selado verbatim em `captures/adversarial-wp4-verdict.md.txt`.

**Veredicto:** **8 CONFIRMED · 0 CORRECTED · 0 REJECTED · 0 UNVERIFIABLE**. O fato-fonte (FK
`RESTRICT` da 0019 + os 5 pais sem a trilha) está provado byte a byte; a ordem de
`MEMORY_TRAIL_TABLES` cobre todas as arestas `RESTRICT`; os 5 sítios estão na posição e no escopo
certos; o RED é dos **bytes do pai** (forense por stack trace — cada frame aponta para uma linha que
só existe no pai) e o GREEN é não vacuoso.

**Defeitos novos e tratamento:**

| achado                                                                                                | tratamento                                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **N2** — o veredicto GREEN decidia só por `exit==0`                                                   | passou a exigir também `23503 == 0` por caminho                                           |
| **N3** — GREEN sem precondição de estado (poderia passar vazio)                                       | precondição fail-closed: container presente, trigger `probe_trail` e ≥ 1 linha de trilha  |
| **N4** — exits do scaffold ecoados; stdout do probe não selado                                        | exits assertados e **transcript por fase** (`wp4-probe-<fase>.log`) via `tee`             |
| **N5** — o instrumento não fixava a revisão dos bytes                                                 | fingerprint de `HEAD` + sha256 dos 6 arquivos no transcript; o RED **asserta diff vazio** |
| **N6** — divergências README/SPEC (4 planos × 3; linha do explain; backfill sob pré-semeio; capturas) | corrigidas neste README e na ERRATA do SPEC                                               |
| **N1** — caminhos de purga residuais fora dos 5                                                       | **declarado** na §4 (latentes, sem caso vivo)                                             |
| **N7** — sobreviventes do RED no container após o GREEN                                               | **declarado** na §4; o container é descartado no fecho (E2)                               |

**Revisão final (R_b):** os instrumentos mudaram depois do veredicto; RED e GREEN foram
re-executados do zero com o instrumento final — `zz-wp4-probe.sh` `b975557d…` (hashes.txt) — com o
fix stashed no RED e restaurado no GREEN, e os transcripts selados (`probe-red.log.txt` /
`probe-green.log.txt`). As correções **não tocam nenhuma asserção de produto**: são do probe e da
prosa.
