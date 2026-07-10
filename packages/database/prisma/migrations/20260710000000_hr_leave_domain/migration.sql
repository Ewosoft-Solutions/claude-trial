-- ============================================================
-- HR leave domain — Step 8 sub-surface follow-up
-- ============================================================
-- Adds staff_leave_requests to the existing "hr" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE TABLE "hr"."staff_leave_requests" (
  "id"                   TEXT NOT NULL,
  "tenant_id"            TEXT NOT NULL,
  "staff_user_tenant_id" TEXT NOT NULL,
  "staff_name"           TEXT NOT NULL,
  "leave_type"           TEXT NOT NULL,
  "start_date"           DATE NOT NULL,
  "end_date"             DATE NOT NULL,
  "days"                 INTEGER NOT NULL,
  "reason"               TEXT,
  "status"               TEXT NOT NULL DEFAULT 'pending',
  "reviewed_by"          TEXT,
  "review_note"          TEXT,
  "created_by"           TEXT,
  "updated_by"           TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_leave_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_leave_requests_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_leave_requests_tenant_id_idx"
  ON "hr"."staff_leave_requests"("tenant_id");
CREATE INDEX "staff_leave_requests_tenant_id_status_idx"
  ON "hr"."staff_leave_requests"("tenant_id", "status");
CREATE INDEX "staff_leave_requests_staff_user_tenant_id_idx"
  ON "hr"."staff_leave_requests"("staff_user_tenant_id");

-- ---- RLS: staff_leave_requests ------------------------------------------

ALTER TABLE "hr"."staff_leave_requests"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr"."staff_leave_requests"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "hr"."staff_leave_requests"
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

-- ---- Grant new table to app_runtime -------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE
  ON "hr"."staff_leave_requests" TO app_runtime;
