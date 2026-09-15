# EXECUÇÃO ONDAS 3 e 4 — painel de supervisão (2026-09-14)

**Plano:** `docs/evidence/plan-partials-2026-09-13/PLANO-ONDAS-3-4.md` (propriedade de arquivo por operador; ordem `18.5 → 18.1 → 18.3 → 20.5 → 20.1` na Onda 3, e Onda 4 disjunta correndo em paralelo).
**Método:** WIP 3 · worktree+branch por operador · integração `--no-ff` com manifests e **marcador parent-pinned por commit** · verificador adversarial por integração · token DB · sem push.
**Partida reconferida por recon direto:** F0-04 e AUTH-005 A+B já fechados nas ondas 0/1 (não re-executados).

## 1. Integrações

| Int.  | Item                                      | Operador | Commits                         | Merge               | V        | Gates do supervisor                                                                                                                                                          |
| ----- | ----------------------------------------- | -------- | ------------------------------- | ------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-O24 | §12.5 schema diff + §12.4 parent/política | O24      | `84b576f`                       | `6132325`           | pendente | secrets-audit `failures=[]` · YAML parse OK · m02-v2b 9/9 · ui-stack/boundaries/matriz limpos · lockfile ok · format 0                                                       |
| I-O19 | 18.5 skeletons nas 4 rotas                | O19      | `d158f71`                       | `4af18ec`           | pendente | 16 testes (3 arquivos) · **build exit 0** · typecheck/eslint/prettier/ui-stack/matriz/boundaries limpos                                                                      |
| I-O20 | 20.5 rate limits (chat/tool)              | O20      | `2951e4a`                       | `ca38937`+`46812f6` | pendente | 23 testes · **burst reproduzido pelo S: chat 20/5 e tool 40/10 (2 instâncias)** · typecheck/eslint/format/matriz limpos                                                      |
| I-O23 | 20.1 canal de coleta CSP                  | O23      | `52311a6`, `9b6c84f`            | `e335935`           | pendente | 16 testes novos (**594 no total**) · **build exit 0** · tsc/eslint/prettier/ui-stack/boundaries limpos · matriz regen                                                        |
| I-O21 | 18.1 estado `estimated`                   | O21      | `50de38c`                       | `a609bfc`           | pendente | 16 testes (3 arquivos) · tsc/eslint limpos · **conflito `AA` de evidência resolvido preservando os dois relatórios**                                                         |
| I-O25 | §13.7 PITR + §12.6 spending               | O25      | `717426a`                       | `f47318a`           | pendente | **34 testes** · secrets-audit `failures=[]`/`literals=[]` · skip real exercitado · YAML/lockfile/matriz/format limpos                                                        |
| I-O22 | 18.3 explain calculation                  | O22      | `ac58b83`, `95625f5`            | `2049d7b`           | pendente | **12 testes** + **189 em 10 arquivos** · tsc/eslint/prettier/matriz limpos                                                                                                   |
| I-O26 | §13.6 preparação de cutover               | O26      | `d3757d3`, `74b707c`, `7504909` | `999556e`           | pendente | preflight exit 1 **correto** (bloqueios reais) · probes canônicos com **par de controle 401/403** · tsc/eslint/format OK                                                     |
| I-O27 | **F2C-1** safe-record sistêmico           | O27      | `1221000`                       | pendente            | pendente | **31 testes** (2 arquivos) · 11 sítios migrados com **red-first por sítio** · `client.server.ts` delega com aridade byte-idêntica · tsc/eslint/format/matriz/lockfile limpos |

## 2. Detalhe por integração

### I-O27 — F2C-1: um único helper de safe-record para os 11 sítios

**Entrega:** `src/instrumentation/safe-record.ts` (novo, 28 linhas) + 11 sítios migrados + `src/test/safe-record.test.ts` (588 linhas, 20 testes) + `tool-runner-fakes.ts` extraído mecanicamente. `client.server.ts` passou a **delegar** aos helpers que já existiam.

**O detalhe que faz a solução ser limpa:** os argumentos são encaminhados por **rest tuple**, então `recordSafely(m, 7)` chama `m.record(7)` com **um** argumento — nunca `record(7, undefined)`. A **aridade fica byte-idêntica sem nenhum condicional**, o que é exatamente o que se quer de uma mudança cujo risco é alterar a série emitida.

**Local escolhido com justificativa:** `src/instrumentation/` e **não** o `src/lib/observability/**` tentativo do meu briefing. O operador seguiu a convenção do repo — é ali que vivem `telemetry.ts`, `http-request-span.ts` e `sql-redactor.ts`, e onde mora a regra documentada _"observabilidade nunca quebra o caminho da request"_ (`telemetry.ts:44-57`). Desvio declarado, e o critério mais correto que o meu.

**Os 11 sítios, com falha vermelha CAPTURADA em cada um** (produção revertida para `HEAD`: `Tests 12 failed | 8 passed (20)` → pós-fix `20 passed`). Os três de maior valor:

