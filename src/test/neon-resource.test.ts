import { describe, expect, it } from "vitest";
import {
  assertConnectionPair,
  assertOwnedResource,
  assertPermanentInventory,
  assertTemporary,
  DEVELOP_ID,
  FIXTURE_BASE_ID,
  NeonResources,
  PRODUCTION_ID,
  PROJECT_ID,
  resourcePlan,
  type Branch,
  type ResourceFetch,
} from "../../scripts/ci/neon-resource";

const now = new Date("2026-10-02T23:00:00Z");
const env = {
  GITHUB_REF: "refs/heads/develop",
  NEON_PROJECT_ID: PROJECT_ID,
  GITHUB_SHA: "a".repeat(40),
  GITHUB_RUN_ID: "1234",
  GITHUB_RUN_ATTEMPT: "2",
};
const plan = resourcePlan(env, now);
const id = "br-disposable-example";
const permanent: Branch[] = [
  { id: DEVELOP_ID, name: "develop", project_id: PROJECT_ID, default: false },
  { id: PRODUCTION_ID, name: "production", project_id: PROJECT_ID, default: true },
  { id: FIXTURE_BASE_ID, name: "ci-fixture-base", project_id: PROJECT_ID, default: false },
];
const temp = (): Branch => ({
  id,
  name: plan.name,
  project_id: PROJECT_ID,
  parent_id: DEVELOP_ID,
  default: false,
  created_at: now.toISOString(),
  expires_at: plan.expiresAt,
});
function mock(responses: { status?: number; body?: unknown; contentType?: string }[]) {
  const calls: { url: string; method?: string }[] = [];
  const impl: ResourceFetch = async (url, init) => {
    const value = responses[calls.length];
    calls.push({ url, method: init.method });
    if (!value) throw new Error("unexpected fetch call");
    const status = value.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(value.body ?? {}), {
      status,
      headers: { "content-type": value.contentType ?? "application/json" },
    });
  };
  return { impl, calls };
}
const inventory = (branches: Branch[] = permanent, next: string | null = null) => ({
  branches,
  pagination: { next },
});

