import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { listProductsWithMetrics } from "@/lib/products.functions";
import {
  breakEvenQueryOptions,
  expensesQueryOptions,
  productsWithMetricsQueryOptions,
} from "@/lib/query-options";
import { deriveProductSelection } from "@/lib/product-selection";
import { brl, pct, num } from "@/lib/format";
import { toDecimalString } from "@/lib/financial-values";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/ponto-equilibrio")({
  head: () => ({
    meta: [
      { title: "Ponto de Equilíbrio · Preço que Dá Lucro" },
      {
        name: "description",
        content: "Descubra quanto você precisa vender para cobrir suas despesas.",
      },
    ],
  }),
  component: PontoEquilibrio,
});

type ProductDetail = Awaited<ReturnType<typeof listProductsWithMetrics>>[number];
type ProductMetricsOk = Extract<ProductDetail["metrics"], { status: "ok" }>;
type CalculationStatus = "idle" | "incomplete" | "invalid" | "ok";
type BreakEvenData = Awaited<
  ReturnType<NonNullable<ReturnType<typeof breakEvenQueryOptions>["queryFn"]>>
>;
type BreakEvenQuery = { isPending: boolean };

function PontoEquilibrio() {
  const [productId, setProductId] = useState<string>("");
  const [profitTarget, setProfitTarget] = useState("");
  const [productsQuery, expensesQuery] = useQueries({
    queries: [productsWithMetricsQueryOptions(), expensesQueryOptions()],
  });

  const details = productsQuery.data ?? [];
  const { products, selectedProductId, selectedDetail } = deriveProductSelection(
    details,
    productId,
  );
  const fixedExpenseAmounts = (expensesQuery.data ?? [])
    .filter((expense) => expense.type === "fixa")
    .map((expense) => expense.amount);
  const metrics =
    selectedDetail?.metrics.status === "ok"
      ? selectedDetail.metrics
      : (null as ProductMetricsOk | null);
  const selectedPrice = selectedDetail?.product.current_price ?? null;
  const calculationStatus: CalculationStatus = selectedDetail?.metrics.status ?? "idle";

  const breakEvenInput = createBreakEvenInput(
    metrics,
    selectedPrice,
    fixedExpenseAmounts,
    profitTarget,
  );
  const breakEvenQuery = useQuery({
    ...breakEvenQueryOptions(
      breakEvenInput ?? {
        fixedExpenses: [],
        price: "0",
        contributionMargin: "0",
        contributionMarginPct: "0",
        desiredProfit: null,
        unitMode: "discrete",
      },
    ),
    enabled: breakEvenInput !== null,
  });
  const be = breakEvenQuery.data ?? null;

  if (productsQuery.isPending || expensesQuery.isPending) {
    return <output className="text-muted-foreground">Carregando...</output>;
  }
  if (productsQuery.isError || expensesQuery.isError) {
    return (
      <PontoErrorState
        onRetry={() => {
          void productsQuery.refetch();
          void expensesQuery.refetch();
        }}
      />
    );
  }
  return (
    <PontoView
      products={products}
      productId={selectedProductId}
      onProductChange={setProductId}
      fixedExpenses={breakEvenQuery.data?.fixedExpenses}
      metrics={metrics}
      selectedPrice={selectedPrice}
      calculationStatus={calculationStatus}
      breakEvenQuery={breakEvenQuery}
      breakEven={be}
      profitTarget={profitTarget}
      onProfitTargetChange={setProfitTarget}
    />
  );
}

function createBreakEvenInput(
  metrics: ProductMetricsOk | null,
  selectedPrice: string | null,
  fixedExpenses: string[],
  profitTarget: string,
) {
  if (!metrics || selectedPrice === null) return null;
  return {
    fixedExpenses,
    price: selectedPrice,
    contributionMargin: toDecimalString(metrics.value.contributionMargin, 8),
    contributionMarginPct: toDecimalString(metrics.value.contributionMarginPct, 8),
    desiredProfit: profitTarget.trim() === "" ? null : toApiDecimal(profitTarget),
    unitMode: "discrete" as const,
  };
}

function PontoErrorState({ onRetry }: Readonly<{ onRetry: () => void }>) {
  return (
    <Card role="alert" className="border-destructive/40">
      <CardContent className="space-y-3 p-5">
        <p>Não foi possível carregar os dados do ponto de equilíbrio.</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  );
}

function PontoView({
  products,
  productId,
  onProductChange,
  fixedExpenses,
  metrics,
  selectedPrice,
  calculationStatus,
  breakEvenQuery,
  breakEven,
  profitTarget,
  onProfitTargetChange,
}: Readonly<{
  products: ProductDetail["product"][];
  productId: string;
  onProductChange: (value: string) => void;
  fixedExpenses: string | null | undefined;
  metrics: ProductMetricsOk | null;
  selectedPrice: string | null;
  calculationStatus: CalculationStatus;
  breakEvenQuery: BreakEvenQuery;
  breakEven: BreakEvenData | null;
  profitTarget: string;
  onProfitTargetChange: (value: string) => void;
}>) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Ponto de Equilíbrio</h1>
        <p className="text-muted-foreground">
          Quanto você precisa vender para cobrir suas despesas fixas.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="ponto-equilibrio-produto">Produto</Label>
            <Select value={productId} onValueChange={onProductChange}>
              <SelectTrigger id="ponto-equilibrio-produto">
                <SelectValue placeholder="Escolha um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ponto-equilibrio-despesas-fixas">Despesas fixas / mês</Label>
            <Input id="ponto-equilibrio-despesas-fixas" value={brl(fixedExpenses)} readOnly />
          </div>
        </CardContent>
      </Card>
      {metrics ? (
        <PontoMetrics
          metrics={metrics}
          selectedPrice={selectedPrice}
          breakEvenQuery={breakEvenQuery}
          breakEven={breakEven}
          profitTarget={profitTarget}
          onProfitTargetChange={onProfitTargetChange}
        />
      ) : (
        <CalculationState status={calculationStatus} />
      )}
    </div>
  );
}

