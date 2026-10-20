# Fase 2a — correção da rota de composição e conclusão da composição manual (relatório)

> **Escopo:** adoção formal da intenção órfã **L948**, correção da rota quebrada (`/produtos/composicao`
> mudava a URL e renderizava a lista do pai) e conclusão da **porta manual** equivalente às tools de
> escrita da IA. Princípio que rege o pacote: _"o usuário deve ter liberdade manual mesmo com a IA
> inserida de forma agêntica no sistema"_ (paridade, honestidade, não-exclusividade, monopólio
> destrutivo humano).
> **Janela medida:** 2026-10-18 20:20Z–2026-10-19 03:xxZ (local America/Bahia, UTC−3).
> **Árvore:** `/home/douglas/WebstormProjects/preco-que-da-lucro`, `develop`, HEAD `4206303`.
> Nenhum commit, nenhum push, nenhuma migration, nenhum alvo remoto.

---

## 1. De-dup e health check

**De-dup (Tarefa −1).** O pacote **não** estava fechado, então não parei:

| linha     | estado lido                                                                             | decisão                    |
| --------- | --------------------------------------------------------------------------------------- | -------------------------- |
| L948      | ▶ **órfã** (sem ✔/✘) — a intenção da Fase 2 (`produtos/composicao.tsx` + CRUD manual)   | **adotada**                |
| L955      | ▶ **órfã** (sem ✔/✘) — a intenção desta própria Fase 2a (adoção + correção + aceitação) | **adotada e reconciliada** |
| L949–L954 | fechadas por outras sessões                                                             | intocadas                  |

**Achado material de árvore (medido, não presumido).** A worktree da sessão
(`/home/douglas/.cline/worktrees/b1dd8`, branch `cline/b1dd8`, HEAD `4206303`) está **limpa e sem o
pacote**: não tem `produtos_.composicao.tsx`, não tem `.artifacts/`, e o journal dela **termina em
L928**. O estado do pacote vive na **árvore principal** `/home/douglas/WebstormProjects/preco-que-da-lucro`
(mesmo `develop`, mesmo commit), e é essa árvore que a bancada serve
(`/proc/148802/cwd` → árvore principal). Trabalhei na árvore que **tem** o estado; fazê-lo na worktree
vazia seria fabricação. Este parágrafo existe para que ninguém procure o trabalho no lugar errado.

**Health check (Tarefa 0 / E5).**

| alvo    | comando                                            | resultado                                              |
| ------- | -------------------------------------------------- | ------------------------------------------------------ |
| PG      | container `preco-que-da-lucro-postgres` em `:5432` | **de pé** (banco de fixture `preco_que_da_lucro_test`) |
| preview | `curl -o /dev/null -w %{http_code} :4173/`         | **200**                                                |
| preview | `:4173/inicio`                                     | **200**                                                |
| preview | `:4173/produtos/composicao` (anônimo)              | **307** — redirecionamento SSR de auth, o esperado     |

A bancada **ficou de pé** entre sessões, como decidido (E5).

---

## 2. Adoção COMO registrada e aceitação COMO pré-registrada

**Adoção (registrada em L955, re-conferida em L956).** Assumi o escopo declarado em L948 com intenção
retroativa, tendo a **correção da rota como primeiro ato**, e o registro nomeia os três escopos:
correção da rota, conclusão da composição manual e os gaps de paridade visados.

**Aceitação pré-registrada — PASSO 0 permanente (escrita ANTES de qualquer edição; virou teste da
suíte):**

> navegar para `/produtos/composicao?produto=<id>` renderiza a página de composição (h1 **próprio**),
> **NÃO** a lista do pai.

