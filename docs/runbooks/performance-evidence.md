# Runbook — evidência de performance (§35)

## Quando é exigida

Um PR (ou commit) que **afirma** ganho ou conserto de performance — título, corpo,
mensagem de commit, ledger ou comentário — precisa de um artefato em
`docs/evidence/` com os 7 rótulos de §35. Exemplos que disparam a exigência:

- "reduz o p50 de X em Y%", "corta RTs", "corrige N+1", "melhora o LCP";
- mudança de índice/query/read-model declarada como ganho;
- qualquer número before/after citado para justificar `keep`.

Refatoração sem alegação de performance não exige o artefato — mas se um número
for citado no PR, a evidência passa a ser exigida.

## Como preencher

1. Copie `docs/evidence/_templates/performance-evidence.md` para
   `docs/evidence/<tema>-<data>.md`; use o nome `perf-*.md`/`*-perf-*.md` (é o
   padrão que o gate varre).
2. Preencha o cabeçalho: **ambiente** (`dev-evidence` ou `CONTROLLED`, nunca
   misturados), **método**, **n**, **janela** (UTC) e **fonte**.
3. Preencha os 7 rótulos: `hypothesis`, `metric`, `before`, `change`, `after`,
   `result`, `decision` (`keep`/`revert`/`follow-up`). Cada rótulo é um campo
   `**rótulo:**` no início de uma linha.
4. Versione o raw que sustenta os números (`.jsonl`/`.json`/`.txt` em
   `docs/evidence/<tema>-<data>/`). `/tmp`, `artifacts/`, `logs/` e `raw/` são
   gitignored e não servem como fonte.
5. Rode `npx vitest run src/test/perf-evidence.test.ts` (ou `npm run test`).

## Gate

- `src/test/perf-evidence.test.ts` varre `docs/evidence/**` por arquivos
  `perf-*.md`/`*-perf-*.md`, ignora `_templates/**` e exige os 7 rótulos nos
  artefatos novos. Em falha, a mensagem aponta o arquivo e o(s) rótulo(s)
  ausente(s).
- Allowlist de legado (publicado antes do gate; não reescrever):
  `perf-baseline-2026-08-29.md`, `perf-after-2026-08-29.md`,
  `explain-critical-queries-2026-08-21.md`.
- O gate roda no `npm run test` e no CI pesado (`ui-stack`); um artefato novo
  fora do padrão deixa a árvore vermelha.

## Rótulos de ambiente

- `dev-evidence`: log/sessão de dev, single-user, sem build de produção — os
  números **não** extrapolam para produção e não sustentam SLO.
- `CONTROLLED`: harness local/mockado (ex.: M-06), repetível e com seed
  determinístico.
- `OBSERVED`: tráfego real autorizado (H-6); nunca misturar com `CONTROLLED`.

Referência de spec: `docs/specs/M-06/definition-of-done.md` (§1).
