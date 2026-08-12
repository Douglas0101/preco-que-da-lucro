import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export interface TableReconciliation {
  table: string;
  sourceCount: number;
  targetCount: number;
  difference: number;
  sourceNulls: number;
  targetNulls: number;
  sourceMinCreatedAt: string | null;
  targetMinCreatedAt: string | null;
  sourceMaxCreatedAt: string | null;
  targetMaxCreatedAt: string | null;
  sourceFinancialTotal: string | null;
  targetFinancialTotal: string | null;
  sourceOrphans: number;
  targetOrphans: number;
  sourceSampleChecksum: string;
  targetSampleChecksum: string;
  matches: boolean;
}

export interface MigrationReconciliation {
  generatedAt: string;
  tables: TableReconciliation[];
  totals: { matching: number; different: number };
}

interface ReconciliationSpec {
  table: string;
  sourceTable: string;
  targetTable: string;
  sourceCreatedAt?: string;
  targetCreatedAt?: string;
  sourceNullExpression?: string;
  targetNullExpression?: string;
  sourceFinancialExpression?: string;
  targetFinancialExpression?: string;
  sourceOrphanExpression?: string;
  targetOrphanExpression?: string;
}

const ZERO = "0";
const SPECS: ReconciliationSpec[] = [
  {
    table: "users",
    sourceTable: "auth.users",
    targetTable: "users",
    sourceNullExpression: "count(*) filter (where email is null)",
    targetNullExpression: "count(*) filter (where email is null)",
  },
  {
    table: "profiles",
    sourceTable: "auth.users",
    targetTable: "profiles",
    sourceNullExpression: ZERO,
    targetNullExpression: "count(*) filter (where email is null)",
  },
  {
    table: "products",
    sourceTable: "public.products",
    targetTable: "products",
    sourceNullExpression:
      "count(*) filter (where current_price is null) + count(*) filter (where yield_qty is null) + count(*) filter (where tax_rate is null)",
    targetNullExpression:
      "count(*) filter (where current_price is null) + count(*) filter (where yield_qty is null) + count(*) filter (where tax_rate is null)",
    sourceFinancialExpression: "coalesce(sum(current_price), 0)",
    targetFinancialExpression: "coalesce(sum(current_price), 0)",
  },
  {
    table: "product_ingredients",
    sourceTable: "public.product_ingredients",
    targetTable: "product_ingredients",
    sourceFinancialExpression: "coalesce(sum(package_price), 0)",
    targetFinancialExpression: "coalesce(sum(package_price), 0)",
    sourceNullExpression:
      "count(*) filter (where package_price is null) + count(*) filter (where package_qty is null) + count(*) filter (where package_unit is null)",
    targetNullExpression:
      "count(*) filter (where package_price is null) + count(*) filter (where package_qty is null) + count(*) filter (where package_unit is null)",
    sourceOrphanExpression:
      "(select count(*) from public.product_ingredients c left join public.products p on p.id = c.product_id where p.id is null)",
    targetOrphanExpression:
      "(select count(*) from product_ingredients c left join products p on p.tenant_id = c.tenant_id and p.id = c.product_id where p.id is null)",
  },
  {
    table: "product_packaging",
    sourceTable: "public.product_packaging",
    targetTable: "product_packaging",
    sourceFinancialExpression: "coalesce(sum(package_price), 0)",
    targetFinancialExpression: "coalesce(sum(package_price), 0)",
    sourceOrphanExpression:
      "(select count(*) from public.product_packaging c left join public.products p on p.id = c.product_id where p.id is null)",
    targetOrphanExpression:
      "(select count(*) from product_packaging c left join products p on p.tenant_id = c.tenant_id and p.id = c.product_id where p.id is null)",
  },
  {
    table: "sales_fees",
    sourceTable: "public.sales_fees",
    targetTable: "sales_fees",
    sourceFinancialExpression: "coalesce(sum(percentage / 100), 0)",
    targetFinancialExpression: "coalesce(sum(percentage), 0)",
    sourceOrphanExpression:
      "(select count(*) from public.sales_fees c left join public.products p on p.id = c.product_id where p.id is null)",
    targetOrphanExpression:
      "(select count(*) from sales_fees c left join products p on p.tenant_id = c.tenant_id and p.id = c.product_id where p.id is null)",
  },
  {
    table: "market_prices",
    sourceTable: "public.market_prices",
    targetTable: "market_prices",
    sourceNullExpression:
      "count(*) filter (where min_price is null) + count(*) filter (where avg_price is null) + count(*) filter (where max_price is null)",
    targetNullExpression:
      "count(*) filter (where min_price is null) + count(*) filter (where avg_price is null) + count(*) filter (where max_price is null)",
    sourceFinancialExpression: "coalesce(sum(avg_price), 0)",
    targetFinancialExpression: "coalesce(sum(avg_price), 0)",
  },
  {
    table: "expenses",
    sourceTable: "public.expenses",
    targetTable: "expenses",
    sourceFinancialExpression: "coalesce(sum(amount), 0)",
    targetFinancialExpression: "coalesce(sum(amount), 0)",
  },
  {
    table: "simulations",
    sourceTable: "public.simulations",
    targetTable: "simulations",
    sourceNullExpression: "count(*) filter (where product_id is null)",
    targetNullExpression: "count(*) filter (where product_id is null)",
  },
  { table: "chat_messages", sourceTable: "public.chat_messages", targetTable: "chat_messages" },
];

