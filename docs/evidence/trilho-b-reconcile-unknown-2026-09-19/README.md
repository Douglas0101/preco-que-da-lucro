# Selo — TRILHO B: reconciliação de uso de IA sem medição

WP `F-B-reconcile-unknown` do C3. Origem: risco declarado no land do `INV-006`
(variante B), âncora `§14.6` (OWASP API4) e P0-17.

## 1. Estado

| campo         | valor                                                         |
| ------------- | ------------------------------------------------------------- |
| branch        | `mission/b-reconcile-unknown`                                 |
| base          | `f06c6d8e3d9749e13b59277a98c32334ad4d2cf0`                    |
| worktree      | `/home/douglas-souza/preco-que-d-main/.worktree-b-reconcile`  |
| container     | `trk-b-pg` (`postgres:17-alpine`, `127.0.0.1:5434`) — efêmero |
| CI local      | `captures/trilho-b-bateria-final-3.log.txt` (728 linhas)      |
| CI origin     | **não executada** — o commit deste WP é local até o land      |
| `:5432` (H-9) | **0 listeners tocados** — medido no próprio log               |

### Vínculo commit ↔ selo, e o manifesto

O código deste WP é o commit **`b70541641eda0189eb7173e507f1ee1675fe9d38`**
(`fix(ai): reconcile usage-unknown events without inventing a measurement`),
com **9 arquivos**. Os hashes abaixo foram extraídos **do commit**, e não do
disco (`git show <sha>:<path> | sha256sum`), de modo que um clone pode
reproduzi-los:

| arquivo                                      | sha256                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                                  | `e210d0a36670b2f54e600a68e55b27e9179ba8269f7c6430ac0843b9429cf79f` |
| `package.json`                               | `97eed3b85525c59fee8a7bd0ab8fa5fc880a2200591e9ff0d7e93335c25841fa` |
| `src/instrumentation/telemetry.ts`           | `4e1aea1fa1b534acc88c083ab3796a70238547593298d0c65280bb47c47ee44b` |
| `src/lib/ai/budget-ledger.server.ts`         | `c167f2b9a72100a1c19849fd22040c89ce39e6ce35bd217a339f7d4a530da973` |
| `src/test/helpers/chat-execution-fakes.ts`   | `f3645cddf9cba98183e8ebfd22ba251ef10b563bdfbdfc4ae114e51f85ffa06a` |
| `scripts/db/reconcile-ai-usage.ts`           | `307962228587b57847e276e67e9f13c70482f09eca671c75d8f5c2f6c72b181d` |
| `scripts/db/release-unknown-reservations.ts` | `2d4510184e86700dc69260e70d4e11d358ee21e93f7c250e4d37f7872eb485bc` |
| `scripts/db/test-reconcile-ai-usage.ts`      | `d5fa1caca6a82967c7a6e959241a3ac7e862bd6498de54b10bf351d56252b149` |
| `docs/runbooks/reconcile-ai-usage.md`        | `28b07b1b29c5238f43a303c5175edb4d1102c7693773c9c3b5d0fbcf30a79e01` |

`MANIFEST.sha256` cobre os **16** arquivos do selo (9 logs + 5 geradores +
`README.md` + `SPEC.md`): **`checked === discovered`** e `sha256sum -c` **16/16**
rodado do root do repositório, que é onde o manifesto foi gerado. O roteiro mata
o próprio erro: `sha256sum -c` imprime `SUCESSO` em locale pt-BR, então o script
exporta `LC_ALL=C` antes de contar — um grep por `: OK` sobre a saída traduzida
teria dado 0 sucessos e ainda assim pareceria uma verificação.

## 2. O problema, medido

`settle` retém a reserva quando o gateway não informa consumo. Reter é o lado
seguro — liberar afirmaria consumo zero, que foi exatamente o que escondeu uso do
teto diário antes do `INV-006`.

