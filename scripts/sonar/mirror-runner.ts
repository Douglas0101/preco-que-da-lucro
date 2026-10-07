import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { authoritativeUnits, lcovUnits, mirror } from "./unit-mirror.ts";
import {
  OriginalProvenanceUnavailable,
  readMainScannerOrigin,
  provenance,
  sha256,
  type UnitSnapshot,
  type LcovProvenance,
} from "./main-unit-adapter.ts";
import { instrumentationFingerprint } from "./lcov-provenance.ts";

interface CandidateMirrorIdentity {
  candidateGate: {
    analysisId: string;
    ceTaskId: string;
    providerIdentity: { revision: string; branch: string; pullRequest: string | null };
  };
  checkoutSha: string;
  expectedBranch: string;
  expectedPr: string;
  instrumentation: string;
}

function assertCandidateIdentity(candidate: LcovProvenance, input: CandidateMirrorIdentity) {
  if (
    candidate.revision !== input.checkoutSha ||
    candidate.branch !== input.expectedBranch ||
    candidate.pullRequest !== input.expectedPr ||
    !/^[1-9][0-9]*$/.test(input.expectedPr) ||
    candidate.instrumentation !== input.instrumentation ||
    input.candidateGate.analysisId !== candidate.analysisId ||
    input.candidateGate.ceTaskId !== candidate.taskId ||
    input.candidateGate.providerIdentity?.revision !== candidate.revision ||
    input.candidateGate.providerIdentity?.branch !== candidate.branch ||
    input.candidateGate.providerIdentity?.pullRequest !== candidate.pullRequest
  )
    throw new Error("original/candidate scanner LCOV provenance differs");
}

export function evaluateMirrorArtifacts(
  input: CandidateMirrorIdentity & {
    baseline: {
      mainSha: string;
      analysisId: string;
      metrics: Record<string, number | null>;
      period: unknown;
    };
    snapshot: UnitSnapshot;
    adapter: {
      schema: string;
      verdict: string;
      mainSha: string;
      analysisId: string;
      metadataDigest: string;
      snapshotSha256: string;
    };
    snapshotBytes: string;
    snapshotDigest: string;
    mainLcov: string;
    mainOrigin: unknown;
    candidateLcov: string;
    candidateOrigin: unknown;
    sourceHash: (path: string) => string;
    now: string;
  },
) {
  const { snapshot: s, baseline: b, adapter: a } = input;
  const target = authoritativeUnits(b.metrics);
  if (
    !/^[a-f0-9]{64}$/.test(input.snapshotDigest) ||
    input.snapshotDigest !== sha256(input.snapshotBytes) ||
    a.schema !== "main-unit-adapter/1" ||
    a.verdict !== "MAPPED" ||
    a.mainSha !== b.mainSha ||
    a.analysisId !== b.analysisId ||
    a.snapshotSha256 !== input.snapshotDigest ||
    a.metadataDigest !== s.metadataDigest ||
    !/^[a-f0-9]{64}$/.test(s.metadataDigest ?? "") ||
    s.schema !== "main-unit-snapshot/1" ||
    b.period == null ||
    s.periodDigest !== sha256(JSON.stringify(b.period)) ||
    s.mainSha !== b.mainSha ||
    s.analysisId !== b.analysisId ||
    s.total !== target.total ||
    s.covered !== target.covered ||
    s.floor !== target.floor
  )
    throw new Error("snapshot/adapter/authoritative baseline identity differs");
  const before = provenance(input.mainOrigin, input.mainLcov),
    after = provenance(input.candidateOrigin, input.candidateLcov);
  assertCandidateIdentity(after, input);
  if (
    before.revision !== b.mainSha ||
    before.analysisId !== b.analysisId ||
    before.branch !== "main" ||
    before.pullRequest !== null ||
    before.periodDigest !== s.periodDigest ||
    JSON.stringify(before.mainUnits) !== JSON.stringify(target) ||
    s.baselineLcovSha256 !== before.lcovSha256 ||
    before.instrumentation !== s.instrumentation ||
    after.instrumentation !== s.instrumentation
  )
    throw new Error("original/candidate scanner LCOV provenance differs");
  const files = [...new Set(s.units.map((unit) => unit.file))].sort();
  if (
    !Array.isArray(s.discoveredFiles) ||
    s.discoveredFiles.length === 0 ||
    new Set(s.discoveredFiles).size !== s.discoveredFiles.length ||
    files.some((file) => !s.discoveredFiles.includes(file)) ||
    Object.keys(s.sourceHashes).sort().join("\n") !== [...s.discoveredFiles].sort().join("\n")
  )
    throw new Error("snapshot file census differs");
  const currentHashes = Object.fromEntries(files.map((file) => [file, input.sourceHash(file)]));
  if (
    files.some(
      (file) =>
        before.sourceHashes[file] !== s.sourceHashes[file] ||
        after.sourceHashes[file] !== currentHashes[file],
    )
  )
    throw new Error("original/candidate source provenance differs");
  return mirror(s, input.mainLcov, input.candidateLcov, {
    mainSha: b.mainSha,
    analysisId: b.analysisId,
    instrumentation: input.instrumentation,
    sourceHashes: currentHashes,
    now: input.now,
  });
}

