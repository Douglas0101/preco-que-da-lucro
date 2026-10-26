# Caça a bugs profunda — bateria de 5 agentes em paralelo (2026-10-21)

> **O que este pacote é:** a evidência de uma bateria de caça a bugs executada na bancada local
> (`:4173`, Postgres local `preco_que_da_lucro_test`) **antes** de qualquer commit ou push, com 5
> agentes em paralelo, uma frente por agente.
>
> **O que este pacote NÃO é:** um relatório de "a suíte passa". A suíte já passava. Aqui há
> **25 achados** — 1 crítico, 3 altos, 9 médios e 12 baixos — todos com passos de reprodução,
> número medido e classificação.
>
> **Nada foi commitado.** Nenhum arquivo de produção foi alterado. Nenhum recurso remoto foi
> tocado (Vercel, Neon, Hostinger, GitHub, deploy, alias). O journal da sessão é
> `docs/evidence/agent-state/PROGRESS.md`; as dívidas novas são `DBT-148..DBT-172` em
> `docs/evidence/agent-state/DEBTS.md`.

---

## 1. Sumário — o que foi encontrado

O achado que muda a prioridade do backlog **não** veio das fases de performance ou acessibilidade.
Veio da fase exploratória, de um fluxo que ninguém tinha exercitado no browser: **excluir uma
despesa**.

| #   | achado                                                                                                                                                          | severidade  | onde                                          | dívida                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- | ----------------------- |
| 1   | **Excluir despesa está morto** — o papel de runtime `app_runtime` não tem `DELETE` em `expenses`, `products` e `simulations` ⇒ HTTP **503** e a linha permanece | **CRÍTICA** | `drizzle/0001_p0_runtime_role_and_rls.sql:42` | `DBT-160`               |
| 2   | **OTel não entrega payload algum** no build compilado — o SDK inicia, 0 requisições OTLP                                                                        | **ALTA**    | `src/instrumentation/telemetry.ts`            | `DBT-148`               |
| 3   | **O foco escapa dos modais** em Chromium e WebKit (o `ESC` devolve, a _contenção_ não)                                                                          | **ALTA**    | `src/components/ui/`                          | `DBT-149`               |
| 4   | **`DECIMAL_OVERFLOW` escapa sem tratamento** em duas telas (exceção crua; toast com código interno)                                                             | **ALTA**    | `/despesas`, `/precos`                        | `DBT-161`               |
| 5   | **Clickjacking**: `x-frame-options` ausente e a CSP em _report-only_ deixa `frame-ancestors` inefetivo ⇒ a página é embutível em `<iframe>` de outra origem     | MÉDIA       | `src/lib/security-headers.ts:39-57`           | `DBT-157`               |
| 6   | **Contraste AA violado em `/produtos`** (2,15:1 e 3,20:1) — reconfirma `DBT-123` e revela que **o gate de axe não varre a rota**                                | MÉDIA       | `e2e/ui-stack.spec.ts`                        | `DBT-159` (+ `DBT-123`) |
| 7   | **Não há baseline de pixel** no projeto — 24 baselines determinísticas foram geradas e estão prontas para integrar                                              | MÉDIA       | `e2e/visual/`                                 | `DBT-152`               |
| 8   | `/vendas` não valida `NaN`/`Infinity`; a mensagem específica é inalcançável                                                                                     | MÉDIA       | `src/routes/_authenticated/vendas.tsx`        | `DBT-162`               |
| 9   | `/vendas` com data vazia mostra **"Invalid time value"** (erro interno cru, em inglês)                                                                          | MÉDIA       | idem                                          | `DBT-163`               |
| 10  | Rolagem horizontal a 320 px em `/produtos` e na landing (3/3 engines)                                                                                           | MÉDIA       | `produtos.tsx`, `index.tsx`                   | `DBT-164`               |
| 11  | Ativar o seletor de período **perde o foco** (vai para `<body>`)                                                                                                | MÉDIA       | `inicio.tsx`                                  | `DBT-165`               |
| 12  | `Enter` num campo do diálogo de composição **não submete** (o `AlertDialog` não tem `<form>`)                                                                   | MÉDIA       | `produtos_.composicao.tsx`                    | `DBT-166`               |
| 13  | Preço de mercado **não tem via de UI** — só o chat grava ⇒ produto incompleto para sempre                                                                       | MÉDIA       | `src/lib/products.functions.ts:777`           | `DBT-167`               |
| 14  | Contador **"0 produtos cadastrados"** exibido junto do alerta de erro (falso)                                                                                   | BAIXA       | `produtos.tsx:88`                             | `DBT-154`               |
| 15  | Landing loga `console.error` quando o backend cai por **rede** (o caminho HTTP 500 é silencioso)                                                                | BAIXA       | `src/routes/index.tsx:45-47`                  | `DBT-155`               |
| 16  | `Object.freeze` não protege o array interno `d` das constantes `Decimal`                                                                                        | BAIXA       | `src/lib/decimal-constants.ts:12-13`          | `DBT-156`               |
| 17  | O **log do servidor** (não a resposta) vaza SQL + token de sessão + caminho absoluto                                                                            | BAIXA       | `auth.server.ts`, `src/start.ts:62-68`        | `DBT-158`               |
| 18  | Tema escuro **não existe** como estado alcançável (nenhum código aplica `.dark`)                                                                                | BAIXA       | `src/styles.css`                              | `DBT-150`               |
| 19  | axe em webkit+dark lê a cor antiga (falso positivo 1,15:1; real 16,48:1)                                                                                        | BAIXA       | gate                                          | `DBT-151`               |
| 20  | `/vendas` renderiza a **data corrente** ⇒ baseline de pixel envelhece todo dia                                                                                  | BAIXA       | `vendas.tsx:58`                               | `DBT-153`               |
| 21  | `/precos` exige um dado que a própria página não tem                                                                                                            | BAIXA       | `precos.tsx`                                  | `DBT-168`               |
| 22  | **Nenhum** formulário associa o erro ao campo (`aria-invalid`, `aria-describedby`, foco)                                                                        | BAIXA       | 5 rotas + 3 diálogos                          | `DBT-169`               |
| 23  | **Zero** `h2`/`h3` em 12/12 rotas — só o `h1`                                                                                                                   | BAIXA       | todas                                         | `DBT-170`               |
| 24  | Premissa extrema **derruba** `/diagnostico` inteiro                                                                                                             | BAIXA       | `diagnostico.tsx`                             | `DBT-171`               |
| 25  | Card de despesa trunca o valor em R$ **sem reticências**                                                                                                        | BAIXA       | `despesas.tsx`                                | `DBT-172`               |

