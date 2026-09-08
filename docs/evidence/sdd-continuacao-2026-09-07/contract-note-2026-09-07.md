# C-01 — Contract-note: gate × drill do snapshot (2026-09-07, SDD-CONTINUAÇÃO)

> Tarefa SOMENTE-LEITURA + este arquivo novo de evidência. Nenhum arquivo
> existente foi editado; sem commit/staging; sem rede/banco/Neon. Somente
> NOMES de envs e hostnames mascarados (`ep-<mascarado>[-pooler]`).
> Branch lida: `develop`. Método: leitura direta dos arquivos citados, com
> `arquivo:linha` para cada afirmação.

## 1. `scripts/db/backup-verify.ts` — contrato CLI completo

**Flags (todas obrigatórias, `parseArgs` strict — `backup-verify.ts:130-144`):**

| Flag | Contrato |
| --- | --- |
| `--snapshot-id` | string, obrigatória (só carregada no JSON de saída; não é revalidada contra o servidor) |
| `--source-branch` | string, obrigatória (branch id esperado da origem) |
| `--restore-branch` | string, obrigatória (branch id esperado do restore) |

Ausência de qualquer uma, ou `source-branch === restore-branch`, → throw
`"Explicit distinct branch IDs and snapshot ID required"` → saída `ERROR`, exit 2.

**Envs exigidas (nomes apenas — `backup-verify.ts:145-146`):**
`DATABASE_ADMIN_URL` (origem) e `DATABASE_RESTORE_URL` (restore isolada).
Ausência de qualquer uma → throw `"Missing database connections"` → `ERROR`, exit 2.

**Predicado de hosts distintos (`backup-verify.ts:147-151`):**
`hostname(DATABASE_ADMIN_URL) === hostname(DATABASE_RESTORE_URL)` →
throw `"Restore must use an isolated branch endpoint"` → `ERROR`, exit 2.
Comparação por igualdade exata de hostname (sem normalização de case; sem
lista de hosts).

**Rejeição de `-pooler` (`backup-verify.ts:21-38`, `directPool()`):**
lança `"A direct PostgreSQL URL is required"` se protocolo ∉
(`postgres:`, `postgresql:`) **ou** `hostname.includes("-pooler")`.
Aplicada às **duas** conexões (`backup-verify.ts:153-154`). TLS: host local
(`127.0.0.1`/`localhost`/`::1`) sem SSL; demais hosts com
`rejectUnauthorized: true`; pool `max: 1`.

**Identidade de alvo no servidor (`backup-verify.ts:161-166`):**
lê `neon.project_id / branch_id / endpoint_id` dos dois lados; exige
`source.branch == --source-branch`, `restored.branch == --restore-branch` e
mesmo `project_id` — senão `"Server target identity mismatch"` → `ERROR`, exit 2.

**Comparação (`backup-verify.ts:94-127`):** major Postgres dos dois lados deve
começar com `"17"` (`postgres-major`); tabelas `public`+`drizzle` por
`{count, checksum}` (sha256 por linha ordenada); `journal`/`catalog`/`roles`
por igualdade JSON; journal local reconciliado hash-a-hash contra
`drizzle/meta/_journal.json` + `drizzle/<tag>.sql` (inclui `journal-count`).

**Formato da saída JSON (`backup-verify.ts:169-185`):**
`{check: "m02:backup-verify", read_only: true, started_at, finished_at,
snapshot_id, source_branch, restore_branch, result: "PASS"|"FAIL",
comparison: {pass, tables_compared, failures[]},
journal: {pass, expected, actual, failures[]},
source: <inventário completo>, restored: <inventário completo>, limits: <texto>}`.
Caminho de erro (`backup-verify.ts:197-206`):
`{check: "m02:backup-verify", result: "ERROR", error: <mensagem genérica — detalhes de DB omitidos>}`.

**Exit codes:** `0` = PASS · `1` = FAIL (comparação ou journal) ·
`2` = ERROR (args/envs/hosts/identidade/conexão).

**CONFIRMAÇÃO — ele gera `dump.pgc`? NÃO.** Verificação por leitura integral
do arquivo (207 linhas): não há `pg_dump`, `pg_restore`, `CREATE/DROP
DATABASE`, `writeFile` ou qualquer escrita em disco — só `SELECT`s em
transações `REPEATABLE READ READ ONLY` (`backup-verify.ts:41`) + leitura local
de `drizzle/*.sql`, e um único `console.log` do JSON. O próprio campo `limits`
declara: `"No resources are created or deleted."` O `dump.pgc` do drill
histórico de 09-05 foi produzido por passos **externos** ao script (dump via
container + restore em banco efêmero), embora documentos históricos o
atribuam ao script (ver D1 em "DIVERGÊNCIAS").

