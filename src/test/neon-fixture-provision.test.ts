import { describe, expect, it } from "vitest";
import {
  provision,
  provisionPlan,
  type ProvisionIo,
} from "../../scripts/ci/provision-neon-fixture";
import {
  DEVELOP_ID,
  FIXTURE_BASE_ID,
  MaskedSecrets,
  pinConnection,
  PRODUCTION_ID,
  PROJECT_ID,
  type ResourceFetch,
} from "../../scripts/ci/neon-resource";

const fixtureSecret = "synthetic-fixture";
const env = {
  GITHUB_REPOSITORY: "Douglas0101/preco-que-da-lucro",
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_BASE_REF: "develop",
  NEON_PROJECT_ID: PROJECT_ID,
  PR_NUMBER: "60",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "2",
};
const now = Date.parse("2026-10-07T02:00:00Z");
const branchId = "br-fixture-example";

function uri(pooled: boolean) {
  const host = pooled
    ? "ep-fixture-example-pooler.c-2.us-east-2.aws.neon.tech"
    : "ep-fixture-example.c-2.us-east-2.aws.neon.tech";
  const value = new URL(`postgresql://neondb_owner:${fixtureSecret}@${host}/neondb`);
  value.searchParams.set("sslmode", "require");
  return value.href;
}
function directHostBody() {
  return {
    endpoints: [
      {
        host: "ep-fixture-example.c-2.us-east-2.aws.neon.tech",
        branch_id: branchId,
        project_id: PROJECT_ID,
        type: "read_write",
        disabled: false,
      },
    ],
  };
}
function branchBody(currentState: string) {
  return { branch: { id: branchId, current_state: currentState } };
}

function ioSink() {
  const events: string[] = [];
  const files = new Map<string, string>();
  const sink: ProvisionIo = {
    stdout: (text) => events.push(`stdout:${JSON.stringify(text)}`),
    stderr: (text) => events.push(`stderr:${text}`),
    appendOutput: (text) => events.push(`output:${JSON.stringify(text)}`),
    writePrivate: (name, content) => {
      events.push(`write:${name}`);
      files.set(name, content);
    },
    writeReport: (name, content) => {
      events.push(`report:${name}`);
      files.set(name, content);
    },
  };
  return { events, files, sink };
}
function mock(
  responses: {
    status?: number;
    body?: unknown;
    rawBody?: string;
    contentType?: string;
    error?: Error;
  }[],
  decorate?: (base: ProvisionIo) => ProvisionIo,
) {
  const { events, files, sink } = ioSink();
  const io = decorate ? decorate(sink) : sink;
  const calls: { method?: string; url: string; body?: string }[] = [];
  let time = now;
  const impl: ResourceFetch = async (url, init) => {
    const value = responses[calls.length];
    calls.push({
      method: init.method,
      url,
      body: typeof init.body === "string" ? init.body : undefined,
    });
    events.push(`fetch:${init.method ?? "GET"}:${new URL(url).pathname}${new URL(url).search}`);
    if (!value) throw new Error("unexpected fetch call");
    if (value.error) throw value.error;
    const status = value.status ?? 200;
    return new Response(
      status === 204 ? null : (value.rawBody ?? JSON.stringify(value.body ?? {})),
      {
        status,
        headers: { "content-type": value.contentType ?? "application/json" },
      },
    );
  };
  const run = () =>
    provision(env, impl, io, {
      now: () => time,
      pause: async () => {
        time += 2000;
      },
    });
  return { calls, events, files, run };
}

describe("zero-row parent-data fixture provisioning plan from the empty base", () => {
  it("plans a parent-data child of the permanent empty base with a 24h TTL", () => {
    const plan = provisionPlan(env, new Date(now));
    expect(plan).toEqual({
      projectId: PROJECT_ID,
      parentId: FIXTURE_BASE_ID,
      branchName: "pr-60-123-2",
      expiresAt: "2026-10-08T02:00:00Z",
    });
    for (const GITHUB_BASE_REF of ["main", "develop"])
      expect(provisionPlan({ ...env, GITHUB_BASE_REF }, new Date(now)).parentId).toBe(
        FIXTURE_BASE_ID,
      );
  });
  it.each([
    { GITHUB_REPOSITORY: "foreign/fork" },
    { GITHUB_EVENT_NAME: "push" },
    { GITHUB_BASE_REF: "preview" },
    { NEON_PROJECT_ID: "different" },
    { PR_NUMBER: "0" },
    { GITHUB_RUN_ID: "" },
    { GITHUB_RUN_ATTEMPT: "x" },
    { PR_NUMBER: undefined },
  ])("refuses an unverifiable run context %j", (patch) => {
    expect(() => provisionPlan({ ...env, ...patch }, new Date(now))).toThrow("precondition");
  });
});

