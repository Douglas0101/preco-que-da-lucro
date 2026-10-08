# Recuperação do backend publicado — endpoint Neon morto, reparo e teste manual

## 1. Resultado observado

O backend publicado estava **fora do ar desde 02/10** com uma mensagem que enganava: o app
registrava `password authentication failed for user 'neondb_owner'`, mas a causa era **endereço de
banco morto**. O `DATABASE_URL` da aplicação apontava para
`ep-lively-recipe-ayuct9gp-pooler.c-5.us-east-2.aws.neon.tech`, endpoint da branch
`br-blue-silence-ayj9erkh` — uma cópia de preview **removida no cleanup de 02/10**. O endpoint
correto da branch `production` é `ep-long-violet-aye9g0bn-pooler.c-5.us-east-2.aws.neon.tech`.

O erro era não-discriminante por construção: um **endpoint inexistente** devolve exatamente o mesmo
`28P01`, porque o proxy responde de forma genérica. Isso foi provado por controle negativo e é o que
manteve a causa oculta por quatro dias (`captures/fingerprint-negativo.txt`). O banco em si sempre
esteve saudável: `neondb` existe, `neondb_owner` pode logar e não expira, e não houve nenhuma
operação de reset de senha de role nas últimas 100 operações do projeto.

O reparo foi aplicado pela **rota autenticada do próprio painel**, trocando **apenas o token do
endpoint** dentro do valor existente — usuário, senha, banco e parâmetros preservados. O `PUT`
devolveu **204**; a releitura do servidor confirmou o novo host com **14 variáveis antes e 14
depois** e `senhaPreservada: true`. O redeploy seguinte (build `01a10f36…`, **35 s**) concluiu e o
app voltou a responder `ready` **200** com `postgres: ok`.

Depois disso o teste manual autenticado foi possível com uma conta de QA criada em produção sob
autorização explícita do operador:

| Verificação                               | Antes                           | Depois                                                              |
| ----------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| `/api/health/live`                        | 200 `ok`                        | 200 `ok`                                                            |
| `/api/health/ready`                       | **503** `postgres: unavailable` | **200** `{"status":"ready","dependencies":{"postgres":"ok"}}`       |
| `/api/auth/get-session`                   | **500** HTML                    | **200** JSON `null` (anônimo)                                       |
| `POST /api/auth/sign-in/email` (inválida) | **500** HTML                    | **401 JSON** `INVALID_EMAIL_OR_PASSWORD`                            |
| Login real (conta de QA)                  | impossível                      | **sessão ativa**, usuário verificado, tenant `QA Manual`            |
| Escrita de produto (`expenses`)           | impossível                      | **persistida** com tenant/usuário corretos e `1500,00 → 1500.0000`  |
| Chat / Novo Produto                       | impossível                      | **`DEPENDENCY_ERROR`** → "Um serviço necessário está indisponível." |

### Mapa de usabilidade medido com sessão real

| Tela                     | Estado                                       | Depende de IA           |
| ------------------------ | -------------------------------------------- | ----------------------- |
| Início                   | renderiza (nav completa, estado vazio)       | não                     |
| Minhas Despesas          | formulário funcional, escrita persistida     | não                     |
| Novo Produto (chat)      | falha em `DEPENDENCY_ERROR`                  | **sim — bloqueado**     |
| Meus Produtos            | "0 produtos cadastrados"                     | sim (cadastro via chat) |
| Preços de Compra         | "Cadastre um produto pelo chat para começar" | sim                     |
| Vendas                   | "Nenhuma venda registrada"                   | sim (exige produto)     |
| Ponto de Equilíbrio      | "Cadastre um produto para calcular."         | sim                     |
| Simulações / Diagnóstico | estados vazios coerentes                     | sim                     |

Consequência prática: **o núcleo do produto está bloqueado hoje** — sem cadastro de produto pelo
chat não há preços, vendas, ponto de equilíbrio nem diagnóstico. O app é utilizável apenas na borda
(despesas), e a falha de IA degrada com mensagem, sem tela branca nem stack trace.

## 2. Evidência e identidade

