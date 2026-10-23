# Fase 1 — affordance e honestidade + auditoria de paridade IA×manual (2026-10-18)

**Princípio do dono:** _"O usuário deve ter liberdade manual mesmo com a IA inserida de forma
agêntica no sistema."_ Corolários: **paridade** (toda mutação da IA exige caminho manual com
affordance visível), **honestidade** (o rótulo cumpre o que promete) e **não-exclusividade**
(nenhuma área depende só da IA).

## Tarefa 0 — varreduras e medições (read-only, antes de qualquer edição)

### 0.1 Varredura global de `variant="ghost"` (fora de `components/ui`)

| arquivo:linha   | ação                                       | `aria-label`              | affordance medida                                                  |
| --------------- | ------------------------------------------ | ------------------------- | ------------------------------------------------------------------ |
| `produtos.tsx`  | excluir produto (na verdade: **arquivar**) | `Excluir <nome>`          | ❌ **ícone puro**, 36×36, `background`/`borderColor` transparentes |
| `despesas.tsx`  | excluir despesa (**hard delete**)          | `Excluir <nome>`          | ❌ **ícone puro**, 36×36, idem                                     |
| `app-shell.tsx` | abrir menu (drawer)                        | `Abrir menu de navegação` | ✅ legítimo: ícone canônico de menu                                |
| `app-shell.tsx` | sair                                       | `Sair`                    | ✅ legítimo: tem texto ("Sair" oculto só abaixo de `sm`)           |

**Classe do defeito:** botão sem recipiente (fundo/borda transparentes) parece decoração. Em touch
não há `:hover` que revele nada — o mesmo defeito é pior sem mouse.

### 0.2 Léxico real de delete (medido no repositório, não no rótulo)

| função                                           | camada                       | semântica REAL                                                        | o que a UI dizia                                                |
| ------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `archiveProduct` (alias `deleteProduct`)         | `product.repository.archive` | **SOFT**: `UPDATE products SET status='archived', archived_at=now()`  | "Excluir produto?", "excluído permanentemente… não desfeita" ❌ |
| `deleteExpense`                                  | `expense.repository.remove`  | **HARD**: `DELETE FROM expenses … RETURNING id`                       | "Excluir despesa?", "excluída permanentemente" ✅               |
| `deleteIngredient`/`deletePackaging`/`deleteFee` | `productService.deleteChild` | **HARD + guarda referencial**: violação de FK vira `CONFLICT` nomeado | — (sem UI própria)                                              |

### 0.3 Matriz de paridade — tools do agente × caminho manual

Tools do agente (10, todas de escrita): `create_product`, `add_ingredients`, `set_ingredient_cost`,
`set_yield`, `add_packaging`, `set_price_and_tax`, `add_fee`, `set_market_price`, `add_expense`,
`finish_product`. **Nenhuma tool de remoção** (`grep` por `name: "(delete|remove|archive)"` = 0).

| mutação da IA              | caminho manual                      | veredito                     |
| -------------------------- | ----------------------------------- | ---------------------------- |
| `create_product`           | `/novo-produto` + "Novo produto"    | ✅                           |
| `add_expense`              | `/despesas` "Adicionar"             | ✅                           |
| `set_market_price`         | `/precos`                           | ✅                           |
| `set_price_and_tax`        | `/precos` (taxa) + preço no produto | ⚠️ parcial                   |
| `add_ingredients`          | **nenhum** — só pela IA no chat     | ❌ **violação do princípio** |
| `set_ingredient_cost`      | **nenhum**                          | ❌                           |
| `set_yield`                | **nenhum**                          | ❌                           |
| `add_packaging`            | **nenhum**                          | ❌                           |
| `add_fee`                  | **nenhum**                          | ❌                           |
| (edição manual de produto) | **nenhum**                          | ❌                           |

**Achado que reordena a Fase 2:** a IA **não apaga nada**, então "paridade de delete" não é lacuna.
As violações reais são **edição manual inexistente de produto e de seus filhos** (ingredientes,
embalagens, taxas) — a área mais rica do agente é a mais pobre em mão humana.

