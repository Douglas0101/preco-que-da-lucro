import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { saveSimulation } from "@/lib/financial.functions";
import {
  expensesQueryOptions,
  financialSimulationQueryOptions,
  productsWithMetricsQueryOptions,
  savedSimulationsQueryOptions,
  type FinancialSimulationInput,
} from "@/lib/query-options";
import { sumFiniteNumbers, type FeeRow, type ProductComputation } from "@/lib/finance";
import { brl, decimalInput, num, pct } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
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

export type ProductBaseline = ProductComputation & {
  name: string;
  price: number;
  taxRate: number | null;
  fees: FeeRow[];
};

type SimulationForm = {
  productId: string;
  price: string;
  unitCost: string;
  fixed: string;
  volume: string;
};

// T5: debounce da simulação manual — runSimulation não dispara a cada tecla.
// Exportado para o teste de race; módulo de rota com exports mistos é
// intencional aqui (helpers do debounce junto da rota que os usa).
/* eslint-disable react-refresh/only-export-components */
export const SIMULATION_DEBOUNCE_MS = 400;

/**
 * Race guard do debounce (T5): cada agendamento ganha uma geração; o timer só
 * aplica se ainda for a geração mais recente (o cleanup do effect cancela o
 * timer anterior). Combinado com a cache key por input do react-query, uma
 * resposta lenta antiga NUNCA sobrescreve a exibição atual.
 */
export function createDebounceScheduler(delayMs: number) {
  let generation = 0;
  return {
    schedule(apply: () => void): () => void {
      generation += 1;
      const scheduled = generation;
      const timer = window.setTimeout(() => {
        if (scheduled === generation) apply();
      }, delayMs);
      return () => window.clearTimeout(timer);
    },
  };
}

const EMPTY_SIMULATION_INPUT: FinancialSimulationInput = {
  price: null,
  unitCost: null,
  fixedExpenses: null,
  volume: null,
  taxRate: null,
  fees: [],
  volumeSource: "manual_simulation",
};

/**
 * Mapeamento puro formulário → input do server fn. Campo vazio vira null
 * (unknown ≠ zero, INV-006/009): nenhum volume padrão é presumido.
 */
export function buildSimulationInput(
  form: SimulationForm,
  base: ProductBaseline | null,
): FinancialSimulationInput {
  return {
    price: toApiDecimal(form.price),
    unitCost: toApiDecimal(form.unitCost),
    fixedExpenses: toApiDecimal(form.fixed),
    volume: toApiDecimal(form.volume),
    taxRate: base?.taxRate == null ? null : String(base.taxRate),
    fees:
      base?.fees.map((fee) => ({
        percentage: fee.percentage == null ? null : String(fee.percentage),
      })) ?? [],
    volumeSource: "manual_simulation" as const,
  };
}