| #   | sítio                                                            | por que importa                                                                                                                            |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `chat.functions.ts` — `runModelAttempt`, **dentro do `finally`** | a **mesma classe de mascaramento** do defeito original: o `metric boom` substituía a resposta do gateway                                   |
| 2   | `start.ts` — `handleResponseError`                               | um record que lance **no tratamento de erro** substitui o próprio erro sendo reportado (`expected Error: metric boom to be Response{503}`) |
| 3   | `start.ts` — `handleUnexpectedError`                             | o 500 **nunca era devolvido** quando o record lançava                                                                                      |

Mais os 3 do §29 em `chat-execution.server.ts` (incluindo o `acknowledgeGatewayResponse` e os dois histogramas de fase), 1 em `dashboard.service.ts` e os 3 de `tool-runner.ts` (incluindo um em que a execução **já persistida** virava falha).

**`client.server.ts` delega, com byte-identidade medida:** stub que **só captura** + `toStrictEqual` — que **distingue aridade**, portanto prova mais que uma comparação frouxa — rodado **nos dois estados** (verde antes e depois da delegação). Assim o repo fica com **um idioma só**, em vez de dois helpers locais mais um compartilhado.

**Gates:** 31 testes (2 arquivos), typecheck/eslint/prettier/matriz/lockfile limpos.

### I-O26 — §13.6 preparação do cutover (preflight executável + probes canônicos)

**Entrega:** `scripts/m02-auth-preflight.ts` e `scripts/m02-canonical-probe.ts` (novos), uma função **aditiva** em `auth-policy.ts` (`describeAuthEnv`) para o preflight **reusar** a política em vez de duplicá-la, §2.1 do runbook com o **R3 detalhado**, e `docs/evidence/cutover-prep-2026-09-14/` com raws + templates de assinatura.

**Preflight por NOME/ESTADO, com prova de que não imprime valores (o ponto mais importante).** Quatro casos rodaram com **valores-sentinela** (incluindo uma URL carregando usuário e senha); `grep -ci sentinel` deu **0** em todas as saídas. Só `presence` e mensagens derivadas da política entram no output — até `NODE_ENV` é reduzido a um booleano. O exit `0/1/2` bloqueia em `invalid`/`incomplete` (a instância de auth lança na construção → 500 em toda request de auth) e em `missing` para `required`/`required-in-production`.

**Probes canônicos EXECUTADOS localmente** (artefato Nitro node-server, DB local): `live` ×3 **PASS**, `ready` ×3 **PASS** (`postgres ok`), `get-session` **PASS** 200 `null`, e — o que o plano exigia — o **par de controle de origem**: origem positiva → 401 `INVALID_EMAIL_OR_PASSWORD`, **origem negativa → 403 `INVALID_ORIGIN`**, repetido com cookie; sem header `Origin` → 403 `MISSING_OR_NULL_ORIGIN`. Ou seja: **não** se mediu a troca de auth pelo `get-session` isolado (o probe fraco que o plano proíbe) — mediu-se o **conjunto** com controle negativo, e o veredito imprime que a troca **não está carimbada**, coerente com H-6.

**Comportamento exemplar em caso-limite:** 429 (bucket 5/min por IP) → **INCONCLUSIVO, exit 2** — nunca PASS nem FAIL. Alvo inalcançável → idem, com um commit próprio (`7504909`) porque o primeiro tratamento classificava errado. Latências rotuladas como **local/controlado**, nunca produção.

**Defeito real achado pelo hook em código NOVO e corrigido:** `scripts/m02-canonical-probe.ts` fazia `new URL(baseUrl)` **sem try/catch** — um `--base-url` malformado lançava `TypeError` em vez de dar erro de uso, o que derrota o propósito de um preflight que existe para **classificar**. Como o `auth-policy.ts` **já** tinha o idioma certo (try/catch em volta do `new URL`), espelhei-o: agora um valor malformado produz `usageError` (exit 2). **Prova:** valor malformado → mensagem limpa + exit 2; e uma URL válida segue funcionando.

**Manifest do supervisor:** aliases `m02:auth-preflight` e `m02:canonical-probe` (o operador não pode tocar `package.json`).

**Residuais declarados:** host canônico / SSL / DNS pós-associação e a asserção de host de e-mail exigem **D-0/H-5/H-6** e `RESEND_*` real; preview Vercel exige H-2; `smoke:substrate`/`m02:readiness` são gates do supervisor.

### I-O22 — §18.3 explain calculation (paridade amarrada ao motor)

**Entrega:** `src/lib/calc-explanation.ts` (novo) + slot `explain` no `MetricCard` para os **4 KPIs** de `/inicio` e o card de melhor margem, mais um explainer _"Como calculamos?"_ no resultado da simulação. `CalcExplainer` foi **reusado**, e `finance.ts` ficou **intocado** (somente leitura). 12 testes.

