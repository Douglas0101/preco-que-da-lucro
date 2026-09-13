import { describe, expect, it } from "vitest";
import { auditEvents, idempotencyRecords, products, toolExecutions } from "@/db/schema";
import { sanitizeToolInput } from "@/lib/ai/tool-payload";
import { runRegisteredTool } from "@/lib/ai/tool-runner";
import type { RequestContext } from "@/lib/request-context";

const tenantId = "72000000-0000-4000-8000-000000000002";
const userId = "71000000-0000-4000-8000-000000000001";
const correlationId = "76000000-0000-4000-8000-000000000006";
const usageId = "78000000-0000-4000-8000-000000000008";

function hasLoneSurrogate(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0xd800 && code <= 0xdfff) return true;
  }
  return false;
}

interface WrittenRow {
  table: unknown;
  values: Record<string, unknown>;
}

/** Fake transaction ladder: registra values/set e devolve rows mínimos por tabela. */
class FakeTransaction {
  private readonly inserts: WrittenRow[] = [];
  private readonly updates: WrittenRow[] = [];
  private claimCounter = 0;
  private executionCounter = 0;

  insertsFor(table: unknown): Record<string, unknown>[] {
    return this.inserts.filter((row) => row.table === table).map((row) => row.values);
  }

  updatesFor(table: unknown): Record<string, unknown>[] {
    return this.updates.filter((row) => row.table === table).map((row) => row.values);
  }

  private rowsFor(table: unknown): Record<string, unknown>[] {
    if (table === idempotencyRecords) {
      this.claimCounter += 1;
      return [{ id: `00000000-0000-4000-8000-00000000000${this.claimCounter}` }];
    }
    if (table === toolExecutions) {
      this.executionCounter += 1;
      return [{ id: `10000000-0000-4000-8000-00000000000${this.executionCounter}` }];
    }
    if (table === products) {
      return [{ id: "20000000-0000-4000-8000-000000000001", name: "Bolo" }];
    }
    return [];
  }

  insert(table: unknown) {
    return {
      values: (values: Record<string, unknown>) => {
        this.inserts.push({ table, values });
        const rows = Promise.resolve(this.rowsFor(table));
        return Object.assign(rows, {
          onConflictDoNothing: () => ({ returning: () => rows }),
          returning: () => rows,
        });
      },
    };
  }

  update(table: unknown) {
    return {
      set: (values: Record<string, unknown>) => {
        this.updates.push({ table, values });
        return { where: () => Promise.resolve() };
      },
    };
  }

  select() {
    return {
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    };
  }

  async execute() {
    return undefined;
  }
}

function fakeContext(transaction: FakeTransaction, roles: string[] = ["owner"]): RequestContext {
  return {
    userId,
    tenantId,
    roles,
    correlationId,
    signal: new AbortController().signal,
    transaction: transaction as unknown as RequestContext["transaction"],
  };
}

describe("persistência da tool execution (§14.3)", () => {
  it("grava tool_call_id, input validado e usage_id na execução", async () => {
    const transaction = new FakeTransaction();
    const result = await runRegisteredTool({
      context: fakeContext(transaction),
      name: "create_product",
      rawArguments: JSON.stringify({ name: "Bolo persistido" }),
      idempotencyKey: "conversation:call-1",
      toolCallId: "call-1",
      usageId,
    });

    expect(result.ok).toBe(true);
    const [execution] = transaction.insertsFor(toolExecutions);
    expect(execution).toMatchObject({
      toolName: "create_product",
      input: { name: "Bolo persistido" },
      toolCallId: "call-1",
      usageId,
      status: "pending",
    });
    const [updated] = transaction.updatesFor(toolExecutions);
    expect(updated).toMatchObject({ status: "succeeded" });
    expect(transaction.insertsFor(auditEvents)).toHaveLength(1);
  });

  it("grava input null e mantém o trace quando o JSON é inválido", async () => {
    const transaction = new FakeTransaction();
    const result = await runRegisteredTool({
      context: fakeContext(transaction),
      name: "create_product",
      rawArguments: "{não-é-json",
      idempotencyKey: "conversation:call-2",
      toolCallId: "call-2",
      usageId,
    });

    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR", replayed: false });
    const [rejected] = transaction.insertsFor(toolExecutions);
    expect(rejected).toMatchObject({
      status: "failed",
      errorCode: "VALIDATION_ERROR",
      input: null,
      toolCallId: "call-2",
      usageId,
    });
  });

  it("redige chaves sensíveis no input de uma rejeição", async () => {
    const transaction = new FakeTransaction();
    const result = await runRegisteredTool({
      context: fakeContext(transaction, ["viewer"]),
      name: "create_product",
      rawArguments: JSON.stringify({
        name: "Sem permissão",
        authorization: "Bearer super-secret",
        api_key: "chave-secreta",
        cookie: "session=abc",
        pricing: "preservado",
      }),
      idempotencyKey: "conversation:call-3",
      toolCallId: "call-3",
      usageId,
    });

    expect(result).toEqual({ ok: false, code: "AUTHORIZATION_ERROR", replayed: false });
    const [rejected] = transaction.insertsFor(toolExecutions);
    expect(rejected.input).toEqual({
      name: "Sem permissão",
      authorization: "[REDACTED]",
      api_key: "[REDACTED]",
      cookie: "[REDACTED]",
      pricing: "preservado",
    });
  });

  it("persiste input sem lone surrogates mesmo com escapes no JSON de entrada", async () => {
    const transaction = new FakeTransaction();
    const result = await runRegisteredTool({
      context: fakeContext(transaction),
      name: "create_product",
      rawArguments: '{"name":"Bolo \\ud83d com low \\udc00 e par \\ud83d\\ude00"}',
      idempotencyKey: "conversation:call-surrogate",
      toolCallId: "call-surrogate",
      usageId,
    });

    expect(result.ok).toBe(true);
    const [execution] = transaction.insertsFor(toolExecutions);
    expect(execution.input).toEqual({ name: "Bolo  com low  e par 😀" });
    expect(hasLoneSurrogate(JSON.stringify(execution.input))).toBe(false);
  });
});

