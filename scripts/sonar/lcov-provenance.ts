import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { authoritativeUnits, lcovUnits } from "./unit-mirror.ts";
import { provenance, sha256, type LcovProvenance } from "./main-unit-adapter.ts";

export function instrumentationFingerprint(cwd = process.cwd()) {
  const lock = JSON.parse(readFileSync(resolve(cwd, "package-lock.json"), "utf8"));
  const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf8"));
  const versions = ["vitest", "@vitest/coverage-v8", "jsdom"].map(
    (name) => lock.packages?.[`node_modules/${name}`]?.version,
  );
  if (
    versions.some((version) => typeof version !== "string" || !version) ||
    !pkg.scripts?.["test:coverage"]
  )
    throw new Error("coverage instrumentation identity unavailable");
  return sha256(
    JSON.stringify({
      node: process.version,
      v8: process.versions.v8,
      versions,
      command: pkg.scripts["test:coverage"],
      config: sha256(readFileSync(resolve(cwd, "vitest.config.ts"))),
    }),
  );
}

export function scannerProvenance(
  revision: string,
  lcov: string,
  gate: {
    analysisId: string;
    ceTaskId: string;
    providerIdentity: { revision: string; branch: string; pullRequest: string | null };
  },
  sensorLog: string,
  instrumentation: string,
  source: (path: string) => string,
  baseline?: {
    mainSha: string;
    analysisId: string;
    metrics: Record<string, number | null>;
    period: unknown;
  },
): LcovProvenance {
  if (
    gate.providerIdentity?.revision !== revision ||
    !sensorLog.includes("Sensor JavaScript/TypeScript Coverage")
  )
    throw new Error("scanner revision/sensor evidence unavailable");
  const files = new Set(
    [...lcovUnits(lcov).keys()]
      .map((id) => id.replace(/:\d+:(?:line|\d+,\d+)$/, ""))
      .filter((path) => path.startsWith("src/") && !path.startsWith("src/test/")),
  );
  const main =
    gate.providerIdentity.branch === "main" && gate.providerIdentity.pullRequest === null;
  if (
    main &&
    (!baseline ||
      baseline.mainSha !== revision ||
      baseline.analysisId !== gate.analysisId ||
      baseline.period == null)
  )
    throw new Error("main period/target provenance unavailable");
  const result: LcovProvenance = {
    schema: "sonar-lcov-provenance/1",
    revision,
    analysisId: gate.analysisId,
    taskId: gate.ceTaskId,
    branch: gate.providerIdentity.branch,
    pullRequest: gate.providerIdentity.pullRequest,
    instrumentation,
    lcovSha256: sha256(lcov),
    coverageSensorObserved: true,
    sourceHashes: Object.fromEntries([...files].map((path) => [path, source(path)])),
    periodDigest: main ? sha256(JSON.stringify(baseline!.period)) : null,
    mainUnits: main ? authoritativeUnits(baseline!.metrics) : null,
  };
  return provenance(result, lcov);
}
function main() {
  try {
    const cwd = process.cwd(),
      root = process.env.RUNNER_TEMP ?? ".";
    const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const lcov = readFileSync(resolve(cwd, "coverage/lcov.info"), "utf8");
    const gate = JSON.parse(readFileSync(resolve(root, "c25-gate-readout.json"), "utf8"));
    const baseline =
      gate.providerIdentity?.branch === "main"
        ? JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"))
        : undefined;
    const result = scannerProvenance(
      revision,
      lcov,
      gate,
      readFileSync("/tmp/scanner.log", "utf8"),
      instrumentationFingerprint(cwd),
      (path) => sha256(readFileSync(resolve(cwd, path))),
      baseline,
    );
    writeFileSync(
      resolve(cwd, "coverage/lcov-provenance.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
  } catch {
    console.error(
      "NO-VERDICT: scanner LCOV provenance could not be established (no raw inputs emitted)",
    );
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
