import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readoutEvidence } from "../../scripts/sonar/readout-evidence";
import { instrumentationFingerprint, scannerProvenance } from "../../scripts/sonar/lcov-provenance";

const revision = "a".repeat(40);
const identity = { revision, branch: "develop", pullRequest: "62" };
const observation = {
  status: "OK",
  analysisId: "analysis-fixture-62",
  ceTaskId: "ce-fixture-62",
  ignoredConditions: false,
  surface: { branch: null, branchType: "PULL_REQUEST", pullRequest: "62" },
  conditions: [
    { metric: "new_security_rating", status: "OK", comparator: "GT", threshold: "1", actual: "1" },
  ],
};
const root = () => ({
  schema: "c25-ce-gate-readout/1",
  providerIdentity: { ...identity },
  ...structuredClone(observation),
});
const preserved = () => ({
  schema: "c25-ce-gate-readout/1",
  status: "NO-VERDICT",
  reason: "gate controle obrigatório ausente ou alterado: NO-VERDICT",
  providerIdentity: { ...identity },
  providerObservation: structuredClone(observation),
});

describe("DBT-106 · CLI real do selo em bancada isolada", () => {
  it.each(["OK", "ERROR", "NO-VERDICT", "ambiguous", "absent"])(
    "selo %s confere identidade e mantém relatório intacto",
    (status) => {
      const directory = mkdtempSync(resolve(tmpdir(), "lcov-readout-")),
        cwd = resolve(directory, "repo"),
        runner = resolve(directory, "runner");
      mkdirSync(cwd);
      mkdirSync(runner);
      const git = (...args: string[]) =>
        execFileSync("git", args, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }).trim();
      const hash = (value: string) => createHash("sha256").update(value).digest("hex");
      try {
        mkdirSync(resolve(cwd, "src"));
        mkdirSync(resolve(cwd, "coverage"));
        const source = "export const fixture = 1;\n",
          lcov = "SF:src/fixture.ts\nDA:1,1\nend_of_record\n";
        writeFileSync(resolve(cwd, "src/fixture.ts"), source);
        writeFileSync(resolve(cwd, "coverage/lcov.info"), lcov);
        const installed = JSON.parse(readFileSync("package-lock.json", "utf8"));
        writeFileSync(
          resolve(cwd, "package-lock.json"),
          JSON.stringify({
            packages: Object.fromEntries(
              ["vitest", "@vitest/coverage-v8", "jsdom"].map((name) => [
                `node_modules/${name}`,
                { version: installed.packages[`node_modules/${name}`].version },
              ]),
            ),
          }),
        );
        writeFileSync(
          resolve(cwd, "package.json"),
          JSON.stringify({ type: "module", scripts: { "test:coverage": "vitest run --coverage" } }),
        );
        writeFileSync(resolve(cwd, "vitest.config.ts"), "export default {};\n");
        git("init", "-b", "develop");
        git("config", "user.email", "fixture@example.invalid");
        git("config", "user.name", "fixture");
        git("add", ".");
        git("commit", "-m", "fixture source");
        const actualRevision = git("rev-parse", "HEAD"),
          report =
            status === "NO-VERDICT" || status === "ambiguous" || status === "absent"
              ? preserved()
              : { ...root(), status };
        report.providerIdentity.revision = actualRevision;
        const value =
          status === "ambiguous"
            ? { ...report, analysisId: "other-analysis" }
            : status === "absent"
              ? { ...report, providerObservation: undefined }
              : report;
        const bytes = JSON.stringify(value);
        writeFileSync(resolve(runner, "c25-gate-readout.json"), bytes);
        // Redirect only this child's fixed scanner-log read; never write /tmp/scanner.log or share state.
        const preload = resolve(directory, "scanner-fixture.mjs");
        writeFileSync(
          preload,
          `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
const original=fs.readFileSync;
fs.readFileSync=(file,...args)=>String(file)==='/tmp/scanner.log' ? 'Sensor JavaScript/TypeScript Coverage\\n' : original(file,...args);
syncBuiltinESMExports();
`,
        );
        const result = spawnSync(
          process.execPath,
          ["--import", preload, resolve("scripts/sonar/lcov-provenance.ts")],
          {
            cwd,
            env: { PATH: process.env.PATH, RUNNER_TEMP: runner },
            encoding: "utf8",
            timeout: 12000,
          },
        );
        expect(result.error).toBeUndefined();
        expect(readFileSync(resolve(runner, "c25-gate-readout.json"), "utf8")).toBe(bytes);
        const sealed = resolve(cwd, "coverage/lcov-provenance.json");
        if (status === "ambiguous" || status === "absent") {
          expect(result.status).toBe(2);
          expect(result.stderr).toContain(
            status === "ambiguous" ? "READOUT_FORMAT_AMBIGUOUS" : "READOUT_OBSERVATION_UNAVAILABLE",
          );
          expect(result.stderr).not.toContain("PROVENANCE_UNCLASSIFIED");
          expect(existsSync(sealed)).toBe(false);
        } else {
          expect(result.status, result.stderr).toBe(0);
          expect(JSON.parse(readFileSync(sealed, "utf8"))).toEqual({
            schema: "sonar-lcov-provenance/1",
            revision: actualRevision,
            analysisId: observation.analysisId,
            taskId: observation.ceTaskId,
            branch: "develop",
            pullRequest: "62",
            instrumentation: instrumentationFingerprint(cwd),
            lcovSha256: hash(lcov),
            coverageSensorObserved: true,
            sourceHashes: { "src/fixture.ts": hash(source) },
            periodDigest: null,
            mainUnits: null,
          });
          expect(readoutEvidence(value).readoutStatus).toBe(status);
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});

describe("DBT-106 · identidade preservada não é aprovação de release", () => {
  it.each(["OK", "ERROR", "NO-VERDICT"])("normaliza %s sem alterar o veredito", (status) => {
    const report = status === "NO-VERDICT" ? preserved() : { ...root(), status };
    const before = JSON.stringify(report);
    const evidence = readoutEvidence(report);
    expect(evidence).toEqual({
      readoutStatus: status,
      analysisId: observation.analysisId,
      ceTaskId: observation.ceTaskId,
      providerIdentity: identity,
      approvesRelease: false,
    });
    expect(JSON.stringify(report)).toBe(before);
    const lcov = "SF:src/fixture.ts\nDA:1,1\nend_of_record\n";
    const seal = scannerProvenance(
      revision,
      lcov,
      evidence,
      "Sensor JavaScript/TypeScript Coverage",
      "b".repeat(64),
      () => "c".repeat(64),
    );
    expect(seal).toMatchObject({
      analysisId: observation.analysisId,
      taskId: observation.ceTaskId,
    });
    expect(seal).not.toHaveProperty("releasePolicy");
    expect(seal).not.toHaveProperty("approvesRelease");
    expect(JSON.stringify(report)).toBe(before);
  });

  it("normaliza a observação real do run reprovado, sem mudar o NO-VERDICT", () => {
    const report = JSON.parse(
      readFileSync(
        "docs/evidence/pr62-root-causes-2026-10-12/captures/c25-gate-readout.json",
        "utf8",
      ),
    );
    const before = JSON.stringify(report);
    expect(readoutEvidence(report)).toMatchObject({
      readoutStatus: "NO-VERDICT",
      analysisId: "ca31e0f1-aca3-4431-9bbd-6a314159c532",
      ceTaskId: "AaEuDL3Y_VRRlkU-_fKk",
      providerIdentity: { revision: "8d5daf49767dd6f2761e0b0bb5c687e7e53e4f9d", pullRequest: "62" },
      approvesRelease: false,
    });
    expect(JSON.stringify(report)).toBe(before);
  });

  it("recusa layouts ambíguos em vez de escolher IDs por preferência", () => {
    for (const report of [
      { ...preserved(), analysisId: "other-analysis" },
      { ...preserved(), ceTaskId: "other-task" },
      { ...root(), providerObservation: observation },
    ])
      expect(() => readoutEvidence(report)).toThrow("READOUT_FORMAT_AMBIGUOUS");
  });

  it.each([null, {}, [], { ...root(), schema: "other" }, { ...root(), status: "PENDING" }])(
    "recusa formato ausente/estranho %j",
    (report) => expect(() => readoutEvidence(report)).toThrow("READOUT_FORMAT_UNAVAILABLE"),
  );

  it("recusa identidade incompleta ou superfície principal inconsistente", () => {
    for (const providerIdentity of [
      null,
      { ...identity, revision: "short" },
      { ...identity, branch: "" },
      { ...identity, pullRequest: "0" },
      { ...identity, pullRequest: undefined },
      { ...identity, pullRequest: null },
      { ...identity, branch: "main" },
    ])
      expect(() => readoutEvidence({ ...preserved(), providerIdentity })).toThrow(
        "READOUT_IDENTITY_UNAVAILABLE",
      );
  });

  it("recusa observação/IDs não validados e não inventa fallback para NO-VERDICT", () => {
    for (const providerObservation of [
      undefined,
      null,
      { ...observation, analysisId: "" },
      { ...observation, ceTaskId: "secret/raw-url" },
      { ...observation, status: "PENDING" },
      { ...observation, ignoredConditions: undefined },
      { ...observation, conditions: [{}] },
      { ...observation, conditions: null },
      { ...observation, surface: undefined },
    ])
      expect(() => readoutEvidence({ ...preserved(), providerObservation })).toThrow(
        "READOUT_OBSERVATION_UNAVAILABLE",
      );
  });

  it("recusa superfície divergente na observação, além da identidade externa", () => {
    for (const surface of [
      { ...observation.surface, branch: "main" },
      { ...observation.surface, pullRequest: "61" },
    ])
      expect(() => readoutEvidence({ ...root(), surface })).toThrow("READOUT_SURFACE_DIVERGENT");
  });

  it("mantém a recusa de revisão e sensor no selo, após normalizar", () => {
    const evidence = readoutEvidence(preserved());
    for (const [sha, sensor] of [
      ["d".repeat(40), "Sensor JavaScript/TypeScript Coverage"],
      [revision, "sensor absent"],
    ])
      expect(() =>
        scannerProvenance(
          sha,
          "SF:src/fixture.ts\nDA:1,1\nend_of_record\n",
          evidence,
          sensor,
          "b".repeat(64),
          () => "c".repeat(64),
        ),
      ).toThrow("scanner revision/sensor");
  });
});
