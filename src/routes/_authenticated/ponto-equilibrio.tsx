import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { listProductsWithMetrics } from "@/lib/products.functions";
import { expensesQueryOptions, productsWithMetricsQueryOptions } from "@/lib/query-options";
import {
  calculateBreakEvenUnits,
  calculateBreakEvenRevenue,
  calculateRequiredSalesForProfit,
  sumFiniteNumbers,
  type ProductComputation,
} from "@/lib/finance";
import { brl, pct, num } from "@/lib/format";
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

function PontoEquilibrio() {
  const [details, setDetails] = useState<ProductDetail[]>([]);
  const products = details.map((detail) => detail.product);
  const [productId, setProductId] = useState<string>("");
  const [fixed, setFixed] = useState(0);
  const [metrics, setMetrics] = useState<
    (ProductComputation & { price: number; name: string }) | null
  >(null);
  const [calculationStatus, setCalculationStatus] = useState<
    "idle" | "incomplete" | "invalid" | "ok"
  >("idle");
  const [profitTarget, setProfitTarget] = useState("");
  const [productsQuery, expensesQuery] = useQueries({
    queries: [productsWithMetricsQueryOptions(), expensesQueryOptions()],
  });

  useEffect(() => {
    if (!productsQuery.data || !expensesQuery.data) return;
    const loadedDetails = productsQuery.data;
    const expenses = expensesQuery.data;
    setDetails(loadedDetails);
    setFixed(
      sumFiniteNumbers(
        expenses
          .filter((expense) => expense.type === "fixa")
          .map((expense) => Number(expense.amount)),
      ),
    );
    if (loadedDetails.length) setProductId(loadedDetails[0].product.id);
  }, [expensesQuery.data, productsQuery.data]);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const detail = details.find((item) => item.product.id === productId);
      if (!detail) return;
      const p = detail.product;
      setMetrics(null);
      setCalculationStatus("idle");
      const c = detail.metrics;
      if (c.status !== "ok") {
        setMetrics(null);
        setCalculationStatus(c.status);
        return;
      }
      setMetrics({ ...c.value, price: Number(p.current_price), name: p.name });
      setCalculationStatus("ok");
    })();
  }, [productId, details]);

  const be = useMemo(() => {
    if (!metrics) return null;
    const units = calculateBreakEvenUnits(fixed, metrics.contributionMargin);
    const revenue = calculateBreakEvenRevenue(fixed, metrics.contributionMarginPct);
    const target = Number(profitTarget.replace(",", "."));
    const targetUnits =
      Number.isFinite(target) && target > 0
        ? calculateRequiredSalesForProfit(fixed, target, metrics.contributionMargin)
        : null;
    const rawTargetRevenue =
      targetUnits?.status === "reachable" ? targetUnits.roundedUnits * metrics.price : null;
    const targetRevenue =
      rawTargetRevenue == null
        ? null
        : Number.isFinite(rawTargetRevenue)
          ? rawTargetRevenue
          : Number.NaN;
    return { units, revenue, targetUnits, targetRevenue };
  }, [metrics, fixed, profitTarget]);

  if (productsQuery.isPending || expensesQuery.isPending) {
    return (
      <div role="status" className="text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (productsQuery.isError || expensesQuery.isError) {
    return (
      <Card role="alert" className="border-destructive/40">
        <CardContent className="space-y-3 p-5">
          <p>Não foi possível carregar os dados do ponto de equilíbrio.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void productsQuery.refetch();
              void expensesQuery.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

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
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="ponto-equilibrio-produto">
                <SelectValue placeholder="Escolha um produto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ponto-equilibrio-despesas-fixas">Despesas fixas / mês</Label>
            <Input id="ponto-equilibrio-despesas-fixas" value={brl(fixed)} readOnly />
          </div>
        </CardContent>
      </Card>

      {!metrics ? (
        <div
          role={calculationStatus === "invalid" ? "alert" : undefined}
          className={calculationStatus === "invalid" ? "text-destructive" : "text-muted-foreground"}
        >
          {calculationStatus === "invalid"
            ? "Erro de cálculo. Revise os valores numéricos do produto."
            : calculationStatus === "incomplete"
              ? "Dados incompletos. Preencha os campos financeiros do produto."
              : "Cadastre um produto para calcular."}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Preço de venda" value={brl(metrics.price)} />
            <Metric label="Custo unitário" value={brl(metrics.unitCost)} />
            <Metric
              label="Margem de contribuição"
              value={`${brl(metrics.contributionMargin)} (${pct(metrics.contributionMarginPct)})`}
            />
          </div>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Seu ponto de equilíbrio</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Você precisa vender</div>
                <div className="text-3xl font-black">
                  {be!.units.status === "reachable"
                    ? `${num(be!.units.roundedUnits, 0)} un.`
                    : be!.units.status === "unreachable"
                      ? "Não atingível"
                      : "Erro de cálculo"}
                </div>
                {be!.units.status === "reachable" && (
                  <div className="text-sm text-muted-foreground">
                    Resultado bruto: {num(be!.units.rawUnits, 2)}; arredondado para venda inteira.
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Faturamento necessário
                </div>
                <div className="text-3xl font-black">
                  {be!.units.status === "unreachable" ? "Não atingível" : brl(be!.revenue)}
                </div>
              </div>
              <p className="md:col-span-2 text-sm text-muted-foreground">
                Considerando os dados informados, sua empresa precisa atingir esse volume de vendas
                mensais para cobrir despesas fixas e chegar ao ponto de equilíbrio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quanto preciso vender para atingir meu lucro?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1 max-w-xs">
                <Label htmlFor="ponto-equilibrio-lucro-desejado">Lucro desejado / mês (R$)</Label>
                <Input
                  id="ponto-equilibrio-lucro-desejado"
                  inputMode="decimal"
                  value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  placeholder="Ex: 3000"
                />
              </div>
              {be?.targetUnits?.status === "reachable" && (
                <div className="rounded-xl bg-secondary p-4">
                  Para obter <strong>{brl(Number(profitTarget.replace(",", ".")))}</strong> de lucro
                  / mês, você precisa vender aproximadamente{" "}
                  <strong>{num(be.targetUnits.roundedUnits, 0)} unidades</strong> (faturamento de{" "}
                  <strong>{brl(be.targetRevenue)}</strong>).
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
