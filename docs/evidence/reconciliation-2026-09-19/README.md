# Artefatos de reconciliação — 2026-09-19 (Stream B)

> **Nada nesta pasta foi executado.** São três runbooks/briefings autocontidos, produzidos por uma
> sessão **sandboxed** (`bwrap --ro-bind / / --tmpfs /tmp --unshare-pid`) e destinados a um processo
> **host-visible** ou ao humano. A restrição epistêmica está declarada em cada arquivo.

| #      | artefato                                                   | o que resolve                                                                                                           | executável deste sandbox?    |
| ------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **B1** | [B1-ciclo-6-reconciliacao.md](B1-ciclo-6-reconciliacao.md) | estado real do **ciclo 6 do enxame** (4 worktrees `/tmp/wt-n7*`, 0 commits, 0 claims) — hoje `UNAUDITABLE-FROM-SANDBOX` | ❌ não (lê `/tmp` e PIDs)    |
| **B2** | [B2-watcher-rearm.md](B2-watcher-rearm.md)                 | **re-arme do `app-live-watch`** antes de ≈ 2026-09-21T03:37:56Z (único detector automatizado do H-6)                    | ❌ não (processo em `$HOME`) |
| **B3** | [B3-listener-4173.md](B3-listener-4173.md)                 | **dono do listener `127.0.0.1:4173`** (preview obsoleto com CSP **enforçada** — armadilha C-1 do ciclo 3)               | ⚠️ medido; matar **não**     |

## Fatos que não dependem de host (verificados nesta sessão)

- `develop` = `origin/develop` = `de8c232` · CI heavy verde (run `35305314936`) · `origin/main` = `9724d2c` (**263 commits atrás**).
- `mission/n7{a,b,c,d}-*`: **0 commits** à frente de `de8c232`; **sem** `CLAIMS-INBOX/N7-*`.
- `app-live-watch` **vivo**: log anexado em `2026-09-19T12:51:17Z` (`i=7530`, `/ready http=404`); marcadores `app-live.txt`/`H2-ready.txt` **ausentes**.
- Alvo canônico em **placeholder PHP**: `GET /` ⇒ 200 "Página padrão" (`x-powered-by: PHP/8.3.33`), `/ready` e `/live` ⇒ **404**.

## Ordem recomendada de execução (host-visible)

1. **B2** primeiro (prazo curto — caduca em ~1,6 dia); é o mais barato e o que evita cegueira.
2. **B3** em seguida (higiene; evita medição falsa de CSP).
3. **B1** por último (exige decisão sobre eventual trabalho não commitado; nunca reexecutar às cegas).

Cada execução deve ser registrada no journal `docs/evidence/agent-state/PROGRESS.md` (§2 append-only e,
para B2/B3, também §4/§6).
