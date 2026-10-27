import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OTEL_BATCH_CONFIG,
  createSpanProcessor,
  createTelemetrySdk,
  ensureTelemetryStarted,
  isTelemetryStarted,
  resolveOtelSdkConfig,
  shouldStartTelemetry,
  type TelemetrySdkDependencies,
} from "@/instrumentation/telemetry";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OB-03 — tuning do exportador em lote", () => {
  it("fixa janela, lote e timeout e não pode ser mutado em runtime", () => {
    expect(OTEL_BATCH_CONFIG).toEqual({
      scheduledDelayMillis: 10_000,
      maxExportBatchSize: 512,
      exportTimeoutMillis: 5_000,
    });
    expect(Object.isFrozen(OTEL_BATCH_CONFIG)).toBe(true);
  });

  it("mantém o intervalo de métricas em 15 s por padrão", () => {
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", "");
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(15_000);
  });

  it("recusa intervalo abaixo do exportTimeoutMillis que derrubaria o SDK", () => {
    // Medido no smoke DBT-148: 1.000 ms faz o PeriodicExportingMetricReader
    // lançar e a telemetria inteira (traces inclusive) fica desligada.
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", "1000");
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(15_000);
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", "4999");
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(15_000);
    vi.stubEnv("OTEL_METRIC_EXPORT_INTERVAL_MS", "5000");
    expect(resolveOtelSdkConfig().exportIntervalMillis).toBe(5_000);
  });
});

describe("OB-02 — lazy-load do SDK", () => {
  it("sem endpoint OTLP não inicia o SDK nem toca no import dinâmico", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    await ensureTelemetryStarted();
    expect(isTelemetryStarted()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A FIAÇÃO do `BatchSpanProcessor`.
//
// O teste antigo fixava a CONSTANTE e o "SDK não inicia sem endpoint", mas
// nada provava que o `BatchSpanProcessor` recebia `{...OTEL_BATCH_CONFIG}` —
// um `new BatchSpanProcessor(exporter)` sem o segundo argumento, ou com outro
// objeto, passaria verde. A costura (`createSpanProcessor` /
// `createTelemetrySdk`) torna a construção observável sem mudar a semântica
// de produção: a produção chama exatamente estas funções.
// ─────────────────────────────────────────────────────────────────────────────

interface ConstrutorObservado {
  exporter: unknown;
  config: unknown;
}

function dublês() {
  const batchCalls: ConstrutorObservado[] = [];
  const traceExporterCalls: { url: string }[] = [];
  const metricExporterCalls: { url: string }[] = [];
  const metricReaderCalls: {
    exporter: unknown;
    exportIntervalMillis: number;
    exportTimeoutMillis: number;
  }[] = [];
  const nodeSdkCalls: { config: Record<string, unknown> }[] = [];

  class FakeBatchSpanProcessor {
    constructor(exporter: unknown, config: unknown) {
      batchCalls.push({ exporter, config });
    }
  }
  class FakeTraceExporter {
    constructor(config: { url: string }) {
      traceExporterCalls.push(config);
    }
  }
  class FakeMetricExporter {
    constructor(config: { url: string }) {
      metricExporterCalls.push(config);
    }
  }
  class FakeMetricReader {
    constructor(config: {
      exporter: unknown;
      exportIntervalMillis: number;
      exportTimeoutMillis: number;
    }) {
      metricReaderCalls.push(config);
    }
  }
  class FakeNodeSdk {
    constructor(config: Record<string, unknown>) {
      nodeSdkCalls.push({ config });
    }
    start(): void {}
    async shutdown(): Promise<void> {}
  }

  const deps = {
    NodeSDK: FakeNodeSdk,
    OTLPTraceExporter: FakeTraceExporter,
    OTLPMetricExporter: FakeMetricExporter,
    PeriodicExportingMetricReader: FakeMetricReader,
    BatchSpanProcessor: FakeBatchSpanProcessor,
  } as unknown as TelemetrySdkDependencies;

  return {
    deps,
    batchCalls,
    traceExporterCalls,
    metricExporterCalls,
    metricReaderCalls,
    nodeSdkCalls,
    FakeBatchSpanProcessor,
  };
}

describe("fiação real do BatchSpanProcessor", () => {
  it("constrói o processador com o tuning do módulo, não com outro objeto", () => {
    const { batchCalls, FakeBatchSpanProcessor } = dublês();
    const exporter = { marker: "exporter-de-traces" };
    createSpanProcessor(exporter, FakeBatchSpanProcessor);
    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]?.exporter).toBe(exporter);
    expect(batchCalls[0]?.config).toEqual({
      scheduledDelayMillis: 10_000,
      maxExportBatchSize: 512,
      exportTimeoutMillis: 5_000,
    });
    // E o objeto entregue é uma CÓPIA do tuning congelado: o SDK não recebe
    // a referência congelada (e nem poderia mutá-la).
    expect(batchCalls[0]?.config).not.toBe(OTEL_BATCH_CONFIG);
    expect(batchCalls[0]?.config).toEqual(OTEL_BATCH_CONFIG);
  });

  it("entrega ao NodeSDK o MESMO processador construído com o tuning", () => {
    const d = dublês();
    const { sdk, spanProcessor } = createTelemetrySdk(d.deps, {
      serviceName: "preco-que-da-lucro",
      endpoint: "https://collector.exemplo/otlp",
      exportIntervalMillis: 15_000,
    });
    expect(d.batchCalls).toHaveLength(1);
    expect(d.batchCalls[0]?.config).toEqual(OTEL_BATCH_CONFIG);
    // Identidade: o processador que o SDK recebe é o que o factory construiu.
    expect(d.nodeSdkCalls[0]?.config.spanProcessors).toEqual([spanProcessor]);
    expect(typeof sdk.start).toBe("function");
  });

  it("aponta o exportador de traces para o endpoint de traces e o de métricas para o de métricas", () => {
    const d = dublês();
    createTelemetrySdk(d.deps, {
      serviceName: "preco-que-da-lucro",
      endpoint: "https://collector.exemplo/otlp",
      exportIntervalMillis: 15_000,
    });
    expect(d.traceExporterCalls).toEqual([{ url: "https://collector.exemplo/otlp/v1/traces" }]);
    expect(d.metricExporterCalls).toEqual([{ url: "https://collector.exemplo/otlp/v1/metrics" }]);
    // O leitor periódico herda o timeout do tuning do módulo.
    expect(d.metricReaderCalls[0]?.exportIntervalMillis).toBe(15_000);
    expect(d.metricReaderCalls[0]?.exportTimeoutMillis).toBe(OTEL_BATCH_CONFIG.exportTimeoutMillis);
  });

  it("o SDK não é iniciado sem endpoint OTLP (decisão, não observação de flag)", () => {
    expect(shouldStartTelemetry({ started: false, starting: false, endpoint: undefined })).toBe(
      false,
    );
    expect(shouldStartTelemetry({ started: false, starting: false, endpoint: "" })).toBe(false);
    expect(shouldStartTelemetry({ started: true, starting: false, endpoint: "https://x" })).toBe(
      false,
    );
    expect(shouldStartTelemetry({ started: false, starting: true, endpoint: "https://x" })).toBe(
      false,
    );
    expect(shouldStartTelemetry({ started: false, starting: false, endpoint: "https://x" })).toBe(
      true,
    );
  });
});