O defeito que sobra é que **nada revisitava esses eventos**. Os predicados são
disjuntos:

- `sweepOrphansInTransaction` seleciona `status = 'reserved'`
  (`src/lib/ai/budget-ledger.server.ts`);
- um evento liquidado sem medição está em `status = 'settled'` +
  `outcome = 'usage_unknown'`.

Logo a reserva ficava retida indefinidamente e o teto diário do tenant encolhia
por um consumo que nunca foi medido — sem que nada no sistema dissesse isso.

## 3. A correção

`reconcileUnknownUsage(tenantId, { minAgeMs, batchSize, now })` no mesmo ledger:

1. seleciona candidatos com `status = 'settled'` **e** `outcome = 'usage_unknown'`
   **e** `settled_at < now() - minAgeMs`, ordenados do mais antigo, limitados por
   `batchSize`;
2. marca cada um como `reconciliation_failed` com **compare-and-set** por
   `usage_id` + `tenant_id` + `status` + `outcome` (INV-009): `returning` vazio
   significa que outro executor já tratou a linha e o replay é no-op;
3. emite `app.ai.reconciliation_total` e `app.ai.reconciliation_failed` por linha,
   o evento estruturado `ai.reconciliation_failed` com `reason:
"gateway_retrieval_unavailable"`, e o gauge
   `app.ai.reconciliation_oldest_age_ms`.

## 4. O que a correção deliberadamente **não** faz

Estas são escolhas, não omissões. Cada uma tem uma razão que se sustenta sozinha:

| não faz                      | por quê                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **não mede o consumo**       | o cliente fala `/v1/chat/completions` sem retrieval por id e `ai_usage` não guarda payload — re-consultar é estruturalmente impossível. Inventar um número seria o pior desfecho possível.             |
| **não libera a reserva**     | decisão humana registrada: devolver orçamento não pode ser efeito colateral de um cron.                                                                                                                |
| **não toca em `status`**     | o CHECK é restrito a `('reserved','settled','expired')`; `outcome` é `text` sem CHECK, então a distinção mora lá.                                                                                      |
| **não zera `real_tokens`**   | `NULL` é o registro honesto de que não houve medição.                                                                                                                                                  |
| **sai com exit 0 ao marcar** | marcar é o desfecho correto, não uma falha. O alarme é o evento estruturado `ai.reconciliation_failed` (as métricas estão inertes — D7); um cron vermelho permanente treinaria quem opera a ignorá-lo. |

A liberação existe, em comando separado (`db:release-unknown-reservations`):
**dry-run por padrão**, exige `--confirm`, exige `--usage-id` explícito (não há
liberação em massa) e só aplica sobre `outcome = 'reconciliation_failed'`.

O rótulo gravado na liberação é **`reservation_released`**, e não `reconciled`.
Nada foi reconciliado: `real_tokens` continua `NULL`. Gravar `reconciled`
afirmaria um fato falso — é uma deviation declarada da spec card aprovada.

## 5. Evidência

`captures/` — **9 logs** + `scripts/` com os 5 geradores que os produziram, todos versionáveis (ver §7):

| arquivo                              | o que prova                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `trilho-b-bateria-final.log.txt`     | S4 VERIFY pré-correções: 17 suítes `db:test` em PG17 **virgem** + `npm run check` completo                          |
| `bateria-1-reprovada.log.txt`        | a 1ª corrida, **reprovada** — preservada porque é o registro do defeito achado (ver §6)                             |
| `e2e-clis.log.txt`                   | ciclo ponta a ponta dos **dois CLIs** com linhas reais                                                              |
| `guardas.log.txt`                    | bateria de guardas, com exit code medido sem pipeline mascarando                                                    |
| `trilho-b-bateria-final-2.log.txt`   | a bateria autoritativa **na altura** (superada pela `-3`), pós D1–D6, com `OTEL_EXPORTER_OTLP_ENDPOINT` **ausente** |
| `correcoes-d1-d6-1a-corrida.log.txt` | a 1ª corrida do teste das correções — preservada: a sonda D4 **falhou no setup** e isso está visível                |
| `sonda-d4-controle-positivo.log.txt` | a sonda D4 **corrigida**: tenant órfão nomeado pelo `AVISO` e removido                                              |
| `d10-gauge-agregado.log.txt`         | o gauge publicado **uma única vez** com o **máximo agregado** — a regressão D10 fechada                             |
| `trilho-b-bateria-final-3.log.txt`   | **a bateria autoritativa final**, pós D8/D9/D10, com as provas estruturais dos três                                 |

