import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema";
import { setDatabaseForTests, type Database } from "../../src/db/client.server";
import { createAuthInstance } from "../../src/server/auth/auth.server";
import { setEmailAdapterForTests } from "../../src/server/email/email-adapter.server";
import { directPool, inventory, verifyLocalJournal } from "./backup-verify";
import { resolve } from "node:path";

let stage = "inputs";
async function main() {
  const startedAt = new Date().toISOString();
  assert.ok(process.env.M02_DRILL_BRANCH?.startsWith("br-"));
  const admin = directPool(process.env.DATABASE_ADMIN_URL!);
  const runtime = directPool(process.env.DATABASE_RESTORE_RUNTIME_URL!);
  const a = await admin.connect();
  try {
    stage = "admin-identity-and-empty-source";
    const before = await inventory(a);
    assert.equal(before.identity?.branch_id, process.env.M02_DRILL_BRANCH);
    assert.equal(before.identity?.project_id, "damp-forest-57346541");
    assert.ok(
      !["br-snowy-violet-aymcvvvv", "br-small-hill-aymcu14y"].includes(before.identity!.branch_id),
    );
    assert.equal(before.tables["public.users"].count, 0);
    stage = "runtime-connection-identity";
    const identity = await runtime.query(
      "select current_user, current_setting('neon.branch_id',true) as branch_id",
    );
    assert.equal(identity.rows[0].current_user, "app_runtime");
    assert.equal(identity.rows[0].branch_id, before.identity!.branch_id);
    stage = "auth-initialization";
    const db = drizzle({ client: runtime, schema }) as unknown as Database;
    setDatabaseForTests(db);
    process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("base64url");
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    process.env.AUTH_TRUSTED_ORIGINS = "http://localhost:3000";
    let verificationUrl = "";
    setEmailAdapterForTests({
      async sendEmailVerification(message) {
        verificationUrl = message.url;
      },
      async sendPasswordReset() {},
    });
    const auth = createAuthInstance(db);
    const headers = {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "198.51.100.92",
    };
    const post = (path: string, body: object, cookie = "") =>
      auth.handler(
        new Request("http://localhost:3000/api/auth" + path, {
          method: "POST",
          headers: { ...headers, cookie },
          body: JSON.stringify(body),
        }),
      );
    const password = randomBytes(24).toString("base64url");
    let cookie = "";
    for (const suffix of ["a", "b"]) {
      const email = `restore-${suffix}@drill.invalid`;
      stage = "signup-" + suffix;
      const signup = await post("/sign-up/email", { name: "Restore drill", email, password });
      stage = "signup-status-" + signup.status;
      assert.equal(signup.status, 200);
      assert.ok(verificationUrl);
      stage = "email-verification";
      const verify = await auth.handler(
        new Request(verificationUrl, { headers, redirect: "manual" }),
      );
      assert.ok(verify.status >= 200 && verify.status < 400);
      stage = "login";
      const login = await post("/sign-in/email", { email, password });
      assert.equal(login.status, 200);
      const setCookie = login.headers.get("set-cookie")!;
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      if (suffix === "a") cookie = setCookie.split(";", 1)[0];
    }
    assert.equal(
      (
        await post("/sign-in/email", {
          email: "restore-a@drill.invalid",
          password: "invalid-password",
        })
      ).status,
      401,
    );
    stage = "tenant-memberships-and-rls";
    const users = await a.query(
      "select u.id as user_id,m.tenant_id,u.email from users u join tenant_memberships m on m.user_id=u.id order by u.email",
    );
    assert.equal(users.rowCount, 2);
    const [first, second] = users.rows;
    await a.query(
      "insert into products(tenant_id,user_id,name) values ($1,$2,'Restore A'),($3,$4,'Restore B')",
      [first.tenant_id, first.user_id, second.tenant_id, second.user_id],
    );
    const r = await runtime.connect();
    try {
      await r.query("BEGIN");
      await r.query(
        "select set_config('app.current_user_id',$1,true),set_config('app.current_tenant_id',$2,true)",
        [first.user_id, first.tenant_id],
      );
      assert.deepEqual((await r.query("select name from products order by name")).rows, [
        { name: "Restore A" },
      ]);
      assert.equal(
        (
          await r.query("update products set name='Forbidden' where tenant_id=$1", [
            second.tenant_id,
          ])
        ).rowCount,
        0,
      );
      await r.query("ROLLBACK");
    } finally {
      r.release();
    }
    stage = "session-and-logout";
    const session = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session?disableCookieCache=true", {
        headers: { ...headers, cookie },
      }),
    );
    assert.ok((await session.json())?.user);
    assert.equal((await post("/sign-out", {}, cookie)).status, 200);
    const loggedOut = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session?disableCookieCache=true", {
        headers: { ...headers, cookie },
      }),
    );
    assert.equal(await loggedOut.json(), null);
    const after = await inventory(a);
    const journal = verifyLocalJournal(after, resolve(import.meta.dirname, "../.."));
    assert.equal(journal.pass, true);
    console.log(
      JSON.stringify(
        {
          check: "m02:restore-auth-drill",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          branch_id: before.identity!.branch_id,
          result: "PASS",
          journal,
          checks: [
            "runtime-role-connection",
            "signup-two-tenants",
            "email-token-verification",
            "login-cookie-flags",
            "wrong-password-401",
            "own-tenant-visible",
            "cross-tenant-read-write-denied",
            "session-persisted",
            "logout-invalidates-session",
          ],
          limits:
            "Application Auth handler with real restored PostgreSQL and app_runtime. Email transport captured in memory; no Resend, Google OAuth, public HTTP or hPanel proof. Fixtures confined to disposable branch; collect evidence then destroy branch.",
        },
        null,
        2,
      ),
    );
  } finally {
    setEmailAdapterForTests(undefined);
    a.release();
    await admin.end();
    await runtime.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      check: "m02:restore-auth-drill",
      result: "FAIL",
      stage,
      code: (error as { code?: string }).code ?? "assertion",
      error: "Restore Auth/RLS drill failed; sensitive details withheld",
    }),
  );
  process.exitCode = 1;
});
