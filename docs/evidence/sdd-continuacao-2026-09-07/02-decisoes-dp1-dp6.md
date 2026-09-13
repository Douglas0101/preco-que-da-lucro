# 02 — Decision-points DP1–DP6 (SDD-CONTINUAÇÃO, 2026-09-07)

## DP1 — Nome do arquivo prod do split: DECIDIDO

**`.env.sanctioned-remote`** (nunca `.env.production`/`.env.prod` — o Vite
auto-carrega `.env.[mode]`). Cobertura `.gitignore:12` (`.env.*`)
verificada — item de verificação, zero edições. Loader:
`node --env-file=.env.sanctioned-remote <script>` (sem `-if-exists`,
fail-closed). Selagem normativa: Emenda #5 (B-00; draft em
`03-emenda-05-split-draft.md`, ★ sela no commit).

## DP2 — Veredito PITR: DECIDIDO (default)

**Compensatório como default** (dump verificado + restore efêmero; PITR 6h
como camada adicional) + **cláusula de tráfego no ledger**: BAK-01 reabre
automaticamente no carimbo `Tráfego: EXISTE` salvo PITR≥7d ativo (dump
lógico não satisfaz RPO≤15min com writes). Se C-00 provar upgrade
impossível no plano: declarar "compensatório = única via". Se perna nativa
cair (404/400): veredito degrada p/ 2 pernas + assinatura humana no memo
G1. Veredito duplo em `dr-verdict-<data>.md` (C-03).

## DP3 — Rota D (greenfield vs V2b): ABERTO (dono: G1/D2)

- (a) greenfield: baseline = Neon atual, SUNSET 20/09;
- (b) V2b com credencial: BLOCKER-EXT-02 + freeze + `different=0`.
  Sem DP3 até 10/09 → NO-GO de dados no freeze (declarar, não improvisar).

## DP4 — Assinatura G1: ABERTO

Memo em RASCUNHO (`docs/specs/M-02/decisions/M02-D-008-G1-memo.md`). Sem
ela, D e freeze = DESCONHECIDOS. Sunset 20/09.

## DP5 — Predicados finos: ABERTO (insumo: C-01 `contract-note`)

Definir: predicado DIRECT canônico (sufixo `-pooler`? lista de hosts?),
formato `<data>`/idade máxima/quantidade dos dumps, glob oficial do gate.
Trava E/C fina — decidir antes de C-02 em caso de divergência
gate-caminho-drill.

## DP6 — Hotfix durante freeze: MARCADOR DEFINIDO (texto exato)

M02-D-009 exige: aprovação explícita do owner (go/no-go no ledger), escopo
mínimo, reinício (A5 do 0h; B3 reconta). Em A-08, a linha freeze leva
`owner: <nome> (go/no-go)`; em hotfix, anexar:
`hotfix: <ref-commit> — escopo: <mínimo> — janela reiniciada em <DATA>`.
