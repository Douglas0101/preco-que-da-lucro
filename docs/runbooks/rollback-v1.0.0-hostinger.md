# Runbook — Rollback da release v1.0.0 em produção (Hostinger)

> **Alvo:** app `darkgray-pony-545965.hostingersite.com`, servido pela branch `main`.
> **Escopo:** reverter a promoção `develop → main` tagueada `v1.0.0` **por revert + redeploy**.
> **Não substitui:** `hostinger-cloud-node.md` (§Operação, restart e rollback), `cutover-A4.md`
> (§7), `a4-a5-cutover.md`, `dia-d-2026-09-12.md` (§2) e `migration-safety.md`.
> **Nada deste runbook foi executado.** Os _fatos_ que ele usa foram medidos por leitura (§1);
> o _procedimento_ está **não executado** e o ensaio está em §9. Não leia "medido" como "testado".

## 0. TL;DR

| situação                                 | alavanca                                                  | verificação que não mente                     |
| ---------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| Release `v1.0.0` saudável, sem trigger   | não fazer nada                                            | §6 (G1–G7) verde na janela                    |
| Trigger de §3 disparado                  | **PR de revert** para `main` → merge → redeploy no hPanel | §5 passo A4 (`git diff --quiet`) + §6 (G1–G7) |
| hPanel indisponível / Git indisponível   | archive anterior (§7) — emergência, com drift declarado   | §6 (G1–G7)                                    |
| `/ready` = 503 **com** `/live` = 200     | **rollback de código não resolve** (§3.1) — é dependência | `/live` 200 já prova que o artefato está vivo |
| Qualquer forma de reescrita de histórico | **PROIBIDO** (§2)                                         | n/a — é veto, não gate                        |

## 1. Fatos medidos nesta sessão (leitura, sem execução)

Medições feitas em 2026-09-30 sobre o repositório local (`git log`/`git show`/`git rev-parse`/
`git diff` somente-leitura, `read` de arquivos e `grep`). Nada foi executado, deployado ou escrito.

