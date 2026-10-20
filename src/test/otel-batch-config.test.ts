import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OTEL_BATCH_CONFIG,
  ensureTelemetryStarted,
  isTelemetryStarted,
  resolveOtelSdkConfig,
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
});

describe("OB-02 — lazy-load do SDK", () => {
  it("sem endpoint OTLP não inicia o SDK nem toca no import dinâmico", () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "");
    ensureTelemetryStarted();
    expect(isTelemetryStarted()).toBe(false);
  });
});
