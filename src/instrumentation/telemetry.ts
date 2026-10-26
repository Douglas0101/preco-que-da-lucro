import {
  SpanStatusCode,
  metrics,
  trace,
  type Attributes,
  type Meter,
  type ObservableResult,
  type Span,
} from "@opentelemetry/api";
import { readEnv } from "@/lib/env.server";
import { logJson } from "@/lib/structured-logger";

// O tracer é criado no import porque a API o entrega como ProxyTracer: ele
// resolve o provider vigente no MOMENTO de `startSpan`. Métricas não têm esse
// proxy — por isso os instrumentos abaixo são lazy (DBT-148/F-otel-provider-order).
const tracer = trace.getTracer("preco-que-da-lucro", "1.0.0");

export interface DatabasePoolSnapshot {
  driver: string;
  used: number;
  idle: number;
  waiting: number;
  max: number;
  inFlightTransactions: number;
}

type PoolSnapshotSource = () => DatabasePoolSnapshot;

const poolSnapshotSources = new Set<PoolSnapshotSource>();

/** Registra uma fonte de snapshot do pool (por driver). Devolve o unregister
 * para testes; em produção os pools vivem por todo o processo. */
export function registerPoolSnapshotSource(source: PoolSnapshotSource): () => void {
  poolSnapshotSources.add(source);
  return () => {
    poolSnapshotSources.delete(source);
  };
}

function safeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Coleta defensiva: uma fonte que lança nunca derruba request nem exporter. */
export function collectPoolSnapshots(): DatabasePoolSnapshot[] {
  const collected: DatabasePoolSnapshot[] = [];
  for (const source of poolSnapshotSources) {
    try {
      const snapshot = source();
      if (!snapshot || typeof snapshot.driver !== "string") continue;
      collected.push({
        driver: snapshot.driver,
        used: safeCount(snapshot.used),
        idle: safeCount(snapshot.idle),
        waiting: safeCount(snapshot.waiting),
        max: safeCount(snapshot.max),
        inFlightTransactions: safeCount(snapshot.inFlightTransactions),
      });
    } catch {
      // Observabilidade nunca pode quebrar o caminho da request.
    }
  }
  return collected;
}

/** Agrega por driver para nunca duplicar série quando há mais de um pool. */
export function aggregatePoolSnapshots(
  snapshots: readonly DatabasePoolSnapshot[],
): DatabasePoolSnapshot[] {
  const byDriver = new Map<string, DatabasePoolSnapshot>();
  for (const snapshot of snapshots) {
    const aggregated = byDriver.get(snapshot.driver) ?? {
      driver: snapshot.driver,
      used: 0,
      idle: 0,
      waiting: 0,
      max: 0,
      inFlightTransactions: 0,
    };
    aggregated.used += safeCount(snapshot.used);
    aggregated.idle += safeCount(snapshot.idle);
    aggregated.waiting += safeCount(snapshot.waiting);
    aggregated.max += safeCount(snapshot.max);
    aggregated.inFlightTransactions += safeCount(snapshot.inFlightTransactions);
    byDriver.set(snapshot.driver, aggregated);
  }
  return [...byDriver.values()];
}

/**
 * Instrumentos de métrica são criados DEPOIS de `sdk.start()`. Um instrumento
 * criado antes recebe o meter noop e não é re-vinculado quando o provider
 * global é registrado — `@opentelemetry/api` não tem proxy de métrica. A
 * fábrica é chamada uma única vez, por `getApplicationMetrics()`.
 */
