# Ciclo 10 — censo de bloqueadores (2026-09-28)

> **O que este documento é.** O resultado da FASE C10-1 do brief do Ciclo 10:
> reconciliar a realidade antes de qualquer mutação. Ele registra os pontos em que o
> brief descreve um mundo que não é o mundo. Não é uma recusa: é a medição que
> precede a execução, como o próprio brief pede.
>
> **Nível de evidência:** local + APIs de leitura (Vercel, GitHub) + MCP Neon.
> Nenhuma mutação de produção foi executada. Nenhum valor de credencial aparece aqui.

## 1. Achado urgente (corrigido): `Keys.txt` a um `git add .` do histórico público

`Keys.txt` (316 B) entrou no diretório de trabalho em 2026-09-28 com **quatro
credenciais vivas em texto plano** — Neon, Vercel, GitHub PAT e Sonar. Não era
rastreado e nunca foi commitado, mas **também não era ignorado**, num repositório
**público**.

É a mesma lacuna que `Sonar*.txt` já cobria desde 2026-09-27, um arquivo ao lado.
Qualquer `git add .` — o reflexo de um agente — publicaria as quatro.

**Corrigido** em `7c8cda0` (`.gitignore`). Verificado antes: nenhum arquivo
rastreado contém esses valores no HEAD, nenhum stash os carrega, `Keys.txt` não
aparece em nenhuma ref, e uma amostra de 400 commits não contém o token Vercel. A
exposição era o working tree, não o histórico.

**Declaração de limite, e ela é séria:** as quatro credenciais foram coladas em
texto plano num canal de conversa. Isso já é exposição — o transcript sai do
controle deste repositório. `gitignore` impede commit; **não desfaz a exposição no
transcript.** As quatro devem ser rotacionadas no emissor depois que este ciclo
terminar de usá-las, e essa rotação é ação do dono.

## 2. `BETTER_AUTH_SECRET` — a rotação da FASE C10-5 **não é executável**

Três medições independentes, cada uma suficiente:

