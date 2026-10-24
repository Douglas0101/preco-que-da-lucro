# Auditoria visual + computer user — produção Vercel (2026-10-24)

**Ambiente:** `https://preco-que-da-lucro-sage.vercel.app` → `dpl_BtH5YVqmd2QTKs5V2fNRGuomrAeB`, `READY`, target `production`, SHA `b8bc52ec52503c3a299f22ed32e2e445046e0731` (main).
**Modo:** anônimo, somente leitura, `reducedMotion=reduce`; nenhuma escrita em produção.
**Ferramentas:** Playwright MCP (computer user, Chromium) + Playwright 1.62.1 + `@axe-core/playwright` 4.13.0 nos engines Chromium, Firefox, WebKit e Pixel 7 (mobile).

## Resultado executivo

**Não há defeito visual bloqueante nas páginas públicas.** A matriz de 16 combinações engine × página terminou com **0 violações axe WCAG 2.0/2.1 A/AA**, **0 overflow horizontal**, **0 imagens quebradas** e **0 erros 5xx**. O CTA de login mobile está visível no primeiro viewport (submit em 750–786 px de 839 px).

Os achados são de **prontidão de CSP**, **consistência de copy**, **autocomplete** e **ruído de console na rota protegida anônima**:

| ID   | Severidade             | Achado                                                                                                                                                                                                                                                                                               | Evidência                                                        | Recomendação                                                                                                                               |
| ---- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| V-01 | **Alta (enforcement)** | CSP Report-Only registra **3 `script-src-elem` inline + 2 `style-src-elem` inline** em todas as páginas; o style vem de `assets/dist-BBRdpqhi.js`. Sob `CSP_ENFORCE=true`, esses inline seriam bloqueados. A coleta no `/api/csp-report` funciona e registra `csp.violation` sem PII.                | `captures/03-csp-runtime.txt`; `captures/02-console-network.txt` | DBT-142: identificar e remover a injeção de style inline; tratar os scripts SSR/page-specific; **não promover a enforcement** antes disso. |
| V-02 | Média                  | A página 404 é o componente customizado de `src/routes/__root.tsx:18-38`, mas o texto é **hardcoded em inglês** (“Page not found”, “Go home”) dentro de um documento `lang=pt-BR`; o título é genérico (“Preço que Dá Lucro”) e não há shell/navegação.                                              | screenshot `chromium-404.png`; `captures/05-computer-user.txt`   | Traduzir para pt-BR, título “Página não encontrada · Preço que Dá Lucro” e link “Ir para o início”/“Entrar”.                               |
| V-03 | Baixa                  | Login: `<input id="email">` sem `autocomplete`; signup: `name` e `email` sem `autocomplete`. O password já tem `current-password`/`new-password`.                                                                                                                                                    | `captures/summary.json`; `src/routes/auth.tsx`                   | `autoComplete="email"` (login/signup) e `autoComplete="name"` (signup); o Chrome sugere `username`.                                        |
| V-04 | Baixa/Média            | Acesso anônimo a `/inicio` e `/novo-produto` chama o server function de dashboard (`period=month`), recebe **401** e registra console error antes de redirecionar. Firefox/WebKit também registram **unhandled rejection** no `/novo-produto`. O redirect funciona em 531–1002 ms e não expõe dados. | `captures/02-console-network.txt`; `captures/01-matrix.txt`      | Guardar a rota `_authenticated` **antes** do fetch de dashboard e tratar 401/abort como redirect esperado, não como erro de console.       |
| V-05 | Baixa                  | Ao alternar para “Cadastre-se”, o `h2` muda para “Vamos começar juntos”, mas o `document.title` permanece “Entrar · Preço que Dá Lucro”.                                                                                                                                                             | `captures/05-computer-user.txt`                                  | Título dinâmico por modo ou rotas separadas de login/cadastro.                                                                             |
| O-01 | Observação             | “Cadastre-se” (84×22), “Esqueci minha senha” (149×22) e “Voltar para entrar” (128×22) têm 22 px de altura. O axe WCAG 2.2 não acusou (exceção de espaçamento/inline), mas o alvo é pequeno no toque.                                                                                                 | `captures/04-axe-summary.txt`                                    | Considerar `min-h-6`/`py-1` nos links standalone.                                                                                          |
| O-02 | Observação             | 4 `POST /api/vitals` abortados com `net::ERR_ABORTED` durante a navegação/redirect. É abort de cliente, não 5xx; beacons RUM podem se perder na transição.                                                                                                                                           | `captures/02-console-network.txt`                                | Nenhuma ação obrigatória; monitorar a perda de RUM se for relevante.                                                                       |

## Matriz

