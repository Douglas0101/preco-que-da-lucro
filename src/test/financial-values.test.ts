import { describe, expect, it } from "vitest";

import {
  decimalStringSchema,
  fractionToPercentPoints,
  moneySchema,
  percentPointsToFraction,
  percentSchema,
  quantitySchema,
  toDecimalString,
} from "@/lib/financial-values";

describe("contratos financeiros exatos", () => {
  it("aceita somente strings decimais canônicas e finitas", () => {
    expect(decimalStringSchema.parse("123.4500")).toBe("123.4500");
    expect(decimalStringSchema.safeParse("R$ 1,00").success).toBe(false);
    expect(decimalStringSchema.safeParse("NaN").success).toBe(false);
    expect(decimalStringSchema.safeParse("Infinity").success).toBe(false);
  });

  it("mantém dinheiro em BRL e quantidade com dimensão", () => {
    expect(moneySchema.parse({ amount: "10.2500", currency: "BRL" })).toEqual({
      amount: "10.2500",
      currency: "BRL",
    });
    expect(quantitySchema.parse({ amount: "0.500000", unit: "kg", dimension: "mass" })).toEqual({
      amount: "0.500000",
      unit: "kg",
      dimension: "mass",
    });
  });

  it("usa fração como percentual canônico", () => {
    const percent = percentPointsToFraction("15");
    expect(percent).toEqual({ value: "0.150000" });
    expect(fractionToPercentPoints(percent).toString()).toBe("15");
    expect(percentSchema.safeParse({ value: "1.000001" }).success).toBe(false);
  });

  it("aplica ROUND_HALF_UP nas fronteiras declaradas", () => {
    expect(toDecimalString("1.005", 2)).toBe("1.01");
  });
});
