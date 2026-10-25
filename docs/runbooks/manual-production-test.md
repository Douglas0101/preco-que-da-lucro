# Teste manual em produção (Vercel) — roteiro e expectativas

- Alvo: `https://preco-que-da-lucro-sage.vercel.app` (alias `sage`).
- Identidade no momento da escrita: `main` `e542aeb`, deployment `dpl_GcsE1qJy7zSV6rvkTUZfS35m3iHc`.
- **O domínio `diretrizprecifica.com` não serve este app** — hoje é Hostinger Horizons. Teste pelo alias.
- Escopo: verificação manual de fluxos que o e2e não cobre (autenticado, escrita, IA). Não substitui gate.

## 1. Correções publicadas que devem estar visíveis

| #   | Passo                                                  | Esperado                                                                                                                           |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir `/rota-inexistente`                              | HTTP 404; `404`, "Página não encontrada", "A página que você procura não existe ou foi movida.", botão "Ir para o início"          |
| 2   | Olhar o título da aba no 404                           | Vira "Página não encontrada · Preço que Dá Lucro" logo após carregar (o SSR entrega o título genérico por <1 s — limite declarado) |
| 3   | Abrir `/auth`                                          | Título "Entrar · Preço que Dá Lucro"; e-mail com autocomplete de e-mail; senha `current-password`                                  |
| 4   | Clicar "Cadastre-se"                                   | Título "Criar conta · Preço que Dá Lucro"; nome com autocomplete `name`; senha `new-password`                                      |
| 5   | Medir "Esqueci minha senha" e "Cadastre-se" no celular | Altura >= 24 px (medido 30 px)                                                                                                     |
| 6   | Deslogado, abrir `/inicio` e `/novo-produto`           | Redireciona para `/auth?redirect=…` em < 1,5 s, sem 401 no console e sem `pageerror`                                               |

## 2. O que não é bug

- **Console com mensagens de CSP no Firefox:** a política está em `Report-Only` de propósito (ADR-048); o Firefox
  loga relatórios como erro. Enforcement exige soak de 7 dias e decisão própria.
- **Kilo Code Review vermelho:** conta sem créditos; check não obrigatório (o ruleset exige `verify-release` e
  `scan + cobertura`).
- **Título do 404 trocando após o load:** dívida declarada no pacote da release.
- **`staging.diretrizprecifica.com` com 302 para login Vercel:** proteção SSO por desenho.

## 3. Fluxos que valem o teste manual

1. **Cadastro real** → confirmação de e-mail → login.
2. **Dashboard** (`/inicio`): períodos mês/trimestre/ano; "DADOS INCOMPLETOS" não pode virar número factual.
3. **Produto** (`/novo-produto`): criar por conversa e criar manualmente; conferir paridade.
4. **Composição** (`/produtos/composicao`): criar ingrediente/embalagem, editar preço, remover embalagem.
5. **Preços de compra, Despesas, Vendas:** lançar e conferir reflexo no dashboard.
6. **Simulações e Ponto de equilíbrio:** rótulo SIMULAÇÃO e ausência de NaN/Infinity.
7. **Chat** (`/novo-produto`): figuras financeiras com lastro, rolagem do log, foco por teclado.
8. **Logout e sessão expirada:** 401 de server function volta ao login preservando o destino.

## 4. Dívidas abertas que podem aparecer

| Dívida      | Sintoma esperado se reproduzir                                    |
| ----------- | ----------------------------------------------------------------- |
| DBT-123     | Log do chat é região rolável sem foco de teclado                  |
| DBT-149     | Foco escapa de modais em chromium/webkit                          |
| DBT-160     | Excluir despesa pode falhar (grant `DELETE` de `app_runtime`)     |
| DBT-161     | `DECIMAL_OVERFLOW` sem tratamento em `/despesas` e `/precos`      |
| DBT-127/128 | Paridade do caminho conversacional × manual na criação de produto |

## 5. Se algo falhar

Capture URL completa, hora UTC, engine e o `x-correlation-id` da resposta (DevTools → Network → Response Headers)
ou o `correlationId` do console. Sem isso o log de produção não é localizável.
