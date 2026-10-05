# ADR-041 — Margem consolidada sobre vendas registradas

- Status: PROPOSTA — implementação local para DBT-88; ratificação pendente.
- Data: 2026-10-04
- Escopo: projeção server-side do dashboard, sem migração de banco.

## Contexto

O dashboard apresentava margem e mensagem fixas apesar de vendas reais. O
agregado precisa preservar identidade de produto, tenant e período. Vendas
podem registrar um preço distinto do catálogo (ADR-024); multiplicar a margem
unitária do catálogo pelas quantidades vendidas produz contribuição fictícia.
Custos históricos por venda não são persistidos neste contrato.

## Decisão proposta

1. O repositório agrega quantidade e valor dos itens por produto, tenant e
   início de período. A leitura mantém a transação e o RLS existentes, sem N+1.
2. O serviço usa Decimal para somar `valor vendido − quantidade × custo
unitário atual − valor vendido × (impostos + taxas atuais)` e dividir essa
   contribuição pela receita do período. O início de período é calculado uma
   vez para as duas consultas. Margem negativa é um resultado válido.
3. Há três estados: `empty` sem vendas; `ok` com premissas completas e receita
   conciliada; `incomplete` quando faltam premissas, a receita é zero ou os
   valores dos itens não conciliam com a receita líquida. Todos os produtos
   vendidos precisam participar; um subconjunto não autoriza margem parcial.
4. Descontos/ajustes líquidos sem alocação fiscal não recebem uma hipótese
   silenciosa. A diferença entre itens e líquido produz `salesMismatch` e
   indisponibilidade com mensagem verdadeira. Leituras concorrentes que não
   conciliem também ficam indisponíveis. Não se altera o isolamento transacional.
5. A interface explica preço efetivamente vendido, custos e taxas atuais e
   ausência de reconstrução histórica. O shape guard recusa campos ausentes,
   números não finitos e motivos degenerados, com recuperação controlada.

## Evidência e limites

Testes independentes cobrem preços reais diferentes do catálogo, contribuição
negativa, receita zero, ausência de vendas, produto vendido incompleto,
desconto sem alocação e escopo por tenant em PostgreSQL 17. O runner de banco
exige identidades dos casos, zero skips e ausência de erros não tratados.
Evidência operacional local em `docs/evidence/ciclo-29/`; matriz remota e
ratificação permanecem evidências separadas. A projeção não comprova margem
histórica, lucro após despesas fixas nem autorização de publicação.

## Referências

- ADR-018 — Decimal, unidades e arredondamento.
- ADR-024 — Integridade de preços, simulações e vendas.
- ADR-032 — Decimal string no wire.
- DBT-86/88 em `docs/evidence/agent-state/DEBTS.md`.