> **Severidade no registry:** a taxonomia de `DEBTS.md` admite `alta` como severidade máxima
> (não há `crítica`). O achado nº 1 é crítico na linguagem do relatório e está registrado como
> `DBT-160` com severidade `alta` — a divergência é **de taxonomia**, não de juízo.

### O achado nº 1, em detalhe (é o que muda a prioridade)

`drizzle/0001_p0_runtime_role_and_rls.sql:42` concede ao papel de runtime:

```sql
GRANT SELECT, INSERT, UPDATE ON TABLE products, expenses, simulations, chat_conversations, ...
```

**Não há `DELETE`** — e o grant nunca existiu em nenhuma migration. Verificado de forma
independente nesta janela, contra o Postgres local:

```
$ psql <como app_runtime> -tAc "select table_name from information_schema.role_table_grants
                             where grantee='app_runtime' and privilege_type='DELETE' order by table_name;"
accounts            ai_memories        ai_memory_conflicts  ai_memory_versions
chat_messages       product_ingredients product_packaging    rate_limits
sales_fees          sessions           users                verifications
```

`expenses`, `products` e `sales` **não estão na lista**. Efeito observado no browser: o diálogo
"Excluir despesa?" — que promete exclusão permanente — responde **HTTP 503**
(`bff.request_failed INTERNAL_ERROR`, `Failed query: delete from "expenses" ...`), o toast diz
"Não foi possível excluir a despesa" e a linha **permanece** (despesas 1→1). A exclusão de
produto e a de venda têm o mesmo caminho.

---

## 2. Comparativo de métricas — antes / depois

### 2.1 Bundle (Fase 1)

| métrica                    | baseline Onda 1 (`L975`) | Onda 1 (depois) | **medido nesta janela** | teto      | folga                   |
| -------------------------- | ------------------------ | --------------- | ----------------------- | --------- | ----------------------- |
| grafo inicial (minificado) | 500.608 B                | 451.284 B       | **451.299 B**           | 500.000 B | **48.701 B (9,74 %)**   |
| entry (minificado)         | 265.408 B                | 219.682 B       | **219.697 B**           | 500.000 B | **280.303 B (56,07 %)** |
| gzip do grafo              | 162.371 B                | 149.045 B       | **149.058 B**           | —         | —                       |

A diferença de **+15 B** foi **atribuída, não presumida**: um bisect por SHA provou que
`HEAD`/`f9a179a`/`5260b34` reproduzem **219.682 B** e que o `vite` 8.2.2 → 8.2.4 produz saída
**byte-idêntica** (sha `358633588df7`). O delta vem do **WIP não commitado** (41 hunks de rename
de identificador minificado, nenhum payload novo). **A hipótese do enunciado — "dependência nova
ou configuração alterada" — foi refutada por medição.**

### 2.2 Performance (Fase 1)

| métrica               | valor                                                                     | como foi medido                                                                                          |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Lighthouse desktop    | perf **0,98** · LCP **974 ms** · TBT **0** · CLS **0** · FCP 867 ms       | `npx lighthouse@12`, `CHROME_PATH` = Chromium 151 do Playwright                                          |
| Lighthouse mobile     | perf **0,71** · LCP **4.874 s** · TBT **0** · CLS **0**                   | idem, sem preset                                                                                         |
| LCP método-compatível | **572 ms** (baseline deep-2026-10-20: 608 ms) ⇒ **−5,9 %, sem regressão** | script F7 (Chromium mobile, CPU 4×, 5 amostras)                                                          |
| INP                   | **não medido**                                                            | o audit `interaction-to-next-paint` exige trace timespan; o Lighthouse 12.8.2 não o emite no modo padrão |

