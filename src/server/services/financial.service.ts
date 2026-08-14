import Decimal from "decimal.js";
import {
  calculateScenario,
  type CalculationResult,
  type FeeRow,
  type VolumeSource,
} from "@/lib/finance";
import { toDecimalString, type DecimalString } from "@/lib/financial-values";

export interface SimulationServiceInput {
  price: string | null;
  unitCost: string | null;
  taxRate: string | null;
  fees: Array<{ percentage: string | null }>;
  fixedExpenses: string | null;
  volume: string | null;
  volumeSource: VolumeSource;
}

export interface DecimalBreakEvenResult {
  status: "reachable" | "unreachable" | "invalid";
  rawUnits: DecimalString | null;
  roundedUnits: DecimalString | null;
  unitMode: "discrete" | "continuous";
  reason?: "NON_POSITIVE_CONTRIBUTION";
  errors?: Array<{ code: string; message: string; field?: string }>;
}

export interface DecimalScenarioResult {
  price: DecimalString;
  unitCost: DecimalString;
  variableCost: DecimalString;
  contributionMargin: DecimalString;
  contributionMarginPct: DecimalString;
  breakEvenUnits: DecimalBreakEvenResult;
  breakEvenRevenue: DecimalString | null;
  volume: DecimalString;
  volumeSource: Exclude<VolumeSource, "unknown">;
  revenue: DecimalString;
  totalVariable: DecimalString;
  totalContribution: DecimalString;
  result: DecimalString;
  resultSign: "positive" | "zero" | "negative";
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
): CalculationResult<DecimalScenarioResult> {
  const fees: FeeRow[] = input.fees.map((fee) => ({
    percentage: parseValue(fee.percentage),
  }));
  const result = calculateScenario({
    price: parseValue(input.price),
    unitCost: parseValue(input.unitCost),
    taxRate: parseValue(input.taxRate),
    fees,
    fixedExpenses: parseValue(input.fixedExpenses),
    volume: parseValue(input.volume),
    volumeSource: input.volumeSource,
  });
  if (result.status !== "ok") return result;

  const value = result.value;
  const decimal = (number: number, scale = 4): DecimalString => toDecimalString(number, scale);
  const breakEvenUnits: DecimalBreakEvenResult =
    value.breakEvenUnits.status === "reachable"
      ? {
          status: "reachable",
          rawUnits: decimal(value.breakEvenUnits.rawUnits, 6),
          roundedUnits: decimal(value.breakEvenUnits.roundedUnits, 6),
          unitMode: value.breakEvenUnits.unitMode,
        }
      : value.breakEvenUnits.status === "unreachable"
        ? {
            status: "unreachable",
            rawUnits: null,
            roundedUnits: null,
            unitMode: value.breakEvenUnits.unitMode,
            reason: value.breakEvenUnits.reason,
          }
        : {
            status: "invalid",
            rawUnits: null,
            roundedUnits: null,
            unitMode: value.breakEvenUnits.unitMode,
            errors: value.breakEvenUnits.errors,
          };
  return {
    status: "ok",
    value: {
      price: decimal(value.price),
      unitCost: decimal(value.unitCost),
      variableCost: decimal(value.variableCost),
      contributionMargin: decimal(value.contributionMargin),
      contributionMarginPct: decimal(value.contributionMarginPct, 6),
      breakEvenUnits,
      breakEvenRevenue: value.breakEvenRevenue == null ? null : decimal(value.breakEvenRevenue),
      volume: decimal(value.volume, 6),
      volumeSource: value.volumeSource,
      revenue: decimal(value.revenue),
      totalVariable: decimal(value.totalVariable),
      totalContribution: decimal(value.totalContribution),
      result: decimal(value.result),
      resultSign: value.result > 0 ? "positive" : value.result < 0 ? "negative" : "zero",
    },
    warnings: result.warnings,
  };
}
