import { SpanStatusCode, metrics, trace, type Attributes, type Span } from "@opentelemetry/api";
import { logJson } from "@/lib/structured-logger";

const tracer = trace.getTracer("preco-que-da-lucro", "1.0.0");
const meter = metrics.getMeter("preco-que-da-lucro", "1.0.0");

export const applicationMetrics = {
  requestDuration: meter.createHistogram("app.request.duration", { unit: "ms" }),
  dbDuration: meter.createHistogram("app.db.duration", { unit: "ms" }),
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
