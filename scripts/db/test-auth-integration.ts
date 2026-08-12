import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashSync } from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import * as schema from "../../src/db/schema";
import { setDatabaseForTests, type Database } from "../../src/db/client.server";
import { createAuthInstance } from "../../src/server/auth/auth.server";
import {
  setEmailAdapterForTests,
  type AuthEmailMessage,
  type TransactionalEmailAdapter,
} from "../../src/server/email/email-adapter.server";
import { requireAdminUrl } from "./migrate";

class CapturingEmailAdapter implements TransactionalEmailAdapter {
  verification?: AuthEmailMessage;
  reset?: AuthEmailMessage;

  async sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    this.verification = message;
  }

  async sendPasswordReset(message: AuthEmailMessage): Promise<void> {
    this.reset = message;
  }
}

function jsonRequest(path: string, body: Record<string, unknown>, cookie?: string): Request {
  const headers = new Headers({
    "content-type": "application/json",
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
  });
  if (cookie) headers.set("cookie", cookie);
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "login deve emitir Set-Cookie");
  assert.match(setCookie, /preco_que_da_lucro\.session_token=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  assert.doesNotMatch(setCookie, /Domain=/i);
  return setCookie.split(";", 1)[0]!;
}

async function main(): Promise<void> {
  const runtimePassword = randomBytes(24).toString("base64url");
  const initialPassword = randomBytes(24).toString("base64url");
  const changedPassword = randomBytes(24).toString("base64url");
  const legacyPassword = randomBytes(24).toString("base64url");
  const adminUrl = requireAdminUrl();
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`alter role app_runtime password ${admin.escapeLiteral(runtimePassword)}`);

  const runtime = new URL(adminUrl);
  runtime.username = "app_runtime";
  runtime.password = runtimePassword;
  const pool = new Pool({ connectionString: runtime.toString(), max: 3 });
  const database = drizzle({ client: pool, schema });
  setDatabaseForTests(database as unknown as Database);

  process.env.BETTER_AUTH_SECRET = randomBytes(32).toString("base64url");
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.AUTH_TRUSTED_ORIGINS = "http://localhost:3000";

  const email = new CapturingEmailAdapter();
  setEmailAdapterForTests(email);
  const auth = createAuthInstance(database as unknown as Database);

  try {
    const signup = await auth.handler(
      jsonRequest("/sign-up/email", {
        name: "Maria Integração",
        email: "maria@example.test",
        password: initialPassword,
      }),
    );
    assert.equal(signup.status, 200);
    assert.ok(email.verification?.url);
    assert.equal(
      signup.headers.get("set-cookie"),
      null,
      "signup não autentica antes da confirmação",
    );

    const tenant = await admin.query<{ count: string }>(
      `select count(*)::text as count
       from tenants t
       join tenant_memberships m on m.tenant_id = t.id
       join users u on u.id = m.user_id
       where u.email = 'maria@example.test' and t.kind = 'personal' and m.role = 'owner'`,
    );
    assert.equal(tenant.rows[0]?.count, "1");

    const verificationUrl = new URL(email.verification.url);
    const verify = await auth.handler(
      new Request(verificationUrl, {
        headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
        redirect: "manual",
      }),
    );
    assert.ok(verify.status >= 200 && verify.status < 400);

    const login = await auth.handler(
      jsonRequest("/sign-in/email", {
        email: "maria@example.test",
        password: initialPassword,
      }),
    );
    assert.equal(login.status, 200);
    const oldCookie = sessionCookie(login);

    const change = await auth.handler(
      jsonRequest(
        "/change-password",
        {
          currentPassword: initialPassword,
          newPassword: changedPassword,
          revokeOtherSessions: false,
        },
        oldCookie,
      ),
    );
    assert.equal(change.status, 200);

    const oldSession = await auth.handler(
      new Request("http://localhost:3000/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie: oldCookie },
      }),
    );
    const oldSessionBody = await oldSession.json();
    assert.equal(oldSessionBody, null, "o token anterior à troca de senha deve ser inválido");

    const newLogin = await auth.handler(
      jsonRequest("/sign-in/email", {
        email: "maria@example.test",
        password: changedPassword,
      }),
    );
    assert.equal(newLogin.status, 200);
    const newCookie = sessionCookie(newLogin);
    assert.notEqual(newCookie, oldCookie);

    const legacyUserId = "50000000-0000-4000-8000-000000000005";
    await admin.query(
      `insert into users (id, name, email, email_verified)
       values ($1, 'Usuário legado', 'legacy@example.test', true)`,
      [legacyUserId],
    );
    await admin.query(
      `insert into accounts (id, account_id, provider_id, user_id, password)
       values ('legacy-credential-account', $1, 'credential', $1, $2)`,
      [legacyUserId, hashSync(legacyPassword, 4)],
    );
    const legacyLogin = await auth.handler(
      jsonRequest("/sign-in/email", {
        email: "legacy@example.test",
        password: legacyPassword,
      }),
    );
    assert.equal(legacyLogin.status, 200, "hash bcrypt importado deve autenticar");

    const sessions = await admin.query<{ count: string }>(
      "select count(*)::text as count from sessions where user_id = $1",
      [legacyUserId],
    );
    assert.equal(sessions.rows[0]?.count, "1");
  } finally {
    setEmailAdapterForTests(undefined);
    setDatabaseForTests(undefined);
    await pool.end();
    await admin.end();
  }

  console.log("Better Auth, tenant pessoal, cookie, bcrypt/scrypt e rotação de sessão: OK");
}

await main();
