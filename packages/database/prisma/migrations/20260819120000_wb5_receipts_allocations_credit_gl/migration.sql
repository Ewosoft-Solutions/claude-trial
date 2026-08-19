-- ============================================================
-- WB5 · Receipts + allocations, unapplied credit, and the double-entry GL
-- ============================================================
-- Three things land together because they are one accounting change:
--
--   1. A `Payment` stops being "a payment against ONE invoice" and becomes a
--      RECEIPT of money received, spread over invoices by
--      `payment_allocations`. This is what lets a parent pay once for two
--      children (ADR-05 Q21) and what lets an invoice collect installments.
--   2. Money received beyond what was settled parks in `account_credits` as an
--      accounts-receivable CREDIT BALANCE (never stored value — ADR-05: we are
--      not a payment custodian), drawn down by `credit_applications`.
--   3. Every one of those events posts a balanced entry into a real
--      double-entry general ledger (ADR-10): `chart_of_accounts`,
--      `accounting_periods`, `journal_entries`, `journal_lines`.
--
-- Plus `finance_number_sequences` — gap-aware, never-reused receipt numbers
-- (ADR-05 Q23), replacing the timestamp+random string that could not be
-- reconciled or audited for gaps.
--
-- MIGRATION SAFETY: existing payments are backfilled into allocations BEFORE
-- `payments.invoice_id`/`student_id` are dropped, so no settlement history is
-- lost. Everything else is additive. Cross-schema references (student_id,
-- household member ids) stay soft, validated in-service, as in every prior
-- finance migration; tenant_id is a real FK.
-- ============================================================