| Engine   | `/`          | `/auth` login | `/auth` signup | `/rota-inexistente` | axe | overflow | redirect `/inicio` | redirect `/novo-produto` |
| -------- | ------------ | ------------- | -------------- | ------------------- | --- | -------- | ------------------ | ------------------------ |
| Chromium | 200 / 506ms  | 200 / 222ms   | 200 / 255ms    | 404 / 457ms         | 0   | false    | 690ms              | 720ms                    |
| Firefox  | 200 / 1087ms | 200 / 361ms   | 200 / 327ms    | 404 / 564ms         | 0   | false    | 875ms              | 713ms                    |
| WebKit   | 200 / 917ms  | 200 / 451ms   | 200 / 299ms    | 404 / 333ms         | 0   | false    | 531ms              | 1002ms                   |
| Pixel 7  | 200 / 567ms  | 200 / 238ms   | 200 / 219ms    | 404 / 286ms         | 0   | false    | 537ms              | 685ms                    |

`axe` = violações WCAG 2.0/2.1 A/AA; passes: home 9, auth 20 (mobile 18), 404 12. WCAG 2.2 extra no mobile (`wcag22aa`): 0 violações. Todos os redirects terminaram em `/auth` (`redirected=true`).

## Positivos

- **A11y:** 0 violações axe WCAG A/AA em 16/16; 0 violações WCAG 2.2 no mobile.
- **Layout:** 0 overflow horizontal; 0 imagens quebradas; desktop e mobile visualmente consistentes.
- **Mobile:** o card de login começa em 477 px, o form em 602 px e o submit “Entrar” em 750–786 px, dentro do viewport de 839 px — o CTA principal é visível sem scroll.
- **Performance percebida:** loads entre 219 ms e 1.087 ms; redirects entre 531 ms e 1.002 ms.
- **404:** status HTTP 404 real (não soft-404), com foco/h1/h2 corretos.
- **CSP:** o `/api/csp-report` recebeu e registrou `csp.violation` de todas as páginas, nos shapes `csp-report` e `reports+json`; `sample=null` e nenhum segredo/PII.
- **Sem 5xx** e sem escrita em produção.

## Metodologia

1. **Computer user (MCP Playwright, Chromium):** navegação em `/`, `/auth`, clique no CTA “Começar agora”, toggle “Cadastre-se”, `/inicio`, `/rota-inexistente`; snapshots de acessibilidade, console e rede; nenhuma submissão de formulário, OAuth ou escrita.
2. **Matriz local:** `docs/evidence/production-visual-2026-10-24/captures/scripts/production-visual-audit.mjs` — 4 engines × 4 páginas; screenshot full-page, `ariaSnapshot`, axe, console/rede, overflow; `/inicio` e `/novo-produto` anônimos para medir redirect.
3. **Mobile WCAG 2.2:** `.../mobile-wcag22.mjs` e `.../mobile-auth-viewport.mjs` — 412×839 (Pixel 7), alvos de toque e geometria do CTA.
4. **CSP runtime:** `tools.vercel.get_runtime_logs` no deployment `dpl_BtH`, query `csp.violation`, janela 30 min.

## Limites

- **Anônimo:** o dashboard e o chat autenticados **não** foram exercitados em produção; testar chat com dados reais violaria o contrato (produção não é alvo de teste). O caminho seguro continua sendo a **G4** (branch Neon efêmera + preview + usuário sintético), ainda pendente.
- **Domínio canônico:** `diretrizprecifica.com` é Hostinger Horizons, não este app; a auditoria foi no alias `sage`.
- **CSP:** a política está em Report-Only; os achados de inline são risco de enforcement, não quebra atual.
- **Artefatos brutos:** screenshots, axe JSON e aria snapshots ficam em `docs/evidence/visual/production-2026-10-24/` (gitignored, conforme AGENTS); o pacote inclui os resumos e os hashes em `captures/06-visual-artifacts.sha256`.
- **Visual gate:** esta auditoria **não** é o gate visual do ADR-033 (que usa fixtures e ambiente local/CI), e não substitui `verify-release`.
- **Dark mode:** o app é light-only por decisão (`src/styles.css`: “o app nunca aplica `.dark`”); não é um achado.

## Evidências

- `captures/00-environment.txt`
- `captures/01-matrix.txt`
- `captures/02-console-network.txt`
- `captures/03-csp-runtime.txt`
- `captures/04-axe-summary.txt`
- `captures/05-computer-user.txt`
- `captures/06-visual-artifacts.sha256`
- `captures/summary.json` (matriz bruta)
- `captures/mobile-wcag22.json`
- `captures/scripts/*.mjs`
- `MANIFEST.sha256`

## Reprodução

```bash
# na raiz do repositório, com browsers instalados
node docs/evidence/production-visual-2026-10-24/captures/scripts/production-visual-audit.mjs
node docs/evidence/production-visual-2026-10-24/captures/scripts/mobile-wcag22.mjs
node docs/evidence/production-visual-2026-10-24/captures/scripts/mobile-auth-viewport.mjs
```

Os scripts gravam os artefatos brutos em `docs/evidence/visual/production-2026-10-24/` e não fazem escrita na aplicação.
