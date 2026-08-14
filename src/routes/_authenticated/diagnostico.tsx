import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { listProductsWithMetrics } from "@/lib/products.functions";
import { expensesQueryOptions, productsWithMetricsQueryOptions } from "@/lib/query-options";
import {
  calculateBreakEvenUnits,
  calculatePriceFormation,
  computeProductCost,
  sumFiniteNumbers,
  type CalculationResult,
  type BreakEvenResult,
  type FeeRow,
  type ProductComputation,
  type ProductCostComputation,
} from "@/lib/finance";
import { brl, num, pct } from "@/lib/format";
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
import { AlertTriangle, Info, TrendingUp } from "lucide-react";

type DiagnosticAlert = { level: "warn" | "info" | "danger"; text: string };
type LoadStatus = "loading" | "ready" | "empty" | "error";
type ProductStatus = "idle" | "loading" | "incomplete" | "invalid" | "error" | "ok";

interface CurrentAnalysis {
  computation: ProductComputation;
  price: number;
  breakEvenUnits: BreakEvenResult;
  alerts: DiagnosticAlert[];
}

interface DiagnosticData {
  cost: CalculationResult<ProductCostComputation>;
  currentStatus: "incomplete" | "invalid" | "ok";
  currentAnalysis: CurrentAnalysis | null;
  currentPrice: number | null;
  taxRate: number | null;
  fees: FeeRow[];
  market: Awaited<ReturnType<typeof listProductsWithMetrics>>[number]["market"];
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
  const [details, setDetails] = useState<Awaited<ReturnType<typeof listProductsWithMetrics>>>([]);
  const products = details.map((detail) => detail.product);
  const [productId, setProductId] = useState(produto ?? "");
  const [fixedExpenses, setFixedExpenses] = useState(0);
  const [hasUnallocatedVariableExpenses, setHasUnallocatedVariableExpenses] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [productStatus, setProductStatus] = useState<ProductStatus>("idle");
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [assumptions, setAssumptions] = useState({
    nonPercentageVariableUnitCost: "",
    targetContributionRate: "",
  });
  const [productsQuery, expensesQuery] = useQueries({
    queries: [productsWithMetricsQueryOptions(), expensesQueryOptions()],
  });

  useEffect(() => {
    if (productsQuery.isPending || expensesQuery.isPending) {
      setLoadStatus("loading");
      return;
    }
    if (productsQuery.isError || expensesQuery.isError) {
      setLoadStatus("error");
      return;
    }

    const loadedDetails = productsQuery.data;
    const expenses = expensesQuery.data;
    const fixed = sumFiniteNumbers(
      expenses
        .filter((expense) => expense.type === "fixa")
        .map((expense) => Number(expense.amount)),
    );

    setDetails(loadedDetails);
    setFixedExpenses(fixed);
    setHasUnallocatedVariableExpenses(expenses.some((expense) => expense.type === "variavel"));
    if (loadedDetails.length === 0) {
      setProductId("");
      setLoadStatus("empty");
      return;
    }

    setProductId((current) =>
      loadedDetails.some((detail) => detail.product.id === current)
        ? current
        : loadedDetails[0].product.id,
    );
    setLoadStatus("ready");
  }, [
    expensesQuery.data,
    expensesQuery.isError,
    expensesQuery.isPending,
    productsQuery.data,
    productsQuery.isError,
    productsQuery.isPending,
  ]);

  useEffect(() => {
    if (loadStatus !== "ready" || !productId) return;

    let cancelled = false;
    setDiagnostic(null);
    setProductStatus("loading");
    setAssumptions({
      nonPercentageVariableUnitCost: "",
      targetContributionRate: "",
    });

    try {
      const detail = details.find((candidate) => candidate.product.id === productId);
      if (!detail) {
        setProductStatus("error");
      } else {
        const result = buildDiagnostic(detail, fixedExpenses);
        setDiagnostic(result.diagnostic);
        setProductStatus(result.status);
      }
    } catch {
      if (cancelled) return;
      setDiagnostic(null);
      setProductStatus("error");
    }

    return () => {
      cancelled = true;
    };
  }, [details, fixedExpenses, loadStatus, productId]);

