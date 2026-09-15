# Classificação de supply chain §25 — repo-local vs. settings do GitHub

- **data:** 2026-09-15
- **wp / squad / branch:** WP-A4 · SQUAD-APP-SUPPLY · `mission/a4-supply` (worktree `.worktree-mA4`)
- **spec_ref:** Plano Mestre §25 (`docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md:1794-1807`), §24 (`:1772-1791`, `dependency review` no fim do pipeline) e missão FASE 2(f)(g)
- **itens cobertos:** `25.1` (Actions pinadas por SHA) · `25.2` (permissions mínimas) · `25.3` (secrets não expostos em PR não confiável) · `25.4` (Dependabot) · `25.5` (Dependency Review — mesmo item de `24.13`, contado uma vez no placar) · `25.6` (CodeQL) · `25.7` (secret scanning)
- **claim:** `docs/evidence/agent-state/CLAIMS-INBOX/12.5-25.4-supply.md`

## 1. Método, e o que este documento NÃO afirma

- **Lado repo-local:** inventário por leitura de `.github/**` no HEAD deste branch + censos por comando (§3). Tudo o que aparece como "repo-local" abaixo é observável no repositório, com `arquivo:linha`.
- **Lado settings do GitHub:** o estado atual **não é derivável read-only** a partir do repo. Não existe artefato versionado para *dependency graph*, *Dependabot alerts/security updates*, *Code Security/GHAS*, *Secret Protection*, *secret scanning* ou *push protection*, e a criação de token pela UI está bloqueada (**H-2**: sem token/CLI, inventário de config não é possível — `docs/evidence/agent-state/AGENT-ENV-NOTES.md:39`). Portanto a coluna "settings do GitHub" é **declaratória**: diz o que precisa ser ligado e por quê — **não** é uma medição do estado atual da instância.
- **Nenhuma chamada de rede** foi feita para produzir este documento; nenhum workflow foi alterado em função dele.
- Divergência relevante para leitura do placar: `25.5` e `24.13` são o **mesmo** item (o plano lista Dependency Review em §24 e §25); este documento o classifica uma única vez (`25.5`).

## 2. Classificação item a item

| item | exigência §25 | classificação | estado no repo (HEAD do branch) | evidência |
| ---- | ------------- | ------------- | ------------------------------- | --------- |
| `25.1` | Actions pinadas por SHA | **repo-local** (já mantido) | DONE — 22 `uses:` em `.github/workflows/**`, **0** refs não-`[0-9a-f]{40}`; pins comentados com a versão | §3.1 |
| `25.2` | permissions mínimas | **repo-local** (já mantido) | DONE — os 6 workflows declaram `permissions:` top-level (`contents: read`); jobs elevam só o necessário | §3.2 |
| `25.3` | secrets não expostos em PR não confiável | **repo-local (controle) + settings (garantia)** | Controle no repo: fork-guard antes de qualquer segredo; job de PR sem secreto; workflows que usam secrets são `workflow_dispatch`-only. Garantia final (política de aprovação de fork, escopo de secrets, environments) é settings | §3.3 |
| `25.4` | Dependabot (quando disponível) | **repo-local (version updates)** + **settings (alerts/security updates)** | Repo-local **implementado neste WP**: `.github/dependabot.yml` com `npm` + `github-actions`, agenda semanal, `open-pull-requests-limit` explícito. *Dependabot alerts* e *security updates* **não** são configuráveis por arquivo ⇒ settings | `.github/dependabot.yml:1-34` |
| `25.5` | Dependency Review | **settings do GitHub** (pré-requisito de feature) | **Não entra workflow neste WP**: a ação só é útil/validável com *dependency graph* ligado, e para repo privado exige *GitHub Code Security/GHAS*. Adicionar o workflow antes do setting produz check que não mede nada — proibido pelo spec-card | §4 passo 1–3 |
| `25.6` | CodeQL "se compatível com plano" | **misto: repo-local se o repo for público; settings/plano se for privado** | Não há artefato no repo. Em repo **público** o code scanning é **gratuito** e o *advanced setup* é artefato versionado (`github/codeql-action` em `.github/workflows/codeql.yml`, pinado por SHA) — implementável **sem setting novo**; em **privado** exige licença *GitHub Code Security*. A **visibilidade do repo não foi medida** (H-2) ⇒ UNVERIFIABLE até o passo 1 da fila | §4 passo 5, §5 |
| `25.7` | secret scanning "se compatível" | **settings do GitHub** | Não há artefato no repo (`.github/secret_scanning.yml` não existe e não é o mecanismo): público ⇒ roda automático e grátis; privado org-owned ⇒ *GitHub Secret Protection* (Team/Enterprise Cloud); privado user-owned ⇒ Enterprise Cloud com EMU. Parte do mesmo bloco de decisão é *push protection* | §4 passo 6, §5 |

