import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardSummaryQueryOptions } from "@/lib/query-options";
import { isDashboardSummaryValid } from "@/lib/dashboard-summary-guard";
import { sessionQueryOptions } from "@/lib/session-context";
import type { ConsolidatedMargin, DashboardPeriod } from "@/lib/dashboard.functions";
import { brl, pct } from "@/lib/format";
import { createErrorReference } from "@/lib/error-reference";
import { CONTRIBUTION_MARGIN_PCT_FORMULA } from "@/lib/calc-explanation";
import { Badge } from "@/components/ui/badge";
import { CalcExplainer } from "@/components/ui/calc-explainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Package,
  PlusCircle,
  Scale,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

const PERIODS: ReadonlyArray<{ value: DashboardPeriod; label: string }> = [
  { value: "month", label: "Mês" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Ano" },
];

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const BUSINESS_MONTH = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});
const WINDOW_DAY = new Intl.DateTimeFormat("pt-BR", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Rótulo `dd/mm/aaaa – dd/mm/aaaa` a partir da janela **atestada pelo servidor**
 * (`summary.window`). Nenhuma fronteira é calculada aqui: `to` é exclusivo, então
 * o último dia que o usuário lê é `to − 1 ms` — uma transformação de exibição,
 * não uma nova janela.
 */
function formatWindowLabel(window: { from: string; to: string }): string {
  const first = new Date(window.from);
  const lastInclusive = new Date(new Date(window.to).getTime() - 1);
  return `${WINDOW_DAY.format(first)} – ${WINDOW_DAY.format(lastInclusive)}`;
}

/**
 * Predicado de calendário, não de janela: o trimestre selecionado começou no mês
 * corrente? Compara no mesmo fuso do servidor para o selo não divergir na virada
 * do mês.
 */
function isSameBusinessMonth(fromIso: string): boolean {
  return BUSINESS_MONTH.format(new Date(fromIso)) === BUSINESS_MONTH.format(new Date());
}

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início · Preço que Dá Lucro" },
      { name: "description", content: "Resumo financeiro do seu negócio." },
    ],
  }),
  // Prefetch não-bloqueante do summary (T2): mesmo queryKey/options de
  // query-options.ts; erro é deglutido aqui para que o useQuery do componente
  // continue exibindo o estado de erro com retry, como hoje.
  // Dynamic import — e não o símbolo estático do topo: o import do topo serve o
  // componente, que é code-split, e o plugin do router o apaga do módulo de
  // referência. Só o dinâmico mantém query-options (+ *.functions/zod) FORA do
  // grafo inicial (orçamento de bundle §17.7) — loaders não são code-split.
  loader: async ({ context }) => {
    const session = context.queryClient.getQueryData(sessionQueryOptions().queryKey);
    if (!session) return null;
    const { dashboardSummaryQueryOptions } = await import("@/lib/query-options");
    return context.queryClient.ensureQueryData(dashboardSummaryQueryOptions()).catch(() => null);
  },
  pendingComponent: InicioSkeleton,
  component: Inicio,
});

interface Metrics {
  productCount: number;
  fixedExpenses: string | null;
  bestProduct: { name: string; cmPct: string } | null;
  hasInvalidCalculation: boolean;
  incompleteProductCount: number;
  alerts: string[];
  period: DashboardPeriod;
  /** Janela factual atestada pelo servidor: `[from, to)` em ISO-8601. */
  window: { from: string; to: string };
  sales: { revenue: string; count: number };
  consolidatedMargin: ConsolidatedMargin;
}

type LoadStatus = "loading" | "ready" | "error";

function loadStatusFor(query: { isPending: boolean; isError: boolean }): LoadStatus {
  if (query.isPending) return "loading";
  if (query.isError) return "error";
  return "ready";
}

