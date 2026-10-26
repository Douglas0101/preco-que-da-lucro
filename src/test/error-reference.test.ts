import { describe, expect, it } from "vitest";

import { createErrorReference } from "@/lib/error-reference";
import { ServerFnEnvelopeError } from "@/lib/server-fn-envelope";

describe("createErrorReference", () => {
  it("deriva a referência do correlationId do envelope (mesmo id do log)", () => {
    const error = new ServerFnEnvelopeError({
      code: "INTERNAL_ERROR",
      correlationId: "08612561-2bb0-4548-9265-c98fee33390a",
    });
    expect(createErrorReference("DASH", error)).toBe("DASH-08612561");
  });

  it("usa o ApiError interno quando o wrapper lança o objeto plano", () => {
    expect(
      createErrorReference("VND", { code: "INTERNAL_ERROR", correlationId: "abc12345-..." }),
    ).toBe("VND-ABC12345");
  });

  it("usa o header x-correlation-id de um Response", () => {
    const response = new Response(null, {
      status: 503,
      headers: { "x-correlation-id": "f9e35f8d-05d4-4643-95b3-c9ccee08c253" },
    });
    expect(createErrorReference("SIM", response)).toBe("SIM-F9E35F8D");
  });

  it("usa o prefixo e um token aleatório quando não há correlação", () => {
    expect(createErrorReference("DIAG")).toMatch(/^DIAG-[A-Z0-9]{6,}$/);
    expect(createErrorReference("DIAG", { correlationId: "UNKNOWN" })).toMatch(
      /^DIAG-[A-Z0-9]{6,}$/,
    );
  });
});
