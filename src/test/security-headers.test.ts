import { afterEach, describe, expect, it } from "vitest";
import { securityHeaders } from "@/lib/security-headers";

/** Diretivas de fonte (o que efetivamente restringe a página) — congeladas de propósito. */
const SOURCE_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self'",
  "script-src 'self'",
  "connect-src 'self' https:",
];

/** Único acréscimo do §20.1: o canal de coleta, que não autoriza nenhuma origem. */
const REPORTING_DIRECTIVES = ["report-uri /api/csp-report", "report-to csp-endpoint"];

const originalEnforce = process.env.CSP_ENFORCE;

afterEach(() => {
  if (originalEnforce === undefined) delete process.env.CSP_ENFORCE;
  else process.env.CSP_ENFORCE = originalEnforce;
});

describe("política de CSP (§20.1)", () => {
  it("mantém as diretivas de fonte e acrescenta apenas o canal de relatório", () => {
    delete process.env.CSP_ENFORCE;
    const policy = securityHeaders()["content-security-policy-report-only"] ?? "";

    expect(policy.split("; ")).toEqual([...SOURCE_DIRECTIVES, ...REPORTING_DIRECTIVES]);
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("unsafe-eval");
  });

  it("declara o endpoint de coleta no Reporting-Endpoints", () => {
    expect(securityHeaders()["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"');
  });

  it("CSP_ENFORCE=true troca report-only por enforcing sem mudar a política", () => {
    delete process.env.CSP_ENFORCE;
    const reportOnly = securityHeaders()["content-security-policy-report-only"];
    expect(reportOnly).toBeDefined();

    process.env.CSP_ENFORCE = "true";
    const headers = securityHeaders();

    expect(headers["content-security-policy"]).toBe(reportOnly);
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    expect(headers["reporting-endpoints"]).toBe('csp-endpoint="/api/csp-report"');
  });
});