describe("sanitizeToolInput", () => {
  it("redige somente chaves sensíveis estritas", () => {
    expect(
      sanitizeToolInput({
        authorization: "Bearer x",
        Cookie: "a=1",
        token: "t",
        secret: "s",
        password: "p",
        api_key: "k",
        access_token: "não-redige",
        pricing: "não-redige",
      }),
    ).toEqual({
      authorization: "[REDACTED]",
      Cookie: "[REDACTED]",
      token: "[REDACTED]",
      secret: "[REDACTED]",
      password: "[REDACTED]",
      api_key: "[REDACTED]",
      access_token: "não-redige",
      pricing: "não-redige",
    });
  });

  it("aplica os limites de string, array, chave, profundidade e número de chaves", () => {
    const longKey = "k".repeat(130);
    const wide = Object.fromEntries(
      Array.from({ length: 150 }, (_, index) => [`chave_${index}`, index]),
    );
    const sanitized = sanitizeToolInput({
      text: "x".repeat(9_000),
      list: Array.from({ length: 150 }, (_, index) => index),
      [longKey]: "valor",
      wide,
      infinite: Number.POSITIVE_INFINITY,
      nan: Number.NaN,
    });

    expect(sanitized?.text).toHaveLength(8_000);
    expect(sanitized?.list).toHaveLength(100);
    expect(Object.keys(sanitized?.wide ?? {})).toHaveLength(100);
    expect(Object.keys(sanitized ?? {}).find((key) => key.startsWith("kkk"))).toHaveLength(120);
    expect(sanitized?.infinite).toBeNull();
    expect(sanitized?.nan).toBeNull();

    let deep: unknown = "fim";
    for (let level = 0; level < 11; level += 1) deep = { level: deep };
    let cursor: unknown = sanitizeToolInput(deep);
    let levels = 0;
    while (cursor && typeof cursor === "object" && "level" in cursor) {
      cursor = (cursor as { level: unknown }).level;
      levels += 1;
    }
    expect(levels).toBe(9);
    expect(cursor).toBeNull();
  });

  it("remove lone surrogates e preserva pares válidos", () => {
    const sanitized = sanitizeToolInput({
      high: "antes \ud83d depois",
      low: "antes \udc00 depois",
      pair: "antes \u{1F680} depois",
    });

    expect(sanitized).toEqual({
      high: "antes  depois",
      low: "antes  depois",
      pair: "antes 🚀 depois",
    });
    expect(hasLoneSurrogate(JSON.stringify(sanitized))).toBe(false);
  });

  it("não corta par surrogate no limite de 8000 unidades UTF-16", () => {
    const sanitized = sanitizeToolInput({
      fits: "a".repeat(7_998) + "🚀",
      cuts: "a".repeat(7_999) + "🚀b",
    });

    expect(sanitized?.fits).toHaveLength(8_000);
    expect((sanitized?.fits as string).endsWith("🚀")).toBe(true);
    expect(sanitized?.cuts).toHaveLength(7_999);
    expect(hasLoneSurrogate(sanitized?.fits as string)).toBe(false);
    expect(hasLoneSurrogate(sanitized?.cuts as string)).toBe(false);
  });

  it("retorna null para payload que não é objeto JSON", () => {
    expect(sanitizeToolInput(null)).toBeNull();
    expect(sanitizeToolInput("texto")).toBeNull();
    expect(sanitizeToolInput([1, 2, 3])).toBeNull();
    expect(sanitizeToolInput(42)).toBeNull();
  });
});
