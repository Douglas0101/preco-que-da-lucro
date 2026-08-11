/**
 * Motor financeiro determinístico.
 * Todos os cálculos do sistema passam por aqui — a IA NUNCA faz contas.
 */

/**
 * Contrato de resultado do motor (V7 §8.2 / Plano §6.2, FIN-001 — lote 03).
 * Separa cálculo válido (`ok`), dado incompleto (`incomplete`) e dado
 * inválido (`invalid`). O lote 04 introduziu `incomplete` para ausência e o
 * lote 05 introduziu `invalid` para números inválidos; a taxonomia definitiva
 * dos códigos de erro permanece no lote 10.
 */
export interface CalculationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface MissingField {
  field: string;
  reason?: string;
}

export interface CalculationError {
  code: string;
  message: string;
  field?: string;
}

export type CalculationResult<T> =
  | { status: "ok"; value: T; warnings: CalculationWarning[] }
  | { status: "incomplete"; missing: MissingField[]; warnings: CalculationWarning[] }
  | { status: "invalid"; errors: CalculationError[] };

export function calcOk<T>(value: T, warnings: CalculationWarning[] = []): CalculationResult<T> {
  return { status: "ok", value, warnings };
}

export function calcIncomplete<T = never>(
  missing: MissingField[],
  warnings: CalculationWarning[] = [],
): CalculationResult<T> {
  return { status: "incomplete", missing, warnings };
}

export function calcInvalid<T = never>(errors: CalculationError[]): CalculationResult<T> {
  return { status: "invalid", errors };
}

interface NumericRules {
  min?: number;
  minExclusive?: number;
  max?: number;
}

function numericInputError(
  field: string,
  value: number,
  rules: NumericRules = {},
): CalculationError | null {
  if (!Number.isFinite(value)) {
    return {
      code: "INVALID_NUMBER",
      message: "Informe um número finito.",
      field,
    };
  }
  if (
    (rules.min !== undefined && value < rules.min) ||
    (rules.minExclusive !== undefined && value <= rules.minExclusive) ||
    (rules.max !== undefined && value > rules.max)
  ) {
    return {
      code: "INVALID_NUMBER",
      message: "Valor fora do intervalo permitido.",
      field,
    };
  }
  return null;
}

function collectNumericError(
  errors: CalculationError[],
  field: string,
  value: number,
  rules: NumericRules = {},
): void {
  const error = numericInputError(field, value, rules);
  if (error !== null) errors.push(error);
}

function collectNullableNumber(
  missing: MissingField[],
  errors: CalculationError[],
  field: string,
  value: number | null,
  rules: NumericRules = {},
): void {
  if (value == null) {
    missing.push({ field });
    return;
  }
  collectNumericError(errors, field, value, rules);
}

function nonFiniteResultError(field: string): CalculationError {
  return {
    code: "NON_FINITE_RESULT",
    message: "O cálculo produziu um resultado não finito.",
    field,
  };
}

function finiteResult(value: number): number {
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Soma valores finitos sem deixar overflow ou entrada especial vazar. */
export function sumFiniteNumbers(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) return Number.NaN;
    sum = finiteResult(sum + value);
    if (Number.isNaN(sum)) return sum;
  }
  return sum;
}

export type Unit =
  | "g"
  | "kg"
  | "mg"
  | "ml"
  | "l"
  | "unidade"
  | "un"
  | "dúzia"
  | "duzia"
  | "pacote"
  | "caixa"
  | "colher"
  | "xicara"
  | "xícara";

const MASS: Record<string, number> = { mg: 0.001, g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, l: 1000 };
const COUNT: Record<string, number> = { unidade: 1, un: 1, dúzia: 12, duzia: 12 };

function normUnit(u: string) {
  return (u || "").trim().toLowerCase();
}

/**
 * Converte quantidade entre unidades da mesma família.
 * Retorna null quando as unidades não são convertíveis com segurança.
 */
