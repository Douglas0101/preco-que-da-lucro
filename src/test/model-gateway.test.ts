import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callModelForTests, retryDelayMsForTests } from "@/lib/chat.functions";
import { GATEWAY_TOOLS } from "@/lib/ai/tool-registry";
import { budgetConfigFromEnv, estimateModelCost } from "@/lib/ai/budget-ledger.server";
import { parseAiUsage } from "@/lib/ai/token-usage";

const messages = [{ role: "user" as const, content: "Olá" }];

function successResponse(): Response {
  return Response.json({ choices: [{ message: { content: "Tudo bem" } }] });
}

beforeEach(() => {
  for (const name of [
    "AI_GATEWAY_API_KEY",
    "LOVABLE_API_KEY",
    "DEEPSEEK_API_KEY",
    "AI_GATEWAY_URL",
    "AI_MODEL",
    "AI_MODEL_MAX_ATTEMPTS",
    "AI_CONSERVATIVE_TOKEN_BUDGET",
  ])
    vi.stubEnv(name, undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("DeepSeek restrito ao servidor Web", () => {
  function native() {
    const key = crypto.randomUUID();
    vi.stubEnv("DEEPSEEK_API_KEY", key);
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com/chat/completions");
    return key;
  }
  function request(mock: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
    const [url, options] = mock.mock.calls[index]!;
    return { url: String(url), options: options!, body: JSON.parse(options!.body as string) };
  }
  it("usa a chave do emissor certo, modo compatível e uso medido", async () => {
    const key = native();
    vi.stubEnv("AI_GATEWAY_API_KEY", crypto.randomUUID());
    vi.stubEnv("LOVABLE_API_KEY", crypto.randomUUID());
    const f = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        model: "deepseek-flash",
        choices: [{ message: { content: "Resposta da fixture" } }],
        usage: { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 },
      }),
    );
    vi.stubGlobal("fetch", f);
    const result = await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
    const r = request(f);
    expect(r.url).toBe("https://api.deepseek.com/chat/completions");
    expect(r.options.redirect).toBe("error");
    expect(r.options.headers).toMatchObject({ Authorization: `Bearer ${key}` });
    expect(r.body).toMatchObject({
      model: "deepseek-flash",
      thinking: { type: "disabled" },
      max_tokens: 8192,
      messages,
      tools: GATEWAY_TOOLS,
      tool_choice: "auto",
    });
    expect(r.body.max_tokens).toBeLessThanOrEqual(budgetConfigFromEnv().conservativeTokenBudget);
    expect(parseAiUsage(result.usage)).toMatchObject({ kind: "known" });
    expect(
      estimateModelCost("deepseek-flash", 100, 25, {
        "deepseek-flash": { inputPerMillion: 0.3, outputPerMillion: 1.2 },
      }),
    ).toEqual({ cost: "0.0001", status: "known" });
    expect(estimateModelCost("deepseek-flash", 100, 25, {})).toEqual({
      cost: null,
      status: "unknown",
    });
  });
  it("conserva as chamadas e os resultados das ferramentas na rodada seguinte", async () => {
    native();
    const tool = {
      id: "fixture-tool-1",
      function: { name: "get_current_product", arguments: "{}" },
    };
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: null, tool_calls: [tool] } }] }),
      )
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal("fetch", f);
    const first = await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
    const next = [
      ...messages,
      { role: "assistant" as const, content: "", tool_calls: first.choices[0]!.message.tool_calls },
      { role: "tool" as const, content: "fixture autorizada", tool_call_id: tool.id },
    ];
    await callModelForTests(next, GATEWAY_TOOLS, new AbortController().signal);
    // O histórico volta na rodada seguinte com `type` explícito em cada
    // tool_call: sem o campo o destino nativo responde 422
    // (`messages[N]: missing field 'type'`) e a rodada com ferramenta morre.
    const sent = request(f, 1).body.messages as Array<{
      role: string;
      tool_calls?: Array<{ id: string; type?: string; function: { name: string } }>;
    }>;
    expect(sent).toHaveLength(next.length);
    expect(sent.at(-2)).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [{ ...tool, type: "function" }],
    });
    expect(sent.at(-1)).toEqual(next.at(-1));
    expect(sent.at(-2)!.tool_calls!.every((call) => call.type === "function")).toBe(true);
    expect(request(f, 1).body.thinking).toEqual({ type: "disabled" });
    expect(request(f, 1).body).not.toHaveProperty("reasoning_content");
  });
  it("não reaproveita credenciais de outros provedores quando falta a chave DeepSeek", async () => {
    native();
    vi.stubEnv("DEEPSEEK_API_KEY", undefined);
    vi.stubEnv("AI_GATEWAY_API_KEY", crypto.randomUUID());
    vi.stubEnv("LOVABLE_API_KEY", crypto.randomUUID());
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
  });
  it("não envia a chave DeepSeek a outro hostname nem ativa o protocolo nativo ali", async () => {
    const key = native();
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com.example.org/chat/completions");
    const f = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
    const other = crypto.randomUUID();
    vi.stubEnv("AI_GATEWAY_API_KEY", other);
    await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
    expect(request(f).options.headers).toMatchObject({ Authorization: `Bearer ${other}` });
    expect(JSON.stringify(request(f))).not.toContain(key);
    expect(request(f).body).not.toHaveProperty("thinking");
    expect(request(f).body).not.toHaveProperty("max_tokens");
  });
  it.each([
    "https://api.deepseek.com/other",
    "https://api.deepseek.com:444/chat/completions",
    "https://operator@api.deepseek.com/chat/completions",
    "https://api.deepseek.com/chat/completions?debug=true",
    "https://api.deepseek.com/chat/completions#fragment",
  ])("recusa desvio de destino nativo antes de enviar: %s", async (url) => {
    native();
    vi.stubEnv("AI_GATEWAY_URL", url);
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
  });
  it("recusa modelo de outro protocolo e credencial com whitespace", async () => {
    native();
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    vi.stubEnv("AI_MODEL", "google/gemini-3.6-flash");
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    vi.stubEnv("AI_MODEL", "deepseek-flash");
    vi.stubEnv("DEEPSEEK_API_KEY", " ");
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
  });
  it("respeita a reserva de tokens existente e não segue redirecionamento", async () => {
    native();
    vi.stubEnv("AI_CONSERVATIVE_TOKEN_BUDGET", "5000");
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(null, { status: 307, headers: { Location: "https://example.org/other" } }),
      );
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(request(f).body.max_tokens).toBe(5000);
    expect(request(f).body.max_tokens).toBeLessThanOrEqual(
      budgetConfigFromEnv().conservativeTokenBudget,
    );
    expect(request(f).options.redirect).toBe("error");
    expect(f).toHaveBeenCalledTimes(1);
  });
  it.each(["NaN", "1000001", "1", "1000000"])(
    "mantém teto de saída dentro do ledger com configuração %s",
    async (budget) => {
      native();
      vi.stubEnv("AI_CONSERVATIVE_TOKEN_BUDGET", budget);
      const f = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
      vi.stubGlobal("fetch", f);
      await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
      const max = request(f).body.max_tokens;
      expect(max).toBeGreaterThanOrEqual(1);
      expect(max).toBeLessThanOrEqual(8192);
      expect(max).toBeLessThanOrEqual(budgetConfigFromEnv().conservativeTokenBudget);
    },
  );
});

