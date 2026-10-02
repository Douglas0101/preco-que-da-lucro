import { describe, expect, it } from "vitest";
import { ceVerdict, scannerTask } from "../../scripts/sonar/gate-readout";

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
