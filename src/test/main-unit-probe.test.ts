import { describe, expect, it } from "vitest";
import { coverageMetadata, sourceActions } from "../../scripts/sonar/main-unit-probe";

describe("Authenticated Sonar unit capability probe", () => {
  it("only selects source row endpoints present in the current API catalog", () => {
    expect(
      sourceActions({
        webServices: [
          { path: "api/sources", actions: [{ key: "lines", internal: true }, { key: "raw" }] },
        ],
      }),
    ).toEqual(["lines", "raw"]);
    expect(
      sourceActions({ webServices: [{ path: "api/other", actions: [{ key: "lines" }] }] }),
    ).toEqual([]);
    expect(() => sourceActions({})).toThrow();
  });
  it("retains eligible numeric metadata and discards source, PII and arbitrary strings", () => {
    const report = coverageMetadata({
      sources: [
        {
          line: 7,
          isNew: true,
          lineHits: 0,
          conditions: 2,
          coveredConditions: 1,
          code: "SECRET_SENTINEL",
          scmAuthor: "PRIVATE_SENTINEL",
        },
      ],
    });
    expect(report).toMatchObject({
      count: 1,
      hasNewMarkers: true,
      hasCoverageCounts: true,
      rows: [{ line: 7, isNew: true, lineHits: 0, conditions: 2, coveredConditions: 1 }],
    });
    expect(JSON.stringify(report)).not.toMatch(/SENTINEL|scmAuthor|code/);
  });
  it("missing coverage and new-code fields are unknown, never zero or false", () => {
    expect(coverageMetadata({ sources: [{ line: 1, code: "ignored" }] })).toEqual({
      count: 1,
      hasNewMarkers: false,
      hasCoverageCounts: false,
      rows: [
        {
          line: 1,
          isNew: null,
          lineHits: null,
          conditions: null,
          coveredConditions: null,
          utLineHits: null,
          utConditions: null,
          utCoveredConditions: null,
        },
      ],
    });
  });
  it("parses the measured sources/lines row shape and discards source and SCM strings", () => {
    const report = coverageMetadata({
      sources: [
        {
          line: 14,
          code: '<span class="k">if</span> (a) {',
          scmRevision: "e342f83695212fa744f2ff5e0462edc6438d5655",
          scmDate: "2026-09-10T07:18:23+0000",
          utLineHits: 1,
          lineHits: 1,
          duplicated: false,
          isNew: true,
        },
        { line: 15, code: "PLAIN_SOURCE_SENTINEL", isNew: false },
      ],
    });
    expect(report).toMatchObject({
      count: 2,
      hasNewMarkers: true,
      hasCoverageCounts: true,
      rows: [
        {
          line: 14,
          isNew: true,
          lineHits: 1,
          conditions: null,
          coveredConditions: null,
          utLineHits: 1,
          utConditions: null,
          utCoveredConditions: null,
        },
        {
          line: 15,
          isNew: false,
          lineHits: null,
          conditions: null,
          coveredConditions: null,
          utLineHits: null,
          utConditions: null,
          utCoveredConditions: null,
        },
      ],
    });
    expect(JSON.stringify(report)).not.toMatch(/SENTINEL|scmRevision|scmDate|duplicated|code/);
  });
  it.each([
    {},
    { sources: [] },
    { sources: [[1, "code", "unexpected"]] },
    { sources: [{ line: 1 }, { line: 1 }] },
  ])("rejects missing, empty and ambiguous source identities", (payload) => {
    expect(() => coverageMetadata(payload)).toThrow();
  });
  it("recognizes advertised show tuples without inventing coverage or retaining source", () => {
    const data = coverageMetadata({ sources: [[17, "CODE_SECRET_SENTINEL"]] });
    expect(data).toEqual({
      count: 1,
      hasNewMarkers: false,
      hasCoverageCounts: false,
      rows: [
        {
          line: 17,
          isNew: null,
          lineHits: null,
          conditions: null,
          coveredConditions: null,
          utLineHits: null,
          utConditions: null,
          utCoveredConditions: null,
        },
      ],
    });
    expect(JSON.stringify(data)).not.toContain("SENTINEL");
  });
  it.each([
    { line: 1, isNew: "true" },
    { line: 1, lineHits: -1 },
    { line: 1, utLineHits: -3 },
    { line: 1, duplicated: "false" },
    { line: 1, conditions: null },
    { line: 1, conditions: 1, coveredConditions: 2 },
    { line: 1, utConditions: 2, utCoveredConditions: 3 },
  ])("rejects degenerate or inconsistent unit metadata", (row) => {
    expect(() => coverageMetadata({ sources: [row] })).toThrow();
  });
  it("unit-test counters alone demonstrate coverage capability", () => {
    const report = coverageMetadata({
      sources: [{ line: 9, utLineHits: 0, utConditions: 1, utCoveredConditions: 0, isNew: true }],
    });
    expect(report.hasCoverageCounts).toBe(true);
    expect(report.hasNewMarkers).toBe(true);
  });
});
