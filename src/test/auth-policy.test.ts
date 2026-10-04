import { hashSync } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import {
  authEnvPresence,
  describeAuthEnv,
  requireAuthSecret,
  resolveAuthPolicy,
  resolveGoogleCredentials,
} from "@/server/auth/auth-policy";
import {
  hashPassword,
  PasswordVerificationError,
  verifyPassword,
} from "@/server/auth/password.server";

describe("Better Auth policy", () => {
  it("uses a __Host cookie only on HTTPS production", () => {
    const policy = resolveAuthPolicy({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://app.example.com",
      AUTH_TRUSTED_ORIGINS: "https://admin.example.com",
    });
    expect(policy).toMatchObject({
      secureCookies: true,
      sessionCookieName: "__Host-preco_que_da_lucro.session_token",
      trustedOrigins: ["https://app.example.com", "https://admin.example.com"],
    });
  });

  it("uses a host-only non-Secure name for local HTTP", () => {
    const policy = resolveAuthPolicy({ NODE_ENV: "development" });
    expect(policy.secureCookies).toBe(false);
    expect(policy.sessionCookieName.startsWith("__Host-")).toBe(false);
    expect(policy.trustedOrigins).toContain("http://localhost:3000");
    expect(policy.trustedOrigins).toContain("http://127.0.0.1:4173");
  });

  it("rejects non-HTTPS remote origins and partial Google credentials", () => {
    expect(() =>
      resolveAuthPolicy({ NODE_ENV: "production", BETTER_AUTH_URL: "http://app.example.com" }),
    ).toThrow(/HTTPS/);
    expect(() => resolveGoogleCredentials({ GOOGLE_CLIENT_ID: "client" })).toThrow(/juntos/);
  });

  it("returns the Google credential pair together and undefined when absent", () => {
    expect(
      resolveGoogleCredentials({
        GOOGLE_CLIENT_ID: "client",
        GOOGLE_CLIENT_SECRET: "client-secret",
      }),
    ).toEqual({ clientId: "client", clientSecret: "client-secret" });
    expect(resolveGoogleCredentials({})).toBeUndefined();
  });

  it("requires a sufficiently strong server secret", () => {
    expect(() => requireAuthSecret({ BETTER_AUTH_SECRET: "short" })).toThrow(/32/);
    expect(requireAuthSecret({ BETTER_AUTH_SECRET: "x".repeat(32) })).toHaveLength(32);
  });
});

// Valores de fixture compostos por fragmentos: sentinelas de teste, nunca credenciais reais.
const strongSecret = ["preflight", "secret", "0123456789", "abcdef", "0123456789"].join("-");