1. **O token Vercel fornecido não alcança o projeto.**
   `GET /v2/user` → HTTP 200 (usuário `douglasultimatesouza-5127`), mas
   `GET /v9/projects/preco-que-da-lucro` → **404 Project not found**;
   `GET /v2/teams` → **403 forbidden** ("You don't have permission to list the
   team"). O projeto vive no escopo de time `douglasultimatesouza-5127s-projects`,
   que este token não enxerga. Sem alcançar o projeto, não há onde escrever a
   variável.

2. **Não existe deployment de produção.**
   `https://preco-que-da-lucro.vercel.app/` → **`DEPLOYMENT_NOT_FOUND`**. Todos os
   deployments registrados no GitHub são `Preview – preco-que-da-lucro` (nenhum de
   `Production`); o mais recente é de `33596d3`, 2026-09-28T03:38Z. O preview está
   atrás do **SSO da Vercel** (`302 → vercel.com/login?next=/sso-api...`). O ledger
   já dizia o mesmo: _"tráfego de aplicação ainda NÃO EXISTE"_.

3. **Não há o que verificar.** `verify_secret_rotation` precisa de uma aplicação
   viva que use o segredo. Sem produção e sem preview acessível, o passo de
   verificação — que é o **gate de saída** da fase — não tem alvo. Fazer a rotação
   assim produziria um "verificado" que não verifica nada, que é a cobertura
   aparente que este repositório existe para não produzir.

**Além disso, o procedimento do runbook está errado no provedor.** O passo 2 de
`docs/runbooks/acoes-manuais-pendentes.md` §2 manda escrever `BETTER_AUTH_SECRET`
em _"Neon → o projeto → Variables"_. **Neon não tem "Variables".** Variável de
ambiente não é um recurso do Neon; `BETTER_AUTH_SECRET` é lido de `process.env`
(`src/server/auth/auth-policy.ts:204`) e validado com ≥ 32 caracteres
(`:206`). Ele pertence a **onde a aplicação roda**, que hoje é lugar nenhum.

**Consequência de sequenciamento:** rotacionar agora não protege nada (não há
processo servindo) e não é verificável. O momento certo é **antes do primeiro
tráfego**, e o ledger diz que o primeiro tráfego ainda não começou. A ordem do
brief está invertida.

## 3. `neon-storage.env` — já revogado, e não é Neon

O brief e o runbook §3 tratam como pendente. O **ledger registra o contrário**,
em 2026-09-12:

> **SEC-01 FECHADA** (atestação do operador, registro por delegação explícita
> autorizada em sessão): as 5 credenciais de `neon-storage.env` foram revogadas no
> emissor; risco residual encerrado para fins do gate `sec01-fechada`.
> — `EXECUTION-STATE-PROGRAM.md:1321`

E as cinco chaves **não eram chaves de API do Neon**. A evidência versionada
(`docs/evidence/pre-a4-2026-09-05/secrets-hygiene.md:13`) lista os nomes:
`AWS_ACCESS_KEY_ID`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`,
`AWS_SECRET_ACCESS_KEY`, `OPENAI_API_KEY` — **AWS S3-compatível e OpenAI**. Os
prefixos `nak_live_`/`nsk_live_`/`nt_live_` não são emitidos pelo Neon.

Logo: o runbook (2026-09-28) contradiz o ledger (2026-09-12), e a instrução
_"no console do Neon, localize as chaves com prefixo `_live_`"_ aponta para o
**provedor errado**. A fase C10-5 segunda metade ou é no-op, ou é dano — se
"revogar" for aplicado contra o Neon, revoga-se o que não estava em questão.

## 4. `DBT-25` não está em 0/35

O brief diz _"Contract-guard de saída (0/35 → DBT-25) 🔴 Aberto"_. Medido com
`npm run guard:contracts`:

```
"contract-output-ratchet": status "pass", detail "cobertura de contrato de saída
14.285714285714285% (5 de 35); dívida declarada em DBT-25, piso 5 de 35"
```

São **5 de 35**, com piso versionado em `scripts/contract-baseline.json`
(`outputContracts: 5`) e o ratchet **verde**. A leitura `0/35` está três ciclos
desatualizada.

**E escalar 5 → 35 agora seria multiplicar um defeito conhecido.** A S6 adversarial
do ciclo 3 refutou a correção do próprio padrão:

- **N-1:** o contrato é aplicado **depois** dos mappers
  (`expenses.functions.ts:112`, `financial.functions.ts:145`,
  `products.functions.ts:394`), então um valor que quebra o mapper lança `TypeError`
  cru e a resposta é **500, não o 503 do contrato**. A afirmação "retorno malformado
  ⇒ `DEPENDENCY_ERROR`" é falsa para essas formas.
- **N-2:** o tipo público de retorno **estreitou em 3 das 5** funções
  (`DecimalString` em `listExpenses`/`listProducts`; `getTotals` deixou de devolver
  `ExpenseTotals`). Foi declarado **não autorizado no brief** e está **pendente de
  ratificação do MAESTRO**.

Replicar esse padrão em 30 funções novas espalharia uma afirmação falsa 30 vezes e
multiplicaria por 7× uma decisão de API ainda não ratificada. A ordem correta é
**corrigir o posicionamento (N-1) e ratificar N-2 antes** de ampliar a cobertura —
exatamente o inverso de "fechar para 35/35".

## 5. `DBT-26` — código corrigido, registry ainda `ABERTA`

O `catch` de `password.server.ts` foi corrigido no ciclo 3 (classifica e **lança**
`PasswordVerificationError` com `malformed-input`/`unusable-hash`/`crypto-failure`;
`false` passou a significar só "hash válido com senha errada"), com controle
negativo medido: mutar de volta derruba 21 de 84 testes. O que falta não é código
— é o **selo/WP que executa o closure**, que é a condição do registry para mover o
status para `FECHADA`. Isso é trabalho executável.

## 6. Observabilidade ponta a ponta — sem alvo para medir

A fase C10-6 pede "100 traces inspecionados sem vazamento". A instrumentação existe
no código, mas um fluxo de traces pressupõe uma aplicação **rodando e gerando
tráfego**. Sem deployment de produção acessível, não há stream de traces para
inspecionar, e "100 traces" não é atingível. O que é verificável hoje é a
**sanitização no código** (unidade/integração), não um conjunto de 100 spans reais.

## 7. Segredo comprometido ainda alcançável — e é isto que dá para fechar hoje

O literal de `BETTER_AUTH_SECRET` que motivou a rotação **é recuperável do
histórico publicado**: 61 caracteres, em `scripts/check-hostinger-runtime.mjs`,
introduzido em `26a2fdd` e removido por `ede2c89`. Ele satisfaz a validação de ≥ 32
caracteres, então a aplicação o aceitaria em um deploy.

Como a rotação é impossível hoje e o repositório é público, a única proteção
executável **agora** é impedir mecanicamente que esse valor seja usado: a aplicação
recusa subir se o `BETTER_AUTH_SECRET` configurado tiver o hash do valor
comprometido — **por hash, nunca pelo valor**, para não recolocar o segredo no
arquivo. Isso transforma "rotacionar é pendente" numa invariante que não depende de
ninguém lembrar, e passa a valer no instante em que a aplicação for implantada.

## 8. O que segue executável neste ciclo

| Item do DoD                             | Situação                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `m02:state:check` como gate             | **Executável** — fecha a dívida achada no ciclo 9                                                                                                                                    |
| Marcador do ledger automatizado         | **Executável** — o check exige o parent do commit que o carrega, o que é insatisfazível por construção para commit que não toca o ledger; a correção é de desenho, não de disciplina |
| `DBT-26` → `FECHADA`                    | **Executável** — falta o selo/WP do closure, não código                                                                                                                              |
| Recusa mecânica do segredo comprometido | **Executável** — ver §7                                                                                                                                                              |
| `npm run check` exit 0                  | **Executável**                                                                                                                                                                       |
| Evidência, journal, `DEBTS.md`          | **Executável**                                                                                                                                                                       |
| Rotação / revogação via MCP             | **Bloqueado** — §2 e §3                                                                                                                                                              |
| Matriz de saída 35/35                   | **Perigoso** — §4, requer N-1 e N-2 antes                                                                                                                                            |
| 100 traces                              | **Sem alvo** — §6                                                                                                                                                                    |
