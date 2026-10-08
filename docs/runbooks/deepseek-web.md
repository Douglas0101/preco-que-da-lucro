# DeepSeek — consumidor exclusivo do sistema Web

O MAESTRO confirmou em 2026-10-03 que a API alimenta somente o sistema Web.
O consumidor é `callModel` em `src/lib/chat.functions.ts`, executado no servidor
Nitro pelo circuito autenticado do chat. Não configurar um provedor do Codex,
SDK no navegador ou credencial em env pública. A preparação de código não prova
autenticação no provedor nem autoriza publicação antes dos gates de release.

## Configuração nominal do consumidor

| Nome no runtime Web     | Configuração                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AI_GATEWAY_URL`        | `https://api.deepseek.com/chat/completions`                                                                     |
| `AI_MODEL`              | `deepseek-flash`                                                                                                |
| `DEEPSEEK_API_KEY`      | Chave emitida pelo DeepSeek, inserida e submetida pelo operador Via A; valor fora do transcript                 |
| `AI_MODEL_PRICING_JSON` | Mapa validado do modelo para `inputPerMillion` e `outputPerMillion`; preços atuais conferidos antes da ativação |

No endpoint DeepSeek, a chave não tem fallback para `AI_GATEWAY_API_KEY` ou
`LOVABLE_API_KEY`. A chave DeepSeek também não é enviada para outros endpoints.
O destino nativo exige origem HTTPS exata, path `/chat/completions`, sem userinfo,
query, fragmento ou porta alternativa. Redirecionamentos são recusados no fetch.
Outros gateways conservam seu contrato de configuração e autenticação existente.

O modelo usa explicitamente `thinking: {type: "disabled"}`. O histórico atual
conserva mensagens e chamadas/resultados de ferramentas, mas não conserva
`reasoning_content`. A documentação exige reenviar esse campo em todas as
rodadas com ferramentas no modo thinking; omiti-lo produz HTTP 400. O modo
escolhido mantém o protocolo atual sem armazenar raciocínio no histórico.
Referências primárias: [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)
e [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/).

`max_tokens` fica em `min(8192, conservativeTokenBudget)` usando a reserva já
configurada em `AI_CONSERVATIVE_TOKEN_BUDGET`. 8192 corresponde ao default
documentado do modo sem thinking; não altera os limites diários, número de
rodadas, reserva, navegadores, testes ou timeout existentes. Esse teto limita
a saída; consumo de entrada e saída continua medido pelo ledger, com os casos
desconhecidos tratados pelo contrato vigente. Permanecem duas tentativas no
máximo e timeout por tentativa de até 30 segundos. [Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/).

Na medição documental de 2026-10-03, o modelo canônico é `deepseek-flash`.
Para estimativa conservadora em USD por milhão de tokens, a tabela de peak/cache
miss informa entrada 0,30 e saída 1,20. Configuração correspondente:

```json
{ "deepseek-flash": { "inputPerMillion": 0.3, "outputPerMillion": 1.2 } }
```

Esses valores são uma estimativa configurada, não uma fatura nem créditos de
uso. Descontos de cache/off-peak não são inferidos pelo ledger. Modelo retornado
sem preço correspondente mantém custo desconhecido, nunca zero fictício. Não
registrar preços ou valores de env em logs. Revalidar os valores na
[tabela oficial](https://api-docs.deepseek.com/quick_start/pricing/) antes de operar.

## Emissão, ativação e rotação — Via A

O console autenticado mostrou a chave nominal `Precifica-Chat`, tracking ID
50733d78-6756-4666-9f32-355224176848. Essa identidade não prova qual chave está
ativa no runtime. Não ler/copiar o valor existente para o agente.

1. Conferir conta, projeto, deployment e SHA do consumidor protegido, antes de
   inserir configuração. Não mudar o runtime antigo de `main` para uma variável
   que somente o candidato conhece. Preparar e validar primeiro em bancada de
   desenvolvimento isolada; produção aguarda o circuito de release completo.
2. O operador emite a chave substituta no DeepSeek, mantém a custódia fora do
   chat e a insere/confirma/salva como `DEEPSEEK_API_KEY` no runtime Web. O agente
   pode preparar campos nominais e acompanhar estados, sem ler a credencial.
3. Configurar URL/modelo/preços nominais, preservar orçamento e publicar o mesmo
   SHA autorizado. Nenhum ajuste de endpoint implica autorização de deploy.
4. Com conta legítima, executar uma conversa e uma rodada de ferramenta; conferir
   resposta, tenant autorizado, uso medido e estimativa persistida. Observar
   timeout/rate limit sem retry cego e ausência de secrets em logs/artefatos.
   O passo é executável por gate, contra bancada isolada:

   ```bash
   npx --no-install esbuild scripts/qa/deepseek-live-chat-gate.mjs --bundle \
     --platform=node --packages=external --format=esm \
     --outfile=.artifacts/qa-deepseek-live-chat-gate.mjs
   node .artifacts/qa-deepseek-live-chat-gate.mjs http://127.0.0.1:4174 <evidenceDir>
   ```

   O gate afirma os quatro turnos com resposta **real** (nunca a mensagem
   controlada), a serialização do compositor, a conversa `completed`, o produto
   com preço **e** rendimento e alíquota **ausente** (nunca zero), as ferramentas
   `succeeded` e todo `ai_usage` liquidado com **custo conhecido**. Exit `1` é
   veredicto (resposta não real ou estado não persistido), `2` é precondição —
   entre elas a **presença** de `DEEPSEEK_API_KEY` no ambiente da bancada,
   verificada só pelo nome: o valor nunca é lido. Ele envia quatro turnos e cria
   produto de fixture: use bancada descartável, nunca produção.

5. Somente após o consumidor novo funcionar, o operador revoga a chave antiga.
   Registrar ID/estado de revogação e status bruto do probe protegido. HTTP 200
   isolado, console autenticado ou saldo visível não fecha uma rotação.

Procedimento completo: [secret-rotation-blind.md](secret-rotation-blind.md).
A emissão/entrada/confirmação/submissão de credenciais permanece humana pela
Via A ratificada e pela política de computer use, inclusive com autorização
antecipada para integração. Não enviar tokens no chat.

## Evidências e limites desta implementação

Os testes exercitam o módulo real com respostas de transporte fictícias:
seleção da chave correta, ausência de fallback e envio a outro host, desvio de
path/porta/userinfo/query/fragmento, modelo incompatível, tool round-trip,
contagem e custo conhecido/desconhecido, redirect, quota, timeout e retry.
O build deve demonstrar que o canário fictício de `DEEPSEEK_API_KEY` e a referência
à variável não aparecem no JS público. Canário não é credencial do provedor.

Chamada real faturável, emissão/revogação, login/tenant do runtime publicado e
teste operacional de custo continuam pendentes. Testes locais/CI sem a chave
operacional não são evidência de integração autenticada em produção.

O gate do passo 4 **foi exercitado** contra bancada isolada com a chave do
operador: quatro turnos reais, sete ferramentas `succeeded` e custo conhecido
somado (US$ 0,0232 na janela medida). Os dois controles fecham o verde por
ausência: bancada **sem** a chave sai `2` sem tocar em nada, e chave canária
inválida — nunca credencial real — sai `1` com os quatro turnos no ramo
controlado. O que segue pendente é o **runtime publicado**: a entrada da
credencial no runtime Web permanece Via A e a publicação aguarda o circuito de
release.
