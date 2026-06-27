-- ============================================================
-- Finance domain — Step 5 of backend remediation
-- ============================================================
-- Creates fee_invoices and payments in the "finance" schema.
-- Both are tenant-scoped (tenant_id NOT NULL). RLS applied
-- explicitly so db:rls:check passes from day one.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS "finance";

-- ---- fee_invoices ---------------------------------------------------

CREATE TABLE "finance"."fee_invoices" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "student_id"     TEXT NOT NULL,
  "class_id"       TEXT,
  "term_name"      TEXT,
  "term_year"      INTEGER,
  "term_cycle"     INTEGER,
  "issued_date"    DATE,
  "due_date"       DATE,
  "amount_due"     INTEGER NOT NULL DEFAULT 0,
  "amount_paid"    INTEGER NOT NULL DEFAULT 0,
  "status"         TEXT NOT NULL DEFAULT 'draft',
  "notes"          TEXT,
  "created_by"     TEXT,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fee_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_invoices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "fee_invoices_tenant_id_invoice_number_key"
  ON "finance"."fee_invoices"("tenant_id", "invoice_number");

CREATE INDEX "fee_invoices_tenant_id_idx"
  ON "finance"."fee_invoices"("tenant_id");
CREATE INDEX "fee_invoices_tenant_id_student_id_idx"
  ON "finance"."fee_invoices"("tenant_id", "student_id");
CREATE INDEX "fee_invoices_tenant_id_status_idx"
  ON "finance"."fee_invoices"("tenant_id", "status");
CREATE INDEX "fee_invoices_student_id_idx"
  ON "finance"."fee_invoices"("student_id");

-- ---- payments -------------------------------------------------------

CREATE TABLE "finance"."payments" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "invoice_id"     TEXT NOT NULL,
  "student_id"     TEXT NOT NULL,
  "method"         TEXT NOT NULL DEFAULT 'transfer',
  "paid_at"        DATE NOT NULL,
  "amount"         INTEGER NOT NULL,
  "reference"      TEXT,
  "status"         TEXT NOT NULL DEFAULT 'completed',
  "notes"          TEXT,
  "recorded_by"    TEXT,
  "created_by"     TEXT,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id")
    REFERENCES "finance"."fee_invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id")
    REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "payments_tenant_id_receipt_number_key"
  ON "finance"."payments"("tenant_id", "receipt_number");

CREATE INDEX "payments_tenant_id_idx"
  ON "finance"."payments"("tenant_id");
CREATE INDEX "payments_tenant_id_invoice_id_idx"
  ON "finance"."payments"("tenant_id", "invoice_id");
CREATE INDEX "payments_tenant_id_student_id_idx"
  ON "finance"."payments"("tenant_id", "student_id");
CREATE INDEX "payments_tenant_id_status_idx"
  ON "finance"."payments"("tenant_id", "status");
CREATE INDEX "payments_invoice_id_idx"
  ON "finance"."payments"("invoice_id");
CREATE INDEX "payments_student_id_idx"
  ON "finance"."payments"("student_id");

-- ---- RLS: fee_invoices ----------------------------------------------

ALTER TABLE "finance"."fee_invoices"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."fee_invoices"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "finance"."fee_invoices"
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

-- ---- RLS: payments --------------------------------------------------

ALTER TABLE "finance"."payments"
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."payments"
  FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation"
  ON "finance"."payments"
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

-- ---- Grant finance schema to app_runtime ----------------------------

GRANT USAGE ON SCHEMA "finance" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA "finance" TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA "finance"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
