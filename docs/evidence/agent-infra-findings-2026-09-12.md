# Achados de infra do agente — pi-hermes (memória) + arqueologia do lockfile

- **Rodada:** produção `preco-que-da-lucro`, 2026-09-12 (coleta em 2026-09-13T01:0xZ).
- **Repositório:** `/home/douglas-souza/preco-que-d-main` · branch `develop` · `HEAD` = `e0c8ec442b42fa7c7cfeb4317a6bf6e521fdae54`
  (`docs(evidence): F-3 prontidao Neon (journal 12/12, RLS 26/30, TTFF) e F-6 probes da interina Vercel`).
- **Contrato desta coleta:** somente leitura do repo (`read`/`grep`/`find`/`git` read-only) + escrita dos artefatos desta frente.
  Nenhum `npm`/`npx`/`tsx` foi executado. Nenhum valor de env/secret/URL de sessão foi transcrito — apenas nomes, estados, hashes e contagens.
- **DOC-FIRST:** este subagente não dispõe de ferramenta web nem de `memory_search`. Toda afirmação sobre sistema externo está ancorada em
  **artefatos locais** (fonte da extensão instalada, transcript da sessão pai, arquivos do repo) e os GAP-DOC estão declarados em §4.
  Nenhuma URL oficial foi citada como consultada.
- **Artefato companheiro:** `docs/evidence/substrato-estado-2026-09-12.md` (estado consolidado + checks M-02).

---

## 1. Warning do pi-hermes (memória do agente) — achado de infra

### 1.1 Classificação

| Campo            | Valor                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| ID               | **INFRA-MEM-01**                                                                                           |
| Componente       | extensão `pi-hermes-memory` (v0.9.8 no bundle `~/.pi/agent/npm`) — memória do agente                       |
| Severidade       | **P1 operacional** (não bloqueia o dia-D; bloqueia confiar em memória como fonte de estado)                |
| Status           | **ABERTO** — sintoma registrado; texto integral do warning não recuperável nesta coleta (limite declarado) |
| Dono sugerido    | Douglas (owner do ambiente) — configuração da extensão; programa M-02 — regra de fonte de estado           |
| Regra permanente | **Estado crítico só em artefato versionado; memória do agente é redundância, nunca fonte.**                |

### 1.2 Sintoma

- O handoff do orquestrador para esta rodada registra explicitamente, como item a tratar:
  **“Warning pi-hermes (memória do agente) — a registrar.”** (transcript da sessão pai, 2026-09-12, mensagem de mandato da rodada).
- **Limite de recuperação:** o texto literal do warning **não é recuperável** nesta coleta read-only: não há log persistido da extensão
  acessível no escopo, o subagente não expõe `memory_search`, e o console da sessão pai não está no transcript JSONL.
  Registrado como limite — **não inventado**.
- Evidência primária local do modo de falha correspondente (memória saturada + sem override de modelo):
  1. **Capacidade estourada:** o transcript da sessão pai registra o store em **100%** de ocupação em medições da própria extensão:
     `100% — 10349/10000 chars` (MEMORY) e `100% — 6791/5000 chars` (escopo de projeto). Ou seja: o mecanismo de memória opera
     **acima do próprio teto configurado**, com avisos de overflow/consolidação associados.
  2. **Nenhum override configurado:** `~/.pi/agent/hermes-memory-config.json` **não existe** (verificado; sem arquivo ⇒ todos os defaults).
     Fonte instalada documenta que `llmModelOverride`/`llmThinkingOverride` são **unset** por padrão e que os loops de background
     (review, flush de sessão, correção, consolidação) usam o **modelo/provider ativo** com fallback para subprocesso
     (`~/.pi/agent/npm/node_modules/pi-hermes-memory/README.md:539-540`; `src/handlers/background-review.ts:240`).
  3. **Mensagem de diagnóstico prevista na própria extensão** (mesma fonte):
     _“Subprocess: … Check the active model/provider or set llmModelOverride.”_ — é exatamente o vetor de falha apontado pelo
     fix sugerido no mandato (`llmModelOverride`/provider).
  4. `autoConsolidationWarnOnFailure` tem default `true` (warn no console) e `consolidationTimeoutMs` default `180000`
     (`README.md:539-541`) — falhas de consolidação **aparecem como warning na sessão** e não são duráveis.

### 1.3 Impacto

1. **Estado crítico não pode depender dela.** A memória vive fora do repo (`~/.pi/agent/…`), não é versionada, não tem commit,
   não tem trilha de auditoria e não é transportada com o código — um `git clone`/runner limpo não a vê.
