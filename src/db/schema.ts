import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const tenantIdentity = {
  tenantId: uuid("tenant_id").notNull(),
  userId: text("user_id").notNull(),
};

const money = (name: string) => numeric(name, { precision: 19, scale: 4 });
const quantity = (name: string) => numeric(name, { precision: 24, scale: 6 });
const percent = (name: string) => numeric(name, { precision: 9, scale: 6 });

// Better Auth models. String identifiers intentionally preserve imported Supabase UUIDs.
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_uidx").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("sessions_token_uidx").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_provider_account_uidx").on(table.providerId, table.accountId),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_expires_at_idx").on(table.expiresAt),
  ],
);

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull().default("personal"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tenants_slug_uidx").on(table.slug),
    check("tenants_kind_check", sql`${table.kind} in ('personal', 'organization')`),
  ],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.userId] }),
    index("tenant_memberships_user_id_idx").on(table.userId),
    check("tenant_memberships_role_check", sql`${table.role} in ('owner', 'admin', 'member')`),
  ],
);

export const profiles = pgTable(
  "profiles",
  {
    id: text("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    ...tenantIdentity,
    email: text("email"),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profiles_tenant_id_id_uidx").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("cascade"),
    check("profiles_identity_check", sql`${table.id} = ${table.userId}`),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    name: text("name").notNull(),
    currentPrice: money("current_price"),
    yieldQty: quantity("yield_qty"),
    yieldUnit: text("yield_unit"),
    taxRegime: text("tax_regime"),
    taxRate: percent("tax_rate"),
    isDemo: boolean("is_demo").notNull().default(false),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("products_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("products_tenant_active_idx").on(table.tenantId, table.archivedAt),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check(
      "products_current_price_check",
      sql`${table.currentPrice} is null or ${table.currentPrice} >= 0`,
    ),
    check("products_yield_qty_check", sql`${table.yieldQty} is null or ${table.yieldQty} > 0`),
    check(
      "products_tax_rate_check",
      sql`${table.taxRate} is null or (${table.taxRate} >= 0 and ${table.taxRate} <= 1)`,
    ),
  ],
);

export const productIngredients = pgTable(
  "product_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull(),
    ...tenantIdentity,
    name: text("name").notNull(),
    usedQty: quantity("used_qty").notNull(),
    usedUnit: text("used_unit").notNull(),
    packagePrice: money("package_price"),
    packageQty: quantity("package_qty"),
    packageUnit: text("package_unit"),
    conversionFactor: numeric("conversion_factor", { precision: 24, scale: 8 }),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_ingredients_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("product_ingredients_tenant_product_idx").on(table.tenantId, table.productId),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check("product_ingredients_used_qty_check", sql`${table.usedQty} > 0`),
    check(
      "product_ingredients_package_price_check",
      sql`${table.packagePrice} is null or ${table.packagePrice} >= 0`,
    ),
    check(
      "product_ingredients_package_qty_check",
      sql`${table.packageQty} is null or ${table.packageQty} > 0`,
    ),
    check(
      "product_ingredients_conversion_factor_check",
      sql`${table.conversionFactor} is null or ${table.conversionFactor} > 0`,
    ),
  ],
);

export const productPackaging = pgTable(
  "product_packaging",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull(),
    ...tenantIdentity,
    name: text("name").notNull(),
    packagePrice: money("package_price").notNull(),
    unitsPerPackage: quantity("units_per_package").notNull(),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_packaging_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("product_packaging_tenant_product_idx").on(table.tenantId, table.productId),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check("product_packaging_price_check", sql`${table.packagePrice} >= 0`),
    check("product_packaging_units_check", sql`${table.unitsPerPackage} > 0`),
  ],
);

export const salesFees = pgTable(
  "sales_fees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull(),
    ...tenantIdentity,
    name: text("name").notNull(),
    percentage: percent("percentage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_fees_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("sales_fees_tenant_product_idx").on(table.tenantId, table.productId),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check(
      "sales_fees_percentage_check",
      sql`${table.percentage} >= 0 and ${table.percentage} <= 1`,
    ),
  ],
);

