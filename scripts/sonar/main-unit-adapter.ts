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
export interface ComponentCensus {
  expectedFiles: number | null;
  discoveredFiles: string[];
  coverageFiles: string[];
  excludedFiles: {
    path: string;
    reason: "CSS_OUTSIDE_JS_TS_COVERAGE";
    sourceSha256: string | null;
  }[];
}
type AdapterPhase =
  | "preconditions"
  | "baseline"
  | "origin"
  | "identity"
  | "components"
  | "sources"
  | "mapping"
  | "persist";
type MetadataFailureCode =
  | "COMPONENT_CENSUS_INVALID"
  | "COMPONENT_IDENTITY_INVALID"
  | "COMPONENT_PATH_UNSUPPORTED"
  | "COMPONENT_MEASURES_UNAVAILABLE"
  | "COMPONENT_METRIC_INVALID"
  | "CSS_COVERAGE_UNSUPPORTED"
  | "COVERAGE_CENSUS_EMPTY"
  | "SOURCE_IDENTITY_UNAVAILABLE"
  | "SOURCE_REQUEST_FAILED"
  | "SOURCE_COVERAGE_INVALID"
  | "SOURCE_PAGINATION_INVALID"
  | "ORIGIN_IDENTITY_INVALID"
  | "ORIGIN_PERIOD_INVALID"
  | "MAPPING_FILE_CENSUS_UNAVAILABLE"
  | "MAPPING_NEW_CODE_MARKER_UNAVAILABLE"
  | "MAPPING_PROVIDER_ALIASES_DISAGREE"
  | "MAPPING_PROVIDER_LINE_DISAGREES"
  | "MAPPING_PROVIDER_LINE_ABSENT"
  | "MAPPING_PROVIDER_CONDITION_DISAGREES"
  | "MAPPING_PROVIDER_CONDITION_WITHOUT_IDENTITY"
  | "MAPPING_FILE_UNITS_DISAGREE"
  | "MAPPING_UNITS_DISAGREE_WITH_DENOMINATOR";