function createApplicationMetrics(meter: Meter) {
  const metricsInstance = {
    requestDuration: meter.createHistogram("app.request.duration", { unit: "ms" }),
    dbDuration: meter.createHistogram("app.db.duration", { unit: "ms" }),
    dbQueryDuration: meter.createHistogram("app.db.query.duration", { unit: "ms" }),
    dbPoolWaitTime: meter.createHistogram("app.db.pool.wait_time", { unit: "ms" }),
    dbPoolConnections: meter.createObservableGauge("app.db.pool.connections", {
      unit: "{connection}",
    }),
    dbPoolInFlightTransactions: meter.createObservableGauge("app.db.pool.in_flight_transactions", {
      unit: "{transaction}",
    }),
    aiDuration: meter.createHistogram("app.ai.duration", { unit: "ms" }),
    // §29: fases da latência percebida no chat não-streaming. `app.ai.duration`
    // continua medindo cada tentativa de gateway; estes histogramas medem o
    // tempo desde o aceite da mensagem até acknowledge/conteúdo/final.
    aiTimeToAcknowledge: meter.createHistogram("app.ai.time_to_acknowledge", { unit: "ms" }),
    aiTimeToFirstContent: meter.createHistogram("app.ai.time_to_first_content", { unit: "ms" }),
    aiTimeToFinal: meter.createHistogram("app.ai.time_to_final", { unit: "ms" }),
    toolDuration: meter.createHistogram("app.ai.tool.duration", { unit: "ms" }),
    errors: meter.createCounter("app.errors"),
    aiTimeouts: meter.createCounter("app.ai.timeouts"),
    aiQuotas: meter.createCounter("app.ai.quotas"),
    aiEstimatedCostTotal: meter.createCounter("app.ai.estimated_cost_total"),
    aiCostUnknownTotal: meter.createCounter("app.ai.cost_unknown_total"),
    aiUsageUnknownTotal: meter.createCounter("app.ai.usage_unknown_total"),
    // TRILHO B: o job de reconciliação trata eventos `usage_unknown` que o varredor
    // de reservas nunca alcança (predicados disjuntos). `total` conta as linhas
    // tratadas; `failed` conta as que terminaram sem medição. Hoje as duas
    // coincidem, porque o gateway não expõe retrieval por id e nenhum payload de
    // uso é persistido — continuarão distintas se um caminho de medição existir.
    aiReconciliationTotal: meter.createCounter("app.ai.reconciliation_total"),
    aiReconciliationFailed: meter.createCounter("app.ai.reconciliation_failed"),
    aiReconciliationOldestAge: meter.createObservableGauge("app.ai.reconciliation_oldest_age_ms", {
      unit: "ms",
    }),
    toolExecutions: meter.createCounter("app.ai.tool.executions"),
    conversationStateTransitions: meter.createCounter("app.ai.conversation_state_transitions"),
    conversationInvalidTransitions: meter.createCounter("app.ai.conversation_invalid_transitions"),
    financialStates: meter.createCounter("app.financial.states"),
    financialEngineVersion: meter.createCounter("app.financial.engine_version"),
    salesCreatedTotal: meter.createCounter("app.sales.created_total"),
    salesSummaryDuration: meter.createHistogram("app.sales.summary_duration", { unit: "ms" }),
    diagnosticCalculationTotal: meter.createCounter("app.diagnostic.calculation_total"),
    simulationSavedTotal: meter.createCounter("app.simulation.saved_total"),
    snapshotCreatedTotal: meter.createCounter("app.snapshot.created_total"),
    snapshotFailureTotal: meter.createCounter("app.snapshot.failure_total"),
  };

  metricsInstance.dbPoolConnections.addCallback((result) => {
    reportPoolConnectionObservations(result);
  });
  metricsInstance.dbPoolInFlightTransactions.addCallback((result) => {
    reportPoolInFlightObservations(result);
  });
  metricsInstance.aiReconciliationOldestAge.addCallback((result) => {
    if (reconciliationOldestAgeMs !== null) result.observe(reconciliationOldestAgeMs);
  });

  return metricsInstance;
}

type ApplicationMetrics = ReturnType<typeof createApplicationMetrics>;

let applicationMetricsInstance: ApplicationMetrics | undefined;
let applicationMetricsMeter: Meter | undefined;

/**
 * Cria os instrumentos contra o provider vigente neste instante.
 *
 * O cache é por identidade do meter — o mesmo padrão de
 * `visual-correlation.ts`. Se algum acesso acontecer antes de `sdk.start()`,
 * a troca de provider devolve um meter novo e os instrumentos são recriados;
 * os eventos anteriores ficam perdidos (noop), mas a série futura não.
 */
export function getApplicationMetrics(): ApplicationMetrics {
  const meter = metrics.getMeter("preco-que-da-lucro", "1.0.0");
  if (applicationMetricsInstance === undefined || applicationMetricsMeter !== meter) {
    applicationMetricsMeter = meter;
    applicationMetricsInstance = createApplicationMetrics(meter);
  }
  return applicationMetricsInstance;
}

