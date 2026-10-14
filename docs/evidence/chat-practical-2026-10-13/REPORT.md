# Teste prático do chat — 2026-10-13

**Estado: cadastro reprovado na bancada; chat autenticado de produção pendente.**
O usuário pediu testes práticos do sistema, principalmente do chat, e reiterou
que a rodada inclui a aplicação publicada na Vercel. A prova local e a prova
remota abaixo têm escopos distintos.

## História e identidade

História: usuário entra em Novo Produto, informa uma receita, responde às
perguntas, e acompanha a gravação por ferramentas até receber uma resposta
coerente com o produto persistido. Fronteiras: navegador → server function →
PostgreSQL → provedor de IA/ferramentas → resposta renderizada.

- Fonte de aplicação publicada: `5d6049b9badf067b804bdc3062c922bab72c46d0`.
- Checkout documental: `f6f95bf401e9c577e83217a9ea1075d4be4f1411` em develop.
  O diff de `src`, `scripts`, manifests e Vite entre essas revisões está vazio.
- Produção Vercel: Sage, deployment
  `dpl_9v4ni1MyeWA6GhnoE7m3p5mpZRZM`, qualificado e promovido na operação anterior.
  A identidade da publicação anterior está em
  `../production-env-sync-2026-10-12/REPORT.md`.
- Bancada própria: container
  `3722fd94943aecc61ce0aab103a8fc16c231c4746800bbfb58e254ea4914ee25`,
  PostgreSQL 17.11 em `127.0.0.1:33253`, banco `preco_que_da_lucro_test`, aplicação
  em `http://127.0.0.1:51643`. Identidade, labels de propriedade, porta e modo
  READ ONLY foram assertados antes da inspeção SQL. O container existente em
  5432 e os bancos Neon permanentes não foram usados como fixtures.
- A bancada usa o consumidor real DeepSeek, `deepseek-flash`, endpoint nativo
  HTTPS, sem alterar o arquivo `.env` existente. Os parâmetros nominais foram
  aplicados somente ao processo da bancada; não foi demonstrada equivalência
  com os valores Secret da Vercel. A chave foi carregada pelo servidor e não
  foi copiada para evidência ou transcript.

## Resultado da bancada

Os três turnos usaram apenas dados fictícios: pizza com massa de R$ 4,00,
queijo de R$ 6,00, rendimento de 1 unidade, venda de R$ 30,00, regime MEI e
alíquota não informada. O usuário confirmou que não havia embalagem ou taxas.

| Fronteira                              | Resultado                             | Evidência                                                                                                                 |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Login e página do chat                 | PASS                                  | Sessão de fixture, heading Cadastro conversacional e compositor visível                                                   |
| Envio vazio e serialização             | PASS observado                        | Whitespace não habilita Enviar; compositor fica desabilitado durante o processamento e volta após a resposta              |
| UI → server function → IA              | PASS de transporte                    | Três respostas; no terceiro turno POST 200, 11.741 ms, modelo `deepseek-flash` com attempt 1/success                      |
| Execução e persistência de ferramentas | PASS de execução; FAIL da história    | 12 execuções `succeeded`, mas duas `create_product` para o mesmo cadastro                                                 |
| Dados informados no produto corrente   | PASS parcial                          | Preço 30, rendimento 1 unidade, regime MEI e `tax_rate: null`; a ausência não virou zero                                  |
| Consumo e orçamento                    | PASS                                  | 13/13 chamadas liquidadas com custo conhecido, 44.236 tokens de entrada e 2.004 de saída; reservas/in-flight finais zero  |
| Produto único por cadastro             | **FAIL — DBT-90 reproduzida**         | IDs diferentes retornados por `create_product` em dois turnos da mesma conversa                                           |
| Resposta final                         | Proteção aplicada; fluxo não aprovado | Dois números sem fonte bloquearam a resposta candidata; a tela exibiu orientação genérica em vez da conclusão do cadastro |

