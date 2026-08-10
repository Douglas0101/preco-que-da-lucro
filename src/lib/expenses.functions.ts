import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sumFiniteNumbers } from "@/lib/finance";
import { z } from "zod";

const uuid = z.string().uuid();

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const expenseInput = z.object({
  id: uuid.optional(),
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  amount: z.number().finite().min(0),
  type: z.enum(["fixa", "variavel"]),
  periodicity: z.string().optional(),
  notes: z.string().optional().nullable(),
});
export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => expenseInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = { ...data, user_id: context.userId };
    const { data: res, error } = await context.supabase
      .from("expenses")
      .upsert(row, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTotals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [expenses, products] = await Promise.all([
      context.supabase.from("expenses").select("amount, type"),
      context.supabase.from("products").select("id"),
    ]);
    const fixed = sumFiniteNumbers(
      (expenses.data ?? [])
        .filter((expense) => expense.type === "fixa")
        .map((expense) => Number(expense.amount)),
    );
    const variable = sumFiniteNumbers(
      (expenses.data ?? [])
        .filter((expense) => expense.type === "variavel")
        .map((expense) => Number(expense.amount)),
    );
    if (!Number.isFinite(fixed) || !Number.isFinite(variable)) {
      throw new Error("Dados numéricos de despesas inválidos");
    }
    return {
      fixed,
      variable,
      productCount: products.data?.length ?? 0,
    };
  });
