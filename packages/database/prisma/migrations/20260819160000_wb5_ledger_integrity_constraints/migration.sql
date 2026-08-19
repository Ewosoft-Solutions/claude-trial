-- ============================================================
-- WB5 · Database-level backstops for the ledger invariants
-- ============================================================
-- The posting service enforces all of these in code, and it is the only writer.
-- That is an argument for keeping the rules right, not for leaving the database
-- willing to store a book that cannot be true — a constraint costs nothing and
-- turns "we always call the one writer" from a convention into a fact.
--
--   1. ONE opening entry per tenant. The opening balance is posted lazily, and
--      two concurrent readers (a bursar with /finance/ledger open in one tab
--      and /finance/reports in another) could each find none and post the whole
--      pre-existing debt. The trial balance cannot detect that — both entries
--      balance — so the guarantee has to be here.
--   2. A journal line is a debit or a credit, never both, and never negative
--      (the redesign of the legacy negative-amount reversal, parity job #95).
--   3. Money rows carry positive amounts, and a credit can never be drawn below
--      zero or above what was received.
--
-- Additive and idempotent; no data is rewritten.
-- ============================================================

-- 1 · one opening entry per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_one_opening_per_tenant"
  ON "finance"."journal_entries" ("tenant_id")
  WHERE "source_type" = 'opening';

-- 2 · a line is one-sided and non-negative
DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_lines_one_sided') THEN
    ALTER TABLE "finance"."journal_lines"
      ADD CONSTRAINT "journal_lines_one_sided"
      CHECK ("debit" >= 0 AND "credit" >= 0 AND NOT ("debit" > 0 AND "credit" > 0));
  END IF;

  -- 3 · money rows are positive, and credit stays within what was received
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_allocations_amount_positive') THEN
    ALTER TABLE "finance"."payment_allocations"
      ADD CONSTRAINT "payment_allocations_amount_positive" CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credit_applications_amount_positive') THEN
    ALTER TABLE "finance"."credit_applications"
      ADD CONSTRAINT "credit_applications_amount_positive" CHECK ("amount" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_credits_remaining_within_amount') THEN
    ALTER TABLE "finance"."account_credits"
      ADD CONSTRAINT "account_credits_remaining_within_amount"
      CHECK ("amount" >= 0 AND "remaining" >= 0 AND "remaining" <= "amount");
  END IF;
END
$checks$;
