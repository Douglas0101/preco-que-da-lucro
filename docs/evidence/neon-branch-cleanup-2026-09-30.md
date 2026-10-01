# Limpeza da branch Neon `c18-migration-rehearsal` — 2026-09-30

**Slice:** `neon-branch-cleanup` (Ciclo 19)
**Veredicto:** a branch é a branch descartável do ensaio do Ciclo 18, **não** é a branch que serve produção, e **não há divergência de schema** em relação a `production`. **A exclusão NÃO foi executada** — depende de confirmação do usuário (ver §7).

---

## 1. Hipótese

`c18-migration-rehearsal` é a branch efêmera criada a partir de `production` para ensaiar o blob das 8 migrations (`0012`–`0019`) antes de aplicá-lo em produção, e continua no projeto custando ~33 MB porque a ferramenta de exclusão de branch é declaradamente não-autônoma. Se a hipótese se confirmar e a branch não divergir de `production`, ela é removível.

## 2. O que foi medido (e com o quê)

Todas as leituras foram feitas pela API Neon via MCP, em 2026-09-30, em modo **read-only**:

| Leitura                | Ferramenta                                                    | Finalidade                                          |
| ---------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Projetos da org        | `xd://mcp__neon_list_projects`                                | Identificar o projeto dono do app implantado        |
| Branches do projeto    | `xd://mcp__neon_list_branches` (`include_deleted: true`)      | Localizar `c18-migration-rehearsal` e suas irmãs    |
| Detalhe da branch      | `xd://mcp__neon_get_branch`                                   | id, pai, tamanho, datas, contadores                 |
| Árvore de objetos      | `xd://mcp__neon_describe_branch` (rehearsal **e** production) | Comparar o conjunto de objetos aplicado             |
| Bancos da branch       | `xd://mcp__neon_list_postgres_databases`                      | Databases existentes na branch                      |
| Operações do projeto   | `xd://mcp__neon_list_operations`                              | Efeitos colaterais observáveis das leituras         |
| Configuração de CI     | `.github/workflows/neon-*.yml` (leitura)                      | Sanções de projeto e caminho sancionado de exclusão |
| Registro do ensaio     | `docs/evidence/agent-state/PROGRESS.md` L256/L257             | O que o ensaio já registrou                         |
| Disponibilidade de CLI | `which neonctl`; `npx --no-install neonctl`                   | Existência de caminho CLI                           |

### Identificação do projeto (sem palpite)

- `.github/workflows/neon-pr-branch.yml:69,95,108` traz `'damp-forest-57346541'` como valor padrão explícito de `vars.NEON_PROJECT_ID`.
- `PROGRESS.md` L257 nomeia `production` como `br-snowy-violet-aymcvvvv`; o projeto que contém essa branch é o único listado por `list_projects`.
- Coincidem: **projeto `damp-forest-57346541`**.

## 3. ANTES — listagem de branches (excerto)

Saída de `xd://mcp__neon_list_branches` para `damp-forest-57346541`, recortada nos campos decisivos:

```
name                          id                          parent_id                   primary default logical_size  created_at
production                    br-snowy-violet-aymcvvvv    (raiz)                      true    true    34250752     2026-08-17T14:58:47Z
c18-migration-rehearsal       br-little-thunder-ay1oz7c4 br-snowy-violet-aymcvvvv  false   false   34299904     2026-09-30T11:49:19Z
develop                      br-small-hill-aymcu14y     br-snowy-violet-aymcvvvv  false   false   31596544     2026-08-23T04:42:49Z
preview-hpanel-2026-09-12    br-blue-silence-ayj9erkh    br-snowy-violet-aymcvvvv  false   false   33677312     2026-09-12T04:10:37Z
vercel-dev                   br-raspy-wildflower-ay41jd97 br-snowy-violet-aymcvvvv false   false   33595392     2026-09-08T05:37:58Z  (state=archived)
preview/feature/contract-guard-bff
                             br-red-bonus-ayx82svs       br-snowy-violet-aymcvvvv  false   false   33685504     2026-09-26T20:33:14Z
preview/dependabot/... (3 branches vercel)
                             br-sweet-night-ayv525d2 / br-jolly-credit-aydbmhf6 /
                             br-fragrant-feather-aybbagq7 / br-withered-rice-aym8xrba
                                                        br-snowy-violet-aymcvvvv  false   false   34299904     2026-09-30T21:50Z
```

A branch procurada **existe** e é a única com esse nome no projeto (a listagem foi feita com `include_deleted: true`, portanto não há uma versão deletada homônima escondida).

### Detalhe da branch alvo (`get_branch`)

