import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeProduct,
  type IngredientRow,
  type PackagingRow,
  type FeeRow,
  calculateBreakEvenUnits,
  calculateBreakEvenRevenue,
} from "@/lib/finance";
import { brl, pct } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  PlusCircle,
  Wallet,
  Scale,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início · Preço que Dá Lucro" },
      { name: "description", content: "Resumo financeiro do seu negócio." },
    ],
  }),
  component: Inicio,
});

interface Metrics {
  productCount: number;
  fixedExpenses: number;
  bestProduct: { name: string; cmPct: number } | null;
  totalRevenue: number;
  breakEvenRevenue: number;
  avgCmPct: number;
  alerts: string[];
}

function Inicio() {
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    (async () => {
      const [prodRes, expRes] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("expenses").select("*"),
      ]);
      const products = prodRes.data ?? [];
      const expenses = expRes.data ?? [];
      const fixedExpenses = expenses
        .filter((e: any) => e.type === "fixa")
        .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      let best: { name: string; cmPct: number } | null = null;
      let sumCmPct = 0;
      let totalRevenue = 0;
      const alerts: string[] = [];

      for (const p of products as any[]) {
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
        sumCmPct += c.contributionMarginPct;
        totalRevenue += Number(p.current_price ?? 0);
        if (!best || c.contributionMarginPct > best.cmPct) {
          best = { name: p.name, cmPct: c.contributionMarginPct };
        }
        if (p.current_price && Number(p.current_price) < c.unitCost) {
          alerts.push(`"${p.name}": preço de venda abaixo do custo unitário.`);
        }
        if (c.contributionMarginPct > 0 && c.contributionMarginPct < 15) {
          alerts.push(
            `"${p.name}": margem de contribuição baixa (${pct(c.contributionMarginPct)}).`,
          );
        }
      }

      const avgCmPct = products.length > 0 ? sumCmPct / products.length : 0;
      const breakEvenRevenue =
        avgCmPct > 0 ? calculateBreakEvenRevenue(fixedExpenses, avgCmPct) : 0;

      setM({
        productCount: products.length,
        fixedExpenses,
        bestProduct: best,
        totalRevenue,
        breakEvenRevenue,
        avgCmPct,
        alerts,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">Carregando...</div>;

  if (!m || m.productCount === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-8 text-center shadow-[var(--shadow-soft)] md:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-black md:text-3xl">Bem-vindo!</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Vamos descobrir juntos quanto custa o seu produto, qual preço faz sentido para o seu
          negócio e quanto você precisa vender para começar a ter lucro.
        </p>
        <Button render={<Link to="/novo-produto" />} size="lg" className="mt-6 gap-2">
          <PlusCircle className="h-5 w-5" /> Começar agora
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Olá! 👋</h1>
        <p className="text-muted-foreground">Aqui está o resumo do seu negócio.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Package} label="Produtos" value={String(m.productCount)} />
        <MetricCard icon={Wallet} label="Despesas fixas / mês" value={brl(m.fixedExpenses)} />
        <MetricCard
          icon={Scale}
          label="Faturamento p/ equilíbrio"
          value={brl(m.breakEvenRevenue)}
        />
        <MetricCard icon={TrendingUp} label="Margem média" value={pct(m.avgCmPct)} />
      </div>

      {m.bestProduct && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">🏆 Produto com maior margem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{m.bestProduct.name}</div>
            <div className="text-muted-foreground">
              Margem de contribuição: {pct(m.bestProduct.cmPct)}
            </div>
          </CardContent>
        </Card>
      )}

      {m.alerts.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas financeiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {m.alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button render={<Link to="/novo-produto" />} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Novo produto
        </Button>
        <Button render={<Link to="/diagnostico" />} variant="outline">
          Ver diagnóstico completo
        </Button>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}
