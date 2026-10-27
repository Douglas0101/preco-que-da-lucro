# Regressão profunda — Onda 1 (2026-10-20)

Bateria de caça a bugs executada na bancada local `:4173` antes de qualquer push.
Nenhum recurso remoto foi tocado: banco de teste local, AI controlada (exceto 1
turno real autorizado), Vercel/Neon/Hostinger intocados. A árvore foi deixada
com o preview **controlado** (chaves de IA vazias) ao fim — **declarado no journal
(L976 como salvaguarda, L977 como feito), sem captura nesta pasta**; ver
"Limites declarados".

## Resultado por frente

| Frente                                 | Resultado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Evidência                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **0. Suíte E2E completa pós-correção** | ✅ **92/92** nos 4 projetos (chromium, firefox, webkit, mobile).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `captures/f0-e2e-full-after-fix.txt`                                                                                         |
| **1. Toaster lazy**                    | ✅ Sem quebra. Erro de API na landing: `h1` visível, 0 pageerrors, 0 console errors, Toaster não montado. Toast de validação em `/auth` aparece e não fica preso após sair. Toast autenticado sobrevive à navegação SPA e auto-dispensa.                                                                                                                                                                                                                                                                                                    | `captures/f1-toaster-static.txt`, `captures/f1-toaster-runtime.json`, `screenshots/f1-auth-toast.png`                        |
| **2. WebKit / animações**              | ✅ Sem reduced-motion: animações 100–200 ms rodando; 20 ciclos abrir/fechar; **20/20** retornos de foco; **0** diálogos órfãos; `nodeDelta 0`; dropdown Base UI seleciona; Sheet mobile abre, prende foco e ESC devolve ao gatilho.                                                                                                                                                                                                                                                                                                         | `captures/f2-webkit-manual.json`, `screenshots/f2-webkit-dialog.png`                                                         |
| **2b. CSP report no WebKit**           | 🔴 **Defeito real encontrado e corrigido.** O WebKit envia o objeto do Reporting API sob `application/csp-report`; o parser exigia `{csp-report}` e respondia **400**, cegando a coleta. Agora responde **204** e loga `csp.violation`.                                                                                                                                                                                                                                                                                                     | `captures/f2-csp-report-webkit.txt`                                                                                          |
| **3. Motor financeiro**                | ✅ Dízima `100/1,11 = 90,090…` → `rawUnits 90.090090…`, `roundedUnits 91`; margens finitas, sem NaN/Infinity; `DECIMAL_ZERO/ONE` compartilhados = `new Decimal` em 10k iterações; PBT 24/24.                                                                                                                                                                                                                                                                                                                                                | `captures/f3-finance-stress.json`, `captures/f3-pbt.txt`                                                                     |
| **3b. `age_days` e fuso**              | ✅ O mesmo `(há 2 dias)` em `America/Sao_Paulo` (UTC−3), `Pacific/Kiritimati` (UTC+14) e `Asia/Kolkata` (UTC+5:30); só a data local muda. `f3-age-America_Sao_Paulo.png` e `f3-age-Asia_Kolkata.png` são **byte-idênticos** (sha256 `47c51e070748552a…` nos dois) porque o teste valida a **invariância da data civil frente ao fuso**: os dois renderizam `17/10/2026 (há 2 dias)` e a imagem é a mesma. Só `Pacific/Kiritimati` (UTC+14) produz **data distinta** (`18/10/2026`) e por isso tem PNG próprio (sha256 `6a7d0aed97d0dcbd…`). | `captures/f3-age-timezones.json`, `screenshots/f3-age-*.png`                                                                 |
| **4. OTel**                            | ✅ Endpoint offline não bloqueia: health mediana 1,92 ms (sem endpoint) vs 3,02 ms (endpoint morto), sem erro de inicialização. Banco indisponível: `/api/auth/get-session` 500, server fn 503, UI redireciona para `/auth` sem pageerror; logger registra `request.failed`, `bff.request_failed`, `health.readiness_failed`. 500 forçado na UI mostra alerta + referência `DASH-…`, sem quebra.                                                                                                                                            | `captures/f4-otel-offline.txt`, `captures/f4-ui-500.json`, `captures/f4-db-down-logger.txt`, `captures/f4-real-db-down.json` |
| **5. Guard de e-mail**                 | ✅ Servidor auxiliar `:4174` com `RESEND_API_KEY=""`/`AUTH_EMAIL_FROM=""`: sign-up **503 `EMAIL_NOT_CONFIGURED`**, **0** usuários criados; sign-in existente continua **200**.                                                                                                                                                                                                                                                                                                                                                              | `captures/f5-email-guard.txt`                                                                                                |
| **5b. Produto manual**                 | ⚠️ **DBT-128 confirmada em aberto**: o empty state de `/produtos` só oferece `/novo-produto` (chat), sem formulário de criação. O caminho manual de **composição de produto existente** funciona: ingrediente salvo pela UI, linha no banco, toast, 0 erros.                                                                                                                                                                                                                                                                                | `captures/f5-manual-composition.json`                                                                                        |
| **6. Chat real (1 turno)**             | ✅ "Bolo de cenoura, rende 12, custa 15, vendo por 5": produto **criado** (`Bolo de cenoura`, preço/rendimento nulos), resposta seguinte pede confirmação de fatias/unidades, **0** figuras calculadas sem lastro e **0** eventos `financial_output_blocked`; 2 rounds, **4.260 tokens**, custo estimado **0,0014**.                                                                                                                                                                                                                        | `captures/f6-chat-live.json`                                                                                                 |
| **7. LCP A/B**                         | ✅ JS transferido **521.248 → 472.506 B** (−48.742, −9,4%). LCP **636 → 608 ms** (−28 ms, −4,4%); FCP **196 → 168 ms**; load **337 → 288 ms**. Ganho real, porém modesto: a landing é limitada por CSS/fontes, não pelo JS.                                                                                                                                                                                                                                                                                                                 | `captures/f7-lcp-ab.json`                                                                                                    |

