#!/usr/bin/env node
/**
 * Collector OTLP/HTTP local para a evidência do plugin de observabilidade.
 *
 * Não é um backend de produção: aceita os POSTs OTLP/HTTP JSON do plugin,
 * conta spans/métricas e grava um recibo em `docs/evidence/observability/`.
 * O arquivo legível (`spans.ndjson`/`metrics.ndjson`) é produzido pelo próprio
 * plugin via exporter in-memory; este processo prova o transporte OTLP.
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const root = process.cwd();
const outDir =
  process.env.OPENCODE_OBSERVABILITY_DIR ?? resolve(root, "docs/evidence/observability");
mkdirSync(outDir, { recursive: true });

const port = Number(process.env.OPENCODE_OBSERVABILITY_COLLECTOR_PORT ?? 4318);
const received = { traces: 0, spans: 0, metrics: 0, metricPoints: 0, failed: 0 };

function record(entry) {
  const line = `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`;
  appendFileSync(resolve(outDir, "otlp-transport.ndjson"), line);
}

function countSpans(payload) {
  if (!payload || !Array.isArray(payload.resourceSpans)) return 0;
  return payload.resourceSpans.reduce(
    (total, resource) =>
      total +
      (Array.isArray(resource.scopeSpans)
        ? resource.scopeSpans.reduce(
            (scopeTotal, scope) =>
              scopeTotal + (Array.isArray(scope.spans) ? scope.spans.length : 0),
            0,
          )
        : 0),
    0,
  );
}

function countMetricPoints(payload) {
  if (!payload || !Array.isArray(payload.resourceMetrics)) return 0;
  return payload.resourceMetrics.reduce(
    (total, resource) =>
      total +
      (Array.isArray(resource.scopeMetrics)
        ? resource.scopeMetrics.reduce(
            (scopeTotal, scope) =>
              scopeTotal +
              (Array.isArray(scope.metrics)
                ? scope.metrics.reduce((metricTotal, metric) => {
                    const direct = Array.isArray(metric.dataPoints) ? metric.dataPoints.length : 0;
                    const nested = ["sum", "gauge", "histogram", "exponentialHistogram"].reduce(
                      (sum, key) =>
                        sum +
                        (metric[key] && Array.isArray(metric[key].dataPoints)
                          ? metric[key].dataPoints.length
                          : 0),
                      0,
                    );
                    return metricTotal + direct + nested;
                  }, 0)
                : 0),
            0,
          )
        : 0),
    0,
  );
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, received }));
    return;
  }
  if (request.method === "GET" && request.url === "/summary") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(received));
    return;
  }
  if (request.method !== "POST" || !["/v1/traces", "/v1/metrics"].includes(request.url)) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      received.failed += 1;
      record({ kind: "parse_failed", path: request.url, bytes: raw.length });
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_json" }));
      return;
    }

    if (request.url === "/v1/traces") {
      received.traces += 1;
      received.spans += countSpans(payload);
      writeFileSync(
        resolve(outDir, "otlp-last-traces.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
      record({ kind: "traces", spans: countSpans(payload), bytes: raw.length });
    } else {
      received.metrics += 1;
      received.metricPoints += countMetricPoints(payload);
      writeFileSync(
        resolve(outDir, "otlp-last-metrics.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
      record({ kind: "metrics", metricPoints: countMetricPoints(payload), bytes: raw.length });
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      event: "collector.ready",
      port,
      outDir,
      timestamp: new Date().toISOString(),
    }),
  );
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
