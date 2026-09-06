import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { directPool, inventory } from "./backup-verify";
import { setTimeout as pause } from "node:timers/promises";
import type { PoolClient } from "pg";
const startedAt = new Date().toISOString();
const pool = directPool(process.env.DATABASE_ADMIN_URL!);
const c = await pool.connect();
const results: { check: string; pass: boolean; detail?: unknown }[] = [];
try {
  const identity = await c.query("select current_setting('neon.branch_id',true) as id");
  assert.ok(process.env.M02_DRILL_BRANCH?.startsWith("br-"));
  assert.equal(identity.rows[0].id, process.env.M02_DRILL_BRANCH);
  assert.ok(!["br-snowy-violet-aymcvvvv", "br-small-hill-aymcu14y"].includes(identity.rows[0].id));
  const down = readFileSync(
    resolve(import.meta.dirname, "../../drizzle/rollback/0010_to_0009_down.sql"),
    "utf8",
  );
  const forward = readFileSync(
    resolve(import.meta.dirname, "../../drizzle/0010_backfill_accounts_issuer.sql"),
    "utf8",
  );
  const before = await inventory(c);
  const count = before.tables["public.accounts"].count;
  if (count > 0) {
    let blocked = false;
    try {
      await c.query(down);
    } catch (error) {
      blocked = (error as { code?: string }).code === "P0001";
      await c.query("ROLLBACK");
    }
    assert.ok(blocked);
    const after = await inventory(c);
    assert.deepEqual(after.tables, before.tables);
    results.push({
      check: "populated-down-refused-no-change",
      pass: true,
      detail: { accounts: count },
    });
  } else {
    await c.query(down);
    const a = await c.query(forward),
      b = await c.query(forward);
    const after = await inventory(c);
    assert.deepEqual(after.tables, before.tables);
    results.push({
      check: "empty-down-forward-forward",
      pass: true,
      detail: { first: a.rowCount, second: b.rowCount },
    });
    await c.query("BEGIN");
    try {
      await c.query(
        "insert into users(id,name,email,email_verified) values ('drill-user-a','Drill A','a@drill.invalid',true),('drill-user-b','Drill B','b@drill.invalid',true)",
      );
      await c.query(
        "insert into tenants(id,name,slug) values ('a0000000-0000-4000-8000-000000000001','Drill A','pre-a4-drill-a'),('b0000000-0000-4000-8000-000000000002','Drill B','pre-a4-drill-b')",
      );
      await c.query(
        "insert into tenant_memberships(tenant_id,user_id,role) values ('a0000000-0000-4000-8000-000000000001','drill-user-a','owner'),('b0000000-0000-4000-8000-000000000002','drill-user-b','owner')",
      );
      await c.query(
        "insert into products(tenant_id,user_id,name) values ('a0000000-0000-4000-8000-000000000001','drill-user-a','A'),('b0000000-0000-4000-8000-000000000002','drill-user-b','B')",
      );
      await c.query(
        "insert into accounts(id,account_id,provider_id,user_id,issuer) values ('drill-account','drill-user-a','credential','drill-user-a',NULL)",
      );
      const filled = await c.query(forward),
        again = await c.query(forward);
      assert.equal(filled.rowCount, 1);
      assert.equal(again.rowCount, 0);
      results.push({
        check: "forward-fills-null-once",
        pass: true,
        detail: { first: filled.rowCount, second: again.rowCount },
      });
    } finally {
      await c.query("ROLLBACK");
    }
    assert.deepEqual((await inventory(c)).tables, before.tables);
    await concurrencyDrill(c, down);
    assert.deepEqual((await inventory(c)).tables, before.tables);
  }
  console.log(
    JSON.stringify(
      {
        check: "m02:rollback-0010-drill",
        branch_id: identity.rows[0].id,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        result: "PASS",
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await c.query("ROLLBACK");
  console.error(
    JSON.stringify({
      check: "m02:rollback-0010-drill",
      result: "FAIL",
      code: (error as { code?: string }).code ?? "assertion",
      error: "Drill assertion failed; sensitive database details withheld.",
    }),
  );
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}

async function waitForLock(observer: PoolClient, pid: number): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const state = await observer.query("select cardinality(pg_blocking_pids($1)) > 0 as blocked", [
      pid,
    ]);
    if (state.rows[0].blocked) return;
    await pause(50);
  }
  throw new Error("Expected concurrent writer to block");
}
async function concurrencyDrill(reader: PoolClient, down: string): Promise<void> {
  const writerPool = directPool(process.env.DATABASE_ADMIN_URL!);
  const writer = await writerPool.connect();
  const user = "pre-a4-concurrency-user";
  const account = "pre-a4-concurrency-account";
  const insert =
    "insert into accounts(id,account_id,provider_id,user_id,issuer) values ($1,$2,'credential',$2,'local:credential') returning issuer";
  try {
    await reader.query(
      "insert into users(id,name,email,email_verified) values ($1,'Concurrency drill','concurrency@drill.invalid',true)",
      [user],
    );
    const writerPid = (await writer.query("select pg_backend_pid() as pid")).rows[0].pid;
    const readerPid = (await reader.query("select pg_backend_pid() as pid")).rows[0].pid;
    await reader.query("BEGIN");
    await reader.query("LOCK TABLE public.accounts IN SHARE ROW EXCLUSIVE MODE");
    const pendingInsert = writer.query(insert, [account, user]);
    await waitForLock(reader, writerPid);
    await reader.query(down);
    assert.equal((await pendingInsert).rows[0].issuer, "local:credential");
    results.push({ check: "writer-after-guard-waits-and-keeps-issuer", pass: true });
    await reader.query("delete from accounts where id=$1", [account]);
    await writer.query("BEGIN");
    await writer.query(insert, [account, user]);
    const pendingDown = reader.query(down).then(
      () => "unexpected-success",
      (error: { code?: string }) => error.code,
    );
    await waitForLock(writer, readerPid);
    await writer.query("COMMIT");
    assert.equal(await pendingDown, "P0001");
    await reader.query("ROLLBACK");
    assert.equal(
      (await reader.query("select issuer from accounts where id=$1", [account])).rows[0].issuer,
      "local:credential",
    );
    results.push({ check: "writer-before-guard-is-seen-and-down-refused", pass: true });
  } finally {
    await writer.query("ROLLBACK");
    await reader.query("ROLLBACK");
    await reader.query("delete from users where id=$1", [user]);
    writer.release();
    await writerPool.end();
  }
}