describe("URI pinning closes the effective-destination residual", () => {
  it("pins the explicit 5432 port and keeps an sslmode-only query", () => {
    const pinned = pinConnection(uri(false), false);
    expect(new URL(pinned).port).toBe("5432");
    expect(new URL(pinConnection(uri(true), true)).port).toBe("5432");
    const noPort = new URL(uri(false));
    noPort.port = "";
    expect(new URL(pinConnection(noPort.href, false)).port).toBe("5432");
  });
  it.each([
    ["a foreign port", uri(false).replace(".tech/", ".tech:9999/"), false],
    ["a destination-altering query host", `${uri(false)}&host=ep-evil.aws.neon.tech`, false],
    ["a query port override", `${uri(false)}&port=9999`, false],
    ["a non-sslmode parameter", `${uri(false)}&application_name=probe`, false],
    ["an insecure sslmode", uri(false).replace("sslmode=require", "sslmode=disable"), false],
    ["a pooler host requested as direct", uri(true), false],
    ["a direct host requested as pooled", uri(false), true],
  ])("refuses %s", (_label, candidate, pooled) => {
    expect(() => pinConnection(candidate, pooled)).toThrow();
  });
});

describe("REST provisioning with masked credentials and sanitized refusals", () => {
  it("creates the zero-row parent-data child once, hands the branch id to cleanup before compute, and writes masked private URIs", async () => {
    const { calls, events, files, run } = mock([
      { body: { branch: { id: branchId } } },
      { body: branchBody("init") },
      { body: branchBody("ready") },
      { body: directHostBody() },
      { body: { uri: uri(false) } },
      { body: { uri: uri(true) } },
    ]);
    await expect(run()).resolves.toEqual({ verdict: "OK", branchId });
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body!)).toEqual({
      branch: {
        name: "pr-60-123-2",
        parent_id: FIXTURE_BASE_ID,
        init_source: "parent-data",
        expires_at: "2026-10-08T02:00:00Z",
      },
      endpoints: [{ type: "read_write" }],
    });
    const output = events.findIndex((event) => event.startsWith("output:"));
    const firstReadiness = events.findIndex((event) => event.includes("/branches/br-fixture"));
    expect(output).toBeGreaterThan(-1);
    expect(firstReadiness).toBeGreaterThan(output);
    const outputText = JSON.parse(events[output]!.slice("output:".length)) as string;
    expect(outputText).toContain(`branch_id=${branchId}\n`);
    expect(outputText).toContain("created=true\n");
    const direct = files.get("branch_direct_url")!;
    const pooled = files.get("branch_pooled_url")!;
    expect(new URL(direct).port).toBe("5432");
    expect(new URL(pooled).hostname).toBe(
      new URL(direct).hostname.replace(/^([^.]+)/, "$1-pooler"),
    );
    const maskDirect = events.findIndex(
      (event) => event.includes("::add-mask::") && event.includes(direct),
    );
    const writeDirect = events.indexOf("write:branch_direct_url");
    const maskPooled = events.findIndex(
      (event) => event.includes("::add-mask::") && event.includes(pooled),
    );
    const writePooled = events.indexOf("write:branch_pooled_url");
    expect(maskDirect).toBeGreaterThan(-1);
    expect(maskDirect).toBeLessThan(writeDirect);
    expect(maskPooled).toBeGreaterThan(-1);
    expect(maskPooled).toBeLessThan(writePooled);
    const report = JSON.parse(files.get("neon-pr-provision.json")!);
    expect(report).toMatchObject({
      phase: "connection-verified",
      branchId,
      initSource: "parent-data",
    });
    // O payload de ::add-mask:: usa escape do protocolo Actions; os demais
    // eventos não podem conter credenciais recebidas.
    for (const captured of events.filter((event) => !event.includes("::add-mask::")))
      expect(captured).not.toContain(fixtureSecret);
    expect(files.get("neon-pr-provision.json")).not.toContain(fixtureSecret);
    expect(files.get("branch_direct_url")).toContain(fixtureSecret);
    expect(files.get("branch_pooled_url")).toContain(fixtureSecret);
  });
  it("a create refusal (HTTP 412) is observed as status plus code, with no retry and no output", async () => {
    const { calls, events, files, run } = mock([
      {
        status: 412,
        body: { code: "BRANCH_CREATION_NOT_ALLOWED", message: "raw-refusal-not-for-output" },
      },
    ]);
    await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT" });
    expect(calls).toHaveLength(1);
    expect(events.join("\n")).not.toContain("raw-refusal-not-for-output");
    const report = JSON.parse(files.get("neon-pr-provision.json")!);
    expect(report.reason).toBe("fixture provisioning HTTP 412, code=BRANCH_CREATION_NOT_ALLOWED");
    expect(report.verdict).toBe("NO-VERDICT");
    expect(report.providerStatus).toBe(412);
    expect(report.providerCode).toBe("BRANCH_CREATION_NOT_ALLOWED");
    expect(report.nextStep).toContain("does not identify the cause");
    expect(report.branchId).toBeUndefined();
    expect(events.some((event) => event.startsWith("output:"))).toBe(false);
  });
  it.each([
    { contentType: "text/html", rawBody: "<html>credential-not-for-output</html>" },
    { rawBody: "{credential-not-for-output" },
    { body: { code: "credential-not-for-output:invalid", message: "secret-message" } },
    { body: { code: "schema_only_not_allowed", message: "secret-message" } },
  ])("retains HTTP412 without leaking an untrusted refusal %j", async (response) => {
    const { calls, events, files, run } = mock([{ status: 412, ...response }]);
    await expect(run()).resolves.toEqual({ verdict: "NO-VERDICT" });
    const report = JSON.parse(files.get("neon-pr-provision.json")!);
    expect(report).toMatchObject({
      verdict: "NO-VERDICT",
      phase: "creating",
      providerStatus: 412,
      providerCode:
        "body" in response && response.body?.code === "schema_only_not_allowed"
          ? "schema_only_not_allowed"
          : "UNCLASSIFIED",
    });
    expect(calls).toHaveLength(1);
    expect(events.some((event) => event.startsWith("output:"))).toBe(false);
    expect(events.join("\n")).not.toContain("credential-not-for-output");
    expect(files.get("neon-pr-provision.json")).not.toContain("secret-message");
  });
  it("never exposes an API key echoed as an otherwise valid provider code", async () => {
    const apiKey = "SYNTHETIC_API_KEY";
    const { events, files, sink } = ioSink();
    const impl: ResourceFetch = async () =>
      new Response(JSON.stringify({ code: apiKey, message: apiKey }), {
        status: 412,
        headers: { "content-type": "application/json" },
      });
    await expect(
      provision({ ...env, NEON_API_KEY: apiKey }, impl, sink, { now: () => now }),
    ).resolves.toEqual({ verdict: "NO-VERDICT" });
    expect(JSON.parse(files.get("neon-pr-provision.json")!)).toMatchObject({
      providerStatus: 412,
      providerCode: "UNCLASSIFIED",
    });
    expect(events.filter((event) => !event.includes("::add-mask::")).join("\n")).not.toContain(
      apiKey,
    );
    expect(files.get("neon-pr-provision.json")).not.toContain(apiKey);
  });
  it.each([DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID, "unverified"])(
    "never hands cleanup a permanent or unverified provider identity %s",
    async (id) => {
      const { events, files, run } = mock([{ body: { branch: { id } } }]);
      await expect(run()).resolves.toEqual({ verdict: "NO-VERDICT" });
      expect(events.some((event) => event.startsWith("output:"))).toBe(false);
      expect(JSON.parse(files.get("neon-pr-provision.json")!).branchId).toBeUndefined();
    },
  );
  it("the branch id reaches cleanup even when readiness or the pooled URI fails afterwards", async () => {
    for (const responses of [
      [
        { body: { branch: { id: branchId } } },
        { body: branchBody("init") },
        { body: branchBody("init") },
        { body: branchBody("init") },
      ],
      [
        { body: { branch: { id: branchId } } },
        { body: branchBody("ready") },
        { status: 403, body: { code: "FORBIDDEN" } },
      ],
      [
        { body: { branch: { id: branchId } } },
        { body: branchBody("ready") },
        { body: directHostBody() },
        { body: { uri: uri(false) } },
        { status: 500, body: { code: "INTERNAL" } },
      ],
    ]) {
      const { events, files, run } = mock(responses);
      await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT", branchId });
      expect(events.some((event) => event.includes("branch_id=br-fixture-example"))).toBe(true);
      expect(JSON.parse(files.get("neon-pr-provision.json")!)).toMatchObject({
        verdict: "NO-VERDICT",
        branchId,
      });
    }
  });
  it("masks a received malformed credential URI before validation can fail", async () => {
    const { events, files, run } = mock([
      { body: { branch: { id: branchId } } },
      { body: branchBody("ready") },
      { body: directHostBody() },
      { body: { uri: `malformed-${fixtureSecret}` } },
    ]);
    await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT", branchId });
    expect(events.some((event) => event.includes(`::add-mask::malformed-${fixtureSecret}`))).toBe(
      true,
    );
    expect(events.filter((event) => !event.includes("::add-mask::")).join("\n")).not.toContain(
      fixtureSecret,
    );
    expect(files.get("neon-pr-provision.json")).not.toContain(fixtureSecret);
  });
  it("a value echoed by a failing layer is redacted before the reason is persisted", async () => {
    const { events, files, run } = mock(
      [
        { body: { branch: { id: branchId } } },
        { body: branchBody("ready") },
        { body: directHostBody() },
        { body: { uri: uri(false) } },
        { body: { uri: uri(true) } },
      ],
      (base) => ({
        ...base,
        writePrivate: (name, content) => {
          if (name === "branch_pooled_url")
            throw new Error(`disk error while handling ${fixtureSecret}`);
          base.writePrivate(name, content);
        },
      }),
    );
    await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT" });
    const report = JSON.parse(files.get("neon-pr-provision.json")!);
    expect(report.reason).toContain("[redacted]");
    expect(report.reason).not.toContain(fixtureSecret);
    expect(events.filter((event) => event.startsWith("stderr:")).join("\n")).not.toContain(
      fixtureSecret,
    );
  });
  it("redacts a previously received SQL password from structured provider codes", async () => {
    const { events, files, run } = mock([
      { body: { branch: { id: branchId } } },
      { body: branchBody("ready") },
      { body: directHostBody() },
      { body: { uri: uri(false) } },
      { status: 412, body: { code: fixtureSecret } },
    ]);
    await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT", branchId });
    expect(JSON.parse(files.get("neon-pr-provision.json")!).providerCode).toBe("[redacted]");
    expect(files.get("neon-pr-provision.json")).not.toContain(fixtureSecret);
    expect(events.filter((event) => !event.includes("::add-mask::")).join("\n")).not.toContain(
      fixtureSecret,
    );
  });
  it("refuses endpoints that do not bind exactly one read_write host of the branch", async () => {
    for (const endpoints of [
      { endpoints: [] },
      { endpoints: [{ ...directHostBody().endpoints[0], branch_id: "br-other" }] },
      { endpoints: [{ ...directHostBody().endpoints[0], type: "read_only" }] },
      { endpoints: [directHostBody().endpoints[0], directHostBody().endpoints[0]] },
      {},
    ]) {
      const { run } = mock([
        { body: { branch: { id: branchId } } },
        { body: branchBody("ready") },
        { body: endpoints },
      ]);
      await expect(run()).resolves.toMatchObject({ verdict: "NO-VERDICT" });
    }
  });
});