**A trava que define o item — paridade de fórmula — foi resolvida com QUATRO bindings, não com prosa:** produção **nunca** re-deriva aritmética (`scenarioExplanation(echo)` só lê o eco do motor) e cada passo declara o `field` que explica. Os quatro testes em `describe("paridade com o motor")` cobrem: (1) os **próprios helpers exportados** do motor aplicados às mesmas entradas igualam o eco (deriva de composição); (2) uma **transcrição independente em `Decimal`** de cada string de fórmula declarada iguala o eco **passo a passo** (deriva aritmética — ex.: a receita deixar de ser `price × volume`); (3) o valor **exibido** tem de igualar `brl/pct` do campo do eco; (4) **trava de cobertura de campos** sobre todas as chaves do eco do BFF, com `NOT_EXPLAINED_HERE` declarando os motivos. Mais um teste **anti-cópia entre telas** (a constante de margem de contribuição é a mesma string do passo fixado e do que o card de `/inicio` renderiza).

**Falsificação executada:** um número escrito à mão (`brl(202)`) falha com `expected 'R$ 202,00' to be 'R$ 200,00'`; trocar o campo explicado por outro falha com `campo do motor sem explicação declarada: totalContribution`; a fonte foi restaurada e conferida **byte a byte** com `diff` (`RESTORED_OK`).

**Origem `forecast` descrita corretamente:** _"projeção de volume informada por você — **não é previsão estatística**: o motor não usa série histórica nem modelo. A matemática é a mesma da simulação manual; muda apenas a origem declarada do volume."_ — coerente com o que o §18.1 estabeleceu (mesma matemática), e o teste de rota assere exatamente isso.

**Residual honesto:** a **prosa** da explicação é linguagem natural e não é lida por máquina; a prova automática cobre valor=eco, aritmética transcrita=motor e cobertura de campos, mas uma troca **só de prosa** depende de revisão. E o toggle nativo `<summary>` (Enter/Espaço) **não** é exercitado porque o jsdom não tem camada de teclado para ele — o teste cobre alcançabilidade por Tab, retenção de foco e o caminho de ativação; o comportamento em browser real fica declarado como não verificado.

### I-O25 — §13.7 (PITR) + §12.6 (spending guardrails)

**Entrega:** `scripts/m02-pitr-check.mjs` + `scripts/m02-neon-spend.mjs` (com `.d.mts`), duas operações novas no workflow manual `neon-drill-ops.yml` (`pitr-status`, `spend-status`), memo v3 e o artefato de evidência de spending.

**Classificação de proveniência por campo — o padrão de honestidade que eu quero propagar.** Cada shape de endpoint é rotulado: `[LOCAL-VERIFICADO]` (vindo dos próprios workflows do repo), `[INFERÊNCIA]`, `[DOC-FIRST-ORQUESTRADOR]`, e há uma lista explícita de **`TO-CONFIRM`** (envelope de resposta, envelope do corpo do PATCH, comportamento ao exceder o teto do plano, sincronicidade, escopo da janela). **Nenhum nome de parâmetro é afirmado sem rótulo.**

**Fail-closed em vez de presumir envelope:** o leitor aceita **as duas** formas e devolve `DESCONHECIDO` (exit 2) em vez de adivinhar a shape — ressalva típica de integração virou comportamento defensivo.

**O skip se declara, e essa é a frase certa:** sem `NEON_API_KEY`, os dois scripts imprimem `"result":"SKIP","live_call":false` com o texto _"NENHUMA chamada live foi feita: a janela de PITR NÃO foi medida. **Skip não é evidência de conformidade (tampouco de violação).**"_ — e o `spend-status` carrega no **próprio output** a caveat de que o alerta é **somente e-mail e NÃO suspende compute**: _"não é guardrail forte (não contém pico de custo); não descrever como teto de gasto"_.

**Provas executadas:** os step scripts foram **extraídos do YAML** e rodados com bash; o caminho **live** foi exercitado contra um **mock local** (`127.0.0.1`, sem rede externa) → `pitr-status` exit 1 (`FAIL`, 21600 s < 604800 s) e `spend-status` exit 0 (`OK`, 2 branches, `hostnames=[…neon.tech]`), com o log do mock mostrando **apenas GET** (nenhum PATCH/PUT). **34 testes unitários**, com a regressão que mais importa para estas scripts: um payload carregando `postgresql://app:<secret>@<host>/db` produz **apenas `<host>`**, com o segredo **ausente** do relatório serializado.

**Decisão do supervisor — recusei corrigir 32 `[line-length]` no workflow, com argumento.** A proveniência é: **23 linhas longas são pré-existentes** e **9 são novas do O25**. Pela política "código novo → corrigir" eu encurtaria as 9 — mas o O25 **verificou os bytes exatos** dos step scripts extraindo-os do YAML e executando-os com bash contra o mock. **Re-quebrar essas linhas invalidaria aquela verificação** para os bytes que eu integro, e eu **não tenho como substituí-la** (sem `NEON_API_KEY`, sem runner do GitHub). Editar um workflow não executável por cosmética, destruindo a única verificação existente, é a troca errada — o mesmo critério que apliquei ao não tocar em código já verificado no caso do V15. As 9 linhas ficam como follow-up com o motivo e a condição de correção (junto com uma re-verificação por extração).

