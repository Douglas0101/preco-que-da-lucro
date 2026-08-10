import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  calculateScenario,
  computeProduct,
  type IngredientRow,
  type PackagingRow,
  type FeeRow,
  type ScenarioResult,
} from "@/lib/finance";
import { brl, num, pct } from "@/lib/format";
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
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulacoes")({
  head: () => ({
    meta: [
      { title: "Simulações · Preço que Dá Lucro" },
      { name: "description", content: "Simule preço, custo, despesas e volume." },
    ],
  }),
  component: Simulacoes,
});

type BaseScenario = ScenarioResult & {
  name: string;
  volume: number;
  taxRate: number | null;
  fees: FeeRow[];
};

function Simulacoes() {
  const [products, setProducts] = useState<Tables<"products">[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [fixed, setFixed] = useState(0);
  const [base, setBase] = useState<BaseScenario | null>(null);
  const [sim, setSim] = useState({ price: "", unitCost: "", fixed: "", volume: "" });

  useEffect(() => {
    (async () => {
      const [p, e] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("type", "fixa"),
      ]);
      setProducts(p.data ?? []);
      const fx = (e.data ?? []).reduce((s, x) => s + Number(x.amount), 0);
      setFixed(fx);
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
        yieldQty: p.yield_qty == null ? null : Number(p.yield_qty),
        price: p.current_price == null ? null : Number(p.current_price),
        taxRate: p.tax_rate == null ? null : Number(p.tax_rate),
        fees: (fees.data ?? []) as unknown as FeeRow[],
      });
      // TODO(P0-UX): estado vazio distinto para produto incompleto, listando os campos de missing[].
      if (c.status !== "ok") {
        setBase(null);
        return;
      }
      const feeRows = (fees.data ?? []) as unknown as FeeRow[];
      const price = Number(p.current_price); // pós-guarda ok: current_price é não nulo
      const volume = 100;
      const scen = calculateScenario({
        price,
        unitCost: c.value.unitCost,
        taxRate: p.tax_rate == null ? null : Number(p.tax_rate),
        fees: feeRows,
        fixedExpenses: fixed,
        volume,
      });
      if (scen.status !== "ok") {
        setBase(null);
        return;
      }
      setBase({
        ...scen.value,
        name: p.name,
        volume,
        taxRate: p.tax_rate == null ? null : Number(p.tax_rate),
        fees: feeRows,
      });
      setSim({
        price: String(price),
        unitCost: String(c.value.unitCost.toFixed(2)),
        fixed: String(fixed),
        volume: String(volume),
      });
    })();
  }, [productId, products, fixed]);

  const simulated = useMemo(() => {
    if (!base) return null;
    const parse = (v: string) => {
      const normalized = v.trim().replace(",", ".");
      return normalized === "" ? null : Number(normalized);
    };
    const r = calculateScenario({
      price: parse(sim.price),
      unitCost: parse(sim.unitCost),
      taxRate: base.taxRate,
      fees: base.fees,
      fixedExpenses: parse(sim.fixed),
      volume: parse(sim.volume),
    });
    return r.status === "ok" ? r.value : null;
  }, [sim, base]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Simulações</h1>
        <p className="text-muted-foreground">Compare o cenário atual com um cenário simulado.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="space-y-1 max-w-md">
            <Label htmlFor="simulacoes-produto">Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="simulacoes-produto">
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
        </CardContent>
      </Card>

      {!base ? (
        <div className="text-muted-foreground">Cadastre um produto para simular.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <ScenarioCard title="Cenário atual" data={base} />
          <div className="hidden lg:grid place-items-center">
            <ArrowRight className="h-8 w-8 text-primary" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Cenário simulado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field
                id="simulacao-preco-venda"
                label="Preço de venda (R$)"
                value={sim.price}
                onChange={(v) => setSim({ ...sim, price: v })}
              />
              <Field
                id="simulacao-custo-unitario"
                label="Custo unitário (R$)"
                value={sim.unitCost}
                onChange={(v) => setSim({ ...sim, unitCost: v })}
              />
              <Field
                id="simulacao-despesas-fixas"
                label="Despesas fixas (R$)"
                value={sim.fixed}
                onChange={(v) => setSim({ ...sim, fixed: v })}
              />
              <Field
                id="simulacao-volume-vendas"
                label="Vendas (unidades)"
                value={sim.volume}
                onChange={(v) => setSim({ ...sim, volume: v })}
              />
              {simulated && (
                <div className="mt-3 space-y-1 rounded-xl bg-secondary p-4 text-sm">
                  <Row
                    label="Margem de contribuição"
                    value={`${brl(simulated.contributionMargin)} (${pct(simulated.contributionMarginPct)})`}
                  />
                  <Row label="Faturamento" value={brl(simulated.revenue)} />
                  <Row
                    label="Resultado"
                    value={brl(simulated.result)}
                    accent={simulated.result >= 0 ? "success" : "destructive"}
                  />
                  <Row
                    label="Diferença vs. atual"
                    value={brl(simulated.result - base.result)}
                    accent={simulated.result - base.result >= 0 ? "success" : "destructive"}
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

function ScenarioCard({
  title,
  data,
}: {
  title: string;
  data: ScenarioResult & { volume: number };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <Row label="Preço" value={brl(data.price)} />
        <Row label="Custo unitário" value={brl(data.unitCost)} />
        <Row
          label="Margem de contribuição"
          value={`${brl(data.contributionMargin)} (${pct(data.contributionMarginPct)})`}
        />
        <Row label="Vendas" value={`${num(data.volume, 0)} un.`} />
        <Row label="Faturamento" value={brl(data.revenue)} />
        <Row
          label="Resultado"
          value={brl(data.result)}
          accent={data.result >= 0 ? "success" : "destructive"}
        />
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
      <span
        className={
          accent === "success"
            ? "font-bold text-success"
            : accent === "destructive"
              ? "font-bold text-destructive"
              : "font-medium"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
