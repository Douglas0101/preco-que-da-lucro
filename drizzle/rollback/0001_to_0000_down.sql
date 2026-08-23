DROP SCHEMA IF EXISTS drizzle CASCADE;

DROP TABLE IF EXISTS
  audit_events,
  ai_daily_budgets,
  tool_executions,
  idempotency_records,
  calculation_snapshots,
  sales_items,
  sales,
  purchase_price_history,
  chat_messages,
  chat_conversations,
  simulations,
  expenses,
  market_prices,
  sales_fees,
  product_packaging,
  product_ingredients,
  profiles,
  products,
  rate_limits,
  tenant_memberships,
  tenants,
  verifications,
  sessions,
  accounts,
  users
CASCADE;

DROP SCHEMA IF EXISTS app_private CASCADE;

DO $drop_runtime$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    DROP OWNED BY app_runtime;
    DROP ROLE app_runtime;
  END IF;
END
$drop_runtime$;
