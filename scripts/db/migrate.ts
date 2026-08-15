import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export function requireAdminUrl(): string {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) {
    throw new Error("DATABASE_ADMIN_URL é obrigatória para migrations");
  }
  return adminUrl;
}

/**
 * Migration 0004 is already published and must keep its recorded Drizzle hash.
 * On a database upgraded from 0003, normalize legacy sales totals before 0004
 * adds its arithmetic check. The operation is idempotent and skips databases
 * where the table or the final constraint already exists.
 */
async function prepareLegacySalesTotals(pool: Pool): Promise<void> {
  const table = await pool.query<{ table_name: string | null }>(
    "select to_regclass('public.sales_items')::text as table_name",
  );
  if (!table.rows[0]?.table_name) return;

  const constraint = await pool.query<{ constraint_name: string }>(
    `select conname as constraint_name
     from pg_constraint
     where conrelid = 'public.sales_items'::regclass
       and conname = 'sales_items_total_amount_math_check'`,
  );
  if (constraint.rowCount) return;

  await pool.query(
    `update public.sales_items
     set total_amount = round(quantity * unit_price, 4)
     where total_amount <> round(quantity * unit_price, 4)`,
  );
}

export async function runMigrations(adminUrl = requireAdminUrl()): Promise<void> {
  const pool = new Pool({ connectionString: adminUrl, max: 1 });
  try {
    await prepareLegacySalesTotals(pool);
    const database = drizzle({ client: pool });
    await migrate(database, { migrationsFolder: resolve("drizzle") });
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log("Migrations PostgreSQL aplicadas com sucesso.");
}
