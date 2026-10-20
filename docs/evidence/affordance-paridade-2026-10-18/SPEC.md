# SPEC — Fase 1: affordance e honestidade + auditoria de paridade IA×manual (2026-10-18)

> **Natureza:** fase de UX/honestidade sobre código existente, com **zero schema, zero RLS e zero
> migration**. O selo de work package é aplicado como contrato de prova; **não houve lane S6
> adversarial de contexto limpo** e isso está declarado na §Riscos, não maquiado como verde.

## 1. Fato-fonte

- Princípio declarado pelo dono: _"O usuário deve ter liberdade manual mesmo com a IA inserida de
  forma agêntica no sistema."_
- Auditoria CRUD da sessão anterior (`docs/evidence/browser-autonomo-2026-10-17/captures/18-21`) e o
  handoff desta fase, que fixou o escopo: produtos mantêm **arquivar** e a UI fica honesta; nenhum
  delete novo em vendas/simulações/preços nesta fase.
- Defeito já diagnosticado no mesmo dia em outro controle (botão "Recomeçar" do chat), que originou
  a regra de review de controles destrutivos aplicada aqui.

## 2. Problema

1. **Affordance:** os botões de apagar de `/produtos` e `/despesas` eram `variant="ghost"` +
   `size="icon"` — medidos em **36×36 com `background` e `borderColor` = `rgba(0,0,0,0)`**. Parecem
   decoração; em touch não existe `:hover` que os revele. (2ª instância da classe do "Recomeçar".)
2. **Honestidade:** `products.functions.ts:528` — `export const deleteProduct = archiveProduct`. O
   servidor faz **soft delete** (`UPDATE products SET status='archived'`), mas a UI dizia
   "Excluir produto?" e "será excluído permanentemente. Esta ação não poderá ser desfeita."
3. **Paridade (auditoria):** o agente tem 10 tools de mutação e **nenhuma de remoção**; as violações
   do princípio estão na **edição** — ingredientes, custo de ingrediente, rendimento, embalagens e
   taxas só existem pela IA.

## 3. Contrato (invariante falsificável)

> (a) Todo controle que altera dados tem **recipiente visível persistente** (fundo ou borda com cor
> não transparente), **não** dependente de `:hover`, com `aria-label` nomeando o alvo e operável por
> teclado. (b) O rótulo do controle e do diálogo nomeia **a operação que o servidor executa**:
> soft delete ⇒ "arquivar" e **sem** cor de perigo; hard delete ⇒ "excluir" **com** cor de perigo.
> (c) O agente não pode ter mutação sem caminho manual equivalente (registrado como lacuna medida,
> corrigido nas fases seguintes).

## 4. Mudanças

| arquivo                                                         | mudança                                                                                                                                                         |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_authenticated/produtos.tsx`                        | botão: `ghost` → `outline`; `aria-label` "Excluir" → "Arquivar"; diálogo: título "Arquivar produto?", corpo honesto, ação sem `destructive` e rótulo "Arquivar" |
| `src/routes/_authenticated/despesas.tsx`                        | botão: `ghost` → `outline` (nada mais — o diálogo já era honesto e continua destrutivo)                                                                         |
| `docs/adr/ADR-046-semantica-de-remocao-e-paridade-manual-ia.md` | **PROPOSTA** (rascunho anexo): semântica de remoção por entidade, paridade e riscos                                                                             |

**Não muda:** schema, migrations, RLS, serviços, repositórios, tools do agente, permissões, e o WIP
alheio nos dois arquivos tocados.

## 5. DoD (critérios binários, cada um com o artefato que o prova)

1. Recipiente persistente nos dois botões — `captures/03-aceitacao-bruta.txt`.
2. `aria-label` coerente com a operação real — idem.
3. Fluxo arquivar: 1º clique abre diálogo honesto; 2º arquiva; produto sai da lista ativa — idem.
4. ESC devolve o foco ao gatilho — idem.
5. Confirmação do produto sem cor de perigo; a de despesa com cor de perigo — idem (fundo medido).
6. 0 erros de console — idem.
7. WIP alheio intacto — `git diff` mostra o hunk alheio preservado.

## 6. Testes (par que reprova quando o defeito existe)

| cenário              | espera                                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| botão com recipiente | medição de `backgroundColor`/`borderColor` ≠ transparente (antes: `rgba(0,0,0,0)`) |
| rótulo honesto       | diálogo do produto diz "arquivar"; o da despesa continua "excluir"                 |
| cor de perigo        | `bg-destructive: false` no produto, `true` na despesa                              |
| foco                 | `document.activeElement` = gatilho após ESC                                        |

## 7. Riscos

- **Sem S6 adversarial de contexto limpo** — a verificação é a bateria de aceitação do autor, com
  critérios pré-registrados no journal (L946). Declarado, não contado como verificado.
- **Arquivar não tem volta na UI** (não há desarquivar) — Fase 2 / ADR-046.
- A medição de affordance é por cor computada; tema escuro não foi exercitado nesta rodada.
- O tier Playwright completo não rodou (a bancada ocupa `:4173`); `test`, `lint`, `typecheck`,
  `check:ui-stack` e as guardas documentais rodaram.

## 8. Rollback

Reverter os dois arquivos de rota (mudança de classe e texto, sem dado). O produto arquivado durante
a bateria foi restaurado (`status='draft'`, `archived_at=null`).
