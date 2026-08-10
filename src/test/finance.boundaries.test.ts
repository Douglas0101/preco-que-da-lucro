import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function projectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("fronteiras de persistência FIN-002", () => {
  it("remove defaults legados que convertiam rendimento/imposto ausentes em 1/0", () => {
    const migration = projectFile(
      "supabase/migrations/20260810014633_drop_unknown_financial_defaults.sql",
    );

    expect(migration).toContain("publique primeiro a aplicação");
    expect(migration).toContain("ALTER COLUMN yield_qty DROP DEFAULT");
    expect(migration).toContain("ALTER COLUMN tax_rate DROP DEFAULT");
  });

  it("preserva rendimento/imposto desconhecidos como null no fluxo conversacional", () => {
    const source = projectFile("src/lib/chat.functions.ts");

    expect(source).toContain("name, yield_qty: null, tax_rate: null");
    expect(source).toContain("tax_rate: args.tax_rate ?? null");
    expect(source).toContain("Omita se não souber");
    expect(source).not.toContain("tax_rate: args.tax_rate ?? 0");
    expect(source).not.toContain("Use 0 se não souber");
  });

  it("preserva null também quando o produto é criado pelo BFF manual", () => {
    const source = projectFile("src/lib/products.functions.ts");

    expect(source).toContain("{ yield_qty: null, tax_rate: null, ...data");
  });
});

describe("fronteiras de entrada FIN-003", () => {
  it("rejeita NaN e Infinity em todos os schemas numéricos do BFF financeiro", () => {
    for (const path of ["src/lib/products.functions.ts", "src/lib/expenses.functions.ts"]) {
      const source = projectFile(path);
      expect(source).not.toMatch(/z\.number\(\)(?!\.finite\(\))/);
    }
  });

  it("rejeita texto vazio e números não finitos nos formulários financeiros", () => {
    const expenses = projectFile("src/routes/_authenticated/despesas.tsx");
    const prices = projectFile("src/routes/_authenticated/precos.tsx");

    expect(expenses).toContain('rawAmount === ""');
    expect(expenses).toContain("!Number.isFinite(amount)");
    expect(prices).toContain("!Number.isFinite(valor)");
  });

  it("mantém invalid distinto de incomplete nos consumidores financeiros", () => {
    for (const path of [
      "src/routes/_authenticated/diagnostico.tsx",
      "src/routes/_authenticated/inicio.tsx",
      "src/routes/_authenticated/ponto-equilibrio.tsx",
      "src/routes/_authenticated/simulacoes.tsx",
    ]) {
      const source = projectFile(path);
      expect(source).toContain("role=");
      expect(source).toContain('"alert"');
      expect(source).toContain("Erro de cálculo");
    }

    const simulation = projectFile("src/routes/_authenticated/simulacoes.tsx");
    const diagnostic = projectFile("src/routes/_authenticated/diagnostico.tsx");
    expect(simulation).toContain('simulated?.status === "invalid"');
    expect(simulation).toContain("Number.isFinite(value) ? value : Number.NaN");
    expect(diagnostic).toContain("!Number.isFinite(rawDiff)");
  });

  it("impõe taxas individuais abaixo de 100% no BFF", () => {
    const source = projectFile("src/lib/products.functions.ts");
    expect(source).toContain("tax_rate: z.number().finite().min(0).lt(100)");
    expect(source).toContain("percentage: z.number().finite().min(0).lt(100)");
  });
});