function CalculationState({ status }: Readonly<{ status: CalculationStatus }>) {
  const message = {
    invalid: "Erro de cálculo. Revise os valores numéricos do produto.",
    incomplete: "Dados incompletos. Preencha os campos financeiros do produto.",
    idle: "Cadastre um produto para calcular.",
    ok: "Cadastre um produto para calcular.",
  }[status];
  return (
    <div
      role={status === "invalid" ? "alert" : undefined}
      className={status === "invalid" ? "text-destructive" : "text-muted-foreground"}
    >
      {message}
    </div>
  );
}

function PontoMetrics({
  metrics,
  selectedPrice,
  breakEvenQuery,
  breakEven,
  profitTarget,
  onProfitTargetChange,
}: Readonly<{
  metrics: ProductMetricsOk;
  selectedPrice: string | null;
  breakEvenQuery: BreakEvenQuery;
  breakEven: BreakEvenData | null;
  profitTarget: string;
  onProfitTargetChange: (value: string) => void;
}>) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Preço de venda" value={brl(selectedPrice)} />
        <Metric label="Custo unitário" value={brl(metrics.value.unitCost)} />
        <Metric
          label="Margem de contribuição"
          value={`${brl(metrics.value.contributionMargin)} (${pct(metrics.value.contributionMarginPct)})`}
        />
      </div>
      <BreakEvenCard query={breakEvenQuery} result={breakEven} />
      <ProfitTargetCard
        result={breakEven}
        profitTarget={profitTarget}
        onProfitTargetChange={onProfitTargetChange}
      />
    </>
  );
}

function BreakEvenCard({
  query,
  result,
}: Readonly<{ query: BreakEvenQuery; result: PontoMetricsProps["breakEven"] }>) {
  const unitsLabel = breakEvenUnitsLabel(query.isPending, result);
  const revenueLabel = breakEvenRevenueLabel(result);
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle>Seu ponto de equilíbrio</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Você precisa vender</div>
          <div className="text-3xl font-black">{unitsLabel}</div>
          {result?.units.status === "reachable" && (
            <div className="text-sm text-muted-foreground">
              Resultado bruto: {num(result.units.rawUnits, 2)}; arredondado para venda inteira.
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Faturamento necessário</div>
          <div className="text-3xl font-black">{revenueLabel}</div>
        </div>
        <p className="md:col-span-2 text-sm text-muted-foreground">
          Considerando os dados informados, sua empresa precisa atingir esse volume de vendas
          mensais para cobrir despesas fixas e chegar ao ponto de equilíbrio.
        </p>
      </CardContent>
    </Card>
  );
}

function breakEvenUnitsLabel(isPending: boolean, result: PontoMetricsProps["breakEven"]): string {
  if (isPending) return "Calculando...";
  if (result?.units.status === "reachable") return `${num(result.units.roundedUnits, 0)} un.`;
  if (result?.units.status === "unreachable") return "Não atingível";
  return "Erro de cálculo";
}

function breakEvenRevenueLabel(result: PontoMetricsProps["breakEven"]): string {
  if (result?.units.status === "unreachable") return "Não atingível";
  return brl(result?.revenue);
}

type PontoMetricsProps = Parameters<typeof PontoMetrics>[0];

function ProfitTargetCard({
  result,
  profitTarget,
  onProfitTargetChange,
}: Readonly<{
  result: PontoMetricsProps["breakEven"];
  profitTarget: string;
  onProfitTargetChange: (value: string) => void;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quanto preciso vender para atingir meu lucro?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-w-xs space-y-1">
          <Label htmlFor="ponto-equilibrio-lucro-desejado">Lucro desejado / mês (R$)</Label>
          <Input
            id="ponto-equilibrio-lucro-desejado"
            inputMode="decimal"
            value={profitTarget}
            onChange={(event) => onProfitTargetChange(event.target.value)}
            placeholder="Ex: 3000"
          />
        </div>
        {result?.targetUnits?.status === "reachable" && (
          <div className="rounded-xl bg-secondary p-4">
            Para obter <strong>{brl(profitTarget)}</strong> de lucro / mês, você precisa vender
            aproximadamente <strong>{num(result.targetUnits.roundedUnits, 0)} unidades</strong>{" "}
            (faturamento de <strong>{brl(result.targetRevenue)}</strong>).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}

function toApiDecimal(value: string): string {
  return value.trim().replace(",", ".");
}
