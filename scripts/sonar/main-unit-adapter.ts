import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { apiReader, type RequestObservation } from "./api.ts";
import { coverageMetadata } from "./main-unit-probe.ts";
import { authoritativeUnits, lcovUnits, type MainSnapshot } from "./unit-mirror.ts";

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export interface LcovProvenance {
  schema: "sonar-lcov-provenance/1";
  revision: string;
  analysisId: string;
  taskId: string;
  branch: string;
  pullRequest: string | null;
  instrumentation: string;
  lcovSha256: string;
  coverageSensorObserved: true;
  sourceHashes: Record<string, string>;
  periodDigest: string | null;
  mainUnits: ReturnType<typeof authoritativeUnits> | null;
}
export interface UnitSnapshot extends MainSnapshot {
  schema: "main-unit-snapshot/1";
  periodDigest: string;
  baselineLcovSha256: string;
  metadataDigest: string;
  discoveredFiles: string[];
}
export interface FileMetadata {
  path: string;
  key: string;
  metrics: Record<string, number | null>;
  rows: ReturnType<typeof coverageMetadata>["rows"];
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const sourcePath = (path: string) =>
  /^src\/(?!test\/)[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx)$/.test(path) && !path.includes("..");
const metricNames = [
  "new_lines_to_cover",
  "new_uncovered_lines",
  "new_conditions_to_cover",
  "new_uncovered_conditions",
] as const;

export function provenance(value: unknown, lcov: string): LcovProvenance {
  if (
    !record(value) ||
    value.schema !== "sonar-lcov-provenance/1" ||
    !/^[a-f0-9]{40}$/.test(String(value.revision)) ||
    typeof value.analysisId !== "string" ||
    !value.analysisId ||
    typeof value.taskId !== "string" ||
    !value.taskId ||
    typeof value.branch !== "string" ||
    !value.branch ||
    !(value.pullRequest === null || typeof value.pullRequest === "string") ||
    !/^[a-f0-9]{64}$/.test(String(value.instrumentation)) ||
    value.lcovSha256 !== sha256(lcov) ||
    value.coverageSensorObserved !== true ||
    !record(value.sourceHashes) ||
    Object.keys(value.sourceHashes).length === 0 ||
    Object.entries(value.sourceHashes).some(
      ([path, hash]) => !sourcePath(path) || !/^[a-f0-9]{64}$/.test(String(hash)),
    )
  )
    throw new Error("LCOV provenance unavailable or unsealed");
  return value as unknown as LcovProvenance;
}

// Hash immutable Git bytes locally; never persist source or highlighted API code.
export function gitSource(revision: string, path: string, cwd = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(revision) || !sourcePath(path))
    throw new Error("source Git identity unavailable");
  const bytes = execFileSync("git", ["show", `${revision}:${path}`], {
    cwd,
    maxBuffer: 2_000_000,
    stdio: ["ignore", "pipe", "ignore"],
  });
  const lines = bytes.toString("utf8").split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return { hash: sha256(bytes), lines: lines.length };
}

export async function collectMetadata(
  get: ReturnType<typeof apiReader>,
  project: string,
  source: (path: string) => { hash: string; lines: number },
): Promise<FileMetadata[]> {
  const files: { key: string; path: string; metrics: Record<string, number | null> }[] = [];
  const keys = new Set<string>(),
    paths = new Set<string>();
  let total: number | null = null;
  for (let page = 1; page <= 100; page++) {
    const params = new URLSearchParams({
      component: project,
      branch: "main",
      qualifiers: "FIL",
      metricKeys: metricNames.join(","),
      ps: "500",
      p: String(page),
    });
    const tree = await get("sonar", `measures/component_tree?${params}`);
    const pageTotal = tree.paging?.total;
    if (
      !Array.isArray(tree.components) ||
      typeof pageTotal !== "number" ||
      !Number.isSafeInteger(pageTotal) ||
      pageTotal < 1 ||
      (total !== null && total !== pageTotal) ||
      tree.components.length === 0 ||
      tree.components.length > 500
    )
      throw new Error("component discovery is empty, changed or incomplete");
    total = pageTotal;
    for (const file of tree.components) {
      if (
        !record(file) ||
        typeof file.key !== "string" ||
        typeof file.path !== "string" ||
        !sourcePath(file.path) ||
        keys.has(file.key) ||
        paths.has(file.path) ||
        !Array.isArray(file.measures)
      )
        throw new Error("component identity is unsupported or duplicated");
      keys.add(file.key);
      paths.add(file.path);
      const measures = file.measures;
      const metrics = Object.fromEntries(
        metricNames.map((name) => {
          const m = measures.find((m: unknown) => record(m) && m.metric === name);
          const period =
            record(m) && record(m.period)
              ? m.period
              : record(m) && Array.isArray(m.periods)
                ? m.periods.find((p) => record(p) && p.index === 1)
                : null;
          const raw = record(m) ? (m.value ?? (record(period) ? period.value : null)) : null;
          return [name, typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : null];
        }),
      );
      files.push({ key: file.key, path: file.path, metrics });
    }
    if (files.length === total) break;
    if (files.length > total! || page === 100)
      throw new Error("component census differs from total");
  }
  const result: FileMetadata[] = [];
  for (const file of files) {
    const identity = source(file.path);
    if (
      !/^[a-f0-9]{64}$/.test(identity.hash) ||
      !Number.isInteger(identity.lines) ||
      identity.lines < 1
    )
      throw new Error("immutable source line count unavailable");
    const rows: FileMetadata["rows"] = [];
    for (let from = 1; from <= identity.lines; from += 500) {
      const to = Math.min(from + 499, identity.lines);
      const params = new URLSearchParams({
        key: file.key,
        branch: "main",
        from: String(from),
        to: String(to),
      });
      const page = coverageMetadata(await get("sonar", `sources/lines?${params}`));
      if (
        page.rows.length !== to - from + 1 ||
        page.rows.some((row, index) => row.line !== from + index)
      )
        throw new Error("source pagination is truncated, overlapping or unordered");
      rows.push(...page.rows);
    }
    result.push({ ...file, rows });
  }
  return result;
}

