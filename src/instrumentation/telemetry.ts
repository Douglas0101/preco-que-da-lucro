import {
  SpanStatusCode,
  metrics,
  trace,
  type Attributes,
  type ObservableResult,
  type Span,
} from "@opentelemetry/api";
import { logJson } from "@/lib/structured-logger";

const tracer = trace.getTracer("preco-que-da-lucro", "1.0.0");
const meter = metrics.getMeter("preco-que-da-lucro", "1.0.0");

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

export const applicationMetrics = {
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
  toolDuration: meter.createHistogram("app.ai.tool.duration", { unit: "ms" }),
  errors: meter.createCounter("app.errors"),
  aiTimeouts: meter.createCounter("app.ai.timeouts"),
  aiQuotas: meter.createCounter("app.ai.quotas"),
  aiEstimatedCostTotal: meter.createCounter("app.ai.estimated_cost_total"),
  aiCostUnknownTotal: meter.createCounter("app.ai.cost_unknown_total"),
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

applicationMetrics.dbPoolConnections.addCallback((result) => {
  reportPoolConnectionObservations(result);
});

applicationMetrics.dbPoolInFlightTransactions.addCallback((result) => {
  reportPoolInFlightObservations(result);
});

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

/** OTLP is opt-in and initialization failures never block or fail a request. */
export function ensureTelemetryStarted(): void {
  if (telemetryStarted || telemetryStarting || !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  telemetryStarting = (async () => {
    try {
      // These packages are server-only. Variable, vite-ignored imports prevent a
      // server function's shared module graph from pulling Node SDK internals
      // into the browser bundle while keeping OTLP available at runtime.
      const sdkPackage = "@opentelemetry/sdk-node";
      const exporterPackage = "@opentelemetry/exporter-trace-otlp-http";
      const metricExporterPackage = "@opentelemetry/exporter-metrics-otlp-http";
      const metricsSdkPackage = "@opentelemetry/sdk-metrics";
      const [
        { NodeSDK },
        { OTLPTraceExporter },
        { OTLPMetricExporter },
        { PeriodicExportingMetricReader },
      ] = await Promise.all([
        import(/* @vite-ignore */ sdkPackage) as Promise<typeof import("@opentelemetry/sdk-node")>,
        import(/* @vite-ignore */ exporterPackage) as Promise<
          typeof import("@opentelemetry/exporter-trace-otlp-http")
        >,
        import(/* @vite-ignore */ metricExporterPackage) as Promise<
          typeof import("@opentelemetry/exporter-metrics-otlp-http")
        >,
        import(/* @vite-ignore */ metricsSdkPackage) as Promise<
          typeof import("@opentelemetry/sdk-metrics")
        >,
      ]);
      const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT!.replace(/\/$/, "");
      const exportIntervalMillis = Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 15_000);
      const sdk = new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME ?? "preco-que-da-lucro",
        traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
        metricReader: new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis:
            Number.isFinite(exportIntervalMillis) && exportIntervalMillis >= 1_000
              ? exportIntervalMillis
              : 15_000,
        }),
      });
      sdk.start();
      telemetryStarted = true;
      const shutdown = () => {
        void sdk
          .shutdown()
          .catch((error: unknown) => logJson("warn", "telemetry.shutdown_failed", { error }));
      };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    } catch (error) {
      logJson("warn", "telemetry.initialization_failed", { error });
    } finally {
      telemetryStarting = undefined;
    }
  })();
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
