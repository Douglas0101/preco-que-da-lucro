# SPEC — WP5 `F-B1-e2e`

**Work package:** `F-B1-e2e` (Bloco 3, quinto na ordem canônica)
**Fato-fonte:** `docs/evidence/agent-state/QUEUE.md:82`
**Base:** `612c34bc9dfb49945854b29773362f012df07020` (develop pós-WP4)
**Branch:** `mission/wp5-analytics-e2e` · worktree `.worktree-wp5-analytics-e2e`

---

## 1. Problema

O `@vercel/analytics` só pode montar quando o build é para a Vercel. A decisão tem **uma única
fonte** — `process.env.VERCEL` em `vite.config.ts` — que escolhe duas coisas acopladas:

1. o preset do Nitro (`vercel` com `VERCEL=1`, `node-server` sem);
2. a constante de build `__VERCEL_ANALYTICS_ENABLED__` que o bundle **cliente** lê para decidir se
   monta o `<Analytics />` (`src/lib/vercel-analytics.ts`, `src/routes/__root.tsx:122`).

No preset `node-server` (local, CI, Hostinger) o caminho `/_vercel/insights/script.js` **não
existe**: montar o componente injeta um `<script>` que responde 404 com `text/html` sob
`X-Content-Type-Options: nosniff` em toda navegação (achado B-1, ciclo 3).

**Nenhum teste força a invariante `preset ≡ gate`.** Uma edição futura que troque a fonte do preset
(ou que mexa no `define`) pode desligar a analytics na Vercel — ou pior, ligá-la fora dela — **em
silêncio**. É o tipo de acoplamento que só é contrato se alguém o medir.

## 2. Contrato

- No preview **node-server** (sem `VERCEL`), a página pública **não pode** requisitar
  `/_vercel/insights/*`, e `window.va` permanece `undefined`.
- A asserção tem de ser **comportamental** (requisições de rede reais no browser), não textual.
- **Anti-vacuidade:** o listener é instalado **antes** do primeiro `goto`; o teste exige que o
  listener tenha visto o **documento** (e não só sub-recursos) e espera o **marcador de hidratação**
  do React (`__reactContainer$`, do `hydrateRoot(document)` do entry do cliente) antes de medir —
  sem hidratação, a medição não vale e o teste falha.
- O teste é a falsificação da invariante: com o gate forçado a `true` (mutação de scratch), a
  requisição **aparece** e o teste **reprova**; restaurado o byte, passa.

## 3. Mudanças

1. `e2e/analytics-gate.spec.ts` (novo) — o teste acima.
2. Este selo.

Fora de escopo: mudar o gate, o preset, o `vite.config.ts` ou a CSP; testar a Vercel real (não há
preset `vercel` executável localmente).

## 4. DoD

- [ ] a spec nova passa no preview node-server (zero `/_vercel/insights/*`, `window.va` undefined)
- [ ] falsificação: gate mutado para `true` ⇒ ≥ 1 requisição `/_vercel/insights/script.js` e spec
      **vermelha**; mutação restaurada byte a byte (sha256 antes/depois)
- [ ] `npm run check` exit 0 sobre os bytes finais
- [ ] `npm run test:e2e` completo (chromium/firefox/webkit/mobile do config) verde no preview
      node-server com PG17 efêmero
- [ ] `origin/main` intocado; `:5432` (H-9) com 0 listeners antes e depois; container removido no fim
- [ ] nenhum arquivo de `src/**` no diff além da mutação transitória de scratch (que não é comitada)

## 5. Testes

`e2e/analytics-gate.spec.ts`:

- instala `page.on("request")` antes do `goto`, acumulando as URLs de documento e filtrando
  `pathname.startsWith("/_vercel/insights/")`;
- visita `/` (heading público visível);
- espera o marcador de hidratação `__reactContainer$` (timeout 15 s) e dois frames após o commit;
- assere que o **documento** foi observado (instrumentação viva), `insights === []` e
  `typeof window.va === "undefined"` (string serializável — uma função não é, e a asserção sobre
  função seria inerte).

## 6. Riscos

| risco                                                       | mitigação                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| o teste pode passar por vacuidade (listener depois do goto) | listener antes do primeiro `goto` + mínimo de requisições observadas         |
| o gate mutado pode não injetar o script a tempo             | espera pelo marcador de hidratação (`__reactContainer$`) antes das asserções |
| a mutação pode vazar para o commit                          | `sha256` antes/depois + restauro conferido; a mutação nunca é `git add`      |
| o preview local pode divergir da CI (build/serve)           | o webServer do Playwright roda o mesmo `npm run build` + `npm run preview`   |

## 7. Rollback

Descartar a branch e o worktree. O diff é `e2e/**` + este selo; nada em `develop` antes do Gate C.

## 8. ERRATA (S6 adversarial, 2026-09-20)

O veredicto S6 (`captures/adversarial-wp5-verdict.md.txt`) auditou a entrega e corrigiu a prosa e o
instrumento **antes** do selo:

1. A §2/§5 descreviam uma segunda navegação autenticada (`/inicio`) que a entrega não faz — o
   Firefox abortava o `goto` com `NS_BINDING_ABORTED` e o `<Analytics />` vive no `__root`, então a
   asserção fica na página pública.
2. A espera de hidratação era um sleep fixo de 1,5 s (fail-open de timing): passou a ser o
   **marcador `__reactContainer$`** do `hydrateRoot(document)`, com dois frames de margem.
3. A asserção `window.va` era **inerte** (o `page.evaluate` não serializa funções): passou a
   `typeof window.va === "undefined"`, que é serializável e distingue o valor real.
4. A anti-vacuidade deixou de contar sub-recursos e passou a exigir o **documento** observado,
   provando que o listener antecedeu o `goto`.
5. A bateria ganhou guarda de porta `4173` (reuso de preview antigo) e uma fase `cleanup` com
   H-9 medida; o rótulo "requisições" da falsificação virou "ocorrências textuais" (4 requisições
   aparecem 2× cada no log).

O DoD da §4 é evidenciado no README do selo; a entrega final foi re-medida depois da correção
(falsificação e E1 re-executadas sobre os bytes finais).
