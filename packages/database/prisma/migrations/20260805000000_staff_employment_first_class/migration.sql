-- ============================================================
-- First-class staff employment (WB1-2)
-- ============================================================
-- Makes the F1 person.staff_profiles a MANAGED employment domain (created /
-- updated / disabled independent of any payroll run) and gives it the depth a
-- real HR record needs:
--   • a reporting line   — self-relation reports_to_staff_profile_id
--   • qualifications      — new person.staff_qualifications child table (RLS)
--   • an account link     — loose user_tenant_id (HR loose-ref convention)
--   • migration source keys — (source_system, source_id) for an idempotent
--                             back-fill from the legacy payroll-as-directory.
--
-- The ALTERs are additive (every new column nullable / no default change), so
-- existing rows are untouched and staff_profiles' RLS (ENABLE+FORCE +
-- tenant_isolation from 20260801010000) is unchanged. The one new table gets its
-- own RLS + app_runtime grants so db:rls:check stays green.
-- ============================================================

-- ---- staff_profiles: employment depth (additive) ------------------------
ALTER TABLE "person"."staff_profiles"
  ADD COLUMN IF NOT EXISTS "user_tenant_id"              TEXT,
  ADD COLUMN IF NOT EXISTS "end_reason"                  TEXT,
  ADD COLUMN IF NOT EXISTS "reports_to_staff_profile_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_system"               TEXT,
  ADD COLUMN IF NOT EXISTS "source_id"                   TEXT,
  ADD COLUMN IF NOT EXISTS "updated_by"                  TEXT;

-- Reporting line self-FK: SetNull so ending a manager's employment does not
-- cascade-delete their reports.
ALTER TABLE "person"."staff_profiles"
  DROP CONSTRAINT IF EXISTS "staff_profiles_reports_to_fkey";
ALTER TABLE "person"."staff_profiles"
  ADD CONSTRAINT "staff_profiles_reports_to_fkey"
  FOREIGN KEY ("reports_to_staff_profile_id")
  REFERENCES "person"."staff_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "staff_profiles_reports_to_idx"
  ON "person"."staff_profiles"("reports_to_staff_profile_id");

-- Idempotent back-fill key. NULLs are distinct in a unique index, so profiles
-- created by hand (no source keys) are unconstrained; only sourced rows dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS "staff_profiles_source_key"
  ON "person"."staff_profiles"("tenant_id", "source_system", "source_id");

-- ---- staff_qualifications (new table + RLS) -----------------------------
CREATE TABLE IF NOT EXISTS "person"."staff_qualifications" (
    "id"                 TEXT NOT NULL,
    "tenant_id"          TEXT NOT NULL,
    "staff_profile_id"   TEXT NOT NULL,
    "qualification_type" TEXT,
    "title"              TEXT NOT NULL,
    "institution"        TEXT,
    "field_of_study"     TEXT,
    "awarded_year"       INTEGER,
    "document_id"        TEXT,
    "created_by"         TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_qualifications_tenant_id_idx"
  ON "person"."staff_qualifications"("tenant_id");
CREATE INDEX IF NOT EXISTS "staff_qualifications_staff_profile_id_idx"
  ON "person"."staff_qualifications"("staff_profile_id");

ALTER TABLE "person"."staff_qualifications"
  DROP CONSTRAINT IF EXISTS "staff_qualifications_staff_profile_id_fkey";
ALTER TABLE "person"."staff_qualifications"
  ADD CONSTRAINT "staff_qualifications_staff_profile_id_fkey"
  FOREIGN KEY ("staff_profile_id")
  REFERENCES "person"."staff_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: tenant_id NON-NULL → own-tenant only, or the audited platform bypass.
ALTER TABLE "person"."staff_qualifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person"."staff_qualifications" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "person"."staff_qualifications"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- person schema already grants app_runtime (20260801010000). Re-grant on the
-- new table explicitly so it is covered even if default privileges do not apply.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "person"."staff_qualifications" TO app_runtime;

-- ---- Back-fill employment from the legacy payroll-as-directory -----------
-- The legacy directory was derived from hr.staff_payroll_records. For every
-- staff member who appears there and is anchored to a Person (F1) but has no
-- StaffProfile yet, materialise a first-class employment record tagged with
-- source keys. Idempotent (ON CONFLICT on the source key), cross-tenant (runs
-- under the audited platform scope, which both the person and hr policies
-- honour). A no-op when there is nothing to migrate.
DO $backfill$
DECLARE
  n_employment integer;
BEGIN
  PERFORM set_config('app.is_platform', 'on', true);

  INSERT INTO "person"."staff_profiles"
    ("id", "tenant_id", "person_id", "user_tenant_id", "job_title",
     "employment_status", "source_system", "source_id",
     "created_by", "created_at", "updated_at")
  SELECT
    gen_random_uuid()::text,
    pr.tenant_id,
    p.id,
    pr.staff_user_tenant_id,
    -- Most-recent payroll run's role as the seed job title.
    (SELECT pr2.role FROM "hr"."staff_payroll_records" pr2
       WHERE pr2.staff_user_tenant_id = pr.staff_user_tenant_id
         AND pr2.tenant_id = pr.tenant_id
       ORDER BY pr2.created_at DESC NULLS LAST LIMIT 1),
    'active',
    'payroll',
    pr.staff_user_tenant_id,
    'system:wb1-2-migration',
    now(), now()
  FROM (
    SELECT DISTINCT tenant_id, staff_user_tenant_id
    FROM "hr"."staff_payroll_records"
  ) pr
  JOIN "person"."persons" p
    ON p.user_tenant_id = pr.staff_user_tenant_id
   AND p.tenant_id = pr.tenant_id
   AND p.status = 'active'
  -- Only anchor payroll people who have no employment record yet, so a school
  -- that already manages staff first-class is never given a duplicate stint.
  WHERE NOT EXISTS (
    SELECT 1 FROM "person"."staff_profiles" sp
    WHERE sp.person_id = p.id
  )
  ON CONFLICT ("tenant_id", "source_system", "source_id") DO NOTHING;

  GET DIAGNOSTICS n_employment = ROW_COUNT;
  RAISE NOTICE 'WB1-2 back-fill: % employment record(s) created from payroll.', n_employment;
END
$backfill$;
