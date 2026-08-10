import { describe, expect, it } from "vitest";

import { calculateBreakEvenRevenue } from "@/lib/finance";
import { brl, num, numericDisplayState, pct } from "@/lib/format";

const formatters = [brl, pct, num] as const;

describe("formatação de estados numéricos FIN-003", () => {
  it.each([null, undefined])("renderiza %s como dado incompleto", (value) => {
    for (const format of formatters) expect(format(value)).toBe("—");
    expect(numericDisplayState(value)).toBe("incomplete");
  });

  it("renderiza NaN como erro de cálculo", () => {
    for (const format of formatters) expect(format(Number.NaN)).toBe("Erro de cálculo");
    expect(numericDisplayState(Number.NaN)).toBe("invalid");
  });

  it("renderiza Infinity semântico como não atingível", () => {
    for (const format of formatters) expect(format(Number.POSITIVE_INFINITY)).toBe("Não atingível");
    expect(brl(calculateBreakEvenRevenue(6000, 0))).toBe("Não atingível");
    expect(numericDisplayState(Number.POSITIVE_INFINITY)).toBe("infinite");
  });

  it("renderiza -Infinity como erro de cálculo", () => {
    for (const format of formatters)
      expect(format(Number.NEGATIVE_INFINITY)).toBe("Erro de cálculo");
    expect(numericDisplayState(Number.NEGATIVE_INFINITY)).toBe("invalid");
  });

  it("preserva zero conhecido e números finitos", () => {
    expect(brl(0)).toContain("0,00");
    expect(pct(0)).toBe("0,00%");
    expect(num(0)).toBe("0,00");
    expect(numericDisplayState(0)).toBe("ok");
  });
});
