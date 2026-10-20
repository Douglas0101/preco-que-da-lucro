import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  UNGROUNDED_FINANCIAL_REPLY,
  groundFinancialOutput,
  ungroundedFinancialReply,
} from "@/lib/ai/financial-output-grounding";

const user = (content: string) => ({ role: "user", content });
const assistantWithCalls = (calls: Array<[string, string]>) => ({
  role: "assistant",
  content: "",
  tool_calls: calls.map(([id, name]) => ({ id, function: { name } })),
});
const tool = (id: string, value: unknown) => ({
  role: "tool",
  tool_call_id: id,
  content: JSON.stringify(value),
});

/**
 * DBT-127: o bloqueio financeiro engolia o turno e afirmava registro
 * inexistente. Ele continua sem exibir figura sem lastro, mas agora só confirma
 * o que as tools registraram de fato e mantém o caminho do cliente vivo.
 */
describe("resposta substituta do bloqueio financeiro (DBT-127)", () => {
  it("sem registro no turno, não afirma que os dados foram salvos", () => {
    const messages = [
      user("Meu produto custa R$ 7,00 e eu vendo por R$ 20,00. Qual minha margem?"),
    ];
    const grounded = groundFinancialOutput("Sua margem é 30%.", messages);
    expect(grounded.blocked).toBe(true);
    expect(grounded.content).toBe(UNGROUNDED_FINANCIAL_REPLY);
    expect(grounded.content).toMatch(/Nenhum dado foi registrado/i);
    expect(grounded.content).not.toMatch(/continuam registrados/i);
  });

  it("com tool bem-sucedida, confirma o registro real e mantém o caminho", () => {
    const messages = [
      user("O nome é Bolo de Cenoura. Rendimento: 12 fatias."),
      assistantWithCalls([
        ["call-1", "create_product"],
        ["call-2", "set_yield"],
      ]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
      tool("call-2", { ok: true, result: { yieldQty: "12" } }),
    ];
    const grounded = groundFinancialOutput("A margem fica em 30%.", messages);
    expect(grounded.blocked).toBe(true);
    expect(grounded.content).toContain("o produto");
    expect(grounded.content).toContain("o rendimento");
    expect(grounded.content).not.toMatch(/Nenhum dado foi registrado/i);
    expect(grounded.content).toMatch(/Podemos seguir com o próximo dado/i);
  });

  it("tool que falhou não conta como registro", () => {
    const messages = [
      user("Custo R$ 7,00"),
      assistantWithCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: false, error: { code: "VALIDATION_ERROR" } }),
    ];
    expect(ungroundedFinancialReply(messages)).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });

  it("a resposta substituta nunca traz figura financeira", () => {
    const comRegistro = ungroundedFinancialReply([
      assistantWithCalls([["call-1", "set_price_and_tax"]]),
      tool("call-1", { ok: true, result: { price: "8.00" } }),
    ]);
    for (const text of [UNGROUNDED_FINANCIAL_REPLY, comRegistro]) {
      expect(text).not.toMatch(/R\$/);
      expect(text).not.toMatch(/\d/);
    }
  });

  it("par negativo preservado: figura lastreada pelo usuário não é bloqueada", () => {
    const grounded = groundFinancialOutput("O custo informado é R$ 7,00.", [
      user("Meu custo é R$ 7,00."),
    ]);
    expect(grounded.blocked).toBe(false);
    expect(grounded.content).toBe("O custo informado é R$ 7,00.");
    expect(grounded.unsupportedCount).toBe(0);
  });

  it("o system prompt manda registrar dado bruto antes de responder", () => {
    const source = readFileSync(path.resolve("src/lib/chat-execution.server.ts"), "utf8");
    expect(source).toMatch(/dados brutos/);
    expect(source).toMatch(/chame a ferramenta de registro/i);
    expect(source).toMatch(/Nunca responda com número calculado/i);
  });
});