## 2. `scripts/m02-readiness.mjs` — trecho `snapshot-fresco`

Fonte: `m02-readiness.mjs:142-172`.

- **Path exato / varredura:** raiz `backupDrillRoot =
  <repo>/.artifacts/backup-drill` (`m02-readiness.mjs:9`); para cada entrada do
  diretório, resolve `<entry>/dump.pgc` e **ignora** a entrada se o arquivo não
  existir (`m02-readiness.mjs:145-150`); elege o `newest` por `mtimeMs`.
- **Idades:** sem nenhum dump → `DESCONHECIDO` (`m02-readiness.mjs:152-161`:
  `"nenhum dump externo encontrado; snapshot nativo (snap-tiny-smoke-ayc382ji)
  vale até 2026-10-10, mas <24h não comprovado"`); `ageH < 24` → `PASS`
  (`"dump externo com Xh"`); caso contrário → `FAIL`
  (`"dump externo stale: Xh (exige snapshot novo no dia do cutover)"`).
- **Rótulo de fonte** nos três ramos: `.artifacts/backup-drill/*/dump.pgc`.
- Agregação (`m02-readiness.mjs:212-231`): qualquer `DESCONHECIDO` →
  `INCOMPLETE` (exit 2); senão qualquer `FAIL` → `FAIL` (exit 1); todos PASS →
  `PASS` (exit 0). GO/NO-GO é decisão documentada, não saída do script.

## 3. Predicado DIRECT canônico usado no repo

O predicado praticado é **substring `-pooler` no hostname** (não lista de hosts):

