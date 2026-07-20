-- ============================================================
-- Make tenant isolation a STANDARD (not a one-off list)
-- ============================================================
-- Two mechanisms so new tables/models adhere automatically:
--   1) ALTER DEFAULT PRIVILEGES — future tables created by the migration owner
--      auto-grant CRUD to app_runtime (so a new table is reachable without a
--      manual GRANT, but still RLS-protected).
--   2) enforce_tenant_rls() — idempotent helper that applies the strict
--      tenant_isolation policy to ANY tenant-scoped table that is missing one.
--      Safe by default (denies cross-tenant + NULL); it SKIPS tables that
--      already have a tenant_isolation policy, so the hand-crafted nullable
--      catalog policies (roles/permission_pools/maker_checker_requests) are
--      never clobbered.
--
-- Companion CI gate: packages/database/prisma/scripts/rls-coverage-check.sql
-- fails the build if any tenant-scoped table lacks RLS.
-- ============================================================

-- 1) Default privileges for FUTURE tables/sequences created by the owner.
--    No `FOR ROLE <name>`: default privileges apply to CURRENT_USER, i.e. the
--    role actually running the migration. Hardcoding `postgres` only worked
--    where the owner happened to be named `postgres` (local dev, CI) and failed
--    on managed Postgres (Render owns the DB as a generated user), where the
--    role either does not exist or we are not a member of it. The portable form
--    matches every other migration in this directory, and
--    20260710020000_app_runtime_grants_cutover re-applies the same default
--    privileges per schema anyway.
ALTER DEFAULT PRIVILEGES IN SCHEMA
  "academic-structure", "audit-logging", "communication", "jwt-secrets",
  "profile", "roles-permissions", "security-policy", "student-management",
  "tenant", "user-management"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA
  "academic-structure", "audit-logging", "communication", "jwt-secrets",
  "profile", "roles-permissions", "security-policy", "student-management",
  "tenant", "user-management"
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- 2) Idempotent enforcer: strict RLS for any tenant-scoped table missing a policy.
CREATE OR REPLACE FUNCTION public.enforce_tenant_rls() RETURNS void AS $fn$
DECLARE
  app_schemas text[] := ARRAY[
    'academic-structure','audit-logging','communication','jwt-secrets',
    'profile','roles-permissions','security-policy','student-management',
    'tenant','user-management'
  ];
  t record;
  col text;
BEGIN
  FOR t IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = ANY(app_schemas)
      AND EXISTS (
        SELECT 1 FROM information_schema.columns ic
        WHERE ic.table_schema = n.nspname AND ic.table_name = c.relname
          AND ic.column_name IN ('tenant_id','school_id')
      )
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname
          AND p.policyname = 'tenant_isolation'
      )
  LOOP
    -- Prefer tenant_id, fall back to school_id.
    SELECT ic.column_name INTO col
    FROM information_schema.columns ic
    WHERE ic.table_schema = t.sch AND ic.table_name = t.tbl
      AND ic.column_name IN ('tenant_id','school_id')
    ORDER BY CASE ic.column_name WHEN 'tenant_id' THEN 0 ELSE 1 END
    LIMIT 1;

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.sch, t.tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', t.sch, t.tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I'
      || ' USING (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))'
      || ' WITH CHECK (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
      t.sch, t.tbl, col, col);
    RAISE NOTICE 'enforce_tenant_rls: applied strict tenant_isolation to %.%', t.sch, t.tbl;
  END LOOP;
END
$fn$ LANGUAGE plpgsql;

-- Apply now (no-op today — all current tenant tables already have policies).
SELECT public.enforce_tenant_rls();
