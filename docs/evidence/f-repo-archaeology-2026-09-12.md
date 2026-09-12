# F-REPO — Arqueologia do incidente de lockfile + inventário de WIP

- **Rodada:** produção preco-que-da-lucro, 2026-09-12 (coleta concluída ~03:36Z).
- **Repositório:** `/home/douglas-souza/preco-que-d-main` · branch `develop` · `HEAD` = `c080586` (`docs(m02): restore state marker after autofix and note dependency drift`).
- **Escopo:** (1) arqueologia do incidente `drizzle-kit`; (2) proposta (sem wire) de `scripts/m02-lockfile-guard.mjs`; (3) inventário de WIP não rastreado com disposição proposta.
- **Contrato de evidência:** nenhum valor de env/secret foi impresso; somente nomes, versões, hashes e estados.
- **DOC-FIRST:** este agente delegado não dispõe de ferramenta web (allowlist: `read/grep/find/ls/bash/edit/write`). Nenhuma DOC oficial externa foi consultada via web nesta frente; toda afirmação sobre comportamento de sistema externo está ancorada em **artifactos locais** (runtime/logs/dist locais) e marcada como GAP-DOC em §4. Nenhuma URL foi inventada.

---

## Sumário executivo

1. **O incidente NÃO foi um evento único.** Houve **dois** episódios de rebaixamento idêntico do `drizzle-kit` para `^0.18.1`:
   - **Episódio A:** 2026-09-12T**02:38:55Z** (capturado ao vivo pela sessão pai às 02:47:30Z; já restaurado e não visível em disco agora).
   - **Episódio B (estado atual):** 2026-09-12T**02:58:54Z** — 10 min **depois** da restauração registrada (`c080586`, 02:49:18Z) e durante janela em que a sessão pai estava **idle** (02:50:15Z → 03:06:03Z no transcript).
   - O working tree **hoje continua baixado** (`package.json`/`package-lock.json` modificados, `node_modules/drizzle-kit` 0.18.1).
2. **Status declarado: LIMITE DECLARADO (causa não estabelecida) — NÃO RESOLVIDO.** Dono do limite: **Douglas (owner do ambiente/repo)**; dono da mitigação proposta: **programa M-02** (guard §2). Ver §1.9.
3. **Não há log npm** na janela: confirmado. O sumiço é compatível com **purga automática** do npm (`logs-max:10`, rolling) — os logs sobreviventes mais antigos são de 03:05:46Z e registram explicitamente remoção de 1 arquivo. Também não houve escrita no `_cacache` na janela (install veio de cache).
4. **O estado `^0.18.1` é “fantasma”: não existe em nenhum ref git.** Nenhum commit, stash ou worktree carrega `drizzle-kit ^0.18.1`; o único valor já commitado é `^0.31.10` (desde `c04bc54`, 2026-08-12). Logo, algo reaplica um **checkpoint antigo de working tree (≤ 2026-08-27)** + reify npm.
5. **Correlação temporal forte (2/2):** os dois episódios ocorreram 20–50 s após **instalações do bundle de extensões pi em `~/.pi/agent/npm`** (02:38:33Z e 02:58:03–07Z). Mecanismo exato não demonstrado — declarado como limite, com hipóteses ranqueadas e próximos diagnósticos.
6. **Risco imediato:** o round vai publicar muito WIP; um `git add -A` incluiria o downgrade `package.json`+lock. **Restaurar antes de qualquer commit** (§3.1).

---

## 1. Incidente `drizzle-kit` — arqueologia

### 1.1 Estado atual observado (evidência primária)

| Arquivo                                 | mtime (local −03:00)    | mtime (UTC)              | Estado                                                      |
| --------------------------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------- |
| `package.json`                          | 2026-09-11 23:58:54.085 | **2026-09-12T02:58:54Z** | L120 `"drizzle-kit": "^0.18.1"`                             |
| `package-lock.json`                     | 2026-09-11 23:58:54.230 | 2026-09-12T02:58:54Z     | L57 spec `^0.18.1`; L5942 resolved `drizzle-kit-0.18.1.tgz` |
| `node_modules/drizzle-kit/package.json` | 2026-09-11 23:58:53.876 | 2026-09-12T02:58:53Z     | `version = 0.18.1`                                          |
| `node_modules/.package-lock.json`       | 2026-09-11 23:58:54.324 | 2026-09-12T02:58:54Z     | hidden lock npm com `drizzle-kit 0.18.1`                    |
| `node_modules/` (dir)                   | 2026-09-11 23:58:54.082 | 2026-09-12T02:58:54Z     | reify em execução                                           |

- `git diff -- package.json` (working tree × HEAD): **única linha alterada**:
  `-    "drizzle-kit": "^0.31.10",` → `+    "drizzle-kit": "^0.18.1",`
- `git diff --stat -- package-lock.json`: `1 file changed, 1402 insertions(+), 1507 deletions(-)`.
- HEAD (`c080586`) declara `^0.31.10` (L120) e lock resolve `drizzle-kit-0.31.10.tgz` (L6292).
- **Reify real, não cópia de arquivo:** `find node_modules -newermt '2026-09-11 23:58:00' ! -newermt '2026-09-11 23:59:30' -type f | wc -l` = **1617 arquivos**, incluindo a árvore legada do drizzle-kit 0.18.1: `cli-color`, `es5-ext`, `json-diff`, `memoizee`, `event-emitter`, `type`, `glob`. Isso caracteriza uma **instalação npm-family** na janela das 23:58:54 local (02:58:54Z), e não um checkout/restore de arquivos.

