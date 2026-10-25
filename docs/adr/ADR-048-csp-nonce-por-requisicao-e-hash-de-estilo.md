# ADR-048 — CSP com nonce por requisição e hash do CSS de biblioteca

- Status: **PROPOSTA** — spec-first. Nenhum código de implementação foi escrito; a ratificação humana e a
  aprovação da spec de testes (`docs/evidence/csp-spec-2026-10-25/SPEC.md`) são precondição.
- Data: 2026-10-25.
- Escopo: substitui a **Parte B** (decisão de nonce) de `ADR-043-topologia-de-publicacao-e-csp-nonce.md`
  quando ratificada. A Parte A (topologia de publicação) não é tocada.
- Evidência: `docs/evidence/csp-spec-2026-10-25/` (medições reprodutíveis) e
  `docs/evidence/production-visual-2026-10-24/captures/03-csp-runtime.txt` (coleta real em produção).

## Contexto

### O stack não é Next.js

Medido em 2026-10-25: `next` **ausente**; `@tanstack/react-start` 1.168.60, `@tanstack/react-router` 1.170.41,
`@tanstack/start-server-core` 1.169.39, Vite 8.2.4, Nitro. **Não existe `middleware.ts`** em lugar nenhum do
repositório, e a aplicação não usa Vercel Edge Middleware. Qualquer desenho que presuma App Router, `middleware.ts`
ou `next/script` é inaplicável aqui: os headers nascem em `src/lib/security-headers.ts` e são aplicados por
`src/start.ts` (middleware de requisição) e `src/server.ts` (entrada do servidor).

### O que a política atual bloqueia de fato (report-only, medido em produção)

| Elemento inline           | Origem                                                | Hash / variabilidade                                                         |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `<style>` de 14.916 B     | **Sonner 2.0.8**, `__insertCSS` no escopo do módulo   | `sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=` — constante por versão |
| script de boot (613 B)    | TanStack Start/Router                                 | `sha256-zFML+AEdb/HsbX66VlYzBOqJKNNHs5/WNGYP8JiblyY=` — constante            |
| script de boundary (56 B) | TanStack Start (`$tsr-stream-boundary`)               | `sha256-REkTQ3mZNdOnZ0xWxlKdqBEAWdIVpJdIT6tm57gvq8Y=` — constante            |
| script `$R` (1.468 B)     | TanStack Start, serialização de hidratação por página | **página/dado-específico**: `HZK5…` em `/inicio`, `pmnv…` em `/novo-produto` |

A conclusão decisiva: **hash estático não cobre o `$R`**. O conteúdo muda com os dados da rota, então nenhuma
lista de hashes fecha `script-src` para este app. Nonce é o único caminho completo que não usa `'unsafe-inline'`.

### O Sonner não aceita nonce (medido)

`grep -c "nonce" node_modules/sonner/dist/index.mjs` → **0**. `__insertCSS` cria `<style>` sem `nonce` e roda no
escopo do módulo, antes de qualquer efeito de componente, então nem um `<Toaster nonce={…}>` chegaria a tempo. O
`<meta property="csp-nonce">` que o TanStack emite não é lido pela biblioteca.

Consequência: **nonce resolve `script-src`; `style-src` precisa de hash** (ou da remoção do Sonner, que é mudança
de UI fora desta decisão).

### Capacidade nativa verificada

`router.options.ssr.nonce` existe (`@tanstack/router-core/dist/esm/router.d.ts:372`); o nonce é repassado a
`createHydrationScripts(nonce)` (`ssr/hydrationScripts.d.ts`), a `getSsrBodyScriptParts(…, nonce, …)`
(`ssr/bodyScripts.d.ts`), aos assets de `HeadContent`/`Scripts` (`react-router/dist/esm/Asset.js:15-64`) e vira
`<meta property="csp-nonce">` (`headContentUtils.js:46-51`). Não é preciso reescrever o render.

### Travas que hoje proíbem nonce

