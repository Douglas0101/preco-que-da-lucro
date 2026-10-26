// Shim de ambiente (não de produção).
//
// O repositório roda os testes no `jsdom`, que é um realm separado: o
// `TextEncoder` global é o do Node (realm de fora), mas o `jose` — avaliado
// dentro do contexto do teste — compara a chave com o `Uint8Array` do realm
// de dentro. O `instanceof` falha e a assinatura do token de verificação
// estoura ("Key for the HS256 algorithm must be one of type CryptoKey,
// KeyObject, JSON Web Key, or Uint8Array. Received an instance of
// Uint8Array"). O runtime de produção é Node (um realm só), e é ele que este
// arquivo precisa exercitar: o shim abaixo devolve o `Uint8Array` no realm
// em que o `jose` roda, que é exatamente o que o Node faria.
import { TextEncoder as NodeTextEncoder } from "node:util";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { APIError } from "better-auth/api";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { setDatabaseForTests, type Database } from "@/db/client.server";
import { createAuthInstance } from "@/server/auth/auth.server";
import {
  setEmailAdapterForTests,
  missingEmailCredentials,
  type AuthEmailMessage,
  type TransactionalEmailAdapter,
} from "@/server/email/email-adapter.server";
import {
  EMAIL_NOT_CONFIGURED_CODE,
  EMAIL_NOT_CONFIGURED_MESSAGE,
  assertEmailSignUpReady,
} from "@/server/auth/email-signup-guard.server";
import { authEnvPresence } from "@/server/auth/auth-policy";
import { ensureRuntimeRoleMembership, runMigrations } from "../../scripts/db/migrate";
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

const configured = {
  RESEND_API_KEY: "re_chave_de_teste",
  AUTH_EMAIL_FROM: "Preço que Dá Lucro <auth@example.test>",
} as const;

function captureGuardError(environment: Readonly<Record<string, string | undefined>>): APIError {
  try {
    assertEmailSignUpReady(environment);
  } catch (error) {
    if (error instanceof APIError) return error;
    throw error;
  }
  throw new Error("assertEmailSignUpReady should have thrown");
}

