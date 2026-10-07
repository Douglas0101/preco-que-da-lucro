import { describe, expect, it } from "vitest";
import { fixtureIdentity, resetEmptyFixture } from "../../scripts/ci/prepare-neon-fixture";
import { DEVELOP_ID, PRODUCTION_ID, PROJECT_ID } from "../../scripts/ci/neon-resource";

const now = Date.parse("2026-10-07T00:50:00Z");
const id = "br-fixture-example";
const host = "ep-fixture-example.c-2.us-east-2.aws.neon.tech";
const env = {
  GITHUB_REPOSITORY: "Douglas0101/preco-que-da-lucro",
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_BASE_REF: "main",
  GITHUB_RUN_ID: "123",
  GITHUB_RUN_ATTEMPT: "2",
  PR_NUMBER: "60",
  NEON_PROJECT_ID: PROJECT_ID,
  BRANCH_ID: id,
  BRANCH_CREATED: "true",
  ALLOW_REMOTE_DB: "CI parent-schema child fixture with synthetic data",
};
function urls(hostname = host) {
  // S6-R2/N01-residual: the explicit 5432 port pins the effective destination,
  // so the ambient PGPORT can never move it; the userinfo stays interpolated
  // synthetic fixture material.
  const direct = new URL(
    `postgresql://fixture_user:${"synthetic-fixture"}@${hostname}:5432/neondb?sslmode=require`,
  );
  const pooled = new URL(direct.href);
  pooled.hostname = pooled.hostname.replace(/^([^.]+)/, "$1-pooler");
  return [direct.href, pooled.href] as const;
}
const branch = () => ({
  branch: {
    id,
    name: "pr-60-123-2",
    project_id: PROJECT_ID,
    default: false,
    protected: false,
    current_state: "ready",
    init_source: "parent-schema",
    parent_id: PRODUCTION_ID,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 24 * 3600_000).toISOString(),
  },
});
const endpoints = () => ({
  endpoints: [
    {
      host,
      id: "ep-fixture-example",
      branch_id: id,
      project_id: PROJECT_ID,
      type: "read_write",
      disabled: false,
    },
  ],
});

describe("Neon PR fixture ownership and endpoint binding", () => {
  it("accepts a parent-schema child bound to the exact run, attempt, parent and endpoint", () => {
    expect(fixtureIdentity(branch(), endpoints(), ...urls(), env, now)).toMatchObject({
      branchId: id,
      branchName: "pr-60-123-2",
      initSource: "parent-schema",
    });
  });
  it("accepts a develop-base child whose explicit parent is develop", () => {
    const body = branch();
    body.branch.parent_id = DEVELOP_ID;
    expect(
      fixtureIdentity(body, endpoints(), ...urls(), { ...env, GITHUB_BASE_REF: "develop" }, now),
    ).toMatchObject({ branchId: id, initSource: "parent-schema" });
  });
  it.each([DEVELOP_ID, PRODUCTION_ID])(
    "refuses permanent branch %s even with remote override",
    (branchId) => {
      expect(() =>
        fixtureIdentity(branch(), endpoints(), ...urls(), { ...env, BRANCH_ID: branchId }, now),
      ).toThrow();
    },
  );
  it("refuses production connections unconditionally and remote targets without a reason", () => {
    expect(() =>
      fixtureIdentity(
        branch(),
        endpoints(),
        ...urls("ep-long-violet-aye9g0bn.c-2.us-east-2.aws.neon.tech"),
        env,
        now,
      ),
    ).toThrow("produção");
    expect(() =>
      fixtureIdentity(branch(), endpoints(), ...urls(), { ...env, ALLOW_REMOTE_DB: " " }, now),
    ).toThrow("remoto");
  });
  it.each([
    { BRANCH_CREATED: "false" },
    { GITHUB_RUN_ATTEMPT: "1" },
    { PR_NUMBER: "61" },
    { GITHUB_REPOSITORY: "foreign/fork" },
    { GITHUB_EVENT_NAME: "push" },
    { NEON_PROJECT_ID: "different" },
    { GITHUB_BASE_REF: "" },
    { GITHUB_BASE_REF: "preview" },
    { GITHUB_BASE_REF: undefined },
    { GITHUB_RUN_ID: "" },
  ])("refuses reused or different run context %j", (patch) => {
    expect(() =>
      fixtureIdentity(branch(), endpoints(), ...urls(), { ...env, ...patch }, now),
    ).toThrow();
  });
  it.each([
    { parent_id: null },
    { parent_id: DEVELOP_ID },
    { init_source: "schema-only" },
    { init_source: "parent-data" },
    { default: true },
    { protected: true },
    { current_state: "init" },
    { project_id: "different" },
    { created_at: "2026-10-06T23:00:00Z" },
    { created_at: "2026-10-07T01:00:00Z" },
    { expires_at: "2026-10-07T00:49:00Z" },
    { expires_at: "2026-10-09T00:50:00Z" },
  ])("refuses unverified branch metadata %j", (patch) => {
    const body = branch();
    Object.assign(body.branch, patch);
    expect(() => fixtureIdentity(body, endpoints(), ...urls(), env, now)).toThrow();
  });
  it("does not infer connection ownership from an ID or matching table counts", () => {
    for (const patch of [
      { branch_id: DEVELOP_ID },
      { project_id: "different" },
      { host: "ep-another.us-east-2.aws.neon.tech" },
      { type: "read_only" },
      { disabled: true },
    ]) {
      const body = endpoints();
      Object.assign(body.endpoints[0], patch);
      expect(() => fixtureIdentity(branch(), body, ...urls(), env, now)).toThrow("endpoint");
    }
    expect(() => fixtureIdentity(branch(), { endpoints: [] }, ...urls(), env, now)).toThrow();
    const duplicate = endpoints();
    duplicate.endpoints.push(duplicate.endpoints[0]);
    expect(() => fixtureIdentity(branch(), duplicate, ...urls(), env, now)).toThrow();
  });
});

