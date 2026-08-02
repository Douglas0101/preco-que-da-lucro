# Diretriz precifica

Crie um aplicativo web responsivo, em português do Brasil, chamado provisoriamente de "Preço que Dá Lucro".

O aplicativo será uma ferramenta de gestão financeira para pequenos empreendedores, especialmente negócios de alimentação, mas deve ser estruturado para futuramente atender outros segmentos.

O principal diferencial do aplicativo é permitir que o usuário faça o cadastro de seus produtos por meio de uma conversa natural com uma IA, como se estivesse conversando com um consultor financeiro.

O usuário não deve sentir que está preenchendo uma planilha complexa.

A experiência deve ser simples, amigável, didática e conversacional.

O aplicativo deve combinar:

Inteligência artificial conversacional

Ficha técnica de produtos

Cálculo de custos

Formação de preço

Comparação com preço de mercado

Margem de contribuição

Cadastro de despesas

Ponto de equilíbrio

Simulação de cenários

Diagnóstico financeiro

IMPORTANTE:

A IA deve ser responsável por conduzir a conversa, interpretar as respostas do usuário e explicar os resultados.

Porém, os cálculos financeiros não devem depender da capacidade de raciocínio matemático da IA.

Todos os cálculos de custos, margens, preços e ponto de equilíbrio devem ser realizados por funções matemáticas determinísticas do sistema, usando os dados estruturados armazenados no banco de dados.

A IA deve interpretar a linguagem natural e transformar as informações fornecidas pelo usuário em dados estruturados.

Depois, o sistema realiza os cálculos.

Por fim, a IA apresenta os resultados ao usuário em linguagem simples.

ARQUITETURA:

Usuário conversa com a IA
→ IA identifica e estrutura os dados
→ Sistema salva os dados
→ Motor financeiro realiza os cálculos
→ Sistema apresenta os resultados
→ IA explica os resultados
→ Usuário pode realizar simulações

==================================================

IDENTIDADE E EXPERIÊNCIA DO USUÁRIO
==================================================

Criar uma interface moderna, profissional, acolhedora e simples.

O público principal são pequenos empreendedores que não possuem conhecimento financeiro avançado.

A linguagem deve ser humana e fácil de entender.

Evitar aparência de sistema contábil complexo.

Usar uma experiência visual semelhante a um aplicativo financeiro moderno.

Criar uma interface responsiva para computador e celular.

O aplicativo deve ter uma navegação principal com:

Início

Meus Produtos

Novo Produto

Minhas Despesas

Ponto de Equilíbrio

Simulações

Diagnóstico

Criar uma página inicial com um resumo financeiro.

Exibir:

Quantidade de produtos cadastrados

Faturamento informado

Total de despesas fixas

Ponto de equilíbrio

Produto com maior margem de contribuição

Alertas financeiros

Caso o usuário ainda não tenha dados cadastrados, mostrar uma tela de boas-vindas incentivando o cadastro do primeiro produto.

Mensagem:

"Vamos descobrir juntos quanto custa o seu produto, qual preço faz sentido para o seu negócio e quanto você precisa vender para começar a ter lucro."

Botão principal:

"Começar agora"

==================================================
2. CADASTRO CONVERSACIONAL DE PRODUTO

Criar uma experiência de chat para cadastro de produtos.

A conversa deve seguir etapas, mas parecer natural.

A IA deve fazer UMA pergunta por vez.

Nunca mostrar um formulário longo com dezenas de campos.

ETAPA 1 — IDENTIFICAR O PRODUTO

A IA deve iniciar:

"Olá! Vamos descobrir juntos quanto realmente custa produzir e vender seu produto. Qual produto ou receita você gostaria de analisar primeiro?"

O usuário pode responder:

"Quero cadastrar meu bolo de chocolate."

Salvar:

Nome do produto: Bolo de Chocolate

Depois perguntar:

"Perfeito! Agora me conte como você prepara esse produto. Pode escrever a receita do seu jeito, sem se preocupar em organizar. Eu vou fazer isso por você."

O usuário pode responder livremente.

Exemplo:

"Uso 2 ovos, 200 g de farinha, 150 g de açúcar, 100 g de chocolate e 1 colher de fermento."

A IA deve identificar automaticamente:

Ingrediente

Quantidade

Unidade de medida

Transformar a resposta em dados estruturados.

Exibir visualmente:

INGREDIENTES IDENTIFICADOS

2 ovos
200 g de farinha
150 g de açúcar
100 g de chocolate
1 colher de fermento

