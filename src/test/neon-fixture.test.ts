import { describe, expect, it } from "vitest";
import {
  fixtureIdentity,
  refusalProjection,
  resetEmptyFixture,
} from "../../scripts/ci/prepare-neon-fixture";
import {
  DEVELOP_ID,
  FIXTURE_BASE_ID,
  PRODUCTION_ID,
  PROJECT_ID,
} from "../../scripts/ci/neon-resource";

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
  ALLOW_REMOTE_DB: "CI parent-data child fixture sourced from the empty ci-fixture-base",
};
function urls(hostname = host) {
  // S6-R2/N01-residual: the explicit 5432 port pins the effective destination,
  // so the ambient PGPORT can never move it; the query carries only the
  // validated provider parameters (sslmode/channel_binding), never a
  // destination mover; the userinfo stays interpolated synthetic fixture
  // material.
  const direct = new URL(
    `postgresql://fixture_user:${"synthetic-fixture"}@${hostname}:5432/neondb?sslmode=require&channel_binding=require`,
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
    init_source: "parent-data",
    parent_id: FIXTURE_BASE_ID,
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
  it("accepts a zero-row parent-data child of the empty base bound to the exact run and endpoint", () => {
    expect(fixtureIdentity(branch(), endpoints(), ...urls(), env, now)).toMatchObject({
      branchId: id,
      branchName: "pr-60-123-2",
      initSource: "parent-data",
    });
  });
  it.each([DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID])(
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
    { GITHUB_RUN_ID: "" },
  ])("refuses reused or different run context %j", (patch) => {
    expect(() =>
      fixtureIdentity(branch(), endpoints(), ...urls(), { ...env, ...patch }, now),
    ).toThrow();
  });
  it.each([
    { parent_id: null },
    { parent_id: PRODUCTION_ID },
    { parent_id: DEVELOP_ID },
    { init_source: "schema-only" },
    { init_source: "parent-schema" },
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
  it("checks every discovered table while locked and rebuilds the migration-owned schemas", async () => {
    const db = database();
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
      keptSchemas: [],
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
  it("drops exactly the migration-owned schemas in discovered order and keeps the managed ones", async () => {
    const db = database({
      schemas: ["app_private", "drizzle", "neon_auth", "pgrst", "public"],
      tables: [
        { schema: "public", name: "accounts", kind: "r" },
        { schema: "drizzle", name: "__drizzle_migrations", kind: "r" },
        { schema: "neon_auth", name: "users", kind: "r" },
      ],
    });
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 3,
      checkedTables: 3,
      rowsErased: 0,
      keptSchemas: ["neon_auth", "pgrst"],
    });
    const drops = db.calls.filter((sql) => sql.startsWith("drop schema"));
    expect(drops).toEqual([
      'drop schema "app_private" cascade',
      'drop schema "drizzle" cascade',
      'drop schema "public" cascade',
    ]);
    const lock = db.calls.findIndex((sql) => sql.startsWith("lock table"));
    const reads = db.calls
      .map((sql, index) => (sql.startsWith("select exists") ? index : -1))
      .filter((index) => index >= 0);
    const firstDrop = db.calls.findIndex((sql) => sql.startsWith("drop schema"));
    expect(reads).toHaveLength(4);
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
  it("accepts the managed neon_auth schema of the zero-row copy when empty, keeping it", async () => {
    const db = database({ schemas: ["app_private", "drizzle", "neon_auth", "public"] });
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
      keptSchemas: ["neon_auth"],
    });
    expect(
      db.calls
        .filter((sql) => sql.startsWith("drop schema"))
        .some((sql) => sql.includes("neon_auth")),
    ).toBe(false);
  });
  it("accepts the managed pgrst schema of the zero-row copy when empty, keeping it", async () => {
    const db = database({ schemas: ["app_private", "drizzle", "neon_auth", "pgrst", "public"] });
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
      keptSchemas: ["neon_auth", "pgrst"],
    });
    expect(
      db.calls
        .filter((sql) => sql.startsWith("drop schema"))
        .some((sql) => sql.includes("pgrst") || sql.includes("neon_auth")),
    ).toBe(false);
  });
  it("drops the migration-owned role so the chain recreates it through its CREATE path", async () => {
    const db = database();
    await resetEmptyFixture(db);
    expect(
      db.calls.filter((sql) => sql.startsWith("drop owned") || sql.startsWith("drop role")),
    ).toEqual(['drop owned by "app_runtime"', 'drop role if exists "app_runtime"']);
    const firstSchemaDrop = db.calls.findIndex((sql) => sql.startsWith("drop schema"));
    const ownedDrop = db.calls.findIndex((sql) => sql.startsWith("drop owned"));
    const roleDrop = db.calls.findIndex((sql) => sql.startsWith("drop role"));
    const createPublic = db.calls.findIndex((sql) => sql.startsWith("create schema public"));
    expect(firstSchemaDrop).toBeGreaterThan(-1);
    expect(ownedDrop).toBeGreaterThan(firstSchemaDrop);
    expect(roleDrop).toBeGreaterThan(ownedDrop);
    expect(roleDrop).toBeLessThan(createPublic);
  });
  it("accepts the provider-owned auth schema of the zero-row copy when empty, keeping it", async () => {
    const db = database({
      schemas: ["app_private", "auth", "drizzle", "neon_auth", "pgrst", "public"],
    });
    expect(await resetEmptyFixture(db)).toEqual({
      discoveredTables: 2,
      checkedTables: 2,
      rowsErased: 0,
      keptSchemas: ["auth", "neon_auth", "pgrst"],
    });
    expect(
      db.calls
        .filter((sql) => sql.startsWith("drop schema"))
        .some((sql) => sql.includes("auth") || sql.includes("pgrst") || sql.includes("neon_auth")),
    ).toBe(false);
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

describe("sanitized refusal projection of the preparation step", () => {
  it("projects an identity-phase plain error with no error content at all", () => {
    const projection = refusalProjection("identity", new Error("password=hunter2"));
    expect(projection).toBe(
      "Neon fixture refused: phase=identity, code=none; no credentials logged",
    );
    expect(projection).not.toContain("password");
    expect(projection).not.toContain("hunter2");
  });
  it("projects a validated SQLSTATE from a pg-shaped error", () => {
    expect(
      refusalProjection("prepare", {
        code: "42501",
        message: "must be owner of schema neon_auth",
      }),
    ).toBe("Neon fixture refused: phase=prepare, code=42501; no credentials logged");
  });
  it("projects a node errno code from a connect-phase failure", () => {
    expect(refusalProjection("connect", { code: "ENOTFOUND" })).toBe(
      "Neon fixture refused: phase=connect, code=ENOTFOUND; no credentials logged",
    );
    expect(refusalProjection("connect", { code: "ECONNREFUSED" })).toBe(
      "Neon fixture refused: phase=connect, code=ECONNREFUSED; no credentials logged",
    );
  });
  it.each([
    "42501'",
    "postgres://u:p@h/x",
    "lower_case",
    "4250",
    "425011234567890123456789",
    "",
    42,
    undefined,
  ])("never projects a credential-looking or invalid code %j", (code) => {
    expect(
      refusalProjection("connect", { code, message: "must be owner of schema neon_auth" }),
    ).toBe("Neon fixture refused: phase=connect, code=none; no credentials logged");
  });
  it("projects a non-object error without throwing", () => {
    expect(refusalProjection("prepare", "raw-string")).toBe(
      "Neon fixture refused: phase=prepare, code=none; no credentials logged",
    );
    expect(refusalProjection("prepare", null)).toBe(
      "Neon fixture refused: phase=prepare, code=none; no credentials logged",
    );
  });
});
