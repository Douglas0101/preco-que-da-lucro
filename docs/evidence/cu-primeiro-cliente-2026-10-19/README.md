# Percurso de primeiro cliente — 2026-10-19

Pacote **não selado**. Conta criada do zero na bancada local (`:4173`, ramo ao vivo autorizado) para percorrer o sistema como um cliente de primeira viagem: cadastro, verificação, tenant vazio, todas as rotas e o primeiro produto pelo chat.

## Conta e tenant

- e-mail: `cliente.novo+1792383572814@example.test` (senha descartável, declarada, nunca reaproveitada)
- tenant criado automaticamente no primeiro login: **"Cliente Novo"** (04:19:32Z) — o cold start bootstrappa tenant + membership
- tudo no Postgres **local**; o tenant semeado dos gates não foi tocado

## O que foi medido

| etapa                                     | resultado                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| cadastro                                  | `POST /api/auth/sign-up/email → 200`; mensagem "Conta criada! Confirme seu e-mail para entrar." **efêmera** (toast ~4 s)                  |
| verificação                               | `email_verified=false` bloqueia o login; sem provedor para `example.test`; liberação local declarada (espelha o clique no link)           |
| tenant vazio                              | `/inicio` = "Bem-vindo!" + "Começar agora"; **0 × `R$ 0,00`**, 0 × NaN, 0 badge, 0 erro de console nas 9 rotas                            |
| estados vazios                            | todos orientam e são honestos ("Só dado factual entra no faturamento", "nenhum cenário é tratado como atual ou factual")                  |
| criação do 1º produto                     | **somente pelo chat** — sem formulário manual; a composição exige produto existente                                                       |
| chat, turno sem figuras                   | resposta conversacional normal, `real=940`, sem bloqueio                                                                                  |
| chat, turno **com** os números do cliente | grounding bloqueia a resposta inteira (`unsupportedCount: 2`), **nada registrado** (`products=0`), **sem próxima pergunta** → **DBT-127** |

## Capturas (bytes crus, selados de formatação)

`playwright-mcp/` — telas do cadastro (`01`–`03`), primeiro login (`04`), produtos vazio (`05`), turno 1 do produto (`06`) e `percurso-primeiro-cliente.txt` com o registro completo, incluindo **três erros do próprio teste** declarados.

## Limites declarados

- O MCP dirige Chromium; Firefox/WebKit foram exercitados por script, não por aqui.
- Custo real: 3 turnos DeepSeek (3.271 tokens), autorizado pelo dono.
- Nenhum commit, push, migration, deploy ou alvo remoto; produção não foi tocada.
