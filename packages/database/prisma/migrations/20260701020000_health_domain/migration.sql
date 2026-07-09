-- ============================================================
-- Health domain — Step 8 of backend remediation
-- ============================================================
-- Creates health_records in the "health" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "health";

-- ---- health_records ---------------------------------------------------

CREATE TABLE "health"."health_records" (
  "id"                      TEXT NOT NULL,
  "tenant_id"               TEXT NOT NULL,
  "student_id"              TEXT NOT NULL,
  "blood_type"              TEXT,
  "allergies"               TEXT,
  "conditions"              TEXT,
  "medications"             TEXT,
  "emergency_contact_name"  TEXT,
  "emergency_contact_phone" TEXT,
  "last_checkup"            DATE,
  "status"                  TEXT NOT NULL DEFAULT 'normal',
  "notes"                   TEXT,
  "created_by"              TEXT,
  "updated_by"              TEXT,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL,

  CONSTRAINT "health_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "health_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "health_records_student_id_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student-management"."students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "health_records_student_id_key"
  ON "health"."health_records"("student_id");
CREATE INDEX "health_records_tenant_id_idx"
  ON "health"."health_records"("tenant_id");
CREATE INDEX "health_records_tenant_id_status_idx"
  ON "health"."health_records"("tenant_id", "status");

-- ---- RLS: health_records ------------------------------------------------

ALTER TABLE "health"."health_records"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health"."health_records"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "health"."health_records"
  AS PERMISSIVE
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

-- ---- Grant health schema to app_runtime --------------------------------

GRANT USAGE ON SCHEMA "health" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "health" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "health"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
