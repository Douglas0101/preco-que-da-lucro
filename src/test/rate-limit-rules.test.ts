import { describe, expect, it } from "vitest";
import { AUTH_RATE_LIMIT_RULES } from "@/server/auth/rate-limit-rules.server";

/** Mirrors Better Auth's default special rules (api/rate-limiter) for comparison. */
const DEFAULT_SPECIAL_RULES: Array<{
  matches: (path: string) => boolean;
  window: number;
  max: number;
}> = [
  {
    matches: (path) =>
      path.startsWith("/sign-in") ||
      path.startsWith("/sign-up") ||
      path.startsWith("/change-password") ||
      path.startsWith("/change-email"),
    window: 10,
    max: 3,
  },
  {
    matches: (path) =>
      path === "/request-password-reset" ||
      path === "/send-verification-email" ||
      path.startsWith("/forget-password") ||
      path === "/email-otp/send-verification-otp" ||
      path === "/email-otp/request-password-reset",
    window: 60,
    max: 3,
  },
];

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

describe("AUTH_RATE_LIMIT_RULES", () => {
  it("cobre login, cadastro e fluxo de reset de senha", () => {
    expect(Object.keys(AUTH_RATE_LIMIT_RULES)).toEqual(
      expect.arrayContaining([
        "/sign-in/email",
        "/sign-up/email",
        "/forget-password*",
        "/reset-password",
      ]),
    );
  });

  it("login é mais restritivo que a regra padrão do Better Auth por minuto", () => {
    const rule = AUTH_RATE_LIMIT_RULES["/sign-in/email"];
    const defaultPerMinute = (DEFAULT_SPECIAL_RULES[0].max / DEFAULT_SPECIAL_RULES[0].window) * 60;
    expect(rule.max / (rule.window / 60)).toBeLessThan(defaultPerMinute);
  });

  it("pedido de reset de senha tem janela longa e limite baixo", () => {
    const rule = AUTH_RATE_LIMIT_RULES["/forget-password*"];
    expect(rule.window).toBeGreaterThanOrEqual(300);
    expect(rule.max).toBeLessThanOrEqual(5);
  });

  it("todas as regras têm janela positiva e limite positivo", () => {
    for (const [path, rule] of Object.entries(AUTH_RATE_LIMIT_RULES)) {
      expect(rule.window, path).toBeGreaterThan(0);
      expect(rule.max, path).toBeGreaterThan(0);
      expect(Number.isFinite(rule.window), path).toBe(true);
      expect(Number.isFinite(rule.max), path).toBe(true);
    }
  });

  it("padrões wildcard casam com os caminhos reais do Better Auth", () => {
    const forgetPattern = AUTH_RATE_LIMIT_RULES["/forget-password*"];
    const matcher = wildcardToRegExp("/forget-password*");
    expect(matcher.test("/forget-password")).toBe(true);
    expect(matcher.test("/forget-password/callback")).toBe(true);
    expect(forgetPattern.max).toBe(3);
  });
});
