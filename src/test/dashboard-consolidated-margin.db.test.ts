// DBT-88 — prova de banco da margem consolidada (três estados honestos).
//
// Exercita o caminho REAL (repositório Drizzle + serviço + read model) dentro
// de uma transação `app_runtime` com os GUCs do tenant, sobre PG17 efêmero.
// Um tenant por estado, com oráculo Decimal independente:
//   - TENANT_EMPTY:  zero vendas reais → `empty` (nada presumido);
//   - TENANT_OK:     2 × mc 11.50 = 23.00 sobre receita 50.00 → 46.0000%;
//   - TENANT_MIX:    venda mista com produto sem custo calculável →
//                    `incomplete`, nunca margem parcial.
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { getDashboardSummary } from "@/lib/dashboard.functions";
import type { DashboardSummary } from "@/server/services/dashboard.service";
import type { RequestContext } from "@/lib/request-context";
import { ensureRuntimeRoleMembership, runMigrations } from "../../scripts/db/migrate";
import { dbPrecondition, skipLabel } from "./helpers/db-precondition";

vi.mock("@tanstack/react-start", () => ({
  createMiddleware: () => ({ server: (handler: unknown) => handler }),
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      validator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));

const TENANT_EMPTY = "d8800000-0000-4000-8000-0000000000e1";
const TENANT_OK = "d8800000-0000-4000-8000-0000000000e2";
const TENANT_MIX = "d8800000-0000-4000-8000-0000000000e3";
const TENANT_ACTUAL_PRICE = "d8800000-0000-4000-8000-0000000000e4";
const USER_EMPTY = "d8800000-0000-4000-8000-0000000000f1";
const USER_OK = "d8800000-0000-4000-8000-0000000000f2";
const USER_MIX = "d8800000-0000-4000-8000-0000000000f3";
const USER_ACTUAL_PRICE = "d8800000-0000-4000-8000-0000000000f4";
const CALCULABLE_OK = "d8800000-0000-4000-8000-0000000000a1";
const CALCULABLE_MIX = "d8800000-0000-4000-8000-0000000000a3";
const CALCULABLE_ACTUAL_PRICE = "d8800000-0000-4000-8000-0000000000a4";
const INCOMPLETE = "d8800000-0000-4000-8000-0000000000a2";
const SALE_OK = "d8800000-0000-4000-8000-0000000000b1";
const SALE_MIXED = "d8800000-0000-4000-8000-0000000000b2";
const SALE_ACTUAL_PRICE = "d8800000-0000-4000-8000-0000000000b3";
const CORRELATION_ID = "d8800000-0000-4000-8000-0000000000c1";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const dbGate = dbPrecondition();
if (!dbGate.enabled) console.log(skipLabel(dbGate.motivo));
const dbDescribe = dbGate.enabled ? describe : describe.skip;

dbDescribe("margem consolidada — caminho real (DBT-88, PG efêmero)", () => {
  const pool = new Pool({ connectionString: adminUrl ?? "", max: 2 });
  const database = drizzle({ client: pool, schema });

  beforeAll(async () => {
    await runMigrations(adminUrl);
    await ensureRuntimeRoleMembership(pool);
    const tenants = [TENANT_EMPTY, TENANT_OK, TENANT_MIX, TENANT_ACTUAL_PRICE];
    for (const tenant of tenants) {
      // Vendas primeiro: o trigger de totais retorna cedo no DELETE da venda
      // (e a cascata leva os itens); deletar itens antes deixaria venda sem
      // item no commit e dispararia SALE_REQUIRES_ITEM.
      await pool.query("delete from sales where tenant_id = $1", [tenant]);
      await pool.query("delete from sales_items where tenant_id = $1", [tenant]);
      await pool.query("delete from product_ingredients where tenant_id = $1", [tenant]);
      await pool.query("delete from product_packaging where tenant_id = $1", [tenant]);
      await pool.query("delete from sales_fees where tenant_id = $1", [tenant]);
      await pool.query("delete from products where tenant_id = $1", [tenant]);
    }
    // Tenants, usuários e memberships (um usuário owner por tenant).
    const identities: Array<[string, string, string]> = [
      [TENANT_EMPTY, USER_EMPTY, "margin-empty@dashboard-db.test"],
      [TENANT_OK, USER_OK, "margin-ok@dashboard-db.test"],
      [TENANT_MIX, USER_MIX, "margin-mix@dashboard-db.test"],
      [TENANT_ACTUAL_PRICE, USER_ACTUAL_PRICE, "margin-actual@dashboard-db.test"],
    ];
    for (const [tenant, user, email] of identities) {
      await pool.query(
        `insert into users (id, name, email, email_verified)
         values ($1, 'Usuário Margem', $2, true)
         on conflict (id) do update set name = excluded.name`,
        [user, email],
      );
      await pool.query(
        `insert into tenants (id, name, slug) values ($1, 'Tenant Margem', $2)
         on conflict (id) do update set name = excluded.name`,
        [tenant, email.split("@")[0]],
      );
      await pool.query(
        `insert into tenant_memberships (tenant_id, user_id, role) values ($1, $2, 'owner')
         on conflict (tenant_id, user_id) do update set role = 'owner'`,
        [tenant, user],
      );
    }
    // Produto com custo calculável: preço 25.00, ingrediente 10.00/kg × 1 kg,
    // embalagem 1.00/un, taxa 10% ⇒ mc unitária 11.50 (cmPct 46%).
    for (const [tenant, user, calculable] of [
      [TENANT_OK, USER_OK, CALCULABLE_OK],
      [TENANT_MIX, USER_MIX, CALCULABLE_MIX],
      [TENANT_ACTUAL_PRICE, USER_ACTUAL_PRICE, CALCULABLE_ACTUAL_PRICE],
    ]) {
      // ids globais (PK): cada tenant ganha o seu par produto/filhos.
      await pool.query(
        `insert into products (id, tenant_id, user_id, name, current_price, yield_qty, yield_unit, status, tax_rate, version)
         values ($1, $2, $3, 'Bolo Calculável', '25.0000', '1.000000', 'unidade', 'active', '0.1', 0)`,
        [calculable, tenant, user],
      );
      await pool.query(
        `insert into product_ingredients
           (id, product_id, tenant_id, user_id, name, used_qty, used_unit, package_price, package_qty, package_unit)
         values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, 'Farinha', '1.000000', 'kg', '10.0000', '1.000000', 'kg')`,
        [calculable, tenant, user],
      );
      await pool.query(
        `insert into product_packaging
           (id, product_id, tenant_id, user_id, name, package_price, units_per_package)
         values (md5(random()::text || clock_timestamp()::text)::uuid, $1, $2, $3, 'Caixa', '1.0000', '1.000000')`,
        [calculable, tenant, user],
      );
    }
    // Produto vendido SEM custo calculável (rascunho, sem insumos) no tenant misto.
    await pool.query(
      `insert into products (id, tenant_id, user_id, name, status, version)
       values ($1, $2, $3, 'Bolo Incompleto', 'draft', 0)`,
      [INCOMPLETE, TENANT_MIX, USER_MIX],
    );
    // Venda e itens no MESMO commit: o trigger de totais é DEFERRABLE
    // INITIALLY DEFERRED e reprova venda sem item no commit (SALE_REQUIRES_ITEM).
    async function insertSaleWithItems(
      saleId: string,
      tenant: string,
      user: string,
      gross: string,
      items: Array<{ productId: string; quantity: string; unitPrice: string; total: string }>,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `insert into sales (id, tenant_id, user_id, occurred_at, gross_amount, net_amount, channel)
           values ($1, $2, $3, now(), $4, $4, 'Loja')`,
          [saleId, tenant, user, gross],
        );
        for (const item of items) {
          await client.query(
            `insert into sales_items (sale_id, tenant_id, user_id, product_id, quantity, unit_price, total_amount)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [saleId, tenant, user, item.productId, item.quantity, item.unitPrice, item.total],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }

    // TENANT_OK: venda única de 2× calculável (receita 50.00).
    await insertSaleWithItems(SALE_OK, TENANT_OK, USER_OK, "50.0000", [
      { productId: CALCULABLE_OK, quantity: "2.000000", unitPrice: "25.0000", total: "50.0000" },
    ]);
    // TENANT_MIX: venda mista — 2× calculável (50.00) + 1× incompleto (30.00).
    await insertSaleWithItems(SALE_MIXED, TENANT_MIX, USER_MIX, "80.0000", [
      { productId: CALCULABLE_MIX, quantity: "2.000000", unitPrice: "25.0000", total: "50.0000" },
      { productId: INCOMPLETE, quantity: "1.000000", unitPrice: "30.0000", total: "30.0000" },
    ]);
    // Preço efetivamente vendido (40) distinto do catálogo (25).
    await insertSaleWithItems(
      SALE_ACTUAL_PRICE,
      TENANT_ACTUAL_PRICE,
      USER_ACTUAL_PRICE,
      "80.0000",
      [
        {
          productId: CALCULABLE_ACTUAL_PRICE,
          quantity: "2.000000",
          unitPrice: "40.0000",
          total: "80.0000",
        },
      ],
    );
  }, 60_000);

  afterAll(async () => {
    await pool.end();
  });

  /** Executa o server fn numa transação `app_runtime` com os GUCs do tenant. */
  async function asTenant(tenantId: string, userId: string) {
    return database.transaction(async (transaction) => {
      await transaction.execute(sql`set local role app_runtime`);
      await transaction.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
      await transaction.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
      const context: RequestContext = {
        userId,
        tenantId,
        roles: ["owner"],
        correlationId: CORRELATION_ID,
        signal: AbortSignal.timeout(15_000),
        transaction,
      };
      // O mock de createServerFn expõe o handler cru: o shape de chamada é o
      // do runtime TanStack (o mesmo padrão da suíte products-fk-conflict).
      // O cast é o mesmo da suíte irmã — o fetcher tipado não expõe `context`.
      const handler = getDashboardSummary as unknown as (input: {
        data: { period: "month" };
        context: { requestContext: RequestContext };
      }) => Promise<DashboardSummary>;
      return handler({ data: { period: "month" }, context: { requestContext: context } });
    });
  }

  it("estado empty: tenant sem vendas reais não inventa margem", async () => {
    const summary = await asTenant(TENANT_EMPTY, USER_EMPTY);
    expect(summary.productCount).toBe(0);
    expect(summary.sales.count).toBe(0);
    expect(summary.consolidatedMargin).toEqual({ state: "empty" });
  });

  it("estado ok: Σ(qty × mc unitária) ÷ receita líquida, em Decimal", async () => {
    const summary = await asTenant(TENANT_OK, USER_OK);
    // Oráculo independente: mc 11.50/un (25 − 10 − 1 − 2.5 de taxa);
    // 2 × 11.50 = 23.00; 23.00 / 50.00 × 100 = 46.00%.
    expect(summary.sales.count).toBe(1);
    expect(summary.sales.revenue).toBe("50.0000");
    expect(summary.consolidatedMargin).toEqual({
      state: "ok",
      valuePct: "46.0000",
      valueAmount: "23.0000",
    });
  });

  it("estado incomplete: produto vendido sem custo calculável desclassifica o agregado", async () => {
    const summary = await asTenant(TENANT_MIX, USER_MIX);
    // A agregação factual por produto (2 un do calculável + 1 un do incompleto)
    // alimenta o estado: o produto sem custo desclassifica a margem inteira.
    expect(summary.sales.count).toBe(1);
    expect(summary.sales.revenue).toBe("80.0000");
    expect(summary.consolidatedMargin).toEqual({
      state: "incomplete",
      incompleteProductCount: 1,
      zeroRevenue: false,
    });
  });

  it("preço real e identidade: duas unidades vendidas a 40 não usam catálogo de 25", async () => {
    const summary = await asTenant(TENANT_ACTUAL_PRICE, USER_ACTUAL_PRICE);
    expect(summary.productCount).toBe(1);
    expect(summary.sales).toEqual({ revenue: "80.0000", count: 1 });
    expect(summary.consolidatedMargin).toEqual({
      state: "ok",
      valuePct: "62.5000",
      valueAmount: "50.0000",
    });
    // Os outros três tenants também têm vendas/estados distintos. Um join
    // sem escopo traria os 210 de receita ou contaminaria o estado calculável.
    const empty = await asTenant(TENANT_EMPTY, USER_EMPTY);
    expect(empty.sales).toEqual({ revenue: "0", count: 0 });
    expect(empty.consolidatedMargin).toEqual({ state: "empty" });
  });
});