| #   | fato                                                                                                                                                                                                                                                                                     | fonte medida                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Produção serve `main`, cujo tip remoto é `9724d2c73b269d0a0199ea305308f3237b38fa09` ("Merge pull request #47 from Douglas0101/develop")                                                                                                                                                  | `git rev-parse origin/main`, `git log -1 origin/main`                                                                          |
| F2  | Esse commit é um **merge commit** (2 pais: `ef2110e`, `0734ed9`)                                                                                                                                                                                                                         | `git log -1 --format='%H %P' 9724d2c`                                                                                          |
| F3  | Último deploy medido no hPanel: branch `main`, commit `9724d2c7`, status "Concluído Atual" em 2026-09-29 11:31:24                                                                                                                                                                        | `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §3.1–§3.2                                                                 |
| F4  | Baseline de gates **medida no alvo** em 2026-09-29: `/` 200 (app), `/api/health/ready` 200, `/api/health/live` 200, `/ready`+`/live` 404, `http→https` 301, TLS válido                                                                                                                   | `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §3.3                                                                      |
| F5  | **`v1.0.0` não existe.** Existem 14 tags: 13 `ci-local/*` e `v0.1.0-rc1` (anotada; resolve para `218086b`, que **não** é ancestral de `origin/main`, `origin/develop` nem `HEAD`)                                                                                                        | `git tag -l`, `git rev-parse v0.1.0-rc1`, `git merge-base --is-ancestor`                                                       |
| F6  | **`develop` está 406 commits à frente de `origin/main`** (`origin/main...origin/develop`). Localmente a contagem é 516 (`main...develop`)                                                                                                                                                | `git rev-list --left-right --count`                                                                                            |
| F7  | `origin/main` é ancestral de `origin/develop` (nenhum commit de `main` fora de `develop`)                                                                                                                                                                                                | `git merge-base --is-ancestor origin/main origin/develop` → exit 0                                                             |
| F8  | **A `main` local está 59 commits atrás de `origin/main`** e `9724d2c` **não é ancestral** dela; a `develop` local está 51 atrás de `origin/develop`                                                                                                                                      | `git rev-list --left-right --count origin/main...main` → `59  0`                                                               |
| F9  | `HEAD` local = `d38d481`, branch `feature/contract-guard-bff`, descendente de `origin/main` (526 à frente, 0 atrás)                                                                                                                                                                      | `git rev-list --left-right --count origin/main...HEAD`                                                                         |
| F10 | **Não existe workflow de deploy.** Os 6 workflows são `ci-light`, `neon-drill-ops`, `neon-pr-branch`, `neon-preview`, `neon-readiness`, `ui-stack`; nenhum contém `hostinger` nem `deploy`                                                                                               | `ls .github/workflows/`, `grep -rniE 'hostinger\|deploy' .github/workflows/`                                                   |
| F11 | Schema de produção = journal com **12 entradas**, última `0011_auth_rls_normalization`                                                                                                                                                                                                   | `git show origin/main:drizzle/meta/_journal.json`                                                                              |
| F12 | Schema da release = journal com **20 entradas**, última `0019_tiresome_robin_chapel`; a release adiciona `0012`–`0019` (26 arquivos em `drizzle/`, incluindo 8 downs e 8 snapshots)                                                                                                      | `git show origin/develop:drizzle/meta/_journal.json`, `git diff --name-status origin/main origin/develop -- drizzle/`          |
| F13 | As 8 migrations da release são **6 `SAFE` + 2 `ONLINE_WITH_CARE`** (`0013`, `0019`), todas `appliedOn: "empty"`; **0 `BREAKING`** e **0 `DATA_MIGRATION`**                                                                                                                               | `scripts/db/migration-classes.ts` (tags das linhas 221–334; `DATA_MIGRATION` do registry são `0004` e `0010`, fora da release) |
| F14 | Nenhuma migration da release remove/renomeia objeto consumido pela produção: `DROP` existe só em `0019` (`DROP CONSTRAINT ai_memories_status_check`, recompondo o CHECK **mais largo** com `'expired'`)                                                                                  | `grep -nEi 'drop \|rename \|delete from\|update \|alter table' drizzle/001[2-9]_*.sql`                                         |
| F15 | `ai_memories` é **criada pela própria release** (`0017`); logo `0018` (`ADD COLUMN dedup_key text NOT NULL`, **sem default**) incide sobre tabela que não existe em produção                                                                                                             | `grep -n 'CREATE TABLE' drizzle/0017_past_gideon.sql`, F11                                                                     |
| F16 | `/api/health/live` não toca o banco; `/api/health/ready` executa `select 1` e devolve **503** quando o Postgres está indisponível                                                                                                                                                        | `src/routes/api/health/live.ts:6`, `src/routes/api/health/ready.ts:8,16`                                                       |
| F17 | Título servido pelo app: `Preço que Dá Lucro — avalie preços sustentáveis para seu produto`                                                                                                                                                                                              | `src/routes/index.tsx:10`                                                                                                      |
| F18 | Enquanto o build está FAIL, o hPanel responde `GET /` com **200** e placeholder PHP (`x-powered-by: PHP/8.3.33`, `server: hcdn`), enquanto as rotas reais respondem 404                                                                                                                  | `docs/evidence/agent-state/PROGRESS.md:248-255`                                                                                |
| F19 | **A doc oficial do hPanel afirma que não existe rollback por commit** — publicar a versão anterior exige `git revert`/`reset` + push, ou upload do archive anterior                                                                                                                      | `docs/evidence/hpanel-docmap-2026-09-12.md:258,260`                                                                            |
| F20 | Limites medidos da plataforma: 15 min para instalar e 15 min para build, **1 deployment por vez** (até 20 na fila), logs das **últimas 10** builds, env vars injetadas no build **e** no runtime, persistindo entre deploys, **salvar env vars dispara redeploy**                        | `docs/evidence/hpanel-docmap-2026-09-12.md:256-258`                                                                            |
| F21 | `engines.node = ">=24.15.0"`; o builder do hPanel tem Node `v24.6.0` e falhou com `npm error code EBADENGINE` → `ERROR: Failed to install dependencies`; o remédio aplicado foi `NPM_CONFIG_ENGINE_STRICT=false`                                                                         | `package.json`, `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §3.1                                                      |
| F22 | A tela `.../node/deployments/settings` renderiza valores de env var **em inputs de texto**; um snapshot de acessibilidade dela vazou `DATABASE_URL` e `BETTER_AUTH_SECRET` para o contexto do agente (contenção executada)                                                               | `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §4                                                                        |
| F23 | O formulário de `settings` listava só as **11** vars originais; as 3 adicionadas (`NPM_CONFIG_ENGINE_STRICT`, `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS` — nenhuma secreta) foram inseridas por DOM e o save submeteu **14**                                                              | `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §3.2                                                                      |
| F24 | O wrapper de smoke local sobe o artefato em `127.0.0.1` (porta efêmera), com `DATABASE_URL` apontando para loopback inalcançável, e asserta `live=200` + `ready=503` **duas vezes** (precedência `NITRO_PORT`/`NITRO_HOST` e `PORT`/`HOST`), com redaction de connection string na saída | `scripts/check-hostinger-runtime.mjs:90-142`                                                                                   |
| F25 | `engine` de smoke local: `npm run build` + `npm run check:hostinger-runtime`; não roda migrations, não escreve no Neon, não usa Resend/OAuth/IA                                                                                                                                          | `docs/runbooks/hostinger-cloud-node.md:67-74`                                                                                  |

### 1.1 Limites declarados desta seção

- **Não** medi produção nesta sessão: nenhum `curl`, nenhum acesso ao hPanel, nenhum deploy. F3/F4
  são **medições de 2026-09-29** lidas de artefato, não re-medições de hoje.
- **Não** sei se o hPanel faz auto-deploy em push. A operação observada (F3) foi **manual**. A doc
  diz que deployment settings "aplicam no próximo push ou via Save and redeploy" (F20) — o que é
  compatível com auto-deploy, mas **não é a mesma coisa** que tê-lo medido.
- **Não** sei se o banco de produção está vazio. O registry declara `appliedOn: "empty"` para as 8
  migrations da release (F13), e o predicado de `live` ("havia dados") é do PR, não uma medição
  minha. Se houver dado de aplicação, a classe de tratamento é a estrita de
  `migration-safety.md:21-22`.
- **Não** sei qual será o SHA do merge `M` nem de `M^1` — a release ainda não aconteceu (F5). Por
  isso o runbook trabalha com **símbolos** (`M`, `M^1`) e o passo A2 os resolve e os congela.

## 2. O plano inválido — por que `git push --force` não é rollback

O brief original propunha `git push origin main --force` para "voltar a `main`". **Isso é rejeitado.**

1. `AGENTS.md:16` — _"Never force-push, rebase, or amend commits already pushed to any published
   branch."_ `main` é branch publicado (é o default do repositório, `AGENTS.md:15`).
2. `AGENTS.md:3-6` — o aviso do Lovable: _"Avoid rewriting published git history — force pushing, or
   rebasing/amending/squashing commits that are already pushed — as it rewrites history on
   Lovable's side and the user will likely lose their project history."_
3. `AGENTS.md:17` — a proteção formal de branch está **pendente** (ADR-017). A ausência de
   branch protection **não** é permissão: é a razão pela qual a regra precisa ser obedecida à mão.

**A mesma rejeição vale para as variantes**, todas da mesma classe (reescrita de histórico publicado):

| comando                                      | veredito                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git push origin main --force`               | **PROIBIDO** (`AGENTS.md:16`)                                                                                                                                                               |
| `git push origin main --force-with-lease`    | **PROIBIDO** — é force-push com outra trava                                                                                                                                                 |
| `git reset --hard <sha> && git push --force` | **PROIBIDO** — o `reset` só publica a versão anterior com um push **não-fast-forward**, que é exatamente o vetado (`hpanel-docmap:258` cita a variante `reset`; `AGENTS.md:16` veta o push) |
| `git tag -f v1.0.0 <sha>`                    | **PROIBIDO** — mover tag publicada torna a release irreprodutível; quem reimplantar a tag recebe o build ruim                                                                               |
| `git push --delete` da tag `v1.0.0`          | **EVITAR** — remover a referência publicada apaga a identidade do que foi ao ar                                                                                                             |

