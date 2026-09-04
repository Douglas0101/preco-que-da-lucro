# Delta-scan Standard — fix `csf_58b444f152e35ba899b5381e` no tip publicado `12c90a1`

**Scan ID:** `cb6038a1-c397-4042-a68d-ae6427e95802`
**Scan base referenciado:** `2ca2b19a-3ab2-49a1-a436-0a9ab46b3fcd` (Standard local selado
em `e61c8c8` pelo producer `codex-security-plugin` 0.1.22; artefatos em
`docs/evidence/security-scan/csf-58b444f-2026-08-27/`)
**Data:** 2026-08-27 · **Tarefa:** M01-4 (Mandato v5, M-01)
**Producer deste delta-scan:** `pi-program-v5.standard-delta-scan` 1.0 — revisão
semântica delimitada pela linha principal; este documento NÃO é output do plugin
codex-security e não o substitui; consolida o fechamento da história do finding no
tip publicado.

## Alvo

| Campo | Valor |
| --- | --- |
| SHA escaneado (base) | `e61c8c80ed7477828e0f44fd6a0c4f799ae9aa48` |
| SHA publicado verificado | `12c90a17f81edd5a126c2e32c3f703c8b7841f87` (tip de `origin/develop`, merge PR #21) |

## Delta verificado entre o scan base e o tip publicado

`git diff --name-only e61c8c8 12c90a1` → exatamente **7 arquivos, 100% documentais**:

1. `EXECUTION-STATE.md`
2. `docs/evidence/csf-58b444f-final-2026-08-27.md`
3. `docs/evidence/security-scan/csf-58b444f-2026-08-27/coverage.json`
4. `docs/evidence/security-scan/csf-58b444f-2026-08-27/findings.json`
5. `docs/evidence/security-scan/csf-58b444f-2026-08-27/report.md`
6. `docs/evidence/security-scan/csf-58b444f-2026-08-27/results.sarif`
7. `docs/evidence/security-scan/csf-58b444f-2026-08-27/scan-manifest.json`

**Zero delta em código executável, schema, migrações, testes ou configuração.** O
conteúdo da árvore escaneada é idêntico ao da árvore publicada; o scan selado da base
aplica-se integralmente ao tip publicado.

## Fix presente no tip publicado (evidência file:line)

- `src/lib/ai/budget-ledger.server.ts:23` — `MIN_SAFE_RESERVATION_TTL_MS = 120_000`
- `src/lib/ai/budget-ledger.server.ts:196-198` — guard de TTL do reservation
- `src/lib/ai/budget-ledger.server.ts:326` — `createBudgetLedger`
  (reserveAtomic/settle/sweep)
- `src/lib/chat-execution.server.ts:311-313` — `reserveAtomic` antes do
  `modelCaller` (reserva precede o contato com o gateway; settle em `finally`)

## Evidência executável no SHA publicado

- UI stack run `33037007387` — **success** em `12c90a1` (2026-08-27T03:39:16Z):
  build, suíte e E2E/browser verdes no SHA exato do tip publicado.
- Evidência v3 no `a4e6fb1` (antecessor do tip, mesmo conteúdo de código): UI
  `33034852220`, Neon boundary `33034852213`, Sonar `98395300602` — todos success.

## Veredito

**`csf_58b444f152e35ba899b5381e` (CWE-770) RESOLVIDO no tip publicado `12c90a1`.**
Nenhum finding novo nas superfícies delimitadas (`findings.json` vazio).

## Cobertura — registrada sem mascarar

- Cobertura **parcial**: 7 superfícies com recibo (6 do scan base re-registradas +
  verificação de delta) de um inventário de 240 arquivos. O restante permanece
  `needs_follow_up` e é roteado para a estratégia incremental de scan do **M-07**.
- Exclusões explícitas mantidas (Neon/produção por H-003; billing/tráfego real;
  `src/routes/auth.tsx`; TAC; portabilidade D1/Workers por REQ-012).
- Residual `callModelForTests` (seam test-only) permanece listado como item de
  revisão humana (M-07/Q aberta registrada no ledger).
- Este resultado NÃO afirma ausência de outras vulnerabilidades fora do escopo
  delimitado.
