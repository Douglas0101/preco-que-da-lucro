import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { DatabaseIdentity, DatabaseTransaction, TransactionManager } from "@/db/client.server";
import {
  createBudgetLedger,
  estimateModelCost,
  type BudgetLedgerConfig,
  type ReserveResult,
  type ReservedUsage,
  type SettleOptions,
} from "@/lib/ai/budget-ledger.server";

/**
 * INV-006 — settle with an *unknown* measurement must not assert a zero.
 *
 * These tests capture the SQL the ledger emits and read the bound parameters by
 * position, so they fail if `real_tokens` ever receives a number on the unknown
 * path, or if the daily counters are moved by a settlement that measured nothing.
 */

interface CapturedStatement {
  text: string;
  params: unknown[];
}

/** Value bound to `column = $N` in the rendered statement. */
function boundTo(statement: CapturedStatement, column: string): unknown {
  const match = new RegExp(`${column} = \\$(\\d+)`).exec(statement.text);
  if (!match) throw new Error(`coluna ${column} não encontrada em: ${statement.text}`);
  return statement.params[Number(match[1]) - 1];
}

/**
 * The settle update of the daily counters — distinguished from the *reserve* update,
 * which also targets `ai_daily_budgets` but only ever adds to the reservation.
 */
function settleDailyStatements(statements: CapturedStatement[]): CapturedStatement[] {
  return statements.filter(
    (s) =>
      s.text.includes("update ai_daily_budgets") && s.text.includes("in_flight = in_flight - 1"),
  );
}

function createCapturingLedger() {
  const dialect = new PgDialect();
  const statements: CapturedStatement[] = [];
  const identity: DatabaseIdentity = { userId: "user-1", tenantId: "tenant-1", roles: ["member"] };
  const transactionManager = {
    async run<T>(_id: DatabaseIdentity, operation: (t: DatabaseTransaction) => Promise<T>) {
      const transaction = {
        async execute(query: SQL) {
          const rendered = dialect.sqlToQuery(query);
          const captured: CapturedStatement = {
            text: rendered.sql.toLowerCase(),
            params: rendered.params,
          };
          statements.push(captured);
          if (captured.text.includes("status = 'expired'")) return { rows: [] };
          if (captured.text.includes("returning budget_tokens")) {
            return { rows: [{ budgetTokens: 100, reservedAt: "2026-09-01T10:00:00.000Z" }] };
          }
          if (captured.text.includes("insert into ai_usage")) {
            return { rows: [{ usageId: "usage-1", reservedAt: "2026-09-01T10:00:00.000Z" }] };
          }
          if (captured.text.includes("update ai_daily_budgets")) {
            return { rows: [{ tokensReserved: 0, inFlight: 0 }] };
          }
          return { rows: [] };
        },
      } as unknown as DatabaseTransaction;
      return operation(transaction);
    },
  } as unknown as TransactionManager;
  return { ledger: createBudgetLedger({ identity, transactionManager }), identity, statements };
}

async function reserve(
  ledger: ReturnType<typeof createCapturingLedger>["ledger"],
  tenantId: string,
) {
  const reservation = await ledger.reserveAtomic(tenantId, 1_000, {
    kind: "chat",
    roundNo: 1,
    now: new Date("2026-09-01T10:00:00Z"),
  });
  if (reservation.status !== "reserved") throw new Error("reserveAtomic recusou inesperadamente");
  return reservation as ReservedUsage & ReserveResult;
}