### 1.2 Correção da linha do tempo (o mandato aponta 02:38:55Z; o mtime atual é de outro evento)

O traceback da sessão pai mostra que **o working tree foi rebaixado duas vezes**:

| #   | Timestamp UTC | Evidência                                                                                                                                                                                                                                                                 | Desfecho                                                                                                                                                                                                                |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **02:38:55Z** | Sessão pai, transcript JSONL `2026-09-11T04-16-19-306Z_01a08eae-…jsonl`, mensagem toolResult às **02:47:30.421Z**: `package.json 2026-09-11 23:38:55.595 -0300`, `package-lock.json … 23:38:55.705`, `node_modules/drizzle-kit/package.json … 23:38:55.409` (= 02:38:55Z) | Restaurado às **02:48:52Z** por `git checkout -- package.json package-lock.json && npm ci --ignore-scripts` (0.31.10 confirmado às 02:49:42Z); commit `c080586` publicado às 02:49:15Z com nota “causa não determinada” |
| B   | **02:58:54Z** | mtimes atuais em disco (§1.1) + `node_modules/.package-lock.json` reescrito + 1617 arquivos reificados                                                                                                                                                                    | **NÃO restaurado** — é o estado do working tree neste momento                                                                                                                                                           |

- A sessão pai esteve **idle** entre 02:50:15Z e 03:06:03Z (timeline do JSONL: última mensagem do turno às 02:50:15.621Z; próxima entrada às 03:06:03.397Z). **Nenhum tool call da sessão pai tocou o repositório no intervalo** — o escritor do Episódio B é externo à sessão.
- Observação adicional: a sessão pai, às 01:38:10Z, registrava “Notificação tardia do `npm ci` (já validado: drizzle-kit 0.31.10)”. Portanto o tree estava em 0.31.10 pouco antes do Episódio A. O estado-0.18.1 **não é anterior** ao início da sessão; ele é aplicado episodicamente.

### 1.3 Ocorrências no ledger (mandato: `grep -n 'drizzle-kit' EXECUTION-STATE-PROGRAM.md`)

| Linha    | Conteúdo (síntese literal)                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **799**  | Desvios do orquestrador (ondas de perf): “`drizzle.config.ts` — `defineConfig` removido … para compatibilidade drizzle-kit 0.18/0.31; **drift PRÉ-existente** (`package.json` já estava com `^0.18.1` antes das ondas).” |
| **887**  | Gates 2026-09-01: “`drizzle-kit check`: "Everything's fine".” (gate executado enquanto o drift pré-existente estava no tree)                                                                                             |
| **1340** | “`drizzle-kit ^0.18.1` + lock reescrito após o resume da sessão, sem log npm correspondente”                                                                                                                             |
| **1342** | “Causa não determinada; conferir `grep '"drizzle-kit"' package.json` antes de cada gate/commit.”                                                                                                                         |

Bloco da nota operacional (ledger, ~L1339–1342, commitado em `c080586`, mtime 2026-09-11 23:49 local = 02:49:18Z): reconhece a **recorrência** e registra a restauração, **sem declarar causa**.

### 1.4 Recorrência (histórico)