A tag `v1.0.0` **não se move**. Ela passa a marcar a release que foi revertida; a release corrigida
é a `v1.0.1` (ou posterior). Registre no ledger que `v1.0.0` está revertida (§12).

## 3. Triggers de rollback (nomeados e mensuráveis)

Qualquer **RT** abaixo, confirmado por duas leituras independentes, autoriza o §5. Cada um traz a
medição — nenhum é "parece estranho".

| id   | trigger                           | limiar                                                                                                                                 | como medir                                                                                 |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| RT-1 | **Liveness ≠ 200**                | `/api/health/live` ∉ {200} em 2 leituras separadas por ≥ 30 s                                                                          | `curl` G2, §6                                                                              |
| RT-2 | **Erro de servidor sustentado**   | **5xx > 5%** das requisições por **2 min contínuos** (piso: ≥ 100 amostras)                                                            | §3.2                                                                                       |
| RT-3 | **Anomalia visual — INV-007**     | NaN/Infinity renderizado como `R$ 0,00` (ou qualquer zero factual onde o valor é não-finito)                                           | revisão visual/`npm run test:visual` contra `src/lib/observability/visual-verification.ts` |
| RT-4 | **Anomalia visual — INV-006**     | dado incompleto apresentado como factual: o estado declarado não bate com o texto (esperado `—` / `Erro de cálculo` / `Não atingível`) | idem RT-3                                                                                  |
| RT-5 | **Violação de segurança**         | cross-tenant (INV-008), credencial exposta, ou acesso sem sessão a rota protegida                                                      | §3.3; abort list de `a4-a5-cutover.md:38`                                                  |
| RT-6 | **Placeholder servindo produção** | `/` responde 200 **e** `x-powered-by: PHP/*` (F18) — o app não está no ar                                                              | §6 G3                                                                                      |

Fonte dos invariantes: `docs/adr/ADR-033-computer-user-observability.md:69-73`,
`src/lib/observability/visual-verification.ts:11-12,95,112,164`.

### 3.1 Discriminação obrigatória antes de reverter (evita rollback inútil)

`live` e `ready` falham por motivos diferentes (F16). Reverter código por causa de dependência
**não conserta nada e ainda troca o artefato bom por um mais antigo**:

| `/api/health/live` | `/api/health/ready` | leitura correta                                                        | rollback de código?            |
| ------------------ | ------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| 200                | 200                 | app e banco ok — RT-2/RT-3/RT-4/RT-5 decidem pelo sintoma              | só se o sintoma for da release |
| 200                | 503                 | **Postgres indisponível** (`hostinger-cloud-node.md:64`) — dependência | **não** — não é a release      |
| ≠ 200              | qualquer            | processo/artefato morto (RT-1)                                         | **sim**                        |
| 200 + PHP          | qualquer            | build FAIL → placeholder (F18)                                         | **sim** (redeploy de artefato) |

### 3.2 Medição do RT-2 (5xx > 5% por 2 min)

**Limite honesto:** não existe, neste repositório, caminho verificado que meça 5xx de produção
sozinho. `scripts/obs/error-budget.ts` é local-first e _parse-only_ — **"não mede tráfego real
sozinha: precisa que alguém exporte o JSONL"** (`slo-error-budget.md` §1), e a classe de 5xx é
"zero até revisão no baseline" (`slo-error-budget.md` §"Falha de servidor/dependência"). Portanto a
medição é do operador, por uma destas duas vias:

```bash
# Via 1 — sonda ativa no caminho de entrada (120 s, 1 req/s). Mede `/`, não o site todo.
end=$(( $(date +%s) + 120 )); n=0; e5=0
while [ "$(date +%s)" -lt "$end" ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 \
    https://darkgray-pony-545965.hostingersite.com/)
  n=$((n + 1)); case "$code" in 5*) e5=$((e5 + 1));; esac
  sleep 1
done
printf 'amostras=%s 5xx=%s\n' "$n" "$e5"
```