**Não existe baseline de Lighthouse no repositório** (`grep -rli lighthouse docs/evidence/` →
vazio), então "regressão > 5 %" contra baseline **não era avaliável**. A comparação feita é
**método-compatível** com a única evidência existente (F7 da bateria `deep-2026-10-20`) — o LCP
mobile do Lighthouse **não** é comparável a ela (o Lighthouse simula Slow-4G a 1,6 Mbps).

### 2.3 Acessibilidade (Fase 2)

| escopo                             | varreduras    | violações                                                                                 |
| ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| 6 rotas × 3 engines × 2 temas      | 36            | **3** (1 regra `color-contrast`, 2 nós) — **todas** em `/produtos` **light**, 3/3 engines |
| contraste real (2º método, canvas) | —             | `.text-success` **2,15:1**; badge **3,20:1** (exige 4,5:1)                                |
| dark                               | 18 varreduras | **0**                                                                                     |
| controle negativo do axe           | 1             | violação conhecida detectada (axe 2,84 = canvas 2,85); tags 24→38 regras                  |

### 2.4 Teclado (Fase 2)

| métrica                              | valor                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| foco visível                         | **36/36** amostras (6 rotas × 3 engines × 2 viewports)          |
| armadilha de foco (loop em Tab)      | **0**                                                           |
| Sheet mobile: foco preso / devolvido | **12/12** / **12/12**                                           |
| **AlertDialog: foco preso**          | **0/6** no chromium e **0/6** no webkit — **vaza**; firefox 6/6 |

### 2.5 Robustez de API (Fase 3)

| modo de falha          | tempo até o erro | estado exibido                           | retry | tela branca |
| ---------------------- | ---------------- | ---------------------------------------- | ----- | ----------- |
| timeout 12 s           | 12.999 ms        | "Não foi possível carregar os produtos." | sim   | **não**     |
| HTTP 500               | 870 ms           | idem                                     | sim   | **não**     |
| erro de rede (`abort`) | 927 ms           | idem                                     | sim   | **não**     |

Em nenhum caso houve retry automático (2 requisições no total, nunca laço).

---

## 3. Tabela de testes executados

| fase | ferramenta                                   | o que rodou                                     | resultado                                                                  |
| ---- | -------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | `scripts/check-bundle.mjs`                   | grafo/entry/gzip/brotli + sha256                | **PASS** 451.299 B                                                         |
| 1    | gerador próprio (Node, sem dependência nova) | relatório HTML do bundle                        | **48.262 B**, 63 células, 100 % da área                                    |
| 1    | `lighthouse@12`                              | desktop + mobile                                | **0,98** / **0,71**; INP ausente                                           |
| 1    | preview com endpoint OTel morto              | carga da landing + `/api/health/ready`          | sem degradação (4,13 ms vs 3,90 ms) — **mas ver achado nº 2**              |
| 2    | Playwright `toHaveScreenshot`                | 6 rotas × 3 engines + mobile = **24 baselines** | **byte-idênticas** entre 2 gerações; spec verde 3×                         |
| 2    | `@axe-core/playwright`                       | 36 varreduras (light + dark)                    | 3 violações (todas reais, remedidas por canvas)                            |
| 2    | script de teclado próprio                    | 36 amostras + sonda de modal                    | **vazamento de foco** em chromium/webkit                                   |
| 3    | `grep` + reescrita de chunk em voo           | 33 call sites de `toast()`                      | **0** fora de `/auth` e `/_authenticated`                                  |
| 3    | `page.route` → 500 / abort                   | landing com API quebrada                        | 0 pageerror; h1 visível; `<Toaster>` não carregado                         |
| 3    | preview com par de e-mail vazio (`:4176`)    | `POST /api/auth/sign-up/email`                  | **503 `EMAIL_NOT_CONFIGURED`**; usuários **25→25**                         |
| 3    | `tsx` sobre o motor financeiro               | dízima, arredondamento, `Decimal`, 4 fusos      | `100/1,11 = 90,090090…`; `age_days` = 2 em 4 fusos                         |
| 3    | `tsx` + Postgres local                       | 1 turno de chat real                            | produto + 3 ingredientes persistidos; **0** número sem lastro; 6 perguntas |
| 3    | `page.route` (12 s / 500 / abort)            | resiliência                                     | ver §2.5                                                                   |
| 4    | SFDPOT                                       | 6 dimensões × 12 rotas                          | **14 achados**, nenhuma célula vazia                                       |
| 4    | tours                                        | novato (interrompido por 429), erro, teclado    | obstáculos documentados                                                    |
| 4    | `pg` como `app_runtime`                      | `DELETE` em `expenses`                          | **42501** ⇒ achado nº 1                                                    |
| 5    | `curl` + Playwright                          | 9 rotas sem sessão / com cookie forjado         | 9/9 → `/auth?redirect=…`; 0 dado pré-auth no corpo                         |
| 5    | 2 tenants + `pg` como `app_runtime`          | isolamento API **e** banco                      | **404/403**; insert **42501**; update 0 linhas                             |
| 5    | Playwright, 5 alvos × 6 payloads             | injeção                                         | **0 execução**, armazenamento literal, `products` 21→21                    |
| 5    | `curl -I` + iframe de outra origem           | headers                                         | `x-frame-options` **ausente** ⇒ **frame carregou** (controle bloqueou)     |
| 5    | scanner de padrões em 23 respostas           | exposição                                       | **0 vazamento** na resposta HTTP                                           |
| —    | `m02-debts-guard`                            | registry                                        | **OK** (155 dívidas)                                                       |
| —    | `m02:work-package-guard`                     | pacote                                          | **OK**                                                                     |

