# Ações manuais pendentes — pós-Ciclo 8

> **Por que este runbook existe.** As ações abaixo **não podem ser executadas por
> agente**: cada uma exige credencial do emissor (Vercel, Neon) ou um valor que
> invalida sessão de usuário. Nenhuma delas é bloqueada pelo código — o CI está
> verde — e nenhuma delas está coberta por um gate. Estão aqui para que a lacuna
> entre _"o repositório está íntegro"_ e _"a rotação foi feita"_ não se perca.

Data do levantamento: **2026-09-28**. Origem: virada de visibilidade do repositório
(privado → público) e o primeiro ciclo de CI executando desde 2026-09-21.

---

## 1. Vercel — `Git author Douglas0101 must have access to the project`

**Estado:** `Vercel – preco-que-da-lucro` está **SUCCESS** no PR #49 e **FAILURE**
no #48 (que foi fechado por subordinação — ver abaixo). A causa declarada pelo
bot é permissão, não código.

**Estado: RESOLVIDO, sem ação necessária.** Os dois checks Vercel do PR #49
estão **SUCCESS** (`Vercel – preco-que-da-lucro` e `Vercel Preview Comments`).

O que aconteceu: o bot falhava com _"Git author Douglas0101 must have access to
the project on Vercel"_, e a **primeira** ação que ele oferece para essa
mensagem é justamente _"make your repository public"_. A virada de visibilidade
resolveu, sem tocar em nenhuma configuração. O PR #48 aparecia ainda vermelho
porque **não tinha sido re-executado** depois da virada; ele foi fechado por
subordinação (ver §5), então o item ficou sem objeto.

Se um deploy voltar a falhar com essa mensagem, o caminho é
`vercel.com` → _Account Settings → Login Connections_ → reconectar a conta
GitHub `Douglas0101`. Não é o caso hoje.

---

## 2. Rotação de `BETTER_AUTH_SECRET` (SEC-01)

**Estado:** um literal de `BETTER_AUTH_SECRET` está presente no **histórico
publicado** de todas as refs, introduzido em `26a2fdd` (2026-08-23) e removido
por `ede2c89`. O valor é auto-descritivo (contém _hostinger/smoke/secret_), ou
seja, provavelmente um segredo de smoke test — mas "provavelmente" não é
"comprovadamente inerte", e o repositório agora é público. **Isto não pode ser
resolvido removendo do histórico**: reescrever histórico publicado é vedado por
`AGENTS.md:4/16`. A única correção é **rotacionar**.

**O que fazer:**

1. Gerar o novo valor: `openssl rand -base64 32`
2. **Neon** → o projeto `preco-que-da-lucro-g3-pg17`, branch `production` →
   _Variables_ → `BETTER_AUTH_SECRET` → substituir
3. **Vercel** → o projeto de produção → _Settings → Environment Variables_ →
   `BETTER_AUTH_SECRET` nos três ambientes → substituir **com o mesmo valor**
4. **Deploy** para que o runtime pegue a variável nova
5. **Invalidar sessões**: `BETTER_AUTH_SECRET` assina o cookie de sessão, então
   trocar o valor **desloga todo mundo**. Se `BETTER_AUTH_SECRET` estiver em uso
   como `BETTER_AUTH_SECRET` no `better-auth`, esperar o cookie `session_token`
   deixar de ser emitido com a chave antiga (o `maxAge` do cookie define a
   janela). Não há como rotacionar sem derrubar sessão.
6. Anotar data, valor **antigo** (referência, não o valor) e motivo no
   `docs/evidence/agent-state/DEBTS.md` se a SEC-01 for fechada por isso

**Advertência honesta:** os passos 2 e 3 exigem acesso ao console do Neon e do
Vercel. Um agente com o token do repositório não tem nenhum dos dois, e
inventar o valor aqui seria pior que não o fazer — o segredo passaria a existir
em mais um lugar sem tratamento. Esta seção é para o dono, com o console aberto.

---

## 3. Revogação de `neon-storage.env` (SEC-01, pendente desde a auditoria)

**Estado:** um blob **órfão** (`25393aac`) contém cinco credenciais com prefixo
`_live_` (`nak_live_`, `nsk_live_`, `nt_live_`). Provado por quatro vias
independentes que **não está em nenhuma ref publicada** — logo não foi exposto
pela virada. O que falta é a prova de que foram **revogadas na origem**; o
próprio ledger registra "revogação não comprovada".