export function runMirrorCli() {
  const root = process.env.RUNNER_TEMP ?? ".",
    reportPath = resolve(root, "c26-main-mirror.json");
  const env = process.env;
  const names = [
    "SONAR_MAIN_UNIT_SNAPSHOT",
    "SONAR_MAIN_UNIT_SNAPSHOT_SHA256",
    "SONAR_MAIN_UNIT_ADAPTER_REPORT",
    "SONAR_MAIN_LCOV",
    "SONAR_MAIN_LCOV_PROVENANCE",
    "SONAR_CANDIDATE_LCOV",
    "SONAR_CANDIDATE_LCOV_PROVENANCE",
    "SONAR_CANDIDATE_GATE_REPORT",
    "EXPECTED_PR",
    "EXPECTED_BRANCH",
  ];
  let target: ReturnType<typeof authoritativeUnits> | null = null;
  let baseline: Record<string, unknown> | null = null;
  try {
    baseline = JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"));
    target = authoritativeUnits(baseline!.metrics as Record<string, number | null>);
    const adapter = env.SONAR_MAIN_UNIT_ADAPTER_REPORT
      ? JSON.parse(readFileSync(env.SONAR_MAIN_UNIT_ADAPTER_REPORT, "utf8"))
      : null;
    if (adapter?.reasonCode === "ORIGINAL_PROVENANCE_UNAVAILABLE") {
      if (
        adapter.schema !== "main-unit-adapter/1" ||
        adapter.verdict !== "NO-VERDICT" ||
        baseline?.schema !== "main-baseline/2" ||
        !/^[a-f0-9]{40}$/.test(String(baseline.mainSha)) ||
        !baseline.analysisId ||
        baseline.period == null ||
        adapter.mainSha !== baseline.mainSha ||
        adapter.analysisId !== baseline.analysisId ||
        names
          .filter((name) => !name.startsWith("SONAR_MAIN_UNIT_SNAPSHOT"))
          .some((name) => !env[name])
      )
        throw new Error("historical provenance observation identity differs");
      // Absence of historical provenance never excuses missing/corrupt candidate evidence.
      const candidateLcov = readFileSync(env.SONAR_CANDIDATE_LCOV!, "utf8");
      lcovUnits(candidateLcov);
      const candidate = provenance(
        JSON.parse(readFileSync(env.SONAR_CANDIDATE_LCOV_PROVENANCE!, "utf8")),
        candidateLcov,
      );
      const gate = JSON.parse(readFileSync(env.SONAR_CANDIDATE_GATE_REPORT!, "utf8"));
      assertCandidateIdentity(candidate, {
        candidateGate: gate,
        checkoutSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        expectedBranch: env.EXPECTED_BRANCH!,
        expectedPr: env.EXPECTED_PR!,
        instrumentation: instrumentationFingerprint(),
      });
      if (
        gate.schema !== "c25-ce-gate-readout/1" ||
        !["OK", "ERROR"].includes(gate.status) ||
        Object.entries(candidate.sourceHashes).some(
          ([path, hash]) => sha256(readFileSync(resolve(path))) !== hash,
        )
      )
        throw new Error("candidate provenance evidence differs");
      // Recheck the actual downloaded LCOV and ENOENT, rather than trusting an adapter label.
      readMainScannerOrigin(env.SONAR_MAIN_LCOV!, env.SONAR_MAIN_LCOV_PROVENANCE!);
      throw new Error("historical provenance absence no longer holds");
    }
    if (names.some((name) => !env[name])) throw new Error("unit input precondition absent");
    const snapshotBytes = readFileSync(env.SONAR_MAIN_UNIT_SNAPSHOT!, "utf8");
    const json = (name: string) => JSON.parse(readFileSync(env[name]!, "utf8"));
    const result = evaluateMirrorArtifacts({
      baseline: baseline as unknown as Parameters<typeof evaluateMirrorArtifacts>[0]["baseline"],
      snapshot: JSON.parse(snapshotBytes),
      snapshotBytes,
      snapshotDigest: env.SONAR_MAIN_UNIT_SNAPSHOT_SHA256!,
      adapter: json("SONAR_MAIN_UNIT_ADAPTER_REPORT"),
      mainLcov: readFileSync(env.SONAR_MAIN_LCOV!, "utf8"),
      mainOrigin: json("SONAR_MAIN_LCOV_PROVENANCE"),
      candidateLcov: readFileSync(env.SONAR_CANDIDATE_LCOV!, "utf8"),
      candidateOrigin: json("SONAR_CANDIDATE_LCOV_PROVENANCE"),
      candidateGate: json("SONAR_CANDIDATE_GATE_REPORT"),
      checkoutSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
      expectedBranch: env.EXPECTED_BRANCH!,
      expectedPr: env.EXPECTED_PR!,
      instrumentation: instrumentationFingerprint(),
      sourceHash: (path) => sha256(readFileSync(resolve(path))),
      now: new Date().toISOString(),
    });
    const verdict = result.pass ? "PASS" : "FAIL";
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          schema: "main-mirror/2",
          mainSha: baseline?.mainSha,
          analysisId: baseline?.analysisId,
          target,
          verdict,
          result,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `MAIN_MIRROR ${verdict}: eligible=${result.total}, covered=${result.covered}, paid=${result.paid.length}, lost=${result.lost.length}, gap=${result.gap}`,
    );
    process.exitCode = result.pass ? 0 : 1;
  } catch (error) {
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          schema: "main-mirror/2",
          mainSha: baseline?.mainSha ?? null,
          analysisId: baseline?.analysisId ?? null,
          target,
          verdict: "NO-VERDICT",
          reasonCode:
            error instanceof OriginalProvenanceUnavailable
              ? "ORIGINAL_PROVENANCE_UNAVAILABLE"
              : "EXECUTION_OR_UNCLASSIFIED",
          reason:
            "Complete sealed per-unit mapping and original/candidate scanner provenance are required.",
          missingNames: names.filter((name) => !env[name]),
        },
        null,
        2,
      ) + "\n",
    );
    console.error("NO-VERDICT: complete per-unit mapping/provenance unavailable or inconsistent");
    process.exitCode = 2;
  }
}
