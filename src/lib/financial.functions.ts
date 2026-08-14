import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { decimalStringSchema } from "@/lib/financial-values";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { runFinancialSimulation } from "@/server/services/financial.service";

const simulationInput = z.object({
  price: decimalStringSchema.nullable(),
  unitCost: decimalStringSchema.nullable(),
  fixedExpenses: decimalStringSchema.nullable(),
  volume: decimalStringSchema.nullable(),
  taxRate: decimalStringSchema.nullable(),
  fees: z.array(z.object({ percentage: decimalStringSchema.nullable() })).max(100),
  volumeSource: z.enum(["real", "manual_simulation", "forecast", "unknown"]),
});

/** Financial scenarios run inside the authenticated BFF, never in React. */
export const runSimulation = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => simulationInput.parse(input))
  .handler(async ({ data }) => runFinancialSimulation(data));
