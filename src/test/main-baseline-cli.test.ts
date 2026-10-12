import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/sonar/main-baseline.mjs");
const sha = "a".repeat(40),
  other = "b".repeat(40);
const analysis = { key: "analysis-own-main", revision: sha, date: "2026-10-12T00:00:00Z" };
const metrics = {
  new_lines_to_cover: 4,
  new_uncovered_lines: 1,
  new_conditions_to_cover: 0,
  new_uncovered_conditions: 0,
  new_coverage: 75,
};
const readout = {
  schema: "c25-ce-gate-readout/1",
  status: "OK",
  analysisId: analysis.key,
  ceTaskId: "ce-own-main",
  providerIdentity: { revision: sha, branch: "main", pullRequest: null },
  surface: { branch: "main", branchType: "BRANCH", pullRequest: null },
  ignoredConditions: false,
  conditions: [],
};
const calls = () => {
  const lines = readFileSync(".github/workflows/sonar.yml", "utf8").split("\n");
  let name = "",
    job = "";
  return lines.flatMap((line) => {
    if (/^ {2}[\w-]+:$/.test(line)) job = line.trim().slice(0, -1);
    if (/^ {6}- name: /.test(line)) name = line.trim().slice("- name: ".length);
    if (!line.includes("run:") || !line.includes("scripts/sonar/main-baseline.mjs")) return [];
    const command = line.trim().slice("run: ".length).split(/\s+/);
    return [{ name, job, args: command.slice(2) }];
  });
};

