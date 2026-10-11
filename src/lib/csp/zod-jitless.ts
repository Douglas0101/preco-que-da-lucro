import { z } from "zod";

/**
 * CSP `script-src 'self'` — sem `'unsafe-eval'`.
 *
 * `allowsEval` (`node_modules/zod/src/v4/core/util.ts:517-535`) sonda a
 * capacidade de JIT com `new F("")`. O `throw` é engolido, mas o navegador
 * reporta a tentativa como violação de `script-src`, e foi uma das violações
 * observadas em produção em 2026-10-08
 * (`docs/evidence/production-runtime-incident-2026-10-08/captures/browser-csp-report-only-violations.txt`,
 * "1x eval (script-src 'self', unsafe-eval not allowed)").
 *
 * `node_modules/zod/README.md:136` documenta a saída exata: "Global mode is
 * automatically disabled when `z.config({ jitless: true })` is set (e.g. CSP
 * environments); calling `z.compile()` directly is an explicit opt-in." A flag
 * vale para schema *novo*: nada muda na API pública e `z.compile()` segue
 * disponível como opt-in explícito.
 *
 * `globalConfig` vive em `globalThis.__zod_globalConfig`
 * (`node_modules/zod/src/v4/core/core.ts:224-228`), então uma chamada cobre o
 * bundle servidor e o cliente — mas ela precisa acontecer **antes** de qualquer
 * módulo que construa schema: `util.allowsEval` é um `cached(...)` lido durante
 * o `init` de `$ZodObject` (`schemas.ts:2364-2366`) e, uma vez lido, fica fixo
 * para o processo inteiro. Por isso este módulo aplica a configuração no
 * próprio escopo de módulo e é importado como **primeira** dependência do
 * `router entry`, que é o ponto de entrada presente nos dois runtimes
 * (`#tanstack-router-entry`, aliased em `resolve.alias` para os ambientes
 * `client` e `ssr`).
 *
 * A chamada no escopo do módulo é o que garante a ordem: se ela vivesse só no
 * corpo do `router entry`, rodaria *depois* das importações daquele módulo —
 * inclusive da árvore de rotas. E o export existe porque a raiz declara
 * `"sideEffects": false`: uma importação por efeito colateral pura é derrubada
 * pelo bundler (medido — a chamada desaparecia do grafo sem nenhum aviso), então
 * o entry importa o binding e o chama de novo, o que é idempotente.
 */
export function disableZodJitForCsp(): void {
  z.config({ jitless: true });
}

disableZodJitForCsp();