`captures/scripts/*.sh.txt` — os cinco geradores (`zz-bateria-final-b2`, `zz-bateria-final-b3`, `zz-d10-proof`, `zz-verify-d1-d6`, `zz-seal-manifest-b`), preservados com sufixo `.txt` porque a extensão `.sh` seria processada pelo ESLint da stack. **`git check-ignore` confirma que nenhum dos 16 arquivos do selo é ignorado** — o trap que já custou duas vezes (§7).

**A bateria que vale é a `-3`.** A primeira foi rodada **antes** das correções
D1–D6; a `-2`, **depois** delas mas antes das correções D8/D9/D10 do veredicto
v3; a `-3`, sobre o estado final congelado. Todas ficam porque a diferença
entre elas é a evidência da correção.

Fatos da bateria final **-3** (728 linhas) — **`DBTEST_EXIT=0 CHECK_EXIT=0`**:

- `HEAD_SHA = f06c6d8…`; `postgres (PostgreSQL) 17.11`;
  `porta 5432 (H-9) tocada? -> 0 listener(es)`
- **prova estrutural D9 (single-flight):** `let shutdownPromise: Promise<void> | undefined;`
  na linha 208 e `shutdownPromise ??= sdk` na 221
- **prova estrutural D10:** `src/lib/ai/budget-ledger.server.ts` tem **0**
  ocorrências de `reportReconciliationOldestAge`; o CLI tem **1**, na linha 350
- **prova estrutural D8:** a frase falsa
  ``quando `OTEL_EXPORTER_OTLP_ENDPOINT` está definida`` tem **0** ocorrências
  em `docs/runbooks/reconcile-ai-usage.md`
- **`DBTEST_EXIT=0`** — **17 suítes**, 0 skipped; as duas provas do TRILHO A
  intactas (linhas 335/347) e os 6 casos do TRILHO B (linha 375)
- **`CHECK_EXIT=0`** — `Test Files 87 passed (87)` / `Tests 865 passed (865)`;
  bundle **473230** minified (inalterado)
- higiene de fixtures: `tenants_TRILHO-B=0`, `ai_usage_orfaos=0`

O que a **-3** acrescenta sobre a **-2**: ela é a única corrida em que as
três correções do veredicto v3 já estão no código **e** as provas estruturais
de D8/D9/D10 são impressas pelo próprio gerador, de modo que a bateria não
depende da minha leitura para confirmar que a correção está lá.

Fatos da bateria final **-2** (716 linhas):

- `postgres = postgres (PostgreSQL) 17.11`; `porta 5432 (H-9) tocada? -> 0 listener(es)`
- **`OTEL_EXPORTER_OTLP_ENDPOINT definida? -> <nao definida>`** — o job roda no
  contexto em que a telemetria OTLP **não** existe, que é o do cron. É aí que o D1 vivia.
- `DBTEST_EXIT=0` — **17 suítes**, 0 skipped
- `CHECK_EXIT=0` — `vitest run` com `Test Files 87 passed (87)` / `Tests 865 passed (865)`
- provas do TRILHO A reaparecem intactas nas linhas 323/335: `products-fk-conflict.test.ts … 13 passed (13), 0 skipped` e `product-contracts.test.ts … 14 passed (14), 0 skipped`
- os 6 casos do TRILHO B na linha 363: `prova de banco da reconciliação concluída (6 casos)`
- higiene de fixtures: `tenants_TRILHO-B=0`, `ai_usage_orfaos=0`

