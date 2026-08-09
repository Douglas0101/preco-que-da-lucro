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
  computeProduct,
  convertUnit,
} from "@/lib/finance";

/**
 * Golden tests (F0-03 — Plano Mestre §5 / V7 Apêndice D, lote 01).
 *
 * Testes de caracterização: assertam o comportamento ATUAL do motor financeiro
 * antes das correções do P0. Comportamentos hoje incorretos são marcados com
 * `golden:` e o lote da sequência determinada (Plano §40) que os corrige.
 * Nenhum valor aqui pode ser "corrigido" sem o lote correspondente.
 *
 * Os casts `null as unknown as number` são deliberados: injetam o dado
 * desconhecido que o tipo não admite para caracterizar a política atual de
 * unknown/invalid. Não "limpar" esses casts — eles são o objeto do teste.
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

  it("custo faltante: dados incompletos viram zero", () => {
    // golden: comportamento atual incorreto — unknown vira zero (corrigir no lote 04, Unknown ≠ Zero)
    expect(
      calculateIngredientCost({
        used_qty: 200,
        used_unit: "g",
        package_price: null,
        package_qty: null,
        package_unit: null,
      }),
    ).toBe(0);
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

  it("yield zero zera o custo de ingredientes por unidade", () => {
    // golden: comportamento atual incorreto — yield zero vira custo zero (corrigir no lote 04, política unknown)
    expect(calculateUnitCost(12, 0, 0.5)).toBe(0.5);
  });

  it("yield null vira 1 em computeProduct", () => {
    // golden: comportamento atual incorreto — yield desconhecido vira 1 (corrigir no lote 04, política unknown)
    const result = computeProduct({
      ingredients: [
        { used_qty: 200, used_unit: "g", package_price: 6, package_qty: 1, package_unit: "kg" },
      ],
      packaging: [],
      yieldQty: null as unknown as number,
      price: 5,
      taxRate: 10,
      fees: [],
    });
    expect(result.unitCost).toBeCloseTo(1.2, 10);
  });

  it("tax null vira 0% em computeProduct", () => {
    // golden: comportamento atual incorreto — alíquota desconhecida vira zero (corrigir no lote 04/05)
    const result = computeProduct({
      ingredients: [],
      packaging: [],
      yieldQty: 10,
      price: 10,
      taxRate: null as unknown as number,
      fees: [],
    });
    expect(result.variableCost).toBe(0);
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
    const result = calculateScenario({ ...base, price: 10 });
    expect(result.contributionMargin).toBeCloseTo(6, 10);
    expect(result.contributionMarginPct).toBeCloseTo(60, 10);
    expect(result.breakEvenUnits).toBeCloseTo(1000, 10);
    expect(result.breakEvenRevenue).toBeCloseTo(10000, 10);
    expect(result.revenue).toBe(7000);
    expect(result.result).toBeCloseTo(-1800, 10);
  });

  it("cenário simulado: preço R$ 11 reduz o prejuízo para R$ 1.100", () => {
    const result = calculateScenario({ ...base, price: 11 });
    expect(result.contributionMargin).toBeCloseTo(7, 10);
    expect(result.result).toBeCloseTo(-1100, 10);
  });
});