Leitura de conjunto: **`25.1`–`25.4` são repo-local** (3 já estavam DONE; `25.4` foi fechado neste WP na metade que o repo pode fechar). **`25.5` e `25.7` são settings-side** — nenhum deles vira workflow versionado. **`25.6` é misto**: em repo **público** o *advanced setup* é artefato versionado (`codeql.yml` com `github/codeql-action` pinada) e não depende de setting novo; em **privado** depende de licença (*GitHub Code Security*). Como a visibilidade **não foi medida** (H-2), `25.6` fica fora do repo nesta rodada — criar o workflow agora poderia fazê-lo falhar por licença ausente.

## 3. Censos (saída real)

Comandos rodados em `.worktree-mA4` (`mission/a4-supply`) em 2026-09-15.

### 3.1 `25.1` — pins por SHA

```
$ grep -hoE "uses: [^ ]+" .github/workflows/*.yml | sed 's/^uses: //' | sed 's/.*@//' | awk '{print length($0), $0}' | sort | uniq -c
      5 40 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a
      6 40 3d3c42e5aac5ba805825da76410c181273ba90b1
      3 40 4468d825d5a88ef4012f1705a82f02ec3072f776
      5 40 820762786026740c76f36085b0efc47a31fe5020
      3 40 fb620d43d4c565abaf088b848a4e28e5c4ea4d9c
$ grep -hoE 'uses: [^ ]+@[^ ]+' .github/workflows/*.yml | grep -vE '@[0-9a-f]{40}$' | wc -l
0
```

22 usos, 5 ações distintas (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `neondatabase/create-branch-action`, `neondatabase/delete-branch-action`), todas com SHA completo. Nenhuma tag flutuante (`@v7`, `@main`).

### 3.2 `25.2` — permissions

```
$ grep -n "permissions:" -A 2 .github/workflows/*.yml
.github/workflows/ci-light.yml:16:permissions:
.github/workflows/ci-light.yml-17-  contents: read
.github/workflows/neon-drill-ops.yml:45:permissions:
.github/workflows/neon-drill-ops.yml-46-  contents: read
.github/workflows/neon-pr-branch.yml:35:permissions:
.github/workflows/neon-pr-branch.yml-36-  contents: read
.github/workflows/neon-pr-branch.yml:86:    permissions:
.github/workflows/neon-pr-branch.yml-87-      contents: read
.github/workflows/neon-pr-branch.yml-88-      pull-requests: read
.github/workflows/neon-pr-branch.yml:393:    permissions:
.github/workflows/neon-pr-branch.yml-394-      contents: read
.github/workflows/neon-pr-branch.yml-395-      pull-requests: write
.github/workflows/neon-preview.yml:12:permissions:
.github/workflows/neon-preview.yml-13-  contents: read
.github/workflows/neon-readiness.yml:34:permissions:
.github/workflows/neon-readiness.yml-35-  contents: read
.github/workflows/ui-stack.yml:13:permissions:
.github/workflows/ui-stack.yml-14-  contents: read
```

`pull-requests: write` aparece só no job `cleanup` (`:393-395`), que precisa comentar no PR; o job de trabalho (`branch-ci`, `:86-88`) fica em `read`. O passo **E2E** adicionado neste WP roda em `branch-ci` e **não** pede permissão nova.

### 3.3 `25.3` — secrets e PR não confiável

```
$ grep -n "HEAD_REPO\|BASE_REPO\|fork-guard" .github/workflows/neon-pr-branch.yml
57:          HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}
58:          BASE_REPO: ${{ github.repository }}
63:          if [ "$HEAD_REPO" != "$BASE_REPO" ]; then
65:            echo "reason=fork-guard" >> "$GITHUB_OUTPUT"
66:            echo "- Neon PR branch CI: PULADO (fork-guard: head '$HEAD_REPO' ≠ repository '$BASE_REPO')" >> "$GITHUB_STEP_SUMMARY"
350:          # aqui (fork-guard do job `gate`).

$ grep -n "secrets\." .github/workflows/*.yml | awk -F: '{print $1}' | sort | uniq -c
      8 .github/workflows/neon-drill-ops.yml
      5 .github/workflows/neon-pr-branch.yml
      5 .github/workflows/neon-readiness.yml
```

- `neon-preview.yml` (o único workflow além do `neon-pr-branch` que roda em `pull_request` — `:7-8`) tem **zero** usos de `secrets.`.
- `neon-drill-ops.yml` (`:16-17`, `workflow_dispatch`) e `neon-readiness.yml` (`:3-4`, `workflow_dispatch`) não são disparáveis por PR.
- `neon-pr-branch.yml` só chega a `secrets.NEON_API_KEY` depois do fork-guard (`:54-66`) e o job de trabalho exige `needs.gate.outputs.run == 'true'` (`:81`). O passo E2E adicionado segue o mesmo contrato: **nenhum segredo novo** e nenhum `secret` em gatilho de PR de fork (ver `docs/evidence/branch-lifecycle-e2e-2026-09-15.md`).
- Lado **settings** (garantia que o repo não pode dar sozinho): *Settings → Actions → General → Fork pull request workflows* (exigir aprovação), política de acesso dos secrets (repo/ambiente) e *environments* com required reviewers para os workflows `workflow_dispatch`. Ver §4 passo 7.

