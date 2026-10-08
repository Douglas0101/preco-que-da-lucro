# C29-FIX — chat do preview indisponível: variável de ambiente definida e vazia

**Data:** 2026-10-06 · **Alvo:** preview Vercel de `develop`
(`preco-que-da-luc-git-53d0a3-douglasultimatesouza-5127s-projects.vercel.app`, deployment
`dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8`, sha `9dd39f4`) · **Natureza:** incidente de configuração de
plataforma + dois defeitos de código na mesma superfície.

## 1. Sintoma relatado

O operador abriu a conversa de cadastro ("Novo Produto") na sessão real e enviou uma mensagem. A
resposta que apareceu no chat foi texto interno do servidor:

```
⚠️ AI gateway endpoint recusado pelo guard (https público obrigatório): URL inválida:
```

O turno **nunca chegou ao provedor**: o orçamento de IA foi reservado e liquidado sem consumo
(`ai.budget_settled … real=0, durationMs=95, outcome=error_dependency_error`). Reproduzido ao vivo
no navegador real do operador (captura `browser-chat-log.txt`).

## 2. Cadeia de causa (medida, não inferida)

| elo | fato medido                                                                                                                      | prova                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `AI_GATEWAY_URL` existe no ambiente do deployment **como string vazia** (registro criado no import do projeto, nunca preenchido) | mensagem do guard termina em `URL inválida: ` sem valor     |
| 2   | `process.env.X ?? default` **não** cai no default quando `X === ""` — devolve `""`                                               | `new URL("")` lança; o default documentado nunca é aplicado |
| 3   | o guard troca a mensagem de política pela de diagnóstico interno (`ApplicationError` com `message` próprio)                      | `src/lib/ai-endpoint.server.ts:38-41`                       |
| 4   | essa mensagem cruza a fronteira do server fn e é renderizada como fala do consultor                                              | payload HTTP 200 `{"$TSR/Error":{"message":"AI gateway…`    |

O mesmo mecanismo de forma atinge `RESEND_API_KEY=""`/`AUTH_EMAIL_FROM=""`, que é o motivo real de o
e-mail de verificação não chegar (grupo 1 de `runtime-errors.txt`) — não é falha do provedor de
e-mail.

## 3. Correção

**Código (`develop`):**

1. `src/lib/env.server.ts` — `readEnv(nome)`: "definida e vazia" conta como **não configurada**;
   espaços nas bordas são preservados para que a validação de credencial continue rejeitando
   `" chave "`. Aplicado às quatro leituras do caminho de IA (`AI_GATEWAY_URL`, `AI_MODEL`,
   `DEEPSEEK_API_KEY`, `AI_GATEWAY_API_KEY`/`LOVABLE_API_KEY`).
2. `src/lib/wire-safe-error.server.ts` — fronteira de saída: só a mensagem da política
   (`apiErrorMessage`) cruza a rede; o detalhe interno fica no log do servidor com o
   `correlationId` (`app.error_internal_detail`) e o erro original segue como `cause`.
3. `src/lib/chat.functions.ts` — usa `readEnv` nas quatro leituras, registra
   `ai.credential_unusable` (provedor, host, motivo `absent`/`padded`) quando a credencial é
   inutilizável, e envolve `sendChatMessage` na fronteira.
4. `src/lib/api-error.ts` — `apiErrorMessage(code)` expõe a mensagem pública já existente na
   tabela de políticas.

**Plataforma (preview/develop, registrado em `captures/vercel-env-preview.json`):**
`AI_GATEWAY_URL=https://api.deepseek.com/chat/completions` e `AI_MODEL=deepseek-flash` como
registros `plain`, `target:["preview"]`, `gitBranch:"develop"`. O registro compartilhado
production+preview original foi **preservado**; produção não foi tocada.

## 4. Evidência e não-vacuidade

| captura                       | o que prova                                                                |
| ----------------------------- | -------------------------------------------------------------------------- |
| `browser-chat-log.txt`        | repro viva do sintoma no navegador real, sessão do operador                |
| `wire-error-payload.txt`      | o texto interno cruza a rede no corpo do 200 da server function            |
| `runtime-errors.txt`          | `real=0` (falha local) + o grupo de e-mail sem adapter                     |
| `targeted-tests-green.txt`    | 36/36 verdes com a correção                                                |
| `negative-control-red.txt`    | os 4 testes novos **reprovam no código antigo** (controle negativo)        |
| `matrix-regenerated.diff.txt` | a matriz M-02 só muda por deslocamento de linha e pelos dois imports novos |
| `vercel-env-preview.json`     | metadados dos registros criados; nenhum valor de segredo lido              |
| `check-green.txt`             | cadeia `npm run check` verde no commit selado                              |
| `live-chat-after.txt`         | turno real de chat ponta a ponta após o novo deployment                    |

## 5. Resultado medido (antes × depois, mesma rota e mesmo tenant)

| sinal                                         | antes (`dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8`)    | depois (`dpl_FjFGGUbzRcG8BLKL8ikSjo4Hcfv9`)     |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `ai.model_attempt`                            | ausente (falha antes do `fetch`)              | `deepseek-flash` **success**, 1155 ms           |
| `ai.chat_completed`                           | ausente                                       | `rounds=1`, `timeToFinalMs=1528`                |
| `ai.budget_settled`                           | `real=0`, `error_dependency_error`            | `real=986`, **success**, `applied=true`         |
| conversa (navegador real, sessão do operador) | `⚠️ AI gateway endpoint recusado pelo guard…` | resposta real do consultor, produto a confirmar |

## 6. Limites declarados

- **Produção não foi verificada nem alterada** nesta rodada: o registro compartilhado
  `AI_GATEWAY_URL` de produção segue vazio, e o runtime publicado (Hostinger) exige decisão
  própria. O reparo aqui é do preview de `develop`.
- O cadastro de **novos** usuários continua dependendo de `RESEND_API_KEY`/`AUTH_EMAIL_FROM`
  reais, que são credencial e entram por **Via A** (operador). A conta em teste usa a liberação
  manual de `email_verified` registrada em L729.
- A fronteira de erro reescreve **`ApplicationError`**; erro genérico não é mascarado por decisão
  (redirecionais do framework são valores não-`ApplicationError`). Residual em `DBT-98`.
- A classe "definida e vazia" fora do caminho de IA (telemetria, driver de banco, vars de
  plataforma) é descoberta e tratada em `DBT-97`, não silenciada.
