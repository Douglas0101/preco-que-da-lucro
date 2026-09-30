# Computer User Observability

Camada de validação visual contínua do Preço Que Dá Lucro, descrita em
§19.7 do Plano Mestre e registrada em
[ADR-033](../adr/ADR-033-computer-user-observability.md).

**Pergunta que a camada responde:** o comportamento que o usuário vê na UI
corresponde ao estado real que o backend calculou? Um teste de backend verde
com uma tela exibindo `R$ 0,00` para um cálculo ausente é regressão, não
sucesso — a camada existe para essa classe de defeito.

## Arquitetura

Quatro agentes, com nomes estáveis no código para rastrear o fluxo:

| Agente           | Módulo                                         | Papel                                                                    |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| V1 Perception    | `src/lib/observability/visual-perception.ts`   | transforma a captura bruta em artefato redigido, com hash e persistência |
| V6 Redaction     | `src/lib/observability/visual-redaction.ts`    | remove segredos, PII e tokens **antes** de qualquer persistência         |
| V5 Verification  | `src/lib/observability/visual-verification.ts` | veredictos tipados por assertion (badge, fallback, CLS, tenant)          |
| V7 Observability | `src/lib/observability/visual-correlation.ts`  | correlação com OTel e emissão das métricas visuais                       |

Fluxo: **V1 → V6 → V5 → V7**. A captura só é persistida depois de V6; V1
reverifica o resíduo no limite da escrita (fail-closed), então um chamador que
monte a captura à mão ainda é barrado em `persistVisualCapture`.

Quem fala com o browser é o adaptador de tempo de teste
`e2e/visual/visual-capture.ts` (Playwright): screenshot, `ariaSnapshot()` do
container e snapshot de DOM limitado (profundidade, filhos, atributos, texto).
Os módulos de `src/lib/observability/` são puros e por isso rodam no `check`.

**Declaração de arquitetura (ADR-033):** a captura é de **tempo de teste**. O
runtime de produção (Nitro `node-server`/Vercel) não lança browser — o Playwright
é uma devDependency. A alternativa de capturar em produção foi avaliada e
recusada; o evento que a motivou (incidente L239, segredo vivo em snapshot de
acessibilidade do hPanel) é justamente o motivo pelo qual a redação é
obrigatória antes de qualquer persistência.

### Onde os artefatos ficam

Cada cenário grava o trio selado em `docs/evidence/visual/`:

```text
<timestamp>-<sha256>.png        screenshot redigido (chunks de texto do PNG removidos)
<timestamp>-<sha256>.a11y.json  snapshot de acessibilidade redigido + metadados
<timestamp>-<sha256>.dom.json   snapshot de DOM redigido + metadados
```

`<sha256>` é o hash do **PNG já redigido**; o JSON também carrega `beforeHash`,
`correlationId`, `redactionsApplied` e `durationMs`. O diretório é gitignored
(evidência de execução, não fonte) e é publicado como artefato de CI pelo job
`verify` (`browser-evidence`). O `.prettierignore` sela `docs/evidence/visual/**`:
artefato bruto não é reformatado.

### Correlação com OTel

`src/start.ts` aceita/emite `x-correlation-id` em toda resposta. O adapter lê o
header da navegação e o grava no artefato; `correlateWithTrace(hash, correlationId)`
devolve o par `screenshot.hash ↔ correlationId` e o `trace_id` **quando há span
ativo no mesmo processo**. O processo de teste do Playwright não tem span OTel
ativo, então a suíte e2e afirma `traceId: null` explicitamente — nunca inventa um
trace. O pareamento com `trace_id` real é exercitado no teste unitário, com
`BasicTracerProvider` + `AsyncLocalStorageContextManager`.

**Limite aberto (`F-otel-provider-order`):** os instrumentos de
`src/instrumentation/telemetry.ts` nascem em escopo de módulo, antes de o
provider existir; sem provider o `@opentelemetry/api` devolve o noop, e o
instrumento criado cedo fica noop para sempre. Por isso a resolução em
`visual-correlation.ts` é tardia (meter/tracer pedidos na primeira emissão, cache
invalidado quando o provider muda). A exportação para Prometheus/Grafana depende
desse ponto ser fechado no caminho de produção.

## Métricas visuais

| Métrica                         | Tipo                         | O que mede            | Alvo        |
| ------------------------------- | ---------------------------- | --------------------- | ----------- |
| `visual.assertion.pass_rate`    | counter                      | assertions aprovadas  | ≥ 99%       |
| `visual.assertion.failure_rate` | counter (por `failure_type`) | assertions reprovadas | 0           |
| `visual.redaction.applied`      | counter                      | redações por captura  | informativo |
| `visual.screenshot.latency_ms`  | histogram                    | custo da captura      | informativo |
| `visual.anomaly.detected`       | counter (por `anomaly_type`) | anomalias visuais     | 0           |

O span `visual_agent.iteration` carrega `screenshot.before_hash`,
`screenshot.after_hash`, `assertion.outcome`, `assertion.failure_type`,
`redactions_applied` e `correlation_id`.

`failure_type` é o vocabulário fechado de V5: `badge-missing`,
`badge-unexpected`, `nan-rendered`, `invalid-as-zero`, `incomplete-not-displayed`,
`cls-above-threshold`, `tenant-leak`, `redaction-leak`.

### Gates

