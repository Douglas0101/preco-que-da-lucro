import { describe, expect, it } from "vitest";
import {
  authoritativeUnits,
  mirror,
  type MainSnapshot,
  type CandidateIdentity,
} from "../../scripts/sonar/gate-mirror";
const file = "src/lib/example.ts",
  sha = "a".repeat(40),
  source = "b".repeat(64);
const now = "2026-10-02T13:00:00Z";
function fixture(): MainSnapshot {
  return {
    mainSha: sha,
    analysisId: "analysis-id",
    observedAt: now,
    instrumentation: "vitest-v8-identical",
    total: 5,
    covered: 3,
    floor: 3,
    sourceHashes: { [file]: source },
    units: [
      ...[1, 2, 3, 4].map((line) => ({ file, line, covered: line <= 3 })),
      { file, line: 5, branch: "0,0", covered: false },
    ],
  };
}
function identity(): CandidateIdentity {
  return {
    mainSha: sha,
    analysisId: "analysis-id",
    instrumentation: "vitest-v8-identical",
    sourceHashes: { [file]: source },
    now,
  };
}
const lcov = (four = 0, branch = "0", old = 0, first = 1) =>
  `TN:\nSF:${file}\nDA:1,${first}\nDA:2,1\nDA:3,1\nDA:4,${four}\nDA:99,${old}\nBRDA:5,0,0,${branch}\nend_of_record\n`;
describe("Conservative main coverage mirror by eligible unit", () => {
  it("measures lines plus conditions and the anti-empty-window floor", () => {
    expect(
      authoritativeUnits({
        new_lines_to_cover: 1904,
        new_uncovered_lines: 690,
        new_conditions_to_cover: 1091,
        new_uncovered_conditions: 411,
        new_coverage: 63.2,
      }),
    ).toMatchObject({ total: 2995, covered: 1894, gap: 502, floor: 1498 });
  });
  it.each([null, -1, 1.5])("missing/invalid condition count %s is not zero", (n) => {
    expect(() =>
      authoritativeUnits({
        new_lines_to_cover: 4,
        new_uncovered_lines: 1,
        new_conditions_to_cover: n,
        new_uncovered_conditions: 0,
        new_coverage: 75,
      }),
    ).toThrow();
  });
  it("rejects an empty window and inconsistent percentage", () => {
    expect(() =>
      authoritativeUnits({
        new_lines_to_cover: 0,
        new_uncovered_lines: 0,
        new_conditions_to_cover: 0,
        new_uncovered_conditions: 0,
        new_coverage: 100,
      }),
    ).toThrow();
    expect(() =>
      authoritativeUnits({
        new_lines_to_cover: 4,
        new_uncovered_lines: 1,
        new_conditions_to_cover: 1,
        new_uncovered_conditions: 1,
        new_coverage: 80,
      }),
    ).toThrow();
  });
  it("credits one real eligible unit and reports its identity", () => {
    expect(mirror(fixture(), lcov(), lcov(1), identity())).toMatchObject({
      pass: true,
      covered: 4,
      coverage: 80,
      paid: [`${file}:4:line`],
    });
  });
  it("does not credit old lines in the same file (C25 false-green control)", () => {
    expect(mirror(fixture(), lcov(), lcov(0, "0", 100), identity())).toMatchObject({
      pass: false,
      coverage: 60,
      gap: 1,
      paid: [],
    });
  });
  it("subtracts coverage lost while crediting a gain", () => {
    expect(mirror(fixture(), lcov(), lcov(1, "0", 0, 0), identity())).toMatchObject({
      pass: false,
      coverage: 60,
      lost: [`${file}:1:line`],
    });
  });
  it("does not treat unknown branch data as uncovered/covered", () => {
    expect(() => mirror(fixture(), lcov(), lcov(1, "-"), identity())).toThrow("mapping");
  });
  it.each(["mainSha", "analysisId", "instrumentation"] as const)("rejects changed %s", (key) => {
    const c = identity();
    c[key] = "changed";
    expect(() => mirror(fixture(), lcov(), lcov(1), c)).toThrow();
  });
  it("rejects changed source, missing units, duplicate units and tests", () => {
    const c = identity();
    c.sourceHashes[file] = "c".repeat(64);
    expect(() => mirror(fixture(), lcov(), lcov(1), c)).toThrow();
    const a = fixture();
    a.units.pop();
    expect(() => mirror(a, lcov(), lcov(1), identity())).toThrow();
    const b = fixture();
    b.units[4] = b.units[3];
    expect(() => mirror(b, lcov(), lcov(1), identity())).toThrow();
    const d = fixture();
    d.units[0].file = "src/test/example.test.ts";
    expect(() => mirror(d, lcov(), lcov(1), identity())).toThrow();
  });
  it("rejects stale/future baseline, denominator below floor and numerator drift", () => {
    for (const observedAt of ["2026-10-02T12:00:00Z", "2026-10-02T14:00:00Z"]) {
      const s = fixture();
      s.observedAt = observedAt;
      expect(() => mirror(s, lcov(), lcov(1), identity())).toThrow();
    }
    const s = fixture();
    s.floor = 6;
    expect(() => mirror(s, lcov(), lcov(1), identity())).toThrow();
    const n = fixture();
    n.covered = 4;
    expect(() => mirror(n, lcov(), lcov(1), identity())).toThrow();
  });
  it("rejects empty, truncated and duplicated LCOV", () => {
    for (const text of ["", lcov().replace("end_of_record", ""), lcov() + lcov()])
      expect(() => mirror(fixture(), lcov(), text, identity())).toThrow();
  });
});