describe("settle — uso desconhecido (INV-006, variante B)", () => {
  it("grava real_tokens NULL e outcome 'usage_unknown' quando a medição é desconhecida", async () => {
    const { ledger, identity, statements } = createCapturingLedger();
    const reservation = await reserve(ledger, identity.tenantId);

    const result = await ledger.settle(
      reservation.usageId,
      { kind: "unknown", reason: "absent" },
      "success",
      { now: new Date("2026-09-01T10:00:30Z") },
    );

    expect(result.applied).toBe(true);
    const claim = statements.find((s) => s.text.includes("returning budget_tokens"));
    expect(claim).toBeDefined();
    expect(boundTo(claim!, "real_tokens")).toBeNull();
    expect(boundTo(claim!, "outcome")).toBe("usage_unknown");
  });

  it("NÃO libera a reserva e NÃO incrementa os contadores de token", async () => {
    const { ledger, identity, statements } = createCapturingLedger();
    const reservation = await reserve(ledger, identity.tenantId);

    await ledger.settle(reservation.usageId, { kind: "unknown", reason: "partial" }, "success", {
      now: new Date("2026-09-01T10:00:30Z"),
      toolCalls: 2,
    });

    const daily = settleDailyStatements(statements);
    expect(daily).toHaveLength(1);
    // A chamada terminou: não está mais em voo.
    expect(daily[0]!.text).toMatch(/in_flight = in_flight - 1/);
    // Mas a reserva permanece retida: liberá-la afirmaria consumo zero não medido.
    expect(daily[0]!.text).not.toMatch(/tokens_reserved = tokens_reserved -/);
    expect(daily[0]!.text).not.toMatch(/input_tokens = input_tokens \+/);
    expect(daily[0]!.text).not.toMatch(/output_tokens = output_tokens \+/);
    // Contagem de ferramentas é medida (não deriva de `usage`), então segue contada.
    expect(daily[0]!.text).toMatch(/tool_call_count = tool_call_count \+/);
  });

  it("distinguishes 'absent', 'partial' and 'invalid' without asserting counts", async () => {
    for (const reason of ["absent", "partial", "invalid"] as const) {
      const { ledger, identity, statements } = createCapturingLedger();
      const reservation = await reserve(ledger, identity.tenantId);
      await ledger.settle(reservation.usageId, { kind: "unknown", reason }, "success");
      const claim = statements.find((s) => s.text.includes("returning budget_tokens"));
      expect(boundTo(claim!, "real_tokens")).toBeNull();
      expect(boundTo(claim!, "outcome")).toBe("usage_unknown");
    }
  });

  it("REGRESSÃO: o caminho numérico legado continua idêntico (libera reserva e incrementa)", async () => {
    const { ledger, identity, statements } = createCapturingLedger();
    const reservation = await reserve(ledger, identity.tenantId);

    await ledger.settle(reservation.usageId, 300, "success", {
      now: new Date("2026-09-01T10:00:30Z"),
      inputTokens: 100,
      outputTokens: 200,
    });

    const claim = statements.find((s) => s.text.includes("returning budget_tokens"));
    expect(boundTo(claim!, "real_tokens")).toBe(300);
    expect(boundTo(claim!, "outcome")).toBe("success");
    const daily = settleDailyStatements(statements)[0];
    expect(daily!.text).toMatch(/tokens_reserved = tokens_reserved -/);
    expect(daily!.text).toMatch(/input_tokens = input_tokens \+/);
    expect(daily!.text).toMatch(/output_tokens = output_tokens \+/);
  });

  it("TokenUsage conhecido usa os valores medidos, não os de options", async () => {
    const { ledger, identity, statements } = createCapturingLedger();
    const reservation = await reserve(ledger, identity.tenantId);

    await ledger.settle(
      reservation.usageId,
      { kind: "known", inputTokens: 120, outputTokens: 35 },
      "success",
      { now: new Date("2026-09-01T10:00:30Z"), inputTokens: 999, outputTokens: 999 },
    );

    const claim = statements.find((s) => s.text.includes("returning budget_tokens"));
    expect(boundTo(claim!, "real_tokens")).toBe(155);
    const daily = settleDailyStatements(statements)[0];
    expect(daily!.params).toContain(120);
    expect(daily!.params).toContain(35);
    expect(daily!.params).not.toContain(999);
  });

  it("zero explícito conhecido liquida com zero (não confundir com desconhecido)", async () => {
    const { ledger, identity, statements } = createCapturingLedger();
    const reservation = await reserve(ledger, identity.tenantId);

    await ledger.settle(
      reservation.usageId,
      { kind: "known", inputTokens: 0, outputTokens: 0 },
      "success",
    );

    const claim = statements.find((s) => s.text.includes("returning budget_tokens"));
    expect(boundTo(claim!, "real_tokens")).toBe(0);
    expect(boundTo(claim!, "outcome")).toBe("success");
    const daily = settleDailyStatements(statements)[0];
    expect(daily!.text).toMatch(/tokens_reserved = tokens_reserved -/);
  });
});

