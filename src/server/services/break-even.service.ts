import Decimal from "decimal.js";
import {
  FINANCIAL_DECIMAL_POLICY,
  toDecimalString,
  type DecimalString,
} from "@/lib/financial-values";

export type BreakEvenServiceStatus = "reachable" | "unreachable" | "invalid";

export interface BreakEvenServiceInput {
  fixedExpenses: string[];
  price: string;
  contributionMargin: string;
  contributionMarginPct: string;
  desiredProfit: string | null;
  unitMode: "discrete" | "continuous";
}

export interface BreakEvenServiceError {
  code: "INVALID_DECIMAL" | "NON_POSITIVE_CONTRIBUTION" | "NON_FINITE_RESULT";
  field: string;
  message: string;
}

export type BreakEvenUnits =
  | {
      status: "reachable";
      rawUnits: DecimalString;
      roundedUnits: DecimalString;
      unitMode: "discrete" | "continuous";
    }
  | {
      status: "unreachable";
      rawUnits: null;
      roundedUnits: null;
      unitMode: "discrete" | "continuous";
      reason: "NON_POSITIVE_CONTRIBUTION";
    }
  | {
      status: "invalid";
      rawUnits: null;
      roundedUnits: null;
      unitMode: "discrete" | "continuous";
      errors: BreakEvenServiceError[];
    };

export interface BreakEvenServiceResult {
  status: BreakEvenServiceStatus;
  fixedExpenses: DecimalString | null;
  units: BreakEvenUnits;
  revenue: DecimalString | null;
  targetUnits: BreakEvenUnits | null;
  targetRevenue: DecimalString | null;
}

function parseDecimal(value: string, field: string, allowZero = true): Decimal {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw invalidDecimal(field);
  }
  if (!parsed.isFinite() || (allowZero ? parsed.isNegative() : !parsed.gt(0))) {
    throw invalidDecimal(field);
  }
  return parsed;
}

function invalidDecimal(field: string): BreakEvenServiceError {
  return {
    code: "INVALID_DECIMAL",
    field,
    message: "Informe um decimal finito dentro do intervalo permitido.",
  };
}

function invalidUnits(
  unitMode: BreakEvenServiceInput["unitMode"],
  errors: BreakEvenServiceError[],
): BreakEvenUnits {
  return { status: "invalid", rawUnits: null, roundedUnits: null, unitMode, errors };
}

function calculateUnits(
  fixedExpenses: Decimal,
  contributionMargin: Decimal,
  unitMode: BreakEvenServiceInput["unitMode"],
): BreakEvenUnits {
  if (!contributionMargin.gt(0)) {
    return {
      status: "unreachable",
      rawUnits: null,
      roundedUnits: null,
      unitMode,
      reason: "NON_POSITIVE_CONTRIBUTION",
    };
  }

  const raw = fixedExpenses.div(contributionMargin);
  if (!raw.isFinite()) {
    return invalidUnits(unitMode, [
      { code: "NON_FINITE_RESULT", field: "rawUnits", message: "O cálculo não é finito." },
    ]);
  }

  const rounded = unitMode === "discrete" ? raw.ceil() : raw;
  return {
    status: "reachable",
    rawUnits: toDecimalString(raw, FINANCIAL_DECIMAL_POLICY.quantity.scale),
    roundedUnits: toDecimalString(rounded, FINANCIAL_DECIMAL_POLICY.quantity.scale),
    unitMode,
  };
}

function invalidResult(
  input: BreakEvenServiceInput,
  errors: BreakEvenServiceError[],
): BreakEvenServiceResult {
  const units = invalidUnits(input.unitMode, errors);
  return {
    status: "invalid",
    fixedExpenses: null,
    units,
    revenue: null,
    targetUnits: null,
    targetRevenue: null,
  };
}

export function calculateBreakEvenSummary(input: BreakEvenServiceInput): BreakEvenServiceResult {
  const errors: BreakEvenServiceError[] = [];
  let fixedExpenses = new Decimal(0);
  for (const [index, value] of input.fixedExpenses.entries()) {
    try {
      fixedExpenses = fixedExpenses.plus(parseDecimal(value, `fixedExpenses[${index}]`));
    } catch (error) {
      errors.push(error as BreakEvenServiceError);
    }
  }

  let price: Decimal;
  let contributionMargin: Decimal;
  let contributionMarginPct: Decimal;
  try {
    price = parseDecimal(input.price, "price");
    contributionMargin = parseDecimal(input.contributionMargin, "contributionMargin");
    contributionMarginPct = parseDecimal(
      input.contributionMarginPct,
      "contributionMarginPct",
      true,
    );
  } catch (error) {
    errors.push(error as BreakEvenServiceError);
    return invalidResult(input, errors);
  }
  if (errors.length) return invalidResult(input, errors);

  const units = calculateUnits(fixedExpenses, contributionMargin, input.unitMode);
  const revenue =
    units.status === "unreachable" || !contributionMarginPct.gt(0)
      ? null
      : toDecimalString(fixedExpenses.div(contributionMarginPct.div(100)), 4);

  let targetUnits: BreakEvenUnits | null = null;
  let targetRevenue: DecimalString | null = null;
  if (input.desiredProfit != null && input.desiredProfit.trim() !== "") {
    try {
      const desiredProfit = parseDecimal(input.desiredProfit, "desiredProfit");
      targetUnits = calculateUnits(
        fixedExpenses.plus(desiredProfit),
        contributionMargin,
        input.unitMode,
      );
      if (targetUnits.status === "reachable") {
        targetRevenue = toDecimalString(new Decimal(targetUnits.roundedUnits).mul(price), 4);
      }
    } catch (error) {
      targetUnits = invalidUnits(input.unitMode, [error as BreakEvenServiceError]);
    }
  }

  const invalidOutputs = [
    fixedExpenses,
    revenue && new Decimal(revenue),
    targetRevenue && new Decimal(targetRevenue),
  ].filter((value): value is Decimal => value !== null && !value.isFinite());
  if (invalidOutputs.length)
    return invalidResult(input, [
      { code: "NON_FINITE_RESULT", field: "breakEven", message: "O cálculo não é finito." },
    ]);

  return {
    status: units.status,
    fixedExpenses: toDecimalString(fixedExpenses, FINANCIAL_DECIMAL_POLICY.money.scale),
    units,
    revenue,
    targetUnits,
    targetRevenue,
  };
}
