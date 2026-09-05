# M-02 boundaries — tratamento por categoria (2026-09-05)

Escopo: gate extracurricular `npm run m02:boundaries` (não roda no
`ui-stack.yml`). Entrada: FAIL, exit 1, **26 ocorrências** (relatório de
checagens pós-publicação de 2026-09-05). Saída: **PASS**, com as 11 violações
reais cobertas por exceções transitórias documentadas (decisão registrada no
ledger e em `docs/specs/M-02/excecoes.md`).

## Categorias e tratamento

### Categoria 1 — Bookkeeping de políticas (3 ocorrências) → corrigido

- `missing entry policy: src/lib/sales.functions.ts` → entryPolicy adicionada
  (`SalesService` / `SalesRepository` / `targetPhase: M02-4`).
- `missing operation mapping: createSale` / `listSales` → operationPolicies com
  `atomicity: per-operation`.
- Verificado no código: ambos os endpoints já passam por `requireDatabaseAuth`
  e `salesService` — o gap era documental, não de autorização.

### Categoria 2 — Catalog paths inexistentes (12 ocorrências) → corrigido

Repoints para os arquivos que de fato implementam o papel (status
`consolidated` + nota de divergência com a fase-alvo de extração):

| Entrada do catálogo                        | Path anterior (inexistente)                     | Path real                                         |
| ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------- |
| PricingService                             | `services/pricing.service.ts`                   | `services/purchase-price.service.ts` (alvo M02-2) |
| ConversationService                        | `services/conversation.service.ts`              | `lib/chat-data.ts` (alvo M02-3)                   |
| AuditService                               | `services/audit.service.ts`                     | `lib/ai/tool-runner.ts` (alvo M-04)               |
| Ingredient/Packaging/MarketPriceRepository | `repositories/product-catalog.repository.ts` ×3 | `repositories/product.repository.ts`              |
| ConversationRepository                     | `repositories/conversation.repository.ts`       | `lib/chat-execution.server.ts` (alvo M02-3)       |
| AuditRepository                            | `repositories/audit.repository.ts`              | `repositories/ai-tool.repository.ts` (alvo M-04)  |

As 4 ocorrências de `memory.contracts.ts`/`event.contracts.ts`
(`contract-only`, alvos M-05/M-04) deixam de falhar a checagem: a spec declara
que as implementações "permanecem nesses módulos", logo a exigência de
existência era falso-positivo do checker. `scripts/m02-boundaries.ts` agora só
verifica existência para status `implemented`/`consolidated`. Nenhum stub foi
criado.

### Categoria 3 — 11 violações BFF→DB reais → exceções transitórias documentadas

A spec (§Fronteira) e `excecoes.md` proíbem exceção de persistência para
`*.functions.ts`/services/tools. O código shipado diverge da regra em 11
arestas. Em vez de silenciar o gate ou refatorar durante a janela de
estabilização, cada aresta recebeu exceção `transient-*` com razão e fase-alvo
de remoção (detalhe em `excecoes.md` § Estado transitório aprovado):

- `src/lib/ai/**` (3 arestas) — budget-ledger = arquitetura de referência H-001;
- `chat-data.ts`, `chat-execution.server.ts`, `chat.functions.ts` (self)
  (3 arestas) — implementação shipada de conversa/execução (ADR-026);
- `products.functions.ts` (self) + `purchase-price.service.ts` (2 arestas) —
  read-model UNION na tenant tx (wave PERF, patch pós-S4);
- `expenses.functions.ts` (self) (1 aresta) — consulta de despesas shipada;
- `product-detail.service.ts` (1 aresta, via `diagnostic.functions.ts`) —
  queries na tenant transaction (WS-01..07).

**Restrição registrada:** nenhuma exceção autoriza novos acessos; ampliar um
caminho `transient-*` exige nova revisão; a remoção de cada exceção é critério
de saída da fase-alvo (M02-2/3/4). A regra normativa da spec permanece o alvo.

## Verificação

- `npm run m02:boundaries` → **PASS** ("all database reachability is allowlisted
  or repository-only").
- `npm run m02:matrix:generate` + `npm run m02:matrix:check` → PASS
  (matrizes regeneradas contra a árvore atual).
- `npm run format:check` · `lint` · `typecheck` · `test` (353) · `build` ·
  `check:bundle` → ver gates do commit no CI (run vinculado no ledger).

## Risco adjacente tratado — rollback 0010

`drizzle/rollback/0010_to_0009_down.sql` ganhou guarda explícita: o down **não
é no-op** (predicado casa 4 contas em produção, embora o forward tenha sido
verificado no-op), é **proibido executar automaticamente** e exige
reconciliação de linhas + confirmação da versão em tráfego + registro no
ledger (§13.4/13.5). SQL inalterado; arquivo não é coberto pelo checksum do
drizzle journal; schema aplicado intocado.
