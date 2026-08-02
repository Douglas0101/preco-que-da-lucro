import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Wallet, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/despesas")({
  head: () => ({
    meta: [
      { title: "Minhas Despesas · Preço que Dá Lucro" },
      { name: "description", content: "Cadastre e acompanhe suas despesas mensais." },
    ],
  }),
  component: Despesas,
});

const CATEGORIES = [
  "Aluguel",
  "Pró-labore",
  "Salários",
  "Contabilidade",
  "Internet",
  "Telefone",
  "Energia",
  "Água",
  "Sistemas",
  "Marketing",
  "Transporte",
  "Manutenção",
  "Impostos",
  "Taxas",
  "Outros",
];

function Despesas() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "Outros",
    type: "fixa" as "fixa" | "variavel",
  });
  const [loading, setLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    setList(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.name || !Number.isFinite(amount) || amount < 0)
      return toast.error("Preencha nome e valor válido");
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      user_id: user.user!.id,
      name: form.name,
      amount,
      category: form.category,
      type: form.type,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Despesa adicionada");
    setForm({ name: "", amount: "", category: "Outros", type: "fixa" });
    load();
  }

  async function del(id: string) {
    await supabase.from("expenses").delete().eq("id", id);
    load();
  }

  const fixed = list.filter((e) => e.type === "fixa").reduce((s, e) => s + Number(e.amount), 0);
  const variable = list
    .filter((e) => e.type === "variavel")
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black">Minhas Despesas</h1>
          <p className="text-muted-foreground">
            Cadastre as contas da sua empresa para calcular o ponto de equilíbrio.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground">Despesas fixas / mês</div>
              <div className="mt-1 text-2xl font-black">{brl(fixed)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs uppercase text-muted-foreground">
                Despesas variáveis / mês
              </div>
              <div className="mt-1 text-2xl font-black">{brl(variable)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-5">
            <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
              <div className="md:col-span-2 space-y-1">
                <Label htmlFor="despesa-nome">Nome</Label>
                <Input
                  id="despesa-nome"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Aluguel"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="despesa-valor">Valor (R$)</Label>
                <Input
                  id="despesa-valor"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="despesa-categoria">Categoria</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="despesa-categoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="despesa-tipo">Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => {
                    if (value === "fixa" || value === "variavel") {
                      setForm({ ...form, type: value });
                    }
                  }}
                >
                  <SelectTrigger id="despesa-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixa">Fixa</SelectItem>
                    <SelectItem value="variavel">Variável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5">
                <Button type="submit" disabled={loading} className="gap-2">
                  <PlusCircle className="h-4 w-4" /> Adicionar despesa
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {list.length === 0 ? (
          <Card>
            <CardContent className="grid place-items-center gap-2 p-12 text-center text-muted-foreground">
              <Wallet className="h-8 w-8" /> Nenhuma despesa cadastrada ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {list.map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.category} · {e.type === "fixa" ? "Fixa" : "Variável"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black">{brl(Number(e.amount))}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDeleteId(e.id)}
                    aria-label={`Excluir ${e.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              A despesa selecionada será excluída permanentemente. Esta ação não poderá ser
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
              Excluir despesa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
