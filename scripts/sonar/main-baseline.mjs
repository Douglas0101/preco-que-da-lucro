import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { authoritativeUnits } from "./gate-mirror.ts";
import { selectMainAnalysis } from "./main-baseline-select.ts";
import { apiReader } from "./api.ts";

// DBT-103: a recusa é NOMEADA. O código pertence a um conjunto fechado e é validado antes de ser
// persistido — corpo bruto do provedor nunca entra no artefato nem no log.
class BaselineRefusal extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

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

/**
 * O `analysisId` do CE **deste** run, lido do gate readout que o passo anterior já esperou. É esta
 * identidade — e não a contagem de análises do histórico — que decide qual análise medir (DBT-103).
 */
function ceReadout() {
  const file = path.join(process.env.RUNNER_TEMP ?? ".", "c25-gate-readout.json");
  let readout;
  try {
    readout = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new BaselineRefusal("GATE_READOUT_UNAVAILABLE");
  }
  const identity = readout?.providerIdentity;
  if (
    readout?.schema !== "c25-ce-gate-readout/1" ||
    typeof readout.analysisId !== "string" ||
    readout.analysisId === ""
  )
    throw new BaselineRefusal("CE_ANALYSIS_ID_UNAVAILABLE");
  if (identity?.branch !== "main" || identity?.pullRequest !== null)
    throw new BaselineRefusal("READOUT_SURFACE_NOT_MAIN");
  if (!/^[a-f0-9]{40}$/.test(String(identity.revision)))
    throw new BaselineRefusal("READOUT_REVISION_UNAVAILABLE");
  return { analysisId: readout.analysisId, revision: identity.revision };
}

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
  const readout = ceReadout();
  if (readout.revision !== sha) throw new BaselineRefusal("READOUT_REVISION_DIFFERS_FROM_MAIN");
  const analyses = await sonar(`project_analyses/search?project=${project}&branch=main&ps=100`);
  const selection = selectMainAnalysis({
    analyses: analyses.analyses,
    mainSha: sha,
    ceAnalysisId: readout.analysisId,
  });
  if (!selection.ok) throw new BaselineRefusal(selection.reasonCode);
  const analysis = selection.analysis;
  const response = await sonar(
    `measures/component?component=${project}&branch=main&metricKeys=${keys.join(",")}`,
  );
  const status = await sonar(
    `qualitygates/project_status?analysisId=${encodeURIComponent(analysis.key)}`,
  );
  const after = await sonar(`project_analyses/search?project=${project}&branch=main&ps=1`);
  if ((await mainSha()) !== sha || after.analyses?.[0]?.key !== analysis.key)
    throw new BaselineRefusal("BASELINE_CHANGED_DURING_MEASUREMENT");
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
  if (!hasLineTarget) throw new BaselineRefusal("NEW_LINE_TARGET_UNAVAILABLE");
} catch (error) {
  const code =
    error instanceof BaselineRefusal && /^[A-Z_]{8,40}$/.test(error.code)
      ? error.code
      : "BASELINE_PRECONDITION_UNCLASSIFIED";
  const failure = {
    schema: "main-baseline/2",
    verdict: "NO-VERDICT",
    observedAt: new Date().toISOString(),
    reasonCode: code,
    reason:
      "Baseline identity/metadata/transport precondition failed; raw provider bodies withheld.",
    requests,
  };
  writeFileSync(
    path.join(process.env.RUNNER_TEMP ?? ".", "c24-main-baseline.json"),
    JSON.stringify(failure, null, 2) + "\n",
  );
  console.error(`precondicao: baseline NO-VERDICT (${code}); detalhes sanitizados no artefato`);
  process.exitCode = 2;
}
