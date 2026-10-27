# SPEC — Barra de rolagem visível nas sugestões do chat (2026-10-25)

## Fato-fonte

- Pedido direto do dono, com captura do painel do Simon: “Coloque uma barra inferior de rolagem
  para que no desktop e mobile se consiga ver as outras opções.”
- Estado anterior: a faixa “Comece por aqui” era um `div` com `overflow-x-auto` **e**
  `no-scrollbar` (`src/components/consultor-chat.tsx`), então as sugestões que não cabiam ficavam
  cortadas sem nenhuma pista visual — no mobile o scrollbar nativo é overlay/auto-oculto, e no
  desktop estava explicitamente escondido.

## Problema

A pessoa vê “Cadastrar meu primeiro produto” e “Entender custos e…” cortado, sem indicação de que
há mais opções à direita; no painel mobile (365 px internos) e no desktop (423 px internos), a linha
tem 776 px de conteúdo. Faltava affordance persistente e operável de rolagem horizontal.

## Contrato

- Quando `scrollWidth > clientWidth`, aparece uma **barra horizontal visível** abaixo da faixa de
  sugestões, nos dois formatos (página e painel), em desktop e mobile.
- A barra é um `input[type=range]` estilizado (trilho + thumb), **sem inline style** (CSP
  `style-src 'self'` intacta) e usando os tokens do tema (trilho `--muted`, thumb `--primary`).
- Interações: arrastar/clicar com mouse ou toque; setas/Home/End do teclado; e a barra acompanha
  qualquer rolagem feita por roda/toque na faixa (scroll listener + `ResizeObserver`).
- Acessível: `role=slider` nativo com `aria-label="Rolagem das sugestões"` e `aria-valuetext`
  percentual; foco visível com `--ring`.
- Quando não há overflow (ou o estado deixa de ser o herói), a barra não renderiza — nenhuma altura
  reservada à toa.
- Sem mudanças de layout além da faixa de 8 px + `mt-2` abaixo das sugestões; sem nova dependência,
  sem catálogo novo (usa `Input` do próprio catálogo) e sem tocar em BFF/DB/CSP.

## Mudanças

- `src/components/consultor-chat.tsx`: componente `SuggestionScrollBar` (métricas de
  `scrollWidth`/`clientWidth`/`scrollLeft`, sincronização com `ResizeObserver`, range controlado),
  `ref` + `data-slot="suggestion-scroller"` na faixa e import do `Input` do catálogo.
- `src/styles.css`: bloco `.suggestion-scrollbar` (trilho/thumbs WebKit e Firefox, foco visível,
  aparência nativa removida).
- `src/test/consultor-chat-dock.test.tsx`: teste com métricas simuladas (620×320 → max 300),
  mudança para 150 e verificação de `aria-valuetext` 50% após evento de scroll.
- `docs/evidence/chat-barra-rolagem-sugestoes-2026-10-25/`: este pacote.

## DoD

1. No navegador real (desktop 1280×900 e mobile 390×844): barra visível, `max` 353 px e 411 px
   respectivamente; `End` leva `scrollLeft` ao máximo e mostra “Calcular meu ponto de equilíbrio” —
   captures 02/03–06.
2. `axe` no diálogo do painel (desktop e mobile, temas WCAG 2A/AA) sem violações — capture 02.
3. Teste unitário com overflow simulado verde; sem overflow a barra não existe — capture 07.
4. Gate local: 20 passos da cadeia `npm run check` (exceto `m02:lockfile-guard`, precondição de
   sessão) exit 0, 2414 testes, build e bundle (486.879 B iniciais) — capture 07.
5. Matriz Playwright completa verde nos quatro projetos — capture 07.

## Testes (falsificação)

- O teste unitário mocka `scrollWidth=620`/`clientWidth=320`; se a lógica de overflow sumir, o
  slider não é encontrado e o teste falha; se o `onChange` não mexer em `scrollLeft`, a asserção de
  150 falha; se o evento de scroll não atualizar o estado, `aria-valuetext` não vira 50%.
- O script de navegador (`check-scrollbar.mjs`) mede `scrollWidth/clientWidth`, pressiona `End` e
  relê `scrollLeft`; qualquer regressão de sincronização aparece nos números.
- Sem overflow (jsdom padrão, 0×0) o componente renderiza `null` — comportamento exercitado pelos
  testes existentes que não encontram slider no herói sem overflow.
- O axe do diálogo reprova se o range ganhar nome/valor inválido ou contraste reprovado.

## Riscos e limites declarados

- **Thumb com largura fixa (3rem)**, não proporcional: evita style inline/JS de layout e mantém a
  CSP estrita; o trilho comunica a posição, o thumb não representa a razão visível.
- **Dois mecanismos de rolagem**: o nativo continua existindo (oculto); a barra é o affordance. Não
  há regressão de roda/toque — os eventos seguem no scroller.
- **Sem e2e dedicado**: o estado de herói só existe com histórico vazio, e resetar a conversa em
  teste e2e concorre com outros workers na mesma fixture (a suíte roda em paralelo). A verificação
  no navegador real está em `02-verificacao-browser.txt` (script Playwright), e o unitário cobre o
  estado de overflow.
- **Dark mode**: thumb/trilho usam os tokens atuais; o app não aplica `.dark` hoje.
- **Gate local**: segue bloqueado apenas por `m02:lockfile-guard` (motion da sessão anterior sem
  commit); esta mudança não toca lockfile.
- Nenhuma mudança arquitetural/contratual: sem ADR.

## Rollback

- Reverter `src/components/consultor-chat.tsx`, `src/styles.css` e o teste; a faixa volta a
  `no-scrollbar` sem barra. Sem migration, env, deploy ou dado alterado.