function Simulacoes() {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");
  const [sim, setSim] = useState<SimulationForm>({
    productId: "",
    price: "",
    unitCost: "",
    fixed: "",
    volume: "",
  });
  const [simulationName, setSimulationName] = useState("");
  const [productsQuery, expensesQuery, savedSimulationsQuery] = useQueries({
    queries: [
      productsWithMetricsQueryOptions(),
      expensesQueryOptions(),
      savedSimulationsQueryOptions(),
    ],
  });

  const details = productsQuery.data ?? [];
  const products = details.map((detail) => detail.product);
  const selectedProductId =
    productId && products.some((product) => product.id === productId)
      ? productId
      : (products[0]?.id ?? "");
  const selectedDetail = details.find((detail) => detail.product.id === selectedProductId);
  const fixed = sumFiniteNumbers(
    (expensesQuery.data ?? [])
      .filter((expense) => expense.type === "fixa")
      .map((expense) => Number(expense.amount)),
  );
  const loadStatus: LoadStatus =
    productsQuery.isPending || expensesQuery.isPending
      ? "loading"
      : productsQuery.isError || expensesQuery.isError
        ? "error"
        : !Number.isFinite(fixed)
          ? "invalid"
          : details.length === 0
            ? "empty"
            : "ready";
  const errorReference = useMemo(
    () => (loadStatus === "error" || !selectedDetail ? createErrorReference("SIM") : null),
    [loadStatus, selectedDetail],
  );
  const base = useMemo<ProductBaseline | null>(() => {
    if (loadStatus !== "ready" || !selectedDetail || selectedDetail.metrics.status !== "ok") {
      return null;
    }
    const product = selectedDetail.product;
    return {
      ...selectedDetail.metrics.value,
      name: product.name,
      price: Number(product.current_price),
      taxRate: product.tax_rate == null ? null : Number(product.tax_rate) * 100,
      fees: selectedDetail.fees.map((fee) => ({
        percentage: Number(fee.percentage) * 100,
      })) satisfies FeeRow[],
    };
  }, [loadStatus, selectedDetail]);
  const productStatus: ProductStatus =
    loadStatus !== "ready" || !selectedProductId
      ? "idle"
      : !selectedDetail
        ? "error"
        : selectedDetail.metrics.status;
  const currentSim: SimulationForm =
    sim.productId === selectedProductId
      ? sim
      : {
          productId: selectedProductId,
          price: base ? decimalInput(base.price) : "",
          unitCost: base ? decimalInput(base.unitCost) : "",
          fixed: decimalInput(fixed),
          volume: "",
        };
  const updateSim = (patch: Partial<Omit<SimulationForm, "productId">>) => {
    setSim({ ...currentSim, ...patch, productId: selectedProductId });
  };

  const [debouncedSim, setDebouncedSim] = useState<SimulationForm | null>(null);
  const scheduler = useMemo(() => createDebounceScheduler(SIMULATION_DEBOUNCE_MS), []);
  const latestSimRef = useRef(currentSim);
  latestSimRef.current = currentSim;
  const debouncedSimKey = [
    currentSim.productId,
    currentSim.price,
    currentSim.unitCost,
    currentSim.fixed,
    currentSim.volume,
    base === null ? "idle" : "ready",
  ].join("|");

  useEffect(
    () => scheduler.schedule(() => setDebouncedSim(latestSimRef.current)),
    [scheduler, debouncedSimKey],
  );

  const debouncedInput =
    debouncedSim !== null && base !== null && debouncedSim.productId === selectedProductId
      ? buildSimulationInput(debouncedSim, base)
      : null;
  // Race safety (T5): cada input tem sua própria cache key; a resposta da key
  // antiga escreve só na entrada antiga e a exibição lê a key ATUAL — fora de
  // ordem, o dado stale nunca aparece.
  const simulationQuery = useQuery({
    ...financialSimulationQueryOptions(debouncedInput ?? EMPTY_SIMULATION_INPUT),
    enabled: debouncedInput !== null,
  });
  const simulated = simulationQuery.data ?? null;
  const simulationErrorReference = useMemo(
    () => (simulationQuery.isError ? createErrorReference("SIM") : null),
    [simulationQuery.isError],
  );

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

  const saveSimulationMutation = useMutation({
    mutationFn: () =>
      saveSimulation({
        data: {
          product_id: selectedProductId || null,
          name: simulationName.trim(),
          params: debouncedInput ?? EMPTY_SIMULATION_INPUT,
        },
      }),
    onSuccess: async () => {
      toast.success("Simulação salva");
      setSimulationName("");
      await queryClient.invalidateQueries({ queryKey: ["simulations", "saved"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a simulação"),
  });

  const saveSimulationLabel = saveSimulationMutation.isPending ? "Salvando..." : "Salvar simulação";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Simulações</h1>
        <p className="text-muted-foreground">
          Teste uma hipótese informada por você. Sem vendas registradas, nenhum cenário é tratado
          como atual ou factual.
        </p>
      </div>

      {loadStatus === "loading" && <SimulacoesSkeleton />}

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
        <output className="text-muted-foreground">
          Cadastre um produto para criar uma simulação manual.
        </output>
      )}

      {products.length > 0 && loadStatus !== "error" && (
        <Card>
          <CardContent className="p-5">
            <div className="max-w-md space-y-1">
              <Label htmlFor="simulacoes-produto">Produto</Label>
              <Select value={selectedProductId} onValueChange={setProductId}>
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
                <Badge
                  variant="secondary"
                  className="shrink-0 uppercase"
                  title="Resultado hipotético: não é dado factual e não alimenta KPIs."
                >
                  Simulação
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                O volume e os resultados abaixo são hipotéticos e não alimentam KPIs factuais.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {simulationQuery.isError && (
                <RemoteErrorState
                  message="Não foi possível calcular a simulação."
                  reference={simulationErrorReference}
                />
              )}
              <Field
                id="simulacao-preco-venda"
                label="Preço de venda simulado (R$)"
                value={currentSim.price}
                describedBy={describesIssue("price") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("price")}
                onChange={(value) => updateSim({ price: value })}
              />
              <Field
                id="simulacao-custo-unitario"
                label="Custo unitário simulado (R$)"
                value={currentSim.unitCost}
                describedBy={describesIssue("unitCost") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("unitCost")}
                onChange={(value) => updateSim({ unitCost: value })}
              />
              <Field
                id="simulacao-despesas-fixas"
                label="Despesas fixas no escopo simulado (R$)"
                value={currentSim.fixed}
                describedBy={describesIssue("fixedExpenses") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("fixedExpenses")}
                onChange={(value) => updateSim({ fixed: value })}
              />
              <Field
                id="simulacao-volume-vendas"
                label="Vendas simuladas (unidades)"
                value={currentSim.volume}
                describedBy={describesIssue("volume") ? issueDescriptionId : undefined}
                invalid={invalidFields.includes("volume")}
                onChange={(value) => updateSim({ volume: value })}
              />

              {simulated?.status === "incomplete" && (
                <div
                  id={issueDescriptionId}
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
                <>
                  <output
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
                      accent={simulated.value.resultSign === "negative" ? "destructive" : "success"}
                    />
                  </output>
                  <div className="mt-3 space-y-2">
                    <div className="space-y-1">
                      <Label htmlFor="simulacao-nome" className="text-xs">
                        Nome da simulação
                      </Label>
                      <Input
                        id="simulacao-nome"
                        maxLength={160}
                        value={simulationName}
                        placeholder="Ex.: Margem-alvo de 25%"
                        onChange={(event) => setSimulationName(event.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => saveSimulationMutation.mutate()}
                      disabled={saveSimulationMutation.isPending || simulationName.trim() === ""}
                    >
                      {saveSimulationLabel}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      O servidor recalcula o cenário antes de salvar; o resultado enviado não é
                      reutilizado (INV-009).
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            Simulações salvas
            <Badge
              variant="secondary"
              className="shrink-0 uppercase"
              title="Simulações persistidas como hipótese, nunca dado factual."
            >
              {savedSimulationsQuery.data?.length ?? 0} registro(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {savedSimulationsQuery.isPending && <Skeleton className="h-16 w-full" />}
          {savedSimulationsQuery.isError && (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Não foi possível carregar as simulações salvas.
            </p>
          )}
          {savedSimulationsQuery.isSuccess && (savedSimulationsQuery.data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma simulação salva. Registre uma hipótese acima para revisitar depois.
            </p>
          )}
          {savedSimulationsQuery.isSuccess &&
            (savedSimulationsQuery.data ?? []).map((saved) => (
              <div key={saved.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{saved.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSavedDate(saved.created_at)} · {saved.engine_version}
                  </span>
                </div>
                {saved.result != null &&
                  saved.result.status === "ok" &&
                  typeof saved.result.value === "object" &&
                  saved.result.value !== null &&
                  "revenue" in saved.result.value &&
                  typeof saved.result.value.revenue === "string" && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      Faturamento simulado: {brl(saved.result.value.revenue)}
                    </div>
                  )}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SimulacoesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Card>
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-64 max-w-full" />
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-9 w-36" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProductState({
  status,
  errorReference,
}: Readonly<{
  status: ProductStatus;
  errorReference: string | null;
}>) {
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
  const message = productStateMessage(status);
  if (invalid) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/40 p-4 font-medium">
        {message}
      </div>
    );
  }
  return <output className="text-muted-foreground">{message}</output>;
}

function productStateMessage(status: ProductStatus): string {
  if (status === "incomplete") {
    return "Dados incompletos. Preencha os campos financeiros do produto para simular.";
  }
  return "Carregando dados do produto...";
}

function ProductCard({ data }: Readonly<{ data: ProductBaseline }>) {
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
}: Readonly<{
  label: string;
  value: string;
  accent?: "success" | "destructive";
}>) {
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
}: Readonly<{
  id: string;
  label: string;
  value: string;
  describedBy?: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}>) {
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

function RemoteErrorState({
  message,
  reference,
}: Readonly<{ message: string; reference: string | null }>) {
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

function toApiDecimal(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  return normalized === "" ? null : normalized;
}

function formatSavedDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
