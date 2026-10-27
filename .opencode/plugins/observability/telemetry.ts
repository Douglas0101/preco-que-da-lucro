/**
 * Exportador local do plugin de observabilidade do OpenCode.
 *
 * Dois caminhos recebem os mesmos spans/métricas:
 *  1. um `InMemory*Exporter` que drena para JSONL em `docs/evidence/observability/`
 *     (a prova legível, mesmo sem backend);
 *  2. os exporters OTLP/HTTP para `127.0.0.1:4318`, que exercitam o transporte
 *     OTLP de verdade (o collector local só precisa responder 200).
 *
 * Nada aqui pode derrubar uma tool call: todos os caminhos de erro são
 * capturados e viram uma linha de diagnóstico no arquivo de eventos.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricData,
  type ResourceMetrics,
} from "@opentelemetry/sdk-metrics";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  InMemorySpanExporter,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  SpanStatusCode,
  type Attributes,
  type Counter,
  type Histogram,
  type Meter,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import type { PolicyDecision } from "./policy";

const DEFAULT_OTLP = "http://127.0.0.1:4318";

export interface ToolBeforeEvent {
  tool: string;
  sessionID: string;
  agent: string;
  messageID: string;
  id: string;
  input: unknown;
}

export interface ToolAfterEvent extends ToolBeforeEvent {
  status: "completed" | "error";
  error?: { type?: string; message?: string };
}

interface TokenSnapshot {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

interface ToolStart {
  startMs: number;
  span: Span;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function tokenSnapshot(value: unknown): TokenSnapshot {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const cache =
    record.cache && typeof record.cache === "object"
      ? (record.cache as Record<string, unknown>)
      : {};
  return {
    input: numberValue(record.input),
    output: numberValue(record.output),
    reasoning: numberValue(record.reasoning),
    cacheRead: numberValue(cache.read),
    cacheWrite: numberValue(cache.write),
  };
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (typeof entry === "bigint") return entry.toString();
    if (entry instanceof Error) return { name: entry.name, message: entry.message };
    return entry;
  });
}

export class Observability {
  private readonly dir: string;
  private readonly spansPath: string;
  private readonly metricsPath: string;
  private readonly eventsPath: string;

  private readonly spanMemory = new InMemorySpanExporter();
  private readonly metricMemory = new InMemoryMetricExporter(AggregationTemporality.DELTA);
  private readonly traceProvider: BasicTracerProvider;
  private readonly meterProvider: MeterProvider;
  private readonly tracer: Tracer;
  private readonly meter: Meter;
  private readonly flushTimer: NodeJS.Timeout;

  private readonly toolCalls: Counter;
  private readonly toolDuration: Histogram;
  private readonly policyViolations: Counter;
  private readonly llmTokens: Counter;
  private readonly llmCost: Counter;
  private readonly mcpStatusChanges: Counter;

  private readonly toolStarts = new Map<string, ToolStart>();
  private readonly blocked = new Set<string>();

  constructor(options: { dir?: string } = {}) {
    this.dir =
      options.dir ??
      process.env.OPENCODE_OBSERVABILITY_DIR ??
      resolve(process.cwd(), "docs/evidence/observability");
    this.spansPath = resolve(this.dir, "spans.ndjson");
    this.metricsPath = resolve(this.dir, "metrics.ndjson");
    this.eventsPath = resolve(this.dir, "plugin-events.ndjson");
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {
      // O exporter de arquivo é best-effort; o OTLP continua disponível.
    }

    const otlpEnabled = process.env.OPENCODE_OBSERVABILITY_OTLP !== "0";
    const endpoint = (process.env.OPENCODE_OBSERVABILITY_OTLP_ENDPOINT ?? DEFAULT_OTLP).replace(
      /\/$/,
      "",
    );

    const spanProcessors = [new BatchSpanProcessor(this.spanMemory, { scheduledDelayMillis: 500 })];
    if (otlpEnabled) {
      spanProcessors.push(
        new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }), {
          scheduledDelayMillis: 500,
        }),
      );
    }
    this.traceProvider = new BasicTracerProvider({ spanProcessors });
    this.tracer = this.traceProvider.getTracer("opencode.observability", "1.0.0");

    const readers = [
      new PeriodicExportingMetricReader({
        exporter: this.metricMemory,
        exportIntervalMillis: 10000,
        exportTimeoutMillis: 5000,
      }),
    ];
    if (otlpEnabled) {
      readers.push(
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: 10000,
          exportTimeoutMillis: 5000,
        }),
      );
    }
    this.meterProvider = new MeterProvider({ readers });
    this.meter = this.meterProvider.getMeter("opencode.observability", "1.0.0");

    this.toolCalls = this.meter.createCounter("opencode.tool.calls", {
      description: "Chamadas de ferramenta do OpenCode, por nome e status",
    });
    this.toolDuration = this.meter.createHistogram("opencode.tool.duration", {
      description: "Duração das chamadas de ferramenta",
      unit: "ms",
    });
    this.policyViolations = this.meter.createCounter("opencode.policy.violations", {
      description: "Bloqueios de política aplicados pelo plugin",
    });
    this.llmTokens = this.meter.createCounter("opencode.llm.tokens", {
      description: "Tokens consumidos por tipo, derivados de session.step.ended",
    });
    this.llmCost = this.meter.createCounter("opencode.llm.cost_usd", {
      description: "Custo estimado em USD, derivado de session.step.ended",
    });
    this.mcpStatusChanges = this.meter.createCounter("opencode.mcp.status.changes", {
      description: "Mudanças de status de servidores MCP",
    });

    this.flushTimer = setInterval(() => this.flushToDisk(), 500);
    this.flushTimer.unref?.();
  }

  startTool(event: ToolBeforeEvent, decision: PolicyDecision): void {
    const key = `${event.sessionID}:${event.id}`;
    const startMs = Date.now();
    const attributes: Attributes = {
      "tool.name": event.tool,
      "tool.session_id": event.sessionID,
      "tool.message_id": event.messageID,
      "tool.call_id": event.id,
      "tool.agent": event.agent,
    };
    const span = this.tracer.startSpan("opencode.tool.call", {
      startTime: new Date(startMs),
      attributes,
    });

    if (!decision.allowed) {
      span.setAttribute("tool.status", "blocked");
      span.setAttribute("tool.duration_ms", 0);
      span.setAttribute("error.type", "policy_violation");
      span.setAttribute("policy.rule", decision.rule);
      span.setStatus({ code: SpanStatusCode.ERROR, message: decision.rule });
      span.end();
      this.blocked.add(key);
      this.toolCalls.add(1, { tool: event.tool, status: "blocked" });
      this.policyViolations.add(1, { rule: decision.rule });
      this.recordEvent("policy_blocked", {
        tool: event.tool,
        rule: decision.rule,
        sessionID: event.sessionID,
        callID: event.id,
      });
      return;
    }

    this.toolStarts.set(key, { startMs, span });
  }

  endTool(event: ToolAfterEvent): void {
    const key = `${event.sessionID}:${event.id}`;
    if (this.blocked.delete(key)) return;

    const entry = this.toolStarts.get(key);
    const endMs = Date.now();
    if (!entry) {
      // O `execute.before` deveria sempre preceder o `after`; se não veio,
      // sintetizamos um span marcado para não inventar duração nem silenciar.
      const span = this.tracer.startSpan("opencode.tool.call", {
        startTime: new Date(endMs),
        attributes: {
          "tool.name": event.tool,
          "tool.session_id": event.sessionID,
          "tool.message_id": event.messageID,
          "tool.call_id": event.id,
          "tool.agent": event.agent,
          "tool.orphan": true,
        },
      });
      span.setAttribute("tool.status", event.status);
      span.end();
      this.toolCalls.add(1, { tool: event.tool, status: event.status });
      this.recordEvent("tool_after_without_start", { tool: event.tool, callID: event.id });
      return;
    }

    this.toolStarts.delete(key);
    const durationMs = Math.max(0, endMs - entry.startMs);
    entry.span.setAttribute("tool.status", event.status);
    entry.span.setAttribute("tool.duration_ms", durationMs);
    if (event.status === "error") {
      entry.span.setAttribute("error.type", event.error?.type ?? "tool_error");
      entry.span.setStatus({
        code: SpanStatusCode.ERROR,
        message: event.error?.type ?? "tool_error",
      });
    } else {
      entry.span.setStatus({ code: SpanStatusCode.OK });
    }
    entry.span.end();
    this.toolCalls.add(1, { tool: event.tool, status: event.status });
    this.toolDuration.record(durationMs, { tool: event.tool, status: event.status });
  }

  recordUsage(data: unknown, scope: "step" | "session" = "session"): void {
    if (!data || typeof data !== "object") return;
    const record = data as Record<string, unknown>;
    const sessionID = typeof record.sessionID === "string" ? record.sessionID : null;
    if (!sessionID) return;

    const cost = numberValue(record.cost);
    const tokens = tokenSnapshot(record.tokens);

    // `session.step.ended` traz o consumo do passo; `session.usage.updated`
    // traz o acumulado da sessão. Só o primeiro entra nos contadores — somar o
    // acumulado da sessão inflaria o custo a cada evento.
    if (scope === "step") {
      for (const [type, value] of [
        ["input", tokens.input],
        ["output", tokens.output],
        ["reasoning", tokens.reasoning],
        ["cache_read", tokens.cacheRead],
        ["cache_write", tokens.cacheWrite],
      ] as const) {
        if (value > 0) this.llmTokens.add(value, { type });
      }
      if (cost > 0) this.llmCost.add(cost, { currency: "USD" });
    }

    const messageID =
      typeof record.assistantMessageID === "string" ? record.assistantMessageID : null;
    const span = this.tracer.startSpan("opencode.llm.usage", {
      startTime: new Date(),
      attributes: {
        "session.id": sessionID,
        "usage.scope": scope,
        ...(messageID === null ? {} : { "message.id": messageID }),
        "llm.cost_usd": cost,
        "llm.tokens.input": tokens.input,
        "llm.tokens.output": tokens.output,
        "llm.tokens.reasoning": tokens.reasoning,
        "llm.tokens.cache_read": tokens.cacheRead,
        "llm.tokens.cache_write": tokens.cacheWrite,
      },
    });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
  }

  recordMcp(server: string, status: string, detail?: Record<string, unknown>): void {
    const failed = /failed|needs_auth|disabled/i.test(status);
    const span = this.tracer.startSpan("opencode.mcp.status", {
      startTime: new Date(),
      attributes: {
        "mcp.server": server,
        "mcp.status": status,
        ...(detail ? { "mcp.detail": safeJson(detail).slice(0, 300) } : {}),
      },
    });
    if (failed) {
      span.setAttribute("error.type", "mcp.connection.failed");
      span.setStatus({ code: SpanStatusCode.ERROR, message: status });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    span.end();
    this.mcpStatusChanges.add(1, { server, status });
  }

  recordError(error: unknown): void {
    this.recordEvent("plugin_error", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  async forceFlush(): Promise<void> {
    this.flushToDisk();
    try {
      await this.traceProvider.forceFlush();
    } catch (error) {
      this.recordError(error);
    }
    try {
      await this.meterProvider.forceFlush();
    } catch (error) {
      this.recordError(error);
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.flushTimer);
    this.flushToDisk();
    for (const [key, entry] of this.toolStarts) {
      entry.span.setAttribute("tool.status", "aborted");
      entry.span.setStatus({ code: SpanStatusCode.ERROR, message: "plugin_shutdown" });
      entry.span.end();
      this.recordEvent("tool_aborted_on_shutdown", { key });
    }
    this.toolStarts.clear();
    try {
      await this.traceProvider.shutdown();
    } catch (error) {
      this.recordError(error);
    }
    try {
      await this.meterProvider.shutdown();
    } catch (error) {
      this.recordError(error);
    }
    this.flushToDisk();
  }

  private flushToDisk(): void {
    try {
      const spans = this.spanMemory.getFinishedSpans();
      if (spans.length > 0) {
        appendFileSync(this.spansPath, spans.map((span) => this.spanLine(span)).join(""));
        this.spanMemory.reset();
      }
    } catch (error) {
      this.recordError(error);
    }

    try {
      const metrics = this.metricMemory.getMetrics();
      if (metrics.length > 0) {
        appendFileSync(this.metricsPath, this.metricLines(metrics).join(""));
        this.metricMemory.reset();
      }
    } catch (error) {
      this.recordError(error);
    }
  }

  private spanLine(span: ReadableSpan): string {
    const context = span.spanContext();
    return `${safeJson({
      ts: new Date().toISOString(),
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: span.parentSpanContext?.spanId ?? null,
      name: span.name,
      startTimeUnixNano: span.startTime[0] * 1e9 + span.startTime[1],
      endTimeUnixNano: span.endTime[0] * 1e9 + span.endTime[1],
      attributes: span.attributes,
      status: span.status,
      events: span.events,
    })}\n`;
  }

  private metricLines(metrics: ResourceMetrics[]): string[] {
    const lines: string[] = [];
    for (const resource of metrics) {
      for (const scope of resource.scopeMetrics) {
        for (const metric of scope.metrics) {
          for (const dataPoint of this.dataPoints(metric)) {
            lines.push(
              `${safeJson({
                ts: new Date().toISOString(),
                name: metric.descriptor.name,
                unit: metric.descriptor.unit,
                attributes: dataPoint.attributes,
                value: this.dataPointValue(dataPoint),
                startTimeUnixNano: dataPoint.startTime,
                endTimeUnixNano: dataPoint.endTime,
              })}\n`,
            );
          }
        }
      }
    }
    return lines;
  }

  private dataPoints(metric: MetricData): Array<{
    attributes: unknown;
    startTime: number;
    endTime: number;
    value?: unknown;
    count?: number;
    sum?: number;
    min?: number;
    max?: number;
  }> {
    return (metric.dataPoints ?? []) as never;
  }

  private dataPointValue(dataPoint: {
    value?: unknown;
    count?: number;
    sum?: number;
    min?: number;
    max?: number;
  }): unknown {
    if (typeof dataPoint.value === "number") return dataPoint.value;
    if (dataPoint.value && typeof dataPoint.value === "object") return dataPoint.value;
    return {
      count: dataPoint.count,
      sum: dataPoint.sum,
      min: dataPoint.min,
      max: dataPoint.max,
    };
  }

  private recordEvent(type: string, payload: Record<string, unknown>): void {
    try {
      appendFileSync(
        this.eventsPath,
        `${safeJson({ ts: new Date().toISOString(), type, ...payload })}\n`,
      );
    } catch {
      // Diagnóstico é best-effort.
    }
  }
}
