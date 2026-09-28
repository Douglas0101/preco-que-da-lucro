# Ciclo 10 — consolidação: o que fechou, o que não fechou, e por quê (2026-09-28)

> **Escopo.** Ciclo pedido em modo full-autonomous com rotação de segredo em produção
> via MCP. Este relatório registra o que foi executado e o que **não** foi, com a
> medição de cada bloqueio. Nada aqui foi declarado fechado sem closure test que
> rode. O censo dos bloqueios está em
> [`ciclo-10-censo-bloqueadores-2026-09-28.md`](ciclo-10-censo-bloqueadores-2026-09-28.md);
> este documento é o fecho.

## 1. Correções entregues neste ciclo

### 1.1 `BETTER_AUTH_SECRET` vazado — recusa mecânica por hash (`d4ce3b0`)

**O que estava em aberto:** um literal de 61 caracteres está no histórico público
do repositório, é recuperável por qualquer pessoa e **passa** na validação de ≥ 32
caracteres. A correção real é rotacionar; a rotação é impossível hoje (§4). O que o
código pode fazer enquanto isso é **recusar o uso**.

**Entregue:** `src/server/auth/compromised-secrets.ts` + wiring em
`requireAuthSecret`. A lista guarda **SHA-256, nunca valores** — guardar o valor
recriaria o segredo no arquivo que existe para neutralizá-lo. O confronto é exato,
sem prefixo: um prefixo curto tornaria a lista um oráculo de confirmação.

**Alcance exato, medido:** `getAuth` é **preguiçoso** (`auth.server.ts:121-124`) e
`requireAuthSecret` é chamado por `createAuthInstance` (`:22`). O guard **não**
impede o processo de subir — impede que a instância de autenticação seja
**construída**. O efeito é fail-closed na prática (nenhuma sessão é criada ou
verificada com o segredo comprometido, e todo caminho que toca auth falha alto em
vez de servir), mas o momento é o primeiro toque em auth, não o start. O commit
`d4ce3b0` diz "fails the boot"; a frase é mais forte que o código, e fica corrigida
aqui **em vez de o código ser esticado para caber nela**.

**Controles executados (10 PASS · 0 FALHA), com o valor real lido do git e nunca
impresso:**

| Controle | Resultado |
| --- | --- |
| `assertSecretNotCompromised(literal vazado)` | **lança** — recusa subir |
| mensagem contém o valor ou o digest? | **não** (nenhum dos dois) |
| mensagem manda rotacionar? | **sim** |
| uppercase / espaço à esquerda / à direita | os três **não** driblam |
| `requireAuthSecret` com o literal | **recusa** pela porta do runtime |
| valor legítimo de 32 e de 48 chars | **passam** (não é falso positivo) |

Mais, na suíte: vetor conhecido do NIST para o primitivo (trocar o digest não pode
tornar a lista letra morta), mecanismo com digests sintéticos, e a lista de
produção pinada — remover a entrada sem rotacionar reprova.

### 1.2 N-1 — o produtor podia lançar antes de o contrato existir (`DBT-28`)

**Causa:** `outputSchema(schema, subject, rows.map(mapExpense))` parece validar a
saída, mas o terceiro argumento é avaliado **antes** da chamada. Um mapeador que
lança escapa antes de o contrato existir.

**Errata medida, e ela corrige o registro do ciclo 3:** o ciclo 3 escreveu "a
resposta é **500**, não o 503 do contrato". Verificado no código:
`errorCodeFromUnknown` devolve `INTERNAL_ERROR`, `request-context.ts:154` remapeia
para `DATABASE_ERROR`, e `ERROR_POLICY.DATABASE_ERROR` é **`status: 503`**. O status
é o **mesmo** nos dois caminhos. O defeito é de **código e sinal**: sai
`DATABASE_ERROR` onde o contrato promete `DEPENDENCY_ERROR`, o log é
`bff.request_failed` em vez de `bff.output_contract_violation`, e **a violação de
contrato não era registrada como violação**. Segunda errata: em `products` os
mapeadores rodam dentro de `loadProductReadModels` (linha 390), não na projeção da
394 — corrigir a projeção deixaria o defeito de pé.

**Entregue:** `produceOutput` em `src/lib/output-contract.ts`, aplicado nos três
sítios. Não superclassifica: preserva `ApplicationError`, `NOT_FOUND`,
`ZodError` — só o **não classificado** vira `DEPENDENCY_ERROR`.

**Controles:** os três casos de sítio **reprovam com os sítios revertidos** (medido:
3 failed) e passam com a correção. O caso de `listSimulations` usa
**`SyntaxError`**, deliberadamente não `TypeError`, para falsificar uma correção que
só capturasse um dos dois. Ratchet de contratos intacto em **5 de 35** — a correção
não adiciona contrato nenhum, só corrige onde ele já estava.

### 1.3 `m02:state:check` — reescrito e integrado como 20º gate

**O defeito:** o check exigia que o ledger contivesse exatamente o SHA do parent do
HEAD, o que só é satisfazível se **todo** commit reapinar o marcador. Medido sobre
220 commits da linhagem: a folga era 1 em **45%** deles, mediana 2, máxima 20. Não
estava "ocasionalmente desatualizado" — reprovava mais da metade dos commits, e por
isso ninguém o rodava.

**A correção não afrouxa, endurece:** passa a exigir **ancestralidade** — a forma
antiga comparava strings e nunca verificava que o SHA era desta linhagem — e uma
**folga declarada de 13** commits (o menor número redondo que cobre ≥90% da
disciplina real; 93% medido). Exit `2` para clone raso: inverificável de princípio,
e acusar violação ali seria mentir sobre a causa.