2. **Não é durável por construção:** é limitada por caracteres (com overflow já observado em 100%), sujeita a consolidação automática
   (que reescreve/rotaciona entradas) e a snapshots `.failures.md.recovery-*` que **preservam o texto antigo** — o oposto de uma fonte de verdade.
3. **Falha assíncrona e silenciosa:** o processamento de background depende de um modelo/provider acessível; quando falha, o efeito é
   degradação silenciosa (consolidação não roda, correções não são salvas) com aviso efêmero no console.
4. **Risco direto de governança nesta rodada:** marcadores de estado do M-02, janela de freeze, SHA do dia-D, fila humana H-1..H-6 e
   hashes de snapshot são exatamente o tipo de dado que **não pode** ter a memória do agente como fonte — ver §2 (o próprio ledger do
   programa exige marcadores versionados) e §4 de `substrato-estado-2026-09-12.md` (drift de state marker).

### 1.4 Fix sugerido

1. **Configurar override explícito de modelo para os loops de background** — criar `~/.pi/agent/hermes-memory-config.json` com:
   - `llmModelOverride`: provider/modelo **comprovadamente alcançável pelo transporte de background** (o README traz um exemplo de
     provider/modelo; a escolha concreta é decisão do owner do ambiente);
   - `llmThinkingOverride`: `"off"` (reduz custo/latência de review/consolidação; default derivado quando há override);
   - manter `reviewTransport` no default `direct` (há fallback para subprocesso);
   - se consolidações forem mortas por timeout, elevar `consolidationTimeoutMs` acima do default de 180 s.
2. **Aliviar a saturação da memória** (hoje em 100%): consolidar manualmente e/ou ajustar `memoryOverflowStrategy` — memória saturada é
   fonte de warns recorrentes e de escrita rejeitada.
3. **Validar o fix:** rodar uma consolidação manual após a configuração e confirmar ausência do warning; manter
   `autoConsolidationWarnOnFailure: true` implícito/default para que falhas continuem visíveis no console.
4. **Não tratar o fix como pré-requisito do dia-D:** a correção é de redundância/ergonomia; o gate de produção continua nos artefatos versionados.

### 1.5 Regra permanente (normativa)

> **Estado crítico só em artefato versionado. Memória do agente é redundância, nunca fonte.**
>
> - Fonte de verdade = `EXECUTION-STATE-PROGRAM.md` (ledger), `docs/evidence/`, `docs/runbooks/`, ADRs e arquivos de estado pinados no repo
>   (ex.: guard `m02:lockfile-guard`, marcadores de state check).
> - A memória do agente pode **acelerar** (atalhos, lições, tool-quirks), **nunca decidir** gates, freeze, SHA, fila humana ou contagens de substrato.
> - Se uma informação existe **somente** na memória do agente, ela não existe para o programa: registrar no artefato versionado na mesma rodada.

---

## 2. Arqueologia mínima — incidente de lockfile `drizzle-kit`

**Fontes:** `docs/evidence/f-repo-archaeology-2026-09-12.md` (arqueologia completa), `EXECUTION-STATE-PROGRAM.md`
(`grep -n 'drizzle-kit'`: linhas 799, 887, 1340, 1342, 1359 e bloco da rodada), `package.json`/`package-lock.json` (leitura atual).

### 2.1 Linha do tempo essencial

| #   | Instante (UTC)           | Evento                                                                                                                                                                     | Desfecho                                                                                                           |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0   | até 2026-08-27           | Estado-fantasma `drizzle-kit ^0.18.1` existe **somente como working tree** (não existe em commit, stash ou worktree)                                                       | Origem do spec fora do git; tolerado no passado via `drizzle.config.ts` dual-compat 0.18/0.31                      |
| A   | **2026-09-12T02:38:55Z** | Episódio 1: `package.json` + lock rebaixados para `^0.18.1` + reify de `node_modules` (1617 arquivos) em ~20 s após escrita no bundle pi                                   | Restaurado às **02:48:52Z** (`git checkout` + `npm ci`); commit `c080586` às 02:49:15Z com “causa não determinada” |
| B   | **2026-09-12T02:58:54Z** | Episódio 2: mesmo rebaixamento, **10 min após a restauração** e durante janela **idle** da sessão pai                                                                      | Detectado no estado atual; evitou-se publicar o drift                                                              |
| C   | 2026-09-12 (rodada)      | Working tree restaurado ao HEAD + `npm ci` (0.31.10); guard proposto passa a **wired**                                                                                     | Commit `267137e` — `feat(m02): add fail-closed lockfile guard and wire it into check`                              |
| D   | 2026-09-13T01:0xZ        | Verificação desta frente: tree **sem drift** — `package.json:121` e `package-lock.json:57` com `"drizzle-kit": "^0.31.10"`; `git status` sem modificação nos dois arquivos | Guard ativo no gate local                                                                                          |

