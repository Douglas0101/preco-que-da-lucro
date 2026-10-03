import { writeFileSync } from "node:fs";
import path from "node:path";
import { authoritativeUnits } from "./gate-mirror.ts";
import { apiReader } from "./api.ts";

// Read-only CI measurement: credentials come from the runner's Secret store and are never emitted.
const project = "Douglas0101_preco-que-da-lucro";
const repository = "Douglas0101/preco-que-da-lucro";
const keys = [
  "new_lines_to_cover",
  "new_uncovered_lines",
  "new_conditions_to_cover",
  "new_uncovered_conditions",
  "new_coverage",
  "new_line_coverage",
  "new_branch_coverage",
  "lines_to_cover",
  "uncovered_lines",
  "coverage",
  "ncloc",
];
const sonarToken = process.env.SONAR_TOKEN;
const githubToken = process.env.GITHUB_TOKEN;
if (!sonarToken || !githubToken) {
  console.error("precondicao: SONAR_TOKEN/GITHUB_TOKEN ausentes (somente nomes)");
  process.exit(2);
}
const requests = [];
const get = apiReader({ github: githubToken, sonar: sonarToken }, requests);
async function mainSha() {
  const result = await get("github", `repos/${repository}/branches/main`);
  const sha = result.commit?.sha;
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha))
    throw new Error("main SHA ausente/ilegível");
  return sha;
}
const sonar = (endpoint) => get("sonar", endpoint);
try {
  const sha = await mainSha();
  const analyses = await sonar(`project_analyses/search?project=${project}&branch=main&ps=100`);
  const matches = analyses.analyses?.filter((analysis) => analysis.revision === sha) ?? [];
  if (matches.length !== 1 || analyses.analyses?.[0]?.revision !== sha)
    throw new Error(`análise de main ausente/ambígua/desatualizada para ${sha}`);
  const analysis = matches[0];
  const response = await sonar(
    `measures/component?component=${project}&branch=main&metricKeys=${keys.join(",")}`,
  );
  const status = await sonar(`qualitygates/project_status?analysisId=${analysis.key}`);
  const after = await sonar(`project_analyses/search?project=${project}&branch=main&ps=1`);
  if ((await mainSha()) !== sha || after.analyses?.[0]?.key !== analysis.key)
    throw new Error("baseline mudou durante a medição");
  const metrics = Object.fromEntries(
    keys.map((key) => {
      const measure = response.component?.measures?.find((entry) => entry.metric === key);
      const raw =
        measure?.value ??
        measure?.period?.value ??
        measure?.periods?.find((period) => period.index === 1)?.value;
      const number = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
      return [key, Number.isFinite(number) ? number : null];
    }),
  );
  const hasLineTarget =
    Number.isInteger(metrics.new_lines_to_cover) &&
    metrics.new_lines_to_cover > 0 &&
    Number.isInteger(metrics.new_uncovered_lines) &&
    metrics.new_uncovered_lines >= 0;
  const units = authoritativeUnits(metrics);
  const report = {
    schema: "main-baseline/2",
    observedAt: new Date().toISOString(),
    mainSha: sha,
    analysisId: analysis.key,
    analysisDate: analysis.date,
    gate: status.projectStatus ?? null,
    metrics,
    units,
    period:
      status.projectStatus?.period ??
      status.projectStatus?.periods ??
      response.period ??
      response.periods ??
      null,
    requests,
    lineOnlyGapTo80: hasLineTarget
      ? Math.max(0, metrics.new_uncovered_lines - Math.floor(metrics.new_lines_to_cover * 0.2))
      : null,
    nullSemantics:
      "valor ausente/ilegível é NO-VERDICT; overall não substitui new; unidades são linhas + condições; snapshot por unidade ainda precisa de adapter validado",
  };
  const file = path.join(process.env.RUNNER_TEMP ?? ".", "c24-main-baseline.json");
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`C24_MAIN_BASELINE ${JSON.stringify(report)}`);
  if (!hasLineTarget) throw new Error("new line target ausente/inaplicável: NO-VERDICT");
} catch {
  const failure = {
    schema: "main-baseline/2",
    verdict: "NO-VERDICT",
    observedAt: new Date().toISOString(),
    reason:
      "Baseline identity/metadata/transport precondition failed; raw provider bodies withheld.",
    requests,
  };
  writeFileSync(
    path.join(process.env.RUNNER_TEMP ?? ".", "c24-main-baseline.json"),
    JSON.stringify(failure, null, 2) + "\n",
  );
  console.error("precondicao: baseline NO-VERDICT; detalhes sanitizados no artefato");
  process.exitCode = 2;
}
