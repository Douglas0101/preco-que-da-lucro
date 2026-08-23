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

interface Queryable {
  query(text: string): Promise<unknown>;
}

// SET ROLE exige membership explícita quando o admin não é superuser (Neon).
// Como o runner da migration cria app_runtime, no PostgreSQL 16+ ele detém
// ADMIN OPTION sobre a role e pode concedê-la a si mesmo. Localmente o admin
// é o superuser postgres e o grant é inócuo. Idempotente por construção.
export async function ensureRuntimeRoleMembership(client: Queryable): Promise<void> {
  await client.query(`
    do $$
    begin
      if exists (select 1 from pg_roles where rolname = 'app_runtime')
         and not exists (
           select 1
           from pg_auth_members m
           join pg_roles granted on granted.oid = m.roleid
           join pg_roles member on member.oid = m.member
           where granted.rolname = 'app_runtime' and member.rolname = current_user
         ) then
        execute format('grant app_runtime to %I', current_user);
      end if;
    end
    $$;
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log("Migrations PostgreSQL aplicadas com sucesso.");
}
