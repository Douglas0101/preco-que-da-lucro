# SPEC — NavigationMenu agrupado no header (2026-10-28)

## Fato-fonte

`AGENTS.md` (Frontend/shadcn, Security baseline e Work packages), `docs/MAPA-OPERACIONAL.md`
(D4/D5 — navegação e fronteiras do shell) e o componente já instalado
`src/components/ui/navigation-menu.tsx` (commit `5391602`). O pedido do dono foi iniciar os
aprimoramentos pela navegação de menus, sem quebrar o sistema.

## Problema

O header desktop carregava oito links planos em uma única barra horizontal
(`src/components/app-shell.tsx`). Em larguras próximas de `lg`, a barra dependia de
`overflow-x-auto`; a hierarquia entre cadastro, vendas e análise não existia, e cada nova rota
aumentaria a largura da barra. O drawer mobile já era uma lista plana funcional e não precisava
de mudança estrutural.

## Contrato

Após a mudança:

1. O desktop tem três entradas no topo: **Início** (link direto), **Cadastro** e **Financeiro**
   (dropdowns), usando `NavigationMenu` sobre Base UI.
2. O drawer mobile continua com a lista plana de oito itens e o mesmo comportamento de foco.
3. A seção ativa é derivada do prefixo mais específico da rota; `/produtos/composicao` marca
   **Meus Produtos** e o grupo **Cadastro**.
4. O menu fecha ao navegar, ao pressionar Escape e ao clicar fora; Escape devolve o foco ao
   trigger.
5. O accessibility gate (axe) continua sem violações críticas/sérias no estado estável.
6. `check:ui-stack` continua provando que só `src/components/ui` importa Base UI e que o shell
   não usa primitivos interativos crus.
7. `check:bundle` continua verde; o grafo inicial não usa o `NavigationMenu`, que fica no chunk
   dinâmico da rota autenticada.

## Mudanças

- `src/components/app-navigation.ts`: modelo puro (`NAV`, `NAV_GROUPS`, `currentSection`,
  `itemsForGroup`, `isGroupActive`) extraído para cobertura unitária e reutilização.
- `src/components/desktop-navigation.tsx`: `DesktopNavigation` com `NavigationMenu`, estado
  controlado, reset por `pathname` e classes compartilhadas.
- `src/components/app-shell.tsx`: consome o modelo e o componente; drawer mobile preservado.
- `src/test/app-navigation.test.ts`: rotas exatas, subrotas, fronteira de prefixo e grupos.
- `src/test/desktop-navigation.test.tsx`: composição, abertura, `aria-current`, `data-active`,
  Escape/foco e axe no estado estável.
- `src/test/ui-stack.test.tsx`: caso de composição do wrapper `NavigationMenu`.
- `e2e/ui-stack.spec.ts`: teste existente passa a abrir o grupo **Cadastro** no desktop; novo
  teste desktop-only para teclado, foco, navegação e `data-active`.
- `docs/evidence/navigation-menu-2026-10-28/`: este pacote.
- Não muda: rotas, auth, banco, RLS, server functions, CSP, catálogo de UI (o componente já
  estava no catálogo) e o drawer mobile.

## DoD

- [x] `npm run check:ui-stack` verde.
- [x] `npm run typecheck` verde.
- [x] `npx vitest run src/test/ui-stack.test.tsx src/test/app-navigation.test.ts src/test/desktop-navigation.test.tsx` verde (12 passed).
- [x] `npm run test:coverage` verde; novos arquivos 85,7%/100%/88,9%.
- [x] `npm run db:test` verde em PG17 efêmero (18 suítes).
- [x] Matriz completa `chromium+firefox+webkit+mobile` verde (59 passed, 1 skipped).
- [x] `npm run test:visual` verde (33 passed, 3 skipped).
- [x] `npm run check` verde.
- [x] `npm run check:bundle` verde com o grafo inicial abaixo de 500.000 bytes.
- [x] Capturas em `captures/`.

## Testes

- **Unitário:** composição, `aria-current`, ausência de controles aninhados, axe no estado
  estável (fechado) e fechamento por Escape.
- **E2E desktop:** foco no trigger, Enter abre, link visível, Escape fecha e devolve foco,
  clique navega para `/produtos` e o trigger fica `data-active="true"`.
- **E2E mobile:** o teste existente abre o Sheet e confirma o link **Meus Produtos**; o teste
  desktop-only é pulado por projeto.
- **Falsificação:** remover o `active` do link ou o `data-active` do trigger faz os testes
  unitário/e2e falharem; remover o reset de `value` no `pathname` deixa o menu aberto após a
  navegação.

## Riscos

- O `NavigationMenu` carrega o chunk dinâmico da rota autenticada (≈40 KB minificados), não o
  grafo inicial. O `check:bundle` mede o grafo inicial; a rota autenticada cresceu de 11.163
  para 51.355 bytes. É um custo observado, não um gate de release.
- O Base UI usa focus guards `aria-hidden` + `tabindex="0"` enquanto o popup está aberto; o axe
  os classifica como `aria-hidden-focus`. O gate axe roda no estado fechado; a abertura é
  coberta por asserções de teclado. Limite declarado, não regra relaxada.
- O jsdom não reproduz toda a medição do popup; o caso unitário cobre composição e Escape, e o
  e2e cobre a interação completa.
- Ícones dos itens continuam em `lucide-react`; o caret do componente é `phosphor`. A migração
  de ícones não faz parte deste WP.

## Rollback

Reverter o commit da integração em `develop`. Não há migration, env, dado ou deploy de
produção envolvido. O componente `navigation-menu.tsx` pode permanecer no catálogo sem uso.
