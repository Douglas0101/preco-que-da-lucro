# SPEC — Tema do sistema nas cores da Diretriz Precifica (2026-10-25)

## Fato-fonte

- Pedido direto do dono (2026-10-25): “https://diretrizprecifica.com/ — Coloque todo o sistema nas
  cores desse site.”
- Fonte da paleta: `getComputedStyle` no site publicado (Playwright/Chromium, 1440×1000 e 390×844),
  lendo as custom properties HSL que o próprio site declara e amostrando `background-color`,
  `color` e `background-image` de todos os elementos visíveis. Extrato bruto em
  `captures/01-fonte-paleta.txt` e `captures/01b-paleta-bruta.json`.
- Tokens do app: `src/styles.css` (`:root` é o tema; o app nunca aplica `.dark`) e o mapeamento
  `@theme inline`; contrato em `AGENTS.md` (shadcn `base-luma`, `check:ui-stack`, axe/AA).

## Problema

O sistema usava o tema zinc padrão com sidebar escura, ouro pontual e um resíduo esmeralda
(`--gradient-hero`, `.premium-hero`, `::selection`). A Diretriz Precifica é creme quente + navy +
ouro (HSL 40 33% 97 / 224 47% 12 / 43 72% 42), com header claro, logo navy com glifo ouro, botões
ouro e cards brancos. “Todo o sistema” significa: tokens globais e também os pontos que ainda
carregavam cor fixa fora dos tokens (logo, acentos de texto, form controls, gradientes).

## Contrato

- `:root` espelha a paleta do site convertida para OKLCH; `--sidebar` vira o header claro do site
  (navy no texto); logo do header/landing/auth é navy com glifo ouro (como o quadrado “D” do site).
- **Acessibilidade preservada (WCAG 2.2 AA, axe do repositório)**:
  - `--primary-foreground` = navy, não o quase-branco do site (site mede 2,95:1; navy/ouro mede
    5,75:1);
  - `--primary-strong` (ouro escuro) para texto/links sobre creme (5,19:1) e `--ring` idem (foco);
  - `--primary-display` (3,32:1) só em títulos grandes (limite 3:1), preservando o ouro vivo do
    site onde ele é visível;
  - `success`/`warning`/`destructive` continuam semânticos e com os valores que já passavam
    (success 4,67:1 no creme; DBT-123).
- Cores fixas fora dos tokens alinhadas: `::selection`, `.premium-hero`, `.glass`, `.gold-text`,
  `--gradient-hero/card`, sombras; inputs/textarea/select/input-group passam de preenchimento
  cinza para branco com borda (formulários do site).
- Sem mudanças de layout, tipografia, CSP, BFF, banco ou dependências nesta mudança (Sora/Inter do
  site exigiria host novo na CSP — fora do escopo “cores”).
- `check:ui-stack` continua pinando `base-luma`/`baseColor: zinc`; o catálogo não muda, só tokens e
  classes de cor.

## Mudanças

- `src/styles.css`: `:root` e `.dark` reescritos na paleta Diretriz (OKLCH), `--primary-strong`,
  `--primary-display`, rampa `--chart-*` ouro→navy, gradientes/sombras/selection e utilitários
  premium alinhados.
- `src/routes/index.tsx` e `src/routes/auth.tsx`: logo navy/glifo ouro e acento de título com
  `text-primary-display`.
- `src/routes/_authenticated/inicio.tsx`: nome do produto em `text-primary-strong` (24px bold).
- `src/components/ui/badge.tsx` e `button.tsx`: variante `link` em `text-primary-strong`.
- `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`, `input-group.tsx`: fundo branco
  (`bg-card`) com borda `border-input`.
- `docs/evidence/tema-diretriz-precifica-2026-10-25/`: este pacote.

## DoD

1. Tokens computados no navegador iguais aos aplicados (creme/navy/ouro) — capture 02b (script
   `shots-theme.mjs` imprime `--background`, `--primary`, `--sidebar` etc.).
2. Tabela de contraste com todos os pares textuais PASS (AA) — capture 03.
3. `axe` da página pública e dos controles de auth sem violações `critical/serious`; contraste dos
   cards de `/produtos` verde nos quatro projetos — capture 11.
4. Build + `check:bundle` verdes; `check:ui-stack` verde (catálogo pinned intacto) — capture 11.
5. Matriz Playwright completa verde — capture 11.
6. Capturas do app comparáveis ao site (landing, auth, dashboard, produtos, chat, painel, mobile) —
   captures 05–12.

## Testes (falsificação)

- `captures/03-contraste-wcag.txt` é gerado de fórmula (HSL/OKLCH→sRGB→luminância relativa); um par
  abaixo do mínimo imprime FAIL e o DoD falha.
- O token computado diverge do CSS se o `@theme inline` não mapear `--primary-strong`/
  `--primary-display`; o script de screenshots falha ao ler os valores esperados.
- O teste E2E `public UI uses valid composed controls and has no serious a11y violations` roda axe
  no HTML real: se o ouro for usado como texto pequeno ou o botão voltar a quase-branco sobre ouro,
  o teste reprova.
- `products list meets WCAG AA text contrast with the seeded rows` cobre `text-success` e o badge
  âmbar sobre o novo creme.
- `check:ui-stack` / `check:bundle` reprovam se a mudança mexer no catálogo/base style ou estourar
  o orçamento.

## Riscos e limites declarados

- **Desvios de cor do site, por AA**: botão ouro com navy (site: quase-branco, 2,95:1) e foco/links
  em ouro escuro (site: ouro puro, 2,90:1 de componente). A paleta é a mesma; a luminância foi
  ajustada onde o axe reprovaria.
- **Tipografia**: site usa Sora (títulos) e Inter (texto); o app mantém Plus Jakarta Sans e
  JetBrains Mono. Trocar fontes exige novos hosts na CSP estrita — fora do escopo.
- **Semânticos**: verde/âmbar/vermelho não vêm do site (ele não define estados); foram mantidos os
  valores aprovados para não trocar significado por estética.
- **`.dark`**: espelho navy atualizado por coerência, mas o app não aplica `.dark`; nenhuma captura
  em dark mode.
- **Gradientes/utilitários premium** não são consumidos pelas telas hoje; foram recolorados para
  não sobrar resíduo esmeralda.
- **Gate local**: o worktree segue sem commit da dependência `motion` (sessão anterior), então
  `m02:lockfile-guard` continua bloqueando o `npm run check` completo; a cadeia é rodada passo a
  passo e registrada. O tema em si não muda lockfile.
- Sem teste de hardware real: cores foram validadas em Chromium/Firefox/WebKit via Playwright e por
  fórmula de contraste.

## Rollback

- `git checkout -- src/styles.css src/routes/index.tsx src/routes/auth.tsx
src/routes/_authenticated/inicio.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx
src/components/ui/select.tsx src/components/ui/input-group.tsx src/components/ui/badge.tsx
src/components/ui/button.tsx` restaura o tema zinc anterior.
- Sem migration, schema, env, deploy ou alteração de URL; o pacote de evidência é removível.
