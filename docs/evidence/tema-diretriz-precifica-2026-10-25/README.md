# README — tema do sistema nas cores da Diretriz Precifica (2026-10-25)

**Natureza:** mudança de UI (tokens + classes de cor) ainda **não commitada** no worktree
`develop`. Nenhuma alteração de layout, tipografia, BFF, CSP, banco ou dependência; o catálogo
`check:ui-stack` continua intacto. Não é mudança arquitetural — não há ADR associada.

**Resultado:** creme quente + navy + ouro do site aplicados em todo o sistema, com contraste WCAG
2.2 AA preservado, `axe`/e2e verdes nos quatro engines e matriz Playwright completa **113 passed /
3 skipped / exit 0**.

## Paleta de origem (computed em https://diretrizprecifica.com/)

| Papel no site       | Cor                         | Uso no app                                   |
| ------------------- | --------------------------- | -------------------------------------------- |
| Fundo creme         | `#faf8f5` (hsl 40 33% 97%)  | `--background`, `--sidebar`                  |
| Navy de texto       | `#10182d` (hsl 224 47% 12%) | `--foreground`, `--card-foreground`, logo    |
| Ouro                | `#b88d1e` (hsl 43 72% 42%)  | `--primary`, `--sidebar-primary-foreground`  |
| Cinza-azulado claro | `#ebecf4` (hsl 224 28% 94%) | `--secondary`, `--muted`, `--sidebar-accent` |
| Tinta de ouro       | hsl(43 45% 94%)             | `--accent`                                   |
| Texto secundário    | `#535b6e` (hsl 224 14% 38%) | `--muted-foreground`                         |
| Bordas              | `#dbdee6` (hsl 224 18% 88%) | `--border`, `--input`                        |

O logo do site (quadrado navy com “D” ouro) foi replicado no header/landing/auth; o header deixou
de ser escuro e passou a ser o creme translúcido do site.

## Desvios declarados (AA antes de fidelidade)

- **Botão primário:** o site usa quase-branco sobre ouro (2,95:1, reprova AA); o app usa navy sobre
  ouro (5,75:1). Mesma dupla de cores da marca.
- **Foco/links de ouro:** ouro escuro `--primary-strong`/`--ring` (5,19:1) em vez do ouro puro
  (2,90:1 de componente).
- **Acento de título grande:** `--primary-display` (3,32:1) mantém o ouro vivo do site só onde o
  texto é grande (limite 3:1).
- **Fontes:** Sora/Inter do site não foram adotadas (exigiriam novo host na CSP); o app mantém Plus
  Jakarta Sans/JetBrains Mono.
- **Semânticos:** verde/âmbar/vermelho não vêm do site e foram preservados com os valores já
  aprovados (DBT-123); trocar por ouro apagaria significado.
- `.dark` ganhou espelho navy coerente, mas o app não aplica dark mode.

## Evidência

| Captura | Conteúdo                                                               | Resultado                                               |
| ------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| 00      | Escopo/diff dos 10 arquivos tocados                                    | +131/−100 linhas                                        |
| 01      | Extração da paleta no site (custom properties + amostras + gradientes) | HSL e HEX do site documentados                          |
| 01b     | JSON bruto da extração (tokens, amostras, top cores)                   | fonte primária                                          |
| 02      | Mapa site → tokens aplicados (OKLCH) e desvios                         | 16 tokens mapeados                                      |
| 02b     | Tokens computados no navegador                                         | creme/navy/ouro batem com o `:root`                     |
| 03      | Contraste WCAG de todos os pares                                       | 15/15 PASS (texto, botão, foco, semânticos)             |
| 04      | Referência: hero do site (1440×1000)                                   | —                                                       |
| 05–12   | App: landing, auth, dashboard, produtos, chat, painel, mobile          | capturas desktop e mobile                               |
| 11      | Testes e gate                                                          | 2.413 testes, ui-stack, bundle 486.930 B, E2E 20+113    |
| 13      | Precondição do `m02:lockfile-guard`                                    | motion sem commit (sessão anterior); tema não toca lock |

## Números medidos

- **Tokens:** `--background oklch(0.98 0.005 84.6)`, `--primary oklch(0.666 0.128 84.7)`,
  `--sidebar oklch(0.987 0.003 84.6)` computados no DOM (capture 02b).
- **Contraste:** foreground/background 16,66:1; muted-foreground/background 6,44:1; navy/ouro
  5,75:1; ouro forte/creme 5,19:1; display/creme 3,32:1; success/creme 4,67:1; warning escuro/âmbar
  8,86:1 — capture 03.
- **Gate:** cadeia `npm run check` passo a passo, 19/20 passos verdes (só `format:check` pegou o JSON
  de evidência copiado no meio da execução; reexecutado isoladamente → 0). Testes: **2413 passed**
  (30 skip); `check:ui-stack` ok; build ok; bundle inicial **486.930 B** (limite 500.000).
- **E2E:** focado (axe público, auth, contraste de `/produtos`, chat, painel) **20 passed** nos 4
  projetos; matriz completa **113 passed / 3 skipped / exit 0** (4,8 min).

## Limites e riscos residuais

- Gate completo continua bloqueado apenas por `m02:lockfile-guard` (dependência `motion` da sessão
  anterior sem commit); o tema não altera `package.json`/lockfile. O CI, com o lock commitado, roda
  o `check` inteiro.
- Sem captura/screenshot em dark mode (não aplicado) nem em hardware real.
- Os tokens `--chart-*` foram recolorados para ouro→navy mas não são consumidos hoje.
- `premium-hero`/`glass`/`gold-text` também não são consumidos hoje; foram recolorados para não
  deixar resíduo esmeralda.
- A paleta do site é pública e pode mudar; este pacote fixa a medição de 2026-10-25.
- **Selo:** `m02-seal --write` exige worktree limpo fora do pacote; sai 2 neste estado. O
  `MANIFEST.sha256` foi gerado no formato do selo e verificado por recomputação
  (`checked === discovered`); reexecutar o selo após o commit.

## Reprodução

```bash
npm run db:up && npm run dev
node .artifacts/design/shots-theme.mjs        # tokens computados + capturas do app
node /tmp/contraste-tema.mjs                  # tabela de contraste
playwright test -g "public UI uses valid composed controls|products list meets WCAG|floating consultor"
npm run check                                 # após commitar motion; hoje use a cadeia sem lockfile-guard
node scripts/m02-seal.mjs --dir docs/evidence/tema-diretriz-precifica-2026-10-25
```
