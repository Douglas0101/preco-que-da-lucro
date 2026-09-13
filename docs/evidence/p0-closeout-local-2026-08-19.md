# Fechamento P0 local — 2026-08-19

## Resultado

O lote P0 foi implementado e validado no espelho isolado abaixo:

```text
/home/douglas-souza/preco-que-d-main/.p0-closeout-docker
branch: codex/p0-closeout
base/public SHA: aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5
```

Este artefato representa evidência local. Não representa aprovação de CI, revisão externa, migração Neon, publicação, cutover ou produção.

## Implementação incluída

- Contratos financeiros: unidades allowlisted, dimensão compatível, conversão de unidade desconhecida em `null`, volume `real` rejeitado na simulação arbitrária e margem negativa classificada como ponto de equilíbrio inalcançável.
- Taxonomia de erro: códigos de domínio `INVALID_*`, `NON_*`, `DECIMAL_*`, `SIMULATION_*` e `SALE_*` chegam como `VALIDATION_ERROR`, sem virar `DATABASE_ERROR`/503 ou retry transitório.
- Resposta e logging: caminhos inesperados, `statusCode` e fallback SSR preservam correlação, headers de segurança, `no-store` em 5xx e redaction de URL de banco, Bearer, e-mail e atribuições de segredo.
- IA: resposta do gateway com limites de bytes/cardinalidade, janela de histórico limitada às mensagens mais recentes, lock transacional do rate limit, propagação do sinal do request, cancelamento como `AI_TIMEOUT`/`cancelled`, auditoria de rejeições, allowlist por estado básico, confirmação server-side e reciclagem de idempotência expirada.
- Testes: regressões financeiras, `ApiError`, redaction, gateway, allowlist, confirmação, idempotência expirada e auditoria.

## Gates locais executados

| Comando                             | Resultado observado                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                          | PASS — 21 arquivos, 248 testes                                                                                                          |
| `npm run format:check`              | PASS                                                                                                                                    |
| `npm run lint`                      | PASS                                                                                                                                    |
| `npm run typecheck`                 | PASS                                                                                                                                    |
| `npm run check:ui-stack`            | PASS                                                                                                                                    |
| `npm run check:no-supabase-runtime` | PASS                                                                                                                                    |
| `npm run build`                     | PASS — client, SSR e Nitro gerados                                                                                                      |
| `npm run check:bundle`              | PASS — entry 222859 minified / 68423 gzip / 59491 Brotli; grafo inicial 462672 minified / 147800 gzip / 129958 Brotli                   |
| `npm run db:check`                  | PASS — Drizzle reportou `Everything's fine`                                                                                             |
| `npm run db:test`                   | PASS — PostgreSQL 17, Better Auth, RLS, tool registry, auditoria, isolamento e semântica de chat                                        |
| `npm audit --audit-level=high`      | PASS no limiar high — 4 vulnerabilidades moderadas conhecidas em `esbuild` transitivo de `drizzle-kit`; nenhuma high/critical reportada |
| `npm run test:e2e`                  | BLOCKED antes do servidor — `E2E_AUTH_EMAIL` ausente                                                                                    |

## Ambiente local

```text
executor de Node/NPM: node:24.15.0-alpine
Docker Server: 29.7.2
PostgreSQL: container preco-que-da-lucro-postgres, postgres:17-alpine, healthy
driver: node-postgres
```

O `db:test` usou o banco local de teste em `127.0.0.1:5432` por meio de `host.docker.internal`. O teste altera fixtures locais como parte do próprio contrato; não acessou Neon.

O processo E2E foi tentado com o `.env` local existente no checkout original, sem imprimir ou copiar segredos. O setup abortou antes de migrations, seed ou inicialização do preview porque `E2E_AUTH_EMAIL` e `E2E_AUTH_PASSWORD` não estavam disponíveis.

O `db:test` emitiu o warning conhecido do Better Auth sobre ausência de IP do cliente no executor local; o runtime deve encaminhar um IP confiável quando estiver atrás do proxy correspondente.

## Limites de aprovação

- O checkout original foi preservado. O espelho desta implementação é um clone aninhado não versionado no checkout original; nenhuma alteração foi enviada ao remoto.
- Não houve push, PR, execução de GitHub Actions, análise Sonar, mutação Neon, aplicação de migração remota, branch preview ou cutover.
- Como o E2E está bloqueado por credenciais locais ausentes, ainda não há prova executada no wire para cross-site CSRF, chamada direta autenticada sem navegação, cookie de produção e rotação de role. Esses itens permanecem `blocked`, não `passed`.
- A correção de allowlist/confirmação deste lote é uma barreira server-side mínima baseada no estado do produto e na confirmação textual explícita; uma FSM persistida completa e campos first-class adicionais de `tool_call_id`/budget de custo exigiriam uma expansão arquitetural/migração fora deste lote.
- O audit moderado de `esbuild` não foi “corrigido” com `npm audit fix --force`, pois a sugestão troca `drizzle-kit` por uma versão potencialmente incompatível.

## Conclusão operacional

Estado local: **implementado e validado nos gates disponíveis; E2E bloqueado por credenciais; release/CI/Neon/cutover não avaliados**.
