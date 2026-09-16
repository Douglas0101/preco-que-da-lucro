# SUPERVISION-LOG — NAS-2 (append-only)

Formato de cada entrada (`LOG-ENTRY`): `timestamp · tier · decisão · racional · itens afetados · caminho de reversão`.

---

## 2026-09-16T12:0xZ · Tier A · adoção da NAS-2 e abertura do ciclo 1

- **Decisão:** adotar a máquina de estados **S0–S9** com a regra **E1/E2** (evidência de worktree = provisória; de HEAD integrado = autoritativa; ledger **só** com E2), contratos canônicos de handoff, WIP limit 1 por squad e escopo de arquivo exclusivo por WP.
- **Racional:** a rodada anterior só descobriu drift de matriz, contador de journal congelado e colisão de escopo do gate §35 **no HEAD integrado** — invisíveis nos worktrees. E1/E2 codifica essa lição como regra estrutural.
- **Itens afetados:** todos; `QUEUE.md` reescrito com os estados S0–S9.
- **Reversão:** 1 commit (o `QUEUE.md` anterior fica no histórico); nenhuma decisão de código.

## 2026-09-16T12:0xZ · Tier A · ciclo 1 despachado

- **Decisão:** despachar **WP-0** (bloqueante — matriz de transições 187×2), **WP-1a** (ledger de backfill + CAS), **WP-1b** (`summarize.mjs` emitindo o bloco §35) e **MEM-D0** (gap report §43), com escopos de arquivo disjuntos.
- **Racional:** WP-0 precede qualquer claim nova (integridade da régua); os demais são as trilhas desbloqueadas de maior destravamento/custo.
- **Itens afetados:** `QUEUE.md` (S0→S2 dos WPs), `SPEC-CARDS/` (cards semente herdados da NAS-2 §10).
- **Reversão:** cancelar dispatches e re-planejar (nada escrito em código neste passo).

## 2026-09-16T12:0xZ · Tier C · 4 briefes emitidos (H-10 · H-11 · H-9 · H-6)

- **Decisão:** emitir `DECISIONS-PENDING/{H-10,H-11,H-9,H-6}.md` no formato canônico + `REGISTRO-H.md`, com prioridade recomendada **H-10 → H-6 → H-9 → H-11**.
- **Racional:** regra anti-ócio — o enxame não espera; mas cada Tier C pendente é crédito que existe e não pode ser validado (CI) ou destravado (Neon live/tráfego).
- **Itens afetados:** `GATE-41`, `12.5`, `20.1`, `13.7`, baterias 3.1–3.3.
- **Reversão:** os briefes são arquivos; retirar do registro é 1 commit. Nenhuma ação externa foi tomada.