/**
 * Lote 2 — pagamento das unidades não cobertas de `budget-ledger.server.ts`.
 *
 * O mock acima roteia por fragmento para fixar a INV-006. Os testes abaixo
 * precisam de respostas por *tipo* de statement (expirados do sweep, candidatos
 * do reconcile, CAS de release, UPDATEs de contador, INSERTs), então usam um
 * roteador que classifica o SQL renderizado e devolve `rows` por caso — o
 * default é sempre `{ rows: [] }`, nunca uma linha fabricada. Toda asserção
 * observa o SQL/params emitidos.
 */

type StatementKind =
  | "sweep-expire"
  | "reconcile-claim"
  | "release-claim"
  | "settle-claim"
  | "candidates"
  | "insert-usage"
  | "insert-budgets"
  | "chat-counters"
  | "reserve-counters"
  | "settle-counters"
  | "sweep-counters"
  | "release-counters"
  | "other";

function classify(statement: CapturedStatement): StatementKind {
  const { text, params } = statement;
  if (text.includes("update ai_usage")) {
    if (text.includes("status = 'expired'")) return "sweep-expire";
    // O CAS de release carrega AMBOS os outcomes nos params (`set` =
    // reservation_released, `where` = reconciliation_failed): tem de ser
    // reconhecido antes do claim de reconcile, senão o roteador o trata como
    // claim de reconcile e devolve linha vazia.
    if (params.includes("reservation_released")) return "release-claim";
    if (params.includes("reconciliation_failed")) return "reconcile-claim";
    if (text.includes("status = 'settled'")) return "settle-claim";
    return "other";
  }
  if (text.includes("from ai_usage")) return "candidates";
  if (text.includes("insert into ai_usage")) return "insert-usage";
  if (text.includes("insert into ai_daily_budgets")) return "insert-budgets";
  if (text.includes("update ai_daily_budgets")) {
    if (text.includes("chat_count = chat_count + 1")) return "chat-counters";
    if (text.includes("model_call_count = model_call_count + 1")) return "reserve-counters";
    if (text.includes("in_flight = in_flight - 1")) return "settle-counters";
    if (text.includes("in_flight = in_flight - ")) return "sweep-counters";
    if (text.includes("tokens_reserved = tokens_reserved - ")) return "release-counters";
  }
  return "other";
}

interface ScriptedResult {
  rows?: unknown[];
}

type Responder = (
  statement: CapturedStatement,
  kind: StatementKind,
  index: number,
) => ScriptedResult | undefined;

function makeTransaction(
  statements: CapturedStatement[],
  responder?: Responder,
): DatabaseTransaction {
  const dialect = new PgDialect();
  return {
    async execute(query: SQL) {
      const rendered = dialect.sqlToQuery(query);
      const captured: CapturedStatement = {
        text: rendered.sql.toLowerCase(),
        params: rendered.params,
      };
      statements.push(captured);
      const response = responder?.(captured, classify(captured), statements.length - 1);
      return response ?? { rows: [] };
    },
  } as unknown as DatabaseTransaction;
}

function createScriptedLedger(
  responder?: Responder,
  overrides: { config?: Partial<BudgetLedgerConfig>; clock?: { now(): Date } } = {},
) {
  const identity: DatabaseIdentity = { userId: "user-1", tenantId: "tenant-1", roles: ["member"] };
  const statements: CapturedStatement[] = [];
  const transactionManager = {
    async run<T>(_id: DatabaseIdentity, operation: (t: DatabaseTransaction) => Promise<T>) {
      return operation(makeTransaction(statements, responder));
    },
  } as unknown as TransactionManager;
  const ledger = createBudgetLedger({
    identity,
    transactionManager,
    ...(overrides.config ? { config: overrides.config } : {}),
    ...(overrides.clock ? { clock: overrides.clock } : {}),
  });
  return { ledger, identity, statements };
}

const NOW = new Date("2026-09-01T12:00:00Z");
const RESERVED_AT = "2026-09-01T10:00:00.000Z";

function claimRow(budgetTokens: unknown = 100, reservedAt: unknown = RESERVED_AT): ScriptedResult {
  return { rows: [{ budgetTokens, reservedAt }] };
}