## Achados que viraram correção

1. **CSP report do WebKit (corrigido neste ciclo).** `recordsOf()` passou a reconhecer
   a forma antes do media type: aceita `{csp-report}`, o objeto único do Reporting
   API e o array, mantendo a allowlist de media types e o filtro
   `type === "csp-violation"`. Testes: `src/test/csp-report.test.ts` (15/15).
   Isso não fecha DBT-112 (as violações inline continuam existindo), mas restaura
   a **coleta** delas no WebKit — antes invisível.
2. **DBT-128 permanece aberta.** Não há formulário de criação manual do primeiro
   produto; a paridade manual existe apenas para composição de produto existente.
3. **Limite de bancada, não do produto:** `--repeat-each=5` da suíte WebKit
   resultou em 50 passed / 5 failed, todas **429** de rate limit no mesmo bucket
   de IP dos testes de auth. A interação foi validada pelo teste manual de 20
   ciclos (20/20 foco, 0 órfãos). **Evidência:** `captures/f2-webkit-5x.txt`
   (55 testes, 2 workers; `50 passed (2.5m)` e `5 failed`, com `Received: 429`
   nas cinco falhas de authentication/authorization/CSRF).
4. **Limite do harness de chat:** o turno real terminou (`ai.chat_completed`),
   mas o script Playwright estourou o timeout padrão de 30 s porque as opções de
   `waitForFunction` foram passadas como `arg`. O produto, as mensagens e o
   `ai_usage` foram lidos do banco e são a prova do turno; nenhum turno extra
   foi pago.

## Limites declarados

- LCP é medição **local de laboratório** (Chromium, viewport mobile, CPU 4×,
  5 amostras, sem throttle de rede); não é RUM de produção.
- O chat usou **1 turno real** (custo aceito pelo dono: 4.260 tokens,
  0,0014 estimado). O restante da bateria rodou no ramo controlado.
- Nenhum push, deploy, migration, Vercel, Neon remoto ou Hostinger foi tocado.
- **Purga dos tenants temporários** (`Tenant Deep Manual`, `Tenant Deep TZ`,
  `Tenant Deep Chat`): **declarada no journal, sem captura neste pacote.** O
  journal registra a purga em **L977** e a intenção que a autorizava em **L976**
  ("semeear/purgar tenant próprio no banco de teste local"), mas **nenhuma
  captura desta pasta** lista as linhas antes/depois — e a string `Tenant Deep`
  não aparece em mais nada de `docs/evidence/`. Estado real: **registrado, não
  evidenciado por captura**.
- **Restauração do preview ao ramo controlado** ao fim: **declarada no journal,
  sem captura neste pacote.** A intenção **L976** a lista como salvaguarda ("a
  bancada volta ao ramo controlado ao fim para não consumir IA em e2e") e **L977**
  registra que foi feita, mas **nenhuma captura** mostra o estado de IA do
  preview depois da bateria — a única captura com eventos de IA é
  `captures/f6-chat-live.json`, que é justamente o **turno real** (o oposto do
  ramo controlado); não há nenhum `credential_unusable` em qualquer captura deste
  pacote. Estado real: **registrado, não evidenciado por captura**.
