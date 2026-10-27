#!/usr/bin/env node
/**
 * Dashboard local de observabilidade do OpenCode (fase 6 do SDD).
 *
 * Lê os JSONL produzidos pelo plugin e expõe:
 *  - /api/summary: contadores, p95, tokens, custo e alertas avaliados;
 *  - /: página estática com os mesmos dados.
 *
 * É um substituto local verificável para Grafana/SigNoz: não depende de rede,
 * não recebe credenciais e não finge um backend externo.
 */
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const root = process.cwd();
const dir = process.env.OPENCODE_OBSERVABILITY_DIR ?? resolve(root, "docs/evidence/observability");
const port = Number(process.env.OPENCODE_OBSERVABILITY_DASHBOARD_PORT ?? 4180);

function readLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarize() {
  const spans = readLines(resolve(dir, "spans.ndjson"));
  const metrics = readLines(resolve(dir, "metrics.ndjson"));
  const toolSpans = spans.filter((span) => span.name === "opencode.tool.call");
  const failures = toolSpans.filter(
    (span) =>
      span.attributes?.["tool.status"] === "error" ||
      span.attributes?.["tool.status"] === "blocked",
  );
  const blocked = toolSpans.filter((span) => span.attributes?.["tool.status"] === "blocked");
  const durations = toolSpans
    .map((span) => span.attributes?.["tool.duration_ms"])
    .filter((value) => typeof value === "number");
  const byTool = {};
  for (const span of toolSpans) {
    const tool = span.attributes?.["tool.name"] ?? "unknown";
    byTool[tool] ??= { total: 0, error: 0, blocked: 0 };
    byTool[tool].total += 1;
    if (span.attributes?.["tool.status"] === "error") byTool[tool].error += 1;
    if (span.attributes?.["tool.status"] === "blocked") byTool[tool].blocked += 1;
  }

  const tokens = {};
  let cost = 0;
  for (const metric of metrics) {
    if (metric.name === "opencode.llm.tokens") {
      const type = metric.attributes?.type ?? "unknown";
      tokens[type] = (tokens[type] ?? 0) + (typeof metric.value === "number" ? metric.value : 0);
    }
    if (metric.name === "opencode.llm.cost_usd" && typeof metric.value === "number") {
      cost += metric.value;
    }
  }

  const errorRate = toolSpans.length === 0 ? 0 : failures.length / toolSpans.length;
  const p95 = percentile(durations, 95);
  const maxDuration = durations.length > 0 ? Math.max(...durations) : null;
  const alerts = [];
  if (toolSpans.length > 0 && errorRate > 0.05) {
    alerts.push({
      severity: "high",
      name: "tool_error_rate",
      value: Number(errorRate.toFixed(4)),
      threshold: 0.05,
      message: "taxa de erro de tool calls acima de 5%",
    });
  }
  if (maxDuration !== null && maxDuration > 10_000) {
    alerts.push({
      severity: "high",
      name: "tool_max_latency_ms",
      value: maxDuration,
      threshold: 10_000,
      message: "uma tool call durou mais de 10 s",
    });
  }
  if (blocked.length > 0) {
    alerts.push({
      severity: "critical",
      name: "policy_violations",
      value: blocked.length,
      threshold: 0,
      message: "ao menos uma tentativa de violação de política foi bloqueada",
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    evidenceDir: dir,
    spans: {
      total: spans.length,
      toolCalls: toolSpans.length,
      failures: failures.length,
      blocked: blocked.length,
      errorRate: Number(errorRate.toFixed(4)),
      p95DurationMs: p95,
      maxDurationMs: maxDuration,
      byTool,
    },
    llm: { tokens, costUsd: Number(cost.toFixed(6)) },
    alerts,
  };
}

function page(summary) {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>OpenCode observability</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;background:#0f172a;color:#e2e8f0}
main{max-width:1100px;margin:0 auto;padding:32px}
h1{font-size:24px;margin:0 0 8px} .muted{color:#94a3b8}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin:24px 0}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px}
.value{font-size:28px;font-weight:700;margin-top:8px}
.alert{border-left:4px solid #ef4444;background:#450a0a;padding:12px;border-radius:8px;margin:8px 0}
.ok{border-left:4px solid #22c55e;background:#052e16;padding:12px;border-radius:8px}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:8px;border-bottom:1px solid #334155}
code{color:#93c5fd}
</style></head>
<body><main>
<h1>OpenCode — observabilidade local</h1>
<p class="muted">Evidência local (não é produção). Gerado em <span id="ts">${summary.generatedAt}</span>.</p>
<section class="grid">
  <div class="card"><div class="muted">Tool calls</div><div class="value">${summary.spans.toolCalls}</div></div>
  <div class="card"><div class="muted">Falhas / bloqueios</div><div class="value">${summary.spans.failures} / ${summary.spans.blocked}</div></div>
  <div class="card"><div class="muted">Taxa de erro</div><div class="value">${(summary.spans.errorRate * 100).toFixed(2)}%</div></div>
  <div class="card"><div class="muted">p95 duração</div><div class="value">${summary.spans.p95DurationMs ?? "—"} ms</div></div>
  <div class="card"><div class="muted">Tokens (delta)</div><div class="value">${Object.values(
    summary.llm.tokens,
  )
    .reduce((a, b) => a + b, 0)
    .toLocaleString("pt-BR")}</div></div>
  <div class="card"><div class="muted">Custo (USD)</div><div class="value">${summary.llm.costUsd.toFixed(6)}</div></div>
</section>
<h2>Alertas</h2>
${summary.alerts.length === 0 ? '<div class="ok">Nenhum alerta ativo.</div>' : summary.alerts.map((a) => `<div class="alert"><strong>${a.name}</strong> — ${a.message} <code>${a.value} &gt; ${a.threshold}</code></div>`).join("")}
<h2>Por ferramenta</h2>
<table><thead><tr><th>tool</th><th>total</th><th>erro</th><th>bloqueado</th></tr></thead><tbody>
${Object.entries(summary.spans.byTool)
  .map(
    ([tool, v]) =>
      `<tr><td>${tool}</td><td>${v.total}</td><td>${v.error}</td><td>${v.blocked}</td></tr>`,
  )
  .join("")}
</tbody></table>
<h2>Tokens por tipo</h2>
<table><thead><tr><th>tipo</th><th>delta</th></tr></thead><tbody>
${Object.entries(summary.llm.tokens)
  .map(([type, value]) => `<tr><td>${type}</td><td>${value.toLocaleString("pt-BR")}</td></tr>`)
  .join("")}
</tbody></table>
<p class="muted">Fonte: <code>${dir}</code>. O endpoint <code>/api/summary</code> devolve o mesmo JSON.</p>
</main></body></html>`;
}

const server = createServer((request, response) => {
  if (request.url === "/api/summary") {
    const summary = summarize();
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(summary, null, 2));
    return;
  }
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page(summarize()));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ event: "dashboard.ready", port, dir }));
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