interface SummaryRow {
  count: string;
  nulls: string;
  min_created_at: Date | null;
  max_created_at: Date | null;
  financial_total: string | null;
  orphans: string;
  sample: string;
}

function safeIdentifierPath(value: string): string {
  if (!/^[a-z_]+(?:\.[a-z_]+)?$/.test(value)) throw new Error("Identificador inválido");
  return value;
}

function checksum(sample: string): string {
  return createHash("sha256").update(sample).digest("hex");
}

async function summarize(
  client: PoolClient,
  table: string,
  options: {
    createdAt: string;
    nullExpression: string;
    financialExpression: string;
    orphanExpression: string;
  },
): Promise<SummaryRow> {
  const safeTable = safeIdentifierPath(table);
  const result = await client.query<SummaryRow>(`
    select
      count(*)::text as count,
      (${options.nullExpression})::text as nulls,
      min(${options.createdAt}) as min_created_at,
      max(${options.createdAt}) as max_created_at,
      case when (${options.financialExpression}) is null then null
           else round((${options.financialExpression})::numeric, 6)::numeric(38,6)::text
      end as financial_total,
      (${options.orphanExpression})::text as orphans,
      coalesce((select string_agg(sample.id::text, ',' order by sample.id::text)
                from (select id from ${safeTable} order by id limit 100) sample), '') as sample
    from ${safeTable}
  `);
  if (!result.rows[0]) throw new Error(`Resumo ausente para ${table}`);
  return result.rows[0];
}

function timestamp(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export async function reconcileMigration(
  source: PoolClient,
  target: PoolClient,
): Promise<MigrationReconciliation> {
  const tables: TableReconciliation[] = [];
  for (const spec of SPECS) {
    const sourceSummary = await summarize(source, spec.sourceTable, {
      createdAt: spec.sourceCreatedAt ?? "created_at",
      nullExpression: spec.sourceNullExpression ?? ZERO,
      financialExpression: spec.sourceFinancialExpression ?? "null::numeric",
      orphanExpression: spec.sourceOrphanExpression ?? ZERO,
    });
    const targetSummary = await summarize(target, spec.targetTable, {
      createdAt: spec.targetCreatedAt ?? "created_at",
      nullExpression: spec.targetNullExpression ?? ZERO,
      financialExpression: spec.targetFinancialExpression ?? "null::numeric",
      orphanExpression: spec.targetOrphanExpression ?? ZERO,
    });
    const sourceCount = Number(sourceSummary.count);
    const targetCount = Number(targetSummary.count);
    const sourceFinancialTotal = sourceSummary.financial_total;
    const targetFinancialTotal = targetSummary.financial_total;
    const item: TableReconciliation = {
      table: spec.table,
      sourceCount,
      targetCount,
      difference: targetCount - sourceCount,
      sourceNulls: Number(sourceSummary.nulls),
      targetNulls: Number(targetSummary.nulls),
      sourceMinCreatedAt: timestamp(sourceSummary.min_created_at),
      targetMinCreatedAt: timestamp(targetSummary.min_created_at),
      sourceMaxCreatedAt: timestamp(sourceSummary.max_created_at),
      targetMaxCreatedAt: timestamp(targetSummary.max_created_at),
      sourceFinancialTotal,
      targetFinancialTotal,
      sourceOrphans: Number(sourceSummary.orphans),
      targetOrphans: Number(targetSummary.orphans),
      sourceSampleChecksum: checksum(sourceSummary.sample),
      targetSampleChecksum: checksum(targetSummary.sample),
      matches:
        sourceCount === targetCount &&
        Number(sourceSummary.nulls) === Number(targetSummary.nulls) &&
        timestamp(sourceSummary.min_created_at) === timestamp(targetSummary.min_created_at) &&
        timestamp(sourceSummary.max_created_at) === timestamp(targetSummary.max_created_at) &&
        sourceFinancialTotal === targetFinancialTotal &&
        Number(sourceSummary.orphans) === 0 &&
        Number(targetSummary.orphans) === 0 &&
        checksum(sourceSummary.sample) === checksum(targetSummary.sample),
    };
    tables.push(item);
  }
  const matching = tables.filter((table) => table.matches).length;
  return {
    generatedAt: new Date().toISOString(),
    tables,
    totals: { matching, different: tables.length - matching },
  };
}
