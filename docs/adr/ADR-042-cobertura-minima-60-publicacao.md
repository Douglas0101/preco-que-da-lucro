# ADR-042 — Cobertura mínima obrigatória de 60% e publicação verificada

- Status: ACEITA — decisão humana nesta sessão de 2026-10-06: “Reduzir o mínimo obrigatório para 60%”. Execução externa registrada separadamente.
- Data: 2026-10-06
- Escopo: política de cobertura e promoção develop → main; recuperação do serviço na Vercel.
- Substitui: limiar de 80%, congelamento condicionado a esse limiar e obrigatoriedade do espelho de ADR-037/ADR-038. Os demais contratos dessas decisões permanecem.

## Contexto

A produção da Vercel continua na revisão antiga de main, enquanto develop contém a atualização de segurança do TanStack e a correção da configuração do chat. O ruleset exige um espelho de cobertura que continua sem provenance suficiente e uma regra update impede qualquer merge. A decisão humana altera a política, sem declarar que a cobertura aumentou ou que o espelho se tornou verificável.

## Decisão

1. A condição obrigatória é **new_coverage >= 60%**. O CI mede a análise real do Compute Engine da revisão e superfície esperadas. Valor ausente, estado pendente, timeout, identidade divergente ou condição ignorada são NO-VERDICT e bloqueiam. Cobertura abaixo de 60% bloqueia.
2. O scanner submete o relatório com qualitygate.wait=false. O passo obrigatório gate-readout espera a conclusão do mesmo task por até 300 segundos, confirma analysisId, projeto, SHA, branch/PR e calcula a decisão ADR-042. A submissão do scanner isoladamente nunca aprova.
3. O relatório conserva status, condições e limiar originais do provedor. Se o preset Sonar way ainda exigir 80%, um ERROR exclusivamente de cobertura entre 60% e 80% pode coexistir com releasePolicy.status=OK. Esse resultado é uma decisão explícita de política; não é apresentado como Quality Gate verde do provedor.
4. Permanecem os controles observados de segurança, confiabilidade e manutenibilidade (rating A), duplicação new <=3% e revisão de hotspots de segurança =100%. Seus comparadores, limites, valores e veredictos são conferidos. Outras condições ERROR também bloqueiam. Nenhuma condição não relacionada a cobertura é dispensada.
5. Baseline e main-coverage-mirror conservam a observação original, inclusive ERROR e NO-VERDICT, e tornam-se informativos. Não projetam aprovação de main. O ruleset deixa de exigir o espelho e retira a regra update condicionada à política anterior, conservando PR, base atualizada, verify-release e scan + cobertura, proibição de exclusão/force push e bypass vazio.
6. Implementação integra develop após npm run check. A PR develop → main exige a matriz completa atual, banco/RLS e decisão ADR-042 da PR. Após o merge, o **CE real do novo SHA de main deve aprovar a política de 60% antes da publicação em produção**. Durante essa transição, a publicação automática da Vercel fica suspensa. Merge e publicação são ações distintas. Main retorna a develop por merge ordinário.
7. Este reparo operacional publica a revisão verificada na Vercel e valida sessão e chat reais. Hostinger, recuperação independente e dívidas sem relação com a mudança conservam sua qualificação própria. Credenciais permanecem sob entrada humana Via A; dados de production não são alvo de testes.

## CI Neon e isolamento

Uma cópia comum de production herdou uma conta real e o rollback de teste recusou apagá-la. O CI passa a criar uma raiz schema-only por PR, run e attempt, com prazo de 24 horas. Antes de preparar o fixture, confirma init_source=schema-only, criação nova, identidade não permanente, endpoint correspondente, prazo e inventário vazio. Toda tabela é bloqueada e verificada; registros, relações externas, grandes objetos ou inventário desconhecido abortam sem apagar dados. Somente schemas copiados e vazios são reconstruídos. As migrations aplicadas geram o ledger verdadeiro. Todas as 18 suítes, RLS, matriz Playwright e descarte always com GET 404 permanecem obrigatórios.

## Validação e consequências

Os negativos exercitam os dois lados de 60%, todos os controles preservados, métricas ausentes/contraditórias, CE tardio/pendente, origem e identidade. A preparação Neon recusa conta herdada e conexão permanente; prova local PG17 e execução remota são registradas no pacote de evidências. O limiar menor aumenta a quantidade de código que pode permanecer sem cobertura; o número observado continua visível e não é substituído por testes locais ou pela cobertura da PR.

