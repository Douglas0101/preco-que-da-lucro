# RELATÓRIO CONSOLIDADO — CICLO 3 (2026-09-26)

> **Escopo autorizado pelo MAESTRO:** registrar `DBT-25`/`DBT-26` no registry, corrigir o verifier de
> senha, executar a fatia autorizada de `DBT-25` (contratos de saída + piso do ratchet) e publicar a
> branch da Fase C. **Branch:** `feature/contract-guard-bff` · **HEAD publicado:** `8df2578` ·
> **Draft PR:** [#49](https://github.com/Douglas0101/preco-que-da-lucro/pull/49) (base `develop`).
> **15 commits**: os 8 da Fase C (`5d7c12e..7a84182`) + os 7 do ciclo 3.

## 1. Resposta direta ao pedido de handoff

| pedido                                          | resultado                                                                                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEBTS.md` atualizado com `DBT-25` e `DBT-26`   | **SIM** — registry 23 → **25**; `m02:debts-guard` exit 0                                                                                                                                                                      |
| Link do PR atualizado                           | **PR [#49](https://github.com/Douglas0101/preco-que-da-lucro/pull/49)** (DRAFT). O **PR #48 não foi tocado**: seu head é `feature/p0-financial-security-baseline` (`5d7c12e`), e esta branch nasceu dela — decisão do MAESTRO |
| Server functions com contrato de saída validado | **5** (tabela §4)                                                                                                                                                                                                             |
| Status dos testes de `DBT-26`                   | **31/31** nos alvos · suíte cheia **1222 passed / 0 failed** · controle negativo por mutação **reprovando 14–21** · restore byte-idêntico                                                                                     |
| Novo piso do ratchet                            | **`outputContracts: 5`, `serverFunctions: 35`** — "5 de 35" (o brief dizia "30/35"; ver §2)                                                                                                                                   |

## 2. Três correções ao brief — todas por medição

1. **`DBT-26` não é `P0` e não tem `DatabaseError`/`TimeoutError`/`ConfigurationError`.** `verifyPassword`
   é **cripto pura**: recebe `{hash, password}` e **não acessa banco**. Superfície real medida:
   `Error("Invalid password hash")` (better-auth exige par `salt:key`), `Error("Illegal arguments: …")`
   (`bcryptjs`) e `TypeError` para hash nulo / senha não-string. Registrado como **`robustez` / `média`**;
   `alta` descartada por medição. Escrever o closure test do brief seria escrever um teste **falso**.
2. **O piso não é "30/35".** O campo `outputContracts` conta funções **com** contrato (era 0). Cinco
   funções ⇒ `5 de 35`; `serverFunctions` permanece 35. O número "30" não é expressável no schema.
3. **O push desta branch não atualiza o PR #48.** Head do #48 = `feature/p0-financial-security-baseline`.
   O journal `L208` registra que esta branch foi criada **a partir dela** como linha própria da Fase C.

## 3. `DBT-26` — o verifier deixa de converter exceção em veredito de negócio

`src/server/auth/password.server.ts` classificava **qualquer** exceção como senha errada. Agora:

- **classifica** (`malformed-input` | `unusable-hash` | `crypto-failure`) e **lança**
  `PasswordVerificationError`, registrando `auth.password.verify.failed` com `code`, `reason` e
  `causeName` — **nunca** o hash, a senha ou um prefixo deles (verificado com sentinelas);
- `false` passa a significar **apenas** hash válido com senha errada;
- a assinatura pública (`Promise<boolean>`) **não** mudou, então o consumidor better-auth
  (`auth.server.ts:42`) não precisou de edição — o `throw` escapa do `if (!await verify(…))`, que é o
  comportamento alto desejado (confirmado em `sign-in.mjs:333-339`, sem `try/catch`);
- **fail-closed preservado:** 18 entradas hostis testadas, **nenhuma** concede acesso.

**Consequência registrada:** o site saiu do inventário pinado de `finance.result-invariants.test.ts`.
O registry é fail-closed **nas duas direções** — sumir também reprova —, então a remoção é um **ato
consciente com decisão registrada**, documentado no teste, em `finance-result-invariants.md` §3.1 e no
`DEBTS.md`. Os controles negativos do scanner seguem intactos: a detecção continua provada viva.

## 4. `DBT-25` — contrato de saída em 5 funções de dinheiro

| função            | arquivo:linha                        | contrato de saída                                              |
| ----------------- | ------------------------------------ | -------------------------------------------------------------- |
| `listExpenses`    | `src/lib/expenses.functions.ts:108`  | `amount` decimal por despesa                                   |
| `getTotals`       | `src/lib/expenses.functions.ts:172`  | `{fixed, variable, productCount}`                              |
| `runSimulation`   | `src/lib/financial.functions.ts:111` | `CalculationResult<DecimalScenarioResult>` (união de 3 pernas) |
| `listSimulations` | `src/lib/financial.functions.ts:141` | array com blobs jsonb                                          |
| `listProducts`    | `src/lib/products.functions.ts:386`  | preços do produto                                              |

Schema Zod **inline no próprio arquivo da função**, ancorado em tempo de compilação por
`satisfies z.ZodType<…>` sobre o **tipo de retorno real**; aplicado no handler por
`outputSchema(schema, sujeito, valor)`. `src/lib/output-contract.ts` guarda **só** o mecanismo —
nenhum schema —, para não criar um segundo sítio de declaração (o que o `AGENTS.md` proíbe). Violação ⇒
log estruturado `bff.output_contract_violation` + `throw ApplicationError("DEPENDENCY_ERROR")`
(§6.9 → **HTTP 503**). **Nunca** lista vazia, **nunca** `null` (INV-013).

**Piso declarado:** `{ "outputContracts": 5, "serverFunctions": 35 }` — detalhe do check
`cobertura de contrato de saída 14,29% (5 de 35); dívida declarada em DBT-25, piso 5 de 35`.
As três falsificações foram observadas na árvore real, com mutação e restauração:
`contrato de saída perdido: eram 5 no piso e agora são 4`;
`1 função(ões) adicionada(s) desde o piso, 0 com contrato de saída`; e piso 6 × real 5.

## 5. S6 adversarial de contexto limpo — 5 VERIFIED · **2 REFUTED** · 0 UNVERIFIABLE

O verificador reconstruiu tudo do zero (sondas próprias, 72 asserções) e **refutou duas afirmações do
próprio enxame**:

- **N-1 (robustez / média-baixa) — o contrato roda DEPOIS dos mappers.**
  `src/lib/expenses.functions.ts:112`, `src/lib/financial.functions.ts:145`,
  `src/lib/products.functions.ts:394`. Um valor que quebra o mapper lança `TypeError` cru ⇒
  `errorCodeFromUnknown` devolve `INTERNAL_ERROR` ⇒ **HTTP 500, não o 503 do contrato**.
  INV-013 continua valendo (alto, nunca vazio), mas "retorno malformado ⇒ `DEPENDENCY_ERROR`" é
  **falso** para essas formas. O closure test do `DBT-25` cobre o **retorno**, não a execução do mapper.
- **N-2 (conformidade / API / média-baixa) — o tipo público estreitou em 3 das 5 funções.**
  `DecimalString` em `listExpenses`/`listProducts`; `getTotals` deixou de devolver o tipo nomeado
  `ExpenseTotals`. A afirmação do autor de que "nenhuma assinatura mudou" é **FALSA** e fica corrigida
  aqui e no journal. É **compatível na leitura** (`brand ⊂ string`), nenhum consumidor quebra
  (`tsc` global exit 0, 1222 testes verdes) e **não** houve mudança para caber o canal de erro (o erro
  é `throw`) — mas **não estava autorizado no brief** e fica **para ratificação do MAESTRO**.

**Limites declarados (não são defeitos novos, são limites):**

- **O-1** o `OUTPUT_CONTRACT_RE` é **textual** (`scripts/lib/contract-guard.ts:108`) e descreve duas
  alternativas de cadeia que o TanStack instalado **não tem** (só `validator`/`inputValidator`) — o
  ratchet conta o **token** `outputSchema`; quem prova o schema é o `satisfies` + os testes negativos.
  Um comentário satisfaz o ratchet, e só as 5 funções estão pinadas por nome.
- **O-2** schemas não são `.strict()`: chave desconhecida é removida, não reprovada (inalcançável por
  jsonb; rejeitar arriscaria 503 no caminho do dinheiro).
- **O-3** o `cause` do `PasswordVerificationError` retém o erro primitivo, cuja mensagem pode carregar
  fragmento derivado do hash (só o fator de custo do bcrypt); o **log** serializa apenas `causeName`
  (verificado: o registro não contém o valor).
- **O-4** o enum de `status` de `listProducts` só vê o valor derivado por `loadProductReadModels`.

**Candidatos a dívida — NÃO registrados** (o registry é do MAESTRO): **N-1**, **O-1** e a **cegueira a
comentário** do scanner de `catch` (descoberta pelo autor do `DBT-26`: a prosa pode fabricar um achado).

## 6. CI — precondição de ambiente, **não** veredito

CI **bloqueada por billing**. Medido na revisão publicada (`8df2578`): o job `verify` do run
`36269955313` abre e fecha em **2 s com `steps=0` e sem runner**, e a anotação verbatim da plataforma é
_"The job was not started because recent account payments have failed or your spending limit needs to be
increased"_ (obtida por `check-runs/<id>/annotations` — **não** por inferência). O único check-run que
conclui `success` é o `Vercel Preview Comments`, que **não é gate de código** ⇒ **nenhum selo `run@sha`
novo é cunhado**.

**Fallback declarado (item (a) do protocolo de bloqueio):** `npm run check` **exit 0**, rodado três
vezes nesta branch, a última na revisão publicada — **1222 passed / 0 failed** —, mais
`tsc --noEmit` **global** exit 0, `m02:matrix:check` verde e `m02:state:check` válido.

**Janela sem verificação (item (b)):** cresceu por **duas publicações autorizadas** — os **65** commits
do push da branch do PR #48 (`a2f5ff6..5d7c12e`) e os **15** desta branch (`5d7c12e..8df2578`). Nenhum
com run verde citável. `origin/main` **intocado**.

## 7. Perda declarada — H-6

A janela do watcher `app-live-watch` **expirou** em `2026-09-26T15:31Z` (re-arme de `2026-09-19T15:31:33Z`,
horizonte de 7 dias) e o log **não** recebe poll novo desde `2026-09-24T02:40:59Z` (`i=6240`,
`/ready` http=404); o mtime do arquivo é o daquele mesmo poll. **A cobertura do H-6 está PERDIDA.** O
re-arme é ação de operador (`setsid` em `$HOME`) e **não** foi executado neste ciclo. O
`m02:temporal-guard` estava vermelho no HEAD `7a84182` exatamente por essa janela encerrada — e como
`src/test/m02-temporal-guard.test.ts` asserta que o próprio repo é o caso verde, `npm run check`
**inteiro** estava vermelho antes deste ciclo (o gate de `05:02Z` ainda era verde porque o prazo
`15:31Z` ainda estava no futuro: **o gate local tem prazo de validade**).

## 8. Procedência

- **Commits:** 7 commits atômicos neste ciclo (§ `git log 5d7c12e..HEAD`), Conventional Commits em inglês.
- **Execução:** 3 fatias disjuntas em paralelo (registry/journal · verifier de senha · contratos de
  saída) + 1 lane S6 adversarial de contexto limpo; nenhum escritor tocou `git`, e o Lead fez todos os
  commits, o piso, a matriz, o marker e o push.
- **Escritores de arquivo:** cada fatia declarou seu escopo; o S6 confirmou que o worktree foi deixado
  byte-idêntico (12 arquivos com `sha256` conferido) e que nenhum teste foi afrouxado.