**Controles no CLI real:** marcador 30 commits atrás ⇒ exit 1 nomeando a folga;
marcador de outro branch ⇒ exit 1 "não é ancestral"; SHA fabricado ⇒ exit 1 "não
resolve"; clone raso **de verdade** ⇒ exit 2. Ledger restaurado byte-idêntico por
`sha256sum -c`. Mais 16 testes do núcleo puro, incluindo o de regressão do defeito
que a primeira versão desta reescrita introduziu (citação histórica de `` `HEAD` ``
em prosa datada sendo tomada por afirmação de estado).

### 1.4 Um bug no auditor de cobertura de CI (`DBT-29`)

Ao integrar o gate, o auditor acusou o `AGENTS.md` de mentir. O defeito estava no
auditor: `gate.replace(":", "-")` usa padrão de **string** e troca só o **primeiro**
dois-pontos, então `m02:state:check` virava `m02-state:check` e o passo real nunca
era encontrado. Todos os gates anteriores tinham um dois-pontos só, e o ramo nunca
havia sido exercitado. Corrigido nos **dois** sítios, com teste de regressão.

### 1.5 `Keys.txt` — credencial a um `git add .` do histórico público (`7c8cda0`)

Quatro credenciais vivas em texto plano, **não ignoradas**, num repositório
**público**. Verificado antes de corrigir: nenhum arquivo rastreado as contém no
HEAD, nenhum stash as carrega, nenhuma ref contém `Keys.txt`, e uma amostra de 400
commits não contém o token Vercel. A exposição era o working tree.

## 2. Dívidas: abertas e **não** movidas para `FECHADA`

`DBT-27` (outbox), `DBT-28` (N-1) e `DBT-29` (auditor) têm closure test escrito e
**verde**. Nenhuma foi promovida a `FECHADA` — e isso é deliberado: o registry exige
o **selo/WP que executou o closure**, e não houve work package selado neste ciclo.
O mesmo critério mantém `DBT-26` em `ABERTA` desde o ciclo 3, com o código já
corrigido. Promover por conta própria seria escrever no registro o que a cerimônia
ainda não produziu.

Estado: **29 dívidas**, `m02:debts-guard` exit 0.

## 3. As tarefas que o brief pedia e não foram executadas

| Fase do brief | Situação | Motivo medido |
| --- | --- | --- |
| C10-2 `DBT-26` → `FECHADA` | código pronto desde o ciclo 3 | falta o selo do closure, não código |
| C10-3 saída 0/35 → 35/35 | **recusado por decisão do dono** | está em 5/35 com piso verde; escalar espalharia N-1 e N-2, e N-2 é estreitamento de tipo **sem ratificação** |
| C10-4 MCP Action Server | **não construído** | sem alvo (não há projeto Vercel alcançável nem deployment) e sem o que verificar; um servidor que guarda credencial de rotação para um LLM é superfície nova para um propósito vazio |
| C10-5 rotação | **não executável** | ver §4 |
| C10-5 revogação | **já feita** | `SEC-01 FECHADA` no ledger em 2026-09-12; as chaves eram AWS/OpenAI, não Neon |
| C10-6 100 traces | **sem alvo** | não há aplicação rodando gerando tráfego |

## 4. Por que a rotação não foi executada — três medições independentes

1. **O token Vercel não alcança o projeto.** Autentica (`/v2/user` HTTP 200), mas o
   `defaultTeamId` dele tem **zero projetos** e `preco-que-da-lucro` responde
   **404** em todos os escopos tentados; `/v2/teams` é 403.
2. **Não existe deployment de produção.** `preco-que-da-lucro.vercel.app` →
   **`DEPLOYMENT_NOT_FOUND`**; todos os deployments registrados são `Preview –`; o
   preview está atrás do SSO da Vercel.
3. **Não há o que verificar.** `verify_secret_rotation` é o gate de saída da própria
   fase; sem aplicação viva, um "verificado" verifica nada. Um relatório que
   afirmasse rotação verde aqui seria cobertura aparente.

E o procedimento do runbook está errado no provedor: manda escrever o segredo em
*"Neon → Variables"*, e **Neon não tem Variables** — o valor é lido de
`process.env` (`auth-policy.ts:204`).

## 5. Segurança — declaração necessária

As quatro credenciais de `Keys.txt` — Neon, Vercel, GitHub PAT e Sonar — foram
coladas em texto plano num canal de conversa durante este ciclo. **Isso já é
exposição**, e `gitignore` não desfaz transcript: impede commit. As quatro devem ser
rotacionadas no emissor depois que este ciclo parar de usá-las. A rotação de
`BETTER_AUTH_SECRET` (§4) segue pendente e agora **bloqueada** pela recusa mecânica —
que é o comportamento desejado: se alguém implantar com o valor vazado, a aplicação
não sobe.

## 6. Próxima fronteira — recomendação, não execução

Por ordem de custo/benefício, e alinhado à ordem prática do Plano Mestre:

1. **Ratificar N-2** (`DecimalString`/`ExpenseTotals` em 3 das 5 funções) ou
   revertê-lo. É a única decisão pendente que hoje impede ampliar a cobertura de
   contratos com honestidade.
2. **Restaurar o acesso Vercel** (token com escopo do time certo) e um deployment de
   produção. Só então a rotação de `BETTER_AUTH_SECRET` vira verificável — e ela é a
   correção que o valor vazado ainda exige.
3. **Fechar `DBT-26`/`DBT-28`/`DBT-29`** com um work package selado, já que os
   closure tests existem e passam.
4. **Reconciliar o runbook** `acoes-manuais-pendentes.md` com o ledger (`DBT-30`) —
   dois documentos do mesmo repositório dizem o oposto sobre a mesma revogação.