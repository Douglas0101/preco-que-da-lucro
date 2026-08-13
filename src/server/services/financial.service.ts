import Decimal from "decimal.js";
import {
  calculateScenario,
  type CalculationResult,
  type FeeRow,
  type ScenarioResult,
  type VolumeSource,
} from "@/lib/finance";

export interface SimulationServiceInput {
  price: string | null;
  unitCost: string | null;
  taxRate: string | null;
  fees: Array<{ percentage: string | null }>;
  fixedExpenses: string | null;
  volume: string | null;
  volumeSource: VolumeSource;
}

function parseValue(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  try {
    const decimal = new Decimal(value.replace(",", "."));
    return decimal.isFinite() ? decimal.toNumber() : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export function runFinancialSimulation(
  input: SimulationServiceInput,
): CalculationResult<ScenarioResult> {
  const fees: FeeRow[] = input.fees.map((fee) => ({
    percentage: parseValue(fee.percentage),
  }));
  return calculateScenario({
    price: parseValue(input.price),
    unitCost: parseValue(input.unitCost),
    taxRate: parseValue(input.taxRate),
    fees,
    fixedExpenses: parseValue(input.fixedExpenses),
    volume: parseValue(input.volume),
    volumeSource: input.volumeSource,
  });
}
