-- ============================================================
-- Admissions domain — Step 8 of backend remediation
-- ============================================================
-- Creates admission_applications in the "admissions" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "admissions";

-- ---- admission_applications ------------------------------------------

CREATE TABLE "admissions"."admission_applications" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "applicant_name" TEXT NOT NULL,
  "applying_for"   TEXT NOT NULL,
  "guardian_name"  TEXT NOT NULL,
  "guardian_email" TEXT,
  "guardian_phone" TEXT,
  "submitted_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "stage"          TEXT NOT NULL DEFAULT 'application',
  "decision"       TEXT NOT NULL DEFAULT 'pending',
  "notes"          TEXT,
  "created_by"     TEXT,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admission_applications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "admission_applications_tenant_id_idx"
  ON "admissions"."admission_applications"("tenant_id");
CREATE INDEX "admission_applications_tenant_id_stage_idx"
  ON "admissions"."admission_applications"("tenant_id", "stage");
CREATE INDEX "admission_applications_tenant_id_decision_idx"
  ON "admissions"."admission_applications"("tenant_id", "decision");
CREATE INDEX "admission_applications_tenant_id_submitted_date_idx"
  ON "admissions"."admission_applications"("tenant_id", "submitted_date");

-- ---- RLS: admission_applications --------------------------------------

ALTER TABLE "admissions"."admission_applications"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admissions"."admission_applications"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "admissions"."admission_applications"
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grant admissions schema to app_runtime ---------------------------

GRANT USAGE ON SCHEMA "admissions" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "admissions" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "admissions"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