```
id                 br-little-thunder-ay1oz7c4
name               c18-migration-rehearsal
project_id         damp-forest-57346541
parent_id          br-snowy-violet-aymcvvvv        (= production)
parent_lsn         0/31A1930   parent_timestamp 2026-09-30T11:48:51Z
init_source        parent-data
current_state      ready
primary            false       default  false      protected  false
logical_size       34299904 bytes  (= 32,71 MiB / 34,3 MB)
creation_source    console      created_by Douglas
created_at         2026-09-30T11:49:19Z
updated_at         2026-09-30T18:05:21Z
state_changed_at   2026-09-30T11:49:20Z
cpu_used_sec       0        compute_time_seconds 0     active_time_seconds 0
written_data_bytes 0        data_transfer_bytes   0
```

Database na branch: `neondb` (id `2474739`, owner `neondb_owner`), criado em `2026-08-17T14:58:47Z` (payload herdado de `production` via `init_source: parent-data`).

Console: <https://console.neon.tech/app/projects/damp-forest-57346541/branches/br-little-thunder-ay1oz7c4>

## 4. Confirmação de que NÃO é a branch que serve produção

Cinco sinais, todos medidos, convergentes:

1. **`primary: false` / `default: false`** — a branch que a Neon resolve por default, e a branch primária do projeto, é `production` (`br-snowy-violet-aymcvvvv`, `primary: true`, `default: true`, raiz sem pai).
2. **Filha, não raiz** — `parent_id = br-snowy-violet-aymcvvvv`; `production` é a raiz (`describe_branch` reporta `Parent Branch: undefined` para ela, `br-snowy-violet-aymcvvvv` para a de ensaio). Um restore PITR só atinge branches raiz, então a produção não pode ser confundida com esta.
3. **Os sinais de uso estão na outra branch** — `production` tem `compute_time_seconds: 7406` e `data_transfer_bytes: 19620403`; a branch de ensaio tem `0` e `0` em ambos (valores como retornados pela API na leitura; a **semântica** desses contadores não foi verificada — ver §8).
4. **Nenhuma referência no repositório** — busca repo-wide por `c18-migration-rehearsal` e por `br-little-thunder-ay1oz7c4` retorna **apenas** `docs/evidence/agent-state/PROGRESS.md` L256/L257 (narrativa do ensaio) e as capturas deste artefato. Nenhum workflow, script, `.env`, config de deploy ou hPanel aponta para essa branch.
5. **A própria narrativa do ensaio** — `PROGRESS.md` L257: _"branch descartável `c18-migration-rehearsal` criada de `production`"_, e no fim _"Limpeza pendente: a branch `c18-migration-rehearsal` **não foi apagada** … Custo: ~33 MB de storage."_ É exatamente a dívida que este slice fecha.

## 5. Comparação do conjunto de migrations (rehearsal × production)

O conjunto de objetos foi extraído das duas árvores de `describe_branch` e comparado por `difflib.unified_diff`:

| Métrica                                                       | `c18-migration-rehearsal` | `production` | Diferença    |
| ------------------------------------------------------------- | ------------------------- | ------------ | ------------ |
| Objetos na árvore (schemas/tabelas/índices/funções/sequences) | 194                       | 194          | **0**        |
| Tabelas (todos os schemas)                                    | 47                        | 47           | **0**        |
| Tabelas em `public`                                           | 37                        | 37           | **0**        |
| `drizzle.__drizzle_migrations` presente                       | sim                       | sim          | —            |
| Índice `ai_memories_tenant_dedup_key_active_uidx` (dedup_key) | presente                  | presente     | —            |
| Linhas de `difflib.unified_diff`                              | —                         | —            | **0 linhas** |

Capturas brutas em [`captures/`](./captures/): `describe-branch-rehearsal.txt` e `describe-branch-production.txt`.

**Resultado: nenhuma divergência.** A árvore de objetos da branch de ensaio é idêntica à de `production`, o que confirma que ela carrega o mesmo conjunto aplicado — inclusive as tabelas das 8 migrations do Ciclo 18 (`purchase_price_history`, `ai_memory_*`, `backfill_*`, `tool_executions`, entre outras).

### Cruzamento com o que o ensaio já registrou

`PROGRESS.md` L257 mediu, no momento da aplicação:

- **Ensaio:** blob de 106 statements (8 migrations + 8 INSERTs de bookkeeping) → `migrations_rows=20`, `public_tables=37`, `ai_memories=1`, `dedup_key` presente.
- **Produção:** o mesmo blob → `APPLIED statements=106 migrations_rows=20 public_tables=37 ai_memories=1`.
- **Verificação independente da produção (segundo caminho):** migrations 20, tabelas públicas 37, `ai_memories` 1, `dedup_key` 2.

O único ponto que **não** foi re-medido agora é a **contagem de linhas** de `drizzle.__drizzle_migrations` na branch de ensaio (ver §8, lacuna L1). A medição de hoje confirma, por um caminho independente, o mesmo número de tabelas públicas (37) que o ensaio gravou para as duas branches — o que acopla a leitura de hoje ao registro do ensaio.

