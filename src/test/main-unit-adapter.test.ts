import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectMetadata,
  mapMainUnits,
  provenance,
  sha256,
} from "../../scripts/sonar/main-unit-adapter";
import { coverageMetadata } from "../../scripts/sonar/main-unit-probe";
import { instrumentationFingerprint, scannerProvenance } from "../../scripts/sonar/lcov-provenance";
import { evaluateMirrorArtifacts } from "../../scripts/sonar/mirror-runner";
import { selectMainOriginRun } from "../../scripts/sonar/main-origin-run";
import type { apiReader } from "../../scripts/sonar/api";

const file = "src/lib/example.ts",
  revision = "a".repeat(40),
  source = "b".repeat(64),
  instrumentation = "c".repeat(64);
const now = "2026-10-03T12:00:00Z";
const baseline = {
  mainSha: revision,
  analysisId: "main-analysis",
  observedAt: now,
  period: { mode: "previous_version", parameter: "0.0.1", date: "2026-10-01T00:00:00Z" },
  metrics: {
    new_lines_to_cover: 4,
    new_uncovered_lines: 1,
    new_conditions_to_cover: 1,
    new_uncovered_conditions: 1,
    new_coverage: 60,
  },
};
const lcov = (paid = 0, old = 1, first = 1) =>
  `TN:\nSF:${file}\nDA:1,${first}\nDA:2,1\nDA:3,1\nDA:4,${paid}\nDA:6,${old}\nBRDA:5,0,0,0\nend_of_record\n`;
const gate = (branch = "main", pullRequest: string | null = null) => ({
  analysisId: branch === "main" ? "main-analysis" : "pr-analysis",
  ceTaskId: `task-${branch}`,
  providerIdentity: { revision, branch, pullRequest },
});
const origin = (text = lcov(), branch = "main", pr: string | null = null) =>
  scannerProvenance(
    revision,
    text,
    gate(branch, pr),
    "Sensor JavaScript/TypeScript Coverage",
    instrumentation,
    () => source,
    branch === "main" ? baseline : undefined,
  );
