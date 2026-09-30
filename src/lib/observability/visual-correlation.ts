/**
 * V7 — correlação entre a captura visual e o pipeline OTel.
 *
 * `F-otel-provider-order` (medido, ADR-033): os instrumentos de
 * `src/instrumentation/telemetry.ts` nascem em escopo de módulo, antes de o
 * provider existir — sem provider o `@opentelemetry/api` devolve o noop, e o
 * instrumento criado cedo fica noop para sempre. Aqui a resolução é **tardia**:
 * o meter/tracer só é pedido na primeira emissão, e o cache é invalidado quando
 * o provider muda (o que permite ao teste unitário injetar um fake global).
 *
 * Sem provider registrado, emitir é noop — limite declarado, não bug: a suíte
 * e2e afirma os veredictos; a exportação para Prometheus/Grafana depende de
 * `F-otel-provider-order` ser fechado.
 */

import {
  metrics,
  trace,
  type Counter,
  type Histogram,
  type Meter,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

import type { AssertionResult, VisualFailureType } from "./visual-verification";

const INSTRUMENTATION_NAME = "preco-que-da-lucro";

export const VISUAL_SPAN_NAME = "visual_agent.iteration";

export const VISUAL_METRICS = {
  passRate: "visual.assertion.pass_rate",
  failureRate: "visual.assertion.failure_rate",
  redactionApplied: "visual.redaction.applied",
  screenshotLatency: "visual.screenshot.latency_ms",
  anomalyDetected: "visual.anomaly.detected",
} as const;

export interface VisualCorrelation {
  screenshotHash: string;
  correlationId: string | null;
  traceId: string | null;
}

export interface VisualSpanAttributes {
  screenshotBeforeHash: string;
  screenshotAfterHash: string;
  outcome: "success" | "fail";
  failureType?: VisualFailureType;
  redactionsApplied: number;
  correlationId: string | null;
}

interface VisualInstruments {
  passRate: Counter;
  failureRate: Counter;
  redactionApplied: Counter;
  screenshotLatency: Histogram;
  anomalyDetected: Counter;
}

let instrumentedMeter: Meter | null = null;
let instrumentsCache: VisualInstruments | null = null;

/** Resolução tardia com cache por instância de meter (nunca em escopo de módulo). */
function instruments(): VisualInstruments {
  const current = metrics.getMeter(INSTRUMENTATION_NAME);
  if (instrumentsCache === null || instrumentedMeter !== current) {
    instrumentedMeter = current;
    instrumentsCache = {
      passRate: current.createCounter(VISUAL_METRICS.passRate, {
        description: "Assertions visuais que passaram",
      }),
      failureRate: current.createCounter(VISUAL_METRICS.failureRate, {
        description: "Assertions visuais que falharam, por tipo de falha",
      }),
      redactionApplied: current.createCounter(VISUAL_METRICS.redactionApplied, {
        description: "Redações aplicadas antes da persistência",
      }),
      screenshotLatency: current.createHistogram(VISUAL_METRICS.screenshotLatency, {
        description: "Latência da captura até o artefato redigido, em ms",
        unit: "ms",
      }),
      anomalyDetected: current.createCounter(VISUAL_METRICS.anomalyDetected, {
        description: "Anomalias visuais detectadas, por tipo",
      }),
    };
  }
  return instrumentsCache;
}

function tracer(): Tracer {
  return trace.getTracer(INSTRUMENTATION_NAME);
}

/** Par screenshot.hash ↔ correlação da request (header `x-correlation-id`). */
export function correlateWithTrace(
  screenshotHash: string,
  correlationId?: string | null,
): VisualCorrelation {
  const active = trace.getActiveSpan();
  const traceId = active ? active.spanContext().traceId : null;
  return {
    screenshotHash,
    correlationId: correlationId ?? null,
    traceId: traceId && /^[0-9a-f]{32}$/i.test(traceId) && !/^0+$/.test(traceId) ? traceId : null,
  };
}

export function recordAssertion(assertion: string, result: AssertionResult): void {
  const attributes: Record<string, string> = { "visual.assertion": assertion };
  if (!result.ok) attributes["visual.failure_type"] = result.failureType;
  if (result.ok) instruments().passRate.add(1, attributes);
  else instruments().failureRate.add(1, attributes);
}

export function recordRedaction(count: number): void {
  if (count <= 0) return;
  instruments().redactionApplied.add(count);
}

export function recordScreenshotLatency(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  instruments().screenshotLatency.record(durationMs);
}

export function recordAnomaly(anomalyType: string): void {
  instruments().anomalyDetected.add(1, { "visual.anomaly_type": anomalyType });
}

/**
 * Abre `visual_agent.iteration` com os atributos do contrato (§19.7), executa o
 * corpo e fecha o span — inclusive no caminho de exceção, onde grava
 * `assertion.outcome = fail` antes de propagar.
 */
export function withVisualSpan<T>(attributes: VisualSpanAttributes, body: (span: Span) => T): T {
  const span = tracer().startSpan(VISUAL_SPAN_NAME, {
    attributes: {
      "screenshot.before_hash": attributes.screenshotBeforeHash,
      "screenshot.after_hash": attributes.screenshotAfterHash,
      "assertion.outcome": attributes.outcome,
      ...(attributes.failureType ? { "assertion.failure_type": attributes.failureType } : {}),
      redactions_applied: attributes.redactionsApplied,
      ...(attributes.correlationId ? { correlation_id: attributes.correlationId } : {}),
    },
  });
  try {
    return body(span);
  } catch (error) {
    span.setAttribute("assertion.outcome", "fail");
    throw error;
  } finally {
    span.end();
  }
}
