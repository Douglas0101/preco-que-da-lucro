import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

type Database = ReturnType<typeof createDatabase>;
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

  const pool = new Pool({ connectionString });
  return drizzle({ client: pool, schema });
}

export function getDatabase(): Database {
  database ??= createDatabase();
  return database;
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
