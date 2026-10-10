# Candidato de publicação, 2026-10-09

**Estado do pacote: EVIDENCE + correções de código não publicadas. Nenhuma
mutação de produção foi executada. Nenhum valor de ambiente foi lido. Nenhum push,
merge, deploy, promoção de alias ou rollback.**

## Resultado corrente

O candidato correto **não** é `fa45632`, como o relatório anterior supunha: é o
HEAD local de `develop`, `852dcaf04180cbe1bf132ed542312c2e543b13c9`, que contém
`fa45632` como ancestral e mais quatro commits que nunca foram enviados ao remoto.
`fa45632` já foi construído pela plataforma (`dpl_6h2LTZ`, `READY`) e **falhou**
em runtime: `/api/health/ready` devolveu `503 not_ready` e
`/api/auth/get-session` devolveu `500`, com o log não-discriminante.

- **VERIFIED.** O HEAD local contém `origin/main` inteiro
  (`git rev-list --left-right --count origin/main...HEAD` = `0 5`), e os cinco
  commits excedentes são `445b49a`, `09dfeba`, `0807115`, `852dcaf`.
- **VERIFIED.** O SHA que serve o alias público continua `d4b9395`
  (`dpl_DHsbjECX…`), com `alias.updatedAt` idêntico ao da contenção de
  2026-10-08: `1791486033986`. A contenção permanece em vigor.
- **VERIFIED.** `@tanstack/react-start` resolve `1.168.60` e
  `@tanstack/start-server-core` resolve `1.169.39` no package.json (direto), no
  lockfile e em `node_modules`; nenhuma cópia aninhada divergente; `npm audit
--audit-level=high` com 0 vulnerabilidades.
- **VERIFIED.** A cadeia `npm run check` passou inteira:
  `CHECK_EXIT=0`, 21/21 passos, 141 arquivos de teste / 2136 testes aprovados,
  18 condicionais.
- **VERIFIED.** A cadeia `npm run db:test` passou inteira contra o container
  PG17 efêmero: `DB_TEST_EXIT=0`, 18/18 suítes — e foi **reexecutada sobre o
  estado que ela própria produz**, sem zerar nada (`DB_TEST_RERUN_EXIT=0`).
- **BLOCKED.** A causa raiz do 503 **não** foi isolada, e o experimento decisivo
  está bloqueado pelo fornecedor.
- **BLOCKED.** Os valores de `AI_MODEL`, `AI_GATEWAY_URL`, `DEEPSEEK_API_KEY` e
  `DATABASE_URL` de produção **não** foram lidos. São pré-requisito duro de
  publicação e são operação Via A.
- **NO-GO.** Publicar exige fechar esses bloqueios.

---

## A. Inventário de versões

| componente                           | SHA                                        | deployment                         | target/state                       | alias público |
| ------------------------------------ | ------------------------------------------ | ---------------------------------- | ---------------------------------- | ------------- |
| local `develop` HEAD                 | `852dcaf04180cbe1bf132ed542312c2e543b13c9` | **nunca construído**               | —                                  | —             |
| `origin/develop`                     | `974581a724c06ea679e076b72e7063aac31b9a54` | **nunca construído**               | —                                  | —             |
| `origin/main` (ex-candidato)         | `fa45632391ad9ffe1d20d3bad5264a53b565638e` | `dpl_6h2LTZX57soGiPP2oTurws7NsgVd` | production/READY                   | não           |
| **servindo o alias público hoje**    | `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9` | `dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL` | production/READY                   | **sim**       |
| reconstrução recusada do SHA servido | `d4b939536f2d2df74ab2d0f1bd02a73fc9ce34c9` | `dpl_4vNYvd5xcXRBjVRyRcp9Fri7mhxz` | production/ERROR (BLOCKED_PACKAGE) | não           |

## B. Matriz de divergência local × remoto × produção

