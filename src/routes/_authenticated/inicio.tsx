import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeProduct,
  sumFiniteNumbers,
  type FeeRow,
  type IngredientRow,
  type PackagingRow,
} from "@/lib/finance";
import { brl, pct } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Package,
  PlusCircle,
  Scale,
  Sparkles,
  TrendingUp,
  Wallet,
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
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
}

type LoadStatus = "loading" | "ready" | "error";

function Inicio() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [productsResult, expensesResult] = await Promise.all([
          supabase.from("products").select("*"),
          supabase.from("expenses").select("*"),
        ]);
        if (cancelled) return;

        if (productsResult.error || expensesResult.error) {
          setMetrics(null);
          setErrorReference(createErrorReference("DASH"));
          setLoadStatus("error");
          return;
        }

        const products = productsResult.data ?? [];
        const expenses = expensesResult.data ?? [];
        const fixedExpenses = sumFiniteNumbers(
          expenses
            .filter((expense) => expense.type === "fixa")
            .map((expense) => Number(expense.amount)),
        );

        let bestProduct: { name: string; cmPct: number } | null = null;
        let invalidProductCount = 0;
        let incompleteProductCount = 0;
        const alerts: string[] = [];

        for (const product of products) {
          const [ingredientsResult, packagingResult, feesResult] = await Promise.all([
            supabase.from("product_ingredients").select("*").eq("product_id", product.id),
            supabase.from("product_packaging").select("*").eq("product_id", product.id),
            supabase.from("sales_fees").select("*").eq("product_id", product.id),
          ]);
          if (cancelled) return;

          if (ingredientsResult.error || packagingResult.error || feesResult.error) {
            setMetrics(null);
            setErrorReference(createErrorReference("DASH"));
            setLoadStatus("error");
            return;
          }

          const computation = computeProduct({
            ingredients: (ingredientsResult.data ?? []) as unknown as IngredientRow[],
            packaging: (packagingResult.data ?? []) as unknown as PackagingRow[],
            yieldQty: product.yield_qty == null ? null : Number(product.yield_qty),
            price: product.current_price == null ? null : Number(product.current_price),
            taxRate: product.tax_rate == null ? null : Number(product.tax_rate),
            fees: (feesResult.data ?? []) as unknown as FeeRow[],
          });

          if (computation.status === "invalid") {
            invalidProductCount += 1;
            continue;
          }
          if (computation.status === "incomplete") {
            incompleteProductCount += 1;
            continue;
          }

          if (!bestProduct || computation.value.contributionMarginPct > bestProduct.cmPct) {
            bestProduct = {
              name: product.name,
              cmPct: computation.value.contributionMarginPct,
            };
          }
          if (Number(product.current_price) < computation.value.unitCost) {
            alerts.push(`"${product.name}": preço de venda abaixo do custo unitário.`);
          }
          if (
            computation.value.contributionMarginPct > 0 &&
            computation.value.contributionMarginPct < 15
          ) {
            alerts.push(
              `"${product.name}": margem de contribuição baixa (${pct(computation.value.contributionMarginPct)}).`,
            );
          }
        }

        if (incompleteProductCount > 0) {
          alerts.unshift(
            `${incompleteProductCount} produto(s) não participa(m) dos destaques por ter dados incompletos.`,
          );
        }

        const hasInvalidCalculation = invalidProductCount > 0 || !Number.isFinite(fixedExpenses);

        setMetrics({
          productCount: products.length,
          fixedExpenses,
          bestProduct: hasInvalidCalculation ? null : bestProduct,
          hasInvalidCalculation,
          incompleteProductCount,
          alerts,
        });
        setErrorReference(null);
        setLoadStatus("ready");
      } catch {
        if (cancelled) return;
        setMetrics(null);
        setErrorReference(createErrorReference("DASH"));
        setLoadStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadStatus === "loading") {
    return (
      <div role="status" className="text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <Card role="alert" className="border-destructive/40">
        <CardContent className="space-y-3 p-5">
          <p className="font-medium">Não foi possível carregar o resumo financeiro.</p>
          {errorReference && (
            <p className="text-xs text-muted-foreground">
              Referência de atendimento: {errorReference}
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.productCount === 0) {
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
        <p className="text-muted-foreground">
          Resumo dos dados cadastrados, sem presumir vendas ou faturamento real.
        </p>
      </div>

      {metrics.hasInvalidCalculation && (
        <Card role="alert" className="border-destructive/40">
          <CardContent className="p-4 font-medium">
            Erro de cálculo. Revise os valores numéricos dos produtos e despesas.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Package} label="Produtos" value={String(metrics.productCount)} />
        <MetricCard
          icon={Wallet}
          label="Despesas fixas cadastradas"
          value={brl(metrics.fixedExpenses)}
        />
        <MetricCard
          icon={Scale}
          label="Faturamento real"
          value="—"
          description="Nenhuma venda real registrada."
        />
        <MetricCard
          icon={TrendingUp}
          label="Margem consolidada"
          value="—"
          description="Mix real de vendas indisponível."
        />
      </div>

      {metrics.bestProduct && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">🏆 Maior margem unitária calculável</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{metrics.bestProduct.name}</div>
            <div className="text-muted-foreground">
              Margem de contribuição unitária: {pct(metrics.bestProduct.cmPct)}
            </div>
            {metrics.incompleteProductCount > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Comparação limitada aos produtos com dados completos.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {metrics.alerts.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas financeiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {metrics.alerts.map((alert) => (
                <li key={alert}>{alert}</li>
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
  description,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  description?: string;
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
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

function createErrorReference(prefix: string): string {
  const token =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  return `${prefix}-${token}`.toUpperCase();
}