## 4. Fila humana — settings do GitHub, passo a passo

Ordem deliberada: cada passo é pré-requisito do seguinte. Nada aqui é executável por agente sem token/API (H-2).

1. **Registrar a visibilidade do repositório** (public / private / internal). Ela decide os passos 3, 5 e 6 — hoje **não** é verificável read-only neste ambiente. *Settings → General → Danger Zone (visibilidade)*.
2. **Ligar o dependency graph** — *Settings → Code security → Dependency graph*. É o pré-requisito declarado de Dependency Review: "The dependency review feature becomes available when you enable the dependency graph" (<https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependency-review>).
3. **Habilitar Dependabot alerts e Dependabot security updates** — *Settings → Code security → Dependabot alerts: Enable* e *Dependabot security updates: Enable*. **Não** é configurável por `.github/dependabot.yml` (que cobre só *version updates*, `docs/PLANO_MESTRE...md:1804`).
4. **Só então avaliar o workflow de Dependency Review (item `25.5`)** — a ação é "available for all public repositories, as well as private repositories that have GitHub Code Security or GitHub Advanced Security enabled" (mesma página do passo 2). Se o passo 1+3 estiver satisfeito: adicionar `actions/dependency-review-action` **pinada por SHA** com `permissions: { contents: read, pull-requests: write }`, e marcar o check como obrigatório na proteção de branch (a doc registra que "A failed check blocks a pull request from being merged when the repository owner requires the dependency review check to pass"). **Enquanto o setting não existir, o workflow não entra** — foi exatamente o que este WP decidiu (spec-card §"NÃO fazer").
5. **CodeQL / code scanning (item `25.6`)** — os dois casos, dependentes da visibilidade registrada no passo 1:
   - **repo público** — feature **gratuita**, e o caminho do *advanced setup* é **artefato versionado**: `.github/workflows/codeql.yml` usando `github/codeql-action` **pinada por SHA** (mantendo §25.1), sem nenhum setting novo. É implementável por agente assim que a visibilidade for conhecida; o *default setup* (Settings → Code security → Code scanning → Set up) também vale e não gera workflow.
   - **repo privado** — exige licença *GitHub Code Security*: "If you want to use code scanning on private repositories, you need a GitHub Code Security license" (<https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning>). Sem a licença, um `codeql.yml` versionado falharia no run — por isso ele **não** foi criado neste WP.
   - **Estado atual:** a visibilidade do repo não é medível read-only (H-2) ⇒ `25.6` segue **UNVERIFIABLE**, e nenhum workflow foi adicionado (não se cria workflow que falharia por setting/licença ausente).
6. **Secret scanning + push protection (item `25.7`)** — *Settings → Code security → Secret scanning*: em **público** "runs automatically for free" (ligar *push protection*); em **privado org-owned** exige *GitHub Secret Protection* em Team ou Enterprise Cloud (<https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning>). `.github/secret_scanning.yml` **não** é o mecanismo de habilitação (serve só para customização/paths ignorados) — por isso a ausência do arquivo não é achado.
7. **Endurecer o lado settings de `25.3`** — *Settings → Actions → General*: em *Fork pull request workflows*, exigir aprovação para workflows de fork; revisar a política de acesso do `NEON_API_KEY` (repo-level hoje, usado por `neon-pr-branch.yml`, `neon-drill-ops.yml`, `neon-readiness.yml`) e, se aplicável, migrá-lo para *environment* com required reviewers nos workflows `workflow_dispatch`.
8. **Registrar o veredicto** de cada passo 2–7 (ligado/desligado + data) na fila humana do MAESTRO. Sem esse registro, `25.5`–`25.7` permanecem **UNVERIFIABLE** (não "NS"): a ausência de artefato no repo não prova ausência de setting.

## 5. Limites declarados

- **Estado dos settings não medido.** Nenhum passo de §4 foi executado nem verificado (H-2: sem token/API, inventário de config não é possível). A classificação separa corretamente *onde* cada item se resolve, mas **não** afirma que os settings estão ligados.
- **Visibilidade do repo desconhecida** neste ambiente; os passos 3, 5 e 6 têm caminhos distintos para público e privado e ambos estão descritos. Consequência direta para `25.6`: o caminho público (workflow `codeql.yml` versionado, sem setting novo) **não** foi implementado por depender dessa medição — não por ser settings-only, mas porque criá-lo às cegas pode falhar por licença.
- **Nenhuma chamada de rede** para GitHub/Neon foi feita na produção deste documento.
- **Regime:** CONTROLLED (inspeção local + censos), sem execução remota.