describe("pré-voo de ambiente de autenticação (§13.6)", () => {
  const entry = (env: ReturnType<typeof describeAuthEnv>, name: string) =>
    env.find((item) => item.name === name);

  it("classifica presença sem tratar vazio como presente", () => {
    expect(authEnvPresence(undefined)).toBe("absent");
    expect(authEnvPresence("   ")).toBe("empty");
    expect(authEnvPresence("valor")).toBe("present");
  });

  it("declara tudo ok em produção com origens e par Google completos", () => {
    const env = describeAuthEnv({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://app.example.com",
      AUTH_TRUSTED_ORIGINS: "https://a.example.com, https://b.example.com",
      BETTER_AUTH_SECRET: strongSecret,
      GOOGLE_CLIENT_ID: ["client", "id"].join("-"),
      GOOGLE_CLIENT_SECRET: ["client", "secret"].join("-"),
    });
    expect(env.find((item) => item.name === "BETTER_AUTH_URL")).toMatchObject({
      presence: "present",
      requirement: "required-in-production",
      verdict: "ok",
      detail: "origem aceita pela política",
    });
    expect(entry(env, "AUTH_TRUSTED_ORIGINS")).toMatchObject({
      presence: "present",
      requirement: "optional",
      verdict: "ok",
      detail: "2 origem(ns) válida(s)",
    });
    expect(entry(env, "BETTER_AUTH_SECRET")).toMatchObject({
      presence: "present",
      requirement: "required",
      verdict: "ok",
      detail: "mínimo de 32 caracteres atendido",
    });
    for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      expect(entry(env, name)).toMatchObject({
        presence: "present",
        requirement: "optional-pair",
        verdict: "ok",
        detail: "par completo (id e segredo presentes)",
      });
    }
  });

  it("exige BETTER_AUTH_URL em produção e a trata como não configurada fora dela", () => {
    const production = describeAuthEnv({
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: strongSecret,
    });
    expect(entry(production, "BETTER_AUTH_URL")).toMatchObject({
      presence: "absent",
      verdict: "missing",
      detail: "obrigatória em produção",
    });
    const local = describeAuthEnv({ NODE_ENV: "development" });
    expect(entry(local, "BETTER_AUTH_URL")).toMatchObject({
      presence: "absent",
      verdict: "not-configured",
      detail: "ausente fora de produção",
    });
  });

  it("repudia origem inválida com a mensagem nomeada da política", () => {
    const env = describeAuthEnv({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://app.example.com",
      BETTER_AUTH_SECRET: strongSecret,
    });
    expect(entry(env, "BETTER_AUTH_URL")).toMatchObject({
      presence: "present",
      verdict: "invalid",
      detail: "BETTER_AUTH_URL deve usar HTTPS fora do ambiente local",
    });
    const withPath = describeAuthEnv({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://app.example.com/app",
      BETTER_AUTH_SECRET: strongSecret,
    });
    expect(entry(withPath, "BETTER_AUTH_URL")).toMatchObject({
      verdict: "invalid",
      detail: "BETTER_AUTH_URL deve conter somente a origem, sem path, credencial ou query",
    });
  });

  it("aceita origem local HTTP e recusa lista de origens com item inválido", () => {
    const env = describeAuthEnv({
      BETTER_AUTH_URL: "http://localhost:3000",
      AUTH_TRUSTED_ORIGINS: "https://a.example.com,notaurl",
    });
    expect(entry(env, "BETTER_AUTH_URL")).toMatchObject({ verdict: "ok" });
    expect(entry(env, "AUTH_TRUSTED_ORIGINS")).toMatchObject({
      presence: "present",
      verdict: "invalid",
      detail: "AUTH_TRUSTED_ORIGINS contém uma URL inválida",
    });
  });

  it("trata lista de origens vazia como não configurada, não como ok", () => {
    const env = describeAuthEnv({ AUTH_TRUSTED_ORIGINS: "  ,  " });
    expect(entry(env, "AUTH_TRUSTED_ORIGINS")).toMatchObject({
      presence: "present",
      verdict: "not-configured",
      detail: "lista vazia; baseURL entra automaticamente",
    });
  });

  it("distingue segredo ausente de segredo curto", () => {
    const missing = describeAuthEnv({ NODE_ENV: "production" });
    expect(entry(missing, "BETTER_AUTH_SECRET")).toMatchObject({
      presence: "absent",
      verdict: "missing",
      detail: "obrigatória",
    });
    const empty = describeAuthEnv({ BETTER_AUTH_SECRET: "   " });
    expect(entry(empty, "BETTER_AUTH_SECRET")).toMatchObject({
      presence: "empty",
      verdict: "missing",
      detail: "obrigatória",
    });
    const short = describeAuthEnv({ BETTER_AUTH_SECRET: "curto" });
    expect(entry(short, "BETTER_AUTH_SECRET")).toMatchObject({
      presence: "present",
      verdict: "invalid",
      detail: "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres",
    });
  });

  it("marca o par Google como incompleto só com metade e desativado sem nenhum", () => {
    const half = describeAuthEnv({ GOOGLE_CLIENT_ID: ["client", "id"].join("-") });
    expect(entry(half, "GOOGLE_CLIENT_ID")).toMatchObject({
      presence: "present",
      requirement: "optional-pair",
      verdict: "incomplete",
      detail: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser configurados juntos",
    });
    expect(entry(half, "GOOGLE_CLIENT_SECRET")).toMatchObject({
      presence: "absent",
      requirement: "optional-pair",
      verdict: "incomplete",
      detail: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser configurados juntos",
    });
    const absent = describeAuthEnv({});
    for (const name of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      expect(entry(absent, name)).toMatchObject({
        presence: "absent",
        verdict: "not-configured",
        detail: "provider Google desativado",
      });
    }
  });
});

describe("password migration", () => {
  const legacyPassword = ["senha", "legada", "segura"].join("-");
  const newPassword = ["senha", "nova", "segura"].join("-");
  const wrongPassword = ["incor", "reta"].join("");

  it("accepts imported bcrypt hashes", async () => {
    const hash = hashSync(legacyPassword, 4);
    await expect(verifyPassword({ hash, password: legacyPassword })).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: wrongPassword })).resolves.toBe(false);
  });

  it("writes and verifies new passwords with scrypt", async () => {
    const hash = await hashPassword(newPassword);
    expect(hash.startsWith("$2")).toBe(false);
    await expect(verifyPassword({ hash, password: newPassword })).resolves.toBe(true);
    await expect(verifyPassword({ hash, password: wrongPassword })).resolves.toBe(false);
  });

  // CONTRATO ALTERADO (DBT-26), AUTORIZADO.
  //
  // Até DBT-26 esta asserção fixava `hash: "unknown"` → `false`, e ao fazê-lo
  // codificava o defeito: uma exceção de verificador era indistinguível de
  // "o usuário digitou a senha errada". O caso NÃO foi removido nem afrouxado —
  // o veredito mudou de "senha errada" para "não foi possível verificar", que
  // agora LANÇA `PasswordVerificationError` com código `unusable-hash`.
  //
  // Autorização: docs/sdd/SDD-20260925-contract-guard/MAESTRO-REQUEST-DBT-26.md
  // (§6, correção autorizada com taxonomia baseada em evidência).
  //
  // Fail-closed PRESERVADO: nenhum acesso é concedido. O `throw` sobe pelo
  // guarda de sign-in do better-auth, que não o captura — é o ramo NEGADO,
  // nunca o ramo que cria a sessão.
  it("DBT-26: hash desconhecido agora LANÇA (contrato alterado, autorizado) e segue fail-closed", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(verifyPassword({ hash: "unknown", password: "senha" })).rejects.toBeInstanceOf(
        PasswordVerificationError,
      );
      // O sinal estruturado faz parte do contrato novo, não é efeito colateral.
      expect(String(logged.mock.calls[0]?.[0])).toContain("auth.password.verify.failed");
    } finally {
      logged.mockRestore();
    }

    // `false` continua reservado à única coisa que ele significa: senha errada.
    const hash = hashSync("senha-legada-segura", 4);
    await expect(verifyPassword({ hash, password: "outra-senha" })).resolves.toBe(false);
  });
});