**Residuais declarados:** chamadas live **não verificadas** (shapes de GET/PATCH TO-CONFIRM); dependências de **H-4** (`spending_limit` e consumption v2 exigem plano pago **e** chave com escopo org/billing, cujo escopo atual é não verificado) e do PITR ≥ 7 d; nomes de campo por branch (`compute_time_seconds`, `active_time_seconds`, `written_data_bytes`, `data_transfer_bytes`) **TO-CONFIRM**; **nenhum drill de PITR foi executado** (sem chave, sem projeto descartável — e o drill é ação humana pós-H-4), então nada aqui é evidência de drill; e a nota do runbook de que **PITR é destrutivo na branch raiz** (último recurso, com aprovação) ainda falta.

### I-O21 — §18.1 estado `estimated` / origem de volume `forecast`

**Entrega:** seletor de origem do volume em `simulacoes.tsx` com grupo acessível (`role="group"` + radios), badge `SIMULAÇÃO`↔`ESTIMATIVA`, título do card, rótulo do campo (`Vendas simuladas`/`Vendas estimadas`) e uma linha **Origem do volume** no resultado que lê o **eco do motor** (`simulated.value.volumeSource`), não o formulário. 269 linhas de teste novo (7 casos) + 2 literais de formulário ajustados em `simulation-race.test.tsx` (o builder deixou de aceitar formulário sem origem declarada).

**A UI não promete o que o servidor recusa (a trava de honestidade do item):** o botão de salvar fica `disabled` quando a origem não é persistível, com `aria-describedby` apontando para uma nota **sempre presente** em região `aria-live="polite"`: _"Salvar está indisponível para estimativas: a persistência aceita apenas a origem «simulação manual» — guardar projeções está previsto para a v2. O cálculo acima continua válido e nada é convertido em simulação manual em segundo plano."_ A dica da própria opção já avisa antes do resultado existir (_"Não é persistida nesta versão"_), e **não há fallback silencioso**: `buildSimulationInput` repassa `form.volumeSource`.

**`forecast` COMPUTA? — sim, com evidência (era a pergunta que eu exigi responder):** `VOLUME_SOURCES` em `finance.ts` inclui `forecast`; `calculateScenario` só rejeita `unknown` com volume numérico; `runFinancialSimulation` só rejeita `real`; o schema de params aceita a origem. O teste unitário roda as duas origens e mostra `status: "ok"` nos dois casos, com os resultados **deep-equal ao remover só o `volumeSource`** — ou seja, a **matemática é idêntica** e só a origem declarada muda. Consequência declarada: **não existe previsão estatística** e nenhum texto da UI sugere que exista. O teste de componente dirige o caminho real (`financialSimulationQueryOptions` → `runSimulation` → motor, com mock só na fronteira HTTP) e assere o resultado renderizado com `Estimativa informada (projeção)`.

**A recusa é do serviço, não do banco:** o CHECK de `scenario_type` **já** aceita `forecast`; a guarda que recusa a persistência é a do `simulation.service.ts` — que ficou **intacta**, e o teste pré-existente de rejeição continua passando. Ou seja: a UI respeita a guarda em vez de contorná-la.

**Prova de falsificação (vermelho→verde):** restaurando o literal fixo antigo, **3 dos 7** testes novos falham (capturado em `falsification.txt`).

**COLISÃO DE EVIDÊNCIA — erro de planejamento do supervisor, resolvido preservando os dois lados.** O único arquivo em conflito (`AA`) foi `docs/evidence/ux-financeira-2026-09-14/report.md`, porque dei a **O19 (18.5) e O21 (18.1) o mesmo diretório de evidência** sem nomes distintos — cada um escreveu o seu `report.md`. A resolução **não** descartou nenhum lado: o de 18.5 virou `report-18.5-skeletons.md` (160 linhas), o de 18.1 virou `report-18.1-volume-origin.md` (113 linhas), e `report.md` passou a ser um **índice** que aponta os dois e carrega os **fatos transversais** (a deriva de performance que atinge a rota de controle, e o contrato de não-persistência do forecast). O `PLANO-ONDAS-3-4.md` foi corrigido para que as fatias seguintes recebam **caminhos de evidência únicos por operador**, não apenas diretórios. Lição: **propriedade de arquivo inclui o caminho do artefato de evidência**, não só o do código.

**Gates do S:** 16 testes (3 arquivos), typecheck/eslint/format limpos, matriz determinística.

**Residuais declarados pelo operador:** sem Playwright em browser real (a prova de teclado é jsdom/`user-event`, então o comportamento de seta/leitura de tela **não** está verificado); `e2e/ui-stack.spec.ts` é arquivo de O23, então o toggle ficou como teste de componente por desenho; o caminho de toast de salvamento rejeitado é inalcançável por construção (botão desabilitado) e segue coberto no serviço; **persistência de forecast é v2 e NÃO foi entregue**.

