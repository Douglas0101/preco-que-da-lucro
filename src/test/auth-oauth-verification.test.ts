// Bypass de verificação no caminho OAuth.
//
// `commit 75da106` (DBT-129) fechou a classe "usuário persistido sem
// possibilidade de verificação" **apenas** para `/sign-up/email`. O caminho
// OAuth continuava aberto: o provider Google era montado sem
// `requireEmailVerification`, o Better Auth criava o usuário ANTES de
// qualquer checagem (`node_modules/better-auth/dist/oauth2/link-account.mjs:220-235`),
// a falha de envio de verificação era engolida (`:300-302`) e a sessão era
// emitida em `:268` mesmo com `emailVerified !== true`.
//
// Este arquivo prova o caminho real (endpoint HTTP + Postgres efêmero):
//   - e-mail NÃO verificado pelo provider + serviço de e-mail sem
//     credencial  => nenhuma sessão, nenhum usuário persistido, recusa
//     `EMAIL_NOT_CONFIGURED`;
//   - e-mail NÃO verificado pelo provider + verificação entregável =>
//     o usuário é criado, a sessão NÃO é;
//   - e-mail verificado pelo provider => a sessão é emitida (login legítimo
//     continua funcionando).
// Shim de ambiente (não de produção). O repositório roda os testes no `jsdom`,
// que é um realm separado: o `TextEncoder` global é o do Node (realm de fora),
// mas o `jose` — avaliado dentro do contexto do teste — compara a chave com o
// `Uint8Array` do realm de dentro. O `instanceof` falha e a assinatura do token
// de verificação estoura ("Key for the HS256 algorithm must be one of type
// CryptoKey, KeyObject, JSON Web Key, or Uint8Array. Received an instance of
// Uint8Array"). O runtime de produção é Node (um realm só), e é ele que este
// arquivo precisa exercitar: o shim abaixo devolve o `Uint8Array` no realm em
// que o `jose` roda, que é exatamente o que o Node faria.
import { TextEncoder as NodeTextEncoder } from "node:util";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { setDatabaseForTests, type Database } from "@/db/client.server";
import { createAuthInstance } from "@/server/auth/auth.server";
import {
  EMAIL_NOT_CONFIGURED_CODE,
  EMAIL_VERIFICATION_NOT_CONFIGURED_MESSAGE,
} from "@/server/auth/email-signup-guard.server";
import {
  setEmailAdapterForTests,
  type AuthEmailMessage,
  type TransactionalEmailAdapter,
} from "@/server/email/email-adapter.server";
import { runMigrations } from "../../scripts/db/migrate";
import { dbPrecondition, skipLabel } from "./helpers/db-precondition";

/**
 * `TextEncoder` que devolve o `Uint8Array` no realm em que o `jose` roda.
 * `NodeTextEncoder` (realm de fora) continua fazendo a codificação — só o
 * invólucro do array muda de realm. Precisa ser **construtor** (`new
 * TextEncoder()`), porque o `@better-auth/core` calcula o índice das tabelas
 * do adapter com ele.
 */
class RealmTextEncoder {
  encode(input = ""): Uint8Array<ArrayBuffer> {
    return new globalThis.Uint8Array(
      new NodeTextEncoder().encode(input),
    ) as Uint8Array<ArrayBuffer>;
  }

  encodeInto(source: string, destination: Uint8Array): { read: number; written: number } {
    const encoded = this.encode(source);
    destination.set(encoded);
    return { read: source.length, written: encoded.length };
  }
}

globalThis.TextEncoder = RealmTextEncoder as unknown as typeof globalThis.TextEncoder;

const BASE_URL = "http://localhost:3000";
const GOOGLE_CLIENT_ID = "test-google-client-id";
const GOOGLE_CLIENT_SECRET = "test-google-client-secret";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const dbGate = dbPrecondition();
if (!dbGate.enabled) console.log(skipLabel(dbGate.motivo));
const dbDescribe = dbGate.enabled ? describe : describe.skip;

class CapturingEmailAdapter implements TransactionalEmailAdapter {
  verification?: AuthEmailMessage;

  async sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    this.verification = message;
  }

  async sendPasswordReset(): Promise<void> {
    throw new Error("recuperação de senha não é exercitada neste arquivo");
  }
}

/**
 * `id_token` sem assinatura: o fluxo de authorization-code do Google decodifica
 * o id_token (`@better-auth/core/dist/social-providers/google.mjs`,
 * `getUserInfo`) sem verificar a assinatura — a token vem do endpoint de token
 * do provider, por TLS. O que interessa aqui é a **afirmação** do provider
 * (`email_verified`), que é exatamente o que o bypass explorava.
 */