Perguntar:

"Entendi! Encontrei 5 ingredientes. Está tudo certo ou você quer adicionar ou remover algum ingrediente?"

Permitir que o usuário corrija os dados.

==================================================
3. CUSTO DOS INGREDIENTES

Após confirmar os ingredientes, iniciar uma conversa para identificar o custo de cada ingrediente.

A IA deve perguntar um ingrediente por vez.

Exemplo:

"Vamos começar pela farinha. Quanto você paga pelo pacote e qual é a quantidade que vem nele?"

Usuário:

"R$ 6,00 e vem 1 kg."

Salvar:

Ingrediente: Farinha
Preço da embalagem: R$ 6,00
Quantidade da embalagem: 1 kg
Quantidade utilizada: 200 g

O sistema deve calcular automaticamente:

Preço por grama = 6 / 1000

Custo utilizado = 200 × preço por grama

Resultado:

Custo da farinha na receita = R$ 1,20

Fazer o mesmo para todos os ingredientes.

Permitir unidades:

g

kg

ml

l

unidade

dúzia

pacote

caixa

outros

Criar conversão automática quando possível.

Exemplos:

1 kg = 1.000 g
1 l = 1.000 ml
1 dúzia = 12 unidades

Quando houver dúvida ou unidade incompatível, pedir confirmação ao usuário.

Nunca inventar conversões que não sejam tecnicamente seguras.

==================================================
4. RENDIMENTO DA RECEITA

Após cadastrar todos os ingredientes, perguntar:

"Essa receita rende quantas unidades do produto que você vende?"

Permitir:

Unidade

Fatia

Porção

Kg

g

L

ml

Outro

Calcular:

Custo total dos ingredientes
÷
Quantidade produzida

Resultado:

Custo de ingredientes por unidade

Exibir uma tabela:

Ingrediente | Quantidade usada | Custo

Mostrar também:

Custo total da receita
Rendimento
Custo unitário

==================================================
5. EMBALAGEM E MATERIAIS

Perguntar:

"Você utiliza alguma embalagem para vender esse produto?"

Opções:

Sim
Não

Se sim:

"Qual embalagem você utiliza?"

Depois:

"Quanto você paga pela embalagem e quantas unidades vêm na embalagem que você compra?"

Calcular:

Preço da embalagem ÷ quantidade de unidades

Permitir cadastrar múltiplas embalagens.

Exemplo:

Caixa: R$ 50,00 / 100 unidades = R$ 0,50 por unidade

Perguntar:

"Além da embalagem, você usa outros materiais para entregar esse produto?"

Exemplos:

Sacola

Etiqueta

Adesivo

Lacre

Talher

Guardanapo

Fita

Outros

Permitir cadastro de múltiplos materiais.

Calcular automaticamente:

Custo total de materiais por unidade.

Resultado:

Custo direto unitário =
Ingredientes
+
Embalagem
+
Materiais diretamente relacionados ao produto

==================================================
6. FORMAÇÃO DE PREÇO

Após calcular o custo direto, iniciar a etapa de formação de preço.

Mostrar:

"Custo direto do seu produto"

Depois explicar:

"Agora vamos analisar quanto você pode cobrar pelo seu produto. Para chegar a um preço sustentável, precisamos considerar também impostos, taxas, despesas variáveis e o resultado que você deseja obter."

Perguntar:

"Por quanto você vende esse produto atualmente?"

Salvar preço atual.

Perguntar:

"Qual é o regime tributário da sua empresa?"

Opções:

MEI

Simples Nacional

Lucro Presumido

Lucro Real

Não sei

Se MEI:

Não presumir automaticamente que o DAS mensal é uma despesa variável por produto.

Tratar o DAS como despesa fixa mensal ou despesa operacional mensal, salvo configuração diferente definida pelo usuário.

Se Simples Nacional, Lucro Presumido ou Lucro Real:

Solicitar a alíquota efetiva ou permitir que o usuário informe a porcentagem utilizada para simulação.

Não inventar alíquotas tributárias.

Perguntar:

"Você paga alguma taxa sobre cada venda?"

Exemplos:

Cartão

Marketplace

Aplicativo de delivery

Comissão

Outras taxas

Permitir cadastrar várias taxas.

Calcular o impacto das taxas no preço.

==================================================
7. MARGEM DE CONTRIBUIÇÃO

Calcular:

Receita unitária

Custos variáveis unitários

Despesas variáveis unitárias

Resultado:

Margem de contribuição unitária.

Calcular também:

Margem de contribuição percentual.

Explicar:

"A margem de contribuição mostra quanto sobra de cada venda para pagar as despesas fixas da empresa e, depois que elas são cobertas, gerar lucro."

Não confundir:

Markup

Margem de contribuição

Margem de lucro

Lucro líquido

Criar uma seção explicativa simples.

==================================================
8. PREÇO DE MERCADO

Perguntar:

"Agora vamos olhar para o mercado. Por quanto seus concorrentes vendem esse mesmo produto?"

Permitir informar:

Menor preço

Preço médio

Maior preço

Perguntar:

"Qual é o preço que você considera como referência para o seu bairro ou região?"

Salvar preço médio de mercado.

Comparar:

Preço atual
Preço calculado
Preço de mercado

Mostrar visualmente:

Seu custo
Seu preço atual
Preço sugerido
Preço médio informado do mercado

Criar uma análise:

"Seu preço atual está X% abaixo/acima do preço médio informado."

Não afirmar automaticamente que o preço está errado.

Explicar que preço deve considerar:

Qualidade

Diferenciação

Público

Localização

Marca

Experiência

Custos

Margem

==================================================
9. DESPESAS DA EMPRESA

Criar uma área chamada:

"Minhas Despesas"

Permitir cadastrar despesas mensais.

Cada despesa deve possuir:

Nome

Categoria

Valor

Tipo

Periodicidade

Observação

Tipos:

Fixa

Variável

Categorias sugeridas:

Aluguel

Pró-labore

Salários

Contabilidade

Internet

Telefone

Energia

Água

Sistemas

Marketing

Transporte

Manutenção

Impostos

Taxas

Outros

A IA também pode coletar essas informações por conversa.

Exemplo:

"Agora vamos conhecer as contas da sua empresa. Qual é a principal despesa fixa que você paga todos os meses?"

Continuar uma pergunta por vez.

==================================================
10. PONTO DE EQUILÍBRIO

Calcular:

Ponto de equilíbrio em unidades:

Despesas fixas ÷ Margem de contribuição unitária

Calcular também:

Ponto de equilíbrio em faturamento:

Despesas fixas ÷ Margem de contribuição percentual

Exibir:

"Seu ponto de equilíbrio"

Exemplo:

Você precisa vender:
1.000 unidades por mês

Faturamento necessário:
R$ 10.000,00

Explicação:

"Isso significa que, considerando os dados informados, sua empresa precisa atingir esse volume de vendas para cobrir suas despesas e chegar ao ponto de equilíbrio."

==================================================
11. META DE LUCRO

Criar uma ferramenta chamada:

"Quanto preciso vender para atingir meu lucro?"

Perguntar:

"Quanto você gostaria de ganhar de lucro por mês?"

Calcular:

Quantidade necessária de vendas =
(Despesas fixas + Lucro desejado)
÷
Margem de contribuição unitária

Mostrar:

Para obter R$ X de lucro por mês, você precisa vender aproximadamente X unidades.

Mostrar também faturamento necessário.

==================================================
12. SIMULAÇÕES

Criar uma área de simulação.

O usuário poderá escolher:

Aumentar preço

Reduzir custos

Reduzir despesas fixas

Aumentar volume de vendas

Permitir comparar:

Cenário atual
Cenário simulado

Mostrar impacto em:

Margem de contribuição

Ponto de equilíbrio

Faturamento

Lucro estimado

Criar visualização simples e intuitiva.

Exemplo:

CENÁRIO ATUAL

Preço: R$ 10,00
Vendas: 700 unidades
Margem de contribuição: R$ 6,00
Despesas fixas: R$ 6.000,00
Resultado: prejuízo de R$ 1.800,00

CENÁRIO SIMULADO

Preço: R$ 11,00
Vendas: 700 unidades
Margem de contribuição: R$ 7,00
Despesas fixas: R$ 6.000,00
Resultado: prejuízo de R$ 1.100,00

Mostrar a diferença.

==================================================
13. DIAGNÓSTICO FINANCEIRO

Criar uma página chamada:

"Meu Diagnóstico"

Gerar automaticamente uma análise com base nos dados cadastrados.

Apresentar:

Custo unitário

Preço atual

Preço sugerido

Preço médio de mercado

Margem de contribuição

Despesas fixas

Ponto de equilíbrio

Meta de lucro

Principais alertas

Recomendações

Criar alertas automáticos quando:

Preço de venda for menor que o custo

Margem de contribuição for muito baixa

Ponto de equilíbrio for muito elevado