### I-O23 — §20.1 canal de coleta de violações CSP

**Entrega:** `src/routes/api/csp-report.ts` + `src/lib/csp-report-payload.ts` (media types, cap de bytes, normalização das **duas** formas, limite por request); `security-headers.ts` ganha `report-uri`/`report-to` + o header `reporting-endpoints`; 16 testes novos (13+3); assert do e2e reescrito; `routeTree.gen.ts` regenerado; matriz regenerada (`apiRoutes: 4→5`).

**A prova que importava — nenhuma diretiva de origem mudou (byte-level).** Removendo as duas diretivas de report das strings antes/depois, o `diff` é **vazio**: as **10 diretivas de origem** são idênticas, e o modo enforce carrega a mesma política (só muda _qual_ header é usado). Sem `'unsafe-inline'`, sem host novo, sem nonce — exatamente a trava do `AGENTS.md`. `src/test/security-headers.test.ts` congela a lista de diretivas e assere que `CSP_ENFORCE` é o **único** caminho de enforcement (rollback por env).

**Contrato do endpoint:** `application/csp-report` → 204 + `csp.violation`; `application/reports+json` → 204 por violação (outros `type`s ignorados); media type desconhecido → **415**; corpo >8 KiB → **413** (corpo **não** lido); JSON malformado → 400; >10 violações → 204 + `csp.violation_truncated`; **nunca 500**; tudo com `cache-control: no-store`.

**Raciocínio de e2e que vale registrar:** além de manter `script-src 'self'` e `nosniff`, ele assere que `content-security-policy` deve estar **`undefined`** (a chave de rollback) **e** criou um teste que **posta um report no caminho publicado exigindo 204** — porque _"um `report-uri` apontando para um 404 anularia silenciosamente o gate de zero violações"_. Ou seja: ele testou o canal, não só o header.

**Declarado como NÃO VERIFICADO (não fingido):** soak 3× report-only ❌ · enforce no **preview** ❌ · produção/H-2 ❌ · as duas asserções de e2e ❌ (exigem build+preview+browsers) · comportamento real de browser de uma URL **relativa** em `Reporting-Endpoints` ❌ · relatórios duplicados se o Chromium honrar os dois canais (ruído de log, declarado).

**Colisão de matriz prevista e resolvida como ele recomendou:** o operador avisou que, se O20 também regenerasse a matriz, o correto seria **re-rodar o gerador** no tree integrado, não fazer merge manual de um arquivo gerado. Foi exatamente o que aconteceu (O20 mexeu em `transactionSites`, O23 em `apiRoutes`), e foi o que fiz — resultado: `apiRoutes=5` **e** `transactionSites=100` coexistem, com o check determinístico verde.

### I-O20 — §20.5 rate limits atômicos para chat e tool

**Entrega:** `consumeRateLimitInTransaction` extraído em `rate-limit-storage.server.ts` (o `consume` de auth vira wrapper fino, com **mesmo SQL e mesmo `now`** — semântica de auth preservada); `USER_RATE_LIMIT_RULES` + `userRateLimitKey`; regra **chat `{600, 20}`** chave `chat|<userId>` consumida como **primeira** instrução de `reserveChatAndLoadHistory`; regra **tool `{600, 40}`** chave `tool|<userId>` em `runRegisteredTool` **após** Zod+AuthZ e **antes** do claim de idempotência; exports documentados como **N/A** com condição de reabertura.

**Um único limitador (o requisito que mais importava):** o limitador por contagem (`countRecentUserMessages` + `CHAT_LIMIT_WINDOW_MS`) **deixou de ser o caminho de chat** — `CHAT_LIMIT_WINDOW_MS` tem **zero** ocorrências — e `AI_CHAT_LIMIT_PER_10_MINUTES` passou a ser o **max** da regra com a janela vindo do módulo de regras. Não restaram dois limitadores concorrentes.

**Divergência ADR-021 × SDD:** o default implementado (20/600 s) foi tratado como fonte de verdade e o **SDD foi alinhado** (linha de chat → "20 turnos por 10 min/usuário"; linha de tools ganha "40 execuções por 10 min/usuário"). **Nenhum limite numérico foi alterado** para acomodar texto obsoleto — exatamente como o briefing exigia.

**Prova de atomicidade — REPRODUZIDA PELO SUPERVISOR, não aceita do relato.** Rodei sob o token DB:

| bucket | concorrência | instâncias | admitidas | recusadas | contador persistido | linhas | retryAfter |
| ------ | ------------ | ---------- | --------- | --------- | ------------------- | ------ | ---------- |
| chat   | 25           | 2          | **20**    | 5         | 20                  | 1      | 600–601 s  |
| tool   | 50           | 2          | **40**    | 10        | 40                  | 1      | 600–601 s  |