| Janela                 | Evidência                                 | Estado                                                                            |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Antes de 2026-08-29/30 | Ledger L799 (desvio #1 das ondas de perf) | `^0.18.1` no working tree; tolerado via `drizzle.config.ts` dual-compat 0.18/0.31 |
| 2026-09-12T02:38:55Z   | §1.2 (transcript)                         | restaurado às 02:48:52Z                                                           |
| 2026-09-12T02:58:54Z   | §1.1                                      | **ativo**                                                                         |

- **Não há origem em git**: `git log -p -- package.json` (todos os commits que tocaram o arquivo) contém **apenas** a introdução `+ "drizzle-kit": "^0.31.10"` no commit `c04bc54` (2026-08-12 01:52 −03:00). Nenhum `- "drizzle-kit": "^0.18.1"` aparece no histórico.
- **Stashes `stash@{0..2}`** (2026-08-27, 2026-08-23) carregam `^0.31.10` — logo o estado-0.18.1 é **posterior a 2026-08-27T23:27-0300** e nunca foi commitado/stashado ⇒ é reaplicado de fonte fora do git (checkpoint de working tree / cópia externa).
- `git worktree list`: 20+ worktrees (`.codex/worktrees/*`, `pre-a4-work/*`) — nenhum contém a spec 0.18.1 no `package.json` versionado (verificação feita nos refs do repo principal).

### 1.5 Logs npm — o que existe e por que não existe

- `~/.npm/_logs` tem **11 debug logs sobreviventes, todos entre 2026-09-12T03:05:46Z e 03:08:58Z**; nenhum cobre 02:38/02:58. Nenhum dos logs sobreviventes menciona `drizzle`/`package-lock`.
- Mecanismo de poda (evidência local, arquivo `~/.npm/_logs/2026-09-12T03_05_46_989Z-debug-0.log`, linhas 9–12):
  - `silly logfile logs-max:10 dir:/home/douglas-souza/.npm/_logs/2026-09-12T03_05_46_989Z-`
  - `silly logfile start cleaning logs, removing 1 files`
  - `silly logfile done cleaning log files`
    ⇒ o npm poda **automaticamente** ao manter 10 arquivos; os logs de 02:38/02:58 seriam os primeiros a cair dado o burst de 03:05–03:09 (11+ execuções `npm config`/`npm exec ast-grep`). **Não há indício de deleção deliberada.**
- Limite epistemicamente honesto: **a ausência de log não distingue** “npm CLI com log podado” de “instalação programática via arborist/pacote (sem log de CLI)”. Ambos produzem o mesmo rastro (§1.1).
- `~/.npm/_cacache` mtime 2026-09-11 08:06 local — **nenhuma escrita de cache** na janela (tarballs já em cache; replay offline).
- `.npmrc` do repo: `engine-strict=true`, `package-lock=true` (sem overrides/registry alternativo). `packageManager`: `npm@11.14.1`.
- `~/.bash_history` (mtime 2026-09-12 00:05:13 local = 03:05:13Z; 37.894 B): **zero ocorrências de `drizzle`** — não há registro de comando manual `npm ... drizzle` em bash interativo. (Ressalva: histórico de shell não cobre o bash tool do agente nem outros shells.)

### 1.6 Correlações temporais e atores testados

| Timestamp             | Evento observado                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 02:38:33–34Z          | Escrita de arquivos em `~/.pi/agent/npm/node_modules` (bundle de extensões pi; ex.: `@pierre/theming`, `d3-*`)                      |
| 02:38:55Z             | **Episódio A** no repo                                                                                                              |
| 02:40:10Z             | Sessão pi pai: `custom:plannotator` (retomada de UI); usuário às 02:40:33Z (“Leita a tarefa em detalhes”)                           |
| 02:47:09–10Z          | `.codex/ipc/ipc.sock` + bootstrap de skills do Codex tocados (início de processo Codex no host)                                     |
| 02:47:30Z             | Sessão pai captura mtimes de 02:38:55Z                                                                                              |
| 02:48:52Z             | Restauração (`git checkout` + `npm ci`) pela sessão pai                                                                             |
| 02:49:15–18Z          | Push/commit `c080586` com a nota de drift                                                                                           |
| 02:50:15Z → 03:06:03Z | Sessão pai **idle** (sem tool calls)                                                                                                |
| 02:58:03–07Z          | Nova escrita em `~/.pi/agent/npm` (`package.json`+lock+node_modules do bundle) e `~/.pi/agent/settings.json` (mtime 23:58:07 local) |
| 02:58:54Z             | **Episódio B** no repo (estado atual)                                                                                               |
| 03:05:46Z             | Primeiro log npm sobrevivente (poda de 1 arquivo)                                                                                   |

**Descartados com evidência:**

- **Hooks git:** `.git/hooks/` sem nenhum hook ativo (apenas amostras).
- **Lifecycle scripts:** `package.json` não tem `prepare`/`preinstall`/`postinstall`; os `pre*` existentes são env-guards de comandos dev/test/build/db.
- **Lockfiles alternativos:** não existem `bun.lock*`, `pnpm-lock.yaml`, `yarn.lock`.
- **Extensões pi como instaladoras diretas:** nenhum `package.json` do bundle `~/.pi/agent/npm` declara `drizzle-kit`; grep por `drizzle-kit` nos fontes/maps das extensões não retorna nada.
- **pi-lens:** instala ferramentas em `~/.pi-lens/tools/` (não no projeto); fontes sem referência a `drizzle`. _(Porém: pi-lens foi observado, durante este pass, aplicando autofix assíncrono em `docs/evidence/vercel-docmap-2026-09-12.md` **fora de turno** — é um escritor assíncrono comprovado do working tree; ver §1.9-H3.)_
- **Subagentes/sessões paralelas do pi:** `subagent-artifacts/` sem atividade entre 2026-09-11 08:40 local e 2026-09-12 00:07 local; nenhuma outra sessão pi do projeto no intervalo.
- **Worktrees Codex:** existem (20+), mas nenhum item de `package.json` versionado com 0.18.1; o Codex IPC iniciou às 02:47:10Z (entre A e B) — **não explica A**, e não foi demonstrado para B. Fica como lead (D6).

### 1.7 O que o estado-0.18.1 implica

- `drizzle.config.ts` foi **adaptado em ago/2026** para funcionar com 0.18 e 0.31 (ledger L799-801), então o tree baixado pode não quebrar imediatamente; `npm run db:check` / `db:generate` sob 0.18.1 **não foram reexecutados neste pass** (não executado por escopo/efeitos colaterais).
- Lock baixado contém **mismatch de peer**: o bloco ~L5208 declara peer `"drizzle-kit": ">=0.31.4 || >=1.0.0-beta.1"` (peer marcado **optional** no `peerDependenciesMeta`, ~L5241). Com devDependency `^0.18.1`, o peer opcional fica fora da faixa (não é hard-fail de `npm ci`, mas é sinal de inconsistência).
- **CI não é afetado enquanto o drift não for commitado**: CI roda `npm ci --ignore-scripts` a partir do lock do commit (0.31.10). O risco é **local** (gates/commits) e de **publicação acidental** do drift.

### 1.8 Hipóteses ranqueadas (sem causa estabelecida)

- **H1 (melhor suportada por timing, 2/2):** um fluxo de **bootstrap/retomada de sessão pi** dispara em background; as escritas em `~/.pi/agent/npm` (02:38:33Z, 02:58:03–07Z) marcam o start/resume; 20–50 s depois um **reify npm-family** no repo aplica `^0.18.1`. O spec 0.18.1 só é conhecido de um estado de working tree de ≤ 2026-08-27 (não commitado) ⇒ **replay/restore de um checkpoint antigo do worktree**, seguido de instalação para reconciliar `node_modules`. Falta demonstrar o elo “extensão pi → npm install no cwd do projeto”.
- **H2:** um **job/background-task persistido** de sessão anterior (extensão `pi-background-tasks`) contendo um comando de `npm install/ci` com snapshot antigo é reexecutado no resume. Não inspecionado neste pass (D4).
- **H3:** um **escritor assíncrono agent-adjacent** (ex.: pi-lens fixer / guard de checkout compartilhado) restaura/reescreve o par `package.json`+lock a partir de estado capturado anteriormente. pi-lens demonstrou escrita assíncrona fora de turno neste mesmo pass; porém nenhuma referência a `drizzle` foi achada em seus fontes.
- **H4 (baixa):** ação humana em shell sem histórico (`~/.bash_history` sem `drizzle`), ou agente de outro vendor (Codex) com cwd compartilhado. Não demonstrado.

### 1.9 Declaração formal

> **STATUS: LIMITE DECLARADO — causa não estabelecida; NÃO RESOLVIDO.**
> **Limite:** um processo não identificado reaplica o par `package.json`+`package-lock.json` no estado `drizzle-kit ^0.18.1` (mais reify de `node_modules`), de forma **episódica**, inclusive durante janela idle da sessão pai e **10 min após restauração registrada**. A fonte do spec é um estado de working tree ≤ 2026-08-27 que **não existe em nenhum ref git**; o log npm correspondente é irrecuperável (poda rolling `logs-max:10`) e não houve escrita no `_cacache` (replay de cache).
> **Dono:** Douglas (owner do ambiente/repositório) para a investigação de causa raiz; **programa M-02** como dono da mitigação proposta (§2) e do registro no ledger.
> **Critério de saída:** (i) writer identificado com evidência de processo (não correlação); ou (ii) 7 dias sem recorrência com `m02:lockfile-guard` verde em toda retomada de sessão + captura de processo em flagrante (D2/D3).

**Próximos diagnósticos (propostos, nenhum executado):**

- **D1** Monitorar recorrência: `stat -c '%y %n' package.json package-lock.json node_modules/.package-lock.json` + `grep '"drizzle-kit"' package.json` a cada resume; registrar no ledger (append-only).
- **D2** Captura em flagrante: `inotifywait -m -e close_write,moved_to --format '%T %w%f' --timefmt '%FT%T%z' package.json package-lock.json` rodando durante um resume de sessão.
- **D3** Com o disparo, capturar o writer: `lsof +D /home/douglas-souza/preco-que-d-main` e `fuser -v package.json package-lock.json` imediatamente após o evento (e, se disponível root, `bpftrace -e 'tracepoint:syscalls:sys_enter_openat /str(args->filename) =~ /package/ { printf("%s %s\n", comm, str(args->filename)); }'`).
- **D4** Inspecionar estado persistido de `pi-background-tasks` (jobs com `npm install`/`npm ci` e timestamps de re-queue) — caminhos de estado da extensão em `~/.pi` e `/tmp/pi-*`.
- **D5** Ler a documentação local do pi sobre resume de sessão/checkpoints (README e `docs/` em `…/@earendil-works/pi-coding-agent`) para confirmar/refutar restauração de working tree no resume — **GAP-DOC** (§4).
- **D6** Verificar se o processo Codex iniciado às 02:47:10Z (e worktrees `.codex/worktrees/*`) executou npm no worktree compartilhado; checar logs/estado do Codex da janela 02:35–03:00Z.
- **D7** Buscar a fonte do spec fantasma fora do repo: `grep -rn --exclude-dir=node_modules --exclude-dir=.git 'drizzle-kit' ~/.pi ~/.codex ~/.config` (procurar manifests/locks antigos com `0.18.1`).

---

## 2. Proposta — `scripts/m02-lockfile-guard.mjs` (SEM WIRE)

> **Natureza:** proposta. **Nenhum arquivo foi criado, nenhum script npm foi alterado, nada foi conectado a `check`/CI.** O código abaixo não foi executado nesta rodada (sem orçamento de validação); deve ser testado (§2.4) antes do wire.

### 2.1 Contrato

- **Objetivo:** detectar a classe de incidente F-REPO (“ghost downgrade”) **antes** de gate/commit.
- **Checks (todos read-only):**
  1. `package.json` → `devDependencies["drizzle-kit"]` casa `^\^0\.31\.\d+$` (contrato “^0.31.x”).
  2. `package-lock.json` → `packages[""].devDependencies["drizzle-kit"]` idêntico à spec do `package.json` (o lock bleeda a spec; no incidente ambos foram reescritos).
  3. `package-lock.json` → `packages["node_modules/drizzle-kit"]` resolve `0.31.x` e tarball consistente (`/drizzle-kit-<versão>.tgz`).
  4. **sha256 do `package-lock.json`** do working tree, comparado com: (a) `HEAD:package-lock.json` via git (default, pega exatamente “lock reescrito sem commit”); e/ou (b) arquivo pinado `--expected` `{ "lockSha256": "…" }` (opcional; atualizado só em PR de dependência).
  5. `HEAD:package.json` dentro do contrato (impede que o próprio HEAD seja o estado fantasma).
  6. (default-on) `node_modules/drizzle-kit` instalado = 0.31.x quando o diretório existe; **ausente = `skipped`** (CI limpo), **presente e fora = `fail`**.
- **Fail-closed:** qualquer arquivo ausente/ilegível, JSON inválido, git indisponível sem `--expected`, ou erro interno ⇒ `ok:false`, `status:"fail"`, exit code **1** (erro interno também emite JSON). Sem `--no-head` e sem `--expected` ⇒ fail (não há referência de hash).
- **Saída:** sempre JSON em stdout, schema `m02-lockfile-guard/1`.
- **Não muta nada** (não roda install, não corrige). O campo `hint` sugere a correção manual.

### 2.2 Código proposto

```js
#!/usr/bin/env node
/**
 * m02-lockfile-guard.mjs — guarda fail-closed para o incidente de lockfile F-REPO.
 *
 * Contrato:
 *   - devDependencies["drizzle-kit"] no package.json casa ^0.31.x
 *   - package-lock.json espelha a spec e resolve 0.31.x
 *   - sha256(package-lock.json) == sha256(HEAD:package-lock.json)  (ou --expected)
 *   - node_modules/drizzle-kit (se presente) == 0.31.x
 *
 * Saída: JSON (stdout), schema m02-lockfile-guard/1.
 * Exit:  0 = pass · 1 = fail (inclui erro interno; fail-closed).
 *
 * Uso:
 *   node scripts/m02-lockfile-guard.mjs
 *   node scripts/m02-lockfile-guard.mjs --expected scripts/m02-lockfile-guard.expected.json
 *   node scripts/m02-lockfile-guard.mjs --no-head --check-node-modules
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const SPEC_RE = /^\^0\.31\.\d+$/; // contrato do repo: drizzle-kit ^0.31.x
const RESOLVED_RE = /^0\.31\.\d+$/; // resolução instalável: 0.31.x
const PKG = "package.json";
const LOCK = "package-lock.json";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const opts = {
  head: !has("--no-head"),
  expectedFile: valueOf("--expected"),
  checkNodeModules: !has("--no-node-modules"),
};

const checks = [];
const reasons = [];
const observed = {};
const expected = {
  specPattern: "^0.31.x",
  resolvedPattern: "0.31.x",
  lockSha256: null,
  source: null,
};

const check = (id, status, detail) => {
  checks.push({ id, status, detail });
  if (status === "fail") reasons.push(`${id}: ${detail}`);
};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function emit(ok, status, extra = {}) {
  const payload = {
    schema: "m02-lockfile-guard/1",
    ok,
    status, // pass | fail
    generatedAt: new Date().toISOString(),
    repo: process.cwd(),
    observed,
    expected,
    checks,
    reasons,
    hint: "git checkout -- package.json package-lock.json && npm ci --ignore-scripts && npm run m02:lockfile-guard",
    ...extra,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(ok ? 0 : 1);
}

try {
  // 0) root do repo (robusto a cwd em subdiretório)
  try {
    const top = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (top) process.chdir(top);
  } catch {
    /* mantém cwd; o check de arquivo abaixo é fail-closed */
  }

  // 1) leitura fail-closed
  const pkgRaw = readFileSync(PKG, "utf8");
  const lockRaw = readFileSync(LOCK, "utf8");

  // 2) spec no package.json
  const pkg = JSON.parse(pkgRaw);
  const spec = pkg?.devDependencies?.["drizzle-kit"] ?? null;
  observed.spec = spec;
  if (!spec) {
    check("package-json-devdep", "fail", "devDependencies['drizzle-kit'] ausente");
  } else if (!SPEC_RE.test(spec)) {
    check("package-json-devdep", "fail", `spec '${spec}' fora do contrato ^0.31.x`);
  } else {
    check("package-json-devdep", "pass", `spec '${spec}'`);
  }

  // 3) espelho no topo do lock
  const lock = JSON.parse(lockRaw);
  const lockSpec = lock?.packages?.[""]?.devDependencies?.["drizzle-kit"] ?? null;
  observed.lockSpec = lockSpec;
  if (lockSpec !== spec) {
    check("lock-top-spec", "fail", `lock declara '${lockSpec}' != package.json '${spec}'`);
  } else {
    check("lock-top-spec", "pass", `lock declara '${lockSpec}'`);
  }

  // 4) resolução instalável no lock
  const resolved = lock?.packages?.["node_modules/drizzle-kit"] ?? null;
  observed.lockResolvedVersion = resolved?.version ?? null;
  observed.lockResolvedUrl = resolved?.resolved ?? null;
  if (!resolved) {
    check("lock-resolved", "fail", "entrada node_modules/drizzle-kit ausente no lock");
  } else if (!RESOLVED_RE.test(resolved.version ?? "")) {
    check("lock-resolved", "fail", `resolvido '${resolved.version}' fora de 0.31.x`);
  } else if (!String(resolved.resolved ?? "").endsWith(`/drizzle-kit-${resolved.version}.tgz`)) {
    check("lock-resolved", "fail", "URL de tarball inconsistente com a versão resolvida");
  } else {
    check("lock-resolved", "pass", `resolvido ${resolved.version}`);
  }

  // 5) sha256 do lock do working tree
  const lockSha = sha256(lockRaw);
  observed.lockSha256 = lockSha;

  if (opts.expectedFile) {
    const exp = JSON.parse(readFileSync(opts.expectedFile, "utf8"));
    expected.lockSha256 = exp?.lockSha256 ?? null;
    expected.source = `file:${opts.expectedFile}`;
    if (!expected.lockSha256) {
      check("lock-sha256-expected", "fail", `${opts.expectedFile} sem campo lockSha256`);
    } else if (expected.lockSha256 !== lockSha) {
      check("lock-sha256-expected", "fail", `lock ${lockSha} != esperado ${expected.lockSha256}`);
    } else {
      check("lock-sha256-expected", "pass", lockSha);
    }
  }

  if (opts.head) {
    let headLock = null;
    try {
      headLock = execFileSync("git", ["show", `HEAD:${LOCK}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      check("lock-sha256-head", "fail", "não foi possível ler HEAD:package-lock.json");
    }
    if (headLock !== null) {
      const headSha = sha256(Buffer.from(headLock, "utf8"));
      expected.headLockSha256 = headSha;
      if (!expected.source) expected.source = "git:HEAD";
      if (headSha !== lockSha) {
        check(
          "lock-sha256-head",
          "fail",
          `lock do working tree ${lockSha} != HEAD ${headSha} (reescrito sem commit)`,
        );
      } else {
        check("lock-sha256-head", "pass", lockSha);
      }
      try {
        const headPkg = JSON.parse(
          execFileSync("git", ["show", `HEAD:${PKG}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }),
        );
        const headSpec = headPkg?.devDependencies?.["drizzle-kit"] ?? null;
        expected.headSpec = headSpec;
        if (!SPEC_RE.test(headSpec ?? "")) {
          check("head-package-json-devdep", "fail", `HEAD spec '${headSpec}' fora do contrato`);
        } else {
          check("head-package-json-devdep", "pass", `HEAD spec '${headSpec}'`);
        }
      } catch {
        check("head-package-json-devdep", "fail", "não foi possível ler HEAD:package.json");
      }
    }
  }

  if (!opts.expectedFile && !opts.head) {
    check(
      "lock-sha256-source",
      "fail",
      "sem referência de hash (--expected ou --head) — fail-closed",
    );
  }

  // 6) node_modules instalado
  if (opts.checkNodeModules) {
    const nmPkg = path.join("node_modules", "drizzle-kit", "package.json");
    if (!existsSync(nmPkg)) {
      check(
        "node-modules-installed",
        "skipped",
        "node_modules/drizzle-kit ausente (npm ci pendente)",
      );
    } else {
      const installed = JSON.parse(readFileSync(nmPkg, "utf8"))?.version ?? null;
      observed.installedVersion = installed;
      if (!RESOLVED_RE.test(installed ?? "")) {
        check("node-modules-installed", "fail", `instalado ${installed} fora de 0.31.x`);
      } else {
        check("node-modules-installed", "pass", `instalado ${installed}`);
      }
    }
  }

  emit(reasons.length === 0, reasons.length === 0 ? "pass" : "fail");
} catch (err) {
  check("guard-runtime", "fail", `erro interno: ${err?.message ?? String(err)}`);
  emit(false, "fail", { error: String(err?.message ?? err) });
}
```

Formato do arquivo pinado opcional (`scripts/m02-lockfile-guard.expected.json`):

```json
{
  "lockSha256": "<sha256 do package-lock.json aprovado>",
  "note": "atualizado somente em PR de dependência; regenerar com: sha256sum package-lock.json"
}
```

### 2.3 Comportamento esperado no incidente atual (projeção, não executado)

| Check                    | Resultado esperado                                                |
| ------------------------ | ----------------------------------------------------------------- |
| `package-json-devdep`    | **fail** (`^0.18.1` ∉ `^\^0\.31\.\d+$`)                           |
| `lock-top-spec`          | pass (lock espelha 0.18.1 — espelho consistente, contrato errado) |
| `lock-resolved`          | **fail** (`0.18.1` ∉ `0.31.x`)                                    |
| `lock-sha256-head`       | **fail** (lock reescrito ≠ HEAD)                                  |
| `node-modules-installed` | **fail** (`0.18.1`)                                               |
| `ok` / exit              | `false` / **1**                                                   |

### 2.4 Casos de teste propostos (antes do wire)

1. Tree atual (drift B) ⇒ fail com 4 reasons (acima).
2. Tree limpo em `c080586` após `git checkout -- package.json package-lock.json && npm ci --ignore-scripts` ⇒ pass.
3. `package.json` corrigido à mão com lock ainda baixado ⇒ fail em `lock-top-spec`/`lock-resolved`/`lock-sha256-head`.
4. `package.json`+lock limpos, `node_modules` ainda 0.18.1 ⇒ fail em `node-modules-installed`.
5. `package.json` presente, `package-lock.json` ausente ⇒ fail (`guard-runtime`, JSON emitido).
6. Sem git (`--no-head`) e sem `--expected` ⇒ fail `lock-sha256-source`.
7. `--expected` com hash pinado correto ⇒ pass mesmo com `--no-head`.

### 2.5 Wire proposto (NÃO executar nesta rodada)

1. `package.json` (scripts): `"m02:lockfile-guard": "node scripts/m02-lockfile-guard.mjs"` — junto do lockfile sincronizado no mesmo commit (regra AGENTS.md).
2. Cadeia local: inserir `npm run m02:lockfile-guard` **no início** de `check` (antes de `check:ui-stack`), para falhar barato antes dos gates pesados.
3. CI `.github/workflows/ui-stack.yml` (job `verify`): passo `run: node scripts/m02-lockfile-guard.mjs` **após checkout e antes de `npm ci`** (o check `--head` funciona no runner; `node-modules-installed` ficará `skipped`).
4. `AGENTS.md` (mesmo commit): regra “após qualquer resume de sessão, rodar `npm run m02:lockfile-guard` antes do próximo gate/commit”; registrar em `docs/runbooks/` se aprovado.
5. Opcional: `m02:state-check` invocar a guarda como pré-condição do marcador de estado.

---

## 3. Inventário de WIP não rastreado

**Snapshot:** coleta em 2026-09-12 ~03:08–03:36Z (o último `git status` já inclui 2 arquivos criados por frentes irmãs durante a rodada: `hpanel-docmap-2026-09-12.md`, `vercel-docmap-2026-09-12.md`). **Nada foi executado/purgado/commitado.** Contagens e tamanhos são point-in-time e podem crescer com as frentes ativas.

**Totais:** 2 modificados (drift) + **24 entradas não rastreadas** = **321 arquivos**, **8.014.404 B (~7,64 MiB)**.

### 3.1 Modificados (drift — disposição: RESTAURAR, não commitar)

| Entrada             | Tamanho   | Disposição proposta                                                                 |
| ------------------- | --------- | ----------------------------------------------------------------------------------- |
| `package.json`      | 6.291 B   | **Restaurar** ao HEAD (`git checkout -- package.json`); nunca commitar o downgrade  |
| `package-lock.json` | 407.524 B | **Restaurar** ao HEAD (`git checkout -- package-lock.json`); validar com o guard §2 |

> ⚠️ **Ordem obrigatória antes de publicar WIP:** restaurar estes dois arquivos primeiro; um `git add -A` publicaria `drizzle-kit ^0.18.1` (violação do contrato de dependências do AGENTS.md).

### 3.2 Não rastreados — `docs/evidence/` (21 entradas · 180 arquivos · 1.800.316 B)

| Entrada                                | Arquivos |   Bytes | Disposição proposta                                                                                            |
| -------------------------------------- | -------: | ------: | -------------------------------------------------------------------------------------------------------------- |
| `checagens-pos-publicacao-2026-09-05/` |        4 |  36.470 | Publicar após triagem (evidência de verificação pós-publicação)                                                |
| `custodia/`                            |        1 |   1.166 | **Triagem** (conferir conteúdo/propósito antes de publicar)                                                    |
| `cutover-2026-09-07/`                  |       15 | 281.262 | Publicar (evidência de cutover executado)                                                                      |
| `cutover-prep-2026-09-07/`             |       26 |  64.909 | Publicar (preparação de cutover; pode conter IDs — rodar `m02:secrets-audit`)                                  |
| `cutover-prep-2026-09-09/`             |        1 |     984 | Publicar (idem)                                                                                                |
| `fase0-2026-09-06/`                    |       28 | 154.427 | Publicar após triagem (runbook/plano Fase 0)                                                                   |
| `gsec-2026-09-06/`                     |       19 | 113.396 | Publicar após triagem (rodada de segurança)                                                                    |
| `hpanel-docmap-2026-09-12.md`          |        1 |  38.467 | **Publicar nesta rodada** (saída de frente irmã)                                                               |
| `hpanel-preview-2026-09-09.md`         |        1 |  17.323 | Publicar (hPanel é dependência externa pendente)                                                               |
| `manual-navigation-2026-08-29.md`      |        1 |   5.832 | **Publicar** (citado como evidência da Onda 0 no ledger)                                                       |
| `neon-pitr-memo-2026-09-12.md`         |        1 |  30.530 | Publicar (memo PITR Neon; referência do cutover)                                                               |
| `obs-local-2026-08-30.md`              |        1 |   4.505 | Publicar (observabilidade local, ondas de perf)                                                                |
| `pendentes-2026-09-07/`                |       10 |  63.816 | Publicar após triagem                                                                                          |
| `perf-after-2026-08-29.md`             |        1 |  22.473 | **Publicar** (citado como evidência da Onda 3 no ledger)                                                       |
| `perf-baseline-2026-08-29.md`          |        1 |   7.720 | **Publicar** (citado como evidência da Onda 0 no ledger)                                                       |
| `preflight-rat-2026-09-07/`            |       17 |  42.110 | Publicar após triagem                                                                                          |
| `ps01-entry-2026-09-07/`               |       11 |  39.441 | Publicar após triagem                                                                                          |
| `pós-rat-2026-09-07/`                  |       17 | 742.825 | Publicar após triagem (maior item de evidência; verificar anexos)                                              |
| `sdd-continuacao-2026-09-07/`          |       14 |  66.758 | Publicar após triagem                                                                                          |
| `subagents/`                           |        9 |  31.837 | **Publicar** (saídas de subagentes: `S-ALIN-*`, `S-FORENSIC-*`, `S-SEC-*`, `S-TEC-*`)                          |
| `vercel-docmap-2026-09-12.md`          |        1 |  34.065 | **Publicar nesta rodada** (frente irmã; note: pi-lens aplicou autofix assíncrono neste arquivo durante o pass) |

- Base da disposição “publicar”: AGENTS.md — “Operational evidence belongs in `docs/evidence/`”; itens citados explicitamente pelo ledger (Ondas 0/3) marcados em negrito.
- Antes de publicar qualquer subconjunto: `npm run m02:secrets-audit` (contrato de segurança do repo) e checagem de tamanho/quota de commit.

### 3.3 Não rastreados — `.vercel/` (1 entrada · 139 arquivos · 6.214.006 B)

| Conteúdo observado                                                                                                                                   | Disposição proposta                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.vercel/output/{static,functions}`, `nitro.json`, `config.json` — Build Output API gerado localmente (AGENTS.md: preset `vercel` quando `VERCEL=1`) | **Descartar** (build output; não é fonte). **Adicionar `.vercel/` ao `.gitignore`** — hoje ele aparece como `??` (i.e., não ignorado) |

### 3.4 Não rastreados — tmp (2 entradas · 2 arquivos · 82 B)

| Entrada                              | Conteúdo | Disposição proposta                                                             |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------- |
| `.m02-review-tmp/env-var-names.txt`  | 41 B     | **Descartar após confirmar** que contém apenas NOMES de env vars (nenhum valor) |
| `.m02-review-tmp2/env-var-names.txt` | 41 B     | Idem (duplicata de scratch de review M-02)                                      |

### 3.5 Não rastreados — outros

Nenhum além das categorias acima (sem `tmp/`, `logs/`, artefatos de build fora de `.vercel/`). Observação: o passivo de arquivos não rastreados já gerou atrito com o gate local na rodada anterior (sessão pai, 2026-09-12T01:37Z registra falha de `format:check`/prettier associada a arquivos não rastreados); publicar ou excluir este WIP reduz esse ruído.

---

## 4. Registro GAP-DOC (regra DOC-FIRST)

| ID                | Afirmação operacional                                                                        | Fonte usada nesta rodada                                                                                                                     | GAP                                                                                                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-DOC-FREPO-001 | npm mantém no máximo 10 logs de debug e poda os mais antigos automaticamente (`logs-max:10`) | Runtime local npm@11.14.1: `~/.npm/_logs/2026-09-12T03_05_46_989Z-debug-0.log` L9/L11/L12 (`logs-max:10`, `cleaning logs, removing 1 files`) | **DOC oficial npm não consultada via web** (ferramenta web indisponível na allowlist do agente delegado). Citar `docs.npmjs.com` (config `logs-max`) em follow-up; até então a afirmação vale como observação de runtime local, não como contrato documentado |
| GAP-DOC-FREPO-002 | Semântica de resume de sessão do pi (se restaura/altera working tree)                        | Nenhuma doc consultada                                                                                                                       | **GAP**: ler `…/@earendil-works/pi-coding-agent/README.md` + `docs/` localmente (D5); nenhuma URL externa consultada                                                                                                                                          |
| GAP-DOC-FREPO-003 | Compatibilidade `drizzle-kit` 0.18.x vs 0.31.x (CLI `check`/`generate`)                      | Ledger L799 (adaptação do `drizzle.config.ts`) e metadata do lock local                                                                      | **GAP**: doc oficial do drizzle-kit não consultada via web; comportamento dos comandos sob 0.18.1 não reproduzido                                                                                                                                             |

Nenhuma outra afirmação sobre sistema externo foi feita sem marcação.

---

## 5. Riscos residuais

1. **Causa ativa:** o writer desconhecido pode reaplicar `^0.18.1` a qualquer retomada de sessão; a guarda (§2) apenas **detecta**. Enquanto não houver captura (D2/D3), o incidente pode recorrer.
2. **Publicação acidental do drift:** o volume grande de WIP favorece `git add -A`; restaurar `package.json`/`package-lock.json` **antes** de qualquer commit da rodada.
3. **Gates locais com toolchain errado:** com 0.18.1 instalado, `db:check`/`db:generate`/`drizzle.config.ts` rodam em versão fora do contrato; não reproduzido neste pass (não executado), compatibilidade apenas presumida pela adaptação de ago/2026.
4. **Peer opcional fora de faixa** no lock baixado (`>=0.31.4 || >=1.0.0-beta.1`, peer optional) — não quebra `npm ci`, mas é inconsistência latente caso o lock baixado seja publicado.
5. **Log irrecuperável:** a evidência de processo dos episódios A/B foi perdida pela poda rolling do npm; a identificação do writer depende de captura prospectiva (D2/D3).
6. **Inventário volátil:** frentes irmãs escreveram `docs/evidence/*-docmap-2026-09-12.md` durante a coleta; contagens podem divergir minutos depois. Além disso, pi-lens aplicou autofix assíncrono em um desses arquivos fora de turno — evidência de que o working tree tem **múltiplos escritores assíncronos** além das ferramentas do agente.
7. **Ruído de gate:** o passivo não rastreado (especialmente 180 arquivos em `docs/evidence/` e 6,2 MiB de `.vercel/`) segue pressionando `format:check`/prettier local até triagem/publicação/ignore.

---

## 6. Apêndice — comandos de coleta (todos read-only)

- `git status --porcelain=v1` / `-z` + `os.walk` (contagem/tamanho por entrada).
- `stat -c '%y %n' package.json package-lock.json node_modules/drizzle-kit/package.json node_modules/.package-lock.json`.
- `git diff -- package.json`; `git diff --stat -- package-lock.json`.
- `grep -n 'drizzle-kit' package.json package-lock.json`; `grep -n 'drizzle-kit' EXECUTION-STATE-PROGRAM.md`.
- `git log -p -- package.json` (histórico completo da linha); `git stash show`/`git show 'stash@{n}:package.json'` (n=0..2); `git reflog`; `git worktree list`.
- `find node_modules -newermt '2026-09-11 23:38:44' ! -newermt '2026-09-11 23:39:04' -type f` e janela equivalente 23:58:00–23:59:30.
- `ls -la --time-style=full-iso ~/.npm/_logs/`; leitura dos logs `2026-09-12T03_05_46_989Z` e `03_05_49_501Z`.
- Timeline do transcript da sessão pai (`…/sessions/…/2026-09-11T04-16-19-306Z_01a08eae-….jsonl`), com extração de eventos em 02:30–03:07Z e de todas as ocorrências de `drizzle-kit`/`0.18.1`.
- `grep -rln '0.18.1'` em `~/.pi/agent/{pi-hermes-memory,projects-memory,missions,skills}` e inspeção de `~/.pi/agent/npm` (bundle de extensões).
- `ps -eo pid,etimes,comm,args`; `find ~/.pi -newermt '2026-09-11 23:30' ! -newermt '2026-09-12 00:05'`; `find ~/.codex …` mesma janela.
- `grep -c 'drizzle' ~/.bash_history` (0) e mtime do histórico.