| eixo                                               | estado                                                                                                                                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| local HEAD vs `origin/main`                        | local **contém** main; 5 commits à frente, 0 atrás.                                                                                                                                           |
| local HEAD vs `origin/develop`                     | 4 commits à frente (`445b49a`, `09dfeba`, `0807115`, `852dcaf`) — nunca enviados.                                                                                                             |
| `origin/main` vs produção                          | `origin/main` = `fa45632`; produção serve `d4b9395`. **Divergentes**, e a divergência é a contenção.                                                                                          |
| produção vs candidato novo                         | **Nenhum deployment existe** para `852dcaf`. O candidato não tem artefato na plataforma.                                                                                                      |
| código de banco entre as duas revisões implantadas | `src/db/client.server.ts` e `src/routes/api/health/ready.ts` são blobs git idênticos entre `d4b9395` e `fa45632` (`2b0e9778…`, `2cdd37e1…`) — o 503 **não** é explicado pelo código de banco. |

**Conclusão de identidade:** o SHA mínimo que contém todas as correções e nenhuma
alteração indevida é `852dcaf`. Publicar `fa45632` deixaria de fora a correção de
env definido-e-vazio em `DATABASE_URL`, a remoção dos sinks que travam a CSP e a
instrumentação de readiness — ou seja, exatamente as três coisas que o incidente
de 2026-10-08 pediu.

## C. Causa raiz

### Provado

- **VERIFIED** — o artefato do incidente existia e era não-discriminante por
  defeito da chamada de log: `src/routes/api/health/ready.ts:14` passava o
  `Error` cru a `logJson`, e `src/lib/structured-logger.ts:24-26` serializa só
  `name` e `message`. O discriminante (`error.cause`, com SQLSTATE, host e
  endpoint) nunca era escrito.
- **VERIFIED** — o código de banco, a rota de readiness, o `env-guard` e o
  `vite.config.ts` são blobs idênticos entre a revisão que conecta (`d4b9395`) e
  a que não conectou (`fa45632`). A pilha de driver Postgres tem versão resolvida
  idêntica nos dois lockfiles.
- **VERIFIED** — a assinatura `"Failed query: begin"` / `"Failed query: insert
into rate_limits"` com `INTERNAL_ERROR` em `/api/auth/get-session` recorre em
  2026-10-02, 2026-10-06 e 2026-10-08, em pelo menos seis deployments distintos,
  inclusive no preview de `develop` `dpl_CzhQ5BmcW1ZPadxH36TKhYy75iQd`. A
  assinatura não é nova nem exclusiva dos bytes novos.
- **VERIFIED** — com o classificador novo, cinco formas de falha distintas
  produzem cinco classificações distintas (`captures/db-connectivity-probe.txt`):
  host inexistente → `dns`/`ENOTFOUND`; senha errada → `authentication`/`28P01`;
  porta fechada → `network`/`ECONNREFUSED`; banco inexistente →
  `configuration`/`3D000`. O sintoma genérico do drizzle esconde cinco causas.

### Refutado

- **H1 (código do cliente de banco divergente): REFUTADA** por identidade de blob.
- **H4 (`BETTER_AUTH_URL` ausente como causa aditiva): REFUTADA** —
  `createAuthInstance(database = getDatabase())` avalia `getDatabase()` antes de
  `resolveAuthPolicy()`, e `dpl_DHsbjECX` responde `get-session` `200 null` hoje
  pelo mesmo escopo. Uma falha de banco explica o 503 e o 500.
- **H5 (delta de framework TanStack como causa do sintoma de banco): REFUTADA** —
  nada na família TanStack toca a pilha de driver.

### Ainda indeterminado

- **H2 (valor de `DATABASE_URL` definido-e-vazio, só-espaços ou malformado):
  INDETERMINADA.** O guard atual (`readEnv`) já recusa `""` e `"   "` — o que não
  existia em `fa45632` era exatamente isso. Mas não há como saber, sem ler o
  valor, se é essa a forma.
