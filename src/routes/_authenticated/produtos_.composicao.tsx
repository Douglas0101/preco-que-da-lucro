import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  deleteFee,
  deleteIngredient,
  deletePackaging,
  updateProduct,
  upsertFee,
  upsertIngredient,
  upsertPackaging,
} from "@/lib/products.functions";
import { unwrapServerFn, ServerFnEnvelopeError } from "@/lib/server-fn-envelope";
import { productDetailQueryOptions, queryKeys } from "@/lib/query-options";
import { QUANTITY_UNITS } from "@/lib/financial-values";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { Pencil, PlusCircle, Trash2, Package, Boxes, Percent, Scale } from "lucide-react";

// Rota FLAT (`produtos_.composicao`): o `_` no segmento desaninha a rota do
// arquivo `produtos.tsx`. Antes ela era FILHA e o pai — que é uma página, não um
// layout, e por isso não tem `<Outlet/>` — nunca montava o filho: a URL mudava
// para /produtos/composicao e a lista do pai ("Meus Produtos") continuava na
// tela. O `_` sai do path/id público (id `/_authenticated/produtos_/composicao`,
// path `/produtos/composicao`) e o botão "Composição" segue apontando certo.
export const Route = createFileRoute("/_authenticated/produtos_/composicao")({
  head: () => ({
    meta: [
      { title: "Composição do produto · Preço que Dá Lucro" },
      {
        name: "description",
        content: "Edite manualmente ingredientes, embalagens, taxas e rendimento do produto.",
      },
    ],
  }),
  validateSearch: (search): { produto?: string } => ({ produto: String(search.produto ?? "") }),
  component: Composicao,
});

const UNIDADES = QUANTITY_UNITS as readonly string[];
const decimal = (value: string) => value.replace(",", ".").trim();

/**
 * Rótulos de remoção por tipo de filho: o diálogo de confirmação e o toast
 * dizem **o que** está sendo removido — "Item removido." escondia o alvo logo
 * abaixo do item que some da lista.
 */
const REMOVE_LABELS: Record<"ingredient" | "packaging" | "fee", { kind: string; removed: string }> =
  {
    ingredient: { kind: "o ingrediente", removed: "Ingrediente removido." },
    packaging: { kind: "a embalagem", removed: "Embalagem removida." },
    fee: { kind: "a taxa", removed: "Taxa removida." },
  };

/** Rótulo do item que está na mira da remoção (`null` = nenhum alvo). */
function removeLabel(kind: "ingredient" | "packaging" | "fee" | null) {
  return kind ? REMOVE_LABELS[kind] : { kind: "o item", removed: "Item removido." };
}