### 3.1 Gate local (`npm run check`)

| passo                                   | resultado                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **20 dos 21 passos** (todos, menos o 1) | **PASS** — `guard:upgrade`, `check:migration-toolchain`, `guard:contracts`, `m02:work-package-guard`, `m02:debts-guard`, `m02:temporal-guard`, `m02:state:check`, `m02:boundaries`, `m02:secrets-audit`, `guard:mcp-runtime`, `m02:seal-dts:check`, `m02:matrix:check`, `check:ui-stack`, `check:no-supabase-runtime`, `format:check`, `lint`, `typecheck`, `test`, `build`, `check:bundle`                      |
| **passo 1** `m02:lockfile-guard`        | 🔴 **vermelho, pré-existente e alheio**: `lock-sha256-head` — o lockfile do worktree (`61d44458…`) ≠ o do HEAD (`fecae2ed…`), "reescrito sem commit". É o WIP de outra sessão (o patch `vite` 8.2.2→8.2.4, journal `L979`). O **remédio que o próprio guard sugere** (`git checkout -- package.json package-lock.json`) **descartaria trabalho de outra sessão** ⇒ **não foi aplicado** (custódia, `AGENTS.md`). |
| `npm run check`                         | **exit 1**, parado no passo 1. **Não se declara o gate verde.**                                                                                                                                                                                                                                                                                                                                                  |

### 3.2 Estado da árvore ao fim

| item                                            | estado                                                                                                                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HEAD                                            | `363eb43ff9b4702bb7b5c837ce6639c05a12369a` — **inalterado**                                                                                                                                          |
| índice (staged)                                 | **vazio** — nada preparado para commit                                                                                                                                                               |
| commits nesta sessão                            | **0** (nenhum push, nenhuma tag, nenhuma branch)                                                                                                                                                     |
| arquivos de produção alterados por esta bateria | **0** — todos os `mtime` de `src/**`, `scripts/**`, `package.json`, `package-lock.json` e `vite.config.ts` são **anteriores** ao início da sessão (o WIP alheio é de 2026-10-21 00:21–01:35)         |
| arquivos alterados por esta bateria             | `docs/evidence/agent-state/DEBTS.md` (+25 linhas, +1 linha de prosa), `docs/evidence/agent-state/PROGRESS.md` (+L980, +L981, +1 bullet em §1, +H-13 em §3) e o pacote novo `docs/evidence/bug-hunt/` |

---

## 4. Achados — reproduções

Os 25 achados estão detalhados **na íntegra** nas 25 linhas `DBT-148..DBT-172` de
`docs/evidence/agent-state/DEBTS.md`, cada uma com `origem` (arquivo:linha), `classe`,
`severidade`, **`closure test`** (o par que reprova com o defeito presente) e `evidência`.
A tabela da §1 é o índice; o registry é a fonte.

Reprodução resumida dos cinco mais graves:

**1. Exclusão de despesa morta (CRÍTICA)**

```
1. login na bancada local; abrir /despesas
2. "Adicionar despesa" (R$ 1.200,50) → toast "Despesa adicionada"
3. clicar no ícone Excluir → no diálogo, "Excluir despesa"
4. observar: POST /_serverFn/... → HTTP 503 (bff.request_failed INTERNAL_ERROR,
   Failed query: delete from "expenses" where ...)
5. a linha continua na lista e no banco (expenses 1→1)
```

**2. OTel sem entrega (ALTA)**

```
1. subir o build compilado com OTEL_EXPORTER_OTLP_ENDPOINT apontando a um coletor local
2. curl na landing e em /api/health/ready; esperar > 15 s (batch 10 s)
3. o coletor NÃO recebe nada (0 requisições em ~2 min); com NODE_DEBUG=http não há
   sequer conexão de cliente
4. contraste: a mesma rota exercitada na FONTE entrega 4 POST /v1/traces + 3 /v1/metrics em ~4 s
```

**3. Foco escapando do modal (ALTA)**

```
1. abrir /produtos com o teclado; Tab até "Arquivar <produto>"; Enter
2. Tab sucessivamente: chromium leva a `body`, depois ao link "Preço que Dá Lucro",
   depois ao botão "Sair" (4 escapes em 6 Tabs); webkit 2/2/4; firefox 0
3. o fundo não fica `inert` nem `aria-hidden` (medido: [false, true, false])
```

**4. `DECIMAL_OVERFLOW` sem tratamento (ALTA)**

