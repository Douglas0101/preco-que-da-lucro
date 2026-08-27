import { sql } from "drizzle-orm";
import {
  transactionManager as defaultTransactionManager,
  type DatabaseIdentity,
  type DatabaseTransaction,
  type TransactionManager,
} from "@/db/client.server";
import { logJson } from "@/lib/structured-logger";

export const DEFAULT_BUDGET_CONFIG = {
  dailyModelCallLimit: 500,
  dailyTokenLimit: 1_500_000,
  dailyChatLimit: 200,
  inFlightLimit: 2,
  conservativeTokenBudget: 64_000,
  reservationTtlMs: 120_000,
} as const;

export interface BudgetLedgerConfig {
  dailyModelCallLimit: number;
  dailyTokenLimit: number;
  dailyChatLimit: number;
  inFlightLimit: number;
  conservativeTokenBudget: number;
  reservationTtlMs: number;
}

export interface BudgetClock {
  now(): Date;
}

export interface ReserveOptions {
  kind: string;
  roundNo: number;
  now?: Date;
}

export interface SettleOptions {
  now?: Date;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: number;
}

export interface SweepOptions {
  now?: Date;
}

export interface ReservedUsage {
  status: "reserved";
  usageId: string;
  budgetTokens: number;
  reservedAt: Date;
}

export interface QuotaReject {
  status: "quota_reject";
  reason: "budget_limit";
}

export type ReserveResult = ReservedUsage | QuotaReject;

export interface SettlementResult {
  applied: boolean;
  usageId: string;
  budgetTokens: number | null;
  durationMs: number | null;
}

export interface SweepResult {
  expiredCount: number;
  usageIds: readonly string[];
}

export interface BudgetLedger {
  reserveChatInTransaction(
    transaction: DatabaseTransaction,
    tenantId: string,
    options?: { now?: Date },
  ): Promise<boolean>;
  reserveAtomic(
    tenantId: string,
    budgetTokens: number,
    options: ReserveOptions,
  ): Promise<ReserveResult>;
  settle(
    usageId: string,
    realTokens: number,
    outcome: string,
    options?: SettleOptions,
  ): Promise<SettlementResult>;
  sweepOrphans(tenantId: string, options?: SweepOptions): Promise<SweepResult>;
}

export interface BudgetLedgerDependencies {
  identity: DatabaseIdentity;
  transactionManager?: TransactionManager;
  config?: Partial<BudgetLedgerConfig>;
  clock?: BudgetClock;
}

interface ExpiredRow {
  usageId: string;
  budgetTokens: number;
  reservedAt: Date | string;
}

interface ClaimedRow {
  budgetTokens: number;
  reservedAt: Date | string;
}

interface ReservationRow {
  usageId: string;
  reservedAt: Date | string;
}

interface SweepInTransactionResult extends SweepResult {
  expired: readonly ExpiredRow[];
}

function rows<T>(result: unknown): T[] {
  const value = result as { rows?: unknown[] };
  return (value.rows ?? []) as T[];
}

function integerSetting(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function budgetConfigFromEnv(): BudgetLedgerConfig {
  return {
    dailyModelCallLimit: integerSetting(
      "AI_DAILY_MODEL_CALL_LIMIT_PER_TENANT",
      DEFAULT_BUDGET_CONFIG.dailyModelCallLimit,
      1,
      100_000,
    ),
    dailyTokenLimit: integerSetting(
      "AI_DAILY_TOKEN_LIMIT_PER_TENANT",
      DEFAULT_BUDGET_CONFIG.dailyTokenLimit,
      1,
      100_000_000,
    ),
    dailyChatLimit: integerSetting(
      "AI_DAILY_CHAT_LIMIT_PER_TENANT",
      DEFAULT_BUDGET_CONFIG.dailyChatLimit,
      1,
      100_000,
    ),
    inFlightLimit: integerSetting(
      "AI_IN_FLIGHT_LIMIT_PER_TENANT",
      DEFAULT_BUDGET_CONFIG.inFlightLimit,
      1,
      1_000,
    ),
    conservativeTokenBudget: integerSetting(
      "AI_CONSERVATIVE_TOKEN_BUDGET",
      DEFAULT_BUDGET_CONFIG.conservativeTokenBudget,
      1,
      1_000_000,
    ),
    reservationTtlMs: integerSetting(
      "AI_BUDGET_RESERVATION_TTL_MS",
      DEFAULT_BUDGET_CONFIG.reservationTtlMs,
      1_000,
      3_600_000,
    ),
  };
}

function resolveConfig(overrides: Partial<BudgetLedgerConfig> | undefined): BudgetLedgerConfig {
  return { ...budgetConfigFromEnv(), ...overrides };
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} deve ser um inteiro não negativo`);
  }
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} deve ser um inteiro positivo`);
  }
}

function assertDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) throw new TypeError(`${name} deve ser uma data válida`);
}

function assertText(name: string, value: string): void {
  const containsControlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
  if (!value || value.length > 128 || containsControlCharacter) {
    throw new TypeError(`${name} inválido`);
  }
}

function utcDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  assertDate(date, "reservedAt");
  return date.toISOString().slice(0, 10);
}

function asInteger(value: unknown, name: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  assertNonNegativeInteger(name, parsed);
  return parsed;
}

function durationMs(now: Date, startedAt: Date | string): number {
  const elapsed = now.getTime() - new Date(startedAt).getTime();
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}

function assertIdentityTenant(identity: DatabaseIdentity, tenantId: string): void {
  if (identity.tenantId !== tenantId) {
    throw new Error("O tenant da operação de orçamento não corresponde à identidade autenticada");
  }
}

function tokenBreakdown(
  realTokens: number,
  options: SettleOptions,
): { inputTokens: number; outputTokens: number } {
  assertNonNegativeInteger("realTokens", realTokens);
  const inputTokens = options.inputTokens ?? 0;
  const outputTokens = options.outputTokens ?? Math.max(0, realTokens - inputTokens);
  assertNonNegativeInteger("inputTokens", inputTokens);
  assertNonNegativeInteger("outputTokens", outputTokens);
  if (inputTokens + outputTokens !== realTokens) {
    throw new RangeError("inputTokens + outputTokens deve corresponder a realTokens");
  }
  return { inputTokens, outputTokens };
}

async function sweepOrphansInTransaction(
  transaction: DatabaseTransaction,
  tenantId: string,
  now: Date,
  config: BudgetLedgerConfig,
): Promise<SweepInTransactionResult> {
  const cutoff = new Date(now.getTime() - config.reservationTtlMs);
  const expiredResult = await transaction.execute(sql`
    update ai_usage
    set
      status = 'expired',
      settled_at = ${now},
      real_tokens = 0,
      outcome = 'ttl_expired'
    where tenant_id = ${tenantId}
      and status = 'reserved'
      and reserved_at < ${cutoff}
    returning usage_id::text as "usageId", budget_tokens as "budgetTokens", reserved_at as "reservedAt"
  `);
  const expired = rows<ExpiredRow>(expiredResult).map((row) => ({
    usageId: String(row.usageId),
    budgetTokens: asInteger(row.budgetTokens, "budgetTokens"),
    reservedAt: row.reservedAt as Date | string,
  }));
  if (expired.length === 0) return { expiredCount: 0, usageIds: [], expired };

  const grouped = new Map<string, { budgetTokens: number; count: number }>();
  for (const row of expired) {
    const date = utcDate(row.reservedAt);
    const current = grouped.get(date) ?? { budgetTokens: 0, count: 0 };
    current.budgetTokens += row.budgetTokens;
    current.count += 1;
    grouped.set(date, current);
  }

  for (const [usageDate, group] of grouped) {
    const countersResult = await transaction.execute(sql`
      update ai_daily_budgets
      set
        tokens_reserved = tokens_reserved - ${group.budgetTokens},
        in_flight = in_flight - ${group.count},
        updated_at = ${now}
      where tenant_id = ${tenantId}
        and usage_date = ${usageDate}
      returning tokens_reserved as "tokensReserved", in_flight as "inFlight"
    `);
    if (rows(countersResult).length !== 1) {
      throw new Error("Não foi possível reconciliar o contador do orçamento expirado");
    }
  }

  return {
    expiredCount: expired.length,
    usageIds: expired.map((row) => row.usageId),
    expired,
  };
}

