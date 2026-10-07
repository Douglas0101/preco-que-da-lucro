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
  scannerContext?: string;
};
type Condition = {
  metricKey?: string;
  status?: string;
  comparator?: string;
  errorThreshold?: string;
  actualValue?: string;
};
type Gate = { status?: string; conditions?: Condition[]; ignoredConditions?: boolean };

function scannerProperty(context: unknown, key: string) {
  if (typeof context !== "string") throw new Error("scanner revision unavailable");
  const values = context
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:- )?/, ""))
    .filter((line) => line.startsWith(`${key}=`))
    .map((line) => line.slice(key.length + 1));
  if (values.length > 1) throw new Error("scanner revision unavailable or ambiguous");
  return values[0];
}

export function scannerRevision(context: unknown) {
  const revision = scannerProperty(context, "sonar.scm.revision");
  if (!revision || !/^[a-f0-9]{40}$/.test(revision))
    throw new Error("scanner revision unavailable or ambiguous");
  return revision;
}

export async function providerTask(
  taskRef: { id: string; url: string },
  api: <T>(url: string) => Promise<T>,
) {
  const url = new URL(taskRef.url);
  if (
    url.origin !== origin ||
    url.pathname !== "/api/ce/task" ||
    url.searchParams.get("id") !== taskRef.id ||
    url.username ||
    url.password
  )
    throw new Error("origem/caminho/identidade do CE divergente");
  url.searchParams.set("additionalFields", "scannerContext");
  const response = await api<{ task?: CeTask }>(url.href);
  if (!response.task || response.task.id !== taskRef.id)
    throw new Error("CE task unavailable or divergent");
  return response.task;
}

export async function completedProviderTask(
  taskRef: { id: string; url: string },
  api: <T>(url: string) => Promise<T>,
  options: {
    timeoutMs?: number;
    now?: () => number;
    pause?: (milliseconds: number) => Promise<void>;
  } = {},
) {
  const timeoutMs = options.timeoutMs ?? 300_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 300_000)
    throw new Error("CE orçamento inválido: NO-VERDICT");
  const now = options.now ?? (() => performance.now());
  const pause = options.pause ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  const started = now();
  for (let attempts = 0; attempts <= Math.ceil(timeoutMs / 2000); attempts++) {
    const task = await providerTask(taskRef, api);
    const elapsed = now() - started;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= timeoutMs)
      throw new Error("CE prazo de conclusão esgotado: NO-VERDICT");
    if (task.status === "SUCCESS") return task;
    if (task.status !== "PENDING" && task.status !== "IN_PROGRESS")
      throw new Error("CE falhou ou retornou estado desconhecido: NO-VERDICT");
    await pause(Math.min(2000, timeoutMs - elapsed));
  }
  throw new Error("CE limite de observações esgotado: NO-VERDICT");
}

