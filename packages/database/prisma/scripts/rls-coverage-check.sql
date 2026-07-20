-- ============================================================
-- RLS coverage guard (CI gate)
-- ============================================================
-- The invariant that makes tenant isolation a STANDARD rather than a one-off:
--   every table that carries a tenant column (tenant_id or school_id) MUST have
--   ROW LEVEL SECURITY enabled + forced AND a PERMISSIVE `tenant_isolation`
--   policy. Permissive matters: a table with ONLY a RESTRICTIVE policy denies
--   EVERY row (restrictive policies only subtract from what permissive ones
--   allow), silently blanking the table under the app_runtime role.
--
-- Run in CI against a migrated DB:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f packages/database/prisma/scripts/rls-coverage-check.sql
--
-- Exits non-zero (RAISE EXCEPTION) and lists offenders if any tenant-scoped
-- table is missing RLS or its policy. Zero offenders => passes silently.
--
-- This is what catches a NEW tenant-scoped table that was added without RLS.
-- ============================================================
DO $guard$
DECLARE
  app_schemas text[] := ARRAY[
    'academic-structure','admissions','ai','audit-logging','communication','events','finance',
    'health','hr','jwt-secrets','learning','library','profile','roles-permissions','security-policy',
    'student-management','tenant','transportation','user-management'
  ];
  offender record;
  offenders text := '';
  n int := 0;
BEGIN
  FOR offender IN
    SELECT n.nspname AS sch, c.relname AS tbl,
           c.relrowsecurity AS rls_on, c.relforcerowsecurity AS rls_forced,
           EXISTS (
             SELECT 1 FROM pg_policies p
             WHERE p.schemaname = n.nspname AND p.tablename = c.relname
               AND p.policyname = 'tenant_isolation'
           ) AS has_policy,
           EXISTS (
             SELECT 1 FROM pg_policies p
             WHERE p.schemaname = n.nspname AND p.tablename = c.relname
               AND p.policyname = 'tenant_isolation'
               AND p.permissive = 'PERMISSIVE'
           ) AS has_permissive
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = ANY(app_schemas)
      AND EXISTS (
        SELECT 1 FROM information_schema.columns col
        WHERE col.table_schema = n.nspname
          AND col.table_name = c.relname
          AND col.column_name IN ('tenant_id','school_id')
      )
      AND NOT (
        c.relrowsecurity AND c.relforcerowsecurity
        -- Must have a PERMISSIVE tenant_isolation policy. A restrictive-only
        -- policy denies all rows, so `has_policy` alone is not enough.
        AND EXISTS (
          SELECT 1 FROM pg_policies p
          WHERE p.schemaname = n.nspname AND p.tablename = c.relname
            AND p.policyname = 'tenant_isolation'
            AND p.permissive = 'PERMISSIVE'
        )
      )
    ORDER BY 1, 2
  LOOP
    n := n + 1;
    offenders := offenders || format(
      E'\n  - %I.%I (rls_enabled=%s, forced=%s, policy=%s, permissive=%s)',
      offender.sch, offender.tbl, offender.rls_on, offender.rls_forced,
      offender.has_policy, offender.has_permissive);
  END LOOP;

  IF n > 0 THEN
    RAISE EXCEPTION
      'RLS coverage check FAILED: % tenant-scoped table(s) missing RLS/policy:%',
      n, offenders
      USING HINT = 'Add ENABLE/FORCE ROW LEVEL SECURITY + a tenant_isolation policy in your migration (see ADR-004 / docs/tenant-isolation-plan.md).';
  END IF;

  RAISE NOTICE 'RLS coverage check passed: all tenant-scoped tables are protected.';
END
$guard$;