describe("limites do gateway de IA", () => {
  it("repete somente uma falha transitória e limita a duas tentativas", async () => {
    process.env.AI_GATEWAY_API_KEY = crypto.randomUUID();
    process.env.AI_MODEL_MAX_ATTEMPTS = "2";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).resolves.toMatchObject({
      choices: [{ message: { content: "Tudo bem" } }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não repete quota ou rate limit", async () => {
    process.env.AI_GATEWAY_API_KEY = crypto.randomUUID();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propaga cancelamento como AI_TIMEOUT", async () => {
    process.env.AI_GATEWAY_API_KEY = crypto.randomUUID();
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, controller.signal),
    ).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true,
    });
  });
});

describe("diagnóstico da recusa do provedor", () => {
  interface WarnRecord {
    event?: string;
    status?: number;
    model?: string;
    detail?: string;
    issues?: string[];
  }

  function nativeDeepSeek(): string {
    const key = crypto.randomUUID();
    vi.stubEnv("DEEPSEEK_API_KEY", key);
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com/chat/completions");
    return key;
  }

  function warnRecords(warn: { mock: { calls: unknown[][] } }): WarnRecord[] {
    return warn.mock.calls.map((call) => JSON.parse(String(call[0])) as WarnRecord);
  }

  it("registra status e motivo do 4xx em vez de descartar a causa", async () => {
    nativeDeepSeek();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json(
          {
            error: {
              type: "invalid_request_error",
              message: "The reasoning_content in the thinking mode must be passed back",
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });

    const record = warnRecords(warn).find((entry) => entry.event === "ai.model_rejected");
    expect(record).toBeDefined();
    expect(record?.status).toBe(400);
    expect(record?.model).toBe("deepseek-flash");
    expect(String(record?.detail)).toContain("invalid_request_error");
    expect(String(record?.detail)).toContain("reasoning_content");
    warn.mockRestore();
  });

  it("nunca registra a própria chave no detalhe do erro", async () => {
    const key = nativeDeepSeek();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { error: { type: "invalid_request_error", message: `rejected credential ${key}` } },
            { status: 401 },
          ),
        ),
    );

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });

    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain(key);
    expect(logged).toContain("[REDACTED]");
    warn.mockRestore();
  });

  it("registra resposta fora do contrato como não interpretável", async () => {
    nativeDeepSeek();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [] })));

    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });

    const record = warnRecords(warn).find((entry) => entry.event === "ai.model_unparsable");
    expect(record).toBeDefined();
    expect(record?.issues?.length).toBeGreaterThan(0);
    warn.mockRestore();
  });
});