function fakeIdToken(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: "https://accounts.google.com",
    aud: GOOGLE_CLIENT_ID,
    iat: now,
    exp: now + 3600,
    ...payload,
  })}.assinatura-de-teste`;
}

function cookiesOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0] ?? "")
    .filter(Boolean)
    .join("; ");
}

dbDescribe("OAuth — e-mail não verificado pelo provider não abre sessão", () => {
  const admin = new Client({ connectionString: adminUrl ?? "" });
  const pool = new Pool({ connectionString: adminUrl ?? "", max: 2 });
  const originalEnv = new Map<string, string | undefined>();
  const originalFetch = globalThis.fetch;
  let auth: ReturnType<typeof createAuthInstance>;
  let adapter: CapturingEmailAdapter;

  function setEnv(name: string, value: string | undefined): void {
    if (!originalEnv.has(name)) originalEnv.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  /** Intercepta a troca de código por token; qualquer outra saída é erro. */
  function stubProviderFetch(emailVerified: boolean, email: string): void {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(TOKEN_ENDPOINT)) {
        return new Response(
          JSON.stringify({
            access_token: "access-token-de-teste",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "email profile openid",
            id_token: fakeIdToken({
              sub: `sub-${email}`,
              email,
              email_verified: emailVerified,
              name: "Usuário OAuth",
              picture: "https://example.test/avatar.png",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`rede externa bloqueada no teste OAuth: ${url}`);
    }) as typeof fetch;
  }

  /**
   * Percorre o fluxo OAuth real: `/sign-in/social` (que cria o state) e
   * `/callback/google` (que troca o código, resolve o perfil do provider,
   * decide sobre o usuário e emite a sessão).
   */
  async function runOAuthCallback(options: {
    emailVerified: boolean;
    email: string;
    ip: string;
  }): Promise<Response> {
    stubProviderFetch(options.emailVerified, options.email);
    const signIn = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE_URL,
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": options.ip,
        },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/apos-login",
          disableRedirect: true,
        }),
      }),
    );
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { url?: string };
    expect(body.url).toBeTruthy();
    const state = new URL(body.url as string).searchParams.get("state");
    expect(state).toBeTruthy();
    const cookie = cookiesOf(signIn);
    expect(cookie).toContain("state=");

    return auth.handler(
      new Request(
        `${BASE_URL}/api/auth/callback/google?code=codigo-de-teste&state=${encodeURIComponent(state as string)}`,
        { method: "GET", headers: { cookie, "x-forwarded-for": options.ip } },
      ),
    );
  }

  async function countUsers(email: string): Promise<number> {
    const result = await admin.query<{ count: string }>(
      "select count(*)::text as count from users where email = $1",
      [email],
    );
    return Number(result.rows[0]?.count ?? "0");
  }

  async function countSessions(userId: string): Promise<number> {
    const result = await admin.query<{ count: string }>(
      "select count(*)::text as count from sessions where user_id = $1",
      [userId],
    );
    return Number(result.rows[0]?.count ?? "0");
  }

  beforeAll(async () => {
    await runMigrations(adminUrl);
    await admin.connect();
    setEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
    setEnv("BETTER_AUTH_URL", BASE_URL);
    setEnv("AUTH_TRUSTED_ORIGINS", BASE_URL);
    setEnv("GOOGLE_CLIENT_ID", GOOGLE_CLIENT_ID);
    setEnv("GOOGLE_CLIENT_SECRET", GOOGLE_CLIENT_SECRET);
    const database = drizzle({ client: pool, schema });
    setDatabaseForTests(database as unknown as Database);
    adapter = new CapturingEmailAdapter();
    setEmailAdapterForTests(adapter);
    auth = createAuthInstance(database as unknown as Database);
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    setEmailAdapterForTests(undefined);
    setDatabaseForTests(undefined);
    for (const [name, value] of originalEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await admin.query("delete from users where email like $1", ["oauth.%@example.test"]);
    await admin.query(
      "delete from tenants t where t.kind = 'personal' and not exists (select 1 from tenant_memberships m where m.tenant_id = t.id)",
    );
    await admin.query("delete from rate_limits where key like '198.51.100.8%'");
    await admin.end();
    await pool.end();
  });

  it("NÃO verificado + e-mail sem credencial: nenhuma sessão, nenhum usuário, recusa nomeada", async () => {
    setEnv("RESEND_API_KEY", "");
    setEnv("AUTH_EMAIL_FROM", "");
    const email = "oauth.sem-credencial@example.test";

    const response = await runOAuthCallback({ emailVerified: false, email, ip: "198.51.100.81" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    // O callback OAuth é um redirecionamento por natureza: a recusa viaja no
    // canal de erro do provider (`?error=` + `?error_description=`), com o
    // mesmo código `EMAIL_NOT_CONFIGURED` do guard de e-mail.
    const expected = new URL(`${BASE_URL}/api/auth/error`);
    expected.searchParams.set("error", EMAIL_NOT_CONFIGURED_CODE);
    expected.searchParams.set("error_description", EMAIL_VERIFICATION_NOT_CONFIGURED_MESSAGE);
    expect(location).toBe(expected.toString());
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    expect(await countUsers(email)).toBe(0);
    expect(adapter.verification).toBeUndefined();
  });

  it("NÃO verificado + verificação entregável: o usuário é criado, a sessão NÃO", async () => {
    setEnv("RESEND_API_KEY", "re_chave_de_teste");
    setEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.test>");
    const email = "oauth.nao-verificado@example.test";

    const response = await runOAuthCallback({ emailVerified: false, email, ip: "198.51.100.82" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("error=email_not_verified");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    expect(await countUsers(email)).toBe(1);
    const user = await admin.query<{ id: string; email_verified: boolean }>(
      "select id, email_verified from users where email = $1",
      [email],
    );
    expect(user.rows[0]?.email_verified).toBe(false);
    expect(await countSessions(user.rows[0]?.id as string)).toBe(0);
    expect(adapter.verification?.to).toBe(email);
  });

  it("verificado pelo provider: a sessão é emitida (login legítimo continua)", async () => {
    setEnv("RESEND_API_KEY", "re_chave_de_teste");
    setEnv("AUTH_EMAIL_FROM", "Preço que Dá Lucro <auth@example.test>");
    const email = "oauth.verificado@example.test";

    const response = await runOAuthCallback({ emailVerified: true, email, ip: "198.51.100.83" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/apos-login");
    expect(location).not.toContain("error=");
    expect(response.headers.get("set-cookie") ?? "").toContain("session_token=");
    expect(await countUsers(email)).toBe(1);
    const user = await admin.query<{ id: string; email_verified: boolean }>(
      "select id, email_verified from users where email = $1",
      [email],
    );
    expect(user.rows[0]?.email_verified).toBe(true);
    expect(await countSessions(user.rows[0]?.id as string)).toBe(1);
  });
});
