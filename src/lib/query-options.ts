import { queryOptions } from "@tanstack/react-query";
import { getChatHistory } from "@/lib/chat.functions";
import { listExpenses } from "@/lib/expenses.functions";
import { listProductsWithMetrics, listPurchasePrices } from "@/lib/products.functions";

const authenticatedQueryPolicy = {
  staleTime: 30_000,
  retry: false,
} as const;

export function productsWithMetricsQueryOptions() {
  return queryOptions({
    queryKey: ["products", "with-metrics"] as const,
    queryFn: () => listProductsWithMetrics(),
    ...authenticatedQueryPolicy,
  });
}

export function expensesQueryOptions() {
  return queryOptions({
    queryKey: ["expenses"] as const,
    queryFn: () => listExpenses(),
    ...authenticatedQueryPolicy,
  });
}

export function purchasePricesQueryOptions() {
  return queryOptions({
    queryKey: ["products", "purchase-prices"] as const,
    queryFn: () => listPurchasePrices(),
    ...authenticatedQueryPolicy,
  });
}

export function chatHistoryQueryOptions() {
  return queryOptions({
    queryKey: ["chat", "history"] as const,
    queryFn: () => getChatHistory(),
    ...authenticatedQueryPolicy,
  });
}
