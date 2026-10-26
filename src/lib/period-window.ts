/**
 * Janela de período financeira do dashboard (WP `dashboard-periodo-2026-10-26`).
 *
 * Contrato: a janela é `[from, to)` no fuso do **negócio**
 * (`America/Sao_Paulo`), independente do `TZ` do processo, e `to` é o início do
 * período seguinte. O intervalo é semiaberto por duas razões medidas no WP:
 * um limite superior inclusivo duplicaria a virada de período, e a ausência de
 * limite superior admitia venda futura dentro da janela corrente.
 *
 * O fuso é resolvido por `Intl` — Node e browser trazem ICU, então o mesmo
 * módulo serve servidor e cliente sem dependência nova. O offset é resolvido em
 * duas passadas porque o offset depende do instante e o instante depende do
 * offset; duas passadas convergem para qualquer fuso com offset estável na
 * virada (o Brasil não observa horário de verão desde 2019 — limite declarado
 * no SPEC do WP).
 *
 * Módulo puro: sem `fs`, sem banco, sem zod, para não arrastar `*.functions` ao
 * grafo inicial (orçamento §17.7).
 */

/** Período factual do dashboard (mês, trimestre ou ano corrente). */
export type DashboardPeriod = "month" | "quarter" | "year";

/** Fuso do negócio: a fronteira do período é a meia-noite aqui, não no host. */
export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

export interface PeriodWindow {
  /** Instante inclusivo de abertura. */
  from: Date;
  /** Instante exclusivo de fechamento: o início do período seguinte. */
  to: Date;
}

const MONTHS_PER_QUARTER = 3;

const BUSINESS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface BusinessParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function businessParts(instant: Date): BusinessParts {
  if (!Number.isFinite(instant.getTime())) throw new Error("PERIOD_WINDOW_INVALID_INSTANT");
  const parts = BUSINESS_FORMATTER.formatToParts(instant);
  const read = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`PERIOD_WINDOW_INVALID_PART:${type}`);
    return parsed;
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** Deslocamento do fuso, em minutos, no instante dado (positivo a leste de UTC). */
function offsetMinutesAt(instant: Date): number {
  const parts = businessParts(instant);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return (asIfUtc - instant.getTime()) / 60_000;
}

/** Instante UTC da meia-noite de (ano, mês, dia) no fuso do negócio. */
function businessMidnightUtc(year: number, month: number, day: number): Date {
  const wallClock = Date.UTC(year, month - 1, day);
  let instant = wallClock;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallClock - offsetMinutesAt(new Date(instant)) * 60_000;
  }
  return new Date(instant);
}

function firstMonthOf(period: DashboardPeriod, month: number): number {
  if (period === "year") return 1;
  if (period === "quarter") {
    return Math.floor((month - 1) / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER + 1;
  }
  return month;
}

/** Quantos meses o período cobre — 1, 3 ou 12 (`to` é o início do seguinte). */
function monthsInPeriod(period: DashboardPeriod): number {
  if (period === "year") return 12;
  if (period === "quarter") return MONTHS_PER_QUARTER;
  return 1;
}

/**
 * Janela `[from, to)` do período, calculada uma única vez por leitura e usada
 * nas duas agregações do dashboard (ADR-041 §2).
 */
export function periodWindow(period: DashboardPeriod, now: Date = new Date()): PeriodWindow {
  const { year, month } = businessParts(now);
  const startMonth = firstMonthOf(period, month);
  // Índice 0-based do mês de abertura do período seguinte. Somar 1 mês aqui
  // fecharia o trimestre em 1 mês e o ano em 1 mês — defeito medido em F2 e
  // coberto por T8–T10.
  const endIndex = startMonth - 1 + monthsInPeriod(period);
  return {
    from: businessMidnightUtc(year, startMonth, 1),
    to: businessMidnightUtc(year + Math.floor(endIndex / 12), (endIndex % 12) + 1, 1),
  };
}

/** Início do período — atalho de `periodWindow` para consumidores de leitura. */
export function periodStart(period: DashboardPeriod, now: Date = new Date()): Date {
  return periodWindow(period, now).from;
}

/** Fim exclusivo do período — o início do período seguinte. */
export function periodEnd(period: DashboardPeriod, now: Date = new Date()): Date {
  return periodWindow(period, now).to;
}