describe("MaskedSecrets redaction ledger", () => {
  it("masks on arrival and scrubs every known value from any later text", () => {
    const ledger = new MaskedSecrets();
    expect(ledger.mask("")).toBe("");
    expect(ledger.mask("mask-sentinel-one")).toBe("::add-mask::mask-sentinel-one\n");
    expect(ledger.mask("mask-sentinel-two")).toBe("::add-mask::mask-sentinel-two\n");
    const leaked = "failure mentions mask-sentinel-one and mask-sentinel-two";
    expect(ledger.redact(leaked)).toBe("failure mentions [redacted] and [redacted]");
    expect(ledger.redact("untouched")).toBe("untouched");
  });

  it("escapes workflow-command delimiters while retaining the original redaction identity", () => {
    const ledger = new MaskedSecrets();
    const secret = "sql%0A-password\r\n::error::untrusted-provider-value";
    const command = ledger.mask(secret);
    expect(command).not.toContain("\r");
    expect(command.split("\n").filter(Boolean)).toHaveLength(1);
    const decoded = command
      .trimEnd()
      .slice("::add-mask::".length)
      .replaceAll("%0D", "\r")
      .replaceAll("%0A", "\n")
      .replaceAll("%25", "%");
    expect(decoded).toBe(secret);
    expect(ledger.redact(`received ${secret}`)).toBe("received [redacted]");
  });
});