Dispara **RT-2** se `n ≥ 100` e `e5/n > 0.05`. **Limite da via 1:** é amostra de um caminho só — um
pico localizado numa rota de API pode passar despercebido. Ela é **piso**, não cobertura.
**Via 2 (autoritativa):** logs de runtime do hPanel (stdout/stderr, F20 — últimos 10 builds) ou os
spans por `pathname` agregados, conforme `slo-error-budget.md` §"Falha de servidor/dependência"
passo 4. Para usar o `error-budget`, exporte o JSONL da janela e rode o script (§4 daquele runbook).

### 3.3 RT-5 — a violação de segurança não se resolve só com rollback

Reverter o código **não** desfaz um segredo exposto. Se o trigger for exposição de credencial, o
rollback é apenas contenção: siga `docs/runbooks/secret-rotation-blind.md` e a dívida `DBT-31`
(rotação de `BETTER_AUTH_SECRET`), e registre o incidente conforme §12. Cross-tenant, ao contrário,
é falha de artefato: rollback imediato (`a4-a5-cutover.md:38`).

## 4. Pré-condições (P1–P4)

| #   | pré-condição                                                                                                 | comando / verificação                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| P1  | `git fetch` feito — **a `main` local está 59 commits atrás** e `9724d2c` não é ancestral dela (F8)           | `git fetch origin --prune && git rev-list --left-right --count origin/main...main`      |
| P2  | `M` e `M^1` resolvidos e **congelados por escrito** (SHA completo, não abreviado)                            | §5 A2                                                                                   |
| P3  | Autoridade de release acionada (a decisão de release é do MAESTRO — `ciclo-15…md` §6.3)                      | registro no journal (`docs/evidence/agent-state/PROGRESS.md`) antes de qualquer mutação |
| P4  | Alvo do rollback é o artefato de `M^1` — e `M^1` **tem de ser comparado** com `9724d2c` (§5 A2, gate `A2-g`) | `git diff --quiet <M^1> 9724d2c73b269d0a0199ea305308f3237b38fa09`                       |

**Não faça** P1 com `git pull` na `main` local: se ela tiver commit local não publicado, um
`--ff-only` falha e o reflexo errado é forçar. Caminho padrão: **não use a `main` local** — corte a
branch de rollback direto de `origin/main` (§5 A1).

## 5. Procedimento A — revert + redeploy

Ordem obrigatória. Não pule A4: é o único passo que prova, **antes** de publicar, que o revert
realmente devolve a árvore anterior.

### A1 — branch de rollback a partir do remoto

```bash
git fetch origin --prune
git switch --create rollback/v1.0.0 origin/main
```

### A2 — identificar e congelar o alvo

```bash
git rev-parse origin/main                     # = M (o merge da release)
git rev-list --parents -n 1 origin/main       # 3 campos ⇒ merge commit (shape esperado, AGENTS.md:15)
git rev-parse v1.0.0^{commit}                 # tem de bater com M
git rev-parse origin/main^1                   # = M^1 (alvo do rollback)
```

**Gate A2-g (bloqueante):** se `M^1` **não** for igual ao `9724d2c` que a produção serve hoje (F1),
então `main` recebeu commits entre o deploy atual e a release — reverter só o merge **não** volta ao
artefato medido como bom. Compare e decida, registrando a decisão:

```bash
git diff --stat <M^1> 9724d2c73b269d0a0199ea305308f3237b38fa09   # vazio ⇒ M^1 é o baseline de produção
```

Se houver diferença, o rollback tem **duas** escolhas e nenhuma é automática: (i) reverter apenas
`M` e aceitar `M^1` como novo estado (que é o release anterior + o que entrou depois — pode conter
o próprio defeito); ou (ii) reverter `M` **e** os commits intermediários. Pare e escale se não
houver clareza.

**Shape alternativo:** se a release entrar como fast-forward ou squash, `origin/main` terá **1 pai**
e `-m 1` é inválido. Nesse caso o revert do range é o caminho:

```bash
git rev-list --parents -n 1 origin/main       # 2 campos ⇒ 1 pai (FF/squash)
git revert --no-commit <M^1>..<M>             # reverte o range; árvore resultante = M^1
git commit -m "revert(release): rollback v1.0.0 para <M^1>"
```

### A3 — reverter o merge

```bash
git revert -m 1 --no-edit <M>                 # -m 1 = mantém o lado `main`, desfaz o conteúdo do PR
```

Conflitos aqui significam que commits posteriores tocaram os mesmos arquivos. Resolva **a favor da
árvore de `M^1`** e siga para A4 — o gate A4 é o que decide se a resolução ficou correta.

### A4 — gate local de identidade de árvore (não mente)

```bash
git diff --quiet <M^1> HEAD && echo "OK: árvore idêntica a M^1" || echo "FALHA: árvore != M^1"
git diff --stat <M^1> HEAD                    # se falhou, é aqui que aparece o que sobrou
```

Exit 0 ⇒ o commit de revert restaura **byte a byte** a árvore do alvo. Isso é independente do shape
do merge e não depende de o Drizzle, o Nitro ou o hPanel concordarem. **Não publique sem A4 verde.**

### A5 — publicar o revert em `main`

`AGENTS.md:15`: _"`main` (...) only receives merges via PR `develop → main` with green CI"_. Um
rollback é uma exceção declarada a essa regra — o **mecanismo** (PR + CI verde) é preservado, a
**origem** não é `develop`. Duas vias, escolhidas por quem tem autoridade (§4 P3):

- **A5-padrão (PR):** abra PR de `rollback/v1.0.0` → `main`. Push em `main`/`develop` (e todo PR)
  dispara o `UI stack` (F10, `AGENTS.md:43-44`); o PR roda a matriz completa. Merge com CI verde.
