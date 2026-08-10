export type NumericDisplayState = "ok" | "incomplete" | "invalid" | "infinite";

/** Classifica valores para apresentação financeira (V7 §8.3 / FIN-003). */
export function numericDisplayState(v: number | null | undefined): NumericDisplayState {
  if (v == null) return "incomplete";
  if (typeof v !== "number" || Number.isNaN(v) || v === Number.NEGATIVE_INFINITY) return "invalid";
  if (v === Number.POSITIVE_INFINITY) return "infinite";
  return "ok";
}

function displayFallback(v: number | null | undefined): string | null {
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

export const brl = (v: number | null | undefined) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v as number);
};

export const pct = (v: number | null | undefined, digits = 2) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return `${(v as number).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

export const num = (v: number | null | undefined, digits = 2) => {
  const fallback = displayFallback(v);
  if (fallback !== null) return fallback;
  return (v as number).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};