function metadata() {
  return [
    {
      path: file,
      key: `project:${file}`,
      metrics: baseline.metrics,
      rows: coverageMetadata({
        sources: [
          ...[1, 2, 3, 4].map((line) => ({ line, isNew: true, lineHits: line < 4 ? 1 : 0 })),
          { line: 5, isNew: true, conditions: 1, coveredConditions: 0 },
          { line: 6, isNew: false, lineHits: 1 },
        ],
      }).rows,
    },
  ];
}
function input(candidate = lcov(1)) {
  const snapshot = mapMainUnits(baseline, origin(), lcov(), metadata(), () => ({ hash: source }));
  const snapshotBytes = JSON.stringify(snapshot),
    snapshotDigest = sha256(snapshotBytes);
  return {
    baseline,
    snapshot,
    snapshotBytes,
    snapshotDigest,
    adapter: {
      schema: "main-unit-adapter/1",
      verdict: "MAPPED",
      mainSha: revision,
      analysisId: baseline.analysisId,
      metadataDigest: snapshot.metadataDigest,
      snapshotSha256: snapshotDigest,
    },
    mainLcov: lcov(),
    mainOrigin: origin(),
    candidateLcov: candidate,
    candidateOrigin: origin(candidate, "develop", "60"),
    candidateGate: gate("develop", "60"),
    checkoutSha: revision,
    expectedBranch: "develop",
    expectedPr: "60",
    instrumentation,
    sourceHash: () => source,
    now,
  };
}
describe("complete unit adapter, original scanner provenance and conservative CLI decision", () => {
  it("maps condition IDs from the ORIGINAL consumed LCOV and reconciles provider counts", () => {
    const snapshot = input().snapshot;
    expect(snapshot.units).toHaveLength(5);
    expect(snapshot.units.at(-1)).toEqual({ file, line: 5, branch: "0,0", covered: false });
    expect(snapshot.units.some((unit) => unit.line === 6)).toBe(false);
    expect(evaluateMirrorArtifacts(input())).toMatchObject({
      pass: true,
      covered: 4,
      paid: [`${file}:4:line`],
    });
    expect(evaluateMirrorArtifacts(input(lcov(0, 50)))).toMatchObject({
      pass: false,
      paid: [],
      coverage: 60,
    });
    expect(evaluateMirrorArtifacts(input(lcov(1, 1, 0)))).toMatchObject({
      pass: false,
      lost: [`${file}:1:line`],
    });
  });
  it("does not promote numeric branch totals without original individual identities", () => {
    for (const text of [
      lcov().replace("BRDA:5,0,0,0\n", ""),
      lcov().replace("BRDA:5,0,0,0", "BRDA:5,0,0,-"),
    ]) {
      expect(() =>
        mapMainUnits(baseline, origin(text), text, metadata(), () => ({ hash: source })),
      ).toThrow();
    }
  });
  it("missing new-code markers, ambiguous aliases, duplicate files and changed source cannot map", () => {
    const mutations = [
      () => {
        const m = metadata();
        m[0].rows[0].isNew = null;
        return m;
      },
      () => {
        const m = metadata();
        m[0].rows[0].utLineHits = 0;
        return m;
      },
      () => [...metadata(), ...metadata()],
      () => {
        const m = metadata();
        m[0].rows.pop();
        m[0].rows.pop();
        return m;
      },
    ];
    for (const mutate of mutations)
      expect(() =>
        mapMainUnits(baseline, origin(), lcov(), mutate(), () => ({ hash: source })),
      ).toThrow();
    expect(() =>
      mapMainUnits(baseline, origin(), lcov(), metadata(), () => ({ hash: "d".repeat(64) })),
    ).toThrow();
  });
  it("sealed bytes, exact period, expected PR, sensor, source and instrumentation are required", () => {
    const mutations: ((value: ReturnType<typeof input>) => void)[] = [
      (v) => {
        v.snapshotDigest = "d".repeat(64);
      },
      (v) => {
        v.adapter.verdict = "NO-VERDICT";
      },
      (v) => {
        v.baseline = { ...v.baseline, period: { ...v.baseline.period, parameter: "changed" } };
      },
      (v) => {
        v.expectedPr = "61";
      },
      (v) => {
        v.instrumentation = "d".repeat(64);
      },
      (v) => {
        v.candidateGate = { ...v.candidateGate, analysisId: "other-analysis" };
      },
      (v) => {
        v.candidateOrigin = { ...v.candidateOrigin, coverageSensorObserved: false } as never;
      },
      (v) => {
        v.sourceHash = () => "d".repeat(64);
      },
      (v) => {
        v.now = "2026-10-03T12:30:00.001Z";
      },
    ];
    for (const mutate of mutations) {
      const value = input();
      mutate(value);
      expect(() => evaluateMirrorArtifacts(value)).toThrow();
    }
    const boundary = input();
    boundary.now = "2026-10-03T12:30:00Z";
    expect(evaluateMirrorArtifacts(boundary).pass).toBe(true);
    expect(() => provenance({ ...origin(), analysisId: "" }, lcov())).toThrow();
    expect(() =>
      scannerProvenance(revision, lcov(), gate(), "sensor absent", instrumentation, () => source),
    ).toThrow();
  });
  it("enumerates pages and checks every source line against immutable Git line count", async () => {
    const calls: string[] = [];
    const get = (async (_origin: string, endpoint: string) => {
      calls.push(endpoint);
      if (endpoint.startsWith("measures/"))
        return {
          paging: { total: 1 },
          components: [{ key: "project:src/lib/a.ts", path: "src/lib/a.ts", measures: [] }],
        };
      const params = new URLSearchParams(endpoint.split("?")[1]),
        from = Number(params.get("from")),
        to = Number(params.get("to"));
      return {
        sources: Array.from({ length: to - from + 1 }, (_, i) => ({
          line: from + i,
          isNew: false,
        })),
      };
    }) as ReturnType<typeof apiReader>;
    const result = await collectMetadata(get, "project", () => ({ hash: source, lines: 501 }));
    expect(result[0].rows).toHaveLength(501);
    expect(calls.filter((call) => call.startsWith("sources/"))).toHaveLength(2);
    expect(calls.at(-1)).toContain("from=501&to=501");
    const truncated = (async (_origin: string, endpoint: string) =>
      endpoint.startsWith("measures/")
        ? { paging: { total: 1 }, components: [{ key: "k", path: file, measures: [] }] }
        : { sources: [{ line: 1, isNew: true }] }) as ReturnType<typeof apiReader>;
    await expect(
      collectMetadata(truncated, "project", () => ({ hash: source, lines: 2 })),
    ).rejects.toThrow("truncated");
  });
  it("rejects changed totals and duplicate file identities across component pages", async () => {
    for (const duplicate of [false, true]) {
      let page = 0;
      const get = (async () => ({
        paging: { total: ++page === 1 ? 2 : duplicate ? 2 : 3 },
        components: [{ key: "k", path: file, measures: [] }],
      })) as ReturnType<typeof apiReader>;
      await expect(
        collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
      ).rejects.toThrow();
    }
  });
  it("selecting a completed immutable main run never substitutes a PR/develop artifact", () => {
    const run = {
      id: 12,
      path: ".github/workflows/sonar.yml",
      head_branch: "main",
      head_sha: revision,
      event: "push",
      status: "completed",
      created_at: now,
    };
    expect(selectMainOriginRun([run], revision)).toBe(12);
    for (const patch of [
      { head_branch: "develop" },
      { event: "pull_request" },
      { status: "in_progress" },
      { head_sha: "d".repeat(40) },
    ])
      expect(() => selectMainOriginRun([{ ...run, ...patch }], revision)).toThrow();
    expect(() => selectMainOriginRun([run, { ...run, id: 13 }], revision)).toThrow("ambiguous");
  });
  it("runs the real bare-Node CLI in its own Git fixture: PASS=0, FAIL=1, NO-VERDICT=2", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "mirror-cli-fixture-"));
    try {
      mkdirSync(resolve(directory, "src/lib"), { recursive: true });
      writeFileSync(resolve(directory, file), "// synthetic CLI fixture only\n");
      writeFileSync(
        resolve(directory, "vitest.config.ts"),
        "// fixture instrumentation configuration\n",
      );
      writeFileSync(
        resolve(directory, "package.json"),
        JSON.stringify({ scripts: { "test:coverage": "vitest run --coverage" } }),
      );
      writeFileSync(
        resolve(directory, "package-lock.json"),
        JSON.stringify({
          packages: Object.fromEntries(
            ["vitest", "@vitest/coverage-v8", "jsdom"].map((name) => [
              `node_modules/${name}`,
              { version: "fixture" },
            ]),
          ),
        }),
      );
      execFileSync("git", ["init", "--initial-branch=develop", "--quiet"], { cwd: directory });
      execFileSync(
        "git",
        ["add", "src/lib/example.ts", "vitest.config.ts", "package.json", "package-lock.json"],
        { cwd: directory },
      );
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
          "test fixture",
        ],
        { cwd: directory },
      );
      const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: directory,
        encoding: "utf8",
      }).trim();
      const stamp = new Date().toISOString(),
        hash = sha256(readFileSync(resolve(directory, file))),
        instr = instrumentationFingerprint(directory);
      const b = { ...baseline, mainSha: checkoutSha, observedAt: stamp };
      const g = (branch: string, pr: string | null) => ({
        ...gate(branch, pr),
        providerIdentity: { revision: checkoutSha, branch, pullRequest: pr },
      });
      const p = (text: string, branch: string, pr: string | null) =>
        scannerProvenance(
          checkoutSha,
          text,
          g(branch, pr),
          "Sensor JavaScript/TypeScript Coverage",
          instr,
          () => hash,
          branch === "main" ? b : undefined,
        );
      const mainOrigin = p(lcov(), "main", null),
        snapshot = mapMainUnits(b, mainOrigin, lcov(), metadata(), () => ({ hash })),
        bytes = JSON.stringify(snapshot),
        digest = sha256(bytes);
      const save = (name: string, value: unknown) => {
        const path = resolve(directory, name);
        writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
        return path;
      };
      const env = {
        ...process.env,
        RUNNER_TEMP: directory,
        EXPECTED_PR: "60",
        EXPECTED_BRANCH: "develop",
        SONAR_MAIN_UNIT_SNAPSHOT: save("snapshot.json", bytes),
        SONAR_MAIN_UNIT_SNAPSHOT_SHA256: digest,
        SONAR_MAIN_UNIT_ADAPTER_REPORT: save("adapter.json", {
          schema: "main-unit-adapter/1",
          verdict: "MAPPED",
          mainSha: checkoutSha,
          analysisId: b.analysisId,
          metadataDigest: snapshot.metadataDigest,
          snapshotSha256: digest,
        }),
        SONAR_MAIN_LCOV: save("main.lcov", lcov()),
        SONAR_MAIN_LCOV_PROVENANCE: save("main-origin.json", mainOrigin),
        SONAR_CANDIDATE_LCOV: resolve(directory, "candidate.lcov"),
        SONAR_CANDIDATE_LCOV_PROVENANCE: resolve(directory, "candidate-origin.json"),
        SONAR_CANDIDATE_GATE_REPORT: save("gate.json", g("develop", "60")),
      };
      save("c24-main-baseline.json", b);
      const command = resolve("scripts/sonar/gate-mirror.ts");
      for (const [candidate, status, verdict] of [
        [lcov(1), 0, "PASS"],
        [lcov(), 1, "FAIL"],
      ] as const) {
        save("candidate.lcov", candidate);
        save("candidate-origin.json", p(candidate, "develop", "60"));
        const result = spawnSync(process.execPath, [command], {
          cwd: directory,
          env,
          encoding: "utf8",
        });
        expect(result.status, result.stderr).toBe(status);
        expect(
          JSON.parse(readFileSync(resolve(directory, "c26-main-mirror.json"), "utf8")).verdict,
        ).toBe(verdict);
      }
      const result = spawnSync(process.execPath, [command], {
        cwd: directory,
        env: { ...env, SONAR_MAIN_UNIT_SNAPSHOT_SHA256: "" },
        encoding: "utf8",
      });
      expect(result.status).toBe(2);
      expect(
        JSON.parse(readFileSync(resolve(directory, "c26-main-mirror.json"), "utf8")).verdict,
      ).toBe("NO-VERDICT");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
