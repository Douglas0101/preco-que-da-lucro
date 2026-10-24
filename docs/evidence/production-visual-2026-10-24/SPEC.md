# SPEC — Auditoria visual + computer user da produção Vercel (2026-10-24)

## Fato-fonte

- Produção Vercel: `https://preco-que-da-lucro-sage.vercel.app` → `dpl_BtH5YVqmd2QTKs5V2fNRGuomrAeB`, `READY`, target `production`.
- SHA servido: `b8bc52ec52503c3a299f22ed32e2e445046e0731` (main; PR #68 mergeado).
- Data da auditoria: 2026-10-24, 23:44–23:54 UTC.
- Ferramentas: Playwright MCP (computer user, Chromium), Playwright 1.62.1, `@axe-core/playwright` 4.13.0, browsers Chromium/Firefox/WebKit/Pixel 7.
- O domínio canônico `diretrizprecifica.com` continua sendo Hostinger Horizons, não este app.

## Problema

Verificar visualmente e com um computer user real o sistema atualizado hospedado na Vercel, sem escrever em produção e sem usar dados de produção como fixture. A pergunta é se o release (`b8bc52e`) introduziu regressão visual, de acessibilidade, de console/rede ou de CSP nas páginas públicas e nos redirects de autenticação.

## Contrato

- **Somente leitura:** navegação anônima, sem login, sem submissão de formulário, sem OAuth, sem criar/alterar dados, sem deploy, sem DNS.
- **Sem segredos:** nenhuma credencial, `.env` ou valor sensível lido/impresso. Os logs CSP têm `sample=null` e não carregam PII.
- **Escopo:** `/`, `/auth` (login e signup via toggle), `/rota-inexistente`, e redirects anônimos de `/inicio` e `/novo-produto`.
- **Evidência:** screenshots, aria snapshots, axe JSON, console/rede e logs CSP brutos em `docs/evidence/visual/production-2026-10-24/` (gitignored); o pacote guarda resumos, hashes e scripts reproduzíveis.
- **Não é o gate visual:** esta auditoria não substitui `verify-release` nem o gate do ADR-033 (fixtures/ambiente local/CI).
- **Findings não são corrigidos nesta janela:** qualquer correção exige PR e novo ciclo de CI/CE.

## Mudanças

- Nenhuma alteração de aplicação, migration, Vercel, DNS ou banco.
- Apenas o pacote de evidência local `docs/evidence/production-visual-2026-10-24/` e os artefatos brutos gitignored em `docs/evidence/visual/production-2026-10-24/`.

## DoD

- [x] Computer user MCP executado em `/`, `/auth`, CTA, signup, `/inicio`, 404.
- [x] Matriz 4 engines × 4 páginas com screenshots, aria snapshot, axe e console/rede.
- [x] Axe WCAG 2.0/2.1 A/AA: 0 violações em 16/16.
- [x] Axe WCAG 2.2 (`wcag22aa`) no mobile: 0 violações.
- [x] Overflow horizontal e imagens quebradas verificados (0/0).
- [x] Redirects anônimos medidos (`/inicio`, `/novo-produto`) e console/network classificados.
- [x] CSP Report-Only coletado no runtime (`/api/csp-report` → `csp.violation`).
- [x] Achados documentados com severidade, evidência e recomendação.
- [x] `MANIFEST.sha256` selado.
- [ ] Chat/dashboard autenticados em produção — **NÃO EXECUTADO** por contrato; caminho seguro é a G4 (branch Neon efêmera + preview + usuário sintético).

## Testes

- `node docs/evidence/production-visual-2026-10-24/captures/scripts/production-visual-audit.mjs` — matriz Chromium/Firefox/WebKit/Pixel 7, axe, screenshots, console/rede, overflow.
- `node docs/evidence/production-visual-2026-10-24/captures/scripts/mobile-wcag22.mjs` — WCAG 2.2 e alvos de toque no Pixel 7.
- `node docs/evidence/production-visual-2026-10-24/captures/scripts/mobile-auth-viewport.mjs` — geometria do primeiro viewport (CTA visível).
- MCP Playwright: `/`, `/auth`, clique em “Começar agora”, “Cadastre-se”, `/inicio`, `/rota-inexistente`; snapshots + console + rede.
- Vercel MCP: `get_runtime_logs` com `query=csp.violation` no deployment `dpl_BtH`.

## Riscos

- **CSP:** os inline scripts/styles são reais; sob `CSP_ENFORCE=true`, o app pode quebrar. Não promover enforcement sem remover/tratar os inline. A coleta report-only funciona.
- **404:** copy em inglês em documento `lang=pt-BR`; inconsistência de idioma e de produto. É um defeito de UX/consistência, não de segurança.
- **Autocomplete:** ausência de `autocomplete` em e-mail/nome afeta password managers e preenchimento; não é violação axe WCAG A/AA.
- **Redirect anônimo:** o 401 é esperado, mas o server function de dashboard é chamado antes do redirect; Firefox/WebKit registram unhandled rejection no `/novo-produto`. Não há exposição de dados; é ruído de console/UX.
- **Produção:** qualquer teste autenticado com dados reais violaria o contrato; usar branch Neon efêmera e preview.
- **Artefatos:** screenshots/axe brutos são gitignored; o pacote guarda hashes. Reexecutar os scripts sobrescreve os brutos.

## Rollback

Nenhuma mutação de produção foi executada. Não há rollback a aplicar. Os artefatos brutos podem ser descartados ou reexecutados; o pacote é somente documental.