Com coletor inalcançável
(`OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:9/dead-collector`), o job sai
**`OTEL_DEAD_EXIT=0`** — telemetria é opt-in e nunca derruba o job. **Isto prova
robustez, não export:** é compatível com "o exporter nunca foi tentado" (§6.2, D7).
E a sonda D4
corrigida mostra o controle positivo: com um tenant sem owner/admin no banco, o
mesmo run que antes era silencioso agora imprime
`AVISO: 1 tenant(s) sem membro owner/admin — … 99999999-…`, e o órfão
corretamente **não** entra em `tenants=13`.

Fatos do e2e (o que a bateria **não** cobria — ela exercita o método do ledger, não o CLI):

```
estado_inicial: outcome=usage_unknown tokens_reserved=800 real_tokens=NULL
job --all-tenants  ->  tenants=14 candidatos=1 marcados=1 mais_antigo_ms=25203288  (JOB_EXIT=0)
apos_job:       outcome=reconciliation_failed status=settled tokens_reserved=800 real_tokens=NULL
replay do job   ->  candidatos=0 marcados=0
liberacao dry-run ->  [elegivel]  e tokens_reserved ainda = 800
liberacao --confirm ->  liberado: 800 tokens devolvidos  (RELEASE_EXIT=0)
final:          outcome=reservation_released tokens_reserved=0 real_tokens=NULL
replay da liberacao ->  [NÃO elegível — só reconciliation_failed é liberável]
```

Ou seja: o job **retém** a reserva, muda só o rótulo, e a devolução só acontece
por comando humano explícito e é idempotente.

Fatos das guardas — todas com `exit=1`:

- sem argumento (`nunca varre tenants por conta própria sem ordem explícita`),
  `--turbo`, `--batch-size 0`, `--batch-size 1001`, `--min-age-ms -1`
- liberação sem `--tenant`, sem `--usage-id` (`não existe liberação em massa`),
  tenant inexistente
- **guard de loopback**: os dois CLIs com
  `DATABASE_ADMIN_URL=postgresql://u:p@db.producao.example.com:5432/real` são
  recusados com `aponta para "db.producao.example.com", não para loopback`

## 6. O defeito achado durante a verificação

A primeira corrida da cadeia **reprovou** (`DBTEST_EXIT=1`), e o log foi
preservado em vez de descartado:

```
AssertionError: app.ai.reconciliation_total deve ser emitido por linha tratada — 0 !== 1
```

O log estruturado `ai.reconciliation_failed` **tinha** sido emitido, então a
emissão estava certa e o que falhava era a **interceptação no próprio teste**:
atribuir a `.add` de um instrumento OpenTelemetry não tem efeito — eles são
proxies. O bug era do teste, não do produto. A correção foi substituir o
instrumento inteiro no objeto `applicationMetrics`, que é um literal mutável.

Isso é relevante mais amplamente: um teste de métrica que intercepta `.add`
**passa em falso** — ele não falha, ele mede zero e "confirma" que nada foi
emitido. Foi uma asserção com dentes que expôs isso.

## 6.1. Veredicto adversarial — 16 claims, e os 6 defeitos que ele achou

Um verificador de contexto limpo (`deepseek-v4.1-flash`, leitura pura, sem shell)
foi instruído a **falsificar** as afirmações do trilho. Resultado: **12 CONFIRMED**,
**5 CORRECTED**, nenhum hazard da lista (falha engolida como sucesso, contador sem
CAS, desconhecido coagido a zero, duplo decremento na liberação, `in_flight`
tocado, corrida entre job e liberação) — e **6 defeitos**, dos quais um material.

