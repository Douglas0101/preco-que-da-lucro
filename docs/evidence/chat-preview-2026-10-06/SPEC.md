# SPEC — C29-FIX (chat do preview: env vazia + fronteira de erro)

## Objetivo

Restabelecer o turno de chat no preview de `develop` e impedir que diagnóstico interno do servidor
apareça para o usuário final, sem afrouxar guarda alguma.

## Write-set declarado

| caminho                                        | mudança                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/env.server.ts`                        | novo: `readEnv` (vazio = não configurado)                          |
| `src/lib/wire-safe-error.server.ts`            | novo: fronteira de erro do server fn                               |
| `src/lib/api-error.ts`                         | `apiErrorMessage(code)`                                            |
| `src/lib/chat.functions.ts`                    | `readEnv` nas 4 leituras, log nomeado, fronteira no handler        |
| `src/test/model-gateway.test.ts`               | 4 testes da classe "definida e vazia"                              |
| `src/test/wire-safe-error.server.test.ts`      | 4 testes da fronteira (+ limite declarado)                         |
| `docs/specs/M-02/matrix.yaml` (+ `.generated`) | regeneradas por `m02:matrix:generate`                              |
| `docs/evidence/chat-preview-2026-10-06/**`     | este pacote                                                        |
| `docs/evidence/agent-state/DEBTS.md`           | DBT-97, DBT-98                                                     |
| `docs/evidence/agent-state/PROGRESS.md`        | L731 (intenção) e L732 (resultado)                                 |
| plataforma Vercel                              | 2 registros `plain` preview/develop (`AI_GATEWAY_URL`, `AI_MODEL`) |

Fora do write-set e preservados: `docs/evidence/ciclo-29/**`, `docs/evidence/local-ci/**`,
`.zcodeignore` (custódia de outras sessões).

## Fora de escopo (declarado)

- produção/Hostinger e o registro compartilhado de produção;
- credenciais (Resend, DeepSeek): leitura/gravação continuam Via A;
- saneamento de erro genérico e das demais superfícies de toast (DBT-98).

## Critério de aceitação

1. `npm run check` exit 0 no commit do write-set (cadeia completa, sem passo pulado).
2. Os 4 testes novos reprovam no código antigo (controle negativo) e passam no novo.
3. Turno real de chat concluído no preview, em sessão autenticada, com resposta do modelo e
   orçamento liquidado com consumo > 0.
4. Nenhum texto interno de diagnóstico visível na UI de chat.
