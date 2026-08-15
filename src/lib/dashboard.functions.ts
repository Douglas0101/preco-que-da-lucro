import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { getDashboardSummary as getDashboardSummaryService } from "@/server/services/dashboard.service";

const dashboardInput = z
  .object({
    period: z.enum(["month", "quarter", "year"]).optional(),
  })
  .optional();

/** Server-side aggregate used by the dashboard route. */
export const getDashboardSummary = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => dashboardInput.parse(input))
  .handler(async ({ context }) => getDashboardSummaryService(context.requestContext));
