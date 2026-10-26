# SPEC — Fase 2a: correção da rota de composição e porta manual (2026-10-18)

> **Natureza:** este `SPEC.md` foi publicado em **2026-10-21**, na sessão de selagem, e **descreve o
> pacote tal como ele já existia** — não é um plano de trabalho futuro. O `REPORT.md` do pacote é o
> registro do resultado; este documento é a especificação fiel do que foi feito, do que foi medido e
> do que fica declarado como limite.
>
> **Selo:** o `MANIFEST.sha256` deste diretório e este `SPEC.md` foram publicados na sessão de selagem
> de 2026-10-21. O **S6 adversarial de contexto limpo NÃO foi executado** — o próprio `REPORT.md` §9
> (follow-up 8) e o "Limite declarado do relatório" registram isso. Nada de selo foi simulado.

## 1. Fato-fonte

- Journal `docs/evidence/agent-state/PROGRESS.md`: a intenção **L948** (Fase 2 — `produtos/composicao.tsx`
  - CRUD manual) estava **órfã** (sem `✔`/`✘`); **L955** era a intenção desta Fase 2a (adoção + correção
  - aceitação), também órfã. Ambas foram **adotadas** e reconciliadas em **L956** (L948–L954 permaneceram
    intocadas).
- `REPORT.md` §1 e §8.3: a medição em disco **contradisse** o prompt da sessão (que dizia que a correção
  NÃO fora aplicada) — a rota já era FLAT e o `routeTree` já estava regerado. O ato foi reconciliado,
  não reexecutado.
- `REPORT.md` §8.5: **colisão de duas sessões na mesma árvore**; o veredito canônico é a linha **L957**
  (03:05Z) e **L958** (03:06Z) é adendo de verificação independente que **não** sobrescreveu o relatório.

## 2. Problema (medido)

1. **Rota quebrada:** `/produtos/composicao` era uma rota **aninhada**; ao clicar "Composição" a URL
   mudava para `/produtos/composicao?produto=…` mas a tela renderizada continuava sendo a **lista do
   pai** (`h1` = "Meus Produtos", heading do pai montado = 1) — `REPORT.md` §4 (coluna "antes (L954)").
2. **Porta manual ausente:** as tools de escrita da IA (`set_yield`, `add_ingredients`,
   `set_ingredient_cost`, `add_packaging`, `add_fee`, edição de produto) existiam no registry
   (`src/lib/ai/tool-registry.ts:99-352`) sem equivalente manual na UI — matriz de paridade em
   `REPORT.md` §7.

## 3. Contrato (invariante falsificável)

> Navegar para `/produtos/composicao?produto=<id>` renderiza a **página de composição** (`h1` **próprio**
> "Composição do produto"), **NÃO** a lista do pai — verificado por URL **e** conteúdo, com o par
> negativo (`h1` do pai = 0) na mesma asserção.

Corolários registrados: cada mutação manual é conferida **no banco** (não por toast); a remoção é
**humana, com guarda e verbo honesto** ("Remover"); vermelho **só** onde a ação é irreversível; `ESC`
devolve o foco ao gatilho.

## 4. Mudanças (arquivo por arquivo, como registradas em `REPORT.md` §3 e §4)

| arquivo                                              | estado   | delta                  | natureza                                                                         |
| ---------------------------------------------------- | -------- | ---------------------- | -------------------------------------------------------------------------------- |
| `src/routes/_authenticated/produtos_.composicao.tsx` | **novo** | 860 linhas             | rota FLAT + porta manual completa                                                |
| `src/routeTree.gen.ts`                               | mod      | +22                    | **gerado** (`/_authenticated/produtos_/composicao`, path `/produtos/composicao`) |
| `src/routes/_authenticated/produtos.tsx`             | mod      | +31 / −12, **7 hunks** | Fase 1 (selada) + botão "Composição" + fio `onCompose`                           |
| `e2e/composicao-manual.spec.ts`                      | **novo** | 53 linhas, 2 casos     | teste de regressão do passo 0                                                    |
| `docs/evidence/agent-state/PROGRESS.md`              | mod      | +34                    | journal L948…L956 (append-only)                                                  |
| `docs/evidence/agent-state/DEBTS.md`                 | mod      | +7                     | **DBT-124** (defeito novo medido)                                                |
| `docs/runbooks/bancada-local-preview.md`             | **novo** | runbook                | **E3** — conhecimento do kit, versionado                                         |
| `docs/evidence/fase2a-2026-10-18/**`                 | **novo** | relatório + 7 capturas | este `SPEC.md` e o bruto                                                         |

