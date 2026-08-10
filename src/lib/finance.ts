/**
 * Motor financeiro determinístico.
 * Todos os cálculos do sistema passam por aqui — a IA NUNCA faz contas.
 */

/**
 * Contrato de resultado do motor (V7 §8.2 / Plano §6.2, FIN-001 — lote 03).
 * Separa cálculo válido (`ok`), dado incompleto (`incomplete`) e dado
 * inválido (`invalid`). Os entry points emitem `ok`/`incomplete` desde o
 * lote 04 (FIN-002, unknown ≠ zero); `invalid` chega com a taxonomia de
 * erros (lote 10).
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

export function calculateIngredientCost(row: IngredientRow): number | null {
  // FIN-01: dado de embalagem desconhecido (null) não vira custo zero.
  // Zero conhecido (package_price === 0) permanece válido (V7 §8.3).
  // Não finito (NaN/Infinity) é inválido (V7 §8.3) — refinado nos lotes 05/10.
  if (row.package_price == null || row.package_qty == null || row.package_unit == null) return null;
  if (!Number.isFinite(row.package_price) || !Number.isFinite(row.package_qty)) return null;
  if (row.package_qty <= 0) return null;
  const converted = convertUnit(row.used_qty, row.used_unit, row.package_unit);
  // golden (lote 08): conversão incompatível ainda vira custo zero.
  if (converted === null) return 0;
  const pricePerBaseUnit = row.package_price / row.package_qty;
  return converted * pricePerBaseUnit;
}

export function calculateRecipeCost(rows: IngredientRow[]): number | null {
  // Custo total é desconhecido se qualquer ingrediente for desconhecido.
  let sum = 0;
  for (const r of rows) {
    const cost = calculateIngredientCost(r);
    if (cost === null) return null;
    sum += cost;
  }
  return sum;
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

export function calculateUnitCost(
  recipeCost: number,
  yieldQty: number,
  packagingCost: number,
): number | null {
  // FIN-02: rendimento desconhecido/não positivo não vira 1 nem zera o custo.
  if (!Number.isFinite(yieldQty) || yieldQty <= 0) return null;
  return recipeCost / yieldQty + packagingCost;
}

export interface FeeRow {
  percentage: number | null;
}

export function calculateVariableCost(
  price: number,
  taxRate: number | null,
  fees: FeeRow[],
): number | null {
  // FIN-03: alíquota/taxa desconhecida não vira 0%.
  if (taxRate == null || !Number.isFinite(taxRate)) return null;
  let feesSum = 0;
  for (const f of fees) {
    if (f.percentage == null || !Number.isFinite(f.percentage)) return null;
    feesSum += f.percentage;
  }
  return price * ((taxRate + feesSum) / 100);
}

export function calculateContributionMargin(
  price: number,
  unitCost: number,
  variableCost: number,
): number {
  return price - unitCost - variableCost;
}

export function calculateContributionMarginPct(price: number, contributionMargin: number): number {
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
  taxRate: number | null;
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

/** Extrai o valor garantido pela pré-validação — null aqui é bug de invariante. */
function invariant<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`motor financeiro: invariante violada (${what})`);
  return value;
}

/** Campos de taxas ausentes, indexados para a UI apontar a origem. */
function missingFeeFields(fees: FeeRow[]): MissingField[] {
  const missing: MissingField[] = [];
  fees.forEach((f, i) => {
    if (f.percentage == null || !Number.isFinite(f.percentage))
      missing.push({ field: `fees[${i}].percentage` });
  });
  return missing;
}

export function calculateScenario(i: ScenarioInput): CalculationResult<ScenarioResult> {
  const missing: MissingField[] = [];
  if (i.taxRate == null || !Number.isFinite(i.taxRate)) missing.push({ field: "taxRate" });
  missing.push(...missingFeeFields(i.fees));
  if (missing.length > 0) return calcIncomplete(missing);
  const variableCost = invariant(calculateVariableCost(i.price, i.taxRate, i.fees), "variableCost");
  const cm = calculateContributionMargin(i.price, i.unitCost, variableCost);
  const cmPct = calculateContributionMarginPct(i.price, cm);
  const beU = calculateBreakEvenUnits(i.fixedExpenses, cm);
  const beR = calculateBreakEvenRevenue(i.fixedExpenses, cmPct);
  const revenue = i.price * i.volume;
  const totalVariable = (i.unitCost + variableCost) * i.volume;
  const totalContribution = cm * i.volume;
  const result = totalContribution - i.fixedExpenses;
  return calcOk({
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
  // FIN-001/002: dado desconhecido não vira zero/um — vira `incomplete`.
  // Não finito (NaN/Infinity) também é rejeitado aqui (V7 §8.3) — a
  // distinção incomplete/invalid é refinada na taxonomia do lote 10.
  const missing: MissingField[] = [];
  args.ingredients.forEach((row, i) => {
    if (row.package_price == null || !Number.isFinite(row.package_price))
      missing.push({ field: `ingredients[${i}].package_price` });
    if (row.package_qty == null || !Number.isFinite(row.package_qty) || row.package_qty <= 0)
      missing.push({
        field: `ingredients[${i}].package_qty`,
        reason: "conteúdo da embalagem desconhecido, inválido ou não positivo",
      });
    if (row.package_unit == null) missing.push({ field: `ingredients[${i}].package_unit` });
  });
  missing.push(...missingFeeFields(args.fees));
  if (args.yieldQty == null || !Number.isFinite(args.yieldQty) || args.yieldQty <= 0)
    missing.push({
      field: "yieldQty",
      reason: "rendimento desconhecido, inválido ou não positivo",
    });
  if (args.price == null || !Number.isFinite(args.price)) missing.push({ field: "price" });
  if (args.taxRate == null || !Number.isFinite(args.taxRate)) missing.push({ field: "taxRate" });
  if (missing.length > 0) return calcIncomplete(missing);

  // Pós-validação: entradas completas — os cálculos não podem retornar null.
  const yieldQty = invariant(args.yieldQty, "yieldQty");
  const price = invariant(args.price, "price");
  const taxRate = invariant(args.taxRate, "taxRate");
  const recipeCost = invariant(calculateRecipeCost(args.ingredients), "recipeCost");
  const packagingCost = calculatePackagingCost(args.packaging);
  const unitCost = invariant(calculateUnitCost(recipeCost, yieldQty, packagingCost), "unitCost");
  const variableCost = invariant(calculateVariableCost(price, taxRate, args.fees), "variableCost");
  const cm = calculateContributionMargin(price, unitCost, variableCost);
  const cmPct = calculateContributionMarginPct(price, cm);
  return calcOk({
    recipeCost,
    packagingCost,
    unitCost,
    variableCost,
    contributionMargin: cm,
    contributionMarginPct: cmPct,
  });
}