```
1. /despesas → nome qualquer → valor 1000000000000000 → "Adicionar despesa"
2. pageError: DECIMAL_OVERFLOW; 0 requisições de rede; 0 toast (o botão parece morto)
   (limiar: 999999999999999 grava; 10^15 estoura)
3. /precos → preço 1e15 → "Atualizar" → toast com o código cru "DECIMAL_OVERFLOW"
```

**5. Clickjacking (MÉDIA)**

```
1. servir, em outra origem (porta 4199), uma página com <iframe src="http://127.0.0.1:4178/">
2. o frame filho CARREGA: título e texto da landing renderizados dentro do iframe;
   o console registra a violação do frame-ancestors 'none' sem ação
3. CONTROLE: a mesma página servindo X-Frame-Options: DENY é bloqueada (chrome-error://)
   ⇒ o método discrimina
```

---

## 5. Riscos e limites declarados

Obrigatório pelo contrato do pacote: **o que não foi possível testar, e por quê**.

### 5.1 Limites do ambiente

| limite                                                                                                                          | consequência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A árvore de trabalho estava suja** (~46 arquivos modificados + 8 não rastreados, WIP de outra sessão, **preservado intacto**) | todas as medições são do **worktree**, não do commit `363eb43`. A diferença de bundle de +15 B foi atribuída ao WIP por bisect.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **A precondição de worktree limpo do selo (`scripts/m02-seal.mjs`) NÃO foi satisfeita**                                         | o selo exige `git status` sem drift **fora** do diretório selado. Nesta sessão isso é **estruturalmente insatisfazível**: o WIP alheio precisa ser preservado (custódia, `AGENTS.md`) e o pedido proíbe commit. O `MANIFEST.sha256` foi gerado pelo **script real**, rodando num repositório git isolado e limpo com os **mesmos bytes** do pacote ⇒ o conteúdo e os hashes são genuínos e conferem (81/81 contra o repo real), mas a afirmação "o pacote foi construído a partir de uma árvore limpa" **é falsa** e fica declarada aqui, não presumida. |
| `m02:lockfile-guard` vermelho                                                                                                   | pré-existente, por WIP alheio e por contrato do próprio guard. Não tocado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Nenhuma medição em produção**                                                                                                 | Vercel, Neon remoto, Hostinger e GitHub não foram acionados. Conclusões de **código** (ex.: `x-frame-options` ausente) valem para produção; a observação em produção **não** foi medida.                                                                                                                                                                                                                                                                                                                                                                 |
| **A árvore sem commit**                                                                                                         | nenhum dos achados foi corrigido. A correção do achado nº 1 toca **migration** ⇒ precisa de decisão humana (migration é irreversível no banco).                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Sem baseline de Lighthouse** no repo                                                                                          | "regressão > 5 %" não era avaliável contra baseline. A comparação foi método-compatível com F7.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **INP não medido**                                                                                                              | o audit do Lighthouse exige trace timespan; a landing é estática e não há interação medida.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **1 execução do Lighthouse por form factor**                                                                                    | o próprio Lighthouse é sensível a variação.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Mecanismo do achado nº 2 não pinçado**                                                                                        | as sondas isoladas com as duas cópias da API propagaram o provider; o que resta sem prova é a combinação exata. Os **fatos** estão afirmados (0 entregas no compilado vs entregas na fonte; SDK inicia; duas cópias; tracer/meter obtidos antes do provider); a **causa-raiz** não é afirmada.                                                                                                                                                                                                                                                           |
| **Um turno de IA real** (13.138 tokens, US$ 0,0049)                                                                             | sob a decisão do dono em `L969`. O resto da bateria rodou no ramo controlado (custo zero).                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **O `rollup-plugin-visualizer` não foi adicionado**                                                                             | não é dependência; adicioná-la mutaria `package.json` + lockfile e colidiria com o guard já vermelho. O HTML foi gerado do manifest do Vite, sem dependência nova. O HTML **não** é interativo.                                                                                                                                                                                                                                                                                                                                                          |
| **Baselines de pixel não validadas na imagem do CI** (`ubuntu-24.04`)                                                           | a igualdade byte a byte foi medida **nesta bancada** (Linux local, Playwright 1.62.1). A portabilidade é **não medida** e é o maior risco da ação de integração.                                                                                                                                                                                                                                                                                                                                                                                         |
| **O ramo dark é sintético**                                                                                                     | o app não tem tema escuro (achado nº 18); o braço dark mede o espelho `.dark` do CSS por injeção de classe.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Tour do novato interrompido**                                                                                                 | o bucket de `/api/auth/get-session` devolveu **429** ⇒ os estados vazios de 6 rotas no tenant novo não foram medidos. **429 é limite de bancada**, nunca defeito do produto.                                                                                                                                                                                                                                                                                                                                                                             |
| **Cadastro por e-mail impossível na bancada**                                                                                   | `POST /api/auth/sign-up/email` → 503 `EMAIL_NOT_CONFIGURED` (transporte de e-mail não configurado localmente) ⇒ o tour usou conta criada direto no banco. Já registrado (`DBT-115`/`DBT-116`).                                                                                                                                                                                                                                                                                                                                                           |
| **Prova do iframe feita só em Chromium**                                                                                        | Firefox/WebKit não foram usados nessa prova; o comportamento é de motor em comum, mas **não** foi medido neles.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Cookie malformado não pôde ser exercitado no browser**                                                                        | o Chrome rejeita o valor em `addCookies`; o cenário foi medido só em HTTP (curl) e em server function (401).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **`'; DROP TABLE products;--` não executado**                                                                                   | prova indireta e explícita: o payload foi gravado literalmente e a tabela continuou existindo (21→21). Não se "provou além disso".                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **`FORCE ROW LEVEL SECURITY` ausente**                                                                                          | medido (`relforcerowsecurity=false`) e **não** re-proposto: é estado já rastreado no `docs/MAPA-OPERACIONAL.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Caminho de criação de usuário do Better Auth não exercitado**                                                                 | os 2 tenants de teste foram criados direto no Postgres local.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **A webkit crashou** na 1ª varredura de plataforma (OOM do container)                                                           | contornado relançando o browser por viewport; a 2ª varredura completou 77 amostras com 0 falhas.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Zoom medido como viewport reduzido** (640×400 = 200 %, 320×400 = 400 %)                                                       | é o modo fiel de zoom de navegador; uma 1ª tentativa com CSS `zoom:2` (que **não** altera media query) produziu falsos positivos e foi **descartada**.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **4 ordens de foco truncadas** (`/vendas`, `/despesas`, `/diagnostico`, `/produtos/composicao`)                                 | o laço de Tab parava em repetição (input `type=date` e duas despesas de mesmo nome).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Rotas fora do escopo**                                                                                                        | `/produtos/composicao`, `/despesas`, `/diagnostico`, `/novo-produto`, `/precos`, `/ponto-equilibrio` não foram auditados pelo axe (fora das 6 rotas da Fase 2); foram cobertas pela Fase 4.                                                                                                                                                                                                                                                                                                                                                              |

### 5.2 Riscos que este pacote cria

| risco                                                              | mitigação declarada                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O par spec + baselines de pixel precisa entrar no mesmo commit** | commit só da spec reprova o job de e2e do CI por baseline ausente. Caminho exato documentado em `DBT-152`; as baselines foram deixadas em `.artifacts/bughunt-b/` **e** as 24 medidas com sha256 em `captures/b-visual-baseline.txt`. |
| **A asserção de baseline é sensível ao ambiente de rasterização**  | regenerar/validar na imagem do CI **antes** de virar verdade; o `README` do pacote registra a medição como _byte-idêntica nesta bancada_.                                                                                             |
| **25 dívidas novas entram no registry**                            | `m02-debts-guard` verde (155 = 117 ABERTA + 35 FECHADA + 3 EM_TRATAMENTO); a prosa da contagem foi **atualizada** (a divergência prosa×fatos é a classe `DBT-121`).                                                                   |
| **Nenhum achado foi corrigido**                                    | por decisão explícita do pedido: "nenhuma alteração de código deve ser commitada sem aprovação explícita". O achado nº 1 exige **migration** ⇒ decisão humana.                                                                        |

### 5.3 Achados que **não** são dívida (descartados explicitamente)

| item                                                            | por quê                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| O patch `vite` 8.2.2 → 8.2.4 muda o bundle                      | **refutado por medição**: saída byte-idêntica. O +15 B é churn de identificador do WIP não commitado.   |
| O bench `:4173` roda com a telemetria OFF                       | comportamento **documentado e testado** (`shouldStartTelemetry` só liga com endpoint não vazio).        |
| Sem compressão de resposta no preset `node-server`              | em produção a compressão é da borda (Vercel); depende do alvo de deploy. Observação, não dívida.        |
| O radio não selecionado de `/simulacoes` "inalcançável" por Tab | semântica de radiogroup nativo: as **setas** alcançam o segundo radio e trocam a seleção (3/3 engines). |
| `get-session` responde 200 com corpo `null` sem sessão          | hipótese do próprio agente, **refutada** por medição; o logout está correto.                            |

---

## 6. Erros dos próprios agentes (declarados)

Um relatório honesto vale mais que um relatório completo. Os erros de harness **dos 5 agentes** foram
declarados por cada um deles nas capturas; os que **mudaram uma conclusão** foram:

| agente | erro                                                                                              | como foi tratado                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| B      | a 1ª auditoria axe rodou antes do shell renderizar no cliente ⇒ "zero violações" em 4 rotas       | resultado **descartado**; reexecutado com espera pelo heading ⇒ achou as 2 violações reais                                               |
| B      | o 2º método de contraste apagava o próprio canvas ⇒ devolvia `#000000`                            | corrigido (canvas de resolução separado) e validado por controle                                                                         |
| B      | o método de detecção de foco comparava com o elemento **anterior** ao gatilho                     | corrigido; 20 falsos positivos de armadilha → 0                                                                                          |
| C      | o `storageState` do Playwright re-codifica o cookie ⇒ o servidor rejeitou a assinatura            | resolvido com login dentro do browser; **o produto estava certo**, o harness é que estava errado                                         |
| C      | o 1º turno de chat teve um `]` a mais e o purge falhou por ordem de FK                            | evidência extraída do banco **antes** do purge; **nenhum turno adicional** foi disparado (limite de 1 respeitado)                        |
| D      | a 1ª varredura de plataforma mediava páginas ainda em carregamento (89 amostras com `bodyLen=13`) | medição **descartada**; a v2/v3 espera o `h1` visível (0 amostras não-prontas)                                                           |
| D      | o script de plataforma escreveu no path errado e sobrescreveu o JSON chromium+firefox             | números recovery pela medição dirigida autenticada + o JSON válido do webkit; **declarado**                                              |
| D      | supôs que `get-session` com sessão ausente devolve não-200                                        | **hipótese refutada** por medição (200 com corpo `null`); o logout está correto                                                          |
| E      | o 1º método do iframe mediu `contentDocument` ⇒ `false` nos **dois** casos (real e controle)      | método **falso-negativo** substituído por `page.frames()`; validado pelo controle que bloqueia                                           |
| E      | supôs que o token de sessão vazado no log era credencial utilizável (seria ALTA)                  | **hipótese refutada** por medição (401 com o token sozinho; a assinatura de 48 chars não vaza) ⇒ achado **rebaixado** de ALTA para BAIXA |
| A      | o 1º gerador do treemap tinha bug de escala (2 células em vez de 63)                              | detectado por **contagem de `<rect>`**, corrigido, regenerado e revalidado geometricamente (100 % da área, 0 fora do viewBox)            |

