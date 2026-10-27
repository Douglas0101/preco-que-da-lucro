# README — diagnóstico e correção: “Não foi possível carregar o resumo financeiro” (DASH-94CD7C2C)

**Natureza:** correção de defect de autenticação/observabilidade encontrada em uso real, mais
diagnóstico do incidente relatado. Worktree `develop` **sem commit**; nenhuma migration, env,
dependência ou mudança de dados.

**Resultado:** um 401 de sessão expirada no meio do uso agora **redireciona para o login** com o
destino preservado (`/auth?redirect=%2Finicio`), sem card de erro e sem referência de suporte. As
demais falhas financeiras continuam exibindo o card — agora com a referência correlacionada ao
`correlationId` do log. Gate local verde (20/20 passos exceto o lockfile da sessão) e matriz
Playwright completa verde.

## Diagnóstico em uma linha

O fetcher do TanStack Start entrega o **`Response` cru** (ou o `ApiError` interno) em respostas 401
sem `x-tss-serialized`; `isFailureEnvelope` lia `Response.ok === false` como envelope, produzia
`ServerFnEnvelopeError(INTERNAL_ERROR, 500)`, e o handler de sessão expirada (DBT-86 1.5) nunca
disparava. A referência `DASH-…`, além de aleatória, não existia em log nenhum.

## Evidência

| Captura | Conteúdo                                                                 | Resultado                                                              |
| ------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 01      | Relato + log do servidor (401) + resposta 401 crua + comportamento antes | URL permanecia `/inicio`; card `DASH-…`; sem redirect                  |
| 02      | Causa raiz detalhada e o que **não** era causa                           | `Response.ok=false` confundido com envelope; referência sem correlação |
| 03      | Diff da correção (envelope, referência, rotas, testes)                   | normalização por status/header; referência correlacionada              |
| 04      | Verificação depois: 401 real → `/auth?redirect=%2Finicio`; E2E focado    | 0 alerts; 8/8 testes focados nos 4 projetos                            |
| 05      | Prova da correlação referência × `correlationId`                         | `DASH-08612561`, `DASH-B17DE025`, `DASH-F9E35F8D`                      |
| 06      | Cadeia do gate + matriz Playwright + flakes de bancada                   | 20/20 passos; 2424 testes; 117 passed/3 skipped (workers=2)            |
| 07      | Dashboard saudável após a correção (sessão válida)                       | heading “Olá! 👋”, 0 alerts, Trimestre ok, painel com 3 turnos         |

## Números medidos

- **Reprodução antes:** refetch com sessão revogada → HTTP 401 + card “Não foi possível carregar o
  resumo financeiro.” + `DASH-6A91FCD3`; URL `/inicio`; “Tentar novamente” repetia o 401.
- **Depois:** mesmo cenário → `/auth?redirect=%2Finicio`, **0** `role=alert` e **0** `DASH-`.
- **Unitários:** `server-fn-envelope.test.ts` 14 casos e `error-reference.test.ts` 4 casos; INV-013
  (`finance.result-invariants`) segue verde — a correção final não adiciona `catch` que engole erro.
- **Gate:** 20 passos da cadeia `npm run check` (sem `m02:lockfile-guard`) exit 0; **2424 testes**
  passaram (30 skip); build ok; bundle inicial **487.544 B** (limite 500.000).
- **Dashboard saudável:** com sessão válida, `/inicio` carrega 200, “Trimestre” refaz a query sem
  alerta e o painel do Simon restaura os 3 turnos; 0 `pageerror`/console error — captura 07.
- **E2E:** focado 8/8 (sessão expirada + falha 503, quatro projetos) e **matriz completa
  117 passed / 3 skipped / exit 0** no run limpo com `--workers=2` e sem retries — captura 06.
  Duas tentativas anteriores em paralelismo default tiveram flops diferentes (parser em
  `page.evaluate` e sign-in da fixture devolvendo 401), ambos aprovados isoladamente; a condição e
  a repetição estão registradas na captura 06.

## O que **não** era o problema

- Dados financeiros: com sessão saudável o mesmo `getDashboardSummary` responde 200
  (`productCount: 2`, `fixedExpenses: "600.0000"`, margem vazia explícita).
- Tema, chat, animações ou scrollbar: nenhum desses fluxos participa da autenticação da server
  function; o 401 vem do middleware de sessão.
- NaN/payload inválido: o guard `isDashboardSummaryValid` não rejeitou o payload saudável.

## Limites e riscos residuais

- A referência `DASH-94CD7C2C` do relato **não é recuperável**: o token anterior era aleatório no
  cliente e nunca foi enviado ao servidor. As referências novas são correlacionáveis.
- 403 continua sendo card de autorização (não redireciona); só 401 é tratado como sessão expirada.
- A detecção defensiva do `ApiError` interno aceita apenas `code === "AUTHENTICATION_ERROR"`.
- Scripts externos que não usam o `QueryClient` do router não recebem o redirect.
- `m02:lockfile-guard` segue bloqueado pela dependência `motion` da sessão anterior sem commit;
  este pacote não toca `package.json`/lockfile.
- **Flakes de bancada documentados:** o Vitest abortou uma vez ao iniciar worker jsdom
  (`SyntaxError: Missing initializer in const declaration`) com 2416 testes passando; o retry da
  cadeia passou 2424/2424. A matriz teve uma falha de parser em `page.evaluate` (`Unexpected
template string`) no projeto mobile; o teste passou isolado em 2,6 s e a matriz foi repetida.
  Ambos são instabilidade de ambiente (o jsdom já tem esse registro no `vitest.config`), não
  deficiência de teste; a repetição limpa está na captura 06.
- Matriz local no host, não no runner do CI.

## Reprodução

```bash
npm run db:up && npm run dev
node .artifacts/design/diag-401.mjs          # revoga a sessão via sign-out e refaz o refetch
node .artifacts/design/diag-401-raw.mjs      # mostra status/headers/corpo do 401
npx vitest run src/test/server-fn-envelope.test.ts src/test/error-reference.test.ts
playwright test -g "sessão expirada no meio do uso|financial query failure"
node scripts/m02-seal.mjs --dir docs/evidence/dashboard-sessao-expirada-2026-10-25
```
