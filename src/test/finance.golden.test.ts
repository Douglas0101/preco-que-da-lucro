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
  sumFiniteNumbers,
  type CalculationResult,
  type ScenarioInput,
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
 * Lotes já aplicados: 03 (contrato CalculationResult), 04 (unknown ≠ zero) e
 * 05 (número inválido ≠ zero). `null` permanece incomplete; valores numéricos
 * inválidos e resultados não finitos usam `invalid`.
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

  it("yield zero conhecido torna o custo unitário inválido (NaN)", () => {
    expect(Number.isNaN(calculateUnitCost(12, 0, 0.5))).toBe(true);
  });

  it("custo unitário propaga custo de receita ou embalagem desconhecido", () => {
    expect(calculateUnitCost(null, 10, 0.5)).toBeNull();
    expect(calculateUnitCost(12, 10, null)).toBeNull();
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

  it("embalagem com unidades por pacote inválidas produz NaN, nunca custo zero", () => {
    expect(
      Number.isNaN(calculatePackagingCost([{ package_price: 50, units_per_package: 0 }])),
    ).toBe(true);
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

  it("custo variável com preço, alíquota ou taxa desconhecida retorna null", () => {
    expect(calculateVariableCost(null, 5, [])).toBeNull();
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

  it.each(["price", "unitCost", "fixedExpenses", "volume"] as const)(
    "cenário com %s desconhecido fica incompleto",
    (field) => {
      const input: ScenarioInput = {
        price: 10,
        unitCost: 4,
        taxRate: 0,
        fees: [],
        fixedExpenses: 6000,
        volume: 700,
      };
      input[field] = null;
      const result = calculateScenario(input);
      expect(result.status).toBe("incomplete");
      if (result.status === "incomplete") {
        expect(result.missing.map((m) => m.field)).toEqual([field]);
      }
    },
  );

  it("cenário com taxa de venda desconhecida fica incompleto", () => {
    const result = calculateScenario({
      price: 10,
      unitCost: 4,
      taxRate: 0,
      fees: [{ percentage: null }],
      fixedExpenses: 6000,
      volume: 700,
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toEqual(["fees[0].percentage"]);
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

  it("alíquota zero conhecida é válida e zera o custo variável (V7 §8.3)", () => {
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 10,
      taxRate: 0,
      fees: [],
    });
    expect(unwrap(result).variableCost).toBe(0);
  });

  it("preço e taxa zero conhecidos permanecem válidos (V7 §8.3)", () => {
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 0,
      taxRate: 0,
      fees: [{ percentage: 0 }],
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.value.variableCost).toBe(0);
      expect(result.value.contributionMarginPct).toBe(0);
    }
  });

  it("produto com todos os campos desconhecidos agrega todos os missing", () => {
    const result = computeProduct({
      ingredients: [
        {
          used_qty: 1,
          used_unit: "g",
          package_price: null,
          package_qty: null,
          package_unit: null,
        },
      ],
      packaging: [],
      yieldQty: null,
      price: null,
      taxRate: null,
      fees: [{ percentage: null }],
    });
    expect(result.status).toBe("incomplete");
    if (result.status === "incomplete") {
      expect(result.missing.map((m) => m.field)).toEqual([
        "ingredients[0].package_price",
        "ingredients[0].package_qty",
        "ingredients[0].package_unit",
        "fees[0].percentage",
        "yieldQty",
        "price",
        "taxRate",
      ]);
    }
  });
});

describe("política invalid number ≠ zero (FIN-003 — lote 05)", () => {
  const validScenario = (): ScenarioInput => ({
    price: 10,
    unitCost: 4,
    taxRate: 0,
    fees: [],
    fixedExpenses: 6000,
    volume: 700,
  });

  type ProductInput = Parameters<typeof computeProduct>[0];
  const validProduct = (): ProductInput => ({
    ingredients: [
      {
        used_qty: 200,
        used_unit: "g",
        package_price: 6,
        package_qty: 1,
        package_unit: "kg",
      },
    ],
    packaging: [{ package_price: 50, units_per_package: 100 }],
    yieldQty: 10,
    price: 10,
    taxRate: 0,
    fees: [{ percentage: 1 }],
  });

  const nonFiniteFields = ["price", "unitCost", "taxRate", "fixedExpenses", "volume"] as const;
  const nonFiniteValues = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  it.each(
    nonFiniteFields.flatMap((field) => nonFiniteValues.map((value) => [field, value] as const)),
  )("cenário com %s=%s retorna invalid", (field, value) => {
    const input = validScenario();
    input[field] = value;
    const result = calculateScenario(input);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toEqual([expect.objectContaining({ code: "INVALID_NUMBER", field })]);
    }
  });

  const productNumericFields: Array<{
    field: string;
    set: (input: ProductInput, value: number) => void;
  }> = [
    {
      field: "ingredients[0].used_qty",
      set: (input, value) => (input.ingredients[0].used_qty = value),
    },
    {
      field: "ingredients[0].package_price",
      set: (input, value) => (input.ingredients[0].package_price = value),
    },
    {
      field: "ingredients[0].package_qty",
      set: (input, value) => (input.ingredients[0].package_qty = value),
    },
    {
      field: "packaging[0].package_price",
      set: (input, value) => (input.packaging[0].package_price = value),
    },
    {
      field: "packaging[0].units_per_package",
      set: (input, value) => (input.packaging[0].units_per_package = value),
    },
    { field: "yieldQty", set: (input, value) => (input.yieldQty = value) },
    { field: "price", set: (input, value) => (input.price = value) },
    { field: "taxRate", set: (input, value) => (input.taxRate = value) },
    {
      field: "fees[0].percentage",
      set: (input, value) => (input.fees[0].percentage = value),
    },
  ];

  it.each(
    productNumericFields.flatMap(({ field, set }) =>
      nonFiniteValues.map((value) => [field, value, set] as const),
    ),
  )("produto com %s=%s retorna invalid", (field, value, set) => {
    const input = validProduct();
    set(input, value);
    const result = computeProduct(input);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "INVALID_NUMBER", field }),
      );
    }
  });

  it.each([
    ["price", -1],
    ["unitCost", -1],
    ["taxRate", -1],
    ["taxRate", 101],
    ["fixedExpenses", -1],
    ["volume", -1],
  ] as const)("cenário com %s=%s fora do domínio retorna invalid", (field, value) => {
    const input = validScenario();
    input[field] = value;
    const result = calculateScenario(input);
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors).toEqual([expect.objectContaining({ code: "INVALID_NUMBER", field })]);
    }
  });

  it.each([-1, 101, Number.NaN, Number.POSITIVE_INFINITY])(
    "taxa de venda inválida (%s) retorna invalid",
    (percentage) => {
      const result = calculateScenario({
        ...validScenario(),
        fees: [{ percentage }],
      });
      expect(result.status).toBe("invalid");
      if (result.status === "invalid") {
        expect(result.errors).toEqual([
          expect.objectContaining({
            code: "INVALID_NUMBER",
            field: "fees[0].percentage",
          }),
        ]);
      }
    },
  );

  it.each([
    [100, []],
    [90, [10]],
    [80, [10, 10]],
  ] as const)("imposto %s + taxas %s igual a 100%% retorna invalid", (taxRate, percentages) => {
    const result = calculateScenario({
      ...validScenario(),
      taxRate,
      fees: percentages.map((percentage) => ({ percentage })),
    });
    expect(result).toMatchObject({
      status: "invalid",
      errors: [{ code: "INVALID_NUMBER", field: "rateOnGrossPrice" }],
    });
  });

  it("subtotal conhecido de 100% prevalece sobre taxa ausente", () => {
    const result = calculateScenario({
      ...validScenario(),
      taxRate: null,
      fees: [{ percentage: 100 }],
    });
    expect(result).toMatchObject({
      status: "invalid",
      errors: [{ code: "INVALID_NUMBER", field: "rateOnGrossPrice" }],
    });
  });

  it("produto agrega todos os campos numéricos inválidos", () => {
    const result = computeProduct({
      ingredients: [
        {
          used_qty: 0,
          used_unit: "g",
          package_price: -1,
          package_qty: 0,
          package_unit: "kg",
        },
      ],
      packaging: [{ package_price: Number.NaN, units_per_package: 0 }],
      yieldQty: 0,
      price: -1,
      taxRate: 101,
      fees: [{ percentage: -1 }],
    });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors.map((error) => error.field)).toEqual([
        "ingredients[0].used_qty",
        "ingredients[0].package_price",
        "ingredients[0].package_qty",
        "packaging[0].package_price",
        "packaging[0].units_per_package",
        "fees[0].percentage",
        "yieldQty",
        "price",
        "taxRate",
      ]);
      expect(result.errors.every((error) => error.code === "INVALID_NUMBER")).toBe(true);
    }
  });

  it("folhas propagam número inválido como NaN, nunca null ou zero", () => {
    expect(
      Number.isNaN(
        calculateIngredientCost({
          used_qty: 0,
          used_unit: "g",
          package_price: 6,
          package_qty: 1,
          package_unit: "kg",
        }),
      ),
    ).toBe(true);
    expect(
      Number.isNaN(
        calculateIngredientCost({
          used_qty: Number.NaN,
          used_unit: "g",
          package_price: null,
          package_qty: null,
          package_unit: null,
        }),
      ),
    ).toBe(true);
    expect(
      Number.isNaN(
        calculateRecipeCost([
          {
            used_qty: 1,
            used_unit: "g",
            package_price: null,
            package_qty: null,
            package_unit: null,
          },
          {
            used_qty: 0,
            used_unit: "g",
            package_price: 6,
            package_qty: 1,
            package_unit: "kg",
          },
        ]),
      ),
    ).toBe(true);
    expect(
      Number.isNaN(calculatePackagingCost([{ package_price: 50, units_per_package: 0 }])),
    ).toBe(true);
    expect(Number.isNaN(calculateUnitCost(null, 0, 0.5))).toBe(true);
    expect(Number.isNaN(calculateVariableCost(null, 100, []))).toBe(true);
    expect(Number.isNaN(calculateContributionMarginPct(Number.NaN, 5))).toBe(true);
    expect(Number.isNaN(calculateBreakEvenUnits(Number.POSITIVE_INFINITY, 5))).toBe(true);
    expect(Number.isNaN(sumFiniteNumbers([1, Number.POSITIVE_INFINITY]))).toBe(true);
    expect(Number.isNaN(sumFiniteNumbers([Number.MAX_VALUE, Number.MAX_VALUE]))).toBe(true);
    expect(sumFiniteNumbers([1, 2, 3])).toBe(6);
  });

  it("overflow de resultado derivado retorna invalid", () => {
    const product = computeProduct({
      ingredients: [],
      packaging: [{ package_price: Number.MAX_VALUE, units_per_package: Number.MIN_VALUE }],
      yieldQty: 1,
      price: 10,
      taxRate: 0,
      fees: [],
    });
    expect(product).toMatchObject({
      status: "invalid",
      errors: [{ code: "NON_FINITE_RESULT", field: "packagingCost" }],
    });

    const scenario = calculateScenario({
      ...validScenario(),
      price: Number.MAX_VALUE,
      unitCost: 0,
      fixedExpenses: 0,
      volume: 2,
    });
    expect(scenario).toMatchObject({
      status: "invalid",
      errors: [{ code: "NON_FINITE_RESULT", field: "revenue" }],
    });
  });

  it("Infinity semântico de break-even permanece não atingível, não invalid", () => {
    const result = calculateScenario({
      ...validScenario(),
      price: 10,
      unitCost: 10,
      fixedExpenses: 6000,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.value.breakEvenUnits).toBe(Number.POSITIVE_INFINITY);
      expect(result.value.breakEvenRevenue).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("invalid prevalece quando a mesma entrada também contém ausência", () => {
    const result = calculateScenario({
      ...validScenario(),
      price: null,
      unitCost: Number.NaN,
    });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.errors.map((error) => error.field)).toEqual(["unitCost"]);
    }
  });
});
