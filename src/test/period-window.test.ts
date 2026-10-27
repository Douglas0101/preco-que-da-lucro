// WP `dashboard-periodo-2026-10-26` — F1 (RED).
//
// Prova que a fronteira do período é calculada no fuso do **negócio**
// (`America/Sao_Paulo`) e não no fuso do processo.
//
// O defeito medido: `periodStart` muta o relógio local com
// `setHours/setDate/setMonth`. Em BRT (TZ desta bancada, -03) o resultado
// coincide com a meia-noite de São Paulo e o defeito fica **invisível**; sob
// `TZ=UTC` — o fuso dos runners do CI — a mesma chamada devolve `00:00Z`, que é
// `21:00` do dia anterior em BRT. Por isso:
//   1. as asserções usam ISO **literal** (oráculo independente, não a
//      implementação);
//   2. o RED é capturado com `TZ=UTC`;
//   3. T7 é uma guarda de **fonte**, independente de fuso, para o gate não
//      depender do ambiente: o módulo não pode conter mutadores de relógio
//      local e precisa declarar o fuso de negócio.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { periodEnd, periodStart, periodWindow, type DashboardPeriod } from "@/lib/period-window";

const ISO = (value: Date) => value.toISOString();

/** Instante fixo: 25/10/2026 09:00 BRT (12:00Z). */
const OCTOBER = new Date("2026-10-25T12:00:00.000Z");
/** Instante fixo: 10/01/2027 09:00 BRT (12:00Z) — primeiro mês do ano e do Q1. */
const JANUARY = new Date("2027-01-10T12:00:00.000Z");
/** Instante fixo: 10/02/2026 09:00 BRT (12:00Z). */
const FEBRUARY = new Date("2026-02-10T12:00:00.000Z");

const PERIODS: readonly DashboardPeriod[] = ["month", "quarter", "year"];

describe("periodStart — fronteira no fuso do negócio (America/Sao_Paulo)", () => {
  it("T1 — mês começa à meia-noite BRT de 01/10, não à meia-noite UTC", () => {
    expect(ISO(periodStart("month", OCTOBER))).toBe("2026-10-01T03:00:00.000Z");
  });

  it("T2 — trimestre começa à meia-noite BRT de 01/10 (Q4)", () => {
    expect(ISO(periodStart("quarter", OCTOBER))).toBe("2026-10-01T03:00:00.000Z");
  });

  it("T3 — ano começa à meia-noite BRT de 01/01", () => {
    expect(ISO(periodStart("year", OCTOBER))).toBe("2026-01-01T03:00:00.000Z");
  });

  it("T4 — em janeiro mês, trimestre e ano coincidem (colapso é intencional)", () => {
    const starts = PERIODS.map((period) => ISO(periodStart(period, JANUARY)));
    expect(starts).toEqual([
      "2027-01-01T03:00:00.000Z",
      "2027-01-01T03:00:00.000Z",
      "2027-01-01T03:00:00.000Z",
    ]);
  });

  it("T5 — o relógio vem do argumento `now`, nunca da parede", () => {
    // Datas fixas: se a implementação ignorasse `now`, os dois valores
    // coincidiriam com o mês corrente da bancada e este par falharia.
    expect(ISO(periodStart("month", OCTOBER))).not.toBe(ISO(periodStart("month", JANUARY)));
  });

  it("T6 — fevereiro trava o offset: 01/02/2026 00:00 BRT = 03:00Z", () => {
    expect(ISO(periodStart("month", FEBRUARY))).toBe("2026-02-01T03:00:00.000Z");
    expect(ISO(periodEnd("month", FEBRUARY))).toBe("2026-03-01T03:00:00.000Z");
  });

  it("T8 — dezembro fecha o mês e vira o ano do calendário", () => {
    const december = new Date("2026-12-15T12:00:00.000Z");
    expect(ISO(periodStart("month", december))).toBe("2026-12-01T03:00:00.000Z");
    expect(ISO(periodEnd("month", december))).toBe("2027-01-01T03:00:00.000Z");
  });

  it("T9 — o trimestre tem 3 meses: Q4 de 2026 abre em 01/10 e fecha em 01/01", () => {
    const window = periodWindow("quarter", OCTOBER);
    expect(ISO(window.from)).toBe("2026-10-01T03:00:00.000Z");
    expect(ISO(window.to)).toBe("2027-01-01T03:00:00.000Z");
  });

  it("T10 — o ano tem 12 meses: abre em 01/01 e fecha em 01/01 do ano seguinte", () => {
    const window = periodWindow("year", OCTOBER);
    expect(ISO(window.from)).toBe("2026-01-01T03:00:00.000Z");
    expect(ISO(window.to)).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("fonte de period-window — sem relógio local (guarda independente de fuso)", () => {
  // Mesmo padrão de `perf-evidence.test.ts`: `fileURLToPath(import.meta.url)` +
  // operações de path. `new URL(relativo, import.meta.url)` sob jsdom devolve um
  // objeto `URL` que o `fileURLToPath` do Node recusa (medido em F1).
  const sourcePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "lib",
    "period-window.ts",
  );

  // Controle negativo: os padrões abaixo precisam REPROVAR um texto plantado.
  // Sem isto, um regex mal escrito (ou um `source` vazio) passaria por vacuidade.
  const PLANTED_DEFECT = "from.setHours(0, 0, 0, 0);";

  it("T7a — o regex de mutadores locais reprova o defeito plantado (controle negativo)", () => {
    const localClockMutator = /\b(setHours|setDate|setMonth|setFullYear|getMonth)\s*\(/;
    expect(localClockMutator.test(PLANTED_DEFECT)).toBe(true);
  });

  it("T7b — o módulo não usa mutadores de relógio local nem leitores locais de mês", () => {
    const source = readFileSync(sourcePath, "utf8");
    const localClockMutator = /\b(setHours|setDate|setMonth|setFullYear|getMonth)\s*\(/;
    expect(source).not.toMatch(localClockMutator);
  });

  it("T7c — o módulo declara o fuso de negócio como símbolo de código, não em prosa", () => {
    const source = readFileSync(sourcePath, "utf8");
    // Ancorar no símbolo (e no uso em `timeZone:`) impede o falso verde medido em
    // F1: a menção em comentário satisfazia um regex frouxo.
    expect(source).toMatch(/\bBUSINESS_TIME_ZONE\s*=\s*"America\/Sao_Paulo"/);
    expect(source).toMatch(/timeZone:\s*BUSINESS_TIME_ZONE/);
  });
});
