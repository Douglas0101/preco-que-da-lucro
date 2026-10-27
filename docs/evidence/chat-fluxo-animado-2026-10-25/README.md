# README — fluxo animado do chat consultor (AI Elements), 2026-10-25

**Natureza:** mudança de UI sobre o chat existente, ainda **não commitada** no worktree `develop`.
Porta o fluxo animado do Chat oficial (`motion/react` + preset `slide-up` + `useReducedMotion`) para
os turnos do consultor, incluindo a resposta (o nosso servidor não faz streaming).

**Resultado:** animação medida no navegador (opacidade/`translateY`), desligada em
`prefers-reduced-motion`, grafo inicial preservado, testes unitários/E2E verdes nos quatro engines.

## O que mudou

- `package.json` / `package-lock.json`: `motion@^12.43.0` (família `motion/react`; lock só com a
  árvore `motion`).
- `src/lib/message-animations.ts`: presets oficiais portados do repo shadcn/ui (MIT), com
  `slide-up` como padrão.
- `src/components/consultor-chat.tsx`: `motion.create(MessageScrollerItem)` no map dos turnos,
  `variants/initial/animate` e `useReducedMotion()`; o item de loading permanece estático.
- Nada mais mudou (sem BFF, CSP, DB, textos, URLs ou outros componentes).

## Evidência

| Captura | Conteúdo                                  | Resultado                                                                  |
| ------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| 01      | Dependência e escopo                      | só `motion`/`motion-dom`/`motion-utils`/`framer-motion` no lock            |
| 02      | Build + `check:bundle`                    | grafo inicial 486.923 B; motion no chunk lazy `consultor-chat` (164.497 B) |
| 03      | Fluxo medido no navegador                 | `opacity` 0,13 → 1 e `translateY` 6,1 px → 0; `getAnimations()` 1 → 0      |
| 04      | `reducedMotion: reduce`                   | `matchMedia=true`; estilo final imediato e 0 animações                     |
| 05      | `fluxo-animado.webm`                      | gravação do painel abrindo e do envio/turnos animando                      |
| 06      | Testes e cadeia do gate (exceto lockfile) | 20 passos exit 0; 2413 testes; E2E focado 16 passed                        |
| 07      | `m02:lockfile-guard`                      | falha esperada por dependência sem commit (precondição de sessão)          |
| 08      | Matriz Playwright completa                | 113 passed / 3 skipped / 0 failed; painel verde nos 4 projetos             |

## Números medidos

- **Animação:** item novo inicia com `opacity: 0.133` e `translateY: 6.117 px` (t≈145 ms) e termina
  em `opacity: 1`, `transform: none`; `getAnimations()` = 1 durante, 0 ao final. O turno do
  consultor também anima (registro `animations: 1` na entrada).
- **Reduced motion:** `matchMedia('(prefers-reduced-motion: reduce)').matches = true`; item novo já
  em `opacity: 1; transform: none;` com 0 animações.
- **Gate:** cadeia do `npm run check` executada passo a passo (sem `m02:lockfile-guard`, capture 07)
  — 20 passos exit 0, `test` 2413 passed / 30 skipped, build ok, bundle 486.923 B.
- **E2E:** focado 16 passed (4 testes × 4 projetos) e matriz completa 113 passed / 3 skipped, exit 0.

## Limites e riscos declarados

- **Sem streaming:** o demo anima a entrada do turno da pessoa e transmite a resposta; aqui a
  resposta chega inteira e ganha a mesma entrada animada. Revelação progressiva de texto é outro
  escopo.
- **Custo:** `motion` adiciona ~70 KB minificados ao chunk lazy do chat. O grafo inicial ficou em
  486.923 B (+185 B), mas não existe gate de orçamento por chunk; o chunk do chat passou a 164.497 B.
- **CSP report-only:** motion aplica estilos inline; os relatórios `style-src-elem` no modo
  report-only já existente continuam (não bloqueiam) e nenhuma política foi afrouxada.
- **Lockfile sem commit:** `m02:lockfile-guard` reprova por desenho; o CI com a dependência
  commitada roda o `check` inteiro.
- **Hardware real:** timing/throttle e teclado móvel não medidos; reduced-motion validado por
  emulação Playwright.
- **Histórico restaurado:** todos os itens animam no mount do painel (paridade com o demo), o que
  anima vários turnos de uma vez em históricos longos.
- **Selo pendente:** `m02-seal --write` exige worktree limpo fora do pacote e sai `2` neste estado
  (WIP herdado + sessão não commitada). O `MANIFEST.sha256` foi gerado no formato do selo e
  verificado por recomputação; reexecutar o selo após o commit.

## Reprodução

```bash
npm run db:up
npm run dev
node .artifacts/design/debug-motion.mjs   # amostra opacidade/transform e getAnimations()
node .artifacts/design/check-reduced.mjs  # contexto reducedMotion: reduce
npx vitest run src/test/novo-produto-chat.test.tsx src/test/consultor-chat-dock.test.tsx \
  src/test/consultor-chat-dock-failure.test.tsx src/test/chat-ui.test.tsx
node scripts/m02-seal.mjs --dir docs/evidence/chat-fluxo-animado-2026-10-25
```
