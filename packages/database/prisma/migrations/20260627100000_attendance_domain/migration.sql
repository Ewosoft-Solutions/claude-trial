-- ============================================================
-- Attendance domain — Step 4 of backend remediation
-- ============================================================
-- Creates attendance_records in the "student-management" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes even before enforce_tenant_rls() is called.
-- ============================================================

CREATE TABLE "student-management"."attendance_records" (
  "id"           TEXT NOT NULL,
  "tenant_id"    TEXT NOT NULL,
  "student_id"   TEXT NOT NULL,
  "class_id"     TEXT NOT NULL,
  "date"         DATE NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'present',
  "notes"        TEXT,
  "recorded_by"  TEXT,
  "created_by"   TEXT,
  "updated_by"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_records_student_id_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student-management"."students"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_records_class_id_fkey"
    FOREIGN KEY ("class_id")
    REFERENCES "academic-structure"."classes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "attendance_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- Unique: one record per student-class-day within a tenant
CREATE UNIQUE INDEX "attendance_records_tenant_id_student_id_class_id_date_key"
  ON "student-management"."attendance_records"("tenant_id", "student_id", "class_id", "date");

-- Query indexes
CREATE INDEX "attendance_records_tenant_id_idx"
  ON "student-management"."attendance_records"("tenant_id");
CREATE INDEX "attendance_records_tenant_id_class_id_date_idx"
  ON "student-management"."attendance_records"("tenant_id", "class_id", "date");
CREATE INDEX "attendance_records_tenant_id_student_id_idx"
  ON "student-management"."attendance_records"("tenant_id", "student_id");
CREATE INDEX "attendance_records_student_id_idx"
  ON "student-management"."attendance_records"("student_id");
CREATE INDEX "attendance_records_class_id_idx"
  ON "student-management"."attendance_records"("class_id");
CREATE INDEX "attendance_records_date_idx"
  ON "student-management"."attendance_records"("date");

-- ---- RLS (self-contained; enforce_tenant_rls() also picks this up) ----------
ALTER TABLE "student-management"."attendance_records"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student-management"."attendance_records"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "student-management"."attendance_records"
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