export function convertUnit(qty: number, from: string, to: string): number | null {
  if (!Number.isFinite(qty)) return Number.NaN;
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return qty;
  if (f in MASS && t in MASS) return finiteResult((qty * MASS[f]) / MASS[t]);
  if (f in VOLUME && t in VOLUME) return finiteResult((qty * VOLUME[f]) / VOLUME[t]);
  if (f in COUNT && t in COUNT) return finiteResult((qty * COUNT[f]) / COUNT[t]);
  return null;
}

export interface IngredientRow {
  used_qty: number;
  used_unit: string;
  package_price: number | null;
  package_qty: number | null;
  package_unit: string | null;
}

export function calculateIngredientCost(row: IngredientRow): number | null {
  // FIN-01: dado de embalagem desconhecido (null) não vira custo zero.
  // FIN-003: número inválido propaga NaN até o Result Type, nunca zero.
  if (numericInputError("used_qty", row.used_qty, { minExclusive: 0 })) return Number.NaN;
  if (
    row.package_price != null &&
    numericInputError("package_price", row.package_price, { min: 0 })
  )
    return Number.NaN;
  if (
    row.package_qty != null &&
    numericInputError("package_qty", row.package_qty, { minExclusive: 0 })
  )
    return Number.NaN;
  if (row.package_price == null || row.package_qty == null || row.package_unit == null) return null;
  const converted = convertUnit(row.used_qty, row.used_unit, row.package_unit);
  // golden (lote 08): conversão incompatível ainda vira custo zero.
  if (converted === null) return 0;
  return finiteResult(converted * (row.package_price / row.package_qty));
}

export function calculateRecipeCost(rows: IngredientRow[]): number | null {
  // Custo total é desconhecido se qualquer ingrediente for desconhecido.
  let sum = 0;
  let incomplete = false;
  for (const r of rows) {
    const cost = calculateIngredientCost(r);
    if (cost === null) {
      incomplete = true;
      continue;
    }
    sum = finiteResult(sum + cost);
    if (Number.isNaN(sum)) return sum;
  }
  return incomplete ? null : sum;
}

export interface PackagingRow {
  package_price: number;
  units_per_package: number;
}
export function calculatePackagingCost(rows: PackagingRow[]): number {
  let sum = 0;
  for (const row of rows) {
    if (numericInputError("package_price", row.package_price, { min: 0 })) return Number.NaN;
    if (numericInputError("units_per_package", row.units_per_package, { minExclusive: 0 }))
      return Number.NaN;
    sum = finiteResult(sum + row.package_price / row.units_per_package);
    if (Number.isNaN(sum)) return sum;
  }
  return sum;
}

export function calculateUnitCost(
  recipeCost: number | null,
  yieldQty: number | null,
  packagingCost: number | null,
): number | null {
  // FIN-02: custo/rendimento desconhecido não vira zero/um.
  if (recipeCost != null && numericInputError("recipeCost", recipeCost, { min: 0 }))
    return Number.NaN;
  if (packagingCost != null && numericInputError("packagingCost", packagingCost, { min: 0 }))
    return Number.NaN;
  if (yieldQty != null && numericInputError("yieldQty", yieldQty, { minExclusive: 0 }))
    return Number.NaN;
  if (recipeCost == null || packagingCost == null || yieldQty == null) return null;
  return finiteResult(recipeCost / yieldQty + packagingCost);
}

export interface FeeRow {
  percentage: number | null;
}

/** SDD §11.7: imposto + taxas sobre preço bruto deve permanecer abaixo de 100%. */
function combinedRateError(taxRate: number | null, fees: FeeRow[]): CalculationError | null {
  let total = 0;
  for (const value of [taxRate, ...fees.map((fee) => fee.percentage)]) {
    if (value == null) continue;
    if (numericInputError("rateOnGrossPrice", value, { min: 0, max: 100 })) return null;
    total = finiteResult(total + value);
    if (!Number.isFinite(total) || total >= 100) {
      return {
        code: "INVALID_NUMBER",
        message: "A soma de imposto e taxas deve ser menor que 100%.",
        field: "rateOnGrossPrice",
      };
    }
  }
  return null;
}