> **O veredicto v3 (re-passe adversarial das correções) REJEITOU o D1** e achou
> mais três defeitos, um deles **regressão introduzida pela correção do D2**.
> A tabela abaixo fica como **registro do v2**; a célula _Correção_ do D1 está
> **superada** por `§6.2`, que é a fonte de verdade do estado atual.

| #      | Defeito                                                                                                                                                                                                                                                                                                                                                         | Correção                                                                                                                                                                                                                                                                                | Provado por                                                                                                                   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **D1** | **MEDIUM — as métricas do job nunca saíam do processo.** Sem `MeterProvider` registrado, os instrumentos de `@opentelemetry/api` são no-ops; e o `sdk` vivia numa closure **sem handle de shutdown exportado**, então um script curto nem esperava a inicialização nem dava flush. A frase do runbook "o alarme é a métrica" era **falsa no contexto do cron**. | `startTelemetry()` (aguardável) e `flushTelemetry()` (drena o exportador periódico e encerra) exportados de `telemetry.ts:273`/`:284` e chamados pelo job. Runbook reescrito: o alarme que sempre existe é o evento estruturado; a métrica exige `OTEL_EXPORTER_OTLP_ENDPOINT` no host. | `grep` confirma as duas chamadas; `OTEL_DEAD_EXIT=0` com coletor inalcançável (telemetria é opt-in e nunca derruba o job)     |
| **D2** | LOW — o gauge nunca limpava: depois de resolver um backlog, uma corrida sem candidatos seguia emitindo a idade antiga.                                                                                                                                                                                                                                          | `reportReconciliationOldestAge(result.oldestAgeMs ?? 0)` — uma varredura concluída **observou** o backlog; `null` é atraso zero, não "não medido".                                                                                                                                      | revisão da linha + re-passe adversarial (não há teste unitário: o valor vive em estado de módulo não exportado)               |
| **D3** | LOW — `Math.min` aparava `batchSize` acima do teto em silêncio na biblioteca, enquanto o CLI o recusava: dois contratos para a mesma opção.                                                                                                                                                                                                                     | o método agora **recusa** com `RangeError`; o CLI segue recusando.                                                                                                                                                                                                                      | caso 6 do teste ganhou o assert do teto — `FOCUSED_EXIT=0`                                                                    |
| **D4** | LOW — `listTenantIdentities` pulava tenants sem owner/admin **em silêncio**: `--all-tenants` podia deixar linha sem tratamento sem nenhum diagnóstico.                                                                                                                                                                                                          | a enumeração passou a fazer `left join` a partir de `tenants` e a devolver `skippedTenantIds`; o job emite `AVISO` nomeando-os **antes** do early-return.                                                                                                                               | controle **positivo**: tenant órfão inserido ⇒ `AVISO: 1 tenant(s) sem membro owner/admin …`, e ele não entra em `tenants=13` |
| **D5** | LOW (precisão) — o comentário do CLI afirmava que a identidade por tenant existia "para que o RLS continue sendo a fronteira". **Falso**: o CLI conecta por `DATABASE_ADMIN_URL` (superusuário), onde o RLS é ignorado.                                                                                                                                         | comentário corrigido: a contenção é o predicado `tenant_id` explícito + `assertIdentityTenant`.                                                                                                                                                                                         | leitura do código + `:214`                                                                                                    |
| **D6** | INFO — `oldestAgeMs` começava em 0 e um candidato de idade exatamente 0 emitiria 0 em vez de `null`.                                                                                                                                                                                                                                                            | **dissolvido pelo D2**: com `?? 0`, zero é o valor correto e informativo.                                                                                                                                                                                                               | —                                                                                                                             |

