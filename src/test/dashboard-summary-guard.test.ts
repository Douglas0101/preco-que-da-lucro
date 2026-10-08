import { describe, expect, it } from "vitest";

import { isDashboardSummaryValid } from "@/lib/dashboard-summary-guard";

function validSummary(): Record<string, unknown> {
  return {
    productCount: 2,
    fixedExpenses: "600.0000",
    bestProduct: { name: "Bolo", cmPct: "35.000000" },
    hasInvalidCalculation: false,
    incompleteProductCount: 0,
    alerts: [],
    period: "month",
    sales: { revenue: "50.0000", count: 1 },
    consolidatedMargin: { state: "empty" },
  };
}

describe("dashboard summary shape guard (DBT-86 1.4)", () => {
  it("accepts a complete summary", () => {
    expect(isDashboardSummaryValid(validSummary())).toBe(true);
  });

  it("rejects the error-envelope shape that crashed the ciclo-28 dashboard", () => {
    expect(isDashboardSummaryValid({ ok: false, error: { code: "AUTHENTICATION_ERROR" } })).toBe(
      false,
    );
  });

  it("rejects a partial payload without sales (the crash signature)", () => {
    const partial = validSummary();
    delete partial.sales;
    expect(isDashboardSummaryValid(partial)).toBe(false);
  });

  it("rejects non-object payloads and missing core fields", () => {
    expect(isDashboardSummaryValid(null)).toBe(false);
    expect(isDashboardSummaryValid("summary")).toBe(false);
    for (const field of ["productCount", "alerts", "period", "hasInvalidCalculation"]) {
      const partial = validSummary();
      delete partial[field];
      expect(isDashboardSummaryValid(partial)).toBe(false);
    }
  });

  it("rejects an unknown period and a malformed bestProduct", () => {
    expect(isDashboardSummaryValid({ ...validSummary(), period: "decade" })).toBe(false);
    expect(isDashboardSummaryValid({ ...validSummary(), bestProduct: { name: 1 } })).toBe(false);
  });

  it("accepts every honest consolidatedMargin state and rejects foreign ones", () => {
    expect(
      isDashboardSummaryValid({ ...validSummary(), consolidatedMargin: { state: "empty" } }),
    ).toBe(true);
    expect(
      isDashboardSummaryValid({
        ...validSummary(),
        consolidatedMargin: { state: "ok", valuePct: "46.0000", valueAmount: "23.0000" },
      }),
    ).toBe(true);
    expect(
      isDashboardSummaryValid({
        ...validSummary(),
        consolidatedMargin: { state: "incomplete", incompleteProductCount: 1, zeroRevenue: false },
      }),
    ).toBe(true);
    expect(
      isDashboardSummaryValid({ ...validSummary(), consolidatedMargin: { state: "partial" } }),
    ).toBe(false);
    expect(
      isDashboardSummaryValid({
        ...validSummary(),
        consolidatedMargin: { state: "ok", valuePct: 5 },
      }),
    ).toBe(false);
    expect(isDashboardSummaryValid({ ...validSummary(), consolidatedMargin: null })).toBe(false);
  });

  it("rejects non-finite margins and malformed incomplete reasons", () => {
    for (const value of ["NaN", "Infinity", "", "1e9999", "no value"]) {
      expect(
        isDashboardSummaryValid({
          ...validSummary(),
          consolidatedMargin: { state: "ok", valuePct: value, valueAmount: "23.0000" },
        }),
      ).toBe(false);
    }
    for (const count of [-1, NaN, Infinity, 1.5]) {
      expect(
        isDashboardSummaryValid({
          ...validSummary(),
          consolidatedMargin: {
            state: "incomplete",
            incompleteProductCount: count,
            zeroRevenue: false,
          },
        }),
      ).toBe(false);
    }
    expect(
      isDashboardSummaryValid({
        ...validSummary(),
        consolidatedMargin: {
          state: "incomplete",
          incompleteProductCount: 0,
          zeroRevenue: false,
          salesMismatch: "yes",
        },
      }),
    ).toBe(false);
  });

  it("accepts null bestProduct and null fixedExpenses (legitimate states)", () => {
    expect(isDashboardSummaryValid({ ...validSummary(), bestProduct: null })).toBe(true);
    expect(isDashboardSummaryValid({ ...validSummary(), fixedExpenses: null })).toBe(true);
  });
});
