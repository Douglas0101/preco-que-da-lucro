# SPEC — Sessão expirada não vira falha genérica do resumo financeiro (2026-10-25)

## Fato-fonte

- Relato do dono, com print: “Não foi possível carregar o resumo financeiro. Referência de
  atendimento: DASH-94CD7C2C”.
- Protocolo do `AGENTS.md`: reproduzir → coletar evidência → uma hipótese → uma correção → verificar;
  tratar vermelho como dívida, nunca como ruído; nenhum teste/regra afrouxado.

## Problema (medido)

Com a sessão revogada no servidor no meio do uso, o refetch de `getDashboardSummary` recebe **HTTP
401** com envelope `AUTHENTICATION_ERROR` (sem `x-tss-serialized`, com `x-correlation-id`). A UI:

- permanecia em `/inicio`;
- mostrava “Não foi possível carregar o resumo financeiro.” + `DASH-…` + “Tentar novamente”;
- não redirecionava para o login, apesar do handler DBT-86 1.5 em `src/router.tsx`.

Causa raiz: o fetcher do TanStack Start devolve o **`Response` cru** para respostas JSON sem o
protocolo serializado; `isFailureEnvelope` usava `value.ok === false`, e `Response.ok` é `false` em 401. O `Response` era classificado como envelope sem `error`, virando
`ServerFnEnvelopeError(INTERNAL_ERROR, status 500)`. `isAuthenticationError` retornava `false` e o
`QueryCache.onError` nunca limpava o cache/navegava. Numa variante, o wrapper de middleware lança o
`ApiError` interno (`{code:"AUTHENTICATION_ERROR"}`, sem `status`), também não reconhecido.

Segundo defeito: `createErrorReference` era duplicado em quatro rotas e gerava UUID aleatório no
cliente — a referência mostrada não existia em nenhum log; o servidor só registra o
`correlationId`.

## Contrato

- 401 de server function, em qualquer formato observado (`Response` cru, envelope JSON ou `ApiError`
  interno), é **erro de autenticação**: `unwrapServerFn` normaliza; `isAuthenticationError` reconhece;
  o `QueryCache.onError` limpa o estado autenticado e navega para `/auth` com `redirect` da rota de
  origem, sem card de erro e sem referência de suporte.
- Falhas **não** autenticadas (400/403/404/409/429/5xx/503/rede) continuam mostrando o card de erro
  e a referência; quando o erro traz correlação, a referência usa os 8 primeiros caracteres hex do
  `correlationId` (o mesmo id de `request.completed`/`request.failed`). Sem correlação, mantém o
  fallback aleatório anterior.
- Nenhuma mudança em layout, tema, dados, BFF, CSP, schema ou dependências; nenhuma regra de
  a11y/teste afrouxada.

## Mudanças

- `src/lib/server-fn-envelope.ts`: `isFailureEnvelope` não trata `Response` como envelope; o
  `Response` cru é mapeado pelo **status** (código de domínio) e pelo header `x-correlation-id` —
  sem ler/parsear corpo, para não introduzir `catch` que engole erro (INV-013); `isAuthenticationError`
  aceita envelope, `status === 401` e `ApiError` interno com `code === "AUTHENTICATION_ERROR"`.
- `src/lib/error-reference.ts` (novo): referência `<PREFIX>-<8 hex>` derivada de
  `error.correlationId`/header `x-correlation-id`, com fallback aleatório.
- `src/routes/_authenticated/{inicio,vendas,diagnostico,simulacoes}.tsx`: usam a referência
  compartilhada passando o erro da query; helpers duplicados removidos.
- `src/test/server-fn-envelope.test.ts` (+5 casos), `src/test/error-reference.test.ts` (novo, 4
  casos), `e2e/ui-stack.spec.ts` (teste do redirect em 401 no meio do uso).
- `docs/evidence/dashboard-sessao-expirada-2026-10-25/`: este pacote.

## DoD

1. Reprodução real (sessão revogada via `sign-out`): antes, card + `DASH-` e URL `/inicio`; depois,
   URL `/auth?redirect=%2Finicio`, zero `alert` — captures 01/04.
2. `Response` cru 401 e `ApiError` interno reconhecidos como autenticação (unitários verdes) —
   capture 04.
3. Referência nova coincide com o `correlationId` do servidor (8 primeiros hex) e mantém fallback
   sem correlação — capture 04 (testes) e 05 (exemplo com id do log).
4. E2E focado nos quatro projetos verde (sessão expirada + falha financeira 503) — capture 04.
5. Matriz Playwright completa verde e cadeia do `npm run check` verde (exceto
   `m02:lockfile-guard`, precondição de sessão) — capture 06.
6. Nenhuma instrumentação temporária residual; nenhum teste/regra removido — `grep` no diário.

## Testes (falsificação)

- Unitário do envelope: sem a normalização de `Response`, o caso 401 volta a produzir
  `INTERNAL_ERROR/500` e o teste falha; sem a detecção do `ApiError` interno, o caso do objeto
  plano falha.
- E2E “sessão expirada no meio do uso”: intercepta `**/_serverFn/**` com 401 no segundo refetch e
  exige `/auth?redirect=%2Finicio`, ausência de `DASH-` e de `role=alert`. Antes da correção o teste
  falhou nos quatro projetos (URL permaneceu `/inicio`).
- Script real (Playwright) revoga a sessão via `/api/auth/sign-out` e repete o refetch: mede o
  redirect sem depender de fixture de banco.
- Referência: teste unitário espera `DASH-08612561` para `correlationId
08612561-…`; com UUID aleatório o valor não bateria.
- O teste existente de falha 503 (“financial query failure is not rendered as empty or zero data”)
  continua exigindo card + `DASH-` + “Tentar novamente”: garante que só o 401 redireciona.

## Riscos e limites declarados

- Referências emitidas **antes** desta correção (como `DASH-94CD7C2C`) não são recuperáveis: o
  cliente nunca enviou esse token ao servidor. Só as novas referências são correlacionáveis.
- A detecção defensiva do `ApiError` interno aceita apenas `code === "AUTHENTICATION_ERROR"`;
  formatos novos de erro precisam de teste antes de ampliar.
- O redirect depende do `QueryCache.onError` do router; caches/consumidores fora desse QueryClient
  (ex.: scripts externos) não recebem o redirect — continuam vendo o erro.
- O 401 é tratado como sessão expirada por contrato; 403 continua card de autorização (não
  redireciona), sem mudança.
- Matriz local em máquina única (host), não no runner do CI.
- `m02:lockfile-guard` segue barrado pela dependência `motion` da sessão anterior sem commit; esta
  correção não toca `package.json`/lockfile.
- Durante o diagnóstico o `tsc` abortou uma vez com core dump (pressão de memória da máquina) e
  passou na repetição; registrado como instabilidade de bancada, sem alteração de código.

## Rollback

- Reverter `src/lib/server-fn-envelope.ts`, apagar `src/lib/error-reference.ts`, restaurar os
  helpers locais nas quatro rotas e reverter os três testes. Sem migration, env, deploy ou dado
  alterado; o comportamento volta ao card genérico com referência aleatória.
