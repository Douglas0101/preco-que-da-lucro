import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sha256 } from "./main-unit-adapter.ts";

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
type ObservationKind = "adapter" | "mirror";

// This boundary changes only the advisory job outcome, never the producer's report or exit semantics.
export function classifyMirrorObservation(
  kind: ObservationKind,
  report: unknown,
  rawExitCode: number | null,
) {
  if (
    !record(report) ||
    report.schema !== (kind === "adapter" ? "main-unit-adapter/1" : "main-mirror/2") ||
    !/^[a-f0-9]{40}$/.test(String(report.mainSha)) ||
    typeof report.analysisId !== "string" ||
    !report.analysisId
  )
    throw new Error("Advisory evidence schema/identity is unavailable.");
  if (kind === "mirror") {
    const target = report.target;
    if (
      !record(target) ||
      !Number.isSafeInteger(target.total) ||
      (target.total as number) < 1 ||
      !Number.isSafeInteger(target.covered) ||
      (target.covered as number) < 0 ||
      (target.covered as number) > (target.total as number) ||
      target.coverage !== (100 * (target.covered as number)) / (target.total as number) ||
      target.floor !== Math.ceil(0.5 * (target.total as number)) ||
      target.gap !==
        Math.max(0, Math.ceil(0.8 * (target.total as number)) - (target.covered as number))
    )
      throw new Error("Authoritative target evidence is incomplete or inconsistent.");
  }
  if (report.verdict === "NO-VERDICT") {
    if (
      rawExitCode !== 2 ||
      report.reasonCode !== "ORIGINAL_PROVENANCE_UNAVAILABLE" ||
      typeof report.reason !== "string" ||
      !report.reason ||
      (kind === "adapter" ? !Array.isArray(report.requests) : !record(report.target))
    )
      throw new Error("NO-VERDICT is not a recognized historical observation.");
    return "NO-VERDICT";
  }
  if (kind === "adapter") {
    if (
      rawExitCode !== 0 ||
      report.verdict !== "MAPPED" ||
      !Number.isSafeInteger(report.total) ||
      (report.total as number) < 1 ||
      !/^[a-f0-9]{64}$/.test(String(report.metadataDigest)) ||
      !/^[a-f0-9]{64}$/.test(String(report.snapshotSha256)) ||
      !Array.isArray(report.requests)
    )
      throw new Error("Adapter exit/status/evidence differs.");
    return "MAPPED";
  }
  const result = report.result,
    target = report.target;
  if (
    !record(result) ||
    !record(target) ||
    !Number.isSafeInteger(result.total) ||
    (result.total as number) < 1 ||
    !Number.isSafeInteger(result.covered) ||
    (result.covered as number) < 0 ||
    (result.covered as number) > (result.total as number) ||
    result.total !== target.total ||
    !Array.isArray(result.paid) ||
    !Array.isArray(result.lost) ||
    [...result.paid, ...result.lost].some((unit) => typeof unit !== "string" || !unit) ||
    result.covered !== (target.covered as number) + result.paid.length - result.lost.length ||
    result.coverage !== (100 * (result.covered as number)) / (result.total as number) ||
    result.gap !==
      Math.max(0, Math.ceil(0.8 * (result.total as number)) - (result.covered as number)) ||
    result.pass !== 5 * (result.covered as number) >= 4 * (result.total as number) ||
    report.verdict !== (result.pass ? "PASS" : "FAIL") ||
    rawExitCode !== (result.pass ? 0 : 1)
  )
    throw new Error("Mirror exit/status/evidence differs.");
  return result.pass ? "PASS" : "FAIL";
}

export function runMirrorObservation(kind: ObservationKind) {
  const root = process.env.RUNNER_TEMP ?? ".";
  const adapter = kind === "adapter";
  const reportName = adapter ? "c28-main-unit-adapter.json" : "c26-main-mirror.json";
  const receiptName = adapter
    ? "c29-main-unit-adapter-observation.json"
    : "c29-main-mirror-observation.json";
  const reportPath = resolve(root, reportName);
  // The producer must publish fresh evidence; a previous invocation cannot satisfy this attempt.
  rmSync(reportPath, { force: true });
  const child = spawnSync(
    process.execPath,
    [resolve(import.meta.dirname, adapter ? "main-unit-adapter.ts" : "gate-mirror.ts")],
    { stdio: "inherit", env: process.env },
  );
  let rawStatus: string | null = null,
    reportSha256: string | null = null;
  let observation: string | null = null;
  try {
    const bytes = readFileSync(reportPath, "utf8");
    reportSha256 = sha256(bytes);
    const report: unknown = JSON.parse(bytes);
    if (record(report) && ["MAPPED", "PASS", "FAIL", "NO-VERDICT"].includes(String(report.verdict)))
      rawStatus = String(report.verdict);
    if (child.error || child.signal) throw new Error("Producer execution did not complete.");
    observation = classifyMirrorObservation(kind, report, child.status);
  } catch {
    console.error(
      "::error::Mirror observation execution/evidence failed; inspect preserved raw reports.",
    );
  }
  const receipt = {
    schema: "main-mirror-observation/1",
    kind,
    rawExitCode: child.status,
    signal: child.signal,
    rawStatus,
    reportName,
    reportSha256,
    observation,
    outcome: observation === null ? "FAILURE" : "INFORMATIONAL",
    approvesMain: false,
  };
  writeFileSync(resolve(root, receiptName), JSON.stringify(receipt, null, 2) + "\n");
  const summary = [
    `### Main coverage ${kind}: ${observation ?? "EXECUTION/EVIDENCE FAILURE"}`,
    `Raw status: ${rawStatus ?? "unavailable"}; raw exit: ${child.status ?? "unavailable"}.`,
    "Informational only under ADR-042. This observation does not approve main or replace the mandatory CE policy (new_coverage >=60%).",
    `Raw evidence: ${reportName}; execution receipt: ${receiptName}.`,
    "",
  ].join("\n\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  return observation === null ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const kind = process.argv[2];
  if (kind !== "adapter" && kind !== "mirror") {
    console.error("Usage: mirror-observation.ts adapter|mirror");
    process.exitCode = 2;
  } else {
    process.exitCode = runMirrorObservation(kind);
  }
}