---

## 7. Auto-verificação pré-S6 (KPI)

O checklist anti-vacuoso do template tem 17 itens. **S6 adversarial de contexto limpo NÃO foi
executado** — nenhum verificador independente reexecutou este pacote. O que segue é a
**auto-verificação do autor**, que mede **prevenção**, não verificação.

| #   | item                                   | como foi satisfeito                                                                                                                                                                                | evidência                                                                              |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Controle negativo obrigatório          | cada achado tem par que reprova: exclusão (503 vs 2xx), foco (contém vs não contém), contraste (reverter os tokens), clique (X-Frame-Options bloqueia), DSN (`<REDACTED>` aceito vs senha literal) | `captures/d-operacoes.txt`, `b-modal-trap.txt`, `b-axe-summary.json`, `e-headers.json` |
| 2   | Fronteira nas duas direções            | `age_days` = 2 nos 4 fusos; `DECIMAL_OVERFLOW` entre 999.999.999.999.999 (grava) e 10¹⁵ (estoura); RLS com e sem GUC (0 vs 1 linha)                                                                | `c-33-finance-engine.json`, `c-33-age-timezones.json`, `e-tenant-isolation.json`       |
| 3   | Identidade, não cardinalidade          | o achado nomeia o **caso** ("Excluir despesa", 42501 na tabela `expenses`), não "houve erro"; 0 escapes em firefox vs 4 em chromium                                                                | `d-operacoes.txt`, `b-modal-trap.txt`                                                  |
| 4   | Proibido exit-code-only                | o veredicto exige **zero** entrega OTel, **zero** execução de payload, **zero** linha de B visível, **zero** violação — não "o processo saiu 0"                                                    | `a-otel-offline.txt`, `e-injection.json`, `e-tenant-isolation.json`                    |
| 5   | Proibido sleep fixo                    | sincronização por marcador observável (`h1` visível, `document.getAnimations()` sem transição `running`, heading da rota)                                                                          | `d-plataforma.txt`, `b-axe-summary.json`                                               |
| 6   | Sem valor degenerado na identidade     | contraste medido por **2 métodos** (axe + canvas), ambos reportados; o token do log redigido por sha256/12, nunca em claro                                                                         | `b-axe-summary.json`, `e-exposure.json`                                                |
| 7   | Precondição de estado compartilhado    | cada fase asserta a precondição: container healthy, seed verde, `/api/health/ready` = ready, contagem de usuários antes/depois                                                                     | `a-bundle-check.txt`, `c-32-email-guard.json`                                          |
| 8   | Sentinela real por cenário             | o tenant semeado (2 produtos, 2 despesas) é a sentinela real; o 429 é sentinela de limite de bancada                                                                                               | `d-purga.txt`                                                                          |
| 9   | Fingerprint de revisão                 | HEAD `363eb43` registrado; o bundle é reidentificado por sha256 (`358633588df7`) e o bisect por SHA fixa a origem dos +15 B                                                                        | `a-bundle-delta.txt`                                                                   |
| 10  | `checked === discovered`               | o selo do pacote lista **todo** arquivo descoberto; descoberta vazia reprova                                                                                                                       | `MANIFEST.sha256`                                                                      |
| 11  | S6 adversarial                         | **NÃO executado** — declarado na §5 e no `SPEC.md` §7                                                                                                                                              | este README                                                                            |
| 12  | Falha alta (fail-closed)               | guardas do repo falham fechado; o registro de dívida exige closure test, senão `NS`                                                                                                                | `m02-debts-guard`                                                                      |
| 13  | Isolamento de bancada assertado        | produção intocada; 4 tenants de teste purgados com contagem antes/depois; o tenant semeado intacto                                                                                                 | `d-purga.txt`, `e-purge.json`                                                          |
| 14  | Todo check impresso tem gate e captura | todo número do relatório tem o comando e o arquivo de captura                                                                                                                                      | §3 e `captures/`                                                                       |
| 15  | Run de CI atado ao commit selado       | **N/A** — nada foi commitado, logo não há run a citar. Declarado.                                                                                                                                  | este README                                                                            |
| 16  | Descoberta multi-sítio                 | call sites de `toast()` enumerados por busca (33); tabelas sem `DELETE` enumeradas por `information_schema` (12 com, 3 sem); `setMarketPrice` sem chamador por busca                               | `c-31-toaster-call-sites.txt`, `e-tenant-isolation.json`, `d-operacoes.txt`            |
| 17  | Precondição de estado ambiente         | cada agente declarava o ambiente (branch, HEAD, porta, xff, modo de IA) e falhava **fechado** quando o bucket de auth estourava (429 = limite, não veredito)                                       | `captures/d-*` (declaração de 429), `captures/c-*`                                     |

