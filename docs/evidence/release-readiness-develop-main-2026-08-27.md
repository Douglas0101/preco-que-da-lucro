# Evidência — Release readiness develop→main

**Data do registro:** 2026-08-27
**Programa:** Mandato de Execução v5 (fechamento SDD), tarefa M01-3
**Limite da evidência:** este documento registra a **release de conteúdo** develop→main
.cumprida via PR. Não é aprovação de cutover de produção, migration, Neon real ou
operação externa — essas permanecem bloqueadas por Q-001/A1 (aberta) e pelo gate F8.

## Resultado: release develop→main CUMPRIDA

| Verificação                                     | Status             | Evidência                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix `csf_58b444f152e35ba899b5381e` em `develop` | `CUMPRIDA`         | Merge PR #21 — tip `12c90a17f81edd5a126c2e32c3f703c8b7841f87`                                                                                                                                                                                                                                                                                                 |
| Fix `csf_58b444f152e35ba899b5381e` em `main`    | `CUMPRIDA`         | Merge PR #22 — tip `55cb5502d43b18f21e0fce85708472ff836a0c06`                                                                                                                                                                                                                                                                                                 |
| Igualdade de conteúdo develop↔main              | `CUMPRIDA`         | `git diff --name-only origin/develop origin/main` → 0 arquivos; merge-base `a4e6fb1`                                                                                                                                                                                                                                                                          |
| CI verde no tip publicado `12c90a1`             | `PASS`             | UI stack run `33037007387` — completed/success em 2026-08-27T03:39:16Z                                                                                                                                                                                                                                                                                        |
| CI do fix `a4e6fb1`                             | `PASS`             | v3: UI `33034852220`, Neon boundary `33034852213`, Sonar `98395300602` (todos success)                                                                                                                                                                                                                                                                        |
| Proveniência dos merges                         | `PRESUMIDO-HUMANO` | Q-009 — default C-19 aplicado (não-bloqueante), pendente de confirmação factual                                                                                                                                                                                                                                                                               |
| Evidência final do fix                          | `PASS`             | `docs/evidence/csf-58b444f-final-2026-08-27.md` + scan selado `2ca2b19a-3ab2-49a1-a436-0a9ab46b3fcd`                                                                                                                                                                                                                                                          |
| Cutover de produção (F8)                        | `BLOQUEADO`        | Depende de Q-001/A1 (fresh provisioning OU URL somente leitura da fonte Supabase)                                                                                                                                                                                                                                                                             |
| Readiness Neon no tip publicado `12c90a1`       | `FALHOU (E6)`      | Run `33080843742` (2026-08-27): boundary íntegro (branch descartável criada/deletada; migrações skipped; URLs provadas) mas `db:test` falhou em T6/E6 (`scripts/db/test-ai-budget.ts:427`) — suposição de wall-clock do harness sob latência Neon; **integridade segurou** (`peakActiveCalls <= 2` PASSOU; T1–T5 verdes); residual roteado ao harness do M-06 |

## Notas de escopo

- A divergência de SHAs entre `develop` e `main` é apenas topológica (dois merge
  commits sobre o mesmo conteúdo); a árvore de conteúdo é idêntica.
- O caminho crítico de produção (F7/F8) segue regido pelo Mandato v5 e bloqueado em
  Q-001/A1; nada neste documento autoriza operação em produção.
- ADR-021 (`docs/adr/ADR-021-migration-cutover-supabase-neon.md`) permanece intocável.
