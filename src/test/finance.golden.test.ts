import { describe, expect, it } from "vitest";

import {
  calculateBreakEvenRevenue,
  calculateBreakEvenUnits,
  calculateContributionMargin,
  calculateContributionMarginPct,
  calculateIngredientCost,
  calculatePackagingCost,
  calculateRecipeCost,
  calculateRequiredSalesForProfit,
  calculateScenario,
  calculateUnitCost,
  calculateVariableCost,
  calcIncomplete,
  calcInvalid,
  calcOk,
  computeProduct,
  convertUnit,
  type CalculationResult,
} from "@/lib/finance";

/** Desembrulha um Result esperando `ok` — falha o teste caso contrário. */
function unwrap<T>(r: CalculationResult<T>): T {
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}`);
  return r.value;
}

/**
 * Golden tests (F0-03 — Plano Mestre §5 / V7 Apêndice D, lote 01).
 *
 * Testes de caracterização do motor financeiro. Comportamentos ainda
 * incorretos são marcados com `golden:` e o lote da sequência determinada
 * (Plano §40) que os corrige. Nenhum valor aqui pode ser "corrigido" sem o
 * lote correspondente.
 *
 * Lotes já aplicados: 03 (contrato CalculationResult) e 04 (unknown ≠ zero —
 * o motor aceita `null` nas entradas e sinaliza desconhecido com
 * `null`/`incomplete` em vez de defaults zero/um).
 */

describe("conversão de unidades", () => {
  it("converte dentro de massa, volume e contagem", () => {
    expect(convertUnit(1, "kg", "g")).toBe(1000);
    expect(convertUnit(1, "l", "ml")).toBe(1000);
    expect(convertUnit(1, "dúzia", "unidade")).toBe(12);
    expect(convertUnit(200, "g", "g")).toBe(200);
  });

  it("retorna null para unidades incompatíveis", () => {
    expect(convertUnit(1, "kg", "l")).toBeNull();
    expect(convertUnit(1, "unidade", "g")).toBeNull();
  });
});

describe("custo de ingredientes e receita", () => {
  it("custo normal: farinha 200 g de um pacote de R$ 6,00/1 kg custa R$ 1,20", () => {
    const cost = calculateIngredientCost({
      used_qty: 200,
      used_unit: "g",
      package_price: 6,
      package_qty: 1,
      package_unit: "kg",
    });
    expect(cost).toBeCloseTo(1.2, 10);
  });

  it("custo faltante: dados incompletos retornam null (desconhecido ≠ zero)", () => {
    expect(
      calculateIngredientCost({
        used_qty: 200,
        used_unit: "g",
        package_price: null,
        package_qty: null,
        package_unit: null,
      }),
    ).toBeNull();
  });

  it("unidade incompatível: custo vira zero silenciosamente", () => {
    // golden: comportamento atual incorreto — conversão incompatível vira custo zero (corrigir no lote 08, units)
    expect(
      calculateIngredientCost({
        used_qty: 200,
        used_unit: "g",
        package_price: 6,
        package_qty: 1,
        package_unit: "l",
      }),
    ).toBe(0);
  });

  it("custo da receita soma os ingredientes", () => {
    const rows = [
      { used_qty: 200, used_unit: "g", package_price: 6, package_qty: 1, package_unit: "kg" },
      {
        used_qty: 2,
        used_unit: "unidade",
        package_price: 12,
        package_qty: 1,
        package_unit: "dúzia",
      },
    ];
    expect(calculateRecipeCost(rows)).toBeCloseTo(1.2 + 2, 10);
  });
});

describe("custo unitário", () => {
  it("yield normal divide o custo da receita e soma embalagem", () => {
    expect(calculateUnitCost(12, 10, 0.5)).toBeCloseTo(1.7, 10);
  });

  it("yield zero torna o custo unitário desconhecido (null)", () => {
    expect(calculateUnitCost(12, 0, 0.5)).toBeNull();
  });

  it("yield desconhecido torna o produto incompleto (FIN-02)", () => {
    const result = computeProduct({
      ingredients: [
        { used_qty: 200, used_unit: "g", package_price: 6, package_qty: 1, package_unit: "kg" },
      ],
      packaging: [],
      yieldQty: null,
      price: 5,
      taxRate: 10,
      fees: [],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("yieldQty");
    }
  });

  it("alíquota desconhecida torna o produto incompleto (FIN-03)", () => {
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 10,
      taxRate: null,
      fees: [],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("taxRate");
    }
  });

  it("embalagem com unidades por pacote inválidas é ignorada", () => {
    expect(calculatePackagingCost([{ package_price: 50, units_per_package: 0 }])).toBe(0);
    expect(calculatePackagingCost([{ package_price: 50, units_per_package: 100 }])).toBeCloseTo(
      0.5,
      10,
    );
  });
});

describe("margem de contribuição", () => {
  it("margem negativa quando o preço não cobre custos", () => {
    const variable = calculateVariableCost(5, 10, [{ percentage: 5 }]);
    if (variable === null) throw new Error("expected number, got null");
    expect(variable).toBeCloseTo(0.75, 10);
    const cm = calculateContributionMargin(5, 6, variable);
    expect(cm).toBeCloseTo(-1.75, 10);
    expect(calculateContributionMarginPct(5, cm)).toBeCloseTo(-35, 10);
  });

  it("percentual com preço zero retorna 0", () => {
    expect(calculateContributionMarginPct(0, 5)).toBe(0);
  });
});

describe("ponto de equilíbrio", () => {
  it("contribuição zero torna o break-even impossível (Infinity)", () => {
    // golden: Infinity vaza para a UI — semântica de impossível será formalizada no lote 09/rounding
    expect(calculateBreakEvenUnits(6000, 0)).toBe(Infinity);
    expect(calculateBreakEvenRevenue(6000, 0)).toBe(Infinity);
  });

  it("margem negativa também torna o break-even impossível", () => {
    expect(calculateBreakEvenUnits(6000, -1)).toBe(Infinity);
    expect(calculateRequiredSalesForProfit(6000, 2000, -1)).toBe(Infinity);
  });

  it("break-even discreto ainda não usa ceil", () => {
    // golden: comportamento atual incorreto — 857,14… unidades sem arredondamento discreto (corrigir no lote 09, FIN-08 da V7)
    expect(calculateBreakEvenUnits(6000, 7)).toBeCloseTo(857.142857, 5);
  });
});

describe("quantidades fracionárias", () => {
  it("meio quilo e frações de unidade fluem como ponto flutuante", () => {
    const cost = calculateIngredientCost({
      used_qty: 0.5,
      used_unit: "kg",
      package_price: 6,
      package_qty: 1,
      package_unit: "kg",
    });
    expect(cost).toBeCloseTo(3, 10);
  });
});

describe("cenários (exemplo canônico da Diretriz §12)", () => {
  const base = {
    unitCost: 4,
    taxRate: 0,
    fees: [],
    fixedExpenses: 6000,
    volume: 700,
  };

  it("cenário real: preço R$ 10 gera prejuízo de R$ 1.800", () => {
    const result = unwrap(calculateScenario({ ...base, price: 10 }));
    expect(result.contributionMargin).toBeCloseTo(6, 10);
    expect(result.contributionMarginPct).toBeCloseTo(60, 10);
    expect(result.breakEvenUnits).toBeCloseTo(1000, 10);
    expect(result.breakEvenRevenue).toBeCloseTo(10000, 10);
    expect(result.revenue).toBe(7000);
    expect(result.result).toBeCloseTo(-1800, 10);
  });

  it("cenário simulado: preço R$ 11 reduz o prejuízo para R$ 1.100", () => {
    const result = unwrap(calculateScenario({ ...base, price: 11 }));
    expect(result.contributionMargin).toBeCloseTo(7, 10);
    expect(result.result).toBeCloseTo(-1100, 10);
  });
});

describe("contrato CalculationResult (FIN-001 — lote 03)", () => {
  it("calcOk envelopa o valor com warnings vazios por padrão", () => {
    expect(calcOk(42)).toEqual({ status: "ok", value: 42, warnings: [] });
  });

  it("calcOk aceita warnings explícitos", () => {
    const w = { code: "W_TEST", message: "aviso" };
    expect(calcOk(1, [w])).toEqual({ status: "ok", value: 1, warnings: [w] });
  });

  it("calcIncomplete carrega os campos faltantes e warnings vazios por padrão", () => {
    expect(calcIncomplete([{ field: "yieldQty" }])).toEqual({
      status: "incomplete",
      missing: [{ field: "yieldQty" }],
      warnings: [],
    });
  });

  it("calcIncomplete aceita warnings explícitos", () => {
    const w = { code: "W_TEST", message: "aviso" };
    expect(calcIncomplete([{ field: "price" }], [w])).toEqual({
      status: "incomplete",
      missing: [{ field: "price" }],
      warnings: [w],
    });
  });

  it("calcInvalid carrega os erros", () => {
    const e = { code: "E_TEST", message: "inválido" };
    expect(calcInvalid([e])).toEqual({ status: "invalid", errors: [e] });
  });

  it("computeProduct retorna status ok com warnings vazios para entradas válidas", () => {
    const r = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 10,
      taxRate: 10,
      fees: [],
    });
    expect(r).toMatchObject({ status: "ok", warnings: [] });
  });

  it("calculateScenario retorna status ok com warnings vazios para entradas válidas", () => {
    const r = calculateScenario({
      price: 10,
      unitCost: 4,
      taxRate: 0,
      fees: [],
      fixedExpenses: 6000,
      volume: 700,
    });
    expect(r).toMatchObject({ status: "ok", warnings: [] });
  });
});

describe("política unknown ≠ zero (FIN-002 — lote 04)", () => {
  it("ingrediente sem preço de embalagem torna o produto incompleto (FIN-01)", () => {
    const result = computeProduct({
      ingredients: [
        { used_qty: 200, used_unit: "g", package_price: null, package_qty: 1, package_unit: "kg" },
      ],
      packaging: [],
      yieldQty: 10,
      price: 5,
      taxRate: 10,
      fees: [],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("ingredients[0].package_price");
    }
  });

  it("conteúdo de embalagem não positivo torna o produto incompleto", () => {
    const result = computeProduct({
      ingredients: [
        { used_qty: 200, used_unit: "g", package_price: 6, package_qty: 0, package_unit: "kg" },
      ],
      packaging: [],
      yieldQty: 10,
      price: 5,
      taxRate: 10,
      fees: [],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("ingredients[0].package_qty");
    }
  });

  it("percentual de taxa desconhecido torna o produto incompleto", () => {
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 5,
      taxRate: 10,
      fees: [{ percentage: null }],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("fees[0].percentage");
    }
  });

  it("preço desconhecido torna o produto incompleto", () => {
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: null,
      taxRate: 10,
      fees: [],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("price");
    }
  });

  it("custo da receita propaga null de ingrediente incompleto", () => {
    expect(
      calculateRecipeCost([
        { used_qty: 200, used_unit: "g", package_price: 6, package_qty: 1, package_unit: "kg" },
        {
          used_qty: 1,
          used_unit: "unidade",
          package_price: null,
          package_qty: null,
          package_unit: null,
        },
      ]),
    ).toBeNull();
  });

  it("custo variável com alíquota ou taxa desconhecida retorna null", () => {
    expect(calculateVariableCost(10, null, [])).toBeNull();
    expect(calculateVariableCost(10, 5, [{ percentage: null }])).toBeNull();
  });

  it("cenário com alíquota desconhecida fica incompleto", () => {
    const result = calculateScenario({
      price: 10,
      unitCost: 4,
      taxRate: null,
      fees: [],
      fixedExpenses: 6000,
      volume: 700,
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toContain("taxRate");
    }
  });

  it("zero conhecido permanece válido: embalagem de R$ 0 custa R$ 0 (V7 §8.3)", () => {
    expect(
      calculateIngredientCost({
        used_qty: 200,
        used_unit: "g",
        package_price: 0,
        package_qty: 1,
        package_unit: "kg",
      }),
    ).toBe(0);
  });
});