Ou seja: exatamente `max` admitidas, contador exato, **uma** linha por bucket, entre **duas instâncias** (2 pools) — a atomicidade distribuída é real. O operador entregou também uma prova de wiring contra Postgres real: 12 chamadas a `runRegisteredTool` → exatamente **6** consumos de bucket (as outras 6 recusadas antes da admissão por Zod/AuthZ), o que mostra que o script é hermético dentro da janela.

**Ordem de admissão (o ponto sutil):** recusar **depois** do claim de idempotência faria a chamada negada **ocupar** a linha `(tenant, user, operation, key)` e um retry seria reproduzido como se tivesse sido aceito. Os testes unitários provam: bucket negado ⇒ **0** inserções de idempotência; bucket permitido ⇒ **1**; e nenhum efeito colateral roda antes da admissão do chat.

**Manifest do supervisor:** `scripts/db/test-rate-limit-burst.ts` estava fora do `db:test` (o operador não pode tocar `package.json`) — **encadeei como 11º passo**, então a prova de atomicidade passa a rodar em todo `db:test`.

**Higiene do S (política consistente):** `format:check` falhava **apenas** no JSON de evidência `burst.json` → formatado. Três sítios de `as unknown as` apontados pelo hook eram **pré-existentes** (`pre-HEAD=1, post=1`) em arquivos que o operador tocou por outro motivo → documentados com comentário `SAFETY:` (comportamento zero alterado). E o `sanitizeJson` que retornava `unknown`: a regra tinha razão, então **tipifiquei** com o tipo recursivo `SanitizedJson`, derivado do próprio corpo da função — mudança **type-only**, e o parse do schema no call-site segue como fonte de verdade do tipo de domínio.

**Sobre os `[line-length]` da matriz (recusados com argumento):** são **pré-existentes** (provei: **9 linhas >80 chars no HEAD pré-merge e 9 agora**) e estão num arquivo **gerado**. Editá-lo à mão **quebraria** o `m02:matrix:check`, que exige o YAML commitado byte-idêntico à saída do gerador — reformatar seria ativamente errado. A regra de line-length não está no `eslint.config.js` nem no prettier do repo (ambos passam). Registrado como advisory, não como dívida.

**Gates do S:** 23 testes locais (3 arquivos), burst exit 0 reproduzido, typecheck/eslint/format/matriz/boundaries limpos.

**Follow-ups abertos por este item (rastreados, não bloqueantes):**

1. **O 429 não envia `Retry-After`** embora o SDD o prometa; a regra já devolve `retryAfter`, mas quem monta a resposta (`chat.functions.ts`/rota) estava **reservado** para o F2C-1 — o cabeçalho fica para quando esse arquivo for tocado.
2. **`countRecentUserMessages` ficou sem uso em runtime** (segue no repository/service com testes próprios): remover ou manter deliberadamente é decisão de limpeza, declarada pelo próprio operador.

### I-O19 — §18.5 skeletons de carregamento nas quatro rotas

**Entrega:** componente novo `src/components/loading-skeleton.tsx` concentrando o contrato de a11y num único lugar (`role="status"` + `sr-only` "Carregando..." **fora** do bloco `aria-hidden` — se ficasse dentro, o leitor de tela o suprimiria), e skeletons com **geometria real** nas quatro rotas que tinham **zero** `Skeleton`: `inicio` (grade KPI `md:2 lg:4`), `produtos` (lista de cards `grid gap-3`), `ponto-equilibrio` (seleção `md:2` + métricas `md:3` + break-even), `diagnostico` (grade `md:2 xl:5` + reuso de `DiagnosticoDataSkeleton`). `MetricCard` **intocado** (aditivo, para o §18.3 poder adicionar o slot `explain`) e `simulacoes.tsx` **intocado**.

**Substituição de padrão — declarada, não enterrada.** O plano pedia `role="status"` + `sr-only`; o **código do repo** usava `<output className="text-muted-foreground">Carregando...</output>` — que tem role `status` **implícita** mas com texto **visível** — e os skeletons já existentes do app não tinham anúncio nenhum. O operador adotou o mecanismo do plano com a **string exata do repo**, o que faz o texto de carregamento passar de visível a `sr-only`, com o **skeleton como indicador visual**. É a leitura correta do item (18.5 troca texto por geometria), e está documentada em detalhe no relatório §2 junto com a divergência plano×código.

**Prova de não-vacuidade do teste:** revertendo o gate de `/inicio` para o `<output>` antigo, o teste **falha** (`região role=status ausente no estado de carregamento`); o arquivo foi restaurado em seguida. Os testes asseguram geometria real (`.lg\:grid-cols-4 > *` com 4 filhos, `.md\:grid-cols-3 > *` com 3), não apenas presença de barras.

**Performance MEDIDA (não declarada como não-mensurável):** harness F0-04 executado (exit 0), **n=5 por rota**, seed sob token DB, `--chat-iterations 0`. **CLS p50 = 0 nas quatro rotas antes e depois** (controle `/simulacoes` mantém 0.02).

