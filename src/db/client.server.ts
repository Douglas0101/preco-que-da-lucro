import { Pool as NeonPool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool as NodePostgresPool } from "pg";
import * as schema from "@/db/schema";
import { ApplicationError } from "@/lib/api-error";
import { logJson } from "@/lib/structured-logger";
import { applicationMetrics, withSpan } from "@/instrumentation/telemetry";

function createNeonDatabase(connectionString: string) {
  const pool = new NeonPool({ connectionString });
  instrumentPoolRoundTrips(pool);
  return drizzleNeon({ client: pool, schema });
}

export type Database = ReturnType<typeof createNeonDatabase>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseIdentity {
  userId: string;
  tenantId: string;
  roles: readonly string[];
}

export interface ResolvedTenantMembership {
  tenantId: string;
  role: string;
}

/** Raised inside the context transaction when membership verification fails.
 * The transaction rolls back; the middleware maps it to a 403 response. */
export class TenantMembershipDeniedError extends ApplicationError {
  constructor() {
    super("AUTHORIZATION_ERROR");
    this.name = "TenantMembershipDeniedError";
  }
}

export interface TransactionManager {
  run<T>(
    identity: DatabaseIdentity,
    operation: (transaction: DatabaseTransaction) => Promise<T>,
  ): Promise<T>;
}

let database: Database | undefined;

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada");
  }

  const driver = process.env.DATABASE_DRIVER ?? "neon-serverless";
  if (driver === "node-postgres") {
    // CI and local integration tests use a regular ephemeral PostgreSQL server.
    // Production remains on Neon pooled through @neondatabase/serverless.
    const pool = new NodePostgresPool({ connectionString });
    instrumentPoolRoundTrips(pool);
    return drizzleNodePostgres({ client: pool, schema }) as unknown as Database;
  }
  if (driver !== "neon-serverless") {
    throw new Error("DATABASE_DRIVER deve ser neon-serverless ou node-postgres");
  }
  return createNeonDatabase(connectionString);
}

export function getDatabase(): Database {
  database ??= createDatabase();
  return database;
}

export function setDatabaseForTests(value: Database | undefined): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("A injeção de banco é proibida em produção");
  }
  database = value;
}

/**
 * Every tenant operation runs in one short transaction. The GUC values feed
 * PostgreSQL RLS while repositories must still include tenant_id explicitly.
 */
export async function withTenantTransaction<T>(
  identity: DatabaseIdentity,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await withSpan(
      "db.tenant_transaction",
      { "db.system": "postgresql", "app.tenant_id": identity.tenantId },
      () =>
        getDatabase().transaction(async (transaction) => {
          await transaction.execute(sql`
            select
              set_config('app.current_user_id', ${identity.userId}, true),
              set_config('app.current_tenant_id', ${identity.tenantId}, true),
              set_config('app.current_roles', ${identity.roles.join(",")}, true)
          `);

          return operation(transaction);
        }),
    );
  } finally {
    applicationMetrics.dbDuration.record(performance.now() - startedAt);
  }
}

/**
 * Single short transaction that resolves membership BEFORE any tenant GUC is
 * applied (INV-002/010) and only then runs the operation with tenant GUCs set
 * for RLS. Consolidates the previous two-transaction flow (membership tx +
 * tenant tx) to remove the fixed per-request round-trip tax.
 */
export async function withResolvedTenantTransaction<T>(
  userId: string,
  resolveMembership: (
    transaction: DatabaseTransaction,
  ) => Promise<ResolvedTenantMembership | undefined>,
  operation: (transaction: DatabaseTransaction, membership: ResolvedTenantMembership) => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await withSpan("db.tenant_transaction", { "db.system": "postgresql" }, (span) =>
      getDatabase().transaction(async (transaction) => {
        await transaction.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
        const membership = await resolveMembership(transaction);
        if (!membership) throw new TenantMembershipDeniedError();
        span.setAttribute("app.tenant_id", membership.tenantId);
        await transaction.execute(sql`
          select
            set_config('app.current_tenant_id', ${membership.tenantId}, true),
            set_config('app.current_roles', ${membership.role}, true)
        `);
        return operation(transaction, membership);
      }),
    );
  } finally {
    applicationMetrics.dbDuration.record(performance.now() - startedAt);
  }
}

/** Public application boundary for short tenant transactions. Keeping this
 * interface beside the existing primitive allows services to depend on a
 * transaction manager without opening nested transactions. */
export const transactionManager: TransactionManager = {
  run: withTenantTransaction,
};

const instrumentedClients = new WeakSet<object>();

function statementText(statement: unknown): string | undefined {
  if (typeof statement === "string") return statement;
  if (statement && typeof statement === "object" && "text" in statement) {
    const text = (statement as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return undefined;
}

function transactionBoundary(statement: unknown): "begin" | "commit" | "rollback" | undefined {
  const text = statementText(statement)?.trim().toLowerCase();
  if (text === "begin" || text?.startsWith("begin ")) return "begin";
  if (text === "commit" || text?.startsWith("commit ")) return "commit";
  if (text === "rollback") return "rollback";
  return undefined;
}

function instrumentClientRoundTrips(client: unknown): unknown {
  const target = client as { query?: (...queryArgs: unknown[]) => unknown } | null;
  if (!target || typeof target.query !== "function" || instrumentedClients.has(target)) {
    return client;
  }
  instrumentedClients.add(target);
  const originalQuery = target.query.bind(target);
  let roundTrips = 0;
  let transactionStartedAt = 0;
  target.query = (...queryArgs: unknown[]) => {
    const boundary = transactionBoundary(queryArgs[0]);
    if (boundary === "begin") {
      roundTrips = 0;
      transactionStartedAt = performance.now();
    }
    roundTrips += 1;
    if (boundary === "commit" || boundary === "rollback") {
      logJson("info", "app.context_tx", {
        round_trips: roundTrips,
        outcome: boundary,
        duration_ms: Math.round(performance.now() - transactionStartedAt),
      });
      roundTrips = 0;
      transactionStartedAt = 0;
    }
    return originalQuery(...queryArgs);
  };
  return client;
}

/** Counts real round trips per transaction and emits an `app.context_tx` log
 * line on commit/rollback (S1-PERF-TX RT instrumentation, zero dependencies). */
export function instrumentPoolRoundTrips(pool: unknown): void {
  const poolLike = pool as { connect?: (...connectArgs: unknown[]) => unknown } | null;
  if (!poolLike || typeof poolLike.connect !== "function") return;
  const originalConnect = poolLike.connect.bind(pool);
  poolLike.connect = (...connectArgs: unknown[]) => {
    const connected = originalConnect(...connectArgs);
    if (!(connected instanceof Promise)) return connected;
    return connected.then((client) => instrumentClientRoundTrips(client));
  };
}
