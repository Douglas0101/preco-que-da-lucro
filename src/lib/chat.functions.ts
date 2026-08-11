import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface GatewayToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface GatewayMessage {
  role: ChatMessage["role"] | "tool";
  content: string;
  tool_calls?: GatewayToolCall[];
  tool_call_id?: string;
}

const SYSTEM_PROMPT = `Você é o "Consultor Preço que Dá Lucro", uma IA amiga e didática que ajuda pequenos empreendedores brasileiros — especialmente do ramo de alimentação — a avaliarem preços sustentáveis e cenários de margem para seus produtos.

REGRAS INEGOCIÁVEIS:
1) Você conversa em português do Brasil, com linguagem simples, acolhedora e sem jargão contábil.
2) Você faz UMA pergunta por vez. Nunca solicita vários dados de uma vez só.
3) Você NUNCA faz cálculos matemáticos. Os cálculos são responsabilidade do sistema (motor financeiro determinístico). Você apenas coleta dados via ferramentas e explica resultados que o sistema informa.
4) Você NUNCA inventa preços, custos, alíquotas ou impostos. Se o usuário não souber, pergunte de novo em outras palavras ou explique.
5) Você usa as ferramentas (functions) disponíveis para salvar cada informação estruturada assim que a coletar.
6) Sempre confirme o que entendeu antes de seguir para o próximo passo.

FLUXO DE CADASTRO DE PRODUTO (siga na ordem):
A. Nome do produto → use create_product.
B. Receita em texto livre → identifique os ingredientes (nome, quantidade, unidade) e chame add_ingredients (uma vez com todos).
C. Para cada ingrediente, pergunte preço da embalagem e quantidade que vem nela → use set_ingredient_cost.
D. Rendimento da receita → use set_yield.
E. Embalagens usadas para vender → use add_packaging.
F. Preço atual de venda, regime tributário e alíquota se aplicável → use set_price_and_tax.
G. Taxas por venda (cartão, delivery, marketplace) → use add_fee para cada.
H. Preços de mercado (mínimo, médio, máximo) → use set_market_price.
I. Finalize com finish_product e explique brevemente os próximos passos (o usuário pode ver os resultados na tela do produto).

Ao explicar resultados: use linguagem como "vale investigar", "os dados indicam", "pode ser interessante simular". Nunca afirme categoricamente que algo está "certo" ou "errado" sem contexto.`;