**Leitura honesta que eu destaco:** LCP/TTFB/ready subiram em **todas** as rotas, **inclusive `/simulacoes`, que o item não tocou** (`readyMs` 2505 → 3154). O relatório diz, textualmente, que o desvio é **da rodada/ambiente** (`n=5`, `warmup 0` em vez de 1, máquina com outros processos) e que **"nenhuma regressão pode ser imputada a §18.5 com este par antes/depois"**, e ainda que o ganho do item é de **geometria/percepção**, não mensurável por CLS nesta fixture — _"declarado como tal em vez de inventar número"_. Um operador que tivesse escondido a linha de controle teria fabricado uma regressão que não existe; ele publicou o controle.

**Nota de verificação:** meu primeiro `grep` por "drift" não achou a caveat porque o relatório está em português e usa "desvio"/"subiram" — **o meu check estava errado, não o relatório**. Segunda vez na rodada que uma checagem minha gerou falso alarme; verificar o verificador (inclusive quando sou eu) segue valendo.

**Gates do S:** 16 testes em 3 arquivos, `npm run build` **exit 0** (o gate que pegou o bug de import-protection na Onda 1 — obrigatório para slice de frontend), typecheck/eslint/prettier/ui-stack/matriz/boundaries limpos.

**Residuais declarados:** captura é **CONTROLADO** (Nitro local + Postgres Docker, IA mockada ≠ produção); sem `npm run check`/`db:test`/e2e completo (contrato do operador — o S roda no PC); dois arquivos de evidência ficam **0 byte** (`ai-model-attempts.jsonl`, `chat-samples.jsonl`) porque o circuito de chat foi **explicitamente pulado** (`--chat-iterations 0`), o que é consistente com o relatório.

### I-O24 — §12.5 schema diff + §12.4 branch model

**§12.4 parent:** `.github/workflows/neon-pr-branch.yml:109` passa a usar `${{ github.base_ref == 'main' && 'production' || 'develop' }}`. O operador **simulou a expressão** (extraindo a string do YAML e avaliando) em vez de afirmar: `main → production` · `develop → develop` · `release/1.0 → develop`. É a prova correta para uma expressão que só roda dentro do runner.

**§12.5 schema diff:** step `schema_diff` após o migrate, chamando `GET /projects/{id}/branches/{branch}/compare_schema?base_branch_id=<production>&db_name=neondb`, com baseline produção e **diff vazio** quando o PR não mexe em `drizzle/**`; artefato + resumo em forma de comentário quando mexe.

**Skip sem chave — declarado, não silencioso:** sem `NEON_API_KEY` o step sai **exit 0** e escreve `summary=PULADO (NEON_API_KEY ausente)` + um `schema-diff.md` que registra explicitamente: _"nenhuma chamada de rede foi feita; nenhuma chave ou project id foi presumido"_ e _"a semântica de baseline/empty-diff fica NÃO VERIFICADA até a chave existir"_. Esse é o comportamento certo: um skip que se declara não verificável em vez de fingir cobertura.

**Verificações do supervisor (independentes do relato):**

| checagem                                  | resultado                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `br-snowy-violet-aymcvvvv` foi inventado? | **NÃO** — pré-existente no `develop` com proveniência `REMOTE-VERIFIED` (`checagens-pos-publicacao-2026-09-05/report.md:23`, `cutover-2026-09-07/`) e no próprio ledger `:1148` |
| `m02-v2b.mjs` é comment-only?             | **SIM** — todas as linhas `+` do diff são `//`; **zero** linha executável alterada; a norma ficou registrada no lugar certo                                                     |
| identificadores de secret/var alterados?  | **NENHUM** (diff vazio nesse padrão)                                                                                                                                            |
| expressão de parent presente?             | **SIM**, em `:109`, exatamente como especificado                                                                                                                                |
| skip explícito?                           | **SIM** — `SKIP-GRACIOSO-ROTULADO` + **fork-guard** (`head_repo ≠ repository`) que **não** estava no meu briefing                                                               |

**Decisão de valor em §12.4b:** fazer o parent virar parâmetro obrigatório do `m02-v2b.mjs` mudaria o comportamento de `--plan`/preflight de um script **aposentado** sem ganho — porque o parent **já** é parâmetro explícito (`NEON_PARENT_BRANCH_ID` tem precedência sobre o default). Escolheu a variante de comentário-norma. Julgamento correto: mudança menor, zero comportamento alterado.

**Política de dados registrada** (`neon-branch-data-policy-2026-09-14.md`): produção é fixture-free hoje (26/26 + smoke 7/7 contínuo), logo herdar o **dado** do parent é aceitável **agora**; gatilho de revisão = PII ou tráfego real (H-6); `schema-only`/mascaramento **só após spike**; e a **caveat ratificada**: `schema-only` **não** copia `drizzle.__drizzle_migrations`, então `db:migrate` tentaria reaplicar e falharia — mitigação registrada (pular o migrate e semear o journal).