describe("empty schema preparation refuses inherited data before any destructive SQL", () => {
  function database(
    options: {
      populated?: boolean;
      invisible?: boolean;
      schemas?: string[];
      tables?: Record<string, unknown>[];
      largeObjects?: boolean;
      countFailure?: boolean;
    } = {},
  ) {
    const calls: string[] = [];
    return {
      calls,
      async query(sql: string) {
        calls.push(sql);
        if (sql.includes("from pg_namespace where"))
          return {
            rows: (options.schemas ?? ["app_private", "drizzle", "public"]).map((nspname) => ({
              nspname,
            })),
          };
        if (sql.includes("from pg_class c"))
          return {
            rows: options.tables ?? [
              { schema: "public", name: "accounts", kind: "r" },
              { schema: "drizzle", name: "__drizzle_migrations", kind: "r" },
            ],
          };
        if (sql.includes("from pg_largeobject_metadata"))
          return { rows: [{ populated: options.largeObjects ?? false }] };
        if (sql.startsWith("select exists")) {
          if (options.countFailure) throw new Error("denied sentinel query");
          return { rows: options.invisible ? [] : [{ populated: options.populated ?? false }] };
        }
        return { rows: [] };
      },
    };
  }
  it("checks every discovered table while locked and rebuilds only the empty schemas", async () => {
    const db = database();
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
    });
    const lock = db.calls.findIndex((sql) => sql.startsWith("lock table"));
    const reads = db.calls
      .map((sql, index) => (sql.startsWith("select exists") ? index : -1))
      .filter((index) => index >= 0);
    const firstDrop = db.calls.findIndex((sql) => sql.startsWith("drop schema"));
    expect(lock).toBeGreaterThan(0);
    expect(reads).toHaveLength(3);
    expect(reads.every((index) => index > lock && index < firstDrop)).toBe(true);
    expect(db.calls.at(-1)).toBe("commit");
  });
  it.each([
    { populated: true },
    { invisible: true },
    { countFailure: true },
    { largeObjects: true },
    { schemas: ["public", "operator_data"] },
    { schemas: [] },
    { tables: [] },
    { tables: [{ schema: "public", name: "external_data", kind: "f" }] },
    { tables: [{ schema: "public", name: "cached_data", kind: "m" }] },
  ])("preserves data and rolls back on incomplete or nonempty inventory %j", async (options) => {
    const db = database(options);
    await expect(resetEmptyFixture(db)).rejects.toThrow();
    expect(db.calls.some((sql) => /^(drop|truncate|delete|create) /i.test(sql))).toBe(false);
    expect(db.calls.at(-1)).toBe("rollback");
  });
  it("accepts the managed neon_auth schema of a parent-schema copy when empty", async () => {
    const db = database({ schemas: ["app_private", "drizzle", "neon_auth", "public"] });
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
    });
  });
  it("refuses an unknown copied schema before any destructive SQL", async () => {
    const db = database({ schemas: ["public", "legacy_web"] });
    await expect(resetEmptyFixture(db)).rejects.toThrow("unexpected or incomplete");
    expect(db.calls.some((sql) => /^(drop|truncate|delete|create) /i.test(sql))).toBe(false);
    expect(db.calls.at(-1)).toBe("rollback");
  });
  it("quotes discovered identifiers instead of executing identifier contents", async () => {
    const db = database({
      tables: [{ schema: "public", name: 'odd"; delete from users; --', kind: "r" }],
    });
    await resetEmptyFixture(db);
    expect(db.calls.find((sql) => sql.startsWith("lock table"))).toContain(
      '"odd""; delete from users; --"',
    );
  });
});
