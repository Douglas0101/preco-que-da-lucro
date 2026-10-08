import { createHash } from "node:crypto";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { auditEvents, idempotencyRecords, products, rateLimits, toolExecutions } from "@/db/schema";
import { TOOL_REGISTRY } from "@/lib/ai/tool-registry";
import { runRegisteredTool } from "@/lib/ai/tool-runner";
import type { RequestContext } from "@/lib/request-context";

type Row = Record<string, unknown>;
type Rows = Row[] | Error;
const tenantId = "72000000-0000-4000-8000-000000000002";
const userId = "71000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const claimId = "30000000-0000-4000-8000-000000000001";
const executionId = "40000000-0000-4000-8000-000000000001";
const key = "conversation:validation-call";
const rawArguments = JSON.stringify({ name: "Bolo validado" });
const hash = createHash("sha256").update(rawArguments).digest("hex");
const dialect = new PgDialect();

/** No generic success fallback: only explicitly scripted table identities return
 * rows. SQL admission is routed by the actual rateLimits table and statement.
 * This bench proves runner effects, not PostgreSQL locking/concurrency/RLS. */
class ValidationTransaction {
  readonly inserts: { table: unknown; values: Row }[] = [];
  readonly updates: { table: unknown; values: Row; predicate: SQL }[] = [];
  readonly reads: { table: unknown; predicate: SQL }[] = [];
  readonly statements: SQL[] = [];
  readonly insertRows = new Map<unknown, Rows[]>();
  readonly selectRows = new Map<unknown, Rows[]>();
  readonly executionState: Row[] = [];
  admissionRows: Row[] = [];

  private async next(script: Map<unknown, Rows[]>, table: unknown): Promise<Row[]> {
    const result = script.get(table)?.shift() ?? [];
    if (result instanceof Error) throw result;
    return result;
  }

  insert(table: unknown) {
    return {
      values: (values: Row) => {
        this.inserts.push({ table, values });
        const returning = async () => {
          // schema.ts tool_executions_idempotency_uidx: enforce identity, not
          // row count. PostgreSQL's ordinary UNIQUE treats NULL as distinct.
          const identity = ["tenantId", "userId", "toolName", "idempotencyKey"];
          if (
            table === toolExecutions &&
            this.executionState.some((existing) =>
              identity.every((field) => values[field] != null && values[field] === existing[field]),
            )
          ) {
            throw Object.assign(new Error("duplicate tool execution identity"), {
              code: "23505",
              constraint: "tool_executions_idempotency_uidx",
            });
          }
          const rows = await this.next(this.insertRows, table);
          if (table === toolExecutions && rows[0]) {
            this.executionState.push({ ...values, ...rows[0] });
          }
          return rows;
        };
        return Object.assign(Promise.resolve(), {
          returning,
          onConflictDoNothing: () => ({ returning }),
        });
      },
    };
  }

  update(table: unknown) {
    return {
      set: (values: Row) => ({
        where: (predicate: SQL) => {
          this.updates.push({ table, values, predicate });
          return Object.assign(Promise.resolve(), { returning: () => Promise.resolve([]) });
        },
      }),
    };
  }

  select() {
    return {
      from: (table: unknown) => ({
        where: (predicate: SQL) => {
          this.reads.push({ table, predicate });
          return { limit: () => this.next(this.selectRows, table) };
        },
      }),
    };
  }

  async execute(statement: SQL) {
    this.statements.push(statement);
    const query = dialect.sqlToQuery(statement).sql.trim().toLowerCase();
    if (statement.queryChunks.includes(rateLimits) && query.startsWith('update "rate_limits"')) {
      return { rows: this.admissionRows };
    }
    return { rows: [] };
  }

  rowsFor(table: unknown): Row[] {
    return this.inserts.filter((entry) => entry.table === table).map((entry) => entry.values);
  }

  changesFor(table: unknown): Row[] {
    return this.updates.filter((entry) => entry.table === table).map((entry) => entry.values);
  }
}

function context(tx: ValidationTransaction, roles: readonly string[] = ["owner"]): RequestContext {
  return {
    tenantId,
    userId,
    roles,
    correlationId: "76000000-0000-4000-8000-000000000006",
    signal: new AbortController().signal,
    // The request handle is driver-neutral; this isolated fake supplies only
    // the runner/registry query surface and never opens a database connection.
    transaction: tx as unknown as RequestContext["transaction"],
  };
}

