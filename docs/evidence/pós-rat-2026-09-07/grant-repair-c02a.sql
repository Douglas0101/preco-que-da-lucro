DO $grant_repair_roles$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(required_role, ', ' ORDER BY required_role)
    INTO missing
    FROM (VALUES ('app_runtime'), ('authenticated'), ('neondb_owner')) AS required(required_role)
   WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required.required_role);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'grant repair requires roles before grants: %', missing;
  END IF;
END
$grant_repair_roles$;

GRANT DELETE ON TABLE "public"."accounts" TO "app_runtime";

GRANT INSERT ON TABLE "public"."accounts" TO "app_runtime";

GRANT SELECT ON TABLE "public"."accounts" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."accounts" TO "app_runtime";

GRANT DELETE ON TABLE "public"."accounts" TO "authenticated";

GRANT INSERT ON TABLE "public"."accounts" TO "authenticated";

GRANT SELECT ON TABLE "public"."accounts" TO "authenticated";

GRANT UPDATE ON TABLE "public"."accounts" TO "authenticated";

GRANT INSERT ON TABLE "public"."ai_daily_budgets" TO "app_runtime";

GRANT SELECT ON TABLE "public"."ai_daily_budgets" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."ai_daily_budgets" TO "app_runtime";

GRANT DELETE ON TABLE "public"."ai_daily_budgets" TO "authenticated";

GRANT INSERT ON TABLE "public"."ai_daily_budgets" TO "authenticated";

GRANT SELECT ON TABLE "public"."ai_daily_budgets" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ai_daily_budgets" TO "authenticated";

GRANT INSERT ON TABLE "public"."ai_usage" TO "app_runtime";

GRANT SELECT ON TABLE "public"."ai_usage" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."ai_usage" TO "app_runtime";

GRANT DELETE ON TABLE "public"."ai_usage" TO "authenticated";

GRANT INSERT ON TABLE "public"."ai_usage" TO "authenticated";

GRANT SELECT ON TABLE "public"."ai_usage" TO "authenticated";

GRANT UPDATE ON TABLE "public"."ai_usage" TO "authenticated";

GRANT INSERT ON TABLE "public"."audit_events" TO "app_runtime";

GRANT DELETE ON TABLE "public"."audit_events" TO "authenticated";

GRANT INSERT ON TABLE "public"."audit_events" TO "authenticated";

GRANT SELECT ON TABLE "public"."audit_events" TO "authenticated";

GRANT UPDATE ON TABLE "public"."audit_events" TO "authenticated";

GRANT INSERT ON TABLE "public"."calculation_snapshots" TO "app_runtime";

GRANT SELECT ON TABLE "public"."calculation_snapshots" TO "app_runtime";

GRANT DELETE ON TABLE "public"."calculation_snapshots" TO "authenticated";

GRANT INSERT ON TABLE "public"."calculation_snapshots" TO "authenticated";

GRANT SELECT ON TABLE "public"."calculation_snapshots" TO "authenticated";

GRANT UPDATE ON TABLE "public"."calculation_snapshots" TO "authenticated";

GRANT INSERT ON TABLE "public"."chat_conversations" TO "app_runtime";

GRANT SELECT ON TABLE "public"."chat_conversations" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."chat_conversations" TO "app_runtime";

GRANT DELETE ON TABLE "public"."chat_conversations" TO "authenticated";

GRANT INSERT ON TABLE "public"."chat_conversations" TO "authenticated";

GRANT SELECT ON TABLE "public"."chat_conversations" TO "authenticated";

GRANT UPDATE ON TABLE "public"."chat_conversations" TO "authenticated";

GRANT DELETE ON TABLE "public"."chat_messages" TO "app_runtime";

GRANT INSERT ON TABLE "public"."chat_messages" TO "app_runtime";

GRANT SELECT ON TABLE "public"."chat_messages" TO "app_runtime";

GRANT DELETE ON TABLE "public"."chat_messages" TO "authenticated";

GRANT INSERT ON TABLE "public"."chat_messages" TO "authenticated";

GRANT SELECT ON TABLE "public"."chat_messages" TO "authenticated";

GRANT UPDATE ON TABLE "public"."chat_messages" TO "authenticated";

GRANT INSERT ON TABLE "public"."expenses" TO "app_runtime";

GRANT SELECT ON TABLE "public"."expenses" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."expenses" TO "app_runtime";

GRANT DELETE ON TABLE "public"."expenses" TO "authenticated";

GRANT INSERT ON TABLE "public"."expenses" TO "authenticated";

