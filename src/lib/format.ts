import Decimal from "decimal.js";

export type NumericDisplayState = "ok" | "incomplete" | "invalid" | "infinite";
export type NumericDisplayValue = number | string | null | undefined;

function displayNumber(v: NumericDisplayValue): number | null {
  if (v == null) return null;
  try {
    const decimal = new Decimal(v);
    if (!decimal.isFinite()) return decimal.isPositive() ? Infinity : NaN;
    const value = decimal.toNumber();
    return Number.isFinite(value) ? value : value > 0 ? Infinity : NaN;
  } catch {
    return NaN;
  }
}

/** Classifica valores para apresentação financeira (V7 §8.3 / FIN-003). */
export function numericDisplayState(v: NumericDisplayValue): NumericDisplayState {
  if (v == null) return "incomplete";
  const value = displayNumber(v);
  if (value == null || Number.isNaN(value) || value === Number.NEGATIVE_INFINITY) return "invalid";
  if (value === Number.POSITIVE_INFINITY) return "infinite";
  return "ok";
}

function displayFallback(v: NumericDisplayValue): string | null {
  switch (numericDisplayState(v)) {
    case "incomplete":
      return "—";
    case "invalid":
      return "Erro de cálculo";
    case "infinite":
      return "Não atingível";
    case "ok":
      return null;
  }
}

export const brl = (v: NumericDisplayValue) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    displayNumber(v) as number,
  );
};

export const pct = (v: NumericDisplayValue, digits = 2) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return `${(displayNumber(v) as number).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

export const num = (v: NumericDisplayValue, digits = 2) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return (displayNumber(v) as number).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
