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
