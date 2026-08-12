import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { deleteProduct, listProductsWithMetrics } from "@/lib/products.functions";
import { brl, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2, MessageCircle, Package, Tag } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Meus Produtos · Preço que Dá Lucro" },
      { name: "description", content: "Lista dos seus produtos e margens." },
    ],
  }),
  component: Produtos,
});

interface Row {
  id: string;
  name: string;
  current_price: string | null;
  unitCost: number | null;
  cmPct: number | null;
}

function Produtos() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const products = await listProductsWithMetrics();
    const enriched: Row[] = [];
    for (const { product: p, metrics: c } of products) {
      // Incomplete permanece "—"; invalid chega ao formatter como NaN e vira
      // "Erro de cálculo", sem mascarar falha numérica como ausência.
      const unavailableMetric = c.status === "invalid" ? Number.NaN : null;
      enriched.push({
        id: p.id,
        name: p.name,
        current_price: p.current_price,
        unitCost: c.status === "ok" ? c.value.unitCost : unavailableMetric,
        cmPct: c.status === "ok" ? c.value.contributionMarginPct : unavailableMetric,
      });
    }
    setRows(enriched);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function del(id: string) {
    try {
      await deleteProduct({ data: { id } });
    } catch {
      return toast.error("Não foi possível arquivar o produto");
    }
    toast.success("Produto arquivado");
    load();
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Meus Produtos</h1>
            <p className="text-muted-foreground">
              {rows.length} produto{rows.length !== 1 ? "s" : ""} cadastrado
              {rows.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              render={<Link to="/precos" />}
              variant="outline"
              className="gap-2"
            >
              <Tag className="h-4 w-4" /> Preços de compra
            </Button>
            <Button nativeButton={false} render={<Link to="/novo-produto" />} className="gap-2">
              <PlusCircle className="h-4 w-4" /> Novo produto
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="grid place-items-center gap-3 p-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div className="font-semibold">Você ainda não tem produtos</div>
              <Button
                nativeButton={false}
                render={<Link to="/novo-produto" />}
                className="mt-2 gap-2"
              >
                <MessageCircle className="h-4 w-4" /> Cadastrar primeiro produto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => (
              <Card
                key={r.id}
                className="transition hover:shadow-[var(--shadow-elevated)] motion-reduce:transition-none"
              >
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{r.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Custo: {r.unitCost == null ? "—" : brl(r.unitCost)} · Preço:{" "}
                      {r.current_price == null ? "—" : brl(Number(r.current_price))} ·{" "}
                      <span
                        className={
                          r.cmPct == null
                            ? ""
                            : r.cmPct > 30
                              ? "text-success font-medium"
                              : r.cmPct > 0
                                ? ""
                                : "text-destructive"
                        }
                      >
                        Margem: {r.cmPct == null ? "—" : pct(r.cmPct)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate({ to: "/diagnostico", search: { produto: r.id } })}
                    >
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDeleteId(r.id)}
                      aria-label={`Excluir ${r.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto selecionado será excluído permanentemente. Esta ação não poderá ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId !== null) void del(pendingDeleteId);
              }}
            >
              Excluir produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
