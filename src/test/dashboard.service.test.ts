import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/db/schema";
import type { RequestContext } from "@/lib/request-context";
import {
  dashboardService,
  DefaultDashboardService,
  getDashboardSummary,
  periodStart,
  type DashboardSummary,
} from "@/server/services/dashboard.service";
import {
  dashboardRepository,
  loadDashboardInputs,
  type DashboardInputs,
  type DashboardRepository,
} from "@/server/repositories/dashboard.repository";
import type { SalesService } from "@/server/services/sales.service";
import type { SaleItemSummaryRow, SalesSummary } from "@/server/repositories/sales.repository";
import { contextWithRole } from "./helpers/request-context";

const TENANT_ID = "50000000-0000-4000-8000-000000000005";

class FakeDashboardRepository implements DashboardRepository {
  readonly contexts: RequestContext[] = [];

  constructor(private readonly result: DashboardInputs) {}

  async loadInputs(context: RequestContext): Promise<DashboardInputs> {
    this.contexts.push(context);
    return this.result;
  }
}

class FakeSalesService implements SalesService {
  readonly calls: Array<{ context: RequestContext; from: Date }> = [];
  readonly itemCalls: Array<{ context: RequestContext; from: Date }> = [];

  constructor(
    private readonly summary: SalesSummary = { revenue: "0.0000", count: 0 },
    private readonly itemSummary: SaleItemSummaryRow[] = [],
  ) {}

  async create(): Promise<never> {
    throw new Error("NOT_IMPLEMENTED");
  }

  async revenue(): Promise<string> {
    return "0.0000";
  }

  async summaryForPeriod(context: RequestContext, from: Date): Promise<SalesSummary> {
    this.calls.push({ context, from });
    return this.summary;
  }

  async itemSummaryForPeriod(context: RequestContext, from: Date): Promise<SaleItemSummaryRow[]> {
    this.itemCalls.push({ context, from });
    return this.itemSummary;
  }

  async list(): Promise<never> {
    throw new Error("NOT_IMPLEMENTED");
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "70000000-0000-4000-8000-000000000001",
    tenantId: TENANT_ID,
    userId: "user-1",
    name: "Bolo de Cacau",
    status: "active",
    currentPrice: null,
    yieldQty: null,
    yieldUnit: null,
    taxRegime: null,
    taxRate: null,
    isDemo: false,
    notes: null,
    version: 0,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function inputs(overrides: Partial<DashboardInputs> = {}): DashboardInputs {
  return {
    productRows: [],
    expenseRows: [],
    ingredientRows: [],
    packagingRows: [],
    feeRows: [],
    marketRows: [],
    ...overrides,
  };
}

describe("DefaultDashboardService (DI)", () => {
  it("carrega os inputs pelo repository injetado e consulta sales no início do período", async () => {
    const context = contextWithRole("owner");
    const repository = new FakeDashboardRepository(inputs());
    const sales = new FakeSalesService({ revenue: "150.0000", count: 3 });
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(context, "quarter");

    expect(repository.contexts).toEqual([context]);
    expect(sales.calls).toHaveLength(1);
    expect(sales.calls[0]!.context).toBe(context);
    expect(sales.calls[0]!.from).toEqual(periodStart("quarter"));
    expect(summary).toEqual({
      productCount: 0,
      fixedExpenses: "0.0000",
      bestProduct: null,
      hasInvalidCalculation: false,
      incompleteProductCount: 0,
      alerts: [],
      consolidatedMargin: {
        state: "incomplete",
        incompleteProductCount: 0,
        zeroRevenue: false,
        salesMismatch: true,
      },
      period: "quarter",
      sales: { revenue: "150.0000", count: 3 },
    });
  });

  it("marca cálculo inválido sem eleger destaque", async () => {
    const repository = new FakeDashboardRepository(
      inputs({ productRows: [product({ currentPrice: "-1" })] }),
    );
    const service = new DefaultDashboardService(repository, new FakeSalesService());

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.productCount).toBe(1);
    expect(summary.hasInvalidCalculation).toBe(true);
    expect(summary.bestProduct).toBeNull();
  });

  it("conta produtos incompletos e alerta antes dos destaques", async () => {
    const repository = new FakeDashboardRepository(
      inputs({ productRows: [product({ status: "draft" })] }),
    );
    const service = new DefaultDashboardService(repository, new FakeSalesService());

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.incompleteProductCount).toBe(1);
    expect(summary.alerts[0]).toContain("não participa(m) dos destaques");
    expect(summary.hasInvalidCalculation).toBe(false);
  });

  it("projeta o melhor produto a partir dos inputs injetados", async () => {
    const okProduct = product({
      name: "Bolo de Cacau",
      currentPrice: "25",
      yieldQty: "1",
      taxRate: "0.1",
    });
    const repository = new FakeDashboardRepository(
      inputs({
        productRows: [okProduct],
        ingredientRows: [
          {
            id: "ingredient-1",
            tenantId: TENANT_ID,
            userId: "user-1",
            productId: okProduct.id,
            usedQty: "1",
            usedUnit: "kg",
            packagePrice: "10",
            packageQty: "1",
            packageUnit: "kg",
            conversionFactor: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          } as DashboardInputs["ingredientRows"][number],
        ],
        packagingRows: [
          {
            id: "packaging-1",
            tenantId: TENANT_ID,
            userId: "user-1",
            productId: okProduct.id,
            packagePrice: "1",
            unitsPerPackage: "1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          } as DashboardInputs["packagingRows"][number],
        ],
      }),
    );
    const service = new DefaultDashboardService(repository, new FakeSalesService());

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.hasInvalidCalculation).toBe(false);
    expect(summary.bestProduct).toEqual({ name: "Bolo de Cacau", cmPct: "46.000000" });
    expect(summary.alerts).toEqual([]);
  });
});