function logExpired(tenantId: string, now: Date, result: SweepInTransactionResult): void {
  for (const row of result.expired) {
    logJson("info", "ai.budget_expired", {
      tenantId,
      usageId: row.usageId,
      budget: row.budgetTokens,
      real: 0,
      durationMs: durationMs(now, row.reservedAt),
      outcome: "ttl_expired",
    });
  }
}

export function createBudgetLedger(dependencies: BudgetLedgerDependencies): BudgetLedger {
  const transactionRunner = dependencies.transactionManager ?? defaultTransactionManager;
  const config = resolveConfig(dependencies.config);
  const clock = dependencies.clock ?? { now: () => new Date() };

  assertPositiveInteger("dailyModelCallLimit", config.dailyModelCallLimit);
  assertPositiveInteger("dailyTokenLimit", config.dailyTokenLimit);
  assertPositiveInteger("dailyChatLimit", config.dailyChatLimit);
  assertPositiveInteger("inFlightLimit", config.inFlightLimit);
  assertPositiveInteger("conservativeTokenBudget", config.conservativeTokenBudget);
  assertPositiveInteger("reservationTtlMs", config.reservationTtlMs);

  return {
    async reserveChatInTransaction(transaction, tenantId, options = {}): Promise<boolean> {
      assertIdentityTenant(dependencies.identity, tenantId);
      const now = options.now ?? clock.now();
      assertDate(now, "now");
      const usageDate = utcDate(now);
      await transaction.execute(sql`
        insert into ai_daily_budgets (tenant_id, usage_date)
        values (${tenantId}, ${usageDate})
        on conflict (tenant_id, usage_date) do nothing
      `);
      const result = await transaction.execute(sql`
        update ai_daily_budgets
        set
          chat_count = chat_count + 1,
          updated_at = ${now}
        where tenant_id = ${tenantId}
          and usage_date = ${usageDate}
          and chat_count + 1 <= ${config.dailyChatLimit}
        returning chat_count as "chatCount"
      `);
      const accepted = rows(result).length === 1;
      if (!accepted) {
        logJson("warn", "ai.chat_budget_rejected", {
          tenantId,
          outcome: "chat_limit",
        });
      }
      return accepted;
    },

    async reserveAtomic(tenantId, budgetTokens, options): Promise<ReserveResult> {
      assertIdentityTenant(dependencies.identity, tenantId);
      assertPositiveInteger("budgetTokens", budgetTokens);
      assertText("kind", options.kind);
      assertNonNegativeInteger("roundNo", options.roundNo);
      const now = options.now ?? clock.now();
      assertDate(now, "now");
      const usageDate = utcDate(now);

      const transactionResult = await transactionRunner.run(
        dependencies.identity,
        async (
          transaction,
        ): Promise<{
          sweep: SweepInTransactionResult;
          reservation: ReservedUsage | null;
        }> => {
          const sweep = await sweepOrphansInTransaction(transaction, tenantId, now, config);
          await transaction.execute(sql`
            insert into ai_daily_budgets (tenant_id, usage_date)
            values (${tenantId}, ${usageDate})
            on conflict (tenant_id, usage_date) do nothing
          `);

          const countersResult = await transaction.execute(sql`
            update ai_daily_budgets
            set
              model_call_count = model_call_count + 1,
              tokens_reserved = tokens_reserved + ${budgetTokens},
              in_flight = in_flight + 1,
              updated_at = ${now}
            where tenant_id = ${tenantId}
              and usage_date = ${usageDate}
              and model_call_count + 1 <= ${config.dailyModelCallLimit}
              and input_tokens + output_tokens + tokens_reserved + ${budgetTokens} <= ${config.dailyTokenLimit}
              and in_flight + 1 <= ${config.inFlightLimit}
            returning model_call_count as "modelCallCount", tokens_reserved as "tokensReserved", in_flight as "inFlight"
          `);
          if (rows(countersResult).length !== 1) {
            return { sweep, reservation: null };
          }

          const usageResult = await transaction.execute(sql`
            insert into ai_usage (tenant_id, kind, round_no, budget_tokens, status, reserved_at)
            values (${tenantId}, ${options.kind}, ${options.roundNo}, ${budgetTokens}, 'reserved', ${now})
            returning usage_id::text as "usageId", reserved_at as "reservedAt"
          `);
          const [usage] = rows<ReservationRow>(usageResult);
          if (!usage) throw new Error("A reserva foi debitada sem trilha de uso");
          return {
            sweep,
            reservation: {
              status: "reserved",
              usageId: String(usage.usageId),
              budgetTokens,
              reservedAt: new Date(usage.reservedAt),
            },
          };
        },
      );
      logExpired(tenantId, now, transactionResult.sweep);

      if (!transactionResult.reservation) {
        logJson("warn", "ai.budget_rejected", {
          tenantId,
          budget: budgetTokens,
          kind: options.kind,
          roundNo: options.roundNo,
          outcome: "budget_limit",
        });
        return { status: "quota_reject", reason: "budget_limit" };
      }

      logJson("info", "ai.budget_reserved", {
        tenantId,
        usageId: transactionResult.reservation.usageId,
        budget: budgetTokens,
        real: 0,
        durationMs: 0,
        outcome: "reserved",
        kind: options.kind,
        roundNo: options.roundNo,
      });
      return transactionResult.reservation;
    },

    async settle(usageId, realTokens, outcome, options = {}): Promise<SettlementResult> {
      assertText("usageId", usageId);
      assertText("outcome", outcome);
      const now = options.now ?? clock.now();
      assertDate(now, "now");
      const breakdown = tokenBreakdown(realTokens, options);
      const toolCalls = options.toolCalls ?? 0;
      assertNonNegativeInteger("toolCalls", toolCalls);

      const applySettlement = () =>
        transactionRunner.run(
          dependencies.identity,
          async (transaction): Promise<SettlementResult> => {
            const claimedResult = await transaction.execute(sql`
              update ai_usage
              set
                status = 'settled',
                settled_at = ${now},
                real_tokens = ${realTokens},
                outcome = ${outcome}
              where usage_id = ${usageId}
                and tenant_id = ${dependencies.identity.tenantId}
                and status = 'reserved'
              returning budget_tokens as "budgetTokens", reserved_at as "reservedAt"
            `);
            const [claimed] = rows<ClaimedRow>(claimedResult);
            if (!claimed) return { applied: false, usageId, budgetTokens: null, durationMs: null };

            const budgetTokens = asInteger(claimed.budgetTokens, "budgetTokens");
            const usageDate = utcDate(claimed.reservedAt);
            const countersResult = await transaction.execute(sql`
              update ai_daily_budgets
              set
                tokens_reserved = tokens_reserved - ${budgetTokens},
                in_flight = in_flight - 1,
                input_tokens = input_tokens + ${breakdown.inputTokens},
                output_tokens = output_tokens + ${breakdown.outputTokens},
                tool_call_count = tool_call_count + ${toolCalls},
                updated_at = ${now}
              where tenant_id = ${dependencies.identity.tenantId}
                and usage_date = ${usageDate}
              returning tokens_reserved as "tokensReserved", in_flight as "inFlight"
            `);
            if (rows(countersResult).length !== 1) {
              throw new Error("A liquidação não encontrou o contador diário correspondente");
            }
            return {
              applied: true,
              usageId,
              budgetTokens,
              durationMs: durationMs(now, claimed.reservedAt),
            };
          },
        );

      let result: SettlementResult;
      try {
        result = await applySettlement();
      } catch (error) {
        // A client-side failure may happen after PostgreSQL committed. Replaying
        // the guarded transition is safe: it either applies a rolled-back
        // settlement or returns the already-settled no-op.
        logJson("warn", "ai.budget_settlement_retry", {
          tenantId: dependencies.identity.tenantId,
          usageId,
          outcome,
          error,
        });
        result = await applySettlement();
      }

      logJson("info", "ai.budget_settled", {
        tenantId: dependencies.identity.tenantId,
        usageId,
        budget: result.budgetTokens,
        real: realTokens,
        durationMs: result.durationMs,
        outcome,
        applied: result.applied,
      });
      return result;
    },

    async sweepOrphans(tenantId, options = {}): Promise<SweepResult> {
      assertIdentityTenant(dependencies.identity, tenantId);
      const now = options.now ?? clock.now();
      assertDate(now, "now");
      const result = await transactionRunner.run(dependencies.identity, (transaction) =>
        sweepOrphansInTransaction(transaction, tenantId, now, config),
      );
      logExpired(tenantId, now, result);
      return { expiredCount: result.expiredCount, usageIds: result.usageIds };
    },
  };
}
