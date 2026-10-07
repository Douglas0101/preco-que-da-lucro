import { describe, expect, it } from "vitest";
import {
  analysisIdentity,
  ceVerdict,
  completedProviderTask,
  providerTask,
  releaseVerdict,
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

describe("ADR-042: minimum coverage 60 with preserved provider evidence", () => {
  const controls = [
    ["new_security_rating", "GT", "1", "1"],
    ["new_reliability_rating", "GT", "1", "1"],
    ["new_maintainability_rating", "GT", "1", "1"],
    ["new_duplicated_lines_density", "GT", "3", "0.0"],
    ["new_security_hotspots_reviewed", "LT", "100", "100.0"],
  ];
  function fixture(coverage: string, threshold = "80") {
    const status = Number(coverage) < Number(threshold) ? "ERROR" : "OK";
    return ceVerdict(
      task,
      {
        status,
        ignoredConditions: false,
        conditions: [
          ...controls.map(([metricKey, comparator, errorThreshold, actualValue]) => ({
            metricKey,
            comparator,
            errorThreshold,
            actualValue,
            status: "OK",
          })),
          {
            metricKey: "new_coverage",
            comparator: "LT",
            errorThreshold: threshold,
            actualValue: coverage,
            status,
          },
        ],
      },
      taskId,
    );
  }
  it.each(["60", "63.23873121869783", "79.9", "80", "100"])(
    "accepts measured %s and retains the original provider verdict",
    (value) => {
      const raw = fixture(value);
      const original = JSON.stringify(raw);
      const result = releaseVerdict(raw);
      expect(result.status).toBe("OK");
      expect(result.providerGateStatus).toBe(Number(value) < 80 ? "ERROR" : "OK");
      expect(result.coverage).toMatchObject({ actual: Number(value), minimum: 60 });
      expect(JSON.stringify(raw)).toBe(original);
    },
  );
  it.each(["0", "59.99"])("blocks measured %s below the mandatory floor", (value) => {
    expect(releaseVerdict(fixture(value)).status).toBe("ERROR");
  });
  it("also accepts an already updated provider threshold", () => {
    expect(releaseVerdict(fixture("60", "60")).status).toBe("OK");
  });
  it.each(controls)("still blocks a failure of %s", (metric, comparator) => {
    const raw = fixture("100");
    const condition = raw.conditions.find((entry) => entry.metric === metric)!;
    condition.actual = comparator === "GT" ? (metric.endsWith("_rating") ? "2" : "4") : "99";
    condition.status = "ERROR";
    raw.status = "ERROR";
    expect(releaseVerdict(raw)).toMatchObject({ status: "ERROR", blockingConditions: [condition] });
  });
  it("retains failures of additional provider controls", () => {
    const raw = fixture("100");
    raw.status = "ERROR";
    raw.conditions.push({
      metric: "future_security_control",
      status: "ERROR",
      comparator: "GT",
      threshold: "0",
      actual: "1",
    });
    expect(releaseVerdict(raw).status).toBe("ERROR");
  });
  it.each([null, "", " ", "NaN", "-1", "101", "Infinity", "60abc"])(
    "refuses missing or invalid coverage %s",
    (value) => {
      const raw = fixture("60");
      raw.conditions.at(-1)!.actual = value;
      expect(() => releaseVerdict(raw)).toThrow("NO-VERDICT");
    },
  );
  it("requires every preserved control, with its original comparator and threshold", () => {
    for (const [metric, comparator] of controls) {
      const failedActual = comparator === "GT" ? (metric.endsWith("_rating") ? "2" : "4") : "99";
      for (const patch of [
        null,
        { comparator: comparator === "LT" ? "GT" : "LT" },
        { threshold: "999" },
        { actual: "" },
        { actual: "NaN" },
        { actual: "999" },
        { status: "NONE" },
        { actual: failedActual, status: "OK" },
      ]) {
        const raw = fixture("60");
        const condition = raw.conditions.find((entry) => entry.metric === metric)!;
        if (patch === null) raw.conditions = raw.conditions.filter((entry) => entry !== condition);
        else Object.assign(condition, patch);
        expect(() => releaseVerdict(raw)).toThrow("NO-VERDICT");
      }
    }
  });
  it("refuses ignored, duplicate, absent and contradictory evidence", () => {
    for (const mutate of [
      (raw: ReturnType<typeof fixture>) => {
        raw.ignoredConditions = true;
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.ignoredConditions = null;
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.conditions.push(raw.conditions[0]);
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.conditions.pop();
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.status = "OK";
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.conditions.at(-1)!.status = "OK";
      },
      (raw: ReturnType<typeof fixture>) => {
        raw.conditions.at(-1)!.threshold = "0";
      },
    ]) {
      const raw = fixture("60");
      mutate(raw);
      expect(() => releaseVerdict(raw)).toThrow("NO-VERDICT");
    }
    const noErrors = fixture("100");
    noErrors.status = "ERROR";
    expect(() => releaseVerdict(noErrors)).toThrow("NO-VERDICT");
  });
});

describe("bounded completion of the exact Compute Engine task", () => {
  it("waits through pending states without replacing task identity", async () => {
    let time = 0;
    const pending = ["PENDING", "IN_PROGRESS", "SUCCESS"];
    const requested: string[] = [];
    const result = await completedProviderTask(
      scannerTask(reportTask),
      async <T>(url: string) => {
        requested.push(url);
        return { task: { ...task, status: pending.shift() } } as T;
      },
      {
        now: () => time,
        pause: async (ms) => {
          time += ms;
        },
      },
    );
    expect(result.status).toBe("SUCCESS");
    expect(time).toBe(4000);
    expect(new Set(requested)).toEqual(
      new Set([`https://sonarcloud.io/api/ce/task?id=${taskId}&additionalFields=scannerContext`]),
    );
  });
  it.each(["FAILED", "CANCELED", "NONE", undefined])("refuses %s", async (status) => {
    await expect(
      completedProviderTask(
        scannerTask(reportTask),
        async <T>() => ({ task: { ...task, status } }) as T,
      ),
    ).rejects.toThrow("NO-VERDICT");
  });
  it("refuses both persistent pending and late success at the deadline", async () => {
    for (const status of ["PENDING", "SUCCESS"]) {
      let time = 0;
      await expect(
        completedProviderTask(
          scannerTask(reportTask),
          async <T>() => {
            time += 300_000;
            return { task: { ...task, status } } as T;
          },
          { now: () => time },
        ),
      ).rejects.toThrow("prazo");
    }
  });
  it("bounds observations even if the clock stalls and refuses backwards time", async () => {
    let calls = 0;
    await expect(
      completedProviderTask(
        scannerTask(reportTask),
        async <T>() => {
          calls++;
          return { task: { ...task, status: "PENDING" } } as T;
        },
        { timeoutMs: 4000, now: () => 1, pause: async () => {} },
      ),
    ).rejects.toThrow("limite");
    expect(calls).toBe(3);
    let time = 1;
    await expect(
      completedProviderTask(
        scannerTask(reportTask),
        async <T>() => {
          time = 0;
          return { task } as T;
        },
        { now: () => time },
      ),
    ).rejects.toThrow("prazo");
  });
  it("refuses an invalid budget before reading any provider state", async () => {
    let calls = 0;
    for (const timeoutMs of [0, -1, NaN, Infinity, 300001])
      await expect(
        completedProviderTask(
          scannerTask(reportTask),
          async <T>() => {
            calls++;
            return { task } as T;
          },
          { timeoutMs },
        ),
      ).rejects.toThrow("orçamento");
    expect(calls).toBe(0);
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
