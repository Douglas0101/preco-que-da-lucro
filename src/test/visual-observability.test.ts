import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { context, metrics, trace, type Span } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricData,
} from "@opentelemetry/sdk-metrics";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { brl, num } from "@/lib/format";
import {
  assertNoSecretLeaks,
  findSecretLeaks,
  redactA11ySnapshot,
  redactDomSnapshot,
  redactPng,
  redactText,
  VisualRedactionError,
  VisualRedactionLeakError,
  type DomNodeSnapshot,
} from "@/lib/observability/visual-redaction";
import {
  assertBadgeAbsent,
  assertBadgePresent,
  assertCLSBelowThreshold,
  assertIncompleteDisplayed,
  assertNoNaNasZero,
  assertNoSecretLeak,
  assertNumericDisplay,
  assertTenantIsolation,
  findNonFiniteTokens,
  summarizeResults,
} from "@/lib/observability/visual-verification";
import {
  buildRedactedCapture,
  isoStamp,
  persistVisualCapture,
  sha256Hex,
  visualArtifactPaths,
} from "@/lib/observability/visual-perception";
import {
  correlateWithTrace,
  recordAnomaly,
  recordAssertion,
  recordRedaction,
  recordScreenshotLatency,
  VISUAL_METRICS,
  VISUAL_SPAN_NAME,
  withVisualSpan,
} from "@/lib/observability/visual-correlation";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMAIL = "foo.bar@example.com";
const RAW_SECRET = "supersecretvalue123";

function pngChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length, 0);
  // O CRC não é validado pelo redator; zeros bastam para exercitar o walk.
  return Buffer.concat([header, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
}

function pngWithText(text: string): Buffer {
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", Buffer.alloc(13)),
    pngChunk("tEXt", Buffer.from(`Comment\u0000${text}`, "latin1")),
    pngChunk("IDAT", Buffer.from([1, 2, 3, 4])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function cleanPng(): Buffer {
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", Buffer.alloc(13)),
    pngChunk("IDAT", Buffer.from([1, 2, 3, 4])),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function sumOf(metric: MetricData | undefined): number {
  if (!metric) return 0;
  return metric.dataPoints.reduce((total, point) => {
    return total + Number((point as { value?: number }).value ?? 0);
  }, 0);
}

function countOf(metric: MetricData | undefined): number {
  if (!metric) return 0;
  return metric.dataPoints.reduce((total, point) => {
    // Em histogramas o count vive dentro de `point.value`, não no ponto.
    const value = (point as { value?: number | { count?: number } }).value;
    const count = typeof value === "number" ? value : (value?.count ?? 0);
    return total + Number(count);
  }, 0);
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("visual-redaction", () => {
  it("redige valor de env cujo nome parece segredo e é idempotente", () => {
    const env = { DATABASE_URL: RAW_SECRET };
    const once = redactText(`token bruto: ${RAW_SECRET}`, env);
    expect(once.value).toBe("token bruto: [REDACTED:env:DATABASE_URL]");
    expect(once.applied).toBe(1);
    const twice = redactText(once.value, env);
    expect(twice.value).toBe(once.value);
    expect(twice.applied).toBe(0);
  });

  it("não redige prosa limpa, valor curto nem nome público (controle negativo)", () => {
    expect(redactText("texto comum", { DATABASE_URL: RAW_SECRET }).applied).toBe(0);
    expect(redactText("valor curto: abc", { DATABASE_URL: "abc" }).value).toBe("valor curto: abc");
    expect(redactText(`nome público: ${RAW_SECRET}`, { PUBLIC_NAME: RAW_SECRET }).value).toBe(
      `nome público: ${RAW_SECRET}`,
    );
  });

  it("redige assignment, bearer e JWT", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const bearer = "abcdefghijklmnopqrstuvwxyz";
    const result = redactText(
      [`BETTER_AUTH_SECRET="${RAW_SECRET}"`, `Authorization: Bearer ${bearer}`, `jwt ${jwt}`].join(
        "\n",
      ),
      {},
    );
    expect(result.value).not.toContain(RAW_SECRET);
    expect(result.value).not.toContain(bearer);
    expect(result.value).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(result.value).toContain("[REDACTED:secret]");
    expect(result.applied).toBeGreaterThanOrEqual(3);
  });

  it("redige PII (email, CPF e telefone)", () => {
    const result = redactText(
      "contato foo.bar@example.com CPF 529.982.247-25 tel (11) 98765-4321",
      {},
    );
    expect(result.value).not.toContain(EMAIL);
    expect(result.value).not.toContain("529.982.247-25");
    expect(result.value).not.toContain("98765-4321");
    expect(result.applied).toBeGreaterThanOrEqual(3);
  });

  it("findSecretLeaks denuncia o tipo sem expor o valor; assertNoSecretLeaks falha fechado", () => {
    const env = { DATABASE_URL: RAW_SECRET };
    expect(findSecretLeaks("nada aqui", env)).toEqual([]);
    const leaks = findSecretLeaks(`vazou ${RAW_SECRET}`, env);
    expect(leaks).toContain("env:DATABASE_URL");
    expect(JSON.stringify(leaks)).not.toContain(RAW_SECRET);
    expect(() => assertNoSecretLeaks(`vazou ${RAW_SECRET}`, env)).toThrow(VisualRedactionLeakError);
    expect(() => assertNoSecretLeaks("limpo", env)).not.toThrow();
  });

  it("redige a árvore de acessibilidade (precedente L239)", () => {
    const snapshot = ["- settings:", "  - text: DATABASE_URL", `  - text: ${EMAIL}`].join("\n");
    const result = redactA11ySnapshot(snapshot, { DATABASE_URL: EMAIL });
    expect(result.value).not.toContain(EMAIL);
    expect(result.value).toContain("[REDACTED");
  });

  it("redige DOM recursivamente (atributos e texto)", () => {
    const dom: DomNodeSnapshot = {
      tag: "form",
      attributes: { action: "/api", "data-token": "Bearer abcdefghijklmnopqrstuvwxyz" },
      children: [{ tag: "span", attributes: {}, text: `contato ${EMAIL}` }],
    };
    const result = redactDomSnapshot(dom, {});
    const serialized = JSON.stringify(result.value);
    expect(serialized).not.toContain(EMAIL);
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(result.applied).toBeGreaterThanOrEqual(2);
  });

  it("reprova árvore profunda demais", () => {
    let deep: DomNodeSnapshot = { tag: "span", attributes: {} };
    for (let index = 0; index < 200; index += 1) {
      deep = { tag: "span", attributes: {}, children: [deep] };
    }
    expect(() => redactDomSnapshot(deep)).toThrow(VisualRedactionError);
  });

  it("remove chunks de texto do PNG preservando os demais bytes", () => {
    const input = pngWithText(EMAIL);
    const result = redactPng(input);
    expect(result.applied).toBe(1);
    expect(result.value.length).toBeLessThan(input.length);
    expect(result.value.toString("latin1")).not.toContain("tEXt");
    expect(result.value.equals(cleanPng())).toBe(true);
  });

  it("reprova payload que não é PNG ou está truncado", () => {
    expect(() => redactPng(Buffer.from("não é png"))).toThrow(VisualRedactionError);
    expect(() => redactPng(pngWithText(EMAIL).subarray(0, 20))).toThrow(VisualRedactionError);
  });
});

describe("visual-verification", () => {
  it("assertBadgePresent/Absent normalizam o rótulo e falham pelo tipo certo", () => {
    expect(assertBadgePresent([" real "], "REAL").ok).toBe(true);
    const missing = assertBadgePresent(["REAL"], "SIMULAÇÃO");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.failureType).toBe("badge-missing");
    expect(assertBadgeAbsent(["REAL"], "SIMULAÇÃO").ok).toBe(true);
    const unexpected = assertBadgeAbsent(["simulação"], "SIMULAÇÃO");
    expect(unexpected.ok).toBe(false);
    if (!unexpected.ok) expect(unexpected.failureType).toBe("badge-unexpected");
  });

  it("encontra tokens não finitos como tokens, não dentro de palavras", () => {
    expect(findNonFiniteTokens("R$ NaN")).toEqual(["NaN"]);
    expect(findNonFiniteTokens("Infinity e ∞")).toEqual(["Infinity", "∞"]);
    expect(findNonFiniteTokens("InfinityCard")).toEqual([]);
    expect(findNonFiniteTokens("NaN NaN")).toEqual(["NaN"]);
  });

  it("não aceita NaN renderizado como valor (INV-007)", () => {
    expect(assertNoNaNasZero("R$ 0,00").ok).toBe(true);
    const failed = assertNoNaNasZero("Total: R$ NaN");
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.failureType).toBe("nan-rendered");
  });

  it("bate com o oráculo do format.ts e reprova as duas direções", () => {
    expect(assertNumericDisplay(brl(Number.NaN), "invalid").ok).toBe(true);
    expect(assertNumericDisplay(brl(Number.POSITIVE_INFINITY), "infinite").ok).toBe(true);
    expect(assertNumericDisplay(num(null), "incomplete").ok).toBe(true);
    expect(assertNumericDisplay(brl(123.45), "ok").ok).toBe(true);
    const asZero = assertNumericDisplay("R$ 0,00", "invalid");
    expect(asZero.ok).toBe(false);
    if (!asZero.ok) expect(asZero.failureType).toBe("invalid-as-zero");
    const incompleteAsFact = assertNumericDisplay("R$ 0,00", "incomplete");
    expect(incompleteAsFact.ok).toBe(false);
    if (!incompleteAsFact.ok) expect(incompleteAsFact.failureType).toBe("incomplete-not-displayed");
    expect(assertNumericDisplay("—", "ok").ok).toBe(false);
  });

  it("exige fallback explícito para dado incompleto (INV-006)", () => {
    expect(assertIncompleteDisplayed("Custo: —").ok).toBe(true);
    expect(assertIncompleteDisplayed("dados incompletos para o cálculo").ok).toBe(true);
    expect(assertIncompleteDisplayed("Custo: R$ 0,00").ok).toBe(false);
  });

  it("CLS falha em valor não finito, negativo ou no teto", () => {
    expect(assertCLSBelowThreshold(0.099).ok).toBe(true);
    expect(assertCLSBelowThreshold(0.2, 0.25).ok).toBe(true);
    expect(assertCLSBelowThreshold(0.1).ok).toBe(false);
    expect(assertCLSBelowThreshold(Number.NaN).ok).toBe(false);
    expect(assertCLSBelowThreshold(-0.01).ok).toBe(false);
  });

  it("isolamento de tenant sem marcador é uma assertion sem valor (controle negativo)", () => {
    expect(assertTenantIsolation("Produto A", ["MARCA-TENANT-B"]).ok).toBe(true);
    const leak = assertTenantIsolation("Produto da MARCA-TENANT-B", ["MARCA-TENANT-B"]);
    expect(leak.ok).toBe(false);
    if (!leak.ok) expect(leak.failureType).toBe("tenant-leak");
    const vacuous = assertTenantIsolation("Produto A", []);
    expect(vacuous.ok).toBe(false);
    if (!vacuous.ok) expect(vacuous.failureType).toBe("tenant-leak");
  });

  it("assertNoSecretLeak lê o ambiente vivo e falha fechado", () => {
    process.env.VISUAL_TEST_SECRET = RAW_SECRET;
    try {
      expect(assertNoSecretLeak(`vazou ${RAW_SECRET}`).ok).toBe(false);
      expect(assertNoSecretLeak("texto limpo").ok).toBe(true);
    } finally {
      delete process.env.VISUAL_TEST_SECRET;
    }
  });

  it("summarizeResults conta por tipo, não só cardinalidade", () => {
    const summary = summarizeResults([
      assertBadgePresent(["REAL"], "REAL"),
      assertIncompleteDisplayed("—"),
      assertBadgePresent([], "REAL"),
      assertCLSBelowThreshold(1),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(2);
    expect(summary.failuresByType["badge-missing"]).toBe(1);
    expect(summary.failuresByType["cls-above-threshold"]).toBe(1);
  });
});

describe("visual-perception", () => {
  it("sha256Hex bate com o vetor conhecido", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("isoStamp e visualArtifactPaths produzem nomes de arquivo seguros", () => {
    expect(isoStamp(new Date("2026-09-30T12:34:56.789Z"))).toBe("2026-09-30T12-34-56-789Z");
    expect(visualArtifactPaths("docs/evidence/visual", "stamp", "hash")).toEqual({
      png: "docs/evidence/visual/stamp-hash.png",
      a11y: "docs/evidence/visual/stamp-hash.a11y.json",
      dom: "docs/evidence/visual/stamp-hash.dom.json",
    });
  });

  it("buildRedactedCapture redige, mede sem dormir e hasheia o payload final", () => {
    const ticks = [100, 175];
    let index = 0;
    const capture = buildRedactedCapture(
      {
        label: "produtos",
        screenshotPng: pngWithText(EMAIL),
        a11ySnapshot: `contato ${EMAIL}`,
        domSnapshot: { tag: "div", attributes: { title: EMAIL } },
        correlationId: "corr-1",
      },
      () => ticks[Math.min(index++, ticks.length - 1)],
    );
    expect(capture.durationMs).toBe(75);
    expect(capture.beforeHash).not.toBe(capture.hash);
    expect(capture.hash).toBe(sha256Hex(capture.screenshotPng));
    expect(capture.a11ySnapshot).not.toContain(EMAIL);
    expect(capture.redactionsApplied).toBeGreaterThanOrEqual(3);
    expect(capture.correlationId).toBe("corr-1");
  });

  it("captura limpa não muda o hash nem conta redações (controle negativo)", () => {
    const capture = buildRedactedCapture({
      label: "produtos",
      screenshotPng: cleanPng(),
      a11ySnapshot: "sem dados sensíveis",
      domSnapshot: { tag: "div", attributes: {} },
    });
    expect(capture.redactionsApplied).toBe(0);
    expect(capture.hash).toBe(capture.beforeHash);
    expect(capture.correlationId).toBeNull();
  });

  it("persistVisualCapture escreve o trio selado e rejeita pixels vazios", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "visual-evidence-"));
    const capture = buildRedactedCapture({
      label: "produtos",
      screenshotPng: pngWithText(EMAIL),
      a11ySnapshot: `contato ${EMAIL}`,
      domSnapshot: { tag: "div", attributes: { title: EMAIL } },
    });
    const persisted = await persistVisualCapture(capture, { dir: tempDir, timestamp: "stamp" });
    expect(persisted.a11y.endsWith(".a11y.json")).toBe(true);
    const a11y = await readFile(persisted.a11y, "utf8");
    expect(a11y).not.toContain(EMAIL);
    expect(a11y).toContain(capture.hash);
    const png = await readFile(persisted.png);
    expect(png.equals(capture.screenshotPng)).toBe(true);
    await expect(
      persistVisualCapture({ ...capture, screenshotPng: Buffer.alloc(0) }, { dir: tempDir }),
    ).rejects.toThrow(VisualRedactionError);
  });
});

describe("visual-correlation", () => {
  // Sem um gerenciador de contexto de verdade, `context.with`/`getActiveSpan` são
  // no-ops e a correlação pareceria quebrada por motivo errado.
  context.setGlobalContextManager(new AsyncLocalStorageContextManager());

  it("os nomes de span e de métrica são o contrato do §19.7", () => {
    expect(VISUAL_SPAN_NAME).toBe("visual_agent.iteration");
    expect(VISUAL_METRICS).toEqual({
      passRate: "visual.assertion.pass_rate",
      failureRate: "visual.assertion.failure_rate",
      redactionApplied: "visual.redaction.applied",
      screenshotLatency: "visual.screenshot.latency_ms",
      anomalyDetected: "visual.anomaly.detected",
    });
  });

  it("correlateWithTrace sem span ativo devolve traceId nulo, não inventa", () => {
    expect(correlateWithTrace("hash-1", "corr-1")).toEqual({
      screenshotHash: "hash-1",
      correlationId: "corr-1",
      traceId: null,
    });
    expect(correlateWithTrace("hash-2").correlationId).toBeNull();
  });

  it("correlateWithTrace extrai o traceId utilizável e recusa o zerado", () => {
    const fakeSpan = (traceId: string) =>
      ({
        spanContext: () => ({ traceId, spanId: "b".repeat(16), traceFlags: 1 }),
      }) as unknown as Span;
    const valid = context.with(trace.setSpan(context.active(), fakeSpan("a".repeat(32))), () =>
      correlateWithTrace("hash-3"),
    );
    expect(valid.traceId).toBe("a".repeat(32));
    const zero = context.with(trace.setSpan(context.active(), fakeSpan("0".repeat(32))), () =>
      correlateWithTrace("hash-4"),
    );
    expect(zero.traceId).toBeNull();
  });

  it("withVisualSpan devolve o corpo e propaga exceção sem engolir", () => {
    const attributes = {
      screenshotBeforeHash: "before",
      screenshotAfterHash: "after",
      outcome: "success" as const,
      redactionsApplied: 1,
      correlationId: null,
    };
    expect(withVisualSpan(attributes, () => 42)).toBe(42);
    expect(() =>
      withVisualSpan(attributes, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
  });

  it("exporta o span com os atributos do contrato e as cinco métricas", async () => {
    const spanExporter = new InMemorySpanExporter();
    const spanProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    });
    trace.setGlobalTracerProvider(spanProvider);
    const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
    const meterProvider = new MeterProvider({
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 60_000,
        }),
      ],
    });
    metrics.setGlobalMeterProvider(meterProvider);
    try {
      withVisualSpan(
        {
          screenshotBeforeHash: "before",
          screenshotAfterHash: "after",
          outcome: "success",
          redactionsApplied: 2,
          correlationId: "corr-9",
        },
        () => undefined,
      );
      expect(() =>
        withVisualSpan(
          {
            screenshotBeforeHash: "before",
            screenshotAfterHash: "after",
            outcome: "success",
            redactionsApplied: 0,
            correlationId: null,
          },
          () => {
            throw new Error("caminho de falha");
          },
        ),
      ).toThrow("caminho de falha");

      recordAssertion("badge-present:REAL", assertBadgePresent(["REAL"], "REAL"));
      recordAssertion("cls-below:0.1", assertCLSBelowThreshold(1));
      recordRedaction(3);
      recordScreenshotLatency(12.5);
      recordAnomaly("layout-shift");

      await spanProvider.forceFlush();
      const spans = spanExporter.getFinishedSpans();
      expect(spans).toHaveLength(2);
      const success = spans.find((span) => span.attributes["assertion.outcome"] === "success");
      expect(success?.name).toBe(VISUAL_SPAN_NAME);
      expect(success?.attributes["screenshot.before_hash"]).toBe("before");
      expect(success?.attributes["screenshot.after_hash"]).toBe("after");
      expect(success?.attributes["redactions_applied"]).toBe(2);
      expect(success?.attributes["correlation_id"]).toBe("corr-9");
      const failed = spans.find((span) => span.attributes["assertion.outcome"] === "fail");
      expect(failed).toBeDefined();

      await meterProvider.forceFlush();
      const exported = metricExporter
        .getMetrics()
        .flatMap((resource) => resource.scopeMetrics.flatMap((scope) => scope.metrics));
      const byName = new Map(exported.map((metric) => [metric.descriptor.name, metric]));
      expect(sumOf(byName.get(VISUAL_METRICS.passRate))).toBe(1);
      expect(sumOf(byName.get(VISUAL_METRICS.failureRate))).toBe(1);
      expect(sumOf(byName.get(VISUAL_METRICS.redactionApplied))).toBe(3);
      expect(countOf(byName.get(VISUAL_METRICS.screenshotLatency))).toBe(1);
      expect(sumOf(byName.get(VISUAL_METRICS.anomalyDetected))).toBe(1);

      const tracer = spanProvider.getTracer("visual-correlation-test");
      let realTraceId = "";
      const correlated = tracer.startActiveSpan("correlate.real", (span) => {
        realTraceId = span.spanContext().traceId;
        const result = correlateWithTrace("hash-real", "corr-real");
        span.end();
        return result;
      });
      expect(correlated.traceId).toBe(realTraceId);
      expect(correlated.traceId).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      await spanProvider.shutdown();
      await meterProvider.shutdown();
      trace.setGlobalTracerProvider(new BasicTracerProvider());
      metrics.setGlobalMeterProvider(new MeterProvider());
    }
  });
});
