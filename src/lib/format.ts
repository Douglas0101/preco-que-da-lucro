export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(v as number) ? (v as number) : 0,
  );

export const pct = (v: number | null | undefined, digits = 2) =>
  `${(Number.isFinite(v as number) ? (v as number) : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  (Number.isFinite(v as number) ? (v as number) : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
