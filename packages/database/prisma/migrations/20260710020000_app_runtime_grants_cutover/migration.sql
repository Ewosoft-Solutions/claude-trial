-- ============================================================
-- app_runtime runtime-cutover grants (ADR-004)
-- ============================================================
-- Makes the restricted `app_runtime` role safe to run the whole app as:
--  1) re-grants USAGE + DML on every current tenant schema/table (catches
--     tables added after the original point-in-time grants — notably
--     student-management.attendance_records, which had no app_runtime DML);
--  2) grants USAGE,SELECT on all sequences;
--  3) sets ALTER DEFAULT PRIVILEGES so tables/sequences created by later
--     migrations are auto-granted (prevents the drift this migration fixes
--     from recurring).
-- All statements are idempotent. app_runtime remains NOLOGIN-neutral here:
-- LOGIN + password is provisioned out-of-band per environment (secret).
-- ============================================================

DO $grants$
DECLARE
  s text;
  app_schemas text[] := ARRAY[
    'academic-structure', 'admissions', 'ai', 'audit-logging', 'communication',
    'events', 'finance', 'health', 'hr', 'jwt-secrets', 'learning', 'library',
    'profile', 'roles-permissions', 'security-policy', 'student-management',
    'tenant', 'transportation', 'user-management'
  ];
BEGIN
  FOREACH s IN ARRAY app_schemas LOOP
    -- Skip schemas that don't exist in this database (defensive).
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO app_runtime', s);
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO app_runtime', s);
      EXECUTE format(
        'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO app_runtime', s);
      -- Future objects created by the owner in this schema.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime', s);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO app_runtime', s);
    END IF;
  END LOOP;
END
$grants$;
