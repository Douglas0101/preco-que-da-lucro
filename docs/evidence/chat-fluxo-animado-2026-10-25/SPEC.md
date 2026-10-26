# SPEC — Fluxo animado do chat consultor (AI Elements), 2026-10-25

## Fato-fonte

- Pedido direto do dono (2026-10-25): “Quero que o chat tem o mesmo fluxo animado demonstrado no
  site oficial do shad.”, citando `pnpm dlx shadcn@latest add message-scroller message bubble
input-group`.
- Fonte oficial do comportamento: `apps/v4/lib/message-animations.ts` e o demo
  `apps/v4/examples/base/chat-demo.tsx` do repositório `shadcn-ui/ui` (commit analisado
  `617134d5810bba521803b3ed787190bacbb80b35`): `motion.create(MessageScrollerItem)`, preset
  `slide-up` (`opacity 0→1`, `y 10→0`, 260 ms, `cubic-bezier(0.16, 1, 0.3, 1)`) e
  `useReducedMotion()` desligando o estado inicial.
- Página de referência: <https://ui.shadcn.com/docs/ai-elements/base/chat>.

## Problema

O chat já usa `MessageScroller`/`Message`/`Bubble`/`InputGroup` atuais, mas os turnos entram sem
animação: ao enviar, a bolha da pessoa e a resposta do consultor aparecem de forma abrupta. O demo
oficial comunica o fluxo com a entrada `slide-up` de cada turno (e respeita preferência por
movimento reduzido). Como o nosso servidor não faz streaming, a resposta também precisa de entrada
animada para reproduzir a sensação do demo.

## Contrato

- Todo turno novo (pessoa e consultor) entra com o preset `slide-up` oficial; o histórico restaurado
  também anima no mount, como no demo.
- `prefers-reduced-motion: reduce` desliga a animação (`initial=false`; estilo final imediato, zero
  animações ativas) — mesmo contrato do `useReducedMotion()` oficial.
- A animação não altera layout/scroll: apenas `opacity` e `translateY` no item do scroller; o
  `scrollAnchor` continua sendo o turno da pessoa.
- `motion` fica no chunk lazy do chat (não no grafo inicial); o grafo inicial permanece abaixo do
  limite de 500.000 B do `check:bundle`.
- Sem regressão de a11y/E2E: axe do painel continua sem violações `critical/serious` e os testes de
  chat passam nos quatro projetos.

## Mudanças

- `package.json` / `package-lock.json`: `motion@^12.43.0` (mesma família `motion/react` usada pelo
  shadcn `^12.12.1`; lock contém apenas a árvore `motion`, sem bump colateral).
- `src/lib/message-animations.ts` (novo): presets oficiais portados (fade, slide-up, slide-side, pop,
  spring-bounce, blur-fade, scale-fade), com atribuição MIT e preset padrão `slide-up`.
- `src/components/consultor-chat.tsx`: `motion.create(MessageScrollerItem)`, `useReducedMotion()` e
  as variantes/initial/animate no map de turnos; o item de loading permanece estático.
- `docs/evidence/chat-fluxo-animado-2026-10-25/`: este pacote.
- Não muda: contratos BFF/CSP/DB, server functions, textos do chat, URL `/novo-produto`, demais
  componentes e dependências.

## DoD

1. Medição no navegador: item novo começa com `opacity < 1` e `translateY > 0`, termina em
   `opacity 1`/`transform: none`, com `getAnimations()` ativo durante e 0 ao final — capture 03.
2. `reducedMotion: reduce`: estilo final imediato e 0 animações — capture 04.
3. `npm run build` + `check:bundle` passam; grafo inicial inalterado (486.923 B) e motion no chunk
   lazy `consultor-chat` — capture 02.
4. Testes unitários de chat verdes (14 testes) e E2E focado nos quatro projetos verde (16 passed) —
   capture 06.
5. Cadeia do `npm run check` verde exceto `m02:lockfile-guard`, que exige a dependência commitada
   (precondição de sessão sem commit; capture 07).

## Testes (falsificação)

- Sem `motion.create`/variantes, a amostragem do item mostra `opacity 1`/`transform: none` desde o
  primeiro frame e `getAnimations() = 0` — o capture 03 (opacidade 0,13 e `translateY` 6,1 px em
  t≈145 ms) reprova esse estado.
- Sem `useReducedMotion`, o contexto reduzido mostraria animação ativa; o capture 04 exige estilo
  final imediato e 0 animações.
- `check:bundle` falha se o motion vazar para o grafo inicial acima do limite.
- E2E do chat falha se a animação quebrar foco, axe (via `prefers-reduced-motion` emulado) ou
  visibilidade dos turnos.

## Riscos e limites declarados

- **Sem streaming**: a animação cobre entrada de turno, não a revelação progressiva de texto que o
  demo obtém do transporte do AI SDK. Declarado; mudar isso seria outro escopo.
- **Tamanho**: `motion` adiciona ~70 KB minificados ao chunk lazy do chat (164.497 B no total). O
  grafo inicial ficou em 486.923 B (+185 B), mas o chunk do chat cresceu; não há gate de orçamento
  por chunk hoje.
- **CSP report-only**: estilos inline aplicados pelo motion geram relatórios `style-src-elem` no
  modo report-only já existente (não bloqueiam); nenhuma política foi afrouxada.
- **Lockfile**: a dependência nova exige commit para o `m02:lockfile-guard`; nesta sessão sem commit
  a cadeia foi rodada passo a passo (capture 06/07). O CI roda o `check` completo com o lock
  commitado.
- **Dispositivo real**: timing de animação em hardware/ throttle não foi medido; reduced-motion foi
  validado por emulação Playwright.
- **Histórico restaurado**: todos os itens animam no mount do painel (paridade com o demo), o que
  pode animar vários turnos de uma vez em históricos longos.

## Rollback

- Remover `motion` de `package.json`/lock, apagar `src/lib/message-animations.ts` e reverter o bloco
  de wiring em `consultor-chat.tsx` (o chat volta ao comportamento estático). Sem migration, sem
  alteração de dados, sem deploy.
