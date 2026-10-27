import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getDatabase, type Database } from "@/db/client.server";
import * as schema from "@/db/schema";
import { getEmailAdapter } from "@/server/email/email-adapter.server";
import { createPersonalTenantForUser } from "./tenant-bootstrap.server";
import {
  assertEmailSignUpReady,
  assertVerifiableUserCanBePersisted,
} from "./email-signup-guard.server";
import {
  resolveAuthPolicy,
  requireAuthSecret,
  resolveGoogleProviderOptions,
  REQUIRE_EMAIL_VERIFICATION,
} from "./auth-policy";
import { hashPassword, verifyPassword } from "./password.server";
import { createDatabaseRateLimitStorage } from "./rate-limit-storage.server";
import { AUTH_RATE_LIMIT_RULES } from "./rate-limit-rules.server";

export function createAuthInstance(database: Database = getDatabase()) {
  const policy = resolveAuthPolicy();
  const google = resolveGoogleProviderOptions();

  return betterAuth({
    ...(policy.baseURL ? { baseURL: policy.baseURL } : {}),
    basePath: "/api/auth",
    secret: requireAuthSecret(),
    trustedOrigins: policy.trustedOrigins,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      usePlural: true,
      transaction: true,
    }),
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: REQUIRE_EMAIL_VERIFICATION,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      password: { hash: hashPassword, verify: verifyPassword },
      sendResetPassword: async ({ user, url }) => {
        await getEmailAdapter().sendPasswordReset({ to: user.email, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await getEmailAdapter().sendEmailVerification({ to: user.email, url });
      },
    },
    socialProviders: google ? { google } : {},
    databaseHooks: {
      user: {
        create: {
          // Roda ANTES de qualquer escrita (`db/with-hooks.mjs:12-22`): o hook
          // `before` decide, e só depois `adapter.create` grava a linha
          // (`with-hooks.mjs:25-29`). Um `throw` aqui aborta a transação
          // (`link-account.mjs:220` abre a transação que cria o usuário do
          // OAuth) e nada é persistido — é o que impede o usuário órfão sem
          // possibilidade de verificação.
          before: async (user) => {
            assertVerifiableUserCanBePersisted(user.emailVerified);
          },
          after: async (user) => {
            await createPersonalTenantForUser(user);
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === "/sign-up/email" && REQUIRE_EMAIL_VERIFICATION)
          assertEmailSignUpReady();
        if (context.path !== "/change-password") return;
        return {
          context: {
            ...context,
            body: { ...context.body, revokeOtherSessions: true },
          },
        };
      }),
      after: createAuthMiddleware(async (context) => {
        if (context.path !== "/change-password") return;
        if (context.context.returned instanceof APIError) return;
        const userId = context.context.session?.session.userId;
        if (userId) {
          // Password changes invalidate every pre-change token, including the
          // current one. The next login creates a new opaque session.
          await getDatabase().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
        }
      }),
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      // Keep buckets in PostgreSQL and use an explicit atomic consume
      // implementation; the adapter's legacy get/set fallback races on first
      // insert when multiple instances receive the same request burst.
      storage: "database",
      customStorage: createDatabaseRateLimitStorage(database),
      customRules: { ...AUTH_RATE_LIMIT_RULES },
    },
    advanced: {
      useSecureCookies: policy.secureCookies,
      crossSubDomainCookies: { enabled: false },
      cookies: {
        session_token: {
          name: policy.sessionCookieName,
          attributes: {
            httpOnly: true,
            secure: policy.secureCookies,
            sameSite: "lax",
            path: "/",
          },
        },
      },
    },
    telemetry: { enabled: false },
    // Must remain last so server-side Better Auth calls propagate cookies in TanStack Start.
    plugins: [tanstackStartCookies()],
  });
}

let auth: ReturnType<typeof createAuthInstance> | undefined;

export function getAuth(): ReturnType<typeof createAuthInstance> {
  auth ??= createAuthInstance();
  return auth;
}
