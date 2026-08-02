import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeProduct,
  calculateBreakEvenUnits,
  calculateBreakEvenRevenue,
  calculateRequiredSalesForProfit,
  type IngredientRow,
  type PackagingRow,
  type FeeRow,
} from "@/lib/finance";
import { brl, pct, num } from "@/lib/format";
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

function PontoEquilibrio() {
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [fixed, setFixed] = useState(0);
  const [metrics, setMetrics] = useState<any>(null);
  const [profitTarget, setProfitTarget] = useState("");

  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("type", "fixa"),
      ]);
      setProducts(p.data ?? []);
      setFixed((e.data ?? []).reduce((s, x) => s + Number(x.amount), 0));
      if ((p.data ?? []).length) setProductId(p.data![0].id);
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const p = products.find((x) => x.id === productId);
      if (!p) return;
      const [ing, pack, fees] = await Promise.all([
        supabase.from("product_ingredients").select("*").eq("product_id", p.id),
        supabase.from("product_packaging").select("*").eq("product_id", p.id),
        supabase.from("sales_fees").select("*").eq("product_id", p.id),
      ]);
      const c = computeProduct({
        ingredients: (ing.data ?? []) as unknown as IngredientRow[],
        packaging: (pack.data ?? []) as unknown as PackagingRow[],
        yieldQty: Number(p.yield_qty ?? 1),
        price: Number(p.current_price ?? 0),
        taxRate: Number(p.tax_rate ?? 0),
        fees: (fees.data ?? []) as unknown as FeeRow[],
      });
      setMetrics({ ...c, price: Number(p.current_price ?? 0), name: p.name });
    })();
  }, [productId, products]);

  const be = useMemo(() => {
    if (!metrics) return null;
    const units = calculateBreakEvenUnits(fixed, metrics.contributionMargin);
    const revenue = calculateBreakEvenRevenue(fixed, metrics.contributionMarginPct);
    const target = Number(profitTarget.replace(",", "."));
    const targetUnits =
      Number.isFinite(target) && target > 0
        ? calculateRequiredSalesForProfit(fixed, target, metrics.contributionMargin)
        : null;
    return {
      units,
      revenue,
      targetUnits,
      targetRevenue: targetUnits ? targetUnits * metrics.price : null,
    };
  }, [metrics, fixed, profitTarget]);

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
        <div className="text-muted-foreground">Cadastre um produto para calcular.</div>
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
                  {Number.isFinite(be!.units) ? `${num(be!.units, 0)} un.` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Faturamento necessário
                </div>
                <div className="text-3xl font-black">
                  {Number.isFinite(be!.revenue) ? brl(be!.revenue) : "—"}
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
              {be?.targetUnits && (
                <div className="rounded-xl bg-secondary p-4">
                  Para obter <strong>{brl(Number(profitTarget.replace(",", ".")))}</strong> de lucro
                  / mês, você precisa vender aproximadamente{" "}
                  <strong>{num(be.targetUnits, 0)} unidades</strong> (faturamento de{" "}
                  <strong>{brl(be.targetRevenue!)}</strong>).
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
