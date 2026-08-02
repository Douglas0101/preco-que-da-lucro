import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPurchasePrices, updatePurchasePrice } from "@/lib/products.functions";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package, RefreshCw, CalendarClock, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/precos")({
  head: () => ({
    meta: [
      { title: "Atualizar Preços de Compra · Preço que Dá Lucro" },
      {
        name: "description",
        content:
          "Atualize o preço de compra dos seus insumos e embalagens e acompanhe a data da última atualização.",
      },
      { property: "og:title", content: "Atualizar Preços de Compra" },
      {
        property: "og:description",
        content: "Mantenha os custos dos seus produtos sempre atualizados.",
      },
    ],
  }),
  component: Precos,
});

type Item = {
  id: string;
  product_id: string;
  name: string;
  package_price: number | null;
  price_updated_at: string | null;
  kind: "ingrediente" | "embalagem";
  detail: string;
};

const DIAS_ALERTA = 30;

function diasDesde(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function dataBR(iso: string | null) {
  if (!iso) return "nunca atualizado";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Precos() {
  const fetchAll = useServerFn(listPurchasePrices);
  const save = useServerFn(updatePurchasePrice);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchAll();
      setProducts(res.products);
      const all: Item[] = [
        ...res.ingredients.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          name: i.name,
          package_price: i.package_price === null ? null : Number(i.package_price),
          price_updated_at: i.price_updated_at,
          kind: "ingrediente" as const,
          detail:
            i.package_qty && i.package_unit
              ? `embalagem de ${Number(i.package_qty)} ${i.package_unit}`
              : "insumo",
        })),
        ...res.packaging.map((p) => ({
          id: p.id,
          product_id: p.product_id,
          name: p.name,
          package_price: p.package_price === null ? null : Number(p.package_price),
          price_updated_at: p.price_updated_at,
          kind: "embalagem" as const,
          detail: `pacote com ${Number(p.units_per_package ?? 1)} unidade(s)`,
        })),
      ];
      setItems(all);
      setDrafts(
        Object.fromEntries(
          all.map((i) => [i.id, i.package_price === null ? "" : String(i.package_price)]),
        ),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar os preços");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desatualizados = useMemo(
    () =>
      items.filter((i) => {
        const d = diasDesde(i.price_updated_at);
        return d === null || d > DIAS_ALERTA;
      }).length,
    [items],
  );

  const grupos = useMemo(
    () =>
      products
        .map((p) => ({ ...p, itens: items.filter((i) => i.product_id === p.id) }))
        .filter((g) => g.itens.length > 0),
    [products, items],
  );

  async function salvar(item: Item) {
    const raw = (drafts[item.id] ?? "").replace(",", ".").trim();
    const valor = Number(raw);
    if (raw === "" || Number.isNaN(valor) || valor < 0) {
      toast.error("Informe um preço válido");
      return;
    }
    setSavingId(item.id);
    try {
      const res = await save({ data: { id: item.id, kind: item.kind, package_price: valor } });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, package_price: valor, price_updated_at: res.price_updated_at }
            : i,
        ),
      );
      toast.success(`Preço de ${item.name} atualizado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar o preço");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black">Atualizar Preços de Compra</h1>
        <p className="text-muted-foreground">
          Quando o preço de um insumo muda, atualize aqui. Seus custos e margens são recalculados
          automaticamente.
        </p>
      </div>

      {!loading && items.length > 0 && desatualizados > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{desatualizados}</strong> item(ns) com preço sem atualização há mais de{" "}
            {DIAS_ALERTA} dias. Vale conferir se o valor ainda está correto.
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-3 p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div className="font-semibold">Nenhum insumo cadastrado ainda</div>
            <p className="text-sm text-muted-foreground">
              Cadastre um produto pelo chat para começar a acompanhar os preços de compra.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-4 w-4 text-primary" /> {g.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {g.itens.map((item) => {
                  const dias = diasDesde(item.price_updated_at);
                  const velho = dias === null || dias > DIAS_ALERTA;
                  const inputId = `preco-${item.kind}-${item.id}`;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-end gap-3 rounded-xl border p-3"
                    >
                      <div className="min-w-[10rem] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{item.name}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {item.kind}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">{item.detail}</div>
                        <div
                          className={`mt-1 flex items-center gap-1 text-xs ${
                            velho ? "text-warning" : "text-muted-foreground"
                          }`}
                        >
                          <CalendarClock className="h-3 w-3" />
                          Última atualização: {dataBR(item.price_updated_at)}
                          {dias !== null && dias > 0 && ` (há ${dias} dia${dias > 1 ? "s" : ""})`}
                        </div>
                      </div>

                      <div className="flex items-end gap-2">
                        <div>
                          <Label
                            htmlFor={inputId}
                            className="mb-1 block text-xs text-muted-foreground"
                          >
                            Preço de compra
                          </Label>
                          <Input
                            id={inputId}
                            inputMode="decimal"
                            className="w-32"
                            value={drafts[item.id] ?? ""}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          className="gap-2"
                          onClick={() => salvar(item)}
                          disabled={
                            savingId === item.id ||
                            (drafts[item.id] ?? "").replace(",", ".") ===
                              String(item.package_price ?? "")
                          }
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${savingId === item.id ? "animate-spin" : ""}`}
                          />
                          Atualizar
                        </Button>
                      </div>

                      <div className="w-full text-xs text-muted-foreground sm:w-auto">
                        Valor atual: {item.package_price === null ? "—" : brl(item.package_price)}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