Preço estiver muito acima do mercado informado

Preço estiver muito abaixo do mercado informado

Despesas fixas forem elevadas

Volume atual estiver abaixo do ponto de equilíbrio

Não determinar que uma situação é "boa" ou "ruim" sem contexto.

Usar linguagem:

"Vale investigar"
"Pode representar um risco"
"Pode ser interessante simular"
"Os dados indicam"

==================================================
14. ESTRUTURA DO BANCO DE DADOS

Criar uma estrutura de banco de dados organizada para permitir que cada usuário tenha seus próprios dados.

Entidades principais:

USERS

PRODUCTS

INGREDIENTS

PRODUCT_INGREDIENTS

PACKAGING

PRODUCT_PACKAGING

OTHER_DIRECT_COSTS

EXPENSES

MARKET_PRICES

TAXES

SALES_FEES

SIMULATIONS

FINANCIAL_DIAGNOSTICS

Criar relacionamentos adequados.

Um usuário pode ter vários produtos.

Um produto pode ter vários ingredientes.

Um produto pode ter várias embalagens e materiais.

Um usuário pode ter várias despesas.

Um produto pode ter vários registros de preço de mercado.

Garantir isolamento dos dados entre usuários.

==================================================
15. REGRAS FINANCEIRAS IMPORTANTES

Todos os cálculos devem ser realizados pelo sistema, não pela IA.

Criar funções específicas para:

calculateIngredientCost()

calculateRecipeCost()

calculateUnitCost()

calculatePackagingCost()

calculateVariableCost()

calculateContributionMargin()

calculateContributionMarginPercentage()

calculateBreakEvenUnits()

calculateBreakEvenRevenue()

calculateRequiredSalesForProfit()

calculateScenario()

Usar arredondamento adequado para apresentação, mas manter precisão interna nos cálculos.

Usar moeda brasileira:

R$

Formato brasileiro:

R$ 1.234,56

Percentuais:

10,00%

==================================================
16. IA CONVERSACIONAL

A IA deve:

Fazer uma pergunta por vez

Nunca repetir perguntas já respondidas

Aproveitar informações anteriores

Confirmar dados importantes

Detectar inconsistências

Pedir esclarecimentos quando necessário

Nunca inventar valores

Nunca inventar preços

Nunca inventar impostos

Nunca inventar custos

Explicar conceitos financeiros de maneira simples

Exemplo de conversa:

IA:

"Qual produto você gostaria de cadastrar?"

Usuário:

"Brownie."

IA:

"Ótimo! Me conte como você prepara seu brownie. Pode escrever a receita do seu jeito."

Usuário:

"Uso 500 g de chocolate, 200 g de manteiga, 4 ovos e 300 g de açúcar."

IA:

"Perfeito! Organizei sua receita. Agora vamos descobrir quanto ela custa de verdade. Quanto você paga pelo chocolate e qual é a quantidade da embalagem que compra?"

Continuar a conversa naturalmente.

==================================================
17. IMPORTANTE SOBRE O MVP

Priorizar primeiro o funcionamento completo do fluxo:

NOVO PRODUTO
→ CONVERSA COM IA
→ RECEITA
→ INGREDIENTES
→ CUSTO
→ RENDIMENTO
→ EMBALAGEM
→ CUSTO UNITÁRIO
→ PREÇO
→ MERCADO
→ DESPESAS
→ MARGEM DE CONTRIBUIÇÃO
→ PONTO DE EQUILÍBRIO
→ META DE LUCRO
→ DIAGNÓSTICO

Criar inicialmente um MVP funcional.

Não adicionar funcionalidades desnecessárias neste primeiro momento.

Priorizar:

Interface simples

Cadastro conversacional

Cálculos corretos

Banco de dados

Segurança dos dados

Dashboard

Diagnóstico

A aplicação deve estar preparada para futuramente receber:

Mais categorias de negócios

Outros tipos de ficha técnica

Controle de estoque

Fluxo de caixa

DRE simplificada

Comparação entre produtos

Ranking de produtos mais lucrativos

Integração com WhatsApp

Plano gratuito e plano pago

Não construir essas funcionalidades agora.

Deixar a arquitetura preparada para expansão futura.

Ao terminar a primeira versão, apresentar uma interface funcional e navegável com dados de exemplo para demonstração.

Os dados de exemplo devem ser claramente identificados como "Dados de demonstração" e não devem ser misturados aos dados reais do usuário.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/380a6a06-df73-457f-8468-c0dbadfa83e4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