- **Ledger (grep `drizzle-kit` em `EXECUTION-STATE-PROGRAM.md`):** L799 (“drift PRÉ-existente (`package.json` já estava com `^0.18.1` antes das ondas)”),
  L887 (`drizzle-kit check` verde em 2026-09-01), L1340 (“`drizzle-kit ^0.18.1` + lock reescrito após o resume da sessão, sem log npm correspondente”),
  L1342 (“Causa não determinada; conferir `grep '\"drizzle-kit\"' package.json` antes de cada gate/commit”),
  L1359 (registro da rodada: “dois episódios … causa não estabelecida — LIMITE DECLARADO (dono: Douglas)”).
- **Correlação temporal 2/2:** os dois episódios ocorreram 20–50 s após gravações no **bundle de extensões pi** em `~/.pi/agent/npm`
  (02:38:33Z e 02:58:03–07Z). Mecanismo exato **não demonstrado** — hipóteses ranqueadas (H1–H4) na arqueologia completa.

### 2.2 Causa, limite e contenção

- **Causa raiz: ABERTA (LIMITE DECLARADO), não resolvida.** Um processo não identificado reaplica o par `package.json`+`package-lock.json`
  no estado `^0.18.1` (com reify do `node_modules`), de forma episódica. O log npm da janela é irrecuperável (poda rolling `logs-max:10`,
  sem indício de deleção deliberada) e não houve escrita no `_cacache` — compatível com replay de cache/checkpoint antigo (**≤ 2026-08-27**),
  que **não existe em nenhum ref git**.
- **Dono:** Douglas (owner do ambiente/repositório) para a investigação de causa raiz; **programa M-02** como dono da mitigação/registro.
- **Contenção (estado atual):** `m02:lockfile-guard` **fail-closed**, wired como **primeiro** elo do gate local —
  `package.json:70`: `"check": "npm run m02:lockfile-guard && …"` e script `m02:lockfile-guard` em `package.json:37`.
  O guard detecta a classe exata do incidente (spec do `package.json`, espelho no lock, resolução da versão/tarball, sha256 do lock vs HEAD,
  e versão instalada em `node_modules` quando presente); em erro/ausência de referência de hash ele **falha** (exit 1), nunca “passa por omissão”.
- **Critério de saída (não atingido):** (i) writer identificado com evidência de processo; ou (ii) 7 dias sem recorrência com guard verde
  em toda retomada + captura em flagrante (diagnósticos D2/D3 da arqueologia).
- **Rastro atual:** `git log --oneline` mostra `267137e` (guard) no `develop`; a rodada seguiu publicando normalmente (CI verde nos 3 pushes,
  ledger L1352-1354) — ou seja, **a guarda contém, mas o achado segue aberto e nunca deve ser rotulado “resolvido” sem explicação.**

---

## 3. Substrato — estado consolidado

O estado operacional desta rodada (tráfego, Neon, hPanel, Vercel, fila humana e resultado dos checks M-02 em modo leitura) está no
artefato companheiro **`docs/evidence/substrato-estado-2026-09-12.md`**, com a mesma data e o mesmo contrato de evidência.
Resumo de uma linha: **tráfego de aplicação NÃO EXISTE · Neon 12/12 · hPanel preview criado com build FAIL no item 1 · Vercel interina verde · fila humana H-1..H-6.**

---

## 4. Limites declarados / GAP-DOC