**O rename conta como hunk e o git não o vê:** a rota nasceu `produtos/composicao.tsx` (aninhada) e
virou `produtos_.composicao.tsx` (flat); `git log --all -- <caminho antigo>` é **vazio** (os dois lados
são untracked nesta linhagem), então o rename está registrado no journal e no `routeTree.gen.ts`
regerado — `REPORT.md` §4 (parágrafo final do diff).

**Não muda:** gates, budgets, ADRs, RLS, migrations, qualquer alvo remoto. Nenhum commit, push ou
migration nesta sessão.

## 5. DoD (critérios binários, cada um com o artefato que o prova)

| #   | critério                                                                      | artefato                                                                                                                     |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | passo 0: URL **e** conteúdo, `h1` do pai = 0 (antes × depois)                 | `captures/prova-fase2a.json.txt`                                                                                             |
| 2   | paridade das 6 portas manuais, mutação conferida no banco                     | `captures/prova-fase2a.json.txt`                                                                                             |
| 3   | remoção com guarda: HTTP 409 `CONFLICT`, linha permanece, `ESC` devolve foco  | `captures/prova-fase2a.json.txt`                                                                                             |
| 4   | cor por sítio no mesmo run, separando `bg-destructive` real de `aria-invalid` | `captures/cor-remocao-3-sitios.txt`                                                                                          |
| 5   | densidade da linha de produto e alvo de toque (D4)                            | `captures/d4-densidade.json.txt`                                                                                             |
| 6   | lint / typecheck / suíte / e2e / registry de dívidas                          | `captures/gates.txt`                                                                                                         |
| 7   | as 4 telas da rota, desktop e mobile                                          | `captures/01-composicao.png`, `02-dialogo-remocao-guarda.png`, `03-linha-produto-desktop.png`, `04-linha-produto-mobile.png` |

## 6. Testes (e a falsificação)

- `e2e/composicao-manual.spec.ts` — **2 casos × 2 projetos** (chromium + mobile) = **4 execuções**; a
  suíte foi de **42 → 46**, e o `REPORT.md` §4.2 registra explicitamente que nada foi removido, pulado
  ou afrouxado para chegar ao verde.
- Gates medidos (`captures/gates.txt`): `npm run lint` exit 0 · `npm run typecheck` exit 0 ·
  `npm run test` exit 0 (**147 arquivos, 2315 testes**) · `npx playwright test --project=chromium
--project=mobile` exit 0 (**46 passed**, 1,1 min) · `node scripts/m02-debts-guard.mjs` exit 0
  (**107 dívidas**).

## 7. Riscos e limites declarados

- **S6 adversarial de contexto limpo NÃO foi executado.** O que existe é a série de controles do
  próprio pacote (§5–§6) e a reconciliação independente de `L958`.
- **DBT-124** — a remoção de embalagem nunca conclui (affordance existe, ação não conclui): **ABERTA**
  no registry.
- **44px de alvo de toque / hit-slop** — **não** adotado: o menor lado medido é **32px** (WCAG 2.2 AA
  exige 24px) e inflar o botão mudaria o **36×36** que a Fase 1 mediu e selou. Fica como **limite
  declarado** e follow-up (§7 do relatório).
- **`set_price_and_tax`** continua **parcial** (preço, regime e alíquota seguem só-IA);
  **`set_market_price`** tem a tool e o server fn e **nenhum consumidor na UI** — gap novo medido nesta
  sessão, declarado.
- **Contaminação de IA:** houve **9 chamadas reais** `success` em 2026-10-18 (21:54Z–22:02Z) do kit
  defeituoso; a partir de 22:04:07Z tudo liquida `error_dependency_error` com `real: 0`. A exposição foi
  de **credencial/orçamento**, não de dados (tenant de fixture com a forma semeada).
- **Firefox + WebKit** rodam na matriz de PR/dispatch, não no dia a dia — declared em §9 follow-up 1.

## 8. Rollback

Nenhum commit foi feito nesta sessão: os arquivos do pacote são **untracked** e o "rollback" é
remover os arquivos criados e desfazer o `format`/journal append-only pelo procedimento do journal.
Sem migration, sem branch, sem estado remoto a desfazer.