## Rollback

Reverter por commits ordinários, restaurar o payload anterior do ruleset e suspender nova publicação. A reversão do deployment usa o identificador anterior observado; não envolve rollback de dados de production nem reescrita de histórico.

## Evidência

- Pedido e resposta humana desta sessão; docs/evidence/release-unblock-2026-10-06/.
- scripts/sonar/gate-readout.ts e src/test/sonar-gate-readout.test.ts.
- .github/workflows/sonar.yml e guardas de contrato de CI.
- scripts/ci/prepare-neon-fixture.ts e src/test/neon-fixture.test.ts.

---

## Emenda — implementação do fixture (2026-10-07): `init_source` parent-schema

O §CI Neon e isolamento exige uma raiz schema-only por PR, run e attempt. A implementação
(`scripts/ci/provision-neon-fixture.ts`) usava `init_source: "schema-only"`, que cria uma branch
**ROOT** sem linhagem. O provedor recusa essa criação no projeto `damp-forest-57346541`: papéis
SQL-created de _legacy web access_ (`app_runtime`) não comportam branches root schema-only — HTTP
412 observado nas runs `37556250921` e `37634147956` e no diagnóstico de console de 2026-10-07
(request `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`); a leitura read-only de 2026-10-07 confirma
somente as duas branches permanentes (`production` root/default, `develop` child) e nenhuma
operação de criação agendada para as tentativas recusadas. Evidência:
`docs/evidence/neon-parent-schema-2026-10-07/`.

**Substituto:** `init_source: "parent-schema"` — branch **CHILD** de pai explícito (`production`
para base `main`, `develop` nos demais), com o schema copiado **sem linhas herdadas**. A
substituição preserva todas as invariantes desta decisão: identidade verificada (pai explícito por
base, criação nova, não-permanente), endpoint correspondente, prazo de 24h, inventário vazio
(nenhuma linha, nenhum grande objeto, nenhum schema desconhecido), reconstrução apenas de schemas
copiados e vazios, migrations reais que geram o ledger verdadeiro, as 18 suítes, a sonda RLS, a
matriz Playwright e o descarte `always()` com GET 404. O `neon_auth` (schema gerenciado do Neon
Auth, presente na `develop`) aparece na cópia schema-only, é verificado vazio como os demais e é
reconstruído no fixture descartável.

Esta emenda é de **implementação**: não altera a decisão de cobertura mínima de 60%
(`new_coverage >= 60%`), nem qualquer condição de segurança, confiabilidade ou manutenibilidade
desta ADR. A aceitação do provedor só é demonstrável pelo CI corrente (run real) — limite
declarado no pacote de evidências; nenhuma prova remota é inferida localmente.

**ERRATA (2026-10-07):** a hipótese `parent-schema` desta emenda foi falsificada pelo run de CI
`37700582228` (HTTP 412, nenhuma branch criada) — o mecanismo final é o da **Emenda 2** abaixo.

---

## Emenda 2 — 2026-10-07: fixture por base vazia permanente (parent-data)