class MetadataPreconditionError extends Error {
  readonly diagnostic: {
    phase: AdapterPhase;
    code: MetadataFailureCode;
    componentPathSha256?: string;
    lineSha256?: string;
  };
  constructor(
    phase: AdapterPhase,
    code: MetadataFailureCode,
    message: string,
    path?: string,
    line?: number,
  ) {
    super(message);
    this.diagnostic = {
      phase,
      code,
      ...(path === undefined ? {} : { componentPathSha256: sha256(path) }),
      ...(line === undefined ? {} : { lineSha256: sha256(String(line)) }),
    };
  }
}
export function adapterDiagnostic(error: unknown, phase: AdapterPhase) {
  if (error instanceof MetadataPreconditionError) return error.diagnostic;
  return {
    phase,
    code:
      error instanceof OriginalProvenanceUnavailable
        ? "ORIGINAL_PROVENANCE_UNAVAILABLE"
        : "EXECUTION_OR_UNCLASSIFIED",
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
// Alfabeto medido no censo real: `src` exponha apenas ts/tsx/css/md, e o router
// do Start nomeia a rota splat `src/routes/api/auth/$.ts` — sem `$` no charset,
// um arquivo JS/TS legitimo era recusado como "tipo nao registrado" (run
// 37981439098: COMPONENT_PATH_UNSUPPORTED com o digest deste mesmo caminho).
// `..` continua recusado em todos os predicados.
const pathName = "[A-Za-z0-9_$./-]+";
const sourcePath = (path: string) =>
  new RegExp(`^src/(?!test/)${pathName}\\.(ts|tsx|js|jsx)$`).test(path) && !path.includes("..");
const cssPath = (path: string) =>
  new RegExp(`^src/(?!test/)${pathName}\\.css$`).test(path) && !path.includes("..");
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

export class OriginalProvenanceUnavailable extends Error {}

export function readMainScannerOrigin(lcovPath: string, provenancePath: string) {
  const lcov = readFileSync(lcovPath, "utf8");
  lcovUnits(lcov); // A missing/corrupt LCOV is infrastructure failure, not historical absence.
  let bytes: string;
  try {
    bytes = readFileSync(provenancePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new OriginalProvenanceUnavailable("Original scanner provenance was not published.");
    throw error;
  }
  return { lcov, origin: provenance(JSON.parse(bytes), lcov) };
}

// Hash immutable Git bytes locally; never persist source or highlighted API code.
export function gitSource(revision: string, path: string, cwd = process.cwd()) {
  if (!/^[a-f0-9]{40}$/.test(revision) || (!sourcePath(path) && !cssPath(path)))
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
  census: ComponentCensus = {
    expectedFiles: null,
    discoveredFiles: [],
    coverageFiles: [],
    excludedFiles: [],
  },
): Promise<FileMetadata[]> {
  if (
    census.expectedFiles !== null ||
    census.discoveredFiles.length ||
    census.coverageFiles.length ||
    census.excludedFiles.length
  )
    throw new MetadataPreconditionError(
      "components",
      "COMPONENT_CENSUS_INVALID",
      "component census must belong to a fresh discovery",
    );
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
      throw new MetadataPreconditionError(
        "components",
        "COMPONENT_CENSUS_INVALID",
        "component discovery is empty, changed or incomplete",
      );
    total = pageTotal;
    census.expectedFiles = total;
    for (const file of tree.components) {
      if (
        !record(file) ||
        typeof file.key !== "string" ||
        !file.key ||
        typeof file.path !== "string" ||
        keys.has(file.key) ||
        paths.has(file.path)
      )
        throw new MetadataPreconditionError(
          "components",
          "COMPONENT_IDENTITY_INVALID",
          "component identity is unsupported or duplicated",
          record(file) && typeof file.path === "string" ? file.path : undefined,
        );
      if (!sourcePath(file.path) && !cssPath(file.path))
        throw new MetadataPreconditionError(
          "components",
          "COMPONENT_PATH_UNSUPPORTED",
          "component path is outside the supported coverage census",
          file.path,
        );
      if (!Array.isArray(file.measures))
        throw new MetadataPreconditionError(
          "components",
          "COMPONENT_MEASURES_UNAVAILABLE",
          "component measures are unavailable",
          file.path,
        );
      keys.add(file.key);
      paths.add(file.path);
      census.discoveredFiles.push(file.path);
      const path = file.path,
        measures = file.measures;
      const metrics = Object.fromEntries(
        metricNames.map((name) => {
          const matches = measures.filter((m: unknown) => record(m) && m.metric === name);
          if (matches.length === 0) return [name, null];
          const m = matches[0];
          const period =
            record(m) && record(m.period)
              ? m.period
              : record(m) && Array.isArray(m.periods)
                ? m.periods.find((p) => record(p) && p.index === 1)
                : null;
          const raw = record(m) ? (m.value ?? (record(period) ? period.value : null)) : null;
          if (
            matches.length !== 1 ||
            typeof raw !== "string" ||
            !/^\d+$/.test(raw) ||
            !Number.isSafeInteger(Number(raw))
          )
            throw new MetadataPreconditionError(
              "components",
              "COMPONENT_METRIC_INVALID",
              "component coverage metric is invalid or duplicated",
              path,
            );
          return [name, Number(raw)];
        }),
      );
      if (cssPath(file.path)) {
        if (Object.values(metrics).some((value) => value !== null && value !== 0))
          throw new MetadataPreconditionError(
            "components",
            "CSS_COVERAGE_UNSUPPORTED",
            "CSS declares coverage units outside the JS/TS LCOV contract",
            file.path,
          );
        census.excludedFiles.push({
          path: file.path,
          reason: "CSS_OUTSIDE_JS_TS_COVERAGE",
          sourceSha256: null,
        });
        continue;
      }
      files.push({ key: file.key, path: file.path, metrics });
      census.coverageFiles.push(file.path);
    }
    // Count every validated component, including CSS; the LCOV subset is not the API census.
    if (paths.size === total) break;
    if (paths.size > total! || page === 100)
      throw new MetadataPreconditionError(
        "components",
        "COMPONENT_CENSUS_INVALID",
        "component census differs from total",
      );
  }
  if (files.length === 0)
    throw new MetadataPreconditionError(
      "components",
      "COVERAGE_CENSUS_EMPTY",
      "authenticated JS/TS coverage discovery is empty",
    );
  const immutableSource = (path: string) => {
    try {
      const identity = source(path);
      if (
        !/^[a-f0-9]{64}$/.test(identity.hash) ||
        !Number.isSafeInteger(identity.lines) ||
        identity.lines < 1
      )
        throw new Error("invalid immutable source identity");
      return identity;
    } catch {
      throw new MetadataPreconditionError(
        "sources",
        "SOURCE_IDENTITY_UNAVAILABLE",
        "immutable source line count unavailable",
        path,
      );
    }
  };
  for (const excluded of census.excludedFiles)
    excluded.sourceSha256 = immutableSource(excluded.path).hash;
  const result: FileMetadata[] = [];
  for (const file of files) {
    const identity = immutableSource(file.path);
    const rows: FileMetadata["rows"] = [];
    for (let from = 1; from <= identity.lines; from += 500) {
      const to = Math.min(from + 499, identity.lines);
      const params = new URLSearchParams({
        key: file.key,
        branch: "main",
        from: String(from),
        to: String(to),
      });
      let response;
      try {
        response = await get("sonar", `sources/lines?${params}`);
      } catch {
        throw new MetadataPreconditionError(
          "sources",
          "SOURCE_REQUEST_FAILED",
          "authenticated source metadata request failed",
          file.path,
        );
      }
      let page;
      try {
        page = coverageMetadata(response);
      } catch {
        throw new MetadataPreconditionError(
          "sources",
          "SOURCE_COVERAGE_INVALID",
          "authenticated source metadata is invalid",
          file.path,
        );
      }
      if (
        page.rows.length !== to - from + 1 ||
        page.rows.some((row, index) => row.line !== from + index)
      )
        throw new MetadataPreconditionError(
          "sources",
          "SOURCE_PAGINATION_INVALID",
          "source pagination is truncated, overlapping or unordered",
          file.path,
        );
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
  try {
    provenance(origin, originalLcov);
  } catch {
    throw new MetadataPreconditionError(
      "origin",
      "ORIGIN_IDENTITY_INVALID",
      "original main scanner provenance is unavailable or unsealed",
    );
  }
  if (
    origin.revision !== baseline.mainSha ||
    origin.analysisId !== baseline.analysisId ||
    origin.branch !== "main" ||
    origin.pullRequest !== null ||
    baseline.period == null
  )
    throw new MetadataPreconditionError(
      "origin",
      "ORIGIN_IDENTITY_INVALID",
      "original main analysis/period identity unavailable",
    );
  const target = authoritativeUnits(baseline.metrics);
  if (
    origin.periodDigest !== sha256(JSON.stringify(baseline.period)) ||
    JSON.stringify(origin.mainUnits) !== JSON.stringify(target)
  )
    throw new MetadataPreconditionError(
      "origin",
      "ORIGIN_PERIOD_INVALID",
      "original main period/denominator changed",
    );
  const original = lcovUnits(originalLcov);
  const units: MainSnapshot["units"] = [];
  const seen = new Set<string>(),
    sourceHashes: Record<string, string> = {};
  if (files.length === 0)
    throw new MetadataPreconditionError(
      "mapping",
      "MAPPING_FILE_CENSUS_UNAVAILABLE",
      "empty authenticated file discovery",
    );
  for (const file of files) {
    // A provenance sela somente os hashes dos arquivos que a rodada de cobertura
    // carregou: em main sao 111 dos 144 do censo, porque 33 arquivos nunca foram
    // importados por teste algum e portanto nao tem registro no LCOV. A identidade
    // desses continua imutavel e vem dos mesmos bytes Git que a provenance sela
    // para os cobertos — hash selado, quando existe, precisa concordar.
    const sealed = origin.sourceHashes[file.path],
      immutable = source(file.path).hash;
    if (
      !sourcePath(file.path) ||
      seen.has(file.path) ||
      file.rows.length === 0 ||
      (sealed !== undefined && sealed !== immutable)
    )
      throw new MetadataPreconditionError(
        "mapping",
        "MAPPING_FILE_CENSUS_UNAVAILABLE",
        "source census/hash unavailable",
        file.path,
      );
    seen.add(file.path);
    sourceHashes[file.path] = immutable;
    const start = units.length;
    const lineSeen = new Set<number>();
    for (const row of file.rows) {
      if (lineSeen.has(row.line) || row.isNew === null)
        throw new MetadataPreconditionError(
          "mapping",
          "MAPPING_NEW_CODE_MARKER_UNAVAILABLE",
          "new-code line identity unavailable",
          file.path,
          row.line,
        );
      lineSeen.add(row.line);
      if (!row.isNew) continue;
      for (const [overall, unit] of [
        [row.lineHits, row.utLineHits],
        [row.conditions, row.utConditions],
        [row.coveredConditions, row.utCoveredConditions],
      ])
        if (overall !== null && unit !== null && overall !== unit)
          throw new MetadataPreconditionError(
            "mapping",
            "MAPPING_PROVIDER_ALIASES_DISAGREE",
            "provider coverage aliases disagree",
            file.path,
            row.line,
          );
      const lineId = `${file.path}:${row.line}:line`;
      const prefix = `${file.path}:${row.line}:`;
      const branches = [...original].filter(([id]) => id.startsWith(prefix) && id !== lineId);
      const coveredBranches = branches.filter(([, hits]) => hits === true).length;
      const lineHits = row.lineHits ?? row.utLineHits;
      if (lineHits !== null) {
        // Regra medida no provedor, em três evidências oficiais/reais:
        // (1) LCOVParser.FileData.save grava as linhas DA e depois as linhas com BRDA
        //     como DA + branches cobertas; (2) o teste oficial
        //     conditions_on_non_executable_lines confirma o fallback de branch em
        //     linha só-BRDA (audit.repository.ts 28-30, BRH 6/6, passa no provedor);
        // (3) medição remota em dashboard.service.ts:174 (DA:174,0 com 1 branch
        //     coberta de 4): o provedor declara a linha NÃO coberta — o valor do DA
        //     existente prevalece e a contribuição de branch só vale como fallback.
        const lineCovered = original.has(lineId)
          ? original.get(lineId) === true
          : coveredBranches > 0;
        if (lineCovered !== lineHits > 0)
          throw new MetadataPreconditionError(
            "mapping",
            "MAPPING_PROVIDER_LINE_DISAGREES",
            "original line coverage disagrees with provider",
            file.path,
            row.line,
          );
        units.push({ file: file.path, line: row.line, covered: lineHits > 0 });
      } else if (original.has(lineId))
        throw new MetadataPreconditionError(
          "mapping",
          "MAPPING_PROVIDER_LINE_ABSENT",
          "provider line coverage absent",
          file.path,
          row.line,
        );
      const count = row.conditions ?? row.utConditions,
        covered = row.coveredConditions ?? row.utCoveredConditions;
      if (branches.length) {
        if (
          count !== branches.length ||
          covered !== branches.filter(([, hits]) => hits === true).length ||
          branches.some(([, hits]) => hits === null)
        )
          throw new MetadataPreconditionError(
            "mapping",
            "MAPPING_PROVIDER_CONDITION_DISAGREES",
            "original condition identity/count disagrees with provider",
            file.path,
            row.line,
          );
        for (const [id, hits] of branches)
          units.push({
            file: file.path,
            line: row.line,
            branch: id.slice(prefix.length),
            covered: hits!,
          });
      } else if ((count !== null && count !== 0) || (covered !== null && covered !== 0))
        throw new MetadataPreconditionError(
          "mapping",
          "MAPPING_PROVIDER_CONDITION_WITHOUT_IDENTITY",
          "provider condition has no original LCOV identity",
          file.path,
          row.line,
        );
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
        throw new MetadataPreconditionError(
          "mapping",
          "MAPPING_FILE_UNITS_DISAGREE",
          "file units disagree with provider metrics",
          file.path,
        );
    });
  }
  if (units.length !== target.total || units.filter((u) => u.covered).length !== target.covered)
    throw new MetadataPreconditionError(
      "mapping",
      "MAPPING_UNITS_DISAGREE_WITH_DENOMINATOR",
      "checked units differ from authoritative main denominator/numerator",
    );
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
  const componentCensus: ComponentCensus = {
    expectedFiles: null,
    discoveredFiles: [],
    coverageFiles: [],
    excludedFiles: [],
  };
  let baseline: Record<string, unknown> | null = null;
  let phase: AdapterPhase = "preconditions";
  try {
    const paths = [process.env.SONAR_MAIN_LCOV, process.env.SONAR_MAIN_LCOV_PROVENANCE];
    if (paths.some((path) => !path) || !process.env.SONAR_TOKEN || !process.env.GITHUB_TOKEN)
      throw new Error("original main LCOV/provenance or credential names unavailable");
    phase = "baseline";
    baseline = JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"));
    if (
      baseline?.schema !== "main-baseline/2" ||
      !/^[a-f0-9]{40}$/.test(String(baseline.mainSha)) ||
      typeof baseline.analysisId !== "string" ||
      !baseline.analysisId ||
      baseline.period == null
    )
      throw new Error("authoritative baseline identity unavailable");
    authoritativeUnits(baseline.metrics as Record<string, number | null>);
    const measured = baseline;
    phase = "origin";
    const { lcov, origin } = readMainScannerOrigin(paths[0]!, paths[1]!);
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
        ref.commit?.sha !== measured.mainSha ||
        analyses.analyses?.[0]?.key !== measured.analysisId ||
        analyses.analyses?.[0]?.revision !== measured.mainSha
      )
        throw new Error("main changed during authenticated unit discovery");
    };
    phase = "identity";
    await assertIdentity();
    const source = (path: string) => gitSource(measured.mainSha as string, path);
    phase = "components";
    const files = await collectMetadata(
      get,
      "Douglas0101_preco-que-da-lucro",
      source,
      componentCensus,
    );
    phase = "mapping";
    const snapshot = mapMainUnits(
      baseline as unknown as Parameters<typeof mapMainUnits>[0],
      origin,
      lcov,
      files,
      source,
    );
    phase = "identity";
    await assertIdentity();
    phase = "persist";
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
          componentCensus,
          requests,
        },
        null,
        2,
      ) + "\n",
    );
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `snapshot_sha256=${sha256(bytes)}\n`);
  } catch (error) {
    const diagnostic = adapterDiagnostic(error, phase);
    console.error(`Main unit adapter NO-VERDICT: ${JSON.stringify(diagnostic)}`);
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          schema: "main-unit-adapter/1",
          verdict: "NO-VERDICT",
          reasonCode:
            error instanceof OriginalProvenanceUnavailable
              ? "ORIGINAL_PROVENANCE_UNAVAILABLE"
              : "EXECUTION_OR_UNCLASSIFIED",
          mainSha: baseline?.mainSha ?? null,
          analysisId: baseline?.analysisId ?? null,
          reason:
            "Complete authenticated metadata and original scanner LCOV provenance are required; no aggregate fallback.",
          diagnostic,
          componentCensus,
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
