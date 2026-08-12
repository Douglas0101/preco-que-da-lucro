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

export async function runMigrations(adminUrl = requireAdminUrl()): Promise<void> {
  const pool = new Pool({ connectionString: adminUrl, max: 1 });
  try {
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
