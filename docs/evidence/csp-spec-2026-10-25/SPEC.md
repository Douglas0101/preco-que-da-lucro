# SPEC — CSP com nonce por requisição (Épico A)

Par da proposta `docs/adr/ADR-048-csp-nonce-por-requisicao-e-hash-de-estilo.md`. **Nenhuma linha de
implementação existe ainda**: este documento define os testes que precisam falhar antes dela.

## 1. Precondições verificáveis

| #   | Precondição                         | Como se prova                                                                                                                                                                                                              |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Baseline atual verde                | `npm run check` exit 0 em `8c1b4d2` (captura `docs/evidence/release-2026-10-25-visual-corrections/captures/13-final-check.txt`)                                                                                            |
| P2  | Ausência de Next.js/`middleware.ts` | `node -e "require('./node_modules/next/package.json')"` falha; `ls middleware.ts` vazio                                                                                                                                    |
| P3  | Capacidade de nonce no TanStack     | `router.d.ts:372` (`ssr.nonce`), `hydrationScripts.d.ts`, `Asset.js:15-64`                                                                                                                                                 |
| P4  | Sonner sem suporte a nonce          | `grep -c nonce node_modules/sonner/dist/index.mjs` → `0`                                                                                                                                                                   |
| P5  | Arquivos-alvo livres de WIP alheio  | `git status --porcelain -- <arquivo>` vazio. **Hoje falha** para `src/lib/security-headers.ts`, `src/test/security-headers.test.ts`, `e2e/ui-stack.spec.ts`, `src/start.ts`, `ADR-043`, `AGENTS.md`, `MAPA-OPERACIONAL.md` |

P5 é bloqueante para o wiring e para o flip das travas. O que **não** depende de WIP: `src/lib/csp/nonce.ts`,
`src/test/csp-nonce.test.ts`, `e2e/csp-nonce.spec.ts`, `src/router.tsx` e `src/server.ts`.

## 2. Unitário — `src/test/csp-nonce.test.ts` (arquivo novo)

Execução: `npx vitest run src/test/csp-nonce.test.ts`.

| #   | Asserção                                                                                                                                               | Vermelho hoje                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| U1  | `withCspNonce(fn)` expõe um nonce que casa `^[A-Za-z0-9_-]{22}$` e 128 bits de entropia (dois contextos nunca repetem em 1.000 amostras)               | módulo não existe                          |
| U2  | `getRouter()` dentro do contexto produz `router.options.ssr.nonce === currentCspNonce()`                                                               | `getRouter` não lê contexto                |
| U3  | `getRouter()` fora do contexto produz `ssr.nonce === undefined` (fail-closed, sem valor residual de requisição anterior)                               | idem                                       |
| U4  | Dois `withCspNonce` concorrentes (`Promise.all`) não vazam nonce entre si                                                                              | idem                                       |
| U5  | Nonce fora do formato (`"x"`, `"a b"`, `""`, `"<script>"`, 23 chars) é descartado e a política sai **sem** `nonce-`, com código de log fixo            | idem                                       |
| U6  | `securityHeaders()` sem nonce devolve exatamente a política atual (mesmas 12 diretivas, mesma ordem, mesmos valores)                                   | passa hoje — **controle de não-regressão** |
| U7  | `securityHeaders({ nonce })` devolve `script-src 'self' 'nonce-<N>'` e `style-src 'self' 'sha256-<sonner>'`                                            | falha hoje                                 |
| U8  | Nenhuma política produzida contém `unsafe-inline`, `unsafe-eval`, `unsafe-hashes`, `strict-dynamic`, `*` ou host novo                                  | passa hoje; trava o futuro                 |
| U9  | O hash em `style-src` é igual ao `sha256` do literal passado a `__insertCSS(...)` em `node_modules/sonner/dist/index.mjs`                              | falha hoje (não existe hash na política)   |
| U10 | `CSP_ENFORCE=false` mantém report-only + `report-uri`/`report-to`; `=true` remove o canal e serve só as diretivas de fonte (contrato atual preservado) | passa hoje — não-regressão                 |
| U11 | Nonce não aparece em nenhum campo de log estruturado emitido pelo caminho de erro                                                                      | falha hoje                                 |