export function mapMainUnits(
  baseline: {
    mainSha: string;
    analysisId: string;
    observedAt: string;
    metrics: Record<string, number | null>;
    period: unknown;
  },
  origin: LcovProvenance,
  originalLcov: string,
  files: FileMetadata[],
  source: (path: string) => { hash: string },
): UnitSnapshot {
  provenance(origin, originalLcov);
  if (
    origin.revision !== baseline.mainSha ||
    origin.analysisId !== baseline.analysisId ||
    origin.branch !== "main" ||
    origin.pullRequest !== null ||
    baseline.period == null
  )
    throw new Error("original main analysis/period identity unavailable");
  const target = authoritativeUnits(baseline.metrics);
  if (
    origin.periodDigest !== sha256(JSON.stringify(baseline.period)) ||
    JSON.stringify(origin.mainUnits) !== JSON.stringify(target)
  )
    throw new Error("original main period/denominator changed");
  const original = lcovUnits(originalLcov);
  const units: MainSnapshot["units"] = [];
  const seen = new Set<string>(),
    sourceHashes: Record<string, string> = {};
  if (files.length === 0) throw new Error("empty authenticated file discovery");
  for (const file of files) {
    if (
      !sourcePath(file.path) ||
      seen.has(file.path) ||
      file.rows.length === 0 ||
      source(file.path).hash !== origin.sourceHashes[file.path]
    )
      throw new Error("source census/hash unavailable");
    seen.add(file.path);
    sourceHashes[file.path] = origin.sourceHashes[file.path];
    const start = units.length;
    const lineSeen = new Set<number>();
    for (const row of file.rows) {
      if (lineSeen.has(row.line) || row.isNew === null)
        throw new Error("new-code line identity unavailable");
      lineSeen.add(row.line);
      if (!row.isNew) continue;
      for (const [overall, unit] of [
        [row.lineHits, row.utLineHits],
        [row.conditions, row.utConditions],
        [row.coveredConditions, row.utCoveredConditions],
      ])
        if (overall !== null && unit !== null && overall !== unit)
          throw new Error("provider coverage aliases disagree");
      const lineId = `${file.path}:${row.line}:line`;
      const lineHits = row.lineHits ?? row.utLineHits;
      if (lineHits !== null) {
        // Medido no lcov real (auth-policy.ts 116/117/192): o v8 emite BRDA sem DA para
        // linhas que o Sonar conta como executáveis. Ausência de DA só equivale a não
        // coberto quando o provedor também declara a linha não coberta; linha declarada
        // coberta com DA ausente segue reprovando.
        if ((original.get(lineId) ?? false) !== lineHits > 0)
          throw new Error("original line coverage disagrees with provider");
        units.push({ file: file.path, line: row.line, covered: lineHits > 0 });
      } else if (original.has(lineId)) throw new Error("provider line coverage absent");
      const prefix = `${file.path}:${row.line}:`;
      const branches = [...original].filter(([id]) => id.startsWith(prefix) && id !== lineId);
      const count = row.conditions ?? row.utConditions,
        covered = row.coveredConditions ?? row.utCoveredConditions;
      if (branches.length) {
        if (
          count !== branches.length ||
          covered !== branches.filter(([, hits]) => hits === true).length ||
          branches.some(([, hits]) => hits === null)
        )
          throw new Error("original condition identity/count disagrees with provider");
        for (const [id, hits] of branches)
          units.push({
            file: file.path,
            line: row.line,
            branch: id.slice(prefix.length),
            covered: hits!,
          });
      } else if ((count !== null && count !== 0) || (covered !== null && covered !== 0))
        throw new Error("provider condition has no original LCOV identity");
    }
    const mapped = units.slice(start);
    const totals = [
      mapped.filter((u) => !u.branch).length,
      mapped.filter((u) => !u.branch && !u.covered).length,
      mapped.filter((u) => u.branch).length,
      mapped.filter((u) => u.branch && !u.covered).length,
    ];
    metricNames.forEach((name, i) => {
      if (
        file.metrics[name] !== totals[i] &&
        !(file.metrics[name] == null && totals.every((n) => n === 0))
      )
        throw new Error("file units disagree with provider metrics");
    });
  }
  if (units.length !== target.total || units.filter((u) => u.covered).length !== target.covered)
    throw new Error("checked units differ from authoritative main denominator/numerator");
  return {
    schema: "main-unit-snapshot/1",
    mainSha: baseline.mainSha,
    analysisId: baseline.analysisId,
    observedAt: baseline.observedAt,
    instrumentation: origin.instrumentation,
    total: target.total,
    covered: target.covered,
    floor: target.floor,
    sourceHashes,
    units,
    periodDigest: sha256(JSON.stringify(baseline.period)),
    baselineLcovSha256: sha256(originalLcov),
    metadataDigest: sha256(JSON.stringify(files)),
    discoveredFiles: [...seen].sort(),
  };
}