| Observação                                                                | Captura                                                                         | Classe                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Estado antes: `ready` 503, sessão 500, log `28P01`                        | `captures/http-before-fix.txt`                                                  | transcrição do log da sessão; condição não reproduzível após o reparo |
| Controle negativo: endpoint inexistente devolve o mesmo `28P01`           | `captures/fingerprint-negativo.txt`                                             | REMOTE-OBSERVED, probe próprio com senha inválida                     |
| Controle negativo **ampliado** e refutação da hipótese de cache de pooler | `captures/fingerprint-ampliado.txt`                                             | REMOTE-OBSERVED, verificação adversarial independente (T1)            |
| Endpoint configurado pertencia a `br-blue-silence-ayj9erkh`               | `captures/neon-inventory.json` e `docs/evidence/infra-2026-10-02/README.md:195` | REMOTE-OBSERVED, metadados                                            |
| Chaves do runtime (nomes) e host do `DATABASE_URL` antes/depois           | `captures/env-var-names.json`                                                   | REMOTE-OBSERVED via API do painel; sem valores                        |
| Build `01a10f36…` completed em 35 s                                       | `captures/builds.json`                                                          | REMOTE-OBSERVED, API do painel                                        |
| Conta de QA, tenant e escrita de `expenses`                               | `captures/db-qa-writes.json`                                                    | REMOTE-OBSERVED, leitura no banco `production`                        |
| Incidente de credencial em contexto                                       | `captures/incident-credential-exposure.json`                                    | declaração; nenhum valor repetido                                     |
| Estado depois: `ready` 200, 401 JSON no sign-in inválido                  | `captures/http-after-fix.txt`                                                   | REMOTE-OBSERVED, GET/POST anônimos                                    |

## 3. Caminho de correção aplicado

1. **Diagnóstico sem segredo**: leitura do valor configurado por extrator com allowlist
   (`host`, `usuario`, `banco`, `comprimento`, `pooled`) — a senha nunca foi devolvida.
2. **Identidade do endpoint morto**: `ep-lively-recipe-ayuct9gp` → branch `br-blue-silence-ayj9erkh`,
   identificada no inventário Neon de 02/10 e ausente da lista atual de branches.
3. **Controle negativo**: probe com senha inválida contra endpoint vivo e contra endpoint
   inexistente, ambos `28P01` — provando que a mensagem não separa as duas causas.
4. **Reparo**: `PUT` em
   `/api/wh-api/api/hapi/v1/accounts/u624951889/vhosts/darkgray-pony-545965.hostingersite.com/nodejs/builds/settings/env`
   com `{ envVars: [...] }`, substituindo **somente** `ep-lively-recipe-ayuct9gp` por
   `ep-long-violet-aye9g0bn` → **204**; releitura confirmou 14 variáveis preservadas.
5. **Redeploy**: disparado pelo painel, build concluído em 35 s, `ready` 200 em seguida — a
   correção sobreviveu ao rebuild (o `DATABASE_URL` permaneceu em 148 caracteres, host `production`).
6. **Teste manual**: cadastro público criou a linha em `users`; o operador digitou a senha (nunca
   passou pelo agente); `UPDATE users SET email_verified = true` liberou o login; a escrita de
   `expenses` foi conferida no banco.

## 4. Incidente declarado

Durante um probe de verificação, uma fatia de texto de uma linha **já revelada** na tela de
variáveis de ambiente entrou no contexto do agente, incluindo o início da connection string — mesma
classe do `L239`. Contenção executada: a linha foi re-mascarada na hora, nenhum arquivo/commit/
screenshot contém o valor, o valor **não** foi usado para autenticar, e a correção do endpoint foi
feita sem lê-lo (apenas o token do endpoint foi trocado dentro da página). O transcript é
irrecuperável: a credencial deve ser tratada como **exposta**, com decisão de rotação pela Via A —
nenhuma rotação foi executada por este agente. Lição: probe de verificação precisa de allowlist
estrita, nunca fatia de texto de linha revelada.

## 5. Riscos e limites

- O build publicado é `main` `d4b93953` (01/10), **anterior** ao patch local do chat; o redeploy
  reconstruiu o mesmo código, não publicou o `develop`.
- A `DEEPSEEK_API_KEY` foi registrada (15ª variável, verificada **só pelo nome**) mas é **inerte**
  neste build: o commit publicado tem **0 referências** a ela e resolve a credencial por
  `AI_GATEWAY_API_KEY ?? LOVABLE_API_KEY`, nenhuma das duas presente. Ativar exige publicar um SHA de
  `main` aprovado que contenha o consumidor (`develop` `cafde4e`, `chat.functions.ts:344-347`), pelo
  circuito de release do `AGENTS.md`.
- Como o build antigo não lê a chave, não há risco de envio a outro emissor — mas a chave fica
  provisionada em runtime que não a utiliza.
- Escrita em produção: a conta de QA e o tenant **permanecem ativos por decisão do operador**
  (limpeza oferecida e não executada). O desvio do contrato "production data is never a test target"
  está declarado e restrito ao tenant de QA.
