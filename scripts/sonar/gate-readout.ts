import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
};
type Condition = {
  metricKey?: string;
  status?: string;
  comparator?: string;
  errorThreshold?: string;
  actualValue?: string;
};
type Gate = { status?: string; conditions?: Condition[]; ignoredConditions?: boolean };

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
    async function api<T>(url: string): Promise<T> {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(`Web API ${new URL(url).pathname}: HTTP ${response.status}`);
      return response.json() as Promise<T>;
    }
    const before = await api<{ task?: CeTask }>(taskRef.url);
    const analysisId = before.task?.analysisId;
    if (!analysisId) throw new Error("analysisId ausente: NO-VERDICT");
    const response = await api<{ projectStatus?: Gate }>(
      `${origin}/api/qualitygates/project_status?analysisId=${encodeURIComponent(analysisId)}`,
    );
    const verdict = ceVerdict(before.task, response.projectStatus, taskRef.id);
    const report = {
      schema: "c25-ce-gate-readout/1",
      observedAt: new Date().toISOString(),
      runnerSha: process.env.GITHUB_SHA ?? null,
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
      reason: error instanceof Error ? error.message : "resposta ilegível",
    };
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.error(`C25_CE_GATE ${JSON.stringify(report)}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/sonar/gate-readout.ts")) {
  await main();
}
