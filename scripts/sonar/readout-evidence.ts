export type ReadoutEvidenceCode =
  | "READOUT_FORMAT_UNAVAILABLE"
  | "READOUT_FORMAT_AMBIGUOUS"
  | "READOUT_IDENTITY_UNAVAILABLE"
  | "READOUT_OBSERVATION_UNAVAILABLE"
  | "READOUT_SURFACE_DIVERGENT";

export class ReadoutEvidenceRefusal extends Error {
  readonly code: ReadoutEvidenceCode;
  constructor(code: ReadoutEvidenceCode) {
    super(code);
    this.name = "ReadoutEvidenceRefusal";
    this.code = code;
  }
}

export interface ReadoutEvidence {
  readoutStatus: "OK" | "ERROR" | "NO-VERDICT";
  analysisId: string;
  ceTaskId: string;
  providerIdentity: { revision: string; branch: string; pullRequest: string | null };
  /** Identity evidence only; never a release authorization, even when raw CE is OK. */
  approvesRelease: false;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(value);

/** DBT-106: validate the two producer layouts, without mutating or deciding their verdict. */
export function readoutEvidence(value: unknown): ReadoutEvidence {
  const report = record(value);
  if (
    !report ||
    report.schema !== "c25-ce-gate-readout/1" ||
    !(report.status === "OK" || report.status === "ERROR" || report.status === "NO-VERDICT")
  )
    throw new ReadoutEvidenceRefusal("READOUT_FORMAT_UNAVAILABLE");
  const preserved = report.status === "NO-VERDICT";
  if (
    (preserved && ("analysisId" in report || "ceTaskId" in report)) ||
    (!preserved && "providerObservation" in report)
  )
    throw new ReadoutEvidenceRefusal("READOUT_FORMAT_AMBIGUOUS");
  const identity = record(report.providerIdentity);
  if (
    !identity ||
    typeof identity.revision !== "string" ||
    !/^[a-f0-9]{40}$/.test(identity.revision) ||
    !(identity.branch === "main" || identity.branch === "develop") ||
    !(
      identity.pullRequest === null ||
      (typeof identity.pullRequest === "string" && /^[1-9]\d*$/.test(identity.pullRequest))
    ) ||
    (identity.pullRequest === null) !== (identity.branch === "main")
  )
    throw new ReadoutEvidenceRefusal("READOUT_IDENTITY_UNAVAILABLE");
  const observation = preserved ? record(report.providerObservation) : report;
  const surface = record(observation?.surface);
  if (
    !observation ||
    !id(observation.analysisId) ||
    !id(observation.ceTaskId) ||
    !(observation.status === "OK" || observation.status === "ERROR") ||
    !(
      observation.ignoredConditions === null || typeof observation.ignoredConditions === "boolean"
    ) ||
    !Array.isArray(observation.conditions) ||
    observation.conditions.some((entry: unknown) => {
      const condition = record(entry);
      return (
        !condition ||
        typeof condition.metric !== "string" ||
        !/^[a-z][a-z0-9_]*$/.test(condition.metric) ||
        !(condition.status === "OK" || condition.status === "ERROR") ||
        ["comparator", "threshold", "actual"].some(
          (field) => condition[field] !== null && typeof condition[field] !== "string",
        )
      );
    }) ||
    !surface
  )
    throw new ReadoutEvidenceRefusal("READOUT_OBSERVATION_UNAVAILABLE");
  if (
    (surface.branch !== null && surface.branch !== identity.branch) ||
    surface.pullRequest !== identity.pullRequest
  )
    throw new ReadoutEvidenceRefusal("READOUT_SURFACE_DIVERGENT");
  return {
    readoutStatus: report.status,
    analysisId: observation.analysisId,
    ceTaskId: observation.ceTaskId,
    providerIdentity: {
      revision: identity.revision,
      branch: identity.branch,
      pullRequest: identity.pullRequest as string | null,
    },
    approvesRelease: false,
  };
}