describe("cadastro por e-mail — falha antes de criar conta sem verificação", () => {
  it("não bloqueia quando o par de credenciais está presente", () => {
    expect(() => assertEmailSignUpReady(configured)).not.toThrow();
  });

  it("nomeia o estado de cada credencial ausente ou vazia", () => {
    expect(
      missingEmailCredentials({
        RESEND_API_KEY: "",
        AUTH_EMAIL_FROM: "   ",
      }),
    ).toEqual(["RESEND_API_KEY (definida e vazia)", "AUTH_EMAIL_FROM (definida e vazia)"]);
    expect(missingEmailCredentials({})).toEqual([
      "RESEND_API_KEY (ausente)",
      "AUTH_EMAIL_FROM (ausente)",
    ]);
  });

  it.each([
    ["RESEND_API_KEY vazia", { ...configured, RESEND_API_KEY: "" }],
    ["AUTH_EMAIL_FROM vazia", { ...configured, AUTH_EMAIL_FROM: "" }],
    ["par com apenas espaços", { RESEND_API_KEY: "   ", AUTH_EMAIL_FROM: "\t " }],
    ["par ausente", {}],
  ])("retorna 503 EMAIL_NOT_CONFIGURED quando %s", (_label, environment) => {
    const error = captureGuardError(environment);
    expect(error.status).toBe("SERVICE_UNAVAILABLE");
    expect(error.statusCode).toBe(503);
    expect(error.body).toMatchObject({ code: EMAIL_NOT_CONFIGURED_CODE });
    expect(error.message).toBe(EMAIL_NOT_CONFIGURED_MESSAGE);
  });

  it("não vaza chave nem remetente na resposta ao cliente", () => {
    const error = captureGuardError({ ...configured, RESEND_API_KEY: "" });
    const serialized = JSON.stringify({ message: error.message, body: error.body });
    expect(serialized).not.toContain(configured.RESEND_API_KEY);
    expect(serialized).not.toContain(configured.AUTH_EMAIL_FROM);
  });

  // Tarefa 3c: a credencial DEFINIDA E VAZIA e a AUSENTE são o mesmo estado de
  // bloqueio. A taxonomia de presença é a de `authEnvPresence`
  // (`src/server/auth/auth-policy.ts:94-97`) — não há detector paralelo: quem
  // distingue "vazia" de "ausente" é a presença, e o veredito é o mesmo.
  it("trata credencial definida e vazia como ausente (mesmo veredito, mesma taxonomia)", () => {
    const vazia = captureGuardError({ ...configured, RESEND_API_KEY: "" });
    const ausente = captureGuardError({ ...configured, RESEND_API_KEY: undefined });
    expect(vazia.statusCode).toBe(ausente.statusCode);
    expect(vazia.status).toBe(ausente.status);
    expect(vazia.body).toEqual(ausente.body);
    expect(vazia.message).toBe(ausente.message);
    expect(authEnvPresence("")).toBe("empty");
    expect(authEnvPresence(undefined)).toBe("absent");
    expect(missingEmailCredentials({ ...configured, RESEND_API_KEY: "" })).toEqual([
      "RESEND_API_KEY (definida e vazia)",
    ]);
    expect(missingEmailCredentials({ ...configured, RESEND_API_KEY: undefined })).toEqual([
      "RESEND_API_KEY (ausente)",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Wiring real: o endpoint HTTP de cadastro, com a contagem de usuários.
//
// A função pura acima prova a decisão; este bloco prova o **cabo**: que o hook
// `before` roda antes de qualquer persistência e que o endpoint real devolve
// 503 sem deixar usuário órfão. Sem Postgres não há como medir "0 usuários
// persistidos" — o bloco é pulado com rótulo nomeado, nunca verde por
// ausência de prova.
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";
const SIGNUP_IP = "198.51.100.71";
const adminUrl = process.env.DATABASE_ADMIN_URL;
const dbGate = dbPrecondition();
if (!dbGate.enabled) console.log(skipLabel(dbGate.motivo));
const dbDescribe = dbGate.enabled ? describe : describe.skip;

class CapturingEmailAdapter implements TransactionalEmailAdapter {
  verification?: AuthEmailMessage;

  async sendEmailVerification(message: AuthEmailMessage): Promise<void> {
    this.verification = message;
  }

  async sendPasswordReset(message: AuthEmailMessage): Promise<void> {
    throw new Error("recuperação de senha não é exercitada neste bloco");
  }
}

function signUpRequest(email: string): Request {
  return new Request(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": SIGNUP_IP,
    },
    body: JSON.stringify({
      name: "Guarda E-mail",
      email,
      password: ["senha", "de", "teste", "segura"].join("-"),
    }),
  });
}

dbDescribe("cadastro por e-mail — wiring do hook (endpoint real, PG efêmero)", () => {
  const admin = new Client({ connectionString: adminUrl ?? "" });
  const pool = new Pool({ connectionString: adminUrl ?? "", max: 2 });
  const email = "guard.wiring@example.test";
  const originalEnv = new Map<string, string | undefined>();
  let auth: ReturnType<typeof createAuthInstance>;
  let adapter: CapturingEmailAdapter;

  function setEnv(name: string, value: string | undefined): void {
    if (!originalEnv.has(name)) originalEnv.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  beforeAll(async () => {
    await runMigrations(adminUrl);
    await admin.connect();
    await ensureRuntimeRoleMembership(pool);
    setEnv("BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
    setEnv("BETTER_AUTH_URL", BASE_URL);
    setEnv("AUTH_TRUSTED_ORIGINS", BASE_URL);
    const database = drizzle({ client: pool, schema });
    setDatabaseForTests(database as unknown as Database);
    adapter = new CapturingEmailAdapter();
    setEmailAdapterForTests(adapter);
    auth = createAuthInstance(database as unknown as Database);
  });

  afterAll(async () => {
    setEmailAdapterForTests(undefined);
    setDatabaseForTests(undefined);
    for (const [name, value] of originalEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await admin.query("delete from users where email = $1", [email]);
    await admin.query(
      "delete from tenants t where t.kind = 'personal' and not exists (select 1 from tenant_memberships m where m.tenant_id = t.id)",
    );
    await admin.query("delete from rate_limits where key like $1", [`${SIGNUP_IP}|%`]);
    await admin.end();
    await pool.end();
  });

  it("503 EMAIL_NOT_CONFIGURED e ZERO usuários persistidos com o par vazio", async () => {
    setEnv("RESEND_API_KEY", "");
    setEnv("AUTH_EMAIL_FROM", "");
    const before = await admin.query<{ count: string }>(
      "select count(*)::text as count from users",
    );

    const response = await auth.handler(signUpRequest(email));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string; message?: string };
    expect(body.code).toBe(EMAIL_NOT_CONFIGURED_CODE);
    expect(body.message).toBe(EMAIL_NOT_CONFIGURED_MESSAGE);
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");

    const after = await admin.query<{ count: string }>("select count(*)::text as count from users");
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    const target = await admin.query<{ count: string }>(
      "select count(*)::text as count from users where email = $1",
      [email],
    );
    expect(target.rows[0]?.count).toBe("0");
    expect(adapter.verification).toBeUndefined();
  });

  it("cadastra quando o par está configurado (o hook não é bloqueio em geral)", async () => {
    setEnv("RESEND_API_KEY", configured.RESEND_API_KEY);
    setEnv("AUTH_EMAIL_FROM", configured.AUTH_EMAIL_FROM);

    const response = await auth.handler(signUpRequest(email));
    expect(response.status).toBe(200);
    expect(adapter.verification?.to).toBe(email);
    const target = await admin.query<{ count: string }>(
      "select count(*)::text as count from users where email = $1",
      [email],
    );
    expect(target.rows[0]?.count).toBe("1");
  });
});