describe("validações fail-closed do ledger", () => {
  it("recusa budgetTokens não positivo e roundNo negativo", async () => {
    const { ledger, identity } = createScriptedLedger();
    await expect(
      ledger.reserveAtomic(identity.tenantId, 0, { kind: "chat", roundNo: 1 }),
    ).rejects.toThrow("budgetTokens deve ser um inteiro positivo");
    await expect(
      ledger.reserveAtomic(identity.tenantId, 10, { kind: "chat", roundNo: -1 }),
    ).rejects.toThrow("roundNo deve ser um inteiro não negativo");
  });

  it("recusa usageId vazio, com caractere de controle ou longo demais", async () => {
    const { ledger } = createScriptedLedger();
    await expect(ledger.settle("", 10, "success")).rejects.toThrow("usageId inválido");
    await expect(ledger.settle("u\u0000", 10, "success")).rejects.toThrow("usageId inválido");
    await expect(ledger.settle("x".repeat(129), 10, "success")).rejects.toThrow("usageId inválido");
    await expect(ledger.settle("usage-1", 10, "success", { toolCalls: -1 })).rejects.toThrow(
      "toolCalls deve ser um inteiro não negativo",
    );
  });

  it("trata string-like (fronteira não tipada) pelo contrato normal", async () => {
    // `Array.from` sobre um objeto array-like pode produzir elemento vazio
    // (""); é o único caminho que alcança o fallback `?? 0` do `codePointAt`
    // e ele precisa reprovar como texto inválido, sem query.
    const { ledger, identity, statements } = createScriptedLedger();
    const stringLike = { length: 1, 0: "", toString: () => "" } as unknown as string;
    await expect(ledger.releaseUnknownReservation(identity.tenantId, stringLike)).rejects.toThrow(
      "usageId inválido",
    );
    expect(statements).toHaveLength(0);
  });

  it("recusa breakdown incoerente e data de agora inválida", async () => {
    const { ledger } = createScriptedLedger();
    await expect(
      ledger.settle("usage-1", 100, "success", { inputTokens: 10, outputTokens: 20 }),
    ).rejects.toThrow("inputTokens + outputTokens deve corresponder a realTokens");
    await expect(
      ledger.settle("usage-1", 10, "success", { now: new Date(Number.NaN) }),
    ).rejects.toThrow("now deve ser uma data válida");
  });

  it("rejeita tenant divergente em todas as superfícies com tenant", async () => {
    const { ledger } = createScriptedLedger();
    const divergent = "tenant-2";
    const mismatch = "O tenant da operação de orçamento não corresponde à identidade autenticada";
    await expect(
      ledger.reserveAtomic(divergent, 10, { kind: "chat", roundNo: 0, now: NOW }),
    ).rejects.toThrow(mismatch);
    await expect(ledger.sweepOrphans(divergent, { now: NOW })).rejects.toThrow(mismatch);
    await expect(ledger.reconcileUnknownUsage(divergent, { now: NOW })).rejects.toThrow(mismatch);
    await expect(
      ledger.releaseUnknownReservation(divergent, "usage-1", { now: NOW }),
    ).rejects.toThrow(mismatch);
  });

  it("createBudgetLedger recusa TTL inseguro e limite não positivo", () => {
    const identity: DatabaseIdentity = {
      userId: "user-1",
      tenantId: "tenant-1",
      roles: ["member"],
    };
    // Sem transactionManager: o fallback defaultTransactionManager é resolvido na
    // criação e nunca chega a executar query — a validação de config falha antes.
    expect(() => createBudgetLedger({ identity })).not.toThrow();
    expect(() => createBudgetLedger({ identity, config: { reservationTtlMs: 1_000 } })).toThrow(
      "reservationTtlMs deve ser um inteiro de pelo menos 120000 ms",
    );
    expect(() => createBudgetLedger({ identity, config: { dailyChatLimit: 0 } })).toThrow(
      "dailyChatLimit deve ser um inteiro positivo",
    );
  });

  it("estimateModelCost nunca fabrica zero: overflow e preço negativo são 'invalid'", () => {
    expect(
      estimateModelCost("m", 1_000_000, 0, { m: { inputPerMillion: 1e18, outputPerMillion: 0 } }),
    ).toEqual({ cost: null, status: "invalid" });
    expect(
      estimateModelCost("m", 10, 10, { m: { inputPerMillion: -1, outputPerMillion: 0 } }),
    ).toEqual({ cost: null, status: "invalid" });
    expect(
      estimateModelCost("m", 5, 5, { m: { inputPerMillion: 0, outputPerMillion: 0 } }),
    ).toEqual({ cost: "0.0000", status: "known" });
  });
});