GRANT SELECT ON TABLE "public"."expenses" TO "authenticated";

GRANT UPDATE ON TABLE "public"."expenses" TO "authenticated";

GRANT INSERT ON TABLE "public"."idempotency_records" TO "app_runtime";

GRANT SELECT ON TABLE "public"."idempotency_records" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."idempotency_records" TO "app_runtime";

GRANT DELETE ON TABLE "public"."idempotency_records" TO "authenticated";

GRANT INSERT ON TABLE "public"."idempotency_records" TO "authenticated";

GRANT SELECT ON TABLE "public"."idempotency_records" TO "authenticated";

GRANT UPDATE ON TABLE "public"."idempotency_records" TO "authenticated";

GRANT INSERT ON TABLE "public"."market_prices" TO "app_runtime";

GRANT SELECT ON TABLE "public"."market_prices" TO "app_runtime";

GRANT DELETE ON TABLE "public"."market_prices" TO "authenticated";

GRANT INSERT ON TABLE "public"."market_prices" TO "authenticated";

GRANT SELECT ON TABLE "public"."market_prices" TO "authenticated";

GRANT UPDATE ON TABLE "public"."market_prices" TO "authenticated";

GRANT DELETE ON TABLE "public"."product_ingredients" TO "app_runtime";

GRANT INSERT ON TABLE "public"."product_ingredients" TO "app_runtime";

GRANT SELECT ON TABLE "public"."product_ingredients" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."product_ingredients" TO "app_runtime";

GRANT DELETE ON TABLE "public"."product_ingredients" TO "authenticated";

GRANT INSERT ON TABLE "public"."product_ingredients" TO "authenticated";

GRANT SELECT ON TABLE "public"."product_ingredients" TO "authenticated";

GRANT UPDATE ON TABLE "public"."product_ingredients" TO "authenticated";

GRANT DELETE ON TABLE "public"."product_packaging" TO "app_runtime";

GRANT INSERT ON TABLE "public"."product_packaging" TO "app_runtime";

GRANT SELECT ON TABLE "public"."product_packaging" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."product_packaging" TO "app_runtime";

GRANT DELETE ON TABLE "public"."product_packaging" TO "authenticated";

GRANT INSERT ON TABLE "public"."product_packaging" TO "authenticated";

GRANT SELECT ON TABLE "public"."product_packaging" TO "authenticated";

GRANT UPDATE ON TABLE "public"."product_packaging" TO "authenticated";

GRANT INSERT ON TABLE "public"."products" TO "app_runtime";

GRANT SELECT ON TABLE "public"."products" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."products" TO "app_runtime";

GRANT DELETE ON TABLE "public"."products" TO "authenticated";

GRANT INSERT ON TABLE "public"."products" TO "authenticated";

GRANT SELECT ON TABLE "public"."products" TO "authenticated";

GRANT UPDATE ON TABLE "public"."products" TO "authenticated";

GRANT INSERT ON TABLE "public"."profiles" TO "app_runtime";

GRANT DELETE ON TABLE "public"."profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."purchase_price_history" TO "app_runtime";

GRANT SELECT ON TABLE "public"."purchase_price_history" TO "app_runtime";

GRANT DELETE ON TABLE "public"."purchase_price_history" TO "authenticated";

GRANT INSERT ON TABLE "public"."purchase_price_history" TO "authenticated";

GRANT SELECT ON TABLE "public"."purchase_price_history" TO "authenticated";

GRANT UPDATE ON TABLE "public"."purchase_price_history" TO "authenticated";

GRANT DELETE ON TABLE "public"."rate_limits" TO "app_runtime";

GRANT INSERT ON TABLE "public"."rate_limits" TO "app_runtime";

GRANT SELECT ON TABLE "public"."rate_limits" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."rate_limits" TO "app_runtime";

GRANT DELETE ON TABLE "public"."rate_limits" TO "authenticated";

GRANT INSERT ON TABLE "public"."rate_limits" TO "authenticated";

GRANT SELECT ON TABLE "public"."rate_limits" TO "authenticated";

GRANT UPDATE ON TABLE "public"."rate_limits" TO "authenticated";

GRANT DELETE ON TABLE "public"."sales_fees" TO "app_runtime";

GRANT INSERT ON TABLE "public"."sales_fees" TO "app_runtime";

GRANT SELECT ON TABLE "public"."sales_fees" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."sales_fees" TO "app_runtime";

GRANT DELETE ON TABLE "public"."sales_fees" TO "authenticated";

