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
class ProvenanceRefusal extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
function textInput(file: string, code: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new ProvenanceRefusal(code);
  }
}
function objectInput(file: string, code: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(textInput(file, code)) as unknown;
  } catch (error) {
    if (error instanceof ProvenanceRefusal) throw error;
    throw new ProvenanceRefusal(code);
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProvenanceRefusal(code);
  return value as Record<string, unknown>;
}
/**
 * A causa é NOMEADA (DBT-103). O passo reprovava o check **exigido** `scan + cobertura` de main com
 * a mensagem genérica "no raw inputs emitted", que não distinguia baseline inutilizável de gate
 * ausente nem de lcov ausente — e é isso que tornava a re-execução um diagnóstico cego. Os códigos
 * são de um conjunto fechado; nenhum valor de provedor entra no log. O veredito permanece
 * fail-closed (exit 2): nomear não afrouxa o selo.
 */
function refusalCode(error: unknown): string {
  if (error instanceof ProvenanceRefusal) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (/scanner revision\/sensor/.test(message)) return "SCANNER_IDENTITY_UNAVAILABLE";
  if (/main period\/target/.test(message)) return "MAIN_PROVENANCE_UNAVAILABLE";
  if (/instrumentation identity/.test(message)) return "INSTRUMENTATION_IDENTITY_UNAVAILABLE";
  return "PROVENANCE_UNCLASSIFIED";
}
function main() {
  const cwd = process.cwd(),
    root = process.env.RUNNER_TEMP ?? ".";
  try {
    let revision: string;
    try {
      revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      throw new ProvenanceRefusal("REVISION_UNAVAILABLE");
    }
    const gate = objectInput(resolve(root, "c25-gate-readout.json"), "GATE_READOUT_UNAVAILABLE");
    const identity = gate.providerIdentity as
      { revision?: string; branch?: string; pullRequest?: string | null } | undefined;
    let baseline: Record<string, unknown> | undefined;
    if (identity?.branch === "main") {
      baseline = objectInput(
        resolve(root, "c24-main-baseline.json"),
        "BASELINE_ARTIFACT_UNAVAILABLE",
      );
      // Um stub `main-baseline/2` com `verdict: NO-VERDICT` (o artefato real do attempt 2 do run
      // 38112535521) não é baseline: o selo recusa NOMEANDO a causa, em vez de sair 2 em silêncio.
      if (
        baseline.schema !== "main-baseline/2" ||
        baseline.verdict === "NO-VERDICT" ||
        !/^[a-f0-9]{40}$/.test(String(baseline.mainSha)) ||
        typeof baseline.analysisId !== "string" ||
        baseline.analysisId === "" ||
        typeof baseline.metrics !== "object" ||
        baseline.metrics === null ||
        baseline.period == null
      )
        throw new ProvenanceRefusal("BASELINE_ARTIFACT_UNUSABLE");
    }
    const lcov = textInput(resolve(cwd, "coverage/lcov.info"), "LCOV_UNAVAILABLE");
    const result = scannerProvenance(
      revision,
      lcov,
      gate as unknown as Parameters<typeof scannerProvenance>[2],
      textInput("/tmp/scanner.log", "SCANNER_LOG_UNAVAILABLE"),
      instrumentationFingerprint(cwd),
      (path) => {
        try {
          return sha256(readFileSync(resolve(cwd, path)));
        } catch {
          throw new ProvenanceRefusal("SOURCE_FILE_UNAVAILABLE");
        }
      },
      baseline as unknown as Parameters<typeof scannerProvenance>[6],
    );
    writeFileSync(
      resolve(cwd, "coverage/lcov-provenance.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
  } catch (error) {
    console.error(
      `NO-VERDICT: scanner LCOV provenance could not be established (${refusalCode(error)})`,
    );
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
