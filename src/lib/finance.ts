/**
 * Motor financeiro determinístico.
 * Todos os cálculos do sistema passam por aqui — a IA NUNCA faz contas.
 */

export type Unit =
  | "g" | "kg" | "mg"
  | "ml" | "l"
  | "unidade" | "un" | "dúzia" | "duzia"
  | "pacote" | "caixa" | "colher" | "xicara" | "xícara";

const MASS: Record<string, number> = { mg: 0.001, g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, l: 1000 };
const COUNT: Record<string, number> = { unidade: 1, un: 1, "dúzia": 12, duzia: 12 };

function normUnit(u: string) {
  return (u || "").trim().toLowerCase();
}

/**
 * Converte quantidade entre unidades da mesma família.
 * Retorna null quando as unidades não são convertíveis com segurança.
 */
export function convertUnit(qty: number, from: string, to: string): number | null {
  const f = normUnit(from);
  const t = normUnit(to);
  if (f === t) return qty;
  if (f in MASS && t in MASS) return (qty * MASS[f]) / MASS[t];
  if (f in VOLUME && t in VOLUME) return (qty * VOLUME[f]) / VOLUME[t];
  if (f in COUNT && t in COUNT) return (qty * COUNT[f]) / COUNT[t];
  return null;
}

export interface IngredientRow {
  used_qty: number;
  used_unit: string;
  package_price: number | null;
  package_qty: number | null;
  package_unit: string | null;
}

export function calculateIngredientCost(row: IngredientRow): number {
  if (!row.package_price || !row.package_qty || !row.package_unit) return 0;
  const converted = convertUnit(row.used_qty, row.used_unit, row.package_unit);
  if (converted === null) return 0;
  const pricePerBaseUnit = row.package_price / row.package_qty;
  return converted * pricePerBaseUnit;
}

export function calculateRecipeCost(rows: IngredientRow[]): number {
  return rows.reduce((s, r) => s + calculateIngredientCost(r), 0);
}

export interface PackagingRow {
  package_price: number;
  units_per_package: number;
}
export function calculatePackagingCost(rows: PackagingRow[]): number {
  return rows.reduce(
    (s, r) => s + (r.units_per_package > 0 ? r.package_price / r.units_per_package : 0),
    0,
  );
}

export function calculateUnitCost(recipeCost: number, yieldQty: number, packagingCost: number): number {
  const perUnitIngredients = yieldQty > 0 ? recipeCost / yieldQty : 0;
  return perUnitIngredients + packagingCost;
}

export interface FeeRow { percentage: number }

export function calculateVariableCost(
  price: number,
  taxRate: number,
  fees: FeeRow[],
): number {
  const feesSum = fees.reduce((s, f) => s + (f.percentage || 0), 0);
  return price * ((taxRate + feesSum) / 100);
}

export function calculateContributionMargin(
  price: number,
  unitCost: number,
  variableCost: number,
): number {
  return price - unitCost - variableCost;
}

export function calculateContributionMarginPct(
  price: number,
  contributionMargin: number,
): number {
  if (price <= 0) return 0;
  return (contributionMargin / price) * 100;
}

export function calculateBreakEvenUnits(fixedExpenses: number, cmUnit: number): number {
  if (cmUnit <= 0) return Infinity;
  return fixedExpenses / cmUnit;
}

export function calculateBreakEvenRevenue(fixedExpenses: number, cmPct: number): number {
  if (cmPct <= 0) return Infinity;
  return fixedExpenses / (cmPct / 100);
}

export function calculateRequiredSalesForProfit(
  fixedExpenses: number,
  desiredProfit: number,
  cmUnit: number,
): number {
  if (cmUnit <= 0) return Infinity;
  return (fixedExpenses + desiredProfit) / cmUnit;
}

export interface ScenarioInput {
  price: number;
  unitCost: number;
  taxRate: number;
  fees: FeeRow[];
  fixedExpenses: number;
  volume: number;
}

export interface ScenarioResult {
  price: number;
  unitCost: number;
  variableCost: number;
  contributionMargin: number;
  contributionMarginPct: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  revenue: number;
  totalVariable: number;
  totalContribution: number;
  result: number; // lucro ou prejuízo
}

export function calculateScenario(i: ScenarioInput): ScenarioResult {
  const variableCost = calculateVariableCost(i.price, i.taxRate, i.fees);
  const cm = calculateContributionMargin(i.price, i.unitCost, variableCost);
  const cmPct = calculateContributionMarginPct(i.price, cm);
  const beU = calculateBreakEvenUnits(i.fixedExpenses, cm);
  const beR = calculateBreakEvenRevenue(i.fixedExpenses, cmPct);
  const revenue = i.price * i.volume;
  const totalVariable = (i.unitCost + variableCost) * i.volume;
  const totalContribution = cm * i.volume;
  const result = totalContribution - i.fixedExpenses;
  return {
    price: i.price,
    unitCost: i.unitCost,
    variableCost,
    contributionMargin: cm,
    contributionMarginPct: cmPct,
    breakEvenUnits: beU,
    breakEvenRevenue: beR,
    revenue,
    totalVariable,
    totalContribution,
    result,
  };
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
  yieldQty: number;
  price: number;
  taxRate: number;
  fees: FeeRow[];
}): ProductComputation {
  const recipeCost = calculateRecipeCost(args.ingredients);
  const packagingCost = calculatePackagingCost(args.packaging);
  const unitCost = calculateUnitCost(recipeCost, args.yieldQty || 1, packagingCost);
  const variableCost = calculateVariableCost(args.price || 0, args.taxRate || 0, args.fees);
  const cm = calculateContributionMargin(args.price || 0, unitCost, variableCost);
  const cmPct = calculateContributionMarginPct(args.price || 0, cm);
  return {
    recipeCost,
    packagingCost,
    unitCost,
    variableCost,
    contributionMargin: cm,
    contributionMarginPct: cmPct,
  };
}