describe("custo estimado — resolveBudgetCostSetters", () => {
  async function settleWithCost(options: SettleOptions) {
    const { ledger, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "settle-claim") return claimRow();
      if (kind === "settle-counters") return { rows: [{ tokensReserved: 0, inFlight: 0 }] };
    });
    await ledger.settle("usage-1", 10, "success", { now: NOW, ...options });
    const daily = statements.find((s) => classify(s) === "settle-counters");
    if (!daily) throw new Error("o UPDATE diário não foi emitido");
    return daily;
  }

  it("known parseável entra no total conhecido com 4 casas", async () => {
    const daily = await settleWithCost({ estimatedCost: "12.5", costStatus: "known" });
    expect(daily.text).toMatch(/estimated_cost = estimated_cost \+ \$/);
    expect(daily.params).toContain("12.5000");
    expect(daily.text).not.toMatch(/estimated_cost_unknown_count/);
  });

  it("known sem string parseável vira desconhecido (nunca zero)", async () => {
    for (const estimatedCost of ["não-é-número", "-1", "Infinity"]) {
      const daily = await settleWithCost({ estimatedCost, costStatus: "known" });
      expect(daily.text).not.toMatch(/estimated_cost = estimated_cost \+/);
      expect(daily.text).toMatch(
        /estimated_cost_unknown_count = estimated_cost_unknown_count \+ 1/,
      );
    }
  });

  it("known sem valor não soma nada e contabiliza o desconhecido", async () => {
    const daily = await settleWithCost({ costStatus: "known" });
    expect(daily.text).not.toMatch(/estimated_cost = estimated_cost \+/);
    expect(daily.text).toMatch(/estimated_cost_unknown_count/);
  });

  it("'invalid' e 'unknown' deixam o total conhecido intacto", async () => {
    for (const costStatus of ["invalid", "unknown"] as const) {
      const daily = await settleWithCost({ estimatedCost: "5", costStatus });
      expect(daily.text).not.toMatch(/estimated_cost = estimated_cost \+/);
      expect(daily.text).toMatch(/estimated_cost_unknown_count/);
    }
  });
});

describe("sweepOrphans — expiração e reconciliação de contadores", () => {
  it("agrupa expirados por dia e reconcilia cada contador com a soma", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "sweep-expire") {
        return {
          rows: [
            { usageId: "u1", budgetTokens: 100, reservedAt: "2026-08-30T23:00:00.000Z" },
            { usageId: "u2", budgetTokens: "250", reservedAt: "2026-08-31T10:00:00.000Z" },
            { usageId: "u3", budgetTokens: 50, reservedAt: "2026-08-31T12:00:00.000Z" },
          ],
        };
      }
      if (kind === "sweep-counters") return { rows: [{ tokensReserved: 0, inFlight: 0 }] };
    });
    const result = await ledger.sweepOrphans(identity.tenantId, { now: NOW });
    expect(result).toEqual({ expiredCount: 3, usageIds: ["u1", "u2", "u3"] });
    const counters = statements.filter((s) => classify(s) === "sweep-counters");
    expect(counters).toHaveLength(2);
    const day30 = counters.find((s) => boundTo(s, "usage_date") === "2026-08-30");
    const day31 = counters.find((s) => boundTo(s, "usage_date") === "2026-08-31");
    expect(day30?.params).toEqual(expect.arrayContaining([100, 1]));
    expect(day31?.params).toEqual(expect.arrayContaining([300, 2]));
  });

  it("sem expirados devolve zero sem tocar contadores", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) =>
      kind === "sweep-expire" ? {} : undefined,
    );
    const result = await ledger.sweepOrphans(identity.tenantId);
    expect(result).toEqual({ expiredCount: 0, usageIds: [] });
    expect(statements.filter((s) => classify(s) === "sweep-counters")).toHaveLength(0);
  });

  it("contador divergente reprova alto", async () => {
    const { ledger, identity } = createScriptedLedger((_s, kind) => {
      if (kind === "sweep-expire") {
        return {
          rows: [{ usageId: "u1", budgetTokens: 100, reservedAt: "2026-08-31T10:00:00.000Z" }],
        };
      }
      if (kind === "sweep-counters") return { rows: [] };
    });
    await expect(ledger.sweepOrphans(identity.tenantId, { now: NOW })).rejects.toThrow(
      "Não foi possível reconciliar o contador do orçamento expirado",
    );
  });
});

