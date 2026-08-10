import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  computeProduct,
  calculateBreakEvenUnits,
  type IngredientRow,
  type PackagingRow,
  type FeeRow,
  type ProductComputation,
} from "@/lib/finance";
import { brl, num, pct } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, TrendingUp, Info } from "lucide-react";

type DiagnosticAlert = { level: "warn" | "info" | "danger"; text: string };

interface ProductAnalysis {
  c: ProductComputation;
  price: number;
  be: number;
  suggestedPrice: number;
  market: Tables<"market_prices"> | null;
  alerts: DiagnosticAlert[];
}

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico · Preço que Dá Lucro" },
      { name: "description", content: "Diagnóstico financeiro completo do seu produto." },
    ],
  }),
  validateSearch: (search): { produto?: string } => ({
    produto: typeof search.produto === "string" ? search.produto : undefined,
  }),
  component: Diagnostico,
});

function Diagnostico() {
  const { produto } = Route.useSearch();
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [productId, setProductId] = useState<string>(produto ?? "");
  const [fixed, setFixed] = useState(0);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);

  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("type", "fixa"),
      ]);
      setProducts(p.data ?? []);
      setFixed((e.data ?? []).reduce((s, x) => s + Number(x.amount), 0));
      setProductId((current) => current || p.data?.[0]?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const p = products.find((x) => x.id === productId);
      if (!p) return;
      const [ing, pack, fees, market] = await Promise.all([
        supabase.from("product_ingredients").select("*").eq("product_id", p.id),
        supabase.from("product_packaging").select("*").eq("product_id", p.id),
        supabase.from("sales_fees").select("*").eq("product_id", p.id),
        supabase
          .from("market_prices")
          .select("*")
          .eq("product_id", p.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const c = computeProduct({
        ingredients: (ing.data ?? []) as unknown as IngredientRow[],
        packaging: (pack.data ?? []) as unknown as PackagingRow[],
        yieldQty: Number(p.yield_qty ?? 1),
        price: Number(p.current_price ?? 0),
        taxRate: Number(p.tax_rate ?? 0),
        fees: (fees.data ?? []) as unknown as FeeRow[],
      });
      if (c.status !== "ok") return;
      const m = c.value;
      const price = Number(p.current_price ?? 0);
      const be = calculateBreakEvenUnits(fixed, m.contributionMargin);
      const suggestedPrice = m.unitCost * 1.5; // sugestão simples: custo × 1,5 como referência
      const alerts: DiagnosticAlert[] = [];
      if (price > 0 && price < m.unitCost)
        alerts.push({
          level: "danger",
          text: "Seu preço de venda está abaixo do custo unitário. Cada venda gera prejuízo — vale investigar.",
        });
      if (m.contributionMarginPct > 0 && m.contributionMarginPct < 20)
        alerts.push({
          level: "warn",
          text: `Margem de contribuição baixa (${pct(m.contributionMarginPct)}). Pode representar risco no médio prazo.`,
        });
      if (fixed > 0 && !Number.isFinite(be))
        alerts.push({
          level: "warn",
          text: "Com a margem atual, você nunca cobre as despesas fixas. Pode ser interessante simular preço maior ou custo menor.",
        });
      const marketAvg = market.data?.avg_price ? Number(market.data.avg_price) : null;
      if (marketAvg && price > 0) {
        const diff = ((price - marketAvg) / marketAvg) * 100;
        if (Math.abs(diff) > 20) {
          alerts.push({
            level: "info",
            text: `Seu preço atual está ${diff > 0 ? "acima" : "abaixo"} do mercado informado em ${pct(Math.abs(diff), 1)}. Preço deve considerar qualidade, público, marca e experiência — vale investigar.`,
          });
        }
      }
      setAnalysis({ c: m, price, be, suggestedPrice, market: market.data, alerts });
    })();
  }, [productId, products, fixed]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Meu Diagnóstico</h1>
        <p className="text-muted-foreground">Análise financeira automática do seu produto.</p>
      </div>

      <Card>
        <CardContent className="p-5 max-w-md">
          <Label htmlFor="diagnostico-produto" className="sr-only">
            Produto para diagnóstico
          </Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger id="diagnostico-produto">
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
        </CardContent>
      </Card>

      {analysis && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Custo unitário" value={brl(analysis.c.unitCost)} />
            <Kpi label="Preço atual" value={analysis.price ? brl(analysis.price) : "—"} />
            <Kpi label="Preço sugerido (custo × 1,5)" value={brl(analysis.suggestedPrice)} />
            <Kpi
              label="Preço médio mercado"
              value={analysis.market?.avg_price ? brl(Number(analysis.market.avg_price)) : "—"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Estrutura financeira</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
              <Line label="Custo dos ingredientes" value={brl(analysis.c.recipeCost)} />
              <Line label="Custo de embalagem/materiais" value={brl(analysis.c.packagingCost)} />
              <Line
                label="Margem de contribuição"
                value={`${brl(analysis.c.contributionMargin)} (${pct(analysis.c.contributionMarginPct)})`}
              />
              <Line label="Despesas fixas / mês" value={brl(fixed)} />
              <Line
                label="Ponto de equilíbrio"
                value={Number.isFinite(analysis.be) ? `${num(analysis.be, 0)} un.` : "—"}
              />
            </CardContent>
          </Card>

          {analysis.alerts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Alertas e recomendações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-xl border p-3 text-sm ${
                      a.level === "danger"
                        ? "border-destructive/40 bg-destructive/5"
                        : a.level === "warn"
                          ? "border-warning/40 bg-warning/10"
                          : "border-primary/30 bg-secondary"
                    }`}
                  >
                    {a.level === "danger" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    ) : a.level === "warn" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span>{a.text}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-success/30">
              <CardContent className="flex items-center gap-3 p-5">
                <TrendingUp className="h-5 w-5 text-success" />
                <span>
                  Os dados indicam saúde financeira. Continue monitorando conforme o mercado muda.
                </span>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