  const priceFormation = useMemo(() => {
    if (!diagnostic) return null;
    const directUnitCost = directUnitCostFrom(diagnostic.cost);
    return calculatePriceFormation({
      directUnitCost,
      nonPercentageVariableUnitCost: parseOptionalNumber(assumptions.nonPercentageVariableUnitCost),
      taxRate: diagnostic.taxRate,
      fees: diagnostic.fees,
      targetContributionRate: parseOptionalNumber(assumptions.targetContributionRate),
      marketReference: nullableNumber(diagnostic.market?.avg_price),
    });
  }, [assumptions, diagnostic]);

  const assumptionStatusId = "price-formation-assumptions-status";
  const variableCostHasIssue =
    priceFormation != null &&
    (resultHasField(priceFormation.minimumSustainablePrice, "nonPercentageVariableUnitCost") ||
      resultHasField(priceFormation.targetMarginPrice, "nonPercentageVariableUnitCost"));
  const targetRateHasIssue =
    priceFormation != null &&
    resultHasField(priceFormation.targetMarginPrice, "targetContributionRate");
  const variableCostIsInvalid =
    priceFormation?.minimumSustainablePrice.status === "invalid" &&
    resultHasField(priceFormation.minimumSustainablePrice, "nonPercentageVariableUnitCost");
  const targetRateIsInvalid =
    priceFormation?.targetMarginPrice.status === "invalid" &&
    resultHasField(priceFormation.targetMarginPrice, "targetContributionRate");
  const hasInvalidPriceFormation =
    priceFormation?.minimumSustainablePrice.status === "invalid" ||
    priceFormation?.targetMarginPrice.status === "invalid";
  const hasIncompletePriceFormation =
    priceFormation?.minimumSustainablePrice.status === "incomplete" ||
    priceFormation?.targetMarginPrice.status === "incomplete";
  const hasInvalidMarketReference = priceFormation?.marketReference.status === "invalid";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Meu Diagnóstico</h1>
        <p className="text-muted-foreground">
          Cálculos e simulações com as premissas financeiras informadas.
        </p>
      </div>

      {loadStatus === "loading" && (
        <output className="text-muted-foreground">Carregando produtos e despesas...</output>
      )}
      {loadStatus === "error" && (
        <RemoteErrorState message="Não foi possível carregar os dados do diagnóstico." />
      )}
      {loadStatus === "empty" && (
        <output className="text-muted-foreground">
          Cadastre um produto para gerar o diagnóstico.
        </output>
      )}

      {products.length > 0 && loadStatus !== "error" && (
        <Card>
          <CardContent className="max-w-md p-5">
            <Label htmlFor="diagnostico-produto" className="sr-only">
              Produto para diagnóstico
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="diagnostico-produto">
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
          </CardContent>
        </Card>
      )}

      {loadStatus === "ready" && !diagnostic && <ProductState status={productStatus} />}

