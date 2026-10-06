import "./helpers/otel-metrics";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeSendChatMessage } from "@/lib/chat-execution.server";
import { groundFinancialOutput } from "@/lib/ai/financial-output-grounding";
import {
  contentResponse,
  createFakeBudgetLedger,
  createFakeConversationService,
  installFakeDatabase,
  restoreFakeDatabase,
  TEST_IDENTITY,
} from "./helpers/chat-execution-fakes";

afterEach(() => {
  restoreFakeDatabase();
  vi.restoreAllMocks();
});

describe("fronteiras numéricas da resposta financeira", () => {
  const user = (content: string) => ({ role: "user", content });
  const tool = (value: unknown) => ({ role: "tool", content: JSON.stringify(value) });

  it.each([
    ["R$ 1.234,56", "Preço R$ 1.234,56.", false],
    ["R$ 1.234,56", "Preço R$ 1.234,57.", true],
    ["R$ 10,49", "Preço R$ 10,50.", true],
    ["R$ -3,25", "Perda R$ -3,25.", false],
    ["Taxa 2,5%", "Taxa 2,50%.", false],
    ["Taxa 2,5%", "Taxa 2,6%.", true],
    ["10 unidades", "Custo R$ 10,00.", true],
    ["Produto 05-10", "Custo R$ 10,00.", true],
    ["Taxa 10%", "Custo R$ 10,00.", true],
    ["Preço R$ 10", "Taxa 10%.", true],
    ["Imposto explicitamente 0%", "Imposto 0%.", false],
    ["Quatro reais?", "Custo R$ 4,00.", true],
    ["Custa 4 reais", "Custo R$ 4,00.", false],
    ["Vendo por 30", "Preço R$ 30,00.", false],
    ["R$ 4,00", "Custo R$ **10,00**.", true],
    ["**R$ 4,00**", "Custo **R$ 4,00**.", false],
    ["R$ -3,25", "Perda R$ − 3,25.", false],
    ["Taxa 2,5%", "Taxa **2,6**%.", true],
    ["R$ 10", "Perda -R$ 10.", true],
    ["-R$ 10", "Preço R$ 10.", true],
    ["- R$ 10", "Perda R$ -10.", false],
    ["R$ -10", "Perda −R$ 10.", false],
    ["Sem custo informado", "Custo BRL 10,00.", true],
    ["BRL 10,00", "Preço R$ 10.", false],
    ["Sem custo informado", "Valor de 1 real.", true],
    ["Valor de 1 real", "Custo R$ 1,00.", false],
    ["Sem taxa informada", "Taxa de 2,5 por cento.", true],
    ["Taxa de 2,5 por cento", "Taxa 2,5%.", false],
    ["R$ 1*0,00", "Preço R$ 10,00.", true],
    ["R$ 1_0,00", "Preço R$ 10,00.", true],
    ["R$ 10", "Preço R$ 1*0,00.", true],
    ["R$ 10", "Preço R$ 1_0,00.", true],
    ["Custo informado R$ 1**0**,00.", "Custo R$ 10,00.", true],
    ["Custo informado **R$ 1**0,00.", "Custo R$ 10,00.", true],
    ["Margem informada 3**0**%.", "Margem 30%.", true],
    ["Custo informado R$ 1**0**,00.", "Custo R$ 1,00.", true],
    ["Custo informado **R$ 1**0,00.", "Custo R$ 1,00.", true],
    ["Margem informada 3**0%.", "Margem 0%.", true],
    ["Custo informado R$ 4,00.", "Custo R$ **4,00**.", false],
    ["Margem informada 30%.", "Margem **30**%.", false],
    ["Taxa 5%", "Taxa ,5%.", true],
  ])("fonte %s / resposta %s / bloqueio %s", (source, content, blocked) => {
    expect(groundFinancialOutput(content, [user(source)]).blocked).toBe(blocked);
  });

  it("aceita cálculo recebido em campo financeiro seguro, sem confiar em quantidades", () => {
    const source = tool({ ok: true, calculation: { totalCost: "10.0000", taxRate: "0.025" } });
    expect(groundFinancialOutput("Custo R$ 10,00; imposto 2,5%.", [source]).blocked).toBe(false);
    expect(
      groundFinancialOutput("Custo R$ 1,00.", [tool({ ok: true, ingredientCount: 1 })]).blocked,
    ).toBe(true);
  });

  it("não aceita campo de ferramenta recusada ou JSON inválido", () => {
    const source = tool({ ok: false, totalCost: "10" });
    expect(groundFinancialOutput("Custo R$ 10,00.", [source]).blocked).toBe(true);
    expect(groundFinancialOutput("Custo R$ 10,00.", [{ role: "tool", content: "{" }]).blocked).toBe(
      true,
    );
  });

  it("mantém o sinal de campo financeiro de ferramenta bem-sucedida", () => {
    const source = tool({ ok: true, amount: "-10" });
    expect(groundFinancialOutput("Perda -R$ 10,00.", [source]).blocked).toBe(false);
    expect(groundFinancialOutput("Valor R$ 10,00.", [source]).blocked).toBe(true);
  });

  it("ignora exemplos do sistema e números anteriores do assistente", () => {
    const sources = [
      { role: "system", content: "Use R$ 1.234,56 como exemplo de formatação." },
      { role: "assistant", content: "Seu custo é R$ 10,00." },
    ];
    expect(groundFinancialOutput("Custo R$ 10,00.", sources).blocked).toBe(true);
    expect(groundFinancialOutput("Preço R$ 1.234,56.", sources).blocked).toBe(true);
  });

  it.each([
    "Custo R$ 1,2,3.",
    "Custo R$ NaN.",
    "Margem Infinity%.",
    "Custo R$ **Na**N.",
    "Margem **Infi**nity%.",
    "Custo R$ N\u200baN.",
    "Custo Ｒ＄ ＮａＮ.",
    "Taxa ,5%.",
    "Custo R$ ,50.",
  ])("recusa valor inválido sem derrubar o chat: %s", (content) => {
    expect(groundFinancialOutput(content, []).blocked).toBe(true);
  });

  it("mantém orientação sem número mesmo com fonte inválida", () => {
    const text = "Informe sua alíquota efetiva para completar os dados.";
    expect(groundFinancialOutput(text, [user("Imposto R$ 1,2,3.")]).content).toBe(text);
  });
});