describe("reconcileUnknownUsage — TRILHO B (INV-009)", () => {
  it("marca candidatos por CAS e devolve a idade do mais antigo", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "candidates") {
        return {
          rows: [
            { usageId: "u1", budgetTokens: 100, settledAt: "2026-09-01T00:00:00.000Z" },
            { usageId: "u2", budgetTokens: "200", settledAt: "2026-08-30T00:00:00.000Z" },
            { usageId: "u3", budgetTokens: 300, settledAt: "2026-08-31T00:00:00.000Z" },
            { usageId: "u4", budgetTokens: 1, settledAt: "data-inválida" },
          ],
        };
      }
      if (kind === "reconcile-claim") return { rows: [{ usageId: "claimed" }] };
    });
    const result = await ledger.reconcileUnknownUsage(identity.tenantId, {
      now: NOW,
      minAgeMs: 60_000,
      batchSize: 4,
    });
    expect(result).toEqual({
      scannedCount: 4,
      failedCount: 4,
      usageIds: ["u1", "u2", "u3", "u4"],
      oldestAgeMs: 216_000_000,
    });
    const claims = statements.filter((s) => classify(s) === "reconcile-claim");
    expect(claims).toHaveLength(4);
    for (const claim of claims) {
      expect(claim.params).toContain("reconciliation_failed");
    }
    expect(claims.map((claim) => claim.params[1])).toEqual(["u1", "u2", "u3", "u4"]);
  });

  it("replay: CAS vazio é no-op e não duplica efeito", async () => {
    let claims = 0;
    const { ledger, identity } = createScriptedLedger((_s, kind) => {
      if (kind === "candidates") {
        return {
          rows: [
            { usageId: "u1", budgetTokens: 100, settledAt: "2026-08-30T00:00:00.000Z" },
            { usageId: "u2", budgetTokens: 100, settledAt: "2026-08-30T00:00:00.000Z" },
          ],
        };
      }
      if (kind === "reconcile-claim") {
        claims += 1;
        return claims === 1 ? { rows: [] } : { rows: [{ usageId: "u2" }] };
      }
    });
    const result = await ledger.reconcileUnknownUsage(identity.tenantId, {
      now: NOW,
      minAgeMs: 0,
      batchSize: 2,
    });
    expect(result).toEqual({
      scannedCount: 2,
      failedCount: 1,
      usageIds: ["u2"],
      oldestAgeMs: 216_000_000,
    });
  });

  it("sem candidatos devolve vazio e usa os defaults documentados", async () => {
    const { ledger, identity, statements } = createScriptedLedger();
    const defaults = await ledger.reconcileUnknownUsage(identity.tenantId);
    expect(defaults).toEqual({ scannedCount: 0, failedCount: 0, usageIds: [], oldestAgeMs: null });
    await ledger.reconcileUnknownUsage(identity.tenantId, {
      now: NOW,
      minAgeMs: 1_000,
      batchSize: 5,
    });
    const selects = statements.filter((s) => classify(s) === "candidates");
    expect(selects).toHaveLength(2);
    expect(selects[0]!.params[2]).toBe(100);
    expect(selects[1]!.params[2]).toBe(5);
    expect((selects[1]!.params[1] as Date).getTime()).toBe(NOW.getTime() - 1_000);
  });

  it("recusa minAgeMs negativo, batchSize zero e lote acima do teto", async () => {
    const { ledger, identity } = createScriptedLedger();
    await expect(ledger.reconcileUnknownUsage(identity.tenantId, { minAgeMs: -1 })).rejects.toThrow(
      "minAgeMs deve ser um inteiro não negativo",
    );
    await expect(ledger.reconcileUnknownUsage(identity.tenantId, { batchSize: 0 })).rejects.toThrow(
      "batchSize deve ser um inteiro positivo",
    );
    await expect(
      ledger.reconcileUnknownUsage(identity.tenantId, { batchSize: 1001 }),
    ).rejects.toThrow("1000 é o teto de batchSize");
  });
});

