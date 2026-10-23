import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import {
  EMAIL_NOT_CONFIGURED_CODE,
  EMAIL_NOT_CONFIGURED_MESSAGE,
  assertEmailSignUpReady,
} from "@/server/auth/email-signup-guard.server";
import { missingEmailCredentials } from "@/server/email/email-adapter.server";

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
});
