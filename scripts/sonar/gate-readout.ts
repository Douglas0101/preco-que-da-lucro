import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const project = "Douglas0101_preco-que-da-lucro";
const origin = "https://sonarcloud.io";

export function scannerTask(text: string): { id: string; url: string } {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("report-task ilegível");
    const key = line.slice(0, separator);
    if (fields.has(key)) throw new Error("report-task com campo duplicado");
    fields.set(key, line.slice(separator + 1));
  }
  const id = fields.get("ceTaskId");
  if (fields.get("projectKey") !== project || !id || !/^[\w-]+$/.test(id))
    throw new Error("projeto/ceTaskId ausente ou divergente");
  const url = new URL(fields.get("ceTaskUrl") ?? "");
  if (
    url.origin !== origin ||
    url.pathname !== "/api/ce/task" ||
    url.searchParams.get("id") !== id ||
    url.username ||
    url.password
  )
    throw new Error("origem/caminho/identidade do CE divergente");
  return { id, url: url.href };
}

type CeTask = {
  id?: string;
  status?: string;
  analysisId?: string;
  componentKey?: string;
  branch?: string;
  branchType?: string;
  pullRequest?: string;
  analysisRevision?: string;
  revision?: string;
};
type Condition = {
  metricKey?: string;
  status?: string;
  comparator?: string;
  errorThreshold?: string;
  actualValue?: string;
};
type Gate = { status?: string; conditions?: Condition[]; ignoredConditions?: boolean };

export function scannerRevision(context: unknown) {
  if (typeof context !== "string") throw new Error("scanner revision unavailable");
  const revisions = context.split(/\r?\n/).filter((line) => /^sonar\.scm\.revision=/.test(line));
  if (revisions.length !== 1 || !/^sonar\.scm\.revision=[a-f0-9]{40}$/.test(revisions[0]))
    throw new Error("scanner revision unavailable or ambiguous");
  return revisions[0].split("=")[1];
}

export function analysisIdentity(
  task: CeTask,
  expected: { revision: string; branch: string; pullRequest?: string },
  revision: string,
) {
  if (!/^[a-f0-9]{40}$/.test(expected.revision) || revision !== expected.revision)
    throw new Error("provider analysis revision differs from checkout");
  if (expected.pullRequest) {
    if (task.pullRequest !== expected.pullRequest || task.branch !== expected.branch)
      throw new Error("provider PR/branch differs from expected surface");
  } else if (expected.branch !== "main" || task.pullRequest || task.branch !== "main")
    throw new Error("provider main surface unavailable or divergent");
  return { revision, branch: task.branch, pullRequest: task.pullRequest ?? null };
}

export function ceVerdict(task: CeTask | undefined, gate: Gate | undefined, taskId: string) {
  if (
    task?.id !== taskId ||
    task.status !== "SUCCESS" ||
    !task.analysisId ||
    task.componentKey !== project
  )
    throw new Error("CE não concluído ou identidade/projeto/analysisId divergente");
  if (!gate || !["OK", "ERROR"].includes(gate.status ?? "") || !Array.isArray(gate.conditions))
    throw new Error("gate ausente/ilegível: NO-VERDICT");
  if (gate.conditions.some((condition) => !condition.metricKey || !condition.status))
    throw new Error("condição de gate ilegível: NO-VERDICT");
  return {
    ceTaskId: task.id,
    analysisId: task.analysisId,
    surface: {
      branch: task.branch ?? null,
      branchType: task.branchType ?? null,
      pullRequest: task.pullRequest ?? null,
    },
    status: gate.status,
    ignoredConditions: gate.ignoredConditions ?? null,
    conditions: gate.conditions.map((condition) => ({
      metric: condition.metricKey,
      status: condition.status,
      comparator: condition.comparator ?? null,
      threshold: condition.errorThreshold ?? null,
      actual: condition.actualValue ?? null,
    })),
  };
}

async function main() {
  const file = resolve(process.env.RUNNER_TEMP ?? ".", "c25-gate-readout.json");
  try {
    const token = process.env.SONAR_TOKEN;
    if (!token) throw new Error("SONAR_TOKEN ausente (somente nome)");
    const taskRef = scannerTask(readFileSync(".scannerwork/report-task.txt", "utf8"));
    const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    async function api<T>(url: string): Promise<T> {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(`Web API ${new URL(url).pathname}: HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }
    const before = await api<{ task?: CeTask }>(taskRef.url);
    const analysisId = before.task?.analysisId;
    if (!analysisId) throw new Error("analysisId ausente: NO-VERDICT");
    const directRevision = before.task?.analysisRevision ?? before.task?.revision;
    const revision =
      directRevision ??
      scannerRevision(
        (
          await api<{ context?: string }>(
            `${origin}/api/ce/scanner_context?taskId=${encodeURIComponent(taskRef.id)}`,
          )
        ).context,
      );
    if (!before.task) throw new Error("CE task unavailable");
    const identity = analysisIdentity(
      before.task,
      {
        revision: checkoutSha,
        branch: process.env.EXPECTED_BRANCH ?? "",
        pullRequest: process.env.EXPECTED_PR || undefined,
      },
      revision,
    );
    const response = await api<{ projectStatus?: Gate }>(
      `${origin}/api/qualitygates/project_status?analysisId=${encodeURIComponent(analysisId)}`,
    );
    const verdict = ceVerdict(before.task, response.projectStatus, taskRef.id);
    const report = {
      schema: "c25-ce-gate-readout/1",
      observedAt: new Date().toISOString(),
      runnerSha: process.env.GITHUB_SHA ?? null,
      checkoutSha,
      providerIdentity: identity,
      ...verdict,
      nullSemantics: "métrica ausente é null; gate de PR não equivale ao de main",
    };
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`C25_CE_GATE ${JSON.stringify(report)}`);
    process.exitCode = verdict.status === "OK" ? 0 : 1;
  } catch (error) {
    const report = {
      schema: "c25-ce-gate-readout/1",
      observedAt: new Date().toISOString(),
      status: "NO-VERDICT",
      reason:
        error instanceof Error &&
        /^(CE |gate |condição |projeto\/|report-task |origem\/|analysisId |SONAR_TOKEN |Web API |scanner revision |provider )/.test(
          error.message,
        )
          ? error.message
          : "readout unavailable; no raw remote error persisted",
    };
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`C25_CE_GATE ${JSON.stringify(report)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/sonar/gate-readout.ts")) {
  await main();
}
