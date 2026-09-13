# Checagens pós-publicação — 2026-09-05

O código publicado mantém CI verde, mas a continuação ainda tem pendências
verificadas: o validador de fronteiras M-02 falha; o down da migration 0010
alteraria quatro contas embora o forward tenha sido relatado como no-op; e o
Sonar de `main` não calculou o Quality Gate. Deploy, smoke produtivo e janelas
temporais continuam pendentes de acesso à Hostinger.

Escopo autorizado: continuar os passos do Plano Mestre e, após a informação
do usuário de que está sem acesso ao hPanel, executar as próximas checagens
disponíveis. A orientação operacional segue o Plano e o realinhamento V7.
Data das consultas: 2026-09-05; timestamps do GitHub em UTC.

Dados estruturados: [evidence.json](evidence.json).
Consulta somente leitura executada: [neon-preflight.sql](neon-preflight.sql).
Manifesto local de integridade: [SHA256SUMS](SHA256SUMS).

## 1. Autenticação e alcance por processo

| Processo                        | Evidência nesta sessão                                                                                                 | Classificação e limite                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub                          | Conector autenticado como `Douglas0101`; permissão `admin` no repositório                                              | REMOTE-VERIFIED; somente leituras de refs, PRs, checks, runs, logs e metadados de artefatos |
| Neon                            | Projeto `damp-forest-57346541`, permissão `ADMIN`; branch `production` = `br-snowy-violet-aymcvvvv`; banco `neondb`    | REMOTE-VERIFIED; duas consultas SELECT, sem obter connection strings                        |
| Role SQL do conector            | `neondb_owner`                                                                                                         | A sessão do conector não comprova autenticação do processo web como `app_runtime`           |
| Hostinger                       | IAB disponível; hPanel redirecionou a `https://auth.hostinger.com/login`; usuário informou indisponibilidade de acesso | BLOCKED-AUTH; contratação, domínio e configuração atual não verificados                     |
| SonarQube Cloud                 | Painel privado devolveu mensagem de projeto inexistente ou autenticação ausente, com opção de login                    | BLOCKED-AUTH para configuração; check do GitHub disponível                                  |
| Better Auth no destino          | Sem domínio confirmado e sem acesso ao deploy                                                                          | UNVERIFIED; testes locais/CI não são smoke produtivo                                        |
| Coletor OTLP e logs de produção | Configuração efetiva do processo Hostinger indisponível                                                                | UNVERIFIED; B3 exige dados reais recebidos e uma janela identificada                        |

A primeira listagem de projetos Neon pediu `org_id`; a organização foi
resolvida pelo conector e o projeto já registrado no repositório foi
confirmado por `describe_project`. Isso foi uma exigência de parâmetro,
sem falha de autenticação.

## 2. Git, release e CI vinculados aos SHAs

