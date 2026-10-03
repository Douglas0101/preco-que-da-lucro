import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertConnectionPair,
  assertPermanentInventory,
  assertTemporary,
  DEVELOP_ID,
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
  it("requires permanent identity and default, not just a cardinality of two", () => {
    expect(() => assertPermanentInventory(permanent)).not.toThrow();
    expect(() =>
      assertPermanentInventory([{ ...permanent[0], id: "br-other" }, permanent[1]]),
    ).toThrow();
    expect(() =>
      assertPermanentInventory([permanent[0], { ...permanent[1], default: false }]),
    ).toThrow();
    expect(() => assertPermanentInventory([...permanent, permanent[0]])).toThrow("duplicated");
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
  it("refuses missing ownership and BOTH permanent IDs", () => {
    expect(() => assertTemporary(temp(), plan, id, "false", now)).toThrow("ownership");
    for (const permanentId of [DEVELOP_ID, PRODUCTION_ID])
      expect(() =>
        assertTemporary({ ...temp(), id: permanentId }, plan, permanentId, "true", now),
      ).toThrow("non-production");
  });
  it("observes identity before DELETE, GET404 afterward, and independent paginated absence", async () => {
    const { impl, calls } = mock([
      { body: { branch: temp() } },
      { body: { branch: temp() } },
      { status: 404, body: { code: "BRANCH_NOT_FOUND" } },
      { body: inventory([permanent[0]], "page-two") },
      { body: inventory([permanent[1]]) },
    ]);
    const proof = await new NeonResources(plan, "test-key", impl).cleanup(id, "true", now);
    expect(proof.phase).toBe("discarded-verified");
    expect(proof.getStatus).toBe(404);
    expect(proof.absentByIdAndName).toBe(true);
    expect(calls.map((call) => call.method)).toEqual(["GET", "DELETE", "GET", "GET", "GET"]);
    expect(calls[0].url).toBe(calls[1].url);
    expect(calls[2].url).toBe(calls[1].url);
    expect(calls[4].url).toContain("cursor=page-two");
  });
  it("makes no DELETE when the returned ID is production or a reused resource", async () => {
    for (const [branch, ownership] of [
      [permanent[1], "true"],
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
    for (const branches of [[...permanent, { ...temp(), id: "br-replacement" }], [permanent[0]]]) {
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
  it("the actual YAML isolates cleanup and passes TTL plus named remote reasons", () => {
    const yaml = readFileSync(".github/workflows/neon-readiness.yml", "utf8");
    expect(yaml).toContain("parent_branch: develop");
    expect(yaml).toContain("expires_at: ${{ steps.resource.outputs.expires_at }}");
    expect(yaml).toContain("node scripts/ci/neon-resource.ts adopt");
    expect(yaml).toContain("BRANCH_CREATED:");
    const cleanup = yaml.slice(yaml.indexOf("  cleanup:"));
    expect(cleanup).toContain("needs: readiness");
    expect(cleanup).toContain("if: always()");
    expect(cleanup).toContain("node scripts/ci/neon-resource.ts cleanup");
    expect(cleanup).not.toContain("delete-branch-action");
    expect(yaml.match(/ALLOW_REMOTE_DB:/g)).toHaveLength(3);
    expect(yaml).toContain("DATABASE_URL_UNPOOLED:");
    expect(yaml).toContain("DATABASE_DRIVER: node-postgres");
    for (const action of yaml.matchAll(/uses: ([^\s]+)@([^\s]+)/g))
      expect(action[2]).toMatch(/^[a-f0-9]{40}$/);
  });
  it("the provisioning workflow plans before creation and cleans independently of DB_URL and adopt success", () => {
    const yaml = readFileSync(".github/workflows/neon-drill-ops.yml", "utf8");
    const names = [
      "Plan provisioning before creation",
      "Exercise provisioning candidate 6.4.0",
      "Adopt ownership and expiry independently of connection outputs",
      "Validate candidate connection outputs against the owned endpoint",
      "Cleanup candidate always by the prepared identity",
    ];
    const indexes = names.map((name) => yaml.indexOf(`- name: ${name}`));
    expect(indexes.every((index) => index >= 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    const block = (name: string) =>
      yaml.slice(yaml.indexOf(`      - name: ${name}`)).split(/\n {6}- (?:name|uses):/)[0];
    for (const name of [names[2], names[4]]) {
      const step = block(name);
      expect(step).toContain(
        "if: always() && inputs.operation == 'exercise-provisioning' && steps.resource.outputs.started_at != ''",
      );
      expect(step).not.toMatch(/DB_URL|DATABASE_|cleanup_allowed|success\(\)/);
      expect(step).toContain("RESOURCE_PURPOSE: provisioning");
    }
    expect(block(names[1])).toContain("expires_at: ${{ steps.resource.outputs.expires_at }}");
    expect(block(names[4])).toContain("node scripts/ci/neon-resource.ts cleanup");
    expect(block(names[3])).toContain("node scripts/ci/neon-resource.ts connections");
  });
});

describe("temporary connection pair identity", () => {
  const direct =
    "postgresql://neondb_owner:fixture-password@ep-test-example.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
  const pooled = direct.replace("ep-test-example.", "ep-test-example-pooler.");
  it("accepts matching direct and pooled endpoints and rejects production or divergent connections", () => {
    expect(() => assertConnectionPair(direct, pooled)).not.toThrow();
    for (const candidate of [
      direct,
      pooled.replace("fixture-password", "other"),
      pooled.replace("neondb?", "other?"),
      pooled.replace("ep-test-example", "ep-other-example"),
      pooled.replace("sslmode=require", "sslmode=disable"),
    ])
      expect(() => assertConnectionPair(direct, candidate)).toThrow();
    expect(() =>
      assertConnectionPair(
        direct.replace("ep-test-example", "ep-long-violet-aye9g0bn"),
        pooled.replace("ep-test-example", "ep-long-violet-aye9g0bn"),
      ),
    ).toThrow("production");
  });
});
