import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { decimalStringSchema } from "@/lib/financial-values";
import { requireDatabaseAuth } from "@/middleware/request-context";
import { runFinancialSimulation } from "@/server/services/financial.service";
import { simulationService } from "@/server/services/simulation.service";

type SerializableJson =
  string | number | boolean | null | SerializableJson[] | { [key: string]: SerializableJson };
type SerializableJsonObject = { [key: string]: SerializableJson };

function toSerializableJsonObject(value: Record<string, unknown>): SerializableJsonObject {
  return JSON.parse(JSON.stringify(value)) as SerializableJsonObject;
}

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

const persistedSimulationInput = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  params: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  scenario_type: z.enum(["manual_simulation", "forecast", "real"]),
  engine_version: z.string().trim().min(1).max(80),
});

function mapSimulation(row: Awaited<ReturnType<typeof simulationService.save>>) {
  return {
    id: row.id,
    product_id: row.productId,
    tenant_id: row.tenantId,
    name: row.name,
    params: toSerializableJsonObject(row.params),
    result: row.result == null ? null : toSerializableJsonObject(row.result),
    scenario_type: row.scenarioType,
    engine_version: row.engineVersion,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export const listSimulations = createServerFn({ method: "GET" })
  .middleware([requireDatabaseAuth])
  .handler(async ({ context }) => {
    const rows = await simulationService.list(context.requestContext);
    return rows.map(mapSimulation);
  });

export const saveSimulation = createServerFn({ method: "POST" })
  .middleware([requireDatabaseAuth])
  .validator((input: unknown) => persistedSimulationInput.parse(input))
  .handler(async ({ data, context }) => {
    const row = await simulationService.save(context.requestContext, {
      id: data.id,
      productId: data.product_id,
      name: data.name,
      params: data.params,
      result: data.result,
      scenarioType: data.scenario_type,
      engineVersion: data.engine_version,
    });
    return mapSimulation(row);
  });