GRANT INSERT ON TABLE "public"."sales_fees" TO "authenticated";

GRANT SELECT ON TABLE "public"."sales_fees" TO "authenticated";

GRANT UPDATE ON TABLE "public"."sales_fees" TO "authenticated";

GRANT INSERT ON TABLE "public"."sales_items" TO "app_runtime";

GRANT SELECT ON TABLE "public"."sales_items" TO "app_runtime";

GRANT DELETE ON TABLE "public"."sales_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."sales_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."sales_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."sales_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."sales" TO "app_runtime";

GRANT SELECT ON TABLE "public"."sales" TO "app_runtime";

GRANT DELETE ON TABLE "public"."sales" TO "authenticated";

GRANT INSERT ON TABLE "public"."sales" TO "authenticated";

GRANT SELECT ON TABLE "public"."sales" TO "authenticated";

GRANT UPDATE ON TABLE "public"."sales" TO "authenticated";

GRANT DELETE ON TABLE "public"."sessions" TO "app_runtime";

GRANT INSERT ON TABLE "public"."sessions" TO "app_runtime";

GRANT SELECT ON TABLE "public"."sessions" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."sessions" TO "app_runtime";

GRANT DELETE ON TABLE "public"."sessions" TO "authenticated";

GRANT INSERT ON TABLE "public"."sessions" TO "authenticated";

GRANT SELECT ON TABLE "public"."sessions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."sessions" TO "authenticated";

GRANT INSERT ON TABLE "public"."simulations" TO "app_runtime";

GRANT SELECT ON TABLE "public"."simulations" TO "app_runtime";

GRANT DELETE ON TABLE "public"."simulations" TO "authenticated";

GRANT INSERT ON TABLE "public"."simulations" TO "authenticated";

GRANT SELECT ON TABLE "public"."simulations" TO "authenticated";

GRANT UPDATE ON TABLE "public"."simulations" TO "authenticated";

GRANT INSERT ON TABLE "public"."tenant_memberships" TO "app_runtime";

GRANT SELECT ON TABLE "public"."tenant_memberships" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."tenant_memberships" TO "app_runtime";

GRANT DELETE ON TABLE "public"."tenant_memberships" TO "authenticated";

GRANT INSERT ON TABLE "public"."tenant_memberships" TO "authenticated";

GRANT SELECT ON TABLE "public"."tenant_memberships" TO "authenticated";

GRANT UPDATE ON TABLE "public"."tenant_memberships" TO "authenticated";

GRANT INSERT ON TABLE "public"."tenants" TO "app_runtime";

GRANT DELETE ON TABLE "public"."tenants" TO "authenticated";

GRANT INSERT ON TABLE "public"."tenants" TO "authenticated";

GRANT SELECT ON TABLE "public"."tenants" TO "authenticated";

GRANT UPDATE ON TABLE "public"."tenants" TO "authenticated";

GRANT INSERT ON TABLE "public"."tool_executions" TO "app_runtime";

GRANT SELECT ON TABLE "public"."tool_executions" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."tool_executions" TO "app_runtime";

GRANT DELETE ON TABLE "public"."tool_executions" TO "authenticated";

GRANT INSERT ON TABLE "public"."tool_executions" TO "authenticated";

GRANT SELECT ON TABLE "public"."tool_executions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."tool_executions" TO "authenticated";

GRANT DELETE ON TABLE "public"."users" TO "app_runtime";

GRANT INSERT ON TABLE "public"."users" TO "app_runtime";

GRANT SELECT ON TABLE "public"."users" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."users" TO "app_runtime";

GRANT DELETE ON TABLE "public"."users" TO "authenticated";

GRANT INSERT ON TABLE "public"."users" TO "authenticated";

GRANT SELECT ON TABLE "public"."users" TO "authenticated";

GRANT UPDATE ON TABLE "public"."users" TO "authenticated";

GRANT DELETE ON TABLE "public"."verifications" TO "app_runtime";

GRANT INSERT ON TABLE "public"."verifications" TO "app_runtime";

GRANT SELECT ON TABLE "public"."verifications" TO "app_runtime";

GRANT UPDATE ON TABLE "public"."verifications" TO "app_runtime";

GRANT DELETE ON TABLE "public"."verifications" TO "authenticated";

GRANT INSERT ON TABLE "public"."verifications" TO "authenticated";

GRANT SELECT ON TABLE "public"."verifications" TO "authenticated";

GRANT UPDATE ON TABLE "public"."verifications" TO "authenticated";