      {diagnostic && priceFormation && (
        <>
          {diagnostic.currentStatus === "invalid" && (
            <div role="alert" className="rounded-xl border border-destructive/40 p-4 font-medium">
              Erro no diagnóstico do preço atual. Revise os valores numéricos deste produto.
            </div>
          )}
          {diagnostic.currentStatus === "incomplete" && (
            <output className="rounded-xl border p-4 text-muted-foreground">
              O diagnóstico do preço atual está incompleto, mas os custos conhecidos e a referência
              de mercado continuam disponíveis abaixo.
            </output>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Premissas da formação de preço</CardTitle>
              <p className="text-sm text-muted-foreground">
                Simulação local não salva. Os campos começam vazios e são limpos ao trocar de
                produto.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <AssumptionField
                id="diagnostico-custo-variavel-unitario"
                label="Outros custos variáveis por unidade (R$)"
                help="Informe somente um valor já conhecido por unidade; não use o total mensal. Digite 0 apenas se tiver confirmado que não existem outros custos unitários."
                value={assumptions.nonPercentageVariableUnitCost}
                describedBy={variableCostHasIssue ? assumptionStatusId : undefined}
                invalid={variableCostIsInvalid}
                onChange={(value) =>
                  setAssumptions({ ...assumptions, nonPercentageVariableUnitCost: value })
                }
              />
              <AssumptionField
                id="diagnostico-margem-alvo"
                label="Margem de contribuição alvo (%)"
                help="Informe uma meta explícita. Nenhuma margem padrão é presumida."
                value={assumptions.targetContributionRate}
                describedBy={targetRateHasIssue ? assumptionStatusId : undefined}
                invalid={targetRateIsInvalid}
                onChange={(value) =>
                  setAssumptions({ ...assumptions, targetContributionRate: value })
                }
              />
              {hasInvalidPriceFormation && (
                <div
                  id={assumptionStatusId}
                  role="alert"
                  className="rounded-xl border border-destructive/40 p-4 font-medium md:col-span-2"
                >
                  Erro de cálculo. Revise os custos, as taxas e a margem alvo informada.
                </div>
              )}
              {!hasInvalidPriceFormation && hasIncompletePriceFormation && (
                <div
                  id={assumptionStatusId}
                  aria-live="polite"
                  className="rounded-xl border p-4 text-sm text-muted-foreground md:col-span-2"
                >
                  Complete as premissas manuais e os dados financeiros necessários para liberar cada
                  cálculo. Valores ausentes não são tratados como zero.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Kpi
              label="Custo unitário calculado"
              value={formatCostResult(diagnostic.cost)}
              description="Cálculo do motor financeiro"
            />
            <Kpi
              label="Preço atual informado"
              value={brl(diagnostic.currentPrice)}
              description="Valor praticado cadastrado"
            />
            <Kpi
              label="Preço mínimo para custos unitários"
              value={formatPriceResult(priceFormation.minimumSustainablePrice)}
              description="Cálculo no escopo informado"
            />
            <Kpi
              label="Preço para margem-alvo"
              value={formatPriceResult(priceFormation.targetMarginPrice)}
              description="Simulação não salva"
            />
            <Kpi
              label="Preço médio de mercado informado"
              value={formatPriceResult(priceFormation.marketReference)}
              description="Referência externa sem fonte estruturada"
            />
          </div>

          {hasInvalidMarketReference && (
            <div role="alert" className="rounded-xl border border-destructive/40 p-4 font-medium">
              A referência de mercado informada contém um valor numérico inválido.
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Escopo dos preços calculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                O preço mínimo cobre somente o custo unitário, os outros custos variáveis por
                unidade informados, impostos e taxas percentuais cadastradas. Ele não garante a
                cobertura das despesas fixas do negócio.
              </p>
              {hasUnallocatedVariableExpenses && (
                <p className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-foreground">
                  Existem despesas variáveis periódicas cadastradas que não entram nestes preços:
                  falta um volume ou direcionador confiável para convertê-las em custo por unidade.
                </p>
              )}
              <p>
                A referência de mercado é contexto informado, não recomendação. Posicionamento,
                qualidade, capacidade e estratégia continuam sendo decisões do usuário.
              </p>
            </CardContent>
          </Card>

          {diagnostic.cost.status === "ok" && (
            <Card>
              <CardHeader>
                <CardTitle>Estrutura financeira</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <Line
                  label="Custo dos ingredientes"
                  value={brl(diagnostic.cost.value.recipeCost)}
                />
                <Line
                  label="Custo de embalagem/materiais"
                  value={brl(diagnostic.cost.value.packagingCost)}
                />
                <Line label="Custo unitário" value={brl(diagnostic.cost.value.unitCost)} />
                <Line label="Despesas fixas cadastradas" value={brl(fixedExpenses)} />
                <Line
                  label="Margem de contribuição atual"
                  value={
                    diagnostic.currentAnalysis
                      ? `${brl(diagnostic.currentAnalysis.computation.contributionMargin)} (${pct(diagnostic.currentAnalysis.computation.contributionMarginPct)})`
                      : "—"
                  }
                />
                <Line
                  label="Ponto de equilíbrio do preço atual"
                  value={
                    diagnostic.currentAnalysis
                      ? diagnostic.currentAnalysis.breakEvenUnits.status === "reachable"
                        ? `${num(diagnostic.currentAnalysis.breakEvenUnits.roundedUnits, 0)} un. (bruto ${num(diagnostic.currentAnalysis.breakEvenUnits.rawUnits, 2)})`
                        : diagnostic.currentAnalysis.breakEvenUnits.status === "unreachable"
                          ? "Não atingível"
                          : "Erro de cálculo"
                      : "—"
                  }
                />
              </CardContent>
            </Card>
          )}

          {diagnostic.currentAnalysis &&
            (diagnostic.currentAnalysis.alerts.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Alertas e interpretações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {diagnostic.currentAnalysis.alerts.map((alert) => (
                    <div
                      key={`${alert.level}-${alert.text}`}
                      className={`flex gap-3 rounded-xl border p-3 text-sm ${
                        alert.level === "danger"
                          ? "border-destructive/40 bg-destructive/5"
                          : alert.level === "warn"
                            ? "border-warning/40 bg-warning/10"
                            : "border-primary/30 bg-secondary"
                      }`}
                    >
                      {alert.level === "danger" ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : alert.level === "warn" ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      ) : (
                        <Info className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <span>{alert.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-success/30">
                <CardContent className="flex items-center gap-3 p-5">
                  <TrendingUp className="h-5 w-5 text-success" />
                  <span>
                    Nenhum alerta foi identificado pelas regras atuais. Continue monitorando os
                    dados e o contexto de mercado.
                  </span>
                </CardContent>
              </Card>
            ))}
        </>
      )}
    </div>
  );
}

type ProductDetail = Awaited<ReturnType<typeof listProductsWithMetrics>>[number];

function buildDiagnostic(
  detail: ProductDetail,
  fixedExpenses: number,
): { diagnostic: DiagnosticData; status: ProductStatus } {
  const product = detail.product;
  const ingredients = detail.ingredients.map((ingredient) => ({
    used_qty: Number(ingredient.used_qty),
    used_unit: ingredient.used_unit,
    package_price: ingredient.package_price == null ? null : Number(ingredient.package_price),
    package_qty: ingredient.package_qty == null ? null : Number(ingredient.package_qty),
    package_unit: ingredient.package_unit,
  }));
  const packaging = detail.packaging.map((item) => ({
    package_price: Number(item.package_price),
    units_per_package: Number(item.units_per_package),
  }));
  const fees = detail.fees.map((fee) => ({
    percentage: Number(fee.percentage) * 100,
  })) satisfies FeeRow[];
  const yieldQty = product.yield_qty == null ? null : Number(product.yield_qty);
  const currentPrice = product.current_price == null ? null : Number(product.current_price);
  const taxRate = product.tax_rate == null ? null : Number(product.tax_rate) * 100;
  const cost = computeProductCost({ ingredients, packaging, yieldQty });
  const current = detail.metrics;
  let currentStatus: DiagnosticData["currentStatus"] = current.status;
  let currentAnalysis: CurrentAnalysis | null = null;

  if (current.status === "ok") {
    const price = currentPrice as number;
    const breakEvenUnits = calculateBreakEvenUnits(fixedExpenses, current.value.contributionMargin);
    if (breakEvenUnits.status === "invalid") {
      currentStatus = "invalid";
    } else {
      const alerts: DiagnosticAlert[] = [];
      if (price < current.value.unitCost) {
        alerts.push({
          level: "danger",
          text: "Seu preço de venda está abaixo do custo unitário. Cada venda gera prejuízo — vale investigar.",
        });
      }
      if (current.value.contributionMarginPct > 0 && current.value.contributionMarginPct < 20) {
        alerts.push({
          level: "warn",
          text: `Margem de contribuição baixa (${pct(current.value.contributionMarginPct)}). Pode representar risco no médio prazo.`,
        });
      }
      if (fixedExpenses > 0 && breakEvenUnits.status === "unreachable") {
        alerts.push({
          level: "warn",
          text: "Com a margem atual, você não cobre as despesas fixas. Pode ser interessante simular preço maior ou custo menor.",
        });
      }

      const marketAverage = nullableNumber(detail.market?.avg_price);
      if (
        marketAverage != null &&
        Number.isFinite(marketAverage) &&
        marketAverage > 0 &&
        price > 0
      ) {
        const difference = ((price - marketAverage) / marketAverage) * 100;
        if (Number.isFinite(difference) && Math.abs(difference) > 20) {
          alerts.push({
            level: "info",
            text: `Seu preço atual está ${difference > 0 ? "acima" : "abaixo"} da referência de mercado informada em ${pct(Math.abs(difference), 1)}. Mercado é contexto; posicionamento, qualidade e capacidade também importam.`,
          });
        }
      }

      currentAnalysis = {
        computation: current.value,
        price,
        breakEvenUnits,
        alerts,
      };
    }
  }

  return {
    diagnostic: {
      cost,
      currentStatus,
      currentAnalysis,
      currentPrice,
      taxRate,
      fees,
      market: detail.market,
    },
    status: currentStatus,
  };
}

function directUnitCostFrom(result: CalculationResult<ProductCostComputation>): number | null {
  return result.status === "ok"
    ? result.value.unitCost
    : result.status === "invalid"
      ? Number.NaN
      : null;
}

function nullableNumber(value: string | number | null | undefined): number | null {
  return value == null ? null : Number(value);
}

function ProductState({ status }: Readonly<{ status: ProductStatus }>) {
  if (status === "error") {
    return <RemoteErrorState message="Não foi possível carregar os dados do produto." />;
  }
  return (
    <output
      role={status === "invalid" ? "alert" : undefined}
      className={
        status === "invalid"
          ? "rounded-xl border border-destructive/40 p-4 font-medium"
          : "text-muted-foreground"
      }
    >
      {status === "invalid"
        ? "Erro de cálculo. Revise os valores numéricos do produto."
        : status === "incomplete"
          ? "Dados incompletos. Os resultados disponíveis serão apresentados separadamente."
          : "Carregando dados do produto..."}
    </output>
  );
}

function AssumptionField({
  id,
  label,
  help,
  value,
  describedBy,
  invalid,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  help: string;
  value: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}>) {
  const helpId = `${id}-help`;
  const descriptionIds = [helpId, describedBy].filter(Boolean).join(" ");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        aria-describedby={descriptionIds}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={helpId} className="text-xs text-muted-foreground">
        {help}
      </p>
    </div>
  );
}

function Kpi({
  label,
  value,
  description,
}: Readonly<{
  label: string;
  value: string;
  description: string;
}>) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-black">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function Line({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function RemoteErrorState({ message }: Readonly<{ message: string }>) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
      <p className="font-medium">{message}</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Tentar novamente
      </Button>
    </div>
  );
}

function resultHasField(result: CalculationResult<number>, field: string): boolean {
  return result.status === "incomplete"
    ? result.missing.some((missing) => missing.field === field)
    : result.status === "invalid"
      ? result.errors.some((error) => error.field === field)
      : false;
}

function formatCostResult(result: CalculationResult<ProductCostComputation>): string {
  return result.status === "ok"
    ? brl(result.value.unitCost)
    : result.status === "invalid"
      ? brl(Number.NaN)
      : brl(null);
}

function formatPriceResult(result: CalculationResult<number>): string {
  return result.status === "ok"
    ? brl(result.value)
    : result.status === "invalid"
      ? brl(Number.NaN)
      : brl(null);
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? null : Number(normalized);
}
