import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const dir =
  process.env.OPENCODE_OBSERVABILITY_DIR ?? resolve(process.cwd(), "docs/evidence/observability");

function lines(name: string): Record<string, any>[] {
  const path = resolve(dir, name);
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

const spans = lines("spans.ndjson");
const metrics = lines("metrics.ndjson");
const otlp = lines("otlp-transport.ndjson");
const boot = lines("plugin-boot.ndjson");
const policy = JSON.parse(readFileSync(resolve(dir, "captures/policy-check.json"), "utf8"));

const toolSpans = spans.filter((span) => span.name === "opencode.tool.call");
const usageSpans = spans.filter((span) => span.name === "opencode.llm.usage");
const mcpSpans = spans.filter((span) => span.name === "opencode.mcp.status");
const issues: string[] = [];

assert.ok(toolSpans.length > 0, "nenhum span de tool call");
assert.ok(usageSpans.length > 0, "nenhum span de uso de LLM");
assert.ok(mcpSpans.length > 0, "nenhum span de status MCP");

for (const span of toolSpans) {
  const a = span.attributes ?? {};
  for (const key of [
    "tool.name",
    "tool.session_id",
    "tool.message_id",
    "tool.call_id",
    "tool.status",
  ]) {
    if (typeof a[key] !== "string" && typeof a[key] !== "number") issues.push(`${key} ausente`);
  }
  if (typeof a["tool.duration_ms"] !== "number") issues.push("tool.duration_ms ausente");
}
for (const span of usageSpans) {
  const a = span.attributes ?? {};
  if (typeof a["session.id"] !== "string") issues.push("session.id ausente em usage");
  if (!["step", "session"].includes(a["usage.scope"])) issues.push("usage.scope ausente");
}
for (const span of mcpSpans) {
  const a = span.attributes ?? {};
  if (typeof a["mcp.server"] !== "string") issues.push("mcp.server ausente");
}

const blocked = toolSpans.filter((span) => span.attributes?.["tool.status"] === "blocked");
const failedMcp = mcpSpans.filter(
  (span) => span.attributes?.["error.type"] === "mcp.connection.failed",
);
const stepUsage = usageSpans.filter((span) => span.attributes?.["usage.scope"] === "step");
const sessionUsage = usageSpans.filter((span) => span.attributes?.["usage.scope"] === "session");
const orphan = spans.filter((span) => span.attributes?.["tool.orphan"] === true);
const traceReceipts = otlp.filter((entry) => entry.kind === "traces" && entry.spans > 0);
const metricReceipts = otlp.filter((entry) => entry.kind === "metrics" && entry.metricPoints > 0);
const tokenMetrics = metrics.filter((metric) => metric.name === "opencode.llm.tokens");
const toolCallMetrics = metrics.filter((metric) => metric.name === "opencode.tool.calls");
const durationMetrics = metrics.filter((metric) => metric.name === "opencode.tool.duration");
const bootSetup = boot.filter((entry) => entry.type === "setup");
const bootHooks = boot.filter(
  (entry) => entry.type === "tool.before" || entry.type === "tool.after",
);

assert.ok(blocked.length >= 2, "esperava ao menos 2 bloqueios de política");
assert.ok(blocked.some((span) => span.attributes?.["policy.rule"] === "sensitive_env_file"));
assert.ok(blocked.some((span) => span.attributes?.["policy.rule"] === "sensitive_env_shell"));
assert.ok(failedMcp.length >= 1, "esperava um span de MCP offline");
assert.ok(stepUsage.length >= 1, "esperava usage.scope=step");
assert.ok(sessionUsage.length >= 1, "esperava usage.scope=session");
assert.equal(orphan.length, 0, "spans órfãos encontrados");
assert.ok(traceReceipts.length >= 1, "nenhum recibo OTLP de traces");
assert.ok(metricReceipts.length >= 1, "nenhum recibo OTLP de metrics");
assert.ok(tokenMetrics.length >= 1, "nenhuma métrica de tokens");
assert.ok(toolCallMetrics.length >= 1, "nenhuma métrica de tool calls");
assert.ok(durationMetrics.length >= 1, "nenhuma métrica de duração");

const tokenTypes = ["input", "output", "reasoning", "cache_read", "cache_write"] as const;
// O próprio verificador é uma tool call e gera um passo novo; comparar o
// instante corrente com o exporter (10 s) daria diferença de janela. A
// reconciliação usa a janela assentada (>15 s), e o total fica no relatório.
const settledCutoff = new Date(Date.now() - 15_000).toISOString();
const settledStepUsage = stepUsage.filter((span) => String(span.ts) <= settledCutoff);
const settledTokenMetrics = tokenMetrics.filter((metric) => String(metric.ts) <= settledCutoff);
const settledCostMetrics = metrics.filter(
  (entry) => entry.name === "opencode.llm.cost_usd" && String(entry.ts) <= settledCutoff,
);
const stepSums: Record<string, number> = {
  input: 0,
  output: 0,
  reasoning: 0,
  cache_read: 0,
  cache_write: 0,
  cost: 0,
};
for (const span of settledStepUsage) {
  const a = span.attributes ?? {};
  for (const type of tokenTypes) stepSums[type] += Number(a[`llm.tokens.${type}`] ?? 0);
  stepSums.cost += Number(a["llm.cost_usd"] ?? 0);
}
const metricSums: Record<string, number> = {
  input: 0,
  output: 0,
  reasoning: 0,
  cache_read: 0,
  cache_write: 0,
  cost: 0,
};
for (const metric of settledTokenMetrics) {
  const type = metric.attributes?.type;
  if (tokenTypes.includes(type)) metricSums[type] += Number(metric.value ?? 0);
}
for (const metric of settledCostMetrics) {
  metricSums.cost += Number(metric.value ?? 0);
}
for (const type of tokenTypes) {
  assert.equal(metricSums[type], stepSums[type], `tokens ${type}: métrica != span de passo`);
}
assert.ok(
  Math.abs(metricSums.cost - stepSums.cost) < 1e-9,
  `custo: métrica ${metricSums.cost} != span ${stepSums.cost}`,
);

assert.ok(bootSetup.length >= 1, "plugin setup não registrado");
assert.ok(bootHooks.length >= 1, "hooks não registrados no boot log");
assert.equal(policy.checked, 17, "policy-check não cobre 17 casos");
assert.equal(policy.failed, 0, "policy-check tem falhas");

const report = {
  checked: toolSpans.length,
  toolSpans: toolSpans.length,
  usageSpans: usageSpans.length,
  stepUsage: stepUsage.length,
  sessionUsage: sessionUsage.length,
  mcpSpans: mcpSpans.length,
  blocked: blocked.length,
  failedMcp: failedMcp.length,
  orphan: orphan.length,
  bootSetup: bootSetup.length,
  bootHooks: bootHooks.length,
  tokenMetrics: tokenMetrics.length,
  toolCallMetrics: toolCallMetrics.length,
  durationMetrics: durationMetrics.length,
  tokenReconciliation: {
    settledCutoff,
    settledSteps: settledStepUsage.length,
    settledTokenMetrics: settledTokenMetrics.length,
    stepSums,
    metricSums,
  },
  traceReceipts: traceReceipts.length,
  metricReceipts: metricReceipts.length,
  policyCases: policy.checked,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length > 0) process.exit(1);