**As 5 claims CORRECTED** (afirmações minhas que o adversarial reescreveu, e que
passam a valer como as afirmações do selo): **C5** — a fronteira de isolamento é o
predicado explícito, **não** o RLS (que o harness superusuário contorna, exatamente
como a §7 declara); **C7** — 0/negativo recusado em todo lugar, mas oversized era
aparado na biblioteca (→ D3); **C10** — emite uma vez por linha que **ganhou o CAS**
(losers não emitem) e o gauge não limpava (→ D2); **C15** — os três entry points
guardam loopback, mas **os métodos da biblioteca não têm guard de host** (usam o
transaction manager injetado; hoje não há caller em `src/**` além de fakes de
teste); **C16** — 8 deviations da spec card, 6 sancionadas, e **2 materiais que
permanecem declaradas neste selo (§7 e §8)**.

### 6.2 Veredicto v3 — o D1 foi REJEITADO, e a correção do D2 introduziu o D10

O re-passe adversarial das correções (revisor independente de contexto limpo)
produziu quatro achados novos. Os quatro foram **verificados por leitura
independente minha**, linha a linha, antes de virarem entrada desta tabela.

| #       | Defeito                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Estado neste selo                                                                                                                        |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **D7**  | **HIGH, pré-existente e repo-wide — a instrumentação inteira da aplicação é noop.** `src/instrumentation/telemetry.ts:12` faz `const meter = metrics.getMeter(...)` no **module scope**; os instrumentos de `applicationMetrics` (`:117-118`, `:158`, `:162`) nascem daí, **antes** de qualquer provider existir. `@opentelemetry/api` 1.9.1 devolve `NOOP_METER` (`NoopMeter.js:99`; `add()` vazio em `:70`, `addCallback()` em `:86`) e **não tem proxy de métrica** — o único proxy da API é o de trace. `sdk.start()` (`:251-253`) registra o provider **tarde** (`sdk.js:192`), e instrumento já entregue não é re-vinculado. Com instrumentos noop o `PeriodicExportingMetricReader` retorna em `:115` (`scopeMetrics.length === 0`) **sem invocar o exporter**. Atinge **102 usos** de `applicationMetrics` em `src/` e `scripts/`, 20+ arquivos (financeiro, dashboard, pricing, chat). | **NÃO corrigido aqui — WP próprio `F-otel-provider-order`**, com ADR obrigatório (é mudança arquitetural).                               |
| **D8**  | LOW — quatro afirmações **falsas** sobre exportação de métrica, escritas por mim: no `docs/runbooks/reconcile-ai-usage.md`, no comentário do `AVISO` do CLI, no doc-comment de `startTelemetry` e no comentário do caso 6 do teste (que afirmava "os instrumentos são proxies" — o modelo mental errado que fez o D1 _parecer_ corrigido).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **CORRIGIDO** — as quatro passaram a dizer que o alarme que existe é o evento estruturado.                                               |
| **D9**  | LOW — `shutdownActiveSdk` não existia: handlers de sinal e `flushTelemetry` chamavam `sdk.shutdown()` **em paralelo**, e o segundo recebia o retorno antecipado do SDK em vez de aguardar o dreno em andamento — a promessa "drenou antes de sair" deixava de valer justamente quando um sinal vencia a corrida.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **CORRIGIDO** — single-flight (`shutdownPromise ??=`) compartilhado pelos dois caminhos.                                                 |
| **D10** | LOW — **regressão minha**: o `?? 0` da correção do D2 zerava o gauge. Como ele é escrito **uma vez por tenant** e é last-write-wins, um tenant posterior sem candidatos **apagava** a idade de backlog de um tenant anterior. Antes da minha correção isso não acontecia; a zeragem foi introduzida por mim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **CORRIGIDO** — publicação única no fim, com o máximo agregado, e só com cobertura completa (tenant sem owner/admin é backlog ilegível). |

**O que o D7 significa para este selo, sem eufemismo:** o `OTEL_DEAD_EXIT=0`
que eu apresentei como prova do D1 é compatível com "o exporter nunca foi
**tentado**" — ele prova que um coletor inalcançável não derruba o job, **não**
que algo foi exportado. **A correção do D1 não fechou o D1: ela fez o D1 parecer
fechado**, com a garantia falsa escrita em runbook, README e comentários de
código. Um controle fantasma _documentado_ é pior que um controle ausente,
porque resiste à detecção.