## 6. O que mudou

**Nada foi mutado.** Nenhuma escrita, nenhuma criação, nenhuma exclusão. Todas as chamadas foram `list_*`, `get_*` e `describe_*`.

## 7. Resultado e a ação exata que está pendente

**Veredicto: é seguro deletar** `br-little-thunder-ay1oz7c4` / `c18-migration-rehearsal` — com a reserva de que a exclusão **não foi executada** e depende de confirmação do usuário, conforme a regra de não-autonomia da ferramenta.

> ⚠️ **A exclusão NÃO foi executada por este slice.** A regra do servidor MCP ("NEVER run autonomously; always ask the user first") é respeitada: este artefato entrega o discovery e a linha de comando exata; o agente de integração pede a confirmação e executa.

Ações exatas, em ordem de preferência:

**A) Via MCP (exige confirmação do usuário antes):**

```
xd://mcp__neon_delete_branch
{ "project_id": "damp-forest-57346541", "branch_id": "br-little-thunder-ay1oz7c4" }
```

**B) Via CLI `neonctl`** — **NÃO executada, e `neonctl` não está instalado nesta máquina** (`which neonctl` → nada; `npx --no-install neonctl` → erro). Se for instalado, a linha é:

```
neonctl branches delete --project-id damp-forest-57346541 --name c18-migration-rehearsal
```

**C) Via CI, caminho já sancionado pelo repositório** (mantém a `NEON_API_KEY` apenas em GitHub Secrets — `.github/workflows/neon-drill-ops.yml:3-7`, gate em `:61-97`, passo de delete em `:217-223`):

```
workflow_dispatch em .github/workflows/neon-drill-ops.yml
  operation:     delete-branch
  branch_id:     br-little-thunder-ay1oz7c4
  confirm:       true
ref:            develop | main   (o gate bloqueia qualquer outro)
```

**Pós-condição a verificar depois da execução:** `list_branches` deve devolver 9 branches (hoje: 10), sem `c18-migration-rehearsal`, e `production` deve continuar `primary: true` / `default: true`.

## 8. Limites declarados

- **L1 — contagem de linhas de `__drizzle_migrations` NÃO re-medida.** O conjunto de ferramentas Neon MCP montado nesta sessão não expõe execução de SQL (`psql` também não está instalado; `DATABASE_URL` no `.env` aponta para `127.0.0.1`, um Postgres local, não para a branch). A afirmação "20 linhas de migrations na branch" vem de `PROGRESS.md` L257 (medido no momento da aplicação), não de uma leitura de hoje. **Não é verde por medição própria.** O acoplamento é indireto: a árvore de objetos é idêntica e o total de tabelas públicas (37) bate com o valor gravado para as duas branches.
- **L2 — semântica dos contadores de uso não verificada.** `cpu_used_sec: 0`, `active_time_seconds: 0`, `written_data_bytes: 0`, `data_transfer_bytes: 0` foram lidos como a API os retornou; **a semântica desses campos não foi documentada nem testada** nesta sessão. O sinal §4.3 é usado como corroboração, não como prova isolada de "nunca serviu tráfego".
- **L3 — efeito colateral de leitura, declarado.** A leitura `describe_branch` na branch de ensaio **iniciou o compute dela**: `list_operations` registra `start_compute` para `br-little-thunder-ay1oz7c4`, endpoint `ep-fragrant-shape-ayyeiyan`, operação `5d36a611-e0ad-4ed7-9106-05b53f1c8a2c`, em `2026-09-30T22:43:04Z`. Nenhum dado foi escrito; o custo é de compute e será removido junto com a branch. Os contadores de §3 foram lidos **antes** desse start.
- **L4 — nenhum backup/snapshot nativo da branch foi inspecionado.** A listagem de branches cobre branches, não snapshots; `snapshot-list` do `neon-drill-ops.yml` existe mas não foi acionado. Não há evidência de que esta branch seja alvo de PITR ou de snapshot de restauração.
- **L5 — `history_retention_seconds` do projeto é 21600 s (6 h).** Se o usuário quiser preservar a branch mais um pouco como prova, a janela de recuperação é curta — mas o conteúdo já está integralmente registrado em `PROGRESS.md` L256/L257 e neste artefato.
- **L6 — a exclusão é irreversível.** Não há undo. A confirmação do usuário deve vir antes de qualquer uma das três linhas de §7.

## 9. Índice de capturas

| Arquivo                                                                                | Conteúdo                                                   |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`captures/describe-branch-rehearsal.txt`](./captures/describe-branch-rehearsal.txt)   | `describe_branch` completo de `br-little-thunder-ay1oz7c4` |
| [`captures/describe-branch-production.txt`](./captures/describe-branch-production.txt) | `describe_branch` completo de `br-snowy-violet-aymcvvvv`   |