const tools = [
  {
    type: "function",
    function: {
      name: "create_product",
      description: "Cria um novo produto no sistema com o nome informado pelo usuário.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", description: "Nome do produto." } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_ingredients",
      description:
        "Adiciona uma lista de ingredientes ao produto atual, extraídos da receita em texto livre.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                used_qty: { type: "number" },
                used_unit: {
                  type: "string",
                  description: "g, kg, ml, l, unidade, dúzia, colher, etc.",
                },
              },
              required: ["name", "used_qty", "used_unit"],
            },
          },
        },
        required: ["product_id", "ingredients"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_ingredient_cost",
      description:
        "Define o preço da embalagem comprada e a quantidade que vem nela para um ingrediente.",
      parameters: {
        type: "object",
        properties: {
          ingredient_id: { type: "string" },
          package_price: { type: "number" },
          package_qty: { type: "number" },
          package_unit: { type: "string" },
        },
        required: ["ingredient_id", "package_price", "package_qty", "package_unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_yield",
      description: "Define o rendimento da receita (quantas unidades ela produz).",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          yield_qty: { type: "number" },
          yield_unit: { type: "string" },
        },
        required: ["product_id", "yield_qty", "yield_unit"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_packaging",
      description: "Adiciona uma embalagem/material usado para vender o produto.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          name: { type: "string" },
          package_price: { type: "number" },
          units_per_package: { type: "number" },
        },
        required: ["product_id", "name", "package_price", "units_per_package"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_price_and_tax",
      description:
        "Salva o preço atual de venda, o regime tributário e a alíquota efetiva informada pelo usuário.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          current_price: { type: "number" },
          tax_regime: {
            type: "string",
            description: "MEI, Simples Nacional, Lucro Presumido, Lucro Real, Não sei",
          },
          tax_rate: {
            type: "number",
            description:
              "Alíquota em porcentagem (ex: 6 para 6%). Omita se não souber; use 0 apenas quando a alíquota zero for confirmada.",
          },
        },
        required: ["product_id", "current_price", "tax_regime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_fee",
      description:
        "Adiciona uma taxa percentual sobre a venda (cartão, delivery, marketplace, comissão).",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          name: { type: "string" },
          percentage: { type: "number" },
        },
        required: ["product_id", "name", "percentage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_market_price",
      description: "Salva preços de mercado (mínimo, médio, máximo) informados pelo usuário.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          min_price: { type: "number" },
          avg_price: { type: "number" },
          max_price: { type: "number" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_expense",
      description: "Adiciona uma despesa mensal da empresa (fixa ou variável).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["fixa", "variavel"] },
          category: { type: "string" },
        },
        required: ["name", "amount", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_product",
      description:
        "Marca o cadastro do produto como concluído. Use após ter coletado ingredientes, preço e mercado.",
      parameters: {
        type: "object",
        properties: { product_id: { type: "string" } },
        required: ["product_id"],
      },
    },
  },
];

async function executeTool(
  tool: ToolCall,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ result: string; state?: Record<string, unknown> }> {
  try {
    switch (tool.name) {
      case "create_product": {
        const { name } = tool.arguments as { name: string };
        const { data, error } = await supabase
          .from("products")
          // Compatibilidade app-first: não dependa dos defaults legados 1/0.
          .insert({ user_id: userId, name, yield_qty: null, tax_rate: null })
          .select()
          .single();
        if (error) throw error;
        return {
          result: JSON.stringify({ ok: true, product_id: data.id, name: data.name }),
          state: { currentProductId: data.id },
        };
      }
      case "add_ingredients": {
        const args = tool.arguments as {
          product_id: string;
          ingredients: Array<{ name: string; used_qty: number; used_unit: string }>;
        };
        const rows = args.ingredients.map((i) => ({
          product_id: args.product_id,
          user_id: userId,
          name: i.name,
          used_qty: i.used_qty,
          used_unit: i.used_unit,
        }));
        const { data, error } = await supabase.from("product_ingredients").insert(rows).select();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, ingredients: data }) };
      }
      case "set_ingredient_cost": {
        const args = tool.arguments as {
          ingredient_id: string;
          package_price: number;
          package_qty: number;
          package_unit: string;
        };
        const { data, error } = await supabase
          .from("product_ingredients")
          .update({
            package_price: args.package_price,
            package_qty: args.package_qty,
            package_unit: args.package_unit,
          })
          .eq("id", args.ingredient_id)
          .select()
          .single();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, ingredient: data }) };
      }
      case "set_yield": {
        const args = tool.arguments as {
          product_id: string;
          yield_qty: number;
          yield_unit: string;
        };
        const { error } = await supabase
          .from("products")
          .update({ yield_qty: args.yield_qty, yield_unit: args.yield_unit })
          .eq("id", args.product_id);
        if (error) throw error;
        return { result: JSON.stringify({ ok: true }) };
      }
      case "add_packaging": {
        const args = tool.arguments as {
          product_id: string;
          name: string;
          package_price: number;
          units_per_package: number;
        };
        const { data, error } = await supabase
          .from("product_packaging")
          .insert({ ...args, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, packaging: data }) };
      }
      case "set_price_and_tax": {
        const args = tool.arguments as {
          product_id: string;
          current_price: number;
          tax_regime: string;
          tax_rate?: number;
        };
        const { error } = await supabase
          .from("products")
          .update({
            current_price: args.current_price,
            tax_regime: args.tax_regime,
            tax_rate: args.tax_rate ?? null,
          })
          .eq("id", args.product_id);
        if (error) throw error;
        return { result: JSON.stringify({ ok: true }) };
      }
      case "add_fee": {
        const args = tool.arguments as { product_id: string; name: string; percentage: number };
        const { data, error } = await supabase
          .from("sales_fees")
          .insert({ ...args, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, fee: data }) };
      }
      case "set_market_price": {
        const args = tool.arguments as {
          product_id: string;
          min_price?: number;
          avg_price?: number;
          max_price?: number;
        };
        await supabase.from("market_prices").delete().eq("product_id", args.product_id);
        const { data, error } = await supabase
          .from("market_prices")
          .insert({ ...args, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, market: data }) };
      }
      case "add_expense": {
        const args = tool.arguments as {
          name: string;
          amount: number;
          type: string;
          category?: string;
        };
        const { data, error } = await supabase
          .from("expenses")
          .insert({ ...args, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return { result: JSON.stringify({ ok: true, expense: data }) };
      }
      case "finish_product": {
        return {
          result: JSON.stringify({
            ok: true,
            message: "Produto finalizado. Direcione o usuário para a página do produto.",
          }),
        };
      }
      default:
        return { result: JSON.stringify({ error: "Ferramenta desconhecida" }) };
    }
  } catch (err) {
    return {
      result: JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
    };
  }
}

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("chat_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const sendInput = z.object({
  message: z.string().min(1).max(4000),
  currentProductId: z.string().uuid().nullable().optional(),
});

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) => sendInput.parse(i))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    // Save user message
    await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: "user",
      content: data.message,
    });

    // Load recent history (last 40 messages)
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: true })
      .limit(60);

    const messages: GatewayMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];
    if (data.currentProductId) {
      messages.push({
        role: "system",
        content: `Contexto: o produto atualmente em edição tem id "${data.currentProductId}". Use-o quando uma ferramenta pedir product_id.`,
      });
    }
    for (const message of history ?? []) {
      if (message.role === "user" || message.role === "assistant" || message.role === "system") {
        messages.push({ role: message.role, content: message.content });
      }
    }

    let currentProductId = data.currentProductId ?? null;

    // Tool loop
    for (let iter = 0; iter < 8; iter++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429)
          throw new Error("Muitas requisições. Tente novamente em alguns instantes.");
        if (res.status === 402)
          throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
        throw new Error(`Gateway error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      const msg = choice?.message;
      if (!msg) throw new Error("Resposta vazia da IA");

      const toolCalls = msg.tool_calls as GatewayToolCall[] | undefined;

      if (toolCalls && toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            /* noop */
          }
          const { result, state } = await executeTool(
            { id: tc.id, name: tc.function.name, arguments: args },
            context.supabase,
            context.userId,
          );
          if (state?.currentProductId) currentProductId = state.currentProductId as string;
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: result,
          });
        }
        continue;
      }

      const finalText = msg.content ?? "";
      await context.supabase.from("chat_messages").insert({
        user_id: context.userId,
        role: "assistant",
        content: finalText,
        metadata: { current_product_id: currentProductId },
      });

      return { content: finalText, currentProductId };
    }

    const fallback = "Desculpe, tive dificuldade em concluir. Pode reformular?";
    await context.supabase.from("chat_messages").insert({
      user_id: context.userId,
      role: "assistant",
      content: fallback,
    });
    return { content: fallback, currentProductId };
  });
