# PS-S1 — Selo S1: produtor/consumidor DP5=(b) (2026-09-07, RAT S0)

Escopo: RAT S0 (DP5=(b) + Emenda #6) + Emenda #6 draft §3 (escrita) e §4
(validação). Sem commit (selo em working tree; human commita via Manifest).

## Arquivos (nomes; sem valores)

- `scripts/m02-snapshot.mjs` — modo explícito (`--out-dir` dado): trio
  `dump.pgc`+`dump.pgc.sha256`+`metadata.json` (N-6); trio pré-existente =
  exit 2 pré-conexão; motivo + anti-pooler nos dois modos (exit 3);
  sucesso só pós-hash; modo default INALTERADO (nomes + seq).
- `scripts/m02-snapshot.d.mts` — `outDirExplicit`, `TRIO_FILENAMES`,
  `TrioMetadataInput`, `trioPreexists`, `buildTrioMetadata`.
- `scripts/m02-readiness.mjs` — `checkSnapshot` reescrito sobre
  `evaluateSnapshotDir`/`checkSnapshotFromRoot` (exportados): glob literal
  preservado; frescor por `created_at` (`0<=idade<24h`); `mtime` removido
  do caminho (import `statSync` excluído); futuro/divergente/incompleto =
  nunca PASS; sem dump = DESCONHECIDO; `main()` sob guarda de execução
  (import em teste não dispara gates).
- `scripts/m02-readiness.d.mts` (novo) — tipos do consumidor.
- `src/test/m02-snapshot.test.ts` — 5 grupos do produtor (default; trio+
  fail-closed; metadata pura; pooler×2 modos; motivo×2 modos), com prova
  de zero socket (`stdout` sem `"event":"start"` nas recusas).
- `src/test/m02-readiness-snapshot.test.ts` (novo) — 11 casos N-5/N-6
  (válido; mtime-only; ≥24h; futuro; dump/sidecar divergentes; producer/
  source; kind; read_only; motivo; ausente/incompleta; vazio;
  seleção por maior `created_at`), tmpdir + relógio fixo, sem rede/banco.
- Docs do escopo: Emenda #6 datada (`## 11.`, RAT S0 2026-09-07),
  runbook §2.3(a) em seis passos, retificação da fundação OP-C (iii-a).

## Resultados

- S1 focados: **21/21 verde** (`m02-snapshot` 10 + `m02-readiness-snapshot` 11).
- Suíte completa: **412/412 em 43 arquivos verde** (defaults intactos;
  nenhum comportamento default mudou).
- `m02:env-guard-selftest`: **13/13 verde** (count inalterado; S1 não toca o guard).
- Zero-socket: recusas pré-conexão (exit 3 motivo/pooler ×2 modos; exit 2
  trio pré-existente) nunca emitem `event:start`; nenhum spawn de banco
  ocorre antes desses pontos (ordenação no código).

## Veredito

PS-S1 **EMITIDO**: S1 implementado + testado + documentado. Libera C-02.
Selagem `m02:sums` (regen+verify) registrada no relatório de saída.
