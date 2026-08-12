DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  ELSE
    ALTER ROLE app_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END
$role$;
--> statement-breakpoint
DO $grant_runtime$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_runtime', current_database());
  EXECUTE format('GRANT app_runtime TO %I', current_user);
END
$grant_runtime$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app_private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public, app_private TO app_runtime;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  users,
  sessions,
  accounts,
  verifications,
  tenants,
  tenant_memberships,
  profiles,
  products,
  product_ingredients,
  product_packaging,
  sales_fees,
  market_prices,
  expenses,
  simulations,
  chat_conversations,
  chat_messages,
  idempotency_records,
  tool_executions,
  ai_daily_budgets,
  audit_events
TO app_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT nullif(current_setting('app.current_user_id', true), '')
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT nullif(current_setting('app.current_tenant_id', true), '')::uuid
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_private.has_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    WHERE membership.tenant_id = target_tenant_id
      AND membership.user_id = app_private.current_user_id()
  )
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.current_user_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.current_tenant_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app_private.has_tenant_access(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_user_id() TO app_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.current_tenant_id() TO app_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_private.has_tenant_access(uuid) TO app_runtime;
--> statement-breakpoint
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenants_select ON tenants
  FOR SELECT TO app_runtime
  USING (
    id = app_private.current_tenant_id()
    AND app_private.has_tenant_access(id)
  );
--> statement-breakpoint
CREATE POLICY tenants_insert ON tenants
  FOR INSERT TO app_runtime
  WITH CHECK (
    id = app_private.current_tenant_id()
    AND app_private.current_user_id() IS NOT NULL
  );
--> statement-breakpoint
CREATE POLICY tenants_update ON tenants
  FOR UPDATE TO app_runtime
  USING (
    id = app_private.current_tenant_id()
    AND app_private.has_tenant_access(id)
  )
  WITH CHECK (
    id = app_private.current_tenant_id()
    AND app_private.has_tenant_access(id)
  );
--> statement-breakpoint
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_memberships_select ON tenant_memberships
  FOR SELECT TO app_runtime
  USING (user_id = app_private.current_user_id());
--> statement-breakpoint
CREATE POLICY tenant_memberships_insert_self ON tenant_memberships
  FOR INSERT TO app_runtime
  WITH CHECK (
    tenant_id = app_private.current_tenant_id()
    AND user_id = app_private.current_user_id()
  );
--> statement-breakpoint
DO $tenant_rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'products',
    'product_ingredients',
    'product_packaging',
    'sales_fees',
    'market_prices',
    'expenses',
    'simulations',
    'chat_conversations',
    'chat_messages',
    'idempotency_records',
    'tool_executions',
    'ai_daily_budgets',
    'audit_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I TO app_runtime USING (
        tenant_id = app_private.current_tenant_id()
        AND app_private.has_tenant_access(tenant_id)
      ) WITH CHECK (
        tenant_id = app_private.current_tenant_id()
        AND app_private.has_tenant_access(tenant_id)
      )',
      table_name
    );
  END LOOP;
END
$tenant_rls$;