| Referência                  | SHA verificado                             | Evidência                                                                                                      |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Checkout e remoto `develop` | `bf356d862e3e8240e2f144f84c1b1fa37bc34f32` | Git local e API de branches concordam                                                                          |
| Remoto `main`               | `b1f946883a106668a5cf1d67ec8d7ec5d48810a2` | API de branches; merge do PR #27                                                                               |
| CI de `develop`             | `bf356d8`                                  | [run 33941501282](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/33941501282), `success`, push |
| CI de `main`                | `b1f9468`                                  | [run 33940307955](https://github.com/Douglas0101/preco-que-da-lucro/actions/runs/33940307955), `success`, push |

Os PRs [#24](https://github.com/Douglas0101/preco-que-da-lucro/pull/24),
[#25](https://github.com/Douglas0101/preco-que-da-lucro/pull/25),
[#26](https://github.com/Douglas0101/preco-que-da-lucro/pull/26) e
[#27](https://github.com/Douglas0101/preco-que-da-lucro/pull/27) estão mergeados.
Nenhuma publicação foi refeita.

Os passos dos dois jobs `verify` foram consultados: formato, typecheck, lint,
unitários, `db:test`, `db:check`, build, bundle, audit de dependências e
Playwright constam como `success`. Há dois artefatos não expirados em
`main`, de browser e bundle, vinculados ao mesmo SHA. Foram verificados os
metadados; os arquivos ZIP não foram baixados ou revalidados nesta sessão.

O diff entre os tips contém apenas ledger, evidência e as duas matrizes M-02.
O comando abaixo terminou com exit 0, confirmando igualdade dos caminhos de
runtime, scripts, testes, migrations, dependências e workflows selecionados:

```bash
git diff --quiet b1f946883a106668a5cf1d67ec8d7ec5d48810a2 bf356d862e3e8240e2f144f84c1b1fa37bc34f32 -- src scripts e2e drizzle package.json package-lock.json .github
```

O lockfile fixa Better Auth e seu adapter Drizzle em 1.7.2. Isso autentica a
versão do código publicado; a versão servida pela Hostinger permanece sem
verificação.

## 3. Gates locais e pendência M-02

| Comando                    | Resultado desta sessão                           |
| -------------------------- | ------------------------------------------------ |
| `npm run m02:state:check`  | PASS; marker parent-pinned válido para `bf356d8` |
| `npm run m02:matrix:check` | PASS; matriz determinística e atualizada         |
| `npm run m02:boundaries`   | FAIL, exit 1; 26 ocorrências                     |
| `npm run typecheck`        | PASS, exit 0                                     |
| `npm run lint`             | PASS, exit 0                                     |
| `npm run test`             | PASS; 353 testes em 34 arquivos                  |
| `npm run format:check`     | PASS antes da criação desta evidência            |
| `git diff --check`         | PASS antes da criação desta evidência            |

O primeiro comando M-02 falhou no sandbox por `listen EPERM` no IPC do
`tsx`. A mesma cadeia de comandos foi reexecutada após aprovação automática
da execução fora dessa restrição. O resultado acima vem da execução efetiva.

As 26 ocorrências de fronteiras se dividem em:

- 11 relações BFF → acesso ao banco fora dos caminhos permitidos;
- 1 política de entrada ausente: `src/lib/sales.functions.ts`;
- 2 mapeamentos ausentes: `createSale` e `listSales`;
- 12 referências de catálogo ausentes, correspondentes a 8 caminhos distintos.

Os oito caminhos de catálogo são `pricing.service.ts`,
`conversation.service.ts`, `memory.contracts.ts`, `audit.service.ts`,
`event.contracts.ts`, `product-catalog.repository.ts`,
`conversation.repository.ts` e `audit.repository.ts`, nos diretórios
`src/server/services`, `contracts` e `repositories` conforme a matriz.
A lista integral de relações e caminhos está no JSON.

Os endpoints de vendas já usam `requireDatabaseAuth` e `salesService`.
Portanto, mapeamento ausente na matriz não demonstra endpoint sem
autenticação. As violações de arquitetura e a política documental precisam
ser tratadas por categoria, mantendo os critérios de aceite existentes.

`ui-stack.yml` não executa os três comandos M-02. Logo, o CI verde e a matriz
determinística não encerram esse gate. Não foram criados stubs, adicionadas
exceções ou regeneradas matrizes nesta rodada.

## 4. Neon de produção: integridade verificada por SELECT

O projeto informa PostgreSQL 17; a consulta retornou
`server_version_num=170011` (17.11).

- Journal: 11 registros, correspondentes a 0000–0010.
- Comparação programática: **11/11 hashes SHA-256 e timestamps do journal
  coincidem com as migrations locais**.
- Credential accounts: 4; `issuer IS NULL`: 0; `local:credential`: 4;
  outros issuers: 0.
- As 11 colunas selecionadas das migrations 0008/0009 estão presentes,
  incluindo idempotência, FSM e custo.
- O índice `calculation_snapshots_idempotency_uidx` é UNIQUE e válido,
  sobre `tenant_id, calculation_type, idempotency_key`.
- Os quatro CHECKs selecionados estão validados.
- As cinco tabelas de tenant selecionadas têm RLS habilitada e não pertencem
  a `app_runtime`; a role não é superuser nem possui BYPASSRLS.

Essas são evidências de catálogo e agregados obtidas como `neondb_owner`.
A execução real do isolamento cross-tenant e da autorização como
`app_runtime` permanece comprovada pelos testes do CI, não por essas
consultas de produção. A reconciliação observada de issuer não substitui
uma reconciliação financeira completa nem a janela A5.

### Risco no rollback 0010

O forward foi relatado como no-op na aplicação de 03/09, pois nenhuma conta
tinha issuer nulo. O estado atual é compatível com esse relato. Entretanto,
o arquivo `drizzle/rollback/0010_to_0009_down.sql` contém:

```sql
UPDATE "accounts" SET "issuer" = NULL
WHERE "provider_id" = 'credential' AND "issuer" = 'local:credential';
```

A contagem somente leitura usando esse predicado retornou **4**.
Assim, o down não é no-op e não limita a reversão às linhas originalmente
alteradas pelo forward. O próprio script alerta que executá-lo com Better
Auth 1.7.x quebra o login.

**Antes de A4:** revisar o procedimento de rollback. Para voltar o artefato
da aplicação, validar sua compatibilidade com o schema aditivo já existente.
Uma reversão de dados exige reconciliação das linhas efetivamente alteradas
e da versão atendendo tráfego. Não executar esse down automaticamente.
As migrations e os scripts de rollback permaneceram byte a byte intactos.

### Backup e restauração

A API informou `history_retention_seconds=21600` (**6 horas**) e retornou
lista vazia de snapshots gerenciados. Isso não demonstra ausência de backup
externo; demonstra que esta sessão não obteve evidência de snapshot
gerenciado ou de restore produtivo.

A janela de histórico observada é menor que a vigilância A5 de 24–72h.
O gate §42 ainda precisa de evidência do mecanismo de backup/restore que
sustentará a janela de rollback. Nenhum snapshot ou restore foi criado.

## 5. Resíduos do relatório anterior

### Sonar de main

O check `101236398317` de `b1f9468` está `completed/neutral`, com título
**Quality Gate not computed**. O check do tip do PR #26 está
`success/Quality Gate passed`. Os dois resultados têm escopos diferentes.

A documentação oficial lista análise inicial sem segunda execução e
definição de New Code ausente como causas possíveis. Sem acesso ao painel,
a causa deste projeto é **UNVERIFIED**; não deve ser normalizada como
comportamento aprovado de toda análise automática.
[Referência oficial](https://docs.sonarsource.com/sonarqube-cloud/standards/quality-gates).

Próxima verificação autenticada: confirmar a branch principal configurada,
o histórico de análises e a definição de New Code. O total de “25 warnings”
permanece REPORTED pelo relatório anterior, sem recontagem atual.

### Playwright: a demora observada ocorreu no APT

No run `33938735859`, tentativa 1, o passo de instalação levou
**17m58s** antes do cancelamento. O log mostra downloads de dependências do
sistema em `azure.archive.ubuntu.com`: pausa após `libproxy1v5`,
`Ign:8` para `glib-networking-common` às 02:27:27Z e o próximo download
às 02:32:52Z. A evidência localiza a demora na etapa APT; não identifica
uma causa definitiva de rede.

Na tentativa 2, o mesmo passo passou em **52s**. O Playwright não recomenda
cache de binários por padrão e ressalta que as dependências de sistema no
Linux não são cobertas por esse cache.
[Referência oficial](https://playwright.dev/docs/ci#caching-browsers).

A avaliação não sustenta adicionar cache de browsers como correção desse
incidente. Uma eventual mudança de CI deve tornar `install-deps` observável
e limitar espera/retry, preservando a matriz de browsers. Nenhum workflow foi
alterado ou redisparado.

### ADR-025: decisão aceita; implementação pendente

O ADR registra **ACCEPTED**, Opção A, decisão do owner em 30/08, com HMAC,
TTL ≤ 60s, revogação/forgery, validação de escritas e membership no banco.
O gate de sequenciamento exige publicar antes as ondas PERF/FIN.

No código atual, `cookieCache.enabled=false` e os dois caminhos privados
do middleware usam `disableCookieCache=true`. O marker proposto não foi
encontrado nesses caminhos. A classificação correta é **decisão aceita /
implementação pendente**. Dados novos da versão 1.7.x não implementam o ADR.
Nenhum comportamento de autenticação foi alterado nesta rodada.

## 6. Pacote de entrada para A4, A5 e B3/B4

| Etapa             | Entrada e comprovação necessárias                                                                                                                          | Estado                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Preparação A4     | Login hPanel; domínio; Node ≥24.15.0; processo, porta, restart, timeout e logs conforme checklist existente; rollback revisado; backup/restore documentado | BLOCKED-AUTH e pendências técnicas acima |
| A4 deploy + smoke | Build do SHA de `main` revalidado; live/ready 200; login com conta antiga; senha errada rejeitada; logout/relogin; proteção sem sessão                     | NÃO EXECUTADO                            |
| A5                | Registrar `deployed_at` e `smoke_passed_at`; observar 24–72h reais; issuers, 401/429 e incidentes                                                          | NÃO INICIADO                             |
| B3                | Após A5, 1–2 semanas de `app.*` e KPIs §46 com ambiente, versão, amostra e cobertura temporal identificados                                                | NÃO INICIADO                             |
| B4                | Revisar janela, CI, regressões P0, isolamento tenant, unknown ≠ zero e erros financeiros críticos                                                          | BLOQUEADO                                |
| Fase C / S9 / F10 | B4 aprovado e sequência governada de memória; §43 antes de embeddings                                                                                      | BLOQUEADA                                |
| HNSW e itens §39  | Evidência dos gates específicos, incluindo §44                                                                                                             | BLOQUEADOS                               |

Para o processo web, usar as variáveis e a separação runtime/admin do
[runbook Hostinger](../../runbooks/hostinger-cloud-node.md).
Registrar configuração somente como presente/ausente ou validada/inválida;
nunca registrar valores de secrets. `DATABASE_ADMIN_URL` não pertence ao
processo web. A fixture E2E escreve no banco e não deve apontar à produção.

Smoke produtivo exige uma conta antiga controlada pelo operador e
evidência de comportamento de sessão. Não recuperar credenciais ou
persistir tokens/cookies para preencher a evidência.

Para B3, a instrumentação declara 20 métricas `app.*`; o closeout WS-07
lista 10 novas. A inicialização OTLP depende de
`OTEL_EXPORTER_OTLP_ENDPOINT`, e falhas de inicialização são degradáveis.
É necessário provar recebimento no coletor: código instrumentado não prova
que uma série foi coletada em produção.

Usar séries de duração de requests e banco, erros, timeouts, quotas, tools,
estados/versão financeira, snapshots, FSM e custos; acrescentar logs de
auth/429 e RUM para os indicadores que dependem dessas fontes. Registrar
denominadores e cobertura. Com amostra zero, marcar **não mensurável**, sem
inventar taxa de erro zero ou antes/depois.

## 7. Preservação e veredito

O checkout inicial tinha alterações não rastreadas preexistentes. Elas foram
preservadas. Não houve commit, push, merge, alteração de refs, deploy,
escrita no banco ou mudança de runtime/workflow/migration.

Write-set documental desta rodada: este diretório de evidências e um
acréscimo em `EXECUTION-STATE-PROGRAM.md`. O relatório de publicação e os
artefatos antigos permanecem como histórico; divergências foram registradas
nesta nova evidência.

**Veredito:** checagens independentes concluídas com pendências explícitas.
M-02 boundaries permanece FAIL; aprovação operacional de A4/B4 e veredito
de produção não foram emitidos.
