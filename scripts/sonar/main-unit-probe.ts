import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const nonnegative = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

export function sourceActions(payload: unknown): string[] {
  if (!record(payload) || !Array.isArray(payload.webServices))
    throw new Error("API catalog shape unavailable");
  const service = payload.webServices.find((v) => record(v) && v.path === "api/sources");
  if (!record(service) || !Array.isArray(service.actions)) return [];
  return service.actions.flatMap((v) =>
    record(v) && typeof v.key === "string" && /^[a-z_]+$/.test(v.key) ? [v.key] : [],
  );
}

// Source code, SCM authors and arbitrary response strings are deliberately discarded.
// This is a capability probe of one file, never a complete denominator or a coverage credit.
export function coverageMetadata(payload: unknown) {
  if (!record(payload) || !Array.isArray(payload.sources))
    throw new Error("source rows unavailable");
  const seen = new Set<number>();
  const rows = payload.sources.map((value) => {
    if (
      !record(value) ||
      !Number.isInteger(value.line) ||
      (value.line as number) < 1 ||
      seen.has(value.line as number)
    )
      throw new Error("source line identity unavailable");
    const line = value.line as number;
    seen.add(line);
    for (const key of ["lineHits", "conditions", "coveredConditions"])
      if (value[key] !== undefined && !nonnegative(value[key]))
        throw new Error("invalid source coverage count");
    if (value.isNew !== undefined && typeof value.isNew !== "boolean")
      throw new Error("invalid new-code marker");
    if (
      typeof value.conditions === "number" &&
      typeof value.coveredConditions === "number" &&
      value.coveredConditions > value.conditions
    )
      throw new Error("inconsistent source condition counts");
    return {
      line,
      isNew: typeof value.isNew === "boolean" ? value.isNew : null,
      lineHits: nonnegative(value.lineHits) ? value.lineHits : null,
      conditions: nonnegative(value.conditions) ? value.conditions : null,
      coveredConditions: nonnegative(value.coveredConditions) ? value.coveredConditions : null,
    };
  });
  if (rows.length === 0) throw new Error("empty source discovery");
  return {
    rows,
    count: rows.length,
    hasNewMarkers: rows.some((r) => r.isNew !== null),
    hasCoverageCounts: rows.some((r) => r.lineHits !== null || r.conditions !== null),
  };
}

function metric(component: RecordValue, key: string): number | null {
  if (!Array.isArray(component.measures)) return null;
  const measure = component.measures.find((v) => record(v) && v.metric === key);
  if (!record(measure)) return null;
  const period = record(measure.period)
    ? measure.period
    : Array.isArray(measure.periods)
      ? measure.periods.find((v) => record(v) && v.index === 1)
      : null;
  const raw = measure.value ?? (record(period) ? period.value : null);
  return typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null;
}

async function main() {
  const root = process.env.RUNNER_TEMP ?? ".";
  const file = resolve(root, "c26-main-unit-probe.json");
  const report: RecordValue = {
    schema: "main-unit-probe/1",
    observedAt: new Date().toISOString(),
    verdict: "NO-VERDICT",
    scope: "one-file capability probe; no unit credit",
    requests: [],
  };
  const requests = report.requests as RecordValue[];
  const sonarToken = process.env.SONAR_TOKEN,
    githubToken = process.env.GITHUB_TOKEN;
  try {
    if (!sonarToken || !githubToken)
      throw new Error("SONAR_TOKEN/GITHUB_TOKEN unavailable (names only)");
    const baseline = JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"));
    report.mainSha = baseline.mainSha;
    report.analysisId = baseline.analysisId;
    async function get(origin: "sonar" | "github", endpoint: string) {
      const base = origin === "sonar" ? "https://sonarcloud.io/api/" : "https://api.github.com/";
      const started = Date.now();
      const response = await fetch(new URL(endpoint, base), {
        headers: {
          Authorization: `Bearer ${origin === "sonar" ? sonarToken : githubToken}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      requests.push({
        origin,
        path: endpoint.split("?")[0],
        status: response.status,
        latencyMs: Date.now() - started,
      });
      if (!response.ok)
        throw new Error(`${origin} ${endpoint.split("?")[0]} HTTP ${response.status}`);
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error("API payload exceeds probe limit");
      try {
        return JSON.parse(body);
      } catch {
        throw new Error("API response is not JSON");
      }
    }
    async function assertIdentity() {
      const ref = await get("github", "repos/Douglas0101/preco-que-da-lucro/branches/main");
      const analyses = await get(
        "sonar",
        "project_analyses/search?project=Douglas0101_preco-que-da-lucro&branch=main&ps=1",
      );
      if (
        ref.commit?.sha !== baseline.mainSha ||
        analyses.analyses?.[0]?.key !== baseline.analysisId
      )
        throw new Error("main SHA/analysis changed during unit probe");
    }
    await assertIdentity();
    const catalog = await get("sonar", "webservices/list?include_internals=true");
    const actions = sourceActions(catalog);
    report.sourceActions = actions;
    const action = actions.includes("lines") ? "lines" : actions.includes("show") ? "show" : null;
    if (!action) throw new Error("catalog advertises no source row endpoint");
    const tree = await get(
      "sonar",
      "measures/component_tree?component=Douglas0101_preco-que-da-lucro&branch=main&qualifiers=FIL&metricKeys=new_lines_to_cover,new_uncovered_lines,new_conditions_to_cover,new_uncovered_conditions&ps=500&p=1",
    );
    if (
      !Array.isArray(tree.components) ||
      !nonnegative(tree.paging?.total) ||
      tree.paging.total > tree.components.length
    )
      throw new Error("file discovery empty/incomplete; no ranking inferred");
    const files = tree.components.filter(
      (v: unknown): v is RecordValue =>
        record(v) &&
        typeof v.key === "string" &&
        typeof v.path === "string" &&
        /^src\/(?!test\/)[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx)$/.test(v.path) &&
        !v.path.includes("..") &&
        (metric(v, "new_lines_to_cover") ?? 0) > 0,
    );
    report.selection =
      "first file with a measured nonempty new-line target; not a coverage ranking";
    const selected = files[0];
    if (!selected) throw new Error("no eligible measured source file");
    report.selectedFile = selected.path;
    report.fileMetrics = Object.fromEntries(
      [
        "new_lines_to_cover",
        "new_uncovered_lines",
        "new_conditions_to_cover",
        "new_uncovered_conditions",
      ].map((key) => [key, metric(selected, key)]),
    );
    report.endpoint = `sources/${action}`;
    const result = await get(
      "sonar",
      `sources/${action}?${new URLSearchParams({ key: String(selected.key), branch: "main", from: "1", to: "500" })}`,
    );
    report.metadata = coverageMetadata(result);
    await assertIdentity();
    report.reason =
      "capability observed; complete source/instrumentation/condition mapping still required";
    console.log(`C26_UNIT_CAPABILITY ${JSON.stringify(report)}`);
  } catch (error) {
    // Network errors can contain data supplied by a remote service. Never emit their message.
    const safe =
      error instanceof Error &&
      /^(SONAR_TOKEN|main SHA|catalog |file discovery|no eligible|source |invalid |inconsistent |empty |API |sonar [a-z_]+\/|github repos\/)/.test(
        error.message,
      )
        ? error.message
        : "request unavailable; no raw remote error persisted";
    report.reason = safe;
    console.error(`NO-VERDICT unit probe: ${safe}`);
    process.exitCode = 2;
  } finally {
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
