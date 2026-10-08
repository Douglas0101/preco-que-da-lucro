import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { apiReader, type RequestObservation } from "./api.ts";

export function selectMainOriginRun(runs: unknown, mainSha: string) {
  if (!Array.isArray(runs)) throw new Error("run discovery unavailable");
  const eligible = runs.filter(
    (run) =>
      run &&
      run.path === ".github/workflows/sonar.yml" &&
      run.head_branch === "main" &&
      run.event === "push" &&
      run.head_sha === mainSha &&
      run.status === "completed",
  );
  if (
    eligible.length === 0 ||
    eligible.some(
      (run) =>
        !Number.isSafeInteger(run.id) ||
        run.id <= 0 ||
        !Number.isFinite(Date.parse(run.created_at)),
    )
  )
    throw new Error("original main scanner run unavailable");
  eligible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (eligible.length > 1 && eligible[0].created_at === eligible[1].created_at)
    throw new Error("run discovery ambiguous");
  // Selection supplies a candidate artifact, never coverage approval. The
  // downloaded provenance must still match the exact current analysisId.
  return eligible[0].id as number;
}
async function main() {
  const root = process.env.RUNNER_TEMP ?? ".",
    requests: RequestObservation[] = [];
  let report: unknown;
  try {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OUTPUT)
      throw new Error("origin run precondition unavailable");
    const baseline = JSON.parse(readFileSync(resolve(root, "c24-main-baseline.json"), "utf8"));
    if (!/^[a-f0-9]{40}$/.test(baseline.mainSha)) throw new Error("main SHA unavailable");
    const get = apiReader({ github: process.env.GITHUB_TOKEN, sonar: "unused" }, requests);
    const runs: unknown[] = [],
      ids = new Set<number>();
    let total: number | null = null;
    for (let page = 1; page <= 10; page++) {
      const payload = await get(
        "github",
        `repos/Douglas0101/preco-que-da-lucro/actions/runs?branch=main&event=push&head_sha=${baseline.mainSha}&per_page=100&page=${page}`,
      );
      const pageTotal = payload.total_count;
      if (
        !Array.isArray(payload.workflow_runs) ||
        typeof pageTotal !== "number" ||
        !Number.isSafeInteger(pageTotal) ||
        pageTotal < 1 ||
        (total !== null && total !== pageTotal) ||
        payload.workflow_runs.length === 0 ||
        payload.workflow_runs.length > 100
      )
        throw new Error("run census incomplete or changed");
      total = pageTotal;
      for (const run of payload.workflow_runs) {
        if (
          !run ||
          typeof run !== "object" ||
          !("id" in run) ||
          typeof run.id !== "number" ||
          !Number.isSafeInteger(run.id) ||
          run.id < 1 ||
          ids.has(run.id)
        )
          throw new Error("run census duplicated or unsupported");
        ids.add(run.id);
        runs.push(run);
      }
      if (runs.length === total) break;
      if (runs.length > total || page === 10)
        throw new Error("run census exceeds bounded discovery");
    }
    const runId = selectMainOriginRun(runs, baseline.mainSha);
    appendFileSync(process.env.GITHUB_OUTPUT, `run_id=${runId}\n`);
    report = {
      schema: "main-origin-run/1",
      verdict: "CANDIDATE-ONLY",
      mainSha: baseline.mainSha,
      analysisId: baseline.analysisId,
      runId,
      requests,
    };
  } catch {
    report = {
      schema: "main-origin-run/1",
      verdict: "NO-VERDICT",
      reason:
        "Original scanner run/artifact unavailable; no replacement analysis or local LCOV substitution.",
      requests,
    };
    process.exitCode = 2;
  }
  writeFileSync(resolve(root, "c28-main-origin-run.json"), JSON.stringify(report, null, 2) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