export function calculateVariableCost(
  price: number | null,
  taxRate: number | null,
  fees: FeeRow[],
): number | null {
  // FIN-03: preço/alíquota/taxa desconhecidos não viram zero.
  if (price != null && numericInputError("price", price, { min: 0 })) return Number.NaN;
  if (taxRate != null && numericInputError("taxRate", taxRate, { min: 0, max: 100 }))
    return Number.NaN;
  for (const fee of fees) {
    if (
      fee.percentage != null &&
      numericInputError("percentage", fee.percentage, { min: 0, max: 100 })
    )
      return Number.NaN;
  }
  if (combinedRateError(taxRate, fees)) return Number.NaN;
  if (price == null || taxRate == null || fees.some((fee) => fee.percentage == null)) return null;
  const totalRate = taxRate + fees.reduce((sum, fee) => sum + (fee.percentage as number), 0);
  return finiteResult(price * (totalRate / 100));
}

export function calculateContributionMargin(
  price: number,
  unitCost: number,
  variableCost: number,
): number {
  if (numericInputError("price", price, { min: 0 })) return Number.NaN;
  if (numericInputError("unitCost", unitCost, { min: 0 })) return Number.NaN;
  if (numericInputError("variableCost", variableCost, { min: 0 })) return Number.NaN;
  return finiteResult(price - unitCost - variableCost);
}

export function calculateContributionMarginPct(price: number, contributionMargin: number): number {
  if (numericInputError("price", price, { min: 0 })) return Number.NaN;
  if (numericInputError("contributionMargin", contributionMargin)) return Number.NaN;
  if (price === 0) return 0;
  return finiteResult((contributionMargin / price) * 100);
}

export function calculateBreakEvenUnits(fixedExpenses: number, cmUnit: number): number {
  if (numericInputError("fixedExpenses", fixedExpenses, { min: 0 })) return Number.NaN;
  if (numericInputError("cmUnit", cmUnit)) return Number.NaN;
  if (cmUnit <= 0) return Infinity;
  return finiteResult(fixedExpenses / cmUnit);
}

export function calculateBreakEvenRevenue(fixedExpenses: number, cmPct: number): number {
  if (numericInputError("fixedExpenses", fixedExpenses, { min: 0 })) return Number.NaN;
  if (numericInputError("cmPct", cmPct)) return Number.NaN;
  if (cmPct <= 0) return Infinity;
  return finiteResult(fixedExpenses / (cmPct / 100));
}

export function calculateRequiredSalesForProfit(
  fixedExpenses: number,
  desiredProfit: number,
  cmUnit: number,
): number {
  if (numericInputError("fixedExpenses", fixedExpenses, { min: 0 })) return Number.NaN;
  if (numericInputError("desiredProfit", desiredProfit, { min: 0 })) return Number.NaN;
  if (numericInputError("cmUnit", cmUnit)) return Number.NaN;
  if (cmUnit <= 0) return Infinity;
  return finiteResult((fixedExpenses + desiredProfit) / cmUnit);
}

export type VolumeSource = "real" | "manual_simulation" | "forecast" | "unknown";

export type ResolvedVolumeSource = Exclude<VolumeSource, "unknown">;

/**
 * Volume real é requisito necessário, mas não suficiente, para um KPI factual.
 * Preço hipotético × volume real continua sendo uma simulação; faturamento
 * realizado deve vir do futuro domínio de vendas.
 */
export function isFactualVolumeSource(source: VolumeSource): source is "real" {
  return source === "real";
}

export interface ScenarioInput {
  price: number | null;
  unitCost: number | null;
  taxRate: number | null;
  fees: FeeRow[];
  fixedExpenses: number | null;
  volume: number | null;
  volumeSource: VolumeSource;
}

export interface ScenarioResult {
  price: number;
  unitCost: number;
  variableCost: number;
  contributionMargin: number;
  contributionMarginPct: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  volume: number;
  volumeSource: ResolvedVolumeSource;
  revenue: number;
  totalVariable: number;
  totalContribution: number;
  result: number; // resultado operacional no escopo informado
}