describe("releaseUnknownReservation — comando humano", () => {
  it("devolve só tokens_reserved e mantém a medição intacta", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "release-claim") return claimRow("500", "2026-08-31T10:00:00.000Z");
      if (kind === "release-counters") return { rows: [{ tokensReserved: 0 }] };
    });
    const result = await ledger.releaseUnknownReservation(identity.tenantId, "usage-1", {
      now: NOW,
    });
    expect(result).toEqual({ applied: true, usageId: "usage-1", releasedTokens: 500 });
    const counters = statements.filter((s) => classify(s) === "release-counters");
    expect(counters).toHaveLength(1);
    expect(counters[0]!.text).toMatch(/tokens_reserved = tokens_reserved - \$/);
    expect(counters[0]!.text).not.toMatch(/in_flight/);
    expect(counters[0]!.text).not.toMatch(/real_tokens/);
    expect(counters[0]!.params).toContain(500);
    expect(boundTo(counters[0]!, "usage_date")).toBe("2026-08-31");
  });

  it("replay sem linha devolve applied:false sem tocar contador", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) =>
      kind === "release-claim" ? { rows: [] } : undefined,
    );
    const result = await ledger.releaseUnknownReservation(identity.tenantId, "usage-1");
    expect(result).toEqual({ applied: false, usageId: "usage-1", releasedTokens: null });
    expect(statements).toHaveLength(1);
  });

  it("contador diário ausente reprova alto", async () => {
    const { ledger, identity } = createScriptedLedger((_s, kind) => {
      if (kind === "release-claim") return claimRow(500, "2026-08-31T10:00:00.000Z");
      if (kind === "release-counters") return { rows: [] };
    });
    await expect(
      ledger.releaseUnknownReservation(identity.tenantId, "usage-1", { now: NOW }),
    ).rejects.toThrow("A liberação não encontrou o contador diário correspondente");
  });

  it("valida usageId antes de qualquer query", async () => {
    const { ledger, identity, statements } = createScriptedLedger();
    await expect(ledger.releaseUnknownReservation(identity.tenantId, "")).rejects.toThrow(
      "usageId inválido",
    );
    expect(statements).toHaveLength(0);
  });
});

describe("reserveChatInTransaction", () => {
  it("aceita quando o UPDATE guardado afeta uma linha", async () => {
    const statements: CapturedStatement[] = [];
    const tx = makeTransaction(statements, (_s, kind) =>
      kind === "chat-counters" ? { rows: [{ chatCount: 1 }] } : undefined,
    );
    const clockNow = new Date("2026-09-01T10:00:00Z");
    const { ledger, identity } = createScriptedLedger(undefined, {
      clock: { now: () => clockNow },
    });
    const accepted = await ledger.reserveChatInTransaction(tx, identity.tenantId);
    expect(accepted).toBe(true);
    const counters = statements.find((s) => classify(s) === "chat-counters");
    if (!counters) throw new Error("o UPDATE de chat não foi emitido");
    expect(counters.text).toMatch(/chat_count = chat_count \+ 1/);
    expect(boundTo(counters, "usage_date")).toBe("2026-09-01");
    expect(statements.some((s) => classify(s) === "insert-budgets")).toBe(true);
  });

  it("recusa quando o limite de chat já foi atingido", async () => {
    const statements: CapturedStatement[] = [];
    const tx = makeTransaction(statements, (_s, kind) =>
      kind === "chat-counters" ? { rows: [] } : undefined,
    );
    const { ledger, identity } = createScriptedLedger();
    const accepted = await ledger.reserveChatInTransaction(tx, identity.tenantId, { now: NOW });
    expect(accepted).toBe(false);
  });
});