async function main() {
  const root = process.env.RUNNER_TEMP ?? ".";
  const reportPath = resolve(root, "c28-main-unit-adapter.json");
  const requests: RequestObservation[] = [];
  try {
    const paths = [process.env.SONAR_MAIN_LCOV, process.env.SONAR_MAIN_LCOV_PROVENANCE];
    if (paths.some((path) => !path) || !process.env.SONAR_TOKEN || !process.env.GITHUB_TOKEN)
      throw new Error("original main LCOV/provenance or credential names unavailable");
    const baseline = JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"));
    const lcov = readFileSync(paths[0]!, "utf8"),
      origin = provenance(JSON.parse(readFileSync(paths[1]!, "utf8")), lcov);
    const get = apiReader(
      { sonar: process.env.SONAR_TOKEN, github: process.env.GITHUB_TOKEN },
      requests,
    );
    const assertIdentity = async () => {
      const ref = await get("github", "repos/Douglas0101/preco-que-da-lucro/branches/main");
      const analyses = await get(
        "sonar",
        "project_analyses/search?project=Douglas0101_preco-que-da-lucro&branch=main&ps=1",
      );
      if (
        ref.commit?.sha !== baseline.mainSha ||
        analyses.analyses?.[0]?.key !== baseline.analysisId ||
        analyses.analyses?.[0]?.revision !== baseline.mainSha
      )
        throw new Error("main changed during authenticated unit discovery");
    };
    await assertIdentity();
    const source = (path: string) => gitSource(baseline.mainSha, path);
    const files = await collectMetadata(get, "Douglas0101_preco-que-da-lucro", source);
    const snapshot = mapMainUnits(baseline, origin, lcov, files, source);
    await assertIdentity();
    const snapshotPath = resolve(root, "c28-main-unit-snapshot.json"),
      bytes = JSON.stringify(snapshot, null, 2) + "\n";
    writeFileSync(snapshotPath, bytes);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          schema: "main-unit-adapter/1",
          verdict: "MAPPED",
          analysisId: snapshot.analysisId,
          mainSha: snapshot.mainSha,
          total: snapshot.total,
          metadataDigest: snapshot.metadataDigest,
          snapshotSha256: sha256(bytes),
          requests,
        },
        null,
        2,
      ) + "\n",
    );
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `snapshot_sha256=${sha256(bytes)}\n`);
  } catch {
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          schema: "main-unit-adapter/1",
          verdict: "NO-VERDICT",
          reason:
            "Complete authenticated metadata and original scanner LCOV provenance are required; no aggregate fallback.",
          requiredNames: [
            "SONAR_MAIN_LCOV",
            "SONAR_MAIN_LCOV_PROVENANCE",
            "SONAR_TOKEN",
            "GITHUB_TOKEN",
          ],
          requests,
        },
        null,
        2,
      ) + "\n",
    );
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