const VOLUME_SOURCES: readonly VolumeSource[] = [
  "real",
  "manual_simulation",
  "forecast",
  "unknown",
];

function invalidVolumeSourceError(message: string): CalculationError {
  return {
    code: "INVALID_VOLUME_SOURCE",
    message,
    field: "volumeSource",
  };
}

/** Campos de taxas ausentes, indexados para a UI apontar a origem. */
function missingFeeFields(fees: FeeRow[]): MissingField[] {
  const missing: MissingField[] = [];
  fees.forEach((f, i) => {
    if (f.percentage == null) missing.push({ field: `fees[${i}].percentage` });
  });
  return missing;
}

function invalidFeeErrors(fees: FeeRow[]): CalculationError[] {
  const errors: CalculationError[] = [];
  fees.forEach((fee, i) => {
    if (fee.percentage != null) {
      collectNumericError(errors, `fees[${i}].percentage`, fee.percentage, { min: 0, max: 100 });
    }
  });
  return errors;
}

export function calculateScenario(i: ScenarioInput): CalculationResult<ScenarioResult> {
  const missing: MissingField[] = [];
  const errors: CalculationError[] = [];
  collectNullableNumber(missing, errors, "price", i.price, { min: 0 });
  collectNullableNumber(missing, errors, "unitCost", i.unitCost, { min: 0 });
  collectNullableNumber(missing, errors, "taxRate", i.taxRate, { min: 0, max: 100 });
  missing.push(...missingFeeFields(i.fees));
  errors.push(...invalidFeeErrors(i.fees));
  const rateError = combinedRateError(i.taxRate, i.fees);
  if (rateError !== null) errors.push(rateError);
  collectNullableNumber(missing, errors, "fixedExpenses", i.fixedExpenses, { min: 0 });
  collectNullableNumber(missing, errors, "volume", i.volume, { min: 0 });
  if (!VOLUME_SOURCES.includes(i.volumeSource)) {
    errors.push(invalidVolumeSourceError("Informe uma origem de volume válida."));
  } else if (i.volumeSource === "unknown" && i.volume !== null) {
    errors.push(invalidVolumeSourceError("Volume numérico não pode ter origem desconhecida."));
  }
  if (errors.length > 0) return calcInvalid(errors);
  if (missing.length > 0) return calcIncomplete(missing);

  const price = i.price as number;
  const unitCost = i.unitCost as number;
  const taxRate = i.taxRate as number;
  const fixedExpenses = i.fixedExpenses as number;
  const volume = i.volume as number;
  const volumeSource = i.volumeSource as ResolvedVolumeSource;
  const variableCost = calculateVariableCost(price, taxRate, i.fees);
  if (variableCost == null || !Number.isFinite(variableCost))
    return calcInvalid([nonFiniteResultError("variableCost")]);
  const contributionMargin = calculateContributionMargin(price, unitCost, variableCost);
  if (!Number.isFinite(contributionMargin))
    return calcInvalid([nonFiniteResultError("contributionMargin")]);
  const contributionMarginPct = calculateContributionMarginPct(price, contributionMargin);
  if (!Number.isFinite(contributionMarginPct))
    return calcInvalid([nonFiniteResultError("contributionMarginPct")]);
  const breakEvenUnits = calculateBreakEvenUnits(fixedExpenses, contributionMargin);
  if (Number.isNaN(breakEvenUnits)) return calcInvalid([nonFiniteResultError("breakEvenUnits")]);
  const breakEvenRevenue = calculateBreakEvenRevenue(fixedExpenses, contributionMarginPct);
  if (Number.isNaN(breakEvenRevenue))
    return calcInvalid([nonFiniteResultError("breakEvenRevenue")]);

  const finiteOutputs = {
    revenue: finiteResult(price * volume),
    totalVariable: finiteResult((unitCost + variableCost) * volume),
    totalContribution: finiteResult(contributionMargin * volume),
  };
  const invalidOutput = Object.entries(finiteOutputs).find(([, value]) => !Number.isFinite(value));
  if (invalidOutput) return calcInvalid([nonFiniteResultError(invalidOutput[0])]);
  const result = finiteResult(finiteOutputs.totalContribution - fixedExpenses);
  if (!Number.isFinite(result)) return calcInvalid([nonFiniteResultError("result")]);

  return calcOk({
    price,
    unitCost,
    variableCost,
    contributionMargin,
    contributionMarginPct,
    breakEvenUnits,
    breakEvenRevenue,
    volume,
    volumeSource,
    ...finiteOutputs,
    result,
  });
}

