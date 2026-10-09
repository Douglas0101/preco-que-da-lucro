import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adapterDiagnostic,
  collectMetadata,
  mapMainUnits,
  provenance,
  sha256,
} from "../../scripts/sonar/main-unit-adapter";
import { coverageMetadata } from "../../scripts/sonar/main-unit-probe";
import { instrumentationFingerprint, scannerProvenance } from "../../scripts/sonar/lcov-provenance";
import { evaluateMirrorArtifacts } from "../../scripts/sonar/mirror-runner";
import { selectMainOriginRun } from "../../scripts/sonar/main-origin-run";
import { authoritativeUnits, mirror } from "../../scripts/sonar/unit-mirror";
import { classifyMirrorObservation } from "../../scripts/sonar/mirror-observation";
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
  it("accepts only coherent documented observations, never a release verdict", () => {
    const historical = {
      schema: "main-unit-adapter/1",
      verdict: "NO-VERDICT",
      reasonCode: "ORIGINAL_PROVENANCE_UNAVAILABLE",
      reason: "Original scanner provenance was not published.",
      mainSha: revision,
      analysisId: baseline.analysisId,
      requests: [],
    };
    expect(classifyMirrorObservation("adapter", historical, 2)).toBe("NO-VERDICT");
    for (const status of [0, 1, 3, null])
      expect(() => classifyMirrorObservation("adapter", historical, status)).toThrow();
    for (const patch of [
      { schema: "unknown" },
      { mainSha: null },
      { requests: null },
      { reasonCode: "EXECUTION_OR_UNCLASSIFIED" },
      { verdict: "PASS" },
    ])
      expect(() => classifyMirrorObservation("adapter", { ...historical, ...patch }, 2)).toThrow();
    for (const candidate of [lcov(), lcov(1)]) {
      const result = evaluateMirrorArtifacts(input(candidate));
      const report = {
        schema: "main-mirror/2",
        mainSha: revision,
        analysisId: baseline.analysisId,
        target: authoritativeUnits(baseline.metrics),
        verdict: result.pass ? "PASS" : "FAIL",
        result,
      };
      expect(classifyMirrorObservation("mirror", report, result.pass ? 0 : 1)).toBe(report.verdict);
      expect(() => classifyMirrorObservation("mirror", report, result.pass ? 1 : 0)).toThrow();
      expect(() =>
        classifyMirrorObservation("mirror", { ...report, result: { ...result, covered: 99 } }, 0),
      ).toThrow();
    }
    expect(() => classifyMirrorObservation("mirror", null, 0)).toThrow();
  });
  it("completes the immutable hash from Git for census files the coverage run never loaded", () => {
    // Medido no LCOV original de main (run 37817760211): 179 SF, dos quais só 111
    // são arquivos do censo — 33 dos 144 nunca foram importados por teste e portanto
    // não têm hash selado na provenance. A identidade continua vinda dos bytes Git.
    const withoutCensusHash = {
      ...origin(),
      sourceHashes: { "src/lib/other.ts": "c".repeat(64) },
    };
    const snapshot = mapMainUnits(baseline, withoutCensusHash, lcov(), metadata(), () => ({
      hash: source,
    }));
    expect(snapshot.sourceHashes).toEqual({ [file]: source });
    expect(snapshot.discoveredFiles).toEqual([file]);
    // Hash selado que discorda dos bytes imutáveis continua recusado.
    let refusal: unknown;
    try {
      mapMainUnits(
        baseline,
        { ...withoutCensusHash, sourceHashes: { [file]: "d".repeat(64) } },
        lcov(),
        metadata(),
        () => ({ hash: source }),
      );
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toMatchObject({
      diagnostic: { phase: "mapping", code: "MAPPING_FILE_CENSUS_UNAVAILABLE" },
    });
  });
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
  it("treats a Sonar-executable uncovered line without original DA as uncovered and refuses a covered one", () => {
    // Caso medido no lcov real (auth-policy.ts 116/117/192): o v8 emite BRDA sem DA para
    // linhas que o Sonar conta como executáveis não cobertas. A unidade mapeia como não
    // coberta; a mesma ausência sob linha declarada COBERTA segue reprovando.
    const orphanMetrics = {
      new_lines_to_cover: 5,
      new_uncovered_lines: 2,
      new_conditions_to_cover: 1,
      new_uncovered_conditions: 1,
      new_coverage: 50,
    };
    const orphanBaseline = { ...baseline, metrics: orphanMetrics };
    const orphanLcov = `TN:\nSF:${file}\nDA:1,1\nDA:2,1\nDA:3,1\nDA:4,0\nDA:6,1\nBRDA:5,0,0,0\nend_of_record\n`;
    const orphanOrigin = scannerProvenance(
      revision,
      orphanLcov,
      gate(),
      "Sensor JavaScript/TypeScript Coverage",
      instrumentation,
      () => source,
      orphanBaseline,
    );
    const rows = (lineSevenHits: number) =>
      coverageMetadata({
        sources: [
          ...[1, 2, 3, 4].map((line) => ({
            line,
            isNew: true,
            lineHits: line < 4 ? 1 : line === 4 ? 0 : lineSevenHits,
          })),
          { line: 5, isNew: true, conditions: 1, coveredConditions: 0 },
          { line: 6, isNew: false, lineHits: 1 },
          { line: 7, isNew: true, lineHits: lineSevenHits },
        ],
      }).rows;
    const snapshot = mapMainUnits(
      orphanBaseline,
      orphanOrigin,
      orphanLcov,
      [{ path: file, key: `project:${file}`, metrics: orphanMetrics, rows: rows(0) }],
      () => ({ hash: source }),
    );
    expect(snapshot.units.filter((unit) => unit.line === 7)).toEqual([
      { file, line: 7, covered: false },
    ]);
    const identity = { ...snapshot, now };
    expect(mirror(snapshot, orphanLcov, orphanLcov, identity)).toMatchObject({
      pass: false,
      covered: 3,
      paid: [],
      lost: [],
      gap: 2,
    });
    const candidateWithMeasuredHit = orphanLcov.replace("end_of_record", "DA:7,1\nend_of_record");
    expect(mirror(snapshot, orphanLcov, candidateWithMeasuredHit, identity)).toMatchObject({
      pass: false,
      covered: 4,
      paid: [`${file}:7:line`],
      lost: [],
      gap: 1,
    });
    const coveredMetrics = {
      ...orphanMetrics,
      new_uncovered_lines: 1,
      new_coverage: 66.66666666666667,
    };
    expect(() =>
      mapMainUnits(
        { ...orphanBaseline, metrics: coveredMetrics },
        scannerProvenance(
          revision,
          orphanLcov,
          gate(),
          "Sensor JavaScript/TypeScript Coverage",
          instrumentation,
          () => source,
          { ...orphanBaseline, metrics: coveredMetrics },
        ),
        orphanLcov,
        [{ path: file, key: `project:${file}`, metrics: coveredMetrics, rows: rows(1) }],
        () => ({ hash: source }),
      ),
    ).toThrow("original line coverage disagrees with provider");
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
  it.each([false, true])(
    "accounts for CSS without LCOV credit in the complete census (paginated=%s)",
    async (paginated) => {
      const css = "src/styles.css",
        cssHash = "d".repeat(64);
      const components = [
        { key: `project:${css}`, path: css, measures: [] },
        {
          key: `project:${file}`,
          path: file,
          measures: Object.entries(baseline.metrics)
            .filter(([metric]) => metric !== "new_coverage")
            .map(([metric, value]) => ({ metric, period: { index: 1, value: String(value) } })),
        },
      ];
      const calls: string[] = [],
        checkedSources: string[] = [];
      const get = (async (_origin: string, endpoint: string) => {
        calls.push(endpoint);
        if (endpoint.startsWith("measures/")) {
          const page = Number(new URLSearchParams(endpoint.split("?")[1]).get("p"));
          return {
            paging: { total: components.length },
            components: paginated ? components.slice(page - 1, page) : components,
          };
        }
        expect(new URLSearchParams(endpoint.split("?")[1]).get("key")).toBe(`project:${file}`);
        return {
          sources: metadata()[0].rows.map((row) =>
            Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)),
          ),
        };
      }) as ReturnType<typeof apiReader>;
      const census = {
        expectedFiles: null,
        discoveredFiles: [],
        coverageFiles: [],
        excludedFiles: [],
      };
      const files = await collectMetadata(
        get,
        "project",
        (path) => {
          checkedSources.push(path);
          return { hash: path === css ? cssHash : source, lines: path === css ? 1 : 6 };
        },
        census,
      );
      expect(files.map((entry) => entry.path)).toEqual([file]);
      expect(census).toEqual({
        expectedFiles: 2,
        discoveredFiles: [css, file],
        coverageFiles: [file],
        excludedFiles: [{ path: css, reason: "CSS_OUTSIDE_JS_TS_COVERAGE", sourceSha256: cssHash }],
      });
      expect([...checkedSources].sort()).toEqual([css, file].sort());
      expect(calls.filter((call) => call.startsWith("measures/"))).toHaveLength(paginated ? 2 : 1);
      expect(calls.filter((call) => call.startsWith("sources/"))).toHaveLength(1);
      const snapshot = mapMainUnits(baseline, origin(), lcov(), files, () => ({ hash: source }));
      expect(snapshot.units).toHaveLength(5);
      expect(snapshot.covered).toBe(3);
      expect(snapshot.discoveredFiles).toEqual([file]);
    },
  );
  it.each([false, true])(
    "accepts the real splat route name as JS/TS coverage and keeps it eligible (paginated=%s)",
    async (paginated) => {
      // Run 37981439098 recusou exatamente este caminho: `$` não estava no
      // charset do censo, e a rota splat do router é arquivo JS/TS legitimio.
      const css = "src/styles.css",
        cssHash = "d".repeat(64),
        splat = "src/routes/api/auth/$.ts",
        splatLcov = lcov().replaceAll(file, splat),
        splatRows = metadata().map((entry) => ({
          ...entry,
          path: splat,
          key: `project:${splat}`,
        })),
        components = [
          { key: `project:${css}`, path: css, measures: [] },
          {
            key: `project:${splat}`,
            path: splat,
            measures: Object.entries(baseline.metrics)
              .filter(([metric]) => metric !== "new_coverage")
              .map(([metric, value]) => ({ metric, period: { index: 1, value: String(value) } })),
          },
        ],
        census = { expectedFiles: null, discoveredFiles: [], coverageFiles: [], excludedFiles: [] },
        checked: string[] = [];
      const get = (async (_origin: string, endpoint: string) => {
        if (endpoint.startsWith("measures/")) {
          const page = Number(new URLSearchParams(endpoint.split("?")[1]).get("p"));
          return {
            paging: { total: components.length },
            components: paginated ? components.slice(page - 1, page) : components,
          };
        }
        expect(new URLSearchParams(endpoint.split("?")[1]).get("key")).toBe(`project:${splat}`);
        return {
          sources: splatRows[0].rows.map((row) =>
            Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)),
          ),
        };
      }) as ReturnType<typeof apiReader>;
      const files = await collectMetadata(
        get,
        "project",
        (path) => {
          checked.push(path);
          return { hash: path === css ? cssHash : source, lines: path === css ? 1 : 6 };
        },
        census,
      );
      expect(files.map((entry) => entry.path)).toEqual([splat]);
      expect(census).toEqual({
        expectedFiles: 2,
        discoveredFiles: [css, splat],
        coverageFiles: [splat],
        excludedFiles: [{ path: css, reason: "CSS_OUTSIDE_JS_TS_COVERAGE", sourceSha256: cssHash }],
      });
      expect([...checked].sort()).toEqual([css, splat].sort());
      const snapshot = mapMainUnits(baseline, origin(splatLcov), splatLcov, files, () => ({
        hash: source,
      }));
      expect(snapshot.units).toHaveLength(5);
      expect(snapshot.units.every((unit) => unit.file === splat)).toBe(true);
      expect(snapshot.covered).toBe(3);
      // O espelho de unidades precisa aceitar o mesmo caminho sem recusar.
      expect(
        mirror(snapshot, splatLcov, splatLcov, {
          mainSha: revision,
          analysisId: baseline.analysisId,
          instrumentation,
          sourceHashes: { [splat]: source },
          now,
        }),
      ).toMatchObject({ total: 5, covered: 3, pass: false });
    },
  );
  it.each([file, "src/styles.css"])(
    "refuses missing measures without silently classifying %s outside coverage",
    async (path) => {
      const get = (async () => ({
        paging: { total: 1 },
        components: [{ key: `project:${path}`, path }],
      })) as ReturnType<typeof apiReader>;
      await expect(
        collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
      ).rejects.toMatchObject({
        diagnostic: {
          phase: "components",
          code: "COMPONENT_MEASURES_UNAVAILABLE",
          componentPathSha256: sha256(path),
        },
      });
    },
  );
  it.each([
    "new_lines_to_cover",
    "new_uncovered_lines",
    "new_conditions_to_cover",
    "new_uncovered_conditions",
  ])("refuses CSS declaring %s instead of dropping measured units", async (metric) => {
    const path = "src/styles.css";
    const get = (async () => ({
      paging: { total: 1 },
      components: [
        {
          key: `project:${path}`,
          path,
          measures: [{ metric, period: { index: 1, value: "1" } }],
        },
      ],
    })) as ReturnType<typeof apiReader>;
    await expect(
      collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
    ).rejects.toMatchObject({ diagnostic: { code: "CSS_COVERAGE_UNSUPPORTED" } });
  });
  it.each([file, "src/styles.css"])(
    "refuses unreadable or duplicated coverage measures for %s",
    async (path) => {
      const metric = "new_lines_to_cover";
      for (const measures of [
        ...[null, undefined, -1, "-1", "1.5", "NaN", "9007199254740992"].map((value) => [
          { metric, value },
        ]),
        [
          { metric, value: "0" },
          { metric, value: "0" },
        ],
      ]) {
        const get = (async () => ({
          paging: { total: 1 },
          components: [{ key: `project:${path}`, path, measures }],
        })) as ReturnType<typeof apiReader>;
        await expect(
          collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
        ).rejects.toMatchObject({ diagnostic: { code: "COMPONENT_METRIC_INVALID" } });
      }
    },
  );
  it.each(["src/template.html", "src/../styles.css", "src/test/styles.css"])(
    "refuses an unregistered component even with empty measures: %s",
    async (path) => {
      const get = (async () => ({
        paging: { total: 1 },
        components: [{ key: `project:${path}`, path, measures: [] }],
      })) as ReturnType<typeof apiReader>;
      await expect(
        collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
      ).rejects.toMatchObject({ diagnostic: { code: "COMPONENT_PATH_UNSUPPORTED" } });
    },
  );
  it("rejects CSS-only discovery and duplicate CSS identities across pages", async () => {
    const css = { key: "project:src/styles.css", path: "src/styles.css", measures: [] };
    const cssOnly = (async () => ({
      paging: { total: 1 },
      components: [css],
    })) as ReturnType<typeof apiReader>;
    await expect(
      collectMetadata(cssOnly, "project", () => ({ hash: source, lines: 1 })),
    ).rejects.toMatchObject({ diagnostic: { code: "COVERAGE_CENSUS_EMPTY" } });
    for (const duplicate of [css, { ...css, key: "another-key" }]) {
      let page = 0;
      const get = (async () => ({
        paging: { total: 2 },
        components: [++page === 1 ? css : duplicate],
      })) as ReturnType<typeof apiReader>;
      await expect(
        collectMetadata(get, "project", () => ({ hash: source, lines: 1 })),
      ).rejects.toMatchObject({ diagnostic: { code: "COMPONENT_IDENTITY_INVALID" } });
    }
  });
  it("emits only fixed diagnostics and path digests, never raw errors or source", async () => {
    const unsafe = "fixture-sensitive-text\n::error::not-a-credential";
    const get = (async (_origin: string, endpoint: string) => {
      if (endpoint.startsWith("measures/"))
        return {
          paging: { total: 1 },
          components: [{ key: "k", path: file, measures: [] }],
        };
      throw new Error(unsafe);
    }) as ReturnType<typeof apiReader>;
    let diagnostic;
    try {
      await collectMetadata(get, "project", () => ({ hash: source, lines: 1 }));
    } catch (error) {
      diagnostic = adapterDiagnostic(error, "components");
    }
    expect(diagnostic).toEqual({
      phase: "sources",
      code: "SOURCE_REQUEST_FAILED",
      componentPathSha256: sha256(file),
    });
    expect(adapterDiagnostic(new Error(unsafe), "origin")).toEqual({
      phase: "origin",
      code: "EXECUTION_OR_UNCLASSIFIED",
    });
    expect(JSON.stringify(diagnostic)).not.toContain(unsafe);
    expect(JSON.stringify(diagnostic)).not.toContain(file);
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
  it.each([
    "direct-contract",
    "historical-absence",
    "corrupt-candidate",
    "corrupt-main-sidecar",
    "missing-main-lcov",
    "mixed-census",
    "coverage-census-failure",
  ] as const)("runs the real bare-Node CLI in its own Git fixture: %s", (scenario) => {
    const directory = mkdtempSync(resolve(tmpdir(), "mirror-cli-fixture-"));
    try {
      mkdirSync(resolve(directory, "src/lib"), { recursive: true });
      writeFileSync(resolve(directory, file), "// synthetic CLI fixture only\n".repeat(6));
      // Nunca importado por teste nenhum: não tem registro no LCOV e nenhum hash
      // selado na provenance, exatamente como 33 dos 144 arquivos do censo de main.
      writeFileSync(resolve(directory, "src/lib/uncovered.ts"), "// never imported\n");
      writeFileSync(resolve(directory, "src/styles.css"), ":root { color: black; }\n");
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
        [
          "add",
          "src/lib/example.ts",
          "src/lib/uncovered.ts",
          "src/styles.css",
          "vitest.config.ts",
          "package.json",
          "package-lock.json",
        ],
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
      save("c24-main-baseline.json", { schema: "main-baseline/2", ...b });
      const command = resolve("scripts/sonar/gate-mirror.ts");
      if (scenario === "direct-contract") {
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
        return;
      }
      save("candidate.lcov", lcov());
      save("candidate-origin.json", p(lcov(), "develop", "60"));

      // Exercise the real producer and advisory entrypoints with no external transport.
      const mixedCensus = scenario === "mixed-census" || scenario === "coverage-census-failure";
      if (!mixedCensus) rmSync(env.SONAR_MAIN_LCOV_PROVENANCE);
      const advisoryEnv = {
        ...env,
        SONAR_TOKEN: "fixture-not-a-credential",
        GITHUB_TOKEN: "fixture-not-a-credential",
        SONAR_MAIN_UNIT_ADAPTER_REPORT: resolve(directory, "c28-main-unit-adapter.json"),
        SONAR_CANDIDATE_GATE_REPORT: save("gate.json", {
          schema: "c25-ce-gate-readout/1",
          status: mixedCensus ? "OK" : "ERROR",
          ...g("develop", "60"),
        }),
        GITHUB_STEP_SUMMARY: resolve(directory, "summary.md"),
        GITHUB_OUTPUT: resolve(directory, "outputs.txt"),
      };
      const advisoryCommand = resolve("scripts/sonar/mirror-observation.ts");
      const runObservation = (kind: "adapter" | "mirror") =>
        spawnSync(process.execPath, [advisoryCommand, kind], {
          cwd: directory,
          env: advisoryEnv,
          encoding: "utf8",
        });
      if (mixedCensus) {
        const css = "src/styles.css",
          uncovered = "src/lib/uncovered.ts";
        // O denominador autoritativo passa a incluir as duas linhas novas não
        // cobertas do arquivo que nenhum teste carrega (4+2 linhas, 1 condição).
        const bMixed = {
          ...b,
          metrics: {
            new_lines_to_cover: 5,
            new_uncovered_lines: 2,
            new_conditions_to_cover: 1,
            new_uncovered_conditions: 1,
            new_coverage: 50,
          },
        };
        save("c24-main-baseline.json", { schema: "main-baseline/2", ...bMixed });
        // Hash real por arquivo: a provenance sela o SHA256 dos bytes de cada SF do
        // LCOV, e com dois SF um hash constante mentiria sobre o segundo.
        const sealedHash = (path: string) => sha256(readFileSync(resolve(directory, path)));
        save(
          "main-origin.json",
          scannerProvenance(
            checkoutSha,
            lcov(),
            g("main", null),
            "Sensor JavaScript/TypeScript Coverage",
            instr,
            sealedHash,
            bMixed,
          ),
        );
        const payloads = {
          ref: { commit: { sha: checkoutSha } },
          analyses: { analyses: [{ key: b.analysisId, revision: checkoutSha }] },
          tree: {
            paging: { total: 3 },
            components: [
              {
                key: `project:${css}`,
                path: css,
                measures:
                  scenario === "coverage-census-failure"
                    ? [{ metric: "new_lines_to_cover", value: "1" }]
                    : [],
              },
              {
                key: `project:${file}`,
                path: file,
                // Métricas POR ARQUIVO (4 linhas, 1 condição); o agregado do
                /// baseline é a soma dos dois arquivos.
                measures: [
                  { metric: "new_lines_to_cover", period: { index: 1, value: "4" } },
                  { metric: "new_uncovered_lines", period: { index: 1, value: "1" } },
                  { metric: "new_conditions_to_cover", period: { index: 1, value: "1" } },
                  { metric: "new_uncovered_conditions", period: { index: 1, value: "1" } },
                ],
              },
              {
                key: `project:${uncovered}`,
                path: uncovered,
                measures: [
                  { metric: "new_lines_to_cover", period: { index: 1, value: "1" } },
                  { metric: "new_uncovered_lines", period: { index: 1, value: "1" } },
                  { metric: "new_conditions_to_cover", period: { index: 1, value: "0" } },
                  { metric: "new_uncovered_conditions", period: { index: 1, value: "0" } },
                ],
              },
            ],
          },
          lines: {
            [`project:${file}`]: {
              sources: metadata()[0].rows.map((row) =>
                Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)),
              ),
            },
            [`project:${uncovered}`]: { sources: [{ line: 1, isNew: true, lineHits: 0 }] },
          },
        };
        const offlineModule = save(
          "offline-api.mjs",
          `const payloads = ${JSON.stringify(payloads)};
globalThis.fetch = async (url) => {
  const target = new URL(String(url));
  let payload;
  if (target.origin === "https://api.github.com" && target.pathname.endsWith("/branches/main")) payload = payloads.ref;
  else if (target.origin === "https://sonarcloud.io") {
    if (target.pathname === "/api/project_analyses/search") payload = payloads.analyses;
    else if (target.pathname === "/api/measures/component_tree") payload = payloads.tree;
    else if (target.pathname === "/api/sources/lines")
      payload = payloads.lines[target.searchParams.get("key")];
  }
  if (!payload) throw new Error("unexpected isolated API request; external transport forbidden");
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
};
`,
        );
        const offlineEnv = {
          ...advisoryEnv,
          NODE_OPTIONS: `--import=${offlineModule}`,
          SONAR_MAIN_UNIT_SNAPSHOT: resolve(directory, "c28-main-unit-snapshot.json"),
          SONAR_MAIN_UNIT_SNAPSHOT_SHA256: "",
        };
        const runOffline = (kind: "adapter" | "mirror") =>
          spawnSync(process.execPath, [advisoryCommand, kind], {
            cwd: directory,
            env: offlineEnv,
            encoding: "utf8",
          });
        const readReport = (name: string) =>
          JSON.parse(readFileSync(resolve(directory, name), "utf8"));
        const adapter = runOffline("adapter"),
          adapterReport = readReport("c28-main-unit-adapter.json");
        if (scenario === "coverage-census-failure") {
          expect(adapter.status, adapter.stderr).toBe(1);
          expect(adapterReport).toMatchObject({
            verdict: "NO-VERDICT",
            reasonCode: "EXECUTION_OR_UNCLASSIFIED",
            diagnostic: {
              phase: "components",
              code: "CSS_COVERAGE_UNSUPPORTED",
              componentPathSha256: sha256(css),
            },
          });
          expect(adapter.stderr).toContain("CSS_COVERAGE_UNSUPPORTED");
          const mirrored = runOffline("mirror");
          expect(mirrored.status, mirrored.stderr).toBe(1);
          for (const name of [
            "c29-main-unit-adapter-observation.json",
            "c29-main-mirror-observation.json",
          ])
            expect(readReport(name)).toMatchObject({
              rawExitCode: 2,
              rawStatus: "NO-VERDICT",
              observation: null,
              outcome: "FAILURE",
              approvesMain: false,
            });
          expect(readReport("c26-main-mirror.json").missingNames).toContain(
            "SONAR_MAIN_UNIT_SNAPSHOT_SHA256",
          );
          return;
        }
        expect(adapter.status, adapter.stderr).toBe(0);
        expect(adapterReport).toMatchObject({
          verdict: "MAPPED",
          total: 6,
          componentCensus: {
            expectedFiles: 3,
            discoveredFiles: [css, file, uncovered],
            coverageFiles: [file, uncovered],
            excludedFiles: [
              {
                path: css,
                reason: "CSS_OUTSIDE_JS_TS_COVERAGE",
                sourceSha256: sha256(readFileSync(resolve(directory, css))),
              },
            ],
          },
        });
        expect(readFileSync(advisoryEnv.GITHUB_OUTPUT, "utf8")).toBe(
          `snapshot_sha256=${adapterReport.snapshotSha256}\n`,
        );
        offlineEnv.SONAR_MAIN_UNIT_SNAPSHOT_SHA256 = adapterReport.snapshotSha256;
        // O candidato cobre todas as unidades, inclusive a do arquivo que o LCOV
        // de main nunca registrou — pagamento sem remapeamento de identidade.
        const candidatePaying = `${lcov(1)}SF:${uncovered}\nDA:1,1\nend_of_record\n`;
        save("candidate.lcov", candidatePaying);
        save(
          "candidate-origin.json",
          scannerProvenance(
            checkoutSha,
            candidatePaying,
            g("develop", "60"),
            "Sensor JavaScript/TypeScript Coverage",
            instr,
            sealedHash,
          ),
        );
        const mirrored = runOffline("mirror");
        expect(mirrored.status, mirrored.stderr).toBe(0);
        expect(readReport("c29-main-unit-adapter-observation.json")).toMatchObject({
          rawExitCode: 0,
          rawStatus: "MAPPED",
          observation: "MAPPED",
          outcome: "INFORMATIONAL",
          approvesMain: false,
        });
        expect(readReport("c29-main-mirror-observation.json")).toMatchObject({
          rawExitCode: 0,
          rawStatus: "PASS",
          observation: "PASS",
          outcome: "INFORMATIONAL",
          approvesMain: false,
        });
        return;
      }
      if (scenario === "corrupt-main-sidecar") {
        save("main-origin.json", "{broken");
        const observed = runObservation("adapter");
        expect(observed.status, observed.stderr).toBe(1);
        expect(
          JSON.parse(readFileSync(resolve(directory, "c28-main-unit-adapter.json"), "utf8")),
        ).toMatchObject({
          verdict: "NO-VERDICT",
          reasonCode: "EXECUTION_OR_UNCLASSIFIED",
        });
        return;
      }
      if (scenario === "missing-main-lcov") {
        rmSync(env.SONAR_MAIN_LCOV);
        const observed = runObservation("adapter");
        expect(observed.status, observed.stderr).toBe(1);
        expect(
          JSON.parse(
            readFileSync(resolve(directory, "c29-main-unit-adapter-observation.json"), "utf8"),
          ),
        ).toMatchObject({
          rawExitCode: 2,
          rawStatus: "NO-VERDICT",
          observation: null,
          outcome: "FAILURE",
        });
        return;
      }
      const adapter = runObservation("adapter");
      expect(adapter.status, adapter.stderr).toBe(0);
      if (scenario === "corrupt-candidate") save("candidate-origin.json", {});
      const observed = runObservation("mirror");
      expect(observed.status, observed.stderr).toBe(scenario === "corrupt-candidate" ? 1 : 0);
      expect(
        JSON.parse(readFileSync(resolve(directory, "c29-main-mirror-observation.json"), "utf8")),
      ).toMatchObject({
        rawExitCode: 2,
        rawStatus: "NO-VERDICT",
        observation: scenario === "corrupt-candidate" ? null : "NO-VERDICT",
        outcome: scenario === "corrupt-candidate" ? "FAILURE" : "INFORMATIONAL",
        approvesMain: false,
      });
      if (scenario === "historical-absence") {
        expect(
          JSON.parse(
            readFileSync(resolve(directory, "c29-main-unit-adapter-observation.json"), "utf8"),
          ),
        ).toMatchObject({
          rawExitCode: 2,
          rawStatus: "NO-VERDICT",
          observation: "NO-VERDICT",
          outcome: "INFORMATIONAL",
          approvesMain: false,
        });
        expect(readFileSync(advisoryEnv.GITHUB_STEP_SUMMARY, "utf8")).toContain("NO-VERDICT");
        expect(
          JSON.parse(readFileSync(resolve(directory, "c26-main-mirror.json"), "utf8")),
        ).toMatchObject({
          verdict: "NO-VERDICT",
          reasonCode: "ORIGINAL_PROVENANCE_UNAVAILABLE",
          target: { covered: 3 },
        });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
