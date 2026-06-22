-- ============================================================
-- Tenant isolation: Row-Level Security policies + restricted runtime role
-- ============================================================
-- Enforces tenant isolation at the database. The app should connect as the
-- non-superuser `app_runtime` role so policies actually bite; migrations and
-- platform/cross-tenant operations run as the owner (superuser, which bypasses
-- RLS) or with the `app.is_platform` GUC set to 'on'.
--
-- Context GUCs (set transaction-locally by the app — see
-- packages/database/src/rls/tenant-context.ts):
--   app.current_tenant_id : the active tenant uuid
--   app.is_platform       : 'on' for audited platform/cross-tenant access
--
-- Policies are NULL-safe: an unset/empty GUC resolves to NULL (deny).
-- Phase 1 covers tables that already carry a tenant column. Child tables are
-- added in a later migration once tenant_id is denormalized onto them.
-- ============================================================

-- 1) Restricted runtime role (no DDL, cannot bypass RLS).
DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$role$;

GRANT USAGE ON SCHEMA
  "academic-structure", "audit-logging", "communication", "jwt-secrets",
  "profile", "roles-permissions", "security-policy", "student-management",
  "tenant", "user-management"
  TO app_runtime;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
  "academic-structure", "audit-logging", "communication", "jwt-secrets",
  "profile", "roles-permissions", "security-policy", "student-management",
  "tenant", "user-management"
  TO app_runtime;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA
  "academic-structure", "audit-logging", "communication", "jwt-secrets",
  "profile", "roles-permissions", "security-policy", "student-management",
  "tenant", "user-management"
  TO app_runtime;

-- 2) Enable + force RLS and attach a tenant-isolation policy per table.
--    (schema, table, tenant_column, nullable_tenant)
DO $rls$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Strict tenant-scoped (tenant column is NOT NULL)
      ('academic-structure', 'academic_years',          'tenant_id', false),
      ('academic-structure', 'courses',                  'tenant_id', false),
      ('academic-structure', 'grading_systems',          'tenant_id', false),
      ('audit-logging',      'audit_logs',               'tenant_id', false),
      ('communication',      'announcements',            'tenant_id', false),
      ('communication',      'messages',                 'tenant_id', false),
      ('jwt-secrets',        'tenant_jwt_configs',       'tenant_id', false),
      ('profile',            'user_tenants',             'tenant_id', false),
      ('student-management', 'students',                 'tenant_id', false),
      ('student-management', 'student_guardians',        'tenant_id', false),
      ('security-policy',    'school_security_policies',  'school_id', false),
      -- Nullable tenant: system/platform rows have NULL and stay globally visible
      ('roles-permissions',  'roles',                    'tenant_id', true),
      ('roles-permissions',  'permission_pools',         'tenant_id', true),
      ('roles-permissions',  'maker_checker_requests',   'tenant_id', true)
    ) AS t(sch, tbl, col, nullable)
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.sch, r.tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.sch, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.sch, r.tbl);

    IF r.nullable THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I.%I'
        || ' USING (current_setting(''app.is_platform'', true) = ''on'''
        || '        OR %I IS NULL'
        || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))'
        || ' WITH CHECK (current_setting(''app.is_platform'', true) = ''on'''
        || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
        r.sch, r.tbl, r.col, r.col, r.col);
    ELSE
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON %I.%I'
        || ' USING (current_setting(''app.is_platform'', true) = ''on'''
        || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))'
        || ' WITH CHECK (current_setting(''app.is_platform'', true) = ''on'''
        || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
        r.sch, r.tbl, r.col, r.col);
    END IF;
  END LOOP;
END
$rls$;