describe("margem consolidada (DBT-88)", () => {
  /** Produto com custo calculável: preço 25 e mcPct 46% → mc unitária 11.50. */
  function calculableInputs() {
    const okProduct = product({
      name: "Bolo de Cacau",
      currentPrice: "25",
      yieldQty: "1",
      taxRate: "0.1",
    });
    return {
      okProduct,
      inputs: inputs({
        productRows: [okProduct],
        ingredientRows: [
          {
            id: "ingredient-1",
            tenantId: TENANT_ID,
            userId: "user-1",
            productId: okProduct.id,
            usedQty: "1",
            usedUnit: "kg",
            packagePrice: "10",
            packageQty: "1",
            packageUnit: "kg",
            conversionFactor: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          } as DashboardInputs["ingredientRows"][number],
        ],
        packagingRows: [
          {
            id: "packaging-1",
            tenantId: TENANT_ID,
            userId: "user-1",
            productId: okProduct.id,
            packagePrice: "1",
            unitsPerPackage: "1",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          } as DashboardInputs["packagingRows"][number],
        ],
      }),
    };
  }

  it("estado empty: zero vendas reais no período, sem inventar margem", async () => {
    const repository = new FakeDashboardRepository(inputs({ productRows: [product()] }));
    const sales = new FakeSalesService({ revenue: "0.0000", count: 0 });
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.consolidatedMargin).toEqual({ state: "empty" });
    expect(sales.itemCalls).toHaveLength(0);
  });

  it("estado ok: Σ(qty × mc unitária) sobre o faturamento líquido, em Decimal", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const repository = new FakeDashboardRepository(rows);
    const sales = new FakeSalesService({ revenue: "50.0000", count: 2 }, [
      { productId: okProduct.id, quantity: "2", totalAmount: "50.0000" },
    ]);
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(contextWithRole("owner"));

    // mc unitária do produto (cmPct 46% sobre preço 25) = 11.50;
    // 2 × 11.50 = 23.00; 23.00 / 50.00 × 100 = 46.00%
    expect(summary.consolidatedMargin).toEqual({
      state: "ok",
      valuePct: "46.0000",
      valueAmount: "23.0000",
    });
  });

  it("usa preço efetivamente vendido e taxas sobre a receita, sem reusar preço de catálogo", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const sales = new FakeSalesService({ revenue: "80.0000", count: 1 }, [
      { productId: okProduct.id, quantity: "2", totalAmount: "80.0000" },
    ]);
    const service = new DefaultDashboardService(new FakeDashboardRepository(rows), sales);
    const summary = await service.getSummary(contextWithRole("owner"));
    // 2×40 vendidos: 80 − 2×11 de custo − 80×0.1 de imposto = 50; 62.5%.
    expect(summary.consolidatedMargin).toEqual({
      state: "ok",
      valuePct: "62.5000",
      valueAmount: "50.0000",
    });
    expect(sales.itemCalls[0].from).toEqual(sales.calls[0].from);
  });

  it("preserva contribuição negativa de vendas abaixo do custo, sem fabricar zero", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const sales = new FakeSalesService({ revenue: "10.0000", count: 1 }, [
      { productId: okProduct.id, quantity: "2", totalAmount: "10.0000" },
    ]);
    const service = new DefaultDashboardService(new FakeDashboardRepository(rows), sales);
    const summary = await service.getSummary(contextWithRole("owner"));
    // 10 − 22 de custo − 1 de imposto = −13; −130%.
    expect(summary.consolidatedMargin).toEqual({
      state: "ok",
      valuePct: "-130.0000",
      valueAmount: "-13.0000",
    });
  });

  it("desconto sem alocação fiscal ou agregado sem itens produz motivo verdadeiro", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    for (const items of [
      [{ productId: okProduct.id, quantity: "2", totalAmount: "50.0000" }],
      [],
    ]) {
      const service = new DefaultDashboardService(
        new FakeDashboardRepository(rows),
        new FakeSalesService({ revenue: "45.0000", count: 1 }, items),
      );
      expect((await service.getSummary(contextWithRole("owner"))).consolidatedMargin).toEqual({
        state: "incomplete",
        incompleteProductCount: 0,
        zeroRevenue: false,
        salesMismatch: true,
      });
    }
  });

  it("estado incomplete: produto vendido sem custo calculável reprova margem parcial", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const repository = new FakeDashboardRepository(rows);
    const UNKNOWN = "80000000-0000-4000-8000-0000000000a1";
    const sales = new FakeSalesService({ revenue: "80.0000", count: 3 }, [
      { productId: okProduct.id, quantity: "2", totalAmount: "50.0000" },
      { productId: UNKNOWN, quantity: "1", totalAmount: "30.0000" },
    ]);
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(contextWithRole("owner"));

    // Nunca margem parcial: o produto sem custo desclassifica o agregado inteiro.
    expect(summary.consolidatedMargin).toEqual({
      state: "incomplete",
      incompleteProductCount: 1,
      zeroRevenue: false,
    });
  });

  it("estado incomplete: produto com cálculo inválido vendido não entra na margem", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const invalidProduct = product({
      id: "90000000-0000-4000-8000-0000000000b2",
      currentPrice: "-1",
    });
    const repository = new FakeDashboardRepository(
      inputs({ ...rows, productRows: [...rows.productRows, invalidProduct] }),
    );
    const sales = new FakeSalesService({ revenue: "50.0000", count: 1 }, [
      { productId: invalidProduct.id, quantity: "1", totalAmount: "0.0000" },
    ]);
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.consolidatedMargin).toEqual({
      state: "incomplete",
      incompleteProductCount: 1,
      zeroRevenue: false,
    });
    expect(summary.hasInvalidCalculation).toBe(true);
  });

  it("estado incomplete com faturamento zero e vendas registradas", async () => {
    const { okProduct, inputs: rows } = calculableInputs();
    const repository = new FakeDashboardRepository(rows);
    const sales = new FakeSalesService({ revenue: "0.0000", count: 1 }, [
      { productId: okProduct.id, quantity: "1", totalAmount: "0.0000" },
    ]);
    const service = new DefaultDashboardService(repository, sales);

    const summary = await service.getSummary(contextWithRole("owner"));

    expect(summary.consolidatedMargin).toEqual({
      state: "incomplete",
      incompleteProductCount: 0,
      zeroRevenue: true,
    });
  });
});

describe("dashboard adapters", () => {
  it("getDashboardSummary delega para o singleton com o período recebido", async () => {
    const context = contextWithRole("owner");
    const expected: DashboardSummary = {
      productCount: 0,
      fixedExpenses: null,
      bestProduct: null,
      hasInvalidCalculation: false,
      consolidatedMargin: { state: "empty" },
      incompleteProductCount: 0,
      alerts: [],
      period: "year",
      sales: { revenue: "0.0000", count: 0 },
    };
    const spy = vi.spyOn(dashboardService, "getSummary").mockResolvedValue(expected);
    try {
      await expect(getDashboardSummary(context, "year")).resolves.toEqual(expected);
      expect(spy).toHaveBeenCalledWith(context, "year");
    } finally {
      spy.mockRestore();
    }
  });

  it("loadDashboardInputs delega para o repositório singleton", async () => {
    const context = contextWithRole("owner");
    const expected = inputs();
    const spy = vi.spyOn(dashboardRepository, "loadInputs").mockResolvedValue(expected);
    try {
      await expect(loadDashboardInputs(context)).resolves.toBe(expected);
      expect(spy).toHaveBeenCalledWith(context);
    } finally {
      spy.mockRestore();
    }
  });
});