| ID                            | Limite ou lacuna                                                                                                                                                                                                                                                                                                                  | Efeito nesta coleta                                                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-INFRA-01                  | Subagente sem ferramenta web e sem `memory_search`; sem acesso ao console/log persistido da extensão `pi-hermes-memory`                                                                                                                                                                                                           | Texto literal do warning do pi-hermes **não recuperado**; sintoma documentado pela fonte da extensão + evidência de saturação no transcript.                                                                          |
| GAP-INFRA-02                  | Doc oficial do pi/pi-hermes não consultada via web (allowlist sem fetch)                                                                                                                                                                                                                                                          | Afirmações sobre a extensão ancoradas no **dist/README instalados** (`~/.pi/agent/npm/node_modules/pi-hermes-memory`), não em documentação publicada.                                                                 |
| GAP-INFRA-03                  | `npm run m02:state:check` e `npm run m02:matrix:check` **EXECUTADOS pelo orquestrador** em 2026-09-13T01:05–01:12Z (o subagente não tinha shell): `state:check` = FAIL-por-desenho até a entrada desta rodada (corrigido no commit final); `matrix:check` = **PASS**; `secrets-audit` = `COMPLETE_WITH_LIMITS` com `failures: []` | Avaliação read-only das assertivas do `state:check` em §4 do artefato de substrato; Registro pós-supervisão (S-ALIN P1-3): a proveniência é o comando + timestamp + HEAD `e0c8ec44…` acima — não uma rodada anterior. |
| GAP-INFRA-04                  | Causa do drift de lockfile não estabelecida (skill/processo externo)                                                                                                                                                                                                                                                              | Registrado como **limite com dono** (§2); guard contém. Nunca marcar como resolvido sem explicação.                                                                                                                   |
| (registro) estado do worktree | WIP não rastreado permanece no repo (`.vercel/`, `docs/evidence/*` antigos, `.m02-review-tmp*`)                                                                                                                                                                                                                                   | Sem impacto no conteúdo deste artefato; segue como risco de publicação acidental já mapeado na arqueologia.                                                                                                           |

---

## 5. Apêndice — comandos de coleta (todos read-only)

- `git rev-parse HEAD` / `git log --oneline -6` / `git status --porcelain=v1` / `git branch --show-current`.
- `grep -n '"drizzle-kit"' package.json package-lock.json`; `grep -n "m02:state\|m02:matrix\|m02:lockfile" package.json`.
- `grep -n "drizzle-kit" EXECUTION-STATE-PROGRAM.md`; `grep -n "Latest state marker parent" EXECUTION-STATE-PROGRAM.md | tail`.
- `read` de `docs/evidence/f-repo-archaeology-2026-09-12.md`, `docs/evidence/cutover-2026-09-12/README.md`,
  `docs/evidence/hpanel-homologacao-2026-09-12/01-node-version.md`, `docs/evidence/neon-prontidao-2026-09-13.md`,
  `docs/evidence/vercel-probes-interina-2026-09-13.md`, `docs/evidence/F-CONS-consolidacao-2026-09-12.md`.
- `read` de `scripts/m02-state-check.ts` e `scripts/m02-matrix.ts` (para descrever com precisão o que cada check asserta).
- Verificações de ambiente da extensão: existência de `~/.pi/agent/hermes-memory-config.json` (**ausente**) e leitura do
  `README.md`/`src/handlers/background-review.ts` do pacote instalado `pi-hermes-memory`.
- Extração de trechos do transcript da sessão pai (JSONL, read-only) para localizar o registro do warning e as medições de capacidade (100%).

---

## PODA J5 — executada (2026-09-13)

**Antes → depois (stores core do pi-hermes; limites: 5.000 chars projeto/user, 10.000 falhas):**

| Store                                        | Antes                      | Depois                                   | % do limite                |
| -------------------------------------------- | -------------------------- | ---------------------------------------- | -------------------------- |
| `pi-hermes-memory/failures.md`               | 32.261 chars · 38 entradas | **600 chars**                            | 322% → **6%**              |
| `projects-memory/preco-que-d-main/MEMORY.md` | 24.872 chars · 23 entradas | **638 chars**                            | 497% → **12%**             |
| `pi-hermes-memory/MEMORY.md` (global)        | 9.624 chars · 17 entradas  | **não podado** (fora do escopo aprovado) | 192% — recomendação aberta |
| `USER.md`                                    | 7.253 chars · 14 entradas  | **não podado** (fora do escopo aprovado) | 145% — recomendação aberta |

**Método:** backup integral dos 4 stores em `~/.local/share/pi-fronts/memory-prune-2026-09-13/`; destilação das lições duráveis
para `docs/evidence/agent-state/AGENT-ENV-NOTES.md` (artefato versionado); gravação de um **índice de boot** em cada store
podado, apontando para o journal e para o artefato (regra `AGENTS.md`: memória = cache invalidável).

**Métrica de sucesso (auto-review volta a responder):**

- Evidência direta: os stores core voltaram a ficar **abaixo do limite** (o overflow era a causa declarada das gravações recusadas com `usage` cheio) e `memory_search` responde normalmente após a poda.
- Evidência indireta declarada: o `sessions.db` (store estendido, ilimitado) preserva o histórico — buscas continuam encontrando entradas antigas; isso **não** é sintoma de saturação dos stores core.
- **Residual honesto:** o comportamento do loop de auto-review só se observa na próxima fronteira de sessão — registrado como pendência de verificação com data prevista (próximo boot, conforme `PROGRESS.md`).