describe("reserveAtomic — quota e trilha de uso", () => {
  it("devolve quota_reject quando o UPDATE guardado não afeta linha", async () => {
    const { ledger, identity, statements } = createScriptedLedger((_s, kind) =>
      kind === "reserve-counters" ? { rows: [] } : undefined,
    );
    const result = await ledger.reserveAtomic(identity.tenantId, 1_000, {
      kind: "chat",
      roundNo: 1,
      now: NOW,
    });
    expect(result).toEqual({ status: "quota_reject", reason: "budget_limit" });
    const counters = statements.find((s) => classify(s) === "reserve-counters");
    if (!counters) throw new Error("o UPDATE guardado não foi emitido");
    expect(counters.text).toMatch(/model_call_count \+ 1 <= \$/);
    expect(counters.text).toMatch(/input_tokens \+ output_tokens \+ tokens_reserved \+ \$/);
    expect(counters.text).toMatch(/in_flight \+ 1 <= \$/);
    expect(statements.some((s) => classify(s) === "insert-usage")).toBe(false);
  });

  it("usa o relógio injetado quando now é omitido", async () => {
    const clockNow = new Date("2026-09-01T10:00:00Z");
    const { ledger, identity, statements } = createScriptedLedger(
      (_s, kind) => {
        if (kind === "reserve-counters") {
          return { rows: [{ modelCallCount: 1, tokensReserved: 1_000, inFlight: 1 }] };
        }
        if (kind === "insert-usage")
          return { rows: [{ usageId: "usage-1", reservedAt: clockNow }] };
      },
      { clock: { now: () => clockNow } },
    );
    const result = await ledger.reserveAtomic(identity.tenantId, 1_000, {
      kind: "chat",
      roundNo: 1,
    });
    expect(result.status).toBe("reserved");
    expect(statements.filter((s) => classify(s) === "insert-budgets")).toHaveLength(1);
  });

  it("reprova alto quando a reserva foi debitada sem trilha de uso", async () => {
    const { ledger, identity } = createScriptedLedger((_s, kind) =>
      kind === "reserve-counters" ? { rows: [{ modelCallCount: 1 }] } : undefined,
    );
    await expect(
      ledger.reserveAtomic(identity.tenantId, 1_000, { kind: "chat", roundNo: 1, now: NOW }),
    ).rejects.toThrow("A reserva foi debitada sem trilha de uso");
  });
});

describe("settle — replay, retry e contador ausente", () => {
  it("CAS sem linha devolve applied:false sem tocar contadores", async () => {
    const { ledger, statements } = createScriptedLedger((_s, kind) =>
      kind === "settle-claim" ? { rows: [] } : undefined,
    );
    const result = await ledger.settle("usage-1", 300, "success", { now: NOW });
    expect(result).toEqual({
      applied: false,
      usageId: "usage-1",
      budgetTokens: null,
      durationMs: null,
    });
    expect(statements.filter((s) => classify(s) === "settle-counters")).toHaveLength(0);
  });

  it("retry após falha do contador liquida na segunda tentativa", async () => {
    let counterCalls = 0;
    const { ledger, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "settle-claim") return claimRow();
      if (kind === "settle-counters") {
        counterCalls += 1;
        return counterCalls === 1 ? { rows: [] } : { rows: [{ tokensReserved: 0, inFlight: 0 }] };
      }
    });
    const result = await ledger.settle("usage-1", 300, "success", { now: NOW });
    expect(result.applied).toBe(true);
    expect(statements.filter((s) => classify(s) === "settle-claim")).toHaveLength(2);
    expect(statements.filter((s) => classify(s) === "settle-counters")).toHaveLength(2);
  });

  it("quando o contador nunca aparece, o retry também reprova", async () => {
    const { ledger } = createScriptedLedger((_s, kind) => {
      if (kind === "settle-claim") return claimRow();
      if (kind === "settle-counters") return { rows: [] };
    });
    await expect(ledger.settle("usage-1", 300, "success", { now: NOW })).rejects.toThrow(
      "A liquidação não encontrou o contador diário correspondente",
    );
  });

  it("caminho numérico sem breakdown explícito usa o fallback (input 0, output real)", async () => {
    const { ledger, statements } = createScriptedLedger((_s, kind) => {
      if (kind === "settle-claim") return claimRow();
      if (kind === "settle-counters") return { rows: [{ tokensReserved: 0, inFlight: 0 }] };
    });
    const result = await ledger.settle("usage-1", 300, "success", { now: NOW });
    expect(result.applied).toBe(true);
    const daily = statements.find((s) => classify(s) === "settle-counters");
    expect(daily?.params).toEqual(expect.arrayContaining([300]));
  });
});