function brl(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Composicao() {
  const { produto } = Route.useSearch();
  // O search do pai é união com o desta rota; depois do guard de vazio o valor é
  // sempre string, e `produtoId` carrega isso para o resto do componente.
  const produtoId = produto ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery(productDetailQueryOptions(produtoId));
  const saveProduct = useServerFn(updateProduct);
  const saveIngredient = useServerFn(upsertIngredient);
  const removeIngredient = useServerFn(deleteIngredient);
  const savePackaging = useServerFn(upsertPackaging);
  const removePackaging = useServerFn(deletePackaging);
  const saveFee = useServerFn(upsertFee);
  const removeFee = useServerFn(deleteFee);

  const [productForm, setProductForm] = useState({
    name: "",
    yield_qty: "",
    yield_unit: "unidade",
  });
  const [ingredientForm, setIngredientForm] = useState({
    id: null as string | null,
    name: "",
    used_qty: "",
    used_unit: "g",
    package_price: "",
    package_qty: "",
    package_unit: "g",
  });
  const [packagingForm, setPackagingForm] = useState({
    id: null as string | null,
    name: "",
    package_price: "",
    units_per_package: "",
  });
  const [feeForm, setFeeForm] = useState({ id: null as string | null, name: "", percentage: "" });
  const [ingredientDialog, setIngredientDialog] = useState(false);
  const [packagingDialog, setPackagingDialog] = useState(false);
  const [feeDialog, setFeeDialog] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "ingredient" | "packaging" | "fee";
    id: string;
    name: string;
  } | null>(null);

  const product = detail.data?.product ?? null;

  useEffect(() => {
    if (!product) return;
    setProductForm({
      name: product.name ?? "",
      yield_qty: product.yield_qty == null ? "" : String(product.yield_qty),
      yield_unit: product.yield_unit ?? "unidade",
    });
  }, [product]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.productDetail(produtoId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.productsWithMetrics() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.productsList() });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const productMutation = useMutation({
    mutationFn: () =>
      unwrapServerFn(
        saveProduct({
          data: {
            id: produtoId,
            version: product?.version ?? 0,
            name: productForm.name.trim(),
            current_price: product?.current_price ?? null,
            yield_qty: productForm.yield_qty === "" ? null : decimal(productForm.yield_qty),
            yield_unit: productForm.yield_unit,
            tax_regime: product?.tax_regime ?? null,
            tax_rate: product?.tax_rate ?? null,
          },
        }),
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Produto atualizado.");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o produto.";
      toast.error(
        /version|CONFLICT|VALIDA/i.test(message)
          ? "O produto mudou em outro lugar. Recarregue a página e tente de novo."
          : message,
      );
    },
  });

  const ingredientMutation = useMutation({
    mutationFn: () =>
      unwrapServerFn(
        saveIngredient({
          data: {
            id: ingredientForm.id ?? undefined,
            product_id: produtoId,
            name: ingredientForm.name.trim(),
            used_qty: decimal(ingredientForm.used_qty),
            used_unit: ingredientForm.used_unit as (typeof QUANTITY_UNITS)[number],
            package_price:
              ingredientForm.package_price === "" ? null : decimal(ingredientForm.package_price),
            package_qty:
              ingredientForm.package_qty === "" ? null : decimal(ingredientForm.package_qty),
            package_unit:
              ingredientForm.package_qty === ""
                ? null
                : (ingredientForm.package_unit as (typeof QUANTITY_UNITS)[number]),
          },
        }),
      ),
    onSuccess: () => {
      invalidate();
      setIngredientDialog(false);
      toast.success(ingredientForm.id ? "Ingrediente atualizado." : "Ingrediente adicionado.");
    },
    onError: (error: unknown) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar o ingrediente.",
      ),
  });

  const packagingMutation = useMutation({
    mutationFn: () =>
      unwrapServerFn(
        savePackaging({
          data: {
            id: packagingForm.id ?? undefined,
            product_id: produtoId,
            name: packagingForm.name.trim(),
            package_price: decimal(packagingForm.package_price),
            units_per_package: decimal(packagingForm.units_per_package),
          },
        }),
      ),
    onSuccess: () => {
      invalidate();
      setPackagingDialog(false);
      toast.success(packagingForm.id ? "Embalagem atualizada." : "Embalagem adicionada.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a embalagem."),
  });

  const feeMutation = useMutation({
    mutationFn: () =>
      unwrapServerFn(
        saveFee({
          data: {
            id: feeForm.id ?? undefined,
            product_id: produtoId,
            name: feeForm.name.trim(),
            percentage: decimal(feeForm.percentage),
          },
        }),
      ),
    onSuccess: () => {
      invalidate();
      setFeeDialog(false);
      toast.success(feeForm.id ? "Taxa atualizada." : "Taxa adicionada.");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a taxa."),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!pendingDelete) return;
      if (pendingDelete.kind === "ingredient")
        await unwrapServerFn(removeIngredient({ data: { id: pendingDelete.id } }));
      if (pendingDelete.kind === "packaging")
        await unwrapServerFn(removePackaging({ data: { id: pendingDelete.id } }));
      if (pendingDelete.kind === "fee")
        await unwrapServerFn(removeFee({ data: { id: pendingDelete.id } }));
    },
    onSuccess: () => {
      invalidate();
      setPendingDelete(null);
      toast.success(removeLabel(pendingDelete?.kind ?? null).removed);
    },
    onError: (error: unknown) => {
      setPendingDelete(null);
      // A recusa legítima (histórico de preços registrado) chega como `CONFLICT`.
      // A mensagem pública do código é genérica ("A operação conflita com o
      // estado atual."), então o motivo — "nada foi apagado" — é dito aqui, sem
      // inventar diagnóstico que o servidor não deu.
      toast.error(
        error instanceof ServerFnEnvelopeError && error.code === "CONFLICT"
          ? "Remoção recusada: este item tem histórico de preços registrado ou outro registro ligado. Nada foi apagado."
          : error instanceof Error
            ? error.message
            : "Não foi possível remover: há um registro ligado.",
      );
    },
  });

  if (!produtoId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-black">Composição do produto</h1>
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            Nenhum produto selecionado. Abra a lista de produtos e escolha "Editar composição".
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Composição do produto</h1>
          <p className="text-sm text-muted-foreground">
            Edite à mão o que a IA também edita no chat. Nada aqui depende do assistente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: "/produtos" })}>
          Voltar aos produtos
        </Button>
      </div>

      {detail.isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {detail.isError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o produto. Tente recarregar a página.
        </p>
      )}

      {product && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4" /> Produto e rendimento
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                O rendimento é o divisor do custo: (ingredientes + embalagens) ÷ rendimento.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1 md:col-span-1">
                <Label htmlFor="produto-nome">Nome</Label>
                <Input
                  id="produto-nome"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="produto-rendimento">Rendimento</Label>
                <Input
                  id="produto-rendimento"
                  inputMode="decimal"
                  value={productForm.yield_qty}
                  onChange={(e) => setProductForm({ ...productForm, yield_qty: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="produto-unidade">Unidade do rendimento</Label>
                <Select
                  value={productForm.yield_unit}
                  onValueChange={(v) => v && setProductForm({ ...productForm, yield_unit: v })}
                >
                  <SelectTrigger id="produto-unidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button
                  onClick={() => productMutation.mutate()}
                  disabled={productMutation.isPending || productForm.name.trim() === ""}
                >
                  {productMutation.isPending ? "Salvando…" : "Salvar produto"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> Ingredientes
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quantidade usada por unidade e preço da embalagem comprada.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setIngredientForm({
                    id: null,
                    name: "",
                    used_qty: "",
                    used_unit: "g",
                    package_price: "",
                    package_qty: "",
                    package_unit: "g",
                  });
                  setIngredientDialog(true);
                }}
              >
                <PlusCircle className="h-4 w-4" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.data?.ingredients.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum ingrediente cadastrado.</p>
              )}
              {detail.data?.ingredients.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.used_qty} {item.used_unit} por unidade · embalagem{" "}
                      {brl(item.package_price)}
                      {item.package_qty ? ` / ${item.package_qty} ${item.package_unit ?? ""}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    aria-label={`Editar ingrediente ${item.name}`}
                    onClick={() => {
                      setIngredientForm({
                        id: item.id,
                        name: item.name,
                        used_qty: item.used_qty,
                        used_unit: item.used_unit ?? "g",
                        package_price: item.package_price ?? "",
                        package_qty: item.package_qty ?? "",
                        package_unit: item.package_unit ?? "g",
                      });
                      setIngredientDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover ingrediente ${item.name}`}
                    onClick={() =>
                      setPendingDelete({ kind: "ingredient", id: item.id, name: item.name })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Embalagens e materiais
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Custo do material por unidade vendida.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setPackagingForm({
                    id: null,
                    name: "",
                    package_price: "",
                    units_per_package: "",
                  });
                  setPackagingDialog(true);
                }}
              >
                <PlusCircle className="h-4 w-4" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.data?.packaging.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma embalagem cadastrada.</p>
              )}
              {detail.data?.packaging.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {brl(item.package_price)} por pacote · {item.units_per_package} unidade(s)
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    aria-label={`Editar embalagem ${item.name}`}
                    onClick={() => {
                      setPackagingForm({
                        id: item.id,
                        name: item.name,
                        package_price: item.package_price,
                        units_per_package: item.units_per_package,
                      });
                      setPackagingDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover embalagem ${item.name}`}
                    onClick={() =>
                      setPendingDelete({ kind: "packaging", id: item.id, name: item.name })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-4 w-4" /> Taxas sobre a venda
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Percentual em fração: 0,1 = 10% (maquininha, comissão de marketplace).
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setFeeForm({ id: null, name: "", percentage: "" });
                  setFeeDialog(true);
                }}
              >
                <PlusCircle className="h-4 w-4" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {detail.data?.fees.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma taxa cadastrada.</p>
              )}
              {detail.data?.fees.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(Number(item.percentage) * 100).toLocaleString("pt-BR", {
                        maximumFractionDigits: 2,
                      })}
                      % por venda
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    aria-label={`Editar taxa ${item.name}`}
                    onClick={() => {
                      setFeeForm({
                        id: item.id,
                        name: item.name,
                        percentage: item.percentage,
                      });
                      setFeeDialog(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remover taxa ${item.name}`}
                    onClick={() => setPendingDelete({ kind: "fee", id: item.id, name: item.name })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Preço de venda e imposto continuam em{" "}
            <Link to="/precos" className="underline">
              Preços de compra
            </Link>{" "}
            e na simulação.
          </p>
        </>
      )}

      {/* ---- diálogo: ingrediente ---- */}
      <AlertDialog open={ingredientDialog} onOpenChange={setIngredientDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ingredientForm.id ? "Editar ingrediente" : "Adicionar ingrediente"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Informe a quantidade usada por unidade produzida. O preço da embalagem exige também a
              quantidade e a unidade dela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="ing-nome">Nome</Label>
              <Input
                id="ing-nome"
                value={ingredientForm.name}
                onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ing-qtd">Quantidade usada</Label>
                <Input
                  id="ing-qtd"
                  inputMode="decimal"
                  value={ingredientForm.used_qty}
                  onChange={(e) =>
                    setIngredientForm({ ...ingredientForm, used_qty: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ing-unidade">Unidade</Label>
                <Select
                  value={ingredientForm.used_unit}
                  onValueChange={(v) => v && setIngredientForm({ ...ingredientForm, used_unit: v })}
                >
                  <SelectTrigger id="ing-unidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ing-preco">Preço da embalagem</Label>
                <Input
                  id="ing-preco"
                  inputMode="decimal"
                  value={ingredientForm.package_price}
                  onChange={(e) =>
                    setIngredientForm({ ...ingredientForm, package_price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ing-pqtd">Qtd. da embalagem</Label>
                <Input
                  id="ing-pqtd"
                  inputMode="decimal"
                  value={ingredientForm.package_qty}
                  onChange={(e) =>
                    setIngredientForm({ ...ingredientForm, package_qty: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ing-punidade">Unidade da embalagem</Label>
                <Select
                  value={ingredientForm.package_unit}
                  onValueChange={(v) =>
                    v && setIngredientForm({ ...ingredientForm, package_unit: v })
                  }
                >
                  <SelectTrigger id="ing-punidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                ingredientMutation.mutate();
              }}
              disabled={
                ingredientMutation.isPending ||
                ingredientForm.name.trim() === "" ||
                ingredientForm.used_qty.trim() === ""
              }
            >
              {ingredientMutation.isPending ? "Salvando…" : "Salvar ingrediente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- diálogo: embalagem ---- */}
      <AlertDialog open={packagingDialog} onOpenChange={setPackagingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {packagingForm.id ? "Editar embalagem" : "Adicionar embalagem"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Preço do pacote e quantas unidades ele rende.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="pkg-nome">Nome</Label>
              <Input
                id="pkg-nome"
                value={packagingForm.name}
                onChange={(e) => setPackagingForm({ ...packagingForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pkg-preco">Preço do pacote</Label>
                <Input
                  id="pkg-preco"
                  inputMode="decimal"
                  value={packagingForm.package_price}
                  onChange={(e) =>
                    setPackagingForm({ ...packagingForm, package_price: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pkg-unidades">Unidades por pacote</Label>
                <Input
                  id="pkg-unidades"
                  inputMode="decimal"
                  value={packagingForm.units_per_package}
                  onChange={(e) =>
                    setPackagingForm({ ...packagingForm, units_per_package: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                packagingMutation.mutate();
              }}
              disabled={
                packagingMutation.isPending ||
                packagingForm.name.trim() === "" ||
                packagingForm.package_price.trim() === "" ||
                packagingForm.units_per_package.trim() === ""
              }
            >
              {packagingMutation.isPending ? "Salvando…" : "Salvar embalagem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- diálogo: taxa ---- */}
      <AlertDialog open={feeDialog} onOpenChange={setFeeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{feeForm.id ? "Editar taxa" : "Adicionar taxa"}</AlertDialogTitle>
            <AlertDialogDescription>
              Percentual em fração: para 10%, informe 0,1.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="fee-nome">Nome</Label>
              <Input
                id="fee-nome"
                value={feeForm.name}
                onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fee-pct">Percentual (fração)</Label>
              <Input
                id="fee-pct"
                inputMode="decimal"
                value={feeForm.percentage}
                onChange={(e) => setFeeForm({ ...feeForm, percentage: e.target.value })}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                feeMutation.mutate();
              }}
              disabled={
                feeMutation.isPending ||
                feeForm.name.trim() === "" ||
                feeForm.percentage.trim() === ""
              }
            >
              {feeMutation.isPending ? "Salvando…" : "Salvar taxa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- confirmação de remoção ---- */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {removeLabel(pendingDelete?.kind ?? null).kind} {pendingDelete?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A remoção é definitiva e não pode ser desfeita. Item sem histórico de preço registrado
              é removido normalmente; se o item tiver histórico de preços ou outro registro ligado a
              ele, o servidor recusa a remoção e nada é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {product && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">versão {product.version}</Badge>
          <span>
            Toda edição manual incrementa a versão e nunca sobrescreve mudança feita em paralelo.
          </span>
        </div>
      )}
    </div>
  );
}
