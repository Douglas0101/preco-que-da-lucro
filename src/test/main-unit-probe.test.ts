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
      rows: [{ line: 1, isNew: null, lineHits: null, conditions: null, coveredConditions: null }],
    });
  });
  it.each([
    {},
    { sources: [] },
    { sources: [[1, "code"]] },
    { sources: [{ line: 1 }, { line: 1 }] },
  ])("rejects missing, empty and ambiguous source identities", (payload) => {
    expect(() => coverageMetadata(payload)).toThrow();
  });
  it.each([
    { line: 1, isNew: "true" },
    { line: 1, lineHits: -1 },
    { line: 1, conditions: null },
    { line: 1, conditions: 1, coveredConditions: 2 },
  ])("rejects degenerate or inconsistent unit metadata", (row) => {
    expect(() => coverageMetadata({ sources: [row] })).toThrow();
  });
});