| Local | Forma exata |
| --- | --- |
| `scripts/db/backup-verify.ts:25` | `parsed.hostname.includes("-pooler")` → throw (sem `toLowerCase`) |
| `scripts/m02-snapshot.mjs:11,132-142` | `host.includes("-pooler")` (com `toLowerCase` na linha 131) → DENY pré-conexão, exit 3, `"dump exige DIRECT"` |
| `src/test/m02-snapshot.test.ts:43-51` | teste sela: host `-pooler` → exit 3 com `DIRECT`, sem vazar credencial |
| `docs/specs/M-02/emenda-2026-09-07-env-guard.md:154-156` (Emenda #4) | norma: "sempre via DIRECT (o script recusa host `-pooler`)", `pg_dump` 17.x do container local |
| `.github/workflows/neon-readiness.yml:199-204` | CI: `DATABASE_ADMIN_URL` (DIRECT) em host Neon **não** pode conter `-pooler`; `DATABASE_URL` (pooled) **deve** conter |
| `scripts/env-guard.mjs:46-48` | predicado **distinto** e de outro escopo: prefixo do endpoint id de produção cobre direct **e** `-pooler` para hard-deny de `db:migrate` (não é o predicado DIRECT de dump) |

Minúcia registrada para DP5: `backup-verify.ts` não normaliza case antes do
`includes`, `m02-snapshot.mjs` normaliza. DP5 deve selar: substring vs sufixo
estrito, case-sensitivity — e confirmar que NÃO há lista de hosts (nenhum
arquivo lido usa allowlist/denylist de hosts para DIRECT).

## 4. Formato / idade esperada dos dumps (`docs/runbooks/cutover-A4.md` §2.3)

- **§2.3(a) dump externo + drill:** comando `m02:backup-verify` com as duas
  envs DIRECT + 3 flags; **"Dump externo salvo como
  `.artifacts/backup-drill/<data>/dump.pgc` + sha256 registrado (o check
  `snapshot-fresco` do gate exige dump < 24 h)"**; esperado JSON
  `result: PASS`, `comparison.pass` + `journal.pass`, origem × restore isolada
  (hostnames distintos), `read_only: true`; evidência = JSON do drill + sha256
  em `docs/evidence/cutover-2026-09-07/`.
- **§2.3(b) snapshot nativo:** registrar **ID + validade** do snapshot do dia
  (referência anterior válida até **2026-10-10** — renovar se expirada).
- **Mecanismo do dump** (fora do §2.3, mas exigido pelo rollback §7 passo 7 e
  praticado no V4 `restore-drill-2026-09-07.md` §2/§4 + Emenda #4):
  `pg_dump -Fc --no-owner --no-privileges`, cliente 17.x do container local,
  via DIRECT; restore com `pg_restore --no-owner --no-privileges`; PITR 6h é
  camada adicional (BAK-01 aberta), não controle primário.
- **`<data>` não tem formato normatizado no runbook** — é literalmente
  `<data>`.

## 5. Insumos pendentes de DP5 (decidir ANTES de C-02 — trava em `02-decisoes-dp1-dp6.md:33-38`)

1. **Formato de `<data>`:** 3 variantes em uso — runbook `<data>` indefinido;
   drill 09-05 usou `<ts>` = `YYYYMMDDHHMMSS` (ex.: `20260905202420`);
   `m02-snapshot.mjs:159-161` escreve `snapshot-<YYYY-MM-DD>[-seq].dump`;
   V4 escreveu `/tmp/restore-drill-2026-09-07/dump-prod.pgc` (fora do repo).
2. **Idade máxima:** o gate aplica `< 24h`, e o runbook exige "snapshot novo no
   dia do cutover" — mas é regra de código, não decisão selada. Selar o valor
   canônico (24h ou outro).
3. **Quantidade:** `2026-09-05-bak-01-backup-restore-policy.md:37-40` exige
   mínimo de **2 gerações** fora do git; o gate avalia **só o newest**. Selar
   retenção/quantidade mínima verificável.
4. **Glob oficial:** o gate lê `.artifacts/backup-drill/*/dump.pgc`; o produtor
   sancionado (Emenda #4) escreve `artifacts/snapshots/snapshot-<data>.dump`;
   o V4 escreveu em `/tmp`; o `backup-verify` não escreve nada. Selar (a) quem
   escreve no glob do gate e com que nome — ou (b) a mudança do glob.
   Restrição vigente: sem improvisar mudança no glob no dia
   (`cutover-prep-2026-09-07/report.md:81-88` — o baseline `m02:snapshot`
   **não** alimenta o gate "por design").
5. **Predicado DIRECT canônico:** selar substring `-pooler` (e case-sensitivity)
   como norma, cf. item 3.

## DIVERGÊNCIAS GATE×DRILL — veredito: DIVERGENTE (decisão DP5 exigida ANTES de C-02)

- **D1 — `backup-verify` ≠ produtor de `dump.pgc`.** `2026-09-05-bak-01-backup-restore-policy.md:24-29`
  afirma que o script "produz `pg_dump` custom em
  `.artifacts/backup-drill/<ts>/dump.pgc`", e `backup-restore-drill.md:5`
  lista o script como produtor do drill com fase `pg-dump` — **falso para o
  código atual** (item 1: o script não gera dump). O passo §2.3(a) do runbook e
  o passo (iii-a) de `01-op-c-01-reescrito.md:20` acoplam num único comando
  (`m02:backup-verify`) a expectativa de artefato (`.artifacts/backup-drill/<data>/dump.pgc`+sha256
  <24h) que esse comando **não produz**.
- **D2 — glob do gate ≠ saída default do produtor sancionado ≠ artefato real
  do drill.** Gate: `.artifacts/backup-drill/*/dump.pgc` · `m02-snapshot`
  (default): `artifacts/snapshots/snapshot-<data>.dump` (+ `.sha256` +
  `.metadata.json`, cf. Emenda #4) · V4 real: `/tmp/.../dump-prod.pgc` ·
  `m02-cutover-t0.mjs:24` fixa `SNAPSHOTS_DIR = "artifacts/snapshots"`.
  **Nenhum script sancionado escreve no glob do gate por default.**
- **D3 (menor) — formato `<data>` não normatizado** (3 variantes, item 5.1).
- **Pedido DP5:** decidir os 5 insumos do item 5 — em especial quem materializa
  `.artifacts/backup-drill/<data>/dump.pgc`+sha256<24h no T-0 (opção: fiar o
  `m02:snapshot` com `--out-dir` + renomeação normatizada, ou ato manual
  sancionado documentado) — **ANTES de C-02**. Sem essa decisão, o check
  `snapshot-fresco` do gate do dia só pode dar `DESCONHECIDO`/`FAIL` por
  construção, não por estado real do backup.
