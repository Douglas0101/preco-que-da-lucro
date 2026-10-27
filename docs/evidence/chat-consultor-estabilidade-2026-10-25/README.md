# README — revisão de estabilidade PC/Mobile do chat consultor (2026-10-25)

**Natureza:** revisão técnica do Lead sobre trabalho de sessão ainda **não commitado** no worktree
`develop` (chat redesenhado, launcher flutuante do Simon e menu sem “Precificação”). Não é um work
package com lane S6 adversarial; os pares RED/GREEN disponíveis estão na captura 05 e no SPEC.

**Resultado:** 7 achados — 6 corrigidos nesta revisão e 1 condição de bancada declarada. Matriz
Playwright final **113 passed / 3 skipped / 0 failed** nos quatro projetos (chromium, firefox,
webkit, mobile). Gate local **`npm run check` exit 0**.

## Achados e desfecho

| #   | Severidade | Achado                                                                                   | Desfecho                                                                                                   | Prova            |
| --- | ---------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Média      | Página e painel usavam o mesmo `id` de composer (`novo-produto-mensagem`)                | IDs por variante: `novo-produto-mensagem` / `simon-mensagem`; teste regride se voltarem a colidir          | capture 03       |
| 2   | Média      | Launcher/composer sem `safe-area` no iOS (home indicator)                                | `bottom`/`pb` com `env(safe-area-inset-bottom)`; desktop preservado                                        | capture 09/10    |
| 3   | Média      | Launcher fixo cobria o último CTA de páginas roláveis                                    | `pb-24 md:pb-20` no conteúdo autenticado (workspace do chat mantém `pb-6 md:pb-10`)                        | capture 09       |
| 4   | Alta       | Falha de chunk do `React.lazy` derrubava o render sem fallback                           | `CatchBoundary` + `role="alert"` com “Tentar novamente”; teste dedicado                                    | capture 03       |
| 5   | Alta       | Teste E2E do painel dependia do herói transitório e o settle de animações não tinha teto | asserção no histórico do fixture; settle limitado a 2 s (o axe não depende do último frame)                | capture 05/06/07 |
| 6   | Alta       | Defeito mobile **pré-existente** em `/produtos`: título do card colapsa a 0 px em 390 px | ações com `max-sm:w-full max-sm:justify-end`; título passou de 0 px para 116 px em 390×844                 | capture 05/13    |
| 7   | Baixa      | `coverage/` na raiz faz `m02:secrets-audit` sair 2/INCOMPLETE (gate para)                | condição de bancada declarada; diretório removido antes do gate; audit volta a COMPLETE_WITH_LIMITS exit 0 | capture 04       |

## Evidência por fase

| Captura | Conteúdo                                                  | Resultado                                         |
| ------- | --------------------------------------------------------- | ------------------------------------------------- |
| 01      | Escopo e diff dos arquivos da sessão                      | 18 caminhos da sessão; WIP alheio listado à parte |
| 02      | `npm run check` (cadeia completa)                         | exit 0; 161/163 arquivos; 2413 testes; 486.738 B  |
| 03      | Cobertura direcionada do código novo                      | chat 92,13% linhas; dock/avatar/persona/rota 100% |
| 04      | Condição de bancada `coverage/` × secrets-audit           | INCOMPLETE/exit 2 → COMPLETE_WITH_LIMITS/exit 0   |
| 05      | Primeira matriz completa (descoberta)                     | 4 falhas medidas e suas causas                    |
| 06      | Re-execução focada após correções                         | 8 passed (2 testes × 4 projetos)                  |
| 07      | Matriz completa final                                     | 113 passed / 3 skipped / 0 failed (4,9 min)       |
| 08      | axe + settle de animações no painel aberto                | axe 0 violações em 671 ms; settle sem pendências  |
| 09      | Painel desktop (1280×900)                                 | layout e histórico restaurado                     |
| 10      | Painel mobile (390×844)                                   | full-width, header compacto, composer visível     |
| 11      | Rota `/novo-produto` (workspace)                          | sem launcher, título “Precificação de produto”    |
| 12      | Launcher no canto inferior direito                        | visível em `/inicio`, com status                  |
| 13      | `/produtos` mobile: título antes (0 px) e depois (116 px) | defeito pré-existente corrigido                   |

