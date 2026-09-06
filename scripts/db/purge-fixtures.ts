import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { directPool, inventory, compareInventories, sha256, type Inventory } from "./backup-verify";

export const PROJECT_ID = "damp-forest-57346541";
export const PRODUCTION_BRANCH = "br-snowy-violet-aymcvvvv";
export const FIXTURE_EMAIL_DOMAIN = "@preco-que-da.test";
export const fixtureTables = [
  "chat_messages",
  "chat_conversations",
  "tool_executions",
  "idempotency_records",
  "audit_events",
  "ai_usage",
  "ai_daily_budgets",
  "calculation_snapshots",
  "sales_items",
  "sales",
  "simulations",
  "purchase_price_history",
  "market_prices",
  "sales_fees",
  "product_packaging",
  "product_ingredients",
  "expenses",
  "products",
  "profiles",
  "tenant_memberships",
  "sessions",
  "accounts",
  "verifications",
  "rate_limits",
  "tenants",
  "users",
] as const;

export interface PurgeEvidence {
  verification: {
    result: string;
    snapshot_id: string;
    source_branch: string;
    restore_branch: string;
    source: Inventory;
    comparison: { pass: boolean };
    journal: { pass: boolean };
  };
  snapshot: { id: string; source_branch_id: string; expires_at: string };
  snapshot_checked_at: string;
}

export function assertEvidence(proof: PurgeEvidence, now = Date.now()): void {
  const v = proof.verification;
  const age = now - Date.parse(proof.snapshot_checked_at);
  if (
    v.result !== "PASS" ||
    !v.comparison.pass ||
    !v.journal.pass ||
    v.source_branch !== PRODUCTION_BRANCH ||
    v.restore_branch === PRODUCTION_BRANCH ||
    v.snapshot_id !== proof.snapshot.id ||
    proof.snapshot.source_branch_id !== PRODUCTION_BRANCH ||
    !(Date.parse(proof.snapshot.expires_at) > now) ||
    !(age >= 0 && age <= 600_000)
  ) {
    throw new Error("Fresh snapshot receipt and passing restore proof required");
  }
}

export function assertTarget(
  identity: Inventory["identity"],
  branch: string,
  proof: PurgeEvidence,
  apply: boolean,
): void {
  if (
    identity?.project_id !== PROJECT_ID ||
    identity.branch_id !== branch ||
    ![PRODUCTION_BRANCH, proof.verification.restore_branch].includes(branch)
  ) {
    throw new Error("Unapproved server identity");
  }
  // DB-01 was completed. Further production APPLY is deliberately unavailable.
  if (apply && branch === PRODUCTION_BRANCH)
    throw new Error("Production purge is closed; rehearsal branch only");
}

export function fixtureStateMatches(actual: Inventory, expected: Inventory): boolean {
  const names = [...fixtureTables.map((t) => "public." + t), "drizzle.__drizzle_migrations"].sort();
  return (
    JSON.stringify(Object.keys(actual.tables).sort()) === JSON.stringify(names) &&
    JSON.stringify(Object.keys(expected.tables).sort()) === JSON.stringify(names) &&
    compareInventories(actual, expected).pass
  );
}

async function execute(branch: string, apply: boolean, proof: PurgeEvidence) {
  const pool = directPool(process.env.DATABASE_ADMIN_URL!);
  const client = await pool.connect();
  const startedAt = new Date().toISOString();
  try {
    await client.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    const identity = await client.query(
      "select current_setting('neon.project_id',true) as project_id, current_setting('neon.branch_id',true) as branch_id",
    );
    assertTarget(identity.rows[0], branch, proof, apply);
    if (apply)
      await client.query(
        "LOCK TABLE " +
          fixtureTables.map((t) => 'public."' + t + '"').join(",") +
          ",drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE",
      );
    const before = await inventory(client, false);
    const empty = fixtureTables.every((t) => before.tables["public." + t]?.count === 0);
    if (!empty && !fixtureStateMatches(before, proof.verification.source))
      throw new Error("Manifest changed");
    const unexpected = await client.query(
      "select count(*)::int as n from public.users where email not ilike '%' || $1",
      [FIXTURE_EMAIL_DOMAIN],
    );
    if (unexpected.rows[0].n !== 0) throw new Error("Non-fixture user");
    const deleted: Record<string, number> = {};
    if (apply && !empty)
      for (const table of fixtureTables) {
        const r = await client.query('DELETE FROM public."' + table + '"');
        deleted[table] = r.rowCount ?? 0;
      }
    const after = await inventory(client, false);
    if (apply && !fixtureTables.every((t) => after.tables["public." + t]?.count === 0))
      throw new Error("Nonempty result");
    for (const key of ["journal", "catalog", "roles"] as const) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
        throw new Error("Structure changed");
    }
    await client.query(apply ? "COMMIT" : "ROLLBACK");
    return {
      check: "db:purge-fixtures",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      branch_id: branch,
      applied: apply,
      result: empty ? "ALREADY_EMPTY" : "PASS",
      snapshot_id: proof.snapshot.id,
      deleted,
      before,
      after,
      sql: fixtureTables.map((t) => 'DELETE FROM public."' + t + '";'),
      limits:
        "Only the exact restored fixture manifest. Production APPLY disabled after DB-01. Snapshot receipt is operator-supplied provider evidence, not fetched by this tool.",
    };
  } catch {
    await client.query("ROLLBACK");
    throw new Error("Transaction aborted; database details withheld");
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      branch: { type: "string" },
      "proof-sha256": { type: "string" },
      apply: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (!values.branch || !values["proof-sha256"] || !process.env.DATABASE_ADMIN_URL)
    throw new Error("Explicit branch, proof digest and connection required");
  const bytes = readFileSync(0);
  if (sha256(bytes) !== values["proof-sha256"]) throw new Error("Proof digest mismatch");
  const proof = JSON.parse(bytes.toString("utf8")) as PurgeEvidence;
  assertEvidence(proof);
  console.log(JSON.stringify(await execute(values.branch, values.apply, proof), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(
      JSON.stringify({
        check: "db:purge-fixtures",
        result: "ERROR",
        error:
          "Purge refused: check proof, expiry, target, manifest and locks. No database details emitted.",
      }),
    );
    process.exitCode = 2;
  });
}
