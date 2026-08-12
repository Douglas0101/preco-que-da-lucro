import { Pool as NeonPool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool as NodePostgresPool } from "pg";
import * as schema from "@/db/schema";

function createNeonDatabase(connectionString: string) {
  const pool = new NeonPool({ connectionString });
  return drizzleNeon({ client: pool, schema });
}

export type Database = ReturnType<typeof createNeonDatabase>;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseIdentity {
  userId: string;
  tenantId: string;
  roles: readonly string[];
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
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(sql`
      select
        set_config('app.current_user_id', ${identity.userId}, true),
        set_config('app.current_tenant_id', ${identity.tenantId}, true),
        set_config('app.current_roles', ${identity.roles.join(",")}, true)
    `);

    return operation(transaction);
  });
}
