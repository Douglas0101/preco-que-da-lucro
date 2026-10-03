import { describe, expect, it } from "vitest";
import {
  analysisIdentity,
  ceVerdict,
  providerTask,
  scannerRevision,
  scannerTask,
} from "../../scripts/sonar/gate-readout";

describe("provider revision and analysis surface", () => {
  const revision = "a".repeat(40);
  const expected = { revision, branch: "develop", pullRequest: "60" };
  const provider = { branch: "develop", pullRequest: "60" };
  it("accepts the exact provider revision and PR surface", () => {
    expect(analysisIdentity(provider, expected, revision)).toEqual({
      revision,
      branch: "develop",
      pullRequest: "60",
    });
  });
  it("cannot use a runner SHA in place of missing, stale or wrong provider evidence", () => {
    for (const sha of ["", "b".repeat(40)])
      expect(() => analysisIdentity(provider, expected, sha)).toThrow("revision");
    expect(() => analysisIdentity({ ...provider, pullRequest: "61" }, expected, revision)).toThrow(
      "PR/branch",
    );
    expect(() => analysisIdentity({ ...provider, branch: "main" }, expected, revision)).toThrow(
      "PR/branch",
    );
  });
  it("requires a main analysis for a main push", () => {
    expect(
      analysisIdentity({ branch: "main" }, { revision, branch: "main" }, revision).pullRequest,
    ).toBeNull();
    expect(() => analysisIdentity(provider, { revision, branch: "main" }, revision)).toThrow();
  });
  it("extracts only one exact revision without persisting scanner context", () => {
    expect(scannerRevision(`secret=PRIVATE_SENTINEL\nsonar.scm.revision=${revision}\n`)).toBe(
      revision,
    );
    for (const text of [
      "",
      "sonar.scm.revision=short",
      `sonar.scm.revision=${revision}\nsonar.scm.revision=${revision}`,
    ])
      expect(() => scannerRevision(text)).toThrow();
  });
  it("uses the provider scanner properties when a PR task omits its branch", () => {
    const scannerContext = `Scanner properties:\n  - sonar.scm.revision=${revision}\n  - sonar.pullrequest.key=60\n  - sonar.pullrequest.branch=develop\n  - secret=PRIVATE_SENTINEL\n`;
    const result = analysisIdentity({ pullRequest: "60", scannerContext }, expected, revision);
    expect(result).toEqual({ revision, branch: "develop", pullRequest: "60" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_SENTINEL");
    for (const context of [
      scannerContext.replace("key=60", "key=61"),
      scannerContext.replace("branch=develop", "branch=main"),
      scannerContext.replace(revision, "b".repeat(40)),
      `${scannerContext}sonar.pullrequest.branch=develop\n`,
      scannerContext.replace("  - sonar.pullrequest.branch=develop\n", ""),
    ])
      expect(() =>
        analysisIdentity({ pullRequest: "60", scannerContext: context }, expected, revision),
      ).toThrow();
    expect(() =>
      analysisIdentity({ branch: "main", pullRequest: "60", scannerContext }, expected, revision),
    ).toThrow();
  });
  it("requires an explicit provider main identity and rejects PR contamination", () => {
    const scannerContext = `sonar.scm.revision=${revision}\nsonar.branch.name=main\n`;
    expect(analysisIdentity({ scannerContext }, { revision, branch: "main" }, revision)).toEqual({
      revision,
      branch: "main",
      pullRequest: null,
    });
    for (const context of [
      `sonar.scm.revision=${revision}\n`,
      scannerContext.replace("name=main", "name=develop"),
      `${scannerContext}sonar.pullrequest.key=60\n`,
    ])
      expect(() =>
        analysisIdentity({ scannerContext: context }, { revision, branch: "main" }, revision),
      ).toThrow();
  });
});

const taskId = "ce-readout-fixture-60";
const project = "Douglas0101_preco-que-da-lucro";
const reportTask = `projectKey=${project}\nceTaskId=${taskId}\nceTaskUrl=https://sonarcloud.io/api/ce/task?id=${taskId}\n`;
const task = { id: taskId, componentKey: project, status: "SUCCESS", analysisId: "analysis-60" };
const gate = {
  status: "ERROR",
  conditions: [
    { metricKey: "new_coverage", status: "ERROR", comparator: "LT", errorThreshold: "80" },
  ],
};

describe("CE optional scanner context API contract", () => {
  it("requests context on the same CE task and never invents a separate endpoint", async () => {
    const requested: string[] = [];
    const fixture = { ...task, scannerContext: "secret=PRIVATE_SENTINEL" };
    const result = await providerTask(scannerTask(reportTask), async <T>(url: string) => {
      requested.push(url);
      return { task: fixture } as T;
    });
    expect(requested).toEqual([
      `https://sonarcloud.io/api/ce/task?id=${taskId}&additionalFields=scannerContext`,
    ]);
    expect(result).toEqual(fixture);
  });
  it("rejects a different task and refuses a credential-bearing request to a different origin", async () => {
    const requested: string[] = [];
    const read = async <T>(url: string) => {
      requested.push(url);
      return { task: { ...task, id: "other-task" } } as T;
    };
    await expect(providerTask(scannerTask(reportTask), read)).rejects.toThrow("CE task");
    requested.length = 0;
    await expect(
      providerTask({ id: taskId, url: `https://example.invalid/api/ce/task?id=${taskId}` }, read),
    ).rejects.toThrow("origem");
    expect(requested).toEqual([]);
  });
});

describe("identidade e origem do task produzido pelo scanner", () => {
  it("aceita somente o task do projeto na origem SonarCloud", () => {
    expect(scannerTask(reportTask)).toEqual({
      id: taskId,
      url: `https://sonarcloud.io/api/ce/task?id=${taskId}`,
    });
  });
  it("recusa substituição de origem antes de transmitir a credencial", () => {
    expect(() => scannerTask(reportTask.replace("sonarcloud.io", "example.invalid"))).toThrow();
  });
  it("recusa task diferente, projeto diferente e campo duplicado", () => {
    expect(() => scannerTask(reportTask.replace(`?id=${taskId}`, "?id=outro-task"))).toThrow();
    expect(() => scannerTask(reportTask.replace(project, "outro-projeto"))).toThrow();
    expect(() => scannerTask(`${reportTask}ceTaskId=${taskId}\n`)).toThrow();
  });
  it("recusa relatório vazio e URL autenticada", () => {
    expect(() => scannerTask("")).toThrow();
    expect(() => scannerTask(reportTask.replace("https://", "https://user@"))).toThrow();
  });
});

describe("veredito do CE, sem equivalência entre superfícies", () => {
  it("nomeia ERROR pelo analysisId e preserva valor ausente como null", () => {
    const result = ceVerdict(task, gate, taskId);
    expect(result.analysisId).toBe("analysis-60");
    expect(result.status).toBe("ERROR");
    expect(result.conditions[0]?.actual).toBeNull();
    expect(result.surface.branch).toBeNull();
  });
  it("nomeia OK sem inventar cobertura quando a condição está ausente", () => {
    expect(ceVerdict(task, { status: "OK", conditions: [] }, taskId).conditions).toEqual([]);
  });
  it("preserva zero medido como valor, distinto de null", () => {
    expect(
      ceVerdict(
        task,
        { ...gate, conditions: [{ ...gate.conditions[0], actualValue: "0" }] },
        taskId,
      ).conditions[0]?.actual,
    ).toBe("0");
  });
  it("recusa CE pendente/falho, análise ausente e identidade substituída", () => {
    for (const patch of [
      { status: "PENDING" },
      { status: "FAILED" },
      { analysisId: undefined },
      { id: "outro-task" },
      { componentKey: "outro-projeto" },
    ]) {
      expect(() => ceVerdict({ ...task, ...patch }, gate, taskId)).toThrow();
    }
  });
  it("gate nulo, NONE ou condição ilegível não viram verde", () => {
    expect(() => ceVerdict(task, undefined, taskId)).toThrow();
    expect(() => ceVerdict(task, { status: "NONE", conditions: [] }, taskId)).toThrow();
    expect(() => ceVerdict(task, { status: "OK" }, taskId)).toThrow();
    expect(() => ceVerdict(task, { status: "OK", conditions: [{}] }, taskId)).toThrow();
  });
});