A conversa é `4ee3cb5c-6234-4b21-9e8f-b2307cffda8c`. Os produtos abaixo foram
identificados pelos IDs retornados por `create_product` bem-sucedidas, ligados
ao mesmo tenant/usuário e a essa sequência de mensagens. A janela SQL também
contém produto do seeder; ele não é contado como criação do chat.

| Turno | Produto criado                                            | Preço | Rendimento | Estado                                        |
| ----- | --------------------------------------------------------- | ----- | ---------- | --------------------------------------------- |
| 2     | `6df87d79-6602-4f7b-a0c9-1f90f294b201` — Pizza Margherita | null  | 1 unidade  | draft                                         |
| 3     | `362db98f-a395-4900-9b0b-98621e27d5cb` — Pizza Margherita | 30    | 1 unidade  | draft; produto corrente da conversa completed |

O turno 2 possui correlation ID `16686fcb-7438-4f57-a059-b6c589928c79`; o turno
3, `9cab6749-c3f7-445f-8f32-5ffc9acd5615`. O segundo ID agrega criação,
ingredientes, custos, rendimento, preço/imposto e `finish_product`.

O custo estimado persistido da rodada foi **USD 0,0156**, calculado com a
tabela nominal da bancada. É estimativa do aplicativo, não recibo de cobrança.
Os preços nominais foram conferidos na documentação oficial do
[DeepSeek](https://api-docs.deepseek.com/quick_start/pricing/) nesta sessão.

## Diagnóstico e correção necessária

A DBT-90 já estava ABERTA e foi reproduzida com a fonte publicada atual.
`gatewayToolsForState()` mantém `create_product` disponível quando há produto
corrente; o handler de `create_product` faz INSERT incondicional. A mensagem
system informa o ID corrente, mas essa instrução ao modelo não impede uma
segunda criação em outro turno. A evidência prova a duplicação; os pontos de
código citados explicam por que a camada de aplicação a aceita.

A correção deve preservar o rascunho identificado pela conversa quando o
usuário está continuando o mesmo cadastro, e permitir uma nova criação somente
quando houver intenção explícita de cadastrar outro produto. A validação deve
provar continuidade com um único ID e o controle negativo de que um novo
produto explicitamente pedido continua possível. Não basta contar ferramentas
`succeeded` ou retirar a proteção dos números financeiros.

O bloqueio de números sem fonte é comportamento previsto por
`AGENTS.md`/`financial-output-grounding.ts`; não é uma falha de autenticação da
IA. A mensagem segura foi persistida e o consumo real foi liquidado.
Não foi enviado um quarto turno após a confirmação da fronteira quebrada.
Não foram feitas novas mutações, reset do histórico ou correções de código.
Retomada, Diagnóstico e Simulações após o cadastro ficam sem veredito nesta
rodada; não foram presumidos verdes.

## Produção pela Vercel

Os GETs públicos foram executados nesta rodada, em 2026-10-13 04:24 UTC:

| Endpoint do Sage publicado               | HTTP | Corpo observado                              |
| ---------------------------------------- | ---- | -------------------------------------------- |
| `/api/health/live`                       | 200  | `status: ok`                                 |
| `/api/health/ready`                      | 200  | `status: ready`, `dependencies.postgres: ok` |
| `/api/auth/get-session`, cliente anônimo | 200  | null, sem sessão                             |

O painel autenticado da Vercel confirmou, por metadados, uma entry Secret
`DEEPSEEK_API_KEY` em Production e outra em Preview, adicionadas em 6 de
outubro. `AI_GATEWAY_URL`, `AI_MODEL` e `AI_MODEL_PRICING_JSON` existem como
Secret em Production/Preview, com entries Config específicas de develop para
URL/modelo. Os valores não foram revelados e a presença não prova seleção do
provedor nem sucesso da chamada na produção.

A aba do navegador apontou para
`https://preco-que-da-lucro-sage.vercel.app/auth?redirect=%2Fnovo-produto`,
sem o chat autenticado. O usuário informou que iria entrar; a conclusão do
login ainda precisa ser observada. **Não há veredito de resposta, persistência
ou consumo da IA de produção nesta rodada.** Nenhuma mensagem de chat foi
enviada em produção, nenhuma fixture/SQL foi aplicada e nenhum deployment,
alias ou ambiente remoto foi alterado.

## Capturas e limites

- `captures/bench-db-observation.json`: identidade, conversa, mensagens, IDs,
  ferramentas, valores e uso medido na bancada própria.
- `captures/inspect-bench.mjs` e `bench-inspection.txt`: inspeção READ ONLY com
  assertions de destino e propriedade; dois snapshots foram lidos, sem retries
  de chat.
- `captures/bench-turn-{1,2,3}.ax.txt`: respostas visíveis, com identificador
  sintético redigido antes da persistência textual.
- `captures/bench-turn-3.jpg`: área da conversa, excluindo o rodapé da conta.
  A primeira captura foi substituída antes do manifesto: formato JPEG com
  extensão correta e rodapé removido; nenhum dado de pessoa real estava nela.
- `captures/bench-runtime-observed-excerpt.json`: trechos selecionados do
  stdout observado, não um log integral.
- `captures/production-http-probe.json`: GETs públicos desta rodada.
- `captures/vercel-*-env-metadata.ax.txt`: nomes/escopos, nunca valores Secret.

Este é um recibo operacional de QA, não um selo de release/S6 e não fecha a
DBT-90. O fluxo reprovado não foi transformado em verde pelos checks anteriores
de release, pelo HTTP 200, por `completed` ou pelo ledger liquidado. O handoff
de recursos e a continuação do chat publicado são registrados no PROGRESS.

## Triagem forense DBT-115 e DBT-116 (sessão 2026-10-13T20Z)

Leitura de código, metadata de ambiente da Vercel e logs de runtime do deployment
vigente (`dpl_9v4ni1MyeWA6GhnoE7m3p5mpZRZM`, main `5d6049b`). Nenhum arquivo de
aplicação, env, deployment, alias, secret ou dado de produção foi alterado nesta
sessão.

### DBT-115 — `ai.credential_unusable`: configuração de produção incompleta, não bug de código

Cadeia provada:

1. `src/lib/chat.functions.ts:330-336` seleciona o provedor pelo **hostname** de
   `AI_GATEWAY_URL`; com a variável vazia, o endpoint cai no default
   `https://ai.gateway.lovable.dev/v1/chat/completions` (`provider=gateway`).
2. Linhas 349-351: no ramo gateway a credencial vem de `AI_GATEWAY_API_KEY ??
LOVABLE_API_KEY`; `readEnv` (`src/lib/env.server.ts`) trata "definida e vazia"
   como ausente.
3. Linhas 352-360: sem credencial, o código registra o evento nomeado e falha
   `DEPENDENCY_ERROR` **antes de qualquer fetch**. O log de runtime do deployment
   vigente registra `{"event":"ai.credential_unusable","provider":"gateway","host":"ai.gateway.lovable.dev","reason":"absent"}`
   em `2026-10-13T04:35:37.451Z`, e o detalhe da request registra
   "External APIs: No outgoing requests". A reserva de orçamento foi liquidada com
   `real:0` e `outcome:error_dependency_error` (`applied:true`).

Causa: o registro compartilhado `AI_GATEWAY_URL`/`AI_MODEL` (tipo sensitive,
Production+Preview, criado `2026-09-08T05:35:18Z`) está **definido e vazio** — estado
afirmado pelo comentário das próprias entradas plain de develop (`2026-10-06T14:56:40Z`,
"override de preview/develop porque o registro compartilhado esta definido e vazio") e
confirmado pelo comportamento de runtime. Em Production não há override equivalente;
`AI_GATEWAY_API_KEY` converge para o mesmo estado vazio. `DEEPSEEK_API_KEY` existe em
Production (`2026-10-06T14:20:00Z`) mas nunca é consultada porque o roteamento nunca
seleciona o ramo DeepSeek.

Classificação: **Cenário A — configuração (ação humana/Ops no painel; sem mudança de
código)**. Fix nominal (runbook `docs/runbooks/deepseek-web.md`), escopo Production,
espelhando o padrão plain de develop e com comentário apontando o runbook:

| Variável (Production)   | Valor nominal                                                       |
| ----------------------- | ------------------------------------------------------------------- |
| `AI_GATEWAY_URL`        | `https://api.deepseek.com/chat/completions`                         |
| `AI_MODEL`              | `deepseek-flash`                                                    |
| `AI_MODEL_PRICING_JSON` | `{"deepseek-flash":{"inputPerMillion":0.3,"outputPerMillion":1.2}}` |
| `DEEPSEEK_API_KEY`      | confirmar valor real (Via A); entrada existe desde 2026-10-06       |

Depois do preenchimento é obrigatório novo deployment (env muda só em build novo).
Escada de verificação pós-fix: rodada real no Sage com `ai.model_attempt ... outcome:success`
e ausência de `ai.credential_unusable`; se aparecer `provider:deepseek`/`reason:absent`,
a entrada da chave está vazia (Via A); se o provedor responder 401, a chave é inválida.
Não preencher `AI_GATEWAY_API_KEY`: a política proíbe reutilizar chave de outro emissor.

### DBT-116 — e-mail de autenticação sem entrega: par RESEND/AUTH_EMAIL_FROM vazio

`src/server/email/email-adapter.server.ts:82-99` exige o par e falha nomeando o estado
("definida e vazia"), sem fallback; `src/server/auth/auth.server.ts` opera com
`requireEmailVerification: true` e chama o adapter em `sendVerificationEmail`
(`sendOnSignUp`/`sendOnSignIn`) e `sendResetPassword`. O log do deployment vigente
(`2026-10-13T04:33:18.814Z`) mostra a falha em `sendVerificationEmail`. Impacto: cadastro
por e-mail não conclui verificação e recuperação de senha fica indisponível; OAuth e
sessões já verificadas não são afetados. Classificação: **configuração** — preencher
`RESEND_API_KEY` (Via A) e `AUTH_EMAIL_FROM` (remetente de domínio verificado no Resend;
dependente da conta/domínio da DBT-98), seguido de redeploy.

### Limites desta sessão

- A reprodução ao vivo no navegador (mensagem de sanidade no chat publicado) **não foi
  executada**: o login humano na janela controlada pelo Playwright não foi estabelecido
  (duas navegações seguidas a `/auth`). A rota alternativa oferecida (credenciais de
  banco no Neon) não substitui o login — senhas do app são hashes irreversíveis — e
  semear usuário/senha em produção violaria o contrato vigente (produção nunca é alvo
  de teste; entrada de credencial é Via A). A autorização de consulta ao Neon foi
  registrada e **não utilizada**: nada foi lido ou escrito no banco.
- A evidência de transporte continua sendo a rodada de `04:35Z` **no mesmo deployment**
  (nenhum deployment, env ou alias mudou desde então; aliases `updatedAt`
  `2026-10-13T02:17:46Z`, deployment criado `2026-10-13T01:41:15Z`): HTTP 200 de
  transporte no `/_serverFn/abb0f390...`, aviso de indisponibilidade na UI e nenhuma
  request externa.
- Avisos `csp.violation` report-only (script-src-elem/style-src-elem, inline)
  reapareceram nas navegações desta sessão, sem atribuição app × instrumentação —
  corroboram DBT-112, sem mudança de veredito.
- Esta triagem não fecha DBT-115/DBT-116; ambas foram registradas ABERTAS no registry
  (`docs/evidence/agent-state/DEBTS.md`) com closure tests de produção.

## Rodada QA runtime — re-verificação independente (2026-10-14, ~02:35–02:48Z)

Re-verificação read-only da sessão de 2026-10-13T20Z. Nenhum arquivo de aplicação, env,
deployment, alias, secret, SQL ou dado de produção foi alterado; nada commitado.

- Código relido diretamente e sem divergência: `src/lib/chat.functions.ts:330-360` (provedor
  pelo hostname de `AI_GATEWAY_URL`, default Lovable quando vazia; chave por ramo sem
  fallback cross-issuer; `ai.credential_unusable` logado e `DEPENDENCY_ERROR` lançado antes de
  qualquer fetch), `src/lib/env.server.ts:17-21` (definida-e-vazia ⇒ não configurada),
  `src/server/email/email-adapter.server.ts:82-99` (par obrigatório, estados nomeados) e
  `src/server/auth/auth.server.ts:39,43-54` (requireEmailVerification com envio pelo adapter).
- Erros agregados (24h, conector Vercel; retenção de log bruto Hobby = 1h): exatamente os dois
  grupos conhecidos, ambos no deployment vigente e sem ocorrência nova além de
  2026-10-13T04:35:37Z / 04:33:18Z. Nenhum 28P01.
- Logs de runtime (30m): tráfego desta sessão saudável (health/home/get-session 200 anônimo;
  vitals 204 good) e `csp.violation` report-only reconfirmado com diretiva/asset/linha —
  corrobora DBT-112; atribuição app × instrumentação segue pendente.
- Metadata de env (decrypted=false): entradas sensíveis de Production+Preview existem e nunca
  foram atualizadas desde a criação; `value:""` de entrada sensitive NÃO prova vazio
  (BETTER_AUTH_SECRET aparece idem e o auth opera) — a prova de inutilização é o runtime.
  `DEEPSEEK_API_KEY` Production existe; conteúdo não observável. Comentário humano das
  entradas plain de develop reconfirmado por leitura própria.
- Navegador: gate de autenticação alcançado (`/auth?redirect=%2Fnovo-produto`); a reprodução
  autenticada desta rodada não foi possível (sessão não persistida; login é Via A) e nenhuma
  conta foi criada em produção. A reprodução E2E vinculante é a rodada de 2026-10-13T04:35Z
  no mesmo deployment, já recibo neste pacote.
- Veredictos mantidos: DBT-115 e DBT-116 = Cenário A (configuração; ação Ops/Humana no painel
  com redeploy do mesmo SHA como verificação). Recibo adicional:
  `captures/qa-runtime-verification-2026-10-14.txt`; `MANIFEST.sha256` regenerado nesta rodada.

## Rodada E2E autenticada autônoma (2026-10-14, 03:03Z) — turno de sanidade executado

Executada com janela Chrome dedicada no host (perfil próprio do driver) depois que a sessão
autenticada foi estabelecida na janela (detectada 03:03:49.912Z; login humano único, Via A —
nenhuma credencial passou pelo agente). O driver Playwright enviou "Teste de sanidade DBT-115.
Responda com OK." na conversa limpa de `/novo-produto` e o turno foi capturado de ponta a ponta:
POST `/_serverFn/abb0f390...` 200 com o erro projetado ao cliente (`Um serviço necessário está
indisponível.`), UI com a bolha ⚠️ e toast, console sem erro JS; no servidor,
`ai.budget_reserved` → `ai.credential_unusable` (provider=gateway, host=ai.gateway.lovable.dev,
reason=absent, 03:03:53.933Z) → `ai.budget_settled` real:0 outcome=error_dependency_error →
`request.completed` 200 (correlationId 5bec3956-4368-4e1c-b8f6-87bd4f7d7051). O agregado 24h
passou a count=2 para o evento nomeado (nova ocorrência no dpl_9v4ni1M; sem 28P01). Nada de
env, deploy, alias, SQL ou código foi tocado; tenantId redigido. Recibo:
`captures/e2e-authenticated-2026-10-14.txt` (+4 PNG, console, corpo do POST e log do driver).
`MANIFEST.sha256` regenerado.
