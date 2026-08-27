import { queryOptions } from "@tanstack/react-query";
import { getChatHistory } from "@/lib/chat.functions";
import { calculateBreakEven, type BreakEvenInput } from "@/lib/break-even.functions";
import { getDashboardSummary } from "@/lib/dashboard.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { runSimulation } from "@/lib/financial.functions";
import { listProductsWithMetrics, listPurchasePrices } from "@/lib/products.functions";

// staleTime por natureza do dado (plano §17.5):
const AGGREGATE_STALE_TIME = 60_000; // agregados/dashboard: custo de agregação alto e mudança lenta
const OPERATIONAL_STALE_TIME = 30_000; // listas operacionais: precisam refletir ações recentes do usuário
const REALTIME_STALE_TIME = 0; // chat: quase em tempo real, sempre considerado stale

const authenticatedQueryPolicy = {
  staleTime: OPERATIONAL_STALE_TIME,
  retry: false,
} as const;

export type FinancialSimulationInput = {
  price: string | null;
  unitCost: string | null;
  fixedExpenses: string | null;
  volume: string | null;
  taxRate: string | null;
  fees: Array<{ percentage: string | null }>;
  volumeSource: "real" | "manual_simulation" | "forecast" | "unknown";
};

export const queryKeys = {
  productsWithMetrics: () => ["products", "with-metrics"] as const,
  expenses: () => ["expenses"] as const,
  dashboardSummary: () => ["dashboard", "summary"] as const,
  purchasePrices: () => ["products", "purchase-prices"] as const,
  chatHistory: () => ["chat", "history"] as const,
  breakEven: (input: BreakEvenInput) => ["break-even", input] as const,
  financialSimulation: (input: FinancialSimulationInput) =>
    [
      "financial-simulation",
      input.price,
      input.unitCost,
      input.fixedExpenses,
      input.volume,
      input.taxRate,
      input.fees.map((fee) => fee.percentage),
      input.volumeSource,
    ] as const,
} as const;

export function productsWithMetricsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.productsWithMetrics(),
    queryFn: () => listProductsWithMetrics(),
    ...authenticatedQueryPolicy,
  });
}

export function expensesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.expenses(),
    queryFn: () => listExpenses(),
    ...authenticatedQueryPolicy,
  });
}

export function dashboardSummaryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.dashboardSummary(),
    queryFn: () => getDashboardSummary(),
    ...authenticatedQueryPolicy,
    staleTime: AGGREGATE_STALE_TIME,
  });
}

export function purchasePricesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.purchasePrices(),
    queryFn: () => listPurchasePrices(),
    ...authenticatedQueryPolicy,
  });
}

export function chatHistoryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.chatHistory(),
    queryFn: () => getChatHistory(),
    ...authenticatedQueryPolicy,
    staleTime: REALTIME_STALE_TIME,
  });
}

export function breakEvenQueryOptions(input: BreakEvenInput) {
  return queryOptions({
    queryKey: queryKeys.breakEven(input),
    queryFn: () => calculateBreakEven({ data: input }),
    ...authenticatedQueryPolicy,
    retry: false,
  });
}

export function financialSimulationQueryOptions(input: FinancialSimulationInput) {
  return queryOptions({
    queryKey: queryKeys.financialSimulation(input),
    queryFn: () => runSimulation({ data: input }),
    ...authenticatedQueryPolicy,
  });
}
