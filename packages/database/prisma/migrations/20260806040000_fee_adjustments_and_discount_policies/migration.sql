-- ============================================================
-- Billing/AR P1 slice 2 — discount policies + fee adjustments
-- ============================================================
-- Additive. Both tables start empty (no seed/backfill). Discretionary
-- adjustments and policy activation run through the WB1-6 maker-checker; the
-- amount an adjustment reduces is DERIVED into the invoice balance in slice 3.

-- ---- discount_policies ----------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."discount_policies" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "type"                TEXT NOT NULL,
  "fee_item_id"         TEXT,
  "amount"              INTEGER,
  "percent_bps"         INTEGER,
  "reason"              TEXT,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "approval_request_id" TEXT,
  "created_by"          TEXT,
  "approved_by"         TEXT,
  "approved_at"         TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "discount_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "discount_policies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "discount_policies_fee_item_id_fkey"
    FOREIGN KEY ("fee_item_id") REFERENCES "finance"."fee_items"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "discount_policies_tenant_id_idx"
  ON "finance"."discount_policies"("tenant_id");
CREATE INDEX IF NOT EXISTS "discount_policies_tenant_id_status_idx"
  ON "finance"."discount_policies"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "discount_policies_fee_item_id_idx"
  ON "finance"."discount_policies"("fee_item_id");

-- ---- fee_adjustments ------------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."fee_adjustments" (
  "id"                  TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL,
  "invoice_id"          TEXT NOT NULL,
  "line_id"             TEXT,
  "type"                TEXT NOT NULL,
  "source"              TEXT NOT NULL,
  "amount"              INTEGER NOT NULL DEFAULT 0,
  "reason"              TEXT,
  "policy_id"           TEXT,
  "status"              TEXT NOT NULL DEFAULT 'pending',
  "approval_request_id" TEXT,
  "requested_by"        TEXT,
  "approved_by"         TEXT,
  "approved_at"         TIMESTAMP(3),
  "applied_at"          TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fee_adjustments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_adjustments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "finance"."fee_invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_adjustments_line_id_fkey"
    FOREIGN KEY ("line_id") REFERENCES "finance"."fee_invoice_lines"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fee_adjustments_policy_id_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "finance"."discount_policies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "fee_adjustments_tenant_id_idx"
  ON "finance"."fee_adjustments"("tenant_id");
CREATE INDEX IF NOT EXISTS "fee_adjustments_tenant_id_invoice_id_idx"
  ON "finance"."fee_adjustments"("tenant_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "fee_adjustments_tenant_id_status_idx"
  ON "finance"."fee_adjustments"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "fee_adjustments_line_id_idx"
  ON "finance"."fee_adjustments"("line_id");
CREATE INDEX IF NOT EXISTS "fee_adjustments_policy_id_idx"
  ON "finance"."fee_adjustments"("policy_id");

-- ---- RLS: tenant isolation (required by db:rls:check) ----------------
ALTER TABLE "finance"."discount_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."discount_policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."discount_policies";
CREATE POLICY "tenant_isolation" ON "finance"."discount_policies"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

ALTER TABLE "finance"."fee_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."fee_adjustments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."fee_adjustments";
CREATE POLICY "tenant_isolation" ON "finance"."fee_adjustments"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grants ---------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."discount_policies" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."fee_adjustments" TO app_runtime;