export interface ProductComputation {
  recipeCost: number;
  packagingCost: number;
  unitCost: number;
  variableCost: number;
  contributionMargin: number;
  contributionMarginPct: number;
}

export function computeProduct(args: {
  ingredients: IngredientRow[];
  packaging: PackagingRow[];
  yieldQty: number | null;
  price: number | null;
  taxRate: number | null;
  fees: FeeRow[];
}): CalculationResult<ProductComputation> {
  // FIN-002/003: ausência vira incomplete; número inválido vira invalid.
  const missing: MissingField[] = [];
  const errors: CalculationError[] = [];
  args.ingredients.forEach((row, i) => {
    collectNumericError(errors, `ingredients[${i}].used_qty`, row.used_qty, { minExclusive: 0 });
    collectNullableNumber(missing, errors, `ingredients[${i}].package_price`, row.package_price, {
      min: 0,
    });
    collectNullableNumber(missing, errors, `ingredients[${i}].package_qty`, row.package_qty, {
      minExclusive: 0,
    });
    if (row.package_unit == null) missing.push({ field: `ingredients[${i}].package_unit` });
  });
  args.packaging.forEach((row, i) => {
    collectNumericError(errors, `packaging[${i}].package_price`, row.package_price, { min: 0 });
    collectNumericError(errors, `packaging[${i}].units_per_package`, row.units_per_package, {
      minExclusive: 0,
    });
  });
  missing.push(...missingFeeFields(args.fees));
  errors.push(...invalidFeeErrors(args.fees));
  const rateError = combinedRateError(args.taxRate, args.fees);
  if (rateError !== null) errors.push(rateError);
  collectNullableNumber(missing, errors, "yieldQty", args.yieldQty, { minExclusive: 0 });
  collectNullableNumber(missing, errors, "price", args.price, { min: 0 });
  collectNullableNumber(missing, errors, "taxRate", args.taxRate, { min: 0, max: 100 });
  if (errors.length > 0) return calcInvalid(errors);
  if (missing.length > 0) return calcIncomplete(missing);

  const yieldQty = args.yieldQty as number;
  const price = args.price as number;
  const taxRate = args.taxRate as number;
  const recipeCost = calculateRecipeCost(args.ingredients);
  if (recipeCost == null || !Number.isFinite(recipeCost))
    return calcInvalid([nonFiniteResultError("recipeCost")]);
  const packagingCost = calculatePackagingCost(args.packaging);
  if (!Number.isFinite(packagingCost)) return calcInvalid([nonFiniteResultError("packagingCost")]);
  const unitCost = calculateUnitCost(recipeCost, yieldQty, packagingCost);
  if (unitCost == null || !Number.isFinite(unitCost))
    return calcInvalid([nonFiniteResultError("unitCost")]);
  const variableCost = calculateVariableCost(price, taxRate, args.fees);
  if (variableCost == null || !Number.isFinite(variableCost))
    return calcInvalid([nonFiniteResultError("variableCost")]);
  const contributionMargin = calculateContributionMargin(price, unitCost, variableCost);
  if (!Number.isFinite(contributionMargin))
    return calcInvalid([nonFiniteResultError("contributionMargin")]);
  const contributionMarginPct = calculateContributionMarginPct(price, contributionMargin);
  if (!Number.isFinite(contributionMarginPct))
    return calcInvalid([nonFiniteResultError("contributionMarginPct")]);
  return calcOk({
    recipeCost,
    packagingCost,
    unitCost,
    variableCost,
    contributionMargin,
    contributionMarginPct,
  });
}