- **A5-emergência (push direto):** só em P0 declarado e com autorização registrada. O push em
  `main` **também** dispara o `UI stack` (mesma regra), mas sem a matriz completa do PR. É exceção
  registrada no journal — **nunca** uma violação silenciosa.

```bash
# A5-padrão
git push -u origin rollback/v1.0.0
#   → abrir PR para main → CI verde → merge
# A5-emergência (P0 registrado)
git push origin HEAD:main
```

### A6 — merge e conferência do que a `main` aponta

```bash
git fetch origin
git log --oneline -3 origin/main              # o revert tem de estar no topo (ou abaixo do merge do PR)
git rev-parse origin/main                     # = R (SHA do revert / do merge do PR de rollback)
git diff --quiet <M^1> origin/main && echo "OK: main == M^1"
```

### A7 — redeploy no hPanel

Não existe rollback por commit no hPanel (F19) — o que publica a versão anterior é o **push** em
`main` (se o auto-deploy em push estiver ativo — **não medido**, §1.1) **e/ou** o disparo manual no
hPanel. Antes de tocar a tela de settings:

1. **Varredura de NOMES de env var** (nunca valores). F23 mediu **14** em 2026-09-29 (11 originais +
   `NPM_CONFIG_ENGINE_STRICT`, `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS`). **Re-derive a lista na
   execução** — o número de 2026-09-29 é evidência, não constante. Os nomes que o runtime exige
   estão em `hostinger-cloud-node.md:116-189`.
2. **Armadilha R-1:** se `NPM_CONFIG_ENGINE_STRICT=false` não estiver presente, o build falha no
   install com `EBADENGINE` (F21) — o app **sai do ar** e volta o placeholder PHP (F18). Um rollback
   que perde as env vars é pior que a release ruim.
3. **Higiene de segredo (obrigatória):** **nunca** faça snapshot de acessibilidade nem screenshot da
   tela `.../node/deployments/settings` — ela renderiza valores **em texto plano** e já vazou
   `DATABASE_URL`/`BETTER_AUTH_SECRET` uma vez (F22). Opere por DOM, sem dump. Se um dump acontecer:
   remova as capturas **sem leitura**, declare o incidente e trate como exposição (§3.3).
4. **Não use "Salvar e reimplantar"** a partir de um formulário que não liste todas as vars (F23):
   salvar env vars **dispara redeploy** (F20) e um formulário desatualizado derruba as ausentes.
5. Dispare **um** deployment e aguarde "Concluído": a plataforma roda **1 por vez** (até 20 na fila),
   com 15 min para install e 15 min para build (F20). Medir gates durante o build mede o build antigo.

### A8 — gates pós-rollback (§6) e, se falharem, §7

Se G1–G7 não fecharem depois de um segundo redeploy, **não** fique tentando: vá para §7 ou reverta o
revert (§12) e escale. Não faça "conserto manual" em produção — a norma do repositório é correção
por reconciliação, nunca mutação ad-hoc (`dia-d-2026-09-12.md:301`).

## 6. Gates de verificação pós-rollback (G1–G7)

O hostname abaixo é público; **nenhum valor de env var entra neste runbook**. A coluna "baseline"
reproduz F4 (medido em 2026-09-29) para comparação — re-meça, não presuma.

| id  | gate                  | comando exato                                                                                                                                                                        | esperado / baseline                                                                                     |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| G1  | `/` serve o app       | `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://darkgray-pony-545965.hostingersite.com/`                                                                             | `200` (baseline 200)                                                                                    |
| G2  | liveness              | `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://darkgray-pony-545965.hostingersite.com/api/health/live`                                                              | `200` (baseline 200)                                                                                    |
| G3  | readiness             | `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 5 https://darkgray-pony-545965.hostingersite.com/api/health/ready`                                                             | `200` (baseline 200); `503` ⇒ ver §3.1                                                                  |
| G4  | **não é placeholder** | `curl -sSI --max-time 5 https://darkgray-pony-545965.hostingersite.com/ \| grep -iE '^(server\|x-powered-by):'`                                                                      | **ausência** de `x-powered-by: PHP/*` (F18)                                                             |
| G5  | título do app         | `curl -sS --max-time 5 https://darkgray-pony-545965.hostingersite.com/ \| grep -o '<title>[^<]*</title>'`                                                                            | contém `Preço que Dá Lucro — avalie preços sustentáveis para seu produto` (F17)                         |
| G6  | `http → https`        | `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' --max-time 5 http://darkgray-pony-545965.hostingersite.com/`                                                              | `301` para `https://…` (baseline 301)                                                                   |
| G7  | TLS                   | `echo \| openssl s_client -connect darkgray-pony-545965.hostingersite.com:443 -servername darkgray-pony-545965.hostingersite.com 2>/dev/null \| openssl x509 -noout -subject -dates` | válido e não expirado; o registro de 2026-09-29 anota `válido (07/12)` — confira `notAfter` na execução |

**G4/G5 são os gates que o baseline engana.** Um `GET / → 200` **não** prova rollback bem-sucedido:
com build FAIL o hPanel também devolve 200, com placeholder PHP (F18). Um detector de "health 200"
é falso-positivo por construção — por isso G4 e G5 existem.

**Ordem de leitura:** G4/G5 primeiro (prova que é o app), depois G1–G3 (prova que está saudável),
depois G6/G7 (prova que a borda não mudou). Repita G1–G3 **duas vezes** com ≥ 30 s entre as leituras.