export const marketPrices = pgTable(
  "market_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull(),
    ...tenantIdentity,
    minPrice: money("min_price"),
    avgPrice: money("avg_price"),
    maxPrice: money("max_price"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("market_prices_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("market_prices_tenant_product_created_idx").on(
      table.tenantId,
      table.productId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check("market_prices_min_check", sql`${table.minPrice} is null or ${table.minPrice} >= 0`),
    check("market_prices_avg_check", sql`${table.avgPrice} is null or ${table.avgPrice} >= 0`),
    check("market_prices_max_check", sql`${table.maxPrice} is null or ${table.maxPrice} >= 0`),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    name: text("name").notNull(),
    category: text("category"),
    amount: money("amount").notNull(),
    type: text("type").notNull().default("fixa"),
    periodicity: text("periodicity").notNull().default("mensal"),
    isDemo: boolean("is_demo").notNull().default(false),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("expenses_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("expenses_tenant_created_idx").on(table.tenantId, table.createdAt),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check("expenses_amount_check", sql`${table.amount} >= 0`),
    check("expenses_type_check", sql`${table.type} in ('fixa', 'variavel')`),
  ],
);

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    productId: uuid("product_id"),
    name: text("name").notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("simulations_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("simulations_tenant_created_idx").on(table.tenantId, table.createdAt),
    foreignKey({
      columns: [table.tenantId, table.productId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
  ],
);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    currentProductId: uuid("current_product_id"),
    confirmedState: jsonb("confirmed_state").$type<Record<string, unknown>>().notNull().default({}),
    resetAt: timestamp("reset_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("chat_conversations_tenant_user_uidx").on(table.tenantId, table.userId),
    uniqueIndex("chat_conversations_tenant_id_uidx").on(table.tenantId, table.id),
    foreignKey({
      columns: [table.tenantId, table.currentProductId],
      foreignColumns: [products.tenantId, products.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("cascade"),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    ...tenantIdentity,
    role: text("role").notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_messages_tenant_id_id_uidx").on(table.tenantId, table.id),
    index("chat_messages_tenant_conversation_created_idx").on(
      table.tenantId,
      table.conversationId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.tenantId, table.conversationId],
      foreignColumns: [chatConversations.tenantId, chatConversations.id],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("cascade"),
    check(
      "chat_messages_role_check",
      sql`${table.role} in ('user', 'assistant', 'system', 'tool')`,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status").notNull().default("pending"),
    response: jsonb("response").$type<Record<string, unknown>>(),
    errorCode: text("error_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idempotency_records_scope_uidx").on(
      table.tenantId,
      table.userId,
      table.operation,
      table.key,
    ),
    index("idempotency_records_expires_idx").on(table.expiresAt),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("cascade"),
    check(
      "idempotency_records_status_check",
      sql`${table.status} in ('pending', 'succeeded', 'failed')`,
    ),
  ],
);

export const toolExecutions = pgTable(
  "tool_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    correlationId: uuid("correlation_id").notNull(),
    toolName: text("tool_name").notNull(),
    inputHash: text("input_hash").notNull(),
    status: text("status").notNull().default("pending"),
    durationMs: integer("duration_ms"),
    safeResult: jsonb("safe_result").$type<Record<string, unknown>>(),
    errorCode: text("error_code"),
    idempotencyKey: text("idempotency_key"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("tool_executions_idempotency_uidx").on(
      table.tenantId,
      table.userId,
      table.toolName,
      table.idempotencyKey,
    ),
    index("tool_executions_tenant_started_idx").on(table.tenantId, table.startedAt),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
    check(
      "tool_executions_status_check",
      sql`${table.status} in ('pending', 'succeeded', 'failed', 'cancelled')`,
    ),
    check(
      "tool_executions_duration_check",
      sql`${table.durationMs} is null or ${table.durationMs} >= 0`,
    ),
  ],
);

export const aiDailyBudgets = pgTable(
  "ai_daily_budgets",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    usageDate: date("usage_date").notNull(),
    chatCount: integer("chat_count").notNull().default(0),
    modelCallCount: integer("model_call_count").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCost: money("estimated_cost").notNull().default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.usageDate] }),
    check(
      "ai_daily_budgets_nonnegative_check",
      sql`${table.chatCount} >= 0 and ${table.modelCallCount} >= 0 and ${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.estimatedCost} >= 0`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ...tenantIdentity,
    correlationId: uuid("correlation_id").notNull(),
    eventType: text("event_type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    safeMetadata: jsonb("safe_metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_events_correlation_idx").on(table.correlationId),
    foreignKey({
      columns: [table.tenantId, table.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.userId],
    }).onDelete("restrict"),
  ],
);

export type User = typeof users.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
