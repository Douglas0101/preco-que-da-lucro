# README — barra de rolagem visível nas sugestões do chat (2026-10-25)

**Natureza:** correção de UX/acessibilidade no painel do Simon (faixa “Comece por aqui”), ainda
**não commitada** no worktree `develop`. Sem nova dependência, sem alteração de BFF/CSP/banco e sem
mudança arquitetural (sem ADR).

**Resultado:** a faixa de sugestões agora tem uma **barra horizontal visível** abaixo dela, no
desktop e no mobile, que arrasta, clica e responde a teclado, refletindo também a rolagem por
toque/roda. `axe` do diálogo sem violações; matriz Playwright completa **113 passed / 3 skipped**.

## O que mudou

- `src/components/consultor-chat.tsx`: componente `SuggestionScrollBar` — mede
  `scrollWidth/clientWidth/scrollLeft`, sincroniza com `ResizeObserver` e renderiza um
  `Input type="range"` (do catálogo) quando há overflow; `data-slot="suggestion-scroller"` na
  faixa; a barra some quando não há overflow.
- `src/styles.css`: `.suggestion-scrollbar` — trilho `--muted`, thumb `--primary`, thumbs WebKit e
  Firefox, foco visível `--ring`; **sem inline style** (CSP `style-src 'self'` intacta).
- `src/test/consultor-chat-dock.test.tsx`: teste com overflow simulado verifica `scrollLeft` e
  `aria-valuetext` após interação.
- Sem mudanças de layout além da faixa de 8 px + `mt-2`; nenhum componente novo no catálogo.

## Evidência

| Captura | Conteúdo                                      | Resultado                                                       |
| ------- | --------------------------------------------- | --------------------------------------------------------------- |
| 01      | Escopo/diff (chat, CSS, teste)                | 3 arquivos, 1 teste novo                                        |
| 02      | Verificação no navegador real + axe           | desktop max 353 px, mobile max 411 px; `End` → fim; 0 violações |
| 03–06   | Prints mobile/desktop antes e depois de rolar | barra visível e “Calcular meu ponto de equilíbrio” alcançável   |
| 07      | Cadeia do gate + matriz                       | 20 passos exit 0; 2414 testes; bundle 486.879 B; E2E 113/3      |

## Números medidos

- **Overflow real:** faixa com `scrollWidth=776`; interno `423` px no desktop e `365` px no mobile
  → `max` 353 e 411 px. A barra fica visível nos dois.
- **Rolagem pela barra:** pressionar `End` no slider levou `scrollLeft` a **353 (desktop)** e **411
  (mobile)**, iguais ao máximo — a última sugestão fica visível.
- **A11y:** `axe` no diálogo do painel (desktop e mobile, WCAG 2A/AA) → **0 violações**; slider com
  `aria-label` e `aria-valuetext` percentual; foco visível.
- **Gate:** cadeia `npm run check` (sem `m02:lockfile-guard`) **20/20 exit 0**; **2414 testes**
  passaram (30 skip); `check:ui-stack` ok; build ok; bundle inicial **486.879 B** (limite 500.000).
- **E2E:** matriz completa **113 passed / 3 skipped / exit 0** (4,6 min), quatro projetos.

## Limites e riscos declarados

- Thumb com largura fixa (3 rem), não proporcional à fração visível: evita style inline/JS de
  layout e mantém a CSP estrita; o trilho comunica a posição.
- O scrollbar nativo continua existindo (oculto); a barra é o affordance persistente. Roda/toque
  seguem rolando a faixa normalmente.
- **Sem e2e dedicado ao estado vazio**: resetar a conversa em teste e2e concorre com os outros
  workers na mesma fixture. A verificação equivalente foi feita por script Playwright no navegador
  real (capture 02) e por teste unitário com métricas simuladas.
- A altura da faixa acrescenta 8 px + margem ao bloco de sugestões; não altera o composer nem o
  painel fechado.
- Gate completo segue bloqueado apenas por `m02:lockfile-guard` (motion sem commit da sessão
  anterior); esta mudança não toca lockfile.
- Sem teste em hardware real; desktop/mobile foram validados por viewport Playwright.

## Reprodução

```bash
npm run db:up && npm run dev
node .artifacts/design/check-scrollbar.mjs     # mede, interage e roda axe
npx vitest run src/test/consultor-chat-dock.test.tsx
playwright test -g "floating consultor|chat: desfecho honesto"
node scripts/m02-seal.mjs --dir docs/evidence/chat-barra-rolagem-sugestoes-2026-10-25
```