### 0.4 Modelo de preços de compra

`purchase-price.service.ts` é **append-only com histórico**: grava `historyId` a partir de
`repository.append(...)` (linhas 96 e 116). O dado é **versionado, não sobrescrito** — o verbo
honesto para a Fase 2 é **expirar/versionar**, nunca "remover". A UI de `/precos` só atualiza o
preço corrente (`updatePurchasePrice`), sem criar nem remover entrada.

## Tarefa 1/2 — correções aplicadas (diff mínimo)

| arquivo                  | mudança                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `produtos.tsx` (botão)   | `variant="ghost"` → `variant="outline"` (recipiente persistente); `aria-label` `Excluir <nome>` → `Arquivar <nome>`                                                                  |
| `produtos.tsx` (diálogo) | título "Excluir produto?" → **"Arquivar produto?"**; corpo explica que sai do catálogo ativo e o histórico é preservado; ação perde `variant="destructive"` e passa a **"Arquivar"** |
| `despesas.tsx` (botão)   | `variant="ghost"` → `variant="outline"`; **nada mais** — o diálogo já era honesto e continua `destructive` porque a operação é hard delete (medido)                                  |

## Aceitação — critérios pré-registrados no journal (L946)

| critério                                       | medido                                                                                          | veredito |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| recipiente visível persistente (não só hover)  | produtos/despesas: fundo `oklch(1 0 0)` + borda `oklch(0.92 0.004 286.32)`                      | ✅       |
| `aria-label` preservado e coerente             | `Arquivar Produto de teste` / `Excluir Despesas variáveis`                                      | ✅       |
| operável por teclado                           | `el.focus()` → `document.activeElement === el` nas duas rotas                                   | ✅       |
| 1º clique abre diálogo honesto                 | título "Arquivar produto?" + corpo novo + botões `["Cancelar","Arquivar"]`                      | ✅       |
| 2º clique arquiva e sai da lista ativa         | `products`: `archived 0 → 1` ("Produto de teste", `archived_at` gravado)                        | ✅       |
| foco preso no diálogo / ESC devolve ao gatilho | `focoPresoNoDialogo: true`; ESC fecha e devolve o foco                                          | ✅       |
| confirmação do produto SEM destructive         | fundo do botão "Arquivar" = `oklch(0.21 0.006 285.885)`, `bg-destructive: false`                | ✅       |
| despesa CONTINUA destrutiva (hard delete)      | fundo `oklab(0.577 0.218 0.112 / 0.1)`, `bg-destructive: true`                                  | ✅       |
| 0 erros de console antes/depois                | 0 → 0                                                                                           | ✅       |
| diff mínimo / WIP alheio intacto               | produtos: hunk alheio (`lift hover:shadow-md`) preservado; despesas: guard do Select preservado | ✅       |

### Erratas do autor (registradas, não apagadas)

1. O primeiro `temRecipiente` que reportei deu `true` para os botões ghost porque comparava
   `borderWidth !== "0px"` — o `Button` base tem `border` com **cor transparente**. O indicador
   correto é a **cor** do fundo/borda.
2. `acaoEhDestructive` deu `2` (falso positivo): o regex `/destructive/` casava a classe de
   validação `aria-invalid:…-destructive` da base do `Button`. A medição correta compara
   `bg-destructive` e a cor computada.
3. A contagem "ativos 11 → 11" com "arquivados 0 → 1" era **ordem de medição** (a query de "antes"
   rodou depois do arquivamento na mesma rodada), não inconsistência de dados: o produto arquivado
   estava em `status='draft'`.

## Riscos e limites declarados

- **Zero schema, zero RLS, zero migration nesta fase** — por desenho.
- Produtos arquivados **não têm caminho de desarquivar** (Fase 2 / ADR).
- A varredura de ghost cobriu `variant="ghost"` literal; botões montados por `render={<Button/>}`
  dentro de `components/ui` não foram varridos (fora do escopo).
- O tier Playwright completo não rodou nesta sessão (a bancada ocupa `:4173`); `test`, `lint`,
  `typecheck` e `check:ui-stack` rodaram.