`src/test/security-headers.test.ts:91-102` (WIP de outra sessão) assere: sem `unsafe-inline`/`unsafe-eval`/
`strict-dynamic`, **sem `nonce-`**, `script-src` exatamente `'self'` e `style-src` exatamente `'self'`. A Parte B
da ADR-043 decidiu não introduzir nonce. O `AGENTS.md` congela as diretivas. As três travas precisam mudar **na
mesma decisão** — não se muda uma sem as outras.

### Telemetria de soak já existe

`POST /api/csp-report` (`src/routes/api/csp-report.ts:45`) registra `logJson("warn", "csp.violation", …)` com
`effectiveDirective`, `blockedUri`, `documentUri`, `disposition` e `sample: null` (sem PII). Não é preciso
construir canal novo para medir a janela.

## Decisão

1. **Nonce por requisição de documento, com escopo de requisição explícito.** O nonce é gerado no início do
   tratamento (16 bytes aleatórios, base64url, 22 caracteres) e vive em um `AsyncLocalStorage` da requisição. O
   `getRouter()` lê o valor corrente e o entrega em `ssr.nonce`. **Proibido** gravar o nonce em opções de uma
   instância de router compartilhada: duas requisições concorrentes no mesmo isolate trocariam o valor.
2. **`script-src 'self' 'nonce-<N>'`.** Sem `'strict-dynamic'` na fase 1: `strict-dynamic` faz o navegador
   ignorar as allowlists de host, o que muda a superfície de scripts externos — é decisão separada, com medição
   própria. Sem `'unsafe-inline'`, sem `'unsafe-eval'`, sem host novo.
3. **`style-src 'self' 'sha256-StEaX…'` no modo documento.** O hash cobre o `<style>` do Sonner. Um teste lê
   `node_modules/sonner/dist/index.mjs`, extrai o literal de `__insertCSS` e compara com o hash da política: bump
   do Sonner **reprova** até o hash ser atualizado de propósito. `'unsafe-hashes'` **não** é necessário para
   `<style>` (ele serve a atributos `style="…"` e handlers inline) e não será introduzido.
4. **Modo explícito no construtor de política.** `securityHeaders({ nonce })`: com nonce → política de documento
   (script com nonce + hash de estilo); sem nonce → política atual, byte a byte (respostas JSON de server
   function, health, página de erro fora de contexto). A política não é inferida de `process.env` nem de estado
   global mutável.
5. **Enforcement separável por diretiva.** Se o soak medir violações de `style-src-attr` causadas por atributos
   `style` de biblioteca (`@base-ui/react` 1.7.0 usa `style:` em `otp-field`, `radio`, `switch` e `tooltip-arrow`),
   a promoção enforça o header **sem** `style-src` e mantém um segundo header
   `Content-Security-Policy-Report-Only` apenas com `style-src` + canal de report. Enforçar `script-src` e deixar
   `style-src` em observação é melhor que manter tudo em observação ou aceitar `'unsafe-inline'`.
6. **`CSP_ENFORCE` continua `false`.** A promoção exige o gate da §Gate cumprido com dados reais; nenhuma
   promoção no mesmo PR que introduz o nonce.
7. **Nonce nunca vem de cache compartilhado.** Respostas de documento permanecem não-cacheáveis de forma
   compartilhável (`cache-control: public, max-age=0, must-revalidate` medido, `age: 0`); o teste assere a
   propriedade e o `Vary` onde couber. Nonce servido de cache compartilhado é falha de segurança, não bug de
   performance.
8. **Fail-closed no formato.** Nonce fora de `^[A-Za-z0-9_-]{22}$` é descartado com log nomeado e a resposta sai
   **sem** nonce (política atual, report-only). Nunca se injeta valor não validado em header.
9. **`nonce` é valor sensível de resposta, não de log.** Não entra em log, métrica, artefato de teste ou
   mensagem de erro.

## Alternativas e justificativa