/**
 * Fachada estável (DBT-148): os consumidores continuam lendo
 * `applicationMetrics.errors`, mas cada acesso resolve o instrumento já criado
 * — nunca um instrumento noop nascido no import. É o que permite mover a
 * criação para depois do `sdk.start()` sem tocar nos 16 módulos consumidores.
 */
const metricOverrides = new Map<PropertyKey, unknown>();

export const applicationMetrics = new Proxy({} as ApplicationMetrics, {
  get(_target, property) {
    if (metricOverrides.has(property)) return metricOverrides.get(property);
    return getApplicationMetrics()[property as keyof ApplicationMetrics];
  },
  // O contrato anterior era um literal mutável: testes e sondas substituem um
  // instrumento inteiro para observar chamadas. O Proxy preserva essa
  // mutabilidade sem abrir mão da criação tardia.
  set(_target, property, value) {
    metricOverrides.set(property, value);
    return true;
  },
});

/** Observa used/idle/waiting/max por driver — `state` evita 4 métricas novas. */
export function reportPoolConnectionObservations(result: ObservableResult): void {
  try {
    for (const snapshot of aggregatePoolSnapshots(collectPoolSnapshots())) {
      result.observe(snapshot.used, { driver: snapshot.driver, state: "used" });
      result.observe(snapshot.idle, { driver: snapshot.driver, state: "idle" });
      result.observe(snapshot.waiting, { driver: snapshot.driver, state: "waiting" });
      result.observe(snapshot.max, { driver: snapshot.driver, state: "max" });
    }
  } catch {
    // Callbacks de observable nunca podem lançar.
  }
}

export function reportPoolInFlightObservations(result: ObservableResult): void {
  try {
    for (const snapshot of aggregatePoolSnapshots(collectPoolSnapshots())) {
      result.observe(snapshot.inFlightTransactions, { driver: snapshot.driver });
    }
  } catch {
    // Callbacks de observable nunca podem lançar.
  }
}

/** Idade do evento `usage_unknown` mais antigo visto na varredura mais recente
 * da reconciliação. `null` significa **nunca medido** — nenhuma varredura
 * completou, então o gauge não emite ponto nenhum. Uma varredura que completou
 * e não achou candidato reporta `0`: ela *observou* que não há atraso pendente,
 * e manter o valor anterior de pé publicaria para sempre a idade de um backlog
 * já tratado (defeito D2 do adversarial). */
let reconciliationOldestAgeMs: number | null = null;

export function reportReconciliationOldestAge(ageMs: number | null): void {
  reconciliationOldestAgeMs =
    typeof ageMs === "number" && Number.isFinite(ageMs) && ageMs >= 0 ? ageMs : null;
}

/** Abre um span de query sem tornar o contexto ativo (o wrapper de client
 * preserva callback/thenable e finaliza o span manualmente). */
export function startDatabaseQuerySpan(operation: string, redactedQueryText?: string): Span {
  const attributes: Attributes = {
    "db.system.name": "postgresql",
    "db.operation.name": operation,
  };
  if (redactedQueryText !== undefined) attributes["db.query.text"] = redactedQueryText;
  return tracer.startSpan(operation, { attributes });
}

