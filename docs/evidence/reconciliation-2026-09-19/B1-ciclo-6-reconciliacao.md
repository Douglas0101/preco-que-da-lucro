# B1 · RUNBOOK DE RECONCILIAÇÃO DO CICLO 6 DO ENXAME NAS-2

**Artefato de preparação — 2026-09-19.** Escrito pelo MAESTRO a partir de uma sessão **sandboxed**.
**NÃO foi executado.** Requer um processo **HOST-VISIBLE** (fora do `bwrap`).

> **⚠ RESTRIÇÃO EPISTÊMICA — leia antes de agir.** A sessão que produziu este runbook rodou sob
> `bwrap --ro-bind / / --tmpfs /tmp --unshare-pid`. Consequências medidas:
>
> - **`/tmp` é um tmpfs VAZIO** para aquela sessão (`ls -A /tmp` ⇒ **0 entradas**). Ausência de
>   `/tmp/wt-n7*` ali **não é evidência de exclusão** — o próprio backup do incidente L63
>   (`/tmp/main-repo-incident-20260918/`) também aparecia "ausente".
> - **PID namespace isolado**: não se enxergava processo algum do host, nem o dono de listeners.
> - `git worktree list` marca os quatro worktrees como `prunable` **por causa do tmpfs vazio** —
>   esse veredito é artefato do sandbox, não fato.
>
> **Regra-mãe: nunca concluir a partir de ausência-de-evidência em ambiente sem visibilidade.**

## 1. O que se sabe (fato verificado, não inferido)

| #   | Fato                                                                                                                         | Fonte                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `develop` = `origin/develop` = `de8c232`; CI heavy verde (run `35305314936`)                                                 | `gh run list`, `git ls-remote`                                                           |
| 2   | Os 4 branches `mission/n7{a,b,c,d}-*` existem e têm **0 commits à frente** de `de8c232`                                      | `git rev-list --count de8c232..<branch>` = 0 (fato de objeto git, não depende de `/tmp`) |
| 3   | **Não existe** `CLAIMS-INBOX/N7-{A,B,C,D}/` (nenhuma claim foi gravada)                                                      | `ls docs/evidence/agent-state/CLAIMS-INBOX/`                                             |
| 4   | O boot L66 (2026-09-18T05:37Z) **registrou** que os worktrees existiam "na base, limpos, 0 commits"                          | `PROGRESS.md` L66                                                                        |
| 5   | O L67 (05:49Z) re-despachou os trilhos; **não há linha no journal depois disso**                                             | `PROGRESS.md` L67 (última linha)                                                         |
| 6   | O watcher `app-live-watch` segue vivo (log anexado em 2026-09-19T12:51:17Z, `i=7530`) ⇒ **há processos do host em execução** | `~/.local/share/pi-fronts/app-live-watch.log`                                            |
| 7   | **Estado do ciclo 6 hoje: `UNAUDITABLE-FROM-SANDBOX`** — pode haver trabalho **não commitado** nos worktrees                 | consequência de 1–6                                                                      |

## 2. Passos (executar em ordem, sem pular)

### Passo 1 — existência e estado de cada worktree

```bash
for t in a b c d; do
  echo "=== wt-n7$t ==="
  ls -la "/tmp/wt-n7$t" 2>&1 | head -20
done
```

Para cada worktree que existir:

```bash
for t in a b c d; do
  d="/tmp/wt-n7$t"
  [ -d "$d" ] || { echo "$d AUSENTE"; continue; }
  echo "=== $d ==="
  git -C "$d" status --porcelain
  git -C "$d" log --oneline -5
done
```

> Interpretação: `status --porcelain` **vazio** ⇒ worktree limpo (nada a salvar).
> **Não-vazio** ⇒ há trabalho não commitado ⇒ **ir ao Passo 2 antes de qualquer decisão**.
> Se o diretório não existir **e** `git worktree list` o listar, o worktree foi removido fora do git:
> registrar como _"worktree removido externamente, 0 commits, sem claims — nada perdido de rastreável"_.

### Passo 2 — preservar trabalho não commitado (obrigatório antes de decidir)