export function analysisIdentity(
  task: CeTask,
  expected: { revision: string; branch: string; pullRequest?: string },
  revision: string,
) {
  if (!/^[a-f0-9]{40}$/.test(expected.revision) || revision !== expected.revision)
    throw new Error("provider analysis revision differs from checkout");
  const context = task.scannerContext;
  const contextRevision = context === undefined ? undefined : scannerRevision(context);
  if (contextRevision !== undefined && contextRevision !== revision)
    throw new Error("provider analysis revision differs from scanner context");
  const contextPr =
    context === undefined ? undefined : scannerProperty(context, "sonar.pullrequest.key");
  const contextBranch =
    context === undefined
      ? undefined
      : scannerProperty(
          context,
          expected.pullRequest ? "sonar.pullrequest.branch" : "sonar.branch.name",
        );
  const branch = task.branch ?? contextBranch;
  if (task.branch && contextBranch && task.branch !== contextBranch)
    throw new Error("provider PR/branch differs from scanner context");
  if (expected.pullRequest) {
    if (
      task.pullRequest !== expected.pullRequest ||
      branch !== expected.branch ||
      (context !== undefined && contextPr !== task.pullRequest)
    )
      throw new Error("provider PR/branch differs from expected surface");
  } else if (expected.branch !== "main" || task.pullRequest || contextPr || branch !== "main")
    throw new Error("provider main surface unavailable or divergent");
  return { revision, branch, pullRequest: task.pullRequest ?? null };
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

/** ADR-042: only the coverage minimum changes; preserve the provider's raw verdict. */
export function releaseVerdict(verdict: ReturnType<typeof ceVerdict>) {
  const controls = new Map([
    ["new_security_rating", { comparator: "GT", threshold: "1" }],
    ["new_reliability_rating", { comparator: "GT", threshold: "1" }],
    ["new_maintainability_rating", { comparator: "GT", threshold: "1" }],
    ["new_duplicated_lines_density", { comparator: "GT", threshold: "3" }],
    ["new_security_hotspots_reviewed", { comparator: "LT", threshold: "100" }],
  ]);
  const byMetric = new Map(verdict.conditions.map((condition) => [condition.metric, condition]));
  if (
    byMetric.size !== verdict.conditions.length ||
    verdict.ignoredConditions !== false ||
    verdict.conditions.some((condition) => !["OK", "ERROR"].includes(condition.status ?? ""))
  )
    throw new Error("gate condições duplicadas, ignoradas ou inconclusivas: NO-VERDICT");
  for (const [metric, expected] of controls) {
    const condition = byMetric.get(metric);
    if (
      !condition ||
      condition.comparator !== expected.comparator ||
      condition.threshold !== expected.threshold ||
      condition.actual === null ||
      !/^\d+(?:\.\d+)?$/.test(condition.actual)
    )
      throw new Error("gate controle obrigatório ausente ou alterado: NO-VERDICT");
    const actual = Number(condition.actual);
    const limit = Number(expected.threshold);
    const failed = expected.comparator === "GT" ? actual > limit : actual < limit;
    const isRating = metric.endsWith("_rating");
    if (
      !Number.isFinite(actual) ||
      (isRating ? !Number.isInteger(actual) || actual < 1 || actual > 5 : actual > 100) ||
      (condition.status === "ERROR") !== failed
    )
      throw new Error("gate controle obrigatório tem valor/status inconsistente: NO-VERDICT");
  }
  const coverage = byMetric.get("new_coverage");
  if (
    !coverage ||
    coverage.comparator !== "LT" ||
    coverage.threshold === null ||
    !/^\d+(?:\.\d+)?$/.test(coverage.threshold) ||
    Number(coverage.threshold) <= 0 ||
    Number(coverage.threshold) > 100 ||
    coverage.actual === null ||
    coverage.actual.trim() === "" ||
    !/^\d+(?:\.\d+)?$/.test(coverage.actual)
  )
    throw new Error("gate new_coverage ausente ou ilegível: NO-VERDICT");
  const actual = Number(coverage.actual);
  if (actual < 0 || actual > 100) throw new Error("gate new_coverage fora do domínio: NO-VERDICT");
  if ((coverage.status === "ERROR") !== actual < Number(coverage.threshold))
    throw new Error("gate new_coverage tem valor/status inconsistente: NO-VERDICT");
  const errors = verdict.conditions.filter((condition) => condition.status === "ERROR");
  if ((verdict.status === "ERROR") !== errors.length > 0)
    throw new Error("gate status diverge das condições: NO-VERDICT");
  const blocking = errors.filter((condition) => condition.metric !== "new_coverage");
  return {
    policy: "ADR-042/coverage-minimum-60",
    providerGateStatus: verdict.status,
    status: actual >= 60 && blocking.length === 0 ? "OK" : "ERROR",
    coverage: {
      metric: "new_coverage",
      minimum: 60,
      actual,
      status: actual >= 60 ? "OK" : "ERROR",
    },
    blockingConditions: blocking,
    preservedControls: [...controls.keys()],
  };
}

async function main() {
  const file = resolve(process.env.RUNNER_TEMP ?? ".", "c25-gate-readout.json");
  try {
    const token = process.env.SONAR_TOKEN;
    if (!token) throw new Error("SONAR_TOKEN ausente (somente nome)");
    const taskRef = scannerTask(readFileSync(".scannerwork/report-task.txt", "utf8"));
    const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const deadline = performance.now() + 300_000;
    async function api<T>(url: string): Promise<T> {
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new Error("CE prazo de conclusão esgotado: NO-VERDICT");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(Math.max(1, Math.ceil(Math.min(15000, remaining)))),
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(`Web API ${new URL(url).pathname}: HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }
    const task = await completedProviderTask(taskRef, api);
    const analysisId = task.analysisId;
    if (!analysisId) throw new Error("analysisId ausente: NO-VERDICT");
    const directRevision = task.analysisRevision ?? task.revision;
    const revision = directRevision ?? scannerRevision(task.scannerContext);
    const identity = analysisIdentity(
      task,
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
    const verdict = ceVerdict(task, response.projectStatus, taskRef.id);
    const releasePolicy = releaseVerdict(verdict);
    const report = {
      schema: "c25-ce-gate-readout/1",
      observedAt: new Date().toISOString(),
      runnerSha: process.env.GITHUB_SHA ?? null,
      checkoutSha,
      providerIdentity: identity,
      ...verdict,
      releasePolicy,
      nullSemantics: "métrica ausente é null; gate de PR não equivale ao de main",
    };
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`C25_CE_GATE ${JSON.stringify(report)}`);
    process.exitCode = releasePolicy.status === "OK" ? 0 : 1;
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