describe("run-scoped Neon readiness resource lifecycle", () => {
  it("plans an expiring resource by run AND attempt, without another permanent channel", () => {
    expect(plan.name).toBe("readiness/develop-1234-2");
    expect(Date.parse(plan.expiresAt) - Date.parse(plan.startedAt)).toBe(24 * 3600000);
    expect(plan.parentId).toBe(DEVELOP_ID);
  });
  it("permits a production parent only for the explicit provisioning purpose, never as target", () => {
    const drill = resourcePlan({ ...env, RESOURCE_PURPOSE: "provisioning" }, now);
    expect(drill.parentId).toBe(PRODUCTION_ID);
    expect(drill.name).toBe("provisioning/develop-1234-2");
    expect(() => new NeonResources({ ...plan, parentId: PRODUCTION_ID }, "key")).toThrow();
    expect(() => resourcePlan({ ...env, RESOURCE_PURPOSE: "unknown" }, now)).toThrow();
    expect(() =>
      assertTemporary({ ...temp(), id: PRODUCTION_ID }, drill, PRODUCTION_ID, "true", now),
    ).toThrow();
  });
  it.each(["GITHUB_REF", "NEON_PROJECT_ID", "GITHUB_SHA", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"])(
    "rejects a missing or wrong %s before use",
    (key) => {
      expect(() => resourcePlan({ ...env, [key]: "" }, now)).toThrow();
    },
  );
  it("rejects production refs, stale start times and changed expiry identity", () => {
    expect(() => resourcePlan({ ...env, GITHUB_REF: "refs/heads/main" }, now)).toThrow();
    expect(() =>
      resourcePlan({ ...env, RESOURCE_STARTED_AT: "2026-10-02T20:00:00Z" }, now),
    ).toThrow();
    expect(() =>
      resourcePlan({ ...env, RESOURCE_EXPIRES_AT: "2026-10-03T22:00:00Z" }, now),
    ).toThrow();
  });
  it("requires permanent identity and default for develop, production and the empty fixture base", () => {
    expect(() => assertPermanentInventory(permanent)).not.toThrow();
    expect(() =>
      assertPermanentInventory([{ ...permanent[0], id: "br-other" }, permanent[1], permanent[2]]),
    ).toThrow();
    expect(() =>
      assertPermanentInventory([permanent[0], { ...permanent[1], default: false }, permanent[2]]),
    ).toThrow();
    expect(() => assertPermanentInventory(permanent.slice(0, 2))).toThrow();
    expect(() =>
      assertPermanentInventory([permanent[0], permanent[1], { ...permanent[2], name: "fixture" }]),
    ).toThrow();
    expect(() =>
      assertPermanentInventory([permanent[0], permanent[1], { ...permanent[2], default: true }]),
    ).toThrow();
    expect(() =>
      assertPermanentInventory([
        permanent[0],
        permanent[1],
        { ...permanent[2], project_id: "other-project" },
      ]),
    ).toThrow();
    expect(() => assertPermanentInventory([...permanent, permanent[0]])).toThrow("duplicated");
    expect(() => assertPermanentInventory([...permanent, permanent[2]])).toThrow("duplicated");
  });
  it("refuses reusing a preexisting resource of the same run name", async () => {
    const { impl } = mock([{ body: inventory([...permanent, temp()]) }]);
    await expect(new NeonResources(plan, "test-key", impl).prepare()).rejects.toThrow(
      "never reuse",
    );
  });
  it.each([
    "id",
    "name",
    "parent_id",
    "project_id",
    "default",
    "expires_at",
    "created_at",
  ] as const)("refuses a changed temporary %s", (key) => {
    const branch = { ...temp(), [key]: key === "default" ? true : "different" };
    expect(() => assertTemporary(branch, plan, id, "true", now)).toThrow();
  });
  it("refuses missing ownership and every permanent ID, including the fixture base", () => {
    expect(() => assertTemporary(temp(), plan, id, "false", now)).toThrow("ownership");
    for (const permanentId of [DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID])
      expect(() =>
        assertTemporary({ ...temp(), id: permanentId }, plan, permanentId, "true", now),
      ).toThrow("non-production");
    expect(() =>
      assertOwnedResource({ ...temp(), id: FIXTURE_BASE_ID }, plan, FIXTURE_BASE_ID, now),
    ).toThrow("non-production");
  });
  it("reports the empty fixture base among the permanent ids it must never delete", async () => {
    const expected = [DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID];
    const prepared = mock([{ body: inventory() }]);
    const report = await new NeonResources(plan, "test-key", prepared.impl).prepare();
    expect(report.permanentIds).toEqual(expected);
    const absent = mock([{ body: inventory() }, { body: inventory() }]);
    const proof = await new NeonResources(plan, "test-key", absent.impl).cleanup("", "", now);
    expect(proof.phase).toBe("no-resource-observed");
    expect(proof.permanentIds).toEqual(expected);
  });
  it("observes identity before DELETE, GET404 afterward, and independent paginated absence", async () => {
    const { impl, calls } = mock([
      { body: { branch: temp() } },
      { body: { branch: temp() } },
      { status: 404, body: { code: "BRANCH_NOT_FOUND" } },
      { body: inventory([permanent[0]], "page-two") },
      { body: inventory([permanent[1], permanent[2]]) },
    ]);
    const proof = await new NeonResources(plan, "test-key", impl).cleanup(id, "true", now);
    expect(proof.phase).toBe("discarded-verified");
    expect(proof.getStatus).toBe(404);
    expect(proof.absentByIdAndName).toBe(true);
    expect(proof.permanentIds).toEqual([DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID]);
    expect(calls.map((call) => call.method)).toEqual(["GET", "DELETE", "GET", "GET", "GET"]);
    expect(calls[0].url).toBe(calls[1].url);
    expect(calls[2].url).toBe(calls[1].url);
    expect(calls[4].url).toContain("cursor=page-two");
  });
  it("makes no DELETE when the returned ID is permanent (production or the fixture base) or reused", async () => {
    for (const [branch, ownership] of [
      [permanent[1], "true"],
      [permanent[2], "true"],
      [temp(), "false"],
    ] as const) {
      const { impl, calls } = mock([{ body: { branch } }]);
      await expect(
        new NeonResources(plan, "test-key", impl).cleanup(branch.id, ownership, now),
      ).rejects.toThrow();
      expect(calls.every((call) => call.method === "GET")).toBe(true);
    }
  });
  it("rejects a DELETE reply that identifies a different branch", async () => {
    const { impl } = mock([
      { body: { branch: temp() } },
      { body: { branch: { ...temp(), id: "br-other" } } },
    ]);
    await expect(
      new NeonResources(plan, "test-key", impl).cleanup(id, "true", now),
    ).rejects.toThrow("delete response identity");
  });
  it("does not treat DELETE success as disposal when GET still finds it", async () => {
    const { impl } = mock([
      { body: { branch: temp() } },
      { body: { branch: temp() } },
      { body: { branch: temp() } },
    ]);
    await expect(
      new NeonResources(plan, "test-key", impl).cleanup(id, "true", now),
    ).rejects.toThrow("GET 404");
  });
  it("rejects a same-name replacement and a missing permanent branch after deletion", async () => {
    for (const branches of [
      [...permanent, { ...temp(), id: "br-replacement" }],
      [permanent[0]],
      [permanent[0], permanent[1]],
    ]) {
      const { impl } = mock([
        { body: { branch: temp() } },
        { body: { branch: temp() } },
        { status: 404 },
        { body: inventory(branches) },
      ]);
      await expect(
        new NeonResources(plan, "test-key", impl).cleanup(id, "true", now),
      ).rejects.toThrow();
    }
  });
  it("a missing output is not exercise closure and does not hide an orphan", async () => {
    const absent = mock([{ body: inventory() }, { body: inventory() }]);
    expect(
      (await new NeonResources(plan, "test-key", absent.impl).cleanup("", "", now)).phase,
    ).toBe("no-resource-observed");
    expect(absent.calls.every((call) => call.method === "GET")).toBe(true);
    const orphan = mock([
      { body: inventory([...permanent, { ...temp(), expires_at: undefined }]) },
      { body: { branch: temp() } },
      { status: 404 },
      { body: inventory() },
    ]);
    const proof = await new NeonResources(plan, "test-key", orphan.impl).cleanup("", "", now);
    expect(proof.branchId).toBe(id);
    expect(proof.phase).toBe("discarded-verified");
    expect(orphan.calls.map((call) => call.method)).toEqual(["GET", "DELETE", "GET", "GET"]);
  });
  it("missing connection outputs and expiry do not prevent discarding a proven owned resource", async () => {
    const f = mock([
      { body: { branch: { ...temp(), expires_at: undefined } } },
      { status: 204 },
      { status: 404 },
      { body: inventory() },
    ]);
    const api = new NeonResources(plan, "test-key", f.impl);
    await expect(api.connections(id, "true", "", "", now)).rejects.toThrow("outputs");
    expect(f.calls).toHaveLength(0);
    expect((await api.cleanup(id, "true", now)).absentByIdAndName).toBe(true);
  });
  it("adopts an owned orphan and measures expiry again after PATCH, without DB_URL", async () => {
    const f = mock([
      { body: inventory([...permanent, { ...temp(), expires_at: undefined }]) },
      { body: {} },
      { body: { branch: temp() } },
    ]);
    expect((await new NeonResources(plan, "test-key", f.impl).adopt("", "", now)).phase).toBe(
      "created-verified",
    );
    expect(f.calls.map((call) => call.method)).toEqual(["GET", "PATCH", "GET"]);
  });
  it("an expiry PATCH failure is red, while cleanup remains possible", async () => {
    const missing = { ...temp(), expires_at: undefined };
    const f = mock([
      { body: { branch: missing } },
      { status: 422 },
      { body: { branch: missing } },
      { status: 204 },
      { status: 404 },
      { body: inventory() },
    ]);
    const api = new NeonResources(plan, "test-key", f.impl);
    await expect(api.adopt(id, "true", now)).rejects.toThrow("HTTP 422");
    expect((await api.cleanup(id, "true", now)).phase).toBe("discarded-verified");
  });
  it("recovering lost output cannot delete ambiguous, wrong-parent or preexisting identities", async () => {
    for (const branches of [
      [...permanent, temp(), { ...temp(), id: "br-another-id" }],
      [...permanent, { ...temp(), parent_id: PRODUCTION_ID }],
      [...permanent, { ...temp(), created_at: "2026-10-02T20:00:00Z" }],
      [...permanent, { ...temp(), default: true }],
    ]) {
      const f = mock([{ body: inventory(branches) }]);
      await expect(
        new NeonResources(plan, "test-key", f.impl).cleanup("", "", now),
      ).rejects.toThrow();
      expect(f.calls.every((call) => call.method === "GET")).toBe(true);
    }
  });
  it("fails closed for malformed/truncated/cyclic inventory and HTML404", async () => {
    for (const body of [{}, { branches: permanent }, { branches: [], pagination: null }]) {
      const { impl } = mock([{ body }]);
      await expect(new NeonResources(plan, "test-key", impl).branches()).rejects.toThrow();
    }
    const cyclic = mock([{ body: inventory(permanent, "same") }, { body: inventory([], "same") }]);
    await expect(new NeonResources(plan, "test-key", cyclic.impl).branches()).rejects.toThrow(
      "pagination",
    );
    const html = mock([
      { body: { branch: temp() } },
      { body: { branch: temp() } },
      { status: 404, contentType: "text/html" },
    ]);
    await expect(
      new NeonResources(plan, "test-key", html.impl).cleanup(id, "true", now),
    ).rejects.toThrow("non-JSON");
  });
  it("422 is an observed status/code and never inferred as auth/quota or echoed raw", async () => {
    const { impl } = mock([
      {
        status: 422,
        body: { code: "INVALID_PAYLOAD", message: "sensitive-payload-not-for-output" },
      },
    ]);
    await expect(new NeonResources(plan, "test-key", impl).prepare()).rejects.toThrow(
      "HTTP 422, code=INVALID_PAYLOAD",
    );
  });
  it("accepts portless action URIs only when the host belongs to the owned resource", async () => {
    const host = "ep-action-example.c-5.us-east-2.aws.neon.tech";
    const direct = `postgresql://neondb_owner:fixture-secret@${host}/neondb?sslmode=require&channel_binding=require`;
    const pooled = direct.replace("ep-action-example.", "ep-action-example-pooler.");
    for (const endpointBranch of [id, "br-unrelated"]) {
      const f = mock([
        { body: { branch: temp() } },
        {
          body: { endpoints: [{ host, branch_id: endpointBranch, project_id: PROJECT_ID }] },
        },
      ]);
      const result = new NeonResources(plan, "test-key", f.impl).connections(
        id,
        "true",
        direct,
        pooled,
        now,
      );
      if (endpointBranch === id)
        await expect(result).resolves.toMatchObject({
          phase: "connection-identity-verified",
          branchId: id,
          hostname: host,
        });
      else await expect(result).rejects.toThrow("does not belong");
    }
  });
});

describe("temporary connection pair identity", () => {
  const direct =
    "postgresql://neondb_owner:fixture-secret@ep-test-example.c-5.us-east-2.aws.neon.tech:5432/neondb?sslmode=require&channel_binding=require";
  const pooled = direct.replace("ep-test-example.", "ep-test-example-pooler.");
  it("accepts matching direct and pooled endpoints and rejects production or divergent connections", () => {
    expect(() => assertConnectionPair(direct, pooled)).not.toThrow();
    for (const candidate of [
      direct,
      pooled.replace("fixture-secret", "other"),
      pooled.replace("neondb?", "other?"),
      pooled.replace("ep-test-example", "ep-other-example"),
      pooled.replace("sslmode=require", "sslmode=disable"),
      pooled.replace("channel_binding=require", "channel_binding=none"),
      `${pooled}&host=ep-evil.aws.neon.tech`,
    ])
      expect(() => assertConnectionPair(direct, candidate)).toThrow();
    expect(() =>
      assertConnectionPair(
        direct.replace("ep-test-example", "ep-long-violet-aye9g0bn"),
        pooled.replace("ep-test-example", "ep-long-violet-aye9g0bn"),
      ),
    ).toThrow("production");
  });
  it("S6-R2/N01-residual: the effective destination cannot be moved by port or query", () => {
    for (const candidate of [
      // an omitted port would let the ambient PGPORT choose the destination
      direct.replace(":5432", ""),
      pooled.replace(":5432", ""),
      // a foreign explicit port
      direct.replace(":5432", ":9999"),
      // destination-altering and non-allowlisted query parameters
      `${direct}&host=ep-evil.c-5.us-east-2.aws.neon.tech`,
      `${direct}&port=9999`,
      `${direct}&hostaddr=10.0.0.1`,
      `${direct}&options=-c%20statement_timeout%3D0`,
      `${direct}&application_name=probe`,
      // an invalid channel_binding value is not on the allowlist
      direct.replace("channel_binding=require", "channel_binding=none"),
    ])
      expect(() => assertConnectionPair(candidate, pooled)).toThrow();
    expect(() => assertConnectionPair(direct, `${pooled}&host=ep-evil.aws.neon.tech`)).toThrow();
  });
});
