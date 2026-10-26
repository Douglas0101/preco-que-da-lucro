import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteProduct } from "@/lib/products.functions";
import { unwrapServerFn } from "@/lib/server-fn-envelope";
import { productsWithMetricsQueryOptions } from "@/lib/query-options";
import { brl, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PlusCircle, Trash2, MessageCircle, Package, Tag, Pencil } from "lucide-react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** Badge sistemático de qualidade do dado (plano mestre §18.2). */
  dataQuality: "real" | "incomplete";
}

function Produtos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const productsQuery = useQuery(productsWithMetricsQueryOptions());
  const archiveProductMutation = useMutation({
    mutationFn: (id: string) => unwrapServerFn(deleteProduct({ data: { id } })),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products", "with-metrics"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] }),
      ]);
      toast.success("Produto arquivado");
      setPendingDeleteId(null);
    },
    onError: () => toast.error("Não foi possível arquivar o produto"),
  });
  const rows = useMemo(() => {
    const products = productsQuery.data ?? [];
    const enriched: Row[] = [];
    for (const { product: p, metrics: c, completeness } of products) {
      // Incomplete permanece "—"; invalid chega ao formatter como NaN e vira
      // "Erro de cálculo", sem mascarar falha numérica como ausência.
      const unavailableMetric = c.status === "invalid" ? Number.NaN : null;
      enriched.push({
        id: p.id,
        name: p.name,
        current_price: p.current_price,
        unitCost: c.status === "ok" ? c.value.unitCost : unavailableMetric,
        cmPct: c.status === "ok" ? c.value.contributionMarginPct : unavailableMetric,
        dataQuality: completeness.status === "complete" ? "real" : "incomplete",
      });
    }
    return enriched;
  }, [productsQuery.data]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Meus Produtos</h1>
            <p className="text-muted-foreground">{productCountLabel(rows.length)}</p>
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

        <ProductListContent
          isPending={productsQuery.isPending}
          isError={productsQuery.isError}
          rows={rows}
          onRetry={() => void productsQuery.refetch()}
          onView={(id) => navigate({ to: "/diagnostico", search: { produto: id } })}
          onCompose={(id) => navigate({ to: "/produtos/composicao", search: { produto: id } })}
          onDelete={setPendingDeleteId}
        />
      </div>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* Honestidade: o servidor ARQUIVA (`archiveProduct` -> status 'archived'),
                nao exclui. O texto anterior prometia exclusao permanente e irreversivel
                — promessa que o comportamento nao cumpria (medido 2026-10-18). */}
            <AlertDialogTitle>Arquivar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              O produto sai do catálogo ativo. O histórico de vendas e simulações que o referencia é
              preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {/* Sem `variant="destructive"`: a acao e reversivel no dado (arquivo, nao
                exclusao), e vermelho aqui seria a mentira inversa. */}
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId !== null) archiveProductMutation.mutate(pendingDeleteId);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function productCountLabel(count: number): string {
  const noun = count === 1 ? "produto" : "produtos";
  return `${count} ${noun} cadastrado${count === 1 ? "" : "s"}`;
}

function ProductListContent({
  isPending,
  isError,
  rows,
  onRetry,
  onView,
  onCompose,
  onDelete,
}: Readonly<{
  isPending: boolean;
  isError: boolean;
  rows: Row[];
  onRetry: () => void;
  onView: (id: string) => void;
  onCompose: (id: string) => void;
  onDelete: (id: string) => void;
}>) {
  if (isPending) return <ProdutosSkeleton />;
  if (isError) {
    return (
      <Card role="alert" className="border-destructive/40">
        <CardContent className="space-y-3 p-5">
          <p>Não foi possível carregar os produtos.</p>
          <Button type="button" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="grid place-items-center gap-3 p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary">
            <Package className="h-6 w-6" />
          </div>
          <div className="font-semibold">Você ainda não tem produtos</div>
          <Button nativeButton={false} render={<Link to="/novo-produto" />} className="mt-2 gap-2">
            <MessageCircle className="h-4 w-4" /> Cadastrar primeiro produto
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <Card key={row.id} className="lift hover:shadow-md">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate">{row.name}</span>
                {row.dataQuality === "real" ? (
                  <Badge variant="secondary" className="shrink-0">
                    REAL
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    title="Faltam dados para o cálculo completo. Abra o produto para ver o que falta."
                    className="shrink-0 border-amber-500/60 text-amber-700 dark:text-amber-400"
                  >
                    DADOS INCOMPLETOS
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Custo: {row.unitCost == null ? "—" : brl(row.unitCost)} · Preço:{" "}
                {row.current_price == null ? "—" : brl(Number(row.current_price))} ·{" "}
                <span className={marginClass(row.cmPct)}>
                  Margem: {row.cmPct == null ? "—" : pct(row.cmPct)}
                </span>
              </div>
            </div>
            {/* No mobile as ações quebram para a própria linha; sem isso o
                bloco de texto (`min-w-0 flex-1`) colapsa a 0px e o nome do
                produto some atrás do `truncate` (medido em 390px). */}
            <div className="flex gap-2 max-sm:w-full max-sm:justify-end">
              <Button variant="outline" size="sm" onClick={() => onView(row.id)}>
                Ver
              </Button>
              {/* Caminho manual de edicao da composicao: o mesmo dado que a IA edita
                  no chat, sem depender do assistente (paridade exigida pelo dono). */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                aria-label={`Editar composição de ${row.name}`}
                onClick={() => onCompose(row.id)}
              >
                <Pencil className="h-4 w-4" /> Composição
              </Button>
              {/* `outline` em vez de `ghost`: com fundo e borda transparentes o controle
                  parecia decoracao e nao se anunciava como acao (medido 2026-10-18:
                  36x36, background e borderColor rgba(0,0,0,0)). O icone segue
                  `destructive` e o aria-label nomeia a acao real (arquivar). */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => onDelete(row.id)}
                aria-label={`Arquivar ${row.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProdutosSkeleton() {
  return (
    <LoadingSkeleton className="grid gap-3">
      {[0, 1, 2].map((row) => (
        <Card key={row}>
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-64 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-9 w-9" />
            </div>
          </CardContent>
        </Card>
      ))}
    </LoadingSkeleton>
  );
}

function marginClass(value: number | null): string {
  if (value == null || value > 0)
    return value != null && value > 30 ? "text-success font-medium" : "";
  return "text-destructive";
}