| Alternativa                               | Veredito                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Nonce por requisição (escolhida)**      | Único desenho que cobre o `$R` sem `'unsafe-inline'` e sem reescrever o render.                                                        |
| Só hashes estáticos                       | **Rejeitada por medição**: o `$R` é página/dado-específico; a lista nunca fecha. Serve apenas para `style-src` (Sonner), onde é usada. |
| `'unsafe-inline'`                         | Proibida pelo `AGENTS.md` e pela baseline de segurança. Não é opção.                                                                   |
| Nonce com `'strict-dynamic'` já na fase 1 | Adiada: muda a semântica de scripts externos; exige medição própria de que nada depende de allowlist de host.                          |
| Substituir o Sonner por toast próprio     | Fora de escopo agora: é mudança de UI em auth/chat/produtos e não é necessária para o objetivo.                                        |
| Manter report-only indefinidamente        | É o status quo; mantém a dívida aberta. Fica como fallback se o gate não fechar.                                                       |

## Consequências

- **Precondição de trabalho:** `src/lib/security-headers.ts`, `src/test/security-headers.test.ts`,
  `e2e/ui-stack.spec.ts`, `src/start.ts`, `docs/adr/ADR-043-…`, `AGENTS.md` e `docs/MAPA-OPERACIONAL.md` estão
  em WIP de outra sessão nesta data. A implementação só começa quando esse WIP entrar, ou em arquivos novos que
  não colidam (módulo de nonce, spec e2e dedicada, testes unitários novos).
- **Vacuidade a evitar:** manter a política de documento fora do teste que hoje congela as diretivas tornaria o
  T2 um verde sobre caminho morto. O fechamento exige que `security-headers.test.ts` assere a política de
  documento; até lá a dívida fica aberta e nomeada.
- **Risco nomeado `style-src-attr`:** componentes Base UI que escrevem atributo `style` seriam bloqueados sob
  enforcement de `style-src`. Por isso a §Decisão 5 existe e por isso o soak é obrigatório.
- **Sem migration, sem dependência nova, sem mudança de dados.**

## Validação (spec-first, vermelho antes do código)

Detalhe completo em `docs/evidence/csp-spec-2026-10-25/SPEC.md`. Resumo:

- **Unitário (novo):** nonce válido entra em `script-src` e no `ssr.nonce`; nonce inválido é descartado
  (fail-closed); dois contextos concorrentes recebem nonces diferentes; `securityHeaders()` sem nonce continua
  byte a byte igual ao contrato atual; hash do Sonner confere com o literal instalado; política nunca contém
  `unsafe-inline`, `unsafe-eval`, `unsafe-hashes`, `strict-dynamic` ou host novo.
- **e2e (novo, 4 projetos):** o header de documento contém `script-src 'self' 'nonce-<N>'`; todo `<script>` inline
  do HTML carrega exatamente `<N>`; dois requests consecutivos têm nonces diferentes; zero `script-src-elem`
  violado no console; zero `style-src-elem` para o Sonner; `style-src-attr` medido e classificado.
- **Controle negativo:** remover o nonce do render (ou do header) tem de reprovar a spec; um nonce fixo entre
  requests tem de reprovar a asserção de unicidade.

## Gate de promoção para `CSP_ENFORCE=true`

Todos os itens, com dados reais, em janela contínua de **≥ 7 dias**:

1. `csp.violation` de `script-src-elem` com `blockedUri: "inline"` e `documentUri` de mesma origem: **zero**.
2. `csp.violation` de `style-src-elem`: **zero** (Sonner coberto pelo hash).
3. `style-src-attr`: contagem medida e classificada; se houver violação de biblioteca, aplica-se a §Decisão 5.
4. e2e de CSP verde nos quatro projetos, com controle negativo verde.
5. Nenhuma resposta de documento cacheável de forma compartilhada com nonce.
6. `CSP_ENFORCE=true` só em PR próprio, com o header enforcado e o canal de report removido — como já é o
   contrato de `securityHeaders()`.

Faltando qualquer item, a política permanece report-only. O gate não é renegociável por prazo.

## Rollback

Reverter o threading do nonce e a política de documento; a resposta volta à política atual (`'self'`, report-only),
sem impacto em dados, schema, dependências ou disponibilidade. O `CSP_ENFORCE` nunca é ligado por este ADR.