## 7. Procedimento B — archive anterior (emergência)

Só quando A for inviável **e** houver autorização registrada. A plataforma aceita
`Source type = archive` (F20/F19): subir o archive do commit alvo e reimplantar.

| custo                                                                                             | por que é pior que A                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Muda o `Source type` do app (git → archive) — drift de plataforma fora do repositório             | O repositório deixa de descrever a produção (`AGENTS.md` §Deployment contract trata dashboard-side como drift) |
| O próximo push em `main` pode voltar a construir do git e **desfazer** o rollback silenciosamente | Rollback que se auto-reverte na próxima promoção                                                               |
| O archive não é versionado nem verificável por `git diff`                                         | Perde-se o gate A4, a única prova barata de identidade de árvore                                               |

Se B for usado: registre em `docs/evidence/` (§12), e trate o retorno ao git como passo obrigatório
do follow-up.

## 8. Banco de dados — por que o revert de código é compatível

Medido (F11–F15), não presumido:

- A produção está no schema **0011**; a release leva a **0019**.
- Das 8 migrations da release, **6 são `SAFE`** (aditivas, sem DML, sem lock relevante) e **2 são
  `ONLINE_WITH_CARE`** (`0013` e `0019`: `ALTER TABLE` com `ACCESS EXCLUSIVE` breve + varredura de
  `CHECK`). **Nenhuma é `BREAKING`; nenhuma é `DATA_MIGRATION`** (as duas `DATA_MIGRATION` do
  registry — `0004`, `0010` — já estão aplicadas e ficam fora da release).
- As colunas `NOT NULL` adicionadas têm **default** (`expenses.version`, `products.version` com
  `DEFAULT 0`; `ai_memories.layer` com `DEFAULT 'L2'`), **exceto** `ai_memories.dedup_key`, que é
  adicionada a uma tabela **criada pela própria release** (`0017`) e que **não existe** no schema de
  produção. O único `DROP` da release recompõe um `CHECK` **mais largo** (aceita `'expired'`).
- Logo: o código anterior à release **não conhece** os objetos novos e continua válido contra o
  schema novo — nenhuma coluna/tabela/constraint que ele consome foi removida, renomeada ou
  estreitada. **Um revert de código não exige reverter schema.**

**Corolário operacional:** o revert **não** desfaz migrations, e não deve tentar. Os downs existem
(`drizzle/rollback/0012_to_0011_down.sql` … `0019_to_0018_down.sql`) mas **down-migration pós-tráfego
não é o caminho sancionado** — a política manda snapshot restore (`migration-safety.md:89-90`,
`a4-a5-cutover.md:40`), e há precedente de down **bloqueado por desenho** com dados presentes
(`drizzle/rollback/0010_to_0009_down.sql`, `dia-d-2026-09-12.md:302`). Não execute down.

## 9. Ensaio do rollback — o que é testável e o que não é

### 9.1 Nesta sessão (declaração honesta)

| item                                                                                                                                                                         | estado                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Refas, SHAs, divergência, ausência de `v1.0.0`, índices de schema, classes das 8 migrations, SQL das migrations, semântica de `live`/`ready`, existência dos scripts citados | **verificado por leitura** (§1)                                                     |
| Execução do `git revert`                                                                                                                                                     | **NÃO executado** — é mutação de git, vedada nesta tarefa                           |
| `npm run build` / `npm run check:hostinger-runtime` / boot do artefato                                                                                                       | **NÃO executado** — geraria artefatos fora do arquivo único que esta tarefa escreve |
| `curl` contra produção, hPanel, deploy, PR, push                                                                                                                             | **NÃO executado** — vedado                                                          |
| Ensaio do procedimento ponta a ponta                                                                                                                                         | **NÃO executado** — exige um rollback real ou um ambiente de homologação            |

Portanto: **este runbook está medido, não testado.** Os fatos que ele usa foram lidos; o procedimento
nunca rodou. Quem for executá-lo é o **primeiro** a rodá-lo — trate A4 e §6 como as redes de
segurança, não como formalidade.

### 9.2 Ensaio mínimo executável (R-B) — sem produção, sem segredo, ~1 build

Prova o que F24 promete: o artefato do commit alvo **sobe** e responde. Não prova `ready=200`
(o smoke é deliberadamente degradado) e **não toca** Neon, Resend, OAuth ou IA.

```bash
# worktree descartável para não sujar a árvore de trabalho
git worktree add /tmp/rb-rehearsal <M^1>
cd /tmp/rb-rehearsal
npm ci
npm run build
npm run check:hostinger-runtime
# esperado (F24): PASS nas duas variantes de porta, "live=200 ready=503"
```

Aplicar o mesmo a `<M>` e comparar os dois PASS é o par mínimo de evidência de que ambos os artefatos
sobem. Limpe depois: `git worktree remove /tmp/rb-rehearsal`.

### 9.3 Ensaio de compatibilidade código-antigo × schema-novo (R-C) — o ensaio que responde a §8

É o ensaio que realmente testa a afirmação "revert de código é compatível com o schema da release".
Exige Docker e banco local; **nunca** um alvo remoto (o `env-guard` nega o endpoint de produção
incondicionalmente, e alvo remoto exige `ALLOW_REMOTE_DB` com motivo — `AGENTS.md` §Local database).

