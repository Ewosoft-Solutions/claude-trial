-- ============================================================
-- HR & Payroll domain — Step 8 of backend remediation
-- ============================================================
-- Creates staff_payroll_records in the "hr" schema.
-- Tenant-scoped (tenant_id NOT NULL). RLS applied explicitly so
-- db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "hr";

-- ---- staff_payroll_records ---------------------------------------------

CREATE TABLE "hr"."staff_payroll_records" (
  "id"                    TEXT NOT NULL,
  "tenant_id"             TEXT NOT NULL,
  "staff_user_tenant_id"  TEXT NOT NULL,
  "staff_name"            TEXT NOT NULL,
  "role"                  TEXT,
  "pay_period"            TEXT NOT NULL,
  "gross_pay"             DECIMAL(12,2) NOT NULL,
  "deductions"            DECIMAL(12,2) NOT NULL DEFAULT 0,
  "net_pay"               DECIMAL(12,2) NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'draft',
  "paid_date"             DATE,
  "created_by"            TEXT,
  "updated_by"            TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "staff_payroll_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_payroll_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "staff_payroll_records_tenant_id_idx"
  ON "hr"."staff_payroll_records"("tenant_id");
CREATE INDEX "staff_payroll_records_tenant_id_status_idx"
  ON "hr"."staff_payroll_records"("tenant_id", "status");
CREATE INDEX "staff_payroll_records_tenant_id_pay_period_idx"
  ON "hr"."staff_payroll_records"("tenant_id", "pay_period");
CREATE INDEX "staff_payroll_records_staff_user_tenant_id_idx"
  ON "hr"."staff_payroll_records"("staff_user_tenant_id");

-- ---- RLS: staff_payroll_records -----------------------------------------

ALTER TABLE "hr"."staff_payroll_records"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr"."staff_payroll_records"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "hr"."staff_payroll_records"
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

-- ---- Grant hr schema to app_runtime -------------------------------------

GRANT USAGE ON SCHEMA "hr" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "hr" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "hr"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
