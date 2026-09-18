// Sonda descartável do TRILHO D2 (F-C6-1): mede, no caminho REAL do driver, em que
// profundidade da cadeia de causas mora o `DatabaseError` do node-postgres e quais
// campos ele carrega (`code`, `constraint`, `table`, `schema`) para as duas FKs de
// `purchase_price_history`. É a medição que fixa `FK_CAUSE_CHAIN_LIMIT` e o nome
// truncado em 63 bytes usado por `PURCHASE_HISTORY_FKS`.
//
// Uso (PG17 efêmero; nunca `:5432`/remoto):
//   cd .worktree-trk-d2 && env -u DATABASE_URL_UNPOOLED \
//     DATABASE_ADMIN_URL=postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test \
//     DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55470/preco_que_da_lucro_test \
//     npx tsx docs/evidence/trk-d2-fk-2026-09-18/probe-real-driver-error-shape.ts
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../../src/db/schema";
import type { RequestContext } from "../../../src/lib/request-context";
import { productService } from "../../../src/server/services/product.service";
import {
  ensureRuntimeRoleMembership,
  requireAdminUrl,
  runMigrations,
} from "../../../scripts/db/migrate";

const TENANT = "c4100000-0000-4000-8000-000000000001";
const USER = "c4100000-0000-4000-8000-000000000002";
const PRODUCT = "c4100000-0000-4000-8000-000000000003";
const INGREDIENT = "c4100000-0000-4000-8000-000000000004";
const PACKAGING = "c4100000-0000-4000-8000-000000000005";
const HISTORY_INGREDIENT = "c4100000-0000-4000-8000-000000000006";
const HISTORY_PACKAGING = "c4100000-0000-4000-8000-000000000007";

const adminUrl = requireAdminUrl();
const pool = new Pool({ connectionString: adminUrl, max: 2 });
const database = drizzle({ client: pool, schema });

await runMigrations(adminUrl);
await ensureRuntimeRoleMembership(pool);
await pool.query("delete from purchase_price_history where tenant_id = $1", [TENANT]);
await pool.query("delete from product_ingredients where tenant_id = $1", [TENANT]);
await pool.query("delete from product_packaging where tenant_id = $1", [TENANT]);
await pool.query("delete from products where tenant_id = $1", [TENANT]);
await pool.query(
  `insert into users (id, name, email, email_verified)
   values ($1, 'Usuário FK', 'fk-conflict@products-fk.test', true)
   on conflict (id) do update set name = excluded.name`,
  [USER],
);
await pool.query(
  `insert into tenants (id, name, slug) values ($1, 'Tenant FK', 'products-fk-conflict')
   on conflict (id) do update set name = excluded.name`,
  [TENANT],
);
await pool.query(
  `insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')
   on conflict (tenant_id, user_id) do update set role = 'owner'`,
  [TENANT, USER],
);
await pool.query(
  `insert into products (id, tenant_id, user_id, name, current_price, yield_qty, yield_unit, status, version)
   values ($1, $2, $3, 'Produto FK', '25.0000', '12.000000', 'unidade', 'active', 0)`,
  [PRODUCT, TENANT, USER],
);
await pool.query(
  `insert into product_ingredients
     (id, product_id, tenant_id, user_id, name, used_qty, used_unit, package_price, package_qty, package_unit)
   values ($1, $2, $3, $4, 'Farinha', '1.000000', 'kg', '8.9000', '5.000000', 'kg')`,
  [INGREDIENT, PRODUCT, TENANT, USER],
);
await pool.query(
  `insert into product_packaging
     (id, product_id, tenant_id, user_id, name, package_price, units_per_package)
   values ($1, $2, $3, $4, 'Caixa', '1.2000', '10.000000')`,
  [PACKAGING, PRODUCT, TENANT, USER],
);
await pool.query(
  `insert into purchase_price_history
     (id, tenant_id, user_id, subject_type, subject_id, ingredient_id, price, quantity, unit, valid_from)
   values ($1, $2, $3, 'ingredient', $4, $4, '8.9000', '5.000000', 'kg', now())`,
  [HISTORY_INGREDIENT, TENANT, USER, INGREDIENT],
);
await pool.query(
  `insert into purchase_price_history
     (id, tenant_id, user_id, subject_type, subject_id, packaging_id, price, quantity, unit, valid_from)
   values ($1, $2, $3, 'packaging', $4, $4, '1.2000', '10.000000', 'unidade', now())`,
  [HISTORY_PACKAGING, TENANT, USER, PACKAGING],
);

function contextFor(transaction: RequestContext["transaction"]): RequestContext {
  return {
    userId: USER,
    tenantId: TENANT,
    roles: ["owner"],
    correlationId: "c4100000-0000-4000-8000-0000000000c1",
    signal: AbortSignal.timeout(15_000),
    transaction,
  };
}

async function probe(kind: "ingredient" | "packaging", id: string): Promise<void> {
  try {
    await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local role app_runtime`);
      await transaction.execute(sql`
        select
          set_config('app.current_user_id', ${USER}, true),
          set_config('app.current_tenant_id', ${TENANT}, true),
          set_config('app.current_roles', 'owner', true)
      `);
      await productService.deleteChild(
        contextFor(transaction as unknown as RequestContext["transaction"]),
        kind,
        id,
      );
    });
    console.log(`${kind}: SEM ERRO (inesperado)`);
  } catch (error) {
    let current: unknown = error;
    for (let depth = 0; depth < 10; depth += 1) {
      if (typeof current !== "object" || current === null) break;
      const node = current as Record<string, unknown>;
      console.log(
        JSON.stringify({
          kind,
          depth,
          ctor: (current as { constructor?: { name?: string } }).constructor?.name,
          code: node.code ?? null,
          constraint: node.constraint ?? null,
          constraintLength: typeof node.constraint === "string" ? node.constraint.length : null,
          table: node.table ?? null,
          schema: node.schema ?? null,
        }),
      );
      if (!("cause" in node)) break;
      current = node.cause;
    }
  }
}

await probe("ingredient", INGREDIENT);
await probe("packaging", PACKAGING);
await pool.end();