async function answer(message: string, modelText: string, previousAssistant?: string) {
  installFakeDatabase();
  const conversations = createFakeConversationService();
  conversations.listMessages = async () => [
    ...(previousAssistant
      ? [{ id: "old", role: "assistant", content: previousAssistant, createdAt: new Date() }]
      : []),
    { id: "user", role: "user", content: message, createdAt: new Date() },
  ];
  const persisted = vi.spyOn(conversations, "appendMessage");
  const ledger = createFakeBudgetLedger();
  const settled = vi.spyOn(ledger, "settle");
  const result = await executeSendChatMessage({ message }, TEST_IDENTITY, {
    modelCaller: async () => contentResponse(modelText),
    conversationService: conversations,
    budgetLedger: ledger,
  });
  return { result, persisted, settled };
}

describe("chat: valores financeiros com fonte antes de persistir", () => {
  it("bloqueia a soma real observada no Chrome, preservando a liquidação da chamada", async () => {
    const { result, persisted, settled } = await answer(
      "Pizza QA Chrome 05-10: massa R$ 4,00 e queijo R$ 6,00; vendo por R$ 30,00.",
      "Os ingredientes custam R$ 4,00 + R$ 6,00 = R$ 10,00 por unidade.",
    );
    expect(result.content).not.toContain("R$ 10,00");
    expect(result.content).toContain("motor financeiro");
    const assistant = persisted.mock.calls.find(([, input]) => input.role === "assistant");
    expect(assistant?.[1].content).toBe(result.content);
    expect(settled).toHaveBeenCalledOnce();
  });

  it("mantém os valores explícitos do usuário com formatação brasileira", async () => {
    const text = "Preço R$ 30,00; ingrediente R$ 4,00; taxa 2,5%.";
    const { result } = await answer("Vendo por R$ 30 e pago R$ 4. Minha taxa é 2,5%.", text);
    expect(result.content).toBe(text);
  });

  it("não transforma taxa ausente em percentual zero", async () => {
    const { result } = await answer("Não informei minha taxa.", "Sua taxa é 0%.");
    expect(result.content).not.toContain("0%");
    expect(result.content).toContain("motor financeiro");
  });

  it("uma resposta antiga do próprio modelo não autoriza valor sem fonte", async () => {
    const { result } = await answer(
      "Confirme somente os dados disponíveis.",
      "Custo R$ 10,00.",
      "Custo R$ 10,00.",
    );
    expect(result.content).not.toContain("R$ 10,00");
  });

  it.each([
    ["R$ 10", "Perda -R$ 10."],
    ["Sem preço informado", "Preço BRL 10,00."],
    ["Sem valor informado", "Valor de 1 real."],
    ["Sem taxa informada", "Taxa de 2,5 por cento."],
    ["R$ 1*0,00", "Preço R$ 10,00."],
    ["R$ 1_0,00", "Preço R$ 10,00."],
    ["Custo informado R$ 1**0**,00.", "Custo R$ 10,00."],
    ["Custo informado **R$ 1**0,00.", "Custo R$ 10,00."],
    ["Margem informada 3**0**%.", "Margem 30%."],
    ["Custo informado R$ 1**0**,00.", "Custo R$ 1,00."],
    ["Custo informado **R$ 1**0,00.", "Custo R$ 1,00."],
    ["Margem informada 3**0%.", "Margem 0%."],
    ["Sem custo informado", "Custo R$ **Na**N."],
    ["Sem margem informada", "Margem **Infi**nity%."],
  ])("não persiste a variação S6: %s / %s", async (source, modelText) => {
    const { result, persisted, settled } = await answer(source, modelText);
    expect(result.content).toContain("motor financeiro");
    expect(result.content).not.toBe(modelText);
    const assistant = persisted.mock.calls.find(([, input]) => input.role === "assistant");
    expect(assistant?.[1].content).toBe(result.content);
    expect(settled).toHaveBeenCalledOnce();
  });

  it("mantém a fonte contígua literal e o negrito somente na resposta", async () => {
    const text = "Custo **R$ 4,00**; margem **30**%.";
    const { result, persisted, settled } = await answer("Custo R$ 4,00 e margem 30%.", text);
    expect(result.content).toBe(text);
    const assistant = persisted.mock.calls.find(([, input]) => input.role === "assistant");
    expect(assistant?.[1].content).toBe(text);
    expect(settled).toHaveBeenCalledOnce();
  });
});