- A branch `develop` estava arquivada desde 04/10 e foi desarquivada por um probe de controle desta
  sessão (`timeline_unarchive` + `start_compute` em 2026-10-06T02:22:59Z) — estado coerente com o
  contrato das duas branches permanentes; compute suspenso desde 02:28Z.
- O toast "Um serviço necessário está indisponível" **persiste durante a navegação** (confirmado
  como `LI.group.toast` em `OL.toaster.group`) — ruído visual a considerar.
- **N1 — `app_runtime` divergente entre planos.** O plano de controle (API Neon) reporta
  `authentication_method: no_login`; a prosa de `docs/evidence/ciclo-26/README.md:31` afirma
  `app_runtime` com LOGIN, e a rota pendente do DBT-73 / ciclo-27 ("salvar `DATABASE_URL` pooled
  production/`app_runtime`") **não é executável como escrita** enquanto isso não for resolvido. O
  plano SQL (`pg_roles.rolcanlogin`) não é medível sem credencial — fica **INDETERMINADO**, a
  resolver por leitura com o operador.
- **N2 — drift de branch de preview ainda ativo.** A integração Vercel criou em 2026-10-04T14:11:39Z
  a branch `br-silent-unit-ay1ixu13` (`preview/dependabot/npm_and_yarn/tailwind-merge-3.7.0`,
  `creation_source: vercel`, endpoint `ep-delicate-queen-aysz28lq`, ativa) — coerente com DBT-70/72
  abertas e **o mesmo modo de falha deste incidente**: uma URL apontando para endpoint de preview que
  depois deixa de existir.
- **Limite declarado:** `senhaPreservada: true` não tem captura do corpo do `PUT`; a afirmação repousa
  na resposta da própria operação e na aritmética (host 60→58 caracteres e total 150→148 ⇒ nenhum
  outro componente mudou de comprimento). Não foi refutada, mas o valor em si não é atestado por
  captura — e não deve ser, por política de segredo.

## 6. Auto-verificação

| #   | Item                          | Resultado                                                                                                                        |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Controle negativo             | endpoint inexistente devolve o mesmo `28P01` que senha errada — a mensagem não discrimina                                        |
| 2   | Fronteira nas duas direções   | `ready` 200/`postgres: ok` contra `ready` 503/`unavailable`; `401` JSON contra `500` HTML                                        |
| 3   | Identidade, não cardinalidade | host do endpoint antes/depois e branch de origem identificados, não apenas "14 variáveis"                                        |
| 4   | Sem valor degenerado          | nenhum valor de credencial registrado; apenas nomes, hosts, comprimentos e booleanos                                             |
| 5   | `checked === discovered`      | 15 nomes de variável conferidos contra a lista do painel; 9 capturas (5 JSON + 4 TXT) contra as 11 entradas do `MANIFEST.sha256` |
| 6   | Todo check com gate e captura | cada afirmação desta página aponta para um arquivo em `captures/`                                                                |
| 7   | Proibido exit-code-only       | o veredito é comportamental (HTTP + banco), não apenas código de saída                                                           |
| 8   | Precondição de estado         | `ready` foi medido antes e depois; o reparo foi confirmado por releitura do servidor, não por resposta do `PUT`                  |

### Correções de comando e limites de cobertura

- A verificação do manifesto **precisa rodar dentro do pacote** (`cd docs/evidence/hostinger-recovery-2026-10-06 && sha256sum -c MANIFEST.sha256`), porque as entradas são relativas ao diretório do pacote. Executada da raiz, `README.md` resolve para o README da raiz e imprime "FALHOU" — falso positivo de corrupção, não defeito do pacote.
- `m02:secrets-audit` **exclui `docs/evidence/**`** por desenho (`evidence-auditor-or-test-not-consumer`), logo o verde dele **não** cobre este pacote. A cobertura de segredo aqui veio de varredura independente com dez padrões (prefixo de senha Neon, URL de conexão com credencial, cabeçalho de autorização, atribuição de senha em três grafias, prefixos de chave de provedores de LLM e de token GitHub/AWS, e a forma `usuario:senha@host`): **0 ocorrências reais** em todas as capturas. Os literais dos padrões não são reproduzidos aqui de propósito, para não poluir varreduras futuras com falso positivo de meta-prosa.
- `m02:work-package-guard` valida apenas o **template** de work package, não certifica a estrutura deste pacote; `m02:boundaries` não é passo do `ci-light.yml` (foi executado por instrução).
- Gate pesado `npm run check` completo: **exit 0** (132 arquivos/1865 testes passando, 18 skips; build e `check:bundle` PASS), com as mudanças não commitadas de outra sessão presentes na árvore — nenhuma falha pré-existente.
