# SPEC — percurso de primeiro cliente (2026-10-19)

> **Natureza:** este `SPEC.md` foi publicado em **2026-10-21**, na sessão de selagem, e **descreve o
> pacote tal como ele já existia**. O `README.md` do pacote é o registro do resultado.
>
> **Selo:** `MANIFEST.sha256` + este `SPEC.md` publicados na sessão de selagem de 2026-10-21. O **S6
> adversarial de contexto limpo NÃO foi executado** — o `README.md` do pacote declara o pacote como
> "não selado" e nada de selo foi simulado.

## 1. Fato-fonte

- Pedido do dono, em sessão: percorrer o sistema **como um cliente de primeira viagem** na bancada
  local `:4173`, com ramo ao vivo autorizado.
- Journal `docs/evidence/agent-state/PROGRESS.md` e o registry `docs/evidence/agent-state/DEBTS.md`
  (**DBT-127**) — o achado do grounding que bloqueia o turno com os números do próprio cliente.
- `README.md` §5 (capturas) e §21 (tabela de medição) — a fonte primária dos números abaixo.

## 2. Problema (medido)

Caminho de primeira viagem **sem nenhuma conta pré-existente**: cadastro → verificação de e-mail →
cold start de tenant → rotas vazias → primeiro produto → chat com os números reais do cliente. As
lacunas medidas foram: (a) a verificação de e-mail **bloqueia o login** e não há provedor para
`example.test`; (b) **não existe formulário de criação de produto** — a composição exige produto
existente, então o 1º produto só sai pelo chat; (c) o **grounding bloqueia a resposta inteira** quando o
turno traz os números do cliente (`unsupportedCount: 2`), **não registra nada** (`products=0`) e **não
faz a pergunta seguinte**.

## 3. Contrato (invariante falsificável)

> Uma conta nova, criada do zero, chega a um tenant vazio cujas telas **orientam e são honestas** (nenhum
> `R$ 0,00`, nenhum NaN, nenhum estado vazio apresentado como factual); o primeiro produto **existe**; e
> o chat, diante de figuras que ele **não** tem como fonte, **não afirma** a figura, **não registra** nada
> e **não** se cala.

## 4. Artefatos (o que o pacote contém)

Diretório `playwright-mcp/` (bytes crus, selados de formatação):

| artefato                         | papel                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `01-cadastro-form.png`           | tela do cadastro                                                                 |
| `02-cadastro-preenchido.png`     | cadastro preenchido                                                              |
| `03-cadastro-resultado.png`      | resultado do cadastro                                                            |
| `04-primeiro-login-inicio.png`   | primeiro login (início)                                                          |
| `05-produtos-vazio.png`          | produtos vazio                                                                   |
| `06-primeiro-produto-turno1.png` | turno 1 do chat com o primeiro produto                                           |
| `percurso-primeiro-cliente.txt`  | registro completo do percurso, **incluindo 3 erros do próprio teste** declarados |
| `verificacao-fix-dbt127.txt`     | verificação do ajuste do DBT-127                                                 |

## 5. DoD (critérios binários, com o artefato que os prova)

| etapa                                     | resultado medido                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| conta                                     | e-mail `cliente.novo+1792383572814@example.test` (senha descartável, declarada, nunca reaproveitada)                                      |
| tenant                                    | criado automaticamente no primeiro login: **"Cliente Novo"** (04:19:32Z) — o cold start bootstrappa tenant + membership                   |
| cadastro                                  | `POST /api/auth/sign-up/email → 200`; mensagem "Conta criada! Confirme seu e-mail para entrar." **efêmera** (toast ~4 s)                  |
| verificação                               | `email_verified=false` bloqueia o login; sem provedor para `example.test`; liberação local declarada (espelha o clique no link)           |
| tenant vazio                              | `/inicio` = "Bem-vindo!" + "Começar agora"; **0 × `R$ 0,00`**, 0 × NaN, 0 badge, 0 erro de console nas 9 rotas                            |
| estados vazios                            | todos orientam e são honestos ("Só dado factual entra no faturamento", "nenhum cenário é tratado como atual ou factual")                  |
| criação do 1º produto                     | **somente pelo chat** — sem formulário manual; a composição exige produto existente                                                       |
| chat, turno sem figuras                   | resposta conversacional normal, `real=940`, sem bloqueio                                                                                  |
| chat, turno **com** os números do cliente | grounding bloqueia a resposta inteira (`unsupportedCount: 2`), **nada registrado** (`products=0`), **sem próxima pergunta** → **DBT-127** |

## 6. Testes (e o que o pacote prova)

- `verificacao-fix-dbt127.txt` — verificação do ajuste do DBT-127.
- `percurso-primeiro-cliente.txt` — registro do percurso com **3 erros do próprio teste declarados**
  (a prova é o registro honesto do erro, não a ausência dele).

## 7. Riscos e limites declarados

- O MCP dirige **Chromium**; Firefox/WebKit foram exercitados **por script**, não por aqui.
- **Custo real: 3 turnos DeepSeek (3.271 tokens)**, autorizado pelo dono.
- O primeiro produto **só** existe pelo caminho do chat — a lacuna de formulário manual fica **declarada**,
  não fechada.
- **S6 adversarial não executado.**
- Nenhum commit, push, migration, deploy ou alvo remoto; **produção não foi tocada**; o tenant semeado
  dos gates não foi tocado (tudo no Postgres local).

## 8. Rollback

Nada a desfazer em Git (nenhum commit). O tenant de teste é local e descartável; o `README.md` declara
a conta e a senha como descartáveis e nunca reaproveitadas.
