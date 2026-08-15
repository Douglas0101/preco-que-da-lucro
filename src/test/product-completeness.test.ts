import { describe, expect, it } from "vitest";
import {
  completenessFromCalculation,
  productStatusFromCalculation,
} from "@/server/services/product-completeness";

describe("product completeness", () => {
  it("does not promote incomplete data to ready", () => {
    const result = {
      status: "incomplete" as const,
      missing: [{ field: "yieldQty" }],
      warnings: [],
    };

    expect(productStatusFromCalculation("draft", result)).toBe("incomplete");
    expect(completenessFromCalculation(result)).toEqual(result);
  });

  it("preserves archived and active lifecycle states", () => {
    const result = { status: "ok" as const, value: {}, warnings: [] };

    expect(productStatusFromCalculation("archived", result)).toBe("archived");
    expect(productStatusFromCalculation("active", result)).toBe("active");
    expect(productStatusFromCalculation("draft", result)).toBe("ready");
  });

  it("keeps invalid calculation distinct from missing data", () => {
    const result = {
      status: "invalid" as const,
      errors: [{ code: "NON_FINITE", message: "Número inválido", field: "price" }],
    };

    expect(productStatusFromCalculation("ready", result)).toBe("incomplete");
    expect(completenessFromCalculation(result)).toEqual({
      status: "invalid",
      errors: result.errors,
    });
  });
});