**Residuais declarados:** (1) sem `NEON_API_KEY` a chamada **ao vivo**, a criação de branch com parent novo e a resolução de base-id ficam **não verificáveis** (construção + simulação mock apenas); (2) quando `develop` estiver à frente, um diff não-vazio é **staleness develop×production** (§12.4 passo 1), não mudança do PR — documentado; (3) decisão declarada: HTTP≠200 **falha** o step (o job já depende da API Neon; cleanup `always()` remove a branch); (4) sem teste de regressão commitado para o step shell (harness em `/tmp`, 6 casos reproduzidos no doc); (5) `.github/**` roteia CI pelo pipeline **pesado** — o `npm run check` de integração é do supervisor.

## 3. Verificação adversarial (V por integração)

### Wave V1 — frontend/bundle · rate limits · CSP

| V               | Alvo                                        | Veredito                 | Bloqueantes | Destaque                                                                                      |
| --------------- | ------------------------------------------- | ------------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| **V-frontend**  | §18.5 · §18.1 · §18.3 **+ o fix de bundle** | **PRONTO-COM-RESSALVAS** | 0           | provou o fix de bundle **por mutação nos dois sentidos**                                      |
| **V-ratelimit** | §20.5                                       | sem bloqueantes          | 0           | **controle positivo** + cobriu o **caminho RLS** que o operador deixou de fora                |
| **V-csp**       | §20.1                                       | **PRONTO-COM-RESSALVAS** | 0           | política **literalmente idêntica** sem as diretivas de report; e2e **+25/−1** (superconjunto) |

**O que o V-frontend provou por mutação (o teste que eu pedi):** removendo de novo os três `await import("@/lib/query-options")` → grafo inicial **656858**, `check:bundle` **exit 1**; repondo `export function Simulacoes()` → **11** chaves de split (`simulacoes` ausente), **787504**, exit 1, **e o próprio gate de build falha com `INEFFECTIVE_DYNAMIC_IMPORT`**. Ou seja: o warning era **sintoma** da causa 1, e a história registrada no ledger está **validada por experimento**, não por narrativa. Também confirmou por build próprio: HEAD tem **12** chaves `tsr-split=component` (com `simulacoes`), `3cb87c4` tinha **11**; o chunk da split é `isDynamicEntry` e **não** está no grafo inicial; orçamento **byte-idêntico**.

**O que o V-ratelimit fez além do pedido:** harness com **90 backends reais** (o do repo usa 24/pool) a **4,5× o max** → sempre exatamente `max`, `persisted == max`, 1 linha; incluiu _stale-window rollover_ e corrida na linha vazia; e — o mais importante — **controle POSITIVO**: removendo a guarda do `UPDATE`, 24 são admitidas em vez de 20, provando que o harness **detecta sobre-admissão** (o verde não é vacuoso). Fechou a lacuna de o burst do operador rodar com **DSN admin (RLS contornada)**: re-rodou sob `set local role app_runtime` com RLS ligada → 20/20, 1 linha, 0 erros. Verificou ainda que o commit concorrente não invalidou a revisão (`git diff` vazio nos seus arquivos).

**O que o V-csp provou:** reconstruiu as duas políticas a partir dos objetos do git — sem as duas diretivas de report o resultado é **literalmente idêntico** (`diff` vazio, `===` true), **10 diretivas** dos dois lados, sem `unsafe-inline`/`unsafe-eval`/`nonce-`; `headers.txt` bate **byte a byte** com o fonte nas duas pontas; `CSP_ENFORCE` segue o único caminho de enforcement e nenhum config injeta uma segunda CSP; e2e **+25/−1** com a única deleção substituída por superconjunto. Confirmou que a divergência de 511 linhas entre os dois arquivos de matriz é **pré-existente**, e alertou que um **artefato de Playwright abortado** (da tentativa que morreu por timeout) falha numa asserção **pré-existente** de heading — **não** é validação nem refutação de CSP, e não deve ser lido como tal.

**Três imprecisões factuais na evidência** foram encontradas e estão em correção pelo O29: (a) o relatório do §18.5 diz que "LCP/TTFB/ready subiram em todas as rotas" quando o **TTFB do controle CAIU** (6.3 → 6.2); (b) o relatório do §20.5 atribui o 429 ausente de `Retry-After` ao **mapeamento do gateway upstream** em vez do construtor da resposta; (c) o mesmo relatório diz que o burst **não** está na cadeia `db:test` — está, e o encadeamento foi **ação de manifest do supervisor** (commit `46812f6`), logo a desatualização é minha. Somam-se: o `meta.json.commit` que lê como o commit medido; o escopo dos residuais do §18.3; e a **asserção de a11y que faltava** (o teste se chama _"announcement outside aria-hidden"_ mas mover o `.sr-only` para dentro do `aria-hidden` ainda passava 5/5).

### Wave V2 — Neon · PITR/spending · cutover · safe-record

_(em execução)_
