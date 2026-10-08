import { describe, expect, it } from "vitest";

import {
  isAuthenticationError,
  ServerFnEnvelopeError,
  unwrapServerFn,
  unwrapServerFnResult,
} from "@/lib/server-fn-envelope";

function envelopeWith(code: string): unknown {
  return {
    ok: false,
    error: {
      code,
      message: "Faça login para continuar.",
      retryable: false,
      correlationId: "1ec94d13-c484-436e-9547-76bf18eb6a71",
    },
  };
}

describe("server-fn envelope guard (DBT-86)", () => {
  it("throws a typed error for an ok:false envelope, preserving code, message and correlation id", () => {
    let caught: unknown;
    try {
      unwrapServerFnResult<{ sales: { count: number } }>(envelopeWith("AUTHENTICATION_ERROR"));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ServerFnEnvelopeError);
    const envelopeError = caught as ServerFnEnvelopeError;
    expect(envelopeError.code).toBe("AUTHENTICATION_ERROR");
    expect(envelopeError.status).toBe(401);
    expect(envelopeError.message).toBe("Faça login para continuar.");
    expect(envelopeError.correlationId).toBe("1ec94d13-c484-436e-9547-76bf18eb6a71");
  });

  it("preserves the code for every failure class that reaches the client", () => {
    for (const code of [
      "AUTHORIZATION_ERROR",
      "VALIDATION_ERROR",
      "RATE_LIMIT",
      "INTERNAL_ERROR",
    ]) {
      try {
        unwrapServerFnResult(envelopeWith(code));
        expect.unreachable(`${code} should have thrown`);
      } catch (error) {
        expect(error).toBeInstanceOf(ServerFnEnvelopeError);
        expect((error as ServerFnEnvelopeError).code).toBe(code);
      }
    }
  });

  it("throws fail-closed even for a malformed ok:false envelope without usable error fields", () => {
    expect(() => unwrapServerFnResult({ ok: false })).toThrow(ServerFnEnvelopeError);
  });

  it("returns success payloads untouched (identity, not a copy)", () => {
    const summary = {
      productCount: 2,
      fixedExpenses: "600.0000",
      alerts: [],
      sales: { revenue: "50.0000", count: 1 },
    };
    expect(unwrapServerFnResult(summary)).toBe(summary);
  });

  it("passes through null, primitives and arrays that are not envelopes", () => {
    expect(unwrapServerFnResult(null)).toBe(null);
    expect(unwrapServerFnResult("ok")).toBe("ok");
    expect(unwrapServerFnResult(42)).toBe(42);
    const list = [1, 2, 3];
    expect(unwrapServerFnResult(list)).toBe(list);
  });

  it("does not mistake an ok:false-looking domain object without error field... but always throws on ok:false", () => {
    // Any payload carrying ok:false is a failure envelope on the wire; a
    // success object in this application never has ok:false.
    expect(() => unwrapServerFnResult({ ok: false, reason: "x" })).toThrow(ServerFnEnvelopeError);
  });

  it("unwrapServerFn rejects with the typed error and resolves with the payload", async () => {
    await expect(
      unwrapServerFn(Promise.resolve(envelopeWith("AUTHENTICATION_ERROR"))),
    ).rejects.toBeInstanceOf(ServerFnEnvelopeError);
    await expect(unwrapServerFn(Promise.resolve({ value: 1 }))).resolves.toEqual({ value: 1 });
  });

  it("isAuthenticationError matches only the authentication code", () => {
    let authError: unknown;
    try {
      unwrapServerFnResult(envelopeWith("AUTHENTICATION_ERROR"));
    } catch (error) {
      authError = error;
    }
    let forbiddenError: unknown;
    try {
      unwrapServerFnResult(envelopeWith("AUTHORIZATION_ERROR"));
    } catch (error) {
      forbiddenError = error;
    }
    expect(isAuthenticationError(authError)).toBe(true);
    expect(isAuthenticationError(forbiddenError)).toBe(false);
    expect(isAuthenticationError(new Error("x"))).toBe(false);
    expect(isAuthenticationError(null)).toBe(false);
  });
});
