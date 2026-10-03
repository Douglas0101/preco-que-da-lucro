import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyRuntime, initialObservation, observe } from "../../scripts/lib/runtime-health";
import { probeRuntime, validateBase, type RuntimeFetch } from "../../scripts/ci/runtime-monitor";

const live = '{"status":"ok"}';
const ready = '{"status":"ready","dependencies":{"postgres":"ok"}}';
const contentType = "application/json; charset=utf-8";
describe("runtime health contract instead of status-only or HTML regex", () => {
  it("accepts the actual live/ready schema and anonymous JSON null independently", () => {
    expect(classifyRuntime("live", 200, contentType, live).verdict).toBe("PASS");
    expect(classifyRuntime("ready", 200, contentType, ready).verdict).toBe("PASS");
    expect(classifyRuntime("session", 200, contentType, "null").verdict).toBe("PASS");
    expect(classifyRuntime("session", 200, contentType, "null").reason).toContain(
      "login/tenant/revision not proved",
    );
  });
  it("rejects HTML200 even containing the former status/postgres regex targets", () => {
    const html = `<html><script>${ready}</script>${live}</html>`;
    for (const kind of ["live", "ready", "session"] as const)
      expect(classifyRuntime(kind, 200, "text/html", html).verdict).toBe("FAIL");
    expect(classifyRuntime("ready", 200, contentType, html).verdict).toBe("FAIL");
  });
  it("missing, null and wrong dependency fields never become readiness", () => {
    for (const body of [
      "null",
      "{}",
      '{"status":"ready"}',
      '{"status":"ready","dependencies":null}',
      '{"status":"ready","postgres":"ok"}',
      '{"status":"ok","dependencies":{"postgres":"ok"}}',
      '{"status":"ready","dependencies":{"postgres":"unavailable"}}',
    ])
      expect(classifyRuntime("ready", 200, contentType, body).verdict).toBe("FAIL");
  });
  it("HTTP503 and redirects are not converted to success by a valid-looking JSON body", () => {
    for (const http of [302, 401, 500, 503])
      expect(classifyRuntime("ready", http, contentType, ready).verdict).toBe("FAIL");
  });
  it("an anonymous response with session data fails without persisting user/token values", () => {
    const body = '{"session":{"token":"PRIVATE-SENTINEL"},"user":{"email":"private@example.test"}}';
    const result = classifyRuntime("session", 200, contentType, body);
    expect(result.verdict).toBe("FAIL");
    expect(result.bodySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain("PRIVATE-SENTINEL");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(classifyRuntime("session", 200, "text/html", "null").verdict).toBe("FAIL");
  });
  it("empty, malformed and oversized JSON fail closed", () => {
    for (const body of ["", "{", " ".repeat(65537) + ready])
      expect(classifyRuntime("ready", 200, contentType, body).verdict).toBe("FAIL");
  });
});
describe("bounded anonymous GET observations and three-consecutive-failure incident", () => {
  it("opens once at three consecutive failures; one success does not erase the incident", () => {
    let state = initialObservation();
    state = observe(state, false, "2026-10-03T00:00:00Z");
    expect(state.incidentOpen).toBe(false);
    state = observe(state, false, "2026-10-03T00:01:00Z");
    expect(state.incidentOpen).toBe(false);
    state = observe(state, false, "2026-10-03T00:02:00Z");
    expect(state.incidentOpen).toBe(true);
    expect(state.incidentsOpened).toBe(1);
    state = observe(state, false, "2026-10-03T00:03:00Z");
    expect(state.incidentsOpened).toBe(1);
    state = observe(state, true, "2026-10-03T00:04:00Z");
    expect(state.consecutiveFailures).toBe(0);
    expect(state.incidentOpen).toBe(true);
  });
  it("nonconsecutive failures do not open an incident; invalid time/state is rejected", () => {
    let state = initialObservation();
    for (const [i, pass] of [false, true, false, true, false].entries())
      state = observe(state, pass, `2026-10-03T00:0${i}:00Z`);
    expect(state.incidentOpen).toBe(false);
    expect(state.consecutiveFailures).toBe(1);
    expect(() => observe(state, true, "2026-10-03T00:00:00Z")).toThrow();
    expect(() => observe(initialObservation(), true, "invalid")).toThrow();
    expect(() =>
      observe({ ...initialObservation(), samples: 3 }, true, "2026-10-03T00:00:00Z"),
    ).toThrow();
  });
  it("rejects URL credentials, query/fragment and remote HTTP before transport", () => {
    for (const url of [
      "https://user:pass@example.test",
      "https://example.test?token=secret",
      "https://example.test#secret",
      "http://example.test",
      "https://example.test/private",
    ])
      expect(() => validateBase(url)).toThrow();
    expect(validateBase("https://example.test/")).toBe("https://example.test");
    expect(validateBase("http://127.0.0.1:1234")).toBe("http://127.0.0.1:1234");
  });
  it("issues exactly three GETs without credentials, follows no redirect and keeps body private", async () => {
    const calls: RequestInit[] = [];
    const impl: RuntimeFetch = async (url, init) => {
      calls.push(init);
      return new Response(url.endsWith("/live") ? live : url.endsWith("/ready") ? ready : "null", {
        headers: { "content-type": contentType },
      });
    };
    const report = await probeRuntime("https://example.test", impl);
    expect(report.pass).toBe(true);
    expect(report.rows).toHaveLength(3);
    expect(calls).toHaveLength(3);
    for (const init of calls) {
      expect(init.method).toBe("GET");
      expect(init.credentials).toBe("omit");
      expect(init.redirect).toBe("manual");
      expect(init.body).toBeUndefined();
      expect(JSON.stringify(init.headers)).not.toMatch(/authorization|cookie/i);
    }
    expect(report.scope).toContain("release revision not proved");
  });
  it("actual localhost HTTP200 HTML produces FAIL, while valid endpoints prove only their contracts", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/api/health/ready") {
        response.writeHead(200, { "content-type": "text/html" });
        response.end(`<script>${ready}</script>`);
      } else {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(request.url === "/api/health/live" ? live : "null");
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture address missing");
      const report = await probeRuntime(`http://127.0.0.1:${address.port}`);
      expect(report.pass).toBe(false);
      expect(report.rows.find((row) => row.kind === "ready")?.verdict).toBe("FAIL");
      expect(report.rows.filter((row) => row.verdict === "PASS")).toHaveLength(2);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
  it("network errors and oversized payloads cannot leak arbitrary provider exceptions", async () => {
    const bad: RuntimeFetch = async () => {
      throw new Error("private-network-sentinel");
    };
    const report = await probeRuntime("https://example.test", bad);
    expect(report.pass).toBe(false);
    expect(JSON.stringify(report)).not.toContain("private-network-sentinel");
    const oversized: RuntimeFetch = async () =>
      new Response("x".repeat(65537), { headers: { "content-type": contentType } });
    const large = await probeRuntime("https://example.test", oversized);
    expect(large.pass).toBe(false);
    expect(large.rows.every((row) => row.reason === "body exceeds probe limit")).toBe(true);
  });
  it("the real canonical CLI rejects an early HTML sample even if a later sample would be valid", async () => {
    let liveRequests = 0;
    const server = createServer((request, response) => {
      let body = "null",
        status = 200,
        type = "application/json";
      if (request.url === "/api/health/live") {
        liveRequests++;
        body = live;
        if (liveRequests === 2) {
          body = `<script>${live}</script>`;
          type = "text/html";
        }
      } else if (request.url === "/api/health/ready") body = ready;
      else if (request.method === "POST") {
        status = request.headers.origin === "https://example.invalid" ? 403 : 400;
        body = "{}";
      }
      response.writeHead(status, { "content-type": type });
      response.end(body);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("fixture address missing");
      const child = spawn(
        process.execPath,
        [
          "scripts/m02-canonical-probe.ts",
          "--base-url",
          `http://127.0.0.1:${address.port}`,
          "--samples",
          "2",
        ],
        { timeout: 10000 },
      );
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
      });
      const [code] = await once(child, "close");
      expect(code).toBe(1);
      expect(output).toMatch(/^live\s+FAIL/m);
      expect(liveRequests).toBe(2);
      expect(readFileSync("scripts/m02-canonical-probe.ts", "utf8")).toContain(
        "podem registrar tentativas/rate limit",
      );
    } finally {
      server.close();
      await once(server, "close");
    }
  });
  it("the monitor retains the declared cadence and full-day sample count", () => {
    const monitor = readFileSync("scripts/ci/runtime-monitor.ts", "utf8");
    expect(monitor).not.toContain('method: "POST"');
    expect(monitor).toContain("60000 * sample");
    expect(monitor).toContain("1441");
  });
});
