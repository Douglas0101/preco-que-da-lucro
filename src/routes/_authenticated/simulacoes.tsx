import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { listProductsWithMetrics } from "@/lib/products.functions";
import { expensesQueryOptions, productsWithMetricsQueryOptions } from "@/lib/query-options";
import {
  calculateScenario,
  sumFiniteNumbers,
  type FeeRow,
  type ProductComputation,
} from "@/lib/finance";
import { brl, num, pct } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/simulacoes")({
  head: () => ({
    meta: [
      { title: "Simulações · Preço que Dá Lucro" },
      { name: "description", content: "Simule preço, custo, despesas e volume." },
    ],
  }),
  component: Simulacoes,
});

type LoadStatus = "loading" | "ready" | "empty" | "error" | "invalid";
type ProductStatus = "idle" | "loading" | "incomplete" | "invalid" | "error" | "ok";

type ProductBaseline = ProductComputation & {
  name: string;
  price: number;
  taxRate: number | null;
  fees: FeeRow[];
};

function Simulacoes() {
  const [details, setDetails] = useState<Awaited<ReturnType<typeof listProductsWithMetrics>>>([]);
  const products = details.map((detail) => detail.product);
  const [productId, setProductId] = useState("");
  const [fixed, setFixed] = useState(0);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [base, setBase] = useState<ProductBaseline | null>(null);
  const [productStatus, setProductStatus] = useState<ProductStatus>("idle");
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [sim, setSim] = useState({ price: "", unitCost: "", fixed: "", volume: "" });
  const [productsQuery, expensesQuery] = useQueries({
    queries: [productsWithMetricsQueryOptions(), expensesQueryOptions()],
  });

  useEffect(() => {
    if (productsQuery.isPending || expensesQuery.isPending) {
      setLoadStatus("loading");
      return;
    }
    if (productsQuery.isError || expensesQuery.isError) {
      setDetails([]);
      setProductId("");
      setErrorReference(createErrorReference("SIM"));
      setLoadStatus("error");
      return;
    }

    const loadedDetails = productsQuery.data;
    const expenses = expensesQuery.data;
    const fixedExpenses = sumFiniteNumbers(
      expenses
        .filter((expense) => expense.type === "fixa")
        .map((expense) => Number(expense.amount)),
    );

    setDetails(loadedDetails);
    setFixed(fixedExpenses);
    if (!Number.isFinite(fixedExpenses)) {
      setLoadStatus("invalid");
      return;
    }
    if (loadedDetails.length === 0) {
      setProductId("");
      setLoadStatus("empty");
      return;
    }

    setProductId(loadedDetails[0].product.id);
    setErrorReference(null);
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
    setBase(null);
    setErrorReference(null);
    setProductStatus("loading");

    void (async () => {
      try {
        const detail = details.find((item) => item.product.id === productId);
        if (!detail) {
          if (!cancelled) {
            setErrorReference(createErrorReference("SIM"));
            setProductStatus("error");
          }
          return;
        }

        const product = detail.product;
        const feeRows = detail.fees.map((fee) => ({
          percentage: Number(fee.percentage) * 100,
        })) satisfies FeeRow[];
        const computation = detail.metrics;
        if (computation.status !== "ok") {
          setProductStatus(computation.status);
          return;
        }

        const price = Number(product.current_price); // pós-guarda: computeProduct validou presença/finitude
        setBase({
          ...computation.value,
          name: product.name,
          price,
          taxRate: product.tax_rate == null ? null : Number(product.tax_rate) * 100,
          fees: feeRows,
        });
        setSim({
          price: String(price),
          unitCost: String(computation.value.unitCost.toFixed(2)),
          fixed: String(fixed),
          volume: "",
        });
        setErrorReference(null);
        setProductStatus("ok");
      } catch {
        if (cancelled) return;
        setBase(null);
        setErrorReference(createErrorReference("SIM"));
        setProductStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [details, fixed, loadStatus, productId]);

  const simulated = useMemo(() => {
    if (!base) return null;
    const parse = (value: string) => {
      const normalized = value.trim().replace(",", ".");
      return normalized === "" ? null : Number(normalized);
    };

    return calculateScenario({
      price: parse(sim.price),
      unitCost: parse(sim.unitCost),
      taxRate: base.taxRate,
      fees: base.fees,
      fixedExpenses: parse(sim.fixed),
      volume: parse(sim.volume),
      volumeSource: "manual_simulation",
    });
  }, [base, sim]);

  const missingFields =
    simulated?.status === "incomplete" ? simulated.missing.map((missing) => missing.field) : [];
  const invalidFields =
    simulated?.status === "invalid"
      ? simulated.errors.flatMap((error) => (error.field ? [error.field] : []))
      : [];
  const issueDescriptionId = "simulation-field-message";
  const describesIssue = (field: string) =>
    missingFields.includes(field) || invalidFields.includes(field);
  const onlyVolumeIsMissing = missingFields.length === 1 && missingFields[0] === "volume";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Simulações</h1>
        <p className="text-muted-foreground">
          Teste uma hipótese informada por você. Sem vendas registradas, nenhum cenário é tratado
          como atual ou factual.
        </p>
      </div>

      {loadStatus === "loading" && (
        <div role="status" className="text-muted-foreground">
          Carregando produtos e despesas...
        </div>
      )}

      {loadStatus === "error" && (
        <RemoteErrorState
          message="Não foi possível carregar os dados financeiros."
          reference={errorReference}
        />
      )}

      {loadStatus === "invalid" && (
        <div role="alert" className="rounded-xl border border-destructive/40 p-4 font-medium">
          Erro de cálculo. Revise os valores numéricos das despesas fixas.
        </div>
      )}

      {loadStatus === "empty" && (
        <div role="status" className="text-muted-foreground">
          Cadastre um produto para criar uma simulação manual.
        </div>
      )}

      {products.length > 0 && loadStatus !== "error" && (
        <Card>
          <CardContent className="p-5">
            <div className="max-w-md space-y-1">
              <Label htmlFor="simulacoes-produto">Produto</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="simulacoes-produto">
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
          </CardContent>
        </Card>
      )}

      {loadStatus === "ready" && !base && (
        <ProductState status={productStatus} errorReference={errorReference} />
      )}

      {base && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProductCard data={base} />
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Simulação manual</CardTitle>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  Simulação manual
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                O volume e os resultados abaixo são hipotéticos e não alimentam KPIs factuais.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                id="simulacao-preco-venda"
                label="Preço de venda simulado (R$)"
                value={sim.price}
                describedBy={describesIssue("price") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("price")}
                onChange={(value) => setSim({ ...sim, price: value })}
              />
              <Field
                id="simulacao-custo-unitario"
                label="Custo unitário simulado (R$)"
                value={sim.unitCost}
                describedBy={describesIssue("unitCost") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("unitCost")}
                onChange={(value) => setSim({ ...sim, unitCost: value })}
              />
              <Field
                id="simulacao-despesas-fixas"
                label="Despesas fixas no escopo simulado (R$)"
                value={sim.fixed}
                describedBy={describesIssue("fixedExpenses") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("fixedExpenses")}
                onChange={(value) => setSim({ ...sim, fixed: value })}
              />
              <Field
                id="simulacao-volume-vendas"
                label="Vendas simuladas (unidades)"
                value={sim.volume}
                describedBy={describesIssue("volume") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("volume")}
                onChange={(value) => setSim({ ...sim, volume: value })}
              />

              {simulated?.status === "incomplete" && (
                <div
                  id={issueDescriptionId}
                  role="status"
                  aria-live="polite"
                  className="mt-3 rounded-xl border p-4 text-sm text-muted-foreground"
                >
                  {onlyVolumeIsMissing
                    ? "Informe o volume da simulação para calcular. Nenhum volume padrão é presumido."
                    : "Preencha os campos indicados da simulação para calcular."}
                </div>
              )}

              {simulated?.status === "invalid" && (
                <div
                  id={issueDescriptionId}
                  role="alert"
                  className="mt-3 rounded-xl border border-destructive/40 p-4 text-sm font-medium"
                >
                  Erro de cálculo. Revise os valores numéricos da simulação.
                </div>
              )}

              {simulated?.status === "ok" && (
                <div
                  role="status"
                  aria-live="polite"
                  className="mt-3 space-y-1 rounded-xl bg-secondary p-4 text-sm"
                >
                  <Row label="Origem do volume" value="Informado manualmente" />
                  <Row label="Volume simulado" value={`${num(simulated.value.volume, 0)} un.`} />
                  <Row
                    label="Margem de contribuição"
                    value={`${brl(simulated.value.contributionMargin)} (${pct(simulated.value.contributionMarginPct)})`}
                  />
                  <Row label="Faturamento simulado" value={brl(simulated.value.revenue)} />
                  <Row
                    label="Resultado operacional simulado dentro do escopo informado"
                    value={brl(simulated.value.result)}
                    accent={simulated.value.result >= 0 ? "success" : "destructive"}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ProductState({
  status,
  errorReference,
}: {
  status: ProductStatus;
  errorReference: string | null;
}) {
  const invalid = status === "invalid";
  const error = status === "error";
  if (error) {
    return (
      <RemoteErrorState
        message="Não foi possível carregar os dados do produto."
        reference={errorReference}
      />
    );
  }
  return (
    <div
      role={invalid ? "alert" : "status"}
      className={
        invalid
          ? "rounded-xl border border-destructive/40 p-4 font-medium"
          : "text-muted-foreground"
      }
    >
      {invalid
        ? "Erro de cálculo. Revise os valores numéricos do produto."
        : status === "incomplete"
          ? "Dados incompletos. Preencha os campos financeiros do produto para simular."
          : "Carregando dados do produto..."}
    </div>
  );
}

function ProductCard({ data }: { data: ProductBaseline }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados unitários do produto</CardTitle>
        <p className="text-sm text-muted-foreground">{data.name}</p>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <Row label="Preço informado" value={brl(data.price)} />
        <Row label="Custo unitário" value={brl(data.unitCost)} />
        <Row label="Custo variável unitário" value={brl(data.variableCost)} />
        <Row
          label="Margem de contribuição unitária"
          value={`${brl(data.contributionMargin)} (${pct(data.contributionMarginPct)})`}
        />
        <div className="mt-4 rounded-xl border p-4 text-muted-foreground">
          Volume real: —. Registre vendas reais antes de usar volume em um KPI factual.
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "destructive";
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-bold text-foreground" : "font-medium"}>{value}</span>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  describedBy,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function RemoteErrorState({ message, reference }: { message: string; reference: string | null }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 p-4">
      <p className="font-medium">{message}</p>
      {reference && (
        <p className="text-xs text-muted-foreground">Referência de atendimento: {reference}</p>
      )}
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Tentar novamente
      </Button>
    </div>
  );
}

function createErrorReference(prefix: string): string {
  const token =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36);
  return `${prefix}-${token}`.toUpperCase();
}
