# Evidência — Fechamento da integração Neon ↔ GitHub — 2026-08-23

## Escopo

Execução das Fases 0–4 e preparação da Fase 7 do plano de próximos passos da
integração Neon ↔ GitHub, com controle de mudança, gates de qualidade,
auditabilidade e rollback. Sessão operada por agente de engenharia sob decisão
humana registrada nos merges.

## Fase 0 — Verificação pré-merge do PR #17

| Item | Resultado |
| --- | --- |
| Estado | OPEN, MERGEABLE, mergeStateStatus CLEAN |
| Base / head | `develop` ← `codex/local-dev-postgres` @ `34659c335b30942e290f4ea164fd445b3182c898` |
| verify (ui-stack) | success — run 32647199292 |
| migration (neon-preview) | success — run 32647199287 |
| SonarCloud | pass ([dashboard](https://sonarcloud.io/dashboard?id=Douglas0101_preco-que-da-lucro&pullRequest=17)) |
| Scan de segredos no diff | limpo (743 linhas; apenas placeholders e regex de redação) |
| Correção RBAC `set_option` | presente em `scripts/db/migrate.ts` (erro 42501 SET ROLE, PG16+) |
| Rollback `0001_to_0000` | sem `REVOKE`; apenas `DROP OWNED` + `DROP ROLE app_runtime` |

## Fase 1 — Saneamento e sincronização do checkout local

- Estado inicial: branch `codex/local-dev-postgres` @ `6c876ad`, **behind 9**
  de origin; working tree sujo (~30 modificados + ~25 não rastreados).
- Backup: branch `backup/codex-local-dev-postgres-20260823-121847`.
- Checkpoint: `git stash push -u -m "checkpoint: trabalho local antes de
  sincronizar codex/local-dev-postgres"` — entrada preservada após o pop.
- Fast-forward limpo `6c876ad → 34659c3` (sem divergência de commits locais).
- `stash pop`: 3 conflitos resolvidos com upstream prevalecente (decisão
  registrada abaixo); nenhum dado perdido:
  - `e2e-local-postgres-2026-08-15.md`: versões idênticas.
  - `pr12-followups-triage-2026-08-15.md`: versão remota é superset estrito.
- Validação pós-resolução: vitest `purchase-price.service.test.ts` 3/3,
  typecheck limpo, eslint OK, prettier OK nos arquivos afetados.

### Decisão de resolução de conflitos

| Arquivo | Conflito | Resolução |
| --- | --- | --- |
| `src/server/repositories/purchase-price.repository.ts` | stash setava `recordedAt: new Date()`; upstream usa default do banco | upstream (schema fixa `recorded_at ... defaultNow()`, `src/db/schema.ts:407`) |
| `src/test/purchase-price.service.test.ts` | teste extra do stash dependia do comportamento substituído | removido; original recuperável em `stash@{0}` |
| `docs/REALINHAMENTO_OPERACIONAL_V7_PLANO.md` | bullet antigo ("triagem registrada") vs novo ("follow-ups implementados", PR #15) | upstream (narrativa mais recente) |

## Fase 2 — Merge do PR #17

- **Decisão humana registrada:** merge commit (convenção dos PRs #12/#15).
- **Merge:** [`7f5f6471899d0a38fe8e3bca733ab23f1ed851fe`](https://github.com/Douglas0101/preco-que-da-lucro/pull/17)
  em `develop` (2026-08-23T15:46:57Z).
- **CI pós-merge:** SUCCESS — [run 32649625771](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/32649625771).

## Fase 3 — Promoção controlada para a main

- Motivo: `workflow_dispatch` do Neon readiness exige o arquivo na branch
  default; o workflow valida internamente que a execução ocorre em
  `refs/heads/develop`.
- **Decisão humana registrada:** merge aprovado.
- PR [#18](https://github.com/Douglas0101/preco-que-da-lucro/pull/18)
  (`develop` → `main`): MERGEABLE/CLEAN; SonarCloud pass; verify pass —
  [run 32650071739](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/32650071739).
- **Merge:** `6f6baca13759be930bfbebffb818a4ac08088651` em `main`
  (2026-08-23T16:01:15Z).

## Fase 4 — Dry-run do Neon readiness a partir da main

- Dispatch manual contra ref `develop` (exigência do passo "Require develop
  ref"), `migration_mode=dry-run`, `confirm_apply=false`.
- Run: [32650393138](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/32650393138)
  — **success** (environment `neon-readiness`, permissions `contents: read`,
  Actions pinadas por SHA).
- Branch efêmera Neon `readiness/develop-32650393138` criada a partir de
  `develop` e **deletada** ao final (steps "Create/Delete disposable Neon
  readiness branch": ambos `success`) — cleanup automático provado.
- Cadeia executada na branch descartável: `npm run db:test` OK (PostgreSQL 17,
  migration zero, constraints, RLS, tabelas P1, cross-tenant, rollback, Better
  Auth, tool registry, chat read-only) + `npm run db:check`.
- Artefato: `neon-readiness-32650393138.zip` (338 bytes, ID 9496024833).
- Segredos: zero ocorrências de credenciais literais no log; tokens mascarados
  como `***` pelo runner.

## Exceções registradas

1. **Required reviewers não configuráveis** — API retorna 422: repositório
   privado em plano gratuito não suporta a funcionalidade (mesma limitação do
   ADR-017). Controle alternativo aceito: revisão humana explícita + checks
   obrigatórios verdes + environment `neon-readiness` sem credenciais de
   produção.

## Pendências bloqueadas (dependem de ação humana)

| Fase | Bloqueio | Ação necessária |
| --- | --- | --- |
| 5 — Card GitHub no console Neon | daemon WebBridge ativo, mas `extension_connected: false` | abrir navegador com extensão Kimi WebBridge conectada |
| 6 — Checklist hPanel (11 itens) | sessão assistida pendente | executar item a item após Fase 5, sem registrar segredos |

## Rollback disponível

- Promoção à main: `git revert -m 1 6f6baca` ou PR de revert.
- Checkout local: branch `backup/codex-local-dev-postgres-20260823-121847` +
  `stash@{0}` íntegros.
