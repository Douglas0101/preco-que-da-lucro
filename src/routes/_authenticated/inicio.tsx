import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardSummaryQueryOptions } from "@/lib/query-options";
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
  fixedExpenses: string | null;
  bestProduct: { name: string; cmPct: string } | null;
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
}

type LoadStatus = "loading" | "ready" | "error";

function loadStatusFor(query: { isPending: boolean; isError: boolean }): LoadStatus {
  if (query.isPending) return "loading";
  if (query.isError) return "error";
  return "ready";
}

function Inicio() {
  const summaryQuery = useQuery(dashboardSummaryQueryOptions());
  const loadStatus = loadStatusFor(summaryQuery);
  const metrics = summaryQuery.data as Metrics | undefined;
  const errorReference = useMemo(
    () => (summaryQuery.isError ? createErrorReference("DASH") : null),
    [summaryQuery.isError],
  );

  if (loadStatus === "loading") {
    return <output className="text-muted-foreground">Carregando...</output>;
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
        <Button
          nativeButton={false}
          render={<Link to="/novo-produto" />}
          size="lg"
          className="mt-6 gap-2"
        >
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
        <Button nativeButton={false} render={<Link to="/novo-produto" />} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Novo produto
        </Button>
        <Button nativeButton={false} render={<Link to="/diagnostico" />} variant="outline">
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
}: Readonly<{
  icon: typeof Package;
  label: string;
  value: string;
  description?: string;
}>) {
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