function Inicio() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const summaryQuery = useQuery(dashboardSummaryQueryOptions(period));
  const loadStatus = loadStatusFor(summaryQuery);
  const metrics = summaryQuery.data as Metrics | undefined;
  // `keepPreviousData` mantém os números (e o seletor) montados durante a troca
  // de período; `isPlaceholderData` diz que o que está na tela ainda é a janela
  // anterior. Nunca desmontar é o que preserva o foco (DBT-165).
  const isPlaceholderData = summaryQuery.isPlaceholderData;
  const hasInvalidPayload = metrics !== undefined && !isDashboardSummaryValid(metrics, period);
  const errorReference = useMemo(
    () =>
      summaryQuery.isError || hasInvalidPayload
        ? createErrorReference("DASH", summaryQuery.error)
        : null,
    [summaryQuery.isError, summaryQuery.error, hasInvalidPayload],
  );

  if (loadStatus === "loading") {
    return <InicioSkeleton />;
  }

  if (loadStatus === "error" || hasInvalidPayload) {
    return (
      <Card role="alert" className="border-destructive/40">
        <CardContent className="space-y-3 p-5">
          <p className="font-medium">Não foi possível carregar o resumo financeiro.</p>
          {errorReference && (
            <p className="text-xs text-muted-foreground">
              Referência de atendimento: {errorReference}
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => void summaryQuery.refetch()}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.productCount === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-border p-8 text-center shadow-md md:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight md:text-3xl">Bem-vindo!</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Vamos descobrir juntos quanto custa o seu produto, qual preço faz sentido para o seu
          negócio e quanto você precisa vender para começar a ter lucro.
        </p>
        <Button
          nativeButton={false}
          render={<Link to="/novo-produto" />}
          size="lg"
          className="mt-8 gap-2 px-8 shadow-md"
        >
          <PlusCircle className="h-5 w-5" /> Começar agora
        </Button>
      </div>
    );
  }

  // Depois dos estados de erro/vazio: aqui `metrics` existe e já passou no shape
  // guard. O rótulo deriva da janela atestada pelo servidor.
  const windowLabel = formatWindowLabel(metrics.window);
  // `metrics.period` (atestado pelo servidor), não o estado local: durante o
  // placeholder o selo precisa descrever a janela que está na tela.
  const coincidesWithMonth =
    metrics.period === "quarter" && isSameBusinessMonth(metrics.window.from);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 p-5 shadow-sm md:p-6">
        <h1 className="text-3xl font-black tracking-tight">Olá! 👋</h1>
        <p className="mt-1 text-muted-foreground">
          Resumo dos dados cadastrados e das vendas reais, sem presumir volume.
        </p>
      </div>

      {metrics.hasInvalidCalculation && (
        <Card role="alert" className="border-destructive/40">
          <CardContent className="p-4 font-medium">
            Erro de cálculo. Revise os valores numéricos dos produtos e despesas.
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="inicio-invariante" className="space-y-3">
        <div>
          <h2
            id="inicio-invariante"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Seu negócio agora
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro e ficha técnica. Estes números não mudam com o período selecionado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            icon={Package}
            label="Produtos"
            value={String(metrics.productCount)}
            description="Cadastro. Não varia por período."
            explain={
              <p>
                Contagem direta dos produtos cadastrados na sua conta. É um dado cadastral: nenhum
                volume de vendas é presumido e o período selecionado não muda este número.
              </p>
            }
          />
          <MetricCard
            icon={Wallet}
            label="Despesas fixas por mês"
            value={brl(metrics.fixedExpenses)}
            description="Compromisso mensal. Não varia por período."
            explain={
              <>
                <p>
                  <span className="font-medium">Fórmula:</span> soma das despesas cadastradas com
                  tipo «fixa», por mês.
                </p>
                <p>
                  O valor é mensal e não é multiplicado pelo período selecionado: o trimestre ou o
                  ano em curso ainda não têm meses futuros realizados, e multiplicar seria presumir
                  um compromisso que ninguém registrou.
                </p>
                <p>
                  Despesas variáveis ficam de fora: elas dependem do quanto você vende. Uma despesa
                  com valor inválido deixa este indicador indisponível e acende o card de erro no
                  topo da página.
                </p>
              </>
            }
          />
        </div>
      </section>

      <section
        aria-labelledby="inicio-realizado"
        aria-busy={isPlaceholderData}
        className="space-y-3"
      >
        <div>
          <h2
            id="inicio-realizado"
            className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Realizado no período
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Só vendas reais registradas. A janela vem do servidor e é a mesma para os dois números.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted p-1"
            role="group"
            aria-label="Período do faturamento"
          >
            {PERIODS.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={period === item.value ? "default" : "outline"}
                aria-pressed={period === item.value}
                onClick={() => setPeriod(item.value)}
                className={
                  period === item.value
                    ? "rounded-full text-sm shadow-sm"
                    : "rounded-full border-transparent bg-transparent text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {item.label}
              </Button>
            ))}
          </div>
          <p
            aria-live="polite"
            className="text-sm font-medium tabular-nums text-muted-foreground"
            data-testid="period-window"
          >
            <span className="sr-only">Janela do período: </span>
            {windowLabel}
          </p>
        </div>

        {coincidesWithMonth && (
          <Badge
            variant="outline"
            className="w-fit"
            title="O trimestre corrente começou neste mês, então a janela do trimestre é a mesma do mês."
          >
            Coincidente com o mês atual
          </Badge>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {metrics.sales.count > 0 ? (
            <MetricCard
              icon={Scale}
              label="Faturamento real"
              value={brl(metrics.sales.revenue)}
              description={`${metrics.sales.count} venda(s) na janela ${windowLabel}.`}
              explain={
                <>
                  <p>
                    <span className="font-medium">Fórmula:</span> soma das vendas registradas na
                    janela exibida acima ({windowLabel}).
                  </p>
                  <p>
                    Só entram vendas já registradas: nenhum volume é presumido, projetado ou
                    estimado neste número.
                  </p>
                </>
              }
            />
          ) : (
            <MetricCard
              icon={Scale}
              label="Faturamento real"
              value="—"
              description="Nenhuma venda real registrada."
              explain={
                <p>
                  Sem vendas registradas na janela exibida não há o que somar: o card mostra «—» em
                  vez de presumir um volume. Vendas da simulação e estimativas não entram neste
                  total.
                </p>
              }
            />
          )}
          <ConsolidatedMarginCard
            margin={metrics.consolidatedMargin}
            salesCount={metrics.sales.count}
            windowLabel={windowLabel}
          />
        </div>
      </section>

      {metrics.bestProduct && (
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle className="text-base">🏆 Maior margem unitária calculável</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-primary-strong text-2xl font-black tracking-tight tabular-nums">
              {metrics.bestProduct.name}
            </div>
            <div className="text-muted-foreground">
              Margem de contribuição unitária: {pct(metrics.bestProduct.cmPct)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Indicador unitário da ficha técnica. Não varia por período.
            </p>
            {metrics.incompleteProductCount > 0 && (
              <div className="mt-2 text-sm text-muted-foreground">
                Comparação limitada aos produtos com dados completos.
              </div>
            )}
            <CalcExplainer className="mt-3">
              <p>
                O destaque é o produto com a <span className="font-medium">maior</span> margem de
                contribuição unitária em %, entre os que têm dados completos. Produtos com dados
                incompletos ficam fora da comparação; em caso de empate permanece o primeiro produto
                avaliado.
              </p>
              <p>
                <span className="font-medium">Fórmula:</span> {CONTRIBUTION_MARGIN_PCT_FORMULA} — a
                margem de contribuição unitária é preço − custo unitário − custo variável unitário
                (imposto e taxas percentuais).
              </p>
            </CalcExplainer>
          </CardContent>
        </Card>
      )}

      {metrics.alerts.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Alertas financeiros
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
        <Button
          nativeButton={false}
          render={<Link to="/novo-produto" />}
          className="gap-2 shadow-md"
        >
          <PlusCircle className="h-4 w-4" /> Novo produto
        </Button>
        <Button nativeButton={false} render={<Link to="/diagnostico" />} variant="outline">
          Ver diagnóstico completo
        </Button>
      </div>
    </div>
  );
}

const MARGIN_UNAVAILABLE_BADGE = (
  <Badge
    variant="outline"
    title="A margem consolidada está indisponível: um dado factual necessário está ausente."
    className="shrink-0 border-amber-500/60 text-amber-700 dark:text-amber-400"
  >
    DADOS INCOMPLETOS
  </Badge>
);

// Estado vazio não é dado incompleto: nada falta, apenas não há venda registrada
// na janela. ADR-041 §3 distingue os três estados; a apresentação também precisa.
const EMPTY_MARGIN_BADGE = (
  <Badge variant="secondary" title="Nenhuma venda real registrada na janela." className="shrink-0">
    SEM VENDAS
  </Badge>
);

function ConsolidatedMarginCard({
  margin,
  salesCount,
  windowLabel,
}: Readonly<{ margin: ConsolidatedMargin; salesCount: number; windowLabel: string }>) {
  const formula = (
    <>
      <p>
        <span className="font-medium">Fórmula:</span> (faturamento real − custo das unidades
        vendidas − impostos e taxas sobre os valores vendidos) ÷ faturamento real do período.
      </p>
      <p>
        A margem é ponderada pelo mix real de vendas — quantas unidades de{" "}
        <span className="font-medium">cada</span> produto foram vendidas, não apenas o faturamento
        total — e usa o preço registrado em cada venda e as premissas de custo, impostos e taxas
        atuais dos produtos. Ela não reconstrói custos históricos.
      </p>
    </>
  );
  if (margin.state === "ok") {
    return (
      <MetricCard
        icon={TrendingUp}
        label="Margem consolidada"
        value={pct(margin.valuePct)}
        description={`Margem sobre o faturamento real (${salesCount} venda(s) na janela ${windowLabel}).`}
        explain={formula}
      />
    );
  }
  if (margin.state === "incomplete") {
    const cause = margin.zeroRevenue
      ? "O faturamento real do período é zero; a margem consolidada exige faturamento."
      : margin.salesMismatch
        ? "Os valores das vendas e de seus itens não conciliam. A margem fica indisponível até conferir descontos e ajustes."
        : `${margin.incompleteProductCount} produto(s) vendido(s) sem custo calculável; a margem exige o custo de tudo que foi vendido.`;
    return (
      <MetricCard
        icon={TrendingUp}
        label="Margem consolidada"
        value="—"
        description={cause}
        explain={
          <>
            {formula}
            <p>
              O card fica indisponível em vez de exibir uma margem parcial ou inventada: sem o custo
              de tudo que foi vendido, qualquer número seria um chute.
            </p>
          </>
        }
        badge={MARGIN_UNAVAILABLE_BADGE}
      />
    );
  }
  return (
    <MetricCard
      icon={TrendingUp}
      label="Margem consolidada"
      value="—"
      description="Sem vendas na janela. Registre vendas reais para calcular o mix."
      badge={EMPTY_MARGIN_BADGE}
      explain={
        <>
          {formula}
          <p>
            Sem vendas registradas na janela exibida não há mix para ponderar: o card fica
            indisponível em vez de presumir volume ou exibir uma margem média dos produtos
            cadastrados.
          </p>
        </>
      }
    />
  );
}

function InicioSkeleton() {
  return (
    <LoadingSkeleton className="space-y-6">
      <div className="rounded-2xl border border-primary/20 p-5 md:p-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-2 h-6 w-80 max-w-full" />
      </div>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted p-1">
        {[0, 1, 2].map((period) => (
          <Skeleton key={period} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <Card key={card} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </div>
              <Skeleton className="mt-3 h-9 w-24" />
              <Skeleton className="mt-1 h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
      </div>
    </LoadingSkeleton>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  badge,
  explain,
}: Readonly<{
  icon: typeof Package;
  label: string;
  value: string;
  description?: string;
  badge?: ReactNode;
  explain?: ReactNode;
}>) {
  return (
    <Card className="lift border-border/60 shadow-sm hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {label}
            </div>
            {badge}
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-3xl font-black tabular-nums tracking-tight">{value}</div>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {explain && <CalcExplainer className="mt-3">{explain}</CalcExplainer>}
      </CardContent>
    </Card>
  );
}