## 3. e2e — `e2e/csp-nonce.spec.ts` (arquivo novo, 4 projetos)

Regras do DoD: nenhuma interação com UI antes da prova de hidratação (`GET /api/auth/get-session` respondido,
como em `e2e/visual-corrections.spec.ts`). Sem `sleep` fixo.

| #   | Asserção                                                                                                                                              | Escopo                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| E1  | `content-security-policy-report-only` (ou `content-security-policy` sob enforcement) contém `script-src 'self' 'nonce-<N>'`                           | `/`, `/auth`, `/rota-inexistente`   |
| E2  | Todo `<script>` inline do documento tem `nonce="<N>"`; `document.querySelectorAll('script:not([src]):not([nonce])').length === 0`                     | idem                                |
| E3  | Dois requests consecutivos devolvem nonces **diferentes** (prova de que é por requisição, não por build)                                              | `/`                                 |
| E4  | `<meta property="csp-nonce" content="<N>">` presente e igual ao do header                                                                             | `/`                                 |
| E5  | Zero `console` de violação `script-src-elem` após o load (report-only ainda reporta)                                                                  | `/`, `/auth`                        |
| E6  | Zero `console` de violação `style-src-elem` (Sonner coberto pelo hash)                                                                                | `/`, `/auth`                        |
| E7  | `style-src-attr`: abrir um `Sheet` e um `Combobox` após hidratação e **medir** violações; o teste falha se aparecer `style-src-attr` não classificado | `/produtos` (autenticado) e `/auth` |
| E8  | Resposta de documento não é cacheável de forma compartilhável (`cache-control` sem `s-maxage`/`max-age>0` público) enquanto carrega nonce             | `/`                                 |

E7 depende de sessão autenticada: entra no tier e2e com `storageState` já existente e é o **único** item que pode
ser declarado `UNVERIFIABLE` se o harness autenticado não estiver disponível — nunca omitido em silêncio.

## 4. Controles negativos (a spec precisa provar que sabe reprovar)

| #   | Controle                                            | Deve reprovar |
| --- | --------------------------------------------------- | ------------- |
| N1  | Remover `nonce` do `ssr.nonce` mantendo o header    | E1/E2         |
| N2  | Manter o nonce fixo entre requests                  | E3            |
| N3  | Servir `script-src 'self'` sem nonce (estado atual) | E1/E2         |
| N4  | Trocar o hash do Sonner por valor de outra versão   | U9            |
| N5  | Aceitar nonce de 8 caracteres                       | U5            |
| N6  | Guardar o nonce em opção de router compartilhado    | U4            |

## 5. Ordem de execução (red-first)

1. Escrever U1–U11 e E1–E8 **antes** de qualquer código; rodar e registrar o vermelho
   (`npx vitest run src/test/csp-nonce.test.ts`, `npx playwright test e2e/csp-nonce.spec.ts`).
2. Implementar `src/lib/csp/nonce.ts` (ALS + validação) até U1–U5 verdes.
3. Threading em `src/server.ts`/`src/router.tsx` até U2–U4 e E1–E4 verdes.
4. Política de documento em `security-headers.ts` (**após P5**) até U7–U9 verdes.
5. Flipar as travas em `security-headers.test.ts` (**após P5**) e adicionar a asserção da política de documento.
6. Medir E7 e classificar `style-src-attr`; decidir §Decisão 5 do ADR com o número na mão.
7. Só então o soak de ≥ 7 dias e o gate de promoção.

## 6. Mapa DoD

| DoD              | Como este épico cumpre                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| Spec first       | §5.1 obriga o vermelho registrado antes do código                                     |
| Hydration-safe   | §3 exige prova de hidratação antes de abrir Sheet/Combobox                            |
| Multi-engine     | `e2e/csp-nonce.spec.ts` roda nos 4 projetos do `playwright.config.ts`                 |
| Evidência        | capturas desta pasta + `MANIFEST.sha256`; relatório de soak com contagem por diretiva |
| Commit semântico | `feat(csp):`, `test(csp):`, `docs(adr):` referenciando ADR-048                        |