-- ---- finance.payment_allocations ----------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."payment_allocations" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount"     INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_allocations_payment_id_invoice_id_key" ON "finance"."payment_allocations"("payment_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_id_idx" ON "finance"."payment_allocations"("tenant_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_id_invoice_id_idx" ON "finance"."payment_allocations"("tenant_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_payment_id_idx" ON "finance"."payment_allocations"("payment_id");

-- ---- finance.account_credits --------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."account_credits" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "household_id" TEXT,
    "student_id"   TEXT,
    "source"       TEXT NOT NULL DEFAULT 'overpayment',
    "amount"       INTEGER NOT NULL DEFAULT 0,
    "remaining"    INTEGER NOT NULL DEFAULT 0,
    "reason"       TEXT,
    "payment_id"   TEXT,
    "status"       TEXT NOT NULL DEFAULT 'active',
    "created_by"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "account_credits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "account_credits_tenant_id_idx" ON "finance"."account_credits"("tenant_id");
CREATE INDEX IF NOT EXISTS "account_credits_tenant_id_household_id_idx" ON "finance"."account_credits"("tenant_id", "household_id");
CREATE INDEX IF NOT EXISTS "account_credits_tenant_id_student_id_idx" ON "finance"."account_credits"("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "account_credits_tenant_id_status_idx" ON "finance"."account_credits"("tenant_id", "status");

-- ---- finance.credit_applications ----------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."credit_applications" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "credit_id"  TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount"     INTEGER NOT NULL DEFAULT 0,
    "applied_by" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_applications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "credit_applications_tenant_id_idx" ON "finance"."credit_applications"("tenant_id");
CREATE INDEX IF NOT EXISTS "credit_applications_tenant_id_invoice_id_idx" ON "finance"."credit_applications"("tenant_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "credit_applications_credit_id_idx" ON "finance"."credit_applications"("credit_id");

-- ---- finance.finance_number_sequences -----------------------------------
CREATE TABLE IF NOT EXISTS "finance"."finance_number_sequences" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "kind"       TEXT NOT NULL,
    "scope_key"  TEXT NOT NULL,
    "prefix"     TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_number_sequences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "finance_number_sequences_tenant_id_kind_scope_key_key" ON "finance"."finance_number_sequences"("tenant_id", "kind", "scope_key");
CREATE INDEX IF NOT EXISTS "finance_number_sequences_tenant_id_idx" ON "finance"."finance_number_sequences"("tenant_id");

-- ---- finance.chart_of_accounts ------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."chart_of_accounts" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "code"           TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "normal_balance" TEXT NOT NULL,
    "system_key"     TEXT,
    "active"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_tenant_id_code_key" ON "finance"."chart_of_accounts"("tenant_id", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "chart_of_accounts_tenant_id_system_key_key" ON "finance"."chart_of_accounts"("tenant_id", "system_key");
CREATE INDEX IF NOT EXISTS "chart_of_accounts_tenant_id_idx" ON "finance"."chart_of_accounts"("tenant_id");

-- ---- finance.accounting_periods -----------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."accounting_periods" (
    "id"         TEXT NOT NULL,
    "tenant_id"  TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date"   DATE NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'open',
    "closed_by"  TEXT,
    "closed_at"  TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_periods_tenant_id_name_key" ON "finance"."accounting_periods"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "accounting_periods_tenant_id_idx" ON "finance"."accounting_periods"("tenant_id");
CREATE INDEX IF NOT EXISTS "accounting_periods_tenant_id_status_idx" ON "finance"."accounting_periods"("tenant_id", "status");

-- ---- finance.journal_entries --------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."journal_entries" (
    "id"             TEXT NOT NULL,
    "tenant_id"      TEXT NOT NULL,
    "entry_number"   TEXT NOT NULL,
    "entry_date"     DATE NOT NULL,
    "period_id"      TEXT,
    "memo"           TEXT,
    "source_type"    TEXT NOT NULL,
    "source_id"      TEXT,
    "status"         TEXT NOT NULL DEFAULT 'posted',
    "reversal_of_id" TEXT,
    "posted_by"      TEXT,
    "posted_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_tenant_id_entry_number_key" ON "finance"."journal_entries"("tenant_id", "entry_number");
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_id_idx" ON "finance"."journal_entries"("tenant_id");
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_id_entry_date_idx" ON "finance"."journal_entries"("tenant_id", "entry_date");
CREATE INDEX IF NOT EXISTS "journal_entries_tenant_id_source_type_source_id_idx" ON "finance"."journal_entries"("tenant_id", "source_type", "source_id");
CREATE INDEX IF NOT EXISTS "journal_entries_period_id_idx" ON "finance"."journal_entries"("period_id");

-- ---- finance.journal_lines ----------------------------------------------
CREATE TABLE IF NOT EXISTS "finance"."journal_lines" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "entry_id"     TEXT NOT NULL,
    "account_id"   TEXT NOT NULL,
    "debit"        INTEGER NOT NULL DEFAULT 0,
    "credit"       INTEGER NOT NULL DEFAULT 0,
    "description"  TEXT,
    "invoice_id"   TEXT,
    "household_id" TEXT,
    "student_id"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "journal_lines_tenant_id_idx" ON "finance"."journal_lines"("tenant_id");
CREATE INDEX IF NOT EXISTS "journal_lines_entry_id_idx" ON "finance"."journal_lines"("entry_id");
CREATE INDEX IF NOT EXISTS "journal_lines_tenant_id_account_id_idx" ON "finance"."journal_lines"("tenant_id", "account_id");
CREATE INDEX IF NOT EXISTS "journal_lines_tenant_id_invoice_id_idx" ON "finance"."journal_lines"("tenant_id", "invoice_id");

-- ---- Foreign keys --------------------------------------------------------
DO $fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_allocations_tenant_id_fkey') THEN
    ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_allocations_payment_id_fkey') THEN
    ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_allocations_invoice_id_fkey') THEN
    ALTER TABLE "finance"."payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "finance"."fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_credits_tenant_id_fkey') THEN
    ALTER TABLE "finance"."account_credits" ADD CONSTRAINT "account_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_credits_household_id_fkey') THEN
    ALTER TABLE "finance"."account_credits" ADD CONSTRAINT "account_credits_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "finance"."billing_households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_credits_payment_id_fkey') THEN
    ALTER TABLE "finance"."account_credits" ADD CONSTRAINT "account_credits_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "finance"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_applications_tenant_id_fkey') THEN
    ALTER TABLE "finance"."credit_applications" ADD CONSTRAINT "credit_applications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_applications_credit_id_fkey') THEN
    ALTER TABLE "finance"."credit_applications" ADD CONSTRAINT "credit_applications_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "finance"."account_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_applications_invoice_id_fkey') THEN
    ALTER TABLE "finance"."credit_applications" ADD CONSTRAINT "credit_applications_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "finance"."fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_number_sequences_tenant_id_fkey') THEN
    ALTER TABLE "finance"."finance_number_sequences" ADD CONSTRAINT "finance_number_sequences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chart_of_accounts_tenant_id_fkey') THEN
    ALTER TABLE "finance"."chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_periods_tenant_id_fkey') THEN
    ALTER TABLE "finance"."accounting_periods" ADD CONSTRAINT "accounting_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_tenant_id_fkey') THEN
    ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_period_id_fkey') THEN
    ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "finance"."accounting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_reversal_of_id_fkey') THEN
    ALTER TABLE "finance"."journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "finance"."journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_tenant_id_fkey') THEN
    ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_entry_id_fkey') THEN
    ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "finance"."journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_account_id_fkey') THEN
    ALTER TABLE "finance"."journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance"."chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$fks$;

-- ---- payments becomes a receipt ------------------------------------------
ALTER TABLE "finance"."payments" ADD COLUMN IF NOT EXISTS "household_id" TEXT;
ALTER TABLE "finance"."payments" ADD COLUMN IF NOT EXISTS "payer_name" TEXT;
ALTER TABLE "finance"."payments" ADD COLUMN IF NOT EXISTS "reprint_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "finance"."payments" ADD COLUMN IF NOT EXISTS "last_reprinted_at" TIMESTAMP(3);

DO $fk_pay$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_household_id_fkey') THEN
    ALTER TABLE "finance"."payments" ADD CONSTRAINT "payments_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "finance"."billing_households"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$fk_pay$;

-- Backfill: every existing payment becomes a one-invoice allocation, and takes
-- the household + billed name its invoice carried. Runs ONLY while the old
-- column still exists, so re-running the migration is a no-op.
DO $backfill$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'finance' AND table_name = 'payments' AND column_name = 'invoice_id'
  ) THEN
    -- Only money that was actually received settles anything. A pending,
    -- failed or refunded payment becoming an allocation would silently mark
    -- its invoice as paid.
    INSERT INTO "finance"."payment_allocations" ("id", "tenant_id", "payment_id", "invoice_id", "amount", "created_by", "created_at")
    SELECT gen_random_uuid()::text, p."tenant_id", p."id", p."invoice_id", p."amount", p."recorded_by", p."created_at"
    FROM "finance"."payments" p
    WHERE p."invoice_id" IS NOT NULL AND p."status" = 'completed'
    ON CONFLICT ("payment_id", "invoice_id") DO NOTHING;

    -- The household carries over. The PAYER does not: the old model recorded
    -- who was billed, not who paid, and stamping the child's name into
    -- `payer_name` would put it on every reprinted historical receipt.
    UPDATE "finance"."payments" p
    SET "household_id" = i."household_id"
    FROM "finance"."fee_invoices" i
    WHERE i."id" = p."invoice_id" AND p."household_id" IS NULL;
  END IF;
END
$backfill$;

-- The old one-to-one link and the student snapshot are now derived from the
-- allocations (allocation → invoice → student), so they are dropped rather than
-- left to drift out of agreement with them.
ALTER TABLE "finance"."payments" DROP CONSTRAINT IF EXISTS "payments_invoice_id_fkey";
DROP INDEX IF EXISTS "finance"."payments_tenant_id_invoice_id_idx";
DROP INDEX IF EXISTS "finance"."payments_tenant_id_student_id_idx";
DROP INDEX IF EXISTS "finance"."payments_invoice_id_idx";
DROP INDEX IF EXISTS "finance"."payments_student_id_idx";
ALTER TABLE "finance"."payments" DROP COLUMN IF EXISTS "invoice_id";
ALTER TABLE "finance"."payments" DROP COLUMN IF EXISTS "student_id";

CREATE INDEX IF NOT EXISTS "payments_tenant_id_household_id_idx" ON "finance"."payments"("tenant_id", "household_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_paid_at_idx" ON "finance"."payments"("tenant_id", "paid_at");

-- ---- RLS (ENABLE + FORCE + tenant_isolation) -----------------------------
DO $rls$
DECLARE
  tables text[][] := ARRAY[
    ARRAY['finance','payment_allocations'],
    ARRAY['finance','account_credits'],
    ARRAY['finance','credit_applications'],
    ARRAY['finance','finance_number_sequences'],
    ARRAY['finance','chart_of_accounts'],
    ARRAY['finance','accounting_periods'],
    ARRAY['finance','journal_entries'],
    ARRAY['finance','journal_lines']
  ];
  i int;
  sch text;
  tbl text;
BEGIN
  FOR i IN 1 .. array_length(tables, 1) LOOP
    sch := tables[i][1];
    tbl := tables[i][2];
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', sch, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I.%I', sch, tbl);
    EXECUTE format($p$
      CREATE POLICY "tenant_isolation" ON %I.%I
        AS PERMISSIVE FOR ALL TO PUBLIC
        USING (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.current_tenant_id', true)
          OR current_setting('app.is_platform', true) = 'on'
        )
    $p$, sch, tbl);
  END LOOP;
END
$rls$;

-- app_runtime needs the new tables (mirrors every prior migration).
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA "finance" TO app_runtime';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "finance" TO app_runtime';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA "finance" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime';
  END IF;
END
$grants$;
