# EXECUÇÃO ONDA 1 — painel de supervisão (2026-09-13)

**Plano:** `docs/evidence/plan-partials-2026-09-13/PLANO.md` (Onda 1 — dados/arquitetura; `part-1-arquitetura.md`).
**Método:** enxame com até 3 operadores (WIP), worktree/branch por operador, schema lane serializada (migrations 0012/0013),
manifests exclusivos do supervisor (package.json, matrix, journal/ledger), verificador adversarial por integração,
token DB e marcador parent-pinned por commit. Sem push.

## 1. Integrações

| Int. | Item                                                     | Operador(es) | Commits                         | Merge em develop    | V                     | Gates                                              |
| ---- | -------------------------------------------------------- | ------------ | ------------------------------- | ------------------- | --------------------- | -------------------------------------------------- |
| I7   | 9.2 DashboardRepository + 9.1 PricingService             | O7           | `b92fd14` (+`e892be3`)          | `b774579`/`e892be3` | V7 PRONTO             | 10 testes, matrix/boundaries, prettier             |
| I8   | 9.1 AuditService/Repository                              | O8           | `7206ce8`                       | `e253b35`           | V8 PRONTO             | 23 testes, tool-security em DB                     |
| I9   | 9.1 ConversationService/Repository                       | O9           | `8c2664a`                       | `635f7d3`           | V9 PRONTO             | 27 testes, chat-semantics em DB, exceção removida  |
| I12  | Contracts Event (M-04) e Memory (M-05)                   | O12          | `902bd7d`                       | `948f163`           | V12 PRONTO            | 8 testes de contrato, typecheck                    |
| I10  | 14.3 ToolExecution + ai-tool (§9.2) — migration 0012     | O10 + O10b   | `b91065d`, `74b0fc8`            | `32154b7`           | V10 BLOQUEADO → fixes | 37 testes, test-migrations/tool-security           |
| I10d | Fix build do chat (import-protection)                    | O10d         | `2ea4d07`                       | `0fb728d`           | V10b PRONTO           | build exit 0, chat-semantics                       |
| I10c | Fix lone surrogates no sanitizador                       | O10c         | `4354a00`                       | `ceeff6b`           | V10b PRONTO           | 27 testes, regressão DB                            |
| I11  | T2 version otimista + BFF create/update — migration 0013 | O11          | `b110167`, `3c4799c`, `6825e5a` | `e8a73ef`           | V11 PRONTO            | check 495 testes, db:test 9 suítes, classify 14/14 |

**Gates finais no HEAD:** `npm run check` **exit 0** (58 arquivos / 495 testes, build, format, bundle) e
`npm run db:test` **exit 0** (9 suítes, incluindo `test-concurrency`); `m02:matrix:check`/`m02:boundaries`/`m02:state:check` verdes.

## 2. Resultado

- **4 PARTIALs fechados**: 9.2 (interfaces + DI), 14.3 (ToolExecution), T2 (§21), BFF-002/003 (create/update split)
  → crédito **~79,1% → ~80,2%**.
- **9.1** avança para 8/10 serviços dedicados (Pricing, Conversation, Audit incorporados); Memory/Event seguem
  contratos PLANNED (gated M-05/M-04) — item permanece PARTIAL com residual declarado, sem dívida oculta.
- Migrations **0012** (`tool_executions`) e **0013** (`version`) aplicadas com rollback, registry 14/14 e contagens atualizadas.
- Decisões novas: **ADR-029** (T2 version otimista) e **M02-D-010** (create/update split); **M04-D-012** (vínculo N:1 via `usage_id`).
- Contratos Event/Memory reais em `src/server/contracts/` (type-only) — paths da matrix deixam de ser mortos.

## 3. Achados dos verificadores (todos endereçados ou registrados)

1. **V10 bloqueou** com 2 achados reais, corrigidos por operadores dirigidos e re-verificados (V10b PRONTO):
   `format:check` vermelho nos artefatos drizzle (corrigido no I11) e lone surrogates no sanitizador (I10c, com regressão DB).
2. **Build do cliente** estava quebrado desde o I9 (`getConversationForTests` mantinha `conversationService` no grafo
   client → import-protection); O10d moveu o helper para `chat-execution.server.ts` (I10d, build exit 0).
3. **V11 (notas não bloqueantes):** teste de contrato BFF tem parte frágil (regex sobre fonte); redação do ADR-029:43
   corrigida neste fechamento; `archiveProduct` não incrementa `version` (comportamento pré-existente, nota T3).
4. **Higiene do DB local:** os harnesses de e2e/perf semeiam usuários `example.test` e o down da 0010 é fail-closed —
   `db:test` local exige recriar o banco descartável a cada rodada (registrado; candidato a runbook).
5. **V8:** a suíte `test-tool-security` exige banco recém-criado (contagens fixas) — não é regressão do I8.

## 4. Próximos passos

1. **Onda 2 — observabilidade** (16.7, 19.2, 19.3, 19.5, 17.8, §29, §30), com decisão aberta sobre RUM persistido (tabela 0014) vs log-only.
2. **Onda 3 — segurança/UX** (18.1, 18.3, 18.5, 20.5, 20.1) e **Onda 4 — Neon/Auth** (§12.4–§12.6, §13.6–§13.7, AUTH-005 D humano).
3. Fila humana inalterada: **H-4** (PITR) e **H-6** (tráfego) continuam os únicos bloqueios operacionais do dia-D.
