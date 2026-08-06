-- ============================================================
-- Billing/AR P2 — durable family billing accounts (households)
-- ============================================================
-- Additive + idempotent. Introduces:
--   finance.billing_households — persistent family account
--   finance.household_members  — TEMPORAL student membership
--   finance.household_payers   — TEMPORAL payer (guardian) membership
-- and an optional finance.fee_invoices.household_id link. Nothing is
-- backfilled here; households are populated by the auto-derive pass
-- (shared primary/billing-guardian clusters) or created by an operator.

-- ---- billing_households ---------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."billing_households" (
  "id"                       TEXT NOT NULL,
  "tenant_id"                TEXT NOT NULL,
  "name"                     TEXT NOT NULL,
  "primary_payer_name"       TEXT,
  "derived_from_guardian_id" TEXT,
  "created_by"               TEXT,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_households_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_households_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
-- Postgres treats NULLs as distinct here, so many manual households (NULL
-- derived_from_guardian_id) coexist while auto households stay one-per-guardian.
CREATE UNIQUE INDEX IF NOT EXISTS "billing_households_tenant_id_derived_from_guardian_id_key"
  ON "finance"."billing_households"("tenant_id", "derived_from_guardian_id");
CREATE INDEX IF NOT EXISTS "billing_households_tenant_id_idx"
  ON "finance"."billing_households"("tenant_id");

-- ---- household_members ----------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."household_members" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "household_id"   TEXT NOT NULL,
  "student_id"     TEXT NOT NULL,
  "student_name"   TEXT,
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to"   TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "household_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_members_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "household_members_household_id_fkey"
    FOREIGN KEY ("household_id") REFERENCES "finance"."billing_households"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "household_members_tenant_id_idx"
  ON "finance"."household_members"("tenant_id");
CREATE INDEX IF NOT EXISTS "household_members_household_id_idx"
  ON "finance"."household_members"("household_id");
CREATE INDEX IF NOT EXISTS "household_members_tenant_id_student_id_idx"
  ON "finance"."household_members"("tenant_id", "student_id");

-- ---- household_payers -----------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."household_payers" (
  "id"             TEXT NOT NULL,
  "tenant_id"      TEXT NOT NULL,
  "household_id"   TEXT NOT NULL,
  "guardian_id"    TEXT NOT NULL,
  "payer_name"     TEXT,
  "role"           TEXT NOT NULL DEFAULT 'primary',
  "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to"   TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "household_payers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "household_payers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "household_payers_household_id_fkey"
    FOREIGN KEY ("household_id") REFERENCES "finance"."billing_households"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "household_payers_tenant_id_idx"
  ON "finance"."household_payers"("tenant_id");
CREATE INDEX IF NOT EXISTS "household_payers_household_id_idx"
  ON "finance"."household_payers"("household_id");
CREATE INDEX IF NOT EXISTS "household_payers_tenant_id_guardian_id_idx"
  ON "finance"."household_payers"("tenant_id", "guardian_id");

-- ---- fee_invoices.household_id (optional family link) ----------------
ALTER TABLE "finance"."fee_invoices"
  ADD COLUMN IF NOT EXISTS "household_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_invoices_household_id_fkey'
  ) THEN
    ALTER TABLE "finance"."fee_invoices"
      ADD CONSTRAINT "fee_invoices_household_id_fkey"
      FOREIGN KEY ("household_id")
      REFERENCES "finance"."billing_households"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "fee_invoices_tenant_id_household_id_idx"
  ON "finance"."fee_invoices"("tenant_id", "household_id");

-- ---- RLS: tenant isolation (required by db:rls:check) ----------------
ALTER TABLE "finance"."billing_households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."billing_households" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."billing_households";
CREATE POLICY "tenant_isolation" ON "finance"."billing_households"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

ALTER TABLE "finance"."household_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."household_members" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."household_members";
CREATE POLICY "tenant_isolation" ON "finance"."household_members"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

ALTER TABLE "finance"."household_payers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance"."household_payers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "finance"."household_payers";
CREATE POLICY "tenant_isolation" ON "finance"."household_payers"
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)
    OR current_setting('app.is_platform', true) = 'on'
  );

-- ---- Grants (finance ALTER DEFAULT PRIVILEGES exists; be explicit) ---
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."billing_households" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."household_members" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "finance"."household_payers" TO app_runtime;