```bash
# 1) banco local PG17 (descartável) — postgres-local-docker.md
npm run db:up

# 2) no worktree da RELEASE: aplicar o schema novo (0019) no banco local
cd /tmp/rb-rehearsal-release          # <M>
#   DATABASE_URL/DATABASE_ADMIN_URL/DATABASE_DRIVER = loopback (postgres-local-docker.md:21-23)
#   rota A — npm run db:migrate: os NOMES das env de migration estão em
#            hostinger-cloud-node.md:180-185; confira o preflight de scripts/db/migrate.ts
#   rota B — npm run db:test: autocontido, "roda as migrations do zero" (postgres-local-docker.md:18-30)

# 3) conferir o DEFAULT que sustenta a compatibilidade (a asserção exata de §8)
#    products.version e expenses.version têm de ter column_default = 0
#    (via psql no container: information_schema.columns, is_nullable='NO')

# 4) no worktree do ALVO: subir o CÓDIGO ANTIGO contra o schema NOVO
cd /tmp/rb-rehearsal                  # <M^1>
npm ci && npm run build
DATABASE_DRIVER=node-postgres DATABASE_URL=<URL local> \
  BETTER_AUTH_URL=http://127.0.0.1:4173 AUTH_TRUSTED_ORIGINS=http://127.0.0.1:4173 \
  PORT=4173 npm run start
# em outro terminal:
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/api/health/live
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/api/health/ready
# esperado: 200 / 200 / 200  ⇒ código antigo + schema novo convivem

npm run db:down
```

**R-C verde** é a evidência de que um rollback por revert não precisa de rollback de banco. **R-C
vermelho** (ex.: `ready` nunca chega a 200, ou um write do código antigo viola uma constraint) vira
**bloqueio de release**, não um detalhe: significa que o ponto de não-retorno (§11) é mais cedo do
que este runbook assume — e a release não deve ser promovida sem um plano de snapshot antes.

**Limite de R-C:** um banco local vazio não reproduz volume, dados legados nem RLS com múltiplos
tenants. Ele prova compatibilidade **de schema**, não de dados — e prova `appliedOn: "empty"`, não
`live`.

## 10. Riscos conhecidos

| id   | risco                                                                                                                                                                                                                                                                    | mitigação                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-1  | **O rollback derruba a produção.** Sem `NPM_CONFIG_ENGINE_STRICT=false` o install falha (`EBADENGINE`, F21) e volta o placeholder (F18)                                                                                                                                  | §5 A7.1–A7.2: varrer NOMES antes de reimplantar; conferir o status do build antes de medir gates                                                                                                                                               |
| R-2  | **A `main` local está 59 commits atrás** e `9724d2c` não é ancestral dela (F8) — reverter a partir dela erra o alvo                                                                                                                                                      | §5 A1 (cortar de `origin/main`) e P1 (`fetch` primeiro)                                                                                                                                                                                        |
| R-3  | **`-m 1` em commit que não é merge** reverte a coisa errada                                                                                                                                                                                                              | §5 A2 verifica nº de pais; shape alternativo documentado                                                                                                                                                                                       |
| R-4  | **Merge `main → develop` depois do revert desfaz a release em `develop`.** `AGENTS.md:18` manda mesclar `main` de volta em `develop` sempre que `main` avança; o commit de revert é o único caso em que obedecer isso **absorve a reversão** na linha de desenvolvimento | **Suspender a regra por decisão explícita** e registrá-la no journal; reconciliar `develop` re-landando a release corrigida. Verificação: `git merge-base --is-ancestor <R> develop` — se o revert aparecer em `develop`, a absorção aconteceu |
| R-5  | **Re-landar sem reverter o revert** faz a release corrigida "sumir" (o revert continua valendo)                                                                                                                                                                          | Para re-landar: `git revert <R>` em `main` (revert do revert) **ou** corte uma promoção nova com o conteúdo corrigido; nunca reaproveite o PR antigo às cegas                                                                                  |
| R-6  | **Plataforma: 1 deployment por vez** e "salvar env vars dispara redeploy" (F20) — medir gates cedo mede o build anterior                                                                                                                                                 | §5 A7.5: aguardar "Concluído"; só um disparo por vez                                                                                                                                                                                           |
| R-7  | **Exposição de segredo na tela `settings`** (F22) — já aconteceu uma vez                                                                                                                                                                                                 | §5 A7.3: nunca snapshot; operar por DOM; contenção sem leitura se ocorrer                                                                                                                                                                      |
| R-8  | **Tag `v1.0.0` irreprodutível** se alguém a mover — quem reimplantar a tag recebe o build ruim                                                                                                                                                                           | §2: a tag não se move; release corrigida é `v1.0.1`                                                                                                                                                                                            |
| R-9  | **`0018` exige `ai_memories` vazia** (`ADD COLUMN … NOT NULL` sem default, F15). Se a feature de memória ganhar escritor em produção antes do deploy, **a migration falha**                                                                                              | Declarar antes do deploy; a feature de memória "não tem escritor em produção" é afirmação do registry (`0019`), **não** uma medição desta sessão                                                                                               |
| R-10 | **Rollback não reverte dado.** Linhas escritas pelo código novo permanecem (ex.: `products.version` incrementado; `status='expired'`)                                                                                                                                    | Nenhuma ação: o código antigo ignora as colunas/tabelas novas (§8). Não "limpe" dado como parte do rollback                                                                                                                                    |

## 11. Ponto de não-retorno

Para **esta** release, com os fatos de §1, o ponto de não-retorno **não é o deploy do código**:

1. Enquanto o registry não tiver `BREAKING` na release (hoje: **zero**, F13) e toda coluna `NOT NULL`
   adicionada tiver default ou pertencer a tabela criada na própria release (F14–F15), um revert de
   código é compatível com o schema novo (§8) — **o rollback continua barato**.
2. O primeiro passo irreversível é o **contract** (passo 6 de `migration-safety.md:40`), que remove/
   renomeia objeto consumido pela versão publicada. Nenhum aconteceu nesta release.
3. O ponto de não-retorno **passa a existir** quando uma destas condições for verdadeira, e nesse
   momento o rollback de código deixa de ser suficiente:
   - uma migration `BREAKING`/`DATA_MIGRATION` entra na linha da release;
   - o código novo escreve dado que o código antigo **não consegue ler** (não é o caso hoje);
   - `ai_memories` ganha escritor em produção antes do deploy (torna R-9 real: a migration falha, e
     o estado "schema parcialmente aplicado" exige decisão humana — não um revert);
   - houve escrita de tráfego real e a política de dado exige snapshot (`a4-a5-cutover.md:40`).
4. **Consequência operacional:** a decisão de reverter deve ser tomada **antes** de a janela de
   snapshot pré-deploy expirar. Se a release for promovida sem `npm run m02:backup-verify` verde
   (`a4-a5-cutover.md:7`) e snapshot externo/nativo registrado, o rollback de código ainda funciona
   (§8), mas o rollback de **dado** não tem rede — e BAK-01/PITR já estão declarados como dívida
   aberta (`a4-a5-cutover.md:40`, `dia-d-2026-09-12.md:300`).

## 12. Registro, comunicação e follow-up

1. **Antes** de qualquer mutação: registre a intenção (`▶`) no journal `docs/evidence/agent-state/PROGRESS.md`,
   com data/hora UTC, `M`, `M^1`, `R` e o trigger de §3 que autorizou.
2. **Depois**: registre o resultado (`✔`/`✘`) com os gates G1–G7 **medidos** (valores, não "verde").
3. **Ledger de evidência:** `docs/evidence/ciclo-XX-rollback-v1.0.0-<data>.md` com a tabela de gates,
   o trigger, os SHAs e o resultado do ensaio (§9) — declarando explicitamente o que **não** foi
   executado.
4. **Incidente:** se RT-5 esteve envolvido, trate como incidente de segurança e siga
   `secret-rotation-blind.md` (rotação ≠ rollback — §3.3).
5. **Dívidas para o MAESTRO** (o agente não edita `DEBTS.md`):
   - tag `v1.0.0` marcando release revertida (R-8) — decidir `v1.0.1`;
   - a tensão R-4 entre `AGENTS.md:18` e o revert (a regra do back-merge não distingue "conteúdo
     novo em `main`" de "reversão em `main`");
   - o watcher `app-live-watch` sonda `/ready /live`, mas as rotas reais são `/api/health/*`
     (`ciclo-15…md` §3.3) — ele **nunca** poderá ficar verde;
   - `ai_memories` como risco de deploy (R-9) enquanto `0018` não tiver default.
6. **Cota de CI:** a via A5-padrão paga um `verify` completo; a via A5-emergência paga um `verify` de
   push. Nenhuma das duas dispensa a cadeia local (`npm run check`) antes do push.

## 13. Referências cruzadas

| documento                                                  | o que este runbook toma dele                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `AGENTS.md:3-6,15,16,17,18`                                | veto de reescrita de histórico; branch de release; back-merge              |
| `docs/runbooks/hostinger-cloud-node.md:53-74,206-227`      | semântica de live/ready; smoke local; rollback app-level; nomes de env var |
| `docs/runbooks/a4-a5-cutover.md:38,40`                     | abort list (cross-tenant); snapshot × rollback de dado                     |
| `docs/runbooks/dia-d-2026-09-12.md:290-325`                | R1–R7 da janela de domínio; GAP-DOC do R3; down-migration bloqueado        |
| `docs/runbooks/cutover-A4.md:385-405`                      | §7 completo (rollback) e guarda de issuer                                  |
| `docs/runbooks/migration-safety.md:12-43,85-100`           | classes; expand/contract de 6 passos; contract = irreversível              |
| `docs/runbooks/postgres-local-docker.md`                   | PG17 local para o ensaio R-C                                               |
| `docs/runbooks/slo-error-budget.md` §1, §"5xx"             | limite do medidor de erro; `HTTP_5XX` por pathname                         |
| `docs/runbooks/secret-rotation-blind.md`                   | rotação quando o trigger é exposição de credencial                         |
| `docs/evidence/hpanel-docmap-2026-09-12.md:256-260`        | limites da plataforma; **não existe rollback por commit**                  |
| `docs/evidence/ciclo-15-rotacao-blind-2026-09-29.md` §3–§4 | deploy real, gates do alvo, EBADENGINE, incidente da tela `settings`       |
| `docs/evidence/agent-state/PROGRESS.md:248-255`            | armadilha do placeholder PHP com `GET / → 200`                             |
| `docs/adr/ADR-033-computer-user-observability.md:69-73`    | INV-006/INV-007/INV-008                                                    |
| `src/routes/api/health/{live,ready}.ts`                    | `live` sem banco; `ready` com `select 1` e 503                             |
| `src/lib/observability/visual-verification.ts`             | implementação das asserções visuais usadas em RT-3/RT-4                    |
| `scripts/check-hostinger-runtime.mjs`                      | primitiva executável do ensaio R-B                                         |
| `scripts/db/migration-classes.ts`                          | classes das migrations da release (F13)                                    |