A aceitação **sobreviveu ao seu autor** — foi pré-registrada antes do edit, e é dela o crédito. O que
o autor não fez foi o `✔`: a sessão de L955 morreu depois de aplicar a correção e **antes** de fechar
o journal. Registro aqui a **ordem real dos fatos**, reconciliada por mtime local × UTC (UTC−3):
intenção L955 às 20:20 local → rename às 22:55–23:01 local → spec às 22:57 → prova de runtime às
23:16–23:20 → build 23:51 → silêncio. Nada disso foi presumido por confiança: medido em disco.

---

## 3. Diff por hunk

Toda a alteração é **escopada**; nenhum arquivo fora do pacote foi tocado e **nenhum hunk alheio foi
modificado**.

| arquivo                                              | estado   | delta                  | natureza                                                                                                                       |
| ---------------------------------------------------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/_authenticated/produtos_.composicao.tsx` | **novo** | 860 linhas             | rota FLAT + a porta manual completa                                                                                            |
| `src/routeTree.gen.ts`                               | mod      | +22                    | **gerado** (id `/_authenticated/produtos_/composicao`, path `/produtos/composicao`, `getParentRoute: AuthenticatedRouteRoute`) |
| `src/routes/_authenticated/produtos.tsx`             | mod      | +31 / −12, **7 hunks** | Fase 1 (selada) + botão "Composição" + fio `onCompose`                                                                         |

---

## 4. Evidências runtime, gates e suíte

Captura bruta: `captures/prova-fase2a.json.txt` (script`.artifacts/cu/prova-fase2a.mjs`, gitignored) —
read-only fora das mutações declaradas; **cada mutação medida no banco** e a fixture restaurada no fim.

**Passo 0 — a aceitação pré-registrada, antes × depois:**

| medição                                      | antes (L954, rota aninhada)                                 | **depois (agora)**                                                            |
| -------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| h1 após clicar "Composição"                  | "Meus Produtos" (a lista do pai)                            | **"Composição do produto"**                                                   |
| heading do pai montado                       | 1                                                           | **0**                                                                         |
| URL                                          | `/produtos/composicao?produto=…` — muda, mas a tela **não** | `/produtos/composicao?produto=00000000-…-0010` **e a tela é a de composição** |
| deep link (documento novo: SSR + hidratação) | —                                                           | h1 "Composição do produto", pai **0**                                         |
| rótulo do gatilho                            | —                                                           | `Editar composição de Produto de teste`                                       |

**Paridade — cada mutação manual conferida no banco, não por toast:**

| tool da IA                                | porta manual                                                                         | medido                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `set_yield`                               | campo Rendimento + "Salvar produto"                                                  | `yield_qty` 10 → **20**, `version` 9 → **10** (CAS por version)                                                       |
| `add_ingredients` + `set_ingredient_cost` | diálogo "Adicionar" ingrediente (nome, qtd usada, unidade, preço e qtd da embalagem) | `product_ingredients` 0 → **1**; `purchase_price_history` **1**; linha `Ingrediente com historico 50.000000 @20.0000` |
| `add_packaging`                           | diálogo "Adicionar" embalagem                                                        | `product_packaging` 1 → **2**                                                                                         |
| `add_fee`                                 | diálogo "Adicionar" taxa                                                             | `sales_fees` 1 → **2**                                                                                                |

**O custo recalcula por causa da mutação:** rendimento 20 → `Custo: R$ 10,05 · Preço: R$ 20,00 ·
Margem: 34,75%`; rendimento 10 → `Custo: R$ 10,10 · Preço: R$ 20,00 · Margem: 34,50%`; `DADOS
INCOMPLETOS` = 0 nos dois. No fim a fixture volta ao estado inicial (`yield_qty` 10, ingredientes 0,
embalagens 1, taxas 1).

**Remoção — humana, com guarda e verbo honesto.** Diálogo `Remover Ingrediente com historico?`, corpo
honesto ("A remoção é definitiva e não pode ser desfeita. Se houver histórico de preços ou outro
registro ligado a este item, o servidor recusa e nada é apagado."), botões `[Cancelar, Remover]`.
Confirmar devolve **HTTP 409** com envelope `CONFLICT` e a linha **permanece** (ingredientes 2 → 2,
histórico intacto) + aviso na tela. `ESC` fecha e **devolve o foco ao gatilho**
(`focoVoltouAoGatilho: true`).

**Teclado:** os dois gatilhos de remoção recebem foco por teclado; `ESC` devolve o foco — sem regressão
face à Fase 1.

**Console e rede:** os **únicos** eventos ≥400 da sessão são os **dois 409 intencionais** do teste de
guarda (propositais, com recusa honesta e mensagem na tela) — **zero** erro inesperado de console ou de
rede.

**Affordance (recipiente visível persistente + `aria-label` nomeando o alvo):** `Adicionar` 434×32,
`Editar embalagem` 89×32, `Remover embalagem` **36×36**, `Remover ingrediente` 36×36 — todos com fundo
`oklch(1 0 0)` e borda `oklch(0.92 0.004 286.32)`.

**Cor é rótulo — léxico medido nos três sítios, no mesmo run** (`captures/cor-remocao-3-sitios.txt`):

| sítio                  | semântica do servidor | ação              | fundo medido                | `bg-destructive` |
| ---------------------- | --------------------- | ----------------- | --------------------------- | ---------------- |
| `/produtos`            | **SOFT** (arquiva)    | "Arquivar"        | `oklch(0.21 0.006 285.885)` | **false**        |
| `/despesas`            | **HARD**              | "Excluir despesa" | `oklab(0.577 … / 0.1)`      | **true**         |
| `/produtos/composicao` | **HARD** + guarda     | "Remover"         | `oklab(0.577 … / 0.1)`      | **true**         |

Vermelho **só** onde a ação é irreversível. O probe distingue `bg-destructive` real de
`aria-invalid:…-destructive` (o artefato que inflou a contagem na Fase 1): os dois "Cancelar" aparecem
com `apenasAriaInvalid: true` e **não** contam como vermelho. `erros => []`.

### 4.1 Decisão D4 — densidade da linha de produto e alvo de toque

Medido em `.artifacts/cu/d4-densidade-linha.mjs` (capturas `03` e `04`):

| viewport | card       | controles                                      | linhas de controle | menor lado | WCAG 2.2 AA (24px) | 44px |
| -------- | ---------- | ---------------------------------------------- | ------------------ | ---------- | ------------------ | ---- |
| 1440×900 | 136 × 1088 | Ver 48×32 · Composição 131×32 · Arquivar 36×36 | **1**              | 32         | **passa**          | não  |
| 390×844  | 268 × 358  | Ver 48×32 · Composição 131×32 · Arquivar 36×36 | **1**              | 32         | **passa**          | não  |

**Rationale das decisões:**

1. **Rótulo textual vs ícone.** "Composição" mantém **rótulo textual + ícone** com recipiente
   persistente: a ação não é auto-evidente por ícone e a paridade precisa ser _descobrível_ (corolário
   2 — rótulo = comportamento). "Arquivar" segue **ícone + recipiente + `aria-label` que nomeia o
   alvo**; um segundo rótulo textual por linha seria ruído, porque o diálogo já nomeia a ação.
2. **O rótulo textual custa densidade zero — medido.** A 390px os três controles somam **231px dos
   318px** úteis e continuam em **uma linha**; não há wrap em nenhum viewport.
3. **Alvo de toque: NÃO inflar para 44px e NÃO acrescentar hit-slop.** (a) o menor lado medido é
   **32px** ⇒ o mínimo **WCAG 2.2 AA (2.5.8, 24px)** é atendido com folga; (b) 44px é **AAA (2.5.5)** /
   recomendação de plataforma, não a régua adotada neste repo, e nada nele a adota; (c) inflar o botão
   de ícone mudaria o **36×36 que a Fase 1 já mediu e selou** — converteria preferência de layout em
   **falsificação de evidência anterior**. Fica como **limite declarado** e follow-up (§9), a
   renegociar num pacote de layout onde a densidade da linha é o objeto.

| `e2e/composicao-manual.spec.ts` | **novo** | 53 linhas, 2 casos | o teste de regressão do passo 0 |
| `docs/evidence/agent-state/PROGRESS.md` | mod | +34 | journal L948…L956 (append-only) |
| `docs/evidence/agent-state/DEBTS.md` | mod | +7 | **DBT-124** (defeito novo medido, §5) |
| `docs/runbooks/bancada-local-preview.md` | **novo** | runbook | **E3** — o conhecimento do kit, versionado |
| `docs/evidence/fase2a-2026-10-18/**` | **novo** | relatório + 7 capturas | este relatório e o bruto |

**O rename conta como hunk — e é um hunk que o git NÃO vê.** A rota nasceu `produtos/composicao.tsx`
(aninhada) e virou `produtos_.composicao.tsx` (flat). Confirmado por `git log --all -- <caminho
antigo>`: **vazio** — os dois lados são _untracked_ nesta linhagem de trabalho, então nenhum diff de
git mostra a renomeação; ela está registrada no **journal** (L955/L956) e no **`routeTree.gen.ts`**
regenerado, que é a fonte de verdade da árvore de rotas. Quem ler só `git diff` não veria o primeiro
ato do pacote — por isso ele está escrito aqui.

**Hunks alheios preservados (não toquei):** `lift hover:shadow-md` do card de produto e o guard
`v &&` do `Select` em `despesas.tsx`. Os hunks alheios de `AGENTS.md` (fechamento do DBT-33 no
`guard:mcp-runtime` + a seção _Operational map_) também ficaram intactos.

---

### 4.2 Gates e suíte (executados ao final, contra a bancada de pé)

| gate                | comando                                                   | resultado                                                   |
| ------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| lint                | `npm run lint`                                            | **exit 0**                                                  |
| tipos               | `npm run typecheck`                                       | **exit 0**                                                  |
| testes unitários    | `npm run test`                                            | **exit 0** — 147 arquivos, **2315 testes**                  |
| e2e                 | `npx playwright test --project=chromium --project=mobile` | **exit 0** — **46 passed (1.1 min)**, sem falha e sem flaky |
| registry de dívidas | `node scripts/m02-debts-guard.mjs`                        | **exit 0** — **107 dívidas**, taxonomia e regra de closure  |

Captura bruta: `captures/gates.txt`.

**A suíte foi de 42 para 46 — não para 44.** Refinamento honesto da expectativa do prompt: o spec novo
tem **2 casos** e roda em **2 projetos** (chromium + mobile), então acrescenta **4** execuções, não 2.
Nada foi removido, pulado ou afrouxado para chegar ao verde.

**Checklist pre-registrado da Tarefa 4, item a item:**

- [x] **Rota alcançável (passo 0)** e teste de regressão na suíte (`e2e/composicao-manual.spec.ts`,
      2 casos × 2 projetos) — a classe "a URL muda mas a tela é a do pai" não passa mais despercebida,
      porque a asserção é **conjunta** (URL **e** conteúdo) e o par negativo (`h1` do pai = 0) está nela.
- [x] **Composição manual fecha os gaps visados**; matriz de paridade atualizada (§7).
- [x] **Remoções** com guarda (409 `CONFLICT` medido, nada apagado) + **verbo honesto** ("Remover") + **affordance** (recipiente persistente 36×36 + `aria-label` nomeando o alvo).
- [x] **Teclado opera tudo** (foco por teclado nos dois gatilhos; `ESC` devolve o foco ao gatilho);
      **0 erro inesperado** de console/rede; **diff escopado**; **hunks alheios intactos**.
- [x] **Não-regressão da Fase 1**: recipiente persistente, `aria-label` nomeando o alvo, foco, diálogo
      honesto ("Arquivar produto?", **sem** `destructive`), vermelho **só** onde é irreversível (os três
      sítios medidos no mesmo run), `ESC`/foco, console/rede limpos.

---

## 5. Runbook do kit versionado (E3) — onde ficou

**`docs/runbooks/bancada-local-preview.md`** (arquivo novo, entra no diff do pacote). Ele carrega os
**mecanismos** e os **nomes** — nunca valores:

1. **Zerar as DUAS credenciais de IA** — `AI_GATEWAY_API_KEY` (legado) **e** `DEEPSEEK_API_KEY` (atual):
   zerar só a legada deixa a atual ativa no `.env` e a bancada passa a fazer chamadas reais.
2. **Entrada direta do build**, não `nitro preview`: `node --env-file-if-exists=.env
.output/server/index.mjs`.
3. **O mecanismo que explica os dois anteriores:** `nitro preview` carrega o `.env` em _runtime_ e
   **sobrescreve** a variável exportada vazia (A/B medido: `ai.model_attempt outcome=success` com o env
   inicial vazio); o entry direto **não** sobrescreve o que já está no ambiente (semântica do Node) ⇒ o
   vazio exportado vence para a IA e os segredos de auth seguem vindo do `.env`.
4. **Armadilha medida:** `/proc/<pid>/environ` mostra o ambiente **INICIAL** e **não** reflete o dotenv
   de runtime — **não é prova** de que as chaves estão vazias; a prova é o A/B de comportamento ou o log.
5. **Caminhada autenticada** (o padrão dos probes): `storageState: .artifacts/e2e-auth.json` +
   `createRequire(<repo>/package.json)` para resolver `playwright-core` + `channel: "chrome"` +
   `x-forwarded-for` de bucket próprio; medições de banco por
   `docker exec … psql -U postgres -d preco_que_da_lucro_test -tAc`, **sempre escopando por
   `product_id`/`tenant_id`**.
6. **Suíte:** com a bancada de pé o Playwright **reusa** o servidor (`reuseExistingServer`), porque o
   `webServer.command` do config usa `npm run preview` (= `nitro preview`) e religaria as credenciais de
   IA do `.env`.
7. **Errata do kit** (registrada, não apagada): a primeira correção zerava só a credencial legada, e a
   primeira hipótese foi `nitro preview` + env exportado.

Os **scripts** de probe ficam em `.artifacts/` (gitignored — `.gitignore:82`), porque carregam credencial
de fixture; foi o **conhecimento**, não o segredo, que virou contrato versionado. Sem este runbook, a
matriz completa de e2e no PR revive o vazamento de IA real.

---

## 6. Verificação de contaminação (E4) — como foi confirmada

**Quanto foi exposto (medido, não estimado).** `ai_usage` no banco de fixture local:

| data (UTC)     | outcome                  | n     | janela                    |
| -------------- | ------------------------ | ----- | ------------------------- |
| 2026-10-17     | `success`                | 1     | 05:04:40Z                 |
| 2026-10-17     | `error_dependency_error` | 1     | 04:59:43Z                 |
| **2026-10-18** | **`success`**            | **9** | **21:54:35Z → 22:02:53Z** |
| 2026-10-18     | `error_dependency_error` | 5     | 22:04:07Z → 22:04:58Z     |
| 2026-10-19     | `error_dependency_error` | 4     | 02:21:32Z → 02:22:07Z     |

O bloco de **9 chamadas reais** é do kit defeituoso (as rodadas que reprovaram por invocação, antes do
conserto). A partir de 22:04:07Z **nada mais é `success`**: tudo liquida `error_dependency_error` com
`real: 0`, e o log vivo do preview mostra `ai.credential_unusable` com `provider: deepseek` e
`reason: "absent"` ⇒ **nenhuma chamada externa** depois do conserto nos três sítios.

**Contaminação de dados: nenhuma, medida.** O tenant de fixture (`00000000-…-0002`) tem **exatamente** a
forma semeada: **2 produtos** (ambos `draft`, os dois do seed), **0 ingredientes**, **1 embalagem**,
**1 taxa**, **2 despesas**, **1 preço de mercado**, **0 histórico de preços**. As **10 tools de escrita**
estavam disponíveis para a IA real (registry) e **nenhuma linha entrou**.

**Por que o re-seed basta:** `scripts/e2e/seed-auth.ts:47-52` percorre `TENANT_SCOPED_TABLES`
(`scripts/db/purge-fixtures.ts:41-66`) com `delete from <tabela> where tenant_id = $1` **antes** de
reinserir — e a lista inclui `ai_usage`, `products`, `product_ingredients`, `product_packaging`,
`sales_fees`, `expenses`, `market_prices` e `purchase_price_history`. Qualquer resíduo do tenant de
fixture é apagado **por construção** no seed seguinte; e o seed roda **antes** do preview.

**Limite honesto:** as linhas de `ai_usage` em si permanecem até o próximo seed (o último rodou
21:53:58Z, **antes** das chamadas) — elas são o **ledger de orçamento de um tenant que o seed apaga**,
não conteúdo; e são justamente o que permitiu **contar** a exposição com exatidão em vez de estimá-la.

**Conclusão:** a exposição foi de **credencial/orçamento**, não de dados.

---

## 7. Matriz de paridade atualizada e próximos pacotes

As 10 tools de escrita do agente (`src/lib/ai/tool-registry.ts:99-352`) contra a superfície manual:

| tool da IA                                       | porta manual                                                                                               | antes   | **agora**                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| `create_product`                                 | `/novo-produto`                                                                                            | OK      | OK                                       |
| `add_ingredients`                                | `/produtos/composicao` → Adicionar ingrediente                                                             | so IA   | **fechado**                              |
| `set_ingredient_cost`                            | `/produtos/composicao` → Editar ingrediente                                                                | so IA   | **fechado**                              |
| `set_yield`                                      | `/produtos/composicao` → Rendimento                                                                        | so IA   | **fechado**                              |
| `add_packaging`                                  | `/produtos/composicao` → Adicionar embalagem                                                               | so IA   | **fechado** (remoção morta: **DBT-124**) |
| `add_fee`                                        | `/produtos/composicao` → Adicionar taxa                                                                    | so IA   | **fechado**                              |
| edição do produto (nome / unidade do rendimento) | `/produtos/composicao`                                                                                     | so IA   | **fechado**                              |
| `set_price_and_tax`                              | parcial — preço e regime/alíquota seguem **so IA**                                                         | parcial | **parcial** (próximo pacote)             |
| `set_market_price`                               | **nenhum consumidor de `setMarketPrice` na UI** (medido por grep; a tool insere em `market_prices` direto) | so IA   | **so IA — gap NOVO medido nesta sessão** |
| `add_expense`                                    | `/despesas`                                                                                                | OK      | OK                                       |
| `finish_product`                                 | não muta dado (confirma a coleta); o caminho manual é o próprio `/novo-produto`                            | OK      | OK                                       |

**Próximos pacotes, por ordem de paridade** (proxy: quanto do valor do produto depende só da IA):

1. **`set_price_and_tax`** — preço, regime e alíquota: o dado mais central do produto ainda é só-IA.
2. **`set_market_price`** — gap novo medido: a tool existe, o server fn existe e **nada na UI o chama**.
3. **DBT-124** — fechar a remoção de embalagem (a affordance existe e nunca conclui).
4. **Despesa, guarda-ou-soft** (pendência **D2-d**): hoje é HARD **sem guarda**.
5. **Desarquivar** (o inverso do arquivar, hoje só há o SOFT de ida).
6. **Undo + autoria IA×usuário** — pré-requisito declarado do ADR-046 para qualquer tool de remoção.
7. **Alvo de toque 44px** (pacote de layout, §4.1).

---

## 8. Erratas

1. **L954 dizia "~7 turns REAIS de IA".** Medido agora: **10 linhas `success`** — **9** em 2026-10-18
   (21:54:35Z→22:02:53Z) e **1** em 2026-10-17 (05:04:40Z). O número exato **refina** a errata; a errata
   **não é apagada**.
2. **L955 não tem `✔` — e não foi esquecimento de escrita:** a sessão morreu **depois** de aplicar a
   correção e antes de fechar o journal. O intent **não é reescrito** (o par é append-only); ele é
   **reconciliado** em L956, com a ordem real dos fatos reconstruída por mtime × UTC (UTC−3).
3. **Errata minha, de recebimento.** Li no prompt que _"a correção NÃO foi aplicada"_; a medição em
   disco mostrou o **contrário** (a rota já era FLAT e o `routeTree` já estava regerado). **Não
   reapliquei** — reexecutar às cegas sobre uma órfã é exatamente o que o protocolo de boot proíbe.
4. **Contagem de "destructive" inflada pelo próprio probe.** O bloco de guarda da `prova-fase2a.mjs`
   reporta `acaoDestructive: 2` porque o seletor casa `class*="destructive"`, que inclui
   `aria-invalid:…-destructive`. A contagem honesta é **1** — confirmada pelo probe dedicado
   (`captures/cor-remocao-3-sitios.txt`), que separa `bg-destructive` real de `apenasAriaInvalid`. É a
   **mesma classe de artefato** que a sessão da Fase 1 já tinha nomeado.

5. **Colisão de duas sessões na MESMA árvore (declarada, não escondida).** Este pacote foi trabalhado
   por **duas sessões ao mesmo tempo**, na mesma árvore. O journal registra a colisão de numeração e
   uma **verificação independente em runtime** (que reconfirmou o passo 0 e a paridade) em **L958**
   (03:06Z), declarando expressamente que **não sobrescreveu este relatório**; o veredito do pacote é a
   linha **L957** (03:05Z). Medido como **deste** autor: a rota FLAT, o `routeTree`, a conclusão da
   composição manual, o **DBT-124**, as capturas (`prova-fase2a`, `cor-remocao`, `d4-densidade`,
   `gates`) e este relatório. **Nada foi perdido nem duplicado** — `DBT-124` aparece **uma vez** no
   registry, o diff do `DEBTS.md` é **7/0** (só a minha linha) e as capturas carregam os números das
   minhas execuções. **Lição de coordenação:** duas sessões na mesma árvore podem colidir sem corromper,
   desde que cada uma **reconcilie em vez de competir**.

---

## 9. Follow-ups

| #   | follow-up                                                                                       | origem                  | estado                                   |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| 1   | **firefox + webkit** rodam na matriz do PR/dispatch, não no dia a dia                           | prompt / runbook        | pendente (o dia a dia é chromium+mobile) |
| 2   | `set_price_and_tax` completo (preço, regime, alíquota)                                          | §7                      | próximo pacote                           |
| 3   | `set_market_price` sem consumidor na UI                                                         | §7 (gap novo medido)    | declarado                                |
| 4   | **DBT-124** — remoção de embalagem nunca conclui                                                | §4/§6, DEBTS.md         | ABERTA no registry                       |
| 5   | **despesa guarda-ou-soft** (pendência D2-d)                                                     | prompt                  | declarado                                |
| 6   | **44px** de alvo de toque / hit-slop                                                            | §4.1 (limite declarado) | pacote de layout                         |
| 7   | desarquivar; undo; autoria IA×usuário; tools de remoção para a IA **só depois** de undo+autoria | ADR-046                 | fora de escopo, por decisão              |
| 8   | **Selo/MANIFEST** desta pasta de evidência **não** foram produzidos nesta sessão                | limite declarado        | não fabricado de propósito               |

**Limite declarado do relatório:** este documento não é um selo de work package (sem
`MANIFEST.sha256`/S6 adversarial). Ele registra medições com captura bruta; a cerimônia de selo é passo
separado e não foi simulada.
