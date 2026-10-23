import { describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  getChatHistory: vi.fn(),
  getDashboardSummary: vi.fn(),
  listExpenses: vi.fn(),
  listSimulations: vi.fn(),
  runSimulation: vi.fn(),
  listProductsWithMetrics: vi.fn(),
  listPurchasePrices: vi.fn(),
  listProducts: vi.fn(),
  getProduct: vi.fn(),
  listSales: vi.fn(),
}));

vi.mock("@/lib/chat.functions", () => ({ getChatHistory: server.getChatHistory }));
vi.mock("@/lib/dashboard.functions", () => ({
  getDashboardSummary: server.getDashboardSummary,
}));
vi.mock("@/lib/expenses.functions", () => ({ listExpenses: server.listExpenses }));
vi.mock("@/lib/financial.functions", () => ({
  listSimulations: server.listSimulations,
  runSimulation: server.runSimulation,
}));
vi.mock("@/lib/products.functions", () => ({
  listProductsWithMetrics: server.listProductsWithMetrics,
  listPurchasePrices: server.listPurchasePrices,
  listProducts: server.listProducts,
  getProduct: server.getProduct,
}));
vi.mock("@/lib/sales.functions", () => ({ listSales: server.listSales }));
vi.mock("@/lib/server-fn-envelope", () => ({
  unwrapServerFn: (value: unknown) => value,
}));

import {
  AGGREGATE_STALE_TIME,
  OPERATIONAL_STALE_TIME,
  REALTIME_STALE_TIME,
  chatHistoryQueryOptions,
  dashboardSummaryQueryOptions,
  expensesQueryOptions,
  financialSimulationQueryOptions,
  productDetailQueryOptions,
  productsListQueryOptions,
  productsWithMetricsQueryOptions,
  purchasePricesQueryOptions,
  queryKeys,
  salesListQueryOptions,
  savedSimulationsQueryOptions,
} from "@/lib/query-options";

const simulation = {
  price: "10",
  unitCost: "4",
  fixedExpenses: "100",
  volume: "20",
  taxRate: "5",
  fees: [{ percentage: "2" }],
  volumeSource: "real" as const,
};

describe("query options", () => {
  it("maps each factory to its key, stale time and server function", async () => {
    server.listProductsWithMetrics.mockResolvedValueOnce("with-metrics");
    server.getProduct.mockResolvedValueOnce("detail");
    server.listExpenses.mockResolvedValueOnce("expenses");
    server.getDashboardSummary.mockResolvedValueOnce("dashboard");
    server.listProducts.mockResolvedValueOnce("products");
    server.listSales.mockResolvedValueOnce("sales");
    server.listPurchasePrices.mockResolvedValueOnce("prices");
    server.getChatHistory.mockResolvedValueOnce("chat");
    server.runSimulation.mockResolvedValueOnce("simulation");
    server.listSimulations.mockResolvedValueOnce("saved");

    const withMetrics = productsWithMetricsQueryOptions();
    expect(withMetrics.queryKey).toEqual(queryKeys.productsWithMetrics());
    expect(withMetrics.staleTime).toBe(OPERATIONAL_STALE_TIME);
    await expect(withMetrics.queryFn?.({} as never)).resolves.toBe("with-metrics");

    const detail = productDetailQueryOptions("produto-1");
    expect(detail.queryKey).toEqual(queryKeys.productDetail("produto-1"));
    await expect(detail.queryFn?.({} as never)).resolves.toBe("detail");
    expect(server.getProduct).toHaveBeenCalledWith({ data: { id: "produto-1" } });

    const expenses = expensesQueryOptions();
    expect(expenses.queryKey).toEqual(queryKeys.expenses());
    await expect(expenses.queryFn?.({} as never)).resolves.toBe("expenses");

    const dashboard = dashboardSummaryQueryOptions("year");
    expect(dashboard.queryKey).toEqual(queryKeys.dashboardSummary("year"));
    expect(dashboard.staleTime).toBe(AGGREGATE_STALE_TIME);
    await expect(dashboard.queryFn?.({} as never)).resolves.toBe("dashboard");
    expect(server.getDashboardSummary).toHaveBeenCalledWith({ data: { period: "year" } });

    const products = productsListQueryOptions();
    expect(products.queryKey).toEqual(queryKeys.productsList());
    await expect(products.queryFn?.({} as never)).resolves.toBe("products");

    const sales = salesListQueryOptions();
    expect(sales.queryKey).toEqual(queryKeys.salesList());
    await expect(sales.queryFn?.({} as never)).resolves.toBe("sales");

    const prices = purchasePricesQueryOptions();
    expect(prices.queryKey).toEqual(queryKeys.purchasePrices());
    await expect(prices.queryFn?.({} as never)).resolves.toBe("prices");

    const chat = chatHistoryQueryOptions();
    expect(chat.queryKey).toEqual(queryKeys.chatHistory());
    expect(chat.staleTime).toBe(REALTIME_STALE_TIME);
    await expect(chat.queryFn?.({} as never)).resolves.toBe("chat");

    const financial = financialSimulationQueryOptions(simulation);
    expect(financial.queryKey).toEqual(queryKeys.financialSimulation(simulation));
    await expect(financial.queryFn?.({} as never)).resolves.toBe("simulation");
    expect(server.runSimulation).toHaveBeenCalledWith({ data: simulation });

    const saved = savedSimulationsQueryOptions();
    expect(saved.queryKey).toEqual(queryKeys.savedSimulations());
    await expect(saved.queryFn?.({} as never)).resolves.toBe("saved");
  });

  it("defaults the dashboard period to month", () => {
    expect(dashboardSummaryQueryOptions().queryKey).toEqual(queryKeys.dashboardSummary("month"));
  });
});