```bash
d=/tmp/wt-n7X            # o worktree com status não-vazio
git -C "$d" diff > "/tmp/n7X-uncommitted-$(date -u +%Y%m%dT%H%M%SZ).patch"
git -C "$d" status --porcelain > "/tmp/n7X-status-$(date -u +%Y%m%dT%H%M%SZ).txt"
git -C "$d" stash push -u -m "n7X-reconciliation-$(date -u +%Y%m%dT%H%M%SZ)"
```

> **Nunca** descartar (`checkout -- .`, `clean -fd`) antes de ter o patch e o stash. A decisão
> salvar-vs-descartar é do humano/MAESTRO **depois** de ver o diff, nunca do operador no calor do passo.

### Passo 3 — mapear processos vivos e o dono do listener 4173

```bash
ps -eo pid,ppid,etime,cmd --sort=start_time | grep -Ei 'watch\.sh|nitro|node .*index\.mjs|vite|playwright' | grep -v grep

# dono do listener 4173
ss -ltnp 'sport = :4173' 2>/dev/null || lsof -nP -iTCP:4173 -sTCP:LISTEN
# para cada PID encontrado:
for p in <PIDs>; do
  echo "PID $p cwd=$(readlink -f /proc/$p/cwd)"
  tr '\0' '\n' < /proc/$p/environ | grep -E '^(DATABASE_URL|DATABASE_URL_UNPOOLED|CSP_ENFORCE|NODE_ENV|VERCEL)=' | sed 's/=.*/=<valor-omitido>/'
done
```

> Ver `B3-listener-4173.md` para o que fazer com o dono do 4173. **Não** matar nada neste passo.

### Passo 4 — classificar cada trilho

| classe                     | critério                                                              | ação                                                                     |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **SEM TRABALHO**           | worktree limpo (`status --porcelain` vazio) **e** 0 commits no branch | nada a salvar; registrar                                                 |
| **NÃO COMMITADO**          | `status --porcelain` não-vazio                                        | patch + stash do Passo 2 ⇒ decidir com o diff à vista                    |
| **COMMITADO-NÃO-MERGEADO** | `git rev-list --count de8c232..mission/n7X` > 0                       | avaliar merge/E2 pelo protocolo normal (claim → adversarial → E2 → land) |
| **AUSENTE**                | diretório inexistente e `git worktree prune -n` acusa                 | registrar como removido externamente                                     |

### Passo 5 — gravar o desfecho no journal (só então)

Escrever em `docs/evidence/agent-state/PROGRESS.md` §2 (**append-only**, par `▶`/`✔`):

```
| L69 | HH:MM:SS | ✔ | **CICLO 6 = RECONCILIADO via <processo host-visible> em <data>.** <classe de cada trilho A/B/C/D>,
  trabalho não commitado encontrado: <sim/não> (patch em <caminho>), listener 4173: <dono / ausente>,
  decisão: <salvar|descartar|mergear>. Substitui o estado provisório `UNAUDITABLE-FROM-SANDBOX`. |
```

E atualizar `QUEUE.md` §Ciclo 6 com o estado real de cada trilho.

> **Nunca reexecutar os trilhos às cegas.** Se os quatro estiverem SEM TRABALHO, a perda máxima é o
> último marco (`de8c232`) e o re-despacho é decisão explícita do MAESTRO — não consequência automática
> da limpeza.

## 3. Critérios de parada / escalação

- Se o Passo 1 exigir **decidir** algo que só o humano pode decidir (descartar trabalho não commitado
  com valor aparente) ⇒ **parar e escalar**.
- Se `ps`/`ss` não estiverem disponíveis ⇒ registrar a limitação e **não** inferir ausência de processos.
- Se aparecer **credencial de produção** em `/proc/<pid>/environ` ⇒ parar, registrar o PID e não ecoar valores.

## 4. O que este runbook deliberadamente NÃO faz

- Não lê `/tmp` a partir do sandbox (não é evidência).
- Não mata processos, não faz merge, não faz push, não toca em produção.
- Não afirma o estado do ciclo 6 — apenas o mede.