function request(tx: ValidationTransaction) {
  return { context: context(tx), name: "create_product", rawArguments, idempotencyKey: key };
}

function admit(tx: ValidationTransaction): void {
  tx.admissionRows = [{ count: 1, last_request: Date.now() }];
}

function successfulExecution(tx: ValidationTransaction): void {
  tx.insertRows.set(toolExecutions, [[{ id: executionId }]]);
  tx.insertRows.set(products, [[{ id: productId, name: "Bolo validado" }]]);
}

function existing(overrides: Row = {}): Row {
  return {
    id: claimId,
    requestHash: hash,
    status: "pending",
    response: null,
    errorCode: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function expectNoExecution(tx: ValidationTransaction): void {
  expect(tx.rowsFor(products)).toEqual([]);
  expect(tx.rowsFor(toolExecutions).filter((row) => row.status === "pending")).toEqual([]);
  expect(tx.changesFor(toolExecutions)).toEqual([]);
  expect(tx.updates.filter((entry) => entry.table !== idempotencyRecords)).toEqual([]);
}

function expectRejected(tx: ValidationTransaction, name: string, code: string): Row {
  expect(tx.rowsFor(idempotencyRecords)).toEqual([]);
  expect(tx.changesFor(idempotencyRecords)).toEqual([]);
  expect(tx.reads).toEqual([]);
  expectNoExecution(tx);
  const rows = tx.rowsFor(toolExecutions);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    tenantId,
    userId,
    toolName: name,
    status: "failed",
    errorCode: code,
  });
  expect(rows[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
  expect(rows[0].durationMs).toEqual(expect.any(Number));
  expect(rows[0].completedAt).toBeInstanceOf(Date);
  expect(tx.rowsFor(auditEvents)).toEqual([
    expect.objectContaining({
      eventType: "ai.tool.rejected",
      resourceId: name,
      safeMetadata: expect.objectContaining({ code, inputHash: rows[0].inputHash }),
    }),
  ]);
  expect(tx.inserts.map((entry) => entry.table)).toEqual([toolExecutions, auditEvents]);
  return rows[0];
}

describe("INV-014: runner validates untrusted arguments using the real registry", () => {
  // Each fixture enters runRegisteredTool, not prepare() directly: INV-014 must
  // reject malformed JSON, non-object JSON, missing and wrongly typed fields.
  it.each([
    "{",
    '{"name":',
    "null",
    "false",
    "42",
    '"Bolo"',
    "[]",
    "",
    "{}",
    '{"name":null}',
    '{"name":12}',
    '{"name":[]}',
    '{"name":"  "}',
    JSON.stringify({ name: "x".repeat(161) }),
  ])("rejects payload %s before admission/claim/domain execution", async (raw) => {
    const tx = new ValidationTransaction();
    const result = await runRegisteredTool({
      ...request(tx),
      rawArguments: raw,
      toolCallId: "call-invalid",
      usageId: "78000000-0000-4000-8000-000000000008",
    });
    expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR", replayed: false });
    const row = expectRejected(tx, "create_product", "VALIDATION_ERROR");
    expect(row).toMatchObject({
      toolCallId: "call-invalid",
      usageId: "78000000-0000-4000-8000-000000000008",
    });
    expect(tx.statements).toEqual([]);
    if (raw === "{") {
      expect(row.input).toBeNull();
      expect(row.inputHash).toBe(createHash("sha256").update(JSON.stringify(raw)).digest("hex"));
    }
  });

  const invalidByTool: Record<string, Row> = {
    create_product: { name: true },
    add_ingredients: { product_id: productId, ingredients: [] },
    set_ingredient_cost: {
      ingredient_id: productId,
      package_price: 1,
      package_qty: "1",
      package_unit: "kg",
    },
    set_yield: { product_id: productId, yield_qty: "0", yield_unit: "kg" },
    add_packaging: {
      product_id: productId,
      name: "Caixa",
      package_price: "1",
      units_per_package: false,
    },
    set_price_and_tax: {
      product_id: productId,
      current_price: "1",
      tax_regime: "Simples",
      tax_rate: "1",
    },
    add_fee: { product_id: productId, name: "Cartão", percentage: "-0.1" },
    set_market_price: { product_id: productId },
    add_expense: { name: "Aluguel", amount: "1", type: "inventado" },
    finish_product: { product_id: "not-a-uuid" },
  };

  it("discovers every registered tool, so adding a tool requires a runtime refusal fixture", () => {
    expect(TOOL_REGISTRY.size).toBeGreaterThan(0);
    expect(Object.keys(invalidByTool).sort()).toEqual([...TOOL_REGISTRY.keys()].sort());
  });

  it.each(Object.entries(invalidByTool))(
    "INV-014 rejects invalid domain fields for %s",
    async (name, input) => {
      const tx = new ValidationTransaction();
      const result = await runRegisteredTool({
        ...request(tx),
        name,
        rawArguments: JSON.stringify(input),
      });
      expect(result).toEqual({ ok: false, code: "VALIDATION_ERROR", replayed: false });
      expectRejected(tx, name, "VALIDATION_ERROR");
      expect(tx.statements).toEqual([]);
    },
  );

  // Positive controls for the same discovered tools: valid schema input reaches
  // the real admission SQL. A blanket schema refusal cannot make this pass.
  const validByTool: Record<string, Row> = {
    create_product: { name: "Bolo" },
    add_ingredients: {
      product_id: productId,
      ingredients: [{ name: "Farinha", used_qty: "1", used_unit: "kg" }],
    },
    set_ingredient_cost: {
      ingredient_id: productId,
      package_price: "1",
      package_qty: "1",
      package_unit: "kg",
    },
    set_yield: { product_id: productId, yield_qty: "1", yield_unit: "un" },
    add_packaging: {
      product_id: productId,
      name: "Caixa",
      package_price: "1",
      units_per_package: "1",
    },
    set_price_and_tax: {
      product_id: productId,
      current_price: "1",
      tax_regime: "Simples",
      tax_rate: "0.1",
    },
    add_fee: { product_id: productId, name: "Cartão", percentage: "0.1" },
    set_market_price: { product_id: productId, avg_price: "1" },
    add_expense: { name: "Aluguel", amount: "1", type: "fixa" },
    finish_product: { product_id: productId },
  };

  it("discovers positive controls for every runtime schema", () => {
    expect(Object.keys(validByTool).sort()).toEqual([...TOOL_REGISTRY.keys()].sort());
  });

  it.each(Object.entries(validByTool))(
    "INV-014 positive schema control reaches admission for %s",
    async (name, input) => {
      const tx = new ValidationTransaction();
      expect(
        await runRegisteredTool({ ...request(tx), name, rawArguments: JSON.stringify(input) }),
      ).toEqual({ ok: false, code: "RATE_LIMIT", replayed: false });
      expectRejected(tx, name, "RATE_LIMIT");
      expect(tx.statements).toHaveLength(3);
      expect(tx.statements.every((statement) => statement.queryChunks.includes(rateLimits))).toBe(
        true,
      );
    },
  );

  it.each(["", "CREATE_PRODUCT", "unknown_tool", "__proto__", "constructor"])(
    "refuses unregistered name %s",
    async (name) => {
      const tx = new ValidationTransaction();
      expect(await runRegisteredTool({ ...request(tx), name })).toEqual({
        ok: false,
        code: "VALIDATION_ERROR",
        replayed: false,
      });
      expectRejected(tx, name, "VALIDATION_ERROR");
      expect(tx.statements).toEqual([]);
    },
  );
});

describe("runner authorization/admission after INV-014 validation", () => {
  it.each([{ roles: [] }, { roles: ["viewer"] }, { roles: ["member"] }])(
    "refuses a valid mutation for roles $roles",
    async ({ roles }) => {
      const tx = new ValidationTransaction();
      expect(await runRegisteredTool({ ...request(tx), context: context(tx, roles) })).toEqual({
        ok: false,
        code: "AUTHORIZATION_ERROR",
        replayed: false,
      });
      expectRejected(tx, "create_product", "AUTHORIZATION_ERROR");
      expect(tx.statements).toEqual([]);
    },
  );

  it.each([
    { allowedToolNames: [] },
    { allowedToolNames: ["add_expense"] },
    { allowedToolNames: ["CREATE_PRODUCT"] },
  ])("refuses a valid tool outside allowlist $allowedToolNames", async ({ allowedToolNames }) => {
    const tx = new ValidationTransaction();
    expect(await runRegisteredTool({ ...request(tx), allowedToolNames })).toEqual({
      ok: false,
      code: "AUTHORIZATION_ERROR",
      replayed: false,
    });
    expectRejected(tx, "create_product", "AUTHORIZATION_ERROR");
    expect(tx.statements).toEqual([]);
  });

  it("refuses missing confirmation before occupying a claim", async () => {
    const tx = new ValidationTransaction();
    expect(await runRegisteredTool({ ...request(tx), requireConfirmation: true })).toEqual({
      ok: false,
      code: "AUTHORIZATION_ERROR",
      replayed: false,
    });
    expectRejected(tx, "create_product", "AUTHORIZATION_ERROR");
    expect(tx.statements).toEqual([]);
  });

  it.each([
    { roles: ["owner"], requireConfirmation: true, confirmed: true },
    { roles: ["admin"], requireConfirmation: false, confirmed: false },
  ])(
    "executes a valid, admitted and authorized request %j (INV-014 positive control)",
    async ({ roles, ...confirmation }) => {
      const tx = new ValidationTransaction();
      admit(tx);
      tx.insertRows.set(idempotencyRecords, [[{ id: claimId }]]);
      successfulExecution(tx);
      const result = await runRegisteredTool({
        ...request(tx),
        context: context(tx, roles),
        rawArguments: JSON.stringify({
          name: "  Bolo validado  ",
          ignored: "untrusted extra field",
        }),
        allowedToolNames: ["create_product"],
        ...confirmation,
      });
      expect(result).toEqual({
        ok: true,
        replayed: false,
        output: {
          result: { productId, name: "Bolo validado" },
          state: { currentProductId: productId },
        },
      });
      expect(tx.rowsFor(products)).toEqual([
        { tenantId, userId, name: "Bolo validado", yieldQty: null, taxRate: null },
      ]);
      expect(tx.rowsFor(toolExecutions)[0].input).toEqual({ name: "Bolo validado" });
      expect(tx.changesFor(idempotencyRecords)).toEqual([
        expect.objectContaining({ status: "succeeded" }),
      ]);
      expect(tx.rowsFor(auditEvents)[0].eventType).toBe("ai.tool.succeeded");
    },
  );

  it("persists a rate refusal without claim or domain mutation (§20.5, not INV-014)", async () => {
    const tx = new ValidationTransaction();
    expect(await runRegisteredTool(request(tx))).toEqual({
      ok: false,
      code: "RATE_LIMIT",
      replayed: false,
    });
    expectRejected(tx, "create_product", "RATE_LIMIT");
    expect(tx.statements).toHaveLength(3);
    expect(tx.statements.every((statement) => statement.queryChunks.includes(rateLimits))).toBe(
      true,
    );
  });
});

describe("§14.4 / INV-009: defensive idempotency and replay (not input validation)", () => {
  function replayBench(row: Row): ValidationTransaction {
    const tx = new ValidationTransaction();
    admit(tx);
    tx.selectRows.set(idempotencyRecords, [[row]]);
    return tx;
  }

  function expectReplayOnly(tx: ValidationTransaction): void {
    expectNoExecution(tx);
    expect(tx.rowsFor(auditEvents)).toEqual([]);
    expect(tx.changesFor(idempotencyRecords)).toEqual([]);
    expect(tx.rowsFor(idempotencyRecords)).toHaveLength(1);
    expect(tx.reads).toHaveLength(1);
    expect(tx.reads[0].table).toBe(idempotencyRecords);
    expect(dialect.sqlToQuery(tx.reads[0].predicate).params).toEqual([
      tenantId,
      userId,
      "ai.tool.create_product",
      key,
    ]);
  }

  it("refuses same key with a different hash without changing the existing claim", async () => {
    const tx = replayBench(existing({ requestHash: "different-request" }));
    expect(await runRegisteredTool(request(tx))).toEqual({
      ok: false,
      code: "CONFLICT",
      replayed: false,
    });
    expectReplayOnly(tx);
  });

  it("replays a sanitized runtime-valid prior result without duplicate execution", async () => {
    let deep: unknown = "discarded";
    for (let level = 0; level < 9; level += 1) deep = { child: deep };
    const longKey = "k".repeat(130);
    const tx = replayBench(
      existing({
        status: "succeeded",
        response: {
          result: {
            text: "ok\u0000\u000b\u000c\u000e\u001f\u007f\t\n",
            long: "x".repeat(8_001),
            list: Array.from({ length: 101 }, (_, index) => index),
            enabled: true,
            empty: null,
            [longKey]: "kept",
            deep,
          },
          state: { currentProductId: productId },
        },
      }),
    );
    const result = await runRegisteredTool(request(tx));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected successful replay");
    expect(result.replayed).toBe(true);
    expect(result.output.result.text).toBe("ok\t\n");
    expect(result.output.result.long).toBe("x".repeat(8_000));
    expect(result.output.result.list).toEqual(Array.from({ length: 100 }, (_, index) => index));
    expect(result.output.result.enabled).toBe(true);
    expect(result.output.result.empty).toBeNull();
    expect(result.output.result["k".repeat(120)]).toBe("kept");
    expect(result.output.result.deep).toEqual({
      child: { child: { child: { child: { child: { child: { child: null } } } } } },
    });
    expect(result.output.state).toEqual({ currentProductId: productId });
    expectReplayOnly(tx);
  });

  it("normalizes a JSON numeric overflow in replay to null, never zero (INV-006/007)", async () => {
    // A JSON numeric token can exceed the JS number range; this uses the real
    // parser rather than mocking Number.isFinite or injecting a built-in type.
    const response: unknown = JSON.parse('{"result":{"overflow":1e309}}');
    const tx = replayBench(existing({ status: "succeeded", response }));
    expect(await runRegisteredTool(request(tx))).toEqual({
      ok: true,
      replayed: true,
      output: { result: { overflow: null } },
    });
    expectReplayOnly(tx);
  });

  // INV-014 also protects the public output boundary: these stored JSON shapes
  // are not valid ToolExecutionOutput and must never become successful replay.
  it.each([
    { response: { result: "bad" } },
    { response: { result: {}, state: { currentProductId: "invalid-uuid" } } },
    { response: ["bad"] },
    { response: true },
  ])(
    "refuses corrupt replay output $response (runtime output validation)",
    async ({ response }) => {
      const tx = replayBench(existing({ status: "succeeded", response }));
      expect(await runRegisteredTool(request(tx))).toEqual({
        ok: false,
        code: "DATABASE_ERROR",
        replayed: false,
      });
      expectReplayOnly(tx);
    },
  );

  it.each([
    { status: "pending", response: null, errorCode: null, code: "CONFLICT" },
    { status: "failed", response: null, errorCode: "NOT_FOUND", code: "NOT_FOUND" },
    { status: "succeeded", response: null, errorCode: null, code: "CONFLICT" },
  ])("returns controlled refusal for existing $status claim", async ({ code, ...state }) => {
    const tx = replayBench(existing(state));
    expect(await runRegisteredTool(request(tx))).toEqual({ ok: false, code, replayed: true });
    expectReplayOnly(tx);
  });

  it.each(["first lookup", "raced lookup"])(
    "reclaims an expired orphan pending claim at %s (no previous execution)",
    async (position) => {
      const tx = new ValidationTransaction();
      admit(tx);
      successfulExecution(tx);
      // Scripted orphan pending fixture with no prior execution. This models
      // a seeded state, without claiming that a transactional crash creates it.
      // An existing same-key execution conflicts with the unique index below.
      expect(tx.executionState).toEqual([]);
      const expired = existing({
        requestHash: "old-hash",
        status: "pending",
        expiresAt: new Date(0),
      });
      tx.selectRows.set(
        idempotencyRecords,
        position === "first lookup" ? [[expired]] : [[], [expired]],
      );
      const before = Date.now();
      expect((await runRegisteredTool(request(tx))).ok).toBe(true);
      const changes = tx.changesFor(idempotencyRecords);
      expect(changes).toHaveLength(2);
      expect(changes[0]).toMatchObject({
        requestHash: hash,
        status: "pending",
        response: null,
        errorCode: null,
      });
      expect((changes[0].expiresAt as Date).getTime()).toBeGreaterThanOrEqual(before + 86_400_000);
      expect(
        tx.updates
          .filter((entry) => entry.table === idempotencyRecords)
          .map((entry) => dialect.sqlToQuery(entry.predicate).params),
      ).toEqual([[claimId], [claimId]]);
      expect(tx.rowsFor(products)).toHaveLength(1);
      expect(tx.rowsFor(toolExecutions)).toHaveLength(1);
      expect(tx.rowsFor(idempotencyRecords)).toHaveLength(position === "first lookup" ? 1 : 2);
    },
  );

  function failedExecution(overrides: Row = {}): Row {
    return {
      id: "40000000-0000-4000-8000-000000000002",
      tenantId,
      userId,
      toolName: "create_product",
      idempotencyKey: key,
      status: "failed",
      errorCode: "NOT_FOUND",
      ...overrides,
    };
  }

  it("throws the existing execution unique constraint when a failed claim expires (known runner limit)", async () => {
    const tx = replayBench(
      existing({ status: "failed", errorCode: "NOT_FOUND", expiresAt: new Date(0) }),
    );
    const prior = failedExecution();
    tx.executionState.push(prior);
    successfulExecution(tx);
    // The execution INSERT is before the runner's try/catch. This records the
    // current defect; it does not claim successful retry of a failed execution
    // or fix the app. The request transaction's real rollback is outside this
    // fake, whose insert/update lists record attempted statements only.
    await expect(runRegisteredTool(request(tx))).rejects.toMatchObject({
      code: "23505",
      constraint: "tool_executions_idempotency_uidx",
    });
    expect(tx.executionState).toEqual([prior]);
    expect(tx.rowsFor(toolExecutions)).toEqual([
      expect.objectContaining({
        tenantId,
        userId,
        toolName: "create_product",
        idempotencyKey: key,
        status: "pending",
      }),
    ]);
    expect(tx.rowsFor(products)).toEqual([]);
    expect(tx.changesFor(toolExecutions)).toEqual([]);
    expect(tx.rowsFor(auditEvents)).toEqual([]);
    expect(tx.changesFor(idempotencyRecords)).toEqual([
      expect.objectContaining({
        status: "pending",
        requestHash: hash,
        response: null,
        errorCode: null,
      }),
    ]);
    expect(tx.insertRows.get(products)).toEqual([[{ id: productId, name: "Bolo validado" }]]);
  });

  // Identity controls: an unrelated existing failure must not make expiry
  // fail by cardinality. Every component of the unique tuple is independent;
  // an existing NULL idempotency key also remains distinct in ordinary UNIQUE.
  it.each([
    { field: "tenantId", value: "72000000-0000-4000-8000-000000000003" },
    { field: "userId", value: "71000000-0000-4000-8000-000000000003" },
    { field: "toolName", value: "add_expense" },
    { field: "idempotencyKey", value: "conversation:different-call" },
    { field: "idempotencyKey", value: null },
  ])(
    "allows an orphan claim with an unrelated execution differing in $field=$value",
    async ({ field, value }) => {
      const tx = replayBench(existing({ expiresAt: new Date(0) }));
      const prior = failedExecution({ [field]: value });
      tx.executionState.push(prior);
      successfulExecution(tx);
      expect(await runRegisteredTool(request(tx))).toEqual({
        ok: true,
        replayed: false,
        output: {
          result: { productId, name: "Bolo validado" },
          state: { currentProductId: productId },
        },
      });
      expect(tx.executionState).toEqual([
        prior,
        expect.objectContaining({
          id: executionId,
          tenantId,
          userId,
          toolName: "create_product",
          idempotencyKey: key,
        }),
      ]);
      expect(tx.rowsFor(products)).toEqual([
        { tenantId, userId, name: "Bolo validado", yieldQty: null, taxRate: null },
      ]);
      expect(tx.changesFor(idempotencyRecords)[1].status).toBe("succeeded");
      expect(tx.rowsFor(auditEvents)[0].eventType).toBe("ai.tool.succeeded");
    },
  );

  it("retries claim insertion when the first conflict has no readable row", async () => {
    const tx = new ValidationTransaction();
    admit(tx);
    successfulExecution(tx);
    tx.insertRows.set(idempotencyRecords, [[], [{ id: claimId }]]);
    expect((await runRegisteredTool(request(tx))).ok).toBe(true);
    expect(tx.rowsFor(idempotencyRecords)).toEqual([
      expect.objectContaining({ key, requestHash: hash, operation: "ai.tool.create_product" }),
      expect.objectContaining({ key, requestHash: hash, operation: "ai.tool.create_product" }),
    ]);
    expect(tx.reads.map((entry) => entry.table)).toEqual([idempotencyRecords]);
    expect(tx.rowsFor(products)).toHaveLength(1);
    expect(tx.changesFor(idempotencyRecords)[0].status).toBe("succeeded");
  });

  it.each([false, true])(
    "after retry, returns a controlled conflict (readable winner=%s)",
    async (hasWinner) => {
      const tx = new ValidationTransaction();
      admit(tx);
      tx.selectRows.set(idempotencyRecords, [
        [],
        hasWinner ? [existing({ errorCode: "NOT_FOUND", status: "failed" })] : [],
      ]);
      expect(await runRegisteredTool(request(tx))).toEqual({
        ok: false,
        code: hasWinner ? "NOT_FOUND" : "CONFLICT",
        replayed: hasWinner,
      });
      expectNoExecution(tx);
      expect(tx.rowsFor(idempotencyRecords)).toHaveLength(2);
      expect(tx.reads.map((entry) => entry.table)).toEqual([
        idempotencyRecords,
        idempotencyRecords,
      ]);
      expect(tx.updates).toEqual([]);
      expect(tx.rowsFor(auditEvents)).toEqual([]);
    },
  );
});

describe("§14.3: execution failures retain trace and never become empty success", () => {
  it("refuses a missing execution row before calling the real tool", async () => {
    const tx = new ValidationTransaction();
    admit(tx);
    tx.insertRows.set(idempotencyRecords, [[{ id: claimId }]]);
    expect(await runRegisteredTool(request(tx))).toEqual({
      ok: false,
      code: "DATABASE_ERROR",
      replayed: false,
    });
    expect(tx.rowsFor(toolExecutions)).toHaveLength(1);
    expect(tx.rowsFor(products)).toEqual([]);
    expect(tx.updates).toEqual([]);
    expect(tx.rowsFor(auditEvents)).toEqual([]);
  });

  it.each([
    { label: "missing domain row", rows: [] as Rows, code: "DATABASE_ERROR" },
    {
      label: "unmapped driver failure",
      rows: new Error("driver unavailable"),
      code: "DATABASE_ERROR",
    },
    { label: "mapped domain failure", rows: new Error("NOT_FOUND"), code: "NOT_FOUND" },
    {
      label: "invalid public UUID output (INV-014)",
      rows: [{ id: "invalid-uuid", name: "Bolo" }],
      code: "DEPENDENCY_ERROR",
    },
  ])("records $label as failure, not success", async ({ rows, code }) => {
    const tx = new ValidationTransaction();
    admit(tx);
    tx.insertRows.set(idempotencyRecords, [[{ id: claimId }]]);
    successfulExecution(tx);
    tx.insertRows.set(products, [rows]);
    expect(await runRegisteredTool(request(tx))).toEqual({ ok: false, code, replayed: false });
    expect(tx.rowsFor(products)).toHaveLength(1);
    expect(tx.changesFor(toolExecutions)).toEqual([
      expect.objectContaining({ status: "failed", errorCode: code }),
    ]);
    expect(tx.changesFor(idempotencyRecords)).toEqual([
      expect.objectContaining({ status: "failed", errorCode: code }),
    ]);
    expect(tx.rowsFor(auditEvents)).toEqual([
      expect.objectContaining({
        eventType: "ai.tool.failed",
        safeMetadata: expect.objectContaining({ code }),
      }),
    ]);
  });

  it("cancels before executing when the real AbortSignal is already aborted (§14.5)", async () => {
    const tx = new ValidationTransaction();
    admit(tx);
    tx.insertRows.set(idempotencyRecords, [[{ id: claimId }]]);
    successfulExecution(tx);
    const controller = new AbortController();
    controller.abort();
    expect(
      await runRegisteredTool({
        ...request(tx),
        context: { ...context(tx), signal: controller.signal },
      }),
    ).toEqual({ ok: false, code: "AI_TIMEOUT", replayed: false });
    expect(tx.rowsFor(products)).toEqual([]);
    expect(tx.changesFor(toolExecutions)).toEqual([
      expect.objectContaining({ status: "cancelled", errorCode: "AI_TIMEOUT" }),
    ]);
    expect(tx.changesFor(idempotencyRecords)).toEqual([
      expect.objectContaining({ status: "failed", errorCode: "AI_TIMEOUT" }),
    ]);
    expect(tx.rowsFor(auditEvents)).toEqual([
      expect.objectContaining({ eventType: "ai.tool.cancelled" }),
    ]);
  });
});
