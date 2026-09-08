# Round-state — SDD-CONTINUAÇÃO materialização (2026-09-07, build mode)

Raiz: `/home/douglas-souza/preco-que-d-main`; branch `develop`;
HEAD inalterado `8d26a2c` (zero commits pelo agente; zero staging).
Produção: somente leitura (Neon CLI `branches list` + `snapshots list`;
nenhum dump, migrate, create ou snapshot-create executado).

## 1. Fundação (★ thread principal, 4 docs novos neste dir)

- `00-namespace-e-rastreabilidade.md` — W1 (OP-H/OP-C, sem colisão PM-F),
  matriz §42 × trilhas (10 itens), W2 (fidelidade §26: E2E+schema-diff =
  corte deliberado + follow-up), W3 (§29 pré-RUM), W4 (H2/H6 resolvidos),
  adendos §24/§25/§45/INV-011/§19.4, ponteiro W6→D-00.
- `01-op-c-01-reescrito.md` — C1/opção-(a): branch-audit +
  neon-guardrails.md removidos como gates (grep vazio em 4 superfícies);
  console-check manual com conteúdo §12.6 + evidência
  `console-check-<data>.md`.
- `02-decisoes-dp1-dp6.md` — DP1+DP2 decididos; DP3/DP4 abertos; DP5
  especificado; marcador DP6 com texto exato.
- `03-emenda-05-split-draft.md` — DRAFT §11 p/ selagem humana (B-00).
  `.gitignore:12` já cobre o nome (verificação, zero edições).

## 2. Agentes paralelos (3/3 concluídos, ≤ escopo, sem prod/commit)

- **A-01:** `m02-sums.mjs` CONFORME 6/6; wiring `"m02:sums"` inserido no
  `package.json` (1 linha, JSON validado); auditoria em
  `docs/evidence/pendentes-2026-09-07/sums-contract-audit.md`.
- **B-01:** loaders 6/6 conformes (zero dotenv; 1 `--mode`; Node 24.15;
  drizzle lê `process.env`; 10/10 hooks sem `--env-file` no main;
  `prem02:snapshot` carrega `.env`); sem loader oculto →
  `loaders-map-2026-09-07.md` (neste dir).
- **C-01:** DIVERGENTE com stop acionado — D1: `backup-verify` NÃO gera
  `dump.pgc` (só compara); D2: nenhum script sancionado escreve no glob
  do gate por default → `contract-note-2026-09-07.md` (neste dir).
  **C-02 BLOQUEADO até decisão DP5** (opções: (a) pg_dump padrão V4 no
  T-0; (b) `m02:snapshot --out-dir` + renomear p/ `dump.pgc`;
  (c) mudar glob do gate = PROIBIDO).

## 3. A-02 selagem (★): STOP-TRIGGER FECHADO

`npm run m02:sums` → PASS (exit 0); `--verify` → PASS; `sha256sum -c` da
raiz (locale PT: SUCESSO/FALHOU): checagens 4/4, cutover **19/19**,
prep 25/25, fase0 28/28, pendentes 9/9, gsec 18 + 2 FALHOU rotulados
(único rótulo permitido, até V0). `m02:matrix:check` sem drift (sem
regen, regra respeitada).

## 4. Recon read-only Neon (★, C-00/E-00 parcial)

- `neon 3.6.0` via `~/.config/neon/credentials.json` (`NEON_API_KEY`
  env UNSET — nada a vazar; só NOMES acima).
- Branches: production `br-snowy-violet-aymcvvvv` ready + develop
  archived; zero efêmera.
- **`neon snapshots list` FUNCIONA no plano**: 1 snapshot,
  id `snap-tiny-smoke-ayc382ji` (nome `pre-a4-prepurge-20260905`),
  criado 2026-09-05T22:37:46Z, expira 2026-10-10T23:59:59Z — nativo
  re-verificado live; `snapshot-create` dia-D é viável (op ★, nunca
  agente). Custo/caminho upgrade PITR ≥7d segue pendente (console).
- D: sem `SUPABASE_MIGRATION_DATABASE_URL` (reconfirmado ausente) —
  nada a executar; E-02/D-02 sem artefatos novos p/ validar.

## 5. Pendências (fila humana/★)

P0 selar Emenda #5 (B-00) → A-03…A-10 commits → B-02 rewiring → DP5 →
C-02/C-03 → E-01 dia-D → D-01 (se D2 até 10/09) → OP-H → OP-C.
Fora desta rodada (futuro/datado): B-04, E-02, D-02/D-03, F2/F3.
