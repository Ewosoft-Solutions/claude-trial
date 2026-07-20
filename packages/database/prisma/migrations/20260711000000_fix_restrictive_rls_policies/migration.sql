-- ============================================================
-- Fix RESTRICTIVE-only tenant_isolation policies (RLS deny-all)
-- ============================================================
-- Several domain tables ended up with a RESTRICTIVE `tenant_isolation`
-- policy and NO permissive policy. In Postgres, restrictive policies only
-- subtract from what permissive policies allow — so a table with ONLY a
-- restrictive policy denies EVERY row to any non-owner role. Under the
-- app_runtime cutover (ADR-004) that silently blanks the affected tables
-- (finance, health, ai, learning, admissions, transport, attendance, events,
-- library, payroll, questions/assessments) at runtime. It was invisible while
-- the app ran as the owner (bypasses RLS), and db:rls:check only verified a
-- policy *exists*, not that it is permissive.
--
-- The domain migrations' source already declares these AS PERMISSIVE; the live
-- DB had drifted. This migration self-heals: for every RLS-enabled tenant table
-- that lacks a permissive policy, it drops any `tenant_isolation` policy and
-- recreates it PERMISSIVE with the standard NULLIF predicate (matching
-- enforce_tenant_rls / the students policy). Idempotent — a no-op once fixed.
-- ============================================================

DO $fix$
DECLARE
  r record;
  col text;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relrowsecurity                       -- RLS enabled
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns ic
        WHERE ic.table_schema = n.nspname AND ic.table_name = c.relname
          AND ic.column_name IN ('tenant_id', 'school_id')
      )
      AND NOT EXISTS (                           -- but no PERMISSIVE policy
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname
          AND p.permissive = 'PERMISSIVE'
      )
  LOOP
    SELECT ic.column_name INTO col
    FROM information_schema.columns ic
    WHERE ic.table_schema = r.sch AND ic.table_name = r.tbl
      AND ic.column_name IN ('tenant_id', 'school_id')
    ORDER BY CASE ic.column_name WHEN 'tenant_id' THEN 0 ELSE 1 END
    LIMIT 1;

    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I.%I', r.sch, r.tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I.%I AS PERMISSIVE FOR ALL TO PUBLIC'
      || ' USING (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))'
      || ' WITH CHECK (current_setting(''app.is_platform'', true) = ''on'''
      || '        OR %I = NULLIF(current_setting(''app.current_tenant_id'', true), ''''))',
      r.sch, r.tbl, col, col);
    RAISE NOTICE 'fix_restrictive_rls: re-permissived %.%', r.sch, r.tbl;
  END LOOP;
END
$fix$;