- **H1 ambiental (valor aponta para endpoint inalcançável): INDETERMINADA.** O
  experimento decisivo — reconstruir `d4b9395` com o ambiente atual — está
  **BLOCKED** pelo fornecedor (`BLOCKED_PACKAGE`), e a alternativa por valor
  exige ler a credencial.
- **H3 (falha intermitente de conectividade, não específica dos bytes novos):
  INDETERMINADA, fortalecida.** A evidência de recorrência multi-deployment é a
  mais forte disponível, mas a amostra por cluster é `count=1`.
- **H7 (falha distinta do banco classificada genericamente como readiness):
  INDETERMINADA**, e agora **mensurável**: com a classificação fechada, a próxima
  ocorrência chega ao log com categoria e código.

## D. Correções implementadas

| arquivo                                            | mudança                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/db-failure-classifier.ts` (novo)          | classificador puro. Lê **somente** `code`, `errno`, `syscall` de cada elo da cadeia `cause`, com profundidade ≤ 4 e largura de `AggregateError` ≤ 3. Devolve chave fixa: `component`, `category`, `step`, `code`, `transient`, `inspectedCauses`. Código só sai se estiver em uma das duas tabelas aprovadas (18 SQLSTATE + 15 códigos de driver Node). Sem correspondência: `unknown` + `code: null`. |
| `src/lib/deployment-identity.server.ts` (novo)     | `deploymentIdentity()` (lê `VERCEL_DEPLOYMENT_ID`/`VERCEL_GIT_COMMIT_SHA` via `readEnv`, valida formato, omite o que não bate) e `requestCorrelationId(request)` (mesmo predicado de `src/server.ts:84-87`).                                                                                                                                                                                           |
| `src/routes/api/health/ready.ts`                   | a linha `health.readiness_failed` passa a carregar `correlationId`, `deploymentId`, `commitSha` e a classificação fechada, em vez do `Error` cru. **A resposta pública de 503 não mudou**: continua `{"status":"not_ready","dependencies":{"postgres":"unavailable"}}` com `cache-control: no-store`.                                                                                                  |
| `src/test/db-failure-classifier.test.ts` (novo)    | 37 testes: chave fixa, tabela de SQLSTATE, tabela de driver, código fora da tabela descartado, cadeia limitada, ciclo de `cause`, `AggregateError`, e seis casos de não-vazamento por substring.                                                                                                                                                                                                       |
| `src/test/health-readiness-logging.test.ts` (novo) | 7 testes da rota: linha discriminante, identidade do deployment, ausência de vazamento, erro sem código, resposta pública 503 genérica, e os dois de correlação.                                                                                                                                                                                                                                       |
| `src/test/model-gateway.test.ts`                   | 1 teste novo: valor opaco de registro de painel (`J5pElDTcKFX90oTm`) no destino nativo DeepSeek recusa antes do `fetch`.                                                                                                                                                                                                                                                                               |
| `docs/specs/M-02/matrix*.yaml`                     | regenerados por `npm run m02:matrix:generate` (duas identidades novas na lista de imports da rota de readiness).                                                                                                                                                                                                                                                                                       |

**Não feito, de propósito:** `script-src`/`style-src` da CSP. A política está
congelada e report-only; o ADR-043 é PROPOSTA sem ratificação.

## E. Segurança

### A vulnerabilidade

Fonte primária: `https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8`
— "Unauthenticated reflected XSS in TanStack Start server-function responses",
**Critical**, CVSS `3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:N` = **9.3**, CWE-79,
**CVE-2026-102989**.

| pacote                        | afetado                 | patched    | candidato `852dcaf`            | produção `d4b9395`     |
| ----------------------------- | ----------------------- | ---------- | ------------------------------ | ---------------------- |
| `@tanstack/react-start`       | `>=1.143.12, <1.168.60` | `1.168.60` | `1.168.60` **no piso patched** | `1.168.49` **afetada** |
| `@tanstack/start-server-core` | `>=1.143.12, <1.169.39` | `1.169.39` | `1.169.39` **no piso patched** | (transitivo)           |

Consequência medida da exploração: um atacante não autenticado cria uma URL para
uma server function; se alguém abre o link, o app pode devolver HTML controlado
pelo atacante da própria origem e executar o JavaScript dele lá — com acesso a
dados same-origin e capacidade de fazer requisições com a autoridade do
visitante.

### Exposição residual

- **VERIFIED:** produção continua em `d4b9395`, que resolve
  `@tanstack/react-start@1.168.49` — **afetada**. A Vercel recusa reconstruir
  essa revisão (`BLOCKED_PACKAGE`), então a exposição não é fechável por
  rollback de deploy: só é fechável publicando o SHA novo.
- **VERIFIED:** o candidato está nos pisos patched com **margem zero**. Qualquer
  downgrade acidental reabre a vulnerabilidade; `guard:upgrade` falharia nesse
  caso (verificado hoje: `spec`, `lockfile`, `node_modules` e `downgrade` todos
  `pass` para `@tanstack/react-start`).
- **VERIFIED:** `npm audit --audit-level=high` → 0 vulnerabilidades.
- **UNDOCUMENTED:** se a Vercel aplica ou não mitigação própria de plataforma
  para o servido. Não foi medido.
- **BLOCKED:** fechar a exposição exige publicar o candidato, o que exige Via A.

### O que a correção do log protege

O log de readiness deixa de serializar `Error`/`error.cause` integralmente. Os
testes provam, por substring, que `host`, `port`, `user`, `password`, `database`,
`connectionString` e a query **não** alcançam a linha de log — inclusive quando o
próprio erro os carrega.

## F. Prontidão para produção

**NO-GO.**

Justificativa verificável, item por item, contra os oito critérios de GO:

| #   | critério                                           | estado      | prova                                                            |
| --- | -------------------------------------------------- | ----------- | ---------------------------------------------------------------- |
| 1   | vulnerabilidade crítica corrigida **no candidato** | **SIM**     | `captures/version-inventory.txt` — `1.168.60`/`1.169.39` no piso |
| 2   | revisão exata identificada                         | **SIM**     | `852dcaf04180cbe1bf132ed542312c2e543b13c9`                       |
| 3   | testes locais e de build aprovados                 | **SIM**     | `CHECK_EXIT=0`, 2136 testes, bundle PASS                         |
| 4   | readiness funcionando **no candidato**             | **NÃO**     | o candidato nunca foi construído; sem evidência de runtime       |
| 5   | integração de IA verificada                        | **PARCIAL** | contrato verificado por código e por teste; chamada real BLOCKED |
| 6   | registros necessários de ambiente validados        | **NÃO**     | valores não lidos; Via A                                         |
| 7   | evidência de equivalência ao ambiente de produção  | **NÃO**     | SSO habilitado, sem bypass autorizado                            |
| 8   | procedimento de contingência definido              | **SIM**     | `docs/runbooks/vercel-prod-env-admin.md` §8                      |

Os itens 4, 6 e 7 são bloqueios externos, não trabalho pendente de código. Nenhum
deles é fechável sem autorização humana.

## G. Handoff humano mínimo

Consolidado em `GO-NO-GO-2026-10-09.md`. Somente operações que exigem credencial,
autorização ou decisão externa.

## H. Próxima execução

Ordenada por dependência, em `GO-NO-GO-2026-10-09.md` §5.

---

## A cadeia de banco: quatro execuções, quatro desfechos

Um agente paralelo mediu a **primeira** execução do `npm run db:test` e a
reportou como "a cadeia aborta". A leitura correta é mais estreita, e está
registrada em `captures/db-test-reproducibility.txt`:

1. **RECUSADA.** O volume nomeado `preco-que-d-main_postgres-data` carregava
   `accounts=2` de rodada anterior da própria bancada; o guarda em
   `drizzle/rollback/0010_to_0009_down.sql:26-37` (mesma transação do `UPDATE`
   destrutivo) recusa com SQLSTATE `P0001` quando `count(*)` de `accounts` é
   `> 0` — **qualquer** linha, sem filtro. Assinatura idêntica à já registrada
   como DBT-96. Nenhuma conta foi apagada à força.
2. **VERDE.** Volume zerado pelo procedimento documentado no runbook; 18/18
   suítes.
3. **VERDE.** Reexecutada sobre o estado deixado pela execução 2
   (`accounts=0`, `journal_rows=20`, `tables=38`), sem zerar nada.
4. **DRIFT (sonda isolada).** Recusa reproduzida em container PG17 efêmero
   próprio: o abort deixa 9 downs commitados **sem a poda do journal**
   (`schema != journal`) e fixtures residuais; a reexecução sem zerar falha
   antes e com outra assinatura. Recuperação = a zeragem documentada — o que a
   execução 2 fez.

Ou seja: a recusa é **condição de entrada** — conta herdada — e não defeito de
reprodutividade; a **saída verde** da cadeia é reexecutável (execução 3), mas o
**aborto não é** (execução 4). Todas as execuções usaram loopback e nenhuma
tocou Neon ou produção; a bancada `:5432` foi conferida intacta depois da sonda.

## Auto-verificação pré-S6

| item do checklist                   | situação                                                                                                                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| controle negativo                   | **sim** — `captures/negative-control.txt`: GREEN 44 → RED 21 → RESTORED 44                                                                                                               |
| fronteira nas duas direções         | **sim** — código fora da tabela aprovada devolve `code: null`; tabela completa é exercitada teste a teste                                                                                |
| identidade, não cardinalidade       | **sim** — a classe do erro é publicada, nunca a mensagem; a ausência de código vira `null`, não string vazia                                                                             |
| proibido exit-code-only             | **sim** — o probe imprime a classificação de cada cenário, não só o exit code                                                                                                            |
| proibido sleep fixo                 | **sim** — nenhum timeout arbitrário; só limites de profundidade/largura                                                                                                                  |
| sem valor degenerado na identidade  | **sim** — `unknown` não é código; `null` não é `"null"`                                                                                                                                  |
| precondição de estado compartilhado | **sim** — o `db:test` recusa quando o container guarda `accounts>0` de rodada anterior; quatro execuções medidas: RECUSADA, VERDE, VERDE, DRIFT (`captures/db-test-reproducibility.txt`) |
| sentinela real por cenário          | **sim** — `S1..S5`, cada um com código esperado distinto                                                                                                                                 |
| fingerprint de revisão              | **sim** — SHA do HEAD em `captures/git-state.txt`                                                                                                                                        |
| `checked === discovered`            | **sim** — `MANIFEST.sha256` cobre a lista descoberta do pacote                                                                                                                           |
| falha alta / fail-closed            | **sim** — `AUTOVERIFY` reprova o probe se alguma substring de credencial alcançar o stdout                                                                                               |
| isolamento de bancada assertado     | **sim** — banco loopback descartável; produção nunca é alvo                                                                                                                              |
| descoberta multi-sítio              | **parcial** — o catálogo `env-nullish-catalog` reprovou um comentário novo; corrigido por reescrita, sem allowlist                                                                       |
| run de CI atado ao commit selado    | **N/A** — nenhum push foi autorizado nesta sessão                                                                                                                                        |

## Rollback

Os arquivos de código desta sessão podem ser descartados sem efeito em produção:
nada foi publicado. O alvo de rollback de produção continua sendo
`dpl_DHsbjECXDyQ5fajQQPvXrT5Rz7eL`, com a ressalva de que voltar a ele **não**
restaura o chat (ele lê `AI_GATEWAY_API_KEY`, não `DEEPSEEK_API_KEY`).
