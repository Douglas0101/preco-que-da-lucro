import { describe, expect, it } from "vitest";
import {
  authoritativeUnits,
  mirror,
  SourceDivergence,
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
  it("keeps an uncovered line without DA uncovered on both sides and credits only a measured hit", () => {
    const missingUncoveredLine = lcov().replace("DA:4,0\n", "");
    expect(mirror(fixture(), missingUncoveredLine, missingUncoveredLine, identity())).toMatchObject(
      {
        pass: false,
        covered: 3,
        paid: [],
        lost: [],
        gap: 1,
      },
    );
    expect(mirror(fixture(), missingUncoveredLine, lcov(1), identity())).toMatchObject({
      pass: true,
      covered: 4,
      paid: [`${file}:4:line`],
      lost: [],
    });
    expect(mirror(fixture(), lcov(), missingUncoveredLine, identity())).toMatchObject({
      pass: false,
      covered: 3,
      paid: [],
      lost: [],
    });
  });
  it("rejects covered lines without DA in the baseline or candidate", () => {
    const missingCoveredLine = lcov().replace("DA:1,1\n", "");
    expect(() => mirror(fixture(), missingCoveredLine, lcov(1), identity())).toThrow(
      `coverage mapping unavailable: ${file}:1:line`,
    );
    expect(() => mirror(fixture(), lcov(), missingCoveredLine, identity())).toThrow(
      `coverage mapping unavailable: ${file}:1:line`,
    );
  });
  it("rejects absent BRDA even when the baseline condition was uncovered", () => {
    const missingCondition = lcov(1).replace("BRDA:5,0,0,0\n", "");
    expect(() => mirror(fixture(), lcov(), missingCondition, identity())).toThrow(
      `coverage mapping unavailable: ${file}:5:0,0`,
    );
    const missingBaselineCondition = lcov().replace("BRDA:5,0,0,0\n", "");
    expect(() => mirror(fixture(), missingBaselineCondition, lcov(1), identity())).toThrow(
      `coverage mapping unavailable: ${file}:5:0,0`,
    );
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
  it("names a main/candidate source divergence with the complete measured set", () => {
    // Recusa POR DESENHO (ADR-038 §3): a projeção exige a MESMA fonte. Ela precisa ser
    // nomeada com o conjunto medido inteiro — não com a primeira unidade encontrada —
    // para que a observação informacional carregue a causa sem inventar crédito.
    const c = identity();
    c.sourceHashes[file] = "c".repeat(64);
    let caught: unknown;
    try {
      mirror(fixture(), lcov(), lcov(1), c);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      name: "SourceDivergence",
      files: [{ path: file, mainSha256: source, candidateSha256: "c".repeat(64) }],
      eligibleUnits: 5,
    });
    expect(caught).toBeInstanceOf(SourceDivergence);
  });
  it("measures every divergent eligible file, not only the first one reached", () => {
    const other = "src/lib/other.ts",
      second = "src/lib/second.ts";
    const s = fixture();
    s.total = 7;
    s.floor = 4;
    s.units = [
      ...s.units,
      { file: other, line: 1, covered: true },
      { file: second, line: 1, covered: false },
    ];
    s.sourceHashes[other] = source;
    s.sourceHashes[second] = source;
    const c = identity();
    c.sourceHashes[file] = "c".repeat(64);
    c.sourceHashes[other] = "d".repeat(64);
    c.sourceHashes[second] = "e".repeat(64);
    let caught: unknown;
    try {
      mirror(s, lcov(), lcov(1), c);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      name: "SourceDivergence",
      files: [
        { path: file, mainSha256: source, candidateSha256: "c".repeat(64) },
        { path: other, mainSha256: source, candidateSha256: "d".repeat(64) },
        { path: second, mainSha256: source, candidateSha256: "e".repeat(64) },
      ],
      eligibleUnits: 7,
    });
    expect(caught).toBeInstanceOf(SourceDivergence);
  });
  it("keeps an unsealed source hash a blocking failure, never a named divergence", () => {
    // Evidência quebrada (hash ausente/malformado) não é divergência de fonte: nomear a
    // recusa ali esconderia um defeito real de identidade.
    for (const broken of ["not-a-digest", "", undefined as unknown as string]) {
      for (const snapshotSide of [true, false]) {
        const s = fixture(),
          c = identity();
        (snapshotSide ? s.sourceHashes : c.sourceHashes)[file] = broken;
        let caught: unknown;
        try {
          mirror(s, lcov(), lcov(1), c);
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).name).not.toBe("SourceDivergence");
        expect((caught as Error).message).toBe(`source mapping unavailable: ${file}`);
      }
    }
  });
  it("does not name a divergence when the sources are identical", () => {
    expect(mirror(fixture(), lcov(), lcov(1), identity())).toMatchObject({
      pass: true,
      paid: [`${file}:4:line`],
    });
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
