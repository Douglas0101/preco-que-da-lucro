import { createHash } from "node:crypto";
export type ProbeKind = "live" | "ready" | "session";
export const runtimePaths: Record<ProbeKind, string> = {
  live: "/api/health/live",
  ready: "/api/health/ready",
  session: "/api/auth/get-session",
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function classifyRuntime(kind: ProbeKind, http: number, contentType: string, body: string) {
  const summary = {
    kind,
    http,
    contentType: contentType.split(";")[0].trim().toLowerCase(),
    bytes: Buffer.byteLength(body),
    bodySha256: createHash("sha256").update(body).digest("hex"),
  };
  let value: unknown;
  const fail = (reason: string) => ({ ...summary, verdict: "FAIL" as const, reason });
  if (summary.bytes > 65536) return fail("body exceeds probe limit");
  if (summary.contentType !== "application/json")
    return fail("API did not return JSON content type");
  try {
    value = JSON.parse(body);
  } catch {
    return fail("API body is not JSON");
  }
  if (http !== 200) return fail("API HTTP status is not 200");
  if (kind === "session") {
    if (value !== null) return fail("anonymous session is not JSON null");
  } else {
    if (!record(value)) return fail("health body is not an object");
    if (kind === "live" && value.status !== "ok") return fail("liveness status is not ok");
    if (
      kind === "ready" &&
      (value.status !== "ready" ||
        !record(value.dependencies) ||
        value.dependencies.postgres !== "ok")
    )
      return fail("readiness status or PostgreSQL dependency is not ready");
  }
  return {
    ...summary,
    verdict: "PASS" as const,
    reason:
      kind === "session"
        ? "anonymous route only; login/tenant/revision not proved"
        : "health contract observed; login/tenant/revision not proved",
  };
}
export interface ObservationState {
  samples: number;
  consecutiveFailures: number;
  incidentsOpened: number;
  incidentOpen: boolean;
  startedAt: string | null;
  observedAt: string | null;
}
export const initialObservation = (): ObservationState => ({
  samples: 0,
  consecutiveFailures: 0,
  incidentsOpened: 0,
  incidentOpen: false,
  startedAt: null,
  observedAt: null,
});
export function observe(state: ObservationState, passed: boolean, at: string) {
  const time = Date.parse(at);
  if (
    !Number.isFinite(time) ||
    (state.observedAt !== null && time < Date.parse(state.observedAt)) ||
    ![state.samples, state.consecutiveFailures, state.incidentsOpened].every(
      (n) => Number.isInteger(n) && n >= 0,
    ) ||
    (state.samples === 0
      ? state.startedAt !== null || state.observedAt !== null
      : !Number.isFinite(Date.parse(state.startedAt ?? "")) ||
        !Number.isFinite(Date.parse(state.observedAt ?? "")))
  )
    throw new Error("observation time/state is invalid");
  const consecutiveFailures = passed ? 0 : state.consecutiveFailures + 1;
  const opened = consecutiveFailures >= 3 && !state.incidentOpen;
  // An incident requires operator disposition; a subsequent HTTP success does not erase it.
  return {
    samples: state.samples + 1,
    consecutiveFailures,
    incidentsOpened: state.incidentsOpened + Number(opened),
    incidentOpen: state.incidentOpen || opened,
    startedAt: state.startedAt ?? at,
    observedAt: at,
  };
}