- `npm run test:visual` — suíte Playwright da camada visual. Roda na **camada de
  e2e** (browser + app servido), não na cadeia `check`; no CI ela pega carona no
  passo `npx playwright test` já existente, em todos os projetos da matriz.
- Assertion visual verde nas telas críticas, zero anomalias, badges de estado
  presentes e CLS < 0,1 (alinhado a §17.8 RUM).

### Rodando localmente

```bash
npm run db:up
set -a && . ./.env && set +a   # os pre-hooks carregam o .env só no próprio processo
E2E_AUTH_EMAIL=teste@example.test \
  E2E_AUTH_PASSWORD=$(openssl rand -hex 16) \
  npm run test:visual -- --project=chromium --project=mobile
```

Os scripts `pretest:visual` e `pree2e:prepare` são pre-hooks: carregam `.env` no
processo do guard, **não** exportam para o Playwright nem para o `webServer`. No
CI as variáveis são exportadas no job (`GITHUB_ENV`), então a execução local
precisa do `set -a && . ./.env && set +a`. Sem ele o `webServer` morre em
`DATABASE_ADMIN_URL é obrigatória para migrations` antes de rodar um único teste.

### Invariantes cobertos

- **INV-007** — `NaN`/`Infinity` nunca formatados como zero: `assertNoNaNasZero`
  procura os literais não finitos no texto visível; `assertNumericDisplay` exige
  o fallback exato de `src/lib/format.ts` (`invalid` → "Erro de cálculo",
  `infinite` → "Não atingível").
- **INV-006** — dado incompleto não vira número factual: `incomplete` exige
  "—" / "Erro de cálculo" exato e `assertIncompleteDisplayed` aceita "—" ou o
  rótulo "DADOS INCOMPLETOS".
- **INV-008** — isolamento de tenant: `assertTenantIsolation` reprova marcador
  estrangeiro visível; lista de marcadores vazia também reprova (fail-closed).
- Badge de estado presente e correto (`REAL` / `DADOS INCOMPLETOS`).

## Como adicionar uma assertion

1. Defina o **tipo de falha** primeiro: adicione o valor ao union
   `VisualFailureType` em `visual-verification.ts`. Sem ele, a métrica
   `visual.assertion.failure_rate` perderia a dimensão que explica a falha.
2. Escreva a assertion como função **pura** que devolve `AssertionResult`
   (`ok`/`fail`) em vez de lançar — é o que a mantém testável sem browser.
   Use o oráculo `src/lib/format.ts` para fallbacks; nunca copie a string de
   fallback (uma segunda fonte de verdade diverge em silêncio).
3. Cubra com teste unitário em `src/test/visual-observability.test.ts`: caso
   positivo, caso negativo (a falha que a assertion existe para pegar) e o
   valor degenerado (vazio, não finito, lista vazia de marcadores).
4. Use-a no cenário e2e correspondente em `e2e/visual/` e converta o veredicto
   com o helper `expectOk` (mensagem carrega assertion + `failureType` + detalhe).
5. Se ela instrumenta o fluxo, emita em `visual-correlation.ts` com
   `recordAssertion(...)` — o caminho de emissão é o mesmo de `withVisualSpan`.

## Como interpretar os dashboards

1. **`visual.anomaly.detected > 0`** é alerta de páginas, não de tendência: uma
   anomalia visual é um defeito de produto (valor não finito exposto, dado
   incompleto apresentado como factual).
2. **`visual.assertion.pass_rate < 99%`** é investigado pela dimensão
   `failure_type`: `nan-rendered` e `invalid-as-zero` apontam para formatação de
   números; `badge-missing` para estado de qualidade do dado; `cls-above-threshold`
   para layout instável; `redaction-leak` é incidente de segurança (§19.4).
3. **Dashboards de RUM e visual se cruzam:** Web Vitals (LCP/INP/CLS) mede o
   usuário real; a suíte visual mede o navegador do CI. Divergência entre os
   dois é sinal de caminho de dados diferente (cache, feature flag, viewport).

## Limites declarados

- **Sem OCR**: a redação cobre texto estruturado (a11y, DOM, chunks de texto do
  PNG). Um segredo **pintado em pixels** não é detectado — o limite está
  documentado no próprio `visual-redaction.ts`.
- **CLS só onde a engine expõe `layout-shift`**: Chromium e o projeto mobile
  (Chromium). Firefox e WebKit não implementam a entry type; o teste registra
  `cls-unsupported` como anotação e essa porção do gate não é afirmada ali —
  anotação explícita, nunca verde silencioso.
- **Cobertura de browser**: a suíte roda em todos os projetos da matriz e2e
  (chromium, firefox, webkit, mobile), mas o snapshot usa o container `body` —
  iframes e shadow DOM fechado não são atravessados.
- **Sem captura em produção**: por desenho (ADR-033); não existe caminho de
  código que persista screenshot em runtime de produção.

## Referências

- `docs/adr/ADR-033-computer-user-observability.md` — decisão e alternativas.
- `docs/PLANO_MESTRE_OTIMIZACOES_VALIDADO_WEB_PRECO_QUE_DA_LUCRO.md` — §17.8
  (RUM), §19.7 (a camada), §32/§33 (matrizes de segurança e financeira), §45
  (Definition of Done) e §46 (KPIs).
- `src/test/visual-observability.test.ts` — contrato unitário dos quatro módulos.
- `e2e/visual/visual-observability.spec.ts` — cenários de tela.
