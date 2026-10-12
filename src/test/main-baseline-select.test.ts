import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { selectMainAnalysis } from "../../scripts/sonar/main-baseline-select";

const sha = "a".repeat(40);
const otherSha = "b".repeat(40);
/** Análise do CE deste run (attempt 2 do run 38112535521) e a anterior da MESMA revisão. */
const ceAnalysis = "08d02858-5846-445b-b349-9e1fc4fe6ba3";
const earlierAnalysis = "11893646-49df-4fe9-a029-de9cec53dbf2";
const analysis = (key: string, revision = sha) => ({ key, revision });

describe("DBT-103 · seleção da análise de main que serve de baseline", () => {
  it("RE-EXECUÇÃO: duas análises da mesma revisão medem a análise do CE, não recusam", () => {
    // O defeito medido: `matches.length !== 1` reprovava a segunda submissão da mesma revisão e
    // derrubava o check exigido `scan + cobertura` de main.
    expect(
      selectMainAnalysis({
        analyses: [analysis(ceAnalysis), analysis(earlierAnalysis)],
        mainSha: sha,
        ceAnalysisId: ceAnalysis,
      }),
    ).toEqual({ ok: true, analysis: { key: ceAnalysis, revision: sha } });
  });

  it.each([3, 5])(
    "histórico com %i análises da mesma revisão não muda a seleção nem a inspira",
    (count) => {
      const analyses = [
        analysis(ceAnalysis),
        ...Array.from({ length: count - 1 }, (_, index) => analysis(`earlier-${index}`)),
      ];
      expect(selectMainAnalysis({ analyses, mainSha: sha, ceAnalysisId: ceAnalysis })).toEqual({
        ok: true,
        analysis: { key: ceAnalysis, revision: sha },
      });
    },
  );

  it("primeira execução: uma só análise continua selecionando a mesma análise", () => {
    expect(
      selectMainAnalysis({
        analyses: [analysis(ceAnalysis)],
        mainSha: sha,
        ceAnalysisId: ceAnalysis,
      }),
    ).toEqual({ ok: true, analysis: { key: ceAnalysis, revision: sha } });
  });

  it("recusa quando a análise mais recente de main não é a do CE (medição de terceiro)", () => {
    expect(
      selectMainAnalysis({
        analyses: [analysis(earlierAnalysis), analysis(ceAnalysis)],
        mainSha: sha,
        ceAnalysisId: ceAnalysis,
      }),
    ).toEqual({ ok: false, reasonCode: "NEWEST_ANALYSIS_NOT_CE_ANALYSIS" });
  });

  it("recusa quando a análise mais recente é de outra revisão", () => {
    expect(
      selectMainAnalysis({
        analyses: [analysis(ceAnalysis, otherSha)],
        mainSha: sha,
        ceAnalysisId: ceAnalysis,
      }),
    ).toEqual({ ok: false, reasonCode: "NEWEST_ANALYSIS_NOT_OUR_REVISION" });
  });

  it("recusa lista de análises vazia", () => {
    expect(selectMainAnalysis({ analyses: [], mainSha: sha, ceAnalysisId: ceAnalysis })).toEqual({
      ok: false,
      reasonCode: "ANALYSES_UNAVAILABLE",
    });
  });

  it("recusa lista de análises ausente", () => {
    expect(
      selectMainAnalysis({ analyses: undefined, mainSha: sha, ceAnalysisId: ceAnalysis }),
    ).toEqual({ ok: false, reasonCode: "ANALYSES_UNAVAILABLE" });
  });

  it("recusa analysisId do CE vazio", () => {
    expect(
      selectMainAnalysis({ analyses: [analysis(ceAnalysis)], mainSha: sha, ceAnalysisId: "" }),
    ).toEqual({ ok: false, reasonCode: "CE_ANALYSIS_ID_UNAVAILABLE" });
  });

  it("recusa analysisId do CE ausente", () => {
    expect(
      selectMainAnalysis({
        analyses: [analysis(ceAnalysis)],
        mainSha: sha,
        ceAnalysisId: undefined,
      }),
    ).toEqual({ ok: false, reasonCode: "CE_ANALYSIS_ID_UNAVAILABLE" });
  });
});

describe("DBT-103 · o selo de proveniência nomeia a causa em vez de sair 2 sem diagnóstico", () => {
  const script = resolve("scripts/sonar/lcov-provenance.ts");
  const lcov = "TN:\nSF:src/fixture.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n";
  const readout = {
    schema: "c25-ce-gate-readout/1",
    observedAt: "2026-10-11T15:03:02.068Z",
    runnerSha: sha,
    checkoutSha: sha,
    analysisId: ceAnalysis,
    ceTaskId: "AaErfPmYHxi1U64p4iLF",
    status: "OK",
    ignoredConditions: false,
    conditions: [],
    surface: { branch: "main", branchType: "BRANCH", pullRequest: null },
    providerIdentity: { revision: sha, branch: "main", pullRequest: null },
  };
  function seal(files: Record<string, string>) {
    const directory = mkdtempSync(resolve(tmpdir(), "dbt103-seal-"));
    try {
      mkdirSync(resolve(directory, "coverage"), { recursive: true });
      writeFileSync(resolve(directory, "coverage/lcov.info"), files.lcov ?? lcov);
      for (const [name, body] of Object.entries(files))
        if (name !== "lcov") writeFileSync(resolve(directory, name), body);
      // O selo lê `git rev-parse HEAD` como o CI lê: a bancada precisa ser um repositório real, senão
      // a recusa medida seria de outra fase (REVISION_UNAVAILABLE) e o teste mediria outra coisa.
      execFileSync("git", ["init", "--quiet"], { cwd: directory });
      execFileSync("git", ["add", "-A"], { cwd: directory });
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Fixture",
          "-c",
          "user.email=fixture@example.invalid",
          "commit",
          "--quiet",
          "-m",
          "fixture",
        ],
        { cwd: directory },
      );
      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        env: { ...process.env, RUNNER_TEMP: directory },
        encoding: "utf8",
      });
      return { status: result.status, stderr: result.stderr ?? "" };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  it("baseline em stub NO-VERDICT (o estado real do attempt 2) recusa com código nomeado", () => {
    const stub = JSON.stringify({
      schema: "main-baseline/2",
      verdict: "NO-VERDICT",
      observedAt: "2026-10-11T15:03:02.762Z",
      reason:
        "Baseline identity/metadata/transport precondition failed; raw provider bodies withheld.",
      requests: [],
    });
    const result = seal({
      "c25-gate-readout.json": JSON.stringify(readout),
      "c24-main-baseline.json": stub,
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("BASELINE_ARTIFACT_UNUSABLE");
  });

  it("gate readout ausente recusa com código nomeado distinto", () => {
    const result = seal({});
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("GATE_READOUT_UNAVAILABLE");
  });
});
