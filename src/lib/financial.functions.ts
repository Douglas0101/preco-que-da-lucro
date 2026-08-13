import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { runFinancialSimulation } from "@/server/services/financial.service";

const simulationInput = z.object({
  price: z.string().trim().max(64).nullable(),
  unitCost: z.string().trim().max(64).nullable(),
  fixedExpenses: z.string().trim().max(64).nullable(),
  volume: z.string().trim().max(64).nullable(),
  taxRate: z.string().trim().max(64).nullable(),
  fees: z.array(z.object({ percentage: z.string().trim().max(64).nullable() })).max(100),
  volumeSource: z.enum(["real", "manual_simulation", "forecast", "unknown"]),
});

/** Financial scenarios run inside the authenticated BFF, never in React. */
export const runSimulation = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => simulationInput.parse(input))
  .handler(async ({ data }) => runFinancialSimulation(data));
