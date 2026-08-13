import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { decimalStringSchema } from "@/lib/financial-values";
import { requireDatabaseAuth } from "@/middleware/request-context";
import {
  calculateBreakEvenSummary,
  type BreakEvenServiceResult,
} from "@/server/services/break-even.service";

export const breakEvenInput = z.object({
  fixedExpenses: z.array(decimalStringSchema).max(500),
  price: decimalStringSchema,
  contributionMargin: decimalStringSchema,
  contributionMarginPct: decimalStringSchema,
  desiredProfit: decimalStringSchema.nullable(),
  unitMode: z.enum(["discrete", "continuous"]),
});

export type BreakEvenInput = z.input<typeof breakEvenInput>;

export const calculateBreakEven = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => breakEvenInput.parse(input))
  .handler(async ({ data }): Promise<BreakEvenServiceResult> => calculateBreakEvenSummary(data));
