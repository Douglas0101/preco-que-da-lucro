# QA visual e operações calculadas — SPEC pré-registrada

Revisão: e3a5507cf5d0a7beb10d383a9f44c1e1537aa05c. Evidência LOCAL-VERIFIED, banco PG17 sintético exclusivo, browser N1. Escopo: login e navegação, formulários, produto completo/incompleto, simulação manual, diagnóstico com premissas explícitas, venda pelo formulário e dashboard antes/depois, persistência após reload, isolamento nominal de tenant e layout desktop/mobile. Nenhum resultado local concede release ou S6 formal.

## Cenários

- V01: formulário de login acessível; autenticar conta sintética pelo clique, shell privado e /inicio.
- V02: dashboard sem vendas informa ausência factual e dados incompletos; não inventa faturamento.
- V03: produtos completo/incompleto e badges, custo ausente como travessão, sem NaN/Infinity/zero factual.
- V04: navegação e formulário de produto: campos, diálogos, validações e persistência de cadastro sintético.
- V05: receita/embalagem/taxa e valores derivados, quando expostos pelo formulário; premissas conhecidas antes de medir.
- V06: simulação manual com volume informado, rótulo SIMULAÇÃO e comparações por aritmética Decimal independente.
- V07: diagnóstico com premissas explícitas e alertas de dados incompletos; decisão limitada ao cenário sintético.
- V08: registrar venda de 2 unidades a R$25,00 => bruto R$50,00; líquido R$50,00 se omitido; linha e faturamento persistem após reload.
- V09: períodos e navegação do dashboard; venda registrada preserva identidade, quantidade e preço.
- V10: marker de tenant B é ausente nas telas de A; B tem fixture própria verificada por identidade.
- V11: largura mobile e menu: conteúdo e controles utilizáveis, sem overflow horizontal que esconda operações.
- V12: saída e fronteira autenticada, sem captura de tokens/cookies/valores de segredo.

Artefatos: trios redigidos em docs/evidence/visual; índice e checksums, steps/resultados e limites neste diretório. Captura correlacionada só quando x-correlation-id for observado em resposta; ausência permanece null. Aritmética detalhada será pré-registrada antes de executar cada cálculo. Fonte de dados e contexto sintético explicitados. Controle negativo: produto incompleto, redirect/auth quando aplicável e marker estrangeiro. Não elevar timeout/retry/limite real para aprovar.

## Extensão documental após a execução

O roteiro acima foi registrado antes das operações (L659). A descrição completa de método, write-set, DoD, riscos, custódia/rollback e checklist de 17 itens está no README, redigido após as medições; não é pré-registro retroativo. Criação de produto por IA ficou NO-VERDICT por ausência de provedor. Foram declarados quatro defeitos ABERTA (DBT-86–89). Nenhuma fonte da aplicação foi alterada e nenhum selo S5/S6 ou run CI novo é alegado.
