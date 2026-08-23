import { describe, expect, it } from "vitest";
import { GATEWAY_TOOLS, TOOL_REGISTRY, toolExecutionOutputSchema } from "@/lib/ai/tool-registry";
import { sanitizeAiOutput } from "@/lib/ai/output-sanitizer";
import { contextWithRole } from "./helpers/request-context";

describe("registro tipado das tools de IA", () => {
  it("publica exatamente as dez tools com JSON Schema", () => {
    expect(TOOL_REGISTRY.size).toBe(10);
    expect(GATEWAY_TOOLS).toHaveLength(10);
    expect(GATEWAY_TOOLS.every((tool) => tool.function.parameters.type === "object")).toBe(true);
  });

  it("rejeita entrada inválida antes de construir o executor", () => {
    const definition = TOOL_REGISTRY.get("set_yield");
    const prepared = definition?.prepare(contextWithRole("owner"), {
      product_id: "não-é-uuid",
      yield_qty: Number.POSITIVE_INFINITY,
      yield_unit: "un",
    });
    expect(prepared).toEqual({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("rejeita mutação sem role antes de tocar o banco", () => {
    const definition = TOOL_REGISTRY.get("create_product");
    const prepared = definition?.prepare(contextWithRole("viewer"), { name: "Bolo" });
    expect(prepared).toEqual({ ok: false, code: "AUTHORIZATION_ERROR" });
  });

  it("preserva ausência de imposto como null no executor validado", () => {
    const definition = TOOL_REGISTRY.get("set_price_and_tax");
    const prepared = definition?.prepare(contextWithRole("owner"), {
      product_id: "50000000-0000-4000-8000-000000000005",
      current_price: "10.0000",
      tax_regime: "Não sei",
    });
    expect(prepared?.ok).toBe(true);
  });

  it("transporta percentuais como frações decimais em string", () => {
    const definition = TOOL_REGISTRY.get("add_fee");
    const base = {
      product_id: "50000000-0000-4000-8000-000000000005",
      name: "Cartão",
    };
    expect(definition?.prepare(contextWithRole("owner"), { ...base, percentage: "0.035" }).ok).toBe(
      true,
    );
    expect(definition?.prepare(contextWithRole("owner"), { ...base, percentage: 3.5 })).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("valida a saída pública da tool e remove HTML do texto da IA", () => {
    expect(
      toolExecutionOutputSchema.safeParse({ result: { value: "ok" }, state: {} }).success,
    ).toBe(true);
    expect(toolExecutionOutputSchema.safeParse({ result: "não é objeto" }).success).toBe(false);
    expect(sanitizeAiOutput("<script>alert(1)</script> Olá\u0000 **mundo**")).toBe(
      "alert(1) Olá **mundo**",
    );
  });
});