**O que fazer:**

1. No console do Neon, localizar as chaves de API com prefixo `_live_` e
   **revogá-las** (ou confirmar que já foram)
2. Registrar a confirmação com **data e autor**, não com o valor
3. `git gc --prune=now` no clone local, para que o blob órfão deixe de existir
   em disco — é higiene, **não** é o que torna a revogação verdadeira

---

## 4. Higiene local (opcional, sem efeito no git)

```bash
chmod 600 Sonar.txt   # o token do SonarCloud está em 664, legível por
                      # qualquer usuário desta máquina
```

`Sonar.txt` está no `.gitignore` desde `c4057f3` e nunca foi commitado
(`git log --all -- Sonar.txt` é vazio). O risco aqui é local, não de
publicação.

---

## 5. O que **não** é ação manual

Para que ninguém procure o que já foi resolvido:

| Item                                  | Onde está | Estado                                                                                                    |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| 4 PNGs de console no histórico        | `90b4fe9` | Removidos do índice. **Continuam no histórico** — irreversível sem reescrever; aceito por decisão do dono |
| 722 commits com e-mail pessoal        | —         | Irremovível sem reescrever história                                                                       |
| S2871 nos 2 sorts do secret-scan      | `d7cf735` | `new_reliability_rating` 4 → **1** · 0 bugs abertos                                                       |
| `dbPrecondition` x escape hatch       | `26a1c55` | Falha original do `Branch efemera` eliminada                                                              |
| 4 copias de `assertLoopback`          | `be6adcd` | Removidas · politica unica em `scripts/lib/db-target.ts`                                                  |
| S4036 x4 (git resolvido por `PATH`)   | `615559f` | **6 → 1** vulnerabilidades · caminho absoluto verificado                                                  |
| S2068 (codigo de falha como literal)  | `0ebabd7` | **0** vulnerabilidades · `new_security_rating` 3 → **1**                                                  |
| `secret_scanning` / `push_protection` | —         | **Habilitados** 2026-09-28                                                                                |
| Vercel                                | —         | **SUCCESS** — resolvido pela virada de visibilidade, sem tocar em configuracao                            |
| PR #48                                | —         | **Fechado** por ser subconjunto estrito do #49 (452/452 arquivos em comum, 442 byte-identicos)            |
| Flake de e2e `ui-stack.spec.ts:92`    | secao 6   | **ABERTO** — 2 falhas em 3 execucoes; pre-existente, nao introduzido aqui                                 |

---

## 6. Flake de e2e em `ui-stack.spec.ts:92` — aberto, nao e do Ciclo 8

**Sintoma:** `login()` clica em "Entrar", a pagina continua em `/auth`, e
`toHaveURL(/\/inicio$/)` estoura o timeout de 5 s.

**Ja e conhecido e instrumentado.**
`docs/sdd/SDD-20260924-e2e-flake-investigation/01-spec.md:20` descreve o mesmo
teste, o mesmo sintoma e o mesmo timeout, com a diretriz explicita de
**"observar != afrouxar"** — nao mexer em timeout nem em assercao. A TASK-03
(atribuida a humano) e medir a latencia do redirect de login.

**O que o Ciclo 8 acrescenta:** a taxa e uma evidencia que aponta para
**interferencia entre testes**, nao latencia.

- **2 falhas em 3 execucoes** do mesmo codigo.
- O run usa `workers: 2` e executa `[mobile]` e `[chromium]` do **mesmo** teste
  em paralelo, com as **mesmas** `E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD`.
- Numa execucao, `[mobile]` **passou** as `03:11:04` e `[chromium]` **falhou** as
  `03:11:23` — 19 s depois.
- **Nenhum erro de autenticacao no servidor** na tentativa que falhou. Se a
  credencial fosse recusada, apareceria `WARN [Better Auth]: Invalid password`,
  como aparece nos testes que a rejeitam de proposito.

**Hipotese a testar — ainda nao testada:** dois workers assinando como o mesmo
usuario em janela de segundos, batendo no rate limiter do Better Auth ou numa
corrida de cookie de sessao. As correcoes candidatas sao credencial por worker ou
serializar o arquivo; ambas mexem no design da fixture de auth, entao a escolha e
do dono. **Nenhuma foi aplicada.** Aumentar o timeout esta fora de questao por
decisao ja registrada na SDD.
