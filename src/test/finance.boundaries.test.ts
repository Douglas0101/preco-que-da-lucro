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
    expect(simulation).toContain('role="alert"');
    expect(diagnostic).toContain("!Number.isFinite(rawDiff)");
  });

  it("impõe taxas individuais abaixo de 100% no BFF", () => {
    const source = projectFile("src/lib/products.functions.ts");
    expect(source).toContain("tax_rate: z.number().finite().min(0).lt(100)");
    expect(source).toContain("percentage: z.number().finite().min(0).lt(100)");
  });
});

describe("fronteiras de proveniência FIN-004", () => {
  it("torna a origem do volume obrigatória no contrato do motor", () => {
    const finance = projectFile("src/lib/finance.ts");

    expect(finance).toContain('export type VolumeSource = "real" | "manual_simulation"');
    expect(finance).toContain("volumeSource: VolumeSource");
    expect(finance).toContain('return source === "real"');
    expect(finance).toContain("Volume numérico não pode ter origem desconhecida");
  });

  it("remove o cenário atual fictício e inicia o volume manual vazio", () => {
    const simulation = projectFile("src/routes/_authenticated/simulacoes.tsx");

    expect(simulation).not.toMatch(/const\s+volume\s*=\s*100/);
    expect(simulation).not.toContain("Cenário atual");
    expect(simulation).not.toContain("Diferença vs. atual");
    expect(simulation).toContain('volume: ""');
    expect(simulation).toContain('volumeSource: "manual_simulation"');
    expect(simulation).toContain("Faturamento simulado");
    expect(simulation).toContain("Resultado operacional simulado dentro do escopo informado");
    expect(simulation).toContain("aria-describedby");
  });

  it("não apresenta soma de preços ou média simples como KPI consolidado", () => {
    const dashboard = projectFile("src/routes/_authenticated/inicio.tsx");

    expect(dashboard).not.toContain("totalRevenue");
    expect(dashboard).not.toContain("sumCmPct");
    expect(dashboard).not.toContain("avgCmPct");
    expect(dashboard).not.toContain("calculateBreakEvenRevenue");
    expect(dashboard).toContain('label="Faturamento real"');
    expect(dashboard).toContain('description="Nenhuma venda real registrada."');
  });

  it("distingue falha de consulta de uma coleção financeira vazia", () => {
    for (const path of [
      "src/routes/_authenticated/inicio.tsx",
      "src/routes/_authenticated/simulacoes.tsx",
    ]) {
      const source = projectFile(path);
      expect(source).toContain("Result.error");
      expect(source).toContain('setLoadStatus("error")');
      expect(source).toContain("Referência de atendimento");
      expect(source).toContain("Tentar novamente");
    }
  });
});
