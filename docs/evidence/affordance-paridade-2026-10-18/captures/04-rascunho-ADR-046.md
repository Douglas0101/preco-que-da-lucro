# ADR-046 — Semântica de remoção por entidade e paridade manual×IA (liberdade manual com IA agêntica)

- **Status:** PROPOSTA (rascunho anexo à Fase 1; **não ratificado** — nada desta ADR está implementado além da Fase 1 de affordance/honestidade).
- **Data:** 2026-10-18.
- **Escopo:** semântica de remoção de dados de produto/venda/simulação/preço de compra; exigência de caminho manual equivalente para toda mutação que o agente executa. Não altera RLS, schema ou migrations nesta proposta — os itens que exigirem schema estão marcados como tal.
- **Origem:** princípio declarado pelo dono — _"O usuário deve ter liberdade manual mesmo com a IA inserida de forma agêntica no sistema"_ — e a auditoria de paridade medida em `docs/evidence/affordance-paridade-2026-10-18/`.
- **Complementa:** ADR-016 (front), ADR-033 (observabilidade de computer-user, pelo vocabulário de affordance verificável).

## Contexto

O produto tem um agente de chat que escreve no banco: **10 tools de mutação** (`create_product`, `add_ingredients`, `set_ingredient_cost`, `set_yield`, `add_packaging`, `set_price_and_tax`, `add_fee`, `set_market_price`, `add_expense`, `finish_product`). A auditoria mediu três fatos:

1. **O agente não remove nada** — `grep` por tool de remoção devolve zero. A assimetria não está no delete.
2. **A assimetria está na edição:** ingredientes, custo de ingrediente, rendimento, embalagens e taxas **só existem pela IA**. Não há tela que os edite. É a violação mais pura do princípio, e a área mais rica do agente.
3. **A semântica de remoção é heterogênea e, em um caso, mentirosa:** `archiveProduct` faz soft delete (`status='archived'`) enquanto a UI dizia "excluído permanentemente"; `deleteExpense` faz hard delete e dizia a verdade.

## Decisão

### 1. Semântica de remoção por entidade

| entidade                       | verbo                   | semântica                                        | razão medida                                                                | schema? |
| ------------------------------ | ----------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- | ------- |
| **Produto**                    | **arquivar**            | soft: `status='archived'`, `archived_at`         | preserva histórico de vendas/simulações que o referenciam                   | não     |
| **Produto (tier 2)**           | excluir definitivamente | hard, **com guarda referencial**                 | mesmo padrão de `deleteChild`: FK violada ⇒ `CONFLICT` nomeado, nunca órfão | não     |
| **Venda**                      | **cancelar**            | soft: status de cancelamento + motivo            | venda é fato contábil; apagar reescreveria relatório de período             | **sim** |
| **Simulação**                  | **excluir**             | hard                                             | simulação é cenário hipotético, sem valor probatório                        | não     |
| **Preço de compra**            | **expirar/versionar**   | append-only: nunca remove a linha histórica      | `purchase-price.service.ts` já grava `historyId` por `repository.append`    | não     |
| **Ingrediente/embalagem/taxa** | excluir                 | hard + guarda referencial (já é o comportamento) | implementado e com mensagem nomeada                                         | não     |
| **Despesa**                    | excluir                 | hard (já é o comportamento)                      | despesa é lançamento simples do próprio usuário                             | não     |

Regra transversal: **o verbo da UI é o verbo do servidor**. Rótulo que promete mais (ou menos) do que o comportamento é defeito, não cosmética — é a 2ª instância da classe "Recomeçar".

### 2. Paridade manual obrigatória

Toda mutação executável pelo agente precisa de caminho manual com affordance visível. Prioridade por **pureza da violação**, na ordem:

1. **Edição manual de produto e filhos** (`add_ingredients`, `set_ingredient_cost`, `set_yield`, `add_packaging`, `add_fee`) — hoje 100% dependentes da IA.
2. **Preço/taxa no produto** (`set_price_and_tax`) — parcialmente manual (`/precos`).
3. **Remoção**: não é lacuna de paridade (a IA não remove), mas é lacuna de **simetria de controle**: o usuário precisa poder desfazer o que a IA fez (desarquivar, cancelar venda).

### 3. Controles destrutivos — regra de review permanente

Todo controle que muda dados deve ter: **(a)** recipiente visível persistente (não só `:hover` — em touch não existe hover); **(b)** verbo condizente com o comportamento real do servidor; **(c)** `aria-label` com o nome do alvo; **(d)** cor de perigo **somente** quando a ação é irreversível. A Fase 1 aplicou (a)–(d) em produtos e despesas.

## Consequências

- **Positivas:** o usuário deixa de depender do chat para corrigir dados; o rótulo passa a ser contrato; risco de perda irreversível fica concentrado em ações marcadas como destrutivas.
- **Negativas:** edição manual de filhos exige telas (custo de UI); cancelamento de venda exige coluna e política de relatório (schema + RLS); desarquivar exige caminho de listagem de arquivados.
- **Neutras:** preço de compra não ganha "excluir" — ganha "expirar", que é o que o modelo já suporta.

## Riscos e questões abertas (para ratificação)

1. **Relatórios e soft delete:** cancelar venda exige decidir se relatórios de período somam vendas canceladas (proposta: excluir do total, manter no histórico auditável).
2. **RLS:** `archiveProduct` já opera sob `app_runtime` com filtro por tenant; qualquer caminho novo de exclusão definitiva precisa repetir o filtro e provar isolamento (o padrão de guarda referencial de `deleteChild` é o modelo).
3. **Atribuição de autoria (IA × usuário):** hoje não há registro de quem executou a mutação. Se virar requisito de auditoria, é coluna nova em cada tabela mutável — **fora do escopo desta proposta**.
4. **Undo:** o produto não tem desfazer. Arquivar é reversível no dado mas não na UI; exclusão definitiva e cancelamento de venda não têm volta. Undo-toast precisa de snapshot.
5. **Ordem de execução:** edição manual de filhos antes de cancelamento de venda (o primeiro é UI pura, o segundo é schema).

## Alternativas rejeitadas

- **Só IA para filhos do produto** (status quo): viola o princípio e deixa o usuário sem correção manual quando a extração da IA erra.
- **Hard delete de produto com `ON DELETE CASCADE`:** apagaria histórico de vendas em silêncio — a guarda referencial explícita (padrão já existente) é preferível.
- **Rótulo "Excluir" com soft delete** (status quo até a Fase 1): mentira de interface, e a pior espécie — a que faz o usuário acreditar que o dado sumiu.

## Evidência

- Auditoria e aceitação da Fase 1: `docs/evidence/affordance-paridade-2026-10-18/README.md` (tabelas 0.1–0.4, capturas e erratas).
- Journal: `docs/evidence/agent-state/PROGRESS.md` L946/L947 (intenção e resultado).