**KPI de prevenção (o que o checklist mede):** das **25** dúvidas levantadas na bateria, todas
foram capturadas **pelos próprios agentes**, sem S6.

> **KPI:** `capturados pelo autor antes do S6 / total de achados` = **25/25** — todos os 25 achados
> foram capturados **pelos próprios agentes**, sem S6. O que **não** se sabe é **quantos** o S6
> acrescentaria: **o S6 não rodou**, e esse número é **declarado como não medido**, não estimado.

---

## 8. Ações pendentes (nenhuma executada — aguardam aprovação humana)

| #   | ação                                                                                               | por quê não foi executada                                                                                 |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | **Corrigir a exclusão** (achado nº 1)                                                              | exige **migration** (conceder `DELETE`), que é irreversível no banco e precisa de decisão humana + janela |
| 2   | Integrar a spec de baseline + as 24 baselines **no mesmo commit**                                  | o pedido proíbe commit; e as baselines precisam ser validadas na imagem do CI antes                       |
| 3   | Aplicar o patch de 1 linha do `x-frame-options` (`src/lib/security-headers.ts:40-44`)              | é código de produção; o pedido exige aprovação explícita antes de alterar                                 |
| 4   | Aplicar a correção do parsing de OTel                                                              | mecanismo **não pinçado** — corrigir às cegas seria chute                                                 |
| 5   | Promover a CSP a aplicada                                                                          | bloqueada pelo gate do **ADR-043** (PROPOSTA) e pela `DBT-142`                                            |
| 6   | Escolher entre corrigir as 2 superfícies de `DECIMAL_OVERFLOW` ou endurecer a política de dinheiro | decisão de produto                                                                                        |

