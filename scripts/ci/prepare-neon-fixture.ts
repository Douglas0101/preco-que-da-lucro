import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { exigirAlvoDeBanco } from "../lib/db-target";
import {
  assertConnectionPair,
  DEVELOP_ID,
  FIXTURE_BASE_ID,
  PRODUCTION_ID,
  PROJECT_ID,
} from "./neon-resource";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function fixtureIdentity(
  branchBody: unknown,
  endpointBody: unknown,
  admin: string,
  pooled: string,
  env: NodeJS.ProcessEnv,
  now = Date.now(),
) {
  exigirAlvoDeBanco("CI fixture DIRECT", admin, env);
  exigirAlvoDeBanco("CI fixture pooled", pooled, env);
  assertConnectionPair(admin, pooled);
  const id = env.BRANCH_ID ?? "";
  const numeric = [env.PR_NUMBER, env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT];
  if (
    env.GITHUB_REPOSITORY !== "Douglas0101/preco-que-da-lucro" ||
    env.GITHUB_EVENT_NAME !== "pull_request" ||
    env.NEON_PROJECT_ID !== PROJECT_ID ||
    env.BRANCH_CREATED !== "true" ||
    numeric.some((value) => !/^[1-9][0-9]*$/.test(value ?? "")) ||
    !/^br-[a-z0-9-]+$/.test(id) ||
    [DEVELOP_ID, PRODUCTION_ID, FIXTURE_BASE_ID].includes(id)
  )
    throw new Error("fixture run/project/creation identity is not verified");
  const name = `pr-${env.PR_NUMBER}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
  const branch = record(branchBody) && record(branchBody.branch) ? branchBody.branch : null;
  const created = Date.parse(String(branch?.created_at ?? ""));
  const expiry = Date.parse(String(branch?.expires_at ?? ""));
  if (
    !branch ||
    branch.id !== id ||
    branch.project_id !== PROJECT_ID ||
    branch.name !== name ||
    branch.default !== false ||
    branch.protected !== false ||
    branch.parent_id !== FIXTURE_BASE_ID ||
    branch.init_source !== "parent-data" ||
    branch.current_state !== "ready" ||
    !Number.isFinite(now) ||
    !Number.isFinite(created) ||
    !Number.isFinite(expiry) ||
    created > now + 60_000 ||
    now - created > 15 * 60_000 ||
    expiry <= now ||
    expiry - created > 24 * 3600_000 + 120_000
  )
    throw new Error("fixture zero-row child/parent/expiry/freshness identity differs");
  const endpoints =
    record(endpointBody) && Array.isArray(endpointBody.endpoints) ? endpointBody.endpoints : [];
  const direct = new URL(admin);
  if (direct.pathname !== "/neondb") throw new Error("fixture database differs from neondb");
  const matched = endpoints.filter((value) => record(value) && value.host === direct.hostname);
  if (
    matched.length !== 1 ||
    !record(matched[0]) ||
    matched[0].branch_id !== id ||
    matched[0].project_id !== PROJECT_ID ||
    matched[0].type !== "read_write" ||
    matched[0].disabled !== false
  )
    throw new Error("fixture connection is not bound to the observed branch endpoint");
  return {
    branchId: id,
    branchName: name,
    initSource: "parent-data",
    expiresAt: branch.expires_at,
  };
}

interface FixtureDatabase {
  query(text: string): Promise<{ rows: RecordValue[] }>;
}
// The drop set is exactly the schemas the migration chain creates/rebuilds.
// Neon-managed `neon_auth` and `pgrst`, plus the provider-owned empty `auth`
// schema (owner cloud_admin; observed on the base as the sixth schema with zero
// tables), are verified empty like every table but are NOT dropped: ownership
// of a managed schema belongs to the provider (a neondb_owner DROP on it is a
// SQLSTATE 42501 hazard), and nothing in the drill, db suites, RLS probe or E2E
// references them — keeping them also keeps the schema-diff baseline clean.
// Unknown schemas still fail closed.
const allowedSchemas = ["app_private", "auth", "drizzle", "neon_auth", "pgrst", "public"];
const migrationOwnedSchemas = ["app_private", "drizzle", "public"];
const quoted = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Only a freshly verified zero-row parent-data child of the empty base may call this function. Never erase rows. */
export async function resetEmptyFixture(db: FixtureDatabase) {
  await db.query("begin");
  try {
    await db.query("set local lock_timeout = '5s'");
    await db.query("set local statement_timeout = '30s'");
    await db.query("set local row_security = off");
    const schemas = await db.query(
      "select nspname from pg_namespace where nspname <> 'information_schema' and nspname !~ '^pg_' order by nspname",
    );
    const names = schemas.rows.map((row) => row.nspname);
    if (
      !names.includes("public") ||
      names.some((name) => typeof name !== "string" || !allowedSchemas.includes(name)) ||
      new Set(names).size !== names.length
    )
      throw new Error("fixture discovered an unexpected or incomplete schema inventory");
    const tables = await db.query(`
      select n.nspname as schema, c.relname as name, c.relkind as kind
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname <> 'information_schema' and n.nspname !~ '^pg_'
        and c.relkind in ('r', 'p', 'm', 'f') order by n.nspname, c.relname
    `);
    if (
      tables.rows.length === 0 ||
      tables.rows.some(
        (row) =>
          typeof row.schema !== "string" ||
          typeof row.name !== "string" ||
          !allowedSchemas.includes(row.schema) ||
          !["r", "p"].includes(String(row.kind)),
      )
    )
      throw new Error("fixture table inventory is empty or contains unsupported relations");
    const relations = tables.rows.map(
      (row) => `${quoted(String(row.schema))}.${quoted(String(row.name))}`,
    );
    if (new Set(relations).size !== relations.length)
      throw new Error("fixture table inventory is duplicated");
    await db.query(`lock table ${relations.join(", ")} in access exclusive mode`);
    for (const relation of relations) {
      const result = await db.query(
        `select exists(select 1 from ${relation} limit 1) as populated`,
      );
      if (result.rows.length !== 1 || result.rows[0].populated !== false)
        throw new Error("fixture contains rows or row visibility is not verified; nothing erased");
    }
    const largeObjects = await db.query(
      "select exists(select 1 from pg_largeobject_metadata limit 1) as populated",
    );
    if (largeObjects.rows.length !== 1 || largeObjects.rows[0].populated !== false)
      throw new Error("fixture contains large objects or inventory is not verified");
    // Drop only the verified empty schemas the migration chain owns, so the
    // rebuild starts from the real migration ledger; managed schemas stay.
    const dropped = names.filter(
      (name): name is string => typeof name === "string" && migrationOwnedSchemas.includes(name),
    );
    const keptSchemas = names
      .filter(
        (name): name is string => typeof name === "string" && !migrationOwnedSchemas.includes(name),
      )
      .sort();
    for (const name of dropped) await db.query(`drop schema ${quoted(String(name))} cascade`);
    await db.query("create schema public");
    await db.query("commit");
    return {
      discoveredTables: relations.length,
      checkedTables: relations.length,
      rowsErased: 0,
      keptSchemas,
    };
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

const refusalCodePattern = /^[0-9A-Z_]{5,12}$/;

/**
 * The validated code projection of a refusal: a pg SQLSTATE or node errno
 * (`error.code`) when it fits the pattern, otherwise absent. Any other error
 * content — messages, provider bodies, credential material — is never surfaced.
 */
export function refusalCode(error: unknown): string | undefined {
  return record(error) && typeof error.code === "string" && refusalCodePattern.test(error.code)
    ? error.code
    : undefined;
}

/**
 * The single sanitized refusal line. The phase discriminates connect failures
 * from SQL failures and identity throws; nothing else from the error is logged.
 */
export function refusalProjection(phase: string, error: unknown): string {
  return `Neon fixture refused: phase=${phase}, code=${refusalCode(error) ?? "none"}; no credentials logged`;
}

async function main() {
  let client: Client | undefined;
  let phase = "identity";
  let artifact: string | undefined;
  try {
    const env = process.env;
    if (!env.RUNNER_TEMP || !env.NEON_API_KEY)
      throw new Error("fixture CI credentials/context absent");
    artifact = resolve(env.RUNNER_TEMP, "neon-pr-fixture.json");
    const admin = readFileSync(resolve(env.RUNNER_TEMP, "branch_direct_url"), "utf8");
    const pooled = readFileSync(resolve(env.RUNNER_TEMP, "branch_pooled_url"), "utf8");
    const id = env.BRANCH_ID ?? "";
    if (!/^br-[a-z0-9-]+$/.test(id) || env.NEON_PROJECT_ID !== PROJECT_ID)
      throw new Error("fixture API target is not verified");
    async function read(path: string) {
      const response = await fetch(
        `https://console.neon.tech/api/v2/projects/${PROJECT_ID}/${path}`,
        {
          headers: { Authorization: `Bearer ${env.NEON_API_KEY}` },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) throw new Error(`fixture API HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    }
    const [branch, endpoints] = await Promise.all([
      read(`branches/${id}`),
      read(`branches/${id}/endpoints`),
    ]);
    const identity = fixtureIdentity(branch, endpoints, admin, pooled, env);
    phase = "connect";
    // A fresh endpoint can still be initializing here; a connect failure now
    // carries its own phase instead of collapsing into the generic refusal.
    client = new Client({ connectionString: admin, connectionTimeoutMillis: 15_000 });
    await client.connect();
    phase = "prepare";
    const result = { schema: "neon-pr-fixture/1", identity, ...(await resetEmptyFixture(client)) };
    phase = "persist";
    writeFileSync(
      resolve(env.RUNNER_TEMP, "neon-pr-fixture.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    // PG errors and provider bodies can contain credential or account values;
    // the refusal line carries only the phase and a validated code projection.
    console.error(refusalProjection(phase, error));
    if (artifact && !existsSync(artifact)) {
      try {
        const code = refusalCode(error);
        writeFileSync(
          artifact,
          `${JSON.stringify(
            {
              schema: "neon-pr-fixture/1",
              phase,
              verdict: "NO-VERDICT",
              ...(code ? { code } : {}),
            },
            null,
            2,
          )}\n`,
        );
      } catch {
        // An artifact-write failure must not mask the original refusal.
      }
    }
    process.exitCode = 2;
  } finally {
    await client?.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
