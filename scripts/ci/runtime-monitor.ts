import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  classifyRuntime,
  initialObservation,
  observe,
  runtimePaths,
  type ProbeKind,
} from "../lib/runtime-health.ts";

export type RuntimeFetch = (url: string, init: RequestInit) => Promise<Response>;
export function validateBase(base: string) {
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw new Error("runtime probe requires a credential-free HTTPS origin or local fixture");
  return url.origin;
}
async function boundedBody(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.length;
    if (length > 65536) {
      await reader.cancel();
      throw new Error("body exceeds probe limit");
    }
    chunks.push(next.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function probeRuntime(base: string, fetchImpl: RuntimeFetch = fetch) {
  const origin = validateBase(base);
  const rows = await Promise.all(
    (Object.keys(runtimePaths) as ProbeKind[]).map(async (kind) => {
      const started = performance.now();
      try {
        const response = await fetchImpl(`${origin}${runtimePaths[kind]}`, {
          method: "GET",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          credentials: "omit",
          redirect: "manual",
          signal: AbortSignal.timeout(15000),
        });
        const body = await boundedBody(response);
        return {
          path: runtimePaths[kind],
          ...classifyRuntime(
            kind,
            response.status,
            response.headers.get("content-type") ?? "",
            body,
          ),
          latencyMs: Math.round(performance.now() - started),
        };
      } catch (error) {
        return {
          path: runtimePaths[kind],
          kind,
          verdict: "FAIL" as const,
          reason:
            error instanceof Error && error.message === "body exceeds probe limit"
              ? error.message
              : "transport unavailable; no raw exception exposed",
          latencyMs: Math.round(performance.now() - started),
        };
      }
    }),
  );
  return {
    schema: "runtime-probe/1",
    origin,
    observedAt: new Date().toISOString(),
    scope: "anonymous GET only; login, tenant isolation and release revision not proved",
    pass: rows.every((row) => row.verdict === "PASS"),
    rows,
  };
}
async function main() {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  let day = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--observe-24h") {
      day = true;
      continue;
    }
    if (!["--base-url", "--output"].includes(args[i]) || !args[i + 1])
      throw new Error("usage: --base-url <origin> --output <jsonl> [--observe-24h]");
    values.set(args[i], args[++i]);
  }
  const base = validateBase(values.get("--base-url") ?? "");
  const output = values.get("--output");
  if (!output) throw new Error("output receipt path required");
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, "", { flag: "wx", mode: 0o600 });
  const samples = day ? 1441 : 1;
  let start = performance.now();
  let state = initialObservation();
  let failed = false;
  for (let sample = 0; sample < samples; sample++) {
    if (sample > 0)
      await new Promise((resolveTimer) =>
        setTimeout(resolveTimer, Math.max(0, 60000 * sample - (performance.now() - start))),
      );
    const receipt = await probeRuntime(base);
    if (sample === 0) start = performance.now();
    state = observe(state, receipt.pass, receipt.observedAt);
    failed ||= !receipt.pass;
    appendFileSync(output, JSON.stringify({ ...receipt, observation: state }) + "\n", {
      mode: 0o600,
    });
    if (state.consecutiveFailures === 3)
      console.error(`INCIDENT runtime contract failed three consecutive times: ${base}`);
    console.log(
      JSON.stringify({
        origin: base,
        observedAt: receipt.observedAt,
        pass: receipt.pass,
        observation: state,
      }),
    );
  }
  const measuredHours = (Date.parse(state.observedAt!) - Date.parse(state.startedAt!)) / 3600000;
  const summary = {
    schema: "runtime-observation/1",
    scope: "health observation only; no production approval",
    observation: state,
    measuredHours,
    complete24h: day && state.samples === 1441 && measuredHours >= 24,
    incidentDispositionRequired: state.incidentOpen,
  };
  writeFileSync(`${output}.summary.json`, JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  process.exitCode = failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch {
    console.error("runtime observation precondition failed; no raw target/error exposed");
    process.exitCode = 2;
  }
}