describe("variável definida e vazia conta como ausente", () => {
  function request(mock: ReturnType<typeof vi.fn<typeof fetch>>, index = 0) {
    const [url, options] = mock.mock.calls[index]!;
    return { url: String(url), options: options!, body: JSON.parse(options!.body as string) };
  }

  it("cai no endpoint default documentado quando AI_GATEWAY_URL está vazia", async () => {
    const key = crypto.randomUUID();
    vi.stubEnv("AI_GATEWAY_URL", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", key);
    const f = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).resolves.toMatchObject({ choices: [{ message: { content: "Tudo bem" } }] });
    expect(request(f).url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
    expect(request(f).options.headers).toMatchObject({ Authorization: `Bearer ${key}` });
  });

  it("trata só-espaços como ausente, não como endpoint", async () => {
    vi.stubEnv("AI_GATEWAY_URL", "   ");
    vi.stubEnv("AI_GATEWAY_API_KEY", crypto.randomUUID());
    const f = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", f);
    await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
    expect(request(f).url).toBe("https://ai.gateway.lovable.dev/v1/chat/completions");
  });

  it("usa deepseek-flash quando AI_MODEL está vazia no destino nativo", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", crypto.randomUUID());
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com/chat/completions");
    vi.stubEnv("AI_MODEL", "");
    const f = vi.fn<typeof fetch>().mockResolvedValue(successResponse());
    vi.stubGlobal("fetch", f);
    await callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal);
    expect(request(f).body.model).toBe("deepseek-flash");
  });

  it("credencial vazia falha alto e nomeada, sem trocar de emissor", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com/chat/completions");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", crypto.randomUUID());
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("ai.credential_unusable");
    expect(logged).toContain("deepseek");
    errorSpy.mockRestore();
  });

  // Registro real de produção: `AI_MODEL` (record `J5pElDTcKFX90oTm`,
  // `docs/runbooks/vercel-prod-env-admin.md` §3) tem valor NÃO VERIFICADO, e a
  // forma possível de um registro de painel é um identificador opaco — nem o
  // nome do documentado (`deepseek-flash`) nem o do outro protocolo
  // (`google/gemini-3.6-flash`). Um valor assim quebraria **todo** turno de chat
  // sem degradar; o contrato tem que recusá-lo antes do fetch.
  it("recusa valor opaco de registro de painel no destino nativo", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", crypto.randomUUID());
    vi.stubEnv("AI_GATEWAY_URL", "https://api.deepseek.com/chat/completions");
    vi.stubEnv("AI_MODEL", "J5pElDTcKFX90oTm");
    const f = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", f);
    await expect(
      callModelForTests(messages, GATEWAY_TOOLS, new AbortController().signal),
    ).rejects.toMatchObject({ code: "DEPENDENCY_ERROR" });
    expect(f).not.toHaveBeenCalled();
  });
});