---

## 9. Índice do pacote

| item                 | o que é                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `SPEC.md`            | o plano da bateria e o contrato falsificável de cada frente                                              |
| `README.md`          | este relatório                                                                                           |
| `MANIFEST.sha256`    | selo de bytes do pacote (`checked === discovered`, 81 arquivos, conferido 81/81 contra os bytes do repo) |
| `captures/`          | **42** arquivos: as medições por fase (`.txt` e `.json`), com DSN redigido                               |
| `screenshots/`       | **36** PNGs curadas — a prova visual dos achados nomeados                                                |
| `bundle-report.html` | relatório do bundle gerado do manifest do Vite, sem dependência nova                                     |

**Onde está o resto do material bruto:** 106 PNGs da varredura de plataforma/erro/dados foram
movidos para `docs/evidence/visual/bug-hunt-2026-10-21/screenshots/` — área **gitignored** de
saída bruta de run (mesma convenção de `docs/evidence/visual/` e de
`docs/evidence/infra-recon-2026-10-17/screenshots/`). **Nada foi apagado**: os bytes são os
mesmos, e as 36 imagens que sustentam um achado nomeado continuam no pacote, seladas.
Os scripts de trabalho dos 5 agentes ficaram em `.artifacts/bughunt-{a,b,c,d,e}/` (gitignored).

**Nota sobre o tamanho do pacote:** as capturas em `captures/` (348 KB) e as 36 imagens curadas
(2,5 MB) é o que entra no Git. O total versionado de `docs/evidence/` no repositório era 8,3 MB;
versionar 10 MB de PNGs de varredura o teria **duplicado** e o byte entraria no histórico de forma
irreversível. A curadoria segue o precedente que o próprio repo já aplicou duas vezes.

---

## 10. Declaração final

- **Nenhum commit, push, tag, branch, merge, deploy, alias ou migration remota** foi executado.
- **Nenhum arquivo de produção** foi alterado.
- **Nenhum** valor de segredo foi lido, impresso ou gravado; os DSNs nas capturas estão redigidos.
- **Nenhuma** dívida existente foi enfraquecida; 25 novas entraram com closure test.
- **O que não foi possível testar está declarado** na §5 — não omitido, não estimado.
- **Aguarda aprovação humana** para as 6 ações da §8.