O mecanismo da emenda anterior (`init_source: "parent-schema"`, child de `production`/`develop`)
foi **falsificado pelo CI real**: o run `37700582228` (PR #60, head `f986fb05`) recusou o POST
`parent-schema` com HTTP 412 e **nenhuma branch foi criada** (artefato `neon-pr-provision.json`,
fase `creating`, `NO-VERDICT`, sem `branchId`). Combinado às recusas anteriores de `schema-only`
(runs `37556250921`/`37634147956` e request de console `bba50fbd-1e38-49d7-a52b-084e5b6e95ed`),
a limitação do provedor cobre **todas as cópias de schema** deste projeto, por causa dos papéis
SQL-created de _legacy web access_ (`app_runtime`, `anonymous`, `authenticated`).

**Decisão do dono:** autorizar uma base de fixture permanente e vazia — branch `ci-fixture-base`
(`br-wandering-sky-ayxm5e5s`), criada uma única vez como filha `parent-data` de `production`,
default false, sem expiração, e esvaziada uma única vez: BEFORE 15 tabelas populadas / 162 linhas
→ AFTER 0 / 0, 0 grandes objetos, com prova in-band `neon.branch_id`; evidência em
`docs/evidence/neon-fixture-base-2026-10-07/`. A base é fonte de fixture de zero linhas: **nunca**
canal de desenvolvimento, **nunca** alvo de teste e **nunca** descartável pelo cleanup (id
presente em todas as guardas/reportes de permanentes). Passa a ser a **terceira branch
permanente**, ao lado de `develop` e `production`.

**Mecanismo final:** cada PR cria um filho `init_source: "parent-data"` da base vazia (zero linhas
herdadas), com TTL de 24h no próprio POST e `branch_id` entregue ao cleanup antes de qualquer
espera por compute/URI; nenhum retry cai em cópia de dados. Todas as invariantes desta ADR
permanecem: identidade explícita (projeto, pai, nome, default, criação nova, não-permanente),
endpoint correspondente, inventário vazio verificado antes de reconstruir (schemas `app_private`,
`drizzle`, `neon_auth`, `pgrst`, `public` — todos presentes e vazios na base), schema diff vs
`production`, migrations reais gerando o ledger verdadeiro, as 18 suítes, a sonda RLS, a matriz
Playwright completa e o descarte `always()` com GET 404. O fechamento de `DBT-96` continua
exigindo essa execução real de CI com todos os estágios verdes.

Esta emenda é de **implementação**: não altera a decisão de cobertura mínima de 60%
(`new_coverage >= 60%`), nem qualquer condição de segurança, confiabilidade ou manutenibilidade
desta ADR. A aceitação do provedor permanece um limite declarado, demonstrável apenas pelo CI
corrente; nenhuma prova remota é inferida localmente.

---

## Emenda 2a — 2026-10-08: readiness do endpoint, drop-set migracional e refusal projetado

Refinamentos de implementação sobre a Emenda 2, após o run `37722430962` (PR #60, head
`2875382b`): o provisionamento e a identidade do filho `parent-data` passaram até
`connection-verified`, e a preparação da fixture recusou em seguida (exit 2 sanitizado) — a recusa
ocorreu 0,52 s após a construção do `Client`, tempo consistente apenas com falha em
`client.connect()` (inferência declarada; o caminho SQL exigiria ≥61 viagens de rede).

1. **Readiness inclui o endpoint.** O loop de espera do provisionador passa a exigir, além de
   `branch.current_state === "ready"`, o endpoint `read_write` correspondente com estado
   conectável (`active`/`idle` — o enum real é `init`/`active`/`idle`, sem `ready`; `idle` acorda ao
   conectar) sob os mesmos predicados de branch/projeto/tipo/disabled/host, antes de
   ler qualquer URI — um endpoint recém-criado pode seguir em `init` quando a branch já reporta
   `ready`.
2. **Drop-set migracional.** `resetEmptyFixture` deixa de derrubar **todos** os schemas
   descobertos: o drop passa a ser exatamente os schemas que a cadeia de migrations cria/rebuilda
   (`app_private`, `drizzle`, `public`). Os demais schemas da base — `neon_auth`, `pgrst` e o
   `auth` de owner `cloud_admin` (vazio; observado como sexto schema em 2026-10-08) —
   permanecem, verificados-vazios como todas as demais tabelas e devolvidos em `keptSchemas` — o
   `DROP` de schema gerido por `neondb_owner` era hazard latente de SQLSTATE `42501`, e a
   permanência também mantém o schema diff §12.5 limpo. Schema desconhecido continua fail-closed.
3. **Refusal projetado.** O catch do `prepare` deixa de ser mudo: projeta uma única linha
   sanitizada com `phase` (`identity`/`connect`/`prepare`/`persist`) e `code` (SQLSTATE/errno
   validado por `[0-9A-Z_]{5,12}`) e grava artefato de falha `neon-pr-fixture.json` (NO-VERDICT)
   quando inexistente — sem nunca expor mensagem, corpo do provedor ou credencial.

Nenhum invariante muda: inventário vazio verificado antes de qualquer SQL destrutivo, identidade
explícita, TTL 24h no POST, `branch_id` antes de compute/URI, migrations reais gerando o ledger,
as 18 suítes, a sonda RLS, a matriz Playwright e o cleanup `always()` com GET 404. A decisão de
cobertura mínima (60%) permanece intocada; a aceitação do provedor segue um limite declarado,
demonstrável apenas pelo CI corrente.