export function endSpanWithResult(span: Span, error?: unknown): void {
  if (error !== undefined && error !== null) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    if (error instanceof Error) span.recordException(error);
    else span.recordException(String(error));
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

let telemetryStarted = false;
let telemetryStarting: Promise<void> | undefined;
let activeSdk: { shutdown(): Promise<void> } | undefined;
let shutdownPromise: Promise<void> | undefined;

/** Encerra o SDK ativo com single-flight.
 *
 * Os handlers de sinal e `flushTelemetry` compartilham a MESMA promise. Sem isto
 * um segundo chamador recebe o retorno antecipado de `sdk.shutdown()` — que é
 * no-op depois do primeiro (o SDK apenas emite `diag.warn`) — e resolve ANTES do
 * dreno em andamento terminar: a garantia "drenou antes de sair" deixaria de
 * valer justamente quando um sinal vence a corrida. */
function shutdownActiveSdk(): Promise<void> {
  const sdk = activeSdk;
  if (!sdk) return Promise.resolve();
  activeSdk = undefined;
  shutdownPromise ??= sdk
    .shutdown()
    .catch((error: unknown) => logJson("warn", "telemetry.shutdown_failed", { error }));
  return shutdownPromise;
}

/** Tuning único do exportador em lote (OB-03).
 *
 * Serverless não ganha nada exportando a cada segundo: lotes maiores e uma
 * janela de 10 s reduzem timers/serializações sem estourar o orçamento de uma
 * invocação. O `exportTimeoutMillis` acompanha o teto de 5 s para que um
 * coletor lento não segure o shutdown.
 *
 * As chaves são as do `BatchSpanProcessor` do `@opentelemetry/sdk-trace-base`
 * (`scheduledDelayMillis`, `maxExportBatchSize`, `exportTimeoutMillis`);
 * `exportIntervalMillis` NÃO pertence ao processador de spans — é opção do
 * leitor de métricas.
 */
export const OTEL_BATCH_CONFIG = Object.freeze({
  scheduledDelayMillis: 10_000,
  maxExportBatchSize: 512,
  exportTimeoutMillis: 5_000,
} as const);

/** Tipo do tuning acima, derivado da própria constante (fonte única). */
export type BatchSpanProcessorConfig = typeof OTEL_BATCH_CONFIG;

/** Exposto para o teste de no-op: sem endpoint o SDK nunca é importado. */
export function isTelemetryStarted(): boolean {
  return telemetryStarted;
}

/**
 * Decisão de partida do SDK, isolada para ser testável sem I/O.
 *
 * A regra é a mesma da linha original (`telemetryStarted || telemetryStarting
 * || !endpoint` → não sai): sem endpoint OTLP o SDK **não** é importado, não
 * é construído e não é iniciado. Extrair a decisão para uma função pura é o
 * que permite PROVAR a precondição — o teste antigo só observava a flag
 * `isTelemetryStarted()`, que também seria `false` se a importação tivesse
 * falhado por outro motivo.
 */
export function shouldStartTelemetry(input: {
  started: boolean;
  starting: boolean;
  endpoint: string | undefined;
}): boolean {
  if (input.started) return false;
  if (input.starting) return false;
  return typeof input.endpoint === "string" && input.endpoint.length > 0;
}

/** Construtor de processador de spans (injetado para poder ser observado). */
export interface SpanProcessorFactory<E = unknown, P = unknown> {
  new (exporter: E, config: BatchSpanProcessorConfig): P;
}

/**
 * Constrói o `BatchSpanProcessor` com o tuning único do módulo.
 *
 * A costura existe porque a auditoria mediu que o teste fixava **a
 * constante** e o "SDK não inicia sem endpoint", mas nunca **a fiação**: nada
 * provava que o `BatchSpanProcessor` recebia `{...OTEL_BATCH_CONFIG}` e não
 * outro objeto. Injetar o construtor torna a fiação observável sem mudar a
 * semântica de produção — o mesmo objeto, a mesma ordem, o mesmo `spread`.
 */
export function createSpanProcessor<E, P>(
  exporter: E,
  BatchSpanProcessorCtor: SpanProcessorFactory<E, P>,
): P {
  return new BatchSpanProcessorCtor(exporter, { ...OTEL_BATCH_CONFIG });
}

/**
 * Dependências do SDK — injetadas para que a fiação seja observável.
 *
 * Os tipos são os das classes REAIS (via `typeof import(...)`, que é apagado
 * em tempo de compilação e não vira import no bundle) e não formas
 * estruturais: um tipo estrutural mais largo passaria a typecheck e
 * esconderia um erro de fiação real.
 */
export interface TelemetrySdkDependencies {
  NodeSDK: (typeof import("@opentelemetry/sdk-node"))["NodeSDK"];
  OTLPTraceExporter: (typeof import("@opentelemetry/exporter-trace-otlp-http"))["OTLPTraceExporter"];
  OTLPMetricExporter: (typeof import("@opentelemetry/exporter-metrics-otlp-http"))["OTLPMetricExporter"];
  PeriodicExportingMetricReader: (typeof import("@opentelemetry/sdk-metrics"))["PeriodicExportingMetricReader"];
  BatchSpanProcessor: (typeof import("@opentelemetry/sdk-trace-base"))["BatchSpanProcessor"];
}

/** Configuração resolvida do SDK (endpoint já vem sem barra final). */
export interface TelemetrySdkConfig {
  serviceName: string;
  endpoint: string;
  exportIntervalMillis: number;
}

/**
 * Monta o `NodeSDK` — processador de spans em lote + leitor periódico.
 *
 * O que o teste precisa ver: o `BatchSpanProcessor` é construído com o
 * exportador de traces e com `{...OTEL_BATCH_CONFIG}`, e o `NodeSDK` recebe
 * esse MESMO processador em `spanProcessors`. A produção chama esta função
 * com as classes reais do SDK; o teste chama com dublês e observa as
 * construções.
 */
export function createTelemetrySdk(
  deps: TelemetrySdkDependencies,
  config: TelemetrySdkConfig,
): {
  sdk: InstanceType<TelemetrySdkDependencies["NodeSDK"]>;
  spanProcessor: InstanceType<TelemetrySdkDependencies["BatchSpanProcessor"]>;
  metricReader: InstanceType<TelemetrySdkDependencies["PeriodicExportingMetricReader"]>;
} {
  const spanProcessor = createSpanProcessor(
    new deps.OTLPTraceExporter({ url: `${config.endpoint}/v1/traces` }),
    deps.BatchSpanProcessor,
  );
  const metricReader = new deps.PeriodicExportingMetricReader({
    exporter: new deps.OTLPMetricExporter({ url: `${config.endpoint}/v1/metrics` }),
    exportIntervalMillis: config.exportIntervalMillis,
    exportTimeoutMillis: OTEL_BATCH_CONFIG.exportTimeoutMillis,
  });
  const sdk = new deps.NodeSDK({
    serviceName: config.serviceName,
    spanProcessors: [spanProcessor],
    metricReader,
  });
  return { sdk, spanProcessor, metricReader };
}

/** Configuração do SDK OTEL resolvida de ambiente.
 *
 * Os dois sítios de leitura eram `??` sobre `process.env`:
 * `OTEL_SERVICE_NAME=""` chegaria ao `NodeSDK` como `serviceName` vazio —
 * o serviço exportado fica sem nome — e `OTEL_METRIC_EXPORT_INTERVAL_MS=""`
 * viraria `Number("") = 0`. `readEnv` trata "definida e vazia" como não
 * configurada (catálogo do DBT-97), e a faixa mantém o piso de 1 s já
 * validado abaixo com um teto de 1 h, para um intervalo absurdo não desligar
 * a exportação por omissão. Ausente e vazio resultam no MESMO default. */
export function resolveOtelSdkConfig(): {
  serviceName: string;
  exportIntervalMillis: number;
  endpoint: string | undefined;
} {
  const rawInterval = readEnv("OTEL_METRIC_EXPORT_INTERVAL_MS");
  const parsedInterval = rawInterval === undefined ? Number.NaN : Number(rawInterval);
  return {
    serviceName: readEnv("OTEL_SERVICE_NAME") ?? "preco-que-da-lucro",
    // O piso é o timeout de exportação, não 1 s: o `PeriodicExportingMetricReader`
    // recusa intervalo menor que `exportTimeoutMillis` e o construtor lança —
    // derrubando traces E métricas junto. Medido no smoke DBT-148 com 1.000 ms:
    // "exportIntervalMillis must be greater than or equal to exportTimeoutMillis".
    exportIntervalMillis:
      Number.isFinite(parsedInterval) &&
      parsedInterval >= OTEL_BATCH_CONFIG.exportTimeoutMillis &&
      parsedInterval <= 3_600_000
        ? parsedInterval
        : 15_000,
    // A barra final precisa sair antes de anexar /v1/traces e /v1/metrics: sem isto
    // o caminho sai com barra dupla e coletores/proxies que a recusam perdem a
    // telemetria em silêncio (regressão do PR #61; comportamento restaurado do main).
    endpoint: readEnv("OTEL_EXPORTER_OTLP_ENDPOINT")?.replace(/\/$/, ""),
  };
}

/**
 * OTLP is opt-in and initialization failures never block or fail a request.
 *
 * Aguardável de propósito (DBT-148): o chamador que precisa instrumentar a
 * request espera o `sdk.start()` terminar. Sem isso, a primeira request cria
 * instrumentos noop e as métricas não são entregues. Com o endpoint ausente
 * o caminho continua síncrono e barato — nenhum import do SDK acontece.
 */
export async function ensureTelemetryStarted(): Promise<void> {
  if (telemetryStarting) {
    await telemetryStarting;
    return;
  }
  const config = resolveOtelSdkConfig();
  // `shouldStartTelemetry` decide a PARTIDA; o `endpoint === undefined` é o
  // narrowing do TypeScript (a função pura não narrowa) — redundante por
  // desenho, não um segundo gate.
  if (
    !shouldStartTelemetry({
      started: telemetryStarted,
      starting: false,
      endpoint: config.endpoint,
    }) ||
    config.endpoint === undefined
  )
    return;
  const { serviceName, exportIntervalMillis, endpoint } = config;
  const starting = (async () => {
    try {
      // These packages are server-only. Imports LITERAIS (e lazy) para o
      // bundler empacotar SDK e API no MESMO grafo: um specifier bare em
      // runtime resolveria outra cópia de `@opentelemetry/api` e os spans
      // nasceriam num provider que o SDK não enxerga (DBT-148). O carregamento
      // dinâmico mantém o custo fora do boot quando OTLP não está configurado.
      const [
        { NodeSDK },
        { OTLPTraceExporter },
        { OTLPMetricExporter },
        { PeriodicExportingMetricReader },
        { BatchSpanProcessor },
      ] = await Promise.all([
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/exporter-trace-otlp-http"),
        import("@opentelemetry/exporter-metrics-otlp-http"),
        import("@opentelemetry/sdk-metrics"),
        import("@opentelemetry/sdk-trace-base"),
      ]);
      const { sdk } = createTelemetrySdk(
        {
          NodeSDK,
          OTLPTraceExporter,
          OTLPMetricExporter,
          PeriodicExportingMetricReader,
          BatchSpanProcessor,
        },
        { serviceName, endpoint, exportIntervalMillis },
      );
      sdk.start();
      telemetryStarted = true;
      activeSdk = sdk;
      // Só depois do provider global: instrumentos de métrica não são
      // re-vinculados (não há ProxyMeter na API).
      getApplicationMetrics();
      const shutdown = () => {
        void shutdownActiveSdk();
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    } catch (error) {
      logJson("warn", "telemetry.initialization_failed", { error });
    } finally {
      telemetryStarting = undefined;
    }
  })();
  telemetryStarting = starting;
  await starting;
}

/** Variante aguardável de `ensureTelemetryStarted`, para processos curtos
 * (scripts e jobs) que precisam do provider global registrado e não podem
 * terminar antes do primeiro ciclo do exportador periódico.
 *
 * DBT-148/F-otel-provider-order: os instrumentos de `applicationMetrics` já
 * não nascem no import. `ensureTelemetryStarted()` instala o provider global e
 * só então cria o meter/instrumentos; `startTelemetry()` espera essa cadeia.
 * A garantia de ENTREGA (≥1 POST /v1/traces e /v1/metrics no coletor) é
 * medida no smoke de runtime — a existência desta função não a substitui. */
export async function startTelemetry(): Promise<void> {
  await ensureTelemetryStarted();
}

/** Drena o exportador periódico e encerra o SDK.
 *
 * Um processo curto que esquece isto perde a última janela de métricas: com o
 * `exportIntervalMillis` padrão de 15 s, o processo termina antes do primeiro
 * flush. Idempotente — um segundo chamado não encontra SDK ativo e devolve sem
 * erro. Compartilha a promise de `shutdownActiveSdk` com os handlers de sinal,
 * então aguarda o MESMO dreno em vez de receber um retorno antecipado. Não
 * rearma `telemetryStarted`: depois do `shutdown` o SDK não volta. */
export async function flushTelemetry(): Promise<void> {
  await telemetryStarting;
  await shutdownActiveSdk();
}

export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      if (error instanceof Error) span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
