import { describe, expect, it } from "vitest";
import { apiReader, type RequestObservation } from "../../scripts/sonar/api";
import { optionalSourceCatalog, sourceMetadata } from "../../scripts/sonar/main-unit-probe";

const tokens = { sonar: "sonar-secret-sentinel", github: "github-secret-sentinel" };
const key = "project:src/file.ts";
function fixture(responses: (Response | Error)[]) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const requests: RequestObservation[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    const result = responses.shift();
    if (result instanceof Error) throw result;
    if (!result) throw new Error("unexpected request");
    return result;
  };
  return { calls, requests, get: apiReader(tokens, requests, fetchImpl) };
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe("Sonar transport and fallback orchestration", () => {
  it("does not let an incomplete or missing catalog suppress the measured endpoint", async () => {
    for (const catalog of [json({}, 404), json({}), json({ webServices: [] })]) {
      const f = fixture([catalog, json({ sources: [{ line: 1, isNew: true, lineHits: 0 }] })]);
      expect((await optionalSourceCatalog(f.get)).actions).toEqual([]);
      expect((await sourceMetadata(f.get, key)).endpoint).toBe("sources/lines");
    }
  });
  it.each([401, 403, 429])("catalog HTTP %s remains a precondition failure", async (status) => {
    const f = fixture([json({}, status)]);
    await expect(optionalSourceCatalog(f.get)).rejects.toThrow(`HTTP ${status}`);
  });
  it("tries the measured lines endpoint first and only persists selected metadata", async () => {
    const f = fixture([
      json({ sources: [{ line: 1, isNew: true, lineHits: 1, code: "PRIVATE_SENTINEL" }] }),
    ]);
    const result = await sourceMetadata(f.get, key);
    expect(f.calls[0].url.pathname).toBe("/api/sources/lines");
    expect(result.endpoint).toBe("sources/lines");
    expect(result.metadata.hasCoverageCounts).toBe(true);
    expect(JSON.stringify({ result, requests: f.requests })).not.toMatch(
      /PRIVATE_SENTINEL|secret-sentinel/,
    );
    expect(f.calls[0].init?.redirect).toBe("error");
  });
  it.each([400, 404, 405])(
    "fallback for unsupported endpoint %s removes the unsupported branch parameter",
    async (status) => {
      const f = fixture([json({}, status), json({ sources: [[1, "PRIVATE_SOURCE"]] })]);
      const result = await sourceMetadata(f.get, key);
      expect(f.calls[1].url.pathname).toBe("/api/sources/show");
      expect(f.calls[1].url.searchParams.has("branch")).toBe(false);
      expect(result.metadata.hasCoverageCounts).toBe(false);
      expect(f.requests.map((r) => r.status)).toEqual([status, 200]);
    },
  );
  it.each([401, 403, 429, 500])("does not hide HTTP %s through fallback", async (status) => {
    const f = fixture([json({ token: "PRIVATE_SENTINEL" }, status)]);
    await expect(sourceMetadata(f.get, key)).rejects.toThrow(`HTTP ${status}`);
    expect(f.calls).toHaveLength(1);
    expect(JSON.stringify(f.requests)).not.toContain("PRIVATE_SENTINEL");
  });
  it("records a transport failure without its remote error text and never retries", async () => {
    const f = fixture([new Error("PRIVATE_SENTINEL credentials in transport error")]);
    await expect(sourceMetadata(f.get, key)).rejects.toThrow("transport unavailable");
    expect(f.calls).toHaveLength(1);
    expect(f.requests[0]).toMatchObject({ status: null, failure: "transport" });
    expect(JSON.stringify(f.requests)).not.toContain("SENTINEL");
  });
  it("HTML, excessive body and malformed JSON cannot become capability evidence", async () => {
    for (const body of ["<html>PRIVATE_SENTINEL</html>", "x".repeat(2_000_001), "{"]) {
      const f = fixture([new Response(body)]);
      await expect(sourceMetadata(f.get, key)).rejects.toThrow();
      expect(f.calls).toHaveLength(1);
      expect(f.requests[0].failure).toBe("payload");
    }
  });
  it("rejects alternate origins before sending a credential", async () => {
    const f = fixture([]);
    await expect(f.get("sonar", "//attacker.invalid/steal")).rejects.toThrow("endpoint");
    expect(f.calls).toHaveLength(0);
  });
});