## Números medidos

- **Gate local:** `npm run check` exit `0` — 161 arquivos passaram / 2 pularam (163), **2413 testes
  passaram** / 30 pularam (2443), build ok, bundle inicial **486.738 B** (limite 500.000).
- **Cobertura (proxy local do new-code do ADR-042):** `consultor-chat.tsx` 92,13% linhas;
  `consultor-chat-dock.tsx`, `consultor-avatar.tsx`, `consultor-persona.ts` e a rota 100%.
- **Matriz Playwright:** chromium 28 ✓, firefox 28 ✓, webkit 28 ✓, mobile 29 ✓; 3 skips
  (mobile-only e condicionais); exit 0.
- **A11y:** axe no diálogo do painel = 0 violações `critical/serious` (unitário e E2E); `Esc` fecha
  e devolve foco; `AlertDialog` aninhado não fecha o painel.

## Riscos e limites declarados

- Teclado virtual de aparelho real (iOS/Android) e notch não são exercitáveis nesta bancada; o
  `safe-area` é CSS e o `visualViewport` do iOS pode cobrir o composer. Não há teste de hardware.
- O foco automático no composer ao abrir o painel pode abrir o teclado no mobile (comportamento
  aceito para chat).
- **Nenhuma ADR foi criada** para a superfície global do consultor; os contratos arquiteturais
  vigentes não mudaram, mas a ratificação de produto/UX fica pendente (não presumida).
- A matriz rodou em uma única máquina (host), não no runner do CI; o CI continua autoridade. O
  `new_coverage` real é o do Sonar/CE (ADR-042), não o proxy local.
- O worktree contém WIP de outras sessões; os gates verdes o incluem, sem revisão nesta rodada.
- O teste do painel depende do fixture `Mensagem restaurada do histórico E2E.` criado por
  `scripts/e2e/seed-auth.ts`.
- Este pacote **não passou por lane S6 adversarial independente**; a falsificação disponível é a dos
  testes listados no SPEC.
- **Selo pendente de commit:** `m02-seal --write` sai `2` com worktree derivado; o MANIFEST manual
  está verificado, mas o selo deve ser reexecutado após o commit da sessão.

## Reprodução

```bash
npm run db:up
npm run check
npx vitest run src/test/novo-produto-chat.test.tsx src/test/consultor-chat-dock.test.tsx \
  src/test/consultor-chat-dock-failure.test.tsx src/test/chat-ui.test.tsx \
  --coverage --coverage.reportsDirectory=/tmp/coverage-review
BETTER_AUTH_URL=http://127.0.0.1:4173 AUTH_TRUSTED_ORIGINS=http://127.0.0.1:4173 \
  E2E_AUTH_EMAIL=<fixture> E2E_AUTH_PASSWORD=<fixture> \
  node --env-file=.env node_modules/@playwright/test/cli.js test   # 4 projetos
node scripts/m02-seal.mjs --dir docs/evidence/chat-consultor-estabilidade-2026-10-25
```

O `MANIFEST.sha256` cobre todos os 15 arquivos descobertos, `checked === discovered`, no mesmo
formato do selo (`sha256` + caminho relativo, ordenado) e verificado por recomputação local. O
`scripts/m02-seal.mjs --write` **não pôde selar** enquanto o worktree tem arquivos derivados fora do
pacote (WIP herdado + esta sessão ainda não commitada): a precondição sai `2` (capture 14). Depois do
commit da sessão, o selo deve ser reexecutado (`node scripts/m02-seal.mjs --dir <este dir>`); essa
pendência está declarada nos riscos.