type Scenario = {
  refs?: string[];
  first?: unknown[];
  after?: unknown[];
  metrics?: Record<string, unknown>;
  component?: string;
  gate?: string;
  httpFailure?: boolean;
};
function run(args: string[], scenario: Scenario = {}, gate?: unknown) {
  const directory = mkdtempSync(resolve(tmpdir(), "baseline-cli-"));
  try {
    writeFileSync(
      resolve(directory, "fixture.json"),
      JSON.stringify({
        refs: [sha, sha],
        first: [analysis, { ...analysis, key: "earlier-same-revision" }],
        after: [analysis],
        metrics,
        component: "Douglas0101_preco-que-da-lucro",
        gate: "OK",
        ...scenario,
      }),
    );
    if (gate !== undefined)
      writeFileSync(resolve(directory, "c25-gate-readout.json"), JSON.stringify(gate));
    const preload = resolve(directory, "api-fixture.mjs");
    writeFileSync(
      preload,
      `
import { readFileSync, appendFileSync } from 'node:fs';
const root = process.env.RUNNER_TEMP;
const fixture = JSON.parse(readFileSync(root + '/fixture.json', 'utf8'));
let refs = 0, analyses = 0;
globalThis.fetch = async (input, options) => {
  const url = new URL(String(input));
  if (options?.headers?.Authorization !== 'Bearer fixture-only-not-a-credential' || options.redirect !== 'error') throw new Error('fixture contract');
  appendFileSync(root + '/calls.jsonl', JSON.stringify({origin:url.origin,path:url.pathname,query:url.search}) + '\\n');
  let body;
  if (url.origin === 'https://api.github.com' && url.pathname.endsWith('/branches/main')) body = {commit:{sha:fixture.refs[refs++]}};
  else if (url.origin === 'https://sonarcloud.io' && url.pathname.endsWith('/project_analyses/search')) {
    if (fixture.httpFailure) return new Response(JSON.stringify({private:'PRIVATE_BODY_SENTINEL'}), {status:403});
    body = {analyses:analyses++ === 0 ? fixture.first : fixture.after};
  } else if (url.origin === 'https://sonarcloud.io' && url.pathname.endsWith('/measures/component')) body = {component:{key:fixture.component,measures:Object.entries(fixture.metrics).map(([metric,value])=>({metric,value:value===null?null:String(value)}))}};
  else if (url.origin === 'https://sonarcloud.io' && url.pathname.endsWith('/qualitygates/project_status')) body = {projectStatus:{status:fixture.gate,conditions:[],period:{mode:'previous_version',date:'2026-10-01T00:00:00Z'}}};
  else throw new Error('NO_NETWORK_UNREGISTERED_ENDPOINT');
  return new Response(JSON.stringify(body),{status:200});
};
`,
    );
    const result = spawnSync(process.execPath, ["--import", preload, script, ...args], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        RUNNER_TEMP: directory,
        SONAR_TOKEN: "fixture-only-not-a-credential",
        GITHUB_TOKEN: "fixture-only-not-a-credential",
      },
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    const report = JSON.parse(readFileSync(resolve(directory, "c24-main-baseline.json"), "utf8"));
    const requests = (() => {
      try {
        return readFileSync(resolve(directory, "calls.jsonl"), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
      } catch {
        return [];
      }
    })();
    expect(result.stdout + result.stderr + JSON.stringify(report)).not.toContain(
      "fixture-only-not-a-credential",
    );
    expect(result.stdout + result.stderr + JSON.stringify(report)).not.toContain(
      "PRIVATE_BODY_SENTINEL",
    );
    return { status: result.status, report, requests, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("DBT-104 · CLI real em cada consumidor descoberto", () => {
  it("descobre os três sítios por nome/job, e cada novo sítio falha por default", () => {
    expect(calls()).toEqual([
      {
        name: "Medir baseline main (M2, leitura por SHA)",
        job: "scan",
        args: ["--mode", "observe-main"],
      },
      {
        name: "Medir main somente após a análise do push",
        job: "scan",
        args: ["--mode", "post-ce-main"],
      },
      {
        name: "Read authoritative main units at the current SHA",
        job: "main-coverage-mirror",
        args: ["--mode", "observe-main"],
      },
    ]);
  });
  it("executa os três comandos completos: PR/espelho não têm readout, pós-CE tem o próprio", () => {
    for (const site of calls()) {
      const main = site.args[1] === "post-ce-main";
      const result = run(site.args, {}, main ? readout : undefined);
      expect(result.status, site.name).toBe(0);
      expect(result.report, site.name).toMatchObject({
        schema: "main-baseline/2",
        mainSha: sha,
        analysisId: analysis.key,
        mode: site.args[1],
        approvesMain: false,
        metrics: { new_coverage: 75 },
        units: { total: 4, covered: 3 },
      });
      expect(result.report.verdict).toBeUndefined();
      expect(result.requests.map((request: { path: string }) => request.path)).toEqual([
        "/repos/Douglas0101/preco-que-da-lucro/branches/main",
        "/api/project_analyses/search",
        "/api/measures/component",
        "/api/qualitygates/project_status",
        "/api/project_analyses/search",
        "/repos/Douglas0101/preco-que-da-lucro/branches/main",
      ]);
      expect(result.requests[3].query).toBe("?analysisId=analysis-own-main");
    }
  });
  it("observação independente não lê um readout presente mas estranho", () => {
    const result = run(["--mode", "observe-main"], {}, { status: "unusable" });
    expect(result.status).toBe(0);
    expect(result.report.analysisId).toBe(analysis.key);
  });
  it("own-CE também pode preservar um NO-VERDICT sem aprovar main", () => {
    const { analysisId, ceTaskId, status, surface, conditions, ignoredConditions } = readout;
    const result = run(
      ["--mode", "post-ce-main"],
      {},
      {
        schema: readout.schema,
        status: "NO-VERDICT",
        providerIdentity: readout.providerIdentity,
        providerObservation: {
          analysisId,
          ceTaskId,
          status,
          surface,
          conditions,
          ignoredConditions,
        },
      },
    );
    expect(result.status).toBe(0);
    expect(result.report).toMatchObject({ analysisId, approvesMain: false });
  });
  it.each([
    { args: [] },
    { args: ["--mode", "unknown"] },
    { args: ["--mode", "observe-main", "extra"] },
  ])("modo inválido $args recusa antes da rede", ({ args }) => {
    const result = run(args);
    expect(result.status).toBe(2);
    expect(result.report).toMatchObject({
      verdict: "NO-VERDICT",
      reasonCode: "BASELINE_MODE_UNAVAILABLE",
      approvesMain: false,
    });
    expect(result.requests).toEqual([]);
  });
  it("pós-CE sem readout conserva a recusa, sem cair na observação", () => {
    const result = run(["--mode", "post-ce-main"]);
    expect(result.status).toBe(2);
    expect(result.report.reasonCode).toBe("GATE_READOUT_UNAVAILABLE");
    expect(result.requests).toHaveLength(1);
  });
  it.each([
    [
      { ...readout, providerIdentity: { revision: other, branch: "main", pullRequest: null } },
      "READOUT_REVISION_DIFFERS_FROM_MAIN",
    ],
    [{ ...readout, analysisId: "third-party-analysis" }, "NEWEST_ANALYSIS_NOT_CE_ANALYSIS"],
    [
      {
        ...readout,
        providerIdentity: { revision: sha, branch: "develop", pullRequest: "62" },
        surface: { branch: "develop", pullRequest: "62" },
      },
      "READOUT_SURFACE_NOT_MAIN",
    ],
  ])("pós-CE com identidade divergente recusa %s", (gate, reasonCode) => {
    const result = run(["--mode", "post-ce-main"], {}, gate);
    expect(result.status).toBe(2);
    expect(result.report.reasonCode).toBe(reasonCode);
  });
  it.each([
    [{ first: [] }, "ANALYSES_UNAVAILABLE"],
    [{ first: [{ ...analysis, revision: other }] }, "NEWEST_ANALYSIS_NOT_OUR_REVISION"],
    [{ first: [{ ...analysis, key: "" }] }, "NEWEST_ANALYSIS_ID_UNAVAILABLE"],
    [{ first: [{ ...analysis, date: "invalid" }] }, "ANALYSIS_DATE_UNAVAILABLE"],
    [{ refs: [sha, other] }, "BASELINE_CHANGED_DURING_MEASUREMENT"],
    [{ after: [{ ...analysis, key: "new-analysis" }] }, "BASELINE_CHANGED_DURING_MEASUREMENT"],
    [{ after: [{ ...analysis, revision: other }] }, "BASELINE_CHANGED_DURING_MEASUREMENT"],
    [
      { after: [{ ...analysis, date: "2026-10-12T01:00:00Z" }] },
      "BASELINE_CHANGED_DURING_MEASUREMENT",
    ],
    [{ component: "other-project" }, "BASELINE_METADATA_UNAVAILABLE"],
    [{ gate: "NONE" }, "BASELINE_METADATA_UNAVAILABLE"],
  ] as [Scenario, string][])("observação recusa %j com causa %s", (scenario, reasonCode) => {
    for (const mode of ["observe-main", "post-ce-main"]) {
      const result = run(["--mode", mode], scenario, mode === "post-ce-main" ? readout : undefined);
      expect(result.status).toBe(2);
      expect(result.report).toMatchObject({
        verdict: "NO-VERDICT",
        reasonCode:
          mode === "post-ce-main" && reasonCode === "NEWEST_ANALYSIS_ID_UNAVAILABLE"
            ? "NEWEST_ANALYSIS_NOT_CE_ANALYSIS"
            : reasonCode,
        approvesMain: false,
      });
      expect(result.report.mainSha).toBeUndefined();
    }
  });
  it("erro HTTP mantém NO-VERDICT e não persiste corpo bruto", () => {
    const result = run(["--mode", "observe-main"], { httpFailure: true });
    expect(result.status).toBe(2);
    expect(result.report.verdict).toBe("NO-VERDICT");
    expect(result.report.requests.at(-1)).toMatchObject({ status: 403 });
  });
  it("contadores ausentes não viram zero ou baseline verde", () => {
    const result = run(["--mode", "observe-main"], {
      metrics: { ...metrics, new_conditions_to_cover: null },
    });
    expect(result.status).toBe(2);
    expect(result.report.verdict).toBe("NO-VERDICT");
    expect(result.report.mainSha).toBeUndefined();
  });
});