O alarme que este trilho realmente entrega é o **evento estruturado
`ai.reconciliation_failed`**, uma linha de log por evento tratado — esse é medido
e funciona. As métricas ficam declaradas como **inertes** até o `F-otel-provider-order`.

O contrato violado já estava escrito no próprio repositório, em
`src/test/helpers/otel-metrics.ts:3-11`: _"Sem provider, `@opentelemetry/api`
devolve o mesmo histograma noop para todos os nomes"_ e _"Este módulo deve ser o
PRIMEIRO import de quem depende dele."_

## 7. Lacuna declarada — o que este selo **não** prova

**O teste roda como superusuário `postgres`, que ignora RLS.** O isolamento por
tenant provado aqui é o predicado `tenant_id` explícito em cada query mais a
recusa de identidade alheia na camada de aplicação (`assertIdentityTenant`, com
controle negativo `assert.rejects(/tenant/i)`). **Não** está provado que o RLS
barraria um erro se o predicado faltasse. É cobertura indireta, e fica declarada
como tal em vez de implícita.

**Nenhuma métrica deste WP é provada como exportada.** O veredicto adversarial v3
mostrou que os instrumentos nascem noop no import e que registrar o provider
depois **não** os re-vincula (§6.2, D7). O selo prova o **evento estruturado**
(`ai.reconciliation_failed`, uma linha por evento) e prova que o código **chama**
`reportReconciliationOldestAge` uma única vez com o máximo agregado (§5, prova
estrutural). **Não** prova que um data point chegou a um coletor — nenhuma
corrida deste selo teve um receiver OTLP real. Ler o código não substitui ver o
byte sair, e é por isso que o WP `F-otel-provider-order` exige um teste ponta a
ponta com coletor real.

Convenção do selo: `captures/` + `*.log.txt`, de propósito. O TRILHO A mostrou
que `docs/evidence/**/raw/` (`.gitignore:107`) e `*.log` (`.gitignore:3`) tornam
o manifesto verdadeiro localmente e **inverificável em clone**. Medido neste
selo: `git check-ignore` não engole nenhum dos **16** arquivos (9 logs + 5
geradores + README + SPEC + `MANIFEST.sha256`).

## 8. Riscos e follow-ups

- **O job marca `failed` e nunca mede.** Enquanto o gateway não oferecer
  retrieval por uso, todo evento sem medição termina em `reconciliation_failed`.
  A decisão de liberar continua manual — se o volume crescer, isso vira trabalho
  humano recorrente. Um modo de liberação automática exigiria uma decisão humana
  nova, e não está implementado.
- **O alarme é o log, não a métrica.** O evento estruturado
  `ai.reconciliation_failed` é emitido uma linha por evento tratado e funciona.
  As métricas `app.ai.reconciliation_*` **não** servem de alarme hoje: os
  instrumentos nascem noop (D7, §6.2). Se ninguém alertar em cima do log, a
  reserva retida volta a ser invisível — só que agora pelo menos está
  _registrada_ como tal.
- **Não há verificação de que o cron está de pé.** O runbook documenta a linha,
  mas nada observa a ausência de execuções.

## 9. Decisões de desenho

- A liberação mora no **mesmo** `budget-ledger.server.ts` — uma implementação,
  duas entradas, e a perigosa atrás de `--confirm`. Duas implementações de
  aritmética de reserva é como se cria divergência de contador.
- `assertPositiveInteger("batchSize", …)` recusa lote 0 porque um lote vazio que
  "termina com sucesso" é o mesmo fail-open silencioso que o TRILHO A fechou.
- Script `tsx` em vez de vitest gated: um vitest gated por loopback **pularia em
  silêncio** na CI (o antipadrão que originou o `F-D2-runner-failopen`); aqui a
  ausência de URL falha alto.
